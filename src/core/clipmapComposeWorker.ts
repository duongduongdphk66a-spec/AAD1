import { DeterministicDetailGenerator } from './detailGenerator';
import { sampleBicubicBaseHeight } from './terrainField';
import { BASE_N, HALF, Level, clamp, spacing } from './units';

export interface ClipmapWorkerSyncStateMsg {
  type: 'syncState';
  baseMap?: Float32Array;
  seed?: number;
  amplitude?: number;
  persistence?: number;
  maxDetailMeters?: number;
  biomeRoughness?: number;
  detailEnabled?: boolean;
}

export interface ClipmapWorkerComposeWindowMsg {
  type: 'composeWindow';
  id: number;
  epoch: number;
  level: Level;
  originX: number;
  originZ: number;
  w: number;
  h: number;
}

export interface ClipmapWorkerComposeResultMsg {
  type: 'composeResult';
  id: number;
  epoch: number;
  level: Level;
  originX: number;
  originZ: number;
  w: number;
  h: number;
  heights: Float32Array;
}

export type ClipmapWorkerIncomingMessage =
  | ClipmapWorkerSyncStateMsg
  | ClipmapWorkerComposeWindowMsg;

/**
 * Shared composition state machine used by both the browser ES Module Web Worker
 * (`new Worker(new URL('./clipmapComposeWorker.ts', import.meta.url), { type: 'module' })`)
 * and the Node.js background adapter, eliminating any duplicated string worker scripts.
 */
export class ClipmapComposeRuntime {
  private baseMap = new Float32Array(BASE_N * BASE_N);
  private readonly detailGen = new DeterministicDetailGenerator(1337, 2.0);

  handleMessage(
    msg: ClipmapWorkerIncomingMessage,
    reply: (payload: ClipmapWorkerComposeResultMsg, transfer: Transferable[]) => void
  ): void {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'syncState') {
      if (msg.baseMap) {
        if (msg.baseMap.length >= BASE_N * BASE_N) {
          this.baseMap = new Float32Array(msg.baseMap.subarray(0, BASE_N * BASE_N));
        } else {
          this.baseMap = new Float32Array(BASE_N * BASE_N);
          this.baseMap.set(msg.baseMap);
        }
      }
      this.detailGen.configure({
        ...(typeof msg.seed === 'number' ? { seed: msg.seed } : {}),
        ...(typeof msg.amplitude === 'number' ? { amplitude: msg.amplitude } : {}),
        ...(typeof msg.persistence === 'number' ? { persistence: msg.persistence } : {}),
        ...(typeof msg.maxDetailMeters === 'number'
          ? { maxDetailMeters: msg.maxDetailMeters }
          : {}),
      });
      if (typeof msg.biomeRoughness === 'number') {
        this.detailGen.setBiomeRoughness(msg.biomeRoughness);
      }
      if (typeof msg.detailEnabled === 'boolean') {
        this.detailGen.setEnabled(msg.detailEnabled);
      }
      return;
    }

    if (msg.type === 'composeWindow') {
      const heights = this.composeBaseAndDetail(
        msg.level,
        msg.originX,
        msg.originZ,
        msg.w,
        msg.h
      );
      reply(
        {
          type: 'composeResult',
          id: msg.id,
          epoch: msg.epoch,
          level: msg.level,
          originX: msg.originX,
          originZ: msg.originZ,
          w: msg.w,
          h: msg.h,
          heights,
        },
        [heights.buffer]
      );
    }
  }

  composeBaseAndDetail(
    level: Level,
    originX: number,
    originZ: number,
    w: number,
    h: number
  ): Float32Array {
    const out = new Float32Array(w * h);
    const step = spacing(level);
    let ptr = 0;
    for (let rz = 0; rz < h; rz++) {
      const wz = clamp(originZ + rz * step, -HALF, HALF);
      for (let rx = 0; rx < w; rx++) {
        const wx = clamp(originX + rx * step, -HALF, HALF);
        const hBase = sampleBicubicBaseHeight(this.baseMap, wx, wz);
        const hDetail = this.detailGen.sample(wx, wz, level);
        out[ptr++] = hBase + hDetail;
      }
    }
    return out;
  }
}

// Listen for messages when executed inside a browser ES Module Web Worker context
if (
  typeof self !== 'undefined' &&
  typeof (self as unknown as Worker).postMessage === 'function' &&
  typeof window === 'undefined'
) {
  const runtime = new ClipmapComposeRuntime();
  self.onmessage = (e: MessageEvent<ClipmapWorkerIncomingMessage>) => {
    runtime.handleMessage(e.data, (payload, transfer) => {
      (self as unknown as Worker).postMessage(payload, transfer);
    });
  };
}
