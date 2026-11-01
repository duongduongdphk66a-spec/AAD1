import {
  BIOMES,
  BiomeId,
  GRID_SIZE,
  MAX_ELEVATION,
  MIN_ELEVATION,
  MicroStrokeStamp,
  PlacedObject,
  PrefabId,
  TEXTURE_BRUSHES,
  TextureBrushId,
  VERTEX_COUNT_PER_SIDE,
  WORLD_SIZE,
  getTextureIndex,
} from './registry';
import { GridDirtyRect, recomputeTerrainColors } from './brushes';
import { getGroundHeightAt } from './sculpting';

export interface PrefabJunctionProfile {
  prefabId: PrefabId;
  baseRadiusMeters: number;
  fusionHeightMeters: number;
  groundTexture: TextureBrushId;
  baseRgb: [number, number, number];
  upperRgb: [number, number, number];
}

export type JunctionBlendMode = 'overlap_fusion' | 'distant_ground_only';

export interface ObjectJunctionPair {
  id: string;
  objA: PlacedObject;
  objB: PlacedObject;
  profileA: PrefabJunctionProfile;
  profileB: PrefabJunctionProfile;
  radiusA: number;
  radiusB: number;
  distanceMeters: number;
  overlapRatio: number; // <= 1 means footprints physically overlap/touch; > 1 means separated/distant
  mode: JunctionBlendMode;
  groundOnly: boolean;
}

export interface JunctionBlendResult {
  overlapFusionCount: number;
  distantGroundCorridorCount: number;
  terrainSeamSmoothedCount: number;
  modifiedVerticesCount: number;
  blendedColorVerticesCount: number;
  updatedObjects: PlacedObject[];
  pairs: ObjectJunctionPair[];
  dirtyRect: GridDirtyRect | null;
  summary: string;
}

/**
 * True 1:1 visual footprint radii (`baseRadiusMeters`), fusion collar heights (`fusionHeightMeters`),
 * associated ground textures, and RGB palettes for all 31 3D prefabs.
 * Calibrated to match the exact 3D mesh footprints in `ProceduralPrefabFactory` so:
 * - Only genuinely intersecting/touching structures trigger 3D volume fusion (`overlap_fusion`).
 * - Separated/distant objects trigger bottom-ground-only interpolation/extrapolation (`distant_ground_only`).
 */
export const PREFAB_JUNCTION_PROFILES: Record<PrefabId, PrefabJunctionProfile> = {
  pluto_cryo_volcano: {
    prefabId: 'pluto_cryo_volcano',
    baseRadiusMeters: 6.8,
    fusionHeightMeters: 3.4,
    groundTexture: 'pluto_nitrogen_ice',
    baseRgb: [0.48, 0.78, 0.92],
    upperRgb: [0.76, 0.92, 0.98],
  },
  europa_penitentes_spire: {
    prefabId: 'europa_penitentes_spire',
    baseRadiusMeters: 6.5,
    fusionHeightMeters: 3.2,
    groundTexture: 'pluto_nitrogen_ice',
    baseRgb: [0.38, 0.72, 0.91],
    upperRgb: [0.72, 0.93, 0.99],
  },
  himalaya_matterhorn_peak: {
    prefabId: 'himalaya_matterhorn_peak',
    baseRadiusMeters: 7.2,
    fusionHeightMeters: 3.8,
    groundTexture: 'glacier_snow',
    baseRgb: [0.52, 0.58, 0.66],
    upperRgb: [0.92, 0.96, 0.99],
  },
  himalaya_fishtail_peak: {
    prefabId: 'himalaya_fishtail_peak',
    baseRadiusMeters: 7.4,
    fusionHeightMeters: 3.8,
    groundTexture: 'glacier_snow',
    baseRgb: [0.48, 0.55, 0.64],
    upperRgb: [0.94, 0.97, 1.0],
  },
  mars_olympus_shield: {
    prefabId: 'mars_olympus_shield',
    baseRadiusMeters: 7.8,
    fusionHeightMeters: 3.6,
    groundTexture: 'mars_regolith',
    baseRgb: [0.76, 0.34, 0.16],
    upperRgb: [0.88, 0.46, 0.22],
  },
  titan_mithrim_montes: {
    prefabId: 'titan_mithrim_montes',
    baseRadiusMeters: 7.2,
    fusionHeightMeters: 3.5,
    groundTexture: 'titan_methane_liquid',
    baseRgb: [0.68, 0.48, 0.18],
    upperRgb: [0.85, 0.64, 0.24],
  },
  island_volcano_icon: {
    prefabId: 'island_volcano_icon',
    baseRadiusMeters: 6.8,
    fusionHeightMeters: 3.4,
    groundTexture: 'volcanic_lava',
    baseRgb: [0.82, 0.58, 0.34],
    upperRgb: [0.94, 0.38, 0.12],
  },
  sahara_atacama_oasis: {
    prefabId: 'sahara_atacama_oasis',
    baseRadiusMeters: 6.0,
    fusionHeightMeters: 2.4,
    groundTexture: 'atacama_salt_crust',
    baseRgb: [0.86, 0.72, 0.46],
    upperRgb: [0.76, 0.54, 0.32],
  },
  hawaii_kilauea_shield: {
    prefabId: 'hawaii_kilauea_shield',
    baseRadiusMeters: 7.0,
    fusionHeightMeters: 3.2,
    groundTexture: 'volcanic_lava',
    baseRgb: [0.28, 0.24, 0.22],
    upperRgb: [0.95, 0.36, 0.08],
  },
  amazon_congo_canopy_tree: {
    prefabId: 'amazon_congo_canopy_tree',
    baseRadiusMeters: 4.5,
    fusionHeightMeters: 2.2,
    groundTexture: 'tropical_rainforest_floor',
    baseRgb: [0.22, 0.46, 0.24],
    upperRgb: [0.16, 0.62, 0.32],
  },
  taiga_spruce_grove: {
    prefabId: 'taiga_spruce_grove',
    baseRadiusMeters: 4.8,
    fusionHeightMeters: 2.3,
    groundTexture: 'taiga_moss_needles',
    baseRgb: [0.24, 0.42, 0.32],
    upperRgb: [0.78, 0.88, 0.94],
  },
  titan_methane_geyser: {
    prefabId: 'titan_methane_geyser',
    baseRadiusMeters: 5.5,
    fusionHeightMeters: 2.6,
    groundTexture: 'titan_methane_liquid',
    baseRgb: [0.72, 0.52, 0.16],
    upperRgb: [0.92, 0.72, 0.28],
  },
  venus_pancake_dome: {
    prefabId: 'venus_pancake_dome',
    baseRadiusMeters: 6.5,
    fusionHeightMeters: 2.8,
    groundTexture: 'venus_sulfur',
    baseRgb: [0.78, 0.66, 0.18],
    upperRgb: [0.92, 0.82, 0.26],
  },
  meteor_impact_crater: {
    prefabId: 'meteor_impact_crater',
    baseRadiusMeters: 6.8,
    fusionHeightMeters: 2.5,
    groundTexture: 'exoplanet_basalt',
    baseRgb: [0.28, 0.26, 0.34],
    upperRgb: [0.56, 0.38, 0.78],
  },
  exoplanet_crystal_spire: {
    prefabId: 'exoplanet_crystal_spire',
    baseRadiusMeters: 4.8,
    fusionHeightMeters: 2.8,
    groundTexture: 'exoplanet_basalt',
    baseRgb: [0.26, 0.32, 0.48],
    upperRgb: [0.38, 0.82, 0.96],
  },
  floating_sky_island: {
    prefabId: 'floating_sky_island',
    baseRadiusMeters: 5.0,
    fusionHeightMeters: 2.4,
    groundTexture: 'glacier_snow',
    baseRgb: [0.64, 0.76, 0.88],
    upperRgb: [0.86, 0.94, 0.99],
  },
  sheer_cliff_wall: {
    prefabId: 'sheer_cliff_wall',
    baseRadiusMeters: 6.2,
    fusionHeightMeters: 3.6,
    groundTexture: 'limestone_cliff',
    baseRgb: [0.54, 0.52, 0.48],
    upperRgb: [0.68, 0.65, 0.6],
  },
  active_volcano: {
    prefabId: 'active_volcano',
    baseRadiusMeters: 6.8,
    fusionHeightMeters: 3.5,
    groundTexture: 'volcanic_lava',
    baseRgb: [0.36, 0.22, 0.18],
    upperRgb: [0.96, 0.36, 0.08],
  },
  abyss_chasm_vortex: {
    prefabId: 'abyss_chasm_vortex',
    baseRadiusMeters: 5.8,
    fusionHeightMeters: 2.2,
    groundTexture: 'limestone_cliff',
    baseRgb: [0.28, 0.22, 0.38],
    upperRgb: [0.58, 0.32, 0.86],
  },
  statue_of_seven: {
    prefabId: 'statue_of_seven',
    baseRadiusMeters: 3.6,
    fusionHeightMeters: 2.2,
    groundTexture: 'dirt_cobble_road',
    baseRgb: [0.78, 0.76, 0.72],
    upperRgb: [0.52, 0.88, 0.96],
  },
  pokemon_gym_stadium: {
    prefabId: 'pokemon_gym_stadium',
    baseRadiusMeters: 6.8,
    fusionHeightMeters: 2.9,
    groundTexture: 'dirt_cobble_road',
    baseRgb: [0.76, 0.78, 0.82],
    upperRgb: [0.92, 0.36, 0.28],
  },
  berry_apricorn_tree: {
    prefabId: 'berry_apricorn_tree',
    baseRadiusMeters: 3.4,
    fusionHeightMeters: 1.8,
    groundTexture: 'emerald_grass',
    baseRgb: [0.34, 0.64, 0.28],
    upperRgb: [0.46, 0.78, 0.34],
  },
  windmill_cottage: {
    prefabId: 'windmill_cottage',
    baseRadiusMeters: 4.8,
    fusionHeightMeters: 2.6,
    groundTexture: 'dirt_cobble_road',
    baseRgb: [0.76, 0.68, 0.56],
    upperRgb: [0.88, 0.78, 0.64],
  },
  sakura_shrine: {
    prefabId: 'sakura_shrine',
    baseRadiusMeters: 5.2,
    fusionHeightMeters: 2.7,
    groundTexture: 'flower_meadow',
    baseRgb: [0.82, 0.46, 0.58],
    upperRgb: [0.92, 0.32, 0.38],
  },
  pokemon_center: {
    prefabId: 'pokemon_center',
    baseRadiusMeters: 5.2,
    fusionHeightMeters: 2.7,
    groundTexture: 'dirt_cobble_road',
    baseRgb: [0.84, 0.84, 0.88],
    upperRgb: [0.94, 0.34, 0.32],
  },
  karst_mountain: {
    prefabId: 'karst_mountain',
    baseRadiusMeters: 5.8,
    fusionHeightMeters: 3.4,
    groundTexture: 'limestone_cliff',
    baseRgb: [0.58, 0.54, 0.46],
    upperRgb: [0.74, 0.68, 0.56],
  },
  volcanic_peak: {
    prefabId: 'volcanic_peak',
    baseRadiusMeters: 6.4,
    fusionHeightMeters: 3.4,
    groundTexture: 'volcanic_lava',
    baseRgb: [0.38, 0.26, 0.22],
    upperRgb: [0.88, 0.34, 0.12],
  },
  sakura_tree: {
    prefabId: 'sakura_tree',
    baseRadiusMeters: 3.8,
    fusionHeightMeters: 1.9,
    groundTexture: 'flower_meadow',
    baseRgb: [0.78, 0.48, 0.62],
    upperRgb: [0.96, 0.68, 0.82],
  },
  emerald_pine: {
    prefabId: 'emerald_pine',
    baseRadiusMeters: 3.6,
    fusionHeightMeters: 1.9,
    groundTexture: 'emerald_grass',
    baseRgb: [0.24, 0.56, 0.32],
    upperRgb: [0.18, 0.68, 0.38],
  },
  aether_crystal: {
    prefabId: 'aether_crystal',
    baseRadiusMeters: 3.2,
    fusionHeightMeters: 2.0,
    groundTexture: 'limestone_cliff',
    baseRgb: [0.42, 0.68, 0.88],
    upperRgb: [0.38, 0.88, 0.98],
  },
  ancient_bridge: {
    prefabId: 'ancient_bridge',
    baseRadiusMeters: 4.6,
    fusionHeightMeters: 2.2,
    groundTexture: 'dirt_cobble_road',
    baseRgb: [0.68, 0.64, 0.58],
    upperRgb: [0.78, 0.74, 0.68],
  },
};

export function getPrefabJunctionProfile(prefabId: PrefabId): PrefabJunctionProfile {
  return (
    PREFAB_JUNCTION_PROFILES[prefabId] || {
      prefabId,
      baseRadiusMeters: 4.8,
      fusionHeightMeters: 2.5,
      groundTexture: 'earth_soil',
      baseRgb: [0.62, 0.56, 0.48],
      upperRgb: [0.74, 0.68, 0.58],
    }
  );
}

/**
 * C2-continuous quintic smoothstep on [0, 1]: 6t^5 - 15t^4 + 10t^3.
 * Guarantees zero 1st and 2nd derivatives at both endpoints for silky color & terrain transitions.
 */
export function quinticSmoothstep(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u * u * (u * (u * 6 - 15) + 10);
}

/**
 * Polynomial Smooth Minimum (smin) and Smooth Maximum (smax) for metaball-like
 * SDF volume & elevation fusion at object/terrain junctions.
 */
export function polynomialSmoothMin(
  a: number,
  b: number,
  k = 2.5
): { value: number; blendFactor: number } {
  const safeK = Math.max(1e-4, k);
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / safeK));
  const value = b * (1 - h) + a * h - safeK * h * (1 - h);
  return { value, blendFactor: 1 - h };
}

export function polynomialSmoothMax(
  a: number,
  b: number,
  k = 2.5
): { value: number; blendFactor: number } {
  const minRes = polynomialSmoothMin(-a, -b, k);
  return { value: -minRes.value, blendFactor: minRes.blendFactor };
}

/**
 * Unified Cubic Hermite Interpolation (for t in [0, 1]) and Damped Tangent Extrapolation
 * (for t < 0 or t > 1).
 *
 * - Interpolation (0 <= t <= 1):
 *   H(t) = (2t^3 - 3t^2 + 1)*h0 + (t^3 - 2t^2 + t)*m0 + (-2t^3 + 3t^2)*h1 + (t^3 - t^2)*m1
 * - Extrapolation (t < 0 or t > 1):
 *   Extends smoothly along the boundary tangent slope m0 or m1 with Gaussian damping exp(-2.2 * u^2)
 *   so the outer apron around each structure grades seamlessly into surrounding terrain without diverging.
 */
export function hermiteInterpolateOrExtrapolate(
  h0: number,
  h1: number,
  m0: number,
  m1: number,
  t: number
): number {
  if (t >= 0 && t <= 1) {
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * h0 + h10 * m0 + h01 * h1 + h11 * m1;
  }
  if (t < 0) {
    const u = -t;
    const damp = Math.exp(-2.2 * u * u);
    return h0 - m0 * u * damp;
  }
  const u = t - 1;
  const damp = Math.exp(-2.2 * u * u);
  return h1 + m1 * u * damp;
}

/**
 * Smoothly interpolates or extrapolates RGB colors in [0, 1]^3 using quintic C2 blending
 * inside [0, 1] and subtle chromatic tangent continuation on the outer aprons.
 */
export function interpolateOrExtrapolateRgb(
  rgbA: readonly [number, number, number],
  rgbB: readonly [number, number, number],
  t: number
): [number, number, number] {
  if (t >= 0 && t <= 1) {
    const s = quinticSmoothstep(t);
    return [
      Math.max(0.03, Math.min(1, rgbA[0] * (1 - s) + rgbB[0] * s)),
      Math.max(0.03, Math.min(1, rgbA[1] * (1 - s) + rgbB[1] * s)),
      Math.max(0.03, Math.min(1, rgbA[2] * (1 - s) + rgbB[2] * s)),
    ];
  }
  const u = t < 0 ? -t : t - 1;
  const extrapolateWeight = u * Math.exp(-3.0 * u * u) * 0.18;
  const base = t < 0 ? rgbA : rgbB;
  const other = t < 0 ? rgbB : rgbA;
  return [
    Math.max(0.03, Math.min(1, base[0] + (base[0] - other[0]) * extrapolateWeight)),
    Math.max(0.03, Math.min(1, base[1] + (base[1] - other[1]) * extrapolateWeight)),
    Math.max(0.03, Math.min(1, base[2] + (base[2] - other[2]) * extrapolateWeight)),
  ];
}

/**
 * Identifies object pairs for:
 * 1. `overlap_fusion`: When 2 structures genuinely overlap or touch at their base (d <= overlapMultiplier * (rA + rB), default 1.0).
 *    They are fused into a single continuous volume at their junction AND their ground is interpolated/extrapolated.
 * 2. `distant_ground_only`: When 2 objects are separated/distant (d > overlapMultiplier * (rA + rB) up to `maxDistantLinkMeters`).
 *    Uses a Gabriel / Relative-Neighborhood + k-Nearest-Neighbor proximity graph so distant objects
 *    are connected by smooth ground-only interpolation/extrapolation corridors ("chỉ tác động vào nền đất dưới cùng").
 */
export function computeObjectJunctionPairs(
  placedObjects: PlacedObject[],
  options?: {
    maxDistantLinkMeters?: number;
    overlapMultiplier?: number;
    focusObjectId?: string | null;
  }
): ObjectJunctionPair[] {
  const n = placedObjects.length;
  if (n < 2) return [];

  const maxDistantLinkMeters = options?.maxDistantLinkMeters ?? 850;
  const overlapMultiplier = options?.overlapMultiplier ?? 1.0;
  const focusObjectId = options?.focusObjectId ?? null;

  const profiles = placedObjects.map((o) => getPrefabJunctionProfile(o.prefabId));
  const radii = placedObjects.map((o, i) =>
    Math.max(2.0, profiles[i].baseRadiusMeters * Math.max(0.35, o.scale))
  );

  const pairMap = new Map<string, ObjectJunctionPair>();

  const addPair = (i: number, j: number) => {
    const aIdx = Math.min(i, j);
    const bIdx = Math.max(i, j);
    const key = `${aIdx}:${bIdx}`;
    if (pairMap.has(key)) return;

    const objA = placedObjects[aIdx];
    const objB = placedObjects[bIdx];
    const profileA = profiles[aIdx];
    const profileB = profiles[bIdx];
    const radiusA = radii[aIdx];
    const radiusB = radii[bIdx];
    const dist = Math.hypot(objB.x - objA.x, objB.z - objA.z);
    const combinedRadius = radiusA + radiusB;
    const overlapThreshold = combinedRadius * overlapMultiplier;
    const isOverlap = dist <= overlapThreshold;

    if (!isOverlap && dist > maxDistantLinkMeters) return;

    pairMap.set(key, {
      id: `junction-${objA.id}-${objB.id}`,
      objA,
      objB,
      profileA,
      profileB,
      radiusA,
      radiusB,
      distanceMeters: Number(dist.toFixed(2)),
      overlapRatio: Number((dist / Math.max(0.1, combinedRadius)).toFixed(3)),
      mode: isOverlap ? 'overlap_fusion' : 'distant_ground_only',
      groundOnly: !isOverlap,
    });
  };

  // 1. Always include ALL genuinely overlapping / touching pairs (d <= overlapMultiplier * (rA + rB))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = Math.hypot(
        placedObjects[j].x - placedObjects[i].x,
        placedObjects[j].z - placedObjects[i].z
      );
      if (dist <= (radii[i] + radii[j]) * overlapMultiplier) {
        addPair(i, j);
      }
    }
  }

  // 2. For separated/distant objects, connect nearest neighbors & Relative-Neighborhood planar edges
  for (let i = 0; i < n; i++) {
    const candidates: Array<{ idx: number; dist: number }> = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const dist = Math.hypot(
        placedObjects[j].x - placedObjects[i].x,
        placedObjects[j].z - placedObjects[i].z
      );
      if (dist <= maxDistantLinkMeters) {
        candidates.push({ idx: j, dist });
      }
    }
    candidates.sort((a, b) => a.dist - b.dist);

    const kLimit =
      focusObjectId && placedObjects[i].id === focusObjectId ? 3 : 2;
    for (let c = 0; c < Math.min(kLimit, candidates.length); c++) {
      addPair(i, candidates[c].idx);
    }

    // Relative Neighborhood check for natural planar corridors between distant landmarks
    for (let c = 0; c < Math.min(4, candidates.length); c++) {
      const j = candidates[c].idx;
      const dAB = candidates[c].dist;
      let blocked = false;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        const dAC = Math.hypot(
          placedObjects[k].x - placedObjects[i].x,
          placedObjects[k].z - placedObjects[i].z
        );
        const dBC = Math.hypot(
          placedObjects[k].x - placedObjects[j].x,
          placedObjects[k].z - placedObjects[j].z
        );
        if (Math.max(dAC, dBC) < dAB * 0.85) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        addPair(i, j);
      }
    }
  }

  return Array.from(pairMap.values());
}

/**
 * Evaluates the ground directional slope along unit vector (ux, uz) at world position (x, z).
 */
function sampleDirectionalSlope(
  heightMap: Float32Array,
  x: number,
  z: number,
  ux: number,
  uz: number,
  stepMeters = 32
): number {
  const hPlus = getGroundHeightAt(
    heightMap,
    GRID_SIZE,
    WORLD_SIZE,
    x + ux * stepMeters,
    z + uz * stepMeters
  );
  const hMinus = getGroundHeightAt(
    heightMap,
    GRID_SIZE,
    WORLD_SIZE,
    x - ux * stepMeters,
    z - uz * stepMeters
  );
  return (hPlus - hMinus) / (2 * stepMeters);
}

/**
 * Performs automatic and manual interpolation & extrapolation at junctions:
 * 1. When 2 structures overlap or touch (`overlap_fusion`):
 *    - Fuses the terrain foundation underneath and between them as 1 unified mound using
 *      Cubic Hermite interpolation + smooth-max (`polynomialSmoothMax`) + outer apron extrapolation.
 *    - Smoothly blends vertex colors (`colorMap`) and textures (`splatMap`) across the junction.
 * 2. When 2 objects are far apart (`distant_ground_only`):
 *    - Strictly modifies ONLY the bottom ground (`heightMap` and `colorMap` along the ground corridor)
 *      using Cubic Hermite interpolation for t in [0, 1] and damped tangent extrapolation at the ends,
 *      leaving upper structures untouched ("áp dụng cả với 2 vật thể ở xa nhau nhưng chỉ tác động vào nền đất dưới cùng").
 * 3. When 2 terrain regions or painted strokes overlap/meet:
 *    - Smooths elevation and vertex color transitions across texture/stroke boundaries so there are
 *      no jagged color or height seams.
 */
export function blendObjectsAndTerrainJunctions(
  heightMap: Float32Array,
  splatMap: Uint8Array,
  colorMap: Float32Array,
  biomeId: BiomeId,
  placedObjects: PlacedObject[],
  options?: {
    microStrokes?: MicroStrokeStamp[];
    focusObjectId?: string | null;
    maxDistantLinkMeters?: number;
    smoothTerrainSeams?: boolean;
    outBounds?: GridDirtyRect;
  }
): JunctionBlendResult {
  const half = WORLD_SIZE / 2;
  const cellSpan = WORLD_SIZE / GRID_SIZE;
  const pairs = computeObjectJunctionPairs(placedObjects, {
    maxDistantLinkMeters: options?.maxDistantLinkMeters ?? 850,
    focusObjectId: options?.focusObjectId ?? null,
  });

  const activePairs = options?.focusObjectId
    ? pairs.filter(
        (p) =>
          p.objA.id === options.focusObjectId ||
          p.objB.id === options.focusObjectId ||
          p.mode === 'overlap_fusion'
      )
    : pairs;

  let touchedMinIx = GRID_SIZE;
  let touchedMaxIx = 0;
  let touchedMinIz = GRID_SIZE;
  let touchedMaxIz = 0;
  let modifiedVerticesCount = 0;
  let blendedColorVerticesCount = 0;
  let overlapFusionCount = 0;
  let distantGroundCorridorCount = 0;

  const markTouched = (ix: number, iz: number) => {
    if (ix < touchedMinIx) touchedMinIx = ix;
    if (ix > touchedMaxIx) touchedMaxIx = ix;
    if (iz < touchedMinIz) touchedMinIz = iz;
    if (iz > touchedMaxIz) touchedMaxIz = iz;
  };

  const baseHeightSnapshot = new Float32Array(heightMap);

  for (const pair of activePairs) {
    if (pair.mode === 'overlap_fusion') {
      overlapFusionCount++;
    } else {
      distantGroundCorridorCount++;
    }

    const { objA, objB, profileA, profileB, radiusA, radiusB, distanceMeters } = pair;
    const dx = objB.x - objA.x;
    const dz = objB.z - objA.z;
    const safeDist = Math.max(0.001, distanceMeters);
    const ux = distanceMeters > 0.05 ? dx / safeDist : Math.cos(objA.rotationY || 0);
    const uz = distanceMeters > 0.05 ? dz / safeDist : Math.sin(objA.rotationY || 0);

    const hA = getGroundHeightAt(baseHeightSnapshot, GRID_SIZE, WORLD_SIZE, objA.x, objA.z);
    const hB = getGroundHeightAt(baseHeightSnapshot, GRID_SIZE, WORLD_SIZE, objB.x, objB.z);

    const rawSlopeA = sampleDirectionalSlope(baseHeightSnapshot, objA.x, objA.z, ux, uz);
    const rawSlopeB = sampleDirectionalSlope(baseHeightSnapshot, objB.x, objB.z, ux, uz);
    const clampedSpan = Math.min(safeDist, 240);
    const mA = Math.max(-65, Math.min(65, rawSlopeA * clampedSpan * 0.5));
    const mB = Math.max(-65, Math.min(65, rawSlopeB * clampedSpan * 0.5));

    const maxRadius = Math.max(radiusA, radiusB);
    const corridorHalfWidth =
      pair.mode === 'overlap_fusion'
        ? Math.max(maxRadius * 2.1, cellSpan * 1.35)
        : Math.max(maxRadius * 1.55, cellSpan * 1.15);

    const extrapolateMarginMeters = Math.max(maxRadius * 1.6, cellSpan * 1.1);

    const minWx = Math.min(objA.x, objB.x) - corridorHalfWidth - extrapolateMarginMeters;
    const maxWx = Math.max(objA.x, objB.x) + corridorHalfWidth + extrapolateMarginMeters;
    const minWz = Math.min(objA.z, objB.z) - corridorHalfWidth - extrapolateMarginMeters;
    const maxWz = Math.max(objA.z, objB.z) + corridorHalfWidth + extrapolateMarginMeters;

    const minIx = Math.max(0, Math.floor(((minWx + half) / WORLD_SIZE) * GRID_SIZE));
    const maxIx = Math.min(GRID_SIZE, Math.ceil(((maxWx + half) / WORLD_SIZE) * GRID_SIZE));
    const minIz = Math.max(0, Math.floor(((minWz + half) / WORLD_SIZE) * GRID_SIZE));
    const maxIz = Math.min(GRID_SIZE, Math.ceil(((maxWz + half) / WORLD_SIZE) * GRID_SIZE));

    const brushA = TEXTURE_BRUSHES[profileA.groundTexture] || TEXTURE_BRUSHES.earth_soil;
    const brushB = TEXTURE_BRUSHES[profileB.groundTexture] || TEXTURE_BRUSHES.earth_soil;
    const groundRgbA: [number, number, number] = [
      (brushA.primaryRgb[0] + profileA.baseRgb[0]) * 0.5,
      (brushA.primaryRgb[1] + profileA.baseRgb[1]) * 0.5,
      (brushA.primaryRgb[2] + profileA.baseRgb[2]) * 0.5,
    ];
    const groundRgbB: [number, number, number] = [
      (brushB.primaryRgb[0] + profileB.baseRgb[0]) * 0.5,
      (brushB.primaryRgb[1] + profileB.baseRgb[1]) * 0.5,
      (brushB.primaryRgb[2] + profileB.baseRgb[2]) * 0.5,
    ];

    for (let iz = minIz; iz <= maxIz; iz++) {
      const wz = (iz / GRID_SIZE) * WORLD_SIZE - half;
      for (let ix = minIx; ix <= maxIx; ix++) {
        const wx = (ix / GRID_SIZE) * WORLD_SIZE - half;
        const relX = wx - objA.x;
        const relZ = wz - objA.z;

        const alongMeters = relX * ux + relZ * uz;
        const effectiveSpan = Math.max(safeDist, cellSpan * 0.5);
        const t = alongMeters / effectiveSpan;

        if (t < -0.45 || t > 1.45) continue;

        const clampedAlong = Math.max(0, Math.min(safeDist, alongMeters));
        const closestX = objA.x + ux * clampedAlong;
        const closestZ = objA.z + uz * clampedAlong;
        const perpDist = Math.hypot(wx - closestX, wz - closestZ);

        if (perpDist > corridorHalfWidth) continue;

        const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
        const currentH = heightMap[idx];

        const normPerp = perpDist / corridorHalfWidth;
        const lateralFalloff = 0.5 * (1 + Math.cos(Math.PI * normPerp));
        const axialFalloff =
          t < 0
            ? Math.exp(-3.5 * t * t)
            : t > 1
            ? Math.exp(-3.5 * (t - 1) * (t - 1))
            : 1.0;
        const weight = lateralFalloff * axialFalloff;

        if (weight <= 0.01) continue;

        const targetGroundH = hermiteInterpolateOrExtrapolate(hA, hB, mA, mB, t);

        if (pair.mode === 'overlap_fusion') {
          const junctionArch =
            Math.sin(Math.max(0, Math.min(1, t)) * Math.PI) *
            Math.min(profileA.fusionHeightMeters, profileB.fusionHeightMeters) *
            0.35;
          const fusedRes = polynomialSmoothMax(
            currentH,
            targetGroundH + junctionArch * lateralFalloff,
            2.0
          );
          const blendStrength = Math.min(0.85, weight * 0.78);
          heightMap[idx] = Math.max(
            MIN_ELEVATION,
            Math.min(MAX_ELEVATION, currentH + (fusedRes.value - currentH) * blendStrength)
          );
        } else {
          // Distant objects: ONLY affect the bottom ground foundation ("chỉ tác động vào nền đất dưới cùng")
          const groundBlendStrength = Math.min(0.65, weight * 0.55);
          heightMap[idx] = Math.max(
            MIN_ELEVATION,
            Math.min(MAX_ELEVATION, currentH + (targetGroundH - currentH) * groundBlendStrength)
          );
        }

        if (lateralFalloff > 0.62 && t >= -0.15 && t <= 1.15) {
          const chosenTex = t < 0.5 ? profileA.groundTexture : profileB.groundTexture;
          splatMap[idx] = getTextureIndex(chosenTex);
        }

        const targetRgb = interpolateOrExtrapolateRgb(groundRgbA, groundRgbB, t);
        const colorWeight = Math.min(0.82, weight * (pair.mode === 'overlap_fusion' ? 0.82 : 0.68));
        const cIdx = idx * 3;
        colorMap[cIdx] = Math.max(
          0.04,
          Math.min(1, colorMap[cIdx] * (1 - colorWeight) + targetRgb[0] * colorWeight)
        );
        colorMap[cIdx + 1] = Math.max(
          0.04,
          Math.min(1, colorMap[cIdx + 1] * (1 - colorWeight) + targetRgb[1] * colorWeight)
        );
        colorMap[cIdx + 2] = Math.max(
          0.04,
          Math.min(1, colorMap[cIdx + 2] * (1 - colorWeight) + targetRgb[2] * colorWeight)
        );

        markTouched(ix, iz);
        modifiedVerticesCount++;
        blendedColorVerticesCount++;
      }
    }
  }

  let terrainSeamSmoothedCount = 0;
  const shouldSmoothTerrainSeams = options?.smoothTerrainSeams ?? true;
  if (shouldSmoothTerrainSeams) {
    const seamResult = smoothOverlappingTerrainSeams(
      heightMap,
      splatMap,
      colorMap,
      biomeId,
      touchedMinIx <= touchedMaxIx
        ? {
            minIx: Math.max(0, touchedMinIx - 2),
            maxIx: Math.min(GRID_SIZE, touchedMaxIx + 2),
            minIz: Math.max(0, touchedMinIz - 2),
            maxIz: Math.min(GRID_SIZE, touchedMaxIz + 2),
          }
        : undefined
    );
    terrainSeamSmoothedCount = seamResult.smoothedVerticesCount;
    if (seamResult.dirtyRect) {
      markTouched(seamResult.dirtyRect.minIx, seamResult.dirtyRect.minIz);
      markTouched(seamResult.dirtyRect.maxIx, seamResult.dirtyRect.maxIz);
    }
    blendedColorVerticesCount += seamResult.smoothedVerticesCount;
  }

  const updatedObjects = placedObjects.map((obj) => {
    const nextY = Number(
      getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, obj.x, obj.z).toFixed(2)
    );
    return nextY === obj.y ? obj : { ...obj, y: nextY };
  });

  const dirtyRect: GridDirtyRect | null =
    touchedMinIx <= touchedMaxIx
      ? {
          minIx: touchedMinIx,
          maxIx: touchedMaxIx,
          minIz: touchedMinIz,
          maxIz: touchedMaxIz,
        }
      : null;

  if (dirtyRect && options?.outBounds) {
    options.outBounds.minIx = dirtyRect.minIx;
    options.outBounds.maxIx = dirtyRect.maxIx;
    options.outBounds.minIz = dirtyRect.minIz;
    options.outBounds.maxIz = dirtyRect.maxIz;
  }

  const summary =
    overlapFusionCount > 0 || distantGroundCorridorCount > 0
      ? `Đã nối liền ${overlapFusionCount} cặp công trình giao nhau & nội/ngoại suy nền đất dưới cùng cho ${distantGroundCorridorCount} cặp vật thể ở xa (${modifiedVerticesCount} đỉnh địa hình mượt).`
      : `Đã làm mượt tiếp giáp địa hình & chuyển màu nội/ngoại suy (${terrainSeamSmoothedCount} đỉnh).`;

  return {
    overlapFusionCount,
    distantGroundCorridorCount,
    terrainSeamSmoothedCount,
    modifiedVerticesCount,
    blendedColorVerticesCount,
    updatedObjects,
    pairs,
    dirtyRect,
    summary,
  };
}

/**
 * Detects boundaries where two different painted terrain textures (`splatMap`) or overlapping
 * terrain strokes meet, and applies bilateral Hermite height & vertex-color interpolation
 * across the junction so terrain transitions and colors are silky-smooth.
 */
export function smoothOverlappingTerrainSeams(
  heightMap: Float32Array,
  splatMap: Uint8Array,
  colorMap: Float32Array,
  biomeId: BiomeId,
  bounds?: GridDirtyRect
): { smoothedVerticesCount: number; dirtyRect: GridDirtyRect | null } {
  const minIx = bounds ? Math.max(1, bounds.minIx) : 1;
  const maxIx = bounds ? Math.min(GRID_SIZE - 1, bounds.maxIx) : GRID_SIZE - 1;
  const minIz = bounds ? Math.max(1, bounds.minIz) : 1;
  const maxIz = bounds ? Math.min(GRID_SIZE - 1, bounds.maxIz) : GRID_SIZE - 1;

  if (!bounds) {
    recomputeTerrainColors(heightMap, splatMap, colorMap, biomeId);
  }

  const heightSnapshot = new Float32Array(heightMap);
  const colorSnapshot = new Float32Array(colorMap);

  let touchedMinIx = GRID_SIZE;
  let touchedMaxIx = 0;
  let touchedMinIz = GRID_SIZE;
  let touchedMaxIz = 0;
  let smoothedVerticesCount = 0;

  for (let iz = minIz; iz <= maxIz; iz++) {
    for (let ix = minIx; ix <= maxIx; ix++) {
      const idx = iz * VERTEX_COUNT_PER_SIDE + ix;
      const centerSplat = splatMap[idx];
      const centerH = heightSnapshot[idx];

      let hasDifferentNeighborSplat = false;
      let weightedH = centerH * 2.2;
      let weightSum = 2.2;
      let weightedR = colorSnapshot[idx * 3] * 1.8;
      let weightedG = colorSnapshot[idx * 3 + 1] * 1.8;
      let weightedB = colorSnapshot[idx * 3 + 2] * 1.8;
      let colorWeightSum = 1.8;

      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dz === 0) continue;
          const nIdx = (iz + dz) * VERTEX_COUNT_PER_SIDE + (ix + dx);
          const nSplat = splatMap[nIdx];
          const nH = heightSnapshot[nIdx];
          if (nSplat !== centerSplat) {
            hasDifferentNeighborSplat = true;
          }
          const spatialW = dx === 0 || dz === 0 ? 1.0 : 0.7071;
          const heightDiff = Math.abs(nH - centerH);
          const rangeW = Math.exp(-(heightDiff * heightDiff) / (2 * 140 * 140));
          const w = spatialW * rangeW;

          weightedH += nH * w;
          weightSum += w;

          weightedR += colorSnapshot[nIdx * 3] * spatialW;
          weightedG += colorSnapshot[nIdx * 3 + 1] * spatialW;
          weightedB += colorSnapshot[nIdx * 3 + 2] * spatialW;
          colorWeightSum += spatialW;
        }
      }

      if (hasDifferentNeighborSplat) {
        const avgH = weightedH / weightSum;
        heightMap[idx] = centerH + (avgH - centerH) * 0.42;

        colorMap[idx * 3] = Math.max(0.04, Math.min(1, weightedR / colorWeightSum));
        colorMap[idx * 3 + 1] = Math.max(0.04, Math.min(1, weightedG / colorWeightSum));
        colorMap[idx * 3 + 2] = Math.max(0.04, Math.min(1, weightedB / colorWeightSum));

        if (ix < touchedMinIx) touchedMinIx = ix;
        if (ix > touchedMaxIx) touchedMaxIx = ix;
        if (iz < touchedMinIz) touchedMinIz = iz;
        if (iz > touchedMaxIz) touchedMaxIz = iz;
        smoothedVerticesCount++;
      }
    }
  }

  return {
    smoothedVerticesCount,
    dirtyRect:
      touchedMinIx <= touchedMaxIx
        ? {
            minIx: touchedMinIx,
            maxIx: touchedMaxIx,
            minIz: touchedMinIz,
            maxIz: touchedMaxIz,
          }
        : null,
  };
}
