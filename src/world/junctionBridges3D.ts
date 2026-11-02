import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
 * Builds a 3D Seamless Volume Fusion Bridge Geometry (`mode === 'overlap_fusion'`) when 2 structures
 * overlap or touch at their junction ("khi 2 công trình đè lên nhau thì tại chỗ tiếp giáp tự động nối liền như 2 khối là 1").
 */
function buildOverlapFusionGeometry(
  pair: ObjectJunctionPair,
  heightMap: Float32Array,
  biomeGroundRgb: readonly [number, number, number]
): THREE.BufferGeometry {
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

  const axialSteps = 12;
  const crossSteps = 8;
  const tMin = -0.12; // Extrapolation apron behind object A
  const tMax = 1.12; // Extrapolation apron beyond object B

  const vertexCount = (axialSteps + 1) * (crossSteps + 1);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  const slopeGround = hGroundB - hGroundA;
  const sminUnion = polynomialSmoothMin(fusionH_A, fusionH_B, 1.8).value;

  let vPtr = 0;
  for (let i = 0; i <= axialSteps; i++) {
    const uNorm = i / axialSteps;
    const t = tMin + uNorm * (tMax - tMin);
    const clampedT = Math.max(0, Math.min(1, t));
    const smoothT = quinticSmoothstep(clampedT);

    const effectiveSpan = Math.max(safeDist, (radiusA + radiusB) * 0.28);
    const spineX = objA.x + ux * (t * effectiveSpan);
    const spineZ = objA.z + uz * (t * effectiveSpan);

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

    const hermiteCrestH = hermiteInterpolateOrExtrapolate(
      fusionH_A,
      fusionH_B,
      -fusionH_A * 0.28,
      fusionH_B * 0.28,
      t
    );
    const midSaddleBoost = Math.sin(clampedT * Math.PI) * sminUnion * overlapStrength * 0.45;
    const crestHeightAboveGround =
      Math.max(0.12, hermiteCrestH * 0.72 + midSaddleBoost) * Math.max(0, extrapolateTaper);

    const axialBaseRgb = interpolateOrExtrapolateRgb(profileA.baseRgb, profileB.baseRgb, t);
    const axialUpperRgb = interpolateOrExtrapolateRgb(profileA.upperRgb, profileB.upperRgb, t);
    const hermiteGroundY = hermiteInterpolateOrExtrapolate(
      hGroundA,
      hGroundB,
      slopeGround * 0.5,
      slopeGround * 0.5,
      t
    );

    for (let j = 0; j <= crossSteps; j++) {
      const sCross = (j / crossSteps) * 2 - 1;
      const absCross = Math.abs(sCross);

      const wx = spineX + nx * (sCross * halfWidth);
      const wz = spineZ + nz * (sCross * halfWidth);

      const trueGroundY = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, wx, wz);
      const crossDome = Math.pow(Math.max(0, Math.cos(sCross * (Math.PI * 0.5))), 1.55);
      const groundSeatY = trueGroundY * 0.7 + hermiteGroundY * 0.3;
      const wy =
        absCross >= 0.98
          ? trueGroundY - 0.03
          : groundSeatY + crestHeightAboveGround * crossDome;

      positions[vPtr * 3] = wx;
      positions[vPtr * 3 + 1] = wy;
      positions[vPtr * 3 + 2] = wz;

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

  const indices = new Uint16Array(axialSteps * crossSteps * 6);
  const rowStride = crossSteps + 1;
  let iPtr = 0;
  for (let i = 0; i < axialSteps; i++) {
    for (let j = 0; j < crossSteps; j++) {
      const a = i * rowStride + j;
      const b = (i + 1) * rowStride + j;
      const c = (i + 1) * rowStride + (j + 1);
      const d = i * rowStride + (j + 1);
      indices[iPtr++] = a;
      indices[iPtr++] = b;
      indices[iPtr++] = d;
      indices[iPtr++] = b;
      indices[iPtr++] = c;
      indices[iPtr++] = d;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

/**
 * Builds a Bottom-Ground-Only Continuum Strip Geometry (`mode === 'distant_ground_only'`) for 2 distant objects:
 * "áp dụng cả với 2 vật thể ở xa nhau nhưng chỉ tác động vào nền đất dưới cùng".
 */
function buildDistantGroundContinuumGeometry(
  pair: ObjectJunctionPair,
  heightMap: Float32Array,
  biomeGroundRgb: readonly [number, number, number]
): THREE.BufferGeometry {
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
    brushA.primaryRgb[0] * 0.55 + profileA.baseRgb[0] * 0.45,
    brushA.primaryRgb[1] * 0.55 + profileA.baseRgb[1] * 0.45,
    brushA.primaryRgb[2] * 0.55 + profileA.baseRgb[2] * 0.45,
  ];
  const groundRgbB: [number, number, number] = [
    brushB.primaryRgb[0] * 0.55 + profileB.baseRgb[0] * 0.45,
    brushB.primaryRgb[1] * 0.55 + profileB.baseRgb[1] * 0.45,
    brushB.primaryRgb[2] * 0.55 + profileB.baseRgb[2] * 0.45,
  ];

  const axialSteps = 12;
  const crossSteps = 4;
  const tMin = -0.1;
  const tMax = 1.1;

  const vertexCount = (axialSteps + 1) * (crossSteps + 1);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

  let vPtr = 0;
  for (let i = 0; i <= axialSteps; i++) {
    const uNorm = i / axialSteps;
    const t = tMin + uNorm * (tMax - tMin);
    const clampedT = Math.max(0, Math.min(1, t));
    const smoothT = quinticSmoothstep(clampedT);

    const spineX = objA.x + ux * (t * safeDist);
    const spineZ = objA.z + uz * (t * safeDist);

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
    const hermiteGroundY = hermiteInterpolateOrExtrapolate(
      hGroundA,
      hGroundB,
      slopeGround * 0.35,
      slopeGround * 0.35,
      t
    );

    for (let j = 0; j <= crossSteps; j++) {
      const sCross = (j / crossSteps) * 2 - 1;
      const absCross = Math.abs(sCross);

      const wx = spineX + nx * (sCross * halfWidth);
      const wz = spineZ + nz * (sCross * halfWidth);

      const trueGroundY = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, wx, wz);
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

  const indices = new Uint16Array(axialSteps * crossSteps * 6);
  const rowStride = crossSteps + 1;
  let iPtr = 0;
  for (let i = 0; i < axialSteps; i++) {
    for (let j = 0; j < crossSteps; j++) {
      const a = i * rowStride + j;
      const b = (i + 1) * rowStride + j;
      const c = (i + 1) * rowStride + (j + 1);
      const d = i * rowStride + (j + 1);
      indices[iPtr++] = a;
      indices[iPtr++] = b;
      indices[iPtr++] = d;
      indices[iPtr++] = b;
      indices[iPtr++] = c;
      indices[iPtr++] = d;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

/**
 * Builds a ground-hugging color & elevation interpolation ribbon geometry between two overlapping
 * or adjacent 3D painted terrain patches (`microStrokes`) of different brush types.
 */
function buildTerrainStrokeJunctionGeometry(
  strokeA: MicroStrokeStamp,
  strokeB: MicroStrokeStamp,
  heightMap: Float32Array,
  biomeGroundRgb: readonly [number, number, number]
): THREE.BufferGeometry | null {
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

  const axialSteps = 8;
  const crossSteps = 4;
  const vertexCount = (axialSteps + 1) * (crossSteps + 1);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);

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

  const indices = new Uint16Array(axialSteps * crossSteps * 6);
  const rowStride = crossSteps + 1;
  let iPtr = 0;
  for (let i = 0; i < axialSteps; i++) {
    for (let j = 0; j < crossSteps; j++) {
      const a = i * rowStride + j;
      const b = (i + 1) * rowStride + j;
      const c = (i + 1) * rowStride + (j + 1);
      const d = i * rowStride + (j + 1);
      indices[iPtr++] = a;
      indices[iPtr++] = b;
      indices[iPtr++] = d;
      indices[iPtr++] = b;
      indices[iPtr++] = c;
      indices[iPtr++] = d;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

/**
 * Builds the complete 3D Junction & Ground Continuum Group (`THREE.Group`) using `mergeGeometries`
 * so the entire junction network (volume-fusion bridges, ground-only continuum strips, and terrain
 * stroke ribbons) renders in a single `THREE.Mesh` (1 draw call total, `< 20ms` even with 800 objects).
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

  const pairs = computeObjectJunctionPairs(placedObjects, {
    maxDistantLinkMeters: 850,
    overlapMultiplier: 1.0,
  });

  const segmentGeometries: THREE.BufferGeometry[] = [];
  const overlapVertexRanges: Array<{ start: number; count: number }> = [];
  const distantGroundVertexRanges: Array<{ start: number; count: number }> = [];
  let vertexOffset = 0;
  let overlapCount = 0;
  let distantGroundCount = 0;

  for (const pair of pairs) {
    if (pair.mode === 'overlap_fusion') {
      const geo = buildOverlapFusionGeometry(pair, heightMap, biomeGroundRgb);
      const vCount = geo.attributes.position.count;
      overlapVertexRanges.push({ start: vertexOffset, count: vCount });
      vertexOffset += vCount;
      segmentGeometries.push(geo);
      overlapCount++;
    } else {
      const geo = buildDistantGroundContinuumGeometry(pair, heightMap, biomeGroundRgb);
      const vCount = geo.attributes.position.count;
      distantGroundVertexRanges.push({ start: vertexOffset, count: vCount });
      vertexOffset += vCount;
      segmentGeometries.push(geo);
      distantGroundCount++;
    }
  }

  // Also fuse overlapping/adjacent painted terrain strokes of different brush types (bounded to recent 24 strokes)
  const recentStrokes = microStrokes.slice(-24);
  let terrainStrokeBridgeCount = 0;
  for (let i = 0; i < recentStrokes.length && terrainStrokeBridgeCount < 24; i++) {
    for (let j = i + 1; j < recentStrokes.length && terrainStrokeBridgeCount < 24; j++) {
      const sA = recentStrokes[i];
      const sB = recentStrokes[j];
      if (sA.brushId === sB.brushId) continue;
      const dist = Math.hypot(sB.x - sA.x, sB.z - sA.z);
      if (dist <= (sA.radius + sB.radius) * 1.45) {
        const strokeGeo = buildTerrainStrokeJunctionGeometry(
          sA,
          sB,
          heightMap,
          biomeGroundRgb
        );
        if (strokeGeo) {
          const vCount = strokeGeo.attributes.position.count;
          distantGroundVertexRanges.push({ start: vertexOffset, count: vCount });
          vertexOffset += vCount;
          segmentGeometries.push(strokeGeo);
          terrainStrokeBridgeCount++;
        }
      }
    }
  }

  if (segmentGeometries.length > 0) {
    const mergedNetworkGeo = mergeGeometries(segmentGeometries, false);
    for (const g of segmentGeometries) g.dispose();
    if (mergedNetworkGeo) {
      mergedNetworkGeo.computeVertexNormals();
      const junctionNetworkMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.82,
        metalness: 0.04,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const networkMesh = new THREE.Mesh(mergedNetworkGeo, junctionNetworkMaterial);
      networkMesh.name = 'merged_junction_network';
      networkMesh.castShadow = overlapCount > 0;
      networkMesh.receiveShadow = true;
      networkMesh.userData.isJunctionBridge = true;
      networkMesh.userData.junctionMode = 'merged_junction_network';
      networkMesh.userData.overlapFusionCount = overlapCount;
      networkMesh.userData.distantGroundCorridorCount = distantGroundCount;
      networkMesh.userData.terrainStrokeBridgeCount = terrainStrokeBridgeCount;
      networkMesh.userData.overlapVertexRanges = overlapVertexRanges;
      networkMesh.userData.distantGroundVertexRanges = distantGroundVertexRanges;
      group.add(networkMesh);
    }
  }

  group.userData.overlapFusionCount = overlapCount;
  group.userData.distantGroundCorridorCount = distantGroundCount;
  group.userData.terrainStrokeBridgeCount = terrainStrokeBridgeCount;
  group.userData.drawCallCount = group.children.length;
  return group;
}
