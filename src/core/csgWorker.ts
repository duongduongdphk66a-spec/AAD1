import * as THREE from 'three';
import { ADDITION, Brush, Evaluator } from 'three-bvh-csg';

export interface CsgWorkerRequest {
  posA: Float32Array;
  normA: Float32Array;
  idxA: Uint32Array | Uint16Array | null;
  posB: Float32Array;
  normB: Float32Array;
  idxB: Uint32Array | Uint16Array | null;
}

export interface CsgWorkerResponse {
  ok: boolean;
  pos?: Float32Array;
  norm?: Float32Array;
  idx?: Uint32Array | Uint16Array | null;
  error?: string;
}

function buildBrush(
  pos: Float32Array,
  norm: Float32Array,
  idx: Uint32Array | Uint16Array | null
): Brush {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  if (idx) {
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  const b = new Brush(geo);
  b.updateMatrixWorld();
  return b;
}

if (typeof self !== 'undefined' && typeof (self as unknown as Worker).postMessage === 'function') {
  self.onmessage = (e: MessageEvent<CsgWorkerRequest>) => {
    try {
      const { posA, normA, idxA, posB, normB, idxB } = e.data;
      const brushA = buildBrush(posA, normA, idxA);
      const brushB = buildBrush(posB, normB, idxB);
      const evaluator = new Evaluator();
      const result = evaluator.evaluate(brushA, brushB, ADDITION);
      const outGeo = result.geometry;
      const outPos = new Float32Array(
        (outGeo.getAttribute('position') as THREE.BufferAttribute).array as ArrayLike<number>
      );
      const outNorm = new Float32Array(
        (outGeo.getAttribute('normal') as THREE.BufferAttribute).array as ArrayLike<number>
      );
      const outIdxAttr = outGeo.getIndex();
      const outIdx = outIdxAttr
        ? new Uint32Array(outIdxAttr.array as ArrayLike<number>)
        : null;
      const transfer: Transferable[] = [outPos.buffer, outNorm.buffer];
      if (outIdx) transfer.push(outIdx.buffer);
      (self as unknown as Worker).postMessage(
        { ok: true, pos: outPos, norm: outNorm, idx: outIdx } satisfies CsgWorkerResponse,
        transfer
      );
    } catch (err) {
      (self as unknown as Worker).postMessage({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      } satisfies CsgWorkerResponse);
    }
  };
}
