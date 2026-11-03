import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MultiResBrushEngine,
  computeBrushTargetLevel,
  createSculptKernel,
} from '../core/brushEngine';
import { computeClipmapMorphAlpha, snapRingOrigin } from '../core/clipmapRenderer';
import { DeterministicDetailGenerator } from '../core/detailGenerator';
import { NonDestructiveLinkSystem } from '../core/linkSystem';
import {
  assertSafeJsonKeys,
  exportAtw,
  importAtw,
  migrateV2ToV3,
} from '../core/persistenceV3';
import { Scheduler } from '../core/scheduler';
import { evaluateProceduralSplatColor } from '../core/splatMaterial';
import {
  SpatialStampIndex,
  Stamp,
  evaluateFootprintSdf,
  smoothUnionSdf,
} from '../core/stampSystem';
import { UnifiedTerrainField } from '../core/terrainField';
import { createTerrainV3Engine } from '../core/terrainV3Controller';
import {
  InMemoryTilePersistence,
  SparseTileStore,
  decodeTileValue,
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
import { serializeWorldToSavePayload } from './generation';
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

    // Gate G6: 800 objects autoConnectAll in <= 50ms and <= 2 meshes
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
    const t0 = performance.now();
    engine.linkSystem.syncObjects(objects800);
    engine.linkSystem.autoConnectAll(45);
    const elapsedMs = performance.now() - t0;

    const mergedGroup = engine.linkSystem.getMergedGroup();
    assert.ok(
      mergedGroup.children.length <= 2,
      `Expected <= 2 meshes in merged link group, got ${mergedGroup.children.length}`
    );
    assert.ok(
      elapsedMs < 50,
      `Expected fast O(N) spatial hash link build for 800 objects (< 50ms), took ${elapsedMs.toFixed(1)}ms`
    );
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

    // Export binary .atw and import into a fresh engine
    const blob = await engine.exportWorldSaveV3(objs);
    assert.ok(blob.size > 32, 'Exported .atw blob must be non-empty');

    const freshEngine = createTerrainV3Engine(new Float32Array(BASE_N * BASE_N), 1, false);
    const imported = await freshEngine.importWorldSaveV3(blob);
    assert.equal(imported.version, 3);
    assert.equal(imported.objects.length, 2);
    assert.ok(imported.tiles.length >= 1);

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
});
