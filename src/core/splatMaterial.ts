import * as THREE from 'three';
import { StampIndex } from './stampSystem';
import { TerrainField } from './terrainField';
import { TileStore, decodeTileValue } from './tileStore';
import {
  BASE_N,
  BASE_STEP,
  HALF,
  Level,
  Rect,
  TILE,
  WORLD_SIZE,
  clamp,
  spacing,
  tileSpan,
} from './units';

export interface SplatLayer {
  id: number;
  name: string;
  albedo: THREE.Color;
  roughness: number;
  slopeBias: number;
  heightRange: [number, number];
}

export interface SplatMaterialHandle {
  readonly material: THREE.ShaderMaterial;
  readonly layers: readonly SplatLayer[];
  updateSplatRect(rect: Rect): void;
  sampleDerivedRgb(x: number, z: number): [number, number, number];
  syncBaseSplatFromField(): void;
  setDebugShowSdfOutline(enabled: boolean): void;
  dispose(): void;
}

export const DEFAULT_SPLAT_LAYERS: readonly SplatLayer[] = [
  {
    id: 0,
    name: 'Cát Bờ Biển',
    albedo: new THREE.Color(0.84, 0.78, 0.62),
    roughness: 0.88,
    slopeBias: 0.1,
    heightRange: [-120, 12],
  },
  {
    id: 1,
    name: 'Thảo Nguyên Cỏ Xanh',
    albedo: new THREE.Color(0.28, 0.56, 0.25),
    roughness: 0.82,
    slopeBias: 0.2,
    heightRange: [4, 240],
  },
  {
    id: 2,
    name: 'Đất Rừng Đồi',
    albedo: new THREE.Color(0.39, 0.34, 0.24),
    roughness: 0.9,
    slopeBias: 0.45,
    heightRange: [40, 380],
  },
  {
    id: 3,
    name: 'Đá Nền Kiến Trúc',
    albedo: new THREE.Color(0.56, 0.57, 0.59),
    roughness: 0.65,
    slopeBias: 0.65,
    heightRange: [-500, 1000],
  },
  {
    id: 4,
    name: 'Vách Đá Granite',
    albedo: new THREE.Color(0.42, 0.43, 0.46),
    roughness: 0.75,
    slopeBias: 0.85,
    heightRange: [80, 900],
  },
  {
    id: 5,
    name: 'Tuyết Đỉnh Cao',
    albedo: new THREE.Color(0.94, 0.96, 0.99),
    roughness: 0.55,
    slopeBias: 0.15,
    heightRange: [280, 1200],
  },
];

/**
 * Pure deterministic function that derives vertex/fragment RGB from
 * (splat, height, slope, stamp) so that blended colors never drift or vanish after save/load.
 */
export function evaluateProceduralSplatColor(
  height: number,
  slope: number,
  stampSplatId?: number,
  stampWeight = 0,
  paintedSplatId?: number,
  layers: readonly SplatLayer[] = DEFAULT_SPLAT_LAYERS
): [number, number, number] {
  // Base procedural weights by elevation & slope
  let r = 0.28;
  let g = 0.56;
  let b = 0.25;

  if (height < 0) {
    const depthT = clamp(-height / 180, 0, 1);
    r = 0.16 * (1 - depthT) + 0.05 * depthT;
    g = 0.42 * (1 - depthT) + 0.18 * depthT;
    b = 0.58 * (1 - depthT) + 0.35 * depthT;
  } else if (height < 14) {
    const t = clamp(height / 14, 0, 1);
    const c0 = layers[0].albedo;
    const c1 = layers[1].albedo;
    r = c0.r * (1 - t) + c1.r * t;
    g = c0.g * (1 - t) + c1.g * t;
    b = c0.b * (1 - t) + c1.b * t;
  } else if (height < 210) {
    const t = clamp((height - 14) / 196, 0, 1);
    const c1 = layers[1].albedo;
    const c2 = layers[2].albedo;
    r = c1.r * (1 - t) + c2.r * t;
    g = c1.g * (1 - t) + c2.g * t;
    b = c1.b * (1 - t) + c2.b * t;
  } else if (height < 340) {
    const t = clamp((height - 210) / 130, 0, 1);
    const c2 = layers[2].albedo;
    const c4 = layers[4].albedo;
    r = c2.r * (1 - t) + c4.r * t;
    g = c2.g * (1 - t) + c4.g * t;
    b = c2.b * (1 - t) + c4.b * t;
  } else {
    const t = clamp((height - 340) / 120, 0, 1);
    const c4 = layers[4].albedo;
    const c5 = layers[5].albedo;
    r = c4.r * (1 - t) + c5.r * t;
    g = c4.g * (1 - t) + c5.g * t;
    b = c4.b * (1 - t) + c5.b * t;
  }

  // Steep cliff rock blend
  const cliffBlend = clamp((slope - 0.32) / 0.38, 0, 1);
  if (cliffBlend > 0) {
    const rock = layers[4].albedo;
    r = r * (1 - cliffBlend) + rock.r * cliffBlend;
    g = g * (1 - cliffBlend) + rock.g * cliffBlend;
    b = b * (1 - cliffBlend) + rock.b * cliffBlend;
  }

  // User painted splat layer at Level 3 (0.8 m)
  if (paintedSplatId !== undefined && paintedSplatId >= 0 && paintedSplatId < layers.length) {
    const pCol = layers[paintedSplatId].albedo;
    r = r * 0.25 + pCol.r * 0.75;
    g = g * 0.25 + pCol.g * 0.75;
    b = b * 0.25 + pCol.b * 0.75;
  }

  // Stamp foundation material blend
  if (
    stampSplatId !== undefined &&
    stampWeight > 0 &&
    stampSplatId >= 0 &&
    stampSplatId < layers.length
  ) {
    const sCol = layers[stampSplatId].albedo;
    const w = clamp(stampWeight * 0.85, 0, 0.9);
    r = r * (1 - w) + sCol.r * w;
    g = g * (1 - w) + sCol.g * w;
    b = b * (1 - w) + sCol.b * w;
  }

  return [r, g, b];
}

export function createSplatMaterialHandle(
  terrainField: TerrainField,
  tileStore: TileStore,
  stampIndex: StampIndex,
  layers: readonly SplatLayer[] = DEFAULT_SPLAT_LAYERS
): SplatMaterialHandle {
  const baseRgba = new Uint8Array(BASE_N * BASE_N * 4);
  const baseTex = new THREE.DataTexture(baseRgba, BASE_N, BASE_N, THREE.RGBAFormat);
  baseTex.wrapS = THREE.ClampToEdgeWrapping;
  baseTex.wrapT = THREE.ClampToEdgeWrapping;
  baseTex.magFilter = THREE.LinearFilter;
  baseTex.minFilter = THREE.LinearFilter;

  const samplePaintedSplat = (x: number, z: number): number | undefined => {
    const splatLevel: Level = 3;
    const span = tileSpan(splatLevel);
    const step = spacing(splatLevel);
    const maxTileIdx = Math.max(0, Math.ceil(WORLD_SIZE / span) - 1);
    const tx = clamp(Math.floor((x + HALF) / span), 0, maxTileIdx);
    const tz = clamp(Math.floor((z + HALF) / span), 0, maxTileIdx);
    const tile = tileStore.get(splatLevel, tx, tz, 'splat');
    if (!tile || tile.scale === 0) return undefined;
    const lx = clamp(Math.floor((x - (-HALF + tx * span)) / step), 0, TILE - 1);
    const lz = clamp(Math.floor((z - (-HALF + tz * span)) / step), 0, TILE - 1);
    const val = Math.round(decodeTileValue(tile, lz * TILE + lx));
    return val > 0 ? val - 1 : undefined;
  };

  const sampleDerivedRgb = (x: number, z: number): [number, number, number] => {
    const baseH = terrainField.sampleHeightNoStamps(x, z, 2);
    const stampEval = stampIndex.evaluateDetailed(x, z, baseH);
    const h = stampEval.height;
    const n = terrainField.sampleNormal(x, z, 2);
    const slope = 1.0 - clamp(n[1], 0, 1);
    const painted = samplePaintedSplat(x, z);
    return evaluateProceduralSplatColor(
      h,
      slope,
      stampEval.dominantSplatId,
      stampEval.weight,
      painted,
      layers
    );
  };

  const syncBaseSplatFromField = (): void => {
    let ptr = 0;
    for (let rz = 0; rz < BASE_N; rz++) {
      const wz = -HALF + rz * BASE_STEP;
      for (let rx = 0; rx < BASE_N; rx++) {
        const wx = -HALF + rx * BASE_STEP;
        const [r, g, b] = sampleDerivedRgb(wx, wz);
        baseRgba[ptr++] = clamp(Math.round(r * 255), 0, 255);
        baseRgba[ptr++] = clamp(Math.round(g * 255), 0, 255);
        baseRgba[ptr++] = clamp(Math.round(b * 255), 0, 255);
        baseRgba[ptr++] = 255;
      }
    }
    baseTex.needsUpdate = true;
  };

  syncBaseSplatFromField();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uHeightTex: { value: null },
      uCoarseHeightTex: { value: null },
      uBaseColorTex: { value: baseTex },
      uRingOrigin: { value: new THREE.Vector2(-HALF, -HALF) },
      uRingStep: { value: 1.0 },
      uRingExtent: { value: 128.0 },
      uCameraXZ: { value: new THREE.Vector2(0, 0) },
      uLevel: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.55, 0.78, 0.3).normalize() },
      uShowSdfOutline: { value: 0.0 },
    },
    vertexShader: /* glsl */ `
      uniform sampler2D uHeightTex;
      uniform vec2 uRingOrigin;
      uniform float uRingStep;
      uniform float uRingExtent;
      uniform vec2 uCameraXZ;
      uniform float uLevel;

      attribute float aSkirtDrop;

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vMorphAlpha;

      float sampleWindowH(vec2 uv) {
        vec2 cUv = clamp(uv, vec2(0.002), vec2(0.998));
        return texture2D(uHeightTex, cUv).r;
      }

      void main() {
        // Position x, z are in grid sample coordinates [0..255]
        vec2 sampleCoord = position.xz;
        vec2 worldXZ = uRingOrigin + sampleCoord * uRingStep;

        // Compute morph factor alpha = smoothstep(0.8, 1.0, dist / ringExtent)
        vec2 dCam = abs(worldXZ - uCameraXZ);
        float chebyshevDist = max(dCam.x, dCam.y);
        float alpha = smoothstep(0.8 * uRingExtent, 1.0 * uRingExtent, chebyshevDist);
        vMorphAlpha = alpha;

        vec2 uv = (sampleCoord + 0.5) / 256.0;
        float hFine = sampleWindowH(uv);

        // Snap odd vertices to even neighbor average for smooth transition to L+1
        vec2 evenSample = floor(sampleCoord * 0.5) * 2.0;
        vec2 uvEven0 = (evenSample + 0.5) / 256.0;
        vec2 uvEven1 = (min(vec2(255.0), evenSample + 2.0) + 0.5) / 256.0;
        float hCoarse = 0.5 * (sampleWindowH(uvEven0) + sampleWindowH(uvEven1));

        float h = mix(hFine, hCoarse, alpha) - aSkirtDrop;

        // Central difference normal in vertex shader
        float eps = 1.0 / 256.0;
        float hxP = sampleWindowH(uv + vec2(eps, 0.0));
        float hxN = sampleWindowH(uv - vec2(eps, 0.0));
        float hzP = sampleWindowH(uv + vec2(0.0, eps));
        float hzN = sampleWindowH(uv - vec2(0.0, eps));
        float dhdx = (hxP - hxN) / (2.0 * uRingStep);
        float dhdz = (hzP - hzN) / (2.0 * uRingStep);
        vNormal = normalize(vec3(-dhdx, 1.0, -dhdz));

        vec3 finalPos = vec3(worldXZ.x, h, worldXZ.y);
        vWorldPos = finalPos;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uBaseColorTex;
      uniform vec3 uSunDir;
      uniform float uShowSdfOutline;

      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vMorphAlpha;

      void main() {
        vec2 worldUv = clamp((vWorldPos.xz + 5000.0) / 10000.0, 0.0, 1.0);
        vec3 baseCol = texture2D(uBaseColorTex, worldUv).rgb;

        vec3 N = normalize(vNormal);
        float slope = 1.0 - clamp(N.y, 0.0, 1.0);

        // Micro-detail procedural rock/grass modulation
        vec3 rockCol = vec3(0.42, 0.43, 0.46);
        float cliffMix = smoothstep(0.32, 0.68, slope);
        vec3 albedo = mix(baseCol, rockCol, cliffMix * 0.65);

        float ndl = max(0.18, dot(N, normalize(uSunDir)));
        float hemi = 0.32 + 0.25 * clamp(N.y, 0.0, 1.0);
        vec3 lit = albedo * (ndl * 0.82 + hemi);

        if (uShowSdfOutline > 0.5) {
          float contour = abs(fract(vWorldPos.y * 0.25) - 0.5);
          if (contour < 0.04) {
            lit = mix(lit, vec3(0.15, 0.9, 0.95), 0.45);
          }
        }

        gl_FragColor = vec4(lit, 1.0);
      }
    `,
  });

  return {
    material,
    layers,
    updateSplatRect(rect: Rect): void {
      const minRx = clamp(Math.floor((rect.minX + HALF) / BASE_STEP) - 1, 0, BASE_N - 1);
      const maxRx = clamp(Math.ceil((rect.maxX + HALF) / BASE_STEP) + 1, 0, BASE_N - 1);
      const minRz = clamp(Math.floor((rect.minZ + HALF) / BASE_STEP) - 1, 0, BASE_N - 1);
      const maxRz = clamp(Math.ceil((rect.maxZ + HALF) / BASE_STEP) + 1, 0, BASE_N - 1);

      for (let rz = minRz; rz <= maxRz; rz++) {
        const wz = -HALF + rz * BASE_STEP;
        for (let rx = minRx; rx <= maxRx; rx++) {
          const wx = -HALF + rx * BASE_STEP;
          const [r, g, b] = sampleDerivedRgb(wx, wz);
          const idx = (rz * BASE_N + rx) * 4;
          baseRgba[idx] = clamp(Math.round(r * 255), 0, 255);
          baseRgba[idx + 1] = clamp(Math.round(g * 255), 0, 255);
          baseRgba[idx + 2] = clamp(Math.round(b * 255), 0, 255);
          baseRgba[idx + 3] = 255;
        }
      }
      baseTex.needsUpdate = true;
    },
    sampleDerivedRgb,
    syncBaseSplatFromField,
    setDebugShowSdfOutline(enabled: boolean): void {
      material.uniforms.uShowSdfOutline.value = enabled ? 1.0 : 0.0;
    },
    dispose(): void {
      baseTex.dispose();
      material.dispose();
    },
  };
}
