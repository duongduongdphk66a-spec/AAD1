import { PREFAB_CATALOG, PlacedObject, PrefabId } from '../world/registry';
import { Rect, smoothstep } from './units';

export type FootprintShape =
  | { kind: 'obb'; halfX: number; halfZ: number }
  | { kind: 'ellipse'; rx: number; rz: number }
  | { kind: 'polygon'; points: Array<[number, number]> }
  | { kind: 'capsuleChain'; points: Array<[number, number]>; radius: number };

export interface Stamp {
  id: string;
  objectId: string;
  centerX: number;
  centerZ: number;
  yaw: number;
  shape: FootprintShape;
  targetY: number;
  falloff: number;
  smoothK: number;
  priority: number;
  splatId?: number;
  padY: number;
  embedDepth: number;
}

export interface StampEvalResult {
  hasInfluence: boolean;
  height: number;
  weight: number;
  signedDistance: number;
  dominantSplatId?: number;
}

export interface StampIndex {
  upsert(s: Stamp): Rect;
  remove(id: string): Rect | undefined;
  get(id: string): Stamp | undefined;
  list(): readonly Stamp[];
  clear(): void;
  queryPoint(x: number, z: number): readonly Stamp[];
  queryRect(r: Rect): readonly Stamp[];
  evaluate(x: number, z: number, baseH: number): number;
  evaluateDetailed(x: number, z: number, baseH: number): StampEvalResult;
  deriveFromObjects(
    objects: readonly PlacedObject[],
    sampleBaseHeight: (x: number, z: number) => number,
    overrides?: ReadonlyMap<string, Partial<Stamp>>
  ): Rect[];
}

/**
 * Commutative polynomial smooth minimum for signed distance fields:
 * h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0, 1)
 * d = mix(d2, d1, h) - k * h * (1 - h)
 */
export function smoothUnionSdf(d1: number, d2: number, k: number): { d: number; h: number } {
  const safeK = Math.max(1e-4, k);
  const rawH = 0.5 + (0.5 * (d2 - d1)) / safeK;
  const h = rawH < 0 ? 0 : rawH > 1 ? 1 : rawH;
  const d = d2 * (1 - h) + d1 * h - safeK * h * (1 - h);
  return { d, h };
}

function pointToSegmentDistSq(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq <= 1e-9) {
    return wx * wx + wz * wz;
  }
  const t = Math.max(0, Math.min(1, (wx * vx + wz * vz) / lenSq));
  const dx = px - (ax + t * vx);
  const dz = pz - (az + t * vz);
  return dx * dx + dz * dz;
}

/**
 * Evaluates exact or high-precision 2D Signed Distance Field d_s(x, z)
 * where d_s <= 0 inside the footprint and d_s > 0 outside.
 */
export function evaluateFootprintSdf(stamp: Stamp, worldX: number, worldZ: number): number {
  const dx = worldX - stamp.centerX;
  const dz = worldZ - stamp.centerZ;
  const cosY = Math.cos(-stamp.yaw);
  const sinY = Math.sin(-stamp.yaw);
  const lx = dx * cosY - dz * sinY;
  const lz = dx * sinY + dz * cosY;

  const shape = stamp.shape;
  switch (shape.kind) {
    case 'obb': {
      const qx = Math.abs(lx) - shape.halfX;
      const qz = Math.abs(lz) - shape.halfZ;
      const outX = Math.max(qx, 0);
      const outZ = Math.max(qz, 0);
      const outside = Math.hypot(outX, outZ);
      const inside = Math.min(Math.max(qx, qz), 0);
      return outside + inside;
    }
    case 'ellipse': {
      const rx = Math.max(0.05, shape.rx);
      const rz = Math.max(0.05, shape.rz);
      const nx = lx / rx;
      const nz = lz / rz;
      const rNorm = Math.hypot(nx, nz);
      if (rNorm < 1e-6) {
        return -Math.min(rx, rz);
      }
      const gx = nx / rx;
      const gz = nz / rz;
      const gradLen = Math.hypot(gx, gz);
      return (rNorm - 1.0) / Math.max(1e-6, gradLen);
    }
    case 'polygon': {
      const pts = shape.points;
      const n = pts.length;
      if (n === 0) return 1e6;
      if (n === 1) return Math.hypot(lx - pts[0][0], lz - pts[0][1]);
      if (n === 2) {
        return Math.sqrt(
          pointToSegmentDistSq(lx, lz, pts[0][0], pts[0][1], pts[1][0], pts[1][1])
        );
      }
      let minDistSq = Infinity;
      let sign = 1;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = pts[i][0];
        const zi = pts[i][1];
        const xj = pts[j][0];
        const zj = pts[j][1];
        const distSq = pointToSegmentDistSq(lx, lz, xi, zi, xj, zj);
        if (distSq < minDistSq) minDistSq = distSq;
        const cond1 = zi > lz;
        const cond2 = zj > lz;
        if (cond1 !== cond2) {
          const xIntersect = ((xj - xi) * (lz - zi)) / (zj - zi + 1e-12) + xi;
          if (lx < xIntersect) {
            sign = -sign;
          }
        }
      }
      return sign * Math.sqrt(minDistSq);
    }
    case 'capsuleChain': {
      const pts = shape.points;
      const n = pts.length;
      const r = Math.max(0.05, shape.radius);
      if (n === 0) return 1e6;
      if (n === 1) {
        return Math.hypot(lx - pts[0][0], lz - pts[0][1]) - r;
      }
      let minDistSq = Infinity;
      for (let i = 0; i < n - 1; i++) {
        const dSq = pointToSegmentDistSq(
          lx,
          lz,
          pts[i][0],
          pts[i][1],
          pts[i + 1][0],
          pts[i + 1][1]
        );
        if (dSq < minDistSq) minDistSq = dSq;
      }
      return Math.sqrt(minDistSq) - r;
    }
  }
}

export function computeStampBounds(stamp: Stamp): Rect {
  const margin = Math.max(0.5, stamp.falloff + stamp.smoothK + 1.0);
  const shape = stamp.shape;
  let halfExtentX = 4;
  let halfExtentZ = 4;

  switch (shape.kind) {
    case 'obb': {
      const c = Math.abs(Math.cos(stamp.yaw));
      const s = Math.abs(Math.sin(stamp.yaw));
      halfExtentX = shape.halfX * c + shape.halfZ * s;
      halfExtentZ = shape.halfX * s + shape.halfZ * c;
      break;
    }
    case 'ellipse': {
      const maxR = Math.max(shape.rx, shape.rz);
      halfExtentX = maxR;
      halfExtentZ = maxR;
      break;
    }
    case 'polygon': {
      let maxR = 1;
      for (const [px, pz] of shape.points) {
        const d = Math.hypot(px, pz);
        if (d > maxR) maxR = d;
      }
      halfExtentX = maxR;
      halfExtentZ = maxR;
      break;
    }
    case 'capsuleChain': {
      if (shape.points.length === 0) break;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      const cosY = Math.cos(stamp.yaw);
      const sinY = Math.sin(stamp.yaw);
      for (const [px, pz] of shape.points) {
        const wx = stamp.centerX + px * cosY - pz * sinY;
        const wz = stamp.centerZ + px * sinY + pz * cosY;
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wz < minZ) minZ = wz;
        if (wz > maxZ) maxZ = wz;
      }
      const r = shape.radius + margin;
      return {
        minX: minX - r,
        minZ: minZ - r,
        maxX: maxX + r,
        maxZ: maxZ + r,
      };
    }
  }

  return {
    minX: stamp.centerX - halfExtentX - margin,
    minZ: stamp.centerZ - halfExtentZ - margin,
    maxX: stamp.centerX + halfExtentX + margin,
    maxZ: stamp.centerZ + halfExtentZ + margin,
  };
}

const CELL_SIZE = 64; // 64 m spatial hash cell

function cellCoords(x: number, z: number): [number, number] {
  return [Math.floor(x / CELL_SIZE), Math.floor(z / CELL_SIZE)];
}

function cellKey(cx: number, cz: number): number {
  return ((cx & 0xffff) << 16) | (cz & 0xffff);
}

export class SpatialStampIndex implements StampIndex {
  private readonly stamps = new Map<string, Stamp>();
  private readonly boundsMap = new Map<string, Rect>();
  private readonly grid = new Map<number, Set<Stamp>>();

  upsert(s: Stamp): Rect {
    const prevBounds = this.boundsMap.get(s.id);
    if (prevBounds) {
      this.removeFromGrid(s.id, prevBounds);
    }

    const cloned: Stamp = {
      ...s,
      falloff: Math.max(0.1, s.falloff),
      smoothK: Math.max(0.05, s.smoothK),
    };
    const bounds = computeStampBounds(cloned);
    this.stamps.set(cloned.id, cloned);
    this.boundsMap.set(cloned.id, bounds);
    this.insertIntoGrid(cloned, bounds);

    if (prevBounds) {
      return {
        minX: Math.min(prevBounds.minX, bounds.minX),
        minZ: Math.min(prevBounds.minZ, bounds.minZ),
        maxX: Math.max(prevBounds.maxX, bounds.maxX),
        maxZ: Math.max(prevBounds.maxZ, bounds.maxZ),
      };
    }
    return bounds;
  }

  remove(id: string): Rect | undefined {
    const bounds = this.boundsMap.get(id);
    if (!bounds) return undefined;
    this.removeFromGrid(id, bounds);
    this.stamps.delete(id);
    this.boundsMap.delete(id);
    return bounds;
  }

  get(id: string): Stamp | undefined {
    return this.stamps.get(id);
  }

  list(): readonly Stamp[] {
    return Array.from(this.stamps.values());
  }

  clear(): void {
    this.stamps.clear();
    this.boundsMap.clear();
    this.grid.clear();
  }

  private insertIntoGrid(stamp: Stamp, r: Rect): void {
    const [minCx, minCz] = cellCoords(r.minX, r.minZ);
    const [maxCx, maxCz] = cellCoords(r.maxX, r.maxZ);
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const k = cellKey(cx, cz);
        let bucket = this.grid.get(k);
        if (!bucket) {
          bucket = new Set<Stamp>();
          this.grid.set(k, bucket);
        }
        bucket.add(stamp);
      }
    }
  }

  private removeFromGrid(id: string, r: Rect): void {
    const existing = this.stamps.get(id);
    if (!existing) return;
    const [minCx, minCz] = cellCoords(r.minX, r.minZ);
    const [maxCx, maxCz] = cellCoords(r.maxX, r.maxZ);
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const k = cellKey(cx, cz);
        const bucket = this.grid.get(k);
        if (bucket) {
          bucket.delete(existing);
          if (bucket.size === 0) {
            this.grid.delete(k);
          }
        }
      }
    }
  }

  queryPoint(x: number, z: number): readonly Stamp[] {
    const [cx, cz] = cellCoords(x, z);
    const bucket = this.grid.get(cellKey(cx, cz));
    if (!bucket || bucket.size === 0) return [];
    const hits: Stamp[] = [];
    for (const s of bucket) {
      const b = this.boundsMap.get(s.id);
      if (b && x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
        hits.push(s);
      }
    }
    return hits;
  }

  queryRect(r: Rect): readonly Stamp[] {
    if (this.stamps.size === 0) return [];
    const [minCx, minCz] = cellCoords(r.minX, r.minZ);
    const [maxCx, maxCz] = cellCoords(r.maxX, r.maxZ);
    const seen = new Set<Stamp>();
    for (let cz = minCz; cz <= maxCz; cz++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const bucket = this.grid.get(cellKey(cx, cz));
        if (!bucket) continue;
        for (const s of bucket) {
          if (seen.has(s)) continue;
          const b = this.boundsMap.get(s.id);
          if (
            b &&
            b.maxX >= r.minX &&
            b.minX <= r.maxX &&
            b.maxZ >= r.minZ &&
            b.minZ <= r.maxZ
          ) {
            seen.add(s);
          }
        }
      }
    }
    return Array.from(seen);
  }

  evaluateDetailed(x: number, z: number, baseH: number): StampEvalResult {
    const candidates = this.queryPoint(x, z);
    if (candidates.length === 0) {
      return {
        hasInfluence: false,
        height: baseH,
        weight: 0,
        signedDistance: Infinity,
      };
    }

    const ordered =
      candidates.length > 1
        ? [...candidates].sort((a, b) =>
            a.priority !== b.priority
              ? a.priority - b.priority
              : a.id < b.id
                ? -1
                : a.id > b.id
                  ? 1
                  : 0
          )
        : candidates;

    let unionD = Infinity;
    let combinedSmoothK = 2.0;
    let combinedFalloff = 4.0;
    let weightedTargetY = 0;
    let totalTargetWeight = 0;
    let bestSplatWeight = 0;
    let dominantSplatId: number | undefined;
    let anyActive = false;

    for (let i = 0; i < ordered.length; i++) {
      const s = ordered[i];
      const d = evaluateFootprintSdf(s, x, z);
      const effectiveFalloff = Math.max(0.1, s.falloff);
      if (d >= effectiveFalloff + s.smoothK) {
        continue;
      }
      anyActive = true;
      const effectiveTargetY = s.targetY + s.padY;

      if (unionD === Infinity) {
        unionD = d;
        combinedSmoothK = s.smoothK;
        combinedFalloff = effectiveFalloff;
      } else {
        const k = Math.max(combinedSmoothK, s.smoothK);
        const { d: mergedD, h } = smoothUnionSdf(unionD, d, k);
        unionD = mergedD;
        combinedSmoothK = k;
        combinedFalloff = combinedFalloff * h + effectiveFalloff * (1 - h);
      }

      const normDist = Math.max(0, d) / effectiveFalloff;
      const insideBoost = d <= 0 ? 1.0 - d * 0.5 : 1.0;
      const w = (1.0 - smoothstep(0, 1, normDist) + 1e-4) * insideBoost;
      weightedTargetY += effectiveTargetY * w;
      totalTargetWeight += w;

      if (s.splatId !== undefined && w > bestSplatWeight) {
        bestSplatWeight = w;
        dominantSplatId = s.splatId;
      }
    }

    if (!anyActive || totalTargetWeight <= 0 || unionD >= combinedFalloff) {
      return {
        hasInfluence: false,
        height: baseH,
        weight: 0,
        signedDistance: unionD,
      };
    }

    const blendedTargetY = weightedTargetY / totalTargetWeight;
    const wUnion = 1.0 - smoothstep(0, combinedFalloff, Math.max(0, unionD));
    const finalHeight = baseH * (1.0 - wUnion) + blendedTargetY * wUnion;

    return {
      hasInfluence: wUnion > 0,
      height: finalHeight,
      weight: wUnion,
      signedDistance: unionD,
      dominantSplatId,
    };
  }

  evaluate(x: number, z: number, baseH: number): number {
    return this.evaluateDetailed(x, z, baseH).height;
  }

  deriveFromObjects(
    objects: readonly PlacedObject[],
    sampleBaseHeight: (x: number, z: number) => number,
    overrides?: ReadonlyMap<string, Partial<Stamp>>
  ): Rect[] {
    const dirtyRects: Rect[] = [];
    const nextObjectIds = new Set<string>();

    for (const obj of objects) {
      const stampId = `obj_${obj.id}`;
      nextObjectIds.add(stampId);
      const meta = PREFAB_CATALOG.find((p) => p.id === (obj.prefabId as PrefabId));
      const scale = Math.max(0.2, obj.scale || 1);
      const rawRadius = meta ? Math.max(4, meta.realHeightMeters * 0.35) * scale : 10 * scale;
      const radiusMeters = Math.max(2.0, Math.min(55, rawRadius * 0.4));
      const ox = obj.x;
      const oy = obj.y;
      const oz = obj.z;
      const yaw = obj.rotationY ?? 0;
      const baseAtCenter = sampleBaseHeight(ox, oz);
      const targetY = Number.isFinite(oy) ? oy : baseAtCenter;

      const userOverride = overrides?.get(obj.id) ?? overrides?.get(stampId);
      const shape: FootprintShape =
        userOverride?.shape ??
        (meta?.category === 'house' || meta?.category === 'landmark'
          ? { kind: 'obb', halfX: radiusMeters * 0.9, halfZ: radiusMeters * 0.85 }
          : { kind: 'ellipse', rx: radiusMeters * 0.85, rz: radiusMeters * 0.85 });

      const stamp: Stamp = {
        id: stampId,
        objectId: obj.id,
        centerX: ox,
        centerZ: oz,
        yaw,
        shape,
        targetY,
        falloff: userOverride?.falloff ?? Math.max(2.0, radiusMeters * 0.65),
        smoothK: userOverride?.smoothK ?? Math.max(1.2, radiusMeters * 0.35),
        priority: userOverride?.priority ?? 0,
        splatId: userOverride?.splatId ?? (meta?.category === 'house' ? 3 : undefined),
        padY: userOverride?.padY ?? 0,
        embedDepth: userOverride?.embedDepth ?? 1.5,
      };

      dirtyRects.push(this.upsert(stamp));
    }

    for (const existingId of Array.from(this.stamps.keys())) {
      if (existingId.startsWith('obj_') && !nextObjectIds.has(existingId)) {
        const r = this.remove(existingId);
        if (r) dirtyRects.push(r);
      }
    }

    return dirtyRects;
  }
}
