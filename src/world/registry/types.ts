export type BiomeId =
  | 'mondstadt_meadow'
  | 'inazuma_sakura'
  | 'liyue_amber'
  | 'paldea_coast'
  | 'snowpeak_glacier'
  | 'celestia_sky_isles'
  | 'natlan_volcano_abyss'
  | 'himalaya_alps_andes'
  | 'sahara_atacama_gobi'
  | 'hawaii_shield_volcano'
  | 'amazon_congo_rainforest'
  | 'boreal_taiga_forest'
  | 'mars_olympus'
  | 'venus_ishtar'
  | 'kepler_crystalline'
  | 'trappist_tidally_locked'
  | 'pluto_cryovolcano'
  | 'titan_methane_sea'
  | 'europa_chaos_ridge'
  | 'corot_lava_ocean';

export type WeatherId =
  | 'clear_sky'
  | 'himalaya_blizzard'
  | 'tropical_monsoon_rain'
  | 'mars_dust_storm'
  | 'supersonic_mars_storm'
  | 'venus_acid_rain'
  | 'concentrated_venus_acid'
  | 'liquid_nitrogen_snow'
  | 'cryo_geyser_blizzard'
  | 'molten_silicate_rain'
  | 'exoplanet_meteor_shower'
  | 'ion_aurora_tempest'
  | 'ash_ember_fall';

export interface WeatherConfig {
  id: WeatherId;
  name: string;
  shortName: string;
  planetOrigin: string;
  subtitle: string;
  badgeColor: string;
  fogOverrideHex?: string;
  particleColorHex: string;
  secondaryColorHex: string;
}

export type SculptToolId =
  | 'raise'
  | 'lower'
  | 'sheer_cliff'
  | 'volcano_crater'
  | 'alpine_horn_glacier'
  | 'barchan_dune_saltflat'
  | 'meander_river_delta'
  | 'cryo_volcano'
  | 'methane_basin'
  | 'abyss_chasm'
  | 'canyon_gorge'
  | 'meteor_crater'
  | 'shield_mesa'
  | 'flatten'
  | 'smooth'
  | 'terrace'
  | 'ridge';

export type TextureBrushId =
  | 'earth_soil'
  | 'emerald_grass'
  | 'flower_meadow'
  | 'desert_sand'
  | 'atacama_salt_crust'
  | 'tropical_rainforest_floor'
  | 'taiga_moss_needles'
  | 'volcanic_lava'
  | 'river_stream'
  | 'lake_water'
  | 'dirt_cobble_road'
  | 'limestone_cliff'
  | 'glacier_snow'
  | 'mars_regolith'
  | 'venus_sulfur'
  | 'exoplanet_basalt'
  | 'pluto_nitrogen_ice'
  | 'titan_methane_liquid';

export type PrefabCategory = 'house' | 'mountain' | 'tree' | 'landmark';

export type PrefabId =
  | 'himalaya_matterhorn_peak'
  | 'himalaya_fishtail_peak'
  | 'mars_olympus_shield'
  | 'titan_mithrim_montes'
  | 'island_volcano_icon'
  | 'sahara_atacama_oasis'
  | 'hawaii_kilauea_shield'
  | 'amazon_congo_canopy_tree'
  | 'taiga_spruce_grove'
  | 'pluto_cryo_volcano'
  | 'titan_methane_geyser'
  | 'europa_penitentes_spire'
  | 'floating_sky_island'
  | 'sheer_cliff_wall'
  | 'active_volcano'
  | 'abyss_chasm_vortex'
  | 'statue_of_seven'
  | 'pokemon_gym_stadium'
  | 'berry_apricorn_tree'
  | 'venus_pancake_dome'
  | 'meteor_impact_crater'
  | 'exoplanet_crystal_spire'
  | 'windmill_cottage'
  | 'sakura_shrine'
  | 'pokemon_center'
  | 'karst_mountain'
  | 'volcanic_peak'
  | 'sakura_tree'
  | 'emerald_pine'
  | 'aether_crystal'
  | 'ancient_bridge';

export interface PlacedObject {
  id: string;
  prefabId: PrefabId;
  label: string;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotationY: number;
}

export interface BiomeConfig {
  id: BiomeId;
  name: string;
  subtitle: string;
  inspiration: string;
  skyTopHex: string;
  skyHorizonHex: string;
  fogHex: string;
  sunHex: string;
  hemiSkyHex: string;
  hemiGroundHex: string;
  waterHex: string;
  waterDeepHex: string;
  defaultTexture: TextureBrushId;
  defaultWeather?: WeatherId;
  waterLevel: number;
  reliefScale: number;
  roughness: number;
}

export interface TextureBrushConfig {
  id: TextureBrushId;
  name: string;
  subtitle: string;
  primaryRgb: [number, number, number]; // 0..1 sRGB values
  secondaryRgb: [number, number, number];
  swatchHex: string;
  roughness: number;
  hydroOrTerrainEffect?: 'river' | 'lake' | 'road' | 'lava' | 'none';
}

export interface PrefabMetadata {
  id: PrefabId;
  name: string;
  category: PrefabCategory;
  inspiration: string;
  partsCount: number;
  defaultScale: number;
  realDimensions: string;
  realHeightMeters: number;
  badgeColor: string;
}


export interface BrushScalePage {
  id: string;
  pageNumber: number;
  label: string;
  shortLabel: string;
  subtitle: string;
  minRadius: number;
  maxRadius: number;
  step: number;
  defaultRadius: number;
  presets: number[];
}


export type FlowerSpeciesId =
  | 'cecilia_star'
  | 'sakura_bloom'
  | 'sun_daisy'
  | 'lotus_waterlily'
  | 'tulip_cup';

export interface FlowerSpeciesConfig {
  id: FlowerSpeciesId;
  name: string;
  shortName: string;
  petalCount: number;
  petalShape: 'pointed' | 'rounded' | 'ray' | 'double_cup' | 'bell';
  defaultColorHex: string;
  coreColorHex: string;
}


export interface FlowerColorOption {
  id: string;
  name: string;
  hex: string;
}


export interface MicroStrokeStamp {
  id: string;
  x: number;
  z: number;
  radius: number;
  brushId: TextureBrushId;
  grassHeightCm?: number; // 3.0 to 5.0 cm real grass blade height
  flowerSpecies?: FlowerSpeciesId;
  flowerColorHex?: string;
}


export type RuleOperator = '>' | '<' | 'between';

export interface TerrainRule {
  id: string;
  name: string;
  enabled: boolean;
  operator: RuleOperator;
  thresholdMeters: number;
  maxThresholdMeters?: number;
  targetPrefabId: PrefabId;
  targetTextureId?: TextureBrushId | 'none';
  maxObjectsToPlace: number;
  minSpacingMeters: number;
  scale: number;
}

export interface TerrainRuleExecutionResult {
  newObjects: PlacedObject[];
  addedObjects: PlacedObject[];
  addedCount: number;
  paintedVerticesCount: number;
  sculptedVerticesCount: number;
  matchedRulesCount: number;
  summary: string;
}


export type DayPhaseId = 'dawn' | 'day' | 'dusk' | 'night';

export interface DayNightPreset {
  id: string;
  label: string;
  shortLabel: string;
  timeOfDayHours: number;
  sunElevationDeg: number;
  sunAzimuthDeg: number;
  starlightMode: boolean;
}

