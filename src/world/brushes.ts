import {
  BIOMES,
  BiomeId,
  BRUSH_SCALE_PAGES,
  BrushScalePage,
  GRID_SIZE,
  MAX_ELEVATION,
  MIN_BRUSH_RADIUS,
  MIN_ELEVATION,
  TEXTURE_BRUSHES,
  TEXTURE_INDEX_MAP,
  TextureBrushId,
  VERTEX_COUNT_PER_SIDE,
  WORLD_SIZE,
  getBrushPageIndexForRadius,
  getTextureIndex,
} from './registry';
import {
  applySculptBrush,
  fbm2D,
  getGroundHeightAt,
  getTerrainElevationStats,
  hash2D,
  valueNoise2D,
} from './sculpting';

export {
  BRUSH_SCALE_PAGES,
  TEXTURE_BRUSHES,
  TEXTURE_INDEX_MAP,
  applySculptBrush,
  fbm2D,
  getBrushPageIndexForRadius,
  getGroundHeightAt,
  getTerrainElevationStats,
  getTextureIndex,
  hash2D,
  valueNoise2D,
};
export type { BrushScalePage };

/**
 * Dirty-rect bounding box on the terrain grid for localized brush updates.
 */
export interface GridDirtyRect {
  minIx: number;
  maxIx: number;
  minIz: number;
  maxIz: number;
}

/**
 * Recomputes per-vertex sRGB colors based on splatMap and elevation (up to 1,000m / 1km).
 * Preserves user-painted textures (grass, flowers, desert sand, volcanic lava, rivers, lakes, roads, etc.).
 */
export function recomputeTerrainColors(
  heightMap: Float32Array,
  splatMap: Uint8Array,
  colorMap: Float32Array,
  biomeId: BiomeId,
  bounds?: GridDirtyRect
): void {
  const biome = BIOMES[biomeId];
  const minIz = bounds ? Math.max(0, bounds.minIz) : 0;
  const maxIz = bounds ? Math.min(GRID_SIZE, bounds.maxIz) : GRID_SIZE;
  const minIx = bounds ? Math.max(0, bounds.minIx) : 0;
  const maxIx = bounds ? Math.min(GRID_SIZE, bounds.maxIx) : GRID_SIZE;

  for (let iz = minIz; iz <= maxIz; iz++) {
    for (let ix = minIx; ix <= maxIx; ix++) {
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
 * Paints a surface texture onto the 10x10 km terrain at (worldX, worldZ) using a dirty-rect bounding box.
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
    outBounds?: GridDirtyRect;
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

  const minIx = Math.max(
    0,
    Math.floor(((worldX - effectiveKernelRadius + half) / WORLD_SIZE) * GRID_SIZE)
  );
  const maxIx = Math.min(
    GRID_SIZE,
    Math.ceil(((worldX + effectiveKernelRadius + half) / WORLD_SIZE) * GRID_SIZE)
  );
  const minIz = Math.max(
    0,
    Math.floor(((worldZ - effectiveKernelRadius + half) / WORLD_SIZE) * GRID_SIZE)
  );
  const maxIz = Math.min(
    GRID_SIZE,
    Math.ceil(((worldZ + effectiveKernelRadius + half) / WORLD_SIZE) * GRID_SIZE)
  );

  let touchedMinIx = GRID_SIZE;
  let touchedMaxIx = 0;
  let touchedMinIz = GRID_SIZE;
  let touchedMaxIz = 0;

  for (let iz = minIz; iz <= maxIz; iz++) {
    for (let ix = minIx; ix <= maxIx; ix++) {
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

        if (ix < touchedMinIx) touchedMinIx = ix;
        if (ix > touchedMaxIx) touchedMaxIx = ix;
        if (iz < touchedMinIz) touchedMinIz = iz;
        if (iz > touchedMaxIz) touchedMaxIz = iz;
        paintedCount++;
      }
    }
  }

  if (paintedCount > 0) {
    const dirtyRect: GridDirtyRect = {
      minIx: touchedMinIx,
      maxIx: touchedMaxIx,
      minIz: touchedMinIz,
      maxIz: touchedMaxIz,
    };
    recomputeTerrainColors(heightMap, splatMap, colorMap, biomeId, dirtyRect);
    if (options?.outBounds) {
      options.outBounds.minIx = dirtyRect.minIx;
      options.outBounds.maxIx = dirtyRect.maxIx;
      options.outBounds.minIz = dirtyRect.minIz;
      options.outBounds.maxIz = dirtyRect.maxIz;
    }
  }
  return paintedCount;
}

