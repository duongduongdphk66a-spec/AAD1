import * as THREE from 'three';
import { SplatMaterialHandle } from './splatMaterial';
import { TerrainField } from './terrainField';
import {
  HALF,
  Level,
  MAX_LEVEL,
  Rect,
  TILE,
  clamp,
  smoothstep,
  spacing,
} from './units';

export interface ClipmapOptions {
  levels: number;
  ringSamples: 256;
  patchSize: 32;
  skirtDepth: number;
  gpuProfile: 'integrated' | 'discrete' | 'software';
}

export interface ClipmapStats {
  activeLevels: number;
  fineActiveLevel: Level;
  visiblePatches: number;
  visibleTriangles: number;
  uploadMs: number;
}

interface RingLevelData {
  level: Level;
  originX: number;
  originZ: number;
  step: number;
  extent: number;
  heightBuffer: Float32Array;
  heightTexture: THREE.DataTexture;
  material: THREE.ShaderMaterial;
  group: THREE.Group;
  patches: Array<{
    gx: number;
    gz: number;
    mesh: THREE.Mesh;
    localMinX: number;
    localMinZ: number;
    localMaxX: number;
    localMaxZ: number;
  }>;
  dirtyRects: Rect[];
  initialized: boolean;
}

/**
 * Snaps ring origin to a multiple of 2 * s(L) to guarantee vertex alignment with parent ring L+1
 * and eliminate T-junction shimmering during camera translation.
 */
export function snapRingOrigin(camCoord: number, level: Level, ringSamples = 256): number {
  const s = spacing(level);
  const snapStep = 2 * s;
  const halfSpan = (ringSamples * 0.5) * s;
  const rawOrigin = camCoord - halfSpan;
  return Math.floor(rawOrigin / snapStep) * snapStep;
}

/**
 * Pure helper to compute morph alpha for unit test & shader parity:
 * alpha = smoothstep(0.8, 1.0, dist / ringExtent)
 */
export function computeClipmapMorphAlpha(
  worldX: number,
  worldZ: number,
  camX: number,
  camZ: number,
  ringExtent: number
): number {
  const chebyshev = Math.max(Math.abs(worldX - camX), Math.abs(worldZ - camZ));
  return smoothstep(0.8 * ringExtent, 1.0 * ringExtent, chebyshev);
}

/**
 * Builds a single 32x32 sample patch geometry (in local grid coordinates [gx*32 .. (gx+1)*32])
 * with an outer vertical skirt along the boundary of the 256x256 ring to seal any sub-pixel seam.
 */
function createPatchGeometry(
  gx: number,
  gz: number,
  patchSize: number,
  skirtDepth: number
): THREE.BufferGeometry {
  const cols = patchSize + 1;
  const rows = patchSize + 1;
  const baseVertCount = cols * rows;

  const isOuterMinX = gx === 0;
  const isOuterMaxX = gx === 7;
  const isOuterMinZ = gz === 0;
  const isOuterMaxZ = gz === 7;

  const positions: number[] = [];
  const skirtDrops: number[] = [];
  const indices: number[] = [];

  const startX = gx * patchSize;
  const startZ = gz * patchSize;

  for (let rz = 0; rz < rows; rz++) {
    for (let rx = 0; rx < cols; rx++) {
      positions.push(startX + rx, 0, startZ + rz);
      skirtDrops.push(0);
    }
  }

  for (let rz = 0; rz < patchSize; rz++) {
    for (let rx = 0; rx < patchSize; rx++) {
      const i00 = rz * cols + rx;
      const i10 = i00 + 1;
      const i01 = (rz + 1) * cols + rx;
      const i11 = i01 + 1;
      indices.push(i00, i01, i10);
      indices.push(i10, i01, i11);
    }
  }

  // Append vertical skirt quads along outer boundary edges of the 8x8 ring
  const addSkirtEdge = (edgeIndices: number[]) => {
    const skirtBaseStart = positions.length / 3;
    for (const vIdx of edgeIndices) {
      positions.push(
        positions[vIdx * 3],
        positions[vIdx * 3 + 1],
        positions[vIdx * 3 + 2]
      );
      skirtDrops.push(skirtDepth);
    }
    for (let i = 0; i < edgeIndices.length - 1; i++) {
      const topA = edgeIndices[i];
      const topB = edgeIndices[i + 1];
      const botA = skirtBaseStart + i;
      const botB = skirtBaseStart + i + 1;
      indices.push(topA, botA, topB);
      indices.push(topB, botA, botB);
    }
  };

  if (isOuterMinZ) {
    const edge: number[] = [];
    for (let rx = 0; rx < cols; rx++) edge.push(rx);
    addSkirtEdge(edge);
  }
  if (isOuterMaxZ) {
    const edge: number[] = [];
    for (let rx = 0; rx < cols; rx++) edge.push((rows - 1) * cols + rx);
    addSkirtEdge(edge);
  }
  if (isOuterMinX) {
    const edge: number[] = [];
    for (let rz = 0; rz < rows; rz++) edge.push(rz * cols);
    addSkirtEdge(edge);
  }
  if (isOuterMaxX) {
    const edge: number[] = [];
    for (let rz = 0; rz < rows; rz++) edge.push(rz * cols + (cols - 1));
    addSkirtEdge(edge);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aSkirtDrop', new THREE.Float32BufferAttribute(skirtDrops, 1));
  geo.setIndex(indices);
  return geo;
}

export class ClipmapRenderer {
  public readonly root = new THREE.Group();
  private readonly terrainField: TerrainField;
  private readonly splatHandle: SplatMaterialHandle;
  private readonly options: ClipmapOptions;
  private readonly rings: RingLevelData[] = [];
  private readonly patchGeometries: THREE.BufferGeometry[][] = [];
  private readonly minFineLevel: Level;
  private lastStats: ClipmapStats = {
    activeLevels: 10,
    fineActiveLevel: 0,
    visiblePatches: 0,
    visibleTriangles: 0,
    uploadMs: 0,
  };
  private readonly unsubscribeField: () => void;

  constructor(
    terrainField: TerrainField,
    splatHandle: SplatMaterialHandle,
    opts?: Partial<ClipmapOptions>
  ) {
    this.terrainField = terrainField;
    this.splatHandle = splatHandle;
    this.options = {
      levels: opts?.levels ?? 10,
      ringSamples: 256,
      patchSize: 32,
      skirtDepth: opts?.skirtDepth ?? 8.0,
      gpuProfile: opts?.gpuProfile ?? 'discrete',
    };

    // Determine finest active ring based on GPU profile
    this.minFineLevel =
      this.options.gpuProfile === 'software'
        ? 3
        : this.options.gpuProfile === 'integrated'
          ? 1
          : 0;

    this.root.name = 'ClipmapTerrainRootV3';
    this.buildSharedPatchGeometries();
    this.buildRings();

    this.unsubscribeField = this.terrainField.on('changed', (rect) => {
      this.markDirty(rect);
      this.splatHandle.updateSplatRect(rect);
    });
  }

  private buildSharedPatchGeometries(): void {
    const patchSize = this.options.patchSize;
    for (let gz = 0; gz < 8; gz++) {
      const row: THREE.BufferGeometry[] = [];
      for (let gx = 0; gx < 8; gx++) {
        row.push(createPatchGeometry(gx, gz, patchSize, this.options.skirtDepth));
      }
      this.patchGeometries.push(row);
    }
  }

  private buildRings(): void {
    for (let l = this.minFineLevel; l <= MAX_LEVEL; l++) {
      const level = l as Level;
      const step = spacing(level);
      const extent = 128 * step;
      const heightBuffer = new Float32Array(TILE * TILE);
      const heightTexture = new THREE.DataTexture(
        heightBuffer,
        TILE,
        TILE,
        THREE.RedFormat,
        THREE.FloatType
      );
      heightTexture.wrapS = THREE.ClampToEdgeWrapping;
      heightTexture.wrapT = THREE.ClampToEdgeWrapping;
      heightTexture.magFilter = THREE.NearestFilter;
      heightTexture.minFilter = THREE.NearestFilter;

      const mat = this.splatHandle.material.clone();
      mat.uniforms.uHeightTex = { value: heightTexture };
      mat.uniforms.uBaseColorTex = this.splatHandle.material.uniforms.uBaseColorTex;
      mat.uniforms.uShowSdfOutline = this.splatHandle.material.uniforms.uShowSdfOutline;
      mat.uniforms.uRingOrigin = { value: new THREE.Vector2(0, 0) };
      mat.uniforms.uRingStep = { value: step };
      mat.uniforms.uRingExtent = { value: extent };
      mat.uniforms.uCameraXZ = { value: new THREE.Vector2(0, 0) };
      mat.uniforms.uLevel = { value: level };

      const group = new THREE.Group();
      group.name = `ClipmapRing_L${level}`;

      const patches: RingLevelData['patches'] = [];
      for (let gz = 0; gz < 8; gz++) {
        for (let gx = 0; gx < 8; gx++) {
          // For L > minFineLevel, the inner 4x4 patches (gx in 2..5, gz in 2..5) are covered by L-1
          const mesh = new THREE.Mesh(this.patchGeometries[gz][gx], mat);
          mesh.frustumCulled = false;
          mesh.receiveShadow = true;
          group.add(mesh);
          patches.push({
            gx,
            gz,
            mesh,
            localMinX: gx * 32,
            localMinZ: gz * 32,
            localMaxX: (gx + 1) * 32,
            localMaxZ: (gz + 1) * 32,
          });
        }
      }

      this.root.add(group);
      this.rings.push({
        level,
        originX: snapRingOrigin(0, level),
        originZ: snapRingOrigin(0, level),
        step,
        extent,
        heightBuffer,
        heightTexture,
        material: mat,
        group,
        patches,
        dirtyRects: [],
        initialized: false,
      });
    }
  }

  markDirty(rect: Rect): void {
    for (const ring of this.rings) {
      const ringMaxX = ring.originX + (TILE - 1) * ring.step;
      const ringMaxZ = ring.originZ + (TILE - 1) * ring.step;
      if (
        rect.maxX >= ring.originX &&
        rect.minX <= ringMaxX &&
        rect.maxZ >= ring.originZ &&
        rect.minZ <= ringMaxZ
      ) {
        ring.dirtyRects.push(rect);
      }
    }
  }

  /**
   * Synchronizes all clipmap rings around the current camera position, updating only shifted or
   * dirty sub-windows and hiding inner 4x4 patches covered by finer levels.
   */
  update(camera: THREE.Camera): ClipmapStats {
    const t0 = performance.now();
    const camX = clamp(camera.position.x, -HALF, HALF);
    const camZ = clamp(camera.position.z, -HALF, HALF);
    const camHeight = Math.max(0, camera.position.y - this.terrainField.sampleHeight(camX, camZ, 3));

    // Dynamically pick finest active level based on camera altitude above terrain
    let dynamicFineLevel = this.minFineLevel;
    if (camHeight > 1200) dynamicFineLevel = Math.max(this.minFineLevel, 4) as Level;
    else if (camHeight > 450) dynamicFineLevel = Math.max(this.minFineLevel, 3) as Level;
    else if (camHeight > 160) dynamicFineLevel = Math.max(this.minFineLevel, 2) as Level;
    else if (camHeight > 55) dynamicFineLevel = Math.max(this.minFineLevel, 1) as Level;

    let visiblePatches = 0;
    let visibleTriangles = 0;

    for (const ring of this.rings) {
      if (ring.level < dynamicFineLevel) {
        ring.group.visible = false;
        continue;
      }
      ring.group.visible = true;

      const snappedX = snapRingOrigin(camX, ring.level);
      const snappedZ = snapRingOrigin(camZ, ring.level);
      const shifted =
        !ring.initialized ||
        Math.abs(snappedX - ring.originX) > 1e-4 ||
        Math.abs(snappedZ - ring.originZ) > 1e-4;

      if (shifted) {
        ring.originX = snappedX;
        ring.originZ = snappedZ;
        this.terrainField.fillWindow(
          ring.level,
          ring.originX,
          ring.originZ,
          TILE,
          TILE,
          ring.heightBuffer
        );
        ring.heightTexture.needsUpdate = true;
        ring.dirtyRects.length = 0;
        ring.initialized = true;
      } else if (ring.dirtyRects.length > 0) {
        // Coalesce dirty rects into a single sub-window update
        let minX = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxZ = -Infinity;
        for (const r of ring.dirtyRects) {
          if (r.minX < minX) minX = r.minX;
          if (r.minZ < minZ) minZ = r.minZ;
          if (r.maxX > maxX) maxX = r.maxX;
          if (r.maxZ > maxZ) maxZ = r.maxZ;
        }
        ring.dirtyRects.length = 0;

        const minSx = clamp(Math.floor((minX - ring.originX) / ring.step) - 1, 0, TILE - 1);
        const maxSx = clamp(Math.ceil((maxX - ring.originX) / ring.step) + 1, 0, TILE - 1);
        const minSz = clamp(Math.floor((minZ - ring.originZ) / ring.step) - 1, 0, TILE - 1);
        const maxSz = clamp(Math.ceil((maxZ - ring.originZ) / ring.step) + 1, 0, TILE - 1);

        for (let rz = minSz; rz <= maxSz; rz++) {
          const wz = ring.originZ + rz * ring.step;
          const rowOff = rz * TILE;
          for (let rx = minSx; rx <= maxSx; rx++) {
            const wx = ring.originX + rx * ring.step;
            ring.heightBuffer[rowOff + rx] = this.terrainField.sampleHeight(wx, wz, ring.level);
          }
        }
        ring.heightTexture.needsUpdate = true;
      }

      ring.material.uniforms.uRingOrigin.value.set(ring.originX, ring.originZ);
      ring.material.uniforms.uCameraXZ.value.set(camX, camZ);

      const isFinestActive = ring.level === dynamicFineLevel;
      for (const p of ring.patches) {
        const isInnerHollow =
          !isFinestActive && p.gx >= 2 && p.gx <= 5 && p.gz >= 2 && p.gz <= 5;
        const patchMinX = ring.originX + p.localMinX * ring.step;
        const patchMaxX = ring.originX + p.localMaxX * ring.step;
        const patchMinZ = ring.originZ + p.localMinZ * ring.step;
        const patchMaxZ = ring.originZ + p.localMaxZ * ring.step;
        const outOfWorld =
          patchMaxX < -HALF || patchMinX > HALF || patchMaxZ < -HALF || patchMinZ > HALF;

        const visible = !isInnerHollow && !outOfWorld;
        p.mesh.visible = visible;
        if (visible) {
          visiblePatches++;
          visibleTriangles += 32 * 32 * 2;
        }
      }
    }

    const uploadMs = performance.now() - t0;
    this.lastStats = {
      activeLevels: MAX_LEVEL - dynamicFineLevel + 1,
      fineActiveLevel: dynamicFineLevel,
      visiblePatches,
      visibleTriangles,
      uploadMs,
    };
    return this.lastStats;
  }

  getStats(): ClipmapStats {
    return this.lastStats;
  }

  getRingHeightSnapshot(level: Level): { originX: number; originZ: number; buffer: Float32Array } | null {
    const ring = this.rings.find((r) => r.level === level);
    if (!ring) return null;
    return {
      originX: ring.originX,
      originZ: ring.originZ,
      buffer: ring.heightBuffer,
    };
  }

  dispose(): void {
    this.unsubscribeField();
    for (const ring of this.rings) {
      ring.heightTexture.dispose();
      ring.material.dispose();
    }
    for (const row of this.patchGeometries) {
      for (const geo of row) {
        geo.dispose();
      }
    }
  }
}
