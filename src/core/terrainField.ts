import { DetailGenerator } from './detailGenerator';
import { StampIndex } from './stampSystem';
import { Tile, TileStore } from './tileStore';
import {
  BASE_N,
  BASE_STEP,
  HALF,
  Level,
  MAX_LEVEL,
  Rect,
  WORLD_SIZE,
  clamp,
  spacing,
  tileSpan,
  worldToTileCoord,
} from './units';

export interface RaycastHit {
  x: number;
  y: number;
  z: number;
  t: number;
}

export interface TerrainField {
  sampleHeight(x: number, z: number, maxLevel?: Level): number;
  sampleHeightNoStamps(x: number, z: number, maxLevel?: Level): number;
  sampleBaseHeight(x: number, z: number): number;
  sampleNormal(x: number, z: number, level?: Level): [number, number, number];
  fillWindow(
    level: Level,
    originX: number,
    originZ: number,
    w: number,
    h: number,
    out: Float32Array
  ): void;
  raycast(
    o: [number, number, number],
    d: [number, number, number],
    maxDist: number
  ): RaycastHit | null;
  on(event: 'changed', fn: (rect: Rect, minLevel: Level) => void): () => void;
  notifyChanged(rect: Rect, minLevel?: Level): void;
  setBaseHeightMap(baseMap: Float32Array): void;
  getBaseHeightMap(): Float32Array;
}

/**
 * 1D Catmull-Rom cubic interpolation spline with tension 0.5
 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

interface LevelMruEntry {
  tx: number;
  tz: number;
  tile: Tile | undefined;
}

export class UnifiedTerrainField implements TerrainField {
  private baseMap: Float32Array;
  private readonly tileStore: TileStore;
  private readonly detailGen: DetailGenerator;
  private readonly stampIndex: StampIndex;
  private readonly listeners = new Set<(rect: Rect, minLevel: Level) => void>();
  private readonly mruByLevel: Array<LevelMruEntry | null> = new Array(MAX_LEVEL + 1).fill(null);

  constructor(
    baseMap: Float32Array,
    tileStore: TileStore,
    detailGen: DetailGenerator,
    stampIndex: StampIndex
  ) {
    if (baseMap.length < BASE_N * BASE_N) {
      this.baseMap = new Float32Array(BASE_N * BASE_N);
      this.baseMap.set(baseMap);
    } else {
      this.baseMap = baseMap;
    }
    this.tileStore = tileStore;
    this.detailGen = detailGen;
    this.stampIndex = stampIndex;
  }

  setBaseHeightMap(baseMap: Float32Array): void {
    this.baseMap = baseMap;
    this.notifyChanged(
      { minX: -HALF, minZ: -HALF, maxX: HALF, maxZ: HALF },
      MAX_LEVEL
    );
  }

  getBaseHeightMap(): Float32Array {
    return this.baseMap;
  }

  invalidateMruCache(): void {
    for (let i = 0; i <= MAX_LEVEL; i++) {
      this.mruByLevel[i] = null;
    }
  }

  on(event: 'changed', fn: (rect: Rect, minLevel: Level) => void): () => void {
    if (event === 'changed') {
      this.listeners.add(fn);
    }
    return () => {
      this.listeners.delete(fn);
    };
  }

  notifyChanged(rect: Rect, minLevel: Level = 0): void {
    this.invalidateMruCache();
    for (const fn of this.listeners) {
      fn(rect, minLevel);
    }
  }

  /**
   * Bicubic Catmull-Rom interpolation on the 161x161 base grid (step 62.5 m).
   */
  sampleBaseHeight(x: number, z: number): number {
    const cx = clamp(x, -HALF, HALF);
    const cz = clamp(z, -HALF, HALF);
    const gx = (cx + HALF) / BASE_STEP;
    const gz = (cz + HALF) / BASE_STEP;

    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const tx = gx - ix;
    const tz = gz - iz;

    const c0 = clamp(ix - 1, 0, BASE_N - 1);
    const c1 = clamp(ix, 0, BASE_N - 1);
    const c2 = clamp(ix + 1, 0, BASE_N - 1);
    const c3 = clamp(ix + 2, 0, BASE_N - 1);

    const r0 = clamp(iz - 1, 0, BASE_N - 1) * BASE_N;
    const r1 = clamp(iz, 0, BASE_N - 1) * BASE_N;
    const r2 = clamp(iz + 1, 0, BASE_N - 1) * BASE_N;
    const r3 = clamp(iz + 2, 0, BASE_N - 1) * BASE_N;

    const bm = this.baseMap;
    const p0 = catmullRom(bm[r0 + c0], bm[r0 + c1], bm[r0 + c2], bm[r0 + c3], tx);
    const p1 = catmullRom(bm[r1 + c0], bm[r1 + c1], bm[r1 + c2], bm[r1 + c3], tx);
    const p2 = catmullRom(bm[r2 + c0], bm[r2 + c1], bm[r2 + c2], bm[r2 + c3], tx);
    const p3 = catmullRom(bm[r3 + c0], bm[r3 + c1], bm[r3 + c2], bm[r3 + c3], tx);
    return catmullRom(p0, p1, p2, p3, tz);
  }

  private getTileCached(level: Level, tx: number, tz: number): Tile | undefined {
    const mru = this.mruByLevel[level];
    if (mru && mru.tx === tx && mru.tz === tz && mru.tile !== undefined) {
      return mru.tile;
    }
    const tile = this.tileStore.get(level, tx, tz, 'height');
    if (tile !== undefined) {
      this.mruByLevel[level] = { tx, tz, tile };
    }
    return tile;
  }

  private readEditCorner(level: Level, ix: number, iz: number, maxTileIdx: number): number {
    if (ix < 0 || iz < 0) return 0;
    const tx = ix >> 8;
    const tz = iz >> 8;
    if (tx > maxTileIdx || tz > maxTileIdx) return 0;

    const tile = this.getTileCached(level, tx, tz);
    if (!tile || tile.scale === 0) return 0;

    const lx = ix & 255;
    const lz = iz & 255;
    return tile.min + (tile.data[(lz << 8) | lx] + 32768) * tile.scale;
  }

  private sampleEditAtLevel(level: Level, x: number, z: number): number {
    const span = tileSpan(level);
    const step = spacing(level);
    const maxTileIdx = Math.max(0, Math.ceil(WORLD_SIZE / span) - 1);

    const gx = Math.max(0, (x + HALF) / step);
    const gz = Math.max(0, (z + HALF) / step);

    const ix0 = Math.floor(gx);
    const iz0 = Math.floor(gz);
    const ix1 = ix0 + 1;
    const iz1 = iz0 + 1;
    const ux = gx - ix0;
    const uz = gz - iz0;

    const v00 = this.readEditCorner(level, ix0, iz0, maxTileIdx);
    const v10 = this.readEditCorner(level, ix1, iz0, maxTileIdx);
    const v01 = this.readEditCorner(level, ix0, iz1, maxTileIdx);
    const v11 = this.readEditCorner(level, ix1, iz1, maxTileIdx);

    const top = v00 + (v10 - v00) * ux;
    const bot = v01 + (v11 - v01) * ux;
    return top + (bot - top) * uz;
  }

  sampleHeightNoStamps(x: number, z: number, minFineLevel: Level = 0): number {
    const cx = clamp(x, -HALF, HALF);
    const cz = clamp(z, -HALF, HALF);
    const hBase = this.sampleBaseHeight(cx, cz);
    const hDetail = this.detailGen.sample(cx, cz, minFineLevel);

    let hEdit = 0;
    const mask = this.tileStore.activeLevelMask();
    if (mask !== 0) {
      for (let l = MAX_LEVEL; l >= minFineLevel; l--) {
        if ((mask & (1 << l)) !== 0) {
          hEdit += this.sampleEditAtLevel(l as Level, cx, cz);
        }
      }
    }

    return hBase + hDetail + hEdit;
  }

  /**
   * Single Source of Truth Height Function:
   * H(x, z) = Base(x, z) + Detail(x, z; L) + sum_{l >= L} Edit_l(x, z) + Stamps(x, z)
   */
  sampleHeight(x: number, z: number, minFineLevel: Level = 0): number {
    const hUnstamped = this.sampleHeightNoStamps(x, z, minFineLevel);
    return this.stampIndex.evaluate(x, z, hUnstamped);
  }

  sampleNormal(x: number, z: number, level: Level = 0): [number, number, number] {
    const hStep = spacing(level);
    const hxPos = this.sampleHeight(x + hStep, z, level);
    const hxNeg = this.sampleHeight(x - hStep, z, level);
    const hzPos = this.sampleHeight(x, z + hStep, level);
    const hzNeg = this.sampleHeight(x, z - hStep, level);

    const dhdx = (hxPos - hxNeg) / (2 * hStep);
    const dhdz = (hzPos - hzNeg) / (2 * hStep);
    const len = Math.hypot(dhdx, 1.0, dhdz);
    return [-dhdx / len, 1.0 / len, -dhdz / len];
  }

  fillWindow(
    level: Level,
    originX: number,
    originZ: number,
    w: number,
    h: number,
    out: Float32Array
  ): void {
    const step = spacing(level);
    let idx = 0;
    for (let rz = 0; rz < h; rz++) {
      const wz = originZ + rz * step;
      for (let rx = 0; rx < w; rx++) {
        const wx = originX + rx * step;
        out[idx++] = this.sampleHeight(wx, wz, level);
      }
    }
  }

  /**
   * Hierarchical sphere-tracing / Lipschitz adaptive march + 12-iteration bisection
   * directly on H(x, z) without requiring a fine-mesh triangle BVH.
   */
  raycast(
    o: [number, number, number],
    d: [number, number, number],
    maxDist: number
  ): RaycastHit | null {
    const dirLen = Math.hypot(d[0], d[1], d[2]);
    if (dirLen < 1e-8) return null;
    const dx = d[0] / dirLen;
    const dy = d[1] / dirLen;
    const dz = d[2] / dirLen;

    // Conservative Lipschitz bound for terrain slope
    const lipschitz = 2.2;
    let t = 0;
    let prevT = 0;

    // Check if ray origin is already below terrain
    const startH = this.sampleHeight(o[0], o[2], 2);
    if (o[1] <= startH) {
      return { x: o[0], y: startH, z: o[2], t: 0 };
    }

    const maxSteps = 256;
    for (let stepIdx = 0; stepIdx < maxSteps && t <= maxDist; stepIdx++) {
      const px = o[0] + dx * t;
      const py = o[1] + dy * t;
      const pz = o[2] + dz * t;

      if (px < -HALF || px > HALF || pz < -HALF || pz > HALF) {
        if (
          (px < -HALF && dx <= 0) ||
          (px > HALF && dx >= 0) ||
          (pz < -HALF && dz <= 0) ||
          (pz > HALF && dz >= 0)
        ) {
          return null;
        }
      }

      // Sample coarser level far away, finer level close to surface
      const sampleLevel: Level = t < 50 ? 0 : t < 250 ? 2 : 4;
      const terrH = this.sampleHeight(px, pz, sampleLevel);
      const diff = py - terrH;

      if (diff <= 0) {
        // Crossed surface between prevT and t -> 12 iterations of bisection at full L0 precision
        let lo = prevT;
        let hi = t;
        for (let b = 0; b < 12; b++) {
          const mid = 0.5 * (lo + hi);
          const mx = o[0] + dx * mid;
          const my = o[1] + dy * mid;
          const mz = o[2] + dz * mid;
          const mh = this.sampleHeight(mx, mz, 0);
          if (my > mh) {
            lo = mid;
          } else {
            hi = mid;
          }
        }
        const hitT = 0.5 * (lo + hi);
        const hx = o[0] + dx * hitT;
        const hz = o[2] + dz * hitT;
        const hy = this.sampleHeight(hx, hz, 0);
        return { x: hx, y: hy, z: hz, t: hitT };
      }

      prevT = t;
      // Adaptive step proportional to vertical clearance above terrain
      const stepDist = Math.max(0.15, (diff / lipschitz) * 0.75);
      t += stepDist;
    }

    return null;
  }
}

export function getIntersectingTileCoords(
  rect: Rect,
  level: Level
): Array<{ tx: number; tz: number }> {
  const [minTx, minTz] = worldToTileCoord(rect.minX, rect.minZ, level);
  const [maxTx, maxTz] = worldToTileCoord(rect.maxX, rect.maxZ, level);
  const coords: Array<{ tx: number; tz: number }> = [];
  for (let tz = minTz; tz <= maxTz; tz++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      coords.push({ tx, tz });
    }
  }
  return coords;
}
