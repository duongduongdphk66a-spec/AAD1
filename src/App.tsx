import React, { useState, useRef, useEffect, useCallback, Suspense, lazy } from 'react';
import {
  Sparkles,
  Camera,
  Compass,
  CheckCircle2,
  Undo2,
  Moon,
  Sun,
} from 'lucide-react';
import {
  BiomeId,
  BIOMES,
  DAY_NIGHT_PRESETS,
  DEFAULT_GRASS_HEIGHT_CM,
  DEFAULT_TERRAIN_RULES,
  FLOWER_SPECIES_CATALOG,
  FlowerSpeciesId,
  generateInitialSurfaceShowcaseStrokes,
  getTextureIndex,
  GRID_SIZE,
  MAX_GRASS_HEIGHT_CM,
  MicroStrokeStamp,
  MIN_BRUSH_RADIUS,
  MIN_GRASS_HEIGHT_CM,
  PlacedObject,
  PREFAB_CATALOG,
  PrefabCategory,
  PrefabId,
  RuleOperator,
  SculptToolId,
  TerrainRule,
  TEXTURE_BRUSHES,
  TextureBrushId,
  TOTAL_VERTICES,
  WeatherId,
  WEATHER_CATALOG,
  WORLD_SIZE,
} from './world/registry';
import {
  applyTextureBrush,
  GridDirtyRect,
  recomputeTerrainColors,
} from './world/brushes';
import {
  applySculptBrush,
  getGroundHeightAt,
  mergeDirtyRect,
} from './world/sculpting';
import {
  executeTerrainRules,
  formatTerrainRuleFormula,
  formatTimeOfDayClock,
  generateBiomeTerrain,
  generateFlatEarthTerrain,
  serializeWorldToSavePayload,
  timeOfDayToSunElevation,
  validateWorldSavePayload,
} from './world/generation';
import { WorldViewport3D, CameraPresetId, ScaleMetrics } from './components/WorldViewport3D';
import { BottomControlDock, ActiveTabId } from './components/BottomControlDock';
import { DistanceScaleBar } from './components/DistanceScaleBar';
import { ErrorBoundary } from './components/ErrorBoundary';

const ImageReconstructModal = lazy(() =>
  import('./components/ImageReconstructModal').then((m) => ({
    default: m.ImageReconstructModal,
  }))
);

interface WorldHistorySnapshot {
  actionLabel: string;
  heightMap: Float32Array;
  splatMap: Uint8Array;
  colorMap: Float32Array;
  placedObjects: PlacedObject[];
  microStrokes: MicroStrokeStamp[];
  selectedObjectId: string | null;
  biomeId: BiomeId;
  waterLevel: number;
  regionTitle: string;
}

const MAX_UNDO_STEPS = 25;

export default function App() {
  // Initial 10x10 km world starts as a Flat Earth Plane ("Mặt Phẳng Đất Nguyên Bản") with 1:1 real-scale village
  const initialWorldRef = useRef(generateFlatEarthTerrain('mondstadt_meadow'));

  const heightMapRef = useRef<Float32Array>(initialWorldRef.current.heightMap);
  const splatMapRef = useRef<Uint8Array>(initialWorldRef.current.splatMap);
  const colorMapRef = useRef<Float32Array>(initialWorldRef.current.colorMap);
  const normalMapRef = useRef<Float32Array>((() => {
    const arr = new Float32Array(TOTAL_VERTICES * 3);
    for (let i = 0; i < TOTAL_VERTICES; i++) {
      arr[i * 3 + 1] = 1.0;
    }
    return arr;
  })());

  const [terrainVersion, setTerrainVersion] = useState<number>(1);
  const [biomeId, setBiomeId] = useState<BiomeId>('mondstadt_meadow');
  const [regionTitle, setRegionTitle] = useState<string>('Mặt Phẳng Đất Nguyên Bản · 10×10km (Vector 1:1)');
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Placed 3D Objects (Houses, Mountains, Trees, Landmarks at 1:1 Real-World Scale)
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>(
    initialWorldRef.current.initialObjects
  );

  // 3D Physical Surface Ecosystem Patches (3-5cm real grass blades, 3D flowers, desert sand dunes, smoking lava)
  const [microStrokes, setMicroStrokes] = useState<MicroStrokeStamp[]>(() =>
    generateInitialSurfaceShowcaseStrokes()
  );

  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(
    initialWorldRef.current.initialObjects[0]?.id ?? null
  );

  // Undo History Stack (up to 25 steps)
  const [undoStack, setUndoStack] = useState<WorldHistorySnapshot[]>([]);
  const lastStrokeSnapshotTimeRef = useRef<number>(0);

  // Unified Bottom Dock State (calibrated for 10x10 km / 10,000,000,000 px / min 1m brush / 1:1 scale)
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<ActiveTabId>('prefabs');
  const [sculptTool, setSculptTool] = useState<SculptToolId>('sheer_cliff');
  const [brushRadius, setBrushRadius] = useState<number>(15); // 15m default brush radius on Page 2 (Thang 25m)
  const [brushStrength, setBrushStrength] = useState<number>(45);
  const [textureBrush, setTextureBrush] = useState<TextureBrushId>('emerald_grass');
  const [grassHeightCm, setGrassHeightCm] = useState<number>(DEFAULT_GRASS_HEIGHT_CM); // 4.0 cm (range 3.0 - 5.0 cm)
  const [flowerSpecies, setFlowerSpecies] = useState<FlowerSpeciesId>('sakura_bloom');
  const [flowerColorHex, setFlowerColorHex] = useState<string>('#f472b6');
  const [carveTerrainOnPaint, setCarveTerrainOnPaint] = useState<boolean>(true);

  // Rule-Based Generation ("Vẽ theo quy luật") State
  const [terrainRules, setTerrainRules] = useState<TerrainRule[]>(() => DEFAULT_TERRAIN_RULES);
  const [autoRuleOnSculpt, setAutoRuleOnSculpt] = useState<boolean>(true);

  // Prefab Placement & Transform State (Orientation 0°-360° & Scale 0.3x-3.0x on top of 1:1 real scale)
  const [selectedPrefab, setSelectedPrefab] = useState<PrefabId>('pluto_cryo_volcano');
  const [prefabCategoryFilter, setPrefabCategoryFilter] = useState<PrefabCategory | 'all'>('all');
  const [placementRotationDeg, setPlacementRotationDeg] = useState<number>(0);
  const [placementScale, setPlacementScale] = useState<number>(1.35);

  // Atmosphere, Planetary Weather, Day/Night Cycle & Camera State
  const [activeWeather, setActiveWeather] = useState<WeatherId>('clear_sky');
  const [sunElevation, setSunElevation] = useState<number>(48);
  const [sunAzimuth, setSunAzimuth] = useState<number>(135);
  const [timeOfDay, setTimeOfDay] = useState<number>(10.5);
  const [isDayNightAuto, setIsDayNightAuto] = useState<boolean>(false);
  const [starlightMode, setStarlightMode] = useState<boolean>(false);
  const [waterLevel, setWaterLevel] = useState<number>(BIOMES.mondstadt_meadow.waterLevel);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('mountain_gallery');
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<number>(0);
  const [showVolcanoRefCard, setShowVolcanoRefCard] = useState<boolean>(true);
  const [activeRefModelIdx, setActiveRefModelIdx] = useState<number>(0);

  // Live Vector Scale Bar & Cursor Coordinates State (Bottom-Right Corner)
  const [scaleMetrics, setScaleMetrics] = useState<ScaleMetrics>({
    metersPerPixel: 0.08,
    cameraDistanceMeters: 62,
  });
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number; z: number } | null>({
    x: 0,
    y: 0,
    z: 0,
  });

  // Image Reconstruction Modal State
  const [isReconstructModalOpen, setIsReconstructModalOpen] = useState<boolean>(false);
  const dirtyRectRef = useRef<GridDirtyRect | null>(null);

  const showToast = useCallback((msg: string) => {
    setStatusBanner(msg);
  }, []);

  const latestStateRef = useRef({
    placedObjects,
    microStrokes,
    selectedObjectId,
    biomeId,
    waterLevel,
    regionTitle,
    undoStack,
  });
  latestStateRef.current = {
    placedObjects,
    microStrokes,
    selectedObjectId,
    biomeId,
    waterLevel,
    regionTitle,
    undoStack,
  };

  useEffect(() => {
    if (!statusBanner) return;
    const timer = window.setTimeout(() => setStatusBanner(null), 4500);
    return () => clearTimeout(timer);
  }, [statusBanner]);

  // Push current state onto Undo Stack before mutating world state
  const pushUndoSnapshot = useCallback((actionLabel: string) => {
    const cur = latestStateRef.current;
    const snapshot: WorldHistorySnapshot = {
      actionLabel,
      heightMap: new Float32Array(heightMapRef.current),
      splatMap: new Uint8Array(splatMapRef.current),
      colorMap: new Float32Array(colorMapRef.current),
      placedObjects: cur.placedObjects.map((o) => ({ ...o })),
      microStrokes: cur.microStrokes.map((m) => ({ ...m })),
      selectedObjectId: cur.selectedObjectId,
      biomeId: cur.biomeId,
      waterLevel: cur.waterLevel,
      regionTitle: cur.regionTitle,
    };
    setUndoStack((prev) => [...prev.slice(-(MAX_UNDO_STEPS - 1)), snapshot]);
  }, []);

  // Undo last action (pure state updates outside updater function for React StrictMode safety)
  const handleUndo = useCallback(() => {
    const stack = latestStateRef.current.undoStack;
    if (stack.length === 0) return;
    const snapshot = stack[stack.length - 1];
    const remainingCount = stack.length - 1;

    setUndoStack((prev) => (prev.length > 0 ? prev.slice(0, -1) : prev));
    heightMapRef.current = new Float32Array(snapshot.heightMap);
    splatMapRef.current = new Uint8Array(snapshot.splatMap);
    colorMapRef.current = new Float32Array(snapshot.colorMap);
    setPlacedObjects(snapshot.placedObjects.map((o) => ({ ...o })));
    setMicroStrokes(snapshot.microStrokes.map((m) => ({ ...m })));
    setSelectedObjectId(snapshot.selectedObjectId);
    setBiomeId(snapshot.biomeId);
    setWaterLevel(snapshot.waterLevel);
    setRegionTitle(snapshot.regionTitle);
    dirtyRectRef.current = null;
    setTerrainVersion((v) => v + 1);
    showToast(
      `Đã hoàn tác: "${snapshot.actionLabel}" (${remainingCount} bước hoàn tác còn lại).`
    );
  }, [showToast]);

  // Keyboard shortcuts: 'H' to toggle Cinema / Zen Mode, 'Ctrl+Z' / 'Cmd+Z' to Undo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setIsDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo]);

  // Live-update 3-5cm grass height across existing grass & flower patches
  const handleChangeGrassHeightCm = useCallback((nextCm: number) => {
    const clamped = Number(
      Math.max(MIN_GRASS_HEIGHT_CM, Math.min(MAX_GRASS_HEIGHT_CM, nextCm)).toFixed(1)
    );
    setGrassHeightCm(clamped);
    setMicroStrokes((prev) =>
      prev.map((st) =>
        st.brushId === 'emerald_grass' || st.brushId === 'flower_meadow'
          ? { ...st, grassHeightCm: clamped }
          : st
      )
    );
  }, []);

  // Live-update 3D flower species on active/existing flower meadow patches
  const handleChangeFlowerSpecies = useCallback(
    (nextSpecies: FlowerSpeciesId) => {
      setFlowerSpecies(nextSpecies);
      const spMeta = FLOWER_SPECIES_CATALOG.find((s) => s.id === nextSpecies);
      setMicroStrokes((prev) =>
        prev.map((st) =>
          st.brushId === 'flower_meadow' ? { ...st, flowerSpecies: nextSpecies } : st
        )
      );
      if (spMeta) {
        showToast(`Đã chuyển loài hoa 3D sang "${spMeta.name}".`);
      }
    },
    [showToast]
  );

  // Live-update 3D flower petal color on active/existing flower meadow patches
  const handleChangeFlowerColorHex = useCallback(
    (nextHex: string) => {
      setFlowerColorHex(nextHex);
      setMicroStrokes((prev) =>
        prev.map((st) =>
          st.brushId === 'flower_meadow' ? { ...st, flowerColorHex: nextHex } : st
        )
      );
    },
    []
  );

  // Sync Placed Objects Y coordinates after terrain edits (filtering by dirtyRect when provided)
  const syncObjectsToGround = useCallback(
    (currentObjects: PlacedObject[], dirtyRect?: GridDirtyRect | null) => {
      const half = WORLD_SIZE / 2;
      const hasBounds =
        dirtyRect != null &&
        (dirtyRect.minIx > 0 ||
          dirtyRect.maxIx < GRID_SIZE ||
          dirtyRect.minIz > 0 ||
          dirtyRect.maxIz < GRID_SIZE);
      const minWx = hasBounds
        ? (Math.max(0, dirtyRect!.minIx - 1) / GRID_SIZE) * WORLD_SIZE - half
        : -half;
      const maxWx = hasBounds
        ? (Math.min(GRID_SIZE, dirtyRect!.maxIx + 1) / GRID_SIZE) * WORLD_SIZE - half
        : half;
      const minWz = hasBounds
        ? (Math.max(0, dirtyRect!.minIz - 1) / GRID_SIZE) * WORLD_SIZE - half
        : -half;
      const maxWz = hasBounds
        ? (Math.min(GRID_SIZE, dirtyRect!.maxIz + 1) / GRID_SIZE) * WORLD_SIZE - half
        : half;

      let anyChanged = false;
      const next = currentObjects.map((obj) => {
        if (
          hasBounds &&
          (obj.x < minWx || obj.x > maxWx || obj.z < minWz || obj.z > maxWz)
        ) {
          return obj;
        }
        const nextY = Number(
          getGroundHeightAt(heightMapRef.current, GRID_SIZE, WORLD_SIZE, obj.x, obj.z).toFixed(2)
        );
        if (nextY === obj.y) return obj;
        anyChanged = true;
        return { ...obj, y: nextY };
      });
      return anyChanged ? next : currentObjects;
    },
    []
  );

  // Toggle an existing terrain generation rule on/off
  const handleToggleTerrainRule = useCallback(
    (ruleId: string) => {
      setTerrainRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
      );
    },
    []
  );

  // Add a custom terrain generation rule
  const handleAddTerrainRule = useCallback(
    (newRuleConfig: {
      operator: RuleOperator;
      thresholdMeters: number;
      maxThresholdMeters?: number;
      targetPrefabId: PrefabId;
      targetTextureId?: TextureBrushId | 'none';
    }) => {
      const ruleObj: TerrainRule = {
        id: `custom-rule-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: '',
        enabled: true,
        operator: newRuleConfig.operator,
        thresholdMeters: newRuleConfig.thresholdMeters,
        maxThresholdMeters: newRuleConfig.maxThresholdMeters,
        targetPrefabId: newRuleConfig.targetPrefabId,
        targetTextureId: newRuleConfig.targetTextureId ?? 'limestone_cliff',
        maxObjectsToPlace: 8,
        minSpacingMeters: 14,
        scale: newRuleConfig.targetPrefabId === 'karst_mountain' ? 1.25 : 1.1,
      };
      ruleObj.name = formatTerrainRuleFormula(ruleObj);
      setTerrainRules((prev) => [ruleObj, ...prev]);
      showToast(`Đã thêm quy luật mới: "${ruleObj.name}".`);
    },
    [showToast]
  );

  // Delete a terrain generation rule
  const handleDeleteTerrainRule = useCallback(
    (ruleId: string) => {
      setTerrainRules((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== ruleId) : prev));
    },
    []
  );

  // Execute active terrain generation rules across the map
  const handleExecuteTerrainRules = useCallback(() => {
    const enabled = terrainRules.filter((r) => r.enabled);
    if (enabled.length === 0) {
      showToast('Hãy bật ít nhất 1 quy luật địa hình trước khi thực thi.');
      return;
    }

    pushUndoSnapshot(`Thực thi ${enabled.length} quy luật địa hình`);
    const result = executeTerrainRules(
      heightMapRef.current,
      splatMapRef.current,
      colorMapRef.current,
      biomeId,
      terrainRules,
      latestStateRef.current.placedObjects,
      { ensureMatchingTerrain: true }
    );

    setPlacedObjects(result.newObjects);
    if (result.addedObjects.length > 0) {
      setSelectedObjectId(result.addedObjects[0].id);
    }
    dirtyRectRef.current = null;
    setTerrainVersion((v) => v + 1);
    showToast(result.summary);
  }, [terrainRules, biomeId, pushUndoSnapshot, showToast]);

  // Record undo snapshot when a brush stroke starts on the 3D terrain
  const handleTerrainStrokeStart = useCallback(() => {
    lastStrokeSnapshotTimeRef.current = performance.now();
    const label =
      activeTab === 'paint'
        ? `Vẽ ${TEXTURE_BRUSHES[textureBrush].name} (Cọ ${brushRadius}m)`
        : `Đắp địa hình (${sculptTool} · Cọ ${brushRadius}m)`;
    pushUndoSnapshot(label);
  }, [activeTab, textureBrush, sculptTool, brushRadius, pushUndoSnapshot]);

  // Handle Sculpt or Paint stroke at (worldX, worldZ) using localized dirtyRect updates
  const handleTerrainStroke = useCallback(
    (worldX: number, worldZ: number) => {
      const now = performance.now();
      if (now - lastStrokeSnapshotTimeRef.current > 1500) {
        lastStrokeSnapshotTimeRef.current = now;
        const label =
          activeTab === 'paint'
            ? `Vẽ ${TEXTURE_BRUSHES[textureBrush].name} (Cọ ${brushRadius}m)`
            : `Đắp địa hình (${sculptTool} · Cọ ${brushRadius}m)`;
        pushUndoSnapshot(label);
      }

      if (activeTab === 'sculpt') {
        const bounds: GridDirtyRect = { minIx: 0, maxIx: GRID_SIZE, minIz: 0, maxIz: GRID_SIZE };
        const changed = applySculptBrush(
          heightMapRef.current,
          splatMapRef.current,
          colorMapRef.current,
          biomeId,
          sculptTool,
          worldX,
          worldZ,
          brushRadius,
          brushStrength,
          bounds,
          normalMapRef.current
        );
        if (changed > 0) {
          dirtyRectRef.current = mergeDirtyRect(dirtyRectRef.current, bounds);
          if (autoRuleOnSculpt && terrainRules.some((r) => r.enabled)) {
            const focusRadius = Math.max(brushRadius * 1.4, 80);
            const half = WORLD_SIZE / 2;
            const ruleBounds: GridDirtyRect = {
              minIx: Math.max(0, Math.floor(((worldX - focusRadius + half) / WORLD_SIZE) * GRID_SIZE)),
              maxIx: Math.min(GRID_SIZE, Math.ceil(((worldX + focusRadius + half) / WORLD_SIZE) * GRID_SIZE)),
              minIz: Math.max(0, Math.floor(((worldZ - focusRadius + half) / WORLD_SIZE) * GRID_SIZE)),
              maxIz: Math.min(GRID_SIZE, Math.ceil(((worldZ + focusRadius + half) / WORLD_SIZE) * GRID_SIZE)),
            };
            dirtyRectRef.current = mergeDirtyRect(dirtyRectRef.current, ruleBounds);
            setPlacedObjects((prevObjs) => {
              const ruleRes = executeTerrainRules(
                heightMapRef.current,
                splatMapRef.current,
                colorMapRef.current,
                biomeId,
                terrainRules,
                prevObjs,
                {
                  ensureMatchingTerrain: false,
                  focusAreaWorldX: worldX,
                  focusAreaWorldZ: worldZ,
                  focusRadiusMeters: focusRadius,
                }
              );
              return ruleRes.newObjects;
            });
          } else {
            setPlacedObjects((prevObjs) => syncObjectsToGround(prevObjs, bounds));
          }
          setTerrainVersion((v) => v + 1);
        }
      } else if (activeTab === 'paint') {
        const bounds: GridDirtyRect = { minIx: 0, maxIx: GRID_SIZE, minIz: 0, maxIz: GRID_SIZE };
        const painted = applyTextureBrush(
          heightMapRef.current,
          splatMapRef.current,
          colorMapRef.current,
          biomeId,
          textureBrush,
          worldX,
          worldZ,
          brushRadius,
          {
            carveTerrain: carveTerrainOnPaint,
            waterLevel,
            outBounds: bounds,
          }
        );
        if (painted > 0) {
          dirtyRectRef.current = mergeDirtyRect(dirtyRectRef.current, bounds);
          setMicroStrokes((prev) => {
            const next = [
              ...prev.slice(-160),
              {
                id: `ms-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                x: Number(worldX.toFixed(1)),
                z: Number(worldZ.toFixed(1)),
                radius: Math.max(MIN_BRUSH_RADIUS, brushRadius),
                brushId: textureBrush,
                grassHeightCm,
                flowerSpecies,
                flowerColorHex,
              },
            ];
            return next;
          });
          setTerrainVersion((v) => v + 1);
        }
      }
    },
    [
      activeTab,
      biomeId,
      sculptTool,
      textureBrush,
      brushRadius,
      brushStrength,
      grassHeightCm,
      flowerSpecies,
      flowerColorHex,
      carveTerrainOnPaint,
      waterLevel,
      autoRuleOnSculpt,
      terrainRules,
      syncObjectsToGround,
      pushUndoSnapshot,
    ]
  );

  // Fill entire terrain with a chosen texture brush AND populate 3D surface ecosystems across the village
  const handleFillEntireTerrainTexture = useCallback(
    (brushId: TextureBrushId) => {
      pushUndoSnapshot(`Phủ toàn bản đồ (${TEXTURE_BRUSHES[brushId].name})`);
      splatMapRef.current.fill(getTextureIndex(brushId));
      recomputeTerrainColors(
        heightMapRef.current,
        splatMapRef.current,
        colorMapRef.current,
        biomeId
      );

      // Populate 3D physical ecosystem patches (3-5cm grass, 3D flowers, sand dunes, or smoking lava)
      const fillPatches: MicroStrokeStamp[] = [
        { x: 0, z: 0, r: 16 },
        { x: -18, z: -12, r: 12 },
        { x: 18, z: -12, r: 12 },
        { x: -16, z: 14, r: 12 },
        { x: 16, z: 14, r: 12 },
        { x: 0, z: -22, r: 11 },
      ].map((pt, i) => ({
        id: `fill-${brushId}-${Date.now()}-${i}`,
        x: pt.x,
        z: pt.z,
        radius: pt.r,
        brushId,
        grassHeightCm,
        flowerSpecies,
        flowerColorHex,
      }));

      setMicroStrokes(fillPatches);
      dirtyRectRef.current = null;
      setTerrainVersion((v) => v + 1);
      showToast(
        `Đã phủ "${TEXTURE_BRUSHES[brushId].name}" (3D thật) lên toàn bộ lưới ${GRID_SIZE + 1}×${GRID_SIZE + 1} (${TOTAL_VERTICES.toLocaleString()} đỉnh · 62,5m/ô).`
      );
    },
    [biomeId, grassHeightCm, flowerSpecies, flowerColorHex, pushUndoSnapshot, showToast]
  );

  // Reset to initial Flat Earth Plane ("Mặt Phẳng Đất Nguyên Bản") with starter 3D surface showcase
  const handleResetToFlatEarth = useCallback(() => {
    pushUndoSnapshot('Đưa về Mặt Phẳng Đất Gốc');
    const flatWorld = generateFlatEarthTerrain(biomeId);
    heightMapRef.current = flatWorld.heightMap;
    splatMapRef.current = flatWorld.splatMap;
    colorMapRef.current = flatWorld.colorMap;
    setMicroStrokes(generateInitialSurfaceShowcaseStrokes());
    setPlacedObjects(flatWorld.initialObjects);
    setSelectedObjectId(flatWorld.initialObjects[0]?.id ?? null);
    setRegionTitle('Mặt Phẳng Đất Nguyên Bản · 10×10km (Vector 1:1)');
    dirtyRectRef.current = null;
    setTerrainVersion((v) => v + 1);
    showToast(
      `Đã đưa bản đồ 10×10km (lưới ${GRID_SIZE + 1}×${GRID_SIZE + 1} · ${TOTAL_VERTICES.toLocaleString()} đỉnh) về Mặt Phẳng Đất Nguyên Bản (Cao độ 0m).`
    );
  }, [biomeId, pushUndoSnapshot, showToast]);

  // Place a 3D prefab at specific world coordinates with chosen orientation & scale (1:1 real dimensions)
  const handlePlacePrefabAt = useCallback(
    (worldX: number, worldZ: number, prefabOverride?: PrefabId) => {
      const targetPrefabId = prefabOverride || selectedPrefab;
      const meta =
        PREFAB_CATALOG.find((p) => p.id === targetPrefabId) || PREFAB_CATALOG[0];
      pushUndoSnapshot(`Đặt ${meta.name}`);

      const wy = getGroundHeightAt(
        heightMapRef.current,
        GRID_SIZE,
        WORLD_SIZE,
        worldX,
        worldZ
      );

      const rotRad = Number(((placementRotationDeg * Math.PI) / 180).toFixed(4));
      const finalScale = Number(Math.max(0.3, Math.min(3.0, placementScale)).toFixed(2));

      const newObj: PlacedObject = {
        id: `prop-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        prefabId: meta.id,
        label: meta.name,
        x: Number(worldX.toFixed(1)),
        y: Number(wy.toFixed(2)),
        z: Number(worldZ.toFixed(1)),
        scale: finalScale,
        rotationY: rotRad,
      };

      setPlacedObjects((prev) => [...prev, newObj]);
      setSelectedObjectId(newObj.id);
      showToast(
        `Đã đặt "${meta.name}" [1:1 ${meta.realDimensions}] (Hướng ${placementRotationDeg}°, Cỡ ${finalScale}x) tại (${Math.round(worldX)}m, ${Math.round(worldZ)}m).`
      );
    },
    [selectedPrefab, placementRotationDeg, placementScale, pushUndoSnapshot, showToast]
  );

  // Spawn prefab near map center at realistic 1:1 village distances (12m - 44m)
  const handleSpawnPrefabAtCenter = useCallback(
    (prefabId: PrefabId) => {
      const offsetIndex = latestStateRef.current.placedObjects.length;
      const angle = offsetIndex * 1.15;
      const radius = 12 + (offsetIndex % 5) * 8;
      const wx = Number((Math.cos(angle) * radius).toFixed(1));
      const wz = Number((Math.sin(angle) * radius).toFixed(1));
      handlePlacePrefabAt(wx, wz, prefabId);
    },
    [handlePlacePrefabAt]
  );

  // Switch Biome & regenerate scenic 1km mountain / planetary world + sync default planetary weather
  const handleSelectBiome = useCallback(
    (nextBiome: BiomeId) => {
      const bConfig = BIOMES[nextBiome];
      pushUndoSnapshot(`Chuyển hành tinh / quần xã sang ${bConfig.name}`);
      setBiomeId(nextBiome);
      setWaterLevel(bConfig.waterLevel);
      setTextureBrush(bConfig.defaultTexture);
      const nextWeather = bConfig.defaultWeather ?? 'clear_sky';
      setActiveWeather(nextWeather);

      const generated = generateBiomeTerrain(nextBiome, 42);
      heightMapRef.current = generated.heightMap;
      splatMapRef.current = generated.splatMap;
      colorMapRef.current = generated.colorMap;
      setPlacedObjects(generated.initialObjects);
      setSelectedObjectId(generated.initialObjects[0]?.id ?? null);

      // Always reset 3D physical surface ecosystem patches to match the newly selected biome
      const biomeBrush = bConfig.defaultTexture;
      setMicroStrokes(
        [
          { x: 0, z: 0, r: 16 },
          { x: -16, z: -10, r: 12 },
          { x: 18, z: -12, r: 12 },
          { x: -14, z: 14, r: 12 },
          { x: 15, z: 14, r: 12 },
        ].map((pt, i) => ({
          id: `biome-patch-${nextBiome}-${i}`,
          x: pt.x,
          z: pt.z,
          radius: pt.r,
          brushId: biomeBrush,
          grassHeightCm,
          flowerSpecies,
          flowerColorHex,
        }))
      );

      setRegionTitle(bConfig.name);
      dirtyRectRef.current = null;
      setTerrainVersion((v) => v + 1);
      const weatherMeta = WEATHER_CATALOG.find((w) => w.id === nextWeather);
      showToast(
        `Đã chuyển sang "${bConfig.name}" · Thời tiết: ${weatherMeta?.name || 'Trời Quang Đãng'}.`
      );
    },
    [grassHeightCm, flowerSpecies, flowerColorHex, pushUndoSnapshot, showToast]
  );

  // Switch active planetary weather mode
  const handleSelectWeather = useCallback(
    (nextWeather: WeatherId) => {
      setActiveWeather(nextWeather);
      const weatherMeta = WEATHER_CATALOG.find((w) => w.id === nextWeather);
      if (weatherMeta) {
        showToast(`Thời tiết hành tinh: "${weatherMeta.name}" (${weatherMeta.subtitle}).`);
      }
    },
    [showToast]
  );

  // Apply Photo-to-3D Reconstruction
  const handleApplyReconstruction = useCallback(
    (payload: {
      heightMap: Float32Array;
      splatMap: Uint8Array;
      colorMap: Float32Array;
      biomeId: BiomeId;
      placedObjects: PlacedObject[];
      regionTitle: string;
      summaryText: string;
    }) => {
      pushUndoSnapshot(`Tái tạo ảnh 3D (${payload.regionTitle})`);
      heightMapRef.current = payload.heightMap;
      splatMapRef.current = payload.splatMap;
      colorMapRef.current = payload.colorMap;
      setBiomeId(payload.biomeId);
      setWaterLevel(BIOMES[payload.biomeId].waterLevel);
      const synced = syncObjectsToGround(payload.placedObjects);
      setPlacedObjects(synced);
      setSelectedObjectId(synced[0]?.id ?? null);
      setRegionTitle(payload.regionTitle);
      dirtyRectRef.current = null;
      setTerrainVersion((v) => v + 1);
      setCameraPreset('village');
      setCameraPresetTrigger((t) => t + 1);
      showToast(
        `Tái tạo lục địa Vector 10×10km hoàn tất: ${payload.regionTitle} (${payload.placedObjects.length} vật thể 1:1).`
      );
    },
    [syncObjectsToGround, pushUndoSnapshot, showToast]
  );

  const handleResetWorld = useCallback(() => {
    pushUndoSnapshot('Tạo Mẫu Đồi Núi 1km');
    const generated = generateBiomeTerrain(biomeId, Date.now() % 10000);
    heightMapRef.current = generated.heightMap;
    splatMapRef.current = generated.splatMap;
    colorMapRef.current = generated.colorMap;
    setPlacedObjects(generated.initialObjects);
    setSelectedObjectId(generated.initialObjects[0]?.id ?? null);
    setRegionTitle(BIOMES[biomeId].name);
    dirtyRectRef.current = null;
    setTerrainVersion((v) => v + 1);
    showToast('Đã kiến tạo mẫu địa hình đồi núi Vector 10×10km (cao độ tối đa 1km).');
  }, [biomeId, pushUndoSnapshot, showToast]);

  // Auto Day/Night Cycle progression timer when isDayNightAuto is active
  useEffect(() => {
    if (!isDayNightAuto) return;
    const timer = window.setInterval(() => {
      setTimeOfDay((prev) => {
        const next = Number(((prev + 0.25) % 24).toFixed(2));
        setSunElevation(timeOfDayToSunElevation(next));
        setSunAzimuth(Math.round((next / 24) * 360));
        return next;
      });
    }, 180);
    return () => clearInterval(timer);
  }, [isDayNightAuto]);

  const handleChangeTimeOfDay = useCallback((nextHour: number) => {
    const norm = ((nextHour % 24) + 24) % 24;
    setTimeOfDay(norm);
    const elev = timeOfDayToSunElevation(norm);
    setSunElevation(elev);
    setSunAzimuth(Math.round((norm / 24) * 360));
  }, []);

  const handleChangeSunElevation = useCallback((nextElev: number) => {
    setSunElevation(nextElev);
    if (nextElev <= -6) {
      setTimeOfDay(22.5);
    } else if (nextElev <= 14) {
      setTimeOfDay((prev) => (prev < 12 ? 6.5 : 17.75));
    }
  }, []);

  const handleChangeSunAzimuth = useCallback((nextAzim: number) => {
    const clamped = ((nextAzim % 360) + 360) % 360;
    setSunAzimuth(clamped);
  }, []);

  const handleToggleStarlightMode = useCallback(() => {
    setStarlightMode((prev) => {
      const next = !prev;
      if (next && sunElevation > 15) {
        setTimeOfDay(23.0);
        setSunElevation(-52);
        setSunAzimuth(320);
      }
      showToast(
        next
          ? 'Đã bật Chế Độ Ánh Sao Ban Đêm (Vòm sao Ngân Hà 3D, sao băng & bóng đổ ánh trăng).'
          : 'Đã tắt khóa Chế Độ Ánh Sao Ban Đêm (Tự động theo chu kỳ mặt trời).'
      );
      return next;
    });
  }, [sunElevation, showToast]);

  const handleApplyDayNightPreset = useCallback(
    (presetId: string) => {
      const preset = DAY_NIGHT_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      setIsDayNightAuto(false);
      setTimeOfDay(preset.timeOfDayHours);
      setSunElevation(preset.sunElevationDeg);
      setSunAzimuth(preset.sunAzimuthDeg);
      setStarlightMode(preset.starlightMode);
      showToast(
        `Đã chuyển chu kỳ ánh sáng sang "${preset.label}" (Hướng mặt trời ${preset.sunAzimuthDeg}°, Cao độ ${preset.sunElevationDeg}°).`
      );
    },
    [showToast]
  );

  const handleExportWorldJson = useCallback(() => {
    const cur = latestStateRef.current;
    const payload = serializeWorldToSavePayload({
      regionTitle: cur.regionTitle,
      biomeId: cur.biomeId,
      activeWeather,
      waterLevel: cur.waterLevel,
      sunElevation,
      sunAzimuth,
      timeOfDay,
      starlightMode,
      grassHeightCm,
      flowerSpecies,
      flowerColorHex,
      heightMap: heightMapRef.current,
      splatMap: splatMapRef.current,
      placedObjects: cur.placedObjects,
      microStrokes: cur.microStrokes,
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aetherterra-v2-${cur.biomeId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(
      `Đã xuất tệp bản đồ 3D đầy đủ (.JSON v2: lưới độ cao ${GRID_SIZE + 1}×${GRID_SIZE + 1}, bảng màu bề mặt & ${cur.placedObjects.length} vật thể).`
    );
  }, [
    activeWeather,
    sunElevation,
    sunAzimuth,
    timeOfDay,
    starlightMode,
    grassHeightCm,
    flowerSpecies,
    flowerColorHex,
    showToast,
  ]);

  const handleImportWorldJson = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '{}'));
          const validation = validateWorldSavePayload(parsed);
          if (!validation.ok) {
            showToast(`Không thể nhập bản đồ: ${validation.reason}`);
            return;
          }
          const restored = validation.data;
          pushUndoSnapshot(`Nhập bản đồ JSON (${restored.regionTitle})`);
          heightMapRef.current = restored.heightMap;
          splatMapRef.current = restored.splatMap;
          colorMapRef.current = restored.colorMap;
          setRegionTitle(restored.regionTitle);
          setBiomeId(restored.biomeId);
          setActiveWeather(restored.activeWeather);
          setWaterLevel(restored.waterLevel);
          setSunElevation(restored.sunElevation);
          setSunAzimuth(restored.sunAzimuth);
          setTimeOfDay(restored.timeOfDay);
          setStarlightMode(restored.starlightMode);
          setGrassHeightCm(restored.grassHeightCm);
          setFlowerSpecies(restored.flowerSpecies);
          setFlowerColorHex(restored.flowerColorHex);
          setPlacedObjects(restored.placedObjects);
          setMicroStrokes(restored.microStrokes);
          setSelectedObjectId(restored.placedObjects[0]?.id ?? null);
          dirtyRectRef.current = null;
          setTerrainVersion((v) => v + 1);
          showToast(
            `Đã tải bản đồ "${restored.regionTitle}" (${restored.placedObjects.length} vật thể 3D).`
          );
        } catch {
          showToast('Không thể đọc tệp JSON. Vui lòng kiểm tra cú pháp JSON của tệp.');
        }
      };
      reader.onerror = () => {
        showToast('Không thể đọc tệp đã chọn. Vui lòng thử lại.');
      };
      reader.readAsText(file);
    },
    [pushUndoSnapshot, showToast]
  );

  const selectedObject =
    placedObjects.find((o) => o.id === selectedObjectId) || null;

  const handleRotateSelected = useCallback(() => {
    const selId = latestStateRef.current.selectedObjectId;
    if (!selId) return;
    pushUndoSnapshot('Xoay vật thể +45°');
    setPlacedObjects((prev) =>
      prev.map((o) =>
        o.id === selId
          ? { ...o, rotationY: o.rotationY + Math.PI / 4 }
          : o
      )
    );
  }, [pushUndoSnapshot]);

  const handleSetSelectedObjectRotationDeg = useCallback(
    (deg: number) => {
      const clampedDeg = ((deg % 360) + 360) % 360;
      setPlacementRotationDeg(clampedDeg);
      const selId = latestStateRef.current.selectedObjectId;
      if (!selId) return;
      const now = performance.now();
      if (now - lastStrokeSnapshotTimeRef.current > 1000) {
        lastStrokeSnapshotTimeRef.current = now;
        pushUndoSnapshot(`Xoay hướng vật thể (${clampedDeg}°)`);
      }
      const rad = Number(((clampedDeg * Math.PI) / 180).toFixed(4));
      setPlacedObjects((prev) =>
        prev.map((o) => (o.id === selId ? { ...o, rotationY: rad } : o))
      );
    },
    [pushUndoSnapshot]
  );

  const handleScaleSelected = useCallback(
    (delta: number) => {
      const selId = latestStateRef.current.selectedObjectId;
      if (!selId) return;
      pushUndoSnapshot('Đổi kích thước vật thể');
      setPlacedObjects((prev) =>
        prev.map((o) =>
          o.id === selId
            ? {
                ...o,
                scale: Math.max(0.3, Math.min(3.0, Number((o.scale + delta).toFixed(2)))),
              }
            : o
        )
      );
    },
    [pushUndoSnapshot]
  );

  const handleSetSelectedObjectScale = useCallback(
    (nextScale: number) => {
      const clamped = Math.max(0.3, Math.min(3.0, Number(nextScale.toFixed(2))));
      setPlacementScale(clamped);
      const selId = latestStateRef.current.selectedObjectId;
      if (!selId) return;
      const now = performance.now();
      if (now - lastStrokeSnapshotTimeRef.current > 1000) {
        lastStrokeSnapshotTimeRef.current = now;
        pushUndoSnapshot(`Chỉnh cỡ vật thể (${clamped}x)`);
      }
      setPlacedObjects((prev) =>
        prev.map((o) => (o.id === selId ? { ...o, scale: clamped } : o))
      );
    },
    [pushUndoSnapshot]
  );

  const handleDeleteSelected = useCallback(() => {
    const selId = latestStateRef.current.selectedObjectId;
    if (!selId) return;
    const target = latestStateRef.current.placedObjects.find((o) => o.id === selId);
    pushUndoSnapshot(`Xóa ${target?.label || 'vật thể'}`);
    setPlacedObjects((prev) => prev.filter((o) => o.id !== selId));
    setSelectedObjectId(null);
    showToast('Đã xóa vật thể khỏi bản đồ (Có thể nhấn Hoàn Tác để khôi phục).');
  }, [pushUndoSnapshot, showToast]);

  const handleToggleCollapse = useCallback(() => {
    setIsDockCollapsed((prev) => !prev);
  }, []);

  const handleToggleCarveTerrainOnPaint = useCallback(() => {
    setCarveTerrainOnPaint((prev) => !prev);
  }, []);

  const handleToggleAutoRuleOnSculpt = useCallback(() => {
    setAutoRuleOnSculpt((prev) => !prev);
  }, []);

  const handleToggleDayNightAuto = useCallback(() => {
    setIsDayNightAuto((prev) => !prev);
  }, []);

  const handleOpenReconstructModal = useCallback(() => {
    setIsReconstructModalOpen(true);
  }, []);

  const handleCloseReconstructModal = useCallback(() => {
    setIsReconstructModalOpen(false);
  }, []);

  const handleViewportPlacePrefab = useCallback(
    (x: number, z: number) => {
      handlePlacePrefabAt(x, z);
    },
    [handlePlacePrefabAt]
  );

  const canUndo = undoStack.length > 0;
  const lastUndoLabel = undoStack[undoStack.length - 1]?.actionLabel;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0f1722] select-none">
      {/* Full-Bleed Vector 3D Open-World Canvas (10x10 km, 1:1 Building Scale, Real-Time Day/Night & Starlight Sky) */}
      <ErrorBoundary label="Khung nhìn 3D" inline>
        <WorldViewport3D
          heightMap={heightMapRef.current}
          splatMap={splatMapRef.current}
          colorMap={colorMapRef.current}
          terrainVersion={terrainVersion}
          dirtyRectRef={dirtyRectRef}
          biomeId={biomeId}
          activeWeather={activeWeather}
          sunElevation={sunElevation}
          sunAzimuth={sunAzimuth}
          timeOfDay={timeOfDay}
          starlightMode={starlightMode}
          waterLevel={waterLevel}
          placedObjects={placedObjects}
          microStrokes={microStrokes}
          selectedObjectId={selectedObjectId}
          activeTab={activeTab}
          sculptTool={sculptTool}
          textureBrush={textureBrush}
          selectedPrefab={selectedPrefab}
          placementRotationDeg={placementRotationDeg}
          placementScale={placementScale}
          brushRadius={brushRadius}
          brushStrength={brushStrength}
          cameraPreset={cameraPreset}
          cameraPresetTrigger={cameraPresetTrigger}
          onTerrainStrokeStart={handleTerrainStrokeStart}
          onTerrainStroke={handleTerrainStroke}
          onPlacePrefabAt={handleViewportPlacePrefab}
          onSelectObject={setSelectedObjectId}
          onHoverCoordsChange={setHoverCoords}
          onScaleMetricsChange={setScaleMetrics}
        />
      </ErrorBoundary>

      {/* Ultra-Compact Single-Line Top Bar */}
      <header className="fixed top-2.5 left-2.5 right-2.5 z-20 pointer-events-none flex flex-nowrap items-center justify-between gap-2">
        {/* Left: Compact Brand & Core Specs Pill */}
        <div className="pointer-events-auto px-3 py-1.5 rounded-xl bg-[#111927]/95 border border-slate-700/90 shadow-lg flex items-center gap-2.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <h1
              className="text-xs font-bold tracking-tight text-white whitespace-nowrap"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              AetherTerra 3D
            </h1>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2 text-[10px] text-slate-300 font-mono tabular-nums whitespace-nowrap">
            <span className="text-emerald-300 font-semibold" data-testid="world-dimensions-spec">
              10×10 km
            </span>
            <span>·</span>
            <span
              className="text-amber-300 font-semibold"
              data-testid="world-resolution-spec"
              title="Lưới độ cao 161×161 đỉnh (25.921 đỉnh, 62,5m/ô) kết hợp thảm sinh thái 3D tỉ lệ 1:1"
            >
              Lưới 161×161 (62,5m/ô)
            </span>
            <span>·</span>
            <span className="text-cyan-300 font-semibold" data-testid="world-scale-spec">
              Tỷ lệ 1:1
            </span>
            <span>·</span>
            <span data-testid="world-grass-spec" className="text-lime-300">
              Cỏ {grassHeightCm.toFixed(1)}cm
            </span>
            <span>·</span>
            <span data-testid="world-time-spec" className="text-indigo-300 font-semibold">
              {formatTimeOfDayClock(timeOfDay)} ({Math.round(sunAzimuth)}°)
            </span>
            <span>·</span>
            <span data-testid="world-weather-spec" className="text-pink-300 font-semibold">
              {WEATHER_CATALOG.find((w) => w.id === activeWeather)?.shortName || 'Quang Đãng'}
            </span>
            <span>·</span>
            <span data-testid="world-brush-spec">Cọ {brushRadius}m</span>
          </div>
        </div>

        {/* Right: Quick Starlight Toggle + Compact Undo + Camera Presets + Photo-to-3D Button */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            data-testid="top-starlight-quick-toggle"
            onClick={handleToggleStarlightMode}
            title="Chuyển nhanh Chế Độ Ánh Sao Ban Đêm / Chu kỳ Mặt Trời"
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 shadow-lg transition-colors whitespace-nowrap cursor-pointer ${
              starlightMode || sunElevation <= -4
                ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white'
                : 'bg-[#111927]/95 hover:bg-slate-800 border-slate-700/90 text-amber-300'
            }`}
          >
            {starlightMode || sunElevation <= -4 ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-200" />
                <span>Đêm Sao ({formatTimeOfDayClock(timeOfDay)})</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>Ngày ({formatTimeOfDayClock(timeOfDay)})</span>
              </>
            )}
          </button>

          <button
            type="button"
            data-testid="top-undo-button"
            onClick={handleUndo}
            disabled={!canUndo}
            title={
              canUndo
                ? `Hoàn tác: ${lastUndoLabel || ''} (Ctrl+Z)`
                : 'Chưa có thao tác nào để hoàn tác (Ctrl+Z)'
            }
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 shadow-lg transition-colors whitespace-nowrap ${
              canUndo
                ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-400 text-white cursor-pointer'
                : 'bg-[#111927]/95 border-slate-700/90 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span>Hoàn Tác {undoStack.length > 0 ? `(${undoStack.length})` : ''}</span>
          </button>

          <div className="hidden md:flex items-center gap-0.5 p-0.5 rounded-xl bg-[#111927]/95 border border-slate-700/90 shadow-lg">
            <Camera className="w-3 h-3 text-slate-400 ml-1.5 mr-0.5" />
            {(
              [
                { id: 'mountain_gallery', label: '7 Núi Ảnh Mẫu' },
                { id: 'pluto_cryo', label: 'Pluto' },
                { id: 'europa_rift', label: 'Europa' },
                { id: 'alps_matterhorn', label: 'Alps' },
                { id: 'himalaya_fishtail', label: 'Himalaya' },
                { id: 'olympus_mons', label: 'Olympus' },
                { id: 'titan_mountain', label: 'Titan' },
                { id: 'volcano_icon', label: 'Núi Lửa' },
                { id: 'overview', label: '10km' },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                data-testid={`camera-preset-${cam.id}`}
                onClick={() => {
                  setCameraPreset(cam.id);
                  setCameraPresetTrigger((t) => t + 1);
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  cameraPreset === cam.id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {cam.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleOpenReconstructModal}
            className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Tải Ảnh 3D
          </button>
        </div>
      </header>

      {/* Reference Image -> 7-Model 3D Showcase Card (Pluto, Europa, Alps, Himalaya, Mars Olympus, Titan, Volcano) */}
      {showVolcanoRefCard && (() => {
        const refGallery = [
          {
            prefabId: 'pluto_cryo_volcano' as PrefabId,
            preset: 'pluto_cryo' as CameraPresetId,
            testId: 'focus-pluto-btn',
            shortTab: 'Pluto',
            title: 'Núi Lửa Băng Wright Mons (Sao Diêm Vương)',
            img: '/assets/aistudio/pluto_cryovolcano_ref.svg',
            desc: 'Nền tholin nâu đỏ gồ ghề · Sông băng nitơ trắng xanh tràn miệng caldera sụt lún · Cột phun Cryoplume thẳng đứng (NASA/JHUAPL/SwRI)',
          },
          {
            prefabId: 'europa_penitentes_spire' as PrefabId,
            preset: 'europa_rift' as CameraPresetId,
            testId: 'focus-europa-btn',
            shortTab: 'Europa',
            title: 'Mặt Cắt Rãnh Nứt Băng & Đại Dương Europa',
            img: '/assets/aistudio/europa_ocean_rifts_ref.svg',
            desc: 'Buồng magma đáy biển · Thủy nhiệt khói trắng · Đại dương ngầm xanh ngọc · Vỏ băng nứt rãnh vàng cam & cột phun hơi nước',
          },
          {
            prefabId: 'himalaya_matterhorn_peak' as PrefabId,
            preset: 'alps_matterhorn' as CameraPresetId,
            testId: 'focus-alps-btn',
            shortTab: 'Alps',
            title: 'Đỉnh Sừng Băng Matterhorn (Dãy Anpơ)',
            img: '/assets/aistudio/alps_matterhorn_ref.svg',
            desc: 'Thảm cỏ hoa đỗ quyên xanh mướt ở tiền cảnh · Yên ngựa tuyết trắng · Chóp sừng kim tự tháp nghiêng (mặt sáng xám + vách tối xanh lam)',
          },
          {
            prefabId: 'himalaya_fishtail_peak' as PrefabId,
            preset: 'himalaya_fishtail' as CameraPresetId,
            testId: 'focus-himalaya-btn',
            shortTab: 'Himalaya',
            title: 'Đỉnh Đuôi Cá Machapuchare (Dãy Himalaya)',
            img: '/assets/aistudio/himalaya_fishtail_ref.svg',
            desc: 'Đồi tiền cảnh nâu vàng bên trái · Vách tuyết dựng đứng đan xen sống đá xanh đen · Máng tuyết lở chéo & đỉnh đôi Đuôi Cá (Fishtail)',
          },
          {
            prefabId: 'mars_olympus_shield' as PrefabId,
            preset: 'olympus_mons' as CameraPresetId,
            testId: 'focus-olympus-btn',
            shortTab: 'Olympus',
            title: 'Núi Lửa Khiên Olympus Mons (Sao Hỏa)',
            img: '/assets/aistudio/m8uek02co8l91_09cb37ea.png',
            desc: 'Vách đá Basal Scarp 8km bao quanh vòm khiên vàng đất · Sườn dung nham tỏa tròn & cụm 6 miệng caldera lồng nhau (Ảnh NASA MOLA)',
          },
          {
            prefabId: 'titan_mithrim_montes' as PrefabId,
            preset: 'titan_mountain' as CameraPresetId,
            testId: 'focus-titan-btn',
            shortTab: 'Titan',
            title: 'Núi Rãnh Sao Mithrim / Doom Mons (Titan)',
            img: '/assets/aistudio/images_1f7cdcc6.jpg',
            desc: 'Cụm 8 sống núi băng-hydrocarbon phân nhánh hình sao (sườn sáng vàng kem & thung lũng chữ V nâu đen) trên bình nguyên cồn cát tholin',
          },
          {
            prefabId: 'island_volcano_icon' as PrefabId,
            preset: 'volcano_icon' as CameraPresetId,
            testId: 'focus-volcano-model-btn',
            shortTab: 'Núi Lửa',
            title: 'Núi Lửa Đảo Nhiệt Đới (14 Bộ Phận)',
            img: '/assets/aistudio/image_19e38ffa.png',
            desc: 'Bãi cát vàng uốn lượn · Vành đai cây xanh · Nón đá nâu rãnh sâu · Dung nham vàng cam & cột khói 2 đám mây trôi',
          },
        ];
        const currentRef = refGallery[activeRefModelIdx] || refGallery[0];

        return (
          <aside
            data-testid="volcano-reference-card"
            className="fixed top-14 left-2.5 z-20 w-80 rounded-xl bg-[#111927]/95 border border-amber-500/60 shadow-2xl p-2.5 text-slate-100 pointer-events-auto"
          >
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                7 Mô Hình 3D Từ Ảnh Mẫu
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="focus-gallery-btn"
                  onClick={() => {
                    setCameraPreset('mountain_gallery');
                    setCameraPresetTrigger((t) => t + 1);
                  }}
                  className="text-[10px] text-cyan-300 hover:text-white px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 cursor-pointer"
                >
                  Toàn Cảnh 7 Núi
                </button>
                <button
                  type="button"
                  onClick={() => setShowVolcanoRefCard(false)}
                  className="text-[10px] text-slate-400 hover:text-white px-1 cursor-pointer"
                  title="Thu gọn thẻ đối chiếu ảnh mẫu"
                >
                  Ẩn
                </button>
              </div>
            </div>

            {/* 7 Quick Selector Tabs */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {refGallery.map((item, idx) => (
                <button
                  key={item.prefabId}
                  type="button"
                  data-testid={item.testId}
                  onClick={() => {
                    setActiveRefModelIdx(idx);
                    setSelectedPrefab(item.prefabId);
                    const found = placedObjects.find((o) => o.prefabId === item.prefabId);
                    if (found) {
                      setSelectedObjectId(found.id);
                    }
                    setCameraPreset(item.preset);
                    setCameraPresetTrigger((t) => t + 1);
                    showToast(`Đang căn góc nhìn 3D: ${item.title}`);
                  }}
                  className={`px-1 py-1 rounded text-[9px] font-bold truncate transition-colors cursor-pointer ${
                    activeRefModelIdx === idx
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  title={item.title}
                >
                  {item.shortTab}
                </button>
              ))}
            </div>

            <div className="flex items-start gap-2.5">
              <img
                src={currentRef.img}
                alt={currentRef.title}
                data-testid="volcano-reference-img"
                className="w-16 h-16 rounded-lg object-cover bg-slate-800/90 border border-slate-700 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-xs font-bold text-white leading-tight">
                  {currentRef.title}
                </h2>
                <p className="text-[10px] text-slate-300 leading-snug mt-0.5">
                  {currentRef.desc}
                </p>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const found = placedObjects.find((o) => o.prefabId === currentRef.prefabId);
                  if (found) {
                    setSelectedObjectId(found.id);
                  }
                  setCameraPreset(currentRef.preset);
                  setCameraPresetTrigger((t) => t + 1);
                  showToast(`Đang căn góc nhìn trực diện: ${currentRef.title}`);
                }}
                className="flex-1 px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold transition-colors cursor-pointer"
              >
                Soi Cận Cảnh 3D
              </button>
              <button
                type="button"
                data-testid="spawn-volcano-model-btn"
                onClick={() => {
                  setSelectedPrefab(currentRef.prefabId);
                  setActiveTab('prefabs');
                  handleSpawnPrefabAtCenter(currentRef.prefabId);
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 text-[10px] font-semibold transition-colors cursor-pointer"
              >
                + Đặt Thêm
              </button>
            </div>
          </aside>
        );
      })()}

      {/* Action Status Feedback Banner */}
      {statusBanner && (
        <div
          role="status"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-[#111927] border border-emerald-400/70 shadow-xl text-xs font-medium text-emerald-200 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusBanner}</span>
        </div>
      )}

      {/* Unified Collapsible Bottom Control Dock (Single-Row Tools + Multi-Page Brush Scales + Day/Night & Starlight + Undo) */}
      <BottomControlDock
        isCollapsed={isDockCollapsed}
        onToggleCollapse={handleToggleCollapse}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        sculptTool={sculptTool}
        onSelectSculptTool={setSculptTool}
        brushRadius={brushRadius}
        onChangeBrushRadius={setBrushRadius}
        brushStrength={brushStrength}
        onChangeBrushStrength={setBrushStrength}
        textureBrush={textureBrush}
        onSelectTextureBrush={setTextureBrush}
        grassHeightCm={grassHeightCm}
        onChangeGrassHeightCm={handleChangeGrassHeightCm}
        flowerSpecies={flowerSpecies}
        onChangeFlowerSpecies={handleChangeFlowerSpecies}
        flowerColorHex={flowerColorHex}
        onChangeFlowerColorHex={handleChangeFlowerColorHex}
        carveTerrainOnPaint={carveTerrainOnPaint}
        onToggleCarveTerrainOnPaint={handleToggleCarveTerrainOnPaint}
        onFillEntireTerrainTexture={handleFillEntireTerrainTexture}
        onResetToFlatEarth={handleResetToFlatEarth}
        terrainRules={terrainRules}
        autoRuleOnSculpt={autoRuleOnSculpt}
        onToggleAutoRuleOnSculpt={handleToggleAutoRuleOnSculpt}
        onToggleTerrainRule={handleToggleTerrainRule}
        onAddTerrainRule={handleAddTerrainRule}
        onDeleteTerrainRule={handleDeleteTerrainRule}
        onExecuteTerrainRules={handleExecuteTerrainRules}
        selectedPrefab={selectedPrefab}
        onSelectPrefab={setSelectedPrefab}
        prefabCategoryFilter={prefabCategoryFilter}
        onChangePrefabCategoryFilter={setPrefabCategoryFilter}
        placementRotationDeg={placementRotationDeg}
        onChangePlacementRotationDeg={setPlacementRotationDeg}
        placementScale={placementScale}
        onChangePlacementScale={setPlacementScale}
        onSpawnPrefabAtCenter={handleSpawnPrefabAtCenter}
        selectedObject={selectedObject}
        onRotateSelectedObject={handleRotateSelected}
        onSetSelectedObjectRotationDeg={handleSetSelectedObjectRotationDeg}
        onScaleSelectedObject={handleScaleSelected}
        onSetSelectedObjectScale={handleSetSelectedObjectScale}
        onDeleteSelectedObject={handleDeleteSelected}
        activeBiome={biomeId}
        onSelectBiome={handleSelectBiome}
        activeWeather={activeWeather}
        onSelectWeather={handleSelectWeather}
        sunElevation={sunElevation}
        onChangeSunElevation={handleChangeSunElevation}
        sunAzimuth={sunAzimuth}
        onChangeSunAzimuth={handleChangeSunAzimuth}
        timeOfDay={timeOfDay}
        onChangeTimeOfDay={handleChangeTimeOfDay}
        isDayNightAuto={isDayNightAuto}
        onToggleDayNightAuto={handleToggleDayNightAuto}
        starlightMode={starlightMode}
        onToggleStarlightMode={handleToggleStarlightMode}
        onApplyDayNightPreset={handleApplyDayNightPreset}
        waterLevel={waterLevel}
        onChangeWaterLevel={setWaterLevel}
        canUndo={canUndo}
        undoCount={undoStack.length}
        lastUndoLabel={lastUndoLabel}
        onUndo={handleUndo}
        onOpenReconstructModal={handleOpenReconstructModal}
        onResetWorld={handleResetWorld}
        onExportWorldJson={handleExportWorldJson}
        onImportWorldJson={handleImportWorldJson}
      />

      {/* Bottom-Right Live Vector Distance Scale Bar / Ruler (1:1 Real-World Scale) */}
      <DistanceScaleBar
        metersPerPixel={scaleMetrics.metersPerPixel}
        cameraDistanceMeters={scaleMetrics.cameraDistanceMeters}
        hoverCoords={hoverCoords}
      />

      {/* Lazy-Loaded Image-to-3D Terrain & Object Reconstruction Modal */}
      {isReconstructModalOpen && (
        <Suspense fallback={null}>
          <ImageReconstructModal
            isOpen={isReconstructModalOpen}
            onClose={handleCloseReconstructModal}
            onApplyReconstruction={handleApplyReconstruction}
          />
        </Suspense>
      )}
    </main>
  );
}
