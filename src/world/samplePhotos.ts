import { BiomeId } from './terrainEngine';

export interface SamplePhotoPreset {
  id: string;
  title: string;
  subtitle: string;
  mode: 'terrain' | 'object' | 'both';
  suggestedBiome: BiomeId;
  description: string;
  drawPhoto: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

/**
 * Generates high-resolution, richly textured aerial reference photographs on an HTML5 Canvas
 * so users can test Photo-to-3D Terrain & Object Reconstruction with 1 click
 * or upload their own image files.
 */
export const SAMPLE_PHOTO_PRESETS: SamplePhotoPreset[] = [
  {
    id: 'alpine_valley',
    title: 'Thung Lũng Thảo Nguyên & Cối Xay Gió',
    subtitle: 'Ảnh vùng đất thực tế: đồi cỏ xanh, sông uốn lượn và làng cối xay gió',
    mode: 'both',
    suggestedBiome: 'mondstadt_meadow',
    description:
      'Tái tạo địa hình thung lũng xanh ngọc lục bảo, dòng suối giữa bản đồ, nhà cối xay gió và rừng thông.',
    drawPhoto: (ctx, w, h) => {
      // Base emerald meadow with organic contour shading
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#22c55e');
      bg.addColorStop(0.5, '#16a34a');
      bg.addColorStop(1, '#15803d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Textured forest clusters and meadow patches
      for (let i = 0; i < 140; i++) {
        const px = ((i * 67) % 100) * 0.01 * w;
        const py = ((i * 113) % 100) * 0.01 * h;
        const r = 4 + (i % 10);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(74, 222, 128, 0.45)' : 'rgba(20, 83, 45, 0.38)';
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }

      // High snow-capped mountain ridges at north-west & north-east
      const drawMountainPeak = (cx: number, cy: number, radius: number) => {
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
        g.addColorStop(0, '#f8fafc');
        g.addColorStop(0.32, '#cbd5e1');
        g.addColorStop(0.68, '#64748b');
        g.addColorStop(1, 'rgba(22, 163, 74, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // Ridge lines
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.5;
        for (let a = 0; a < 6; a++) {
          const ang = (a / 6) * Math.PI * 2 + 0.3;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(ang) * radius * 0.7, cy + Math.sin(ang) * radius * 0.7);
          ctx.stroke();
        }
      };

      drawMountainPeak(w * 0.22, h * 0.22, w * 0.27);
      drawMountainPeak(w * 0.78, h * 0.25, w * 0.24);

      // Sandy riverbank border + winding turquoise river
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = w * 0.15;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.08, h * 0.86);
      ctx.bezierCurveTo(w * 0.38, h * 0.65, w * 0.55, h * 0.45, w * 0.92, h * 0.35);
      ctx.stroke();

      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = w * 0.1;
      ctx.beginPath();
      ctx.moveTo(w * 0.08, h * 0.86);
      ctx.bezierCurveTo(w * 0.38, h * 0.65, w * 0.55, h * 0.45, w * 0.92, h * 0.35);
      ctx.stroke();

      // Terracotta roof structures (cottages & windmill)
      const roofs = [
        { x: w * 0.35, y: h * 0.47, s: w * 0.09 },
        { x: w * 0.67, y: h * 0.63, s: w * 0.08 },
      ];
      for (const rf of roofs) {
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(rf.x - rf.s / 2, rf.y - rf.s / 2, rf.s, rf.s * 0.8);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.strokeRect(rf.x - rf.s / 2, rf.y - rf.s / 2, rf.s, rf.s * 0.8);
      }
    },
  },
  {
    id: 'sakura_archipelago',
    title: 'Đảo Hoa Anh Đào & Đền Cổ Trên Núi',
    subtitle: 'Ảnh thực tế: rừng anh đào hồng phấn, vịnh biển lam và đền thờ',
    mode: 'both',
    suggestedBiome: 'inazuma_sakura',
    description:
      'Tái tạo quần đảo hoa anh đào Inazuma với thảm cỏ hồng phấn, đền thờ thần thụ và bờ biển ngọc.',
    drawPhoto: (ctx, w, h) => {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, w, h);

      // Central island landmass with pink sakura groves
      const island = ctx.createRadialGradient(
        w * 0.5,
        h * 0.48,
        w * 0.06,
        w * 0.5,
        h * 0.48,
        w * 0.44
      );
      island.addColorStop(0, '#fdf2f8');
      island.addColorStop(0.42, '#f472b6');
      island.addColorStop(0.75, '#db2777');
      island.addColorStop(0.9, '#fde047');
      island.addColorStop(1, 'rgba(2,132,199,0)');
      ctx.fillStyle = island;
      ctx.fillRect(0, 0, w, h);

      // Blossom tree crowns
      for (let i = 0; i < 65; i++) {
        const ang = i * 0.9;
        const dist = (i / 65) * w * 0.34;
        const px = w * 0.5 + Math.cos(ang) * dist;
        const py = h * 0.48 + Math.sin(ang) * dist;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 207, 232, 0.75)' : 'rgba(236, 72, 153, 0.65)';
        ctx.beginPath();
        ctx.arc(px, py, 5 + (i % 5), 0, Math.PI * 2);
        ctx.fill();
      }

      // Vermilion shrine courtyard at summit
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(w * 0.42, h * 0.38, w * 0.14, h * 0.11);
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.strokeRect(w * 0.42, h * 0.38, w * 0.14, h * 0.11);
    },
  },
  {
    id: 'karst_canyon',
    title: 'Tuyệt Vân Đá Vôi & Thung Lũng Hổ Phách',
    subtitle: 'Ảnh thực tế: cột đá karst cao vút, ruộng bậc thang vàng và hồ ngọc',
    mode: 'terrain',
    suggestedBiome: 'liyue_amber',
    description:
      'Tái tạo địa hình cột đá thạch anh dựng đứng phong cách Liyue với bậc thang địa chất và thảo nguyên vàng.',
    drawPhoto: (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, '#f59e0b');
      bg.addColorStop(0.6, '#d97706');
      bg.addColorStop(1, '#92400e');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const pillars = [
        { x: 0.26, y: 0.28, r: 0.21 },
        { x: 0.74, y: 0.28, r: 0.22 },
        { x: 0.54, y: 0.72, r: 0.19 },
      ];
      for (const p of pillars) {
        const g = ctx.createRadialGradient(w * p.x, h * p.y, 2, w * p.x, h * p.y, w * p.r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.55, '#cbd5e1');
        g.addColorStop(1, 'rgba(245,158,11,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(w * 0.45, h * 0.48, w * 0.16, h * 0.1, 0.2, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'citadel_object',
    title: 'Vật Thể Kiến Trúc: Đài Thiên Văn & Tháp Cổ',
    subtitle: 'Ảnh vật thể thực tế: tự động nâng cao nguyên trung tâm và dựng quần thể kiến trúc',
    mode: 'object',
    suggestedBiome: 'paldea_coast',
    description:
      'Tái tạo từ ảnh vật thể đơn lẻ: dựng đài cao nguyên bậc thang trung tâm cùng trung tâm lữ hành và trụ tinh thể.',
    drawPhoto: (ctx, w, h) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);

      const g = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.05, w * 0.5, h * 0.5, w * 0.4);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, '#fbbf24');
      g.addColorStop(0.65, '#22c55e');
      g.addColorStop(1, '#0284c7');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
  },
];

export function renderSamplePresetToDataUrl(
  preset: SamplePhotoPreset,
  size = 160
): {
  dataUrl: string;
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  preset.drawPhoto(ctx, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);
  return {
    dataUrl: canvas.toDataURL('image/png'),
    rgba: imgData.data,
    width: size,
    height: size,
  };
}
