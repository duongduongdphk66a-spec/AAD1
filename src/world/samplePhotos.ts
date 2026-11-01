import { BiomeId } from './registry';

export interface SamplePhotoPreset {
  id: string;
  title: string;
  subtitle: string;
  mode: 'terrain' | 'object' | 'both';
  suggestedBiome: BiomeId;
  description: string;
  imageUrl?: string;
  drawPhoto: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}

/**
 * Generates high-resolution, richly textured aerial reference photographs on an HTML5 Canvas
 * so users can test Photo-to-3D Terrain & Object Reconstruction with 1 click
 * or upload their own image files.
 */
export const SAMPLE_PHOTO_PRESETS: SamplePhotoPreset[] = [
  {
    id: 'pluto_cryovolcano_ref',
    title: 'Núi Lửa Băng Wright Mons (Ảnh Mẫu Sao Diêm Vương)',
    subtitle: 'Ảnh gốc NASA/JHUAPL/SwRI: nền tholin nâu đỏ, sông băng nitơ tràn miệng caldera & cột phun Cryoplume',
    mode: 'both',
    suggestedBiome: 'pluto_cryovolcano',
    imageUrl: '/assets/aistudio/pluto_cryovolcano_ref.webp',
    description:
      'Tái tạo trực tiếp từ ảnh mẫu CRYOPLUME ERUPTION DETECTED (NASA/JHUAPL/SwRI): nền đá tholin nâu đỏ gồ ghề, dòng băng nitơ trắng xanh tràn khỏi miệng caldera sụt lún và cột phun băng Cryoplume thẳng đứng.',
    drawPhoto: (ctx, w, h) => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h * 0.42);
      ctx.fillStyle = '#57362b';
      ctx.fillRect(0, h * 0.42, w, h * 0.58);
      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.ellipse(w * 0.34, h * 0.46, w * 0.16, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(w * 0.29, h * 0.46);
      ctx.lineTo(w * 0.24, h * 0.12);
      ctx.lineTo(w * 0.43, h * 0.12);
      ctx.lineTo(w * 0.38, h * 0.46);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'europa_ocean_rifts_ref',
    title: 'Mặt Cắt Rãnh Nứt Băng & Đại Dương Ngầm Europa (Ảnh Mẫu)',
    subtitle: 'Ảnh gốc: khối địa chất 5 tầng (magma đáy biển, thủy nhiệt khói trắng, đại dương xanh ngọc, vỏ băng nứt & geyser)',
    mode: 'both',
    suggestedBiome: 'europa_chaos_ridge',
    imageUrl: '/assets/aistudio/europa_ocean_rifts_ref.webp',
    description:
      'Tái tạo trực tiếp từ sơ đồ mặt cắt địa chất 3D vệ tinh Europa: buồng magma đáy biển, miệng phun thủy nhiệt khói trắng, đại dương ngầm xanh ngọc, vỏ băng nứt rãnh vàng cam và cột phun hơi nước.',
    drawPhoto: (ctx, w, h) => {
      ctx.fillStyle = '#110e20';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#0891b2';
      ctx.fillRect(w * 0.2, h * 0.38, w * 0.58, h * 0.44);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(w * 0.2, h * 0.28, w * 0.58, h * 0.1);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(w * 0.2, h * 0.22, w * 0.58, h * 0.06);
      ctx.fillStyle = '#ea580c';
      ctx.beginPath();
      ctx.arc(w * 0.42, h * 0.88, w * 0.09, Math.PI, 0);
      ctx.fill();
    },
  },
  {
    id: 'alps_matterhorn_ref',
    title: 'Đỉnh Matterhorn Dãy Anpơ (Ảnh Mẫu Thụy Sĩ)',
    subtitle: 'Ảnh gốc: thảm cỏ hoa đỗ quyên xanh mướt, yên ngựa tuyết trắng & chóp sừng Matterhorn nghiêng (mặt sáng xám + vách tối xanh lam)',
    mode: 'both',
    suggestedBiome: 'himalaya_alps_andes',
    imageUrl: '/assets/aistudio/alps_matterhorn_ref.webp',
    description:
      'Tái tạo trực tiếp từ ảnh mẫu Đỉnh Matterhorn (Dãy Anpơ): thảm cỏ hoa đỗ quyên núi Anpơ xanh mướt ở tiền cảnh, yên ngựa tuyết trắng và chóp sừng kim tự tháp 4 mặt nghiêng đặc trưng.',
    drawPhoto: (ctx, w, h) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      // Snow-draped alpine col & Matterhorn pyramid
      ctx.fillStyle = '#57534e';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.56);
      ctx.lineTo(w * 0.34, h * 0.46);
      ctx.lineTo(w * 0.46, h * 0.21);
      ctx.lineTo(w * 0.59, h * 0.42);
      ctx.lineTo(w, h * 0.65);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      // Dark navy-slate North shadow face
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.moveTo(w * 0.45, h * 0.21);
      ctx.lineTo(w * 0.56, h * 0.42);
      ctx.lineTo(w * 0.46, h * 0.52);
      ctx.closePath();
      ctx.fill();

      // White glacier snowfields
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(w * 0.38, h * 0.52, w * 0.22, h * 0.06, -0.15, 0, Math.PI * 2);
      ctx.fill();

      // Lush green alpine rhododendron meadow foreground
      ctx.fillStyle = '#65a30d';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.76);
      ctx.quadraticCurveTo(w * 0.5, h * 0.64, w, h * 0.56);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'himalaya_fishtail_ref',
    title: 'Đỉnh Đuôi Cá Machapuchare / Everest (Ảnh Mẫu Himalaya)',
    subtitle: 'Ảnh gốc: đồi tiền cảnh nâu vàng, vách tuyết đan xen sống đá xanh đen, máng tuyết lở chéo & đỉnh đôi Đuôi Cá',
    mode: 'both',
    suggestedBiome: 'himalaya_alps_andes',
    imageUrl: '/assets/aistudio/himalaya_fishtail_ref.webp',
    description:
      'Tái tạo trực tiếp từ ảnh mẫu Đỉnh Machapuchare (Annapurna Himalaya): đồi tiền cảnh nâu vàng bên trái, vách tuyết dựng đứng đan xen các sống đá xanh đen và chóp đôi Đuôi Cá (Fishtail Spire).',
    drawPhoto: (ctx, w, h) => {
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, w, h);

      // Steep white & slate-blue Himalayan massif with twin Fishtail summit
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(w * 0.08, h * 0.75);
      ctx.lineTo(w * 0.41, h * 0.23);
      ctx.lineTo(w * 0.45, h * 0.27);
      ctx.lineTo(w * 0.49, h * 0.19);
      ctx.lineTo(w * 0.88, h * 0.58);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(w * 0.41, h * 0.23);
      ctx.lineTo(w * 0.49, h * 0.19);
      ctx.lineTo(w * 0.85, h * 0.68);
      ctx.lineTo(w * 0.28, h * 0.68);
      ctx.closePath();
      ctx.fill();

      // Golden-brown russet foreground ridge on front-left
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.6);
      ctx.lineTo(w * 0.46, h * 0.78);
      ctx.lineTo(w * 0.68, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'mars_olympus_ref',
    title: 'Núi Lửa Khiên Olympus Mons (Ảnh Quỹ Đạo Sao Hỏa)',
    subtitle: 'Ảnh gốc: vách đá Basal Scarp 8km, vòm khiên vàng đất & 6 miệng caldera lồng nhau (m8uek02co8l91_09cb37ea.webp)',
    mode: 'both',
    suggestedBiome: 'mars_olympus',
    imageUrl: '/assets/aistudio/m8uek02co8l91_09cb37ea.webp',
    description:
      'Tái tạo trực tiếp từ ảnh quỹ đạo Olympus Mons (m8uek02co8l91_09cb37ea.webp): vách đá dựng đứng Basal Scarp 8km, vòm khiên thoải màu vàng đất và cụm 6 miệng caldera lồng nhau.',
    drawPhoto: (ctx, w, h) => {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h * 0.42);
      ctx.fillStyle = '#c58b56';
      ctx.fillRect(0, h * 0.42, w, h * 0.58);
      ctx.fillStyle = '#ccb07e';
      ctx.beginPath();
      ctx.ellipse(w * 0.48, h * 0.62, w * 0.36, h * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3d2e1b';
      ctx.beginPath();
      ctx.ellipse(w * 0.46, h * 0.58, w * 0.06, h * 0.025, 0, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  {
    id: 'titan_mountain_ref',
    title: 'Núi Rãnh Sao Mithrim / Doom Mons (Ảnh NASA JPL Titan)',
    subtitle: 'Ảnh gốc: cụm 8 sống núi băng-hydrocarbon phân nhánh hình sao & cồn cát tholin (images_1f7cdcc6.webp)',
    mode: 'both',
    suggestedBiome: 'titan_methane_sea',
    imageUrl: '/assets/aistudio/images_1f7cdcc6.webp',
    description:
      'Tái tạo trực tiếp từ ảnh radar/VIMS tàu Cassini NASA JPL (images_1f7cdcc6.webp): cụm sống núi băng-hydrocarbon phân nhánh hình sao với sườn sáng vàng kem và thung lũng chữ V nâu đen.',
    drawPhoto: (ctx, w, h) => {
      ctx.fillStyle = '#5c3812';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e09a48';
      ctx.beginPath();
      ctx.ellipse(w * 0.14, h * 0.45, w * 0.16, h * 0.28, -0.35, 0, Math.PI * 2);
      ctx.fill();
      for (const ang of [1.9, 1.55, 1.2, 0.85, 0.35]) {
        ctx.strokeStyle = '#f5d096';
        ctx.lineWidth = Math.max(3, w * 0.025);
        ctx.beginPath();
        ctx.moveTo(w * 0.43, h * 0.24);
        ctx.lineTo(w * (0.43 + Math.cos(ang) * 0.32), h * (0.24 + Math.sin(ang) * 0.42));
        ctx.stroke();
      }
    },
  },
  {
    id: 'island_volcano_ref',
    title: 'Núi Lửa Đảo Nhiệt Đới (Ảnh Mẫu Tải Lên)',
    subtitle: 'Ảnh gốc: bãi cát vàng, vành đai rừng xanh, núi lửa nâu phun dung nham vàng cam & cột khói 2 đám mây',
    mode: 'both',
    suggestedBiome: 'hawaii_shield_volcano',
    imageUrl: '/assets/aistudio/image_19e38ffa.webp',
    description:
      'Tái tạo trực tiếp từ ảnh mẫu image_19e38ffa.webp: dựng mô hình 3D Núi Lửa Đảo Nhiệt Đới 14 bộ phận (bãi cát vàng uốn lượn, vành đai cây xanh, sườn núi nâu rãnh sâu, miệng dung nham vàng cam & cột khói trắng-nâu kèm 2 đám mây trôi).',
    drawPhoto: (ctx, w, h) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      // Golden-orange scalloped sandy beach ring
      ctx.fillStyle = '#f4b256';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.82, w * 0.42, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();

      // Lush emerald-green foliage collar
      ctx.fillStyle = '#15992b';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.77, w * 0.35, h * 0.065, 0, 0, Math.PI * 2);
      ctx.fill();

      // Steep mahogany-brown volcanic cone
      ctx.fillStyle = '#6b3814';
      ctx.beginPath();
      ctx.moveTo(w * 0.18, h * 0.76);
      ctx.lineTo(w * 0.37, h * 0.39);
      ctx.lineTo(w * 0.61, h * 0.39);
      ctx.lineTo(w * 0.82, h * 0.76);
      ctx.closePath();
      ctx.fill();

      // Dark brown vertical ridges
      ctx.strokeStyle = '#4a240b';
      ctx.lineWidth = Math.max(2, w * 0.025);
      for (const rx of [0.34, 0.46, 0.56, 0.68]) {
        ctx.beginPath();
        ctx.moveTo(w * (0.39 + (rx - 0.34) * 0.55), h * 0.42);
        ctx.lineTo(w * rx, h * 0.76);
        ctx.stroke();
      }

      // Yellow-gold & orange cascading lava crown & tongues
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.ellipse(w * 0.49, h * 0.41, w * 0.14, h * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(w * 0.49, h * 0.4, w * 0.12, h * 0.03, 0, 0, Math.PI * 2);
      ctx.fill();

      // Diagonal two-tone smoke plume + 2 detached smoke clouds
      const puffs = [
        { x: 0.48, y: 0.33, r: 0.08 },
        { x: 0.55, y: 0.25, r: 0.085 },
        { x: 0.63, y: 0.17, r: 0.09 },
        { x: 0.73, y: 0.24, r: 0.055 },
        { x: 0.8, y: 0.12, r: 0.04 },
      ];
      for (const pf of puffs) {
        ctx.fillStyle = '#a6826c';
        ctx.beginPath();
        ctx.arc(w * (pf.x + 0.01), h * (pf.y + 0.015), w * pf.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f5f5f4';
        ctx.beginPath();
        ctx.arc(w * pf.x, h * pf.y, w * pf.r * 0.92, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
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
