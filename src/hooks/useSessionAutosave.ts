import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ATW_CHUNK_WARNING_THRESHOLD,
  MAX_ATW_CHUNKS,
  checkStorageQuotaWarning,
} from '../core/persistenceV3';
import {
  SessionRecord,
  loadNewestSession,
  nextOppositeSlot,
  putSession,
} from '../core/sessionStore';
import {
  TerrainSaveStatus,
  TerrainV3EngineBundle,
} from '../core/terrainV3Controller';
import { BiomeId, MicroStrokeStamp, PlacedObject } from '../world/registry';

export interface SessionAutosaveWorldState {
  placedObjects: PlacedObject[];
  microStrokes: MicroStrokeStamp[];
  biomeId: BiomeId;
  waterLevel: number;
  regionTitle: string;
}

export function useSessionAutosaveAndShortcuts(options: {
  v3EngineRef: React.MutableRefObject<TerrainV3EngineBundle | null>;
  latestStateRef: React.MutableRefObject<SessionAutosaveWorldState>;
  placedObjects: PlacedObject[];
  biomeId: BiomeId;
  waterLevel: number;
  regionTitle: string;
  microStrokes: MicroStrokeStamp[];
  showToast: (msg: string) => void;
  onUndo: () => void;
  setIsDockCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  setIsShortcutsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    v3EngineRef,
    latestStateRef,
    placedObjects,
    biomeId,
    waterLevel,
    regionTitle,
    microStrokes,
    showToast,
    onUndo,
    setIsDockCollapsed,
    setIsShortcutsModalOpen,
  } = options;

  const [saveStatus, setSaveStatus] = useState<TerrainSaveStatus>('saved');
  const [dirtyTileCount, setDirtyTileCount] = useState<number>(0);
  const [pendingSession, setPendingSession] = useState<SessionRecord | null>(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState<boolean>(false);
  const scheduleSessionAutosaveRef = useRef<(() => void) | null>(null);
  const nextSessionSlotRef = useRef<'a' | 'b'>('a');

  // Subscribe to V3 tileStore dirty status & autosave lifecycle
  useEffect(() => {
    const engine = v3EngineRef.current;
    if (!engine) return;
    setSaveStatus(engine.getSaveStatus());
    setDirtyTileCount(engine.tileStore.stats().dirty);
    return engine.onSaveStatusChange((nextStatus, nextDirtyCount) => {
      setSaveStatus(nextStatus);
      setDirtyTileCount(nextDirtyCount);
    });
  }, [v3EngineRef]);

  // Startup: request persistent storage and check for recoverable session in IndexedDB
  useEffect(() => {
    let cancelled = false;
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      void navigator.storage.persist().catch(() => {});
    }
    loadNewestSession()
      .then((rec) => {
        if (cancelled) return;
        nextSessionSlotRef.current = nextOppositeSlot(rec?.slot);
        if (rec && rec.bytes && rec.bytes.byteLength > 16) {
          setPendingSession(rec);
        } else {
          setAutosaveEnabled(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAutosaveEnabled(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 5-second debounced session autosave into alternating 'a' / 'b' IndexedDB slots
  useEffect(() => {
    const eng = v3EngineRef.current;
    if (!eng || !autosaveEnabled) {
      scheduleSessionAutosaveRef.current = null;
      return;
    }
    let timer = 0;
    let dirty = false;
    let consecutiveErrors = 0;

    const flush = async () => {
      if (!dirty) return;
      dirty = false;
      try {
        const q = await checkStorageQuotaWarning();
        if (q.warning80Pct) {
          showToast('Bộ nhớ trình duyệt gần đầy, hãy xuất .atw để sao lưu.');
        }
        const tStats = eng.tileStore.stats();
        if (tStats.edited >= ATW_CHUNK_WARNING_THRESHOLD) {
          showToast(
            `Cảnh báo: Đã sửa ${tStats.edited}/${MAX_ATW_CHUNKS - 2} ô địa hình (>80% trần lưu trữ) — hãy xuất .atw để sao lưu.`
          );
        }
        const cur = latestStateRef.current;
        const blob = await eng.exportWorldSaveV3(cur.placedObjects, {
          microStrokes: cur.microStrokes,
          settings: {
            biomeId: cur.biomeId,
            waterLevel: cur.waterLevel,
            regionTitle: cur.regionTitle,
          },
        });
        const targetSlot = nextSessionSlotRef.current;
        await putSession(targetSlot, {
          savedAt: Date.now(),
          title: cur.regionTitle,
          bytes: await blob.arrayBuffer(),
          slot: targetSlot,
        });
        nextSessionSlotRef.current = nextOppositeSlot(targetSlot);
        consecutiveErrors = 0;
        setSaveStatus(eng.getSaveStatus());
      } catch (err) {
        dirty = true;
        consecutiveErrors += 1;
        setSaveStatus('error');
        const reason = err instanceof Error ? err.message : 'Lỗi không xác định';
        showToast(
          `Tự động lưu phiên thất bại (lần ${consecutiveErrors}: ${reason}) — Hãy xuất .ATW để tránh mất dữ liệu.`
        );
        if (consecutiveErrors <= 3) {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            void flush();
          }, 5000 * consecutiveErrors);
        }
      }
    };

    const schedule = () => {
      dirty = true;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void flush();
      }, 5000);
    };

    scheduleSessionAutosaveRef.current = schedule;
    const off = eng.terrainField.on('changed', schedule);
    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        void flush();
      }
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      scheduleSessionAutosaveRef.current = null;
      off();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [autosaveEnabled, latestStateRef, showToast, v3EngineRef]);

  // Schedule session autosave when React world state changes
  const isInitialMountRef = useRef(true);
  // biome-ignore lint/correctness/useExhaustiveDependencies: schedule debounced autosave whenever world state props change
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    scheduleSessionAutosaveRef.current?.();
  }, [placedObjects, biomeId, waterLevel, regionTitle, microStrokes]);

  const handleForceSyncTerrain = useCallback(() => {
    const engine = v3EngineRef.current;
    if (!engine) return;
    setSaveStatus('saving');
    scheduleSessionAutosaveRef.current?.();
    void engine
      .verifyPostImportIntegrity()
      .then((res) => {
        setDirtyTileCount(res.remainingDirtyTiles);
        setSaveStatus(res.remainingDirtyTiles > 0 ? 'saving' : 'saved');
      })
      .catch(() => {
        setSaveStatus('error');
      });
  }, [v3EngineRef]);

  // Keyboard shortcuts driven by single source of truth (SHORTCUTS in src/ui/shortcuts.ts)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsShortcutsModalOpen(false);
        return;
      }
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        onUndo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setIsDockCollapsed((prev) => !prev);
      } else if (e.key === '?') {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onUndo, setIsDockCollapsed, setIsShortcutsModalOpen]);

  return {
    saveStatus,
    setSaveStatus,
    dirtyTileCount,
    setDirtyTileCount,
    pendingSession,
    setPendingSession,
    autosaveEnabled,
    setAutosaveEnabled,
    handleForceSyncTerrain,
  };
}
