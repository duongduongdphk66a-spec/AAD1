export type BiomeId =
  | 'mondstadt_meadow'
  | 'inazuma_sakura'
  | 'liyue_amber'
  | 'paldea_coast'
  | 'snowpeak_glacier'
  | 'celestia_sky_isles'
  | 'natlan_volcano_abyss'
  | 'himalaya_alps_andes'
  | 'sahara_atacama_gobi'
  | 'hawaii_shield_volcano'
  | 'amazon_congo_rainforest'
  | 'boreal_taiga_forest'
  | 'mars_olympus'
  | 'venus_ishtar'
  | 'kepler_crystalline'
  | 'trappist_tidally_locked'
  | 'pluto_cryovolcano'
  | 'titan_methane_sea'
  | 'europa_chaos_ridge'
  | 'corot_lava_ocean';

export type WeatherId =
  | 'clear_sky'
  | 'himalaya_blizzard'
  | 'tropical_monsoon_rain'
  | 'mars_dust_storm'
  | 'supersonic_mars_storm'
  | 'venus_acid_rain'
  | 'concentrated_venus_acid'
  | 'liquid_nitrogen_snow'
  | 'cryo_geyser_blizzard'
  | 'molten_silicate_rain'
  | 'exoplanet_meteor_shower'
  | 'ion_aurora_tempest'
  | 'ash_ember_fall';

export interface WeatherConfig {
  id: WeatherId;
  name: string;
  shortName: string;
  planetOrigin: string;
  subtitle: string;
  badgeColor: string;
  fogOverrideHex?: string;
  particleColorHex: string;
  secondaryColorHex: string;
}

export type SculptToolId =
  | 'raise'
  | 'lower'
  | 'sheer_cliff'
  | 'volcano_crater'
  | 'alpine_horn_glacier'
  | 'barchan_dune_saltflat'
  | 'meander_river_delta'
  | 'cryo_volcano'
  | 'methane_basin'
  | 'abyss_chasm'
  | 'canyon_gorge'
  | 'meteor_crater'
  | 'shield_mesa'
  | 'flatten'
  | 'smooth'
  | 'terrace'
  | 'ridge';

export type TextureBrushId =
  | 'earth_soil'
  | 'emerald_grass'
  | 'flower_meadow'
  | 'desert_sand'
  | 'atacama_salt_crust'
  | 'tropical_rainforest_floor'
  | 'taiga_moss_needles'
  | 'volcanic_lava'
  | 'river_stream'
  | 'lake_water'
  | 'dirt_cobble_road'
  | 'limestone_cliff'
  | 'glacier_snow'
  | 'mars_regolith'
  | 'venus_sulfur'
  | 'exoplanet_basalt'
  | 'pluto_nitrogen_ice'
  | 'titan_methane_liquid';

export type PrefabCategory = 'house' | 'mountain' | 'tree' | 'landmark';

export type PrefabId =
  | 'himalaya_matterhorn_peak'
  | 'sahara_atacama_oasis'
  | 'hawaii_kilauea_shield'
  | 'amazon_congo_canopy_tree'
  | 'taiga_spruce_grove'
  | 'pluto_cryo_volcano'
  | 'titan_methane_geyser'
  | 'europa_penitentes_spire'
  | 'floating_sky_island'
  | 'sheer_cliff_wall'
  | 'active_volcano'
  | 'abyss_chasm_vortex'
  | 'statue_of_seven'
  | 'pokemon_gym_stadium'
  | 'berry_apricorn_tree'
  | 'mars_olympus_shield'
  | 'venus_pancake_dome'
  | 'meteor_impact_crater'
  | 'exoplanet_crystal_spire'
  | 'windmill_cottage'
  | 'sakura_shrine'
  | 'pokemon_center'
  | 'karst_mountain'
  | 'volcanic_peak'
  | 'sakura_tree'
  | 'emerald_pine'
  | 'aether_crystal'
  | 'ancient_bridge';

export interface PlacedObject {
  id: string;
  prefabId: PrefabId;
  label: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationY: number;
}

export interface BiomeConfig {
  id: BiomeId;
  name: string;
  subtitle: string;
  inspiration: string;
  skyTopHex: string;
  skyHorizonHex: string;
  fogHex: string;
  sunHex: string;
  hemiSkyHex: string;
  hemiGroundHex: string;
  waterHex: string;
  waterDeepHex: string;
  defaultTexture: TextureBrushId;
  defaultWeather?: WeatherId;
  waterLevel: number;
  reliefScale: number;
}

export interface TextureBrushConfig {
  id: TextureBrushId;
  name: string;
  subtitle: string;
  primaryRgb: [number, number, number]; // 0..1 sRGB values
  secondaryRgb: [number, number, number];
  swatchHex: string;
  roughness: number;
  hydroOrTerrainEffect?: 'river' | 'lake' | 'road' | 'lava' | 'none';
}

export interface PrefabMetadata {
  id: PrefabId;
  name: string;
  category: PrefabCategory;
  inspiration: string;
  partsCount: number;
  defaultScale: number;
  realDimensions: string;
  realHeightMeters: number;
  badgeColor: string;
}

// 10x10 km Open-World Continent Scale (10,000m x 10,000m = 100 km², 1,000m = 1 km max height)
// 10,000,000,000 px (100,000 x 100,000 px, 0.1m = 10cm/px) Ultra-High Virtual Splat & Surface Detail Resolution (100x upgrade)
export const VIRTUAL_SIDE_PX = 100000; // 100,000 px per side (0.1m / 10cm per pixel)
export const VIRTUAL_RESOLUTION_PX = 10000000000; // 10,000,000,000 px (10 Gigapixels = 100x of 100M px)
export const PIXEL_SIZE_CM = 10; // 10cm per virtual pixel
export const MIN_BRUSH_RADIUS = 1; // 1m minimum brush radius
export const MAX_BRUSH_RADIUS = 2500; // 2,500m maximum brush radius

export interface BrushScalePage {
  id: string;
  pageNumber: number;
  label: string;
  shortLabel: string;
  subtitle: string;
  minRadius: number;
  maxRadius: number;
  step: number;
  defaultRadius: number;
  presets: number[];
}

export const BRUSH_SCALE_PAGES: BrushScalePage[] = [
  {
    id: 'scale_5m',
    pageNumber: 1,
    label: 'Thang 5m (1m – 5m)',
    shortLabel: 'Thang 5m',
    subtitle: 'Vi mô · Lối mòn, suối nhỏ, vườn hoa',
    minRadius: 1,
    maxRadius: 5,
    step: 1,
    defaultRadius: 3,
    presets: [1, 2, 3, 4, 5],
  },
  {
    id: 'scale_25m',
    pageNumber: 2,
    label: 'Thang 25m (5m – 25m)',
    shortLabel: 'Thang 25m',
    subtitle: 'Khu làng 1:1 · Ao hồ, sân đền, bãi cỏ',
    minRadius: 5,
    maxRadius: 25,
    step: 1,
    defaultRadius: 15,
    presets: [5, 10, 15, 20, 25],
  },
  {
    id: 'scale_100m',
    pageNumber: 3,
    label: 'Thang 100m (25m – 100m)',
    shortLabel: 'Thang 100m',
    subtitle: 'Thung lũng · Dòng sông lớn, ngọn đồi',
    minRadius: 25,
    maxRadius: 100,
    step: 5,
    defaultRadius: 50,
    presets: [25, 40, 60, 80, 100],
  },
  {
    id: 'scale_500m',
    pageNumber: 4,
    label: 'Thang 500m (100m – 500m)',
    shortLabel: 'Thang 500m',
    subtitle: 'Quần sơn · Hồ lớn, sa mạc, dung nham',
    minRadius: 100,
    maxRadius: 500,
    step: 25,
    defaultRadius: 250,
    presets: [100, 200, 300, 400, 500],
  },
  {
    id: 'scale_2500m',
    pageNumber: 5,
    label: 'Thang 2.5km (500m – 2.5km)',
    shortLabel: 'Thang 2.5km',
    subtitle: 'Đại lục địa · Kiến tạo dãy núi 1km',
    minRadius: 500,
    maxRadius: 2500,
    step: 100,
    defaultRadius: 1000,
    presets: [500, 1000, 1500, 2000, 2500],
  },
];

export function getBrushPageIndexForRadius(radius: number): number {
  if (radius <= 5) return 0;
  if (radius <= 25) return 1;
  if (radius <= 100) return 2;
  if (radius <= 500) return 3;
  return 4;
}

// Real 1:1 Grass Blade Height Specification: 3.0 cm to 5.0 cm
export const MIN_GRASS_HEIGHT_CM = 3.0;
export const MAX_GRASS_HEIGHT_CM = 5.0;
export const DEFAULT_GRASS_HEIGHT_CM = 4.0;

export type FlowerSpeciesId =
  | 'cecilia_star'
  | 'sakura_bloom'
  | 'sun_daisy'
  | 'lotus_waterlily'
  | 'tulip_cup';

export interface FlowerSpeciesConfig {
  id: FlowerSpeciesId;
  name: string;
  shortName: string;
  petalCount: number;
  petalShape: 'pointed' | 'rounded' | 'ray' | 'double_cup' | 'bell';
  defaultColorHex: string;
  coreColorHex: string;
}

export const FLOWER_SPECIES_CATALOG: FlowerSpeciesConfig[] = [
  {
    id: 'cecilia_star',
    name: 'Hoa Cecilia Sao (5 Cánh Nhọn)',
    shortName: 'Cecilia Sao',
    petalCount: 5,
    petalShape: 'pointed',
    defaultColorHex: '#ffffff',
    coreColorHex: '#facc15',
  },
  {
    id: 'sakura_bloom',
    name: 'Hoa Anh Đào Inazuma (5 Cánh Tròn)',
    shortName: 'Anh Đào',
    petalCount: 5,
    petalShape: 'rounded',
    defaultColorHex: '#f472b6',
    coreColorHex: '#fef08a',
  },
  {
    id: 'sun_daisy',
    name: 'Hoa Cúc Mặt Trời (8 Cánh Tỏa)',
    shortName: 'Cúc Mặt Trời',
    petalCount: 8,
    petalShape: 'ray',
    defaultColorHex: '#facc15',
    coreColorHex: '#d97706',
  },
  {
    id: 'lotus_waterlily',
    name: 'Hoa Sen Lưu Ly (Đài Kép 10 Cánh)',
    shortName: 'Sen Lưu Ly',
    petalCount: 10,
    petalShape: 'double_cup',
    defaultColorHex: '#38bdf8',
    coreColorHex: '#fde047',
  },
  {
    id: 'tulip_cup',
    name: 'Hoa Chuông Tulip (Đài Chuông 3D)',
    shortName: 'Chuông Tulip',
    petalCount: 6,
    petalShape: 'bell',
    defaultColorHex: '#c084fc',
    coreColorHex: '#fef9c3',
  },
];

export interface FlowerColorOption {
  id: string;
  name: string;
  hex: string;
}

export const FLOWER_COLOR_PALETTE: FlowerColorOption[] = [
  { id: 'pink_sakura', name: 'Hồng Anh Đào', hex: '#f472b6' },
  { id: 'gold_sun', name: 'Vàng Ánh Dương', hex: '#facc15' },
  { id: 'purple_electro', name: 'Tím Lôi Thần', hex: '#c084fc' },
  { id: 'blue_glaze', name: 'Xanh Lưu Ly', hex: '#38bdf8' },
  { id: 'red_crimson', name: 'Đỏ Hồng Ngọc', hex: '#fb7185' },
  { id: 'white_cecilia', name: 'Trắng Tinh Khiết', hex: '#ffffff' },
];

export interface MicroStrokeStamp {
  id: string;
  x: number;
  z: number;
  radius: number;
  brushId: TextureBrushId;
  grassHeightCm?: number; // 3.0 to 5.0 cm real grass blade height
  flowerSpecies?: FlowerSpeciesId;
  flowerColorHex?: string;
}

export function generateInitialSurfaceShowcaseStrokes(): MicroStrokeStamp[] {
  return [
    {
      id: 'init-grass-windmill',
      x: -15,
      z: -10,
      radius: 11,
      brushId: 'emerald_grass',
      grassHeightCm: 4.2,
    },
    {
      id: 'init-grass-shrine',
      x: 0,
      z: -22,
      radius: 10,
      brushId: 'emerald_grass',
      grassHeightCm: 4.5,
    },
    {
      id: 'init-flower-sakura',
      x: -7,
      z: -3,
      radius: 7,
      brushId: 'flower_meadow',
      grassHeightCm: 4.0,
      flowerSpecies: 'sakura_bloom',
      flowerColorHex: '#f472b6',
    },
    {
      id: 'init-flower-daisy',
      x: 8,
      z: -4,
      radius: 7,
      brushId: 'flower_meadow',
      grassHeightCm: 3.8,
      flowerSpecies: 'sun_daisy',
      flowerColorHex: '#facc15',
    },
    {
      id: 'init-desert-sand',
      x: 20,
      z: 6,
      radius: 8,
      brushId: 'desert_sand',
    },
    {
      id: 'init-volcanic-lava',
      x: -22,
      z: 5,
      radius: 7.5,
      brushId: 'volcanic_lava',
    },
    {
      id: 'init-river-stream',
      x: 0,
      z: 16,
      radius: 8.5,
      brushId: 'river_stream',
    },
    {
      id: 'init-cobble-road',
      x: 0,
      z: 6,
      radius: 5.5,
      brushId: 'dirt_cobble_road',
      grassHeightCm: 3.5,
    },
  ];
}

export const GRID_SIZE = 160; // 160x160 mesh cells -> 161x161 vertices (25,921 vertices)
export const VERTEX_COUNT_PER_SIDE = GRID_SIZE + 1;
export const TOTAL_VERTICES = VERTEX_COUNT_PER_SIDE * VERTEX_COUNT_PER_SIDE;
export const WORLD_SIZE = 10000; // 10,000m = 10 km (-5000m to +5000m on X and Z)
export const WORLD_SIZE_KM = 10; // 10 km x 10 km
export const MAX_ELEVATION = 1000; // 1,000m = 1.0 km maximum elevation
export const MIN_ELEVATION = -250; // -250m ocean/lake trench depth

export const BIOMES: Record<BiomeId, BiomeConfig> = {
  mondstadt_meadow: {
    id: 'mondstadt_meadow',
    name: 'Thảo Nguyên Phong Thần',
    subtitle: 'Mặt phẳng đất & cỏ ngọc lục bảo, sông hồ trong xanh',
    inspiration: 'Mondstadt (Genshin) & Paldea South',
    skyTopHex: '#38bdf8',
    skyHorizonHex: '#7dd3fc',
    fogHex: '#bae6fd',
    sunHex: '#fffbeb',
    hemiSkyHex: '#7dd3fc',
    hemiGroundHex: '#4d3824',
    waterHex: '#0ea5e9',
    waterDeepHex: '#0284c7',
    defaultTexture: 'emerald_grass',
    waterLevel: -25,
    reliefScale: 1.0,
  },
  inazuma_sakura: {
    id: 'inazuma_sakura',
    name: 'Đảo Anh Đào Vĩnh Hằng',
    subtitle: 'Thung lũng mặt hoa sakura hồng tím và đền cổ',
    inspiration: 'Inazuma Narukami & Kitakami',
    skyTopHex: '#6366f1',
    skyHorizonHex: '#e9d5ff',
    fogHex: '#f3e8ff',
    sunHex: '#fef3c7',
    hemiSkyHex: '#e879f9',
    hemiGroundHex: '#4c1d95',
    waterHex: '#38bdf8',
    waterDeepHex: '#4338ca',
    defaultTexture: 'flower_meadow',
    waterLevel: -20,
    reliefScale: 1.1,
  },
  liyue_amber: {
    id: 'liyue_amber',
    name: 'Tuyệt Vân Đá Hổ Phách',
    subtitle: 'Núi đá vôi dựng đứng 1km, đất đá cổ đại & dung nham',
    inspiration: 'Liyue Jueyun Karst & Natlan',
    skyTopHex: '#f59e0b',
    skyHorizonHex: '#fde68a',
    fogHex: '#fef3c7',
    sunHex: '#fff7ed',
    hemiSkyHex: '#fcd34d',
    hemiGroundHex: '#78350f',
    waterHex: '#14b8a6',
    waterDeepHex: '#0f766e',
    defaultTexture: 'earth_soil',
    waterLevel: -30,
    reliefScale: 1.25,
  },
  paldea_coast: {
    id: 'paldea_coast',
    name: 'Sa Mạc & Vịnh Paldea',
    subtitle: 'Cát sa mạc vàng óng, ốc đảo và trung tâm lữ hành',
    inspiration: 'Sumeru Desert & Pokémon Paldea Coast',
    skyTopHex: '#0284c7',
    skyHorizonHex: '#7dd3fc',
    fogHex: '#bae6fd',
    sunHex: '#ffffff',
    hemiSkyHex: '#38bdf8',
    hemiGroundHex: '#a16207',
    waterHex: '#06b6d4',
    waterDeepHex: '#0369a1',
    defaultTexture: 'desert_sand',
    waterLevel: -15,
    reliefScale: 0.92,
  },
  snowpeak_glacier: {
    id: 'snowpeak_glacier',
    name: 'Đỉnh Tuyết Long Tích',
    subtitle: 'Đỉnh núi băng hà cao 1km, tinh thể phát sáng và rừng thông',
    inspiration: 'Dragonspine & Glaseado Mountain',
    skyTopHex: '#1e3a8a',
    skyHorizonHex: '#93c5fd',
    fogHex: '#dbeafe',
    sunHex: '#e0f2fe',
    hemiSkyHex: '#93c5fd',
    hemiGroundHex: '#334155',
    waterHex: '#3b82f6',
    waterDeepHex: '#1d4ed8',
    defaultTexture: 'glacier_snow',
    waterLevel: -35,
    reliefScale: 1.22,
  },
  celestia_sky_isles: {
    id: 'celestia_sky_isles',
    name: 'Đảo Bay Celestia & Vực Đá',
    subtitle: 'Quần đảo lơ lửng trên mây, vách đá dựng đứng & cột trời',
    inspiration: 'Celestia / Khánh Vân Đỉnh (Genshin) & Sky Pillar (Pokémon)',
    skyTopHex: '#0284c7',
    skyHorizonHex: '#bae6fd',
    fogHex: '#e0f2fe',
    sunHex: '#fef9c3',
    hemiSkyHex: '#7dd3fc',
    hemiGroundHex: '#334155',
    waterHex: '#38bdf8',
    waterDeepHex: '#0369a1',
    defaultTexture: 'limestone_cliff',
    waterLevel: -45,
    reliefScale: 1.35,
  },
  natlan_volcano_abyss: {
    id: 'natlan_volcano_abyss',
    name: 'Núi Lửa Natlan & Vực Sâu',
    subtitle: 'Miệng núi lửa phun trào dung nham & đại vực Area Zero',
    inspiration: 'Natlan / Vực Đá Sâu (Genshin) & Mt. Chimney / Area Zero (Pokémon)',
    skyTopHex: '#7c2d12',
    skyHorizonHex: '#fdba74',
    fogHex: '#fed7aa',
    sunHex: '#ffedd5',
    hemiSkyHex: '#fb923c',
    hemiGroundHex: '#450a0a',
    waterHex: '#ea580c',
    waterDeepHex: '#9a3412',
    defaultTexture: 'volcanic_lava',
    defaultWeather: 'ash_ember_fall',
    waterLevel: -60,
    reliefScale: 1.4,
  },
  mars_olympus: {
    id: 'mars_olympus',
    name: 'Sao Hỏa · Hẻm Núi Valles & Olympus',
    subtitle: 'Đất oxit sắt đỏ cam, hố va chạm thiên thạch, núi lửa khiên Olympus & bão bụi đỏ',
    inspiration: 'Sao Hỏa (Mars Valles Marineris, Olympus Mons & Jezero Crater)',
    skyTopHex: '#451a03',
    skyHorizonHex: '#d97706',
    fogHex: '#b45309',
    sunHex: '#fde68a',
    hemiSkyHex: '#fb923c',
    hemiGroundHex: '#431407',
    waterHex: '#9a3412',
    waterDeepHex: '#431407',
    defaultTexture: 'mars_regolith',
    defaultWeather: 'mars_dust_storm',
    waterLevel: -140,
    reliefScale: 1.28,
  },
  venus_ishtar: {
    id: 'venus_ishtar',
    name: 'Sao Kim · Cao Nguyên Lưu Huỳnh Ishtar',
    subtitle: 'Khí quyển CO₂ siêu đặc vàng cam, mưa axit H₂SO₄, vòm núi lửa Pancake & biển magma',
    inspiration: 'Sao Kim (Venus Ishtar Terra, Maat Mons & Pancake Domes)',
    skyTopHex: '#713f12',
    skyHorizonHex: '#eab308',
    fogHex: '#ca8a04',
    sunHex: '#fef08a',
    hemiSkyHex: '#facc15',
    hemiGroundHex: '#422006',
    waterHex: '#ea580c',
    waterDeepHex: '#9a3412',
    defaultTexture: 'venus_sulfur',
    defaultWeather: 'venus_acid_rain',
    waterLevel: -50,
    reliefScale: 1.18,
  },
  kepler_crystalline: {
    id: 'kepler_crystalline',
    name: 'Ngoại Hành Tinh Đá Kepler-452b',
    subtitle: 'Siêu Trái Đất ngoài Hệ Mặt Trời, đá bazan tím, rừng cột tinh thể silicat & mưa sao băng',
    inspiration: 'Ngoại hành tinh đất đá Kepler-452b & K2-18b',
    skyTopHex: '#1e1b4b',
    skyHorizonHex: '#7e22ce',
    fogHex: '#581c87',
    sunHex: '#38bdf8',
    hemiSkyHex: '#c084fc',
    hemiGroundHex: '#1e1b4b',
    waterHex: '#0284c7',
    waterDeepHex: '#1e3a8a',
    defaultTexture: 'exoplanet_basalt',
    defaultWeather: 'exoplanet_meteor_shower',
    waterLevel: -30,
    reliefScale: 1.32,
  },
  trappist_tidally_locked: {
    id: 'trappist_tidally_locked',
    name: 'Hành Tinh Đá TRAPPIST-1e (Khóa Thủy Triều)',
    subtitle: 'Hành tinh đá quay quanh sao lùn đỏ, vùng chạng vạng băng - lửa & bão từ cực quang',
    inspiration: 'Hệ ngoại hành tinh đá TRAPPIST-1e & Proxima Centauri b',
    skyTopHex: '#3b0764',
    skyHorizonHex: '#be123c',
    fogHex: '#881337',
    sunHex: '#fb7185',
    hemiSkyHex: '#f43f5e',
    hemiGroundHex: '#1e1b4b',
    waterHex: '#0ea5e9',
    waterDeepHex: '#0f172a',
    defaultTexture: 'exoplanet_basalt',
    defaultWeather: 'ion_aurora_tempest',
    waterLevel: -25,
    reliefScale: 1.25,
  },
  pluto_cryovolcano: {
    id: 'pluto_cryovolcano',
    name: 'Sao Diêm Vương · Núi Lửa Băng Wright Mons',
    subtitle: 'Núi lửa băng phun nitơ lỏng -230°C, đồng bằng băng Sputnik Planitia & tholin đỏ Cthulhu',
    inspiration: 'Sao Diêm Vương (Pluto Wright Mons, Piccard Mons & Sputnik Planitia)',
    skyTopHex: '#090d16',
    skyHorizonHex: '#1e3a8a',
    fogHex: '#172554',
    sunHex: '#bae6fd',
    hemiSkyHex: '#38bdf8',
    hemiGroundHex: '#451a03',
    waterHex: '#67e8f9',
    waterDeepHex: '#0e7490',
    defaultTexture: 'pluto_nitrogen_ice',
    defaultWeather: 'liquid_nitrogen_snow',
    waterLevel: -45,
    reliefScale: 1.32,
  },
  titan_methane_sea: {
    id: 'titan_methane_sea',
    name: 'Vệ Tinh Titan · Biển Mêtan Kraken Mare',
    subtitle: 'Đại dương mêtan & êtan lỏng rộng lớn, đá cuội băng hydrocarbon & bầu khí quyển tholin cam đặc',
    inspiration: 'Vệ tinh lớn nhất Sao Thổ (Titan Kraken Mare, Ligeia Mare & Huygens Landing Site)',
    skyTopHex: '#451a03',
    skyHorizonHex: '#d97706',
    fogHex: '#b45309',
    sunHex: '#fde68a',
    hemiSkyHex: '#f59e0b',
    hemiGroundHex: '#27272a',
    waterHex: '#b45309',
    waterDeepHex: '#451a03',
    defaultTexture: 'titan_methane_liquid',
    defaultWeather: 'liquid_nitrogen_snow',
    waterLevel: -12,
    reliefScale: 1.12,
  },
  europa_chaos_ridge: {
    id: 'europa_chaos_ridge',
    name: 'Vệ Tinh Europa · Nứt Gãy Băng Chaos & Mạch Phun',
    subtitle: 'Vỏ băng đan chéo rãnh muối đỏ, rừng tháp băng Penitentes & mạch nước ngầm phun cao',
    inspiration: 'Vệ tinh băng của Sao Mộc (Europa Conamara Chaos & Enceladus Tiger Stripes)',
    skyTopHex: '#0f172a',
    skyHorizonHex: '#0284c7',
    fogHex: '#0c4a6e',
    sunHex: '#e0f2fe',
    hemiSkyHex: '#7dd3fc',
    hemiGroundHex: '#334155',
    waterHex: '#22d3ee',
    waterDeepHex: '#0369a1',
    defaultTexture: 'pluto_nitrogen_ice',
    defaultWeather: 'cryo_geyser_blizzard',
    waterLevel: -32,
    reliefScale: 1.26,
  },
  corot_lava_ocean: {
    id: 'corot_lava_ocean',
    name: 'Hành Tinh Dung Nham CoRoT-7b · Mưa Đá Silicat',
    subtitle: 'Ngoại hành tinh siêu nóng 2.500°C, đại dương magma sôi sục & mưa đá silicat nóng chảy',
    inspiration: 'Ngoại hành tinh cực hạn CoRoT-7b, 55 Cancri e & K2-141b',
    skyTopHex: '#2a0808',
    skyHorizonHex: '#ea580c',
    fogHex: '#9a3412',
    sunHex: '#fef08a',
    hemiSkyHex: '#fb923c',
    hemiGroundHex: '#450a0a',
    waterHex: '#f97316',
    waterDeepHex: '#991b1b',
    defaultTexture: 'volcanic_lava',
    defaultWeather: 'molten_silicate_rain',
    waterLevel: -18,
    reliefScale: 1.38,
  },
  himalaya_alps_andes: {
    id: 'himalaya_alps_andes',
    name: 'Dãy Núi Tuyết Himalaya · Anpơ · Andes',
    subtitle: 'Đỉnh sừng băng Everest & Matterhorn cao vút, thung lũng băng hà chữ U & hồ ngọc lam Andes',
    inspiration: 'Himalaya (Everest/Annapurna), Dãy Anpơ (Matterhorn) & Dãy Andes (Patagonia/Altiplano)',
    skyTopHex: '#0f172a',
    skyHorizonHex: '#7dd3fc',
    fogHex: '#e0f2fe',
    sunHex: '#ffffff',
    hemiSkyHex: '#bae6fd',
    hemiGroundHex: '#334155',
    waterHex: '#06b6d4',
    waterDeepHex: '#0369a1',
    defaultTexture: 'glacier_snow',
    defaultWeather: 'himalaya_blizzard',
    waterLevel: -28,
    reliefScale: 1.44,
  },
  sahara_atacama_gobi: {
    id: 'sahara_atacama_gobi',
    name: 'Đại Sa Mạc Sahara · Atacama · Gobi',
    subtitle: 'Đồi cát lưỡi liềm Barchan Sahara, bãi muối trắng Salar de Atacama, đá gió mòn Gobi & ốc đảo cọ',
    inspiration: 'Sa mạc Sahara (Bắc Phi), Atacama (Chile) & Gobi (Mông Cổ)',
    skyTopHex: '#0369a1',
    skyHorizonHex: '#fcd34d',
    fogHex: '#fde68a',
    sunHex: '#fffbeb',
    hemiSkyHex: '#fbbf24',
    hemiGroundHex: '#78350f',
    waterHex: '#14b8a6',
    waterDeepHex: '#0f766e',
    defaultTexture: 'desert_sand',
    defaultWeather: 'clear_sky',
    waterLevel: -48,
    reliefScale: 1.05,
  },
  hawaii_shield_volcano: {
    id: 'hawaii_shield_volcano',
    name: 'Núi Lửa Khiên Hawaii · Kīlauea & Mauna Loa',
    subtitle: 'Núi lửa khiên bazan đen phun dòng dung nham Pahoehoe đổ thẳng ra biển Thái Bình Dương & rừng nhiệt đới',
    inspiration: 'Quần đảo Hawaii (Kīlauea, Mauna Loa & bờ biển đá bazan đen)',
    skyTopHex: '#0284c7',
    skyHorizonHex: '#fdba74',
    fogHex: '#fed7aa',
    sunHex: '#fef3c7',
    hemiSkyHex: '#38bdf8',
    hemiGroundHex: '#27272a',
    waterHex: '#0ea5e9',
    waterDeepHex: '#0369a1',
    defaultTexture: 'volcanic_lava',
    defaultWeather: 'ash_ember_fall',
    waterLevel: -16,
    reliefScale: 1.24,
  },
  amazon_congo_rainforest: {
    id: 'amazon_congo_rainforest',
    name: 'Rừng Nhiệt Đới Amazon & Trung Phi Congo',
    subtitle: 'Rừng mưa nhiệt đới đa tầng rậm rạp, đại thụ Kapok - Baobab, sông uốn khúc Meander & thác sương mù',
    inspiration: 'Rừng mưa Amazon (Nam Mỹ) & Rừng nhiệt đới lưu vực sông Congo (Trung Phi)',
    skyTopHex: '#0284c7',
    skyHorizonHex: '#a7f3d0',
    fogHex: '#d1fae5',
    sunHex: '#fef9c3',
    hemiSkyHex: '#6ee7b7',
    hemiGroundHex: '#14532d',
    waterHex: '#0d9488',
    waterDeepHex: '#115e59',
    defaultTexture: 'tropical_rainforest_floor',
    defaultWeather: 'tropical_monsoon_rain',
    waterLevel: -12,
    reliefScale: 0.96,
  },
  boreal_taiga_forest: {
    id: 'boreal_taiga_forest',
    name: 'Rừng Lá Kim Taiga (Siberia · Bắc Âu · Canada)',
    subtitle: 'Rừng thông & vân sam lá kim phương Bắc bạt ngàn, thảm rêu xanh thẫm, hồ băng & đá granite cổ',
    inspiration: 'Rừng lá kim Boreal Taiga (Siberia, Scandinavia & Canada)',
    skyTopHex: '#1e3a8a',
    skyHorizonHex: '#93c5fd',
    fogHex: '#dbeafe',
    sunHex: '#f0f9ff',
    hemiSkyHex: '#7dd3fc',
    hemiGroundHex: '#1e293b',
    waterHex: '#0284c7',
    waterDeepHex: '#1e3a8a',
    defaultTexture: 'taiga_moss_needles',
    defaultWeather: 'clear_sky',
    waterLevel: -22,
    reliefScale: 1.16,
  },
};

export const WEATHER_CATALOG: WeatherConfig[] = [
  {
    id: 'clear_sky',
    name: 'Trời Quang Đãng (Tự Nhiên)',
    shortName: 'Quang Đãng',
    planetOrigin: 'Trái Đất / Teyvat',
    subtitle: 'Bầu trời trong trẻo, ánh nắng chuẩn theo quần xã',
    badgeColor: '#38bdf8',
    particleColorHex: '#ffffff',
    secondaryColorHex: '#bae6fd',
  },
  {
    id: 'himalaya_blizzard',
    name: 'Bão Tuyết Đỉnh Himalaya · Anpơ · Andes',
    shortName: 'Bão Tuyết Himalaya',
    planetOrigin: 'Himalaya / Anpơ / Andes',
    subtitle: 'Gió tuyết sơn cước cuốn bông tuyết trắng xóa & sương băng quanh các đỉnh núi 1km',
    badgeColor: '#bae6fd',
    fogOverrideHex: '#cbd5e1',
    particleColorHex: '#ffffff',
    secondaryColorHex: '#7dd3fc',
  },
  {
    id: 'tropical_monsoon_rain',
    name: 'Mưa Giông & Sương Mù Rừng Nhiệt Đới (Amazon / Trung Phi)',
    shortName: 'Mưa Rừng Amazon',
    planetOrigin: 'Amazon / Congo',
    subtitle: 'Mưa rào nhiệt đới mát lành kèm làn sương hơi nước bốc lên từ tán rừng mưa',
    badgeColor: '#34d399',
    fogOverrideHex: '#6ee7b7',
    particleColorHex: '#a7f3d0',
    secondaryColorHex: '#38bdf8',
  },
  {
    id: 'mars_dust_storm',
    name: 'Bão Bụi Đỏ & Lốc Xoáy Sao Hỏa',
    shortName: 'Bão Bụi Sao Hỏa',
    planetOrigin: 'Sao Hỏa (Mars)',
    subtitle: 'Bão cát oxit sắt đỏ cam toàn cầu kèm cột lốc bụi Dust Devil xoáy cao',
    badgeColor: '#ea580c',
    fogOverrideHex: '#b45309',
    particleColorHex: '#f97316',
    secondaryColorHex: '#9a3412',
  },
  {
    id: 'supersonic_mars_storm',
    name: 'Bão Bụi Siêu Thanh & Sét Tĩnh Điện (Mars)',
    shortName: 'Bão Bụi Siêu Thanh',
    planetOrigin: 'Sao Hỏa (Mars Extreme)',
    subtitle: 'Gió giật siêu thanh cuốn vệt cát ngang tốc độ cao, 4 vòi rồng bụi khổng lồ & phóng điện ma sát',
    badgeColor: '#f97316',
    fogOverrideHex: '#9a3412',
    particleColorHex: '#fb923c',
    secondaryColorHex: '#38bdf8',
  },
  {
    id: 'venus_acid_rain',
    name: 'Mưa Axit Sunfuric & Sấm Chớp Sao Kim',
    shortName: 'Mưa Axit Sao Kim',
    planetOrigin: 'Sao Kim (Venus)',
    subtitle: 'Mưa axit H₂SO₄ vàng lục đặc quánh từ tầng mây siêu quay & tia chớp áp suất cao',
    badgeColor: '#eab308',
    fogOverrideHex: '#a16207',
    particleColorHex: '#fde047',
    secondaryColorHex: '#a3e635',
  },
  {
    id: 'concentrated_venus_acid',
    name: 'Mưa Axit Cô Đặc & Sét Siêu Áp (Venus)',
    shortName: 'Mưa Axit Cô Đặc',
    planetOrigin: 'Sao Kim (Venus 92 Bar)',
    subtitle: 'Mưa axit sunfuric cô đặc xối xả, tia sét 3D đánh thẳng xuống bề mặt & hơi ăn mòn bốc khói',
    badgeColor: '#a3e635',
    fogOverrideHex: '#854d0e',
    particleColorHex: '#bef264',
    secondaryColorHex: '#facc15',
  },
  {
    id: 'liquid_nitrogen_snow',
    name: 'Tuyết Nitơ Lỏng & Sương Mêtan (Titan / Pluto)',
    shortName: 'Tuyết Nitơ Lỏng',
    planetOrigin: 'Titan / Sao Diêm Vương',
    subtitle: 'Bông tuyết nitơ lỏng xanh băng & giọt mưa mêtan vàng hổ phách rơi chậm kèm sương khói lạnh -230°C',
    badgeColor: '#22d3ee',
    fogOverrideHex: '#164e63',
    particleColorHex: '#67e8f9',
    secondaryColorHex: '#f59e0b',
  },
  {
    id: 'cryo_geyser_blizzard',
    name: 'Bão Phun Trào Núi Lửa Băng & Tinh Thể (Pluto / Europa)',
    shortName: 'Bão Phun Băng',
    planetOrigin: 'Sao Diêm Vương / Europa',
    subtitle: 'Các cột mạch phun băng nitơ & amoniac bắn vọt từ lòng đất lên trời kèm bão tuyết tinh thể',
    badgeColor: '#38bdf8',
    fogOverrideHex: '#0c4a6e',
    particleColorHex: '#e0f2fe',
    secondaryColorHex: '#38bdf8',
  },
  {
    id: 'molten_silicate_rain',
    name: 'Mưa Đá Silicat Nóng Chảy & Bão Thủy Tinh (CoRoT-7b)',
    shortName: 'Mưa Đá Nóng Chảy',
    planetOrigin: 'CoRoT-7b / HD 189733b',
    subtitle: 'Mưa đá thạch anh & thủy tinh silicat nóng chảy 2.500°C quất chéo kèm sóng nhiệt magma',
    badgeColor: '#fb7185',
    fogOverrideHex: '#7f1d1d',
    particleColorHex: '#fda4af',
    secondaryColorHex: '#f97316',
  },
  {
    id: 'exoplanet_meteor_shower',
    name: 'Mưa Sao Băng & Thiên Thạch Ngoại Hành Tinh',
    shortName: 'Mưa Sao Băng',
    planetOrigin: 'Kepler-452b / Ngoại Hành Tinh',
    subtitle: 'Mưa sao băng phát quang xanh lam - tím cắt ngang bầu trời hành tinh đá',
    badgeColor: '#a855f7',
    fogOverrideHex: '#4c1d95',
    particleColorHex: '#38bdf8',
    secondaryColorHex: '#e879f9',
  },
  {
    id: 'ion_aurora_tempest',
    name: 'Bão Từ Cực Quang & Tinh Thể Băng TRAPPIST-1e',
    shortName: 'Bão Từ Cực Quang',
    planetOrigin: 'TRAPPIST-1e / Proxima b',
    subtitle: 'Dải cực quang bức xạ sao lùn đỏ & bụi kim cương băng trôi lơ lửng',
    badgeColor: '#f43f5e',
    fogOverrideHex: '#701a75',
    particleColorHex: '#2dd4bf',
    secondaryColorHex: '#fb7185',
  },
  {
    id: 'ash_ember_fall',
    name: 'Mưa Tro Núi Lửa & Tàn Lửa Magma',
    shortName: 'Mưa Tro Lửa',
    planetOrigin: 'Natlan / Hành Tinh Dung Nham',
    subtitle: 'Tàn lửa đỏ rực bay lên cùng mưa tro xỉ bazan rơi từ miệng núi lửa',
    badgeColor: '#ef4444',
    fogOverrideHex: '#7c2d12',
    particleColorHex: '#fb923c',
    secondaryColorHex: '#475569',
  },
];

export const TEXTURE_BRUSHES: Record<TextureBrushId, TextureBrushConfig> = {
  earth_soil: {
    id: 'earth_soil',
    name: 'Đất Nền Nguyên Bản',
    subtitle: 'Mặt đất nâu ấm tự nhiên (Định dạng gốc)',
    primaryRgb: [0.52, 0.37, 0.23],
    secondaryRgb: [0.41, 0.28, 0.17],
    swatchHex: '#855836',
    roughness: 0.88,
    hydroOrTerrainEffect: 'none',
  },
  emerald_grass: {
    id: 'emerald_grass',
    name: 'Mặt Cỏ Thảo Nguyên',
    subtitle: 'Cỏ xanh ngọc lục bảo phong cách Genshin/Pokémon',
    primaryRgb: [0.18, 0.68, 0.24],
    secondaryRgb: [0.11, 0.50, 0.18],
    swatchHex: '#22c55e',
    roughness: 0.78,
    hydroOrTerrainEffect: 'none',
  },
  flower_meadow: {
    id: 'flower_meadow',
    name: 'Mặt Hoa Rực Rỡ',
    subtitle: 'Thảm hoa anh đào & hoa dại hồng tím Inazuma',
    primaryRgb: [0.89, 0.36, 0.65],
    secondaryRgb: [0.68, 0.24, 0.54],
    swatchHex: '#ec4899',
    roughness: 0.75,
    hydroOrTerrainEffect: 'none',
  },
  desert_sand: {
    id: 'desert_sand',
    name: 'Cát Sa Mạc',
    subtitle: 'Cát vàng óng ả vùng sa mạc & bờ vịnh',
    primaryRgb: [0.93, 0.75, 0.34],
    secondaryRgb: [0.82, 0.61, 0.24],
    swatchHex: '#f59e0b',
    roughness: 0.82,
    hydroOrTerrainEffect: 'none',
  },
  volcanic_lava: {
    id: 'volcanic_lava',
    name: 'Dung Nham Núi Lửa',
    subtitle: 'Nham thạch nóng chảy đỏ cam rực sáng & xỉ bazan',
    primaryRgb: [0.98, 0.26, 0.05],
    secondaryRgb: [0.42, 0.08, 0.03],
    swatchHex: '#ef4444',
    roughness: 0.45,
    hydroOrTerrainEffect: 'lava',
  },
  river_stream: {
    id: 'river_stream',
    name: 'Dòng Sông Xanh',
    subtitle: 'Vẽ lòng sông uốn lượn & tự hạ cốt đất ngập nước',
    primaryRgb: [0.06, 0.68, 0.88],
    secondaryRgb: [0.04, 0.48, 0.72],
    swatchHex: '#06b6d4',
    roughness: 0.22,
    hydroOrTerrainEffect: 'river',
  },
  lake_water: {
    id: 'lake_water',
    name: 'Mặt Hồ Nước Trong',
    subtitle: 'Vẽ lòng hồ sâu xanh biếc & tụ thủy tự nhiên',
    primaryRgb: [0.05, 0.48, 0.85],
    secondaryRgb: [0.03, 0.32, 0.68],
    swatchHex: '#0284c7',
    roughness: 0.18,
    hydroOrTerrainEffect: 'lake',
  },
  dirt_cobble_road: {
    id: 'dirt_cobble_road',
    name: 'Đường Đất - Đá',
    subtitle: 'Lối mòn đất nện xen đá cuội dẫn qua thị trấn',
    primaryRgb: [0.62, 0.54, 0.45],
    secondaryRgb: [0.46, 0.40, 0.34],
    swatchHex: '#a8a29e',
    roughness: 0.85,
    hydroOrTerrainEffect: 'road',
  },
  limestone_cliff: {
    id: 'limestone_cliff',
    name: 'Đá Vách Núi',
    subtitle: 'Đá vôi xám xanh nguyên khối có vân địa chất',
    primaryRgb: [0.38, 0.45, 0.56],
    secondaryRgb: [0.27, 0.33, 0.43],
    swatchHex: '#64748b',
    roughness: 0.88,
    hydroOrTerrainEffect: 'none',
  },
  glacier_snow: {
    id: 'glacier_snow',
    name: 'Tuyết Đỉnh Núi',
    subtitle: 'Tuyết trắng ánh lam trên đỉnh núi 1km',
    primaryRgb: [0.85, 0.92, 0.99],
    secondaryRgb: [0.68, 0.80, 0.94],
    swatchHex: '#bae6fd',
    roughness: 0.55,
    hydroOrTerrainEffect: 'none',
  },
  mars_regolith: {
    id: 'mars_regolith',
    name: 'Đất Đỏ Sao Hỏa',
    subtitle: 'Bụi đá oxit sắt hematit đỏ cam & sỏi bazan Sao Hỏa',
    primaryRgb: [0.80, 0.31, 0.14],
    secondaryRgb: [0.55, 0.18, 0.08],
    swatchHex: '#c2410c',
    roughness: 0.90,
    hydroOrTerrainEffect: 'none',
  },
  venus_sulfur: {
    id: 'venus_sulfur',
    name: 'Đá Lưu Huỳnh Sao Kim',
    subtitle: 'Bề mặt lưu huỳnh vàng sẫm, khe nhiệt dịch & bazan áp suất cao',
    primaryRgb: [0.84, 0.66, 0.14],
    secondaryRgb: [0.58, 0.41, 0.06],
    swatchHex: '#ca8a04',
    roughness: 0.84,
    hydroOrTerrainEffect: 'none',
  },
  exoplanet_basalt: {
    id: 'exoplanet_basalt',
    name: 'Đá Tinh Thể Ngoại Hành Tinh',
    subtitle: 'Đá bazan tím sẫm xen mạch tinh thể silicat phát quang Kepler/TRAPPIST',
    primaryRgb: [0.42, 0.25, 0.62],
    secondaryRgb: [0.18, 0.55, 0.76],
    swatchHex: '#7e22ce',
    roughness: 0.65,
    hydroOrTerrainEffect: 'none',
  },
  pluto_nitrogen_ice: {
    id: 'pluto_nitrogen_ice',
    name: 'Băng Nitơ & Tholin Sao Diêm Vương',
    subtitle: 'Băng nitơ xanh ngọc Sputnik Planitia xen trầm tích tholin đỏ nâu & gai băng Penitentes',
    primaryRgb: [0.45, 0.86, 0.96],
    secondaryRgb: [0.58, 0.18, 0.16],
    swatchHex: '#22d3ee',
    roughness: 0.32,
    hydroOrTerrainEffect: 'none',
  },
  titan_methane_liquid: {
    id: 'titan_methane_liquid',
    name: 'Biển Mêtan Lỏng & Cuội Băng Titan',
    subtitle: 'Hồ hydrocarbon mêtan-êtan lỏng vàng hổ phách sẫm, sủi bọt khí & đá cuội băng',
    primaryRgb: [0.78, 0.45, 0.08],
    secondaryRgb: [0.28, 0.16, 0.04],
    swatchHex: '#d97706',
    roughness: 0.16,
    hydroOrTerrainEffect: 'lake',
  },
  atacama_salt_crust: {
    id: 'atacama_salt_crust',
    name: 'Muối Trắng Atacama & Đá Gobi',
    subtitle: 'Bề mặt muối kết tinh đa giác Salar de Atacama xen sỏi đá sa mạc Gobi & Sahara',
    primaryRgb: [0.95, 0.89, 0.84],
    secondaryRgb: [0.82, 0.68, 0.56],
    swatchHex: '#fed7aa',
    roughness: 0.72,
    hydroOrTerrainEffect: 'none',
  },
  tropical_rainforest_floor: {
    id: 'tropical_rainforest_floor',
    name: 'Thảm Rừng Nhiệt Đới Amazon',
    subtitle: 'Thảm thực vật rừng mưa Amazon & Trung Phi: dương xỉ khổng lồ, rễ cây & đất mùn ẩm',
    primaryRgb: [0.06, 0.52, 0.22],
    secondaryRgb: [0.16, 0.34, 0.12],
    swatchHex: '#15803d',
    roughness: 0.76,
    hydroOrTerrainEffect: 'none',
  },
  taiga_moss_needles: {
    id: 'taiga_moss_needles',
    name: 'Rêu & Lá Kim Rừng Taiga',
    subtitle: 'Thảm rêu xanh Bắc Cực, lá thông vân sam rụng & đá tảng phủ tuyết rừng Taiga',
    primaryRgb: [0.12, 0.42, 0.32],
    secondaryRgb: [0.24, 0.36, 0.22],
    swatchHex: '#0f766e',
    roughness: 0.80,
    hydroOrTerrainEffect: 'none',
  },
};

export const PREFAB_CATALOG: PrefabMetadata[] = [
  {
    id: 'himalaya_matterhorn_peak',
    name: 'Đỉnh Sừng Băng Himalaya / Matterhorn Anpơ',
    category: 'mountain',
    inspiration: 'Đỉnh núi đá hình kim tự tháp Matterhorn (Anpơ), Everest (Himalaya) & hồ băng Andes',
    partsCount: 10,
    defaultScale: 1.35,
    realDimensions: '20.0m × 19.0m × Cao 23.5m',
    realHeightMeters: 23.5,
    badgeColor: '#bae6fd',
  },
  {
    id: 'sahara_atacama_oasis',
    name: 'Ốc Đảo Sahara & Đá Gió Mòn Atacama - Gobi',
    category: 'landmark',
    inspiration: 'Đồi cát lưỡi liềm Sahara, hồ ốc đảo rợp bóng cọ & cột đá sa thạch Gobi/Atacama',
    partsCount: 10,
    defaultScale: 1.15,
    realDimensions: '17.0m × 16.0m × Cao 11.5m',
    realHeightMeters: 11.5,
    badgeColor: '#f59e0b',
  },
  {
    id: 'hawaii_kilauea_shield',
    name: 'Núi Lửa Kīlauea Hawaii & Dòng Magma Đổ Biển',
    category: 'mountain',
    inspiration: 'Núi lửa khiên Mauna Loa / Kīlauea Hawaii, hồ dung nham Halemaʻumaʻu & cột hơi nước trắng',
    partsCount: 10,
    defaultScale: 1.25,
    realDimensions: '21.0m × 20.0m × Cao 15.0m',
    realHeightMeters: 15.0,
    badgeColor: '#f97316',
  },
  {
    id: 'amazon_congo_canopy_tree',
    name: 'Đại Thụ Kapok Amazon & Baobab Trung Phi',
    category: 'tree',
    inspiration: 'Cây cổ thụ rừng mưa nhiệt đới Amazon & Congo với bộ rễ bạnh vè khổng lồ, dây leo & tán 4 tầng',
    partsCount: 10,
    defaultScale: 1.15,
    realDimensions: 'Tán 11.5m × Cao 14.5m',
    realHeightMeters: 14.5,
    badgeColor: '#16a34a',
  },
  {
    id: 'taiga_spruce_grove',
    name: 'Quần Thể Thông Vân Sam Rừng Lá Kim Taiga',
    category: 'tree',
    inspiration: 'Cụm 3 cây thông & vân sam phương Bắc phủ tuyết nhẹ trên nền đá rêu Siberia/Canada',
    partsCount: 9,
    defaultScale: 1.1,
    realDimensions: 'Tán 9.5m × Cao 13.0m',
    realHeightMeters: 13.0,
    badgeColor: '#0d9488',
  },
  {
    id: 'pluto_cryo_volcano',
    name: 'Núi Lửa Băng Wright Mons (Sao Diêm Vương)',
    category: 'mountain',
    inspiration: 'Núi lửa băng khổng lồ cao 4km trên Sao Diêm Vương, phun băng nitơ - amoniac & sườn tholin đỏ',
    partsCount: 11,
    defaultScale: 1.25,
    realDimensions: '21.0m × 21.0m × Cao 17.5m',
    realHeightMeters: 17.5,
    badgeColor: '#22d3ee',
  },
  {
    id: 'titan_methane_geyser',
    name: 'Hồ Mêtan & Mạch Phun Hydrocarbon (Titan)',
    category: 'landmark',
    inspiration: 'Lòng hồ mêtan lỏng Kraken Mare, đảo cuội băng Huygens & cột phun khí hydrocarbon vàng cam',
    partsCount: 10,
    defaultScale: 1.2,
    realDimensions: '18.5m × 18.5m × Cao 13.0m',
    realHeightMeters: 13.0,
    badgeColor: '#f59e0b',
  },
  {
    id: 'europa_penitentes_spire',
    name: 'Rừng Tháp Băng Penitentes & Rãnh Muối (Europa)',
    category: 'mountain',
    inspiration: 'Lưỡi băng Penitentes sắc nhọn vùng Tartarus Dorsa (Pluto) & nứt gãy băng Chaos (Europa)',
    partsCount: 10,
    defaultScale: 1.2,
    realDimensions: '15.0m × 15.0m × Cao 18.0m',
    realHeightMeters: 18.0,
    badgeColor: '#38bdf8',
  },
  {
    id: 'mars_olympus_shield',
    name: 'Núi Lửa Olympus Mons (Sao Hỏa)',
    category: 'mountain',
    inspiration: 'Núi lửa khiên lớn nhất Hệ Mặt Trời, miệng caldera bậc thang & bụi oxit sắt',
    partsCount: 10,
    defaultScale: 1.25,
    realDimensions: '22.0m × 22.0m × Cao 18.5m',
    realHeightMeters: 18.5,
    badgeColor: '#ea580c',
  },
  {
    id: 'venus_pancake_dome',
    name: 'Vòm Dung Nham Lưu Huỳnh (Sao Kim)',
    category: 'mountain',
    inspiration: 'Vòm núi lửa Pancake phẳng đặc trưng Sao Kim, khe nứt magma vàng & cột khí axit',
    partsCount: 10,
    defaultScale: 1.2,
    realDimensions: '18.0m × 18.0m × Cao 11.0m',
    realHeightMeters: 11.0,
    badgeColor: '#eab308',
  },
  {
    id: 'meteor_impact_crater',
    name: 'Hố Thiên Thạch & Lõi Sao Băng',
    category: 'landmark',
    inspiration: 'Hố va chạm thiên thạch vành tròn nâng cao & khối thiên thạch sắt-niken nóng sáng',
    partsCount: 9,
    defaultScale: 1.15,
    realDimensions: '16.0m × 16.0m × Cao 6.5m',
    realHeightMeters: 6.5,
    badgeColor: '#f97316',
  },
  {
    id: 'exoplanet_crystal_spire',
    name: 'Tháp Tinh Thể Silicat Ngoại Hành Tinh',
    category: 'mountain',
    inspiration: 'Cụm cột tinh thể thạch anh - silicat phát quang trên siêu Trái Đất Kepler-452b',
    partsCount: 10,
    defaultScale: 1.2,
    realDimensions: '12.0m × 12.0m × Cao 19.0m',
    realHeightMeters: 19.0,
    badgeColor: '#a855f7',
  },
  {
    id: 'floating_sky_island',
    name: 'Đảo Bay Celestia / Khánh Vân',
    category: 'landmark',
    inspiration: 'Đảo thần lơ lửng trên không, thác mây & đình cổ Genshin/Sky Pillar',
    partsCount: 11,
    defaultScale: 1.0,
    realDimensions: '16.0m × 16.0m × Lơ lửng 22m',
    realHeightMeters: 22.0,
    badgeColor: '#38bdf8',
  },
  {
    id: 'sheer_cliff_wall',
    name: 'Vách Đá Dựng Đứng Tuyệt Vân',
    category: 'mountain',
    inspiration: 'Vách núi đá 90° Liyue, cầu ván gỗ treo & mạch quặng phát sáng',
    partsCount: 9,
    defaultScale: 1.2,
    realDimensions: '18.5m × 9.0m × Cao 21.0m',
    realHeightMeters: 21.0,
    badgeColor: '#94a3b8',
  },
  {
    id: 'active_volcano',
    name: 'Núi Lửa Phun Trào Natlan',
    category: 'mountain',
    inspiration: 'Miệng núi lửa dung nham sôi, sông magma & cột khói 3D (Mt. Chimney)',
    partsCount: 10,
    defaultScale: 1.3,
    realDimensions: '20.0m × 20.0m × Cao 18.5m',
    realHeightMeters: 18.5,
    badgeColor: '#ef4444',
  },
  {
    id: 'abyss_chasm_vortex',
    name: 'Vực Sâu Vực Đá & Hố Area Zero',
    category: 'landmark',
    inspiration: 'Hố sâu Thâm Uyên Genshin & tinh thể xoáy Area Zero Pokémon',
    partsCount: 10,
    defaultScale: 1.15,
    realDimensions: '15.0m × 15.0m × Sâu -8m',
    realHeightMeters: 9.5,
    badgeColor: '#a855f7',
  },
  {
    id: 'statue_of_seven',
    name: 'Thất Thiên Thần Tượng Genshin',
    category: 'landmark',
    inspiration: 'Tượng thần ban phước, vòng hào quang & ngọc Phong/Thiên Không',
    partsCount: 9,
    defaultScale: 1.0,
    realDimensions: '5.4m × 5.4m × Cao 9.2m',
    realHeightMeters: 9.2,
    badgeColor: '#2dd4bf',
  },
  {
    id: 'pokemon_gym_stadium',
    name: 'Sân Đấu Pokémon Gym Stadium',
    category: 'house',
    inspiration: 'Đấu trường Pokéball vòm đôi, sân chiến đấu & 4 trụ đèn pha',
    partsCount: 11,
    defaultScale: 1.0,
    realDimensions: '16.5m × 13.5m × Cao 9.8m',
    realHeightMeters: 9.8,
    badgeColor: '#f43f5e',
  },
  {
    id: 'berry_apricorn_tree',
    name: 'Cây Quả Berry & Apricorn Pokémon',
    category: 'tree',
    inspiration: 'Cây cổ thụ trĩu quả Berry xanh/vàng/hồng & giỏ thu hoạch',
    partsCount: 9,
    defaultScale: 1.0,
    realDimensions: 'Tán 7.2m × Cao 8.4m',
    realHeightMeters: 8.4,
    badgeColor: '#facc15',
  },
  {
    id: 'windmill_cottage',
    name: 'Nhà Cối Xay Gió Mondstadt',
    category: 'house',
    inspiration: 'Kiến trúc gỗ đá & cánh quạt gió Teyvat',
    partsCount: 9,
    defaultScale: 1.0,
    realDimensions: '8.6m × 8.4m × Cao 11.5m',
    realHeightMeters: 11.5,
    badgeColor: '#34d399',
  },
  {
    id: 'sakura_shrine',
    name: 'Đền Thờ Anh Đào Inazuma',
    category: 'house',
    inspiration: 'Đền gỗ sơn son, mái cong & cổng Torii',
    partsCount: 8,
    defaultScale: 1.0,
    realDimensions: '10.4m × 9.2m × Cao 9.5m',
    realHeightMeters: 9.5,
    badgeColor: '#f472b6',
  },
  {
    id: 'pokemon_center',
    name: 'Trung Tâm Lữ Hành Paldea',
    category: 'house',
    inspiration: 'Mái vòm đỏ trắng biểu tượng Pokémon',
    partsCount: 8,
    defaultScale: 1.0,
    realDimensions: '10.0m × 9.2m × Cao 8.5m',
    realHeightMeters: 8.5,
    badgeColor: '#fb7185',
  },
  {
    id: 'karst_mountain',
    name: 'Đỉnh Đá Thạch Anh Liyue',
    category: 'mountain',
    inspiration: 'Cột đá vôi dựng đứng & mạch quặng hổ phách',
    partsCount: 7,
    defaultScale: 1.5,
    realDimensions: '14.0m × 13.0m × Cao 24.8m',
    realHeightMeters: 16.5,
    badgeColor: '#fbbf24',
  },
  {
    id: 'volcanic_peak',
    name: 'Núi Đá Nham Cổ Đại',
    category: 'mountain',
    inspiration: 'Vách đá bazan & khe tinh thể nhiệt',
    partsCount: 6,
    defaultScale: 1.5,
    realDimensions: '16.0m × 15.0m × Cao 16.0m',
    realHeightMeters: 10.7,
    badgeColor: '#f97316',
  },
  {
    id: 'sakura_tree',
    name: 'Cây Anh Đào Thần Thụ',
    category: 'tree',
    inspiration: 'Tán hoa hồng phấn nhiều tầng & dây bùa',
    partsCount: 7,
    defaultScale: 1.0,
    realDimensions: 'Tán 8.2m × Cao 8.8m',
    realHeightMeters: 8.8,
    badgeColor: '#e879f9',
  },
  {
    id: 'emerald_pine',
    name: 'Cây Thông Ngọc Lục Bảo',
    category: 'tree',
    inspiration: 'Tán lá phân tầng phong cách Cel-Shaded',
    partsCount: 6,
    defaultScale: 1.0,
    realDimensions: 'Tán 6.4m × Cao 9.5m',
    realHeightMeters: 9.5,
    badgeColor: '#4ade80',
  },
  {
    id: 'aether_crystal',
    name: 'Đài Tinh Thể Phong Thần',
    category: 'landmark',
    inspiration: 'Trụ dịch chuyển & pha lê Terastal lơ lửng',
    partsCount: 7,
    defaultScale: 1.0,
    realDimensions: '3.6m × 3.6m × Cao 4.8m',
    realHeightMeters: 4.8,
    badgeColor: '#38bdf8',
  },
  {
    id: 'ancient_bridge',
    name: 'Cầu Đá & Đèn Cổ Thị Trấn',
    category: 'landmark',
    inspiration: 'Cầu vòm đá bắc qua suối với trụ đèn',
    partsCount: 7,
    defaultScale: 1.0,
    realDimensions: 'Dài 13.6m × Rộng 4.8m × Cao 4.2m',
    realHeightMeters: 4.2,
    badgeColor: '#a8a29e',
  },
];

export const TEXTURE_INDEX_MAP: TextureBrushId[] = [
  'earth_soil',
  'emerald_grass',
  'flower_meadow',
  'desert_sand',
  'atacama_salt_crust',
  'tropical_rainforest_floor',
  'taiga_moss_needles',
  'volcanic_lava',
  'river_stream',
  'lake_water',
  'dirt_cobble_road',
  'limestone_cliff',
  'glacier_snow',
  'mars_regolith',
  'venus_sulfur',
  'exoplanet_basalt',
  'pluto_nitrogen_ice',
  'titan_methane_liquid',
];

export function getTextureIndex(id: TextureBrushId): number {
  const idx = TEXTURE_INDEX_MAP.indexOf(id);
  return idx >= 0 ? idx : 0;
}

export function getTerrainElevationStats(heightMap: Float32Array): {
  maxElevation: number;
  minElevation: number;
} {
  let maxE = -Infinity;
  let minE = Infinity;
  for (let i = 0; i < heightMap.length; i++) {
    const v = heightMap[i];
    if (v > maxE) maxE = v;
    if (v < minE) minE = v;
  }
  return {
    maxElevation: Number.isFinite(maxE) ? Math.round(maxE) : 0,
    minElevation: Number.isFinite(minE) ? Math.round(minE) : 0,
  };
}

// Fast deterministic hash noise for procedural world generation
export function hash2D(ix: number, iz: number, seed = 1337): number {
  let n = ix * 374761393 + iz * 668265263 + seed * 1442695041;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

export function valueNoise2D(x: number, z: number, seed = 1337): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);

  const a = hash2D(ix, iz, seed);
  const b = hash2D(ix + 1, iz, seed);
  const c = hash2D(ix, iz + 1, seed);
  const d = hash2D(ix + 1, iz + 1, seed);

  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm2D(x: number, z: number, octaves = 4, seed = 1337): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1.0;
  let maxAmp = 0;

  for (let i = 0; i < octaves; i++) {
    value += (valueNoise2D(x * frequency, z * frequency, seed + i * 97) * 2 - 1) * amplitude;
    maxAmp += amplitude;
    amplitude *= 0.5;
    frequency *= 2.05;
  }
  return value / maxAmp;
}

/**
 * Bilinear interpolation of terrain elevation at world coordinates (x, z).
 * Ensures every placed 3D object sits flush on the ground with zero floating.
 */
export function getGroundHeightAt(
  heightMap: Float32Array,
  gridSize: number,
  worldSize: number,
  x: number,
  z: number
): number {
  const half = worldSize / 2;
  const clampedX = Math.max(-half, Math.min(half, x));
  const clampedZ = Math.max(-half, Math.min(half, z));

  const gx = ((clampedX + half) / worldSize) * gridSize;
  const gz = ((clampedZ + half) / worldSize) * gridSize;

  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const x1 = Math.min(gridSize, x0 + 1);
  const z1 = Math.min(gridSize, z0 + 1);

  const tx = gx - x0;
  const tz = gz - z0;

  const stride = gridSize + 1;
  const h00 = heightMap[z0 * stride + x0] ?? 0;
  const h10 = heightMap[z0 * stride + x1] ?? 0;
  const h01 = heightMap[z1 * stride + x0] ?? 0;
  const h11 = heightMap[z1 * stride + x1] ?? 0;

  const h0 = h00 * (1 - tx) + h10 * tx;
  const h1 = h01 * (1 - tx) + h11 * tx;
  return h0 * (1 - tz) + h1 * tz;
}

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
    { prefabId: 'windmill_cottage', label: 'Nhà Cối Xay Gió Trung Tâm', x: -16, z: -12, scale: 1.0, rotationY: 0.45 },
    { prefabId: 'pokemon_center', label: 'Trung Tâm Lữ Hành', x: 17, z: -10, scale: 1.0, rotationY: -0.5 },
    { prefabId: 'sakura_shrine', label: 'Đền Thờ Anh Đào', x: 0, z: -24, scale: 1.0, rotationY: 0 },
    { prefabId: 'floating_sky_island', label: 'Đảo Bay Celestia / Khánh Vân', x: 0, z: -8, scale: 1.0, rotationY: 0.2 },
    { prefabId: 'sheer_cliff_wall', label: 'Vách Đá Dựng Đứng Tuyệt Vân', x: -30, z: -22, scale: 1.15, rotationY: 0.55 },
    { prefabId: 'active_volcano', label: 'Núi Lửa Phun Trào Natlan', x: -24, z: 6, scale: 1.1, rotationY: 0.3 },
    { prefabId: 'abyss_chasm_vortex', label: 'Vực Sâu Vực Đá & Area Zero', x: 24, z: 8, scale: 1.0, rotationY: 0 },
    { prefabId: 'statue_of_seven', label: 'Thất Thiên Thần Tượng', x: -7, z: 5, scale: 1.0, rotationY: 0.25 },
    { prefabId: 'pokemon_gym_stadium', label: 'Sân Đấu Pokémon Gym', x: 28, z: -22, scale: 0.95, rotationY: -0.45 },
    { prefabId: 'berry_apricorn_tree', label: 'Cây Quả Berry Pokémon', x: 11, z: 4, scale: 1.0, rotationY: 0.8 },
    { prefabId: 'sakura_tree', label: 'Cây Anh Đào Cổ Thụ', x: -14, z: 12, scale: 1.0, rotationY: 1.2 },
    { prefabId: 'emerald_pine', label: 'Cây Thông Ngọc Lục', x: 15, z: 14, scale: 1.0, rotationY: 0.3 },
    { prefabId: 'ancient_bridge', label: 'Cầu Đá Thị Trấn', x: 0, z: 16, scale: 1.0, rotationY: 0 },
    { prefabId: 'aether_crystal', label: 'Đài Dịch Chuyển Trung Tâm', x: 0, z: 0, scale: 1.0, rotationY: 0 },
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
          { prefabId: 'himalaya_matterhorn_peak', label: 'Đỉnh Everest Himalaya (Nóc Nhà Thế Giới)', x: -22, z: -18, scale: 1.35, rotationY: 0.3 },
          { prefabId: 'himalaya_matterhorn_peak', label: 'Đỉnh Sừng Băng Matterhorn (Dãy Anpơ)', x: 22, z: -16, scale: 1.25, rotationY: -0.5 },
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
          { prefabId: 'hawaii_kilauea_shield', label: 'Miệng Núi Lửa Kīlauea & Hồ Dung Nham', x: -20, z: -16, scale: 1.3, rotationY: 0.25 },
          { prefabId: 'hawaii_kilauea_shield', label: 'Đỉnh Núi Lửa Khiên Mauna Loa (Hawaii)', x: 22, z: -14, scale: 1.25, rotationY: -0.45 },
          { prefabId: 'active_volcano', label: 'Dòng Magma Pahoehoe Đổ Biển', x: 0, z: -24, scale: 1.15, rotationY: 0.1 },
          { prefabId: 'amazon_congo_canopy_tree', label: 'Rừng Nhiệt Đới Bờ Biển Kauai', x: -16, z: 14, scale: 1.05, rotationY: 0.7 },
          { prefabId: 'amazon_congo_canopy_tree', label: 'Thung Lũng Dương Xỉ Hawaii', x: 18, z: 14, scale: 1.0, rotationY: 1.6 },
          { prefabId: 'aether_crystal', label: 'Đài Quan Sát Núi Lửa Hawaii', x: 0, z: 0, scale: 1.0, rotationY: 0 },
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
          { prefabId: 'titan_methane_geyser', label: 'Vịnh Mêtan Kraken Mare', x: -18, z: -14, scale: 1.25, rotationY: 0.25 },
          { prefabId: 'titan_methane_geyser', label: 'Hồ Hydrocarbon Ligeia Mare', x: 20, z: -12, scale: 1.2, rotationY: -0.5 },
          { prefabId: 'pluto_cryo_volcano', label: 'Núi Lửa Băng Doom Mons (Titan)', x: 0, z: -24, scale: 1.15, rotationY: 0.4 },
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

/**
 * Recomputes per-vertex sRGB colors based on splatMap and elevation (up to 1,000m / 1km).
 * Preserves user-painted textures (grass, flowers, desert sand, volcanic lava, rivers, lakes, roads, etc.).
 */
export function recomputeTerrainColors(
  heightMap: Float32Array,
  splatMap: Uint8Array,
  colorMap: Float32Array,
  biomeId: BiomeId
): void {
  const biome = BIOMES[biomeId];

  for (let iz = 0; iz <= GRID_SIZE; iz++) {
    for (let ix = 0; ix <= GRID_SIZE; ix++) {
      const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
      const h = heightMap[idx];

      const paintedBrushId = TEXTURE_INDEX_MAP[splatMap[idx]] || biome.defaultTexture;
      const activeBrush = TEXTURE_BRUSHES[paintedBrushId] || TEXTURE_BRUSHES.earth_soil;

      // Subtle organic variation for stylized Cel-PBR richness
      const microTone = ((ix * 17 + iz * 31) % 11) / 11;
      const blendFactor =
        paintedBrushId === 'volcanic_lava' || paintedBrushId === 'flower_meadow'
          ? microTone * 0.42
          : microTone * 0.25;
      const elevationBoost =
        paintedBrushId === 'volcanic_lava'
          ? 0.06
          : Math.max(-0.08, Math.min(0.14, (h / MAX_ELEVATION) * 0.14));

      const r =
        activeBrush.primaryRgb[0] * (1 - blendFactor) +
        activeBrush.secondaryRgb[0] * blendFactor +
        elevationBoost;
      const g =
        activeBrush.primaryRgb[1] * (1 - blendFactor) +
        activeBrush.secondaryRgb[1] * blendFactor +
        elevationBoost;
      const b =
        activeBrush.primaryRgb[2] * (1 - blendFactor) +
        activeBrush.secondaryRgb[2] * blendFactor +
        elevationBoost;

      colorMap[idx * 3] = Math.max(0.04, Math.min(1, r));
      colorMap[idx * 3 + 1] = Math.max(0.04, Math.min(1, g));
      colorMap[idx * 3 + 2] = Math.max(0.04, Math.min(1, b));
    }
  }
}

/**
 * Applies a terrain sculpting tool at world coordinates (worldX, worldZ) on the 10x10 km continent.
 * Elevation is clamped between MIN_ELEVATION (-250m) and MAX_ELEVATION (1,000m = 1km).
 */
export function applySculptBrush(
  heightMap: Float32Array,
  splatMap: Uint8Array,
  colorMap: Float32Array,
  biomeId: BiomeId,
  tool: SculptToolId,
  worldX: number,
  worldZ: number,
  radius: number,
  strength: number
): number {
  const half = WORLD_SIZE / 2;
  const safeRadius = Math.max(MIN_BRUSH_RADIUS, radius);
  const cellSpan = WORLD_SIZE / GRID_SIZE;
  const effectiveKernelRadius = Math.max(safeRadius, cellSpan * 0.72);
  const microScale = safeRadius < cellSpan ? Math.max(0.25, safeRadius / cellSpan) : 1;
  const centerHeight = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, worldX, worldZ);
  let modifiedCount = 0;

  const copyMap = tool === 'smooth' ? new Float32Array(heightMap) : null;

  for (let iz = 0; iz <= GRID_SIZE; iz++) {
    for (let ix = 0; ix <= GRID_SIZE; ix++) {
      const wx = (ix / GRID_SIZE) * WORLD_SIZE - half;
      const wz = (iz / GRID_SIZE) * WORLD_SIZE - half;
      const dist = Math.hypot(wx - worldX, wz - worldZ);

      if (dist > effectiveKernelRadius) continue;

      const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
      const normalizedDist = dist / effectiveKernelRadius;
      const falloff = 0.5 * (1 + Math.cos(Math.PI * normalizedDist)) * microScale;
      const currentH = heightMap[idx];
      let nextH = currentH;

      switch (tool) {
        case 'raise':
          nextH = currentH + strength * 0.85 * falloff;
          break;
        case 'lower':
          nextH = currentH - strength * 0.85 * falloff;
          break;
        case 'sheer_cliff': {
          // Sheer Vertical Karst Cliff / Plateau (Vách Đá Dựng Đứng 90° Liyue / Victory Road)
          // Flat plateau top inside 72% radius, near-vertical cliff wall between 72% and 95%
          const targetPlateauH = Math.min(MAX_ELEVATION, centerHeight + strength * 1.45 * microScale);
          if (normalizedDist <= 0.72) {
            nextH = currentH + (targetPlateauH - currentH) * 0.82;
          } else if (normalizedDist <= 0.96) {
            const wallT = 1 - (normalizedDist - 0.72) / 0.24;
            const steepFactor = Math.pow(Math.max(0, wallT), 0.35);
            nextH = currentH + (targetPlateauH - currentH) * steepFactor * 0.75;
            splatMap[idx] = getTextureIndex('limestone_cliff');
          }
          break;
        }
        case 'volcano_crater': {
          // Active Volcanic Cone + Sunken Molten Caldera Rim (Núi Lửa Phun Trào Natlan / Mt. Chimney)
          if (normalizedDist < 0.36) {
            // Sunken molten caldera bowl in the center
            const craterDepth = (1 - normalizedDist / 0.36) * strength * 0.95 * microScale;
            nextH = currentH + strength * 0.65 * microScale - craterDepth;
            splatMap[idx] = getTextureIndex('volcanic_lava');
          } else {
            // Steep outer volcanic cone peaking at the rim (normalizedDist = 0.36)
            const coneProfile = Math.pow(1 - (normalizedDist - 0.36) / 0.64, 1.35);
            nextH = currentH + strength * 1.55 * coneProfile * microScale;
            if (normalizedDist < 0.52) {
              splatMap[idx] = getTextureIndex('volcanic_lava');
            } else {
              splatMap[idx] = getTextureIndex('limestone_cliff');
            }
          }
          break;
        }
        case 'abyss_chasm': {
          // Deep Sheer-Walled Abyss / Crater (Vực Sâu Vực Đá Genshin / Đại Hố Area Zero Pokémon)
          const targetAbyssDepth = Math.max(MIN_ELEVATION, currentH - strength * 1.85 * microScale);
          if (normalizedDist < 0.68) {
            nextH = targetAbyssDepth;
            splatMap[idx] = getTextureIndex('limestone_cliff');
          } else if (normalizedDist < 0.94) {
            // Raised jagged rim lip around the abyss
            const rimBoost = Math.sin(((normalizedDist - 0.68) / 0.26) * Math.PI) * strength * 0.35 * microScale;
            nextH = currentH + rimBoost;
            splatMap[idx] = getTextureIndex('limestone_cliff');
          }
          break;
        }
        case 'canyon_gorge': {
          // Tectonic Rift / Canyon Gorge (Hẻm Núi Đứt Gãy Dựng Đứng)
          const crossAxisDist = Math.abs(wx - worldX) / effectiveKernelRadius;
          const alongAxisFactor = Math.max(0, 1 - Math.pow(Math.abs(wz - worldZ) / effectiveKernelRadius, 2));
          if (crossAxisDist < 0.38) {
            nextH = currentH - strength * 1.45 * alongAxisFactor * microScale;
            splatMap[idx] = getTextureIndex('river_stream');
          } else if (crossAxisDist < 0.82) {
            nextH = currentH + strength * 0.85 * alongAxisFactor * microScale;
            splatMap[idx] = getTextureIndex('limestone_cliff');
          }
          break;
        }
        case 'meteor_crater': {
          // Planetary Meteor Impact Crater (Hố Va Chạm Thiên Thạch Sao Hỏa / Ngoại Hành Tinh)
          // Features a central rebound peak (0..0.18), depressed impact bowl (0.18..0.72), and raised ejecta rim wall (0.72..0.96)
          if (normalizedDist < 0.2) {
            const rebound = (1 - normalizedDist / 0.2) * strength * 0.45 * microScale;
            nextH = currentH - strength * 0.85 * microScale + rebound;
            splatMap[idx] = getTextureIndex('mars_regolith');
          } else if (normalizedDist < 0.72) {
            const bowlProfile = Math.sin(((normalizedDist - 0.2) / 0.52) * Math.PI);
            nextH = currentH - strength * 1.25 * bowlProfile * microScale;
            splatMap[idx] = getTextureIndex('mars_regolith');
          } else if (normalizedDist < 0.96) {
            const rimProfile = Math.sin(((normalizedDist - 0.72) / 0.24) * Math.PI);
            nextH = currentH + strength * 0.62 * rimProfile * microScale;
            splatMap[idx] = getTextureIndex('limestone_cliff');
          }
          break;
        }
        case 'shield_mesa': {
          // Shield Volcano / Venusian Pancake Dome (Núi Lửa Khiên Olympus / Vòm Dung Nham Sao Kim)
          if (normalizedDist < 0.25) {
            const shallowCaldera = (1 - normalizedDist / 0.25) * strength * 0.32 * microScale;
            nextH = currentH + strength * 1.15 * microScale - shallowCaldera;
            splatMap[idx] = getTextureIndex('venus_sulfur');
          } else if (normalizedDist < 0.88) {
            const domeProfile = Math.pow(1 - (normalizedDist - 0.25) / 0.63, 0.65);
            nextH = currentH + strength * 1.2 * domeProfile * microScale;
            splatMap[idx] = getTextureIndex('mars_regolith');
          }
          break;
        }
        case 'cryo_volcano': {
          // Pluto Cryovolcano Dome (Núi Lửa Băng Wright Mons / Piccard Mons - Sao Diêm Vương)
          // Broad hummocky ice volcano massif with a deep central nitrogen-ammonia cryovolcanic caldera
          if (normalizedDist < 0.34) {
            const cryoCalderaDepth = (1 - normalizedDist / 0.34) * strength * 1.15 * microScale;
            nextH = currentH + strength * 0.55 * microScale - cryoCalderaDepth;
            splatMap[idx] = getTextureIndex('pluto_nitrogen_ice');
          } else if (normalizedDist < 0.94) {
            const flankT = (normalizedDist - 0.34) / 0.6;
            const hummock = Math.cos(flankT * Math.PI * 3) * 0.08;
            const domeProfile = Math.pow(1 - flankT, 1.15) + hummock * (1 - flankT);
            nextH = currentH + strength * 1.48 * Math.max(0, domeProfile) * microScale;
            splatMap[idx] = getTextureIndex(normalizedDist < 0.68 ? 'pluto_nitrogen_ice' : 'glacier_snow');
          }
          break;
        }
        case 'methane_basin': {
          // Titan Liquid Methane Sea & Terraced Hydrocarbon Shoreline (Biển Mêtan Kraken Mare - Vệ tinh Titan)
          const waterLvl = BIOMES[biomeId].waterLevel;
          if (normalizedDist < 0.68) {
            const seaDepth = Math.min(currentH - strength * 1.45 * microScale, waterLvl - 32);
            nextH = currentH + (seaDepth - currentH) * 0.85;
            splatMap[idx] = getTextureIndex('titan_methane_liquid');
          } else if (normalizedDist < 0.95) {
            const shoreT = (normalizedDist - 0.68) / 0.27;
            const shoreStep = Math.sin(shoreT * Math.PI) * strength * 0.24 * microScale;
            nextH = currentH - (1 - shoreT) * strength * 0.4 * microScale + shoreStep;
            splatMap[idx] = getTextureIndex('titan_methane_liquid');
          }
          break;
        }
        case 'alpine_horn_glacier': {
          // Pyramidal Glacial Horn Peak + Faceted Arête Ridges (Himalaya Everest / Alps Matterhorn / Andes)
          const angle = Math.atan2(wz - worldZ, wx - worldX);
          const arêteFacet = 0.78 + 0.22 * Math.cos(angle * 4);
          if (normalizedDist < 0.72) {
            const hornProfile = Math.pow(1 - normalizedDist / 0.72, 1.55) * arêteFacet;
            nextH = currentH + strength * 1.85 * hornProfile * microScale;
            splatMap[idx] = getTextureIndex(normalizedDist < 0.45 ? 'glacier_snow' : 'limestone_cliff');
          } else if (normalizedDist < 0.96) {
            // Glacial cirque trough at the foot of the horn
            const trough = Math.sin(((normalizedDist - 0.72) / 0.24) * Math.PI) * strength * 0.35 * microScale;
            nextH = currentH - trough;
            splatMap[idx] = getTextureIndex('glacier_snow');
          }
          break;
        }
        case 'barchan_dune_saltflat': {
          // Crescent Barchan Sand Dune Ridge (Sahara / Gobi) + Flat Salt Pan Interdune (Atacama)
          const dx = (wx - worldX) / effectiveKernelRadius;
          const dz = (wz - worldZ) / effectiveKernelRadius;
          const crescentCurve = dx + 0.45 * dz * dz;
          if (Math.abs(crescentCurve) < 0.38 && normalizedDist < 0.88) {
            const duneCrest = (1 - Math.abs(crescentCurve) / 0.38) * (1 - normalizedDist * 0.75);
            nextH = currentH + strength * 1.15 * duneCrest * microScale;
            splatMap[idx] = getTextureIndex('desert_sand');
          } else {
            nextH = currentH + (centerHeight - currentH) * 0.45 * falloff;
            splatMap[idx] = getTextureIndex('atacama_salt_crust');
          }
          break;
        }
        case 'meander_river_delta': {
          // Sinuous Meandering Amazon / Congo River Channel + Lush Rainforest Floodplain Banks
          const dzNorm = (wz - worldZ) / effectiveKernelRadius;
          const meanderCenterX = Math.sin(dzNorm * Math.PI * 1.5) * 0.32 * effectiveKernelRadius;
          const distFromChannel = Math.abs(wx - worldX - meanderCenterX) / effectiveKernelRadius;
          if (distFromChannel < 0.28) {
            const channelFactor = 1 - distFromChannel / 0.28;
            nextH = Math.min(currentH - strength * 1.15 * channelFactor * microScale, BIOMES[biomeId].waterLevel - 14);
            splatMap[idx] = getTextureIndex('river_stream');
          } else if (distFromChannel < 0.78) {
            splatMap[idx] = getTextureIndex('tropical_rainforest_floor');
          }
          break;
        }
        case 'flatten':
          nextH = currentH + (centerHeight - currentH) * Math.min(1, 0.45 * falloff);
          break;
        case 'smooth': {
          if (copyMap) {
            let sum = 0;
            let count = 0;
            for (let dz = -1; dz <= 1; dz++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = ix + dx;
                const nz = iz + dz;
                if (nx >= 0 && nx <= GRID_SIZE && nz >= 0 && nz <= GRID_SIZE) {
                  sum += copyMap[nz * VERTEX_COUNT_PER_SIDE + nx];
                  count++;
                }
              }
            }
            const avg = sum / (count || 1);
            nextH = currentH + (avg - currentH) * Math.min(1, 0.55 * falloff);
          }
          break;
        }
        case 'terrace': {
          const stepSize = 110; // 110m geological steps up to 1,000m
          const stepped = Math.round(currentH / stepSize) * stepSize;
          nextH = currentH + (stepped - currentH) * Math.min(1, 0.6 * falloff);
          break;
        }
        case 'ridge': {
          const sharp = Math.pow(1 - normalizedDist, 2.2) * microScale;
          nextH = currentH + strength * 1.35 * sharp;
          break;
        }
      }

      heightMap[idx] = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, nextH));
      modifiedCount++;
    }
  }

  if (modifiedCount > 0) {
    recomputeTerrainColors(heightMap, splatMap, colorMap, biomeId);
  }
  return modifiedCount;
}

/**
 * Paints a surface texture onto the 10x10 km (100,000,000 px virtual 1m/px) terrain at (worldX, worldZ).
 * Supports brush radius down to 1m (MIN_BRUSH_RADIUS = 1).
 * For hydrological and road brushes (river_stream, lake_water, dirt_cobble_road, volcanic_lava),
 * also sculpts the channel/basin/roadbed when carveTerrain is enabled.
 */
export function applyTextureBrush(
  heightMap: Float32Array,
  splatMap: Uint8Array,
  colorMap: Float32Array,
  biomeId: BiomeId,
  brushId: TextureBrushId,
  worldX: number,
  worldZ: number,
  radius: number,
  options?: {
    carveTerrain?: boolean;
    waterLevel?: number;
  }
): number {
  const half = WORLD_SIZE / 2;
  const safeRadius = Math.max(MIN_BRUSH_RADIUS, radius);
  const cellSpan = WORLD_SIZE / GRID_SIZE;
  const effectiveKernelRadius = Math.max(safeRadius, cellSpan * 0.72);
  const microScale = safeRadius < cellSpan ? Math.max(0.25, safeRadius / cellSpan) : 1;
  const targetIdx = getTextureIndex(brushId);
  const brushConfig = TEXTURE_BRUSHES[brushId];
  const carveTerrain = options?.carveTerrain ?? true;
  const waterLevel = options?.waterLevel ?? BIOMES[biomeId].waterLevel;
  const centerHeight = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, worldX, worldZ);
  let paintedCount = 0;

  for (let iz = 0; iz <= GRID_SIZE; iz++) {
    for (let ix = 0; ix <= GRID_SIZE; ix++) {
      const wx = (ix / GRID_SIZE) * WORLD_SIZE - half;
      const wz = (iz / GRID_SIZE) * WORLD_SIZE - half;
      const dist = Math.hypot(wx - worldX, wz - worldZ);

      if (dist <= effectiveKernelRadius) {
        const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
        splatMap[idx] = targetIdx;

        if (carveTerrain && brushConfig?.hydroOrTerrainEffect) {
          const normalizedDist = dist / effectiveKernelRadius;
          const falloff = 0.5 * (1 + Math.cos(Math.PI * normalizedDist)) * microScale;
          const currentH = heightMap[idx];

          if (brushConfig.hydroOrTerrainEffect === 'river') {
            const targetRiverBed = Math.min(currentH - 18 * falloff, waterLevel - 16);
            heightMap[idx] = Math.max(
              MIN_ELEVATION,
              currentH + (targetRiverBed - currentH) * (0.55 * falloff)
            );
          } else if (brushConfig.hydroOrTerrainEffect === 'lake') {
            const targetLakeBed = Math.min(currentH - 38 * falloff, waterLevel - 38);
            heightMap[idx] = Math.max(
              MIN_ELEVATION,
              currentH + (targetLakeBed - currentH) * (0.68 * falloff)
            );
          } else if (brushConfig.hydroOrTerrainEffect === 'road') {
            heightMap[idx] = currentH + (centerHeight - currentH) * (0.35 * falloff);
          }
        }

        paintedCount++;
      }
    }
  }

  if (paintedCount > 0) {
    recomputeTerrainColors(heightMap, splatMap, colorMap, biomeId);
  }
  return paintedCount;
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

export type RuleOperator = '>' | '<' | 'between';

export interface TerrainRule {
  id: string;
  name: string;
  enabled: boolean;
  operator: RuleOperator;
  thresholdMeters: number;
  maxThresholdMeters?: number;
  targetPrefabId: PrefabId;
  targetTextureId?: TextureBrushId | 'none';
  maxObjectsToPlace: number;
  minSpacingMeters: number;
  scale: number;
}

export interface TerrainRuleExecutionResult {
  newObjects: PlacedObject[];
  addedObjects: PlacedObject[];
  addedCount: number;
  paintedVerticesCount: number;
  sculptedVerticesCount: number;
  matchedRulesCount: number;
  summary: string;
}

export const DEFAULT_TERRAIN_RULES: TerrainRule[] = [
  {
    id: 'rule-sharp-rock-500m',
    name: 'Nếu cao độ > 500m thì tự động đặt vật thể đá nhọn',
    enabled: true,
    operator: '>',
    thresholdMeters: 500,
    targetPrefabId: 'karst_mountain',
    targetTextureId: 'limestone_cliff',
    maxObjectsToPlace: 8,
    minSpacingMeters: 14,
    scale: 1.25,
  },
  {
    id: 'rule-cliff-wall-250m',
    name: 'Nếu cao độ > 250m thì tự động đặt Vách Đá Dựng Đứng',
    enabled: false,
    operator: '>',
    thresholdMeters: 250,
    targetPrefabId: 'sheer_cliff_wall',
    targetTextureId: 'limestone_cliff',
    maxObjectsToPlace: 6,
    minSpacingMeters: 18,
    scale: 1.15,
  },
  {
    id: 'rule-sky-island-650m',
    name: 'Nếu cao độ > 650m thì tự động đặt Đảo Bay Celestia',
    enabled: false,
    operator: '>',
    thresholdMeters: 650,
    targetPrefabId: 'floating_sky_island',
    targetTextureId: 'glacier_snow',
    maxObjectsToPlace: 4,
    minSpacingMeters: 24,
    scale: 1.1,
  },
  {
    id: 'rule-abyss-chasm-neg40m',
    name: 'Nếu cao độ < -40m thì tự động đặt Vực Sâu Thâm Uyên',
    enabled: false,
    operator: '<',
    thresholdMeters: -40,
    targetPrefabId: 'abyss_chasm_vortex',
    targetTextureId: 'limestone_cliff',
    maxObjectsToPlace: 4,
    minSpacingMeters: 20,
    scale: 1.05,
  },
  {
    id: 'rule-pine-belt-20-180m',
    name: 'Nếu cao độ 20m–180m thì tự động đặt Cây Thông Ngọc Lục',
    enabled: false,
    operator: 'between',
    thresholdMeters: 20,
    maxThresholdMeters: 180,
    targetPrefabId: 'emerald_pine',
    targetTextureId: 'emerald_grass',
    maxObjectsToPlace: 8,
    minSpacingMeters: 12,
    scale: 1.0,
  },
];

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

  const allObjects: PlacedObject[] = existingObjects.map((o) => ({
    ...o,
    y: Number(getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, o.x, o.z).toFixed(2)),
  }));
  const addedObjects: PlacedObject[] = [];
  let paintedVerticesCount = 0;
  let matchedRulesCount = 0;

  const hasFocusFilter =
    typeof options?.focusAreaWorldX === 'number' &&
    typeof options?.focusAreaWorldZ === 'number' &&
    typeof options?.focusRadiusMeters === 'number';

  for (const rule of enabledRules) {
    const prefabMeta =
      PREFAB_CATALOG.find((p) => p.id === rule.targetPrefabId) || PREFAB_CATALOG[0];
    const texIdx =
      rule.targetTextureId && rule.targetTextureId !== 'none'
        ? getTextureIndex(rule.targetTextureId)
        : null;

    // Collect matching vertices for this rule
    const matchingVertices: Array<{ wx: number; wz: number; h: number; distOrigin: number }> = [];

    for (let iz = 0; iz <= GRID_SIZE; iz++) {
      for (let ix = 0; ix <= GRID_SIZE; ix++) {
        const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
        const h = heightMap[idx];
        if (!evaluateRuleElevation(h, rule)) continue;

        const wx = (ix / GRID_SIZE) * WORLD_SIZE - half;
        const wz = (iz / GRID_SIZE) * WORLD_SIZE - half;

        if (hasFocusFilter) {
          const distFocus = Math.hypot(
            wx - (options!.focusAreaWorldX as number),
            wz - (options!.focusAreaWorldZ as number)
          );
          if (distFocus > Math.max(options!.focusRadiusMeters as number, cellSpan * 1.15)) {
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
    recomputeTerrainColors(heightMap, splatMap, colorMap, biomeId);
  }

  const firstRuleText = enabledRules[0] ? formatTerrainRuleFormula(enabledRules[0]) : '';
  const summary =
    addedObjects.length > 0
      ? `Đã thực thi ${enabledRules.length} quy luật (${firstRuleText}): Tự động đặt ${addedObjects.length} vật thể 3D & tô ${paintedVerticesCount} điểm địa hình.`
      : paintedVerticesCount > 0
      ? `Đã áp dụng ${enabledRules.length} quy luật: Cập nhật ${paintedVerticesCount} điểm bề mặt địa hình.`
      : `Đã kiểm tra ${enabledRules.length} quy luật: Các đỉnh đủ điều kiện đã có đủ mật độ vật thể.`;

  return {
    newObjects: allObjects,
    addedObjects,
    addedCount: addedObjects.length,
    paintedVerticesCount,
    sculptedVerticesCount,
    matchedRulesCount,
    summary,
  };
}

