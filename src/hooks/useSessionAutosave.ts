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
  selectNextWriteSlot,
} from '../core/sessionStore';
import {
  TerrainSaveStatus,
  TerrainV3EngineBundle,
} from '../core/terrainV3Controller';
import { t } from '../i18n';
import { BiomeId, MicroStrokeStamp, PlacedObject } from '../world/registry';

export interface SessionAutosaveWorldState {
  placedObjects: PlacedObject[];
  microStrokes: MicroStrokeStamp[];
  biomeId: BiomeId;
  waterLevel: number;
  regionTitle: string;
}

export type ShortcutKeyAction = 'escape' | 'undo' | 'redo' | 'zen' | 'help' | null;

/**
 * Pure keyboard shortcut classifier:
 * - Ctrl/Cmd+Z (without Shift) -> 'undo'
 * - Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y -> 'redo'
 * - Escape -> 'escape'
 * - H (when not focused in an input/textarea/select) -> 'zen'
 * - ? (when not focused in an input/textarea/select) -> 'help'
 */
export function resolveKeyboardShortcutAction(event: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  activeElementTagName?: string | null;
}): ShortcutKeyAction {
  if (event.key === 'Escape') {
    return 'escape';
  }
  const tag = event.activeElementTagName ? event.activeElementTagName.toUpperCase() : '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return null;
  }
  const mod = Boolean(event.ctrlKey || event.metaKey);
  if (mod && !event.altKey) {
    const lower = event.key.toLowerCase();
    if (lower === 'z') {
      return event.shiftKey ? 'redo' : 'undo';
    }
    if (lower === 'y' && !event.shiftKey) {
      return 'redo';
    }
    return null;
  }
  if (mod || event.altKey) {
    return null;
  }
  if (event.key === 'h' || event.key === 'H') {
    return 'zen';
  }
  if (event.key === '?') {
    return 'help';
  }
  return null;
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
  onRedo?: () => void;
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
    onRedo,
    setIsDockCollapsed,
    setIsShortcutsModalOpen,
  } = options;

  const [saveStatus, setSaveStatus] = useState<TerrainSaveStatus>('saved');
  const [dirtyTileCount, setDirtyTileCount] = useState<number>(0);
  const [pendingSession, setPendingSession] = useState<SessionRecord | null>(null);
  const [autosaveEnabled, setAutosaveEnabled] = useState<boolean>(false);
  const scheduleSessionAutosaveRef = useRef<(() => void) | null>(null);
  const nextSessionSlotRef = useRef<'a' | 'b'>('a');
  const pinnedDismissedSlotRef = useRef<'a' | 'b' | null>(null);
  const sessionSaveErrorRef = useRef<boolean>(false);
  const warnedStorageQuotaRef = useRef<boolean>(false);
  const warnedChunkCeilingRef = useRef<boolean>(false);

  // Subscribe to V3 tileStore dirty status & autosave lifecycle without letting tileStore 'saved' mask an active session autosave error
  useEffect(() => {
    const engine = v3EngineRef.current;
    if (!engine) return;
    setSaveStatus(sessionSaveErrorRef.current ? 'error' : engine.getSaveStatus());
    setDirtyTileCount(engine.tileStore.stats().dirty);
    return engine.onSaveStatusChange((nextStatus, nextDirtyCount) => {
      setDirtyTileCount(nextDirtyCount);
      if (sessionSaveErrorRef.current && nextStatus === 'saved') {
        setSaveStatus('error');
      } else {
        setSaveStatus(nextStatus);
      }
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

  const dismissPendingSession = useCallback(() => {
    if (pendingSession?.slot) {
      pinnedDismissedSlotRef.current = pendingSession.slot;
      nextSessionSlotRef.current = nextOppositeSlot(pendingSession.slot);
    }
    setPendingSession(null);
    setAutosaveEnabled(true);
  }, [pendingSession]);

  // 5-second debounced session autosave into alternating 'a' / 'b' IndexedDB slots with in-flight guard
  useEffect(() => {
    const eng = v3EngineRef.current;
    if (!eng || !autosaveEnabled) {
      scheduleSessionAutosaveRef.current = null;
      return;
    }
    let timer = 0;
    let dirty = false;
    let inFlight = false;
    let consecutiveErrors = 0;

    const flush = async () => {
      if (!dirty || inFlight) return;
      inFlight = true;
      dirty = false;
      try {
        const q = await checkStorageQuotaWarning();
        if (q.warning80Pct) {
          if (!warnedStorageQuotaRef.current) {
            warnedStorageQuotaRef.current = true;
            showToast(t('autosave.storageNearlyFull'));
          }
        } else {
          warnedStorageQuotaRef.current = false;
        }

        const tStats = eng.tileStore.stats();
        if (tStats.edited >= ATW_CHUNK_WARNING_THRESHOLD) {
          if (!warnedChunkCeilingRef.current) {
            warnedChunkCeilingRef.current = true;
            showToast(
              t('autosave.chunkQuotaWarning', {
                edited: tStats.edited,
                max: MAX_ATW_CHUNKS - 2,
              })
            );
          }
        } else {
          warnedChunkCeilingRef.current = false;
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
        const targetSlot = pinnedDismissedSlotRef.current
          ? nextOppositeSlot(pinnedDismissedSlotRef.current)
          : nextSessionSlotRef.current;
        await putSession(targetSlot, {
          savedAt: Date.now(),
          title: cur.regionTitle,
          bytes: await blob.arrayBuffer(),
          slot: targetSlot,
        });
        nextSessionSlotRef.current = selectNextWriteSlot(
          targetSlot,
          pinnedDismissedSlotRef.current
        );
        consecutiveErrors = 0;
        sessionSaveErrorRef.current = false;
        setSaveStatus(eng.getSaveStatus());
      } catch (err) {
        dirty = true;
        consecutiveErrors += 1;
        sessionSaveErrorRef.current = true;
        setSaveStatus('error');
        const reason = err instanceof Error ? err.message : 'Unknown error';
        showToast(
          t('autosave.failed', {
            count: consecutiveErrors,
            reason,
          })
        );
        if (consecutiveErrors <= 3) {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            void flush();
          }, 5000 * consecutiveErrors);
        }
      } finally {
        inFlight = false;
        if (dirty && consecutiveErrors === 0) {
          window.clearTimeout(timer);
          timer = window.setTimeout(() => {
            void flush();
          }, 5000);
        }
      }
    };

    const schedule = () => {
      dirty = true;
      if (inFlight) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void flush();
      }, 5000);
    };

    scheduleSessionAutosaveRef.current = schedule;
    const off = eng.terrainField.on('changed', schedule);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void flush();
      }
    };
    const onPageHide = () => {
      void flush();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      scheduleSessionAutosaveRef.current = null;
      off();
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [autosaveEnabled, latestStateRef, showToast, v3EngineRef]);

  // Schedule session autosave when React world state changes
  const isInitialMountRef = useRef(true);
  const lastWorldStateSnapshotRef = useRef({
    placedObjects,
    biomeId,
    waterLevel,
    regionTitle,
    microStrokes,
  });
  useEffect(() => {
    const prev = lastWorldStateSnapshotRef.current;
    lastWorldStateSnapshotRef.current = {
      placedObjects,
      biomeId,
      waterLevel,
      regionTitle,
      microStrokes,
    };
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (
      prev.placedObjects !== placedObjects ||
      prev.biomeId !== biomeId ||
      prev.waterLevel !== waterLevel ||
      prev.regionTitle !== regionTitle ||
      prev.microStrokes !== microStrokes
    ) {
      scheduleSessionAutosaveRef.current?.();
    }
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
      const action = resolveKeyboardShortcutAction({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        shiftKey: e.shiftKey,
        activeElementTagName: document.activeElement?.tagName ?? null,
      });
      if (action === 'escape') {
        setIsShortcutsModalOpen(false);
      } else if (action === 'undo') {
        e.preventDefault();
        onUndo();
      } else if (action === 'redo') {
        e.preventDefault();
        onRedo?.();
      } else if (action === 'zen') {
        setIsDockCollapsed((prev) => !prev);
      } else if (action === 'help') {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onUndo, onRedo, setIsDockCollapsed, setIsShortcutsModalOpen]);

  return {
    saveStatus,
    setSaveStatus,
    dirtyTileCount,
    setDirtyTileCount,
    pendingSession,
    setPendingSession,
    dismissPendingSession,
    autosaveEnabled,
    setAutosaveEnabled,
    handleForceSyncTerrain,
  };
}
