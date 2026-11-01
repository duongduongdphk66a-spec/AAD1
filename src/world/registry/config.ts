import type {
  BrushScalePage,
  FlowerSpeciesConfig,
  FlowerColorOption,
  MicroStrokeStamp,
  TerrainRule,
  DayNightPreset,
} from './types';

// 10x10 km Open-World Continent Scale (10,000m x 10,000m = 100 km², 1,000m = 1 km max height)
// 160x160 grid cells (161x161 vertices = 25,921 vertices, 62.5m per cell) + 1:1 3D Surface Ecosystem Patches
export const CELL_SPAN_METERS = 62.5; // 10,000m / 160 cells = 62.5m per grid cell
export const MIN_BRUSH_RADIUS = 1; // 1m minimum brush radius
export const MAX_BRUSH_RADIUS = 2500; // 2,500m maximum brush radius


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


export const FLOWER_COLOR_PALETTE: FlowerColorOption[] = [
  { id: 'pink_sakura', name: 'Hồng Anh Đào', hex: '#f472b6' },
  { id: 'gold_sun', name: 'Vàng Ánh Dương', hex: '#facc15' },
  { id: 'purple_electro', name: 'Tím Lôi Thần', hex: '#c084fc' },
  { id: 'blue_glaze', name: 'Xanh Lưu Ly', hex: '#38bdf8' },
  { id: 'red_crimson', name: 'Đỏ Hồng Ngọc', hex: '#fb7185' },
  { id: 'white_cecilia', name: 'Trắng Tinh Khiết', hex: '#ffffff' },
];


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


export const DAY_NIGHT_PRESETS: DayNightPreset[] = [
  {
    id: 'dawn_golden',
    label: 'Bình Minh Rực Rỡ (06:15)',
    shortLabel: 'Bình Minh 06:15',
    timeOfDayHours: 6.25,
    sunElevationDeg: 12,
    sunAzimuthDeg: 82,
    starlightMode: false,
  },
  {
    id: 'noon_zenith',
    label: 'Trưa Nắng Đỉnh Trời (12:00)',
    shortLabel: 'Trưa 12:00',
    timeOfDayHours: 12.0,
    sunElevationDeg: 76,
    sunAzimuthDeg: 145,
    starlightMode: false,
  },
  {
    id: 'dusk_twilight',
    label: 'Hoàng Hôn Đỏ Thẫm (17:45)',
    shortLabel: 'Hoàng Hôn 17:45',
    timeOfDayHours: 17.75,
    sunElevationDeg: 9,
    sunAzimuthDeg: 262,
    starlightMode: false,
  },
  {
    id: 'midnight_starlight',
    label: 'Đêm Ánh Sao Ngân Hà (23:00)',
    shortLabel: 'Đêm Sao 23:00',
    timeOfDayHours: 23.0,
    sunElevationDeg: -52,
    sunAzimuthDeg: 320,
    starlightMode: true,
  },
];

