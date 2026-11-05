import 'dotenv/config';
import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import zlib from 'zlib';
import { GoogleGenAI, Type } from '@google/genai';
import {
  BIOMES,
  PREFAB_CATALOG,
  TEXTURE_INDEX_MAP,
} from './src/world/registry';
import { sanitizeAnalysis } from './src/world/aiAnalysis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const isProd =
  process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

// Configure reverse proxy hops based on environment (prevents X-Forwarded-For spoofing when running directly)
const hops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.K_SERVICE ? 1 : 0));
app.set('trust proxy', hops > 0 ? hops : false);
app.disable('x-powered-by');

export const CSP_SCRIPT_SRC = isProd ? "'self'" : "'self' 'unsafe-inline'";
export const CSP_CONNECT_SRC = isProd ? "'self'" : "'self' ws: wss:";

/**
 * Validates that an environment URL intended for CSP `frame-ancestors` is a real HTTP(S) origin
 * and not a placeholder (such as `MY_APP_URL`).
 */
export function sanitizeFrameAncestorOrigin(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed === 'MY_APP_URL' ||
    trimmed === 'MY_SHARED_APP_URL' ||
    (!trimmed.startsWith('https://') && !trimmed.startsWith('http://'))
  ) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export const CSP_FRAME_ANCESTORS =
  process.env.CSP_FRAME_ANCESTORS ||
  [
    "'self'",
    'https://aistudio.google.com',
    'https://*.google.com',
    'https://*.googleusercontent.com',
    sanitizeFrameAncestorOrigin(process.env.APP_URL),
    sanitizeFrameAncestorOrigin(process.env.SHARED_APP_URL),
  ]
    .filter(Boolean)
    .join(' ');

export const CSP_HEADER_VALUE =
  `default-src 'self'; script-src ${CSP_SCRIPT_SRC}; worker-src 'self'; child-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src ${CSP_CONNECT_SRC}; object-src 'none'; base-uri 'self'; frame-ancestors ${CSP_FRAME_ANCESTORS}; form-action 'self';`;

// Security headers (CSP, X-Content-Type-Options, Referrer-Policy)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Content-Security-Policy', CSP_HEADER_VALUE);
  next();
});

// Client error reporting endpoint (placed before the 3.5MB parser so the 8KB limit is strictly enforced)
const logHits = new Map<string, { n: number; resetAt: number }>();

export function pruneExpiredLogHits(now = Date.now()): void {
  for (const [key, val] of logHits.entries()) {
    if (now > val.resetAt) {
      logHits.delete(key);
    }
  }
}

export function resetClientLogHitsForTest(): void {
  logHits.clear();
}

app.post('/api/client-log', express.json({ limit: '8kb' }), (req, res) => {
  const ip = req.ip ?? 'local';
  const now = Date.now();
  if (logHits.size > 500) {
    pruneExpiredLogHits(now);
  }
  const h = logHits.get(ip);
  if (!h || h.resetAt < now) {
    logHits.set(ip, { n: 1, resetAt: now + 60_000 });
  } else if (++h.n > 30) {
    res.status(429).end();
    return;
  }
  const b = (req.body ?? {}) as Record<string, unknown>;
  const s = (v: unknown, n: number) => String(v ?? '').slice(0, n);
  console.warn(
    JSON.stringify({
      t: 'client-error',
      kind: s(b.kind, 20),
      message: s(b.message, 300),
      stack: s(b.stack, 1500),
      label: s(b.label, 40),
      build: s(b.build, 20),
    })
  );
  res.status(204).end();
});

// 3.5 MB JSON body limit accommodates MAX_BASE64_LENGTH (~2.8 MB base64 for 2 MB image) plus JSON envelope
const jsonBody = express.json({ limit: '3.5mb' });

const AI_BUDGET_WINDOW_MS = 3_600_000;
const AI_DAILY_WINDOW_MS = 86_400_000;
const AI_MAX_CALLS_PER_HOUR = Math.max(1, Number(process.env.AI_MAX_CALLS_PER_HOUR ?? 200));
const AI_MAX_CALLS_PER_IP_HOUR = Math.max(
  1,
  Number(process.env.AI_MAX_CALLS_PER_IP_HOUR ?? 40)
);
const GEMINI_DAILY_BUDGET = Math.max(1, Number(process.env.GEMINI_DAILY_BUDGET ?? 500));
let aiHourWindow = { count: 0, resetAt: 0 };
let aiDayWindow = { count: 0, resetAt: 0 };
const aiIpHourWindow = new Map<string, { count: number; resetAt: number }>();

export function consumeGlobalAiBudget(
  now = Date.now(),
  maxHourly = AI_MAX_CALLS_PER_HOUR,
  maxDaily = GEMINI_DAILY_BUDGET,
  clientIp?: string,
  maxPerIpHourly = AI_MAX_CALLS_PER_IP_HOUR
): boolean {
  const hourExpired = now > aiHourWindow.resetAt;
  const dayExpired = now > aiDayWindow.resetAt;
  const nextHourCount = hourExpired ? 1 : aiHourWindow.count + 1;
  const nextDayCount = dayExpired ? 1 : aiDayWindow.count + 1;

  if (nextHourCount > maxHourly || nextDayCount > maxDaily) {
    return false;
  }

  if (clientIp) {
    const ipEntry = aiIpHourWindow.get(clientIp);
    const ipExpired = !ipEntry || now > ipEntry.resetAt;
    const nextIpCount = ipExpired ? 1 : ipEntry.count + 1;
    if (nextIpCount > maxPerIpHourly) {
      return false;
    }
    aiIpHourWindow.set(clientIp, {
      count: nextIpCount,
      resetAt: ipExpired ? now + AI_BUDGET_WINDOW_MS : ipEntry.resetAt,
    });
  }

  aiHourWindow = {
    count: nextHourCount,
    resetAt: hourExpired ? now + AI_BUDGET_WINDOW_MS : aiHourWindow.resetAt,
  };
  aiDayWindow = {
    count: nextDayCount,
    resetAt: dayExpired ? now + AI_DAILY_WINDOW_MS : aiDayWindow.resetAt,
  };
  return true;
}

export function refundGlobalAiBudget(clientIp?: string): void {
  if (aiHourWindow.count > 0) {
    aiHourWindow.count -= 1;
  }
  if (aiDayWindow.count > 0) {
    aiDayWindow.count -= 1;
  }
  if (clientIp) {
    const ipEntry = aiIpHourWindow.get(clientIp);
    if (ipEntry && ipEntry.count > 0) {
      ipEntry.count -= 1;
    }
  }
}

export function resetAiBudgetForTest(): void {
  aiHourWindow = { count: 0, resetAt: 0 };
  aiDayWindow = { count: 0, resetAt: 0 };
  aiIpHourWindow.clear();
}

const PROMPT_VERSION = 'v1';
const AI_CACHE_TTL_MS = 60 * 60_000;
const AI_CACHE_MAX = 100;
const aiCache = new Map<
  string,
  { at: number; value: NonNullable<ReturnType<typeof sanitizeAnalysis>> }
>();
const aiInflight = new Map<string, Promise<ReturnType<typeof sanitizeAnalysis>>>();

export function computeAiCacheKey(
  mimeType: string,
  mode: string,
  cleanBase64: string,
  model = GEMINI_MODEL,
  version = PROMPT_VERSION
): string {
  return crypto
    .createHash('sha256')
    .update(`${version}|${model}|${mimeType}|${mode}|`)
    .update(cleanBase64)
    .digest('hex');
}

export function resetAiCacheForTest(): void {
  aiCache.clear();
  aiInflight.clear();
}

// Health check endpoint
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', mode: isProd ? 'production' : 'development' });
});

// Lightweight in-memory rate limiter & byte quota per IP (max 20 requests or 25 MB / minute) with periodic eviction
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const RATE_LIMIT_MAX_BYTES = 25 * 1024 * 1024;
const rateLimitMap = new Map<string, { count: number; bytes: number; resetAt: number }>();

export interface ApiQuotaResult {
  allowed: boolean;
  remainingRequests: number;
  remainingBytes: number;
  resetAt: number;
  reason?: 'rate_limit' | 'byte_quota';
}

export function checkApiQuota(
  ip: string,
  payloadBytes = 0,
  incrementRequest = true
): ApiQuotaResult {
  const now = Date.now();
  if (rateLimitMap.size > 500) {
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt) {
        rateLimitMap.delete(key);
      }
    }
  }
  const safeBytes = Math.max(0, Math.floor(payloadBytes));
  const reqDelta = incrementRequest ? 1 : 0;
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    if (safeBytes > RATE_LIMIT_MAX_BYTES) {
      return {
        allowed: false,
        remainingRequests: RATE_LIMIT_MAX_REQUESTS,
        remainingBytes: 0,
        resetAt,
        reason: 'byte_quota',
      };
    }
    rateLimitMap.set(ip, { count: reqDelta, bytes: safeBytes, resetAt });
    return {
      allowed: true,
      remainingRequests: RATE_LIMIT_MAX_REQUESTS - reqDelta,
      remainingBytes: RATE_LIMIT_MAX_BYTES - safeBytes,
      resetAt,
    };
  }
  if (incrementRequest && entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      remainingRequests: 0,
      remainingBytes: Math.max(0, RATE_LIMIT_MAX_BYTES - entry.bytes),
      resetAt: entry.resetAt,
      reason: 'rate_limit',
    };
  }
  if (entry.bytes + safeBytes > RATE_LIMIT_MAX_BYTES) {
    return {
      allowed: false,
      remainingRequests: Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count),
      remainingBytes: Math.max(0, RATE_LIMIT_MAX_BYTES - entry.bytes),
      resetAt: entry.resetAt,
      reason: 'byte_quota',
    };
  }
  entry.count += reqDelta;
  entry.bytes += safeBytes;
  return {
    allowed: true,
    remainingRequests: RATE_LIMIT_MAX_REQUESTS - entry.count,
    remainingBytes: RATE_LIMIT_MAX_BYTES - entry.bytes,
    resetAt: entry.resetAt,
  };
}

export function resetRateLimitsForTest(): void {
  rateLimitMap.clear();
}

const PLACEHOLDER_AUTH_TOKENS = new Set([
  'true',
  'false',
  'change-me',
  'change-me-in-production',
  'my_api_auth_token',
]);

function timingSafeStringEqual(candidate: string, expected: string): boolean {
  const bufA = Buffer.from(candidate, 'utf8');
  const bufB = Buffer.from(expected, 'utf8');
  if (bufA.length !== bufB.length) {
    // Compare bufB against itself to keep constant-time execution before returning false
    crypto.timingSafeEqual(bufB, bufB);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const REQUIRE_API_AUTH = process.env.REQUIRE_API_AUTH === 'true';

export function verifyApiAuth(
  headers: Record<string, string | string[] | undefined>,
  configuredToken = process.env.API_AUTH_TOKEN,
  requireToken = REQUIRE_API_AUTH
): boolean {
  const rawToken = configuredToken?.trim() ?? '';
  const isUnconfiguredOrPlaceholder =
    rawToken.length === 0 || PLACEHOLDER_AUTH_TOKENS.has(rawToken.toLowerCase());

  if (isUnconfiguredOrPlaceholder) {
    return !requireToken;
  }

  const authHeader = String(headers['authorization'] || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (timingSafeStringEqual(bearer, rawToken)) return true;
  }
  const apiKeyHeader = String(headers['x-api-key'] || '').trim();
  if (apiKeyHeader && timingSafeStringEqual(apiKeyHeader, rawToken)) return true;
  return false;
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitMap.entries()) {
    if (now > val.resetAt) {
      rateLimitMap.delete(key);
    }
  }
  pruneExpiredLogHits(now);
  for (const [key, val] of aiIpHourWindow.entries()) {
    if (now > val.resetAt) {
      aiIpHourWindow.delete(key);
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

function reconstructGuard(req: Request, res: Response, next: NextFunction): void {
  if (!verifyApiAuth(req.headers)) {
    res.status(401).json({ error: 'Yêu cầu thiếu hoặc sai khóa xác thực API (API_AUTH_TOKEN).' });
    return;
  }
  const declaredLen = Math.max(0, Number(req.headers['content-length'] ?? 0) || 0);
  const clientIp = req.ip || 'local';
  const quota = checkApiQuota(clientIp, declaredLen);
  res.setHeader('X-RateLimit-Remaining', String(quota.remainingRequests));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(quota.resetAt / 1000)));
  if (!quota.allowed) {
    res.status(429).json({
      error:
        quota.reason === 'byte_quota'
          ? 'Đã vượt hạn mức băng thông phân tích AI trong 1 phút (tối đa 25MB/phút).'
          : 'Quá nhiều yêu cầu phân tích AI. Vui lòng thử lại sau 1 phút.',
    });
    return;
  }
  next();
}

app.post('/api/reconstruct', reconstructGuard, jsonBody, async (req, res) => {
  try {
    const { imageBase64, mimeType, mode = 'both', clientMetrics } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Thiếu dữ liệu ảnh đầu vào (imageBase64).' });
      return;
    }

    // Account for chunked transfer encoding where content-length was omitted or under-reported
    const declaredLen = Math.max(0, Number(req.headers['content-length'] ?? 0) || 0);
    const actualBodyBytes = Buffer.byteLength(imageBase64, 'utf8');
    const unreportedBytes = Math.max(0, actualBodyBytes - declaredLen);
    const clientIp = req.ip || 'local';
    if (unreportedBytes > 0) {
      const postParseQuota = checkApiQuota(clientIp, unreportedBytes, false);
      if (!postParseQuota.allowed) {
        res.status(429).json({
          error: 'Đã vượt hạn mức băng thông phân tích AI trong 1 phút (tối đa 25MB/phút).',
        });
        return;
      }
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

    const key = computeAiCacheKey(resolvedMime, resolvedMode, cleanBase64);
    const hit = aiCache.get(key);
    if (hit && Date.now() - hit.at < AI_CACHE_TTL_MS) {
      aiCache.delete(key);
      aiCache.set(key, hit);
      res.setHeader('X-AI-Source', 'gemini-vision');
      res.json({ source: 'gemini-vision', analysis: hit.value, cached: true });
      return;
    }

    let consumedBudgetForRequest = false;
    let job = aiInflight.get(key);
    if (!job) {
      const ai = getGeminiClient();
      if (!ai) {
        res.setHeader('X-AI-Source', 'pixel-engine');
        res.json({
          source: 'pixel-engine',
          warning: 'Khóa GEMINI_API_KEY chưa được cấu hình — sử dụng bộ phân tích Pixel Depth cục bộ.',
          analysis: null,
        });
        return;
      }

      if (!consumeGlobalAiBudget(Date.now(), AI_MAX_CALLS_PER_HOUR, GEMINI_DAILY_BUDGET, clientIp)) {
        res.setHeader('X-AI-Source', 'pixel-engine');
        res.json({
          source: 'pixel-engine',
          warning: 'Đã đạt giới hạn gọi AI trong giờ/ngày — sử dụng bộ phân tích Pixel Depth cục bộ.',
          analysis: null,
        });
        return;
      }
      consumedBudgetForRequest = true;

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

      job = (async () => {
        try {
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
          const sanitized = sanitizeAnalysis(rawText ? JSON.parse(rawText.trim()) : null);
          if (!sanitized && consumedBudgetForRequest) {
            refundGlobalAiBudget(clientIp);
            consumedBudgetForRequest = false;
          }
          return sanitized;
        } catch (err) {
          if (consumedBudgetForRequest) {
            refundGlobalAiBudget(clientIp);
            consumedBudgetForRequest = false;
          }
          throw err;
        }
      })().finally(() => aiInflight.delete(key));
      aiInflight.set(key, job);
    }

    const analysis = await job;
    if (!analysis) {
      res.setHeader('X-AI-Source', 'pixel-engine');
      res.status(200).json({
        source: 'pixel-engine',
        warning: 'Phân tích AI không trả về dữ liệu hợp lệ — đã tự động chuyển sang bộ tái tạo Pixel Depth cục bộ.',
        analysis: null,
      });
      return;
    }

    if (aiCache.size >= AI_CACHE_MAX) {
      const oldestKey = aiCache.keys().next().value;
      if (oldestKey) aiCache.delete(oldestKey);
    }
    aiCache.set(key, { at: Date.now(), value: analysis });
    res.setHeader('X-AI-Source', 'gemini-vision');
    res.json({
      source: 'gemini-vision',
      analysis,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('[server] /api/reconstruct error:', errMsg);
    const isTransientUnavailable =
      /timeout|timed out|abort|503|429|overloaded|unavailable/i.test(errMsg);
    const statusCode = isTransientUnavailable ? 503 : 502;
    res.setHeader('X-AI-Source', 'pixel-engine');
    res.status(statusCode).json({
      source: 'pixel-engine',
      error: 'Dịch vụ phân tích AI tạm thời gián đoạn — đã giữ kết quả tái tạo Pixel Depth cục bộ.',
      warning: 'Dịch vụ phân tích AI tạm thời không phản hồi — đã tự động chuyển sang bộ tái tạo Pixel Depth cục bộ.',
      analysis: null,
    });
  }
});

// Explicit 404 JSON handler for unknown /api/* routes so they never fall through to the SPA HTML fallback
app.all('/api/*splat', (_req, res) => {
  res.status(404).json({ error: 'Không tìm thấy endpoint API.' });
});

const brotliCompressAsync = promisify(zlib.brotliCompress);
const gzipAsync = promisify(zlib.gzip);

interface CompressedAssetEntry {
  br: Buffer;
  gzip: Buffer;
  mime: string;
}

// In-memory cache of pending/resolved compressed static assets in production
const compressedAssetCache = new Map<string, Promise<CompressedAssetEntry>>();
const COMPRESSIBLE_EXT_MIME: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
};

/**
 * Safely decodes URL pathname, returning null if malformed percent-encoding is encountered.
 */
export function safeDecodePathname(rawUrlPath: string): string | null {
  try {
    return decodeURIComponent(rawUrlPath.split('?')[0]);
  } catch {
    return null;
  }
}

/**
 * Resolves a request pathname inside `distPath` and verifies via `path.relative(distPath, resolvedFile)`
 * that it cannot escape into parent or sibling directories (e.g. `../dist-secret`), while still allowing
 * valid filenames that contain consecutive dots (e.g. `/assets/chunk..123.js`).
 */
export function resolveSafeDistFile(distPath: string, cleanPath: string): string | null {
  if (cleanPath.includes('\0')) return null;
  const resolvedFile = path.resolve(
    distPath,
    '.' + (cleanPath === '/' ? '/index.html' : cleanPath)
  );
  const rel = path.relative(distPath, resolvedFile);
  if (!rel || path.isAbsolute(rel)) {
    return null;
  }
  const segments = rel.split(/[\\/]+/);
  if (segments.includes('..')) {
    return null;
  }
  return resolvedFile;
}

/**
 * Parses an HTTP `Accept-Encoding` header respecting RFC 9110 quality weights (`;q=0`, `;q=0.8`).
 * Explicitly rejects encodings with `q=0` (e.g. `Accept-Encoding: br;q=0`).
 */
export function selectContentEncoding(
  acceptEncodingHeader: string | undefined
): 'br' | 'gzip' | null {
  if (!acceptEncodingHeader) return null;
  let brQ = -1;
  let gzipQ = -1;
  let starQ = -1;

  for (const rawPart of acceptEncodingHeader.split(',')) {
    const segments = rawPart.trim().split(';');
    const token = segments[0]?.trim().toLowerCase();
    if (!token) continue;
    let q = 1.0;
    for (let i = 1; i < segments.length; i++) {
      const param = segments[i].trim();
      if (param.toLowerCase().startsWith('q=')) {
        const parsed = Number(param.slice(2).trim());
        q = Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0;
      }
    }
    if (token === 'br') brQ = q;
    else if (token === 'gzip' || token === 'x-gzip') gzipQ = q;
    else if (token === '*') starQ = q;
  }

  const effectiveBr = brQ >= 0 ? brQ : starQ;
  const effectiveGzip = gzipQ >= 0 ? gzipQ : starQ;
  if (effectiveBr > 0 && effectiveBr >= effectiveGzip) return 'br';
  if (effectiveGzip > 0) return 'gzip';
  return null;
}

export function serveCompressedOrStatic(distPath: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }

    const cleanPath = safeDecodePathname(req.path);
    if (cleanPath === null) {
      res.status(400).json({ error: 'Đường dẫn URL không hợp lệ.' });
      return;
    }

    const ext = path.extname(cleanPath).toLowerCase();
    const mime = COMPRESSIBLE_EXT_MIME[ext];
    if (!mime) {
      next();
      return;
    }

    const resolvedFile = resolveSafeDistFile(distPath, cleanPath);
    if (!resolvedFile) {
      next();
      return;
    }

    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    const brDisabled = /br\s*;\s*q\s*=\s*0(\.0+)?\b/i.test(acceptEncoding);
    const gzipDisabled = /gzip\s*;\s*q\s*=\s*0(\.0+)?\b/i.test(acceptEncoding);
    const parsedEncoding = selectContentEncoding(acceptEncoding);
    const canUseBr =
      !brDisabled &&
      parsedEncoding === 'br' &&
      /\bbr\b/i.test(acceptEncoding);
    const canUseGzip =
      !gzipDisabled &&
      (parsedEncoding === 'gzip' || (brDisabled && /\bgzip\b/i.test(acceptEncoding)));
    const encoding: 'br' | 'gzip' | null = canUseBr
      ? 'br'
      : canUseGzip
      ? 'gzip'
      : parsedEncoding;
    if (!encoding || (encoding === 'br' && brDisabled) || (encoding === 'gzip' && gzipDisabled)) {
      next();
      return;
    }

    try {
      let pending = compressedAssetCache.get(resolvedFile);
      if (!pending) {
        const stat = await fs.promises.stat(resolvedFile).catch(() => null);
        if (!stat || !stat.isFile()) {
          next();
          return;
        }
        pending = (async () => {
          const [preBr, preGz] = await Promise.all([
            fs.promises.readFile(`${resolvedFile}.br`).catch(() => null),
            fs.promises.readFile(`${resolvedFile}.gz`).catch(() => null),
          ]);
          if (preBr && preGz) {
            return { br: preBr, gzip: preGz, mime };
          }
          const rawBuf = await fs.promises.readFile(resolvedFile);
          const [br, gzip] = await Promise.all([
            preBr
              ? Promise.resolve(preBr)
              : brotliCompressAsync(rawBuf, {
                  params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
                }),
            preGz ? Promise.resolve(preGz) : gzipAsync(rawBuf, { level: 6 }),
          ]);
          return { br, gzip, mime };
        })();
        compressedAssetCache.set(resolvedFile, pending);
      }

      const cached = await pending;
      const isHashedAsset =
        cleanPath.startsWith('/assets/') && !cleanPath.startsWith('/assets/aistudio/');
      res.setHeader(
        'Cache-Control',
        isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
      );
      res.setHeader('Content-Type', cached.mime);
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Content-Encoding', encoding);
      res.send(encoding === 'br' ? cached.br : cached.gzip);
    } catch {
      compressedAssetCache.delete(resolvedFile);
      next();
    }
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
      '/assets/aistudio',
      express.static(path.join(distPath, 'assets', 'aistudio'), {
        immutable: false,
        maxAge: '1d',
      })
    );
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
    app.get('/{*splat}', (req, res) => {
      const ext = path.extname(req.path).toLowerCase();
      if (ext && ext !== '.html') {
        res.status(404).end();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Express JSON / payload & fallback error middleware registered LAST so it catches all route/static errors
  app.use((err: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'Kích thước dữ liệu gửi lên vượt quá giới hạn cho phép (3.5MB).' });
      return;
    }
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json({ error: 'Định dạng JSON trong yêu cầu không hợp lệ.' });
      return;
    }
    res.status(err.status || 500).json({ error: 'Lỗi máy chủ nội bộ.' });
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `AetherTerra 3D Server (${isProd ? 'production' : 'development'}) listening on http://localhost:${PORT}`
    );
  });

  process.on('SIGTERM', () => {
    server.close(() => process.exit(0));
  });
}

const isTestExecution =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.NODE_TEST_CONTEXT) ||
  process.execArgv.includes('--test') ||
  process.argv.includes('--test') ||
  Boolean(process.argv[1] && /\.test\.[cm]?[jt]sx?$/.test(process.argv[1]));

if (!isTestExecution) {
  startServer().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}


