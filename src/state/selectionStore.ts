import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import {
  PREFAB_CATALOG,
  PrefabCategory,
  PrefabId,
  SculptToolId,
} from '../world/registry';
import { SCULPT_TOOL_PREFAB_MAP } from '../world/sculpting';

export interface SelectionState {
  sculptTool: SculptToolId;
  selectedPrefab: PrefabId;
  sculptPrefabOverride: PrefabId | 'auto';
  prefabCategoryFilter: PrefabCategory | 'all';
  selectedObjectId: string | null;
  selectPrefab: (id: PrefabId) => { name: string };
  setCategoryFilter: (cat: PrefabCategory | 'all') => { name: string } | null;
  setSculptTool: (tool: SculptToolId) => void;
  setSculptPrefabOverride: (override: PrefabId | 'auto') => { name: string } | null;
  selectObject: (id: string | null) => void;
}

const PREFERRED_BY_CAT: Record<PrefabCategory, PrefabId> = {
  house: 'windmill_cottage',
  tree: 'sakura_tree',
  mountain: 'pluto_cryo_volcano',
  landmark: 'ancient_bridge',
};

export function createSelectionStore() {
  return createStore<SelectionState>((set, get) => ({
    sculptTool: 'sheer_cliff',
    selectedPrefab: 'windmill_cottage',
    sculptPrefabOverride: 'auto',
    prefabCategoryFilter: 'all',
    selectedObjectId: null,

    selectPrefab: (nextPrefab) => {
      const meta = PREFAB_CATALOG.find((p) => p.id === nextPrefab) ?? PREFAB_CATALOG[0];
      const cur = get();
      set({
        selectedPrefab: meta.id,
        sculptPrefabOverride: meta.id,
        selectedObjectId: null,
        prefabCategoryFilter:
          cur.prefabCategoryFilter !== 'all' && cur.prefabCategoryFilter !== meta.category
            ? meta.category
            : cur.prefabCategoryFilter,
      });
      return { name: meta.name };
    },

    setCategoryFilter: (nextCat) => {
      if (nextCat === 'all') {
        set({ prefabCategoryFilter: 'all' });
        return null;
      }
      const cur = get();
      const curMeta = PREFAB_CATALOG.find((p) => p.id === cur.selectedPrefab);
      const nextId: PrefabId =
        curMeta?.category === nextCat
          ? cur.selectedPrefab
          : PREFERRED_BY_CAT[nextCat] ??
            PREFAB_CATALOG.find((p) => p.category === nextCat)?.id ??
            cur.selectedPrefab;
      const meta = PREFAB_CATALOG.find((p) => p.id === nextId);
      set({
        prefabCategoryFilter: nextCat,
        selectedPrefab: nextId,
        sculptPrefabOverride: nextId,
        selectedObjectId: null,
      });
      return meta ? { name: meta.name } : null;
    },

    setSculptTool: (nextTool) => {
      const mapped = SCULPT_TOOL_PREFAB_MAP[nextTool];
      const meta = mapped ? PREFAB_CATALOG.find((p) => p.id === mapped.prefabId) : undefined;
      const cur = get();
      set({
        sculptTool: nextTool,
        sculptPrefabOverride: 'auto',
        ...(meta
          ? {
              selectedPrefab: meta.id,
              selectedObjectId: null,
              prefabCategoryFilter:
                cur.prefabCategoryFilter !== 'all' && cur.prefabCategoryFilter !== meta.category
                  ? meta.category
                  : cur.prefabCategoryFilter,
            }
          : {}),
      });
    },

    setSculptPrefabOverride: (nextOverride) => {
      const cur = get();
      if (nextOverride !== 'auto') {
        const meta = PREFAB_CATALOG.find((p) => p.id === nextOverride);
        if (!meta) return null;
        set({
          sculptPrefabOverride: meta.id,
          selectedPrefab: meta.id,
          selectedObjectId: null,
          prefabCategoryFilter:
            cur.prefabCategoryFilter !== 'all' && cur.prefabCategoryFilter !== meta.category
              ? meta.category
              : cur.prefabCategoryFilter,
        });
        return { name: meta.name };
      }
      const mapped = SCULPT_TOOL_PREFAB_MAP[cur.sculptTool];
      const meta = mapped ? PREFAB_CATALOG.find((p) => p.id === mapped.prefabId) : undefined;
      set({
        sculptPrefabOverride: 'auto',
        ...(meta
          ? {
              selectedPrefab: meta.id,
              prefabCategoryFilter:
                cur.prefabCategoryFilter !== 'all' && cur.prefabCategoryFilter !== meta.category
                  ? meta.category
                  : cur.prefabCategoryFilter,
            }
          : {}),
      });
      return meta ? { name: meta.name } : null;
    },

    selectObject: (id) => set({ selectedObjectId: id }),
  }));
}

export const selectionStore = createSelectionStore();
export const useSelection = <T,>(selector: (s: SelectionState) => T): T =>
  useStore(selectionStore, selector);
