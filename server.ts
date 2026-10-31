import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
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

app.use(express.json({ limit: '15mb' }));

// Lightweight in-memory rate limiter per IP (max 20 requests / minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count += 1;
  return true;
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

    const ai = getGeminiClient();
    if (!ai) {
      res.json({
        source: 'pixel-engine',
        analysis: null,
      });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const resolvedMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

    const biomeIds = Object.keys(BIOMES);
    const prefabLines = PREFAB_CATALOG.map((p) => `   - '${p.id}' (${p.name})`).join('\n');

    const promptText = `Bạn là kiến trúc sư thế giới 3D phong cách Genshin Impact (Teyvat), Pokémon Legends và các đại địa hình Trái Đất / Hệ Mặt Trời.
Bản đồ thế giới mở có tổng diện tích 10x10 km (lưới 160x160 ô, trần độ cao 1.000m) với khu vực trung tâm 1:1 quanh tọa độ (-48m đến +48m).
Người dùng vừa tải lên một bức ảnh thực tế (chế độ tái tạo: ${mode}).
Thông số màu sắc trích xuất từ ảnh: ${JSON.stringify(clientMetrics || {})}.

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
    const message = err instanceof Error ? err.message : 'Lỗi phân tích AI';
    res.status(200).json({
      source: 'pixel-engine-fallback',
      warning: message,
      analysis: null,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AetherTerra 3D Server listening on http://localhost:${PORT}`);
  });
}

startServer();
