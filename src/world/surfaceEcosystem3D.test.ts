import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { TEXTURE_BRUSHES, TEXTURE_INDEX_MAP, FLOWER_SPECIES_CATALOG } from './terrainEngine.ts';
import { createSurfaceEcosystemPatch, disposeObject3DTree } from './surfaceEcosystem3D.ts';

for (const brushId of TEXTURE_INDEX_MAP) {
  test(`createSurfaceEcosystemPatch không văng lỗi với cọ "${brushId}"`, () => {
    const patch = createSurfaceEcosystemPatch(
      { id: `smoke-${brushId}`, x: 12, z: -8, radius: 10, brushId },
      1
    );
    assert.ok(patch instanceof THREE.Group);
    assert.equal(patch.userData.brushId, brushId);
    disposeObject3DTree(patch);
  });
}

test('TEXTURE_INDEX_MAP và TEXTURE_BRUSHES luôn đồng bộ', () => {
  assert.deepEqual([...TEXTURE_INDEX_MAP].sort(), Object.keys(TEXTURE_BRUSHES).sort());
});

test('mọi loài hoa trong catalog đều dựng được trên flower_meadow', () => {
  for (const sp of FLOWER_SPECIES_CATALOG) {
    const patch = createSurfaceEcosystemPatch(
      {
        id: `flower-${sp.id}`,
        x: 0,
        z: 0,
        radius: 8,
        brushId: 'flower_meadow',
        flowerSpecies: sp.id,
        flowerColorHex: '#f472b6',
      },
      1
    );
    assert.ok(patch.children.length > 0);
    disposeObject3DTree(patch);
  }
});
