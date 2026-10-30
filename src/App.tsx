import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Camera,
  Compass,
  CheckCircle2,
  Undo2,
} from 'lucide-react';
import {
  BiomeId,
  BIOMES,
  DEFAULT_GRASS_HEIGHT_CM,
  DEFAULT_TERRAIN_RULES,
  executeTerrainRules,
  FLOWER_SPECIES_CATALOG,
  FlowerSpeciesId,
  formatTerrainRuleFormula,
  generateBiomeTerrain,
  generateFlatEarthTerrain,
  generateInitialSurfaceShowcaseStrokes,
  getGroundHeightAt,
  getTerrainElevationStats,
  getTextureIndex,
  GRID_SIZE,
  MAX_ELEVATION,
  MAX_GRASS_HEIGHT_CM,
  MicroStrokeStamp,
  MIN_BRUSH_RADIUS,
  MIN_GRASS_HEIGHT_CM,
  PIXEL_SIZE_CM,
  PlacedObject,
  PREFAB_CATALOG,
  PrefabCategory,
  PrefabId,
  recomputeTerrainColors,
  RuleOperator,
  SculptToolId,
  TerrainRule,
  TEXTURE_BRUSHES,
  TextureBrushId,
  VIRTUAL_RESOLUTION_PX,
  VIRTUAL_SIDE_PX,
  WeatherId,
  WEATHER_CATALOG,
  WORLD_SIZE,
  WORLD_SIZE_KM,
  applySculptBrush,
  applyTextureBrush,
} from './world/terrainEngine';
import { WorldViewport3D, CameraPresetId, ScaleMetrics } from './components/WorldViewport3D';
import { BottomControlDock, ActiveTabId } from './components/BottomControlDock';
import { ImageReconstructModal } from './components/ImageReconstructModal';
import { DistanceScaleBar } from './components/DistanceScaleBar';

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
  const [activeTab, setActiveTab] = useState<ActiveTabId>('paint');
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
  const [selectedPrefab, setSelectedPrefab] = useState<PrefabId>('floating_sky_island');
  const [prefabCategoryFilter, setPrefabCategoryFilter] = useState<PrefabCategory | 'all'>('all');
  const [placementRotationDeg, setPlacementRotationDeg] = useState<number>(0);
  const [placementScale, setPlacementScale] = useState<number>(1.0);

  // Atmosphere, Planetary Weather & Camera State (default to 'village' 1:1 real-scale view)
  const [activeWeather, setActiveWeather] = useState<WeatherId>('clear_sky');
  const [sunElevation, setSunElevation] = useState<number>(48);
  const [waterLevel, setWaterLevel] = useState<number>(BIOMES.mondstadt_meadow.waterLevel);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('village');
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<number>(0);

  // Live Vector Scale Bar & Cursor Coordinates State (Bottom-Right Corner)
  const [scaleMetrics, setScaleMetrics] = useState<ScaleMetrics>({
    metersPerPixel: 0.08,
    cameraDistanceMeters: 62,
  });
  const [hoverCoords, setHoverCoords] = useState<{ x: number; z: number } | null>({ x: 0, z: 0 });

  // Image Reconstruction Modal State
  const [isReconstructModalOpen, setIsReconstructModalOpen] = useState<boolean>(false);
  const [, setStrokeCount] = useState<number>(0);

  const elevationStats = useMemo(
    () => getTerrainElevationStats(heightMapRef.current),
    [terrainVersion]
  );

  const showToast = useCallback((msg: string) => {
    setStatusBanner(msg);
  }, []);

  useEffect(() => {
    if (!statusBanner) return;
    const timer = window.setTimeout(() => setStatusBanner(null), 4500);
    return () => clearTimeout(timer);
  }, [statusBanner]);

  // Push current state onto Undo Stack before mutating world state
  const pushUndoSnapshot = useCallback(
    (actionLabel: string) => {
      const snapshot: WorldHistorySnapshot = {
        actionLabel,
        heightMap: new Float32Array(heightMapRef.current),
        splatMap: new Uint8Array(splatMapRef.current),
        colorMap: new Float32Array(colorMapRef.current),
        placedObjects: placedObjects.map((o) => ({ ...o })),
        microStrokes: microStrokes.map((m) => ({ ...m })),
        selectedObjectId,
        biomeId,
        waterLevel,
        regionTitle,
      };
      setUndoStack((prev) => [...prev.slice(-(MAX_UNDO_STEPS - 1)), snapshot]);
    },
    [placedObjects, microStrokes, selectedObjectId, biomeId, waterLevel, regionTitle]
  );

  // Undo last action
  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      const remaining = prev.slice(0, -1);

      heightMapRef.current = new Float32Array(snapshot.heightMap);
      splatMapRef.current = new Uint8Array(snapshot.splatMap);
      colorMapRef.current = new Float32Array(snapshot.colorMap);
      setPlacedObjects(snapshot.placedObjects.map((o) => ({ ...o })));
      setMicroStrokes(snapshot.microStrokes.map((m) => ({ ...m })));
      setSelectedObjectId(snapshot.selectedObjectId);
      setBiomeId(snapshot.biomeId);
      setWaterLevel(snapshot.waterLevel);
      setRegionTitle(snapshot.regionTitle);
      setTerrainVersion((v) => v + 1);
      showToast(
        `Đã hoàn tác: "${snapshot.actionLabel}" (${remaining.length} bước hoàn tác còn lại).`
      );
      return remaining;
    });
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
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndo();
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

  // Sync Placed Objects Y coordinates after terrain edits
  const syncObjectsToGround = useCallback((currentObjects: PlacedObject[]) => {
    return currentObjects.map((obj) => ({
      ...obj,
      y: Number(getGroundHeightAt(heightMapRef.current, GRID_SIZE, WORLD_SIZE, obj.x, obj.z).toFixed(2)),
    }));
  }, []);

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
      placedObjects,
      { ensureMatchingTerrain: true }
    );

    setPlacedObjects(result.newObjects);
    if (result.addedObjects.length > 0) {
      setSelectedObjectId(result.addedObjects[0].id);
    }
    setTerrainVersion((v) => v + 1);
    showToast(result.summary);
  }, [terrainRules, biomeId, placedObjects, pushUndoSnapshot, showToast]);

  // Record undo snapshot when a brush stroke starts on the 3D terrain
  const handleTerrainStrokeStart = useCallback(() => {
    lastStrokeSnapshotTimeRef.current = performance.now();
    const label =
      activeTab === 'paint'
        ? `Vẽ ${TEXTURE_BRUSHES[textureBrush].name} (Cọ ${brushRadius}m)`
        : `Đắp địa hình (${sculptTool} · Cọ ${brushRadius}m)`;
    pushUndoSnapshot(label);
  }, [activeTab, textureBrush, sculptTool, brushRadius, pushUndoSnapshot]);

  // Handle Sculpt or Paint stroke at (worldX, worldZ)
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
        const changed = applySculptBrush(
          heightMapRef.current,
          splatMapRef.current,
          colorMapRef.current,
          biomeId,
          sculptTool,
          worldX,
          worldZ,
          brushRadius,
          brushStrength
        );
        if (changed > 0) {
          if (autoRuleOnSculpt && terrainRules.some((r) => r.enabled)) {
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
                  focusRadiusMeters: Math.max(brushRadius * 1.4, 80),
                }
              );
              return ruleRes.newObjects;
            });
          } else {
            setPlacedObjects((prevObjs) => syncObjectsToGround(prevObjs));
          }
          setTerrainVersion((v) => v + 1);
          setStrokeCount((c) => c + 1);
        }
      } else if (activeTab === 'paint') {
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
          }
        );
        if (painted > 0) {
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
          setStrokeCount((c) => c + 1);
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
      setTerrainVersion((v) => v + 1);
      showToast(
        `Đã phủ "${TEXTURE_BRUSHES[brushId].name}" (3D thật) lên toàn bộ ${VIRTUAL_RESOLUTION_PX.toLocaleString()} điểm Vector.`
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
    setTerrainVersion((v) => v + 1);
    showToast(
      'Đã đưa bản đồ 10×10km (10.000.000.000 điểm Vector) về Mặt Phẳng Đất Nguyên Bản (Cao độ 0m).'
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
      const offsetIndex = placedObjects.length;
      const angle = offsetIndex * 1.15;
      const radius = 12 + (offsetIndex % 5) * 8;
      const wx = Number((Math.cos(angle) * radius).toFixed(1));
      const wz = Number((Math.sin(angle) * radius).toFixed(1));
      handlePlacePrefabAt(wx, wz, prefabId);
    },
    [placedObjects.length, handlePlacePrefabAt]
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

      // Populate 3D physical surface ecosystem patches matching the planet's surface
      if (
        nextBiome === 'mars_olympus' ||
        nextBiome === 'venus_ishtar' ||
        nextBiome === 'kepler_crystalline' ||
        nextBiome === 'trappist_tidally_locked'
      ) {
        const planetBrush = bConfig.defaultTexture;
        setMicroStrokes(
          [
            { x: 0, z: 0, r: 16 },
            { x: -16, z: -10, r: 12 },
            { x: 18, z: -12, r: 12 },
            { x: -14, z: 14, r: 12 },
            { x: 15, z: 14, r: 12 },
          ].map((pt, i) => ({
            id: `planet-patch-${nextBiome}-${i}`,
            x: pt.x,
            z: pt.z,
            radius: pt.r,
            brushId: planetBrush,
            grassHeightCm,
            flowerSpecies,
            flowerColorHex,
          }))
        );
      }

      setRegionTitle(bConfig.name);
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
    setTerrainVersion((v) => v + 1);
    showToast('Đã kiến tạo mẫu địa hình đồi núi Vector 10×10km (cao độ tối đa 1km).');
  }, [biomeId, pushUndoSnapshot, showToast]);

  const handleExportWorldJson = useCallback(() => {
    const payload = {
      regionTitle,
      biomeId,
      graphicsEngine: 'Vector 3D Mesh + Physical 3D Surface Ecosystems',
      buildingScaleMode: '1:1 Real-World Dimensions (1 unit = 1m)',
      grassHeightCm,
      flowerSpecies,
      flowerColorHex,
      dimensionsKm: `${WORLD_SIZE_KM}x${WORLD_SIZE_KM}km`,
      areaSqKm: WORLD_SIZE_KM * WORLD_SIZE_KM,
      resolutionPx: VIRTUAL_RESOLUTION_PX,
      virtualGridDimensions: `${VIRTUAL_SIDE_PX}x${VIRTUAL_SIDE_PX}px (${PIXEL_SIZE_CM}cm/px)`,
      minBrushRadiusMeters: MIN_BRUSH_RADIUS,
      maxElevationMeters: MAX_ELEVATION,
      currentPeakMeters: elevationStats.maxElevation,
      waterLevel,
      sunElevation,
      gridSize: GRID_SIZE,
      worldSizeMeters: WORLD_SIZE,
      placedObjects,
      microStrokes,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aetherterra-vector-10x10km-${biomeId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã xuất tệp thiết kế bản đồ Vector 10×10km (.JSON).');
  }, [
    regionTitle,
    biomeId,
    grassHeightCm,
    flowerSpecies,
    flowerColorHex,
    elevationStats.maxElevation,
    waterLevel,
    sunElevation,
    placedObjects,
    microStrokes,
    showToast,
  ]);

  const selectedObject =
    placedObjects.find((o) => o.id === selectedObjectId) || null;

  const handleRotateSelected = () => {
    if (!selectedObjectId) return;
    pushUndoSnapshot('Xoay vật thể +45°');
    setPlacedObjects((prev) =>
      prev.map((o) =>
        o.id === selectedObjectId
          ? { ...o, rotationY: o.rotationY + Math.PI / 4 }
          : o
      )
    );
  };

  const handleSetSelectedObjectRotationDeg = (deg: number) => {
    const clampedDeg = ((deg % 360) + 360) % 360;
    setPlacementRotationDeg(clampedDeg);
    if (!selectedObjectId) return;
    const now = performance.now();
    if (now - lastStrokeSnapshotTimeRef.current > 1000) {
      lastStrokeSnapshotTimeRef.current = now;
      pushUndoSnapshot(`Xoay hướng vật thể (${clampedDeg}°)`);
    }
    const rad = Number(((clampedDeg * Math.PI) / 180).toFixed(4));
    setPlacedObjects((prev) =>
      prev.map((o) => (o.id === selectedObjectId ? { ...o, rotationY: rad } : o))
    );
  };

  const handleScaleSelected = (delta: number) => {
    if (!selectedObjectId) return;
    pushUndoSnapshot('Đổi kích thước vật thể');
    setPlacedObjects((prev) =>
      prev.map((o) =>
        o.id === selectedObjectId
          ? {
              ...o,
              scale: Math.max(0.3, Math.min(3.0, Number((o.scale + delta).toFixed(2)))),
            }
          : o
      )
    );
  };

  const handleSetSelectedObjectScale = (nextScale: number) => {
    const clamped = Math.max(0.3, Math.min(3.0, Number(nextScale.toFixed(2))));
    setPlacementScale(clamped);
    if (!selectedObjectId) return;
    const now = performance.now();
    if (now - lastStrokeSnapshotTimeRef.current > 1000) {
      lastStrokeSnapshotTimeRef.current = now;
      pushUndoSnapshot(`Chỉnh cỡ vật thể (${clamped}x)`);
    }
    setPlacedObjects((prev) =>
      prev.map((o) => (o.id === selectedObjectId ? { ...o, scale: clamped } : o))
    );
  };

  const handleDeleteSelected = () => {
    if (!selectedObjectId) return;
    const target = placedObjects.find((o) => o.id === selectedObjectId);
    pushUndoSnapshot(`Xóa ${target?.label || 'vật thể'}`);
    setPlacedObjects((prev) => prev.filter((o) => o.id !== selectedObjectId));
    setSelectedObjectId(null);
    showToast('Đã xóa vật thể khỏi bản đồ (Có thể nhấn Hoàn Tác để khôi phục).');
  };

  const canUndo = undoStack.length > 0;
  const lastUndoLabel = undoStack[undoStack.length - 1]?.actionLabel;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0f1722] select-none">
      {/* Full-Bleed Vector 3D Open-World Canvas (10x10 km, 10 Billion Vector Points, 1:1 Building Scale, Real 3D Grass/Flowers/Sand/Lava) */}
      <WorldViewport3D
        heightMap={heightMapRef.current}
        splatMap={splatMapRef.current}
        colorMap={colorMapRef.current}
        terrainVersion={terrainVersion}
        biomeId={biomeId}
        activeWeather={activeWeather}
        sunElevation={sunElevation}
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
        onPlacePrefabAt={(x, z) => handlePlacePrefabAt(x, z)}
        onSelectObject={setSelectedObjectId}
        onHoverCoordsChange={setHoverCoords}
        onScaleMetricsChange={setScaleMetrics}
      />

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
            <span className="text-amber-300 font-semibold" data-testid="world-resolution-spec">
              Vector 10.000.000.000 px (10cm)
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
            <span data-testid="world-weather-spec" className="text-pink-300 font-semibold">
              {WEATHER_CATALOG.find((w) => w.id === activeWeather)?.shortName || 'Quang Đãng'}
            </span>
            <span>·</span>
            <span data-testid="world-brush-spec">Cọ {brushRadius}m</span>
          </div>
        </div>

        {/* Right: Compact Undo + Camera Presets + Photo-to-3D Button */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
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
                { id: 'village', label: 'Làng 1:1' },
                { id: 'sky_volcano', label: 'Đảo Bay & Núi Lửa' },
                { id: 'closeup', label: 'Soi Cỏ 3–5cm' },
                { id: 'valley', label: 'Thung Lũng' },
                { id: 'overview', label: '10km' },
                { id: 'topdown', label: '90°' },
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
            onClick={() => setIsReconstructModalOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 shadow-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Tải Ảnh 3D
          </button>
        </div>
      </header>

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

      {/* Unified Collapsible Bottom Control Dock (Single-Row Tools + Multi-Page Brush Scales + 3-5cm Grass & Flower Customizer + Undo) */}
      <BottomControlDock
        isCollapsed={isDockCollapsed}
        onToggleCollapse={() => setIsDockCollapsed((prev) => !prev)}
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
        onToggleCarveTerrainOnPaint={() => setCarveTerrainOnPaint((prev) => !prev)}
        onFillEntireTerrainTexture={handleFillEntireTerrainTexture}
        onResetToFlatEarth={handleResetToFlatEarth}
        terrainRules={terrainRules}
        autoRuleOnSculpt={autoRuleOnSculpt}
        onToggleAutoRuleOnSculpt={() => setAutoRuleOnSculpt((prev) => !prev)}
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
        onChangeSunElevation={setSunElevation}
        waterLevel={waterLevel}
        onChangeWaterLevel={setWaterLevel}
        canUndo={canUndo}
        undoCount={undoStack.length}
        lastUndoLabel={lastUndoLabel}
        onUndo={handleUndo}
        onOpenReconstructModal={() => setIsReconstructModalOpen(true)}
        onResetWorld={handleResetWorld}
        onExportWorldJson={handleExportWorldJson}
      />

      {/* Bottom-Right Live Vector Distance Scale Bar / Ruler (1:1 Real-World Scale) */}
      <DistanceScaleBar
        metersPerPixel={scaleMetrics.metersPerPixel}
        cameraDistanceMeters={scaleMetrics.cameraDistanceMeters}
        hoverCoords={hoverCoords}
      />

      {/* Image-to-3D Terrain & Object Reconstruction Modal */}
      <ImageReconstructModal
        isOpen={isReconstructModalOpen}
        onClose={() => setIsReconstructModalOpen(false)}
        onApplyReconstruction={handleApplyReconstruction}
      />
    </main>
  );
}
