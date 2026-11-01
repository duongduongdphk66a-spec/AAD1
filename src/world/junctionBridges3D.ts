import * as THREE from 'three';
import {
  BIOMES,
  BiomeId,
  GRID_SIZE,
  MicroStrokeStamp,
  PlacedObject,
  TEXTURE_BRUSHES,
  WORLD_SIZE,
} from './registry';
import { getGroundHeightAt } from './sculpting';
import {
  ObjectJunctionPair,
  computeObjectJunctionPairs,
  hermiteInterpolateOrExtrapolate,
  interpolateOrExtrapolateRgb,
  polynomialSmoothMin,
  quinticSmoothstep,
} from './junctionBlending';

/**
 * Converts sRGB [0..1] component to linear color space for Three.js vertex color buffer attributes.
 */
function srgbToLinear(c: number): number {
  const clamped = Math.max(0, Math.min(1, c));
  return clamped <= 0.04045
    ? clamped / 12.92
    : Math.pow((clamped + 0.055) / 1.055, 2.4);
}

function hexToSrgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [0.42, 0.52, 0.36];
  return [
    ((num >> 16) & 255) / 255,
    ((num >> 8) & 255) / 255,
    (num & 255) / 255,
  ];
}

/**
 * Builds a 3D Seamless Volume Fusion Bridge Mesh (`mode === 'overlap_fusion'`) when 2 structures
 * overlap or touch at their junction ("khi 2 công trình đè lên nhau thì tại chỗ tiếp giáp tự động nối liền như 2 khối là 1").
 *
 * Uses:
 * - Cubic Hermite interpolation for t in [0, 1] and damped tangent extrapolation for outer aprons t in [-0.18, 0) and (1, 1.18].
 * - Polynomial Smooth Minimum (`polynomialSmoothMin`) to create a continuous organic metaball saddle arch
 *   uniting the lower volumes and foundations of both structures into 1 continuous silhouette.
 * - Quintic C2 vertex color interpolation (`interpolateOrExtrapolateRgb`) across both the axial parameter `t`
 *   and vertical/lateral parameter `v` so colors transition smoothly between structure A, structure B, and the ground.
 */
function buildOverlapFusionMesh(
  pair: ObjectJunctionPair,
  heightMap: Float32Array,
  biomeGroundRgb: readonly [number, number, number],
  sharedMaterial: THREE.MeshStandardMaterial
): THREE.Mesh {
  const { objA, objB, profileA, profileB, radiusA, radiusB, distanceMeters } = pair;
  const dx = objB.x - objA.x;
  const dz = objB.z - objA.z;
  const safeDist = Math.max(0.05, distanceMeters);
  const ux = distanceMeters > 0.05 ? dx / safeDist : Math.cos(objA.rotationY || 0);
  const uz = distanceMeters > 0.05 ? dz / safeDist : Math.sin(objA.rotationY || 0);
  const nx = -uz;
  const nz = ux;

  const hGroundA = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, objA.x, objA.z);
  const hGroundB = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, objB.x, objB.z);

  const fusionH_A = Math.max(1.4, profileA.fusionHeightMeters * Math.max(0.4, objA.scale) * 0.72);
  const fusionH_B = Math.max(1.4, profileB.fusionHeightMeters * Math.max(0.4, objB.scale) * 0.72);

  // Closer overlap -> higher unified metaball saddle bridge
  const overlapStrength = Math.max(0.25, Math.min(1.0, 1.15 - pair.overlapRatio * 0.55));

  const axialSteps = 22;
  const crossSteps = 14;
  const tMin = -0.12; // Extrapolation apron behind object A
  const tMax = 1.12; // Extrapolation apron beyond object B

  const vertexCount = (axialSteps + 1) * (crossSteps + 1);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const slopeGround = hGroundB - hGroundA;

  let vPtr = 0;
  for (let i = 0; i <= axialSteps; i++) {
    const uNorm = i / axialSteps;
    const t = tMin + uNorm * (tMax - tMin); // spans [-0.12, 1.12] for interpolation + extrapolation
    const clampedT = Math.max(0, Math.min(1, t));
    const smoothT = quinticSmoothstep(clampedT);

    // World center spine along AB (including extrapolated aprons)
    const effectiveSpan = Math.max(safeDist, (radiusA + radiusB) * 0.28);
    const spineX = objA.x + ux * (t * effectiveSpan);
    const spineZ = objA.z + uz * (t * effectiveSpan);

    // Half-width of the fused volume collar along t: stays tightly inside the overlapping footprint
    const baseWidthLerp = radiusA * (1 - smoothT) + radiusB * smoothT;
    const neckHourglass = 1.0 - 0.16 * Math.sin(clampedT * Math.PI);
    const extrapolateTaper =
      t < 0
        ? Math.cos(Math.min(1, -t / 0.12) * (Math.PI * 0.5))
        : t > 1
        ? Math.cos(Math.min(1, (t - 1) / 0.12) * (Math.PI * 0.5))
        : 1.0;
    const halfWidth = Math.max(
      0.65,
      baseWidthLerp * 0.52 * neckHourglass * Math.max(0.15, extrapolateTaper)
    );

    // Spine crest height above ground via Hermite interpolation/extrapolation + smin metaball union
    const hermiteCrestH = hermiteInterpolateOrExtrapolate(
      fusionH_A,
      fusionH_B,
      -fusionH_A * 0.28,
      fusionH_B * 0.28,
      t
    );
    const sminUnion = polynomialSmoothMin(fusionH_A, fusionH_B, 1.8).value;
    const midSaddleBoost = Math.sin(clampedT * Math.PI) * sminUnion * overlapStrength * 0.45;
    const crestHeightAboveGround =
      Math.max(0.12, hermiteCrestH * 0.72 + midSaddleBoost) * Math.max(0, extrapolateTaper);

    // Interpolated/extrapolated base & upper colors at axial parameter t
    const axialBaseRgb = interpolateOrExtrapolateRgb(profileA.baseRgb, profileB.baseRgb, t);
    const axialUpperRgb = interpolateOrExtrapolateRgb(profileA.upperRgb, profileB.upperRgb, t);

    for (let j = 0; j <= crossSteps; j++) {
      // sCross in [-1, 1]: -1 is left ground skirt, 0 is top fused ridge crest, +1 is right ground skirt
      const sCross = (j / crossSteps) * 2 - 1;
      const absCross = Math.abs(sCross);

      const wx = spineX + nx * (sCross * halfWidth);
      const wz = spineZ + nz * (sCross * halfWidth);

      const trueGroundY = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, wx, wz);
      const hermiteGroundY = hermiteInterpolateOrExtrapolate(
        hGroundA,
        hGroundB,
        slopeGround * 0.5,
        slopeGround * 0.5,
        t
      );

      // Cross-sectional dome profile: C1 smooth bell curve that touches ground at sCross = +-1
      const crossDome = Math.pow(Math.max(0, Math.cos(sCross * (Math.PI * 0.5))), 1.55);
      const groundSeatY = trueGroundY * 0.7 + hermiteGroundY * 0.3;
      const wy =
        absCross >= 0.98
          ? trueGroundY - 0.03
          : groundSeatY + crestHeightAboveGround * crossDome;

      positions[vPtr * 3] = wx;
      positions[vPtr * 3 + 1] = wy;
      positions[vPtr * 3 + 2] = wz;

      // Vertical & lateral color blend: upper crest uses axialUpperRgb/axialBaseRgb, outer skirt blends into biomeGroundRgb
      const upperMix = crossDome * 0.65;
      const groundSkirtMix = Math.pow(absCross, 2.2) * 0.58;
      const bodyR = axialBaseRgb[0] * (1 - upperMix) + axialUpperRgb[0] * upperMix;
      const bodyG = axialBaseRgb[1] * (1 - upperMix) + axialUpperRgb[1] * upperMix;
      const bodyB = axialBaseRgb[2] * (1 - upperMix) + axialUpperRgb[2] * upperMix;

      const finalR = bodyR * (1 - groundSkirtMix) + biomeGroundRgb[0] * groundSkirtMix;
      const finalG = bodyG * (1 - groundSkirtMix) + biomeGroundRgb[1] * groundSkirtMix;
      const finalB = bodyB * (1 - groundSkirtMix) + biomeGroundRgb[2] * groundSkirtMix;

      colors[vPtr * 3] = srgbToLinear(finalR);
      colors[vPtr * 3 + 1] = srgbToLinear(finalG);
      colors[vPtr * 3 + 2] = srgbToLinear(finalB);
      vPtr++;
    }
  }

  const rowStride = crossSteps + 1;
  for (let i = 0; i < axialSteps; i++) {
    for (let j = 0; j < crossSteps; j++) {
      const a = i * rowStride + j;
      const b = (i + 1) * rowStride + j;
      const c = (i + 1) * rowStride + (j + 1);
      const d = i * rowStride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, sharedMaterial);
  mesh.name = `overlap_fusion_${pair.id}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.isJunctionBridge = true;
  mesh.userData.junctionMode = 'overlap_fusion';
  mesh.userData.groundOnly = false;
  return mesh;
}

/**
 * Builds a Bottom-Ground-Only Continuum Strip (`mode === 'distant_ground_only'`) for 2 distant objects:
 * "áp dụng cả với 2 vật thể ở xa nhau nhưng chỉ tác động vào nền đất dưới cùng".
 *
 * Strictly hugs the bottom ground terrain (`y = getGroundHeightAt(...) + subtle ground crown <= 0.05m`),
 * never touching or bridging the upper bodies of distant objects. Smoothly interpolates and extrapolates
 * ground color and micro-elevation between object A's base and object B's base.
 */
function buildDistantGroundContinuumMesh(
  pair: ObjectJunctionPair,
  heightMap: Float32Array,
  biomeGroundRgb: readonly [number, number, number],
  groundStripMaterial: THREE.MeshStandardMaterial
): THREE.Mesh {
  const { objA, objB, profileA, profileB, radiusA, radiusB, distanceMeters } = pair;
  const dx = objB.x - objA.x;
  const dz = objB.z - objA.z;
  const safeDist = Math.max(0.1, distanceMeters);
  const ux = dx / safeDist;
  const uz = dz / safeDist;
  const nx = -uz;
  const nz = ux;

  const hGroundA = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, objA.x, objA.z);
  const hGroundB = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, objB.x, objB.z);
  const slopeGround = hGroundB - hGroundA;

  const brushA = TEXTURE_BRUSHES[profileA.groundTexture] || TEXTURE_BRUSHES.earth_soil;
  const brushB = TEXTURE_BRUSHES[profileB.groundTexture] || TEXTURE_BRUSHES.earth_soil;
  const groundRgbA: [number, number, number] = [
    (brushA.primaryRgb[0] * 0.55 + profileA.baseRgb[0] * 0.45),
    (brushA.primaryRgb[1] * 0.55 + profileA.baseRgb[1] * 0.45),
    (brushA.primaryRgb[2] * 0.55 + profileA.baseRgb[2] * 0.45),
  ];
  const groundRgbB: [number, number, number] = [
    (brushB.primaryRgb[0] * 0.55 + profileB.baseRgb[0] * 0.45),
    (brushB.primaryRgb[1] * 0.55 + profileB.baseRgb[1] * 0.45),
    (brushB.primaryRgb[2] * 0.55 + profileB.baseRgb[2] * 0.45),
  ];

  const axialSteps = 28;
  const crossSteps = 8;
  const tMin = -0.1; // Extrapolated ground apron behind A
  const tMax = 1.1; // Extrapolated ground apron beyond B

  const vertexCount = (axialSteps + 1) * (crossSteps + 1);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  let vPtr = 0;
  for (let i = 0; i <= axialSteps; i++) {
    const uNorm = i / axialSteps;
    const t = tMin + uNorm * (tMax - tMin);
    const clampedT = Math.max(0, Math.min(1, t));
    const smoothT = quinticSmoothstep(clampedT);

    const spineX = objA.x + ux * (t * safeDist);
    const spineZ = objA.z + uz * (t * safeDist);

    // Width flares around A and B's base footprints and forms a gentle ground corridor in between
    const endpointFlare =
      Math.exp(-Math.pow(clampedT / 0.2, 2)) * radiusA * 0.52 +
      Math.exp(-Math.pow((1 - clampedT) / 0.2, 2)) * radiusB * 0.52;
    const baseCorridorWidth = Math.min(radiusA, radiusB) * 0.36 + endpointFlare;
    const extrapolateTaper =
      t < 0
        ? Math.cos(Math.min(1, -t / 0.1) * (Math.PI * 0.5))
        : t > 1
        ? Math.cos(Math.min(1, (t - 1) / 0.1) * (Math.PI * 0.5))
        : 1.0;
    const halfWidth = Math.max(0.9, baseCorridorWidth * Math.max(0.2, extrapolateTaper));

    const axialRgb = interpolateOrExtrapolateRgb(groundRgbA, groundRgbB, t);
    const midDistanceFade = Math.sin(clampedT * Math.PI) * Math.min(0.48, distanceMeters / 160);

    for (let j = 0; j <= crossSteps; j++) {
      const sCross = (j / crossSteps) * 2 - 1;
      const absCross = Math.abs(sCross);

      const wx = spineX + nx * (sCross * halfWidth);
      const wz = spineZ + nz * (sCross * halfWidth);

      const trueGroundY = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, wx, wz);
      const hermiteGroundY = hermiteInterpolateOrExtrapolate(
        hGroundA,
        hGroundB,
        slopeGround * 0.35,
        slopeGround * 0.35,
        t
      );

      // Lateral cosine falloff strictly on the bottom ground (max 0.045m crown so it NEVER rises into objects)
      const lateralBell = 0.5 * (1 + Math.cos(sCross * Math.PI)) * Math.max(0, extrapolateTaper);
      const smoothedGroundY =
        trueGroundY + (hermiteGroundY - trueGroundY) * lateralBell * 0.28;
      const crownOffset = 0.012 + lateralBell * 0.032;

      positions[vPtr * 3] = wx;
      positions[vPtr * 3 + 1] = smoothedGroundY + crownOffset;
      positions[vPtr * 3 + 2] = wz;

      const edgeBlend = Math.min(1, Math.pow(absCross, 1.5) + midDistanceFade * (1 - smoothT * 0.2));
      const r = axialRgb[0] * (1 - edgeBlend) + biomeGroundRgb[0] * edgeBlend;
      const g = axialRgb[1] * (1 - edgeBlend) + biomeGroundRgb[1] * edgeBlend;
      const b = axialRgb[2] * (1 - edgeBlend) + biomeGroundRgb[2] * edgeBlend;

      colors[vPtr * 3] = srgbToLinear(r);
      colors[vPtr * 3 + 1] = srgbToLinear(g);
      colors[vPtr * 3 + 2] = srgbToLinear(b);
      vPtr++;
    }
  }

  const rowStride = crossSteps + 1;
  for (let i = 0; i < axialSteps; i++) {
    for (let j = 0; j < crossSteps; j++) {
      const a = i * rowStride + j;
      const b = (i + 1) * rowStride + j;
      const c = (i + 1) * rowStride + (j + 1);
      const d = i * rowStride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, groundStripMaterial);
  mesh.name = `distant_ground_${pair.id}`;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.isJunctionBridge = true;
  mesh.userData.junctionMode = 'distant_ground_only';
  mesh.userData.groundOnly = true;
  return mesh;
}

/**
 * Builds a ground-hugging color & elevation interpolation ribbon between two overlapping
 * or adjacent 3D painted terrain patches (`microStrokes`) of different brush types
 * ("khi 2 công trình hoặc địa hình đè lên nhau thì tại chỗ tiếp giáp tự động nối liền... đảm bảo chuyển màu và chuyển địa hình mượt").
 */
function buildTerrainStrokeJunctionMesh(
  strokeA: MicroStrokeStamp,
  strokeB: MicroStrokeStamp,
  heightMap: Float32Array,
  biomeGroundRgb: readonly [number, number, number],
  groundStripMaterial: THREE.MeshStandardMaterial
): THREE.Mesh | null {
  const dx = strokeB.x - strokeA.x;
  const dz = strokeB.z - strokeA.z;
  const dist = Math.hypot(dx, dz);
  const rA = Math.max(2, strokeA.radius);
  const rB = Math.max(2, strokeB.radius);
  if (dist > (rA + rB) * 1.45) return null;

  const safeDist = Math.max(0.1, dist);
  const ux = dist > 0.05 ? dx / safeDist : 1;
  const uz = dist > 0.05 ? dz / safeDist : 0;
  const nx = -uz;
  const nz = ux;

  const brushA = TEXTURE_BRUSHES[strokeA.brushId] || TEXTURE_BRUSHES.earth_soil;
  const brushB = TEXTURE_BRUSHES[strokeB.brushId] || TEXTURE_BRUSHES.earth_soil;

  const axialSteps = 14;
  const crossSteps = 6;
  const vertexCount = (axialSteps + 1) * (crossSteps + 1);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];

  const halfWidth = Math.max(1.8, Math.min(rA, rB) * 0.65);

  let vPtr = 0;
  for (let i = 0; i <= axialSteps; i++) {
    const t = -0.1 + (i / axialSteps) * 1.2;
    const axialRgb = interpolateOrExtrapolateRgb(brushA.primaryRgb, brushB.primaryRgb, t);
    const spineX = strokeA.x + ux * (t * safeDist);
    const spineZ = strokeA.z + uz * (t * safeDist);

    for (let j = 0; j <= crossSteps; j++) {
      const sCross = (j / crossSteps) * 2 - 1;
      const absCross = Math.abs(sCross);
      const wx = spineX + nx * (sCross * halfWidth);
      const wz = spineZ + nz * (sCross * halfWidth);
      const wy = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, wx, wz);

      const bell = 0.5 * (1 + Math.cos(sCross * Math.PI));
      positions[vPtr * 3] = wx;
      positions[vPtr * 3 + 1] = wy + 0.012 + bell * 0.03;
      positions[vPtr * 3 + 2] = wz;

      const edgeMix = Math.pow(absCross, 1.8) * 0.5;
      colors[vPtr * 3] = srgbToLinear(axialRgb[0] * (1 - edgeMix) + biomeGroundRgb[0] * edgeMix);
      colors[vPtr * 3 + 1] = srgbToLinear(axialRgb[1] * (1 - edgeMix) + biomeGroundRgb[1] * edgeMix);
      colors[vPtr * 3 + 2] = srgbToLinear(axialRgb[2] * (1 - edgeMix) + biomeGroundRgb[2] * edgeMix);
      vPtr++;
    }
  }

  const rowStride = crossSteps + 1;
  for (let i = 0; i < axialSteps; i++) {
    for (let j = 0; j < crossSteps; j++) {
      const a = i * rowStride + j;
      const b = (i + 1) * rowStride + j;
      const c = (i + 1) * rowStride + (j + 1);
      const d = i * rowStride + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, groundStripMaterial);
  mesh.name = `terrain_stroke_junction_${strokeA.id}_${strokeB.id}`;
  mesh.receiveShadow = true;
  mesh.userData.isJunctionBridge = true;
  mesh.userData.junctionMode = 'terrain_stroke_overlap';
  mesh.userData.groundOnly = true;
  return mesh;
}

/**
 * Builds the complete 3D Junction & Ground Continuum Group (`THREE.Group`) containing:
 * 1. Seamless 3D volume fusion bridges (`overlap_fusion`) where 2 structures overlap or touch closely.
 * 2. Bottom-ground-only geodesic interpolation/extrapolation corridors (`distant_ground_only`)
 *    between distant objects ("áp dụng cả với 2 vật thể ở xa nhau nhưng chỉ tác động vào nền đất dưới cùng").
 * 3. Smooth transition bridges where 2 painted terrain patches (`microStrokes`) overlap.
 */
export function buildJunctionContinuumGroup(
  placedObjects: PlacedObject[],
  microStrokes: MicroStrokeStamp[],
  heightMap: Float32Array,
  biomeId: BiomeId
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'junction_continuum_root';

  const biome = BIOMES[biomeId];
  const defaultBrush =
    TEXTURE_BRUSHES[biome.defaultTexture] ||
    { primaryRgb: hexToSrgbTuple(biome.hemiGroundHex) };
  const biomeGroundRgb: [number, number, number] = [
    defaultBrush.primaryRgb[0],
    defaultBrush.primaryRgb[1],
    defaultBrush.primaryRgb[2],
  ];

  const fusionVolumeMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.06,
  });

  const groundStripMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.88,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const pairs = computeObjectJunctionPairs(placedObjects, {
    maxDistantLinkMeters: 850,
    overlapMultiplier: 1.0,
  });

  let overlapCount = 0;
  let distantGroundCount = 0;

  for (const pair of pairs) {
    if (pair.mode === 'overlap_fusion') {
      group.add(buildOverlapFusionMesh(pair, heightMap, biomeGroundRgb, fusionVolumeMaterial));
      overlapCount++;
    } else {
      group.add(
        buildDistantGroundContinuumMesh(pair, heightMap, biomeGroundRgb, groundStripMaterial)
      );
      distantGroundCount++;
    }
  }

  // Also fuse overlapping/adjacent painted terrain strokes of different brush types (bounded to recent 36 strokes for speed)
  const recentStrokes = microStrokes.slice(-36);
  let terrainStrokeBridgeCount = 0;
  for (let i = 0; i < recentStrokes.length; i++) {
    for (let j = i + 1; j < recentStrokes.length; j++) {
      const sA = recentStrokes[i];
      const sB = recentStrokes[j];
      if (sA.brushId === sB.brushId) continue;
      const dist = Math.hypot(sB.x - sA.x, sB.z - sA.z);
      if (dist <= (sA.radius + sB.radius) * 1.45) {
        const bridge = buildTerrainStrokeJunctionMesh(
          sA,
          sB,
          heightMap,
          biomeGroundRgb,
          groundStripMaterial
        );
        if (bridge) {
          group.add(bridge);
          terrainStrokeBridgeCount++;
        }
      }
    }
  }

  group.userData.overlapFusionCount = overlapCount;
  group.userData.distantGroundCorridorCount = distantGroundCount;
  group.userData.terrainStrokeBridgeCount = terrainStrokeBridgeCount;
  return group;
}
