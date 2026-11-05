import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { createTerrainV3Engine } from '../src/core/terrainV3Controller';
import { BASE_N, TILE, snapToGrid, spacing } from '../src/core/units';
import { PlacedObject } from '../src/world/registry';

function runCalibrationLoop(): number {
  const t0 = performance.now();
  let acc = 0;
  for (let i = 0; i < 1_000_000; i++) {
    acc += Math.sin(i * 0.001) * Math.cos(i * 0.002);
  }
  if (acc === Number.NaN) console.log(acc);
  return Math.max(0.1, performance.now() - t0);
}

function generateObjects(count: number): PlacedObject[] {
  const list: PlacedObject[] = [];
  const cols = Math.ceil(Math.sqrt(count));
  for (let i = 0; i < count; i++) {
    const gx = (i % cols) * 32 - (cols * 32) / 2;
    const gz = Math.floor(i / cols) * 32 - (cols * 32) / 2;
    list.push({
      id: `bench_obj_${i}`,
      prefabId: i % 2 === 0 ? 'windmill_cottage' : 'ancient_bridge',
      label: `Object ${i}`,
      x: gx,
      y: 0,
      z: gz,
      scale: 1,
      rotationY: (i % 4) * (Math.PI / 2),
    });
  }
  return list;
}

function runBenchmark(): void {
  console.log('=== AetherTerra 3D v3 Performance Benchmark ===\n');
  const calibMs = runCalibrationLoop();
  const recordedMetrics: Record<string, number> = {};

  const baseHeight = new Float32Array(BASE_N * BASE_N);
  for (let i = 0; i < baseHeight.length; i++) {
    baseHeight[i] = Math.sin(i * 0.03) * 25;
  }

  // 1. Link building benchmark for N = 20 / 100 / 300 / 800 objects
  console.log('1. Non-Destructive Link & Stamp Build (N = 20 / 100 / 300 / 800):');
  console.log('   Count | Build Time (ms) | Mesh Count | Links Created');
  console.log('   ------+-----------------+------------+--------------');

  for (const n of [20, 100, 300, 800]) {
    const engine = createTerrainV3Engine(baseHeight, 1337, false);
    const objs = generateObjects(n);
    const t0 = performance.now();
    engine.stampIndex.deriveFromObjects(objs, (x, z) =>
      engine.terrainField.sampleHeightNoStamps(x, z, 2)
    );
    engine.linkSystem.syncObjects(objs);
    const links = engine.linkSystem.autoConnectAll(45);
    const dt = performance.now() - t0;
    if (n === 800) recordedMetrics.linkBuild800Ms = Number(dt.toFixed(2));
    const meshCount = engine.linkSystem.getMergedGroup().children.length;
    console.log(
      `   ${String(n).padStart(5)} | ${dt.toFixed(2).padStart(12)} ms | ${String(meshCount).padStart(10)} | ${String(links.length).padStart(13)}`
    );
    engine.dispose();
  }

  // 2. composeWindow (256x256 samples at L0 = 0.1m)
  console.log('\n2. composeWindow (256x256 samples at L0 = 0.1m):');
  const engine = createTerrainV3Engine(baseHeight, 1337, false);
  const outWin = new Float32Array(TILE * TILE);
  const originX = snapToGrid(0, 2 * spacing(0));
  const originZ = snapToGrid(0, 2 * spacing(0));

  const w0 = performance.now();
  const iterations = 10;
  for (let i = 0; i < iterations; i++) {
    engine.composeWindow(0, originX, originZ, TILE, TILE, outWin);
  }
  const avgWinMs = (performance.now() - w0) / iterations;
  recordedMetrics.composeWindowL0Ms = Number(avgWinMs.toFixed(2));
  console.log(`   Average 256×256 L0 window compose: ${avgWinMs.toFixed(2)} ms`);

  // 3. 1,000 brush stamps at radii 1m, 10m, 100m
  console.log('\n3. 1,000 Brush Stamps across Radii (1 m / 10 m / 100 m):');
  for (const r of [1, 10, 100]) {
    const bEngine = createTerrainV3Engine(baseHeight, 1337, false);
    bEngine.brushEngine.beginStroke();
    const b0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      const wx = ((i * 17) % 600) - 300;
      const wz = ((i * 31) % 600) - 300;
      bEngine.applySculptStrokeStamp(wx, wz, r, 50, 'raise', 0.02);
    }
    bEngine.brushEngine.endStroke();
    const totalMs = performance.now() - b0;
    if (r === 10) recordedMetrics.brush1000StampsR10Ms = Number(totalMs.toFixed(2));
    const stats = bEngine.tileStore.stats();
    console.log(
      `   Radius ${String(r).padStart(3)} m (L${bEngine.brushEngine.selectLevel(r)}): ${(totalMs / 1000).toFixed(3)} ms/stamp (Total: ${totalMs.toFixed(1)} ms, Resident tiles: ${stats.tiles}, ${(stats.bytes / (1024 * 1024)).toFixed(2)} MB)`
    );
    bEngine.dispose();
  }

  // 4. Clipmap Toroidal Strip Update across Camera Speeds (1.2 m/s, 6 m/s, 30 m/s, 4.5 km teleport)
  console.log('\n4. Clipmap Toroidal Strip Update (300 frames per speed):');
  console.log('   Camera Speed | Avg (ms) | p95 (ms) | Frames > 16.6 ms');
  console.log('   -------------+----------+----------+-----------------');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 20000);
  const clipmap = engine.attachClipmap(scene);
  clipmap.update(camera);
  clipmap.flushPendingCompositions();

  for (const speed of [1.2, 6, 30]) {
    const step = speed / 60;
    const frameTimes: number[] = [];
    let overBudget = 0;
    for (let f = 0; f < 300; f++) {
      camera.position.x += step;
      camera.position.z += step * 0.5;
      const f0 = performance.now();
      clipmap.update(camera);
      const dt = performance.now() - f0;
      frameTimes.push(dt);
      if (dt > 16.6) overBudget++;
    }
    frameTimes.sort((a, b) => a - b);
    const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    if (speed === 6) recordedMetrics.clipmapUpdateAvgMs = Number(avg.toFixed(2));
    const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)];
    console.log(
      `   ${ `${speed} m/s`.padStart(12) } | ${avg.toFixed(2).padStart(8)} | ${p95.toFixed(2).padStart(8)} | ${`${overBudget}/300`.padStart(16)}`
    );
  }

  engine.dispose();

  const outPath = path.resolve(process.cwd(), 'bench/out.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify({ calibMs: Number(calibMs.toFixed(2)), metrics: recordedMetrics }, null, 2)
  );
}

runBenchmark();
