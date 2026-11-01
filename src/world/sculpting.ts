import {
  BIOMES,
  BiomeId,
  GRID_SIZE,
  MAX_ELEVATION,
  MIN_BRUSH_RADIUS,
  MIN_ELEVATION,
  SculptToolId,
  TextureBrushId,
  VERTEX_COUNT_PER_SIDE,
  WORLD_SIZE,
  getTextureIndex,
} from './registry';
import { GridDirtyRect, recomputeTerrainColors } from './brushes';

export interface SculptKernelContext {
  ix: number;
  iz: number;
  idx: number;
  wx: number;
  wz: number;
  worldX: number;
  worldZ: number;
  dist: number;
  normalizedDist: number;
  effectiveKernelRadius: number;
  falloff: number;
  microScale: number;
  strength: number;
  currentH: number;
  centerHeight: number;
  biomeId: BiomeId;
  heightMap: Float32Array;
  copyMap: Float32Array | null;
}

export interface SculptKernelResult {
  nextH: number;
  textureOverride?: TextureBrushId;
}

export type SculptKernelHandler = (ctx: SculptKernelContext) => SculptKernelResult;

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
 * Modular, table-driven kernel handlers for all 17 geological & planetary sculpting tools.
 */
export const SCULPT_TOOL_HANDLERS: Record<SculptToolId, SculptKernelHandler> = {
  raise: ({ currentH, strength, falloff }) => ({
    nextH: currentH + strength * 0.85 * falloff,
  }),

  lower: ({ currentH, strength, falloff }) => ({
    nextH: currentH - strength * 0.85 * falloff,
  }),

  sheer_cliff: ({ currentH, centerHeight, strength, microScale, normalizedDist }) => {
    const targetPlateauH = Math.min(MAX_ELEVATION, centerHeight + strength * 1.45 * microScale);
    if (normalizedDist <= 0.72) {
      return { nextH: currentH + (targetPlateauH - currentH) * 0.82 };
    }
    if (normalizedDist <= 0.96) {
      const wallT = 1 - (normalizedDist - 0.72) / 0.24;
      const steepFactor = Math.pow(Math.max(0, wallT), 0.35);
      return {
        nextH: currentH + (targetPlateauH - currentH) * steepFactor * 0.75,
        textureOverride: 'limestone_cliff',
      };
    }
    return { nextH: currentH };
  },

  volcano_crater: ({ currentH, strength, microScale, normalizedDist }) => {
    if (normalizedDist < 0.36) {
      const craterDepth = (1 - normalizedDist / 0.36) * strength * 0.95 * microScale;
      return {
        nextH: currentH + strength * 0.65 * microScale - craterDepth,
        textureOverride: 'volcanic_lava',
      };
    }
    const coneProfile = Math.pow(1 - (normalizedDist - 0.36) / 0.64, 1.35);
    return {
      nextH: currentH + strength * 1.55 * coneProfile * microScale,
      textureOverride: normalizedDist < 0.52 ? 'volcanic_lava' : 'limestone_cliff',
    };
  },

  abyss_chasm: ({ currentH, strength, microScale, normalizedDist }) => {
    const targetAbyssDepth = Math.max(MIN_ELEVATION, currentH - strength * 1.85 * microScale);
    if (normalizedDist < 0.68) {
      return {
        nextH: targetAbyssDepth,
        textureOverride: 'limestone_cliff',
      };
    }
    if (normalizedDist < 0.94) {
      const rimBoost = Math.sin(((normalizedDist - 0.68) / 0.26) * Math.PI) * strength * 0.35 * microScale;
      return {
        nextH: currentH + rimBoost,
        textureOverride: 'limestone_cliff',
      };
    }
    return { nextH: currentH };
  },

  canyon_gorge: ({ currentH, wx, wz, worldX, worldZ, effectiveKernelRadius, strength, microScale }) => {
    const crossAxisDist = Math.abs(wx - worldX) / effectiveKernelRadius;
    const alongAxisFactor = Math.max(0, 1 - Math.pow(Math.abs(wz - worldZ) / effectiveKernelRadius, 2));
    if (crossAxisDist < 0.38) {
      return {
        nextH: currentH - strength * 1.45 * alongAxisFactor * microScale,
        textureOverride: 'river_stream',
      };
    }
    if (crossAxisDist < 0.82) {
      return {
        nextH: currentH + strength * 0.85 * alongAxisFactor * microScale,
        textureOverride: 'limestone_cliff',
      };
    }
    return { nextH: currentH };
  },

  meteor_crater: ({ currentH, strength, microScale, normalizedDist }) => {
    if (normalizedDist < 0.2) {
      const rebound = (1 - normalizedDist / 0.2) * strength * 0.45 * microScale;
      return {
        nextH: currentH - strength * 0.85 * microScale + rebound,
        textureOverride: 'mars_regolith',
      };
    }
    if (normalizedDist < 0.72) {
      const bowlProfile = Math.sin(((normalizedDist - 0.2) / 0.52) * Math.PI);
      return {
        nextH: currentH - strength * 1.25 * bowlProfile * microScale,
        textureOverride: 'mars_regolith',
      };
    }
    if (normalizedDist < 0.96) {
      const rimProfile = Math.sin(((normalizedDist - 0.72) / 0.24) * Math.PI);
      return {
        nextH: currentH + strength * 0.62 * rimProfile * microScale,
        textureOverride: 'limestone_cliff',
      };
    }
    return { nextH: currentH };
  },

  shield_mesa: ({ currentH, strength, microScale, normalizedDist }) => {
    if (normalizedDist < 0.25) {
      const shallowCaldera = (1 - normalizedDist / 0.25) * strength * 0.32 * microScale;
      return {
        nextH: currentH + strength * 1.15 * microScale - shallowCaldera,
        textureOverride: 'venus_sulfur',
      };
    }
    if (normalizedDist < 0.88) {
      const domeProfile = Math.pow(1 - (normalizedDist - 0.25) / 0.63, 0.65);
      return {
        nextH: currentH + strength * 1.2 * domeProfile * microScale,
        textureOverride: 'mars_regolith',
      };
    }
    return { nextH: currentH };
  },

  cryo_volcano: ({ currentH, strength, microScale, normalizedDist }) => {
    if (normalizedDist < 0.34) {
      const cryoCalderaDepth = (1 - normalizedDist / 0.34) * strength * 1.15 * microScale;
      return {
        nextH: currentH + strength * 0.55 * microScale - cryoCalderaDepth,
        textureOverride: 'pluto_nitrogen_ice',
      };
    }
    if (normalizedDist < 0.94) {
      const flankT = (normalizedDist - 0.34) / 0.6;
      const hummock = Math.cos(flankT * Math.PI * 3) * 0.08;
      const domeProfile = Math.pow(1 - flankT, 1.15) + hummock * (1 - flankT);
      return {
        nextH: currentH + strength * 1.48 * Math.max(0, domeProfile) * microScale,
        textureOverride: normalizedDist < 0.68 ? 'pluto_nitrogen_ice' : 'glacier_snow',
      };
    }
    return { nextH: currentH };
  },

  methane_basin: ({ currentH, strength, microScale, normalizedDist, biomeId }) => {
    const waterLvl = BIOMES[biomeId].waterLevel;
    if (normalizedDist < 0.68) {
      const seaDepth = Math.min(currentH - strength * 1.45 * microScale, waterLvl - 32);
      return {
        nextH: currentH + (seaDepth - currentH) * 0.85,
        textureOverride: 'titan_methane_liquid',
      };
    }
    if (normalizedDist < 0.95) {
      const shoreT = (normalizedDist - 0.68) / 0.27;
      const shoreStep = Math.sin(shoreT * Math.PI) * strength * 0.24 * microScale;
      return {
        nextH: currentH - (1 - shoreT) * strength * 0.4 * microScale + shoreStep,
        textureOverride: 'titan_methane_liquid',
      };
    }
    return { nextH: currentH };
  },

  alpine_horn_glacier: ({ currentH, wx, wz, worldX, worldZ, strength, microScale, normalizedDist }) => {
    const angle = Math.atan2(wz - worldZ, wx - worldX);
    const areteFacet = 0.78 + 0.22 * Math.cos(angle * 4);
    if (normalizedDist < 0.72) {
      const hornProfile = Math.pow(1 - normalizedDist / 0.72, 1.55) * areteFacet;
      return {
        nextH: currentH + strength * 1.85 * hornProfile * microScale,
        textureOverride: normalizedDist < 0.45 ? 'glacier_snow' : 'limestone_cliff',
      };
    }
    if (normalizedDist < 0.96) {
      const trough = Math.sin(((normalizedDist - 0.72) / 0.24) * Math.PI) * strength * 0.35 * microScale;
      return {
        nextH: currentH - trough,
        textureOverride: 'glacier_snow',
      };
    }
    return { nextH: currentH };
  },

  barchan_dune_saltflat: ({
    currentH,
    centerHeight,
    wx,
    wz,
    worldX,
    worldZ,
    effectiveKernelRadius,
    strength,
    microScale,
    normalizedDist,
    falloff,
  }) => {
    const dx = (wx - worldX) / effectiveKernelRadius;
    const dz = (wz - worldZ) / effectiveKernelRadius;
    const crescentCurve = dx + 0.45 * dz * dz;
    if (Math.abs(crescentCurve) < 0.38 && normalizedDist < 0.88) {
      const duneCrest = (1 - Math.abs(crescentCurve) / 0.38) * (1 - normalizedDist * 0.75);
      return {
        nextH: currentH + strength * 1.15 * duneCrest * microScale,
        textureOverride: 'desert_sand',
      };
    }
    return {
      nextH: currentH + (centerHeight - currentH) * 0.45 * falloff,
      textureOverride: 'atacama_salt_crust',
    };
  },

  meander_river_delta: ({
    currentH,
    wx,
    wz,
    worldX,
    worldZ,
    effectiveKernelRadius,
    strength,
    microScale,
    biomeId,
  }) => {
    const dzNorm = (wz - worldZ) / effectiveKernelRadius;
    const meanderCenterX = Math.sin(dzNorm * Math.PI * 1.5) * 0.32 * effectiveKernelRadius;
    const distFromChannel = Math.abs(wx - worldX - meanderCenterX) / effectiveKernelRadius;
    if (distFromChannel < 0.28) {
      const channelFactor = 1 - distFromChannel / 0.28;
      return {
        nextH: Math.min(currentH - strength * 1.15 * channelFactor * microScale, BIOMES[biomeId].waterLevel - 14),
        textureOverride: 'river_stream',
      };
    }
    if (distFromChannel < 0.78) {
      return {
        nextH: currentH,
        textureOverride: 'tropical_rainforest_floor',
      };
    }
    return { nextH: currentH };
  },

  flatten: ({ currentH, centerHeight, falloff }) => ({
    nextH: currentH + (centerHeight - currentH) * Math.min(1, 0.45 * falloff),
  }),

  smooth: ({ currentH, ix, iz, falloff, copyMap }) => {
    if (!copyMap) return { nextH: currentH };
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
    return {
      nextH: currentH + (avg - currentH) * Math.min(1, 0.55 * falloff),
    };
  },

  terrace: ({ currentH, falloff }) => {
    const stepSize = 110; // 110m geological steps up to 1,000m
    const stepped = Math.round(currentH / stepSize) * stepSize;
    return {
      nextH: currentH + (stepped - currentH) * Math.min(1, 0.6 * falloff),
    };
  },

  ridge: ({ currentH, strength, normalizedDist, microScale }) => {
    const sharp = Math.pow(1 - normalizedDist, 2.2) * microScale;
    return {
      nextH: currentH + strength * 1.35 * sharp,
    };
  },
};

/**
 * Applies a terrain sculpting tool at world coordinates (worldX, worldZ) on the 10x10 km continent.
 * Uses a tight dirty-rect bounding box so small brushes only inspect, re-color, and recompute
 * surface normals (`computePartialVertexNormals`) on the touched grid cells instead of all 25,921 vertices.
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
  strength: number,
  outBounds?: GridDirtyRect,
  normalMap?: Float32Array
): number {
  const half = WORLD_SIZE / 2;
  const safeRadius = Math.max(MIN_BRUSH_RADIUS, radius);
  const cellSpan = WORLD_SIZE / GRID_SIZE;
  const effectiveKernelRadius = Math.max(safeRadius, cellSpan * 0.72);
  const microScale = safeRadius < cellSpan ? Math.max(0.25, safeRadius / cellSpan) : 1;
  const centerHeight = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, worldX, worldZ);
  let modifiedCount = 0;

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

  const copyMap = tool === 'smooth' ? new Float32Array(heightMap) : null;
  const kernelHandler = SCULPT_TOOL_HANDLERS[tool] ?? SCULPT_TOOL_HANDLERS.raise;

  for (let iz = minIz; iz <= maxIz; iz++) {
    for (let ix = minIx; ix <= maxIx; ix++) {
      const wx = (ix / GRID_SIZE) * WORLD_SIZE - half;
      const wz = (iz / GRID_SIZE) * WORLD_SIZE - half;
      const dist = Math.hypot(wx - worldX, wz - worldZ);

      if (dist > effectiveKernelRadius) continue;

      const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
      const normalizedDist = dist / effectiveKernelRadius;
      const falloff = 0.5 * (1 + Math.cos(Math.PI * normalizedDist)) * microScale;
      const currentH = heightMap[idx];

      const { nextH, textureOverride } = kernelHandler({
        ix,
        iz,
        idx,
        wx,
        wz,
        worldX,
        worldZ,
        dist,
        normalizedDist,
        effectiveKernelRadius,
        falloff,
        microScale,
        strength,
        currentH,
        centerHeight,
        biomeId,
        heightMap,
        copyMap,
      });

      if (textureOverride) {
        splatMap[idx] = getTextureIndex(textureOverride);
      }

      heightMap[idx] = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, nextH));
      if (ix < touchedMinIx) touchedMinIx = ix;
      if (ix > touchedMaxIx) touchedMaxIx = ix;
      if (iz < touchedMinIz) touchedMinIz = iz;
      if (iz > touchedMaxIz) touchedMaxIz = iz;
      modifiedCount++;
    }
  }

  if (modifiedCount > 0) {
    const dirtyRect: GridDirtyRect = {
      minIx: touchedMinIx,
      maxIx: touchedMaxIx,
      minIz: touchedMinIz,
      maxIz: touchedMaxIz,
    };
    recomputeTerrainColors(heightMap, splatMap, colorMap, biomeId, dirtyRect);
    if (normalMap) {
      computePartialVertexNormals(heightMap, normalMap, dirtyRect);
    }
    if (outBounds) {
      outBounds.minIx = dirtyRect.minIx;
      outBounds.maxIx = dirtyRect.maxIx;
      outBounds.minIz = dirtyRect.minIz;
      outBounds.maxIz = dirtyRect.maxIz;
    }
  }
  return modifiedCount;
}

/**
 * Merges two GridDirtyRect regions into their bounding union so multiple brush strokes
 * within a single frame accumulate cleanly without losing dirty vertices.
 */
export function mergeDirtyRect(
  existing: GridDirtyRect | null | undefined,
  next: GridDirtyRect
): GridDirtyRect {
  if (!existing) {
    return {
      minIx: next.minIx,
      maxIx: next.maxIx,
      minIz: next.minIz,
      maxIz: next.maxIz,
    };
  }
  return {
    minIx: Math.min(existing.minIx, next.minIx),
    maxIx: Math.max(existing.maxIx, next.maxIx),
    minIz: Math.min(existing.minIz, next.minIz),
    maxIz: Math.max(existing.maxIz, next.maxIz),
  };
}

/**
 * Recomputes vertex normals only for the vertices inside `dirtyRect` (expanded by 1 grid cell
 * so neighbor slopes remain seamless) instead of iterating through all 25,921 vertices.
 * Returns the padded GridDirtyRect that was updated and the number of vertices processed.
 */
export function computePartialVertexNormals(
  heightMap: Float32Array,
  normalArray: Float32Array,
  dirtyRect?: GridDirtyRect | null
): { paddedRect: GridDirtyRect; updatedVertexCount: number } {
  const stride = VERTEX_COUNT_PER_SIDE;
  const cellSpan = WORLD_SIZE / GRID_SIZE;

  const nMinIx = dirtyRect ? Math.max(0, dirtyRect.minIx - 1) : 0;
  const nMaxIx = dirtyRect ? Math.min(GRID_SIZE, dirtyRect.maxIx + 1) : GRID_SIZE;
  const nMinIz = dirtyRect ? Math.max(0, dirtyRect.minIz - 1) : 0;
  const nMaxIz = dirtyRect ? Math.min(GRID_SIZE, dirtyRect.maxIz + 1) : GRID_SIZE;

  let updatedVertexCount = 0;

  for (let iz = nMinIz; iz <= nMaxIz; iz++) {
    const rowOffset = iz * stride;
    const zPrev = Math.max(0, iz - 1) * stride;
    const zNext = Math.min(GRID_SIZE, iz + 1) * stride;
    const dzSpan = (iz > 0 && iz < GRID_SIZE ? 2 : 1) * cellSpan;

    for (let ix = nMinIx; ix <= nMaxIx; ix++) {
      const i = rowOffset + ix;
      const xPrev = Math.max(0, ix - 1);
      const xNext = Math.min(GRID_SIZE, ix + 1);
      const dxSpan = (ix > 0 && ix < GRID_SIZE ? 2 : 1) * cellSpan;

      const hL = heightMap[rowOffset + xPrev] ?? 0;
      const hR = heightMap[rowOffset + xNext] ?? 0;
      const hU = heightMap[zPrev + ix] ?? 0;
      const hD = heightMap[zNext + ix] ?? 0;

      const nx = (hL - hR) / dxSpan;
      const ny = 1.0;
      const nz = (hU - hD) / dzSpan;
      const invLen = 1.0 / Math.hypot(nx, ny, nz);

      const nIdx = i * 3;
      normalArray[nIdx] = nx * invLen;
      normalArray[nIdx + 1] = ny * invLen;
      normalArray[nIdx + 2] = nz * invLen;
      updatedVertexCount++;
    }
  }

  return {
    paddedRect: {
      minIx: nMinIx,
      maxIx: nMaxIx,
      minIz: nMinIz,
      maxIz: nMaxIz,
    },
    updatedVertexCount,
  };
}

