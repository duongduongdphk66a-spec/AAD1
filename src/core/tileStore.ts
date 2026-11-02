import {
  HALF,
  Level,
  MAX_LEVEL,
  Rect,
  TILE,
  TileKey,
  spacing,
  tileKey,
  tileKeyToWorldRect,
  unpackTileKey,
} from './units';

export type TileKind = 'edit' | 'height' | 'splat';

export interface Tile {
  key: TileKey;
  kind: TileKind;
  level: Level;
  tx: number;
  tz: number;
  data: Int16Array; // TILE * TILE quantized samples: u16 = data[i] + 32768 -> value = min + u16 * scale
  min: number;
  scale: number;
  dirty: boolean;
  lastUsed: number;
  version: number;
}

export interface TilePersistence {
  load(worldId: string, kind: TileKind, key: TileKey): Promise<Uint8Array | null>;
  saveBatch(
    worldId: string,
    entries: { kind: TileKind; key: TileKey; bytes: Uint8Array }[]
  ): Promise<void>;
  listKeys(worldId: string, kind: TileKind): Promise<TileKey[]>;
  clear(worldId: string): Promise<void>;
}

export interface TileStoreStats {
  tiles: number;
  bytes: number;
  dirty: number;
  resident: number;
  edited: number;
  bytesResident: number;
  bytesEdited: number;
  fineEditTilesL0: number;
}

export interface TileStore {
  get(level: Level, tx: number, tz: number, kind?: TileKind): Tile | undefined;
  getByKey(kind: TileKind, key: TileKey): Tile | undefined;
  getOrCreate(level: Level, tx: number, tz: number, kind?: TileKind): Tile;
  delete(level: Level, tx: number, tz: number, kind?: TileKind): boolean;
  compactIfZero(level: Level, tx: number, tz: number, kind?: TileKind): boolean;
  countTilesAtLevel(level: Level, kind?: TileKind): number;
  activeLevelMask(): number;
  entries(): Tile[];
  clear(): void;
  ensure(kind: TileKind, key: TileKey, create?: boolean): Promise<Tile | undefined>;
  read(kind: TileKind, level: number, ix: number, iz: number): number;
  write(kind: TileKind, level: number, ix: number, iz: number, v: number): void;
  edited(kind: TileKind): Iterable<TileKey>;
  stats(): TileStoreStats;
  flush(): Promise<void>;
  evict(): void;
  onDirty(fn: (key: TileKey, rect: Rect) => void): () => void;
}

const QUANT_OFFSET = 32768;
const QUANT_STEPS = 65535;
const BYTES_PER_TILE = TILE * TILE * 2; // 131,072 bytes (128 KB)
const DEFAULT_MAX_RESIDENT_TILES = 512; // 512 * 128 KB = 64 MB

export function dequantizeSample(rawInt16: number, min: number, scale: number): number {
  if (scale === 0) return min;
  return min + (rawInt16 + QUANT_OFFSET) * scale;
}

export function decodeTileValue(tile: Tile, idx: number): number {
  if (tile.scale === 0) return tile.min;
  return tile.min + (tile.data[idx] + QUANT_OFFSET) * tile.scale;
}

export function quantizeSample(value: number, min: number, scale: number): number {
  if (scale <= 0) return -QUANT_OFFSET;
  const norm = Math.round((value - min) / scale);
  const clamped = Math.max(0, Math.min(QUANT_STEPS, norm));
  return clamped - QUANT_OFFSET;
}

/**
 * Encodes a 256x256 Float32Array into a quantized Int16 Tile, dynamically computing
 * (min, scale) to cover [minVal, maxVal] with 16-bit precision.
 */
export function writeFloatTile(tile: Tile, floatValues: Float32Array): void {
  let minVal = Infinity;
  let maxVal = -Infinity;
  let allZero = true;

  for (let i = 0; i < TILE * TILE; i++) {
    const v = floatValues[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
    if (Math.abs(v) > 1e-6) allZero = false;
  }

  if (allZero || !Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    tile.min = 0;
    tile.scale = 0;
    tile.data.fill(-QUANT_OFFSET);
    tile.dirty = true;
    tile.version++;
    return;
  }

  const range = maxVal - minVal;
  if (range < 1e-6) {
    tile.min = Math.fround(minVal);
    tile.scale = Math.fround(1e-5);
    tile.data.fill(-QUANT_OFFSET);
    tile.dirty = true;
    tile.version++;
    return;
  }

  const fMin = Math.fround(minVal);
  const fScale = Math.fround(range / QUANT_STEPS);
  const invScale = 1.0 / fScale;
  tile.min = fMin;
  tile.scale = fScale;

  for (let i = 0; i < TILE * TILE; i++) {
    const q = Math.round((floatValues[i] - fMin) * invScale);
    const clamped = q < 0 ? 0 : q > QUANT_STEPS ? QUANT_STEPS : q;
    tile.data[i] = clamped - QUANT_OFFSET;
  }
  tile.dirty = true;
  tile.version++;
}

export function createZeroTile(kind: TileKind, key: TileKey): Tile {
  const { level, tx, tz } = unpackTileKey(key);
  const data = new Int16Array(TILE * TILE);
  data.fill(-QUANT_OFFSET);
  return {
    key,
    kind: kind === 'edit' ? 'height' : kind,
    level,
    tx,
    tz,
    data,
    min: 0,
    scale: 0,
    dirty: false,
    lastUsed: performance.now(),
    version: 1,
  };
}

export function serializeTileToBytes(tile: Tile): Uint8Array {
  const buf = new ArrayBuffer(8 + BYTES_PER_TILE);
  const view = new DataView(buf);
  view.setFloat32(0, tile.min, true);
  view.setFloat32(4, tile.scale, true);
  new Int16Array(buf, 8, TILE * TILE).set(tile.data);
  return new Uint8Array(buf);
}

export function deserializeTileFromBytes(
  kind: TileKind,
  key: TileKey,
  bytes: Uint8Array
): Tile {
  const { level, tx, tz } = unpackTileKey(key);
  const aligned = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const view = new DataView(aligned);
  const min = view.getFloat32(0, true);
  const scale = view.getFloat32(4, true);
  const data = new Int16Array(TILE * TILE);
  if (aligned.byteLength >= 8 + BYTES_PER_TILE) {
    data.set(new Int16Array(aligned, 8, TILE * TILE));
  } else {
    data.fill(-QUANT_OFFSET);
  }
  return {
    key,
    kind: kind === 'edit' ? 'height' : kind,
    level,
    tx,
    tz,
    data,
    min,
    scale,
    dirty: false,
    lastUsed: performance.now(),
    version: 1,
  };
}

export class InMemoryTilePersistence implements TilePersistence {
  private store = new Map<string, Uint8Array>();

  private makeKey(worldId: string, kind: TileKind, key: TileKey): string {
    const normKind = kind === 'edit' ? 'height' : kind;
    return `${worldId}:${normKind}:${key}`;
  }

  async load(worldId: string, kind: TileKind, key: TileKey): Promise<Uint8Array | null> {
    const found = this.store.get(this.makeKey(worldId, kind, key));
    return found ? new Uint8Array(found) : null;
  }

  async saveBatch(
    worldId: string,
    entries: { kind: TileKind; key: TileKey; bytes: Uint8Array }[]
  ): Promise<void> {
    for (const entry of entries) {
      this.store.set(this.makeKey(worldId, entry.kind, entry.key), new Uint8Array(entry.bytes));
    }
  }

  async listKeys(worldId: string, kind: TileKind): Promise<TileKey[]> {
    const normKind = kind === 'edit' ? 'height' : kind;
    const prefix = `${worldId}:${normKind}:`;
    const keys: TileKey[] = [];
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        keys.push(Number(k.slice(prefix.length)));
      }
    }
    return keys;
  }

  async clear(worldId: string): Promise<void> {
    const prefix = `${worldId}:`;
    for (const k of Array.from(this.store.keys())) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }
}

export class IndexedDbTilePersistence implements TilePersistence {
  private fallback = new InMemoryTilePersistence();
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  public hasIndexedDbError = false;
  private dbName: string;

  constructor(dbName = 'aetherterra_v3_tiles') {
    this.dbName = dbName;
  }

  private getDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') {
      return Promise.resolve(null);
    }
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open(this.dbName, 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains('tiles')) {
              db.createObjectStore('tiles');
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => {
            this.hasIndexedDbError = true;
            resolve(null);
          };
        } catch {
          this.hasIndexedDbError = true;
          resolve(null);
        }
      });
    }
    return this.dbPromise;
  }

  async load(worldId: string, kind: TileKind, key: TileKey): Promise<Uint8Array | null> {
    const db = await this.getDb();
    if (!db) return this.fallback.load(worldId, kind, key);
    const normKind = kind === 'edit' ? 'height' : kind;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('tiles', 'readonly');
        const store = tx.objectStore('tiles');
        const req = store.get(`${worldId}:${normKind}:${key}`);
        req.onsuccess = () => {
          const res = req.result;
          resolve(res instanceof Uint8Array ? res : null);
        };
        req.onerror = () => resolve(this.fallback.load(worldId, kind, key));
      } catch {
        this.hasIndexedDbError = true;
        resolve(this.fallback.load(worldId, kind, key));
      }
    });
  }

  async saveBatch(
    worldId: string,
    entries: { kind: TileKind; key: TileKey; bytes: Uint8Array }[]
  ): Promise<void> {
    await this.fallback.saveBatch(worldId, entries);
    const db = await this.getDb();
    if (!db) return;

    const batchSize = 64;
    for (let i = 0; i < entries.length; i += batchSize) {
      const slice = entries.slice(i, i + batchSize);
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction('tiles', 'readwrite');
          const store = tx.objectStore('tiles');
          for (const item of slice) {
            const normKind = item.kind === 'edit' ? 'height' : item.kind;
            store.put(item.bytes, `${worldId}:${normKind}:${item.key}`);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => {
            this.hasIndexedDbError = true;
            resolve();
          };
        } catch {
          this.hasIndexedDbError = true;
          resolve();
        }
      });
    }
  }

  async listKeys(worldId: string, kind: TileKind): Promise<TileKey[]> {
    return this.fallback.listKeys(worldId, kind);
  }

  async clear(worldId: string): Promise<void> {
    await this.fallback.clear(worldId);
  }
}

export class SparseTileStore implements TileStore {
  private editTiles = new Map<TileKey, Tile>();
  private splatTiles = new Map<TileKey, Tile>();
  private dirtyListeners = new Set<(key: TileKey, rect: Rect) => void>();
  private persistence: TilePersistence;
  private worldId: string;
  private maxResidentTiles: number;
  private accessCounter = 1;

  constructor(
    maxResidentOrOptions?:
      | number
      | {
          worldId?: string;
          persistence?: TilePersistence;
          maxResidentTiles?: number;
        },
    persistenceArg?: TilePersistence
  ) {
    if (typeof maxResidentOrOptions === 'number') {
      this.maxResidentTiles = maxResidentOrOptions;
      this.persistence = persistenceArg ?? new InMemoryTilePersistence();
      this.worldId = 'default-world';
    } else {
      this.worldId = maxResidentOrOptions?.worldId ?? 'default-world';
      this.persistence =
        persistenceArg ?? maxResidentOrOptions?.persistence ?? new InMemoryTilePersistence();
      this.maxResidentTiles = maxResidentOrOptions?.maxResidentTiles ?? DEFAULT_MAX_RESIDENT_TILES;
    }
  }

  private getMap(kind: TileKind = 'height'): Map<TileKey, Tile> {
    return kind === 'splat' ? this.splatTiles : this.editTiles;
  }

  get(level: Level, tx: number, tz: number, kind: TileKind = 'height'): Tile | undefined {
    const key = tileKey(level, tx, tz, kind);
    return this.getByKey(kind, key);
  }

  getByKey(kind: TileKind, key: TileKey): Tile | undefined {
    const map = this.getMap(kind);
    const tile = map.get(key);
    if (tile) {
      tile.lastUsed = ++this.accessCounter;
    }
    return tile;
  }

  getOrCreate(level: Level, tx: number, tz: number, kind: TileKind = 'height'): Tile {
    const key = tileKey(level, tx, tz, kind);
    const map = this.getMap(kind);
    let tile = map.get(key);
    if (!tile) {
      tile = createZeroTile(kind, key);
      tile.lastUsed = ++this.accessCounter;
      map.set(key, tile);
      this.evictIfNeeded();
    } else {
      tile.lastUsed = ++this.accessCounter;
    }
    return tile;
  }

  delete(level: Level, tx: number, tz: number, kind: TileKind = 'height'): boolean {
    const key = tileKey(level, tx, tz, kind);
    return this.getMap(kind).delete(key);
  }

  compactIfZero(level: Level, tx: number, tz: number, kind: TileKind = 'height'): boolean {
    const key = tileKey(level, tx, tz, kind);
    const map = this.getMap(kind);
    const tile = map.get(key);
    if (!tile) return false;
    if (this.isTileAllZero(tile)) {
      map.delete(key);
      return true;
    }
    return false;
  }

  countTilesAtLevel(level: Level, kind: TileKind = 'height'): number {
    const map = this.getMap(kind);
    let count = 0;
    for (const t of map.values()) {
      if (t.level === level) count++;
    }
    return count;
  }

  activeLevelMask(): number {
    if (this.editTiles.size === 0) return 0;
    let mask = 0;
    for (const t of this.editTiles.values()) {
      if (t.scale !== 0 || t.min !== 0) {
        mask |= 1 << t.level;
      }
    }
    return mask;
  }

  entries(): Tile[] {
    return [
      ...Array.from(this.editTiles.values()),
      ...Array.from(this.splatTiles.values()),
    ];
  }

  clear(): void {
    this.editTiles.clear();
    this.splatTiles.clear();
  }

  async ensure(kind: TileKind, key: TileKey, create = false): Promise<Tile | undefined> {
    const existing = this.getByKey(kind, key);
    if (existing) return existing;

    const bytes = await this.persistence.load(this.worldId, kind, key);
    if (bytes) {
      const loaded = deserializeTileFromBytes(kind, key, bytes);
      loaded.lastUsed = ++this.accessCounter;
      this.getMap(kind).set(key, loaded);
      this.evictIfNeeded();
      return loaded;
    }

    if (create) {
      const created = createZeroTile(kind, key);
      created.lastUsed = ++this.accessCounter;
      this.getMap(kind).set(key, created);
      this.evictIfNeeded();
      return created;
    }
    return undefined;
  }

  read(kind: TileKind, level: number, ix: number, iz: number): number {
    if (level < 0 || level > MAX_LEVEL || ix < 0 || iz < 0) return 0;
    const tx = Math.floor(ix / TILE);
    const tz = Math.floor(iz / TILE);
    if (tx >= 1024 || tz >= 1024) return 0;

    const key = tileKey(level, tx, tz, kind);
    const tile = this.getByKey(kind, key);
    if (!tile) return 0;

    const lx = ix - tx * TILE;
    const lz = iz - tz * TILE;
    const raw = tile.data[lz * TILE + lx];
    return dequantizeSample(raw, tile.min, tile.scale);
  }

  write(kind: TileKind, level: number, ix: number, iz: number, v: number): void {
    if (level < 0 || level > MAX_LEVEL || ix < 0 || iz < 0) return;
    const tx = Math.floor(ix / TILE);
    const tz = Math.floor(iz / TILE);
    if (tx >= 1024 || tz >= 1024) return;

    const key = tileKey(level, tx, tz, kind);
    const map = this.getMap(kind);
    let tile = map.get(key);

    if (!tile) {
      if (Math.abs(v) < 1e-6) return;
      tile = createZeroTile(kind, key);
      if (kind === 'splat') {
        tile.min = 0;
        tile.scale = 255 / QUANT_STEPS;
      } else {
        const span = Math.max(2.0, Math.abs(v) * 2.5);
        tile.min = -span;
        tile.scale = (span * 2) / QUANT_STEPS;
        const zeroQ = quantizeSample(0, tile.min, tile.scale);
        tile.data.fill(zeroQ);
      }
      map.set(key, tile);
      this.evictIfNeeded();
    }

    const currentMax = tile.min + QUANT_STEPS * tile.scale;
    if (tile.scale <= 0 || v < tile.min || v > currentMax) {
      this.requantizeTileToInclude(tile, v);
    }

    const lx = ix - tx * TILE;
    const lz = iz - tz * TILE;
    const idx = lz * TILE + lx;
    const q = quantizeSample(v, tile.min, tile.scale);
    tile.data[idx] = q;
    tile.dirty = true;
    tile.lastUsed = ++this.accessCounter;
    tile.version++;

    if (Math.abs(v) < 1e-5 && this.isTileAllZero(tile)) {
      map.delete(key);
    }

    const rect = tileKeyToWorldRect(key);
    for (const fn of this.dirtyListeners) {
      fn(key, rect);
    }
  }

  private requantizeTileToInclude(tile: Tile, incomingValue: number): void {
    const oldMin = tile.min;
    const oldScale = tile.scale;
    const data = tile.data;

    let minVal = Math.min(0, incomingValue);
    let maxVal = Math.max(0, incomingValue);

    if (oldScale > 0) {
      for (let i = 0; i < data.length; i++) {
        const val = dequantizeSample(data[i], oldMin, oldScale);
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }

    const margin = Math.max(0.5, (maxVal - minVal) * 0.15);
    const newMin = minVal - margin;
    const newMax = maxVal + margin;
    const newScale = (newMax - newMin) / QUANT_STEPS;

    for (let i = 0; i < data.length; i++) {
      const val = oldScale > 0 ? dequantizeSample(data[i], oldMin, oldScale) : 0;
      data[i] = quantizeSample(val, newMin, newScale);
    }

    tile.min = newMin;
    tile.scale = newScale;
  }

  private isTileAllZero(tile: Tile): boolean {
    if (tile.scale === 0) return Math.abs(tile.min) < 1e-5;
    const zeroTol = Math.max(1e-4, tile.scale * 1.5);
    for (let i = 0; i < tile.data.length; i++) {
      const val = dequantizeSample(tile.data[i], tile.min, tile.scale);
      if (Math.abs(val) > zeroTol) return false;
    }
    return true;
  }

  edited(kind: TileKind): Iterable<TileKey> {
    return Array.from(this.getMap(kind).keys());
  }

  stats(): TileStoreStats {
    const editCount = this.editTiles.size;
    const splatCount = this.splatTiles.size;
    const resident = editCount + splatCount;
    let fineEditTilesL0 = 0;
    let dirty = 0;
    for (const t of this.editTiles.values()) {
      if (t.level === 0) fineEditTilesL0++;
      if (t.dirty) dirty++;
    }
    for (const t of this.splatTiles.values()) {
      if (t.dirty) dirty++;
    }
    const bytes = resident * BYTES_PER_TILE;
    return {
      tiles: resident,
      bytes,
      dirty,
      resident,
      edited: resident,
      bytesResident: bytes,
      bytesEdited: bytes,
      fineEditTilesL0,
    };
  }

  async flush(): Promise<void> {
    const batch: { kind: TileKind; key: TileKey; bytes: Uint8Array }[] = [];
    for (const tile of this.editTiles.values()) {
      if (tile.dirty) {
        batch.push({ kind: 'height', key: tile.key, bytes: serializeTileToBytes(tile) });
        tile.dirty = false;
      }
    }
    for (const tile of this.splatTiles.values()) {
      if (tile.dirty) {
        batch.push({ kind: 'splat', key: tile.key, bytes: serializeTileToBytes(tile) });
        tile.dirty = false;
      }
    }
    if (batch.length > 0) {
      await this.persistence.saveBatch(this.worldId, batch);
    }
  }

  private evictIfNeeded(): void {
    const total = this.editTiles.size + this.splatTiles.size;
    if (total > this.maxResidentTiles) {
      this.evict();
    }
  }

  evict(): void {
    const total = this.editTiles.size + this.splatTiles.size;
    if (total <= this.maxResidentTiles) return;

    const candidates: Array<{ map: Map<TileKey, Tile>; key: TileKey; lastUsed: number }> = [];
    for (const [k, t] of this.editTiles.entries()) {
      if (!t.dirty) candidates.push({ map: this.editTiles, key: k, lastUsed: t.lastUsed });
    }
    for (const [k, t] of this.splatTiles.entries()) {
      if (!t.dirty) candidates.push({ map: this.splatTiles, key: k, lastUsed: t.lastUsed });
    }

    candidates.sort((a, b) => a.lastUsed - b.lastUsed);
    const toRemove = Math.min(candidates.length, total - this.maxResidentTiles);
    for (let i = 0; i < toRemove; i++) {
      candidates[i].map.delete(candidates[i].key);
    }
  }

  onDirty(fn: (key: TileKey, rect: Rect) => void): () => void {
    this.dirtyListeners.add(fn);
    return () => {
      this.dirtyListeners.delete(fn);
    };
  }
}
