import { validateWorldSavePayload } from '../world/generation';
import {
  BIOMES,
  BiomeId,
  MicroStrokeStamp,
  PREFAB_CATALOG,
  PlacedObject,
  PrefabId,
  TEXTURE_INDEX_MAP,
  TextureBrushId,
} from '../world/registry';
import { Link } from './linkSystem';
import { Stamp } from './stampSystem';
import { Tile, TileKind } from './tileStore';
import {
  BASE_N,
  HALF,
  Level,
  MAX_LEVEL,
  TILE,
  maxTileCoordForLevel,
} from './units';

export interface SerializedSplatLayer {
  id: number;
  name: string;
  albedoHex: string;
  roughness: number;
  slopeBias: number;
  heightRange: [number, number];
}

export interface WorldSaveV3 {
  version: 3;
  seed: number;
  worldSize: 10000;
  baseHeight: Float32Array; // 161 x 161
  baseSplat: Uint8Array; // 161 x 161 x 4
  tiles: Array<{
    level: Level;
    tx: number;
    tz: number;
    kind: TileKind;
    min: number;
    scale: number;
    data: Int16Array;
    version?: number;
  }>;
  objects: PlacedObject[];
  stamps: Stamp[];
  links: Link[];
  splatLayers?: SerializedSplatLayer[];
  microStrokes?: MicroStrokeStamp[];
  settings?: {
    biomeId: BiomeId;
    waterLevel: number;
    regionTitle: string;
  };
}

export interface WorldIO {
  exportAtw(state: WorldSaveV3): Promise<Blob>;
  importAtw(blob: Blob): Promise<WorldSaveV3>;
  migrateV2ToV3(v2Json: unknown): WorldSaveV3;
}

const ATW_MAGIC = 'ATW3';
const ATW_VERSION = 3;

export const MAX_META_DECOMPRESSED_BYTES = 32 * 1024 * 1024; // 32 MB ceiling for META JSON
export const EXACT_BASE_DECOMPRESSED_BYTES = BASE_N * BASE_N * 4 * 2; // 207,368 bytes
export const EXACT_TILE_DECOMPRESSED_BYTES = 20 + TILE * TILE * 2; // 131,092 bytes
export const MAX_TOTAL_DECOMPRESSED_BYTES = 256 * 1024 * 1024; // ~1,900 tiles (256 MB total across all chunks)
export const MAX_ATW_COMPRESSED_BYTES = 64 * 1024 * 1024; // 64 MB ceiling for compressed .atw archive
export const MAX_ATW_CHUNKS = 2048;
export const ATW_CHUNK_WARNING_THRESHOLD = Math.floor((MAX_ATW_CHUNKS - 2) * 0.8); // 1,636 tiles (80% of ceiling)

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) {
    c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function validateSettingsV3(raw: unknown): WorldSaveV3['settings'] | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const s = raw as Record<string, unknown>;
  return {
    biomeId:
      typeof s.biomeId === 'string' && Object.hasOwn(BIOMES, s.biomeId)
        ? (s.biomeId as BiomeId)
        : 'mondstadt_meadow',
    waterLevel:
      typeof s.waterLevel === 'number' && Number.isFinite(s.waterLevel)
        ? Math.min(5000, Math.max(-2000, s.waterLevel))
        : 0,
    regionTitle: typeof s.regionTitle === 'string' ? s.regionTitle.slice(0, 120) : '',
  };
}

const VALID_PREFAB_IDS = new Set<string>(PREFAB_CATALOG.map((p) => p.id));
const VALID_TEXTURE_IDS = new Set<string>(TEXTURE_INDEX_MAP);
const VALID_LINK_KINDS = new Set<string>(['path', 'bridge', 'stairs', 'wall']);

export async function compressGzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error(
      'Môi trường hiện tại thiếu CompressionStream (gzip) nên không thể nén dữ liệu .atw.'
    );
  }
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  const writeTask = (async () => {
    await writer.write(bytes as unknown as BufferSource);
    await writer.close();
  })();
  const readTask = new Response(cs.readable).arrayBuffer();
  const [, ab] = await Promise.all([writeTask, readTask]);
  return new Uint8Array(ab);
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

/**
 * Bounded streaming Gzip decompression that enforces `maxOutputBytes` (and optional `exactOutputBytes`)
 * on-the-fly during decompression, aborting immediately on a gzip bomb without buffering excess memory.
 */
export async function decompressGzipBounded(
  bytes: Uint8Array,
  maxOutputBytes: number,
  exactOutputBytes?: number
): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Môi trường hiện tại thiếu DecompressionStream (gzip) nên không thể giải nén tệp .atw.'
    );
  }

  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();

  // Feed input asynchronously and suppress stream write cancellation errors when reader aborts early
  const writePromise = (async () => {
    try {
      await writer.write(bytes as unknown as BufferSource);
      await writer.close();
    } catch {
      // Expected if reader cancels early due to exceeding maxOutputBytes
    }
  })();

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxOutputBytes) {
          await reader.cancel('Exceeded maxOutputBytes').catch(() => {});
          throw new Error(
            `Giải nén vượt quá giới hạn an toàn (${maxOutputBytes} byte) — từ chối tệp nghi ngờ gzip bomb`
          );
        }
        chunks.push(value);
      }
    }
  } finally {
    await writePromise;
  }

  if (exactOutputBytes !== undefined && totalBytes !== exactOutputBytes) {
    throw new Error(
      `Kích thước chunk sau giải nén không khớp: nhận ${totalBytes} byte, yêu cầu đúng ${exactOutputBytes} byte`
    );
  }

  return concatUint8Arrays(chunks);
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively checks an unknown JSON value using Object.hasOwn to reject any
 * prototype-pollution keys (__proto__, constructor, prototype).
 */
export function assertSafeJsonKeys(val: unknown, path = 'root'): void {
  if (val === null || typeof val !== 'object') return;
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i++) {
      assertSafeJsonKeys(val[i], `${path}[${i}]`);
    }
    return;
  }
  const proto = Object.getPrototypeOf(val);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error(`Đối tượng không hợp lệ tại ${path}`);
  }
  for (const key of Object.getOwnPropertyNames(val)) {
    if (!Object.hasOwn(val, key) || DANGEROUS_KEYS.has(key)) {
      throw new Error(`Phát hiện khóa không an toàn "${key}" tại ${path}`);
    }
    assertSafeJsonKeys((val as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

function validatePlacedObjectsV3(rawObjects: unknown): PlacedObject[] {
  if (!Array.isArray(rawObjects)) {
    throw new Error('Trường META.objects phải là một mảng');
  }
  if (rawObjects.length > 2000) {
    throw new Error('Số lượng vật thể vượt quá giới hạn tối đa (2000)');
  }
  const out: PlacedObject[] = [];
  for (let i = 0; i < rawObjects.length; i++) {
    const item = rawObjects[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Vật thể tại vị trí [${i}] không hợp lệ`);
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== 'string' || obj.id.trim().length === 0 || obj.id.length > 128) {
      throw new Error(`ID vật thể tại [${i}] không hợp lệ`);
    }
    if (typeof obj.prefabId !== 'string' || !VALID_PREFAB_IDS.has(obj.prefabId)) {
      throw new Error(`Mã mẫu vật thể (prefabId="${String(obj.prefabId)}") tại [${i}] không tồn tại trong danh mục`);
    }
    const x = obj.x;
    const y = obj.y;
    const z = obj.z;
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      typeof z !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z) ||
      x < -HALF ||
      x > HALF ||
      z < -HALF ||
      z > HALF ||
      y < -1000 ||
      y > 2500
    ) {
      throw new Error(`Tọa độ vật thể (x, y, z) tại [${i}] không hợp lệ hoặc ngoài biên bản đồ`);
    }
    const scale = obj.scale;
    if (
      typeof scale !== 'number' ||
      !Number.isFinite(scale) ||
      scale < 0.1 ||
      scale > 10.0
    ) {
      throw new Error(`Tỷ lệ vật thể (scale=${String(scale)}) tại [${i}] phải nằm trong khoảng [0.1, 10]`);
    }
    const rotationY = obj.rotationY === undefined ? 0 : obj.rotationY;
    if (
      typeof rotationY !== 'number' ||
      !Number.isFinite(rotationY) ||
      Math.abs(rotationY) > Math.PI * 10
    ) {
      throw new Error(`Góc xoay vật thể (rotationY) tại [${i}] không hợp lệ`);
    }
    const label =
      typeof obj.label === 'string' && obj.label.trim().length > 0
        ? obj.label.slice(0, 128)
        : obj.prefabId;

    out.push({
      id: obj.id,
      prefabId: obj.prefabId as PrefabId,
      label,
      x,
      y,
      z,
      scale,
      rotationY,
    });
  }
  return out;
}

function validateMicroStrokesV3(rawStrokes: unknown): MicroStrokeStamp[] {
  if (rawStrokes === undefined) return [];
  if (!Array.isArray(rawStrokes)) {
    throw new Error('Trường META.microStrokes phải là một mảng');
  }
  if (rawStrokes.length > 5000) {
    throw new Error('Số lượng nét vẽ vi mô vượt quá giới hạn (5000)');
  }
  const out: MicroStrokeStamp[] = [];
  for (let i = 0; i < rawStrokes.length; i++) {
    const item = rawStrokes[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Nét vẽ microStroke tại [${i}] không hợp lệ`);
    }
    const ms = item as Record<string, unknown>;
    if (typeof ms.id !== 'string' || ms.id.trim().length === 0 || ms.id.length > 128) {
      throw new Error(`ID microStroke tại [${i}] không hợp lệ`);
    }
    const rawBrushId = ms.brushId ?? ms.textureId;
    if (typeof rawBrushId !== 'string' || !VALID_TEXTURE_IDS.has(rawBrushId)) {
      throw new Error(`Kết cấu microStroke (brushId="${String(rawBrushId)}") tại [${i}] không hợp lệ`);
    }
    const x = ms.x;
    const z = ms.z;
    const radius = ms.radius ?? ms.radiusMeters;
    if (
      typeof x !== 'number' ||
      typeof z !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      x < -HALF ||
      x > HALF ||
      z < -HALF ||
      z > HALF
    ) {
      throw new Error(`Tọa độ microStroke tại [${i}] không hợp lệ`);
    }
    if (
      typeof radius !== 'number' ||
      !Number.isFinite(radius) ||
      radius < 0.5 ||
      radius > 500
    ) {
      throw new Error(
        `Bán kính microStroke (radius=${String(radius)}) tại [${i}] vượt ngoài phạm vi [0.5, 500] (không hợp lệ)`
      );
    }
    const grassHeightCm =
      typeof ms.grassHeightCm === 'number' && Number.isFinite(ms.grassHeightCm)
        ? ms.grassHeightCm
        : 4.0;
    if (grassHeightCm < 0.5 || grassHeightCm > 50) {
      throw new Error(`Chiều cao cỏ tại [${i}] không hợp lệ`);
    }
    out.push({
      id: ms.id,
      brushId: rawBrushId as TextureBrushId,
      x,
      z,
      radius,
      grassHeightCm,
      flowerSpecies:
        typeof ms.flowerSpecies === 'string'
          ? (ms.flowerSpecies as MicroStrokeStamp['flowerSpecies'])
          : 'sakura_bloom',
      flowerColorHex:
        typeof ms.flowerColorHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(ms.flowerColorHex)
          ? ms.flowerColorHex
          : '#f472b6',
    });
  }
  return out;
}

function validateStampsV3(rawStamps: unknown): Stamp[] {
  if (rawStamps === undefined) return [];
  if (!Array.isArray(rawStamps)) {
    throw new Error('Trường META.stamps phải là một mảng');
  }
  if (rawStamps.length > 2000) {
    throw new Error('Số lượng tem SDF vượt quá giới hạn (2000)');
  }
  const out: Stamp[] = [];
  for (let i = 0; i < rawStamps.length; i++) {
    const item = rawStamps[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Stamp tại [${i}] không hợp lệ`);
    }
    const s = item as Record<string, unknown>;
    if (typeof s.id !== 'string' || typeof s.objectId !== 'string') {
      throw new Error(`Stamp ID tại [${i}] không hợp lệ`);
    }
    if (
      typeof s.centerX !== 'number' ||
      typeof s.centerZ !== 'number' ||
      typeof s.targetY !== 'number' ||
      typeof s.yaw !== 'number' ||
      typeof s.falloff !== 'number' ||
      typeof s.smoothK !== 'number' ||
      !Number.isFinite(s.centerX) ||
      !Number.isFinite(s.centerZ) ||
      !Number.isFinite(s.targetY) ||
      !Number.isFinite(s.yaw) ||
      !Number.isFinite(s.falloff) ||
      !Number.isFinite(s.smoothK) ||
      s.centerX < -HALF ||
      s.centerX > HALF ||
      s.centerZ < -HALF ||
      s.centerZ > HALF ||
      s.falloff <= 0 ||
      s.falloff > 500 ||
      s.smoothK <= 0 ||
      s.smoothK > 200
    ) {
      throw new Error(`Thông số hình học Stamp tại [${i}] không hợp lệ`);
    }
    out.push(s as unknown as Stamp);
  }
  return out;
}

function validateLinksV3(rawLinks: unknown): Link[] {
  if (rawLinks === undefined) return [];
  if (!Array.isArray(rawLinks)) {
    throw new Error('Trường META.links phải là một mảng');
  }
  if (rawLinks.length > 5000) {
    throw new Error('Số lượng đường nối vượt quá giới hạn (5000)');
  }
  const out: Link[] = [];
  for (let i = 0; i < rawLinks.length; i++) {
    const item = rawLinks[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Link tại [${i}] không hợp lệ`);
    }
    const l = item as Record<string, unknown>;
    const endA = l.a as Record<string, unknown> | undefined;
    const endB = l.b as Record<string, unknown> | undefined;
    const hasValidEndpoints =
      (endA &&
        typeof endA === 'object' &&
        typeof endA.objectId === 'string' &&
        endB &&
        typeof endB === 'object' &&
        typeof endB.objectId === 'string') ||
      (typeof l.fromObjId === 'string' && typeof l.toObjId === 'string');

    if (
      typeof l.id !== 'string' ||
      !hasValidEndpoints ||
      typeof l.kind !== 'string' ||
      !VALID_LINK_KINDS.has(l.kind) ||
      typeof l.width !== 'number' ||
      !Number.isFinite(l.width) ||
      l.width <= 0 ||
      l.width > 100
    ) {
      throw new Error(`Dữ liệu Link tại [${i}] không hợp lệ`);
    }
    out.push(l as unknown as Link);
  }
  return out;
}

function validateSplatLayersV3(rawLayers: unknown): SerializedSplatLayer[] {
  if (rawLayers === undefined) return [];
  if (!Array.isArray(rawLayers)) {
    throw new Error('Trường META.splatLayers phải là một mảng');
  }
  if (rawLayers.length > 32) {
    throw new Error('Số lượng lớp vật liệu splatLayers vượt quá giới hạn (32)');
  }
  const out: SerializedSplatLayer[] = [];
  for (let i = 0; i < rawLayers.length; i++) {
    const item = rawLayers[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Lớp splatLayer tại [${i}] không hợp lệ`);
    }
    const layer = item as Record<string, unknown>;
    if (
      typeof layer.id !== 'number' ||
      !Number.isFinite(layer.id) ||
      typeof layer.name !== 'string' ||
      layer.name.length > 128 ||
      typeof layer.albedoHex !== 'string' ||
      !/^#[0-9a-fA-F]{6}$/.test(layer.albedoHex) ||
      typeof layer.roughness !== 'number' ||
      !Number.isFinite(layer.roughness) ||
      layer.roughness < 0 ||
      layer.roughness > 1 ||
      typeof layer.slopeBias !== 'number' ||
      !Number.isFinite(layer.slopeBias) ||
      !Array.isArray(layer.heightRange) ||
      layer.heightRange.length !== 2 ||
      typeof layer.heightRange[0] !== 'number' ||
      typeof layer.heightRange[1] !== 'number' ||
      !Number.isFinite(layer.heightRange[0]) ||
      !Number.isFinite(layer.heightRange[1])
    ) {
      throw new Error(`Dữ liệu splatLayer tại [${i}] không hợp lệ`);
    }
    out.push({
      id: layer.id,
      name: layer.name,
      albedoHex: layer.albedoHex,
      roughness: layer.roughness,
      slopeBias: layer.slopeBias,
      heightRange: [layer.heightRange[0], layer.heightRange[1]],
    });
  }
  return out;
}

interface CachedCompressedTileChunk {
  level: Level;
  tx: number;
  tz: number;
  kind: TileKind;
  min: number;
  scale: number;
  version: number;
  compressed: Uint8Array;
}

const TILE_GZIP_CACHE = new WeakMap<Int16Array, CachedCompressedTileChunk>();
const EVICTED_TILE_GZIP_CACHE = new Map<string, { crc: number; compressed: Uint8Array }>();
let lastMetaChunkCache: { crc: number; compressed: Uint8Array } | null = null;
let lastBaseChunkCache: { crc: number; compressed: Uint8Array } | null = null;
let lastExportGzipCompressionCount = 0;

/**
 * Returns how many chunks required fresh `compressGzip` invocations during the most recent
 * `exportAtw` call (0 for unchanged META + BASE + unchanged tiles).
 */
export function getLastExportGzipCompressionCount(): number {
  return lastExportGzipCompressionCount;
}

export async function exportAtw(state: WorldSaveV3): Promise<Blob> {
  const encoder = new TextEncoder();
  let gzipCount = 0;

  const metaObj: Record<string, unknown> = {
    version: 3,
    seed: state.seed,
    worldSize: 10000,
    objects: state.objects,
    stamps: state.stamps,
    links: state.links,
    splatLayers: state.splatLayers ?? [],
    microStrokes: state.microStrokes ?? [],
  };
  if (state.settings !== undefined) {
    metaObj.settings = state.settings;
  }
  const metaRaw = encoder.encode(JSON.stringify(metaObj));
  const projected =
    EXACT_BASE_DECOMPRESSED_BYTES +
    metaRaw.byteLength +
    state.tiles.length * EXACT_TILE_DECOMPRESSED_BYTES;
  if (
    projected > MAX_TOTAL_DECOMPRESSED_BYTES ||
    state.tiles.length + 2 > MAX_ATW_CHUNKS
  ) {
    throw new Error('Thế giới quá lớn để lưu thành một tệp .atw.');
  }

  const metaCrc = crc32(metaRaw);
  let metaBytes: Uint8Array;
  if (lastMetaChunkCache && lastMetaChunkCache.crc === metaCrc) {
    metaBytes = lastMetaChunkCache.compressed;
  } else {
    metaBytes = await compressGzip(metaRaw);
    gzipCount++;
    lastMetaChunkCache = { crc: metaCrc, compressed: metaBytes };
  }

  const baseRaw = new Uint8Array(EXACT_BASE_DECOMPRESSED_BYTES);
  const f32View = new Float32Array(baseRaw.buffer, 0, BASE_N * BASE_N);
  f32View.set(state.baseHeight.subarray(0, BASE_N * BASE_N));
  baseRaw.set(state.baseSplat.subarray(0, BASE_N * BASE_N * 4), BASE_N * BASE_N * 4);
  const baseCrc = crc32(baseRaw);
  let baseBytes: Uint8Array;
  if (lastBaseChunkCache && lastBaseChunkCache.crc === baseCrc) {
    baseBytes = lastBaseChunkCache.compressed;
  } else {
    baseBytes = await compressGzip(baseRaw);
    gzipCount++;
    lastBaseChunkCache = { crc: baseCrc, compressed: baseBytes };
  }

  const rawChunks: Array<{ tag: string; payload: Uint8Array }> = [
    { tag: 'META', payload: metaBytes },
    { tag: 'BASE', payload: baseBytes },
  ];

  for (const t of state.tiles) {
    const tileVersion = (t as { version?: number }).version;
    const cached = tileVersion !== undefined ? TILE_GZIP_CACHE.get(t.data) : undefined;
    if (
      cached &&
      tileVersion !== undefined &&
      cached.version === tileVersion &&
      cached.level === t.level &&
      cached.tx === t.tx &&
      cached.tz === t.tz &&
      cached.kind === t.kind &&
      cached.min === t.min &&
      cached.scale === t.scale
    ) {
      rawChunks.push({ tag: 'TILE', payload: cached.compressed });
      continue;
    }

    const tileRaw = new ArrayBuffer(EXACT_TILE_DECOMPRESSED_BYTES);
    const dv = new DataView(tileRaw);
    dv.setUint8(0, t.level);
    dv.setUint8(1, t.kind === 'splat' ? 1 : 0);
    dv.setUint16(2, 0, true);
    dv.setInt32(4, t.tx, true);
    dv.setInt32(8, t.tz, true);
    dv.setFloat32(12, t.min, true);
    dv.setFloat32(16, t.scale, true);
    const i16 = new Int16Array(tileRaw, 20, TILE * TILE);
    i16.set(t.data.subarray(0, TILE * TILE));
    const tileRawU8 = new Uint8Array(tileRaw);
    const coordKey = `${t.kind}:${t.level}:${t.tx}:${t.tz}`;
    const tileCrc = crc32(tileRawU8);
    const evictedHit = EVICTED_TILE_GZIP_CACHE.get(coordKey);
    let compressedTile: Uint8Array;
    if (evictedHit && evictedHit.crc === tileCrc) {
      compressedTile = evictedHit.compressed;
    } else {
      compressedTile = await compressGzip(tileRawU8);
      gzipCount++;
      if (EVICTED_TILE_GZIP_CACHE.size >= MAX_ATW_CHUNKS) {
        const oldestKey = EVICTED_TILE_GZIP_CACHE.keys().next().value;
        if (oldestKey !== undefined) EVICTED_TILE_GZIP_CACHE.delete(oldestKey);
      }
      EVICTED_TILE_GZIP_CACHE.set(coordKey, { crc: tileCrc, compressed: compressedTile });
    }

    if (tileVersion !== undefined) {
      TILE_GZIP_CACHE.set(t.data, {
        level: t.level,
        tx: t.tx,
        tz: t.tz,
        kind: t.kind,
        min: t.min,
        scale: t.scale,
        version: tileVersion,
        compressed: compressedTile,
      });
    }
    rawChunks.push({ tag: 'TILE', payload: compressedTile });
  }

  lastExportGzipCompressionCount = gzipCount;

  const bodyParts: Uint8Array[] = [];
  for (const ch of rawChunks) {
    const chHeader = new ArrayBuffer(8);
    const chView = new DataView(chHeader);
    for (let i = 0; i < 4; i++) {
      chView.setUint8(i, ch.tag.charCodeAt(i));
    }
    chView.setUint32(4, ch.payload.byteLength, true);
    bodyParts.push(new Uint8Array(chHeader));
    bodyParts.push(ch.payload);
  }
  const body = concatUint8Arrays(bodyParts);

  const header = new ArrayBuffer(16);
  const hView = new DataView(header);
  for (let i = 0; i < 4; i++) {
    hView.setUint8(i, ATW_MAGIC.charCodeAt(i));
  }
  hView.setUint16(4, ATW_VERSION, true);
  hView.setUint16(6, 1, true);
  hView.setUint32(8, rawChunks.length, true);
  hView.setUint32(12, crc32(body), true);

  const combined = concatUint8Arrays([new Uint8Array(header), body]);
  if (combined.byteLength > MAX_ATW_COMPRESSED_BYTES) {
    throw new Error(
      `Kích thước tệp .atw sau nén (${(combined.byteLength / (1024 * 1024)).toFixed(1)}MB) vượt quá giới hạn nhập lại an toàn (64MB).`
    );
  }
  return new Blob([combined as unknown as BlobPart], { type: 'application/octet-stream' });
}

export async function importAtw(blob: Blob): Promise<WorldSaveV3> {
  if (blob.size > MAX_ATW_COMPRESSED_BYTES) {
    throw new Error('Kích thước tệp .atw vượt quá giới hạn an toàn (64MB)');
  }
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);

  if (bytes.byteLength >= 4) {
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== ATW_MAGIC) {
      if (bytes.byteLength > MAX_META_DECOMPRESSED_BYTES) {
        throw new Error('Tệp JSON vượt quá giới hạn 32MB');
      }
      const text = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(text);
      assertSafeJsonKeys(parsed);
      return migrateV2ToV3(parsed);
    }
  } else {
    throw new Error('Tệp thế giới quá ngắn hoặc bị hỏng');
  }

  if (bytes.byteLength < 16) {
    throw new Error('Tiêu đề tệp .atw không đủ 16 byte');
  }

  const dv = new DataView(ab);
  const version = dv.getUint16(4, true);
  if (version !== ATW_VERSION) {
    throw new Error(`Phiên bản ATW không được hỗ trợ: v${version}`);
  }
  const chunkCount = dv.getUint32(8, true);
  if (chunkCount > MAX_ATW_CHUNKS) {
    throw new Error(`Số lượng chunk (${chunkCount}) vượt quá giới hạn an toàn (${MAX_ATW_CHUNKS})`);
  }
  const expected = dv.getUint32(12, true);
  if (crc32(bytes.subarray(16)) !== expected) {
    throw new Error('Tệp .atw bị hỏng (CRC không khớp)');
  }

  let offset = 16;
  const decoder = new TextDecoder();

  let hasMeta = false;
  let hasBase = false;
  let totalDecompressedBytes = 0;

  let seed = 1337;
  let objects: PlacedObject[] = [];
  let stamps: Stamp[] = [];
  let links: Link[] = [];
  let splatLayers: SerializedSplatLayer[] = [];
  let microStrokes: MicroStrokeStamp[] = [];
  let settings: WorldSaveV3['settings'] = undefined;
  let baseHeight = new Float32Array(BASE_N * BASE_N);
  let baseSplat = new Uint8Array(BASE_N * BASE_N * 4);
  const tiles: WorldSaveV3['tiles'] = [];
  const seenTileKeys = new Set<string>();

  for (let c = 0; c < chunkCount; c++) {
    if (offset + 8 > bytes.byteLength) {
      throw new Error('Tệp .atw bị cắt cụt ở tiêu đề chunk');
    }
    const tag = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3]
    );
    const len = dv.getUint32(offset + 4, true);
    offset += 8;

    if (offset + len > bytes.byteLength) {
      throw new Error(`Chunk ${tag} vượt quá kích thước tệp`);
    }
    const compressed = bytes.subarray(offset, offset + len);
    offset += len;

    if (tag === 'META') {
      if (hasMeta) {
        throw new Error('Tệp .atw chứa nhiều hơn một chunk META');
      }
      hasMeta = true;
      const raw = await decompressGzipBounded(compressed, MAX_META_DECOMPRESSED_BYTES);
      totalDecompressedBytes += raw.byteLength;
      if (totalDecompressedBytes > MAX_TOTAL_DECOMPRESSED_BYTES) {
        throw new Error('Tổng dung lượng giải nén vượt quá giới hạn an toàn');
      }

      const jsonStr = decoder.decode(raw);
      const meta = JSON.parse(jsonStr);
      assertSafeJsonKeys(meta, 'META');
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
        throw new Error('Chunk META không phải là đối tượng hợp lệ');
      }
      if (meta.version !== undefined && meta.version !== 3) {
        throw new Error(`Phiên bản META không hợp lệ: ${String(meta.version)}`);
      }
      if (meta.seed !== undefined && (typeof meta.seed !== 'number' || !Number.isFinite(meta.seed))) {
        throw new Error('Trường META.seed không hợp lệ');
      }
      seed = typeof meta.seed === 'number' ? meta.seed : 1337;
      objects = validatePlacedObjectsV3(meta.objects ?? []);
      stamps = validateStampsV3(meta.stamps);
      links = validateLinksV3(meta.links);
      splatLayers = validateSplatLayersV3(meta.splatLayers);
      microStrokes = validateMicroStrokesV3(meta.microStrokes);
      settings = validateSettingsV3(meta.settings);
    } else if (tag === 'BASE') {
      if (hasBase) {
        throw new Error('Tệp .atw chứa nhiều hơn một chunk BASE');
      }
      hasBase = true;
      const raw = await decompressGzipBounded(
        compressed,
        EXACT_BASE_DECOMPRESSED_BYTES,
        EXACT_BASE_DECOMPRESSED_BYTES
      );
      totalDecompressedBytes += raw.byteLength;
      if (totalDecompressedBytes > MAX_TOTAL_DECOMPRESSED_BYTES) {
        throw new Error('Tổng dung lượng giải nén vượt quá giới hạn an toàn');
      }

      baseHeight = new Float32Array(raw.buffer, raw.byteOffset, BASE_N * BASE_N);
      for (let i = 0; i < baseHeight.length; i++) {
        const h = baseHeight[i];
        if (!Number.isFinite(h) || h < -2000 || h > 5000) {
          throw new Error(`Độ cao nền BASE tại mẫu [${i}] không hợp lệ: ${String(h)}`);
        }
      }
      baseSplat = new Uint8Array(
        raw.buffer,
        raw.byteOffset + BASE_N * BASE_N * 4,
        BASE_N * BASE_N * 4
      );
    } else if (tag === 'TILE') {
      const raw = await decompressGzipBounded(
        compressed,
        EXACT_TILE_DECOMPRESSED_BYTES,
        EXACT_TILE_DECOMPRESSED_BYTES
      );
      totalDecompressedBytes += raw.byteLength;
      if (totalDecompressedBytes > MAX_TOTAL_DECOMPRESSED_BYTES) {
        throw new Error('Tổng dung lượng giải nén vượt quá giới hạn an toàn');
      }

      const tView = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
      const rawLevel = tView.getUint8(0);
      if (rawLevel > MAX_LEVEL) {
        throw new Error(`Mức LOD của TILE không hợp lệ: ${rawLevel}`);
      }
      const level = rawLevel as Level;
      const rawKind = tView.getUint8(1);
      if (rawKind !== 0 && rawKind !== 1) {
        throw new Error(`Loại TILE (kind=${rawKind}) không hợp lệ`);
      }
      const kind: TileKind = rawKind === 1 ? 'splat' : 'height';
      const tx = tView.getInt32(4, true);
      const tz = tView.getInt32(8, true);
      const maxCoord = maxTileCoordForLevel(level);
      if (tx < 0 || tz < 0 || tx > maxCoord || tz > maxCoord) {
        throw new Error(
          `Tọa độ TILE (${tx}, ${tz}) tại mức L${level} vượt ngoài biên hợp lệ [0..${maxCoord}]`
        );
      }
      const min = tView.getFloat32(12, true);
      const scale = tView.getFloat32(16, true);
      if (
        !Number.isFinite(min) ||
        !Number.isFinite(scale) ||
        scale < 0 ||
        scale > 100 ||
        Math.abs(min) > 10000
      ) {
        throw new Error(`Tham số lượng tử hóa TILE (min=${min}, scale=${scale}) không hợp lệ`);
      }

      const dedupKey = `${kind}:${level}:${tx}:${tz}`;
      if (seenTileKeys.has(dedupKey)) {
        throw new Error(`Phát hiện TILE trùng lặp tại ${dedupKey}`);
      }
      seenTileKeys.add(dedupKey);

      const data = new Int16Array(raw.buffer, raw.byteOffset + 20, TILE * TILE);
      tiles.push({ level, tx, tz, kind, min, scale, data });
    } else {
      throw new Error(`Tag chunk không xác định trong tệp .atw: "${tag}"`);
    }
  }

  return {
    version: 3,
    seed,
    worldSize: 10000,
    baseHeight,
    baseSplat,
    tiles,
    objects,
    stamps,
    links,
    splatLayers,
    microStrokes,
    ...(settings ? { settings } : {}),
  };
}

/**
 * Migrates a legacy v2 JSON save into a full WorldSaveV3 structure while validating
 * against prototype pollution and malformed fields via validateWorldSavePayload.
 */
export function migrateV2ToV3(v2Json: unknown): WorldSaveV3 {
  assertSafeJsonKeys(v2Json, 'v2Json');
  if (v2Json && typeof v2Json === 'object' && !Array.isArray(v2Json)) {
    const rec = v2Json as Record<string, unknown>;
    if (rec.placedObjects !== undefined) {
      validatePlacedObjectsV3(rec.placedObjects);
    }
    if (rec.objects !== undefined) {
      validatePlacedObjectsV3(rec.objects);
    }
    if (rec.microStrokes !== undefined) {
      validateMicroStrokesV3(rec.microStrokes);
    }
  }
  const validation = validateWorldSavePayload(v2Json);
  if (!validation.ok) {
    throw new Error(validation.reason ?? 'Dữ liệu thế giới v2 không hợp lệ');
  }

  const data = validation.data;
  const objects = data.placedObjects;
  const baseHeight = new Float32Array(BASE_N * BASE_N);
  baseHeight.set(data.heightMap.subarray(0, BASE_N * BASE_N));

  const baseSplat = new Uint8Array(BASE_N * BASE_N * 4);
  for (let i = 0; i < BASE_N * BASE_N; i++) {
    baseSplat[i * 4] = Math.round((data.colorMap[i * 3] ?? 0.28) * 255);
    baseSplat[i * 4 + 1] = Math.round((data.colorMap[i * 3 + 1] ?? 0.56) * 255);
    baseSplat[i * 4 + 2] = Math.round((data.colorMap[i * 3 + 2] ?? 0.25) * 255);
    baseSplat[i * 4 + 3] = 255;
  }

  const stamps: Stamp[] = objects.map((obj) => ({
    id: `obj_${obj.id}`,
    objectId: obj.id,
    centerX: obj.x,
    centerZ: obj.z,
    yaw: obj.rotationY ?? 0,
    shape: { kind: 'ellipse', rx: 6, rz: 6 },
    targetY: obj.y,
    falloff: 4.5,
    smoothK: 2.0,
    priority: 0,
    padY: 0,
    embedDepth: 1.5,
  }));

  return {
    version: 3,
    seed: 1337,
    worldSize: 10000,
    baseHeight,
    baseSplat,
    tiles: [],
    objects,
    stamps,
    links: [],
    microStrokes: data.microStrokes,
    settings: {
      biomeId: data.biomeId,
      waterLevel: data.waterLevel,
      regionTitle: data.regionTitle,
    },
  };
}

export async function checkStorageQuotaWarning(): Promise<{
  usageBytes: number;
  quotaBytes: number;
  warning80Pct: boolean;
}> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.storage &&
    typeof navigator.storage.estimate === 'function'
  ) {
    try {
      const est = await navigator.storage.estimate();
      const usageBytes = est.usage ?? 0;
      const quotaBytes = est.quota ?? 1024 * 1024 * 1024;
      return {
        usageBytes,
        quotaBytes,
        warning80Pct: quotaBytes > 0 && usageBytes / quotaBytes >= 0.8,
      };
    } catch {
      // Ignore storage estimate errors
    }
  }
  return { usageBytes: 0, quotaBytes: 1024 * 1024 * 1024, warning80Pct: false };
}

export function extractNonEmptyTilesForSave(tiles: readonly Tile[]): WorldSaveV3['tiles'] {
  return tiles
    .filter((t) => t.scale > 0 || t.min !== 0)
    .map((t) => ({
      level: t.level,
      tx: t.tx,
      tz: t.tz,
      kind: t.kind,
      min: t.min,
      scale: t.scale,
      data: t.data,
      version: t.version,
    }));
}
