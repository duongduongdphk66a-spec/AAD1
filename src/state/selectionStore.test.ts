import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelectionStore } from './selectionStore';
import { PREFAB_CATALOG, PrefabId } from '../world/registry';

test('selectPrefab: ID không hợp lệ rơi về phần tử đầu của PREFAB_CATALOG', () => {
  const s = createSelectionStore();
  s.getState().selectObject('obj-1');
  s.getState().selectPrefab('khong_ton_tai' as PrefabId);
  assert.equal(s.getState().selectedPrefab, PREFAB_CATALOG[0].id);
  assert.equal(s.getState().sculptPrefabOverride, PREFAB_CATALOG[0].id);
  assert.equal(s.getState().selectedObjectId, null);
});

test('selectPrefab: giữ nguyên filter "all", nhưng đổi filter nếu đang lọc danh mục khác', () => {
  const s = createSelectionStore();
  s.getState().selectPrefab('sakura_tree');
  assert.equal(s.getState().prefabCategoryFilter, 'all');

  s.getState().setCategoryFilter('house');
  assert.equal(s.getState().prefabCategoryFilter, 'house');
  s.getState().selectPrefab('sakura_tree');
  assert.equal(s.getState().prefabCategoryFilter, 'tree');
});

test('setCategoryFilter: chọn prefab ưu tiên theo danh mục khi prefab hiện tại khác loại', () => {
  const s = createSelectionStore();
  s.getState().setCategoryFilter('mountain');
  assert.equal(s.getState().selectedPrefab, 'pluto_cryo_volcano');
  assert.equal(s.getState().sculptPrefabOverride, 'pluto_cryo_volcano');
});

test('setSculptTool: công cụ không có prefab ánh xạ (smooth) giữ nguyên selectedPrefab', () => {
  const s = createSelectionStore();
  s.getState().selectPrefab('sakura_tree');
  s.getState().setSculptTool('smooth');
  assert.equal(s.getState().sculptTool, 'smooth');
  assert.equal(s.getState().sculptPrefabOverride, 'auto');
  assert.equal(s.getState().selectedPrefab, 'sakura_tree');
});

test('gọi liên tiếp trong cùng tick đọc được ngay trạng thái mới (không cần latestStateRef)', () => {
  const s = createSelectionStore();
  s.getState().setCategoryFilter('tree');
  s.getState().selectPrefab('ancient_bridge');
  assert.equal(s.getState().selectedPrefab, 'ancient_bridge');
  assert.equal(s.getState().prefabCategoryFilter, 'landmark');
});
