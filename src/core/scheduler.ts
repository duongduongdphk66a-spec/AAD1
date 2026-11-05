import { ComposeWorkerPool, WorkerComposeResult } from './clipmapWorker';
import { DetailParams } from './detailGenerator';
import { Stamp } from './stampSystem';
import { Level, Rect, rectsIntersect } from './units';

export type WorkerRequest =
  | {
      id: number;
      epoch: number;
      kind: 'composeWindow';
      level: Level;
      originX: number;
      originZ: number;
      w: number;
      h: number;
    }
  | {
      id: number;
      epoch: number;
      kind: 'buildLinkRibbon';
      linkId: string;
      points: Array<[number, number, number]>;
      width: number;
    }
  | {
      id: number;
      epoch: number;
      kind: 'rasterStampBounds';
      stamps: Stamp[];
      rect: Rect;
      level: Level;
    };

export type WorkerResponse =
  | { id: number; epoch: number; kind: 'composeWindow'; heights: Float32Array }
  | {
      id: number;
      epoch: number;
      kind: 'buildLinkRibbon';
      positions: Float32Array;
      normals: Float32Array;
      uvs: Float32Array;
      indices: Uint32Array;
    }
  | { id: number; epoch: number; kind: 'rasterStampBounds'; delta: Int16Array; min: number; scale: number };

export type JobPriority = 1 | 2 | 3 | 4;

export interface ScheduledJob {
  id: string;
  priority: JobPriority;
  epoch: number;
  rect?: Rect;
  level?: Level;
  run: () => void;
}

/**
 * Priority-based frame scheduler with background Worker pool (`ComposeWorkerPool`),
 * epoch cancellation, dirty rect coalescing, and strict main-thread budget enforcement (default 2.2 ms).
 */
export class Scheduler {
  private epochCounter = 1;
  public readonly workerPool: ComposeWorkerPool;
  private readonly queues: Record<JobPriority, ScheduledJob[]> = {
    1: [], // Active brush stroke window (L = L*)
    2: [], // Inner clipmap rings (L0..L2)
    3: [], // Outer clipmap rings (L3..L9) & link ribbons
    4: [], // Autosave & background CSG
  };

  constructor(enableWorker = true) {
    this.workerPool = enableWorker ? new ComposeWorkerPool() : (null as unknown as ComposeWorkerPool);
  }

  get currentEpoch(): number {
    return this.epochCounter;
  }

  bumpEpoch(): number {
    this.epochCounter++;
    if (this.workerPool) {
      this.workerPool.cancelBeforeEpoch(this.epochCounter);
    }
    return this.epochCounter;
  }

  syncWorkerTerrainState(
    baseMap: Float32Array,
    params?: DetailParams,
    detailEnabled = true,
    biomeRoughness = 0.72
  ): void {
    if (this.workerPool) {
      this.workerPool.syncState(baseMap, params, detailEnabled, biomeRoughness);
    }
  }

  dispatchWorkerCompose(
    level: Level,
    originX: number,
    originZ: number,
    w: number,
    h: number,
    onComplete: (res: WorkerComposeResult) => void
  ): boolean {
    if (!this.workerPool || !this.workerPool.isAvailable()) {
      return false;
    }
    const reqEpoch = this.epochCounter;
    const id = this.workerPool.requestComposeWindow(
      reqEpoch,
      level,
      originX,
      originZ,
      w,
      h,
      (res) => {
        if (res.epoch < this.epochCounter) {
          return; // Stale epoch discarded
        }
        onComplete(res);
      }
    );
    return id !== -1;
  }

  enqueue(job: ScheduledJob): void {
    const list = this.queues[job.priority];
    // Coalesce jobs with the same id or overlapping dirty rect at the same level
    const existingIdx = list.findIndex(
      (j) =>
        j.id === job.id ||
        (j.level !== undefined &&
          j.level === job.level &&
          j.rect !== undefined &&
          job.rect !== undefined &&
          rectsIntersect(j.rect, job.rect))
    );
    if (existingIdx !== -1) {
      const prev = list[existingIdx];
      if (prev.rect && job.rect) {
        job.rect = {
          minX: Math.min(prev.rect.minX, job.rect.minX),
          minZ: Math.min(prev.rect.minZ, job.rect.minZ),
          maxX: Math.max(prev.rect.maxX, job.rect.maxX),
          maxZ: Math.max(prev.rect.maxZ, job.rect.maxZ),
        };
      }
      list[existingIdx] = job;
      return;
    }
    list.push(job);
  }

  pendingCount(): number {
    return (
      this.queues[1].length +
      this.queues[2].length +
      this.queues[3].length +
      this.queues[4].length +
      (this.workerPool ? this.workerPool.pendingCount() : 0)
    );
  }

  clear(): void {
    this.queues[1].length = 0;
    this.queues[2].length = 0;
    this.queues[3].length = 0;
    this.queues[4].length = 0;
  }

  /**
   * Executes queued jobs in priority order (1 -> 4) within budgetMs (default 2.2 ms),
   * automatically discarding stale jobs whose epoch < minValidEpoch.
   */
  tick(budgetMs = 2.2, minValidEpoch = 0): number {
    const start = performance.now();
    let executed = 0;

    for (const p of [1, 2, 3, 4] as const) {
      const q = this.queues[p];
      while (q.length > 0) {
        const job = q.shift()!;
        if (job.epoch < minValidEpoch) {
          continue; // Discarded stale job
        }
        job.run();
        executed++;
        if (performance.now() - start >= budgetMs) {
          return executed;
        }
      }
    }

    return executed;
  }

  dispose(): void {
    this.clear();
    if (this.workerPool) {
      this.workerPool.dispose();
    }
  }
}

