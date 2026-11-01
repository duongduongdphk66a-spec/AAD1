import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';
import { GoogleGenAI, Type } from '@google/genai';
import {
  BIOMES,
  PREFAB_CATALOG,
  TEXTURE_INDEX_MAP,
} from './src/world/registry';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const isProd =
  process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

// Configure reverse proxy hops based on environment (prevents X-Forwarded-For spoofing when running directly)
const hops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.K_SERVICE ? 1 : 0));
app.set('trust proxy', hops > 0 ? hops : false);
app.disable('x-powered-by');

// Security headers (CSP, X-Content-Type-Options, Referrer-Policy)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'self';"
  );
  next();
});

app.use(express.json({ limit: '2.5mb' }));

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', mode: isProd ? 'production' : 'development' });
});

// Lightweight in-memory rate limiter per IP (max 20 requests / minute) with periodic eviction
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 500) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) return false;
  entry.count += 1;
  return true;
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, RATE_LIMIT_WINDOW_MS);
cleanupTimer.unref();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const ALLOWED_MODES = new Set(['terrain', 'object', 'objects', 'both']);
const BASE64_REGEX = /^[A-Za-z0-9+/=\r\n]+$/;
const MAX_BASE64_LENGTH = 2.8 * 1024 * 1024; // ~2 MB binary image payload

function sanitizeClientMetrics(raw: unknown): Record<string, number | string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const clampNum = (val: unknown, min: number, max: number, fallback = 0): number => {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Number(Math.max(min, Math.min(max, n)).toFixed(3));
  };
  const suggestedBiome =
    typeof src.suggestedBiome === 'string' && Object.hasOwn(BIOMES, src.suggestedBiome)
      ? src.suggestedBiome
      : 'mondstadt_meadow';
  const suggestedTexture =
    typeof src.suggestedTexture === 'string' &&
    (TEXTURE_INDEX_MAP as readonly string[]).includes(src.suggestedTexture)
      ? src.suggestedTexture
      : 'emerald_grass';

  return {
    avgR: clampNum(src.avgR, 0, 255),
    avgG: clampNum(src.avgG, 0, 255),
    avgB: clampNum(src.avgB, 0, 255),
    waterRatio: clampNum(src.waterRatio, 0, 1),
    greenRatio: clampNum(src.greenRatio, 0, 1),
    pinkRatio: clampNum(src.pinkRatio, 0, 1),
    warmRatio: clampNum(src.warmRatio, 0, 1),
    snowRatio: clampNum(src.snowRatio, 0, 1),
    contrastScore: clampNum(src.contrastScore, 0, 1),
    peakElevationMeters: clampNum(src.peakElevationMeters, -250, 1000),
    suggestedBiome,
    suggestedTexture,
  };
}

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/reconstruct', async (req, res) => {
  try {
    const clientIp = req.ip || 'local';
    if (!checkRateLimit(clientIp)) {
      res.status(429).json({ error: 'Quá nhiều yêu cầu phân tích AI. Vui lòng thử lại sau 1 phút.' });
      return;
    }

    const { imageBase64, mimeType, mode = 'both', clientMetrics } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Thiếu dữ liệu ảnh đầu vào (imageBase64).' });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
    if (
      cleanBase64.length === 0 ||
      cleanBase64.length > MAX_BASE64_LENGTH ||
      !BASE64_REGEX.test(cleanBase64)
    ) {
      res.status(400).json({ error: 'Dữ liệu ảnh base64 không hợp lệ hoặc vượt quá giới hạn dung lượng (2MB).' });
      return;
    }

    const resolvedMime =
      typeof mimeType === 'string' && ALLOWED_MIME_TYPES.has(mimeType)
        ? mimeType
        : 'image/jpeg';
    const resolvedMode =
      typeof mode === 'string' && ALLOWED_MODES.has(mode) ? mode : 'both';
    const safeMetrics = sanitizeClientMetrics(clientMetrics);

    const ai = getGeminiClient();
    if (!ai) {
      res.json({
        source: 'pixel-engine',
        warning: 'Khóa GEMINI_API_KEY chưa được cấu hình — sử dụng bộ phân tích Pixel Depth cục bộ.',
        analysis: null,
      });
      return;
    }

    const biomeIds = Object.keys(BIOMES);
    const prefabLines = PREFAB_CATALOG.map((p) => `   - '${p.id}' (${p.name})`).join('\n');

    const promptText = `Bạn là kiến trúc sư thế giới 3D phong cách Genshin Impact (Teyvat), Pokémon Legends và các đại địa hình Trái Đất / Hệ Mặt Trời.
Bản đồ thế giới mở có tổng diện tích 10x10 km (lưới 160x160 ô, trần độ cao 1.000m) với khu vực trung tâm 1:1 quanh tọa độ (-48m đến +48m).
Người dùng vừa tải lên một bức ảnh thực tế (chế độ tái tạo: ${resolvedMode}).
Thông số màu sắc trích xuất từ ảnh: ${JSON.stringify(safeMetrics)}.

Hãy phân tích địa hình, độ cao (tối đa 1000m), mặt nước, thảm thực vật và các công trình/vật thể trong ảnh:
1. Chọn biome phù hợp nhất từ danh sách (${biomeIds.length} quần xã): ${biomeIds.join(', ')}.
2. Chọn kết cấu bề mặt chủ đạo (dominantTexture) từ danh sách (${TEXTURE_INDEX_MAP.length} loại): ${TEXTURE_INDEX_MAP.join(', ')}.
3. Đề xuất thông số địa hình (reliefScale từ 0.6 đến 2.2, waterLevel từ -120 đến 80, terraceSteps từ 0 đến 8).
4. Liệt kê từ 6 đến 14 vật thể 3D (detectedObjects) đặt trong vùng quan sát trung tâm 1:1 (x, z trong khoảng -48 đến +48 mét), sử dụng prefabId thuộc danh sách:
${prefabLines}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: resolvedMime,
              data: cleanBase64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        abortSignal: AbortSignal.timeout(20_000),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            regionName: {
              type: Type.STRING,
              description: 'Tên vùng đất bằng tiếng Việt',
            },
            biome: {
              type: Type.STRING,
              enum: biomeIds,
              description: 'Quần xã / hành tinh phù hợp nhất từ registry',
            },
            dominantTexture: {
              type: Type.STRING,
              enum: TEXTURE_INDEX_MAP,
              description: 'Kết cấu bề mặt chủ đạo từ registry',
            },
            summary: {
              type: Type.STRING,
              description: 'Mô tả ngắn gọn (1-2 câu) cách tái tạo địa hình và vật thể từ bức ảnh.',
            },
            reliefScale: {
              type: Type.NUMBER,
              description: 'Hệ số độ cao địa hình từ 0.6 đến 2.2',
            },
            waterLevel: {
              type: Type.NUMBER,
              description: 'Mực nước tính bằng mét từ -120 đến 80',
            },
            terraceSteps: {
              type: Type.INTEGER,
              description: 'Số bậc thang địa hình (0 nếu mượt, 4-8 nếu có ruộng bậc thang/vách đá)',
            },
            detectedObjects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  prefabId: {
                    type: Type.STRING,
                    enum: PREFAB_CATALOG.map((p) => p.id),
                  },
                  label: { type: Type.STRING },
                  x: { type: Type.NUMBER, description: 'Tọa độ X từ -48 đến 48 mét' },
                  z: { type: Type.NUMBER, description: 'Tọa độ Z từ -48 đến 48 mét' },
                  scale: { type: Type.NUMBER },
                  rotationY: { type: Type.NUMBER },
                },
                required: ['prefabId', 'label', 'x', 'z', 'scale', 'rotationY'],
              },
            },
          },
          required: [
            'regionName',
            'biome',
            'dominantTexture',
            'summary',
            'reliefScale',
            'waterLevel',
            'terraceSteps',
            'detectedObjects',
          ],
        },
      },
    });

    const rawText = response.text;
    const parsed = rawText ? JSON.parse(rawText.trim()) : null;
    res.json({
      source: 'gemini-vision',
      analysis: parsed,
    });
  } catch (err: unknown) {
    console.error('[server] /api/reconstruct error:', err instanceof Error ? err.message : err);
    res.status(200).json({
      source: 'pixel-engine-fallback',
      warning: 'Dịch vụ phân tích AI tạm thời không phản hồi — đã tự động chuyển sang bộ tái tạo Pixel Depth cục bộ.',
      analysis: null,
    });
  }
});

// In-memory cache for compressed static assets in production
const compressedAssetCache = new Map<string, { br: Buffer; gzip: Buffer; mime: string }>();
const COMPRESSIBLE_EXT_MIME: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
};

function serveCompressedOrStatic(distPath: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    const cleanPath = decodeURIComponent(req.path.split('?')[0]);
    const ext = path.extname(cleanPath).toLowerCase();
    const mime = COMPRESSIBLE_EXT_MIME[ext];
    if (!mime) {
      next();
      return;
    }

    const resolvedFile = path.resolve(distPath, '.' + (cleanPath === '/' ? '/index.html' : cleanPath));
    if (!resolvedFile.startsWith(distPath) || !fs.existsSync(resolvedFile) || !fs.statSync(resolvedFile).isFile()) {
      next();
      return;
    }

    let cached = compressedAssetCache.get(resolvedFile);
    if (!cached) {
      const rawBuf = fs.readFileSync(resolvedFile);
      cached = {
        br: zlib.brotliCompressSync(rawBuf, {
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
        }),
        gzip: zlib.gzipSync(rawBuf, { level: 6 }),
        mime,
      };
      compressedAssetCache.set(resolvedFile, cached);
    }

    const isHashedAsset = cleanPath.startsWith('/assets/');
    res.setHeader(
      'Cache-Control',
      isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
    );
    res.setHeader('Content-Type', cached.mime);
    res.setHeader('Vary', 'Accept-Encoding');

    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    if (acceptEncoding.includes('br')) {
      res.setHeader('Content-Encoding', 'br');
      res.send(cached.br);
      return;
    }
    if (acceptEncoding.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      res.send(cached.gzip);
      return;
    }
    next();
  };
}

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(serveCompressedOrStatic(distPath));
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        immutable: true,
        maxAge: '365d',
      })
    );
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          } else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Express JSON / payload & fallback error middleware registered LAST so it catches all route/static errors
  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Kích thước dữ liệu gửi lên vượt quá giới hạn cho phép (2.5MB).' });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Định dạng JSON trong yêu cầu không hợp lệ.' });
      return;
    }
    res.status(err.status || 500).json({ error: 'Lỗi máy chủ nội bộ.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `AetherTerra 3D Server (${isProd ? 'production' : 'development'}) listening on http://localhost:${PORT}`
    );
  });
}

startServer();

