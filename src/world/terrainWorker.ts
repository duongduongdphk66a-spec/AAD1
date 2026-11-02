export interface ErosionParams {
  width: number;
  height: number;
  iterations: number;
  inertia: number; // alpha
  sedimentCapacityFactor: number; // K_c
  minSedimentCapacity: number; // delta_min
  erodeSpeed: number;
  depositSpeed: number;
  evaporateSpeed: number; // K_e
  gravity: number; // g
  maxDropletLifetime: number;
  seed?: number;
}

export const DEFAULT_EROSION_PARAMS: ErosionParams = {
  width: 256,
  height: 256,
  iterations: 50000,
  inertia: 0.05,
  sedimentCapacityFactor: 4.0,
  minSedimentCapacity: 0.01,
  erodeSpeed: 0.3,
  depositSpeed: 0.3,
  evaporateSpeed: 0.01,
  gravity: 4.0,
  maxDropletLifetime: 30,
};

export function calculateHeightAndGradient(
  map: Float32Array,
  width: number,
  height: number,
  posX: number,
  posY: number
) {
  const coordX = Math.max(0, Math.min(width - 2, Math.floor(posX)));
  const coordY = Math.max(0, Math.min(height - 2, Math.floor(posY)));
  const u = posX - coordX;
  const v = posY - coordY;

  const idx00 = coordY * width + coordX;
  const h00 = map[idx00];
  const h10 = map[idx00 + 1];
  const h01 = map[idx00 + width];
  const h11 = map[idx00 + width + 1];

  const gx = (h10 - h00) * (1 - v) + (h11 - h01) * v;
  const gy = (h01 - h00) * (1 - u) + (h11 - h10) * u;
  const interpolatedHeight =
    h00 * (1 - u) * (1 - v) +
    h10 * u * (1 - v) +
    h01 * (1 - u) * v +
    h11 * u * v;

  return { height: interpolatedHeight, gx, gy, coordX, coordY, u, v, idx00 };
}

/**
 * Particle-based Hydraulic Erosion (Xói mòn Thủy lực theo hạt).
 * Simulates water droplets flowing down terrain gradients, eroding steep slopes
 * and depositing sediment in flatter basins using bilinear height/gradient interpolation.
 */
export function applyHydraulicErosion(
  heightmap: Float32Array,
  customParams?: Partial<ErosionParams>
): Float32Array {
  const inferredSide = Math.round(Math.sqrt(heightmap.length));
  const defaultWidth =
    inferredSide * inferredSide === heightmap.length
      ? inferredSide
      : DEFAULT_EROSION_PARAMS.width;
  const defaultHeight =
    inferredSide * inferredSide === heightmap.length
      ? inferredSide
      : DEFAULT_EROSION_PARAMS.height;

  const p: ErosionParams = {
    ...DEFAULT_EROSION_PARAMS,
    width: defaultWidth,
    height: defaultHeight,
    ...customParams,
  };
  const { width, height } = p;

  if (width < 4 || height < 4 || heightmap.length < width * height) {
    return heightmap;
  }

  let s = p.seed !== undefined ? p.seed >>> 0 : 0;
  const useSeeded = p.seed !== undefined;
  const nextRand = () => {
    if (!useSeeded) return Math.random();
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  for (let iter = 0; iter < p.iterations; iter++) {
    let posX = nextRand() * (width - 2) + 1;
    let posY = nextRand() * (height - 2) + 1;
    let dirX = 0;
    let dirY = 0;
    let speed = 1.0;
    let water = 1.0;
    let sediment = 0.0;

    for (let lifetime = 0; lifetime < p.maxDropletLifetime; lifetime++) {
      const current = calculateHeightAndGradient(heightmap, width, height, posX, posY);

      dirX = dirX * p.inertia - current.gx * (1 - p.inertia);
      dirY = dirY * p.inertia - current.gy * (1 - p.inertia);

      const len = Math.hypot(dirX, dirY);
      if (len !== 0) {
        dirX /= len;
        dirY /= len;
      } else {
        const angle = nextRand() * Math.PI * 2;
        dirX = Math.cos(angle);
        dirY = Math.sin(angle);
      }

      posX += dirX;
      posY += dirY;

      if (posX < 1 || posX >= width - 2 || posY < 1 || posY >= height - 2) {
        break;
      }

      const next = calculateHeightAndGradient(heightmap, width, height, posX, posY);
      const deltaHeight = next.height - current.height;

      const capacity =
        Math.max(-deltaHeight, p.minSedimentCapacity) *
        speed *
        water *
        p.sedimentCapacityFactor;

      if (sediment > capacity || deltaHeight > 0) {
        const amountToDeposit =
          deltaHeight > 0
            ? Math.min(deltaHeight, sediment)
            : (sediment - capacity) * p.depositSpeed;
        sediment -= amountToDeposit;

        const { idx00, u, v } = current;
        heightmap[idx00] += amountToDeposit * (1 - u) * (1 - v);
        heightmap[idx00 + 1] += amountToDeposit * u * (1 - v);
        heightmap[idx00 + width] += amountToDeposit * (1 - u) * v;
        heightmap[idx00 + width + 1] += amountToDeposit * u * v;
      } else {
        const amountToErode = Math.min(
          (capacity - sediment) * p.erodeSpeed,
          -deltaHeight
        );
        sediment += amountToErode;

        const { idx00, u, v } = current;
        heightmap[idx00] -= amountToErode * (1 - u) * (1 - v);
        heightmap[idx00 + 1] -= amountToErode * u * (1 - v);
        heightmap[idx00 + width] -= amountToErode * (1 - u) * v;
        heightmap[idx00 + width + 1] -= amountToErode * u * v;
      }

      speed = Math.sqrt(Math.max(0, speed * speed + -deltaHeight * p.gravity));
      water *= 1 - p.evaporateSpeed;
    }
  }

  return heightmap;
}

/**
 * Runs hydraulic erosion asynchronously in a dedicated Web Worker when available in the browser,
 * falling back seamlessly to synchronous execution in Node/test environments.
 */
export function runHydraulicErosionAsync(
  heightmap: Float32Array,
  params?: Partial<ErosionParams>
): Promise<Float32Array> {
  if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    return new Promise((resolve) => {
      try {
        const worker = new Worker(new URL('./terrainWorker.ts', import.meta.url), {
          type: 'module',
        });
        const cloned = new Float32Array(heightmap);
        worker.onmessage = (e: MessageEvent<{ buffer: ArrayBuffer }>) => {
          worker.terminate();
          resolve(new Float32Array(e.data.buffer));
        };
        worker.onerror = () => {
          worker.terminate();
          const fallback = new Float32Array(heightmap);
          resolve(applyHydraulicErosion(fallback, params));
        };
        worker.postMessage({ buffer: cloned.buffer, params: params ?? {} }, [cloned.buffer]);
      } catch {
        const fallback = new Float32Array(heightmap);
        resolve(applyHydraulicErosion(fallback, params));
      }
    });
  }
  const copy = new Float32Array(heightmap);
  return Promise.resolve(applyHydraulicErosion(copy, params));
}

// Listen for messages when executed inside a Web Worker context
if (
  typeof self !== 'undefined' &&
  'onmessage' in self &&
  typeof window === 'undefined'
) {
  self.onmessage = (
    e: MessageEvent<{ buffer: ArrayBuffer; params: Partial<ErosionParams> }>
  ) => {
    const map = new Float32Array(e.data.buffer);
    const eroded = applyHydraulicErosion(map, e.data.params);
    (self as unknown as Worker).postMessage({ buffer: eroded.buffer }, [eroded.buffer]);
  };
}
