import {
  ClipmapComposeRuntime,
  ClipmapWorkerComposeResultMsg,
  ClipmapWorkerIncomingMessage,
  ClipmapWorkerSyncStateMsg,
} from './clipmapComposeWorker';
import { DetailParams } from './detailGenerator';
import { Level, spacing } from './units';

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

interface WorkerAdapter {
  postMessage(msg: ClipmapWorkerIncomingMessage, transfer?: Transferable[]): void;
  terminate(): void;
}

/**
 * Off-thread Worker pool for Clipmap window composition.
 * Spawns a standard bundled ES Module Web Worker (`clipmapComposeWorker.ts`) in the browser
 * (requiring only `worker-src 'self'` with zero `blob:` URLs or duplicated string code),
 * and uses the shared `ClipmapComposeRuntime` asynchronously in Node.js test environments.
 */
let sharedWorkerInstance: WorkerAdapter | null = null;
let sharedWorkerInitializing = false;
let sharedWorkerFailureCount = 0;
let sharedWorkerNextRetryAt = 0;
let lastSharedSyncPayload: ClipmapWorkerSyncStateMsg | null = null;
const MAX_WORKER_RETRIES = 3;
const sharedMessageListeners = new Set<(data: unknown) => void>();
const sharedErrorListeners = new Set<() => void>();

function handleSharedWorkerFailure(terminate?: () => void): void {
  try {
    terminate?.();
  } catch {
    /* ignore */
  }
  sharedWorkerInstance = null;
  sharedWorkerInitializing = false;
  sharedWorkerFailureCount++;
  sharedWorkerNextRetryAt = Date.now() + Math.min(5000, 250 * sharedWorkerFailureCount);
  for (const fn of sharedErrorListeners) fn();
}

function flushInitialSyncToWorker(worker: WorkerAdapter): void {
  if (!lastSharedSyncPayload) return;
  try {
    worker.postMessage({
      ...lastSharedSyncPayload,
      baseMap: lastSharedSyncPayload.baseMap
        ? new Float32Array(lastSharedSyncPayload.baseMap)
        : undefined,
    });
  } catch {
    /* ignore */
  }
}

function ensureSharedWorker(): WorkerAdapter | null {
  if (sharedWorkerInstance) return sharedWorkerInstance;
  if (sharedWorkerInitializing) return null;
  if (sharedWorkerFailureCount >= MAX_WORKER_RETRIES) return null;
  if (sharedWorkerFailureCount > 0 && Date.now() < sharedWorkerNextRetryAt) return null;
  sharedWorkerInitializing = true;

  // 1. Browser ES Module Web Worker (bundled by Vite, served from 'self')
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      const w = new Worker(new URL('./clipmapComposeWorker.ts', import.meta.url), {
        type: 'module',
      });
      w.onmessage = (e: MessageEvent) => {
        for (const fn of sharedMessageListeners) fn(e.data);
      };
      w.onerror = () => {
        handleSharedWorkerFailure(() => {
          w.terminate();
        });
      };
      sharedWorkerInstance = {
        postMessage: (msg, transfer) => w.postMessage(msg, transfer ?? []),
        terminate: () => {
          w.terminate();
        },
      };
      sharedWorkerInitializing = false;
      flushInitialSyncToWorker(sharedWorkerInstance);
      return sharedWorkerInstance;
    } catch {
      handleSharedWorkerFailure();
      return null;
    }
  }

  // 2. Node.js test/benchmark environment: uses the exact same ClipmapComposeRuntime asynchronously
  if (typeof process !== 'undefined' && process.versions?.node) {
    const runtime = new ClipmapComposeRuntime();
    let terminated = false;
    sharedWorkerInstance = {
      postMessage: (msg) => {
        if (terminated) return;
        queueMicrotask(() => {
          if (terminated) return;
          runtime.handleMessage(msg, (payload: ClipmapWorkerComposeResultMsg) => {
            if (terminated) return;
            for (const fn of sharedMessageListeners) fn(payload);
          });
        });
      },
      terminate: () => {
        terminated = true;
      },
    };
    sharedWorkerInitializing = false;
    flushInitialSyncToWorker(sharedWorkerInstance);
    return sharedWorkerInstance;
  }

  sharedWorkerInitializing = false;
  sharedWorkerFailureCount = MAX_WORKER_RETRIES;
  return null;
}

interface PendingWorkerEntry {
  epoch: number;
  level: Level;
  onResult: (res: WorkerComposeResult) => void;
}

export class ComposeWorkerPool {
  private static globalReqCounter = 1;
  private pendingCallbacks = new Map<number, PendingWorkerEntry>();
  private disposed = false;
  private lastDetailParams: DetailParams = {
    seed: 1337,
    amplitude: 0.85,
    persistence: 0.52,
    maxDetailMeters: 2.0,
  };
  private lastDetailEnabled = true;
  private lastBiomeRoughness = 0.72;
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
      const entry = this.pendingCallbacks.get(msg.id);
      if (!entry) return;
      this.pendingCallbacks.delete(msg.id);
      entry.onResult({
        id: msg.id,
        epoch: msg.epoch ?? entry.epoch,
        level: (msg.level ?? entry.level) as Level,
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
    detailEnabled?: boolean,
    biomeRoughness?: number
  ): void {
    if (params) {
      this.lastDetailParams = { ...params };
    }
    if (detailEnabled !== undefined) {
      this.lastDetailEnabled = detailEnabled;
    }
    if (biomeRoughness !== undefined) {
      this.lastBiomeRoughness = biomeRoughness;
    }

    const payload: ClipmapWorkerSyncStateMsg = {
      type: 'syncState',
      baseMap: new Float32Array(baseMap),
      seed: this.lastDetailParams.seed,
      amplitude: this.lastDetailParams.amplitude,
      persistence: this.lastDetailParams.persistence,
      maxDetailMeters: this.lastDetailParams.maxDetailMeters,
      biomeRoughness: this.lastBiomeRoughness,
      detailEnabled: this.lastDetailEnabled,
    };
    lastSharedSyncPayload = payload;

    const worker = ensureSharedWorker();
    if (!worker || this.disposed) return;
    worker.postMessage({
      ...payload,
      baseMap: new Float32Array(baseMap),
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
    this.pendingCallbacks.set(id, { epoch, level, onResult });
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

  cancelBeforeEpoch(minEpoch: number, level?: Level): void {
    for (const [id, entry] of this.pendingCallbacks.entries()) {
      if (entry.epoch < minEpoch && (level === undefined || entry.level === level)) {
        this.pendingCallbacks.delete(id);
      }
    }
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
  return samples * octaves * 0.000015;
}
