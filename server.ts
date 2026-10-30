import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

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
    const { imageBase64, mimeType, mode = 'both', clientMetrics } = req.body || {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Thiếu dữ liệu ảnh đầu vào (imageBase64).' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      // Return deterministic synthesis enriched by client pixel analysis when no key is set
      res.json({
        source: 'pixel-engine',
        analysis: null,
      });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    const resolvedMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/png';

    const promptText = `Bạn là kiến trúc sư thế giới 3D phong cách Genshin Impact (Teyvat) và Pokémon Legends.
Bản đồ thế giới mở có tổng diện tích 10x10 km (10.000m x 10.000m, tọa độ x và z từ -5000 đến +5000) và trần độ cao 1 km (1.000m).
Người dùng vừa tải lên một bức ảnh thực tế (chế độ tái tạo: ${mode}).
Thông số màu sắc trích xuất từ ảnh: ${JSON.stringify(clientMetrics || {})}.

Hãy phân tích địa hình, độ cao (tối đa 1000m), mặt nước, thảm thực vật và các công trình/vật thể trong ảnh, sau đó chuyển đổi thành thông số tái tạo bản đồ 3D 10x10km:
1. Chọn biome phù hợp nhất: 'mondstadt_meadow', 'inazuma_sakura', 'liyue_amber', 'paldea_coast', hoặc 'snowpeak_glacier'.
2. Chọn kết cấu bề mặt chủ đạo (dominantTexture): 'earth_soil', 'emerald_grass', 'flower_meadow', 'desert_sand', 'volcanic_lava', 'river_stream', 'lake_water', 'dirt_cobble_road', 'limestone_cliff', hoặc 'glacier_snow'.
3. Đề xuất thông số địa hình (reliefScale từ 0.6 đến 2.2, waterLevel từ -120 đến 80, terraceSteps từ 0 đến 8).
4. Liệt kê từ 6 đến 16 vật thể 3D (detectedObjects) tương ứng với vị trí trong ảnh (x, z trong khoảng -3600 đến 3600 mét), sử dụng prefabId thuộc danh sách:
   - 'windmill_cottage' (nhà cối xay gió / nhà ở)
   - 'sakura_shrine' (đền thờ / chùa / cổng cổ)
   - 'pokemon_center' (tòa nhà lớn / biệt thự / trung tâm)
   - 'karst_mountain' (núi đá cao 1km / vách đá)
   - 'volcanic_peak' (núi nhọn / đá tảng lớn)
   - 'sakura_tree' (cây hoa hồng/đỏ/tím)
   - 'emerald_pine' (cây xanh / rừng thông)
   - 'aether_crystal' (tinh thể / đài tưởng niệm / vật thể nổi bật)
   - 'ancient_bridge' (cầu đá / lối đi qua sông)`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
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
              description: 'Tên vùng đất phong cách Genshin / Pokémon bằng tiếng Việt',
            },
            biome: {
              type: Type.STRING,
              description: 'Một trong: mondstadt_meadow, inazuma_sakura, liyue_amber, paldea_coast, snowpeak_glacier',
            },
            dominantTexture: {
              type: Type.STRING,
              description: 'Một trong: earth_soil, emerald_grass, flower_meadow, desert_sand, volcanic_lava, river_stream, lake_water, dirt_cobble_road, limestone_cliff, glacier_snow',
            },
            summary: {
              type: Type.STRING,
              description: 'Mô tả ngắn gọn (1-2 câu) cách AI tái tạo địa hình và vật thể từ bức ảnh.',
            },
            reliefScale: {
              type: Type.NUMBER,
              description: 'Hệ số độ cao địa hình từ 0.6 đến 2.2',
            },
            waterLevel: {
              type: Type.NUMBER,
              description: 'Mực nước từ -4.0 đến 3.0',
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
                  prefabId: { type: Type.STRING },
                  label: { type: Type.STRING },
                  x: { type: Type.NUMBER },
                  z: { type: Type.NUMBER },
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
    // Graceful fallback so client pixel engine reconstruction still succeeds seamlessly
    const message = err instanceof Error ? err.message : 'Lỗi phân tích AI';
    res.json({
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
