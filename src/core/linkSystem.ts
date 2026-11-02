import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PREFAB_CATALOG, PlacedObject, PrefabId } from '../world/registry';
import { Stamp, StampIndex } from './stampSystem';
import { TerrainField } from './terrainField';
import { clamp } from './units';

export type LinkKind = 'snap' | 'merge' | 'path' | 'fence' | 'bridge';

export interface SocketDef {
  id: string;
  localPos: [number, number, number];
  localDir: [number, number, number];
  kind: 'wall' | 'road' | 'pipe' | 'bridge';
  radius: number;
}

export interface Link {
  id: string;
  kind: LinkKind;
  a: { objectId: string; socketId: string };
  b: { objectId: string; socketId: string };
  waypoints: Array<[number, number, number]>;
  width: number;
  splatId: number;
  bakedMeshId?: string;
}

export interface SnapMatch {
  targetObjId: string;
  targetSocket: string;
  sourceSocket: string;
  worldTransform: {
    position: [number, number, number];
    yaw: number;
  };
  distance: number;
}

export interface LinkSystem {
  findSnap(
    movingObjId: string,
    candidatePos: [number, number, number],
    candidateYaw?: number
  ): SnapMatch | null;
  upsertLink(l: Link): void;
  removeLink(id: string): void;
  getLink(id: string): Link | undefined;
  listLinks(): readonly Link[];
  clearLinks(): void;
  buildRibbon(l: Link, field: TerrainField): { mesh: THREE.BufferGeometry; stamp: Stamp };
  bakeUnion(linkId: string): Promise<THREE.BufferGeometry>;
  syncObjects(objects: readonly PlacedObject[]): void;
  autoConnectAll(maxDistMeters?: number): Link[];
  getMergedGroup(): THREE.Group;
  getRebuildCount(): number;
  dispose(): void;
}

const SOCKET_CELL_SIZE = 64;
const PREFAB_META_MAP = new Map(PREFAB_CATALOG.map((p) => [p.id, p]));

function socketCellKey(x: number, z: number): number {
  const cx = Math.floor(x / SOCKET_CELL_SIZE) & 0xffff;
  const cz = Math.floor(z / SOCKET_CELL_SIZE) & 0xffff;
  return (cx << 16) | cz;
}

/**
 * Generates 4 cardinal sockets around an object's bounding footprint.
 */
export function getSocketsForObject(obj: PlacedObject): SocketDef[] {
  const meta = PREFAB_META_MAP.get(obj.prefabId as PrefabId);
  const scale = Math.max(0.2, obj.scale || 1);
  const baseR = meta ? Math.max(2.0, Math.min(35, meta.realHeightMeters * scale * 0.2)) : 5 * scale;
  const kind: SocketDef['kind'] =
    meta?.category === 'house'
      ? 'wall'
      : meta?.category === 'landmark'
        ? 'bridge'
        : 'road';
  const snapRadius = Math.max(4.5, baseR * 0.8);

  return [
    { id: 'north', localPos: [0, 0, -baseR], localDir: [0, 0, -1], kind, radius: snapRadius },
    { id: 'south', localPos: [0, 0, baseR], localDir: [0, 0, 1], kind, radius: snapRadius },
    { id: 'east', localPos: [baseR, 0, 0], localDir: [1, 0, 0], kind, radius: snapRadius },
    { id: 'west', localPos: [-baseR, 0, 0], localDir: [-1, 0, 0], kind, radius: snapRadius },
  ];
}

function socketToWorld(
  pos: [number, number, number],
  yaw: number,
  sock: SocketDef
): { worldPos: [number, number, number]; worldDir: [number, number, number] } {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const [lx, ly, lz] = sock.localPos;
  const [dx, dy, dz] = sock.localDir;
  return {
    worldPos: [
      pos[0] + lx * c - lz * s,
      pos[1] + ly,
      pos[2] + lx * s + lz * c,
    ],
    worldDir: [dx * c - dz * s, dy, dx * s + dz * c],
  };
}

/**
 * Evaluates a 3D centripetal Catmull-Rom spline segment between P1 and P2.
 */
function evalCentripetalCatmullRom3D(
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  u: number
): [number, number, number] {
  const u2 = u * u;
  const u3 = u2 * u;
  const interp = (a: number, b: number, c: number, d: number): number =>
    0.5 *
    (2 * b +
      (-a + c) * u +
      (2 * a - 5 * b + 4 * c - d) * u2 +
      (-a + 3 * b - 3 * c + d) * u3);
  return [
    interp(p0[0], p1[0], p2[0], p3[0]),
    interp(p0[1], p1[1], p2[1], p3[1]),
    interp(p0[2], p1[2], p2[2], p3[2]),
  ];
}

interface WorldSocketEntry {
  objId: string;
  socket: SocketDef;
  worldPos: [number, number, number];
  worldDir: [number, number, number];
}

interface RibbonBufferData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

export class NonDestructiveLinkSystem implements LinkSystem {
  private readonly terrainField: TerrainField;
  private readonly stampIndex: StampIndex;
  private readonly links = new Map<string, Link>();
  private readonly ribbonBuffers = new Map<string, RibbonBufferData>();
  private readonly objectsById = new Map<string, PlacedObject>();
  private readonly socketHash = new Map<number, WorldSocketEntry[]>();
  private readonly mergedGroup = new THREE.Group();
  private readonly ribbonMaterial: THREE.MeshStandardMaterial;
  private mergedMesh: THREE.Mesh | null = null;
  private rebuildCount = 0;

  constructor(terrainField: TerrainField, stampIndex: StampIndex) {
    this.terrainField = terrainField;
    this.stampIndex = stampIndex;
    this.mergedGroup.name = 'NonDestructiveLinksV3';
    this.ribbonMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.54, 0.52, 0.48),
      roughness: 0.78,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }

  getMergedGroup(): THREE.Group {
    return this.mergedGroup;
  }

  getRebuildCount(): number {
    return this.rebuildCount;
  }

  syncObjects(objects: readonly PlacedObject[]): void {
    this.objectsById.clear();
    this.socketHash.clear();

    for (const obj of objects) {
      this.objectsById.set(obj.id, obj);
      const yaw = obj.rotationY ?? 0;
      const pos: [number, number, number] = [obj.x, obj.y, obj.z];
      const sockets = getSocketsForObject(obj);
      for (const sock of sockets) {
        const { worldPos, worldDir } = socketToWorld(pos, yaw, sock);
        const key = socketCellKey(worldPos[0], worldPos[2]);
        let bucket = this.socketHash.get(key);
        if (!bucket) {
          bucket = [];
          this.socketHash.set(key, bucket);
        }
        bucket.push({
          objId: obj.id,
          socket: sock,
          worldPos,
          worldDir,
        });
      }
    }

    let removedAny = false;
    for (const [id, link] of Array.from(this.links.entries())) {
      if (!this.objectsById.has(link.a.objectId) || !this.objectsById.has(link.b.objectId)) {
        this.links.delete(id);
        this.ribbonBuffers.delete(id);
        const rect = this.stampIndex.remove(`link_${id}`);
        if (rect) this.terrainField.notifyChanged(rect, 2);
        removedAny = true;
      }
    }

    if (removedAny) {
      this.rebuildMergedMesh();
    }
  }

  findSnap(
    movingObjId: string,
    candidatePos: [number, number, number],
    candidateYaw = 0
  ): SnapMatch | null {
    const movingObj: PlacedObject = this.objectsById.get(movingObjId) ?? {
      id: movingObjId,
      prefabId: 'windmill_cottage',
      label: 'Moving',
      x: candidatePos[0],
      y: candidatePos[1],
      z: candidatePos[2],
      rotationY: candidateYaw,
      scale: 1,
    };
    const movingSockets = getSocketsForObject(movingObj);

    const cx = Math.floor(candidatePos[0] / SOCKET_CELL_SIZE);
    const cz = Math.floor(candidatePos[2] / SOCKET_CELL_SIZE);

    let bestMatch: SnapMatch | null = null;
    let bestDist = Infinity;

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const key = (((cx + dx) & 0xffff) << 16) | ((cz + dz) & 0xffff);
        const bucket = this.socketHash.get(key);
        if (!bucket) continue;

        for (const targetEntry of bucket) {
          if (targetEntry.objId === movingObjId) continue;

          for (const srcSock of movingSockets) {
            if (srcSock.kind !== targetEntry.socket.kind) continue;

            const { worldPos: srcPos, worldDir: srcDir } = socketToWorld(
              candidatePos,
              candidateYaw,
              srcSock
            );

            const dist = Math.hypot(
              srcPos[0] - targetEntry.worldPos[0],
              srcPos[2] - targetEntry.worldPos[2]
            );
            const maxSnapDist = Math.max(srcSock.radius, targetEntry.socket.radius);
            if (dist > maxSnapDist || dist >= bestDist) continue;

            const dot =
              srcDir[0] * targetEntry.worldDir[0] +
              srcDir[1] * targetEntry.worldDir[1] +
              srcDir[2] * targetEntry.worldDir[2];

            const desiredDirX = -targetEntry.worldDir[0];
            const desiredDirZ = -targetEntry.worldDir[2];
            const srcLocalAngle = Math.atan2(srcSock.localDir[2], srcSock.localDir[0]);
            const targetOppositeAngle = Math.atan2(desiredDirZ, desiredDirX);
            const snappedYaw = dot < -0.7 ? candidateYaw : targetOppositeAngle - srcLocalAngle;

            const c = Math.cos(snappedYaw);
            const s = Math.sin(snappedYaw);
            const [lx, ly, lz] = srcSock.localPos;
            const snappedX = targetEntry.worldPos[0] - (lx * c - lz * s);
            const snappedY = targetEntry.worldPos[1] - ly;
            const snappedZ = targetEntry.worldPos[2] - (lx * s + lz * c);

            bestDist = dist;
            bestMatch = {
              targetObjId: targetEntry.objId,
              targetSocket: targetEntry.socket.id,
              sourceSocket: srcSock.id,
              worldTransform: {
                position: [snappedX, snappedY, snappedZ],
                yaw: snappedYaw,
              },
              distance: dist,
            };
          }
        }
      }
    }

    return bestMatch;
  }

  private buildRibbonBuffers(l: Link, field: TerrainField): { data: RibbonBufferData; stamp: Stamp } {
    const objA = this.objectsById.get(l.a.objectId);
    const objB = this.objectsById.get(l.b.objectId);

    const startPt: [number, number, number] = objA
      ? [objA.x, objA.y, objA.z]
      : l.waypoints[0] ?? [0, 0, 0];
    const endPt: [number, number, number] = objB
      ? [objB.x, objB.y, objB.z]
      : l.waypoints[l.waypoints.length - 1] ?? [10, 0, 10];

    const controlPts: Array<[number, number, number]> = [
      startPt,
      ...l.waypoints,
      endPt,
    ];

    const sampled3D: Array<[number, number, number]> = [];
    const sampled2D: Array<[number, number]> = [];

    for (let seg = 0; seg < controlPts.length - 1; seg++) {
      const p0 = controlPts[Math.max(0, seg - 1)];
      const p1 = controlPts[seg];
      const p2 = controlPts[seg + 1];
      const p3 = controlPts[Math.min(controlPts.length - 1, seg + 2)];

      const segLen = Math.max(0.5, Math.hypot(p2[0] - p1[0], p2[2] - p1[2]));
      const stepDist =
        l.waypoints.length === 0 && segLen > 4 ? Math.max(0.5, segLen / 4) : 0.5;
      const steps = Math.max(2, Math.min(256, Math.ceil(segLen / stepDist)));

      for (let i = 0; i < steps; i++) {
        if (seg > 0 && i === 0) continue;
        const u = i / (steps - 1);
        const [wx, wySpline, wz] = evalCentripetalCatmullRom3D(p0, p1, p2, p3, u);
        const terrH =
          l.waypoints.length === 0
            ? field.sampleBaseHeight(wx, wz)
            : field.sampleHeightNoStamps(wx, wz, 2);
        let h = l.kind === 'bridge' ? Math.max(terrH + 0.35, wySpline) : terrH + 0.12;

        if (sampled3D.length > 0) {
          const prev = sampled3D[sampled3D.length - 1];
          const ds = Math.max(0.1, Math.hypot(wx - prev[0], wz - prev[2]));
          const maxDeltaH = 0.25 * ds;
          h = clamp(h, prev[1] - maxDeltaH, prev[1] + maxDeltaH);
        }

        sampled3D.push([wx, h, wz]);
        sampled2D.push([wx, wz]);
      }
    }

    if (sampled3D.length < 2) {
      sampled3D.push([startPt[0] + 1, startPt[1], startPt[2]]);
      sampled2D.push([startPt[0] + 1, startPt[2]]);
    }

    const halfW = Math.max(0.5, l.width * 0.5);
    const nPts = sampled3D.length;
    const positions = new Float32Array(nPts * 2 * 3);
    const normals = new Float32Array(nPts * 2 * 3);
    const uvs = new Float32Array(nPts * 2 * 2);
    const indices = new Uint32Array((nPts - 1) * 6);

    let arcLen = 0;
    for (let i = 0; i < nPts; i++) {
      const cur = sampled3D[i];
      const prev = sampled3D[Math.max(0, i - 1)];
      const next = sampled3D[Math.min(nPts - 1, i + 1)];
      if (i > 0) {
        arcLen += Math.hypot(cur[0] - prev[0], cur[2] - prev[2]);
      }

      let tx = next[0] - prev[0];
      let tz = next[2] - prev[2];
      const tLen = Math.hypot(tx, tz) || 1;
      tx /= tLen;
      tz /= tLen;

      const nx = -tz;
      const nz = tx;

      const vLeft = i * 2;
      const vRight = i * 2 + 1;

      positions[vLeft * 3] = cur[0] - nx * halfW;
      positions[vLeft * 3 + 1] = cur[1];
      positions[vLeft * 3 + 2] = cur[2] - nz * halfW;

      positions[vRight * 3] = cur[0] + nx * halfW;
      positions[vRight * 3 + 1] = cur[1];
      positions[vRight * 3 + 2] = cur[2] + nz * halfW;

      normals[vLeft * 3] = 0;
      normals[vLeft * 3 + 1] = 1;
      normals[vLeft * 3 + 2] = 0;
      normals[vRight * 3] = 0;
      normals[vRight * 3 + 1] = 1;
      normals[vRight * 3 + 2] = 0;

      uvs[vLeft * 2] = 0;
      uvs[vLeft * 2 + 1] = arcLen / Math.max(1, l.width);
      uvs[vRight * 2] = 1;
      uvs[vRight * 2 + 1] = arcLen / Math.max(1, l.width);

      if (i < nPts - 1) {
        const baseIdx = i * 6;
        const a = vLeft;
        const b = vRight;
        const c = (i + 1) * 2;
        const d = (i + 1) * 2 + 1;
        indices[baseIdx] = a;
        indices[baseIdx + 1] = c;
        indices[baseIdx + 2] = b;
        indices[baseIdx + 3] = b;
        indices[baseIdx + 4] = c;
        indices[baseIdx + 5] = d;
      }
    }

    const maxStampPts = 12;
    const stride = Math.max(1, Math.floor(sampled2D.length / maxStampPts));
    const capsulePts: Array<[number, number]> = [];
    for (let i = 0; i < sampled2D.length; i += stride) {
      capsulePts.push(sampled2D[i]);
    }
    if (capsulePts[capsulePts.length - 1] !== sampled2D[sampled2D.length - 1]) {
      capsulePts.push(sampled2D[sampled2D.length - 1]);
    }

    const avgY =
      sampled3D.reduce((acc, p) => acc + p[1], 0) / Math.max(1, sampled3D.length);

    const stamp: Stamp = {
      id: `link_${l.id}`,
      objectId: l.id,
      centerX: 0,
      centerZ: 0,
      yaw: 0,
      shape: {
        kind: 'capsuleChain',
        points: capsulePts,
        radius: halfW * 1.1,
      },
      targetY: avgY - 0.1,
      falloff: Math.max(2.0, l.width * 0.8),
      smoothK: Math.max(1.2, l.width * 0.4),
      priority: 1,
      splatId: l.splatId,
      padY: 0,
      embedDepth: 0.5,
    };

    return {
      data: { positions, normals, uvs, indices },
      stamp,
    };
  }

  buildRibbon(l: Link, field: TerrainField): { mesh: THREE.BufferGeometry; stamp: Stamp } {
    const { data, stamp } = this.buildRibbonBuffers(l, field);
    const mesh = new THREE.BufferGeometry();
    mesh.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    mesh.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    mesh.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    mesh.setIndex(new THREE.BufferAttribute(data.indices, 1));
    return { mesh, stamp };
  }

  upsertLink(l: Link): void {
    const { data, stamp } = this.buildRibbonBuffers(l, this.terrainField);
    this.links.set(l.id, l);
    this.ribbonBuffers.set(l.id, data);
    const rect = this.stampIndex.upsert(stamp);
    this.rebuildMergedMesh();
    this.terrainField.notifyChanged(rect, 2);
  }

  removeLink(id: string): void {
    if (!this.links.has(id)) return;
    this.links.delete(id);
    this.ribbonBuffers.delete(id);
    const rect = this.stampIndex.remove(`link_${id}`);
    this.rebuildMergedMesh();
    if (rect) {
      this.terrainField.notifyChanged(rect, 2);
    }
  }

  getLink(id: string): Link | undefined {
    return this.links.get(id);
  }

  listLinks(): readonly Link[] {
    return Array.from(this.links.values());
  }

  clearLinks(): void {
    for (const id of Array.from(this.links.keys())) {
      this.stampIndex.remove(`link_${id}`);
    }
    this.links.clear();
    this.ribbonBuffers.clear();
    this.rebuildMergedMesh();
  }

  autoConnectAll(maxDistMeters = 140): Link[] {
    const objs = Array.from(this.objectsById.values());
    if (objs.length < 2) {
      this.clearLinks();
      return [];
    }

    for (const id of Array.from(this.links.keys())) {
      if (id.startsWith('auto_')) {
        this.links.delete(id);
        this.ribbonBuffers.delete(id);
        this.stampIndex.remove(`link_${id}`);
      }
    }

    const cellSize = Math.max(64, maxDistMeters * 0.5);
    const objGrid = new Map<number, PlacedObject[]>();
    for (const o of objs) {
      const cx = Math.floor(o.x / cellSize) & 0xffff;
      const cz = Math.floor(o.z / cellSize) & 0xffff;
      const k = (cx << 16) | cz;
      let bucket = objGrid.get(k);
      if (!bucket) {
        bucket = [];
        objGrid.set(k, bucket);
      }
      bucket.push(o);
    }

    const created: Link[] = [];
    const connectedPairs = new Set<string>();
    const includeIndividualLinkStamps = objs.length <= 120;

    for (const a of objs) {
      const cx = Math.floor(a.x / cellSize);
      const cz = Math.floor(a.z / cellSize);
      let nearest: PlacedObject | null = null;
      let bestDistSq = maxDistMeters * maxDistMeters;

      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          const k = (((cx + dx) & 0xffff) << 16) | ((cz + dz) & 0xffff);
          const bucket = objGrid.get(k);
          if (!bucket) continue;
          for (const b of bucket) {
            if (b.id === a.id) continue;
            const ddx = b.x - a.x;
            const ddz = b.z - a.z;
            const dSq = ddx * ddx + ddz * ddz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              nearest = b;
            }
          }
        }
      }

      if (nearest) {
        const pairKey = a.id < nearest.id ? `${a.id}__${nearest.id}` : `${nearest.id}__${a.id}`;
        if (connectedPairs.has(pairKey)) continue;
        connectedPairs.add(pairKey);

        const link: Link = {
          id: `auto_${pairKey}`,
          kind: 'path',
          a: { objectId: a.id, socketId: 'east' },
          b: { objectId: nearest.id, socketId: 'west' },
          waypoints: [],
          width: 4.5,
          splatId: 3,
        };

        const { data, stamp } = this.buildRibbonBuffers(link, this.terrainField);
        this.links.set(link.id, link);
        this.ribbonBuffers.set(link.id, data);
        if (includeIndividualLinkStamps) {
          this.stampIndex.upsert(stamp);
        }
        created.push(link);
      }
    }

    this.rebuildMergedMesh();
    return created;
  }

  private rebuildMergedMesh(): void {
    this.rebuildCount++;
    if (this.mergedMesh) {
      this.mergedGroup.remove(this.mergedMesh);
      this.mergedMesh.geometry.dispose();
      this.mergedMesh = null;
    }

    const buffers = Array.from(this.ribbonBuffers.values());
    if (buffers.length === 0) return;

    const ribbonGeos: THREE.BufferGeometry[] = [];
    for (const b of buffers) {
      if (b.positions.length === 0 || b.indices.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(b.positions, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(b.normals, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(b.uvs, 2));
      geo.setIndex(new THREE.BufferAttribute(b.indices, 1));
      ribbonGeos.push(geo);
    }

    if (ribbonGeos.length === 0) return;

    const combinedGeo = mergeGeometries(ribbonGeos, false);
    for (const g of ribbonGeos) {
      g.dispose();
    }
    if (!combinedGeo) return;

    this.mergedMesh = new THREE.Mesh(combinedGeo, this.ribbonMaterial);
    this.mergedMesh.name = 'MergedLinkRibbonsMesh';
    this.mergedMesh.receiveShadow = true;
    this.mergedGroup.add(this.mergedMesh);
  }

  async bakeUnion(linkId: string): Promise<THREE.BufferGeometry> {
    const link = this.links.get(linkId);
    const objA = link ? this.objectsById.get(link.a.objectId) : undefined;
    const objB = link ? this.objectsById.get(link.b.objectId) : undefined;

    const { ADDITION, Brush, Evaluator } = await import('three-bvh-csg');

    const boxA = new THREE.BoxGeometry(6, 6, 6);
    const brushA = new Brush(boxA);
    if (objA) {
      brushA.position.set(objA.x, objA.y, objA.z);
    }
    brushA.updateMatrixWorld();

    const boxB = new THREE.BoxGeometry(6, 6, 6);
    const brushB = new Brush(boxB);
    if (objB) {
      brushB.position.set(objB.x, objB.y, objB.z);
    } else {
      brushB.position.set(3, 0, 0);
    }
    brushB.updateMatrixWorld();

    const evaluator = new Evaluator();
    const result = evaluator.evaluate(brushA, brushB, ADDITION);

    if (link) {
      link.kind = 'merge';
      link.bakedMeshId = `csg_${link.id}`;
    }

    return result.geometry;
  }

  dispose(): void {
    this.ribbonBuffers.clear();
    if (this.mergedMesh) {
      this.mergedMesh.geometry.dispose();
    }
    this.ribbonMaterial.dispose();
  }
}
