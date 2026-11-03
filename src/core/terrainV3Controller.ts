import * as THREE from 'three';
import { PlacedObject, SculptToolId } from '../world/registry';
import {
  BrushCostEstimate,
  BrushEngine,
  MultiResBrushEngine,
  createSculptKernel,
} from './brushEngine';
import { ClipmapOptions, ClipmapRenderer, ClipmapStats } from './clipmapRenderer';
import { DetailGenerator, DeterministicDetailGenerator } from './detailGenerator';
import { Link, LinkSystem, NonDestructiveLinkSystem, SnapMatch } from './linkSystem';
import {
  WorldSaveV3,
  exportAtw,
  extractNonEmptyTilesForSave,
  importAtw,
  migrateV2ToV3,
} from './persistenceV3';
import { Scheduler } from './scheduler';
import { SplatMaterialHandle, createSplatMaterialHandle } from './splatMaterial';
import { SpatialStampIndex, Stamp, StampIndex } from './stampSystem';
import { TerrainField, UnifiedTerrainField } from './terrainField';
import {
  InMemoryTilePersistence,
  IndexedDbTilePersistence,
  SparseTileStore,
  TileStore,
} from './tileStore';
import { ADDRESSABLE_SAMPLES_L0, BASE_N, Level, Rect, tileSpan } from './units';

export interface TerrainV3EngineBundle {
  readonly seed: number;
  readonly tileStore: TileStore;
  readonly detailGen: DetailGenerator;
  readonly stampIndex: StampIndex;
  readonly terrainField: TerrainField;
  readonly brushEngine: BrushEngine;
  readonly splatHandle: SplatMaterialHandle;
  readonly linkSystem: LinkSystem;
  readonly scheduler: Scheduler;
  clipmap: ClipmapRenderer | null;
  stampOverrides: Map<string, Partial<Stamp>>;
  isBrushDragging: boolean;
  attachClipmap(scene: THREE.Scene, opts?: Partial<ClipmapOptions>): ClipmapRenderer;
  detachClipmap(scene: THREE.Scene): void;
  syncPlacedObjects(objects: readonly PlacedObject[], autoConnect?: boolean): void;
  applySculptStrokeStamp(
    x: number,
    z: number,
    radiusMeters: number,
    strengthPct: number,
    tool: SculptToolId,
    dt?: number,
    splatId?: number
  ): Rect;
  composeWindow(
    level: Level,
    originX: number,
    originZ: number,
    w: number,
    h: number,
    out?: Float32Array
  ): Float32Array;
  exportWorldSaveV3(objects: readonly PlacedObject[]): Promise<Blob>;
  importWorldSaveV3(blob: Blob): Promise<WorldSaveV3>;
  flushAutosave(): Promise<void>;
  getHudMetrics(fps?: number): {
    addressableSamples: number;
    residentTiles: number;
    residentMB: number;
    fineAreaKm2: number;
    activeLevels: number;
    fineActiveLevel: Level;
    visibleTriangles: number;
    pendingJobs: number;
    fps: number;
    uploadMs: number;
    softCapExceeded: boolean;
    dirtyTiles: number;
  };
  estimateBrush(radiusMeters: number): BrushCostEstimate;
  dispose(): void;
}

export function createTerrainV3Engine(
  initialBaseHeightMap: Float32Array,
  seed = 1337,
  useIndexedDb = typeof indexedDB !== 'undefined'
): TerrainV3EngineBundle {
  const persistence = useIndexedDb
    ? new IndexedDbTilePersistence('aetherterra-v3-tiles')
    : new InMemoryTilePersistence();

  const tileStore = new SparseTileStore(512, persistence);
  const detailGen = new DeterministicDetailGenerator(seed);
  const stampIndex = new SpatialStampIndex();
  const terrainField = new UnifiedTerrainField(
    initialBaseHeightMap,
    tileStore,
    detailGen,
    stampIndex
  );
  const brushEngine = new MultiResBrushEngine(tileStore, terrainField);
  const splatHandle = createSplatMaterialHandle(terrainField, tileStore, stampIndex);
  const linkSystem = new NonDestructiveLinkSystem(terrainField, stampIndex);
  const scheduler = new Scheduler();
  const stampOverrides = new Map<string, Partial<Stamp>>();

  let clipmap: ClipmapRenderer | null = null;
  let isBrushDragging = false;
  let linkRebuildTimer: ReturnType<typeof setTimeout> | null = null;
  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  const scheduleDebouncedAutosave = () => {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer);
    }
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void tileStore.flush();
    }, 2000);
    if (typeof (autosaveTimer as unknown as { unref?: () => void }).unref === 'function') {
      (autosaveTimer as unknown as { unref: () => void }).unref();
    }
  };

  const unsubscribeAutosave = tileStore.onDirty(() => {
    scheduleDebouncedAutosave();
  });

  const scheduleDebouncedLinkConnect = (objects: readonly PlacedObject[], autoConnect: boolean) => {
    if (linkRebuildTimer !== null) {
      clearTimeout(linkRebuildTimer);
      linkRebuildTimer = null;
    }
    if (!autoConnect) {
      linkSystem.clearLinks();
      return;
    }
    // Never rebuild link meshes while the user is actively dragging the terrain brush
    if (isBrushDragging) return;

    linkRebuildTimer = setTimeout(() => {
      linkRebuildTimer = null;
      if (!isBrushDragging) {
        linkSystem.syncObjects(objects);
        linkSystem.autoConnectAll(140);
      }
    }, 150);
  };

  const bundle: TerrainV3EngineBundle = {
    seed,
    tileStore,
    detailGen,
    stampIndex,
    terrainField,
    brushEngine,
    splatHandle,
    linkSystem,
    scheduler,
    clipmap: null,
    stampOverrides,
    get isBrushDragging() {
      return isBrushDragging;
    },
    set isBrushDragging(v: boolean) {
      isBrushDragging = v;
    },

    attachClipmap(scene: THREE.Scene, opts?: Partial<ClipmapOptions>): ClipmapRenderer {
      if (clipmap) {
        scene.remove(clipmap.root);
        clipmap.dispose();
      }
      clipmap = new ClipmapRenderer(terrainField, splatHandle, opts, scheduler);
      bundle.clipmap = clipmap;
      scene.add(clipmap.root);
      scene.add(linkSystem.getMergedGroup());
      return clipmap;
    },

    detachClipmap(scene: THREE.Scene): void {
      if (clipmap) {
        scene.remove(clipmap.root);
        clipmap.dispose();
        clipmap = null;
        bundle.clipmap = null;
      }
      scene.remove(linkSystem.getMergedGroup());
    },

    syncPlacedObjects(objects: readonly PlacedObject[], autoConnect = true): void {
      const dirtyRects = stampIndex.deriveFromObjects(
        objects,
        (x, z) => terrainField.sampleHeightNoStamps(x, z, 2),
        stampOverrides
      );
      linkSystem.syncObjects(objects);
      for (const r of dirtyRects) {
        terrainField.notifyChanged(r, 2);
      }
      scheduleDebouncedLinkConnect(objects, autoConnect);
    },

    applySculptStrokeStamp(
      x: number,
      z: number,
      radiusMeters: number,
      strengthPct: number,
      tool: SculptToolId,
      dt = 0.05,
      splatId?: number
    ): Rect {
      const normStrength = Math.max(0.05, Math.min(2.0, strengthPct / 50));
      let mode: 'raise' | 'lower' | 'flatten' | 'smooth' | 'terrace' | 'noise' = 'raise';
      if (
        tool === 'lower' ||
        tool === 'abyss_chasm' ||
        tool === 'canyon_gorge' ||
        tool === 'meander_river_delta' ||
        tool === 'methane_basin' ||
        tool === 'meteor_crater'
      ) {
        mode = 'lower';
      } else if (tool === 'flatten' || tool === 'shield_mesa') {
        mode = 'flatten';
      } else if (tool === 'smooth') {
        mode = 'smooth';
      } else if (tool === 'terrace') {
        mode = 'terrace';
      }

      const kernel = createSculptKernel(
        mode,
        normStrength,
        mode === 'flatten' ? terrainField.sampleHeight(x, z, 2) : undefined
      );

      return brushEngine.applyStamp(
        {
          x,
          z,
          radius: radiusMeters,
          strength: normStrength,
          kernel,
          splatId,
        },
        dt
      );
    },

    composeWindow(
      level: Level,
      originX: number,
      originZ: number,
      w: number,
      h: number,
      out?: Float32Array
    ): Float32Array {
      const target = out ?? new Float32Array(w * h);
      terrainField.fillWindow(level, originX, originZ, w, h, target);
      return target;
    },

    async exportWorldSaveV3(objects: readonly PlacedObject[]): Promise<Blob> {
      const baseHeight = terrainField.getBaseHeightMap();
      const baseSplat = new Uint8Array(BASE_N * BASE_N * 4);
      const state: WorldSaveV3 = {
        version: 3,
        seed,
        worldSize: 10000,
        baseHeight,
        baseSplat,
        tiles: extractNonEmptyTilesForSave(tileStore.entries()),
        objects: [...objects],
        stamps: [...stampIndex.list()],
        links: [...linkSystem.listLinks()],
      };
      return exportAtw(state);
    },

    async importWorldSaveV3(blob: Blob): Promise<WorldSaveV3> {
      const state = await importAtw(blob);
      detailGen.configure({ seed: state.seed });
      tileStore.clear();
      for (const t of state.tiles) {
        const tile = tileStore.getOrCreate(t.level, t.tx, t.tz, t.kind);
        tile.min = t.min;
        tile.scale = t.scale;
        tile.data.set(t.data);
        tile.dirty = false;
      }
      stampIndex.clear();
      for (const s of state.stamps) {
        stampIndex.upsert(s);
      }
      terrainField.setBaseHeightMap(state.baseHeight);
      linkSystem.syncObjects(state.objects);
      linkSystem.clearLinks();
      for (const l of state.links) {
        linkSystem.upsertLink(l);
      }
      splatHandle.syncBaseSplatFromField();
      return state;
    },

    async flushAutosave(): Promise<void> {
      if (autosaveTimer !== null) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      await tileStore.flush();
    },

    getHudMetrics(fps = 60) {
      const tStats = tileStore.stats();
      const cStats: ClipmapStats = clipmap
        ? clipmap.getStats()
        : {
            activeLevels: 10,
            fineActiveLevel: 0,
            visiblePatches: 52,
            visibleTriangles: 106_496,
            uploadMs: 0.15,
          };
      const l0Count = tileStore.countTilesAtLevel(0, 'height');
      const l0SpanKm = tileSpan(0) / 1000;
      const fineAreaKm2 = l0Count * l0SpanKm * l0SpanKm;
      const residentMB = 1.4 + tStats.bytes / (1024 * 1024);

      return {
        addressableSamples: ADDRESSABLE_SAMPLES_L0,
        residentTiles: tStats.tiles,
        residentMB,
        fineAreaKm2,
        activeLevels: cStats.activeLevels,
        fineActiveLevel: cStats.fineActiveLevel,
        visibleTriangles: cStats.visibleTriangles,
        pendingJobs: scheduler.pendingCount(),
        fps,
        uploadMs: cStats.uploadMs,
        softCapExceeded: tStats.softCapExceeded,
        dirtyTiles: tStats.dirty,
      };
    },

    estimateBrush(radiusMeters: number): BrushCostEstimate {
      return brushEngine.estimateCost(radiusMeters);
    },

    dispose(): void {
      unsubscribeAutosave();
      if (autosaveTimer !== null) {
        clearTimeout(autosaveTimer);
        autosaveTimer = null;
      }
      if (linkRebuildTimer !== null) {
        clearTimeout(linkRebuildTimer);
      }
      if (clipmap) {
        clipmap.dispose();
        clipmap = null;
      }
      scheduler.dispose();
      linkSystem.dispose();
      splatHandle.dispose();
    },
  };

  return bundle;
}

export { exportAtw, importAtw, migrateV2ToV3 };
export type { SnapMatch, Link };

