import { TerrainField } from '../core/terrainField';
import { HALF, WORLD_SIZE } from '../core/units';

export interface Heightmap16Meta {
  size: number;
  metersPerSample: number;
  minHeight: number;
  maxHeight: number;
  worldSize: number;
}

export interface Heightmap16Result {
  data: Uint16Array;
  meta: Heightmap16Meta;
}

export const UNITY_HEIGHTMAP_SIZES = [257, 513, 1025, 2049, 4097] as const;
export const UNREAL_HEIGHTMAP_SIZES = [1009, 2017, 4033, 8129] as const;

export async function exportHeightmap16(
  field: TerrainField,
  size: number,
  signal?: AbortSignal,
  onProgress?: (p: number) => void
): Promise<Heightmap16Result> {
  if (!Number.isInteger(size) || size < 2 || size > 8192) {
    throw new Error(`Kích thước heightmap (${size}) phải là số nguyên trong khoảng [2, 8192]`);
  }
  const step = WORLD_SIZE / (size - 1);
  const heights = new Float32Array(size * size);
  let lo = Infinity;
  let hi = -Infinity;

  for (let j = 0; j < size; j++) {
    if (signal?.aborted) {
      throw new DOMException('Đã hủy', 'AbortError');
    }
    const wz = -HALF + j * step;
    for (let i = 0; i < size; i++) {
      const wx = -HALF + i * step;
      const h = field.sampleHeight(wx, wz, 0);
      heights[j * size + i] = h;
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
    if (j % 32 === 0) {
      onProgress?.(j / size);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  onProgress?.(1);
  const range = Math.max(1e-6, hi - lo);
  const out = new Uint16Array(size * size);
  if (hi - lo < 1e-6) {
    out.fill(0);
  } else {
    for (let i = 0; i < out.length; i++) {
      out[i] = Math.round(((heights[i] - lo) / range) * 65535);
    }
  }

  return {
    data: out,
    meta: {
      size,
      metersPerSample: step,
      minHeight: lo,
      maxHeight: hi,
      worldSize: WORLD_SIZE,
    },
  };
}

/**
 * Encodes a Uint16Array into explicit little-endian `.raw` bytes for Unity / Unreal Engine.
 */
export function encodeHeightmapRawLittleEndian(data: Uint16Array): Uint8Array {
  const buf = new ArrayBuffer(data.length * 2);
  const dv = new DataView(buf);
  for (let i = 0; i < data.length; i++) {
    dv.setUint16(i * 2, data[i], true);
  }
  return new Uint8Array(buf);
}

/**
 * Reconstructs the world elevation in meters from a 16-bit sample `v` in [0, 65535]
 * using `minHeight + (v / 65535) * (maxHeight - minHeight)`.
 */
export function reconstructHeightFromUint16(
  v: number,
  minHeight: number,
  maxHeight: number
): number {
  return minHeight + (v / 65535) * (maxHeight - minHeight);
}
