import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Mountain,
  Paintbrush,
  Trees,
  Sun,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  PlusCircle,
  Trash2,
  RotateCw,
  Download,
  Maximize2,
  Layers,
  SlidersHorizontal,
  Flower2,
  Sprout,
  Wand2,
  Play,
  Pause,
  Moon,
  Sparkles,
  Upload,
  Check,
  X,
} from 'lucide-react';
import {
  BiomeId,
  BIOMES,
  BRUSH_SCALE_PAGES,
  DAY_NIGHT_PRESETS,
  FLOWER_COLOR_PALETTE,
  FLOWER_SPECIES_CATALOG,
  FlowerSpeciesId,
  getBrushPageIndexForRadius,
  MAX_GRASS_HEIGHT_CM,
  MIN_GRASS_HEIGHT_CM,
  PlacedObject,
  PrefabCategory,
  PrefabId,
  PREFAB_CATALOG,
  RuleOperator,
  SculptToolId,
  TerrainRule,
  TextureBrushId,
  TEXTURE_BRUSHES,
  WeatherId,
  WEATHER_CATALOG,
} from '../world/registry';
import {
  formatTerrainRuleFormula,
  formatTimeOfDayClock,
} from '../world/generation';

export type ActiveTabId = 'sculpt' | 'paint' | 'rules' | 'prefabs' | 'atmosphere';

interface BottomControlDockProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  activeTab: ActiveTabId;
  onSelectTab: (tab: ActiveTabId) => void;

  // Sculpting state
  sculptTool: SculptToolId;
  onSelectSculptTool: (tool: SculptToolId) => void;
  brushRadius: number;
  onChangeBrushRadius: (r: number) => void;
  brushStrength: number;
  onChangeBrushStrength: (s: number) => void;

  // Texture painting & 3D surface ecosystem state (3-5cm grass, flower species & color)
  textureBrush: TextureBrushId;
  onSelectTextureBrush: (brush: TextureBrushId) => void;
  grassHeightCm: number;
  onChangeGrassHeightCm: (cm: number) => void;
  flowerSpecies: FlowerSpeciesId;
  onChangeFlowerSpecies: (species: FlowerSpeciesId) => void;
  flowerColorHex: string;
  onChangeFlowerColorHex: (hex: string) => void;
  carveTerrainOnPaint: boolean;
  onToggleCarveTerrainOnPaint: () => void;
  onFillEntireTerrainTexture: (brush: TextureBrushId) => void;
  onResetToFlatEarth: () => void;

  // Rule-based generation ("Vẽ theo quy luật") state & actions
  terrainRules: TerrainRule[];
  autoRuleOnSculpt: boolean;
  onToggleAutoRuleOnSculpt: () => void;
  onToggleTerrainRule: (ruleId: string) => void;
  onAddTerrainRule: (rule: {
    operator: RuleOperator;
    thresholdMeters: number;
    maxThresholdMeters?: number;
    targetPrefabId: PrefabId;
    targetTextureId?: TextureBrushId | 'none';
  }) => void;
  onDeleteTerrainRule: (ruleId: string) => void;
  onExecuteTerrainRules: () => void;

  // Prefab placement & orientation/scale state
  selectedPrefab: PrefabId;
  onSelectPrefab: (prefab: PrefabId) => void;
  prefabCategoryFilter: PrefabCategory | 'all';
  onChangePrefabCategoryFilter: (cat: PrefabCategory | 'all') => void;
  placementRotationDeg: number;
  onChangePlacementRotationDeg: (deg: number) => void;
  placementScale: number;
  onChangePlacementScale: (scale: number) => void;
  onSpawnPrefabAtCenter: (prefab: PrefabId) => void;

  // Selected placed object manipulation
  selectedObject: PlacedObject | null;
  onRotateSelectedObject: () => void;
  onSetSelectedObjectRotationDeg: (deg: number) => void;
  onScaleSelectedObject: (delta: number) => void;
  onSetSelectedObjectScale: (scale: number) => void;
  onDeleteSelectedObject: () => void;

  // World, Planetary Biomes, Weather & Day/Night Cycle state
  activeBiome: BiomeId;
  onSelectBiome: (biome: BiomeId) => void;
  activeWeather: WeatherId;
  onSelectWeather: (weather: WeatherId) => void;
  sunElevation: number;
  onChangeSunElevation: (val: number) => void;
  sunAzimuth?: number;
  onChangeSunAzimuth?: (val: number) => void;
  timeOfDay?: number;
  onChangeTimeOfDay?: (val: number) => void;
  isDayNightAuto?: boolean;
  onToggleDayNightAuto?: () => void;
  starlightMode?: boolean;
  onToggleStarlightMode?: () => void;
  onApplyDayNightPreset?: (presetId: string) => void;
  waterLevel: number;
  onChangeWaterLevel: (val: number) => void;

  // Undo history state
  canUndo: boolean;
  undoCount: number;
  lastUndoLabel?: string;
  onUndo: () => void;

  // Actions
  onOpenReconstructModal: () => void;
  onResetWorld: () => void;
  onExportWorldJson: () => void;
  onImportWorldJson?: (file: File) => void;
}

const SCULPT_TOOLS: Array<{ id: SculptToolId; name: string }> = [
  { id: 'alpine_horn_glacier', name: 'Đỉnh Tuyết Himalaya / Anpơ / Andes' },
  { id: 'barchan_dune_saltflat', name: 'Cồn Cát Sahara / Muối Atacama' },
  { id: 'meander_river_delta', name: 'Sông Uốn Khúc Amazon / Congo' },
  { id: 'cryo_volcano', name: 'Núi Lửa Băng Sao Diêm Vương (Pluto)' },
  { id: 'methane_basin', name: 'Biển Metan Lỏng Vệ Tinh Titan' },
  { id: 'meteor_crater', name: 'Hố Va Chạm Thiên Thạch' },
  { id: 'shield_mesa', name: 'Núi Lửa Khiên Sao Hỏa / Vòm Sao Kim' },
  { id: 'sheer_cliff', name: 'Vách Đá Dựng Đứng 90°' },
  { id: 'volcano_crater', name: 'Miệng Núi Lửa' },
  { id: 'abyss_chasm', name: 'Vực Sâu Vực Đá' },
  { id: 'canyon_gorge', name: 'Hẻm Núi Đứt Gãy' },
  { id: 'raise', name: 'Nâng Đồi Núi' },
  { id: 'lower', name: 'Đào Sông / Hồ' },
  { id: 'ridge', name: 'Đỉnh Núi Nhọn' },
  { id: 'terrace', name: 'Bậc Thang Genshin' },
  { id: 'flatten', name: 'San Phẳng Nền' },
  { id: 'smooth', name: 'Làm Mượt Sườn' },
];

const RULE_PREFAB_OPTIONS: Array<{ id: PrefabId; label: string; defaultTex: TextureBrushId }> = [
  { id: 'pluto_cryo_volcano', label: 'Núi Lửa Băng Wright Mons (Sao Diêm Vương — Từ Ảnh Mẫu)', defaultTex: 'pluto_nitrogen_ice' },
  { id: 'europa_penitentes_spire', label: 'Mặt Cắt Rãnh Nứt Băng & Đại Dương Ngầm Europa (Từ Ảnh Mẫu)', defaultTex: 'pluto_nitrogen_ice' },
  { id: 'himalaya_matterhorn_peak', label: 'Đỉnh Sừng Băng Matterhorn (Dãy Anpơ — Từ Ảnh Mẫu)', defaultTex: 'glacier_snow' },
  { id: 'himalaya_fishtail_peak', label: 'Đỉnh Đuôi Cá Machapuchare / Everest (Himalaya — Từ Ảnh Mẫu)', defaultTex: 'glacier_snow' },
  { id: 'mars_olympus_shield', label: 'Núi Lửa Khiên Olympus Mons (Sao Hỏa — Từ Ảnh Mẫu)', defaultTex: 'mars_regolith' },
  { id: 'titan_mithrim_montes', label: 'Núi Rãnh Sao Mithrim / Doom Mons (Titan — Ảnh NASA JPL)', defaultTex: 'titan_methane_liquid' },
  { id: 'island_volcano_icon', label: 'Núi Lửa Đảo Nhiệt Đới (Từ Ảnh Mẫu)', defaultTex: 'volcanic_lava' },
  { id: 'karst_mountain', label: 'Đá Nhọn (Đỉnh Đá Thạch Anh)', defaultTex: 'limestone_cliff' },
  { id: 'sahara_atacama_oasis', label: 'Ốc Đảo Sahara & Tháp Đá Atacama', defaultTex: 'atacama_salt_crust' },
  { id: 'hawaii_kilauea_shield', label: 'Núi Lửa Khiên Kīlauea (Hawaii)', defaultTex: 'volcanic_lava' },
  { id: 'amazon_congo_canopy_tree', label: 'Đại Thụ Rừng Mưa Amazon / Trung Phi', defaultTex: 'tropical_rainforest_floor' },
  { id: 'taiga_spruce_grove', label: 'Rừng Lá Kim Taiga Tuyết Phủ', defaultTex: 'taiga_moss_needles' },
  { id: 'titan_methane_geyser', label: 'Đảo Đá & Mạch Phun Metan (Titan)', defaultTex: 'titan_methane_liquid' },
  { id: 'venus_pancake_dome', label: 'Vòm Lưu Huỳnh (Sao Kim)', defaultTex: 'venus_sulfur' },
  { id: 'meteor_impact_crater', label: 'Hố Thiên Thạch & Lõi Sao Băng', defaultTex: 'exoplanet_basalt' },
  { id: 'exoplanet_crystal_spire', label: 'Tháp Tinh Thể Ngoại Hành Tinh', defaultTex: 'exoplanet_basalt' },
  { id: 'sheer_cliff_wall', label: 'Vách Đá Dựng Đứng 90°', defaultTex: 'limestone_cliff' },
  { id: 'floating_sky_island', label: 'Đảo Bay Celestia', defaultTex: 'glacier_snow' },
  { id: 'active_volcano', label: 'Núi Lửa Phun Trào', defaultTex: 'volcanic_lava' },
  { id: 'abyss_chasm_vortex', label: 'Vực Sâu Area Zero', defaultTex: 'limestone_cliff' },
  { id: 'volcanic_peak', label: 'Núi Đá Nham Cổ Đại', defaultTex: 'limestone_cliff' },
  { id: 'emerald_pine', label: 'Cây Thông Ngọc Lục', defaultTex: 'emerald_grass' },
  { id: 'sakura_tree', label: 'Cây Anh Đào Thần Thụ', defaultTex: 'flower_meadow' },
  { id: 'statue_of_seven', label: 'Thất Thiên Thần Tượng', defaultTex: 'limestone_cliff' },
  { id: 'windmill_cottage', label: 'Nhà Cối Xay Gió', defaultTex: 'emerald_grass' },
];

const BottomControlDockComponent: React.FC<BottomControlDockProps> = ({
  isCollapsed,
  onToggleCollapse,
  activeTab,
  onSelectTab,
  sculptTool,
  onSelectSculptTool,
  brushRadius,
  onChangeBrushRadius,
  brushStrength,
  onChangeBrushStrength,
  textureBrush,
  onSelectTextureBrush,
  grassHeightCm,
  onChangeGrassHeightCm,
  flowerSpecies,
  onChangeFlowerSpecies,
  flowerColorHex,
  onChangeFlowerColorHex,
  carveTerrainOnPaint,
  onToggleCarveTerrainOnPaint,
  onFillEntireTerrainTexture,
  onResetToFlatEarth,
  terrainRules,
  autoRuleOnSculpt,
  onToggleAutoRuleOnSculpt,
  onToggleTerrainRule,
  onAddTerrainRule,
  onDeleteTerrainRule,
  onExecuteTerrainRules,
  selectedPrefab,
  onSelectPrefab,
  prefabCategoryFilter,
  onChangePrefabCategoryFilter,
  placementRotationDeg,
  onChangePlacementRotationDeg,
  placementScale,
  onChangePlacementScale,
  onSpawnPrefabAtCenter,
  selectedObject,
  onRotateSelectedObject,
  onSetSelectedObjectRotationDeg,
  onScaleSelectedObject,
  onSetSelectedObjectScale,
  onDeleteSelectedObject,
  activeBiome,
  onSelectBiome,
  activeWeather,
  onSelectWeather,
  sunElevation,
  onChangeSunElevation,
  sunAzimuth = 135,
  onChangeSunAzimuth,
  timeOfDay = 10.5,
  onChangeTimeOfDay,
  isDayNightAuto = false,
  onToggleDayNightAuto,
  starlightMode = false,
  onToggleStarlightMode,
  onApplyDayNightPreset,
  waterLevel,
  onChangeWaterLevel,
  canUndo,
  undoCount,
  lastUndoLabel,
  onUndo,
  onResetWorld,
  onExportWorldJson,
  onImportWorldJson,
}) => {
  const [brushPageIndex, setBrushPageIndex] = useState<number>(() =>
    getBrushPageIndexForRadius(brushRadius)
  );
  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);

  // Quick Rule Builder state inside BottomControlDock
  const [newRuleOperator, setNewRuleOperator] = useState<RuleOperator>('>');
  const [newRuleThreshold, setNewRuleThreshold] = useState<number>(500);
  const [newRuleMaxThreshold, setNewRuleMaxThreshold] = useState<number>(750);
  const [newRulePrefab, setNewRulePrefab] = useState<PrefabId>('karst_mountain');

  const horizontalRowRef = useRef<HTMLDivElement | null>(null);
  const [horizontalScrollPct, setHorizontalScrollPct] = useState<number>(0);

  const enabledRulesCount = terrainRules.filter((r) => r.enabled).length;

  const handleCreateRule = () => {
    const opt =
      RULE_PREFAB_OPTIONS.find((o) => o.id === newRulePrefab) || RULE_PREFAB_OPTIONS[0];
    onAddTerrainRule({
      operator: newRuleOperator,
      thresholdMeters: newRuleThreshold,
      maxThresholdMeters: newRuleOperator === 'between' ? newRuleMaxThreshold : undefined,
      targetPrefabId: newRulePrefab,
      targetTextureId: opt.defaultTex,
    });
  };

  useEffect(() => {
    const el = horizontalRowRef.current;
    if (!el) return;
    el.scrollLeft = 0;
    setHorizontalScrollPct(0);
  }, [activeTab, prefabCategoryFilter]);

  const handleRowScroll = useCallback(() => {
    const el = horizontalRowRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 0) {
      setHorizontalScrollPct(0);
    } else {
      setHorizontalScrollPct(Math.round((el.scrollLeft / maxScroll) * 100));
    }
  }, []);

  const handleHorizontalSliderChange = useCallback((pct: number) => {
    setHorizontalScrollPct(pct);
    const el = horizontalRowRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll > 0) {
      el.scrollLeft = (pct / 100) * maxScroll;
    }
  }, []);

  const scrollRowByStep = useCallback((direction: -1 | 1) => {
    const el = horizontalRowRef.current;
    if (!el) return;
    el.scrollBy({ left: 180 * direction, behavior: 'smooth' });
  }, []);

  const handleSelectBrushPage = (nextPageIdx: number) => {
    const clampedIdx = Math.max(0, Math.min(BRUSH_SCALE_PAGES.length - 1, nextPageIdx));
    setBrushPageIndex(clampedIdx);
    const page = BRUSH_SCALE_PAGES[clampedIdx];
    if (brushRadius < page.minRadius || brushRadius > page.maxRadius) {
      onChangeBrushRadius(page.defaultRadius);
    }
  };

  const activeBrushPage = BRUSH_SCALE_PAGES[brushPageIndex] || BRUSH_SCALE_PAGES[1];
  const sliderBrushValue = Math.max(
    activeBrushPage.minRadius,
    Math.min(activeBrushPage.maxRadius, brushRadius)
  );

  const filteredPrefabs = PREFAB_CATALOG.filter(
    (p) => prefabCategoryFilter === 'all' || p.category === prefabCategoryFilter
  );

  const selectedObjDeg = selectedObject
    ? (((Math.round((selectedObject.rotationY * 180) / Math.PI) % 360) + 360) % 360)
    : placementRotationDeg;

  const selectedObjScale = selectedObject ? selectedObject.scale : placementScale;
  const selectedObjMeta = selectedObject
    ? PREFAB_CATALOG.find((p) => p.id === selectedObject.prefabId) || PREFAB_CATALOG[0]
    : null;

  return (
    <div
      style={{
        bottom: '10px',
        left: '10px',
        maxWidth: isCollapsed ? '240px' : 'calc(100vw - 192px)',
        width: isCollapsed ? 'auto' : '100%',
      }}
      className="fixed z-30 pointer-events-auto flex flex-col items-start"
    >
      {isCollapsed ? (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="px-3 py-1.5 rounded-full bg-[#111927]/95 border border-slate-700/90 text-xs font-medium text-slate-200 hover:text-white hover:border-amber-400/60 flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
        >
          <ChevronUp className="w-3.5 h-3.5 text-amber-400" />
          <span>Mở Công Cụ Thiết Kế (Phím H)</span>
        </button>
      ) : (
        <section
          aria-label="Bảng công cụ thiết kế thu gọn"
          className="w-full rounded-xl bg-[#111927]/95 border border-slate-700/90 shadow-2xl px-2.5 py-1.5 text-slate-100 flex flex-col gap-1.5"
        >
          {/* ROW 1: Mode Tabs + Inline Selected Object Controls + Undo / Reset / Collapse (30px height) */}
          <div className="flex flex-nowrap items-center justify-between gap-2 pb-1 border-b border-slate-800/90 overflow-x-auto no-scrollbar">
            {/* Mode Tabs */}
            <div className="flex items-center gap-1 bg-[#0b111c] p-0.5 rounded-lg shrink-0">
              <button
                type="button"
                data-testid="tab-paint"
                onClick={() => onSelectTab('paint')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'paint'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Paintbrush className="w-3 h-3" />
                Vẽ Bề Mặt (18)
              </button>
              <button
                type="button"
                data-testid="tab-sculpt"
                onClick={() => onSelectTab('sculpt')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'sculpt'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Mountain className="w-3 h-3" />
                Đắp Địa Hình (17)
              </button>
              <button
                type="button"
                data-testid="tab-rules"
                onClick={() => onSelectTab('rules')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'rules'
                    ? 'bg-violet-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Wand2 className="w-3 h-3" />
                Vẽ Quy Luật ({enabledRulesCount}/{terrainRules.length})
              </button>
              <button
                type="button"
                data-testid="tab-prefabs"
                onClick={() => onSelectTab('prefabs')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'prefabs'
                    ? 'bg-cyan-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Trees className="w-3 h-3" />
                Công Trình &amp; Hành Tinh ({PREFAB_CATALOG.length})
              </button>
              <button
                type="button"
                data-testid="tab-atmosphere"
                onClick={() => onSelectTab('atmosphere')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'atmosphere'
                    ? 'bg-pink-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Sun className="w-3 h-3" />
                Hành Tinh & Thời Tiết (20)
              </button>
            </div>

            {/* Inline Selected Object Mini-Inspector (No extra vertical row!) */}
            {selectedObject && (
              <div
                data-testid="selected-object-inspector"
                className="flex items-center gap-2 px-2 py-0.5 rounded-lg bg-[#162032] border border-amber-400/50 text-[11px] shrink-0"
              >
                <span className="text-amber-300 font-semibold truncate max-w-[125px]">
                  {selectedObject.label}
                </span>
                {selectedObjMeta && (
                  <span
                    data-testid="selected-object-real-dims"
                    className="text-emerald-300 font-mono text-[10px] hidden xl:inline"
                  >
                    ({selectedObjMeta.realDimensions})
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[10px]">Hướng:</span>
                  <input
                    aria-label="Hướng xoay vật thể đang chọn"
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={selectedObjDeg}
                    onChange={(e) => onSetSelectedObjectRotationDeg(Number(e.target.value))}
                    className="w-12 h-1 accent-amber-400 cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-amber-300 w-7 text-right">
                    {selectedObjDeg}°
                  </span>
                  <button
                    type="button"
                    onClick={onRotateSelectedObject}
                    className="px-1 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer"
                  >
                    +45°
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 text-[10px]">Cỡ:</span>
                  <input
                    aria-label="Kích thước vật thể đang chọn"
                    type="range"
                    min={0.3}
                    max={3.0}
                    step={0.05}
                    value={selectedObjScale}
                    onChange={(e) => onSetSelectedObjectScale(Number(e.target.value))}
                    className="w-12 h-1 accent-cyan-400 cursor-pointer"
                  />
                  <span className="font-mono text-[10px] text-cyan-300 w-8 text-right">
                    {selectedObjScale.toFixed(1)}x
                  </span>
                  <button
                    type="button"
                    onClick={() => onScaleSelectedObject(0.15)}
                    className="px-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => onScaleSelectedObject(-0.15)}
                    className="px-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] cursor-pointer"
                  >
                    -
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onDeleteSelectedObject}
                  aria-label="Xóa vật thể đang chọn"
                  className="px-1.5 py-0.2 rounded bg-rose-950/90 hover:bg-rose-800 text-rose-200 text-[10px] flex items-center gap-0.5 cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  Xóa
                </button>
              </div>
            )}

            {/* Right Quick Actions + Collapse Button */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                data-testid="dock-undo-button"
                onClick={onUndo}
                disabled={!canUndo}
                title={
                  canUndo
                    ? `Hoàn tác: ${lastUndoLabel || ''} (Ctrl+Z)`
                    : 'Chưa có thao tác để hoàn tác'
                }
                className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors whitespace-nowrap ${
                  canUndo
                    ? 'bg-indigo-500/25 hover:bg-indigo-500/40 border-indigo-400/70 text-indigo-100 cursor-pointer'
                    : 'bg-slate-800/50 border-slate-800 text-slate-500 cursor-not-allowed'
                }`}
              >
                <RotateCcw className="w-3 h-3 text-indigo-300" />
                <span>Hoàn Tác {undoCount > 0 ? `(${undoCount})` : ''}</span>
              </button>
              <button
                type="button"
                onClick={onResetToFlatEarth}
                title="Đưa về Mặt Phẳng Đất Nguyên Bản (0m)"
                className="px-2 py-0.5 rounded-lg bg-amber-950/70 hover:bg-amber-900/80 border border-amber-500/40 text-amber-200 text-[11px] font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Layers className="w-3 h-3 text-amber-400" />
                Đất Gốc
              </button>
              <button
                type="button"
                onClick={onResetWorld}
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Đồi Núi 1km
              </button>
              <button
                type="button"
                onClick={onExportWorldJson}
                aria-label="Xuất dữ liệu bản đồ JSON"
                data-testid="export-world-json-btn"
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3 h-3" />
                Xuất JSON
              </button>
              {onImportWorldJson && (
                <>
                  <input
                    ref={jsonImportInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        onImportWorldJson(f);
                        e.target.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => jsonImportInputRef.current?.click()}
                    aria-label="Nhập dữ liệu bản đồ JSON"
                    data-testid="import-world-json-btn"
                    className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-medium flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    Nhập JSON
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onToggleCollapse}
                title="Thu gọn thanh công cụ (Phím H)"
                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-medium flex items-center gap-0.5 whitespace-nowrap cursor-pointer"
              >
                <ChevronDown className="w-3 h-3" />
                <span>Ẩn [H]</span>
              </button>
            </div>
          </div>

          {/* ROW 2: Single-Row Compact Tool Chips + Horizontal Search Slider + Multi-Page Brush Controller */}
          <div className="flex flex-nowrap items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            {/* Left Section: Single-Row Tool Chips + Compact Horizontal Slider */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1 bg-[#0b111c] px-2 py-1 rounded-lg border border-slate-800/80">
              <div
                ref={horizontalRowRef}
                onScroll={handleRowScroll}
                data-testid="single-row-tools-strip"
                className="flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0"
              >
                {activeTab === 'paint' &&
                  (Object.keys(TEXTURE_BRUSHES) as TextureBrushId[]).map((bId) => {
                    const b = TEXTURE_BRUSHES[bId];
                    const active = textureBrush === bId;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        data-testid={`brush-card-${b.id}`}
                        onClick={() => onSelectTextureBrush(b.id)}
                        className={`shrink-0 px-2.5 py-1 rounded-lg border text-left transition-colors cursor-pointer flex items-center gap-1.5 ${
                          active
                            ? 'bg-emerald-400/20 border-emerald-400 text-white font-semibold'
                            : 'bg-[#162032] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-sm shrink-0 border border-white/25"
                          style={{ backgroundColor: b.swatchHex }}
                        />
                        <span className="text-[11px] whitespace-nowrap">{b.name}</span>
                      </button>
                    );
                  })}

                {activeTab === 'sculpt' &&
                  SCULPT_TOOLS.map((t) => {
                    const active = sculptTool === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        data-testid={`sculpt-tool-${t.id}`}
                        onClick={() => onSelectSculptTool(t.id)}
                        className={`shrink-0 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer whitespace-nowrap text-[11px] ${
                          active
                            ? 'bg-amber-400/20 border-amber-400 text-white font-semibold'
                            : 'bg-[#162032] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}

                {activeTab === 'rules' &&
                  terrainRules.map((rule) => {
                    const active = rule.enabled;
                    return (
                      <div
                        key={rule.id}
                        data-testid={`rule-chip-${rule.id}`}
                        className={`shrink-0 px-2 py-0.5 rounded-lg border transition-colors flex items-center gap-1.5 ${
                          active
                            ? 'bg-violet-500/25 border-violet-400 text-white font-semibold'
                            : 'bg-[#162032] border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onToggleTerrainRule(rule.id)}
                          data-testid={`toggle-rule-${rule.id}`}
                          className="flex items-center gap-1.5 text-[11px] whitespace-nowrap cursor-pointer"
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] font-bold ${
                              active
                                ? 'bg-violet-400 text-slate-950'
                                : 'bg-slate-800 text-slate-500 border border-slate-700'
                            }`}
                          >
                            {active ? <Check className="w-2.5 h-2.5" /> : null}
                          </span>
                          <span>{formatTerrainRuleFormula(rule)}</span>
                        </button>
                        {terrainRules.length > 1 && (
                          <button
                            type="button"
                            onClick={() => onDeleteTerrainRule(rule.id)}
                            data-testid={`delete-rule-${rule.id}`}
                            aria-label={`Xóa quy luật ${rule.name}`}
                            className="p-0.5 rounded hover:bg-rose-500/30 text-slate-400 hover:text-rose-200 cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                {activeTab === 'prefabs' &&
                  filteredPrefabs.map((prefab) => {
                    const active = selectedPrefab === prefab.id;
                    return (
                      <button
                        key={prefab.id}
                        type="button"
                        data-testid={`prefab-card-${prefab.id}`}
                        onClick={() => onSelectPrefab(prefab.id)}
                        className={`shrink-0 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                          active
                            ? 'bg-cyan-400/20 border-cyan-400 text-white font-semibold'
                            : 'bg-[#162032] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: prefab.badgeColor }}
                        />
                        <span className="text-[11px] whitespace-nowrap">{prefab.name}</span>
                        <span className="text-[10px] font-mono text-emerald-300 whitespace-nowrap">
                          ({prefab.realDimensions.split('×')[0].trim()})
                        </span>
                      </button>
                    );
                  })}

                {activeTab === 'atmosphere' &&
                  ([...(Object.keys(BIOMES) as BiomeId[])].sort((a, b) => {
                    const rank = (id: BiomeId) => {
                      if (
                        id === 'himalaya_alps_andes' ||
                        id === 'sahara_atacama_gobi' ||
                        id === 'hawaii_shield_volcano' ||
                        id === 'amazon_congo_rainforest' ||
                        id === 'boreal_taiga_forest'
                      )
                        return 0;
                      if (
                        id === 'pluto_cryovolcano' ||
                        id === 'titan_methane_sea' ||
                        id === 'europa_chaos_ridge' ||
                        id === 'corot_lava_ocean' ||
                        id === 'mars_olympus' ||
                        id === 'venus_ishtar' ||
                        id === 'kepler_crystalline' ||
                        id === 'trappist_tidally_locked'
                      )
                        return 1;
                      return 2;
                    };
                    return rank(a) - rank(b);
                  })).map((bId) => {
                    const b = BIOMES[bId];
                    if (!b) return null;
                    const active = activeBiome === bId;
                    const isPlanetary =
                      bId === 'pluto_cryovolcano' ||
                      bId === 'titan_methane_sea' ||
                      bId === 'europa_chaos_ridge' ||
                      bId === 'corot_lava_ocean' ||
                      bId === 'mars_olympus' ||
                      bId === 'venus_ishtar' ||
                      bId === 'kepler_crystalline' ||
                      bId === 'trappist_tidally_locked';
                    const isEarthMegaregion =
                      bId === 'himalaya_alps_andes' ||
                      bId === 'sahara_atacama_gobi' ||
                      bId === 'hawaii_shield_volcano' ||
                      bId === 'amazon_congo_rainforest' ||
                      bId === 'boreal_taiga_forest';
                    return (
                      <button
                        key={b.id}
                        type="button"
                        data-testid={`biome-card-${b.id}`}
                        onClick={() => onSelectBiome(b.id)}
                        className={`shrink-0 px-2.5 py-1 rounded-lg border transition-colors cursor-pointer whitespace-nowrap text-[11px] flex items-center gap-1.5 ${
                          active
                            ? 'bg-pink-400/20 border-pink-400 text-white font-semibold'
                            : isPlanetary
                              ? 'bg-[#1c192b] border-amber-500/40 text-amber-200 hover:border-amber-400'
                              : isEarthMegaregion
                                ? 'bg-[#102428] border-emerald-400/40 text-emerald-200 hover:border-emerald-400'
                                : 'bg-[#162032] border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        {isPlanetary && (
                          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        )}
                        {isEarthMegaregion && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                        )}
                        <span>{b.name}</span>
                      </button>
                    );
                  })}
              </div>

              {/* Compact Inline Horizontal Scroll Slider */}
              <div className="flex items-center gap-1 pl-1.5 border-l border-slate-800 shrink-0">
                <SlidersHorizontal className="w-3 h-3 text-amber-400" />
                <button
                  type="button"
                  onClick={() => scrollRowByStep(-1)}
                  aria-label="Cuộn sang trái"
                  className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={horizontalScrollPct}
                  onChange={(e) => handleHorizontalSliderChange(Number(e.target.value))}
                  aria-label="Thanh trượt ngang tìm công cụ"
                  data-testid="horizontal-tool-slider"
                  className="w-16 h-1 accent-amber-400 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => scrollRowByStep(1)}
                  aria-label="Cuộn sang phải"
                  className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Right Section: Multi-Page Brush Controller OR Rule Builder OR Prefab/Atmosphere Inline Controls */}
            {activeTab === 'rules' && (
              <div
                data-testid="rule-builder-bar"
                className="flex items-center gap-1.5 bg-[#162032] px-2.5 py-1 rounded-lg border border-violet-500/40 shrink-0 text-[11px]"
              >
                <span className="text-violet-200 font-semibold whitespace-nowrap">
                  Nếu cao độ
                </span>
                <select
                  aria-label="Điều kiện so sánh cao độ"
                  data-testid="rule-operator-select"
                  value={newRuleOperator}
                  onChange={(e) => setNewRuleOperator(e.target.value as RuleOperator)}
                  className="bg-[#0b111c] border border-slate-700 rounded px-1.5 py-0.5 text-[11px] font-mono text-amber-300 cursor-pointer"
                >
                  <option value=">">&gt; (Lớn hơn)</option>
                  <option value="<">&lt; (Nhỏ hơn)</option>
                  <option value="between">Trong khoảng</option>
                </select>
                <div className="flex items-center gap-0.5">
                  <input
                    aria-label="Ngưỡng cao độ mét"
                    data-testid="rule-threshold-input"
                    type="number"
                    min={-240}
                    max={980}
                    step={25}
                    value={newRuleThreshold}
                    onChange={(e) => setNewRuleThreshold(Number(e.target.value))}
                    className="w-14 bg-[#0b111c] border border-slate-700 rounded px-1 py-0.5 text-[11px] font-mono text-emerald-300 text-right"
                  />
                  <span className="font-mono text-[10px] text-slate-400">m</span>
                </div>
                {newRuleOperator === 'between' && (
                  <div className="flex items-center gap-0.5">
                    <span className="text-slate-400">..</span>
                    <input
                      aria-label="Ngưỡng cao độ tối đa mét"
                      data-testid="rule-max-threshold-input"
                      type="number"
                      min={-200}
                      max={1000}
                      step={25}
                      value={newRuleMaxThreshold}
                      onChange={(e) => setNewRuleMaxThreshold(Number(e.target.value))}
                      className="w-14 bg-[#0b111c] border border-slate-700 rounded px-1 py-0.5 text-[11px] font-mono text-emerald-300 text-right"
                    />
                    <span className="font-mono text-[10px] text-slate-400">m</span>
                  </div>
                )}
                <span className="text-slate-300 whitespace-nowrap">→ Đặt:</span>
                <select
                  aria-label="Chọn vật thể đặt tự động theo quy luật"
                  data-testid="rule-prefab-select"
                  value={newRulePrefab}
                  onChange={(e) => setNewRulePrefab(e.target.value as PrefabId)}
                  className="bg-[#0b111c] border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-cyan-200 cursor-pointer max-w-[165px]"
                >
                  {RULE_PREFAB_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  data-testid="add-rule-btn"
                  onClick={handleCreateRule}
                  className="px-2 py-0.5 rounded bg-violet-500/25 hover:bg-violet-500/40 border border-violet-400/70 text-violet-100 text-[10px] font-semibold flex items-center gap-0.5 whitespace-nowrap cursor-pointer"
                >
                  <PlusCircle className="w-3 h-3 text-violet-300" />
                  Thêm Quy Luật
                </button>
                <button
                  type="button"
                  data-testid="toggle-auto-rule-sculpt"
                  onClick={onToggleAutoRuleOnSculpt}
                  title="Tự động chạy các quy luật đang bật ngay khi đắp địa hình vượt ngưỡng cao độ"
                  className={`px-2 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap cursor-pointer ${
                    autoRuleOnSculpt
                      ? 'bg-emerald-500/20 border-emerald-400/70 text-emerald-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {autoRuleOnSculpt ? '✓ Tự Động Khi Đắp' : 'Tự Động Khi Đắp'}
                </button>
                <button
                  type="button"
                  data-testid="execute-rules-btn"
                  onClick={onExecuteTerrainRules}
                  className="px-2.5 py-0.5 rounded-md bg-violet-400 hover:bg-violet-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap shadow cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-slate-950" />
                  Thực Thi Quy Luật
                </button>
              </div>
            )}

            {(activeTab === 'paint' || activeTab === 'sculpt') && (
              <div
                data-testid="brush-multipage-controller"
                className="flex items-center gap-1.5 bg-[#162032] px-2.5 py-1 rounded-lg border border-slate-800 shrink-0"
              >
                <span className="text-[11px] font-semibold text-slate-200 whitespace-nowrap">
                  Cọ:
                </span>
                <span
                  data-testid="brush-radius-readout"
                  className="font-mono text-[11px] font-bold text-emerald-300 tabular-nums w-9"
                >
                  {brushRadius >= 1000 ? `${brushRadius / 1000}km` : `${brushRadius}m`}
                </span>
                <span
                  data-testid="active-brush-page-label"
                  className="hidden"
                >
                  ({activeBrushPage.label})
                </span>

                {/* Compact Scale Page Pills (Thang 5m | 25m | 100m | 500m | 2.5km) */}
                <div
                  data-testid="brush-scale-pages-row"
                  className="flex items-center gap-0.5 bg-[#0b111c] p-0.5 rounded-md"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectBrushPage(brushPageIndex - 1)}
                    disabled={brushPageIndex === 0}
                    data-testid="brush-page-prev"
                    aria-label="Trang thang cỡ cọ trước"
                    className="p-0.5 rounded text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                  {BRUSH_SCALE_PAGES.map((page, idx) => {
                    const isActivePage = idx === brushPageIndex;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        data-testid={`brush-page-tab-${page.id}`}
                        onClick={() => handleSelectBrushPage(idx)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap transition-colors cursor-pointer ${
                          isActivePage
                            ? activeTab === 'paint'
                              ? 'bg-emerald-400 text-slate-950 font-bold'
                              : 'bg-amber-400 text-slate-950 font-bold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {page.shortLabel.replace('Thang ', '')}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => handleSelectBrushPage(brushPageIndex + 1)}
                    disabled={brushPageIndex === BRUSH_SCALE_PAGES.length - 1}
                    data-testid="brush-page-next"
                    aria-label="Trang thang cỡ cọ tiếp theo"
                    className="p-0.5 rounded text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Calibrated Slider + Quick Presets */}
                <input
                  aria-label={`Thanh trượt cỡ cọ ${activeBrushPage.shortLabel}`}
                  data-testid="brush-page-slider"
                  type="range"
                  min={activeBrushPage.minRadius}
                  max={activeBrushPage.maxRadius}
                  step={activeBrushPage.step}
                  value={sliderBrushValue}
                  onChange={(e) => onChangeBrushRadius(Number(e.target.value))}
                  className="w-16 h-1 accent-emerald-400 cursor-pointer"
                />
                <div className="hidden xl:flex items-center gap-0.5">
                  {activeBrushPage.presets.map((rVal) => (
                    <button
                      key={rVal}
                      type="button"
                      data-testid={`brush-preset-${rVal}m`}
                      onClick={() => onChangeBrushRadius(rVal)}
                      className={`px-1 py-0.5 rounded text-[9px] font-mono cursor-pointer ${
                        brushRadius === rVal
                          ? 'bg-emerald-400 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-300 hover:text-white'
                      }`}
                    >
                      {rVal >= 1000 ? `${rVal / 1000}km` : `${rVal}m`}
                    </button>
                  ))}
                </div>

                {activeTab === 'sculpt' && (
                  <div className="flex items-center gap-1 pl-1 border-l border-slate-700">
                    <span className="text-[10px] text-slate-300">Cao:</span>
                    <input
                      aria-label="Biên độ đắp địa hình"
                      type="range"
                      min={1}
                      max={250}
                      step={1}
                      value={brushStrength}
                      onChange={(e) => onChangeBrushStrength(Number(e.target.value))}
                      className="w-14 h-1 accent-amber-400 cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-amber-300">+{brushStrength}m</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'prefabs' && (
              <div className="flex items-center gap-2 bg-[#162032] px-2.5 py-1 rounded-lg border border-slate-800 shrink-0">
                <div className="flex items-center gap-1">
                  {(
                    [
                      { id: 'all', label: 'Tất cả' },
                      { id: 'house', label: 'Nhà' },
                      { id: 'mountain', label: 'Núi' },
                      { id: 'tree', label: 'Cây' },
                      { id: 'landmark', label: 'Cầu' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => onChangePrefabCategoryFilter(cat.id)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                        prefabCategoryFilter === cat.id
                          ? 'bg-cyan-400 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <RotateCw className="w-3 h-3 text-amber-400" />
                  <input
                    aria-label="Hướng đặt công trình"
                    type="range"
                    min={0}
                    max={360}
                    step={15}
                    value={selectedObjDeg}
                    onChange={(e) => {
                      const deg = Number(e.target.value);
                      onChangePlacementRotationDeg(deg);
                      if (selectedObject) onSetSelectedObjectRotationDeg(deg);
                    }}
                    className="w-14 h-1 accent-amber-400 cursor-pointer"
                  />
                  <span
                    data-testid="prefab-rotation-readout"
                    className="font-mono text-[10px] text-amber-300 w-7"
                  >
                    {selectedObjDeg}°
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Maximize2 className="w-3 h-3 text-cyan-400" />
                  <input
                    aria-label="Kích thước đặt công trình"
                    type="range"
                    min={0.3}
                    max={3.0}
                    step={0.05}
                    value={selectedObjScale}
                    onChange={(e) => {
                      const sc = Number(e.target.value);
                      onChangePlacementScale(sc);
                      if (selectedObject) onSetSelectedObjectScale(sc);
                    }}
                    className="w-14 h-1 accent-cyan-400 cursor-pointer"
                  />
                  <span
                    data-testid="prefab-scale-readout"
                    className="font-mono text-[10px] text-cyan-300 w-8"
                  >
                    {selectedObjScale.toFixed(1)}x
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onSpawnPrefabAtCenter(selectedPrefab)}
                  className="px-2.5 py-0.5 rounded-md bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  <PlusCircle className="w-3 h-3" />
                  Đặt 1:1
                </button>
              </div>
            )}

            {activeTab === 'atmosphere' && (
              <div
                data-testid="weather-and-atmosphere-bar"
                className="flex items-center gap-2 bg-[#162032] px-2.5 py-1 rounded-lg border border-pink-500/40 shrink-0 text-[11px] max-w-[54vw]"
              >
                <span className="text-pink-200 font-semibold whitespace-nowrap shrink-0">
                  Thời tiết (13):
                </span>
                <div className="flex items-center gap-1 pr-2 border-r border-slate-700/80 overflow-x-auto no-scrollbar max-w-[270px] xl:max-w-[350px]">
                  {WEATHER_CATALOG.map((w) => {
                    const active = activeWeather === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        data-testid={`weather-btn-${w.id}`}
                        title={w.subtitle}
                        onClick={() => onSelectWeather(w.id)}
                        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1 ${
                          active
                            ? 'bg-pink-400 text-slate-950 font-bold'
                            : 'bg-[#0b111c] border border-slate-700 text-slate-300 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: w.badgeColor }}
                        />
                        <span>{w.shortName}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-300">Cao nắng:</span>
                  <input
                    id="sun-angle-slider"
                    data-testid="sun-elevation-slider"
                    type="range"
                    min={-55}
                    max={80}
                    step={1}
                    value={Math.round(sunElevation)}
                    onChange={(e) => onChangeSunElevation(Number(e.target.value))}
                    className="w-12 h-1 accent-amber-400 cursor-pointer"
                  />
                  <span className="font-mono text-amber-300 text-[10px]">
                    {Math.round(sunElevation)}°
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-300">Mực nước:</span>
                  <input
                    id="water-level-slider"
                    type="range"
                    min={-150}
                    max={150}
                    step={5}
                    value={waterLevel}
                    onChange={(e) => onChangeWaterLevel(Number(e.target.value))}
                    className="w-12 h-1 accent-cyan-400 cursor-pointer"
                  />
                  <span className="font-mono text-cyan-300 text-[10px]">{waterLevel}m</span>
                </div>
              </div>
            )}
          </div>

          {/* ROW 3A (Atmosphere Mode): Day/Night Cycle (00:00–24:00), Sun Azimuth Shadows (0°–360°), Presets & Starlight Mode */}
          {activeTab === 'atmosphere' && (
            <div
              data-testid="day-night-cycle-bar"
              className="flex flex-nowrap items-center justify-between gap-2 px-2 py-0.5 rounded-lg bg-[#0b111c] border border-indigo-500/40 overflow-x-auto no-scrollbar text-[10px]"
            >
              {/* 1. Time of Day Slider + Auto Day/Night Cycle Play/Pause */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Sun className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-slate-300 font-medium whitespace-nowrap">
                  Chu kỳ Ngày/Đêm:
                </span>
                <input
                  id="time-of-day-slider"
                  data-testid="time-of-day-slider"
                  aria-label="Chu kỳ ngày đêm từ 0h đến 24h"
                  type="range"
                  min={0}
                  max={24}
                  step={0.25}
                  value={timeOfDay}
                  onChange={(e) => onChangeTimeOfDay?.(Number(e.target.value))}
                  className="w-20 h-1 accent-amber-400 cursor-pointer"
                />
                <span
                  data-testid="time-of-day-readout"
                  className="font-mono font-bold text-amber-300 tabular-nums w-10"
                >
                  {formatTimeOfDayClock(timeOfDay)}
                </span>
                <button
                  type="button"
                  data-testid="toggle-day-night-auto"
                  onClick={onToggleDayNightAuto}
                  title="Tự động xoay chu kỳ ngày đêm thời gian thực"
                  className={`px-1.5 py-0.5 rounded border flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                    isDayNightAuto
                      ? 'bg-amber-400 text-slate-950 border-amber-300 font-bold'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {isDayNightAuto ? (
                    <Pause className="w-2.5 h-2.5" />
                  ) : (
                    <Play className="w-2.5 h-2.5" />
                  )}
                  <span>{isDayNightAuto ? 'Đang chạy' : 'Tự động'}</span>
                </button>
              </div>

              {/* 2. Sun Azimuth Direction (0°–360°) for Real-Time Directional Shadows */}
              <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-slate-800">
                <RotateCw className="w-3 h-3 text-cyan-400 shrink-0" />
                <span className="text-slate-300 whitespace-nowrap">Hướng Mặt Trời (Bóng đổ):</span>
                <input
                  id="sun-azimuth-slider"
                  data-testid="sun-azimuth-slider"
                  aria-label="Hướng mặt trời tạo bóng đổ từ 0 đến 360 độ"
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={Math.round(sunAzimuth)}
                  onChange={(e) => onChangeSunAzimuth?.(Number(e.target.value))}
                  className="w-20 h-1 accent-cyan-400 cursor-pointer"
                />
                <span
                  data-testid="sun-azimuth-readout"
                  className="font-mono font-bold text-cyan-300 tabular-nums w-8"
                >
                  {Math.round(sunAzimuth)}°
                </span>
              </div>

              {/* 3. Quick Day/Night Presets */}
              <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-slate-800">
                {DAY_NIGHT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    data-testid={`day-night-preset-${preset.id}`}
                    onClick={() => onApplyDayNightPreset?.(preset.id)}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 whitespace-nowrap cursor-pointer"
                  >
                    {preset.shortLabel}
                  </button>
                ))}
              </div>

              {/* 4. Nocturnal Starlight Mode Toggle ("Chế Độ Ánh Sao Ban Đêm") */}
              <div className="flex items-center gap-1 shrink-0 pl-2 border-l border-slate-800">
                <button
                  type="button"
                  data-testid="toggle-starlight-mode"
                  onClick={onToggleStarlightMode}
                  className={`px-2 py-0.5 rounded-md border flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                    starlightMode
                      ? 'bg-indigo-500 text-white border-indigo-300 font-bold shadow-sm'
                      : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-200 hover:bg-indigo-900/70'
                  }`}
                >
                  <Moon className="w-3 h-3 text-indigo-200" />
                  <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                  <span>{starlightMode ? '★ Ánh Sao Đêm: BẬT' : 'Chế Độ Ánh Sao Đêm'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ROW 3B (Only in Paint Mode, ultra-slim 24px bar): Grass 3-5cm + Flower Species + Flower Colors + Fill Map */}
          {activeTab === 'paint' && (
            <div
              data-testid="surface-ecosystem-bar"
              className="flex flex-nowrap items-center justify-between gap-2 px-2 py-0.5 rounded-lg bg-[#0b111c] border border-slate-800/80 overflow-x-auto no-scrollbar text-[10px]"
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <Sprout className="w-3 h-3 text-emerald-400" />
                <span className="text-slate-300">Cỏ (3–5cm):</span>
                <input
                  id="grass-height-cm-slider"
                  data-testid="grass-height-slider"
                  type="range"
                  min={MIN_GRASS_HEIGHT_CM}
                  max={MAX_GRASS_HEIGHT_CM}
                  step={0.1}
                  value={grassHeightCm}
                  onChange={(e) => onChangeGrassHeightCm(Number(e.target.value))}
                  className="w-16 h-1 accent-emerald-400 cursor-pointer"
                />
                <span
                  data-testid="grass-height-cm-readout"
                  className="font-mono font-bold text-emerald-300 tabular-nums"
                >
                  {grassHeightCm.toFixed(1)} cm
                </span>
              </div>

              <div
                data-testid="flower-species-selector"
                className="flex items-center gap-1 shrink-0"
              >
                <Flower2 className="w-3 h-3 text-pink-400" />
                <span className="text-slate-300">Hoa:</span>
                {FLOWER_SPECIES_CATALOG.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    data-testid={`flower-species-${sp.id}`}
                    onClick={() => {
                      onChangeFlowerSpecies(sp.id);
                      onSelectTextureBrush('flower_meadow');
                    }}
                    className={`px-1.5 py-0.2 rounded text-[10px] whitespace-nowrap cursor-pointer ${
                      flowerSpecies === sp.id
                        ? 'bg-pink-400 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    {sp.shortName}
                  </button>
                ))}
              </div>

              <div
                data-testid="flower-color-selector"
                className="flex items-center gap-1 shrink-0"
              >
                <span className="text-slate-300">Màu:</span>
                {FLOWER_COLOR_PALETTE.map((col) => (
                  <button
                    key={col.id}
                    type="button"
                    title={col.name}
                    aria-label={`Chọn màu hoa ${col.name}`}
                    data-testid={`flower-color-${col.id}`}
                    onClick={() => {
                      onChangeFlowerColorHex(col.hex);
                      onSelectTextureBrush('flower_meadow');
                    }}
                    style={{ backgroundColor: col.hex }}
                    className={`w-3.5 h-3.5 rounded-full cursor-pointer ${
                      flowerColorHex.toLowerCase() === col.hex.toLowerCase()
                        ? 'ring-2 ring-white scale-110'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={onToggleCarveTerrainOnPaint}
                  className={`px-1.5 py-0.2 rounded border text-[10px] cursor-pointer whitespace-nowrap ${
                    carveTerrainOnPaint
                      ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                >
                  {carveTerrainOnPaint ? '✓ Tự Đào Sông/Hồ' : 'Chỉ Tô'}
                </button>
                <button
                  type="button"
                  onClick={() => onFillEntireTerrainTexture(textureBrush)}
                  className="px-2 py-0.2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-semibold whitespace-nowrap cursor-pointer"
                >
                  Phủ Toàn Bản Đồ
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export const BottomControlDock = React.memo(BottomControlDockComponent);
