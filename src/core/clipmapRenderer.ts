import * as THREE from 'three';
import { Scheduler } from './scheduler';
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
  frameBudgetMs?: number;
}

export interface ClipmapStats {
  activeLevels: number;
  fineActiveLevel: Level;
  visiblePatches: number;
  visibleTriangles: number;
  uploadMs: number;
  toroidalShifts?: number;
  samplesComposedLastFrame?: number;
}

interface RingLevelData {
  level: Level;
  originX: number;
  originZ: number;
  toroidalOffsetX: number;
  toroidalOffsetZ: number;
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
  pendingFullEpoch: number;
}

/**
 * Snaps ring origin to a multiple of 2 * s(L) to guarantee vertex alignment with parent ring L+1
 * and eliminate T-junction shimmering during camera translation.
 */
export function snapRingOrigin(camCoord: number, level: Level, ringSamples = 256): number {
  const s = spacing(level);
  const snapStep = 2 * s;
  const halfSpan = ringSamples * 0.5 * s;
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
 * Shifts a 256x256 row-major heightBuffer in-place by (shiftX, shiftZ) samples
 * where |shiftX| < 256 and |shiftZ| < 256 so only the newly exposed edge strips
 * need to be composed.
 */
export function shiftRingBufferInPlace(
  buf: Float32Array,
  shiftX: number,
  shiftZ: number
): void {
  if (shiftX === 0 && shiftZ === 0) return;

  const absX = Math.abs(shiftX);
  const absZ = Math.abs(shiftZ);
  if (absX >= TILE || absZ >= TILE) return;

  const overlapW = TILE - absX;
  const overlapH = TILE - absZ;
  const srcStartX = shiftX > 0 ? shiftX : 0;
  const dstStartX = shiftX < 0 ? -shiftX : 0;

  if (shiftZ >= 0) {
    for (let rz = 0; rz < overlapH; rz++) {
      const srcRowOff = (rz + shiftZ) * TILE;
      const dstRowOff = rz * TILE;
      buf.copyWithin(
        dstRowOff + dstStartX,
        srcRowOff + srcStartX,
        srcRowOff + srcStartX + overlapW
      );
    }
  } else {
    for (let rz = overlapH - 1; rz >= 0; rz--) {
      const srcRowOff = rz * TILE;
      const dstRowOff = (rz - shiftZ) * TILE;
      buf.copyWithin(
        dstRowOff + dstStartX,
        srcRowOff + srcStartX,
        srcRowOff + srcStartX + overlapW
      );
    }
  }
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

const SHARED_PATCH_GEOMETRY_CACHE = new Map<string, THREE.BufferGeometry[][]>();

function getSharedPatchGeometries(patchSize: number, skirtDepth: number): THREE.BufferGeometry[][] {
  const key = `${patchSize}:${skirtDepth}`;
  let cached = SHARED_PATCH_GEOMETRY_CACHE.get(key);
  if (!cached) {
    cached = [];
    for (let gz = 0; gz < 8; gz++) {
      const row: THREE.BufferGeometry[] = [];
      for (let gx = 0; gx < 8; gx++) {
        row.push(createPatchGeometry(gx, gz, patchSize, skirtDepth));
      }
      cached.push(row);
    }
    SHARED_PATCH_GEOMETRY_CACHE.set(key, cached);
  }
  return cached;
}

export class ClipmapRenderer {
  public readonly root = new THREE.Group();
  private readonly terrainField: TerrainField;
  private readonly splatHandle: SplatMaterialHandle;
  private readonly scheduler: Scheduler;
  private readonly ownsScheduler: boolean;
  private readonly options: Required<ClipmapOptions>;
  private readonly rings: RingLevelData[] = [];
  private patchGeometries: THREE.BufferGeometry[][] = [];
  private readonly minFineLevel: Level;
  private toroidalShiftCount = 0;
  private lastStats: ClipmapStats = {
    activeLevels: 10,
    fineActiveLevel: 0,
    visiblePatches: 0,
    visibleTriangles: 0,
    uploadMs: 0,
    toroidalShifts: 0,
    samplesComposedLastFrame: 0,
  };
  private readonly unsubscribeField: () => void;

  constructor(
    terrainField: TerrainField,
    splatHandle: SplatMaterialHandle,
    opts?: Partial<ClipmapOptions>,
    scheduler?: Scheduler
  ) {
    this.terrainField = terrainField;
    this.splatHandle = splatHandle;
    this.ownsScheduler = !scheduler;
    this.scheduler = scheduler ?? new Scheduler(true);
    this.options = {
      levels: opts?.levels ?? 10,
      ringSamples: 256,
      patchSize: 32,
      skirtDepth: opts?.skirtDepth ?? 8.0,
      gpuProfile: opts?.gpuProfile ?? 'discrete',
      frameBudgetMs: opts?.frameBudgetMs ?? 1.8,
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

    this.scheduler.syncWorkerTerrainState(this.terrainField.getBaseHeightMap());

    this.unsubscribeField = this.terrainField.on('changed', (rect) => {
      this.markDirty(rect);
      this.splatHandle.updateSplatRect(rect);
    });
  }

  private buildSharedPatchGeometries(): void {
    this.patchGeometries = getSharedPatchGeometries(
      this.options.patchSize,
      this.options.skirtDepth
    );
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
        toroidalOffsetX: 0,
        toroidalOffsetZ: 0,
        step,
        extent,
        heightBuffer,
        heightTexture,
        material: mat,
        group,
        patches,
        dirtyRects: [],
        initialized: false,
        pendingFullEpoch: 0,
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

  private fillSubWindowOnRing(
    ring: RingLevelData,
    startRx: number,
    startRz: number,
    subW: number,
    subH: number
  ): number {
    if (subW <= 0 || subH <= 0) return 0;
    if (this.terrainField.fillSubWindow) {
      this.terrainField.fillSubWindow(
        ring.level,
        ring.originX,
        ring.originZ,
        TILE,
        startRx,
        startRz,
        subW,
        subH,
        ring.heightBuffer
      );
    } else {
      for (let rz = 0; rz < subH; rz++) {
        const wz = ring.originZ + (startRz + rz) * ring.step;
        const rowOff = (startRz + rz) * TILE + startRx;
        for (let rx = 0; rx < subW; rx++) {
          const wx = ring.originX + (startRx + rx) * ring.step;
          ring.heightBuffer[rowOff + rx] = this.terrainField.sampleHeight(wx, wz, ring.level);
        }
      }
    }
    ring.heightTexture.needsUpdate = true;
    return subW * subH;
  }

  /**
   * Enqueues progressive 32-row strip composition jobs into Scheduler AND dispatches
   * off-thread Worker composition for full-window jumps (cold start or 4.5km teleport)
   * so that any single frame stays strictly within <= 2.2 ms on the main thread.
   */
  private scheduleFullRingComposition(ring: RingLevelData, epoch: number): void {
    ring.pendingFullEpoch = epoch;
    const reqOriginX = ring.originX;
    const reqOriginZ = ring.originZ;
    const priority = ring.level <= 2 ? 2 : 3;

    // 1. Dispatch off-thread worker composition for base+detail
    this.scheduler.dispatchWorkerCompose(
      ring.level,
      reqOriginX,
      reqOriginZ,
      TILE,
      TILE,
      (res) => {
        if (
          ring.originX !== reqOriginX ||
          ring.originZ !== reqOriginZ ||
          ring.pendingFullEpoch !== epoch
        ) {
          return;
        }
        ring.heightBuffer.set(res.heights);
        ring.heightTexture.needsUpdate = true;
        ring.pendingFullEpoch = 0;
      }
    );

    // 2. Schedule progressive 8-row strip jobs on Scheduler within frame budget
    const stripHeight = 8;
    for (let startRz = 0; startRz < TILE; startRz += stripHeight) {
      const rz0 = startRz;
      const h = Math.min(stripHeight, TILE - rz0);
      this.scheduler.enqueue({
        id: `ring_L${ring.level}_strip_${rz0}`,
        priority,
        epoch,
        level: ring.level,
        run: () => {
          if (ring.pendingFullEpoch !== epoch) return;
          // Note: ring.originX/Z may have shifted slightly by toroidal steps; fill current ring origin
          this.fillSubWindowOnRing(ring, 0, rz0, TILE, h);
          if (rz0 + h >= TILE) {
            ring.pendingFullEpoch = 0;
          }
        },
      });
    }
  }

  /**
   * Synchronizes all clipmap rings around the current camera position:
   * - Incremental camera translation (|shiftX| < 256 && |shiftZ| < 256): shifts heightBuffer
   *   toroidally in-place and composes ONLY the newly exposed rows/columns (~1/128 cost).
   * - Cold start or multi-kilometer teleport (|shift| >= 256): schedules progressive strip &
   *   background Worker composition within the strict frameBudgetMs (<= 2.2 ms).
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
    let samplesComposed = 0;
    let hadLargeTeleport = false;

    for (const ring of this.rings) {
      if (ring.level < dynamicFineLevel) {
        ring.group.visible = false;
        continue;
      }
      ring.group.visible = true;

      const snappedX = snapRingOrigin(camX, ring.level);
      const snappedZ = snapRingOrigin(camZ, ring.level);
      const shiftX = Math.round((snappedX - ring.originX) / ring.step);
      const shiftZ = Math.round((snappedZ - ring.originZ) / ring.step);

      if (!ring.initialized || Math.abs(shiftX) >= TILE || Math.abs(shiftZ) >= TILE) {
        if (!hadLargeTeleport) {
          this.scheduler.bumpEpoch();
          hadLargeTeleport = true;
        }
        ring.originX = snappedX;
        ring.originZ = snappedZ;
        ring.toroidalOffsetX = 0;
        ring.toroidalOffsetZ = 0;
        ring.dirtyRects.length = 0;
        ring.initialized = true;
        this.scheduleFullRingComposition(ring, this.scheduler.currentEpoch);
      } else if (shiftX !== 0 || shiftZ !== 0) {
        // Toroidal / sliding-window strip update: only compose newly exposed rows & columns!
        shiftRingBufferInPlace(ring.heightBuffer, shiftX, shiftZ);
        ring.originX = snappedX;
        ring.originZ = snappedZ;
        ring.toroidalOffsetX = (ring.toroidalOffsetX + shiftX) & (TILE - 1);
        ring.toroidalOffsetZ = (ring.toroidalOffsetZ + shiftZ) & (TILE - 1);
        this.toroidalShiftCount++;

        const absX = Math.abs(shiftX);
        const absZ = Math.abs(shiftZ);

        // 1. Newly exposed horizontal Z-strip (width = TILE, height = absZ)
        if (absZ > 0) {
          const zStart = shiftZ > 0 ? TILE - absZ : 0;
          samplesComposed += this.fillSubWindowOnRing(ring, 0, zStart, TILE, absZ);
        }

        // 2. Newly exposed vertical X-strip (width = absX, height = TILE - absZ)
        if (absX > 0) {
          const xStart = shiftX > 0 ? TILE - absX : 0;
          const zRemStart = shiftZ < 0 ? absZ : 0;
          const zRemHeight = TILE - absZ;
          samplesComposed += this.fillSubWindowOnRing(
            ring,
            xStart,
            zRemStart,
            absX,
            zRemHeight
          );
        }
      }

      if (ring.dirtyRects.length > 0) {
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

        samplesComposed += this.fillSubWindowOnRing(
          ring,
          minSx,
          minSz,
          maxSx - minSx + 1,
          maxSz - minSz + 1
        );
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

    // Execute queued progressive composition jobs strictly within the remaining per-frame budget
    const elapsedSoFar = performance.now() - t0;
    const remainingBudget = this.options.frameBudgetMs - elapsedSoFar;
    if (this.scheduler.pendingCount() > 0 && remainingBudget > 0.1) {
      this.scheduler.tick(remainingBudget, this.scheduler.currentEpoch);
    }

    const uploadMs = performance.now() - t0;
    this.lastStats = {
      activeLevels: MAX_LEVEL - dynamicFineLevel + 1,
      fineActiveLevel: dynamicFineLevel,
      visiblePatches,
      visibleTriangles,
      uploadMs,
      toroidalShifts: this.toroidalShiftCount,
      samplesComposedLastFrame: samplesComposed,
    };
    return this.lastStats;
  }

  /**
   * Synchronously drains any pending scheduled ring strip compositions (useful for deterministic snapshot tests).
   */
  flushPendingCompositions(): void {
    while (this.scheduler.pendingCount() > 0) {
      const ran = this.scheduler.tick(50, this.scheduler.currentEpoch);
      if (ran === 0) break;
    }
  }

  getStats(): ClipmapStats {
    return this.lastStats;
  }

  getRingHeightSnapshot(level: Level): { originX: number; originZ: number; buffer: Float32Array } | null {
    const ring = this.rings.find((r) => r.level === level);
    if (!ring) return null;
    if (ring.pendingFullEpoch !== 0) {
      this.fillSubWindowOnRing(ring, 0, 0, TILE, TILE);
      ring.pendingFullEpoch = 0;
    }
    return {
      originX: ring.originX,
      originZ: ring.originZ,
      buffer: ring.heightBuffer,
    };
  }

  dispose(): void {
    this.unsubscribeField();
    if (this.ownsScheduler) {
      this.scheduler.dispose();
    }
    for (const ring of this.rings) {
      ring.heightTexture.dispose();
      ring.material.dispose();
    }
  }
}

