import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import {
  MultiResBrushEngine,
  computeBrushTargetLevel,
  createSculptKernel,
} from '../core/brushEngine';
import { computeClipmapMorphAlpha, snapRingOrigin } from '../core/clipmapRenderer';
import { DeterministicDetailGenerator } from '../core/detailGenerator';
import {
  MAX_ATW_CHUNKS,
  WorldSaveV3,
  assertSafeJsonKeys,
  compressGzip,
  crc32,
  exportAtw,
  importAtw,
  validateSettingsV3,
} from '../core/persistenceV3';
import {
  clearSessions,
  loadNewestSession,
  nextOppositeSlot,
  putSession,
} from '../core/sessionStore';
import {
  BrushStrokeCommand,
  CommandHistoryManager,
  ImportCommand,
  ObjectsCommand,
  SettingsCommand,
  WorldSettingsState,
} from '../core/undoCommands';
import { Scheduler } from '../core/scheduler';
import {
  SpatialStampIndex,
  Stamp,
  smoothUnionSdf,
} from '../core/stampSystem';
import { UnifiedTerrainField } from '../core/terrainField';
import { createTerrainV3Engine } from '../core/terrainV3Controller';
import {
  InMemoryTilePersistence,
  IndexedDbTilePersistence,
  SparseTileStore,
  createZeroTile,
  decodeTileValue,
  serializeTileToBytes,
  writeFloatTile,
} from '../core/tileStore';
import {
  ADDRESSABLE_SAMPLES_L0,
  BASE_N,
  Level,
  MAX_LEVEL,
  TILE,
  spacing,
  tileKey,
  tileSpan,
  unpackTileKey,
} from '../core/units';
import {
  encodeHeightmapRawLittleEndian,
  exportHeightmap16,
  reconstructHeightFromUint16,
} from './exportHeightmap';
import { serializeWorldToSavePayload } from './generation';
import {
  sniffImageMimeType,
  validateReconstructAiPayload,
} from './reconstructValidation';
import { PlacedObject } from './registry';

describe('AetherTerra V3: 10-Billion Virtual Sample Clipmap & Non-Destructive Stamp/Link Engine', () => {
  it('1. tileKey & unpackTileKey roundtrip across all levels L=0..9 and tile kinds', () => {
    assert.equal(ADDRESSABLE_SAMPLES_L0, 10_000_200_001);
    for (let l = 0; l <= MAX_LEVEL; l++) {
      const level = l as Level;
      const maxIdx = Math.max(0, Math.ceil(10_000 / tileSpan(level)) - 1);
      const testCoords = [
        [0, 0],
        [maxIdx, maxIdx],
        [Math.floor(maxIdx / 2), Math.floor(maxIdx / 3)],
      ];
      for (const [tx, tz] of testCoords) {
        for (const kind of ['height', 'splat'] as const) {
          const key = tileKey(level, tx, tz, kind);
          const unpacked = unpackTileKey(key);
          assert.equal(unpacked.level, level);
          assert.equal(unpacked.tx, tx);
          assert.equal(unpacked.tz, tz);
          assert.equal(unpacked.kind, kind);
        }
      }
    }
  });

  it('2. Int16 tile dynamic re-quantization maintains sub-millimeter precision and compacts zero tiles', () => {
    const store = new SparseTileStore(16, new InMemoryTilePersistence());
    const tile = store.getOrCreate(0, 10, 12, 'height');

    // First write small range [-2m, +3m]
    const buf1 = new Float32Array(TILE * TILE);
    buf1[0] = -2.0;
    buf1[100] = 1.25;
    buf1[1000] = 3.0;
    writeFloatTile(tile, buf1);

    assert.ok(Math.abs(decodeTileValue(tile, 0) - -2.0) < 1e-3);
    assert.ok(Math.abs(decodeTileValue(tile, 100) - 1.25) < 1e-3);
    assert.ok(Math.abs(decodeTileValue(tile, 1000) - 3.0) < 1e-3);

    // Now exceed range [-45m, +180m] -> triggers dynamic re-quantization
    buf1[0] = -45.0;
    buf1[500] = 62.4;
    buf1[1000] = 180.0;
    writeFloatTile(tile, buf1);

    const maxQuantError = (180 - -45) / 65535;
    assert.ok(Math.abs(decodeTileValue(tile, 0) - -45.0) <= maxQuantError + 1e-4);
    assert.ok(Math.abs(decodeTileValue(tile, 500) - 62.4) <= maxQuantError + 1e-4);
    assert.ok(Math.abs(decodeTileValue(tile, 1000) - 180.0) <= maxQuantError + 1e-4);

    // Zero out and verify compaction
    buf1.fill(0);
    writeFloatTile(tile, buf1);
    const compacted = store.compactIfZero(0, 10, 12, 'height');
    assert.equal(compacted, true);
    assert.equal(store.get(0, 10, 12, 'height'), undefined);
  });

  it('3. Brush level selection L* formula and L0 fine quota enforcement (Gate G3)', () => {
    // Section 8 table verification: r=1m -> L0, r=10m -> L4, r=100m -> L7, r=500m -> L9
    assert.equal(computeBrushTargetLevel(1), 0);
    assert.equal(computeBrushTargetLevel(10), 4);
    assert.equal(computeBrushTargetLevel(100), 7);
    assert.equal(computeBrushTargetLevel(500), 9);

    const baseMap = new Float32Array(BASE_N * BASE_N);
    const store = new SparseTileStore(512);
    const detail = new DeterministicDetailGenerator(1337);
    const stamps = new SpatialStampIndex();
    const field = new UnifiedTerrainField(baseMap, store, detail, stamps);
    const brush = new MultiResBrushEngine(store, field);

    // Measure 1m brush effect at L0 (10cm spacing)
    const beforeCenter = field.sampleHeight(0, 0, 0);
    brush.applyStamp(
      {
        x: 0,
        z: 0,
        radius: 1.0,
        strength: 1.0,
        kernel: createSculptKernel('raise', 1.0),
      },
      0.1
    );
    const afterCenter = field.sampleHeight(0, 0, 0);
    const afterSubGrid = field.sampleHeight(0.2, 0.1, 0);
    const outsideRadius = field.sampleHeight(1.5, 0, 0);

    // Gate G3: 1m brush produces genuine sub-meter edits at 10cm resolution
    assert.ok(afterCenter > beforeCenter + 0.5, 'Center height must increase significantly');
    assert.ok(afterSubGrid > beforeCenter + 0.3, '20cm offset must be smoothly sculpted');
    assert.ok(Math.abs(outsideRadius - field.sampleHeightNoStamps(1.5, 0, 0)) < 1e-4);
  });

  it('4. Nyquist band-limited fBm DetailGenerator is zero-mean, bounded, and band-limits high frequencies at coarse levels', () => {
    const gen = new DeterministicDetailGenerator(42);
    let sum = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const x = (i - 200) * 7.3;
      const z = (i - 200) * 5.1;
      const d0 = gen.sample(x, z, 0);
      const d9 = gen.sample(x, z, 9);
      assert.ok(Math.abs(d0) <= gen.maxDetailMeters);
      // Level 9 (51.2m step) has Nyquist cutoff 2 * 51.2 = 102.4m > 62.5m, so all detail octaves are filtered out
      assert.equal(d9, 0);
      sum += d0;
    }
    const mean = sum / N;
    assert.ok(Math.abs(mean) < 0.25, `Expected near-zero mean, got ${mean}`);
  });

  it('5. Smooth-union SDF is strictly commutative, order-independent, and 100% idempotent on 400m cliffs (Gate G4)', () => {
    // Commutativity of smoothUnionSdf
    for (const [d1, d2, k] of [
      [-1.2, 0.8, 2.5],
      [0.3, 0.4, 1.5],
      [-4.0, -0.5, 3.0],
    ]) {
      const ab = smoothUnionSdf(d1, d2, k);
      const ba = smoothUnionSdf(d2, d1, k);
      assert.ok(Math.abs(ab.d - ba.d) < 1e-12);
    }

    // Order-independence of SpatialStampIndex with 3 overlapping stamps
    const stampA: Stamp = {
      id: 'obj_a',
      objectId: 'a',
      centerX: 0,
      centerZ: 0,
      yaw: 0.2,
      shape: { kind: 'obb', halfX: 5, halfZ: 4 },
      targetY: 20,
      falloff: 6,
      smoothK: 2.5,
      priority: 0,
      padY: 0,
      embedDepth: 1.5,
    };
    const stampB: Stamp = {
      id: 'obj_b',
      objectId: 'b',
      centerX: 4,
      centerZ: 2,
      yaw: -0.4,
      shape: { kind: 'ellipse', rx: 5, rz: 4 },
      targetY: 24,
      falloff: 6,
      smoothK: 2.5,
      priority: 0,
      padY: 0.5,
      embedDepth: 1.5,
    };
    const stampC: Stamp = {
      id: 'obj_c',
      objectId: 'c',
      centerX: 2,
      centerZ: -3,
      yaw: 0,
      shape: {
        kind: 'polygon',
        points: [
          [-4, -4],
          [4, -4],
          [3, 4],
          [-3, 4],
        ],
      },
      targetY: 22,
      falloff: 5,
      smoothK: 2.0,
      priority: 0,
      padY: 0,
      embedDepth: 1.5,
    };

    const idx1 = new SpatialStampIndex();
    idx1.upsert(stampA);
    idx1.upsert(stampB);
    idx1.upsert(stampC);

    const idx2 = new SpatialStampIndex();
    idx2.upsert(stampC);
    idx2.upsert(stampA);
    idx2.upsert(stampB);

    for (let x = -8; x <= 10; x += 1.5) {
      for (let z = -8; z <= 8; z += 1.5) {
        const h1 = idx1.evaluate(x, z, 10);
        const h2 = idx2.evaluate(x, z, 10);
        assert.ok(Math.abs(h1 - h2) < 1e-9, `Order mismatch at (${x},${z}): ${h1} vs ${h2}`);
      }
    }

    // Gate G4: 20 repeated deriveFromObjects / blend calls next to a 400m cliff produce 0.000m drift
    const cliffBase = new Float32Array(BASE_N * BASE_N);
    for (let rz = 0; rz < BASE_N; rz++) {
      for (let rx = 0; rx < BASE_N; rx++) {
        cliffBase[rz * BASE_N + rx] = rx > 80 ? 400 : 0;
      }
    }
    const engine = createTerrainV3Engine(cliffBase, 1337, false);
    const objs: PlacedObject[] = [
      {
        id: 'cliff-house-1',
        prefabId: 'windmill_cottage',
        label: 'Nhà Cối Xay',
        x: 5,
        y: 12,
        z: 0,
        scale: 1,
        rotationY: 0,
      },
      {
        id: 'cliff-house-2',
        prefabId: 'pokemon_center',
        label: 'Trung Tâm',
        x: 14,
        y: 12,
        z: 4,
        scale: 1,
        rotationY: 0,
      },
    ];

    engine.syncPlacedObjects(objs, false);
    const baselineHeights: number[] = [];
    for (let x = -20; x <= 40; x += 2) {
      baselineHeights.push(engine.terrainField.sampleHeight(x, 0, 0));
    }

    for (let iter = 0; iter < 20; iter++) {
      engine.syncPlacedObjects(objs, false);
    }

    let maxDrift = 0;
    let idx = 0;
    for (let x = -20; x <= 40; x += 2) {
      const hAfter = engine.terrainField.sampleHeight(x, 0, 0);
      const drift = Math.abs(hAfter - baselineHeights[idx++]);
      if (drift > maxDrift) maxDrift = drift;
    }
    assert.equal(maxDrift, 0, `Expected 0m drift across 20 re-applications, got ${maxDrift}`);
  });

  it('6. Per-tile diff Undo / Redo restores byte-exact Int16 tile data (Gate G9)', () => {
    const baseMap = new Float32Array(BASE_N * BASE_N);
    const store = new SparseTileStore(128);
    const detail = new DeterministicDetailGenerator(99);
    const stamps = new SpatialStampIndex();
    const field = new UnifiedTerrainField(baseMap, store, detail, stamps);
    const brush = new MultiResBrushEngine(store, field);

    const hInitial = field.sampleHeight(12.3, -8.4, 0);

    // Stroke 1
    brush.beginStroke();
    brush.applyStamp({
      x: 12.3,
      z: -8.4,
      radius: 4.0,
      strength: 0.8,
      kernel: createSculptKernel('raise', 0.8),
    });
    brush.endStroke();

    const hAfterStroke1 = field.sampleHeight(12.3, -8.4, 0);
    assert.ok(hAfterStroke1 > hInitial + 0.2);
    const tileAfter1 = store.get(computeBrushTargetLevel(4.0), 39, 38, 'height');
    const snapshotAfter1 = tileAfter1 ? new Int16Array(tileAfter1.data) : null;

    // Stroke 2 on same area
    brush.beginStroke();
    brush.applyStamp({
      x: 12.3,
      z: -8.4,
      radius: 4.0,
      strength: 0.9,
      kernel: createSculptKernel('raise', 0.9),
    });
    brush.endStroke();

    const hAfterStroke2 = field.sampleHeight(12.3, -8.4, 0);
    assert.ok(hAfterStroke2 > hAfterStroke1);

    // Undo Stroke 2 -> must match Stroke 1 byte-for-byte
    brush.undo();
    const hUndone2 = field.sampleHeight(12.3, -8.4, 0);
    assert.equal(hUndone2, hAfterStroke1);
    if (snapshotAfter1) {
      const tileRestored = store.get(computeBrushTargetLevel(4.0), 39, 38, 'height')!;
      assert.deepEqual(tileRestored.data, snapshotAfter1);
    }

    // Undo Stroke 1 -> must restore clean initial state
    brush.undo();
    assert.equal(field.sampleHeight(12.3, -8.4, 0), hInitial);

    // Redo Stroke 1 -> must match hAfterStroke1 again
    brush.redo();
    assert.equal(field.sampleHeight(12.3, -8.4, 0), hAfterStroke1);
  });

  it('7. LinkSystem socket snapping, 800-object benchmark (<50ms, <=2 meshes), and 0 rebuilds during brush drag (Gate G5 & G6)', () => {
    const baseMap = new Float32Array(BASE_N * BASE_N);
    const engine = createTerrainV3Engine(baseMap, 1337, false);

    const twoHouses: PlacedObject[] = [
      {
        id: 'h1',
        prefabId: 'windmill_cottage',
        label: 'Nhà 1',
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
        rotationY: 0,
      },
      {
        id: 'h2',
        prefabId: 'pokemon_center',
        label: 'Nhà 2',
        x: 8,
        y: 0,
        z: 0,
        scale: 1,
        rotationY: 0,
      },
    ];
    engine.linkSystem.syncObjects(twoHouses);

    // Test findSnap near h1 east socket
    const snap = engine.linkSystem.findSnap('h2', [7.5, 0, 0.2], 0);
    assert.ok(snap !== null, 'Expected a valid socket snap match');
    assert.equal(snap.targetObjId, 'h1');

    // Gate G5: Verify 0 link rebuilds while brush is dragging across 60 stroke stamps
    engine.linkSystem.autoConnectAll(50);
    const rebuildsBeforeDrag = engine.linkSystem.getRebuildCount();
    engine.isBrushDragging = true;
    engine.brushEngine.beginStroke();
    for (let i = 0; i < 60; i++) {
      engine.applySculptStrokeStamp(i * 0.5, 0, 8, 50, 'raise', 0.03);
    }
    engine.brushEngine.endStroke();
    engine.isBrushDragging = false;
    const rebuildsAfterDrag = engine.linkSystem.getRebuildCount();
    assert.equal(
      rebuildsAfterDrag - rebuildsBeforeDrag,
      0,
      'LinkSystem must perform 0 mesh rebuilds during brush drag'
    );

    // Gate G6: 800 objects autoConnectAll in <= 2 meshes (with warm-up for CI/sandbox stability)
    const objects800: PlacedObject[] = [];
    for (let i = 0; i < 800; i++) {
      const gx = (i % 40) * 35 - 700;
      const gz = Math.floor(i / 40) * 35 - 350;
      objects800.push({
        id: `obj800_${i}`,
        prefabId: i % 2 === 0 ? 'windmill_cottage' : 'ancient_bridge',
        label: `Obj ${i}`,
        x: gx,
        y: 0,
        z: gz,
        scale: 1,
        rotationY: 0,
      });
    }

    const timeBuild = (objs: PlacedObject[]) => {
      const t = performance.now();
      engine.linkSystem.syncObjects(objs);
      engine.linkSystem.autoConnectAll(45);
      return performance.now() - t;
    };
    const bestOf = (n: number, fn: () => number) => {
      let best = Infinity;
      for (let i = 0; i < n; i++) best = Math.min(best, fn());
      return best;
    };

    timeBuild(objects800.slice(0, 100)); // warm up JIT
    const t100 = Math.max(0.2, bestOf(3, () => timeBuild(objects800.slice(0, 100))));
    const elapsedMs = bestOf(3, () => timeBuild(objects800));

    const mergedGroup = engine.linkSystem.getMergedGroup();
    assert.ok(
      mergedGroup.children.length <= 2,
      `Expected <= 2 meshes in merged link group, got ${mergedGroup.children.length}`
    );
    assert.ok(
      elapsedMs < 50 && elapsedMs < t100 * 20,
      `Expected near-linear O(N) spatial hash link build for 800 objects (< 50ms and < 20x 100-obj), took ${elapsedMs.toFixed(1)}ms (100-obj: ${t100.toFixed(1)}ms)`
    );

    // Also verify TerrainField.fillSubWindow matches sampleHeight
    const ringBuf = new Float32Array(TILE * TILE);
    assert.equal(typeof engine.terrainField.fillSubWindow, 'function');
    engine.terrainField.fillSubWindow!(0, -10, -10, TILE, 4, 6, 8, 8, ringBuf);
    const step0 = spacing(0);
    for (let rz = 0; rz < 8; rz++) {
      for (let rx = 0; rx < 8; rx++) {
        const expectedH = engine.terrainField.sampleHeight(
          -10 + (4 + rx) * step0,
          -10 + (6 + rz) * step0,
          0
        );
        assert.ok(
          Math.abs(ringBuf[(6 + rz) * TILE + (4 + rx)] - expectedH) < 1e-5,
          'fillSubWindow must match sampleHeight exactly'
        );
      }
    }
  });

  it('8. PersistenceV3 .atw binary roundtrip, migrateV2ToV3, derived color consistency (Gate G7), and prototype-pollution rejection (Gate G8)', async () => {
    const baseMap = new Float32Array(BASE_N * BASE_N);
    baseMap[100] = 42.5;
    const engine = createTerrainV3Engine(baseMap, 2026, false);

    // Paint a stroke and add a link
    engine.applySculptStrokeStamp(15, -15, 6, 65, 'raise', 0.1, 3);
    const objs: PlacedObject[] = [
      {
        id: 'save-a',
        prefabId: 'windmill_cottage',
        label: 'A',
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
        rotationY: 0,
      },
      {
        id: 'save-b',
        prefabId: 'sakura_shrine',
        label: 'B',
        x: 20,
        y: 0,
        z: 0,
        scale: 1,
        rotationY: 0,
      },
    ];
    engine.syncPlacedObjects(objs, false);
    engine.linkSystem.autoConnectAll(50);

    // Record derived colors before save (Gate G7)
    const sampleCoords: Array<[number, number]> = [
      [0, 0],
      [15, -15],
      [20, 0],
      [-100, 200],
    ];
    const colorsBefore = sampleCoords.map(([x, z]) =>
      engine.splatHandle.sampleDerivedRgb(x, z)
    );
    const heightAtStrokeBefore = engine.terrainField.sampleHeight(15, -15, 0);

    // Export binary .atw with microStrokes and import into a fresh engine with different initial seed (1)
    const blob = await engine.exportWorldSaveV3(objs, {
      microStrokes: [{ id: 'ms-1', x: 4, z: -4, radius: 8, brushId: 'emerald_grass' }],
    });
    assert.ok(blob.size > 32, 'Exported .atw blob must be non-empty');

    const freshEngine = createTerrainV3Engine(new Float32Array(BASE_N * BASE_N), 1, false);
    const imported = await freshEngine.importWorldSaveV3(blob);
    assert.equal(imported.version, 3);
    assert.equal(imported.seed, 2026);
    assert.equal(freshEngine.seed, 2026, 'Engine seed getter must update to imported seed');
    assert.equal(imported.objects.length, 2);
    assert.equal(imported.microStrokes?.length, 1);
    assert.ok(imported.tiles.length >= 1);

    // Verify re-exporting from freshEngine preserves seed 2026
    const reExportedBlob = await freshEngine.exportWorldSaveV3(imported.objects);
    const reImported = await importAtw(reExportedBlob);
    assert.equal(reImported.seed, 2026, 'Re-exported .atw must preserve imported seed 2026');

    const heightAtStrokeAfter = freshEngine.terrainField.sampleHeight(15, -15, 0);
    assert.ok(Math.abs(heightAtStrokeAfter - heightAtStrokeBefore) < 1e-3);

    const colorsAfter = sampleCoords.map(([x, z]) =>
      freshEngine.splatHandle.sampleDerivedRgb(x, z)
    );
    assert.deepEqual(colorsAfter, colorsBefore);

    // Test migrateV2ToV3 via importAtw on a legacy v2 JSON blob
    const v2Payload = serializeWorldToSavePayload({
      regionTitle: 'Test V2 World',
      biomeId: 'mondstadt_meadow',
      activeWeather: 'clear_sky',
      waterLevel: -4,
      sunElevation: 45,
      sunAzimuth: 135,
      timeOfDay: 10.5,
      starlightMode: false,
      grassHeightCm: 4,
      flowerSpecies: 'sakura_bloom',
      flowerColorHex: '#f472b6',
      heightMap: baseMap,
      splatMap: new Uint8Array(BASE_N * BASE_N),
      placedObjects: objs,
      microStrokes: [],
    });
    const v2Blob = new Blob([JSON.stringify(v2Payload)], { type: 'application/json' });
    const migrated = await importAtw(v2Blob);
    assert.equal(migrated.version, 3);
    assert.equal(migrated.objects.length, 2);
    assert.equal(migrated.baseHeight[100], 42.5);

    // Gate G8: Reject prototype-pollution keys (__proto__, constructor, prototype)
    const maliciousJson = '{"__proto__": {"polluted": true}, "version": 2}';
    const maliciousBlob = new Blob([maliciousJson], { type: 'application/json' });
    await assert.rejects(
      async () => {
        await importAtw(maliciousBlob);
      },
      /không an toàn|__proto__/
    );
    assert.throws(() => {
      const obj = JSON.parse('{"constructor": {"prototype": {}}}');
      assertSafeJsonKeys(obj);
    }, /không an toàn/);
  });

  it('9. CPU vs GPU clipmap window height parity <= 1mm, morph factor, and raycast bisection accuracy', () => {
    const baseMap = new Float32Array(BASE_N * BASE_N);
    for (let i = 0; i < baseMap.length; i++) {
      baseMap[i] = Math.sin(i * 0.05) * 18;
    }
    const engine = createTerrainV3Engine(baseMap, 777, false);
    const level: Level = 2;
    const originX = snapRingOrigin(25.3, level);
    const originZ = snapRingOrigin(-14.7, level);
    const step = spacing(level);

    // Ensure snapped origin is a multiple of 2 * s(L)
    assert.ok(Math.abs(originX % (2 * step)) < 1e-6);
    assert.ok(Math.abs(originZ % (2 * step)) < 1e-6);

    const win = engine.composeWindow(level, originX, originZ, TILE, TILE);
    for (let rz = 0; rz < TILE; rz += 31) {
      for (let rx = 0; rx < TILE; rx += 31) {
        const wx = originX + rx * step;
        const wz = originZ + rz * step;
        const hCpu = engine.terrainField.sampleHeight(wx, wz, level);
        const hWin = win[rz * TILE + rx];
        assert.ok(Math.abs(hCpu - hWin) < 1e-5, `Window mismatch at (${rx},${rz})`);
      }
    }

    // Morph alpha boundary checks
    assert.equal(computeClipmapMorphAlpha(0, 0, 0, 0, 100), 0);
    assert.equal(computeClipmapMorphAlpha(100, 0, 0, 0, 100), 1);

    // Raycast bisection check
    const targetX = 12.5;
    const targetZ = -18.2;
    const groundY = engine.terrainField.sampleHeight(targetX, targetZ, 0);
    const hit = engine.terrainField.raycast([targetX, groundY + 50, targetZ], [0, -1, 0], 200);
    assert.ok(hit !== null);
    assert.ok(Math.abs(hit.y - groundY) < 1e-2);

    // Scheduler priority & epoch cancellation check
    const sched = new Scheduler();
    const order: number[] = [];
    const ep1 = sched.currentEpoch;
    sched.enqueue({ id: 'low', priority: 4, epoch: ep1, run: () => order.push(4) });
    sched.enqueue({ id: 'high', priority: 1, epoch: ep1, run: () => order.push(1) });
    sched.tick(10, ep1);
    assert.deepEqual(order, [1, 4]);
  });

  it('10. Global-grid sampleEditAtLevel eliminates tile boundary jumps with seam error <= 1 cm (Gate G2)', () => {
    const baseMap = new Float32Array(BASE_N * BASE_N);
    const store = new SparseTileStore(256);
    const detail = new DeterministicDetailGenerator(1337);
    const stamps = new SpatialStampIndex();
    const field = new UnifiedTerrainField(baseMap, store, detail, stamps);
    const brush = new MultiResBrushEngine(store, field);

    // 1. Test brush stroke straddling L0 (25.6m tile span) and L4 (409.6m tile span) tile boundaries
    for (const [level, radius] of [
      [0 as Level, 1.2],
      [2 as Level, 4.0],
      [4 as Level, 15.0],
    ] as const) {
      const span = tileSpan(level);
      const step = spacing(level);
      // Pick tile boundary between tx=10 and tx=11, tz=10 and tz=11
      const boundaryX = -5000 + 11 * span;
      const boundaryZ = -5000 + 11 * span;

      brush.applyStamp(
        {
          x: boundaryX,
          z: boundaryZ,
          radius,
          strength: 1.0,
          kernel: createSculptKernel('raise', 1.0),
        },
        0.15
      );

      // Probe across X boundary and Z boundary with +/- 0.5 mm offset
      const eps = 0.0005;
      for (let offset = -radius * 0.8; offset <= radius * 0.8; offset += step * 0.35) {
        const hLeft = field.sampleHeight(boundaryX - eps, boundaryZ + offset, 0);
        const hRight = field.sampleHeight(boundaryX + eps, boundaryZ + offset, 0);
        const seamJumpX = Math.abs(hRight - hLeft);
        assert.ok(
          seamJumpX <= 0.01,
          `Gate G2 failed on X boundary at L${level}: jump=${seamJumpX.toFixed(5)}m > 0.01m (1cm)`
        );

        const hBottom = field.sampleHeight(boundaryX + offset, boundaryZ - eps, 0);
        const hTop = field.sampleHeight(boundaryX + offset, boundaryZ + eps, 0);
        const seamJumpZ = Math.abs(hTop - hBottom);
        assert.ok(
          seamJumpZ <= 0.01,
          `Gate G2 failed on Z boundary at L${level}: jump=${seamJumpZ.toFixed(5)}m > 0.01m (1cm)`
        );
      }

      // Verify linear ramp interpolation across the last cell [boundaryX - step, boundaryX]
      const hAt255 = field.sampleHeightNoStamps(boundaryX - step, boundaryZ, level);
      const hAt256 = field.sampleHeightNoStamps(boundaryX, boundaryZ, level);
      const hMid = field.sampleHeightNoStamps(boundaryX - 0.5 * step, boundaryZ, level);
      const expectedMid = 0.5 * (hAt255 + hAt256);
      assert.ok(
        Math.abs(hMid - expectedMid) <= 0.01,
        `Gate G2 midpoint interpolation across tile seam at L${level} deviated by ${Math.abs(hMid - expectedMid).toFixed(5)}m`
      );
    }
  });

  it('11. Post-import integrity check (verifyPostImportIntegrity) & save status transitions prevent .atw brush data loss', async () => {
    const baseMap = new Float32Array(BASE_N * BASE_N);
    const sourceEngine = createTerrainV3Engine(baseMap, 8888, false);
    const observedStatuses: string[] = [];
    const unsubSource = sourceEngine.onSaveStatusChange((status) => {
      observedStatuses.push(status);
    });

    assert.equal(sourceEngine.getSaveStatus(), 'saved');

    // Apply a brush stroke and verify status transitions to 'saving' with dirty tiles > 0
    sourceEngine.applySculptStrokeStamp(20, -20, 4.0, 80, 'raise', 0.1, 2);
    assert.equal(sourceEngine.getSaveStatus(), 'saving');
    assert.ok(sourceEngine.tileStore.stats().dirty > 0, 'Sculpt stroke must mark tiles dirty');

    // Run verifyPostImportIntegrity directly on dirty tiles
    const manualIntegrity = await sourceEngine.verifyPostImportIntegrity();
    assert.equal(manualIntegrity.autosaveTriggered, true);
    assert.ok(manualIntegrity.unsyncedTilesFound > 0);
    assert.equal(manualIntegrity.remainingDirtyTiles, 0);
    assert.equal(sourceEngine.getSaveStatus(), 'saved');
    assert.ok(observedStatuses.includes('saving'));
    assert.equal(observedStatuses[observedStatuses.length - 1], 'saved');

    const expectedHeightAtBrush = sourceEngine.terrainField.sampleHeight(20, -20, 0);
    const atwBlob = await sourceEngine.exportWorldSaveV3([]);

    // Import into a target engine and track save status transitions during importWorldSaveV3
    const targetEngine = createTerrainV3Engine(new Float32Array(BASE_N * BASE_N), 1, false);
    const targetStatuses: Array<{ status: string; dirty: number }> = [];
    const unsubTarget = targetEngine.onSaveStatusChange((status, dirty) => {
      targetStatuses.push({ status, dirty });
    });

    await targetEngine.importWorldSaveV3(atwBlob);

    // Must have transitioned through 'saving' during import and ended at 'saved' with 0 dirty tiles
    assert.ok(
      targetStatuses.some((s) => s.status === 'saving'),
      'Import must emit saving status while dirty tiles are being synchronized'
    );
    assert.equal(targetEngine.getSaveStatus(), 'saved');
    assert.equal(targetEngine.tileStore.stats().dirty, 0);

    // Even if we force LRU eviction to 0 resident tiles and page back in, imported brush data must survive in persistence
    (targetEngine.tileStore as SparseTileStore).evict();
    const heightAfterImportAndFlush = targetEngine.terrainField.sampleHeight(20, -20, 0);
    assert.ok(
      Math.abs(heightAfterImportAndFlush - expectedHeightAtBrush) < 1e-3,
      'Imported brush height must remain intact after post-import integrity flush'
    );

    unsubSource();
    unsubTarget();
    sourceEngine.dispose();
    targetEngine.dispose();
  });

  it('12. SessionStore (fake-indexeddb) alternates slots a/b, tracks slot on newest session, and computes nextOppositeSlot', async () => {
    await clearSessions();
    assert.equal(await loadNewestSession(), null);
    assert.equal(nextOppositeSlot(undefined), 'a');

    const bytesA = new Uint8Array([1, 2, 3, 4]).buffer;
    const bytesB = new Uint8Array([9, 8, 7, 6, 5]).buffer;

    await putSession('a', { savedAt: 1000, title: 'Phiên A', bytes: bytesA });
    const afterA = await loadNewestSession();
    assert.ok(afterA !== null);
    assert.equal(afterA.title, 'Phiên A');
    assert.equal(afterA.savedAt, 1000);
    assert.equal(afterA.slot, 'a');
    assert.equal(nextOppositeSlot(afterA.slot), 'b');

    await putSession('b', { savedAt: 2500, title: 'Phiên B Mới Hơn', bytes: bytesB });
    const afterB = await loadNewestSession();
    assert.ok(afterB !== null);
    assert.equal(afterB.title, 'Phiên B Mới Hơn');
    assert.equal(afterB.savedAt, 2500);
    assert.equal(afterB.slot, 'b');
    assert.equal(nextOppositeSlot(afterB.slot), 'a');
    assert.deepEqual(new Uint8Array(afterB.bytes), new Uint8Array([9, 8, 7, 6, 5]));

    // Overwrite slot 'a' with an even newer timestamp (3500) while keeping slot 'b' intact
    await putSession('a', { savedAt: 3500, title: 'Phiên A Cập Nhật', bytes: bytesA });
    const afterA2 = await loadNewestSession();
    assert.ok(afterA2 !== null);
    assert.equal(afterA2.title, 'Phiên A Cập Nhật');
    assert.equal(afterA2.savedAt, 3500);
    assert.equal(afterA2.slot, 'a');
    assert.equal(nextOppositeSlot(afterA2.slot), 'b');

    await clearSessions();
    assert.equal(await loadNewestSession(), null);
  });

  it('13. ATW v3 settings metadata, CRC32 corruption detection, 1000-tile roundtrip, and ceiling guard', async () => {
    const baseHeight = new Float32Array(BASE_N * BASE_N);
    const baseSplat = new Uint8Array(BASE_N * BASE_N * 4);
    const sharedData = new Int16Array(TILE * TILE);
    sharedData[0] = 1234;

    // 1. 1,000 tiles + settings roundtrip
    const thousandTiles: WorldSaveV3['tiles'] = [];
    for (let i = 0; i < 1000; i++) {
      thousandTiles.push({
        level: 0,
        tx: i % 100,
        tz: Math.floor(i / 100),
        kind: 'height',
        min: -10,
        scale: 0.01,
        data: sharedData,
      });
    }

    const state1000: WorldSaveV3 = {
      version: 3,
      seed: 4242,
      worldSize: 10000,
      baseHeight,
      baseSplat,
      tiles: thousandTiles,
      objects: [],
      stamps: [],
      links: [],
      settings: {
        biomeId: 'snowpeak_glacier',
        waterLevel: -8.5,
        regionTitle: 'Đỉnh Băng Ngàn Ô',
      },
    };

    const blob1000 = await exportAtw(state1000);
    const imported1000 = await importAtw(blob1000);
    assert.equal(imported1000.tiles.length, 1000);
    assert.deepEqual(imported1000.settings, {
      biomeId: 'snowpeak_glacier',
      waterLevel: -8.5,
      regionTitle: 'Đỉnh Băng Ngàn Ô',
    });

    // Validate settings fallback behavior
    assert.deepEqual(validateSettingsV3({ biomeId: 'unknown_biome', waterLevel: 99999, regionTitle: 'X' }), {
      biomeId: 'mondstadt_meadow',
      waterLevel: 5000,
      regionTitle: 'X',
    });

    // 2. Flip 1 byte in the body to verify CRC32 mismatch detection
    const rawBytes = new Uint8Array(await blob1000.arrayBuffer());
    assert.ok(crc32(rawBytes.subarray(16)) !== 0);
    rawBytes[rawBytes.length - 5] ^= 0xff;
    const corruptedBlob = new Blob([rawBytes], { type: 'application/octet-stream' });
    await assert.rejects(
      async () => {
        await importAtw(corruptedBlob);
      },
      /CRC không khớp/
    );

    // 3. Ceiling check when tile count exceeds MAX_ATW_CHUNKS
    const tooManyTiles: WorldSaveV3['tiles'] = [];
    for (let i = 0; i < MAX_ATW_CHUNKS; i++) {
      tooManyTiles.push({
        level: 0,
        tx: i % 200,
        tz: Math.floor(i / 200),
        kind: 'height',
        min: -1,
        scale: 0.01,
        data: sharedData,
      });
    }
    await assert.rejects(
      async () => {
        await exportAtw({ ...state1000, tiles: tooManyTiles });
      },
      /Thế giới quá lớn để lưu thành một tệp \.atw/
    );
  });

  it('14. Unified Undo: brushDepth alignment and CommandHistoryManager ([brush -> object -> undo] & [5s stroke -> undo])', async () => {
    const engine = createTerrainV3Engine(new Float32Array(BASE_N * BASE_N), 1337, false);

    // Case A: [brush stroke -> place object -> undo] must preserve the brush stroke!
    const snapBeforeStroke = { brushDepth: engine.brushEngine.historyDepth() };
    assert.equal(snapBeforeStroke.brushDepth, 0);

    const hOriginBefore = engine.terrainField.sampleHeight(0, 0, 0);
    engine.applySculptStrokeStamp(0, 0, 5.0, 80, 'raise', 0.1);
    const heightAfterStroke = engine.terrainField.sampleHeight(0, 0, 0);
    assert.ok(heightAfterStroke > hOriginBefore + 0.1, 'Brush stroke must raise terrain at origin');
    assert.equal(engine.brushEngine.historyDepth(), 1);

    // Now user places an object: snapshot records current brushDepth (1)
    const snapBeforePlaceObject = { brushDepth: engine.brushEngine.historyDepth() };
    assert.equal(snapBeforePlaceObject.brushDepth, 1);

    // User undoes object placement: while (historyDepth() > snapBeforePlaceObject.brushDepth) undo()
    while (engine.brushEngine.historyDepth() > snapBeforePlaceObject.brushDepth) {
      engine.brushEngine.undo();
    }
    assert.equal(engine.brushEngine.historyDepth(), 1, 'Undoing object placement must not pop brush stroke');
    assert.ok(
      Math.abs(engine.terrainField.sampleHeight(0, 0, 0) - heightAfterStroke) < 1e-5,
      'Brush stroke height must remain intact after undoing object placement'
    );

    // Case B: Multi-stamp 5-second stroke with intermediate snapshots unwinds cleanly to initial depth
    const h30Before = engine.terrainField.sampleHeight(30, 30, 0);
    const depthBeforeLongStroke = engine.brushEngine.historyDepth(); // 1
    engine.applySculptStrokeStamp(30, 30, 5.0, 80, 'raise', 0.1);
    engine.applySculptStrokeStamp(32, 30, 5.0, 80, 'raise', 0.1);
    engine.applySculptStrokeStamp(34, 30, 5.0, 80, 'raise', 0.1);
    assert.equal(engine.brushEngine.historyDepth(), 4);

    while (engine.brushEngine.historyDepth() > depthBeforeLongStroke) {
      engine.brushEngine.undo();
    }
    assert.equal(engine.brushEngine.historyDepth(), 1);
    assert.ok(Math.abs(engine.terrainField.sampleHeight(30, 30, 0) - h30Before) < 1e-4);

    // Case C: CommandHistoryManager (BrushStrokeCommand, ObjectsCommand, SettingsCommand, ImportCommand)
    const cmdMgr = new CommandHistoryManager(1024 * 1024);
    let currentObjects: PlacedObject[] = [];
    let currentSettings: WorldSettingsState = {
      biomeId: 'mondstadt_meadow',
      waterLevel: -3,
      regionTitle: 'Thung Lũng Gió',
    };

    const hNeg25Before = engine.terrainField.sampleHeight(-25, 25, 0);
    const d0 = engine.brushEngine.historyDepth();
    engine.applySculptStrokeStamp(-25, 25, 4.0, 80, 'raise', 0.1);
    const d1 = engine.brushEngine.historyDepth();
    const hRaised = engine.terrainField.sampleHeight(-25, 25, 0);
    cmdMgr.push(new BrushStrokeCommand(engine.brushEngine, d0, d1));

    const objAfter: PlacedObject[] = [
      { id: 'o1', prefabId: 'windmill_cottage', label: 'Cối Xay', x: 5, y: 0, z: 5, scale: 1, rotationY: 0 },
    ];
    cmdMgr.push(
      new ObjectsCommand(currentObjects, objAfter, (objs) => {
        currentObjects = objs;
      })
    );
    currentObjects = objAfter;

    const settingsAfter: WorldSettingsState = {
      biomeId: 'liyue_amber',
      waterLevel: 2,
      regionTitle: 'Đỉnh Đá Vôi',
    };
    cmdMgr.push(
      new SettingsCommand(currentSettings, settingsAfter, (s) => {
        currentSettings = s;
      })
    );
    currentSettings = settingsAfter;

    await cmdMgr.undo(); // Undo SettingsCommand
    assert.equal(currentSettings.biomeId, 'mondstadt_meadow');
    assert.equal(currentObjects.length, 1);

    await cmdMgr.undo(); // Undo ObjectsCommand
    assert.equal(currentObjects.length, 0);
    assert.ok(Math.abs(engine.terrainField.sampleHeight(-25, 25, 0) - hRaised) < 1e-4);

    await cmdMgr.undo(); // Undo BrushStrokeCommand
    assert.ok(Math.abs(engine.terrainField.sampleHeight(-25, 25, 0) - hNeg25Before) < 1e-4);

    await cmdMgr.redo(); // Redo BrushStrokeCommand
    assert.ok(Math.abs(engine.terrainField.sampleHeight(-25, 25, 0) - hRaised) < 1e-4);

    const h40Before = engine.terrainField.sampleHeight(40, -40, 0);
    const beforeAtw = await engine.exportWorldSaveV3([]);
    engine.applySculptStrokeStamp(40, -40, 4.0, 90, 'raise', 0.1);
    const afterAtw = await engine.exportWorldSaveV3([]);
    const importCmd = new ImportCommand(beforeAtw, afterAtw, async (b) => {
      await engine.importWorldSaveV3(b);
    });
    cmdMgr.push(importCmd);
    await cmdMgr.undo();
    assert.ok(Math.abs(engine.terrainField.sampleHeight(40, -40, 0) - h40Before) < 1e-4);
    await cmdMgr.redo();
    assert.ok(engine.terrainField.sampleHeight(40, -40, 0) > h40Before + 0.1);

    engine.dispose();
  });

  it('15. exportHeightmap16 (.raw little-endian + metadata) & reconstructValidation (MIME + AI payload)', async () => {
    const engine = createTerrainV3Engine(new Float32Array(BASE_N * BASE_N), 1337, false);
    engine.applySculptStrokeStamp(0, 0, 250, 95, 'raise', 0.25);

    const { data, meta } = await exportHeightmap16(engine.terrainField, 65);
    assert.equal(data.length, 65 * 65);
    assert.equal(meta.size, 65);
    assert.equal(meta.worldSize, 10000);
    assert.ok(meta.maxHeight > meta.minHeight);

    const centerIdx = 32 * 65 + 32;
    const reconstructedCenter = reconstructHeightFromUint16(
      data[centerIdx],
      meta.minHeight,
      meta.maxHeight
    );
    const actualCenter = engine.terrainField.sampleHeight(0, 0, 0);
    assert.ok(
      Math.abs(reconstructedCenter - actualCenter) < 0.05,
      '16-bit quantized heightmap must reconstruct center height within 5cm'
    );

    const rawBytes = encodeHeightmapRawLittleEndian(data);
    assert.equal(rawBytes.byteLength, 65 * 65 * 2);

    // MIME magic-byte sniffing
    assert.equal(
      sniffImageMimeType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])),
      'image/png'
    );
    assert.equal(
      sniffImageMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])),
      'image/jpeg'
    );
    assert.equal(
      sniffImageMimeType(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])
      ),
      'image/webp'
    );
    assert.equal(sniffImageMimeType(new Uint8Array([1, 2, 3])), null);

    // AI payload validation
    const validated = validateReconstructAiPayload({
      regionName: '  Thung Lũng Sao Hỏa  ',
      summary: 'Địa hình hẻm núi đỏ',
      biomeId: 'mars_olympus',
      terraceSteps: 99,
      elevationScale: 500,
      detectedObjects: [
        { prefabId: 'mars_olympus_shield', x: 10, z: -10, scale: 1.5, rotationDeg: 405 },
        { prefabId: 'invalid_prefab_id', x: 0, z: 0 },
      ],
    });
    assert.equal(validated.regionName, 'Thung Lũng Sao Hỏa');
    assert.equal(validated.biomeId, 'mars_olympus');
    assert.equal(validated.terraceSteps, 18);
    assert.equal(validated.elevationScale, 85);
    assert.equal(validated.detectedObjects.length, 1);
    assert.equal(validated.detectedObjects[0].rotationDeg, 45);

    engine.dispose();
  });

  it('16. IndexedDbTilePersistence reload listKeys, clear, zeroed tile deletion, flush error retention, and compressGzip guard', async () => {
    const dbName = `test_idb_tiles_${Date.now()}`;
    const idb1 = new IndexedDbTilePersistence(dbName);
    await idb1.clear('w1');

    const store1 = new SparseTileStore({ worldId: 'w1', persistence: idb1, maxResidentTiles: 16 });
    const t1 = store1.getOrCreate(0, 5, 6, 'height');
    const buf = new Float32Array(TILE * TILE);
    buf[0] = 12.5;
    writeFloatTile(t1, buf);
    store1.markTileDirty(t1);
    await store1.flush();
    assert.equal(store1.stats().dirty, 0);

    // Fresh IndexedDbTilePersistence instance (simulating browser reload with empty RAM fallback)
    const idb2 = new IndexedDbTilePersistence(dbName);
    const keysAfterReload = await idb2.listKeys('w1', 'height');
    assert.deepEqual(keysAfterReload, [t1.key], 'listKeys() must read persisted keys from IndexedDB after reload');

    // Compacting a zeroed tile must remove it from IndexedDB so ensure() does not resurrect it
    buf.fill(0);
    writeFloatTile(t1, buf);
    const compacted = store1.compactIfZero(0, 5, 6, 'height');
    assert.equal(compacted, true);
    await new Promise((r) => setTimeout(r, 15));
    const resurrected = await store1.ensure('height', t1.key, false);
    assert.equal(resurrected, undefined, 'Zeroed/compacted tile must not resurrect via ensure()');

    // Re-save and verify clear() removes from IndexedDB
    await idb2.saveBatch('w1', [{ kind: 'height', key: t1.key, bytes: serializeTileToBytes(t1) }]);
    assert.equal((await idb2.listKeys('w1', 'height')).length, 1);
    await idb2.clear('w1');
    const idb3 = new IndexedDbTilePersistence(dbName);
    assert.equal((await idb3.listKeys('w1', 'height')).length, 0, 'clear() must wipe IndexedDB entries');

    // Verify flush() keeps tile dirty if saveBatch throws
    const failingPersistence = new InMemoryTilePersistence();
    failingPersistence.saveBatch = async () => {
      throw new Error('Simulated disk full');
    };
    const failingStore = new SparseTileStore(16, failingPersistence);
    const dirtyTile = failingStore.getOrCreate(0, 1, 1, 'height');
    buf[0] = 5.0;
    writeFloatTile(dirtyTile, buf);
    failingStore.markTileDirty(dirtyTile);
    await assert.rejects(async () => {
      await failingStore.flush();
    }, /Simulated disk full/);
    assert.equal(dirtyTile.dirty, true, 'Tile must remain dirty when saveBatch fails');
    assert.equal(failingStore.stats().dirty, 1);

    // Verify compressGzip throws when CompressionStream is missing
    const origCompressionStream = globalThis.CompressionStream;
    try {
      // @ts-expect-error testing missing CompressionStream in older browsers
      delete globalThis.CompressionStream;
      await assert.rejects(
        async () => {
          await compressGzip(new Uint8Array([1, 2, 3, 4]));
        },
        /CompressionStream/
      );
    } finally {
      globalThis.CompressionStream = origCompressionStream;
    }
  });

  it('17. Clipmap worker brush+stamp preservation, consecutive-frame multi-ring teleport convergence, custom seed/roughness sync, CRC=0 & splatLayers validation, and bounded IDB RAM cache', async () => {
    const baseMap = new Float32Array(BASE_N * BASE_N);
    baseMap.fill(10);
    // Enable worker = true
    const engine = createTerrainV3Engine(baseMap, 777, true);
    engine.detailGen.setBiome('sahara_dunes');
    engine.scheduler.syncWorkerTerrainState(
      engine.terrainField.getBaseHeightMap(),
      engine.detailGen.getParams(),
      engine.detailGen.isEnabled(),
      engine.detailGen.getBiomeRoughness()
    );

    const scene = new THREE.Scene();
    const clipmap = engine.attachClipmap(scene, {
      gpuProfile: 'discrete',
      frameBudgetMs: 2.2,
    });

    // Wait briefly so worker_threads finishes initializing
    await new Promise((r) => setTimeout(r, 40));

    // 1. Sculpt terrain and place an object stamp at (0, 0)
    engine.applySculptStrokeStamp(0, 0, 6.0, 95, 'raise', 0.2);
    engine.syncPlacedObjects(
      [
        {
          id: 'tower_1',
          prefabId: 'windmill_cottage',
          label: 'Tháp Cối Xay',
          x: 4,
          y: 25,
          z: 4,
          scale: 1,
          rotationY: 0,
        },
      ],
      true
    );

    const cam = new THREE.PerspectiveCamera();
    cam.position.set(0, 20, 0);
    clipmap.update(cam);

    // 2. Teleport camera far away (3000m) and back to (0, 0) while worker is active
    cam.position.set(3000, 20, 3000);
    clipmap.update(cam);
    await new Promise((r) => setTimeout(r, 30));

    cam.position.set(0, 20, 0);
    clipmap.update(cam);
    // Wait for worker composeResult callback to arrive BEFORE all main-thread strips finish
    await new Promise((r) => setTimeout(r, 40));
    // Now tick main-thread strips to completion across frames
    for (let f = 0; f < 260 && engine.scheduler.pendingCount() > 0; f++) {
      clipmap.update(cam);
      if (f % 25 === 0) {
        await new Promise((r) => setTimeout(r, 5));
      }
    }

    const snapL0 = clipmap.getRingHeightSnapshot(0);
    assert.ok(snapL0, 'L0 snapshot must exist');
    let maxDiffL0 = 0;
    for (let rz = 0; rz < TILE; rz += 8) {
      for (let rx = 0; rx < TILE; rx += 8) {
        const wx = snapL0.originX + rx * 0.1;
        const wz = snapL0.originZ + rz * 0.1;
        const expected = engine.terrainField.sampleHeight(wx, wz, 0);
        const actual = snapL0.buffer[rz * TILE + rx];
        maxDiffL0 = Math.max(maxDiffL0, Math.abs(actual - expected));
      }
    }
    assert.ok(
      maxDiffL0 < 1e-4,
      `L0 buffer after worker + strip rebuild must match terrainField (edits + stamps + seed 777), got maxDiff=${maxDiffL0}`
    );

    // 3. Consecutive-frame teleports across altitude thresholds (L1 teleports on frame N, L0 teleports on frame N+1)
    cam.position.set(2500, 200, 2500); // camHeight ~ 190 -> dynamicFineLevel = 2 (L0 and L1 hidden)
    clipmap.update(cam);

    // Frame N: descend to y=100 (camHeight ~ 90 -> dynamicFineLevel = 1 -> L1 becomes visible and teleports!)
    cam.position.set(2500, 100, 2500);
    clipmap.update(cam);

    // Frame N+1: descend to y=30 (camHeight ~ 20 -> dynamicFineLevel = 0 -> L0 becomes visible and teleports!)
    cam.position.set(2500, 30, 2500);
    clipmap.update(cam);

    // Run frame updates to drain progressive strips for all rings
    for (let f = 0; f < 260 && engine.scheduler.pendingCount() > 0; f++) {
      clipmap.update(cam);
      if (f % 25 === 0) {
        await new Promise((r) => setTimeout(r, 5));
      }
    }
    assert.equal(
      engine.scheduler.pendingCount(),
      0,
      'All progressive strips for both L1 and L0 must drain without getting stuck'
    );

    const snapL1 = clipmap.getRingHeightSnapshot(1);
    assert.ok(snapL1);
    let maxDiffL1 = 0;
    for (let rz = 0; rz < TILE; rz += 16) {
      for (let rx = 0; rx < TILE; rx += 16) {
        const wx = snapL1.originX + rx * 0.2;
        const wz = snapL1.originZ + rz * 0.2;
        const expected = engine.terrainField.sampleHeight(wx, wz, 1);
        const actual = snapL1.buffer[rz * TILE + rx];
        maxDiffL1 = Math.max(maxDiffL1, Math.abs(actual - expected));
      }
    }
    assert.ok(
      maxDiffL1 < 1e-4,
      `L1 buffer must converge accurately after consecutive-frame teleport, got maxDiff=${maxDiffL1}`
    );

    // 4. Verify importAtw rejects tampered CRC = 0
    const validBlob = await engine.exportWorldSaveV3([]);
    const tamperedBytes = new Uint8Array(await validBlob.arrayBuffer());
    new DataView(tamperedBytes.buffer).setUint32(12, 0, true); // Set expected CRC to 0
    tamperedBytes[tamperedBytes.length - 1] ^= 0xff;
    await assert.rejects(
      async () => {
        await importAtw(new Blob([tamperedBytes]));
      },
      /CRC không khớp/,
      'importAtw must not bypass CRC check when expected CRC is set to 0'
    );

    // 5. Verify IndexedDbTilePersistence bounds in-memory sync cache to maxSyncCacheTiles
    const boundedIdb = new IndexedDbTilePersistence(`test_bounded_${Date.now()}`, 4);
    const entries = [];
    for (let i = 0; i < 10; i++) {
      const t = createZeroTile('height', tileKey(2, i, 0));
      entries.push({ kind: 'height' as const, key: t.key, bytes: serializeTileToBytes(t) });
    }
    await boundedIdb.saveBatch('w_bounded', entries);
    assert.ok(
      boundedIdb.cachedSyncCount() <= 4,
      `IndexedDbTilePersistence sync cache must be bounded to <= 4 entries, got ${boundedIdb.cachedSyncCount()}`
    );
    await boundedIdb.clear('w_bounded');

    engine.dispose();
  });
});


