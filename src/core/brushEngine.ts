import { TerrainField } from './terrainField';
import { TileStore, decodeTileValue, writeFloatTile } from './tileStore';
import {
  HALF,
  Level,
  MAX_FINE_EDIT_KM2,
  MAX_LEVEL,
  Rect,
  S0,
  TILE,
  WORLD_SIZE,
  clamp,
  smoothstep,
  spacing,
  tileKey,
  tileSpan,
  worldToTileCoord,
} from './units';

export interface SampleAccessor {
  readonly height: number;
  readonly baseHeight: number;
  readonly editDelta: number;
  neighborAvg4(): number;
}

export type BrushKernel = (
  x: number,
  z: number,
  rNorm: number,
  sample: SampleAccessor,
  dt: number
) => number;

export interface BrushStamp {
  x: number;
  z: number;
  radius: number;
  strength: number;
  kernel: BrushKernel;
  splatId?: number;
}

export interface BrushCostEstimate {
  level: Level;
  clampedByQuota: boolean;
  quotaWarning80Pct: boolean;
  fineAreaKm2: number;
  maxFineAreaKm2: number;
  mbPerKm2: number;
  estimatedTilesForStroke: number;
}

export interface BrushEngine {
  selectLevel(radiusMeters: number): Level;
  beginStroke(): void;
  applyStamp(s: BrushStamp, dt?: number): Rect;
  endStroke(): void;
  undo(): Rect | null;
  redo(): Rect | null;
  canUndo(): boolean;
  canRedo(): boolean;
  estimateCost(radiusMeters: number): BrushCostEstimate;
}

interface TileSnapshot {
  level: Level;
  tx: number;
  tz: number;
  existedBefore: boolean;
  beforeMin: number;
  beforeScale: number;
  beforeData: Int16Array | null;
  existedAfter: boolean;
  afterMin: number;
  afterScale: number;
  afterData: Int16Array | null;
}

interface StrokeRecord {
  tiles: TileSnapshot[];
  bounds: Rect;
  minLevel: Level;
  byteSize: number;
}

const MAX_UNDO_STROKES = 64;
const MAX_UNDO_BYTES = 128 * 1024 * 1024; // 128 MB

/**
 * Pure formula from Section 8:
 * L* = clamp(round(log2(r / (8 * S0))), 0, 9)
 */
export function computeBrushTargetLevel(radiusMeters: number): Level {
  const safeR = Math.max(0.1, radiusMeters);
  const raw = Math.round(Math.log2(safeR / (8 * S0)));
  return clamp(raw, 0, MAX_LEVEL) as Level;
}

/**
 * Built-in kernels for standard sculpt operations on TerrainField
 */
export function createSculptKernel(
  mode: 'raise' | 'lower' | 'flatten' | 'smooth' | 'terrace' | 'noise',
  strength: number,
  targetElevation?: number
): BrushKernel {
  return (x, z, rNorm, sample, dt) => {
    const falloff = 1.0 - smoothstep(0, 1, rNorm);
    const amount = strength * falloff * dt;

    switch (mode) {
      case 'raise':
        return sample.editDelta + amount * 35;
      case 'lower':
        return sample.editDelta - amount * 35;
      case 'flatten': {
        const target = targetElevation ?? sample.height;
        const desiredDelta = target - (sample.height - sample.editDelta);
        const blend = clamp(amount * 4.5, 0, 1);
        return sample.editDelta + (desiredDelta - sample.editDelta) * blend;
      }
      case 'smooth': {
        const avg = sample.neighborAvg4();
        const diff = avg - sample.height;
        const blend = clamp(amount * 4.0, 0, 0.85);
        return sample.editDelta + diff * blend;
      }
      case 'terrace': {
        const stepMeters = 18;
        const terraced = Math.round(sample.height / stepMeters) * stepMeters;
        const diff = terraced - sample.height;
        const blend = clamp(amount * 4.0, 0, 0.9);
        return sample.editDelta + diff * blend;
      }
      case 'noise': {
        const wave = Math.sin(x * 0.23 + z * 0.17) * Math.cos(x * 0.13 - z * 0.29);
        return sample.editDelta + wave * amount * 30;
      }
    }
  };
}

export class MultiResBrushEngine implements BrushEngine {
  private readonly tileStore: TileStore;
  private readonly terrainField: TerrainField;
  private activeStrokeSnapshots: Map<number, TileSnapshot> | null = null;
  private activeStrokeBounds: Rect | null = null;
  private activeStrokeMinLevel: Level = MAX_LEVEL;
  private readonly undoStack: StrokeRecord[] = [];
  private readonly redoStack: StrokeRecord[] = [];
  private totalUndoBytes = 0;

  constructor(tileStore: TileStore, terrainField: TerrainField) {
    this.tileStore = tileStore;
    this.terrainField = terrainField;
  }

  private getFineL0AreaKm2(): number {
    const l0Tiles = this.tileStore.countTilesAtLevel(0, 'height');
    const spanKm = tileSpan(0) / 1000; // 0.0256 km
    return l0Tiles * spanKm * spanKm;
  }

  selectLevel(radiusMeters: number): Level {
    const ideal = computeBrushTargetLevel(radiusMeters);
    if (ideal === 0 && this.getFineL0AreaKm2() >= MAX_FINE_EDIT_KM2) {
      return 1;
    }
    return ideal;
  }

  estimateCost(radiusMeters: number): BrushCostEstimate {
    const ideal = computeBrushTargetLevel(radiusMeters);
    const fineAreaKm2 = this.getFineL0AreaKm2();
    const clampedByQuota = ideal === 0 && fineAreaKm2 >= MAX_FINE_EDIT_KM2;
    const level: Level = clampedByQuota ? 1 : ideal;
    const quotaWarning80Pct = fineAreaKm2 >= MAX_FINE_EDIT_KM2 * 0.8;

    const spanM = tileSpan(level);
    const tileAreaKm2 = (spanM * spanM) / 1_000_000;
    const tileMB = (TILE * TILE * 2) / (1024 * 1024); // 0.125 MB per tile
    const mbPerKm2 = tileMB / tileAreaKm2;
    const diam = radiusMeters * 2;
    const tilesAcross = Math.ceil(diam / spanM) + 1;

    return {
      level,
      clampedByQuota,
      quotaWarning80Pct,
      fineAreaKm2,
      maxFineAreaKm2: MAX_FINE_EDIT_KM2,
      mbPerKm2,
      estimatedTilesForStroke: tilesAcross * tilesAcross,
    };
  }

  beginStroke(): void {
    this.activeStrokeSnapshots = new Map<number, TileSnapshot>();
    this.activeStrokeBounds = null;
    this.activeStrokeMinLevel = MAX_LEVEL;
  }

  applyStamp(s: BrushStamp, dt = 0.05): Rect {
    const autoManageStroke = this.activeStrokeSnapshots === null;
    if (autoManageStroke) {
      this.beginStroke();
    }

    const r = Math.max(0.1, s.radius);
    const level = this.selectLevel(r);
    if (level < this.activeStrokeMinLevel) {
      this.activeStrokeMinLevel = level;
    }

    const rect: Rect = {
      minX: clamp(s.x - r, -HALF, HALF),
      minZ: clamp(s.z - r, -HALF, HALF),
      maxX: clamp(s.x + r, -HALF, HALF),
      maxZ: clamp(s.z + r, -HALF, HALF),
    };

    if (!this.activeStrokeBounds) {
      this.activeStrokeBounds = { ...rect };
    } else {
      this.activeStrokeBounds.minX = Math.min(this.activeStrokeBounds.minX, rect.minX);
      this.activeStrokeBounds.minZ = Math.min(this.activeStrokeBounds.minZ, rect.minZ);
      this.activeStrokeBounds.maxX = Math.max(this.activeStrokeBounds.maxX, rect.maxX);
      this.activeStrokeBounds.maxZ = Math.max(this.activeStrokeBounds.maxZ, rect.maxZ);
    }

    const [minTx, minTz] = worldToTileCoord(rect.minX, rect.minZ, level);
    const [maxTx, maxTz] = worldToTileCoord(rect.maxX, rect.maxZ, level);
    const span = tileSpan(level);
    const step = spacing(level);

    const floatBuf = new Float32Array(TILE * TILE);
    const prevBuf = new Float32Array(TILE * TILE);

    for (let tz = minTz; tz <= maxTz; tz++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const key = tileKey(level, tx, tz, 'height');
        const existing = this.tileStore.get(level, tx, tz, 'height');

        if (this.activeStrokeSnapshots && !this.activeStrokeSnapshots.has(key)) {
          this.activeStrokeSnapshots.set(key, {
            level,
            tx,
            tz,
            existedBefore: Boolean(existing),
            beforeMin: existing ? existing.min : 0,
            beforeScale: existing ? existing.scale : 0,
            beforeData: existing ? new Int16Array(existing.data) : null,
            existedAfter: false,
            afterMin: 0,
            afterScale: 0,
            afterData: null,
          });
        }

        // Decode current float deltas for this tile
        if (existing && existing.scale !== 0) {
          for (let i = 0; i < TILE * TILE; i++) {
            const v = existing.min + (existing.data[i] + 32768) * existing.scale;
            floatBuf[i] = v;
            prevBuf[i] = v;
          }
        } else {
          floatBuf.fill(0);
          prevBuf.fill(0);
        }

        const tileOriginX = -HALF + tx * span;
        const tileOriginZ = -HALF + tz * span;

        const minLx = clamp(Math.floor((rect.minX - tileOriginX) / step), 0, TILE - 1);
        const maxLx = clamp(Math.ceil((rect.maxX - tileOriginX) / step), 0, TILE - 1);
        const minLz = clamp(Math.floor((rect.minZ - tileOriginZ) / step), 0, TILE - 1);
        const maxLz = clamp(Math.ceil((rect.maxZ - tileOriginZ) / step), 0, TILE - 1);

        let modified = false;

        for (let lz = minLz; lz <= maxLz; lz++) {
          const wz = tileOriginZ + lz * step;
          const dz = wz - s.z;
          for (let lx = minLx; lx <= maxLx; lx++) {
            const wx = tileOriginX + lx * step;
            const dx = wx - s.x;
            const dist = Math.hypot(dx, dz);
            if (dist > r) continue;

            const rNorm = dist / r;
            const cellIdx = lz * TILE + lx;
            const curEditDelta = prevBuf[cellIdx];
            const baseH = this.terrainField.sampleBaseHeight(wx, wz);
            const curTotalH = this.terrainField.sampleHeight(wx, wz, level);

            const accessor: SampleAccessor = {
              height: curTotalH,
              baseHeight: baseH,
              editDelta: curEditDelta,
              neighborAvg4: () => {
                const xm = Math.max(0, lx - 1);
                const xp = Math.min(TILE - 1, lx + 1);
                const zm = Math.max(0, lz - 1);
                const zp = Math.min(TILE - 1, lz + 1);
                const dAvg =
                  0.25 *
                  (prevBuf[lz * TILE + xm] +
                    prevBuf[lz * TILE + xp] +
                    prevBuf[zm * TILE + lx] +
                    prevBuf[zp * TILE + lx]);
                return curTotalH - curEditDelta + dAvg;
              },
            };

            const nextDelta = s.kernel(wx, wz, rNorm, accessor, dt);
            if (Number.isFinite(nextDelta) && Math.abs(nextDelta - curEditDelta) > 1e-6) {
              floatBuf[cellIdx] = nextDelta;
              modified = true;
            }
          }
        }

        if (modified) {
          const targetTile = this.tileStore.getOrCreate(level, tx, tz, 'height');
          writeFloatTile(targetTile, floatBuf);
          this.tileStore.compactIfZero(level, tx, tz, 'height');
        }
      }
    }

    // Optional splat painting at Level 3 (0.8 m spacing) when splatId is provided
    if (s.splatId !== undefined) {
      this.applySplatStamp(s.x, s.z, r, s.splatId, s.strength * dt);
    }

    this.terrainField.notifyChanged(rect, level);

    if (autoManageStroke) {
      this.endStroke();
    }

    return rect;
  }

  private applySplatStamp(
    cx: number,
    cz: number,
    radius: number,
    splatId: number,
    amount: number
  ): void {
    const splatLevel: Level = 3; // 0.8 m spacing as specified in Section 9
    const span = tileSpan(splatLevel);
    const step = spacing(splatLevel);
    const rect: Rect = {
      minX: clamp(cx - radius, -HALF, HALF),
      minZ: clamp(cz - radius, -HALF, HALF),
      maxX: clamp(cx + radius, -HALF, HALF),
      maxZ: clamp(cz + radius, -HALF, HALF),
    };
    const [minTx, minTz] = worldToTileCoord(rect.minX, rect.minZ, splatLevel);
    const [maxTx, maxTz] = worldToTileCoord(rect.maxX, rect.maxZ, splatLevel);
    const floatBuf = new Float32Array(TILE * TILE);

    for (let tz = minTz; tz <= maxTz; tz++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const existing = this.tileStore.get(splatLevel, tx, tz, 'splat');
        if (existing && existing.scale !== 0) {
          for (let i = 0; i < TILE * TILE; i++) {
            floatBuf[i] = decodeTileValue(existing, i);
          }
        } else {
          floatBuf.fill(0);
        }

        const tileOriginX = -HALF + tx * span;
        const tileOriginZ = -HALF + tz * span;
        const minLx = clamp(Math.floor((rect.minX - tileOriginX) / step), 0, TILE - 1);
        const maxLx = clamp(Math.ceil((rect.maxX - tileOriginX) / step), 0, TILE - 1);
        const minLz = clamp(Math.floor((rect.minZ - tileOriginZ) / step), 0, TILE - 1);
        const maxLz = clamp(Math.ceil((rect.maxZ - tileOriginZ) / step), 0, TILE - 1);

        let modified = false;
        for (let lz = minLz; lz <= maxLz; lz++) {
          const wz = tileOriginZ + lz * step;
          for (let lx = minLx; lx <= maxLx; lx++) {
            const wx = tileOriginX + lx * step;
            const dist = Math.hypot(wx - cx, wz - cz);
            if (dist > radius) continue;
            const w = (1.0 - smoothstep(0, 1, dist / radius)) * clamp(amount * 6, 0.05, 1);
            if (w > 0.25) {
              // Encode 1-based splatId in integer part
              floatBuf[lz * TILE + lx] = splatId + 1;
              modified = true;
            }
          }
        }

        if (modified) {
          const tile = this.tileStore.getOrCreate(splatLevel, tx, tz, 'splat');
          writeFloatTile(tile, floatBuf);
        }
      }
    }
  }

  endStroke(): void {
    if (!this.activeStrokeSnapshots) return;

    const snapshots: TileSnapshot[] = [];
    let byteSize = 0;

    for (const snap of this.activeStrokeSnapshots.values()) {
      const afterTile = this.tileStore.get(snap.level, snap.tx, snap.tz, 'height');
      if (afterTile) {
        snap.existedAfter = true;
        snap.afterMin = afterTile.min;
        snap.afterScale = afterTile.scale;
        snap.afterData = new Int16Array(afterTile.data);
      } else {
        snap.existedAfter = false;
        snap.afterMin = 0;
        snap.afterScale = 0;
        snap.afterData = null;
      }

      if (snap.existedBefore || snap.existedAfter) {
        snapshots.push(snap);
        byteSize +=
          (snap.beforeData ? snap.beforeData.byteLength : 0) +
          (snap.afterData ? snap.afterData.byteLength : 0);
      }
    }

    if (snapshots.length > 0 && this.activeStrokeBounds) {
      const record: StrokeRecord = {
        tiles: snapshots,
        bounds: this.activeStrokeBounds,
        minLevel: this.activeStrokeMinLevel,
        byteSize,
      };
      this.undoStack.push(record);
      this.totalUndoBytes += byteSize;
      this.redoStack.length = 0;

      while (
        this.undoStack.length > MAX_UNDO_STROKES ||
        (this.undoStack.length > 1 && this.totalUndoBytes > MAX_UNDO_BYTES)
      ) {
        const oldest = this.undoStack.shift();
        if (oldest) {
          this.totalUndoBytes -= oldest.byteSize;
        }
      }
    }

    this.activeStrokeSnapshots = null;
    this.activeStrokeBounds = null;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): Rect | null {
    const rec = this.undoStack.pop();
    if (!rec) return null;
    this.totalUndoBytes -= rec.byteSize;

    for (const snap of rec.tiles) {
      if (!snap.existedBefore || !snap.beforeData) {
        this.tileStore.delete(snap.level, snap.tx, snap.tz, 'height');
      } else {
        const tile = this.tileStore.getOrCreate(snap.level, snap.tx, snap.tz, 'height');
        tile.min = snap.beforeMin;
        tile.scale = snap.beforeScale;
        tile.data.set(snap.beforeData);
        tile.dirty = true;
      }
    }

    this.redoStack.push(rec);
    this.terrainField.notifyChanged(rec.bounds, rec.minLevel);
    return rec.bounds;
  }

  redo(): Rect | null {
    const rec = this.redoStack.pop();
    if (!rec) return null;
    this.totalUndoBytes += rec.byteSize;

    for (const snap of rec.tiles) {
      if (!snap.existedAfter || !snap.afterData) {
        this.tileStore.delete(snap.level, snap.tx, snap.tz, 'height');
      } else {
        const tile = this.tileStore.getOrCreate(snap.level, snap.tx, snap.tz, 'height');
        tile.min = snap.afterMin;
        tile.scale = snap.afterScale;
        tile.data.set(snap.afterData);
        tile.dirty = true;
      }
    }

    this.undoStack.push(rec);
    this.terrainField.notifyChanged(rec.bounds, rec.minLevel);
    return rec.bounds;
  }
}
