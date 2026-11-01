import {
  BIOMES,
  BiomeId,
  DAY_NIGHT_PRESETS,
  DEFAULT_GRASS_HEIGHT_CM,
  DEFAULT_TERRAIN_RULES,
  DayNightPreset,
  DayPhaseId,
  FLOWER_SPECIES_CATALOG,
  FlowerSpeciesId,
  GRID_SIZE,
  MAX_ELEVATION,
  MAX_GRASS_HEIGHT_CM,
  MIN_BRUSH_RADIUS,
  MIN_ELEVATION,
  MIN_GRASS_HEIGHT_CM,
  MicroStrokeStamp,
  PREFAB_CATALOG,
  PlacedObject,
  PrefabId,
  RuleOperator,
  TEXTURE_BRUSHES,
  TEXTURE_INDEX_MAP,
  TOTAL_VERTICES,
  TerrainRule,
  TerrainRuleExecutionResult,
  TextureBrushId,
  VERTEX_COUNT_PER_SIDE,
  WEATHER_CATALOG,
  WORLD_SIZE,
  WeatherId,
  generateInitialSurfaceShowcaseStrokes,
  getTextureIndex,
} from './registry';
import { recomputeTerrainColors } from './brushes';
import {
  fbm2D,
  getGroundHeightAt,
  getTerrainElevationStats,
} from './sculpting';

export { DAY_NIGHT_PRESETS, DEFAULT_TERRAIN_RULES };
export type {
  DayNightPreset,
  DayPhaseId,
  RuleOperator,
  TerrainRule,
  TerrainRuleExecutionResult,
};

/**
 * Generates the default initial 10x10 km Flat Earth Plane ("Mặt Phẳng Đất Nguyên Bản").
 * All vertices start on a clean flat earth plane (0m elevation) with earth_soil surface texture,
 * ready for the user to sculpt mountains (up to 1km), dig rivers/lakes, paint grass/flowers/sand/lava/roads,
 * and place/adjust 3D objects.
 */
export function generateFlatEarthTerrain(
  biomeId: BiomeId = 'mondstadt_meadow'
): {
  heightMap: Float32Array;
  splatMap: Uint8Array;
  colorMap: Float32Array;
  initialObjects: PlacedObject[];
} {
  const heightMap = new Float32Array(TOTAL_VERTICES);
  const splatMap = new Uint8Array(TOTAL_VERTICES);
  const colorMap = new Float32Array(TOTAL_VERTICES * 3);

  const earthIdx = getTextureIndex('earth_soil');
  heightMap.fill(0); // Pure flat plane at 0m elevation
  splatMap.fill(earthIdx); // Pure earth/soil base texture

  recomputeTerrainColors(heightMap, splatMap, colorMap, biomeId);

  const rawStarterProps: Array<{
    prefabId: PrefabId;
    label: string;
    x: number;
    z: number;
    scale: number;
    rotationY: number;
  }> = [
    { prefabId: 'pluto_cryo_volcano', label: 'Núi Lửa Băng Wright Mons (Sao Diêm Vương — Từ Ảnh Mẫu)', x: -16, z: -8, scale: 1.35, rotationY: 0 },
    { prefabId: 'europa_penitentes_spire', label: 'Mặt Cắt Rãnh Nứt Băng & Đại Dương Ngầm Europa (Từ Ảnh Mẫu)', x: 16, z: -8, scale: 1.35, rotationY: 0 },
    { prefabId: 'himalaya_matterhorn_peak', label: 'Đỉnh Sừng Băng Matterhorn (Dãy Anpơ — Từ Ảnh Mẫu)', x: -45, z: -10, scale: 1.35, rotationY: 0 },
    { prefabId: 'himalaya_fishtail_peak', label: 'Đỉnh Đuôi Cá Machapuchare / Everest (Himalaya — Từ Ảnh Mẫu)', x: 45, z: -10, scale: 1.35, rotationY: 0 },
    { prefabId: 'mars_olympus_shield', label: 'Núi Lửa Khiên Olympus Mons (Sao Hỏa — Từ Ảnh Mẫu)', x: -76, z: -12, scale: 1.35, rotationY: 0 },
    { prefabId: 'titan_mithrim_montes', label: 'Núi Rãnh Sao Mithrim / Doom Mons (Vệ Tinh Titan — Ảnh NASA JPL)', x: 76, z: -12, scale: 1.35, rotationY: 0 },
    { prefabId: 'island_volcano_icon', label: 'Núi Lửa Đảo Nhiệt Đới (Từ Ảnh Mẫu)', x: 0, z: -26, scale: 1.35, rotationY: 0 },
    { prefabId: 'windmill_cottage', label: 'Nhà Cối Xay Gió Trung Tâm', x: -26, z: 12, scale: 1.0, rotationY: 0.45 },
    { prefabId: 'pokemon_center', label: 'Trung Tâm Lữ Hành', x: 26, z: 12, scale: 1.0, rotationY: -0.5 },
    { prefabId: 'sakura_shrine', label: 'Đền Thờ Anh Đào', x: 0, z: -44, scale: 1.0, rotationY: 0 },
    { prefabId: 'floating_sky_island', label: 'Đảo Bay Celestia / Khánh Vân', x: -22, z: -42, scale: 1.0, rotationY: 0.2 },
    { prefabId: 'sheer_cliff_wall', label: 'Vách Đá Dựng Đứng Tuyệt Vân', x: -34, z: -22, scale: 1.15, rotationY: 0.55 },
    { prefabId: 'active_volcano', label: 'Núi Lửa Phun Trào Natlan', x: -32, z: 8, scale: 1.1, rotationY: 0.3 },
    { prefabId: 'abyss_chasm_vortex', label: 'Vực Sâu Vực Đá & Area Zero', x: 28, z: 12, scale: 1.0, rotationY: 0 },
    { prefabId: 'statue_of_seven', label: 'Thất Thiên Thần Tượng', x: -18, z: 12, scale: 1.0, rotationY: 0.25 },
    { prefabId: 'pokemon_gym_stadium', label: 'Sân Đấu Pokémon Gym', x: 32, z: -22, scale: 0.95, rotationY: -0.45 },
    { prefabId: 'berry_apricorn_tree', label: 'Cây Quả Berry Pokémon', x: 19, z: 8, scale: 1.0, rotationY: 0.8 },
    { prefabId: 'sakura_tree', label: 'Cây Anh Đào Cổ Thụ', x: -20, z: 18, scale: 1.0, rotationY: 1.2 },
    { prefabId: 'emerald_pine', label: 'Cây Thông Ngọc Lục', x: 20, z: 18, scale: 1.0, rotationY: 0.3 },
    { prefabId: 'ancient_bridge', label: 'Cầu Đá Thị Trấn', x: 0, z: 24, scale: 1.0, rotationY: 0 },
    { prefabId: 'aether_crystal', label: 'Đài Dịch Chuyển Trung Tâm', x: 14, z: 14, scale: 1.0, rotationY: 0 },
  ];

  const initialObjects: PlacedObject[] = rawStarterProps.map((item, idx) => ({
    id: `flat-init-${idx}-${item.prefabId}`,
    prefabId: item.prefabId,
    label: item.label,
    x: item.x,
    y: 0,
    z: item.z,
    scale: item.scale,
    rotationY: item.rotationY,
  }));

  return { heightMap, splatMap, colorMap, initialObjects };
}

/**
 * Generates an initial scenic 10x10 km open-world terrain (with peaks up to 1 km / 1,000m) for a given biome.
 */
export function generateBiomeTerrain(
  biomeId: BiomeId,
  seed = 42
): {
  heightMap: Float32Array;
  splatMap: Uint8Array;
  colorMap: Float32Array;
  initialObjects: PlacedObject[];
} {
  const biome = BIOMES[biomeId];
  const heightMap = new Float32Array(TOTAL_VERTICES);
  const splatMap = new Uint8Array(TOTAL_VERTICES);
  const colorMap = new Float32Array(TOTAL_VERTICES * 3);

  const defaultTexIdx = getTextureIndex(biome.defaultTexture);
  splatMap.fill(defaultTexIdx);

  const half = WORLD_SIZE / 2; // 5,000m

  for (let iz = 0; iz <= GRID_SIZE; iz++) {
    for (let ix = 0; ix <= GRID_SIZE; ix++) {
      const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
      const wx = (ix / GRID_SIZE) * WORLD_SIZE - half;
      const wz = (iz / GRID_SIZE) * WORLD_SIZE - half;

      const distFromCenter = Math.hypot(wx, wz) / half;
      const nx = wx * 0.00042;
      const nz = wz * 0.00042;

      const n = fbm2D(nx, nz, 5, seed);
      // Winding river valley across the 10x10 km continent + towering 1 km mountain massifs
      const riverChannel = Math.exp(
        -Math.pow((wx + Math.sin(wz * 0.0007) * 950) / 720, 2)
      );
      const northMassif = Math.exp(
        -Math.pow((wx + 1750) / 1550, 2) - Math.pow((wz + 1900) / 1550, 2)
      );
      const eastSummit = Math.exp(
        -Math.pow((wx - 2100) / 1450, 2) - Math.pow((wz + 1350) / 1650, 2)
      );
      const westRidge = Math.exp(
        -Math.pow((wx + 2400) / 1400, 2) - Math.pow((wz - 1500) / 1600, 2)
      );

      let h =
        (110 +
          n * 280 +
          northMassif * 790 +
          eastSummit * 680 +
          westRidge * 440) *
          biome.reliefScale -
        riverChannel * 185;

      if (biomeId === 'liyue_amber' && h > 160) {
        h = Math.round(h / 95) * 95;
      }

      if (distFromCenter > 0.92) {
        const edgeFactor = (distFromCenter - 0.92) / 0.08;
        h = h * (1 - edgeFactor * 0.35);
      }

      // Level the central 1:1 landing/village basin (within 110m of 0,0) so starter 1:1 structures & planetary domes sit in full view of the camera
      const distMeters = Math.hypot(wx, wz);
      if (distMeters < 140) {
        const basinBlend = Math.max(0, Math.min(1, (distMeters - 65) / 75));
        h = h * basinBlend * basinBlend;
      }

      const clampedH = Math.max(
        MIN_ELEVATION,
        Math.min(MAX_ELEVATION, Number.isFinite(h) ? h : 0)
      );
      heightMap[idx] = clampedH;

      // Assign initial biome surface textures by elevation/river channel
      if (biomeId === 'himalaya_alps_andes') {
        if (clampedH < biome.waterLevel + 14) {
          splatMap[idx] = getTextureIndex('lake_water');
        } else if (clampedH > 320) {
          splatMap[idx] = getTextureIndex('glacier_snow');
        } else if (clampedH > 140) {
          splatMap[idx] = getTextureIndex('limestone_cliff');
        } else {
          splatMap[idx] = getTextureIndex('taiga_moss_needles');
        }
      } else if (biomeId === 'sahara_atacama_gobi') {
        if (clampedH < biome.waterLevel + 24) {
          splatMap[idx] = getTextureIndex('atacama_salt_crust');
        } else if (clampedH > 460) {
          splatMap[idx] = getTextureIndex('limestone_cliff');
        } else if (((ix + iz) % 7) === 0) {
          splatMap[idx] = getTextureIndex('atacama_salt_crust');
        } else {
          splatMap[idx] = getTextureIndex('desert_sand');
        }
      } else if (biomeId === 'hawaii_shield_volcano') {
        if (clampedH < biome.waterLevel + 12) {
          splatMap[idx] = getTextureIndex('lake_water');
        } else if (clampedH > 450 || (Math.abs(wx) < 600 && clampedH > 180)) {
          splatMap[idx] = getTextureIndex('volcanic_lava');
        } else if (clampedH > 220) {
          splatMap[idx] = getTextureIndex('limestone_cliff');
        } else {
          splatMap[idx] = getTextureIndex('tropical_rainforest_floor');
        }
      } else if (biomeId === 'amazon_congo_rainforest') {
        if (clampedH < biome.waterLevel + 22) {
          splatMap[idx] = getTextureIndex('river_stream');
        } else if (clampedH > 540) {
          splatMap[idx] = getTextureIndex('limestone_cliff');
        } else {
          splatMap[idx] = getTextureIndex('tropical_rainforest_floor');
        }
      } else if (biomeId === 'boreal_taiga_forest') {
        if (clampedH < biome.waterLevel + 14) {
          splatMap[idx] = getTextureIndex('lake_water');
        } else if (clampedH > 480) {
          splatMap[idx] = getTextureIndex('glacier_snow');
        } else if (clampedH > 320) {
          splatMap[idx] = getTextureIndex('limestone_cliff');
        } else {
          splatMap[idx] = getTextureIndex('taiga_moss_needles');
        }
      } else if (
        biomeId === 'pluto_cryovolcano' ||
        biomeId === 'europa_chaos_ridge'
      ) {
        if (clampedH < biome.waterLevel + 14) {
          splatMap[idx] = getTextureIndex('pluto_nitrogen_ice');
        } else if (clampedH > 540) {
          splatMap[idx] = getTextureIndex('glacier_snow');
        } else {
          splatMap[idx] = defaultTexIdx;
        }
      } else if (biomeId === 'titan_methane_sea') {
        if (clampedH < biome.waterLevel + 35) {
          splatMap[idx] = getTextureIndex('titan_methane_liquid');
        } else if (clampedH > 520) {
          splatMap[idx] = getTextureIndex('pluto_nitrogen_ice');
        } else {
          splatMap[idx] = getTextureIndex('desert_sand');
        }
      } else if (biomeId === 'corot_lava_ocean') {
        if (clampedH < biome.waterLevel + 40) {
          splatMap[idx] = getTextureIndex('volcanic_lava');
        } else if (clampedH > 560) {
          splatMap[idx] = getTextureIndex('volcanic_lava');
        } else {
          splatMap[idx] = getTextureIndex('exoplanet_basalt');
        }
      } else if (
        biomeId === 'mars_olympus' ||
        biomeId === 'venus_ishtar' ||
        biomeId === 'kepler_crystalline' ||
        biomeId === 'trappist_tidally_locked'
      ) {
        if (clampedH < biome.waterLevel + 12) {
          splatMap[idx] = getTextureIndex(
            biomeId === 'venus_ishtar' || biomeId === 'trappist_tidally_locked'
              ? 'volcanic_lava'
              : biome.defaultTexture
          );
        } else if (clampedH > 580) {
          splatMap[idx] = getTextureIndex(
            biomeId === 'mars_olympus'
              ? 'limestone_cliff'
              : biomeId === 'venus_ishtar'
              ? 'volcanic_lava'
              : 'glacier_snow'
          );
        } else {
          splatMap[idx] = defaultTexIdx;
        }
      } else if (clampedH < biome.waterLevel + 10) {
        splatMap[idx] = getTextureIndex('river_stream');
      } else if (clampedH < biome.waterLevel + 42) {
        splatMap[idx] = getTextureIndex('desert_sand');
      } else if (clampedH > 620) {
        splatMap[idx] = getTextureIndex('glacier_snow');
      } else if (clampedH > 420) {
        splatMap[idx] = getTextureIndex('limestone_cliff');
      } else {
        splatMap[idx] = defaultTexIdx;
      }
    }
  }

  recomputeTerrainColors(heightMap, splatMap, colorMap, biomeId);

  const rawStarterProps: Array<{
    prefabId: PrefabId;
    label: string;
    x: number;
    z: number;
    scale: number;
    rotationY: number;
  }> =
    biomeId === 'himalaya_alps_andes'
      ? [
          { prefabId: 'himalaya_matterhorn_peak', label: 'Đỉnh Sừng Băng Matterhorn (Dãy Anpơ — Từ Ảnh Mẫu)', x: -18, z: -12, scale: 1.35, rotationY: 0 },
          { prefabId: 'himalaya_fishtail_peak', label: 'Đỉnh Đuôi Cá Machapuchare / Everest (Himalaya — Từ Ảnh Mẫu)', x: 18, z: -12, scale: 1.35, rotationY: 0 },
          { prefabId: 'himalaya_matterhorn_peak', label: 'Đỉnh Aconcagua & Hồ Băng Andes', x: 0, z: -26, scale: 1.2, rotationY: 0.15 },
          { prefabId: 'taiga_spruce_grove', label: 'Rừng Thông Sơn Cước Anpơ', x: -16, z: 14, scale: 1.05, rotationY: 0.8 },
          { prefabId: 'sheer_cliff_wall', label: 'Vách Đá Băng Hà Patagonia', x: 22, z: 12, scale: 1.15, rotationY: -0.4 },
          { prefabId: 'aether_crystal', label: 'Trạm Khí Tượng Đỉnh Núi Tuyết', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'sahara_atacama_gobi'
      ? [
          { prefabId: 'sahara_atacama_oasis', label: 'Ốc Đảo Cọ & Đồi Cát Sahara', x: -18, z: -14, scale: 1.2, rotationY: 0.35 },
          { prefabId: 'sahara_atacama_oasis', label: 'Thung Lũng Mặt Trăng Atacama & Bãi Muối', x: 20, z: -12, scale: 1.15, rotationY: -0.6 },
          { prefabId: 'karst_mountain', label: 'Vách Đá Lửa Flaming Cliffs (Sa Mạc Gobi)', x: 0, z: -24, scale: 1.35, rotationY: 0.2 },
          { prefabId: 'sheer_cliff_wall', label: 'Cột Đá Gió Mòn Tassili Sahara', x: -22, z: 14, scale: 1.15, rotationY: 0.9 },
          { prefabId: 'meteor_impact_crater', label: 'Hố Thiên Thạch Sa Mạc Atacama', x: 20, z: 14, scale: 1.05, rotationY: 0.4 },
          { prefabId: 'aether_crystal', label: 'Trạm Quan Trắc Thiên Văn Atacama ALMA', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'hawaii_shield_volcano'
      ? [
          { prefabId: 'island_volcano_icon', label: 'Núi Lửa Đảo Nhiệt Đới (Từ Ảnh Mẫu)', x: 0, z: -10, scale: 1.35, rotationY: 0 },
          { prefabId: 'hawaii_kilauea_shield', label: 'Miệng Núi Lửa Kīlauea & Hồ Dung Nham', x: -22, z: -18, scale: 1.3, rotationY: 0.25 },
          { prefabId: 'hawaii_kilauea_shield', label: 'Đỉnh Núi Lửa Khiên Mauna Loa (Hawaii)', x: 22, z: -16, scale: 1.25, rotationY: -0.45 },
          { prefabId: 'active_volcano', label: 'Dòng Magma Pahoehoe Đổ Biển', x: 0, z: -26, scale: 1.15, rotationY: 0.1 },
          { prefabId: 'amazon_congo_canopy_tree', label: 'Rừng Nhiệt Đới Bờ Biển Kauai', x: -16, z: 14, scale: 1.05, rotationY: 0.7 },
          { prefabId: 'amazon_congo_canopy_tree', label: 'Thung Lũng Dương Xỉ Hawaii', x: 18, z: 14, scale: 1.0, rotationY: 1.6 },
          { prefabId: 'aether_crystal', label: 'Đài Quan Sát Núi Lửa Hawaii', x: 0, z: 8, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'amazon_congo_rainforest'
      ? [
          { prefabId: 'amazon_congo_canopy_tree', label: 'Đại Thụ Kapok Rừng Mưa Amazon', x: -18, z: -14, scale: 1.25, rotationY: 0.3 },
          { prefabId: 'amazon_congo_canopy_tree', label: 'Cổ Thụ Baobab & Lim Xanh Trung Phi Congo', x: 18, z: -12, scale: 1.2, rotationY: 1.4 },
          { prefabId: 'amazon_congo_canopy_tree', label: 'Tán Rừng Nhiệt Đới Đa Tầng', x: -16, z: 14, scale: 1.15, rotationY: 2.1 },
          { prefabId: 'berry_apricorn_tree', label: 'Cây Ăn Quả Nhiệt Đới Lưu Vực Amazon', x: 16, z: 14, scale: 1.1, rotationY: 0.8 },
          { prefabId: 'karst_mountain', label: 'Núi Bàn Tepui Rừng Amazon (Thác Thiên Thần)', x: 0, z: -26, scale: 1.4, rotationY: 0.15 },
          { prefabId: 'ancient_bridge', label: 'Cầu Đá Cổ Vượt Sông Nhiệt Đới', x: 0, z: 14, scale: 1.0, rotationY: 0 },
          { prefabId: 'aether_crystal', label: 'Trạm Sinh Thái Rừng Mưa Nhiệt Đới', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'boreal_taiga_forest'
      ? [
          { prefabId: 'taiga_spruce_grove', label: 'Rừng Vân Sam Lá Kim Siberia', x: -18, z: -14, scale: 1.2, rotationY: 0.2 },
          { prefabId: 'taiga_spruce_grove', label: 'Quần Thể Thông Phương Bắc Bắc Âu', x: 18, z: -12, scale: 1.15, rotationY: 1.2 },
          { prefabId: 'taiga_spruce_grove', label: 'Rừng Thông Tuyết Yukon Canada', x: -16, z: 14, scale: 1.15, rotationY: 2.4 },
          { prefabId: 'emerald_pine', label: 'Thông Lãnh Nguyên Cổ Thụ', x: 16, z: 14, scale: 1.15, rotationY: 0.6 },
          { prefabId: 'himalaya_matterhorn_peak', label: 'Đỉnh Núi Đá Granite Phương Bắc', x: 0, z: -26, scale: 1.25, rotationY: 0.3 },
          { prefabId: 'windmill_cottage', label: 'Trạm Kiểm Lâm Rừng Taiga', x: 0, z: 14, scale: 0.95, rotationY: 0.1 },
          { prefabId: 'aether_crystal', label: 'Cột Cực Quang Phương Bắc', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'pluto_cryovolcano'
      ? [
          { prefabId: 'pluto_cryo_volcano', label: 'Núi Lửa Băng Wright Mons (Pluto)', x: -20, z: -16, scale: 1.25, rotationY: 0.3 },
          { prefabId: 'pluto_cryo_volcano', label: 'Núi Lửa Băng Piccard Mons', x: 22, z: -14, scale: 1.15, rotationY: -0.6 },
          { prefabId: 'europa_penitentes_spire', label: 'Rừng Băng Tartarus Penitentes', x: -16, z: 14, scale: 1.2, rotationY: 0.8 },
          { prefabId: 'europa_penitentes_spire', label: 'Cột Băng Nitơ Sputnik Planitia', x: 20, z: 12, scale: 1.15, rotationY: 1.4 },
          { prefabId: 'meteor_impact_crater', label: 'Hố Va Chạm Vành Đai Kuiper', x: 0, z: -24, scale: 1.1, rotationY: 0.2 },
          { prefabId: 'aether_crystal', label: 'Trạm Thăm Dò New Horizons', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'titan_methane_sea'
      ? [
          { prefabId: 'titan_mithrim_montes', label: 'Núi Rãnh Sao Mithrim / Doom Mons (Titan — Ảnh NASA JPL)', x: 0, z: -14, scale: 1.35, rotationY: 0 },
          { prefabId: 'titan_methane_geyser', label: 'Vịnh Mêtan Kraken Mare', x: -20, z: -14, scale: 1.25, rotationY: 0.25 },
          { prefabId: 'titan_methane_geyser', label: 'Hồ Hydrocarbon Ligeia Mare', x: 20, z: -12, scale: 1.2, rotationY: -0.5 },
          { prefabId: 'pluto_cryo_volcano', label: 'Núi Lửa Băng Sotra Patera (Titan)', x: 0, z: -28, scale: 1.15, rotationY: 0.4 },
          { prefabId: 'venus_pancake_dome', label: 'Đảo Đá Cuội Băng Huygens', x: -16, z: 14, scale: 1.1, rotationY: 1.1 },
          { prefabId: 'karst_mountain', label: 'Cồn Cát Hydrocarbon Tối', x: 22, z: 12, scale: 1.25, rotationY: 0.7 },
          { prefabId: 'aether_crystal', label: 'Trạm Đổ Bộ Cassini-Huygens', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'europa_chaos_ridge'
      ? [
          { prefabId: 'europa_penitentes_spire', label: 'Rãnh Băng Đỏ Conamara Chaos', x: -18, z: -14, scale: 1.3, rotationY: 0.35 },
          { prefabId: 'pluto_cryo_volcano', label: 'Mạch Phun Nước Ngầm Europa', x: 20, z: -14, scale: 1.2, rotationY: -0.45 },
          { prefabId: 'europa_penitentes_spire', label: 'Tháp Băng Tiger Stripes', x: -15, z: 14, scale: 1.15, rotationY: 1.2 },
          { prefabId: 'abyss_chasm_vortex', label: 'Vực Băng Đại Dương Ngầm', x: 20, z: 12, scale: 1.1, rotationY: 0 },
          { prefabId: 'sheer_cliff_wall', label: 'Vách Đứt Gãy Vỏ Băng', x: 0, z: -25, scale: 1.15, rotationY: 0.1 },
          { prefabId: 'aether_crystal', label: 'Trạm Khoan Băng Europa Clipper', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'corot_lava_ocean'
      ? [
          { prefabId: 'active_volcano', label: 'Siêu Núi Lửa Magma CoRoT-7b', x: -20, z: -16, scale: 1.35, rotationY: 0.3 },
          { prefabId: 'venus_pancake_dome', label: 'Hồ Silicat Nóng Chảy 55 Cancri e', x: 20, z: -14, scale: 1.25, rotationY: -0.5 },
          { prefabId: 'exoplanet_crystal_spire', label: 'Cột Tinh Thể Kim Cương Nhiệt Áp', x: -16, z: 14, scale: 1.2, rotationY: 0.9 },
          { prefabId: 'meteor_impact_crater', label: 'Hố Thiên Thạch Nóng Chảy', x: 20, z: 12, scale: 1.15, rotationY: 0.4 },
          { prefabId: 'volcanic_peak', label: 'Vách Bazan Chạng Vạng', x: 0, z: -24, scale: 1.3, rotationY: 0.2 },
          { prefabId: 'aether_crystal', label: 'Lõi Chắn Nhiệt Ngoại Hành Tinh', x: 0, z: 0, scale: 1.05, rotationY: 0 },
        ]
      : biomeId === 'mars_olympus'
      ? [
          { prefabId: 'mars_olympus_shield', label: 'Đỉnh Núi Lửa Olympus Mons', x: -22, z: -18, scale: 1.25, rotationY: 0.3 },
          { prefabId: 'meteor_impact_crater', label: 'Hố Thiên Thạch Jezero', x: 18, z: -10, scale: 1.15, rotationY: 0.8 },
          { prefabId: 'sheer_cliff_wall', label: 'Vách Hẻm Núi Valles Marineris', x: 0, z: -26, scale: 1.2, rotationY: 0.1 },
          { prefabId: 'meteor_impact_crater', label: 'Hố Sao Băng Hellas', x: -16, z: 14, scale: 1.0, rotationY: 1.6 },
          { prefabId: 'karst_mountain', label: 'Cột Đá Oxit Sắt Cydonia', x: 24, z: 12, scale: 1.35, rotationY: 0.5 },
          { prefabId: 'aether_crystal', label: 'Trạm Thăm Dò Địa Chất Sao Hỏa', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'venus_ishtar'
      ? [
          { prefabId: 'venus_pancake_dome', label: 'Vòm Dung Nham Pancake Alpha', x: -20, z: -14, scale: 1.25, rotationY: 0.2 },
          { prefabId: 'active_volcano', label: 'Đỉnh Núi Lửa Maat Mons', x: 20, z: -18, scale: 1.25, rotationY: -0.4 },
          { prefabId: 'venus_pancake_dome', label: 'Vòm Lưu Huỳnh Ishtar', x: -14, z: 14, scale: 1.1, rotationY: 1.1 },
          { prefabId: 'volcanic_peak', label: 'Cột Bazan Áp Suất Cao', x: 22, z: 12, scale: 1.3, rotationY: 0.9 },
          { prefabId: 'meteor_impact_crater', label: 'Hố Va Chạm Áp Suất', x: 0, z: -24, scale: 1.1, rotationY: 0.4 },
          { prefabId: 'aether_crystal', label: 'Trụ Cảm Biến Khí Quyển Sao Kim', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'kepler_crystalline' || biomeId === 'trappist_tidally_locked'
      ? [
          { prefabId: 'exoplanet_crystal_spire', label: 'Tháp Tinh Thể Silicat Kepler', x: -18, z: -14, scale: 1.25, rotationY: 0.4 },
          { prefabId: 'exoplanet_crystal_spire', label: 'Cụm Thạch Anh Ngoại Hành Tinh', x: 20, z: -12, scale: 1.15, rotationY: 1.5 },
          { prefabId: 'floating_sky_island', label: 'Đảo Đá Từ Trường Lơ Lửng', x: 0, z: -10, scale: 1.0, rotationY: 0.2 },
          { prefabId: 'meteor_impact_crater', label: 'Hố Sao Băng Ngoại Hệ', x: -16, z: 12, scale: 1.1, rotationY: 0.7 },
          { prefabId: 'abyss_chasm_vortex', label: 'Khe Đứt Gãy Khóa Thủy Triều', x: 20, z: 12, scale: 1.05, rotationY: 0 },
          { prefabId: 'aether_crystal', label: 'Lõi Năng Lượng Ngoại Hành Tinh', x: 0, z: 0, scale: 1.1, rotationY: 0 },
        ]
      : biomeId === 'inazuma_sakura'
      ? [
          { prefabId: 'sakura_shrine', label: 'Đền Narukami Thượng', x: -16, z: -14, scale: 1.0, rotationY: 0.4 },
          { prefabId: 'sakura_tree', label: 'Anh Đào Thần Thụ', x: -24, z: -4, scale: 1.0, rotationY: 1.1 },
          { prefabId: 'sakura_tree', label: 'Cây Anh Đào Cổ', x: 18, z: -12, scale: 1.0, rotationY: 2.2 },
          { prefabId: 'sakura_tree', label: 'Cây Anh Đào Ven Suối', x: 16, z: 14, scale: 1.0, rotationY: 0.7 },
          { prefabId: 'ancient_bridge', label: 'Cầu Đá Inazuma', x: 0, z: 14, scale: 1.0, rotationY: 0.15 },
          { prefabId: 'karst_mountain', label: 'Vách Đá Tím', x: 32, z: -26, scale: 1.5, rotationY: 0.8 },
          { prefabId: 'aether_crystal', label: 'Trụ Lôi Thần', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ]
      : biomeId === 'liyue_amber'
      ? [
          { prefabId: 'karst_mountain', label: 'Đỉnh Tuyệt Vân Bắc', x: -28, z: -26, scale: 1.6, rotationY: 0.5 },
          { prefabId: 'karst_mountain', label: 'Cột Đá Hổ Phách', x: 30, z: -22, scale: 1.5, rotationY: 1.8 },
          { prefabId: 'sakura_shrine', label: 'Vọng Thư Các', x: 16, z: -8, scale: 1.0, rotationY: -0.5 },
          { prefabId: 'ancient_bridge', label: 'Cầu Đá Cổ Vân', x: 0, z: 14, scale: 1.0, rotationY: 0.2 },
          { prefabId: 'emerald_pine', label: 'Thông Cổ Thụ', x: -18, z: 12, scale: 1.0, rotationY: 0.9 },
          { prefabId: 'aether_crystal', label: 'Tinh Thể Nham Thần', x: 0, z: 0, scale: 1.0, rotationY: 0.4 },
        ]
      : [
          { prefabId: 'windmill_cottage', label: 'Nhà Cối Xay Gió Phong Khởi', x: -16, z: -12, scale: 1.0, rotationY: 0.45 },
          { prefabId: 'pokemon_center', label: 'Trung Tâm Lữ Hành Thảo Nguyên', x: 17, z: -10, scale: 1.0, rotationY: -0.6 },
          { prefabId: 'ancient_bridge', label: 'Cầu Đá Qua Suối', x: 0, z: 16, scale: 1.0, rotationY: 0.15 },
          { prefabId: 'karst_mountain', label: 'Vách Đá Phong Long', x: -32, z: -28, scale: 1.5, rotationY: 0.3 },
          { prefabId: 'volcanic_peak', label: 'Núi Đá Cổ Đại', x: 34, z: -26, scale: 1.5, rotationY: 1.4 },
          { prefabId: 'emerald_pine', label: 'Rừng Thông Ngọc Lục 1', x: -18, z: 12, scale: 1.0, rotationY: 0.2 },
          { prefabId: 'emerald_pine', label: 'Rừng Thông Ngọc Lục 2', x: 18, z: 12, scale: 1.0, rotationY: 1.9 },
          { prefabId: 'sakura_tree', label: 'Cây Hoa Gió Ấm', x: -10, z: 22, scale: 1.0, rotationY: 0.8 },
          { prefabId: 'aether_crystal', label: 'Đài Dịch Chuyển Tinh Thể', x: 0, z: 0, scale: 1.0, rotationY: 0 },
        ];

  const initialObjects: PlacedObject[] = rawStarterProps.map((item, idx) => {
    const groundY = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, item.x, item.z);
    return {
      id: `init-${idx}-${item.prefabId}`,
      prefabId: item.prefabId,
      label: item.label,
      x: item.x,
      y: groundY,
      z: item.z,
      scale: item.scale,
      rotationY: item.rotationY,
    };
  });

  return { heightMap, splatMap, colorMap, initialObjects };
}

export interface PixelReconstructionMetrics {
  avgR: number;
  avgG: number;
  avgB: number;
  waterRatio: number;
  greenRatio: number;
  pinkRatio: number;
  warmRatio: number;
  snowRatio: number;
  contrastScore: number;
  peakElevationMeters: number;
  suggestedBiome: BiomeId;
  suggestedTexture: TextureBrushId;
}

export interface ReconstructedWorldData {
  heightMap: Float32Array;
  splatMap: Uint8Array;
  colorMap: Float32Array;
  metrics: PixelReconstructionMetrics;
  detectedObjects: PlacedObject[];
}

/**
 * Reconstructs a full 10x10 km 3D open-world terrain heightfield (up to 1,000m / 1 km elevation),
 * biome texture splat map, and 3D landmarks/objects from an RGBA image pixel buffer!
 */
export function reconstructFromRgbaBuffer(
  rgba: Uint8ClampedArray | number[],
  imgWidth: number,
  imgHeight: number,
  options?: {
    reliefScale?: number;
    waterLevel?: number;
    terraceSteps?: number;
    overrideBiome?: BiomeId;
    mode?: 'terrain' | 'object' | 'both';
  }
): ReconstructedWorldData {
  const heightMap = new Float32Array(TOTAL_VERTICES);
  const splatMap = new Uint8Array(TOTAL_VERTICES);
  const colorMap = new Float32Array(TOTAL_VERTICES * 3);

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let waterCount = 0;
  let greenCount = 0;
  let pinkCount = 0;
  let warmCount = 0;
  let snowCount = 0;
  let minLum = 1;
  let maxLum = 0;

  const reliefScale = options?.reliefScale ?? 1.25;
  const terraceSteps = options?.terraceSteps ?? 0;
  const mode = options?.mode ?? 'both';

  const structureHotspots: Array<{ ix: number; iz: number; score: number }> = [];
  const mountainHotspots: Array<{ ix: number; iz: number; score: number }> = [];
  const treeHotspots: Array<{ ix: number; iz: number; score: number }> = [];
  const sakuraHotspots: Array<{ ix: number; iz: number; score: number }> = [];

  for (let iz = 0; iz <= GRID_SIZE; iz++) {
    for (let ix = 0; ix <= GRID_SIZE; ix++) {
      const idx = iz * VERTEX_COUNT_PER_SIDE + ix;

      const px = Math.min(imgWidth - 1, Math.floor((ix / GRID_SIZE) * imgWidth));
      const py = Math.min(imgHeight - 1, Math.floor((iz / GRID_SIZE) * imgHeight));
      const pIdx = (py * imgWidth + px) * 4;

      const r = (rgba[pIdx] ?? 128) / 255;
      const g = (rgba[pIdx + 1] ?? 128) / 255;
      const b = (rgba[pIdx + 2] ?? 128) / 255;

      sumR += r;
      sumG += g;
      sumB += b;

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      minLum = Math.min(minLum, lum);
      maxLum = Math.max(maxLum, lum);

      const isWater = b > r * 1.18 && b > g * 1.04 && lum < 0.78;
      const isSnow = lum > 0.82 && Math.abs(r - b) < 0.15;
      const isSakura = r > 0.58 && r > g * 1.18 && b > 0.42;
      const isLava = r > 0.72 && g < 0.35 && b < 0.2;
      const isLushGreen = g > r * 1.06 && g > b * 1.08;
      const isWarmGolden = r > 0.55 && g > 0.42 && b < 0.38;

      if (isWater) waterCount++;
      else if (isSnow) snowCount++;
      else if (isSakura) pinkCount++;
      else if (isLushGreen) greenCount++;
      else if (isWarmGolden || isLava) warmCount++;

      let brush: TextureBrushId = 'emerald_grass';
      if (isWater) {
        brush = lum < 0.4 ? 'lake_water' : 'river_stream';
      } else if (isLava) {
        brush = 'volcanic_lava';
      } else if (isSnow) {
        brush = 'glacier_snow';
      } else if (isSakura) {
        brush = 'flower_meadow';
      } else if (isLushGreen) {
        brush = 'emerald_grass';
      } else if (isWarmGolden) {
        brush = 'desert_sand';
      } else if (lum < 0.45) {
        brush = 'limestone_cliff';
      } else {
        brush = 'dirt_cobble_road';
      }
      splatMap[idx] = getTextureIndex(brush);

      // Compute 3D elevation on the 1,000m (1km) vertical scale
      const centerDist = Math.hypot(ix / GRID_SIZE - 0.5, iz / GRID_SIZE - 0.5) * 2;
      let rawElevation = 0;

      if (isWater) {
        rawElevation = -95 - (1 - lum) * 75;
      } else if (mode === 'object') {
        const subjectMask = Math.max(0, 1 - Math.pow(centerDist * 0.95, 2));
        rawElevation = (lum * 760 - 60) * subjectMask * reliefScale + (1 - subjectMask) * 35;
      } else {
        const rockAccent = brush === 'limestone_cliff' || brush === 'glacier_snow' ? 210 : 0;
        rawElevation = ((lum - 0.28) * 860 + rockAccent) * reliefScale;
      }

      if (terraceSteps >= 2 && rawElevation > 40) {
        const stepH = MAX_ELEVATION / terraceSteps;
        rawElevation = Math.round(rawElevation / stepH) * stepH;
      }

      heightMap[idx] = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, rawElevation));

      if (ix > 10 && ix < GRID_SIZE - 10 && iz > 10 && iz < GRID_SIZE - 10 && !isWater) {
        if (isWarmGolden || (r > 0.65 && g < 0.45)) {
          structureHotspots.push({ ix, iz, score: r + lum });
        } else if (lum > 0.72) {
          mountainHotspots.push({ ix, iz, score: lum });
        } else if (isSakura) {
          sakuraHotspots.push({ ix, iz, score: r + b });
        } else if (isLushGreen) {
          treeHotspots.push({ ix, iz, score: g });
        }
      }
    }
  }

  // Smooth the reconstructed heightMap (2 passes)
  const temp = new Float32Array(heightMap.length);
  for (let pass = 0; pass < 2; pass++) {
    temp.set(heightMap);
    for (let iz = 1; iz < GRID_SIZE; iz++) {
      for (let ix = 1; ix < GRID_SIZE; ix++) {
        const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
        const avg =
          (temp[idx] * 2 +
            temp[idx - 1] +
            temp[idx + 1] +
            temp[idx - VERTEX_COUNT_PER_SIDE] +
            temp[idx + VERTEX_COUNT_PER_SIDE]) /
          6;
        heightMap[idx] = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, avg));
      }
    }
  }

  const total = TOTAL_VERTICES;
  const waterRatio = waterCount / total;
  const greenRatio = greenCount / total;
  const pinkRatio = pinkCount / total;
  const warmRatio = warmCount / total;
  const snowRatio = snowCount / total;

  let suggestedBiome: BiomeId = options?.overrideBiome ?? 'mondstadt_meadow';
  if (!options?.overrideBiome) {
    if (pinkRatio > 0.12) suggestedBiome = 'inazuma_sakura';
    else if (snowRatio > 0.25) suggestedBiome = 'snowpeak_glacier';
    else if (waterRatio > 0.28) suggestedBiome = 'paldea_coast';
    else if (warmRatio > 0.22) suggestedBiome = 'liyue_amber';
    else suggestedBiome = 'mondstadt_meadow';
  }

  const suggestedTexture = BIOMES[suggestedBiome].defaultTexture;
  recomputeTerrainColors(heightMap, splatMap, colorMap, suggestedBiome);

  const placed: PlacedObject[] = [];
  const minSpacing = 14; // 14m real-world spacing between village buildings & trees

  const tryPlace = (
    ix: number,
    iz: number,
    prefabId: PrefabId,
    label: string,
    scale: number
  ) => {
    const wx = Math.round(((ix / GRID_SIZE) - 0.5) * 120);
    const wz = Math.round(((iz / GRID_SIZE) - 0.5) * 120);
    if (placed.some((p) => Math.hypot(p.x - wx, p.z - wz) < minSpacing)) {
      return false;
    }
    const wy = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, wx, wz);
    placed.push({
      id: `recon-${placed.length + 1}-${prefabId}`,
      prefabId,
      label,
      x: wx,
      y: Math.round(wy),
      z: wz,
      scale,
      rotationY: ((ix * 7 + iz * 13) % 628) / 100,
    });
    return true;
  };

  structureHotspots.sort((a, b) => b.score - a.score);
  mountainHotspots.sort((a, b) => b.score - a.score);
  sakuraHotspots.sort((a, b) => b.score - a.score);
  treeHotspots.sort((a, b) => b.score - a.score);

  const houseTypes: Array<{ id: PrefabId; label: string }> =
    suggestedBiome === 'inazuma_sakura'
      ? [
          { id: 'sakura_shrine', label: 'Đền Thờ Tái Tạo Từ Ảnh' },
          { id: 'windmill_cottage', label: 'Nhà Cổ Thung Lũng' },
        ]
      : suggestedBiome === 'paldea_coast'
      ? [
          { id: 'pokemon_center', label: 'Trung Tâm Lữ Hành Bờ Vịnh' },
          { id: 'windmill_cottage', label: 'Nhà Cối Xay Gió Ven Biển' },
        ]
      : [
          { id: 'windmill_cottage', label: 'Nhà Cối Xay Gió Tái Tạo' },
          { id: 'pokemon_center', label: 'Trung Tâm Lữ Hành Thảo Nguyên' },
          { id: 'sakura_shrine', label: 'Đền Cổ Trên Đồi' },
        ];

  let housesPlaced = 0;
  for (const spot of structureHotspots) {
    if (housesPlaced >= 3) break;
    const hType = houseTypes[housesPlaced % houseTypes.length];
    if (tryPlace(spot.ix, spot.iz, hType.id, hType.label, 1.1)) {
      housesPlaced++;
    }
  }
  if (housesPlaced === 0) {
    tryPlace(
      Math.floor(GRID_SIZE * 0.42),
      Math.floor(GRID_SIZE * 0.45),
      houseTypes[0].id,
      houseTypes[0].label,
      1.15
    );
  }

  let mountainsPlaced = 0;
  for (const spot of mountainHotspots) {
    if (mountainsPlaced >= 3) break;
    const mId: PrefabId = mountainsPlaced % 2 === 0 ? 'karst_mountain' : 'volcanic_peak';
    const mLabel = mId === 'karst_mountain' ? 'Đỉnh Đá Tái Tạo (1km)' : 'Vách Núi Cổ Đại';
    if (tryPlace(spot.ix, spot.iz, mId, mLabel, 1.25)) {
      mountainsPlaced++;
    }
  }

  let treesPlaced = 0;
  for (const spot of sakuraHotspots) {
    if (treesPlaced >= 3) break;
    if (tryPlace(spot.ix, spot.iz, 'sakura_tree', 'Cây Anh Đào Tái Tạo', 1.1)) {
      treesPlaced++;
    }
  }
  for (const spot of treeHotspots) {
    if (treesPlaced >= 5) break;
    if (tryPlace(spot.ix, spot.iz, 'emerald_pine', 'Rừng Thông Tái Tạo', 1.1)) {
      treesPlaced++;
    }
  }

  // Place central island_volcano_icon when reconstructing an object or volcanic island image
  if (mode === 'object' || (warmRatio > 0.14 && greenRatio > 0.04)) {
    const wyCenter = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, 0, -6);
    placed.unshift({
      id: `recon-volcano-island_volcano_icon`,
      prefabId: 'island_volcano_icon',
      label: 'Núi Lửa Đảo Nhiệt Đới (Từ Ảnh Mẫu)',
      x: 0,
      y: Math.round(wyCenter),
      z: -6,
      scale: 1.35,
      rotationY: 0,
    });
  }

  tryPlace(
    Math.floor(GRID_SIZE * 0.55),
    Math.floor(GRID_SIZE * 0.52),
    'aether_crystal',
    'Tinh Thể Phong Thần',
    1.05
  );

  const { maxElevation } = getTerrainElevationStats(heightMap);

  return {
    heightMap,
    splatMap,
    colorMap,
    metrics: {
      avgR: Math.round((sumR / total) * 255),
      avgG: Math.round((sumG / total) * 255),
      avgB: Math.round((sumB / total) * 255),
      waterRatio: Number(waterRatio.toFixed(3)),
      greenRatio: Number(greenRatio.toFixed(3)),
      pinkRatio: Number(pinkRatio.toFixed(3)),
      warmRatio: Number(warmRatio.toFixed(3)),
      snowRatio: Number(snowRatio.toFixed(3)),
      contrastScore: Number((maxLum - minLum).toFixed(3)),
      peakElevationMeters: maxElevation,
      suggestedBiome,
      suggestedTexture,
    },
    detectedObjects: placed,
  };
}

// ============================================================================
// RULE-BASED GENERATION ENGINE ("VẼ THEO QUY LUẬT")
// Example rule: "Nếu cao độ > 500m thì tự động đặt vật thể đá nhọn"
// ============================================================================

export function evaluateRuleElevation(elevationMeters: number, rule: TerrainRule): boolean {
  if (rule.operator === '>') {
    return elevationMeters > rule.thresholdMeters;
  }
  if (rule.operator === '<') {
    return elevationMeters < rule.thresholdMeters;
  }
  const low = Math.min(rule.thresholdMeters, rule.maxThresholdMeters ?? rule.thresholdMeters + 100);
  const high = Math.max(rule.thresholdMeters, rule.maxThresholdMeters ?? rule.thresholdMeters + 100);
  return elevationMeters >= low && elevationMeters <= high;
}

export function formatTerrainRuleFormula(rule: TerrainRule): string {
  const prefabMeta = PREFAB_CATALOG.find((p) => p.id === rule.targetPrefabId);
  const prefabLabel =
    rule.targetPrefabId === 'karst_mountain'
      ? 'Đá Nhọn (Đỉnh Đá Thạch Anh)'
      : prefabMeta?.name || rule.targetPrefabId;

  if (rule.operator === '>') {
    return `Nếu cao độ > ${rule.thresholdMeters}m → Đặt ${prefabLabel}`;
  }
  if (rule.operator === '<') {
    return `Nếu cao độ < ${rule.thresholdMeters}m → Đặt ${prefabLabel}`;
  }
  const high = rule.maxThresholdMeters ?? rule.thresholdMeters + 100;
  return `Nếu cao độ ${rule.thresholdMeters}m..${high}m → Đặt ${prefabLabel}`;
}

/**
 * Executes active rule-based generation rules across the 10x10 km terrain.
 * - Evaluates each vertex against enabled TerrainRule conditions (e.g., elevation > 500m).
 * - Optionally sculpts dramatic matching peaks/chasms when `ensureMatchingTerrain` is true and the current map
 *   has no vertices matching the rule (e.g., when starting from a 0m flat plane).
 * - Paints the rule's target surface texture and places 3D objects (e.g., sharp rock spires `karst_mountain`)
 *   exclusively on coordinates whose ground elevation satisfies the rule condition.
 */
export function executeTerrainRules(
  heightMap: Float32Array,
  splatMap: Uint8Array,
  colorMap: Float32Array,
  biomeId: BiomeId,
  rules: TerrainRule[],
  existingObjects: PlacedObject[],
  options?: {
    ensureMatchingTerrain?: boolean;
    focusAreaWorldX?: number;
    focusAreaWorldZ?: number;
    focusRadiusMeters?: number;
  }
): TerrainRuleExecutionResult {
  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length === 0) {
    return {
      newObjects: [...existingObjects],
      addedObjects: [],
      addedCount: 0,
      paintedVerticesCount: 0,
      sculptedVerticesCount: 0,
      matchedRulesCount: 0,
      summary: 'Chưa có quy luật nào được bật.',
    };
  }

  const half = WORLD_SIZE / 2;
  const cellSpan = WORLD_SIZE / GRID_SIZE; // 62.5m per grid cell
  const ensureMatching = options?.ensureMatchingTerrain ?? false;
  let sculptedVerticesCount = 0;

  // Step 1: If ensureMatchingTerrain is requested and a rule currently has 0 matching vertices on the map,
  // automatically sculpt scenic peaks/chasms near the visible center so the rule immediately demonstrates its effect.
  if (ensureMatching) {
    for (const rule of enabledRules) {
      let existingMatchCount = 0;
      for (let i = 0; i < heightMap.length; i++) {
        if (evaluateRuleElevation(heightMap[i], rule)) {
          existingMatchCount++;
          if (existingMatchCount >= 4) break;
        }
      }

      if (existingMatchCount < 4) {
        if (rule.operator === '>') {
          const targetPeakH = Math.min(
            MAX_ELEVATION,
            Math.max(rule.thresholdMeters + 95, Math.round(rule.thresholdMeters * 1.16))
          );
          // 4 scenic mountain massifs ringing the background so center village at (0,0) stays flat
          const peakCenters = [
            { x: -cellSpan * 2, z: -cellSpan * 2 },
            { x: cellSpan * 2, z: -cellSpan * 2 },
            { x: 0, z: -cellSpan * 2 },
            { x: -cellSpan * 2, z: -cellSpan },
          ];

          for (const pc of peakCenters) {
            for (let iz = 0; iz <= GRID_SIZE; iz++) {
              for (let ix = 0; ix <= GRID_SIZE; ix++) {
                const wx = (ix / GRID_SIZE) * WORLD_SIZE - half;
                const wz = (iz / GRID_SIZE) * WORLD_SIZE - half;
                const dist = Math.hypot(wx - pc.x, wz - pc.z);
                const radius = cellSpan * 1.15;
                if (dist <= radius) {
                  const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
                  const falloff = 0.5 * (1 + Math.cos((Math.PI * dist) / radius));
                  const sculptedH = heightMap[idx] + (targetPeakH - heightMap[idx]) * Math.pow(falloff, 0.65);
                  if (sculptedH > heightMap[idx]) {
                    heightMap[idx] = Math.min(MAX_ELEVATION, sculptedH);
                    sculptedVerticesCount++;
                  }
                }
              }
            }
          }
        } else if (rule.operator === '<') {
          const targetDepthH = Math.max(
            MIN_ELEVATION,
            Math.min(rule.thresholdMeters - 60, Math.round(rule.thresholdMeters * 1.35))
          );
          const chasmCenters = [
            { x: cellSpan, z: cellSpan },
            { x: -cellSpan, z: cellSpan },
          ];
          for (const cc of chasmCenters) {
            for (let iz = 0; iz <= GRID_SIZE; iz++) {
              for (let ix = 0; ix <= GRID_SIZE; ix++) {
                const wx = (ix / GRID_SIZE) * WORLD_SIZE - half;
                const wz = (iz / GRID_SIZE) * WORLD_SIZE - half;
                const dist = Math.hypot(wx - cc.x, wz - cc.z);
                const radius = cellSpan * 1.45;
                if (dist <= radius) {
                  const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
                  const falloff = 0.5 * (1 + Math.cos((Math.PI * dist) / radius));
                  const sculptedH = heightMap[idx] + (targetDepthH - heightMap[idx]) * Math.pow(falloff, 0.75);
                  if (sculptedH < heightMap[idx]) {
                    heightMap[idx] = Math.max(MIN_ELEVATION, sculptedH);
                    sculptedVerticesCount++;
                  }
                }
              }
            }
          }
        } else if (rule.operator === 'between') {
          const midH = Math.max(
            MIN_ELEVATION,
            Math.min(
              MAX_ELEVATION,
              (rule.thresholdMeters + (rule.maxThresholdMeters ?? rule.thresholdMeters + 100)) * 0.5
            )
          );
          const ridgeCenters = [
            { x: -cellSpan, z: cellSpan },
            { x: cellSpan, z: -cellSpan },
          ];
          for (const rc of ridgeCenters) {
            for (let iz = 0; iz <= GRID_SIZE; iz++) {
              for (let ix = 0; ix <= GRID_SIZE; ix++) {
                const wx = (ix / GRID_SIZE) * WORLD_SIZE - half;
                const wz = (iz / GRID_SIZE) * WORLD_SIZE - half;
                const dist = Math.hypot(wx - rc.x, wz - rc.z);
                const radius = cellSpan * 1.5;
                if (dist <= radius) {
                  const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
                  const falloff = 0.5 * (1 + Math.cos((Math.PI * dist) / radius));
                  heightMap[idx] = heightMap[idx] + (midH - heightMap[idx]) * falloff;
                  sculptedVerticesCount++;
                }
              }
            }
          }
        }
      }
    }
  }

  let anyObjectYChanged = false;
  const allObjects: PlacedObject[] = existingObjects.map((o) => {
    const nextY = Number(getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, o.x, o.z).toFixed(2));
    if (nextY === o.y) return o;
    anyObjectYChanged = true;
    return { ...o, y: nextY };
  });
  const addedObjects: PlacedObject[] = [];
  let paintedVerticesCount = 0;
  let matchedRulesCount = 0;

  const hasFocusFilter =
    typeof options?.focusAreaWorldX === 'number' &&
    typeof options?.focusAreaWorldZ === 'number' &&
    typeof options?.focusRadiusMeters === 'number';

  const focusX = hasFocusFilter ? (options!.focusAreaWorldX as number) : 0;
  const focusZ = hasFocusFilter ? (options!.focusAreaWorldZ as number) : 0;
  const focusRadius = hasFocusFilter
    ? Math.max(options!.focusRadiusMeters as number, cellSpan * 1.15)
    : WORLD_SIZE;

  const scanMinIx = hasFocusFilter
    ? Math.max(0, Math.floor(((focusX - focusRadius + half) / WORLD_SIZE) * GRID_SIZE))
    : 0;
  const scanMaxIx = hasFocusFilter
    ? Math.min(GRID_SIZE, Math.ceil(((focusX + focusRadius + half) / WORLD_SIZE) * GRID_SIZE))
    : GRID_SIZE;
  const scanMinIz = hasFocusFilter
    ? Math.max(0, Math.floor(((focusZ - focusRadius + half) / WORLD_SIZE) * GRID_SIZE))
    : 0;
  const scanMaxIz = hasFocusFilter
    ? Math.min(GRID_SIZE, Math.ceil(((focusZ + focusRadius + half) / WORLD_SIZE) * GRID_SIZE))
    : GRID_SIZE;

  for (const rule of enabledRules) {
    const prefabMeta =
      PREFAB_CATALOG.find((p) => p.id === rule.targetPrefabId) || PREFAB_CATALOG[0];
    const texIdx =
      rule.targetTextureId && rule.targetTextureId !== 'none'
        ? getTextureIndex(rule.targetTextureId)
        : null;

    // Collect matching vertices for this rule within the active scan bounds
    const matchingVertices: Array<{ wx: number; wz: number; h: number; distOrigin: number }> = [];

    for (let iz = scanMinIz; iz <= scanMaxIz; iz++) {
      for (let ix = scanMinIx; ix <= scanMaxIx; ix++) {
        const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
        const h = heightMap[idx];
        if (!evaluateRuleElevation(h, rule)) continue;

        const wx = (ix / GRID_SIZE) * WORLD_SIZE - half;
        const wz = (iz / GRID_SIZE) * WORLD_SIZE - half;

        if (hasFocusFilter) {
          const distFocus = Math.hypot(wx - focusX, wz - focusZ);
          if (distFocus > focusRadius) {
            continue;
          }
        }

        if (texIdx !== null && splatMap[idx] !== texIdx) {
          splatMap[idx] = texIdx;
          paintedVerticesCount++;
        }

        matchingVertices.push({
          wx,
          wz,
          h,
          distOrigin: Math.hypot(wx, wz),
        });
      }
    }

    if (matchingVertices.length === 0) continue;
    matchedRulesCount++;

    // Prioritize matching vertices near the visible scene first, then by extreme elevation
    matchingVertices.sort((a, b) => {
      const aNear = a.distOrigin <= 350 ? 0 : 1;
      const bNear = b.distOrigin <= 350 ? 0 : 1;
      if (aNear !== bNear) return aNear - bNear;
      return rule.operator === '<' ? a.h - b.h : b.h - a.h;
    });

    // Build candidate placement coordinates on and around the matching vertices
    const subOffsets = [
      { dx: 0, dz: 0 },
      { dx: -9, dz: -7 },
      { dx: 10, dz: -8 },
      { dx: -11, dz: 9 },
      { dx: 11, dz: 10 },
      { dx: 0, dz: -14 },
      { dx: -15, dz: 0 },
      { dx: 15, dz: 0 },
    ];

    let placedForRule = 0;
    const maxToPlace = Math.max(1, Math.min(24, rule.maxObjectsToPlace));
    const minSpacing = Math.max(6, rule.minSpacingMeters);

    for (const v of matchingVertices) {
      if (placedForRule >= maxToPlace) break;

      for (let sIdx = 0; sIdx < subOffsets.length; sIdx++) {
        if (placedForRule >= maxToPlace) break;
        const off = subOffsets[sIdx];
        const cx = Number((v.wx + off.dx).toFixed(1));
        const cz = Number((v.wz + off.dz).toFixed(1));

        // Verify interpolated ground elevation at (cx, cz) strictly satisfies the rule condition
        const groundY = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, cx, cz);
        if (!evaluateRuleElevation(groundY, rule)) continue;

        // Check spacing against existing objects of the same prefab (or very close any object)
        const tooClose = allObjects.some((obj) => {
          const d = Math.hypot(obj.x - cx, obj.z - cz);
          return obj.prefabId === rule.targetPrefabId ? d < minSpacing : d < 6;
        });
        if (tooClose) continue;

        const labelSuffix =
          rule.targetPrefabId === 'karst_mountain'
            ? `Đá Nhọn Quy Luật (${Math.round(groundY)}m)`
            : `${prefabMeta.name} (${Math.round(groundY)}m)`;

        const newObj: PlacedObject = {
          id: `rule-${rule.id}-${Date.now()}-${addedObjects.length + 1}`,
          prefabId: rule.targetPrefabId,
          label: labelSuffix,
          x: cx,
          y: Number(groundY.toFixed(2)),
          z: cz,
          scale: Number(Math.max(0.4, Math.min(3.0, rule.scale)).toFixed(2)),
          rotationY: Number((((addedObjects.length * 73 + sIdx * 41) % 360) * (Math.PI / 180)).toFixed(3)),
        };

        allObjects.push(newObj);
        addedObjects.push(newObj);
        placedForRule++;
      }
    }
  }

  if (sculptedVerticesCount > 0 || paintedVerticesCount > 0) {
    recomputeTerrainColors(
      heightMap,
      splatMap,
      colorMap,
      biomeId,
      hasFocusFilter && !ensureMatching
        ? {
            minIx: scanMinIx,
            maxIx: scanMaxIx,
            minIz: scanMinIz,
            maxIz: scanMaxIz,
          }
        : undefined
    );
  }

  const firstRuleText = enabledRules[0] ? formatTerrainRuleFormula(enabledRules[0]) : '';
  const summary =
    addedObjects.length > 0
      ? `Đã thực thi ${enabledRules.length} quy luật (${firstRuleText}): Tự động đặt ${addedObjects.length} vật thể 3D & tô ${paintedVerticesCount} điểm địa hình.`
      : paintedVerticesCount > 0
      ? `Đã áp dụng ${enabledRules.length} quy luật: Cập nhật ${paintedVerticesCount} điểm bề mặt địa hình.`
      : `Đã kiểm tra ${enabledRules.length} quy luật: Các đỉnh đủ điều kiện đã có đủ mật độ vật thể.`;

  return {
    newObjects: addedObjects.length > 0 || anyObjectYChanged ? allObjects : existingObjects,
    addedObjects,
    addedCount: addedObjects.length,
    paintedVerticesCount,
    sculptedVerticesCount,
    matchedRulesCount,
    summary,
  };
}

export interface DayNightLightingState {
  normalizedTimeHours: number;
  formattedClock: string;
  phase: DayPhaseId;
  phaseLabelVi: string;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  sunDirection: { x: number; y: number; z: number };
  moonDirection: { x: number; y: number; z: number };
  shadowCasterPosition: { x: number; y: number; z: number };
  directionalLightHex: string;
  directionalLightIntensity: number;
  hemiSkyHex: string;
  hemiGroundHex: string;
  hemiIntensity: number;
  skyBackgroundHex: string;
  fogHex: string;
  starlightIntensity: number;
  isNightOrStarlight: boolean;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const num = parseInt(clean.length === 6 ? clean : 'ffffff', 16);
  return [((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255];
}

function rgb01ToHex(r: number, g: number, b: number): string {
  const ri = Math.round(clamp01(r) * 255);
  const gi = Math.round(clamp01(g) * 255);
  const bi = Math.round(clamp01(b) * 255);
  return (
    '#' +
    ri.toString(16).padStart(2, '0') +
    gi.toString(16).padStart(2, '0') +
    bi.toString(16).padStart(2, '0')
  );
}

function lerpHexColor(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb01(hexA);
  const b = hexToRgb01(hexB);
  const k = clamp01(t);
  return rgb01ToHex(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
}

/**
 * Converts a 24-hour clock value (0..24) into solar elevation angle in degrees (-65° to +76°).
 */
export function timeOfDayToSunElevation(timeHours: number): number {
  const norm = ((timeHours % 24) + 24) % 24;
  const rad = (norm / 24) * Math.PI * 2;
  const rawElev = -Math.cos(rad) * 70 + 6;
  return Math.max(-65, Math.min(82, Math.round(rawElev * 10) / 10));
}

/**
 * Formats a 24-hour float (e.g. 17.75) into "17:45".
 */
export function formatTimeOfDayClock(timeHours: number): string {
  const norm = ((timeHours % 24) + 24) % 24;
  let hh = Math.floor(norm);
  let mm = Math.round((norm - hh) * 60);
  if (mm >= 60) {
    hh = (hh + 1) % 24;
    mm = 0;
  }
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}

/**
 * Pure calculation of the 3D solar/lunar vectors, real-time shadow-caster position,
 * directional/hemisphere colors, atmospheric fog, and nocturnal starlight intensity.
 */
export function computeDayNightLightingState(params: {
  timeOfDayHours: number;
  sunElevationDeg?: number;
  sunAzimuthDeg: number;
  starlightMode: boolean;
  biomeId: BiomeId;
}): DayNightLightingState {
  const biome = BIOMES[params.biomeId] || BIOMES.mondstadt_meadow;
  const normalizedTimeHours = ((params.timeOfDayHours % 24) + 24) % 24;
  const formattedClock = formatTimeOfDayClock(normalizedTimeHours);

  const sunElevationDeg =
    typeof params.sunElevationDeg === 'number'
      ? Math.max(-65, Math.min(85, params.sunElevationDeg))
      : timeOfDayToSunElevation(normalizedTimeHours);

  const sunAzimuthDeg = ((params.sunAzimuthDeg % 360) + 360) % 360;

  const elevRad = (sunElevationDeg * Math.PI) / 180;
  const azimRad = (sunAzimuthDeg * Math.PI) / 180;

  // Spherical to Cartesian unit vector for the Sun
  const cosElev = Math.cos(elevRad);
  const sunDirX = Number((cosElev * Math.cos(azimRad)).toFixed(4));
  const sunDirY = Number(Math.sin(elevRad).toFixed(4));
  const sunDirZ = Number((cosElev * Math.sin(azimRad)).toFixed(4));

  // Moon orbits opposite the Sun with a minimum high arc when Sun is below horizon
  const moonElevRad = Math.max(0.28, -elevRad);
  const moonAzimRad = azimRad + Math.PI;
  const moonDirX = Number((Math.cos(moonElevRad) * Math.cos(moonAzimRad)).toFixed(4));
  const moonDirY = Number(Math.sin(moonElevRad).toFixed(4));
  const moonDirZ = Number((Math.cos(moonElevRad) * Math.sin(moonAzimRad)).toFixed(4));

  // Classify day phase
  let phase: DayPhaseId = 'day';
  let phaseLabelVi = 'Ban Ngày';
  if (sunElevationDeg <= -4 || params.starlightMode) {
    phase = 'night';
    phaseLabelVi = params.starlightMode ? 'Ánh Sao Ban Đêm' : 'Đêm Đầy Sao';
  } else if (sunElevationDeg <= 16) {
    if (normalizedTimeHours < 12) {
      phase = 'dawn';
      phaseLabelVi = 'Bình Minh';
    } else {
      phase = 'dusk';
      phaseLabelVi = 'Hoàng Hôn';
    }
  }

  // Starlight visibility factor (0..1):
  // - If starlightMode is explicitly enabled, stars shine at full brilliance (1.0)
  // - Otherwise, stars fade in smoothly as sunElevation drops below +10° to -12°
  const naturalStarFactor = clamp01((10 - sunElevationDeg) / 22);
  const starlightIntensity = params.starlightMode
    ? 1.0
    : Number(naturalStarFactor.toFixed(3));
  const isNightOrStarlight = starlightIntensity > 0.15;

  // Daylight blend factor (0 = deep night, 0.5 = golden hour horizon, 1 = bright day)
  const dayFactor = params.starlightMode
    ? clamp01((sunElevationDeg + 25) / 110) * 0.32
    : clamp01((sunElevationDeg + 8) / 36);
  const goldenHourFactor =
    !params.starlightMode && sunElevationDeg > -6 && sunElevationDeg < 22
      ? 1 - Math.abs(sunElevationDeg - 7) / 15
      : 0;

  const nightSkyHex = '#050814';
  const nightFogHex = '#080e20';
  const nightHemiSkyHex = '#1e293b';
  const nightHemiGroundHex = '#090d16';
  const goldenSunHex = normalizedTimeHours < 12 ? '#fb923c' : '#f97316';
  const goldenHorizonHex = normalizedTimeHours < 12 ? '#fdba74' : '#fb7185';
  const moonlightHex = '#93c5fd';

  let skyBackgroundHex = lerpHexColor(nightSkyHex, biome.skyHorizonHex, dayFactor);
  let fogHex = lerpHexColor(nightFogHex, biome.fogHex, dayFactor);
  let directionalLightHex = lerpHexColor(moonlightHex, biome.sunHex, dayFactor);
  let hemiSkyHex = lerpHexColor(nightHemiSkyHex, biome.hemiSkyHex, dayFactor);
  let hemiGroundHex = lerpHexColor(nightHemiGroundHex, biome.hemiGroundHex, dayFactor);

  if (goldenHourFactor > 0.05) {
    const g = clamp01(goldenHourFactor * 0.72);
    skyBackgroundHex = lerpHexColor(skyBackgroundHex, goldenHorizonHex, g * 0.65);
    fogHex = lerpHexColor(fogHex, goldenHorizonHex, g * 0.55);
    directionalLightHex = lerpHexColor(directionalLightHex, goldenSunHex, g);
  }

  // Shadow caster position at radius 560m:
  // When sun is above horizon (>= 3°), shadows are cast from the sun's exact elevation & azimuth.
  // When sun is below horizon (< 3°), the active shadow caster smoothly transitions to the Moon's arc
  // so buildings, mountains, and trees cast atmospheric moonlight shadows at night.
  const shadowRadius = 560;
  const useSunForShadows = sunElevationDeg >= 3;
  const activeElevRad = useSunForShadows
    ? Math.max((6 * Math.PI) / 180, elevRad)
    : Math.max((18 * Math.PI) / 180, moonElevRad);
  const activeAzimRad = useSunForShadows ? azimRad : moonAzimRad;

  const shadowCasterPosition = {
    x: Number((Math.cos(activeElevRad) * Math.cos(activeAzimRad) * shadowRadius).toFixed(2)),
    y: Number((Math.sin(activeElevRad) * shadowRadius).toFixed(2)),
    z: Number((Math.cos(activeElevRad) * Math.sin(activeAzimRad) * shadowRadius).toFixed(2)),
  };

  const directionalLightIntensity = useSunForShadows
    ? Number((0.65 + dayFactor * 0.8).toFixed(2))
    : Number((0.46 + starlightIntensity * 0.16).toFixed(2));

  const hemiIntensity = Number((0.28 + dayFactor * 0.44).toFixed(2));

  return {
    normalizedTimeHours,
    formattedClock,
    phase,
    phaseLabelVi,
    sunElevationDeg,
    sunAzimuthDeg,
    sunDirection: { x: sunDirX, y: sunDirY, z: sunDirZ },
    moonDirection: { x: moonDirX, y: moonDirY, z: moonDirZ },
    shadowCasterPosition,
    directionalLightHex,
    directionalLightIntensity,
    hemiSkyHex,
    hemiGroundHex,
    hemiIntensity,
    skyBackgroundHex,
    fogHex,
    starlightIntensity,
    isNightOrStarlight,
  };
}

export interface WorldSaveFileV2 {
  version: 2;
  regionTitle: string;
  biomeId: BiomeId;
  activeWeather: WeatherId;
  waterLevel: number;
  sunElevation: number;
  sunAzimuth: number;
  timeOfDay: number;
  starlightMode: boolean;
  grassHeightCm: number;
  flowerSpecies: FlowerSpeciesId;
  flowerColorHex: string;
  gridSize: number;
  worldSizeMeters: number;
  texturePalette: TextureBrushId[];
  heightMap: number[];
  splatMap: number[];
  placedObjects: PlacedObject[];
  microStrokes: MicroStrokeStamp[];
  exportedAt: string;
}

/**
 * Serializes the entire 3D world state (including heightMap, splatMap with named texturePalette,
 * placedObjects, microStrokes, and Day/Night settings) into a versioned JSON payload.
 */
export function serializeWorldToSavePayload(params: {
  regionTitle: string;
  biomeId: BiomeId;
  activeWeather: WeatherId;
  waterLevel: number;
  sunElevation: number;
  sunAzimuth: number;
  timeOfDay: number;
  starlightMode: boolean;
  grassHeightCm: number;
  flowerSpecies: FlowerSpeciesId;
  flowerColorHex: string;
  heightMap: Float32Array;
  splatMap: Uint8Array;
  placedObjects: PlacedObject[];
  microStrokes: MicroStrokeStamp[];
}): WorldSaveFileV2 {
  const roundedHeights = new Array<number>(params.heightMap.length);
  for (let i = 0; i < params.heightMap.length; i++) {
    roundedHeights[i] = Math.round(params.heightMap[i] * 100) / 100;
  }
  return {
    version: 2,
    regionTitle: params.regionTitle,
    biomeId: params.biomeId,
    activeWeather: params.activeWeather,
    waterLevel: params.waterLevel,
    sunElevation: params.sunElevation,
    sunAzimuth: params.sunAzimuth,
    timeOfDay: params.timeOfDay,
    starlightMode: params.starlightMode,
    grassHeightCm: params.grassHeightCm,
    flowerSpecies: params.flowerSpecies,
    flowerColorHex: params.flowerColorHex,
    gridSize: GRID_SIZE,
    worldSizeMeters: WORLD_SIZE,
    texturePalette: [...TEXTURE_INDEX_MAP],
    heightMap: roundedHeights,
    splatMap: Array.from(params.splatMap),
    placedObjects: params.placedObjects,
    microStrokes: params.microStrokes,
    exportedAt: new Date().toISOString(),
  };
}

export interface DeserializedWorldPayload {
  regionTitle: string;
  biomeId: BiomeId;
  activeWeather: WeatherId;
  waterLevel: number;
  sunElevation: number;
  sunAzimuth: number;
  timeOfDay: number;
  starlightMode: boolean;
  grassHeightCm: number;
  flowerSpecies: FlowerSpeciesId;
  flowerColorHex: string;
  heightMap: Float32Array;
  splatMap: Uint8Array;
  colorMap: Float32Array;
  placedObjects: PlacedObject[];
  microStrokes: MicroStrokeStamp[];
}

export type WorldSaveValidationResult =
  | { ok: true; data: DeserializedWorldPayload }
  | { ok: false; reason: string };

/**
 * Validates and deserializes a saved JSON payload (supporting named texturePalette remapping).
 * Uses Object.hasOwn to prevent prototype-pollution keys ('constructor', 'toString', '__proto__')
 * from bypassing dictionary lookups, and returns a specific rejection reason when invalid.
 */
export function validateWorldSavePayload(raw: unknown): WorldSaveValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      reason: 'Tệp JSON không phải là đối tượng dữ liệu bản đồ hợp lệ.',
    };
  }
  const data = raw as Omit<Partial<WorldSaveFileV2>, 'version'> & { version?: unknown };

  if (data.version !== undefined && data.version !== 1 && data.version !== 2) {
    return {
      ok: false,
      reason: `Phiên bản tệp bản đồ không được hỗ trợ (version: ${String(data.version)}, yêu cầu v1 hoặc v2).`,
    };
  }
  if (data.gridSize !== undefined && data.gridSize !== GRID_SIZE) {
    return {
      ok: false,
      reason: `Kích thước lưới không tương thích (gridSize: ${String(data.gridSize)}, yêu cầu ${GRID_SIZE}).`,
    };
  }
  if (!Array.isArray(data.heightMap)) {
    return {
      ok: false,
      reason: 'Tệp bản đồ thiếu mảng độ cao (heightMap).',
    };
  }
  if (data.heightMap.length !== TOTAL_VERTICES) {
    return {
      ok: false,
      reason: `Độ dài heightMap không khớp (${data.heightMap.length} điểm, yêu cầu ${TOTAL_VERTICES} đỉnh cho lưới ${GRID_SIZE + 1}×${GRID_SIZE + 1}).`,
    };
  }
  if (data.splatMap !== undefined) {
    if (!Array.isArray(data.splatMap) || data.splatMap.length !== TOTAL_VERTICES) {
      return {
        ok: false,
        reason: `Độ dài splatMap không khớp (${Array.isArray(data.splatMap) ? data.splatMap.length : 'không phải mảng'}, yêu cầu ${TOTAL_VERTICES}).`,
      };
    }
  }

  const biomeId: BiomeId =
    typeof data.biomeId === 'string' && Object.hasOwn(BIOMES, data.biomeId)
      ? (data.biomeId as BiomeId)
      : 'mondstadt_meadow';
  const bCfg = BIOMES[biomeId];

  const heightMap = new Float32Array(TOTAL_VERTICES);
  const splatMap = new Uint8Array(TOTAL_VERTICES);
  const colorMap = new Float32Array(TOTAL_VERTICES * 3);

  for (let i = 0; i < TOTAL_VERTICES; i++) {
    const v = Number(data.heightMap[i]);
    heightMap[i] = Number.isFinite(v)
      ? Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, v))
      : 0;
  }

  const palette = Array.isArray(data.texturePalette) ? data.texturePalette : TEXTURE_INDEX_MAP;
  const defaultTexIdx = getTextureIndex(bCfg.defaultTexture);
  if (Array.isArray(data.splatMap) && data.splatMap.length === TOTAL_VERTICES) {
    for (let i = 0; i < TOTAL_VERTICES; i++) {
      const rawIdx = Number(data.splatMap[i]);
      const safeIdx = Number.isInteger(rawIdx) && rawIdx >= 0 ? rawIdx : -1;
      const brushName =
        safeIdx >= 0 && safeIdx < palette.length
          ? (palette[safeIdx] as TextureBrushId | undefined)
          : undefined;
      splatMap[i] =
        typeof brushName === 'string' && Object.hasOwn(TEXTURE_BRUSHES, brushName)
          ? getTextureIndex(brushName)
          : defaultTexIdx;
    }
  } else {
    splatMap.fill(defaultTexIdx);
  }

  recomputeTerrainColors(heightMap, splatMap, colorMap, biomeId);

  const halfWorld = WORLD_SIZE / 2;
  const validPrefabIds = new Set<PrefabId>(PREFAB_CATALOG.map((p) => p.id));
  const validFlowerSpecies = new Set<FlowerSpeciesId>(FLOWER_SPECIES_CATALOG.map((s) => s.id));
  const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

  const sanitizedObjects: PlacedObject[] = [];
  if (Array.isArray(data.placedObjects)) {
    const rawList = data.placedObjects.slice(0, 500);
    for (let i = 0; i < rawList.length; i++) {
      const item = rawList[i] as Partial<PlacedObject> | null | undefined;
      if (!item || typeof item !== 'object') continue;
      if (typeof item.prefabId !== 'string' || !validPrefabIds.has(item.prefabId as PrefabId)) {
        continue;
      }
      const rx = Number(item.x);
      const rz = Number(item.z);
      if (!Number.isFinite(rx) || !Number.isFinite(rz)) continue;

      const x = Math.max(-halfWorld, Math.min(halfWorld, rx));
      const z = Math.max(-halfWorld, Math.min(halfWorld, rz));
      const ry = Number(item.y);
      const y = Number.isFinite(ry)
        ? Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, ry))
        : Number(getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, x, z).toFixed(2));
      const rScale = Number(item.scale);
      const scale = Number.isFinite(rScale)
        ? Math.max(0.3, Math.min(3.0, rScale))
        : 1.0;
      const rRot = Number(item.rotationY);
      const rotationY = Number.isFinite(rRot) ? rRot : 0;

      sanitizedObjects.push({
        id:
          typeof item.id === 'string' && item.id.trim()
            ? item.id.trim().slice(0, 80)
            : `restored-obj-${i}-${item.prefabId}`,
        prefabId: item.prefabId as PrefabId,
        label:
          typeof item.label === 'string' && item.label.trim()
            ? item.label.trim().slice(0, 120)
            : item.prefabId,
        x,
        y,
        z,
        scale,
        rotationY,
      });
    }
  }

  const sanitizedStrokes: MicroStrokeStamp[] = [];
  if (Array.isArray(data.microStrokes)) {
    const rawStrokes = data.microStrokes.slice(0, 300);
    for (let i = 0; i < rawStrokes.length; i++) {
      const st = rawStrokes[i] as Partial<MicroStrokeStamp> | null | undefined;
      if (!st || typeof st !== 'object') continue;
      if (typeof st.brushId !== 'string' || !Object.hasOwn(TEXTURE_BRUSHES, st.brushId)) {
        continue;
      }
      const rx = Number(st.x);
      const rz = Number(st.z);
      if (!Number.isFinite(rx) || !Number.isFinite(rz)) continue;

      const x = Math.max(-halfWorld, Math.min(halfWorld, rx));
      const z = Math.max(-halfWorld, Math.min(halfWorld, rz));
      const rRad = Number(st.radius);
      const radius = Number.isFinite(rRad)
        ? Math.max(MIN_BRUSH_RADIUS, Math.min(2500, rRad))
        : 8;
      const rGrass = Number(st.grassHeightCm);
      const grassHeightCm = Number.isFinite(rGrass)
        ? Math.max(MIN_GRASS_HEIGHT_CM, Math.min(MAX_GRASS_HEIGHT_CM, rGrass))
        : undefined;
      const flowerSpecies =
        typeof st.flowerSpecies === 'string' &&
        validFlowerSpecies.has(st.flowerSpecies as FlowerSpeciesId)
          ? (st.flowerSpecies as FlowerSpeciesId)
          : undefined;
      const flowerColorHex =
        typeof st.flowerColorHex === 'string' && hexColorRegex.test(st.flowerColorHex)
          ? st.flowerColorHex
          : undefined;

      sanitizedStrokes.push({
        id:
          typeof st.id === 'string' && st.id.trim()
            ? st.id.trim().slice(0, 80)
            : `restored-stroke-${i}`,
        x,
        z,
        radius,
        brushId: st.brushId as TextureBrushId,
        grassHeightCm,
        flowerSpecies,
        flowerColorHex,
      });
    }
  } else {
    sanitizedStrokes.push(...generateInitialSurfaceShowcaseStrokes());
  }

  const rawWater = Number(data.waterLevel);
  const waterLevel = Number.isFinite(rawWater)
    ? Math.max(-150, Math.min(150, rawWater))
    : bCfg.waterLevel;

  const rawSunElev = Number(data.sunElevation);
  const sunElevation = Number.isFinite(rawSunElev)
    ? Math.max(-65, Math.min(85, rawSunElev))
    : 48;

  const rawSunAzim = Number(data.sunAzimuth);
  const sunAzimuth = Number.isFinite(rawSunAzim)
    ? ((rawSunAzim % 360) + 360) % 360
    : 135;

  const rawTime = Number(data.timeOfDay);
  const timeOfDay = Number.isFinite(rawTime)
    ? ((rawTime % 24) + 24) % 24
    : 10.5;

  const rawGrass = Number(data.grassHeightCm);
  const grassHeightCm = Number.isFinite(rawGrass)
    ? Math.max(MIN_GRASS_HEIGHT_CM, Math.min(MAX_GRASS_HEIGHT_CM, rawGrass))
    : DEFAULT_GRASS_HEIGHT_CM;

  const flowerSpecies: FlowerSpeciesId =
    typeof data.flowerSpecies === 'string' &&
    validFlowerSpecies.has(data.flowerSpecies as FlowerSpeciesId)
      ? (data.flowerSpecies as FlowerSpeciesId)
      : 'sakura_bloom';

  const flowerColorHex =
    typeof data.flowerColorHex === 'string' && hexColorRegex.test(data.flowerColorHex)
      ? data.flowerColorHex
      : '#f472b6';

  return {
    ok: true,
    data: {
      regionTitle:
        typeof data.regionTitle === 'string' && data.regionTitle.trim()
          ? data.regionTitle.trim().slice(0, 120)
          : bCfg.name,
      biomeId,
      activeWeather:
        typeof data.activeWeather === 'string' &&
        WEATHER_CATALOG.some((w) => w.id === data.activeWeather)
          ? (data.activeWeather as WeatherId)
          : bCfg.defaultWeather ?? 'clear_sky',
      waterLevel,
      sunElevation,
      sunAzimuth,
      timeOfDay,
      starlightMode: Boolean(data.starlightMode),
      grassHeightCm,
      flowerSpecies,
      flowerColorHex,
      heightMap,
      splatMap,
      colorMap,
      placedObjects: sanitizedObjects,
      microStrokes: sanitizedStrokes,
    },
  };
}

/**
 * Deserializes a saved JSON payload, returning null if malformed or incompatible.
 */
export function deserializeWorldFromSavePayload(raw: unknown): DeserializedWorldPayload | null {
  const res = validateWorldSavePayload(raw);
  return res.ok ? res.data : null;
}

