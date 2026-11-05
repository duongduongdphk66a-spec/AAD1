import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAnalysis } from './aiAnalysis';

test('sanitizeAnalysis returns null for non-object inputs (null, undefined, array, primitives)', () => {
  assert.equal(sanitizeAnalysis(null), null);
  assert.equal(sanitizeAnalysis(undefined), null);
  assert.equal(sanitizeAnalysis([]), null);
  assert.equal(sanitizeAnalysis('invalid'), null);
  assert.equal(sanitizeAnalysis(42), null);
});

test('sanitizeAnalysis clamps numeric ranges, filters unknown prefabs, and caps detectedObjects at 14', () => {
  const manyObjects = Array.from({ length: 100 }, (_, i) => ({
    prefabId: i % 2 === 0 ? 'windmill_cottage' : 'unknown_alien_prefab',
    label: 'A'.repeat(120),
    x: i % 3 === 0 ? Number.NaN : 9999,
    z: -9999,
    scale: 500,
    rotationY: 100,
  }));

  const out = sanitizeAnalysis({
    regionName: 'R'.repeat(200),
    summary: 'S'.repeat(500),
    biome: 'not_a_real_biome',
    dominantTexture: 'not_a_real_texture',
    reliefScale: Number.NaN,
    waterLevel: 9999,
    terraceSteps: 42.7,
    detectedObjects: manyObjects,
  });

  assert.ok(out);
  assert.equal(out.regionName.length, 80);
  assert.equal(out.summary.length, 300);
  assert.equal(out.biome, null);
  assert.equal(out.dominantTexture, null);
  assert.equal(out.reliefScale, 1);
  assert.equal(out.waterLevel, 80);
  assert.equal(out.terraceSteps, 8);
  // First 14 items examined, half of which have valid prefabId ('windmill_cottage')
  assert.equal(out.detectedObjects.length, 7);
  assert.equal(out.detectedObjects[0].prefabId, 'windmill_cottage');
  assert.equal(out.detectedObjects[0].label.length, 60);
  assert.equal(out.detectedObjects[0].x, 0); // NaN fallback
  assert.equal(out.detectedObjects[1].x, 48); // 9999 clamped to 48
  assert.equal(out.detectedObjects[0].z, -48); // -9999 clamped to -48
  assert.equal(out.detectedObjects[0].scale, 3); // 500 clamped to 3
  assert.ok(Math.abs(out.detectedObjects[0].rotationY - Math.PI * 2) < 1e-6);
});
