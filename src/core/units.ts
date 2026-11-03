/**
 * Core spatial & quantization conventions for AetherTerra 3D v3 (10 Billion Virtual Samples Engine).
 * - World bounds: [-5000, 5000] meters on X and Z (10 x 10 km).
 * - Level 0 sample spacing: S0 = 0.1 m (10 cm) -> 100,001 x 100,001 = 10,000,200,001 addressable samples.
 * - Levels L = 0..9: spacing(L) = 0.1 * 2^L meters (L9 = 51.2 m).
 * - Tile dimensions: 256 x 256 quantized Int16 samples per tile.
 */

export const WORLD_SIZE = 10_000;
export const HALF = WORLD_SIZE / 2;
export const S0 = 0.1; // bước mẫu mức 0 (0.1 m = 10 cm)
export const MAX_LEVEL = 9;
export const TILE = 256; // mẫu mỗi cạnh tile

export const BASE_N = 161;
export const BASE_STEP = WORLD_SIZE / (BASE_N - 1); // 62.5 m

export type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const ADDRESSABLE_SAMPLES_PER_SIDE = Math.round(WORLD_SIZE / S0) + 1; // 100,001
export const ADDRESSABLE_TOTAL_SAMPLES =
  ADDRESSABLE_SAMPLES_PER_SIDE * ADDRESSABLE_SAMPLES_PER_SIDE; // 10,000,200,001
export const ADDRESSABLE_SAMPLES_L0 = ADDRESSABLE_TOTAL_SAMPLES;

/**
 * Maximum fine-detail (Level 0, 10 cm) edited area in km² before clamping new edits to Level 1 (20 cm).
 * 0.25 km² = 250,000 m² ≈ 381.47 tiles of (25.6 m x 25.6 m) at Level 0 (~50 MB raw before compression).
 */
export const MAX_FINE_EDIT_KM2 = 0.25;
export const L0_TILE_AREA_M2 = TILE * S0 * (TILE * S0); // 655.36 m²
export const MAX_FINE_EDIT_TILES = Math.floor((MAX_FINE_EDIT_KM2 * 1_000_000) / L0_TILE_AREA_M2); // 381 tiles

export const spacing = (L: number): number => S0 * 2 ** L;
export const tileSpan = (L: number): number => TILE * spacing(L);

export function clamp(val: number, min: number, max: number): number {
  return val < min ? min : val > max ? max : val;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-9, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function snapToGrid(val: number, step: number): number {
  return Math.floor(val / step) * step;
}

export function maxTileCoordForLevel(level: number): number {
  return Math.max(0, Math.ceil(WORLD_SIZE / tileSpan(level)) - 1);
}

export function worldToTileCoord(x: number, z: number, level: number): [number, number] {
  const span = tileSpan(level);
  const maxIdx = maxTileCoordForLevel(level);
  const tx = clamp(Math.floor((x + HALF) / span), 0, maxIdx);
  const tz = clamp(Math.floor((z + HALF) / span), 0, maxIdx);
  return [tx, tz];
}

export type TileKey = number;

/**
 * Packs (L, tx, tz, kind) into a 25-bit unsigned integer TileKey:
 * ((kind === 'splat' ? 1 : 0) << 24) | ((L & 0xf) << 20) | ((tx & 0x3ff) << 10) | (tz & 0x3ff).
 * Valid for L in [0..9] and 0 <= tx, tz <= maxTileCoordForLevel(L) (< 1024).
 */
export const tileKey = (
  L: number,
  tx: number,
  tz: number,
  kind: 'edit' | 'height' | 'splat' = 'height'
): TileKey => {
  if (!Number.isInteger(L) || L < 0 || L > MAX_LEVEL) {
    throw new RangeError(`Mức LOD tile không hợp lệ: L=${L} (phải từ 0 đến ${MAX_LEVEL})`);
  }
  const maxCoord = maxTileCoordForLevel(L);
  if (
    !Number.isInteger(tx) ||
    !Number.isInteger(tz) ||
    tx < 0 ||
    tz < 0 ||
    tx > maxCoord ||
    tz > maxCoord ||
    tx > 0x3ff ||
    tz > 0x3ff
  ) {
    throw new RangeError(
      `Tọa độ tile ngoài phạm vi tại L${L}: (${tx}, ${tz}), giới hạn hợp lệ [0..${maxCoord}]`
    );
  }
  return (
    ((kind === 'splat' ? 1 : 0) << 24) |
    ((L & 0xf) << 20) |
    ((tx & 0x3ff) << 10) |
    (tz & 0x3ff)
  );
};

/**
 * Unpacks a TileKey back into its exact { level, tx, tz, kind } coordinates.
 */
export const unpackTileKey = (
  key: TileKey
): { level: Level; tx: number; tz: number; kind: 'height' | 'splat' } => ({
  level: ((key >>> 20) & 0xf) as Level,
  tx: (key >>> 10) & 0x3ff,
  tz: key & 0x3ff,
  kind: ((key >>> 24) & 0x1) === 1 ? 'splat' : 'height',
});

export interface Rect {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;
}

export function mergeRects(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b };
  return {
    minX: Math.min(a.minX, b.minX),
    minZ: Math.min(a.minZ, b.minZ),
    maxX: Math.max(a.maxX, b.maxX),
    maxZ: Math.max(a.maxZ, b.maxZ),
  };
}

export function tileKeyToWorldRect(key: TileKey): Rect {
  const { level, tx, tz } = unpackTileKey(key);
  const span = tileSpan(level);
  const minX = -HALF + tx * span;
  const minZ = -HALF + tz * span;
  return {
    minX,
    minZ,
    maxX: Math.min(HALF, minX + span),
    maxZ: Math.min(HALF, minZ + span),
  };
}

export function worldToGridIndex(coordMeters: number, level: number): number {
  const s = spacing(level);
  const clamped = Math.max(-HALF, Math.min(HALF, coordMeters));
  return Math.floor((clamped + HALF) / s);
}

export function gridIndexToWorld(index: number, level: number): number {
  return -HALF + index * spacing(level);
}

export function hashInt2D(ix: number, iz: number, seed = 1337): number {
  let h =
    Math.imul(ix | 0, 374761393) ^
    Math.imul(iz | 0, 668265263) ^
    Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

const GRAD_TABLE_X = new Float32Array([
  1.0, 0.9238795, 0.70710677, 0.38268343,
  0.0, -0.38268343, -0.70710677, -0.9238795,
  -1.0, -0.9238795, -0.70710677, -0.38268343,
  0.0, 0.38268343, 0.70710677, 0.9238795,
]);

const GRAD_TABLE_Z = new Float32Array([
  0.0, 0.38268343, 0.70710677, 0.9238795,
  1.0, 0.9238795, 0.70710677, 0.38268343,
  0.0, -0.38268343, -0.70710677, -0.9238795,
  -1.0, -0.9238795, -0.70710677, -0.38268343,
]);

export function deterministicGradientNoise2D(x: number, z: number, seed: number): number {
  const fx0 = Math.floor(x);
  const fz0 = Math.floor(z);
  const ix0 = fx0 | 0;
  const iz0 = fz0 | 0;
  const ix1 = (ix0 + 1) | 0;
  const iz1 = (iz0 + 1) | 0;

  const dx = Math.fround(x - fx0);
  const dz = Math.fround(z - fz0);

  const ux = Math.fround(dx * dx * dx * (dx * (dx * 6 - 15) + 10));
  const uz = Math.fround(dz * dz * dz * (dz * (dz * 6 - 15) + 10));

  const h00 = hashInt2D(ix0, iz0, seed) & 15;
  const h10 = hashInt2D(ix1, iz0, seed) & 15;
  const h01 = hashInt2D(ix0, iz1, seed) & 15;
  const h11 = hashInt2D(ix1, iz1, seed) & 15;

  const dx1 = Math.fround(dx - 1);
  const dz1 = Math.fround(dz - 1);

  const n00 = Math.fround(GRAD_TABLE_X[h00] * dx + GRAD_TABLE_Z[h00] * dz);
  const n10 = Math.fround(GRAD_TABLE_X[h10] * dx1 + GRAD_TABLE_Z[h10] * dz);
  const n01 = Math.fround(GRAD_TABLE_X[h01] * dx + GRAD_TABLE_Z[h01] * dz1);
  const n11 = Math.fround(GRAD_TABLE_X[h11] * dx1 + GRAD_TABLE_Z[h11] * dz1);

  const nx0 = Math.fround(n00 + ux * (n10 - n00));
  const nx1 = Math.fround(n01 + ux * (n11 - n01));
  return Math.fround((nx0 + uz * (nx1 - nx0)) * 1.4142135);
}

export function isTerrainV3DefaultEnabled(): boolean {
  try {
    const envVal = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_TERRAIN_V3;
    if (envVal === 'false' || envVal === '0') return false;
  } catch {
    // Node test environment fallback
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_TERRAIN_V3 === 'false' || process.env.VITE_TERRAIN_V3 === '0') {
      return false;
    }
  }
  return true;
}
