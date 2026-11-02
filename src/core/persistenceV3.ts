import { validateWorldSavePayload } from '../world/generation';
import { MicroStrokeStamp, PlacedObject } from '../world/registry';
import { Link } from './linkSystem';
import { Stamp } from './stampSystem';
import { Tile, TileKind } from './tileStore';
import { BASE_N, Level, MAX_LEVEL, TILE, clamp } from './units';

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
  }>;
  objects: PlacedObject[];
  stamps: Stamp[];
  links: Link[];
  splatLayers?: SerializedSplatLayer[];
  microStrokes?: MicroStrokeStamp[];
}

export interface WorldIO {
  exportAtw(state: WorldSaveV3): Promise<Blob>;
  importAtw(blob: Blob): Promise<WorldSaveV3>;
  migrateV2ToV3(v2Json: unknown): WorldSaveV3;
}

const ATW_MAGIC = 'ATW3';
const ATW_VERSION = 3;

async function compressGzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(bytes as unknown as BufferSource);
    writer.close();
    const res = new Response(cs.readable);
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  }
  return bytes;
}

async function decompressGzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(bytes as unknown as BufferSource);
    writer.close();
    const res = new Response(ds.readable);
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  }
  return bytes;
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
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

export async function exportAtw(state: WorldSaveV3): Promise<Blob> {
  const encoder = new TextEncoder();

  const metaObj = {
    version: 3,
    seed: state.seed,
    worldSize: 10000,
    objects: state.objects,
    stamps: state.stamps,
    links: state.links,
    splatLayers: state.splatLayers ?? [],
    microStrokes: state.microStrokes ?? [],
  };
  const metaBytes = await compressGzip(encoder.encode(JSON.stringify(metaObj)));

  const baseRaw = new Uint8Array(BASE_N * BASE_N * 4 + BASE_N * BASE_N * 4);
  const f32View = new Float32Array(baseRaw.buffer, 0, BASE_N * BASE_N);
  f32View.set(state.baseHeight.subarray(0, BASE_N * BASE_N));
  baseRaw.set(state.baseSplat.subarray(0, BASE_N * BASE_N * 4), BASE_N * BASE_N * 4);
  const baseBytes = await compressGzip(baseRaw);

  const rawChunks: Array<{ tag: string; payload: Uint8Array }> = [
    { tag: 'META', payload: metaBytes },
    { tag: 'BASE', payload: baseBytes },
  ];

  for (const t of state.tiles) {
    const tileRaw = new ArrayBuffer(20 + TILE * TILE * 2);
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
    const compressedTile = await compressGzip(new Uint8Array(tileRaw));
    rawChunks.push({ tag: 'TILE', payload: compressedTile });
  }

  const header = new ArrayBuffer(16);
  const hView = new DataView(header);
  for (let i = 0; i < 4; i++) {
    hView.setUint8(i, ATW_MAGIC.charCodeAt(i));
  }
  hView.setUint16(4, ATW_VERSION, true);
  hView.setUint16(6, 1, true);
  hView.setUint32(8, rawChunks.length, true);
  hView.setUint32(12, 0, true);

  const parts: Uint8Array[] = [new Uint8Array(header)];
  for (const ch of rawChunks) {
    const chHeader = new ArrayBuffer(8);
    const chView = new DataView(chHeader);
    for (let i = 0; i < 4; i++) {
      chView.setUint8(i, ch.tag.charCodeAt(i));
    }
    chView.setUint32(4, ch.payload.byteLength, true);
    parts.push(new Uint8Array(chHeader));
    parts.push(ch.payload);
  }

  const combined = concatUint8Arrays(parts);
  return new Blob([combined as unknown as BlobPart], { type: 'application/octet-stream' });
}

export async function importAtw(blob: Blob): Promise<WorldSaveV3> {
  const ab = await blob.arrayBuffer();
  const bytes = new Uint8Array(ab);

  if (bytes.byteLength >= 4) {
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic !== ATW_MAGIC) {
      const text = new TextDecoder().decode(bytes);
      const parsed = JSON.parse(text);
      assertSafeJsonKeys(parsed);
      return migrateV2ToV3(parsed);
    }
  } else {
    throw new Error('Tệp thế giới quá ngắn hoặc bị hỏng');
  }

  const dv = new DataView(ab);
  const version = dv.getUint16(4, true);
  if (version !== ATW_VERSION) {
    throw new Error(`Phiên bản ATW không được hỗ trợ: v${version}`);
  }
  const chunkCount = dv.getUint32(8, true);
  if (chunkCount > 100_000) {
    throw new Error('Số lượng chunk vượt quá giới hạn an toàn');
  }

  let offset = 16;
  const decoder = new TextDecoder();

  let seed = 1337;
  let objects: PlacedObject[] = [];
  let stamps: Stamp[] = [];
  let links: Link[] = [];
  let splatLayers: SerializedSplatLayer[] = [];
  let microStrokes: MicroStrokeStamp[] = [];
  let baseHeight = new Float32Array(BASE_N * BASE_N);
  let baseSplat = new Uint8Array(BASE_N * BASE_N * 4);
  const tiles: WorldSaveV3['tiles'] = [];

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

    const raw = await decompressGzip(compressed);

    if (tag === 'META') {
      const jsonStr = decoder.decode(raw);
      const meta = JSON.parse(jsonStr);
      assertSafeJsonKeys(meta, 'META');
      seed = typeof meta.seed === 'number' && Number.isFinite(meta.seed) ? meta.seed : 1337;
      objects = Array.isArray(meta.objects) ? meta.objects : [];
      stamps = Array.isArray(meta.stamps) ? meta.stamps : [];
      links = Array.isArray(meta.links) ? meta.links : [];
      splatLayers = Array.isArray(meta.splatLayers) ? meta.splatLayers : [];
      microStrokes = Array.isArray(meta.microStrokes) ? meta.microStrokes : [];
    } else if (tag === 'BASE') {
      const expectedBytes = BASE_N * BASE_N * 4 * 2;
      if (raw.byteLength < expectedBytes) {
        throw new Error('Chunk BASE không đủ độ dài dữ liệu 161x161');
      }
      const aligned = raw.slice();
      baseHeight = new Float32Array(aligned.buffer, 0, BASE_N * BASE_N);
      baseSplat = new Uint8Array(
        aligned.buffer,
        BASE_N * BASE_N * 4,
        BASE_N * BASE_N * 4
      );
    } else if (tag === 'TILE') {
      if (raw.byteLength < 20 + TILE * TILE * 2) {
        throw new Error('Chunk TILE bị hỏng kích thước');
      }
      const aligned = raw.slice();
      const tView = new DataView(aligned.buffer);
      const level = clamp(tView.getUint8(0), 0, MAX_LEVEL) as Level;
      const kind: TileKind = tView.getUint8(1) === 1 ? 'splat' : 'height';
      const tx = tView.getInt32(4, true);
      const tz = tView.getInt32(8, true);
      const min = tView.getFloat32(12, true);
      const scale = tView.getFloat32(16, true);
      const data = new Int16Array(aligned.buffer, 20, TILE * TILE);
      tiles.push({ level, tx, tz, kind, min, scale, data });
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
  };
}

/**
 * Migrates a legacy v2 JSON save into a full WorldSaveV3 structure while validating
 * against prototype pollution and malformed fields via validateWorldSavePayload.
 */
export function migrateV2ToV3(v2Json: unknown): WorldSaveV3 {
  assertSafeJsonKeys(v2Json, 'v2Json');
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
      data: new Int16Array(t.data),
    }));
}
