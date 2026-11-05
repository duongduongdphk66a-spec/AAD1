import { DetailParams } from './detailGenerator';
import { BASE_N, BASE_STEP, HALF, Level, MAX_LEVEL, spacing } from './units';

export interface WorkerComposeRequest {
  id: number;
  epoch: number;
  level: Level;
  originX: number;
  originZ: number;
  w: number;
  h: number;
}

export interface WorkerComposeResult {
  id: number;
  epoch: number;
  level: Level;
  originX: number;
  originZ: number;
  w: number;
  h: number;
  heights: Float32Array;
}

const WORKER_SCRIPT = `
const BASE_N = ${BASE_N};
const BASE_STEP = ${BASE_STEP};
const HALF = ${HALF};
const MAX_LEVEL = ${MAX_LEVEL};
const S0 = 0.1;

let baseMap = new Float32Array(BASE_N * BASE_N);
let seed = 1337;
let amplitude = 0.85;
let persistence = 0.52;
let maxDetailMeters = 2.0;
let biomeRoughness = 0.72;
let detailEnabled = true;

const GRAD_X = new Float32Array([
  1.0, 0.9238795, 0.70710677, 0.38268343,
  0.0, -0.38268343, -0.70710677, -0.9238795,
  -1.0, -0.9238795, -0.70710677, -0.38268343,
  0.0, 0.38268343, 0.70710677, 0.9238795
]);
const GRAD_Z = new Float32Array([
  0.0, 0.38268343, 0.70710677, 0.9238795,
  1.0, 0.9238795, 0.70710677, 0.38268343,
  0.0, -0.38268343, -0.70710677, -0.9238795,
  -1.0, -0.9238795, -0.70710677, -0.38268343
]);

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function hashInt2D(ix, iz, s) {
  let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function noise2D(x, z, s) {
  const fx0 = Math.floor(x);
  const fz0 = Math.floor(z);
  const ix0 = fx0 | 0;
  const iz0 = fz0 | 0;
  const ix1 = (ix0 + 1) | 0;
  const iz1 = (iz0 + 1) | 0;
  const dx = Math.fround(x - fx0);
  const dz = Math.fround(z - fz0);
  const ux = Math.fround(dx * dx * dx * (dx * (dx * 6 - 15) + 10));
  const uz = Math.fround(dz * dz * dz * (dz * (dz * 6 - 15) + 10));
  const h00 = hashInt2D(ix0, iz0, s) & 15;
  const h10 = hashInt2D(ix1, iz0, s) & 15;
  const h01 = hashInt2D(ix0, iz1, s) & 15;
  const h11 = hashInt2D(ix1, iz1, s) & 15;
  const dx1 = Math.fround(dx - 1);
  const dz1 = Math.fround(dz - 1);
  const n00 = Math.fround(GRAD_X[h00] * dx + GRAD_Z[h00] * dz);
  const n10 = Math.fround(GRAD_X[h10] * dx1 + GRAD_Z[h10] * dz);
  const n01 = Math.fround(GRAD_X[h01] * dx + GRAD_Z[h01] * dz1);
  const n11 = Math.fround(GRAD_X[h11] * dx1 + GRAD_Z[h11] * dz1);
  const nx0 = Math.fround(n00 + ux * (n10 - n00));
  const nx1 = Math.fround(n01 + ux * (n11 - n01));
  return Math.fround((nx0 + uz * (nx1 - nx0)) * 1.4142135);
}

function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

let octaveTable = [];
function rebuildOctaves() {
  octaveTable = new Array(MAX_LEVEL + 1);
  for (let level = 0; level <= MAX_LEVEL; level++) {
    const sL = S0 * Math.pow(2, level);
    const nyquist = 2.0 * sL;
    const list = [];
    for (let k = 0; k < 10; k++) {
      const wavelength = 62.5 / Math.pow(2, k);
      if (wavelength < nyquist) break;
      const ratio = wavelength / sL;
      const nyquistFade = ratio >= 4.0 ? 1.0 : Math.fround((ratio - 2.0) * 0.5);
      const ampWeight = Math.fround(amplitude * Math.pow(persistence, k) * biomeRoughness * nyquistFade);
      if (ampWeight <= 1e-5) break;
      list.push({
        invLambda: Math.fround(1.0 / wavelength),
        ampWeight,
        seed: (seed + k * 1013) | 0
      });
    }
    octaveTable[level] = list;
  }
}
rebuildOctaves();

function composeBaseAndDetail(level, originX, originZ, w, h) {
  const out = new Float32Array(w * h);
  const step = S0 * Math.pow(2, level);
  const octs = detailEnabled ? (octaveTable[level] || []) : [];
  const numOcts = octs.length;
  const slopeFactor = Math.fround(0.45 + Math.min(1.55, 0.25 * 1.25));
  let ptr = 0;
  for (let rz = 0; rz < h; rz++) {
    const wz = clamp(originZ + rz * step, -HALF, HALF);
    const gz = (wz + HALF) / BASE_STEP;
    const iz = Math.floor(gz);
    const tz = gz - iz;
    const r0 = clamp(iz - 1, 0, BASE_N - 1) * BASE_N;
    const r1 = clamp(iz, 0, BASE_N - 1) * BASE_N;
    const r2 = clamp(iz + 1, 0, BASE_N - 1) * BASE_N;
    const r3 = clamp(iz + 2, 0, BASE_N - 1) * BASE_N;

    for (let rx = 0; rx < w; rx++) {
      const wx = clamp(originX + rx * step, -HALF, HALF);
      const gx = (wx + HALF) / BASE_STEP;
      const ix = Math.floor(gx);
      const tx = gx - ix;
      const c0 = clamp(ix - 1, 0, BASE_N - 1);
      const c1 = clamp(ix, 0, BASE_N - 1);
      const c2 = clamp(ix + 1, 0, BASE_N - 1);
      const c3 = clamp(ix + 2, 0, BASE_N - 1);
      const p0 = catmullRom(baseMap[r0 + c0], baseMap[r0 + c1], baseMap[r0 + c2], baseMap[r0 + c3], tx);
      const p1 = catmullRom(baseMap[r1 + c0], baseMap[r1 + c1], baseMap[r1 + c2], baseMap[r1 + c3], tx);
      const p2 = catmullRom(baseMap[r2 + c0], baseMap[r2 + c1], baseMap[r2 + c2], baseMap[r2 + c3], tx);
      const p3 = catmullRom(baseMap[r3 + c0], baseMap[r3 + c1], baseMap[r3 + c2], baseMap[r3 + c3], tx);
      const hBase = catmullRom(p0, p1, p2, p3, tz);

      let dSum = 0;
      for (let o = 0; o < numOcts; o++) {
        const oct = octs[o];
        const n = noise2D(Math.fround(wx * oct.invLambda), Math.fround(wz * oct.invLambda), oct.seed);
        dSum = Math.fround(dSum + n * oct.ampWeight * slopeFactor);
      }
      const hDetail = Math.fround(Math.max(-maxDetailMeters, Math.min(maxDetailMeters, dSum)));
      out[ptr++] = hBase + hDetail;
    }
  }
  return out;
}

function onMsg(msg, reply) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'syncState') {
    if (msg.baseMap) baseMap = new Float32Array(msg.baseMap);
    if (typeof msg.seed === 'number') seed = msg.seed;
    if (typeof msg.amplitude === 'number') amplitude = msg.amplitude;
    if (typeof msg.persistence === 'number') persistence = msg.persistence;
    if (typeof msg.maxDetailMeters === 'number') maxDetailMeters = msg.maxDetailMeters;
    if (typeof msg.biomeRoughness === 'number') biomeRoughness = msg.biomeRoughness;
    if (typeof msg.detailEnabled === 'boolean') detailEnabled = msg.detailEnabled;
    rebuildOctaves();
    return;
  }
  if (msg.type === 'composeWindow') {
    const heights = composeBaseAndDetail(msg.level, msg.originX, msg.originZ, msg.w, msg.h);
    reply({
      type: 'composeResult',
      id: msg.id,
      epoch: msg.epoch,
      level: msg.level,
      originX: msg.originX,
      originZ: msg.originZ,
      w: msg.w,
      h: msg.h,
      heights
    }, [heights.buffer]);
  }
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  self.onmessage = (e) => onMsg(e.data, (payload, transfer) => self.postMessage(payload, transfer));
} else {
  import('node:worker_threads').then(({ parentPort }) => {
    if (parentPort) {
      parentPort.on('message', (data) => onMsg(data, (payload, transfer) => parentPort.postMessage(payload, transfer)));
    }
  }).catch(() => {});
}
`;

interface WorkerAdapter {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  terminate(): void;
}

/**
 * Off-thread Worker pool for Clipmap window composition.
 * Automatically spawns a Web Worker in browser or an unref'd worker_threads Worker in Node.
 */
let sharedWorkerInstance: WorkerAdapter | null = null;
let sharedWorkerInitializing = false;
const sharedMessageListeners = new Set<(data: unknown) => void>();
const sharedErrorListeners = new Set<() => void>();

function handleSharedWorkerFailure(terminate?: () => void): void {
  try {
    terminate?.();
  } catch {
    /* ignore */
  }
  sharedWorkerInstance = null;
  // Keep sharedWorkerInitializing = true so ensureSharedWorker() stays null and falls back to main thread
  for (const fn of sharedErrorListeners) fn();
}

function ensureSharedWorker(): WorkerAdapter | null {
  if (sharedWorkerInstance) return sharedWorkerInstance;
  if (sharedWorkerInitializing) return null;
  sharedWorkerInitializing = true;

  // 1. Browser Web Worker via Blob URL
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
    try {
      const blob = new Blob([WORKER_SCRIPT], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const w = new Worker(url);
      w.onmessage = (e: MessageEvent) => {
        for (const fn of sharedMessageListeners) fn(e.data);
      };
      w.onerror = () => {
        handleSharedWorkerFailure(() => {
          w.terminate();
          URL.revokeObjectURL(url);
        });
      };
      sharedWorkerInstance = {
        postMessage: (msg, transfer) => w.postMessage(msg, transfer ?? []),
        terminate: () => {
          w.terminate();
          URL.revokeObjectURL(url);
        },
      };
      return sharedWorkerInstance;
    } catch {
      // Fallback if CSP blocks blob worker
    }
  }

  // 2. Node.js worker_threads (single shared unref'd worker so tests / benchmarks never spawn multiple V8 isolates or hang)
  if (typeof process !== 'undefined' && process.versions?.node) {
    import('node:worker_threads')
      .then(({ Worker: NodeWorker }) => {
        const nw = new NodeWorker(WORKER_SCRIPT, { eval: true });
        nw.on('message', (data) => {
          for (const fn of sharedMessageListeners) fn(data);
        });
        nw.on('error', () => {
          handleSharedWorkerFailure(() => {
            void nw.terminate();
          });
        });
        // Call unref() AFTER attaching 'message' listener because .on('message') re-refs the port in Node.js
        nw.unref();
        sharedWorkerInstance = {
          postMessage: (msg) => nw.postMessage(msg),
          terminate: () => {
            void nw.terminate();
          },
        };
      })
      .catch(() => {
        handleSharedWorkerFailure();
      });
  }

  return sharedWorkerInstance;
}

export class ComposeWorkerPool {
  private static globalReqCounter = 1;
  private pendingCallbacks = new Map<number, (res: WorkerComposeResult) => void>();
  private disposed = false;
  private lastBaseMap: Float32Array | null = null;
  private lastDetailParams: DetailParams | null = null;
  private readonly boundListener: (data: unknown) => void;
  private readonly boundErrorListener: () => void;

  constructor() {
    this.boundListener = (data: unknown) => this.handleMessage(data);
    this.boundErrorListener = () => this.pendingCallbacks.clear();
    sharedMessageListeners.add(this.boundListener);
    sharedErrorListeners.add(this.boundErrorListener);
    ensureSharedWorker();
  }

  private handleMessage(data: unknown): void {
    if (this.disposed || !data || typeof data !== 'object') return;
    const msg = data as {
      type?: string;
      id?: number;
      epoch?: number;
      level?: Level;
      originX?: number;
      originZ?: number;
      w?: number;
      h?: number;
      heights?: Float32Array;
    };
    if (msg.type === 'composeResult' && typeof msg.id === 'number' && msg.heights) {
      const cb = this.pendingCallbacks.get(msg.id);
      if (!cb) return;
      this.pendingCallbacks.delete(msg.id);
      cb({
        id: msg.id,
        epoch: msg.epoch ?? 0,
        level: (msg.level ?? 0) as Level,
        originX: msg.originX ?? 0,
        originZ: msg.originZ ?? 0,
        w: msg.w ?? 256,
        h: msg.h ?? 256,
        heights:
          msg.heights instanceof Float32Array
            ? msg.heights
            : new Float32Array(msg.heights),
      });
    }
  }

  isAvailable(): boolean {
    return ensureSharedWorker() !== null && !this.disposed;
  }

  syncState(
    baseMap: Float32Array,
    params?: DetailParams,
    detailEnabled = true,
    biomeRoughness = 0.72
  ): void {
    this.lastBaseMap = baseMap;
    if (params) this.lastDetailParams = params;
    const worker = ensureSharedWorker();
    if (!worker || this.disposed) return;
    const copy = new Float32Array(baseMap);
    worker.postMessage({
      type: 'syncState',
      baseMap: copy,
      seed: params?.seed ?? 1337,
      amplitude: params?.amplitude ?? 0.85,
      persistence: params?.persistence ?? 0.52,
      maxDetailMeters: params?.maxDetailMeters ?? 2.0,
      biomeRoughness,
      detailEnabled,
    });
  }

  requestComposeWindow(
    epoch: number,
    level: Level,
    originX: number,
    originZ: number,
    w: number,
    h: number,
    onResult: (res: WorkerComposeResult) => void
  ): number {
    const worker = ensureSharedWorker();
    if (!worker || this.disposed) return -1;
    const id = ComposeWorkerPool.globalReqCounter++;
    this.pendingCallbacks.set(id, onResult);
    worker.postMessage({
      type: 'composeWindow',
      id,
      epoch,
      level,
      originX,
      originZ,
      w,
      h,
    });
    return id;
  }

  cancelBeforeEpoch(minEpoch: number): void {
    void minEpoch;
    this.pendingCallbacks.clear();
  }

  pendingCount(): number {
    return this.pendingCallbacks.size;
  }

  dispose(): void {
    this.disposed = true;
    this.pendingCallbacks.clear();
    sharedMessageListeners.delete(this.boundListener);
    sharedErrorListeners.delete(this.boundErrorListener);
  }
}

export function estimateComposeStripCostMs(samples: number, level: Level): number {
  const s = spacing(level);
  const octaves = Math.max(1, Math.min(9, Math.floor(Math.log2(62.5 / (2 * s))) + 1));
  return (samples * octaves) * 0.000015;
}
