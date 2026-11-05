import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveQuality } from './adaptiveQuality';

test('AdaptiveQuality steps down to min under sustained 33ms frames without oscillation and recovers to max under 8ms frames', () => {
  const aq = new AdaptiveQuality(0.6, 2.0);
  let changes = 0;
  for (let i = 0; i < 600; i++) {
    const res = aq.update(33);
    if (res !== null) {
      changes++;
      assert.ok(res >= 0.6 && res <= 2.0);
    }
  }
  assert.ok(changes >= 2 && changes <= 15);
  assert.ok(Math.abs(aq.scale - 0.6) < 1e-6, `Expected scale to reach 0.6, got ${aq.scale}`);

  // Once at min (0.6) with continued slow frames, it must not emit redundant updates
  assert.equal(aq.update(33), null);

  // Recover under fast 8ms frames
  for (let i = 0; i < 1200; i++) {
    aq.update(8);
  }
  assert.ok(Math.abs(aq.scale - 2.0) < 1e-6, `Expected scale to recover to 2.0, got ${aq.scale}`);
});
