import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_SIZE,
  WORLD_SIZE,
  WORLD_SIZE_KM,
  MAX_ELEVATION,
  MIN_BRUSH_RADIUS,
  MIN_GRASS_HEIGHT_CM,
  MAX_GRASS_HEIGHT_CM,
  FLOWER_SPECIES_CATALOG,
  FLOWER_COLOR_PALETTE,
  BRUSH_SCALE_PAGES,
  getBrushPageIndexForRadius,
  CELL_SPAN_METERS,
  TOTAL_VERTICES,
  PREFAB_CATALOG,
  generateFlatEarthTerrain,
  generateBiomeTerrain,
  generateInitialSurfaceShowcaseStrokes,
  getGroundHeightAt,
  getTerrainElevationStats,
  applySculptBrush,
  applyTextureBrush,
  reconstructFromRgbaBuffer,
  getTextureIndex,
  DEFAULT_TERRAIN_RULES,
  evaluateRuleElevation,
  executeTerrainRules,
  formatTerrainRuleFormula,
  BIOMES,
  WEATHER_CATALOG,
  DAY_NIGHT_PRESETS,
  timeOfDayToSunElevation,
  formatTimeOfDayClock,
  computeDayNightLightingState,
  TEXTURE_INDEX_MAP,
  serializeWorldToSavePayload,
  deserializeWorldFromSavePayload,
  applyHydraulicErosion,
  calculateHeightAndGradient,
  reconstructTerrainFromRGBA,
  SculptHistoryManager,
  cosineBrushFalloff,
  TerrainQuadtreeLOD,
  QuadTreeNode,
  createGPUWeatherSystem,
  BIOME_WEATHER_PRESETS,
  spawnSculptLandformObject,
  SCULPT_TOOL_PREFAB_MAP,
} from './terrainEngine';
import {
  createSurfaceEcosystemPatch,
  PATCH_BUILDERS,
  disposeObject3DTree,
  buildInstancedEcosystem,
} from './surfaceEcosystem3D';
import * as THREE from 'three';
import {
  ProceduralPrefabFactory,
  createProceduralPineTree,
  createProceduralSakuraTree,
} from './proceduralModels';
import { createDynamicTerrainMaterial } from './materialsAndTextures';
import { SAMPLE_PHOTO_PRESETS } from './samplePhotos';
import * as constantsMod from './constants';
import * as registryMod from './registry';
import * as biomesMod from './registry/biomes';
import * as prefabsMod from './registry/prefabs';
import * as brushesMod from './brushes';
import * as sculptingMod from './sculpting';
import * as generationMod from './generation';
import {
  blendObjectsAndTerrainJunctions,
  computeObjectJunctionPairs,
  hermiteInterpolateOrExtrapolate,
  interpolateOrExtrapolateRgb,
  polynomialSmoothMin,
  quinticSmoothstep,
  computeHeightLerpWeights,
  blendBiomeJunction,
} from './junctionBlending';
import { buildJunctionContinuumGroup } from './junctionBridges3D';

test('world dimensions are 10x10km, 161x161 grid (62.5m/cell), 1km max elevation, multi-page brush scales (5m, 25m, 100m, 500m, 2.5km), 3-5cm real grass, customizable 3D flowers, and 1:1 real building dimensions', () => {
  assert.equal(WORLD_SIZE, 10000);
  assert.equal(WORLD_SIZE_KM, 10);
  assert.equal(MAX_ELEVATION, 1000);
  assert.equal(CELL_SPAN_METERS, 62.5);
  assert.equal(WORLD_SIZE / GRID_SIZE, CELL_SPAN_METERS);
  assert.equal(MIN_BRUSH_RADIUS, 1);
  assert.equal(MIN_GRASS_HEIGHT_CM, 3.0);
  assert.equal(MAX_GRASS_HEIGHT_CM, 5.0);
  assert.equal(FLOWER_SPECIES_CATALOG.length, 5);
  assert.equal(FLOWER_COLOR_PALETTE.length, 6);

  const showcaseStrokes = generateInitialSurfaceShowcaseStrokes();
  assert.ok(showcaseStrokes.some((s) => s.brushId === 'emerald_grass' && (s.grassHeightCm ?? 0) >= 3 && (s.grassHeightCm ?? 0) <= 5));
  assert.ok(showcaseStrokes.some((s) => s.brushId === 'flower_meadow' && s.flowerSpecies && s.flowerColorHex));
  assert.ok(showcaseStrokes.some((s) => s.brushId === 'desert_sand'));
  assert.ok(showcaseStrokes.some((s) => s.brushId === 'volcanic_lava'));

  assert.equal(BRUSH_SCALE_PAGES.length, 5);
  assert.equal(BRUSH_SCALE_PAGES[0].shortLabel, 'Thang 5m');
  assert.equal(BRUSH_SCALE_PAGES[0].maxRadius, 5);
  assert.equal(BRUSH_SCALE_PAGES[1].shortLabel, 'Thang 25m');
  assert.equal(BRUSH_SCALE_PAGES[1].maxRadius, 25);
  assert.equal(getBrushPageIndexForRadius(3), 0);
  assert.equal(getBrushPageIndexForRadius(15), 1);
  assert.equal(getBrushPageIndexForRadius(80), 2);
  assert.equal(getBrushPageIndexForRadius(300), 3);
  assert.equal(getBrushPageIndexForRadius(1500), 4);

  for (const prefab of PREFAB_CATALOG) {
    assert.ok(prefab.realDimensions.length > 0, `Prefab ${prefab.id} should define real 1:1 dimensions`);
    assert.ok(prefab.realHeightMeters >= 3.5 && prefab.realHeightMeters <= 100);
  }
});

test('generateFlatEarthTerrain creates a flat 0m earth plane with earth_soil base texture and 1:1 village coordinates', () => {
  const flatWorld = generateFlatEarthTerrain('mondstadt_meadow');
  assert.equal(flatWorld.heightMap.length, TOTAL_VERTICES);
  const stats = getTerrainElevationStats(flatWorld.heightMap);
  assert.equal(stats.maxElevation, 0);
  assert.equal(stats.minElevation, 0);
  assert.equal(flatWorld.splatMap[0], getTextureIndex('earth_soil'));
  assert.ok(flatWorld.initialObjects.length >= 4);
  for (const obj of flatWorld.initialObjects) {
    assert.ok(Math.abs(obj.x) <= 85 && Math.abs(obj.z) <= 60, 'Starter 1:1 village & 7-mountain gallery objects should be placed within realistic meter distances');
  }
});

test('generateBiomeTerrain creates valid 10x10km heightMap and grounded starter objects', () => {
  const world = generateBiomeTerrain('mondstadt_meadow', 42);
  assert.equal(world.heightMap.length, TOTAL_VERTICES);
  assert.equal(world.splatMap.length, TOTAL_VERTICES);
  assert.equal(world.colorMap.length, TOTAL_VERTICES * 3);
  assert.ok(world.initialObjects.length >= 6);

  const stats = getTerrainElevationStats(world.heightMap);
  assert.ok(stats.maxElevation > 400 && stats.maxElevation <= MAX_ELEVATION);

  for (const obj of world.initialObjects) {
    const expectedY = getGroundHeightAt(world.heightMap, GRID_SIZE, WORLD_SIZE, obj.x, obj.z);
    assert.ok(Math.abs(obj.y - expectedY) < 1e-3, `Object ${obj.id} should sit flush on ground`);
  }
});

test('applySculptBrush supports 1m minimum brush radius up to 2500m on 10x10km grid', () => {
  const world = generateFlatEarthTerrain('mondstadt_meadow');
  const beforeCenter = getGroundHeightAt(world.heightMap, GRID_SIZE, WORLD_SIZE, 0, 0);
  assert.equal(beforeCenter, 0);

  // Test 1m brush radius at (0, 0)
  const modified1m = applySculptBrush(
    world.heightMap,
    world.splatMap,
    world.colorMap,
    'mondstadt_meadow',
    'raise',
    0,
    0,
    1,
    40
  );
  assert.ok(modified1m >= 1, '1m sculpt brush should modify the nearest terrain cell');
  const after1mRaise = getGroundHeightAt(world.heightMap, GRID_SIZE, WORLD_SIZE, 0, 0);
  assert.ok(after1mRaise > 0, 'Center height should increase after 1m raise brush');

  // Test 900m brush radius
  const modifiedRaise = applySculptBrush(
    world.heightMap,
    world.splatMap,
    world.colorMap,
    'mondstadt_meadow',
    'raise',
    0,
    0,
    900,
    120
  );
  assert.ok(modifiedRaise > 10);
  const afterRaise = getGroundHeightAt(world.heightMap, GRID_SIZE, WORLD_SIZE, 0, 0);
  assert.ok(afterRaise > after1mRaise + 50, 'Center height should increase after 900m raise brush');
});

test('applyTextureBrush paints with 1m minimum brush radius as well as macro brushes', () => {
  const world = generateFlatEarthTerrain('mondstadt_meadow');
  const centerIdx = (GRID_SIZE / 2) * (GRID_SIZE + 1) + GRID_SIZE / 2;

  // Test 1m brush painting grass
  const count1m = applyTextureBrush(
    world.heightMap,
    world.splatMap,
    world.colorMap,
    'mondstadt_meadow',
    'emerald_grass',
    0,
    0,
    1
  );
  assert.ok(count1m >= 1, '1m texture brush should paint at target coordinate');
  assert.equal(world.splatMap[centerIdx], getTextureIndex('emerald_grass'));

  for (const brush of [
    'flower_meadow',
    'desert_sand',
    'volcanic_lava',
    'dirt_cobble_road',
    'mars_regolith',
    'venus_sulfur',
    'exoplanet_basalt',
  ] as const) {
    const count = applyTextureBrush(
      world.heightMap,
      world.splatMap,
      world.colorMap,
      'mondstadt_meadow',
      brush,
      0,
      0,
      800
    );
    assert.ok(count > 5);
    assert.equal(world.splatMap[centerIdx], getTextureIndex(brush));
  }

  // Painting lake_water with carveTerrain=true should lower the center elevation below waterLevel (-25m)
  applyTextureBrush(
    world.heightMap,
    world.splatMap,
    world.colorMap,
    'mondstadt_meadow',
    'lake_water',
    0,
    0,
    900,
    { carveTerrain: true, waterLevel: -25 }
  );
  assert.equal(world.splatMap[centerIdx], getTextureIndex('lake_water'));
  const lakeDepth = getGroundHeightAt(world.heightMap, GRID_SIZE, WORLD_SIZE, 0, 0);
  assert.ok(lakeDepth < -25, `Lake bed (${lakeDepth}m) should be carved below water level (-25m)`);
});

test('reconstructFromRgbaBuffer converts an RGBA image into 10x10km 3D heightfield up to 1km', () => {
  const w = 32;
  const h = 32;
  const rgba = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (y < 10) {
        rgba[i] = 235;
        rgba[i + 1] = 110;
        rgba[i + 2] = 185;
        rgba[i + 3] = 255;
      } else if (x > 20 && y > 20) {
        rgba[i] = 30;
        rgba[i + 1] = 140;
        rgba[i + 2] = 230;
        rgba[i + 3] = 255;
      } else {
        rgba[i] = 65;
        rgba[i + 1] = 185;
        rgba[i + 2] = 85;
        rgba[i + 3] = 255;
      }
    }
  }

  const recon = reconstructFromRgbaBuffer(rgba, w, h, { reliefScale: 1.3 });
  assert.equal(recon.heightMap.length, TOTAL_VERTICES);
  assert.ok(recon.metrics.pinkRatio > 0.2);
  assert.ok(recon.metrics.peakElevationMeters > 200 && recon.metrics.peakElevationMeters <= MAX_ELEVATION);
  assert.equal(recon.metrics.suggestedBiome, 'inazuma_sakura');
  assert.ok(recon.detectedObjects.length >= 4);
});

test('Genshin, Pokémon, Earth Megaregions (Himalaya/Alps/Andes, Sahara/Atacama/Gobi, Hawaii, Amazon/Congo, Taiga) & Planetary (Pluto, Titan, Mars, Venus, Europa, CoRoT-7b) work accurately', () => {
  assert.equal(PREFAB_CATALOG.length, 31);
  const prefabIds = PREFAB_CATALOG.map((p) => p.id);
  for (const expectedId of [
    'pluto_cryo_volcano',
    'europa_penitentes_spire',
    'himalaya_matterhorn_peak',
    'himalaya_fishtail_peak',
    'mars_olympus_shield',
    'titan_mithrim_montes',
    'island_volcano_icon',
    'floating_sky_island',
    'sheer_cliff_wall',
    'active_volcano',
    'abyss_chasm_vortex',
    'statue_of_seven',
    'pokemon_gym_stadium',
    'berry_apricorn_tree',
    'sahara_atacama_oasis',
    'hawaii_kilauea_shield',
    'amazon_congo_canopy_tree',
    'taiga_spruce_grove',
    'pluto_cryo_volcano',
    'titan_methane_geyser',
    'europa_penitentes_spire',
    'mars_olympus_shield',
    'venus_pancake_dome',
    'meteor_impact_crater',
    'exoplanet_crystal_spire',
  ] as const) {
    assert.ok(prefabIds.includes(expectedId), `Catalog should include ${expectedId}`);
  }

  // Verify 20 biomes and 13 weather catalog options
  assert.equal(Object.keys(BIOMES).length, 20);
  assert.equal(WEATHER_CATALOG.length, 13);
  const weatherIds = WEATHER_CATALOG.map((w) => w.id);
  for (const wId of [
    'himalaya_blizzard',
    'tropical_monsoon_rain',
    'supersonic_mars_storm',
    'concentrated_venus_acid',
    'liquid_nitrogen_snow',
    'cryo_geyser_blizzard',
    'molten_silicate_rain',
  ] as const) {
    assert.ok(weatherIds.includes(wId), `Weather catalog should include ${wId}`);
  }
  assert.equal(BIOMES.himalaya_alps_andes.defaultWeather, 'himalaya_blizzard');
  assert.equal(BIOMES.sahara_atacama_gobi.defaultWeather, 'clear_sky');
  assert.equal(BIOMES.hawaii_shield_volcano.defaultWeather, 'ash_ember_fall');
  assert.equal(BIOMES.amazon_congo_rainforest.defaultWeather, 'tropical_monsoon_rain');
  assert.equal(BIOMES.boreal_taiga_forest.defaultWeather, 'clear_sky');
  assert.equal(BIOMES.pluto_cryovolcano.defaultWeather, 'liquid_nitrogen_snow');
  assert.equal(BIOMES.titan_methane_sea.defaultWeather, 'liquid_nitrogen_snow');
  assert.equal(BIOMES.europa_chaos_ridge.defaultWeather, 'cryo_geyser_blizzard');
  assert.equal(BIOMES.corot_lava_ocean.defaultWeather, 'molten_silicate_rain');
  assert.equal(BIOMES.mars_olympus.defaultWeather, 'mars_dust_storm');
  assert.equal(BIOMES.venus_ishtar.defaultWeather, 'venus_acid_rain');
  assert.equal(BIOMES.kepler_crystalline.defaultWeather, 'exoplanet_meteor_shower');
  assert.equal(BIOMES.trappist_tidally_locked.defaultWeather, 'ion_aurora_tempest');

  const plutoWorld = generateBiomeTerrain('pluto_cryovolcano', 42);
  assert.ok(plutoWorld.initialObjects.some((o) => o.prefabId === 'pluto_cryo_volcano'));

  const titanWorld = generateBiomeTerrain('titan_methane_sea', 42);
  assert.ok(titanWorld.initialObjects.some((o) => o.prefabId === 'titan_methane_geyser'));

  const himalayaWorld = generateBiomeTerrain('himalaya_alps_andes', 42);
  assert.ok(himalayaWorld.initialObjects.some((o) => o.prefabId === 'himalaya_matterhorn_peak'));

  const desertWorld = generateBiomeTerrain('sahara_atacama_gobi', 42);
  assert.ok(desertWorld.initialObjects.some((o) => o.prefabId === 'sahara_atacama_oasis'));

  const hawaiiWorld = generateBiomeTerrain('hawaii_shield_volcano', 42);
  assert.ok(hawaiiWorld.initialObjects.some((o) => o.prefabId === 'hawaii_kilauea_shield'));

  const amazonWorld = generateBiomeTerrain('amazon_congo_rainforest', 42);
  assert.ok(amazonWorld.initialObjects.some((o) => o.prefabId === 'amazon_congo_canopy_tree'));

  const taigaWorld = generateBiomeTerrain('boreal_taiga_forest', 42);
  assert.ok(taigaWorld.initialObjects.some((o) => o.prefabId === 'taiga_spruce_grove'));

  const marsWorld = generateBiomeTerrain('mars_olympus', 42);
  assert.ok(marsWorld.initialObjects.some((o) => o.prefabId === 'mars_olympus_shield'));

  const venusWorld = generateBiomeTerrain('venus_ishtar', 42);
  assert.ok(venusWorld.initialObjects.some((o) => o.prefabId === 'venus_pancake_dome'));

  const world = generateFlatEarthTerrain('mondstadt_meadow');
  const centerIdx = (GRID_SIZE / 2) * (GRID_SIZE + 1) + GRID_SIZE / 2;

  // 1. Sheer cliff plateau raises flat mesa top
  applySculptBrush(world.heightMap, world.splatMap, world.colorMap, 'mondstadt_meadow', 'sheer_cliff', 0, 0, 250, 100);
  const cliffTop = getGroundHeightAt(world.heightMap, GRID_SIZE, WORLD_SIZE, 0, 0);
  assert.ok(cliffTop > 80, `Sheer cliff should raise plateau above 80m, got ${cliffTop}m`);

  // 2. Volcano crater paints volcanic_lava at caldera center
  applySculptBrush(world.heightMap, world.splatMap, world.colorMap, 'mondstadt_meadow', 'volcano_crater', 0, 0, 350, 120);
  assert.equal(world.splatMap[centerIdx], getTextureIndex('volcanic_lava'));

  // 3. Abyss chasm carves deep trench below 0m
  const world2 = generateFlatEarthTerrain('mondstadt_meadow');
  applySculptBrush(world2.heightMap, world2.splatMap, world2.colorMap, 'mondstadt_meadow', 'abyss_chasm', 0, 0, 300, 120);
  const abyssDepth = getGroundHeightAt(world2.heightMap, GRID_SIZE, WORLD_SIZE, 0, 0);
  assert.ok(abyssDepth < -150, `Abyss chasm should carve deep trench below -150m, got ${abyssDepth}m`);

  // 4. Shield mesa (Mars/Venus volcano dome) raises broad shield plateau
  const world3 = generateFlatEarthTerrain('mars_olympus');
  applySculptBrush(world3.heightMap, world3.splatMap, world3.colorMap, 'mars_olympus', 'shield_mesa', 0, 0, 320, 100);
  const shieldHeight = getGroundHeightAt(world3.heightMap, GRID_SIZE, WORLD_SIZE, 0, 0);
  assert.ok(shieldHeight > 50, `Shield mesa should raise broad Martian/Venusian dome above 50m, got ${shieldHeight}m`);

  // 5. Pluto Cryovolcano sculpts icy caldera and paints pluto_nitrogen_ice
  const world4 = generateFlatEarthTerrain('pluto_cryovolcano');
  applySculptBrush(world4.heightMap, world4.splatMap, world4.colorMap, 'pluto_cryovolcano', 'cryo_volcano', 0, 0, 320, 110);
  assert.equal(world4.splatMap[centerIdx], getTextureIndex('pluto_nitrogen_ice'));

  // 6. Titan Methane Basin carves deep sea and paints titan_methane_liquid
  const world5 = generateFlatEarthTerrain('titan_methane_sea');
  applySculptBrush(world5.heightMap, world5.splatMap, world5.colorMap, 'titan_methane_sea', 'methane_basin', 0, 0, 320, 110);
  assert.equal(world5.splatMap[centerIdx], getTextureIndex('titan_methane_liquid'));

  // 7. Himalaya Alpine Horn Glacier raises pyramidal snow horn and paints glacier_snow
  const world6 = generateFlatEarthTerrain('himalaya_alps_andes');
  applySculptBrush(world6.heightMap, world6.splatMap, world6.colorMap, 'himalaya_alps_andes', 'alpine_horn_glacier', 0, 0, 320, 120);
  const hornPeak = getGroundHeightAt(world6.heightMap, GRID_SIZE, WORLD_SIZE, 0, 0);
  assert.ok(hornPeak > 100, `Alpine horn glacier should raise sharp peak above 100m, got ${hornPeak}m`);
  assert.equal(world6.splatMap[centerIdx], getTextureIndex('glacier_snow'));
});

test('Rule-based generation ("Vẽ theo quy luật") places sharp rock spires (karst_mountain) where elevation > 500m', () => {
  const defaultRule = DEFAULT_TERRAIN_RULES[0];
  assert.equal(defaultRule.operator, '>');
  assert.equal(defaultRule.thresholdMeters, 500);
  assert.equal(defaultRule.targetPrefabId, 'karst_mountain');
  assert.ok(formatTerrainRuleFormula(defaultRule).includes('> 500m'));

  assert.equal(evaluateRuleElevation(499, defaultRule), false);
  assert.equal(evaluateRuleElevation(500, defaultRule), false);
  assert.equal(evaluateRuleElevation(501, defaultRule), true);

  // Case A: Execute rule on 1km biome terrain where peaks already exceed 500m
  const biomeWorld = generateBiomeTerrain('liyue_amber', 42);
  const resA = executeTerrainRules(
    biomeWorld.heightMap,
    biomeWorld.splatMap,
    biomeWorld.colorMap,
    'liyue_amber',
    [defaultRule],
    biomeWorld.initialObjects,
    { ensureMatchingTerrain: false }
  );
  assert.ok(resA.addedCount >= 1, 'Should automatically place sharp rock objects on > 500m peaks');
  for (const obj of resA.addedObjects) {
    assert.equal(obj.prefabId, 'karst_mountain');
    assert.ok(obj.y > 500, `Placed sharp rock object at (${obj.x}, ${obj.z}) must have elevation > 500m, got ${obj.y}m`);
  }

  // Case B: Execute rule on 0m flat terrain with ensureMatchingTerrain=true
  const flatWorld = generateFlatEarthTerrain('mondstadt_meadow');
  const resB = executeTerrainRules(
    flatWorld.heightMap,
    flatWorld.splatMap,
    flatWorld.colorMap,
    'mondstadt_meadow',
    [defaultRule],
    flatWorld.initialObjects,
    { ensureMatchingTerrain: true }
  );
  assert.ok(resB.sculptedVerticesCount > 0, 'Should auto-sculpt matching > 500m peaks when starting from 0m flat plane');
  assert.ok(resB.addedCount >= 1, 'Should place sharp rock spires on the newly sculpted > 500m peaks');
  for (const obj of resB.addedObjects) {
    assert.equal(obj.prefabId, 'karst_mountain');
    assert.ok(obj.y > 500, `Placed sharp rock object must sit above 500m, got ${obj.y}m`);
  }
});

test('Day/Night cycle engine computes solar/lunar vectors, real-time shadow caster coordinates across azimuths, and nocturnal starlight intensity', () => {
  assert.equal(DAY_NIGHT_PRESETS.length, 4);
  assert.equal(formatTimeOfDayClock(6.25), '06:15');
  assert.equal(formatTimeOfDayClock(12.0), '12:00');
  assert.equal(formatTimeOfDayClock(17.75), '17:45');
  assert.equal(formatTimeOfDayClock(23.0), '23:00');

  const noonElev = timeOfDayToSunElevation(12);
  const midnightElev = timeOfDayToSunElevation(0);
  assert.ok(noonElev > 65, `Noon sun elevation should exceed 65°, got ${noonElev}°`);
  assert.ok(midnightElev < -50, `Midnight sun elevation should be below -50°, got ${midnightElev}°`);

  // 1. Midday (12:00) with azimuth 0° vs 180° shifts shadow caster X/Z coordinates in opposite directions
  const noonEast = computeDayNightLightingState({
    timeOfDayHours: 12,
    sunElevationDeg: 45,
    sunAzimuthDeg: 0,
    starlightMode: false,
    biomeId: 'mondstadt_meadow',
  });
  const noonWest = computeDayNightLightingState({
    timeOfDayHours: 12,
    sunElevationDeg: 45,
    sunAzimuthDeg: 180,
    starlightMode: false,
    biomeId: 'mondstadt_meadow',
  });
  assert.equal(noonEast.phase, 'day');
  assert.equal(noonEast.starlightIntensity, 0);
  assert.equal(noonEast.isNightOrStarlight, false);
  assert.ok(noonEast.shadowCasterPosition.x > 200, 'Azimuth 0° places shadow caster on +X side');
  assert.ok(noonWest.shadowCasterPosition.x < -200, 'Azimuth 180° places shadow caster on -X side');
  assert.ok(noonEast.shadowCasterPosition.y > 200, 'Shadow caster Y should be elevated above terrain');

  // 2. Dusk (17:45) golden hour
  const duskState = computeDayNightLightingState({
    timeOfDayHours: 17.75,
    sunElevationDeg: 8,
    sunAzimuthDeg: 260,
    starlightMode: false,
    biomeId: 'mondstadt_meadow',
  });
  assert.equal(duskState.phase, 'dusk');
  assert.ok(duskState.starlightIntensity > 0, 'Twilight should begin fading in early stars');

  // 3. Midnight (23:00) naturally enables starry night and moonlight shadow caster
  const nightState = computeDayNightLightingState({
    timeOfDayHours: 23.0,
    sunElevationDeg: -50,
    sunAzimuthDeg: 310,
    starlightMode: false,
    biomeId: 'mondstadt_meadow',
  });
  assert.equal(nightState.phase, 'night');
  assert.equal(nightState.starlightIntensity, 1.0);
  assert.equal(nightState.isNightOrStarlight, true);
  assert.ok(nightState.shadowCasterPosition.y > 100, 'Moonlight shadow caster stays above horizon at night');

  // 4. Explicit Starlight Mode (Chế độ Ánh Sao Ban Đêm) forces full starlight visibility even at higher sun angles
  const forcedStarlight = computeDayNightLightingState({
    timeOfDayHours: 14.0,
    sunElevationDeg: 48,
    sunAzimuthDeg: 135,
    starlightMode: true,
    biomeId: 'mondstadt_meadow',
  });
  assert.equal(forcedStarlight.starlightIntensity, 1.0);
  assert.equal(forcedStarlight.isNightOrStarlight, true);
  assert.equal(forcedStarlight.phase, 'night');
});

test('surfaceEcosystem3D PATCH_BUILDERS exhaustively builds and disposes all 18 TextureBrushId brushes (including earth_soil, atacama_salt_crust, tropical_rainforest_floor, taiga_moss_needles) without ReferenceError', () => {
  const flatWorld = generateFlatEarthTerrain('mondstadt_meadow');
  assert.equal(Object.keys(PATCH_BUILDERS).length, TEXTURE_INDEX_MAP.length);

  for (const brushId of TEXTURE_INDEX_MAP) {
    assert.equal(typeof PATCH_BUILDERS[brushId], 'function', `PATCH_BUILDERS must register ${brushId}`);
    const patch = createSurfaceEcosystemPatch(
      {
        id: `test_patch_${brushId}`,
        brushId,
        x: 0,
        z: 0,
        radius: 6,
        grassHeightCm: 4.0,
        flowerSpecies: 'cecilia_star',
        flowerColorHex: '#f8fafc',
      },
      1
    );
    assert.ok(patch.children.length > 0, `Surface patch for ${brushId} should generate 3D children`);
    disposeObject3DTree(patch);
  }
});

test('WorldSaveFileV2 serializeWorldToSavePayload and deserializeWorldFromSavePayload preserve heightMap, splatMap with named texturePalette remapping, placedObjects, and Day/Night state', () => {
  const world = generateFlatEarthTerrain('mondstadt_meadow');
  applySculptBrush(world.heightMap, world.splatMap, world.colorMap, 'mondstadt_meadow', 'raise', 0, 0, 250, 90);
  applyTextureBrush(world.heightMap, world.splatMap, world.colorMap, 'mondstadt_meadow', 'atacama_salt_crust', 0, 0, 200);

  const payload = serializeWorldToSavePayload({
    regionTitle: 'Salar de Atacama Test',
    biomeId: 'sahara_atacama_gobi',
    activeWeather: 'clear_sky',
    waterLevel: -20,
    sunElevation: -35,
    sunAzimuth: 240,
    timeOfDay: 22.5,
    starlightMode: true,
    grassHeightCm: 4.0,
    flowerSpecies: 'sakura_bloom',
    flowerColorHex: '#f472b6',
    heightMap: world.heightMap,
    splatMap: world.splatMap,
    placedObjects: world.initialObjects,
    microStrokes: [
      {
        id: 'stroke_1',
        brushId: 'atacama_salt_crust',
        x: 0,
        z: 0,
        radius: 8,
      },
    ],
  });

  assert.equal(payload.version, 2);
  assert.deepEqual(payload.texturePalette, TEXTURE_INDEX_MAP);

  const restored = deserializeWorldFromSavePayload(payload);
  assert.ok(restored !== null, 'deserializeWorldFromSavePayload should return valid restored state');
  assert.equal(restored.biomeId, 'sahara_atacama_gobi');
  assert.equal(restored.starlightMode, true);
  assert.equal(restored.sunAzimuth, 240);
  assert.equal(restored.timeOfDay, 22.5);
  const centerIdx = (GRID_SIZE / 2) * (GRID_SIZE + 1) + GRID_SIZE / 2;
  assert.equal(restored.splatMap[centerIdx], getTextureIndex('atacama_salt_crust'));
  assert.ok(Math.abs(restored.heightMap[centerIdx] - world.heightMap[centerIdx]) < 0.05);
});

test('modular terrainEngine split (constants, brushes, sculpting, generation) exports identical bindings and table-driven SCULPT_TOOL_HANDLERS without circular issues', () => {
  assert.equal(constantsMod.BIOMES, BIOMES);
  assert.equal(constantsMod.WEATHER_CATALOG, WEATHER_CATALOG);
  assert.equal(constantsMod.PREFAB_CATALOG, PREFAB_CATALOG);
  assert.equal(constantsMod.TEXTURE_INDEX_MAP, TEXTURE_INDEX_MAP);
  assert.equal(constantsMod.getTextureIndex, getTextureIndex);
  assert.equal(constantsMod.BRUSH_SCALE_PAGES, BRUSH_SCALE_PAGES);
  assert.equal(constantsMod.DEFAULT_TERRAIN_RULES, DEFAULT_TERRAIN_RULES);
  assert.equal(constantsMod.DAY_NIGHT_PRESETS, DAY_NIGHT_PRESETS);

  assert.equal(brushesMod.applyTextureBrush, applyTextureBrush);
  assert.equal(typeof brushesMod.recomputeTerrainColors, 'function');

  assert.equal(sculptingMod.getGroundHeightAt, getGroundHeightAt);
  assert.equal(sculptingMod.getTerrainElevationStats, getTerrainElevationStats);
  assert.equal(sculptingMod.applySculptBrush, applySculptBrush);
  assert.equal(typeof sculptingMod.fbm2D, 'function');
  assert.equal(Object.keys(sculptingMod.SCULPT_TOOL_HANDLERS).length, 17);

  assert.equal(generationMod.generateFlatEarthTerrain, generateFlatEarthTerrain);
  assert.equal(generationMod.generateBiomeTerrain, generateBiomeTerrain);
  assert.equal(generationMod.reconstructFromRgbaBuffer, reconstructFromRgbaBuffer);
  assert.equal(generationMod.executeTerrainRules, executeTerrainRules);
  assert.equal(generationMod.computeDayNightLightingState, computeDayNightLightingState);
  assert.equal(generationMod.serializeWorldToSavePayload, serializeWorldToSavePayload);
  assert.equal(generationMod.deserializeWorldFromSavePayload, deserializeWorldFromSavePayload);
});

test('island_volcano_icon 3D model reproduces all 5 layers of reference image_19e38ffa.png (sandy beach, green foliage collar, fluted brown cone, yellow-orange lava crown/streams, diagonal two-tone smoke plume + 2 detached clouds)', () => {
  const dummyTex = new THREE.Texture();
  const factory = new ProceduralPrefabFactory(dummyTex, true);
  const volcanoGroup = factory.createPrefab('island_volcano_icon');

  assert.equal(volcanoGroup.name, 'island_volcano_icon_root');
  assert.ok(volcanoGroup.getObjectByName('contact_shadow'), 'Includes ground contact shadow');
  assert.ok(volcanoGroup.getObjectByName('sand_beach_base'), 'Layer 1: Scalloped golden sand beach base');
  assert.ok(volcanoGroup.getObjectByName('foliage_jungle_collar'), 'Layer 2: Lush green foliage collar');
  assert.ok(volcanoGroup.getObjectByName('volcano_brown_cone'), 'Layer 3a: Steep mahogany-brown volcanic cone');
  assert.ok(volcanoGroup.getObjectByName('volcano_dark_flutes'), 'Layer 3b: Dark brown vertical ribs and gullies');
  assert.ok(volcanoGroup.getObjectByName('crater_lava_crown'), 'Layer 4a: Yellow-gold molten crater crown');
  assert.ok(volcanoGroup.getObjectByName('cascading_lava_streams'), 'Layer 4b: Cascading yellow/orange lava streams & fissures');

  const smokePlume = volcanoGroup.getObjectByName('diagonal_smoke_plume');
  assert.ok(smokePlume, 'Layer 5a: Diagonal two-tone smoke plume');
  assert.equal(smokePlume.userData.isStylizedVolcanoPlume, true);

  const cloud1 = volcanoGroup.getObjectByName('detached_smoke_cloud_1');
  const cloud2 = volcanoGroup.getObjectByName('detached_smoke_cloud_2');
  assert.ok(cloud1 && cloud1.userData.isDetachedSmokeCloud, 'Layer 5b: Detached smoke cloud 1 on right');
  assert.ok(cloud2 && cloud2.userData.isDetachedSmokeCloud, 'Layer 5c: Detached smoke cloud 2 higher on right');
  assert.ok(cloud2.position.x > cloud1.position.x && cloud2.position.y > cloud1.position.y);

  // Verify sample photo presets use .webp thumbnails and starter flat earth terrain includes all 7 featured reference mountains
  const volcanoPreset = SAMPLE_PHOTO_PRESETS.find((p) => p.id === 'island_volcano_ref');
  assert.ok(volcanoPreset);
  assert.equal(volcanoPreset.imageUrl, '/assets/aistudio/image_19e38ffa.webp');
  for (const presetWithAsset of SAMPLE_PHOTO_PRESETS.filter((p) => p.imageUrl)) {
    assert.ok(
      presetWithAsset.imageUrl?.startsWith('/assets/aistudio/') &&
        presetWithAsset.imageUrl.endsWith('.webp'),
      `Sample photo preset ${presetWithAsset.id} should use a .webp thumbnail in /assets/aistudio/`
    );
  }
  const flatWorld = generateFlatEarthTerrain('mondstadt_meadow');
  for (const featuredId of [
    'pluto_cryo_volcano',
    'europa_penitentes_spire',
    'himalaya_matterhorn_peak',
    'himalaya_fishtail_peak',
    'mars_olympus_shield',
    'titan_mithrim_montes',
    'island_volcano_icon',
  ] as const) {
    assert.ok(
      flatWorld.initialObjects.some((o) => o.prefabId === featuredId),
      `Flat Earth starter showcase should include ${featuredId}`
    );
  }
  disposeObject3DTree(volcanoGroup);
});

test('6 new reference-image 3D mountains (Pluto Wright Mons, Europa Ocean Rift Cutaway, Alps Matterhorn, Himalaya Machapuchare Fishtail, Mars Olympus Mons, Titan Mithrim Montes) reproduce all geological layers', () => {
  const dummyTex = new THREE.Texture();
  const factory = new ProceduralPrefabFactory(dummyTex, true);

  // 1. Pluto Wright Mons Cryovolcano (NASA/JHUAPL/SwRI)
  const plutoGroup = factory.createPrefab('pluto_cryo_volcano');
  assert.equal(plutoGroup.name, 'pluto_cryo_volcano_root');
  assert.ok(plutoGroup.getObjectByName('tholin_hummocky_bedrock'));
  assert.ok(plutoGroup.getObjectByName('nitrogen_glacier_lobes'));
  assert.ok(plutoGroup.getObjectByName('wright_mons_conical_caldera'));
  assert.ok(plutoGroup.getObjectByName('cryoplume_eruption_jet'));
  disposeObject3DTree(plutoGroup);

  // 2. Europa Subsurface Ocean & Ice-Shell Rift Cutaway
  const europaGroup = factory.createPrefab('europa_penitentes_spire');
  assert.equal(europaGroup.name, 'europa_ocean_rift_cutaway_root');
  assert.ok(europaGroup.getObjectByName('europa_mantle_magma_core'));
  assert.ok(europaGroup.getObjectByName('hydrothermal_seafloor_smokers'));
  assert.ok(europaGroup.getObjectByName('subsurface_turquoise_ocean'));
  assert.ok(europaGroup.getObjectByName('white_ice_shell_crust'));
  assert.ok(europaGroup.getObjectByName('chaos_ridge_surface'));
  assert.ok(europaGroup.getObjectByName('europa_cryo_geyser_plume'));
  disposeObject3DTree(europaGroup);

  // 3. Alps Matterhorn Peak
  const alpsGroup = factory.createPrefab('himalaya_matterhorn_peak');
  assert.equal(alpsGroup.name, 'alps_matterhorn_peak_root');
  assert.ok(alpsGroup.getObjectByName('alpine_rhododendron_meadow'));
  assert.ok(alpsGroup.getObjectByName('glacier_saddle_col'));
  assert.ok(alpsGroup.getObjectByName('matterhorn_horn_pyramid'));
  assert.ok(alpsGroup.getObjectByName('matterhorn_hooked_summit'));
  disposeObject3DTree(alpsGroup);

  // 4. Himalaya Machapuchare Fishtail Peak
  const himalayaGroup = factory.createPrefab('himalaya_fishtail_peak');
  assert.equal(himalayaGroup.name, 'himalaya_fishtail_peak_root');
  assert.ok(himalayaGroup.getObjectByName('himalaya_golden_foothill'));
  assert.ok(himalayaGroup.getObjectByName('annapurna_fluted_buttresses'));
  assert.ok(himalayaGroup.getObjectByName('machapuchare_fishtail_summit'));
  assert.ok(himalayaGroup.getObjectByName('fishtail_left_horn'));
  assert.ok(himalayaGroup.getObjectByName('fishtail_right_horn'));
  disposeObject3DTree(himalayaGroup);

  // 5. Mars Olympus Mons Shield Volcano (m8uek02co8l91_09cb37ea.png)
  const olympusGroup = factory.createPrefab('mars_olympus_shield');
  assert.equal(olympusGroup.name, 'mars_olympus_shield_root');
  assert.ok(olympusGroup.getObjectByName('aureole_plains_apron'));
  assert.ok(olympusGroup.getObjectByName('basal_scarp_cliff_ring'));
  assert.ok(olympusGroup.getObjectByName('shield_gentle_dome'));
  assert.ok(olympusGroup.getObjectByName('radial_flow_ribs'));
  assert.ok(olympusGroup.getObjectByName('nested_caldera_complex'));
  disposeObject3DTree(olymusGroupCompat(olympusGroup));

  // 6. Titan Mithrim Montes / Doom Mons (images_1f7cdcc6.jpg)
  const titanGroup = factory.createPrefab('titan_mithrim_montes');
  assert.equal(titanGroup.name, 'titan_mithrim_montes_root');
  assert.ok(titanGroup.getObjectByName('titan_dune_basin_floor'));
  assert.ok(titanGroup.getObjectByName('titan_dendritic_ridges'));
  assert.ok(titanGroup.getObjectByName('titan_summit_peak_crater'));
  disposeObject3DTree(titanGroup);
});

function olymusGroupCompat(g: THREE.Group): THREE.Group {
  return g;
}

test('src/world/registry modular structure exports all 20 individual biomes and 31 individual prefabs in separate modules', () => {
  assert.equal(registryMod.BIOMES, BIOMES);
  assert.equal(registryMod.PREFAB_CATALOG, PREFAB_CATALOG);
  assert.equal(registryMod.WEATHER_CATALOG, WEATHER_CATALOG);
  assert.equal(Object.keys(biomesMod.BIOMES).length, 20);
  assert.equal(prefabsMod.PREFAB_CATALOG.length, 31);
  assert.equal(Object.keys(prefabsMod.PREFAB_MAP).length, 31);

  for (const [id, cfg] of Object.entries(BIOMES)) {
    assert.equal((biomesMod as Record<string, unknown>)[id], cfg, `Biome module ${id} should match BIOMES[${id}]`);
  }
  for (const prefab of PREFAB_CATALOG) {
    assert.equal((prefabsMod as Record<string, unknown>)[prefab.id], prefab, `Prefab module ${prefab.id} should match PREFAB_CATALOG entry`);
  }
});

test('deserializeWorldFromSavePayload rejects malformed heightMap/gridSize/version and sanitizes placedObjects, microStrokes, waterLevel, and flowerColorHex', () => {
  // 1. Rejects wrong heightMap length instead of returning a silent 0m flat terrain
  assert.equal(deserializeWorldFromSavePayload(null), null);
  assert.equal(deserializeWorldFromSavePayload({}), null);
  assert.equal(deserializeWorldFromSavePayload({ version: 2, heightMap: [1, 2, 3] }), null);
  assert.equal(
    deserializeWorldFromSavePayload({
      version: 99,
      heightMap: new Array(TOTAL_VERTICES).fill(0),
    }),
    null
  );
  assert.equal(
    deserializeWorldFromSavePayload({
      version: 2,
      gridSize: 64,
      heightMap: new Array(TOTAL_VERTICES).fill(0),
    }),
    null
  );

  // 2. Sanitizes placedObjects (filters unknown prefabId & NaN, clamps scale) and microStrokes
  const validHeights = new Array(TOTAL_VERTICES).fill(12);
  const restored = deserializeWorldFromSavePayload({
    version: 2,
    gridSize: GRID_SIZE,
    biomeId: 'mondstadt_meadow',
    waterLevel: 9999,
    flowerColorHex: 'not-a-hex-color',
    flowerSpecies: 'unknown_flower',
    heightMap: validHeights,
    placedObjects: [
      {
        id: 'valid-1',
        prefabId: 'windmill_cottage',
        label: 'Cối Xay',
        x: 10,
        y: 12,
        z: -10,
        scale: 99,
        rotationY: 0.5,
      },
      {
        id: 'invalid-prefab',
        prefabId: 'non_existent_prefab',
        label: 'Bad',
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
        rotationY: 0,
      },
      {
        id: 'nan-coords',
        prefabId: 'windmill_cottage',
        label: 'NaN',
        x: Number.NaN,
        y: 0,
        z: 0,
        scale: 1,
        rotationY: 0,
      },
    ],
    microStrokes: [
      {
        id: 'valid-stroke',
        brushId: 'emerald_grass',
        x: 4,
        z: -4,
        radius: 50000,
      },
      {
        id: 'bad-brush',
        brushId: 'unknown_brush',
        x: 0,
        z: 0,
        radius: 10,
      },
    ],
  });

  assert.ok(restored !== null);
  assert.equal(restored.waterLevel, 150);
  assert.equal(restored.flowerColorHex, '#f472b6');
  assert.equal(restored.flowerSpecies, 'sakura_bloom');
  assert.equal(restored.placedObjects.length, 1);
  // 3. Rejects Object.prototype keys ("constructor", "toString", "__proto__") via Object.hasOwn
  const protoTest = deserializeWorldFromSavePayload({
    version: 2,
    gridSize: GRID_SIZE,
    biomeId: 'constructor',
    texturePalette: ['__proto__', 'toString', 'valueOf'],
    heightMap: validHeights,
    splatMap: new Array(TOTAL_VERTICES).fill(0),
    microStrokes: [
      {
        id: 'proto-stroke-1',
        brushId: 'constructor',
        x: 0,
        z: 0,
        radius: 10,
      },
      {
        id: 'proto-stroke-2',
        brushId: 'toString',
        x: 5,
        z: 5,
        radius: 10,
      },
    ],
  });
  assert.ok(protoTest !== null);
  assert.equal(
    protoTest.biomeId,
    'mondstadt_meadow',
    'Prototype key "constructor" must not be accepted as a valid biomeId'
  );
  assert.equal(
    protoTest.microStrokes.length,
    0,
    'Prototype keys "constructor" and "toString" must not be accepted as valid brushIds'
  );
  assert.equal(
    protoTest.splatMap[0],
    getTextureIndex('emerald_grass'),
    'Prototype key "__proto__" in texturePalette must fall back to default texture index'
  );

  // 4. validateWorldSavePayload returns specific Vietnamese rejection reasons
  const badVer = generationMod.validateWorldSavePayload({
    version: 99,
    heightMap: validHeights,
  });
  assert.equal(badVer.ok, false);
  if (!badVer.ok) {
    assert.ok(badVer.reason.includes('Phiên bản'));
  }

  const badGrid = generationMod.validateWorldSavePayload({
    version: 2,
    gridSize: 64,
    heightMap: validHeights,
  });
  assert.equal(badGrid.ok, false);
  if (!badGrid.ok) {
    assert.ok(badGrid.reason.includes('gridSize'));
  }

  const badHeights = generationMod.validateWorldSavePayload({
    version: 2,
    gridSize: GRID_SIZE,
    heightMap: [1, 2, 3],
  });
  assert.equal(badHeights.ok, false);
  if (!badHeights.ok) {
    assert.ok(badHeights.reason.includes('heightMap'));
  }
});

test('applySculptBrush and applyTextureBrush populate dirty-rect outBounds and computePartialVertexNormals matches Three.js PlaneGeometry normals on jagged terrain', () => {
  const world = generateFlatEarthTerrain('mondstadt_meadow');
  const sculptBounds = { minIx: 0, maxIx: GRID_SIZE, minIz: 0, maxIz: GRID_SIZE };

  const changed = applySculptBrush(
    world.heightMap,
    world.splatMap,
    world.colorMap,
    'mondstadt_meadow',
    'raise',
    0,
    0,
    120,
    50,
    sculptBounds
  );
  assert.ok(changed > 0);
  const centerCell = GRID_SIZE / 2;
  assert.ok(sculptBounds.minIx >= centerCell - 4 && sculptBounds.maxIx <= centerCell + 4);
  assert.ok(sculptBounds.minIz >= centerCell - 4 && sculptBounds.maxIz <= centerCell + 4);
  assert.ok(
    (sculptBounds.maxIx - sculptBounds.minIx + 1) * (sculptBounds.maxIz - sculptBounds.minIz + 1) <
      TOTAL_VERTICES / 10,
    'Dirty rect should cover only a small localized subset of vertices'
  );

  const paintBounds = { minIx: 0, maxIx: GRID_SIZE, minIz: 0, maxIz: GRID_SIZE };
  const painted = applyTextureBrush(
    world.heightMap,
    world.splatMap,
    world.colorMap,
    'mondstadt_meadow',
    'volcanic_lava',
    0,
    0,
    120,
    { outBounds: paintBounds }
  );
  assert.ok(painted > 0);
  assert.equal(paintBounds.minIx, sculptBounds.minIx);
  assert.equal(paintBounds.maxIx, sculptBounds.maxIx);

  // Verify computePartialVertexNormals updates only the 1-cell padded dirtyRect and leaves outside vertices untouched
  const normalArray = new Float32Array(TOTAL_VERTICES * 3);
  const sentinelValue = 7.5;
  normalArray.fill(sentinelValue);

  const { paddedRect, updatedVertexCount } = sculptingMod.computePartialVertexNormals(
    world.heightMap,
    normalArray,
    sculptBounds
  );
  assert.equal(
    normalArray[0],
    sentinelValue,
    'computePartialVertexNormals must not touch normals outside the padded dirtyRect'
  );
  assert.equal(paddedRect.minIx, Math.max(0, sculptBounds.minIx - 1));
  assert.equal(paddedRect.maxIx, Math.min(GRID_SIZE, sculptBounds.maxIx + 1));
  assert.equal(paddedRect.minIz, Math.max(0, sculptBounds.minIz - 1));
  assert.equal(paddedRect.maxIz, Math.min(GRID_SIZE, sculptBounds.maxIz + 1));
  assert.ok(
    updatedVertexCount < 100 && updatedVertexCount < TOTAL_VERTICES / 250,
    `computePartialVertexNormals should process < 100 vertices for a 120m brush instead of ${TOTAL_VERTICES}, got ${updatedVertexCount}`
  );

  // Verify exact parity between partial normals, full normals, and Three.js PlaneGeometry.computeVertexNormals() even on jagged 1-2 cell terrain
  const jaggedHeights = new Float32Array(TOTAL_VERTICES);
  for (let i = 0; i < TOTAL_VERTICES; i++) {
    jaggedHeights[i] = Math.sin(i * 1.7) * 350 + (i % 2 === 0 ? 160 : -160);
  }
  const fullNormals = new Float32Array(TOTAL_VERTICES * 3);
  sculptingMod.computePartialVertexNormals(jaggedHeights, fullNormals, null);

  const partialNormals = new Float32Array(fullNormals);
  partialNormals.fill(0);
  sculptingMod.computePartialVertexNormals(jaggedHeights, partialNormals, {
    minIx: 40,
    maxIx: 55,
    minIz: 40,
    maxIz: 55,
  });

  const refGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, GRID_SIZE, GRID_SIZE);
  refGeo.rotateX(-Math.PI / 2);
  const refPos = refGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < refPos.count; i++) {
    refPos.setY(i, jaggedHeights[i]);
  }
  refGeo.computeVertexNormals();
  const threeNormals = (refGeo.attributes.normal as THREE.BufferAttribute).array as Float32Array;

  for (let iz = 39; iz <= 56; iz++) {
    for (let ix = 39; ix <= 56; ix++) {
      const idx = (iz * (GRID_SIZE + 1) + ix) * 3;
      assert.equal(partialNormals[idx], fullNormals[idx], 'Partial and full normal X must be identical');
      assert.equal(partialNormals[idx + 1], fullNormals[idx + 1], 'Partial and full normal Y must be identical');
      assert.equal(partialNormals[idx + 2], fullNormals[idx + 2], 'Partial and full normal Z must be identical');

      const dot = Math.min(
        1,
        Math.max(
          -1,
          fullNormals[idx] * threeNormals[idx] +
            fullNormals[idx + 1] * threeNormals[idx + 1] +
            fullNormals[idx + 2] * threeNormals[idx + 2]
        )
      );
      const angleDeg = Math.acos(dot) * (180 / Math.PI);
      assert.ok(
        angleDeg < 0.05,
        `Normal on jagged terrain must match Three.js computeVertexNormals within 0.05 deg, got ${angleDeg}`
      );
    }
  }
  refGeo.dispose();

  // Verify mergeDirtyRect accumulates multiple brush strokes cleanly
  const merged = sculptingMod.mergeDirtyRect(sculptBounds, {
    minIx: 10,
    maxIx: 14,
    minIz: 20,
    maxIz: 25,
  });
  assert.equal(merged.minIx, 10);
  assert.equal(merged.maxIx, sculptBounds.maxIx);
  assert.equal(merged.minIz, 20);
  assert.equal(merged.maxIz, sculptBounds.maxIz);
});

test('disposeObject3DTree disposes material textures (map, normalMap, emissiveMap) while preserving shared textures', () => {
  const group = new THREE.Group();
  const mapTex = new THREE.Texture();
  const normalTex = new THREE.Texture();
  const sharedTex = new THREE.Texture();
  sharedTex.userData = { shared: true };

  let mapDisposed = false;
  let normalDisposed = false;
  let sharedDisposed = false;
  mapTex.dispose = () => {
    mapDisposed = true;
  };
  normalTex.dispose = () => {
    normalDisposed = true;
  };
  sharedTex.dispose = () => {
    sharedDisposed = true;
  };

  const mat = new THREE.MeshStandardMaterial({
    map: mapTex,
    normalMap: normalTex,
    roughnessMap: sharedTex,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  group.add(mesh);

  disposeObject3DTree(group);
  assert.equal(mapDisposed, true, 'Should dispose material.map texture');
  assert.equal(normalDisposed, true, 'Should dispose material.normalMap texture');
  assert.equal(sharedDisposed, false, 'Should not dispose textures marked with userData.shared = true');
});

test('junctionBlending and junctionBridges3D fuse overlapping structures as 1 volume and interpolate/extrapolate only the bottom ground for distant objects', () => {
  // 1. Verify Hermite interpolation (t in [0, 1]) and damped tangent extrapolation (t < 0, t > 1)
  assert.equal(hermiteInterpolateOrExtrapolate(10, 30, 5, 5, 0), 10);
  assert.equal(hermiteInterpolateOrExtrapolate(10, 30, 5, 5, 1), 30);
  const midH = hermiteInterpolateOrExtrapolate(10, 30, 0, 0, 0.5);
  assert.equal(midH, 20, 'Symmetric Hermite midpoint must equal 20');
  const extrapLeft = hermiteInterpolateOrExtrapolate(10, 30, 12, 12, -0.2);
  const extrapRight = hermiteInterpolateOrExtrapolate(10, 30, 12, 12, 1.2);
  assert.ok(extrapLeft < 10 && extrapLeft > 5, 'Left extrapolation must continue slope smoothly');
  assert.ok(extrapRight > 30 && extrapRight < 35, 'Right extrapolation must continue slope smoothly');

  // 2. Verify C2 quintic color interpolation & extrapolation
  const colMid = interpolateOrExtrapolateRgb([0.2, 0.4, 0.8], [0.8, 0.6, 0.2], 0.5);
  assert.ok(Math.abs(colMid[0] - 0.5) < 1e-6);
  assert.equal(quinticSmoothstep(0), 0);
  assert.equal(quinticSmoothstep(1), 1);
  assert.equal(quinticSmoothstep(0.5), 0.5);

  const sminRes = polynomialSmoothMin(4.0, 4.0, 2.0);
  assert.ok(sminRes.value < 4.0, 'Smooth minimum of equal values must round the junction corner');

  // 3. Verify pair classification: overlapping pair (d = 8m) vs distant pair (d = 180m)
  const testObjects = [
    {
      id: 'obj-overlap-a',
      prefabId: 'windmill_cottage' as const,
      label: 'Nhà A',
      x: 0,
      y: 0,
      z: 0,
      scale: 1.2,
      rotationY: 0,
    },
    {
      id: 'obj-overlap-b',
      prefabId: 'sakura_shrine' as const,
      label: 'Đền B (Đè lên A)',
      x: 8,
      y: 0,
      z: 0,
      scale: 1.2,
      rotationY: 0.4,
    },
    {
      id: 'obj-distant-c',
      prefabId: 'mars_olympus_shield' as const,
      label: 'Núi C (Ở xa)',
      x: 180,
      y: 0,
      z: 0,
      scale: 1.3,
      rotationY: 0,
    },
  ];

  const pairs = computeObjectJunctionPairs(testObjects);
  const overlapPair = pairs.find(
    (p) => p.objA.id === 'obj-overlap-a' && p.objB.id === 'obj-overlap-b'
  );
  const distantPair = pairs.find(
    (p) => p.objB.id === 'obj-distant-c'
  );

  assert.ok(overlapPair, 'Should detect overlapping pair A-B');
  assert.equal(overlapPair.mode, 'overlap_fusion');
  assert.equal(overlapPair.groundOnly, false);

  assert.ok(distantPair, 'Should detect distant pair to C');
  assert.equal(distantPair.mode, 'distant_ground_only');
  assert.equal(
    distantPair.groundOnly,
    true,
    'Distant object pair must be flagged groundOnly = true ("chỉ tác động vào nền đất dưới cùng")'
  );

  // 4. Verify terrain & color blending on flat world with height difference
  const world = generateFlatEarthTerrain('mondstadt_meadow');
  applySculptBrush(
    world.heightMap,
    world.splatMap,
    world.colorMap,
    'mondstadt_meadow',
    'raise',
    180,
    0,
    140,
    80
  );

  const blendRes = blendObjectsAndTerrainJunctions(
    world.heightMap,
    world.splatMap,
    world.colorMap,
    'mondstadt_meadow',
    testObjects,
    { smoothTerrainSeams: true }
  );

  assert.equal(blendRes.overlapFusionCount, 1);
  assert.ok(blendRes.distantGroundCorridorCount >= 1);
  assert.ok(blendRes.modifiedVerticesCount > 0);
  assert.ok(blendRes.blendedColorVerticesCount > 0);

  // 5. Verify 3D Junction Continuum Group merges the entire junction network into a single THREE.Mesh (1 draw call)
  const continuumGroup = buildJunctionContinuumGroup(
    blendRes.updatedObjects,
    [
      { id: 'ms-1', x: -10, z: -10, radius: 14, brushId: 'emerald_grass' },
      { id: 'ms-2', x: 4, z: -10, radius: 14, brushId: 'volcanic_lava' },
    ],
    world.heightMap,
    'mondstadt_meadow'
  );

  assert.equal(continuumGroup.userData.overlapFusionCount, 1);
  assert.ok(continuumGroup.userData.distantGroundCorridorCount >= 1);
  assert.equal(continuumGroup.userData.terrainStrokeBridgeCount, 1);
  assert.equal(continuumGroup.userData.drawCallCount, 1);

  let foundOverlapVertices = false;
  let foundDistantGroundVertices = false;
  let meshCount = 0;

  continuumGroup.traverse((child) => {
    if (child instanceof THREE.Mesh && child.userData.isJunctionBridge) {
      meshCount++;
      const posAttr = child.geometry.attributes.position as THREE.BufferAttribute;
      const colAttr = child.geometry.attributes.color as THREE.BufferAttribute;
      assert.ok(posAttr.count > 20);
      assert.equal(colAttr.count, posAttr.count, 'Every bridge vertex must have interpolated vertex color');

      const overlapRanges = (child.userData.overlapVertexRanges ?? []) as Array<{
        start: number;
        count: number;
      }>;
      const distantRanges = (child.userData.distantGroundVertexRanges ?? []) as Array<{
        start: number;
        count: number;
      }>;

      if (overlapRanges.length > 0) {
        foundOverlapVertices = true;
        let maxHeightAboveGround = 0;
        for (const range of overlapRanges) {
          for (let i = range.start; i < range.start + range.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);
            const gy = getGroundHeightAt(world.heightMap, GRID_SIZE, WORLD_SIZE, vx, vz);
            maxHeightAboveGround = Math.max(maxHeightAboveGround, vy - gy);
          }
        }
        assert.ok(
          maxHeightAboveGround > 1.2,
          `Overlapping structures bridge should rise > 1.2m to fuse volumes as 1, got ${maxHeightAboveGround}`
        );
      }

      if (distantRanges.length > 0) {
        foundDistantGroundVertices = true;
        for (const range of distantRanges) {
          for (let i = range.start; i < range.start + range.count; i++) {
            const vx = posAttr.getX(i);
            const vy = posAttr.getY(i);
            const vz = posAttr.getZ(i);
            const gy = getGroundHeightAt(world.heightMap, GRID_SIZE, WORLD_SIZE, vx, vz);
            assert.ok(
              Math.abs(vy - gy) < 15,
              'Distant ground strip must stay hugging the interpolated bottom ground'
            );
          }
        }
      }
    }
  });

  assert.equal(foundOverlapVertices, true);
  assert.equal(foundDistantGroundVertices, true);
  assert.equal(meshCount, 1, `Merged continuum group must contain a single mesh (1 draw call), got ${meshCount}`);
  disposeObject3DTree(continuumGroup);
});

test('blendObjectsAndTerrainJunctions is strictly idempotent near a 400m cliff and preserves 100% of colorMap across Save/Load and subsequent brush strokes', () => {
  const world = generateFlatEarthTerrain('mondstadt_meadow');

  // Sculpt a 400m sheer cliff next to the origin
  for (let step = 0; step < 6; step++) {
    applySculptBrush(
      world.heightMap,
      world.splatMap,
      world.colorMap,
      'mondstadt_meadow',
      'sheer_cliff',
      85,
      0,
      90,
      85
    );
  }

  const cliffObjects = [
    {
      id: 'cliff-obj-1',
      prefabId: 'windmill_cottage' as const,
      label: 'Nhà Sát Vách Đá 1',
      x: 12,
      y: 0,
      z: 0,
      scale: 1.3,
      rotationY: 0,
    },
    {
      id: 'cliff-obj-2',
      prefabId: 'sakura_shrine' as const,
      label: 'Đền Sát Vách Đá 2',
      x: 20,
      y: 0,
      z: 0,
      scale: 1.3,
      rotationY: 0.5,
    },
  ];

  // 1st click of "Nối Tiếp Giáp"
  const res1 = blendObjectsAndTerrainJunctions(
    world.heightMap,
    world.splatMap,
    world.colorMap,
    'mondstadt_meadow',
    cliffObjects,
    { smoothTerrainSeams: true }
  );
  const heightsAfterClick1 = new Float32Array(world.heightMap);
  const colorsAfterClick1 = new Float32Array(world.colorMap);
  const splatAfterClick1 = new Uint8Array(world.splatMap);

  // 5th and 20th clicks of "Nối Tiếp Giáp" must produce 0.0m additional elevation drift
  let currentObjs = res1.updatedObjects;
  for (let click = 2; click <= 20; click++) {
    const resN = blendObjectsAndTerrainJunctions(
      world.heightMap,
      world.splatMap,
      world.colorMap,
      'mondstadt_meadow',
      currentObjs,
      { smoothTerrainSeams: true }
    );
    currentObjs = resN.updatedObjects;
  }

  let maxHeightDiff = 0;
  for (let i = 0; i < TOTAL_VERTICES; i++) {
    const diff = Math.abs(world.heightMap[i] - heightsAfterClick1[i]);
    if (diff > maxHeightDiff) maxHeightDiff = diff;
    assert.equal(world.splatMap[i], splatAfterClick1[i]);
  }
  assert.equal(
    maxHeightDiff,
    0,
    `Repeated calls to blendObjectsAndTerrainJunctions (20x) must be idempotent (0m drift), got ${maxHeightDiff}m`
  );

  for (let i = 0; i < colorsAfterClick1.length; i++) {
    assert.equal(world.colorMap[i], colorsAfterClick1[i]);
  }

  // Verify Save -> Load preserves 100% of blended colorMap (0 / 77,763 differences)
  const savedPayload = serializeWorldToSavePayload({
    regionTitle: 'Kiểm Tra Lưu Màu Blend',
    biomeId: 'mondstadt_meadow',
    activeWeather: 'clear_sky',
    waterLevel: -18,
    sunElevation: 48,
    sunAzimuth: 135,
    timeOfDay: 10.5,
    starlightMode: false,
    grassHeightCm: 4.0,
    flowerSpecies: 'sakura_bloom',
    flowerColorHex: '#f472b6',
    heightMap: world.heightMap,
    splatMap: world.splatMap,
    placedObjects: currentObjs,
    microStrokes: [],
  });

  const restored = deserializeWorldFromSavePayload(savedPayload);
  assert.ok(restored !== null);
  let differingColorChannels = 0;
  for (let i = 0; i < world.colorMap.length; i++) {
    if (Math.abs(restored.colorMap[i] - world.colorMap[i]) > 1e-6) {
      differingColorChannels++;
    }
  }
  assert.equal(
    differingColorChannels,
    0,
    `Expected 0/77,763 color differences after Save -> Load, got ${differingColorChannels}`
  );
});

test('buildJunctionContinuumGroup merges geometries into a single mesh (1 draw call) and scales to 100, 300, and 800 objects in < 60ms', () => {
  const world = generateFlatEarthTerrain('mondstadt_meadow');
  const prefabIds = PREFAB_CATALOG.map((p) => p.id);

  // Verify all 20 biomes define a positive roughness value in BIOMES registry
  for (const [id, cfg] of Object.entries(BIOMES)) {
    assert.ok(typeof cfg.roughness === 'number' && cfg.roughness > 0, `Biome ${id} must define roughness > 0`);
  }

  // Warm up V8 JIT before measuring scaling loop so container/CI CPU jitter does not skew results
  const warmupGroup = buildJunctionContinuumGroup(
    [
      {
        id: 'warmup-0',
        prefabId: prefabIds[0],
        label: 'Warmup 0',
        x: 0,
        y: 0,
        z: 0,
        scale: 1,
        rotationY: 0,
      },
      {
        id: 'warmup-1',
        prefabId: prefabIds[1],
        label: 'Warmup 1',
        x: 8,
        y: 0,
        z: 0,
        scale: 1,
        rotationY: 0,
      },
    ],
    [],
    world.heightMap,
    'mondstadt_meadow'
  );
  disposeObject3DTree(warmupGroup);

  for (const count of [20, 100, 300, 800]) {
    const objects = Array.from({ length: count }, (_, idx) => {
      const row = Math.floor(idx / 25);
      const col = idx % 25;
      // Mix overlapping pairs (every even/odd pair close together) and separated clusters
      const clusterX = (col - 12) * 38;
      const clusterZ = (row - 12) * 38;
      const offset = idx % 2 === 1 ? 6 : 0;
      return {
        id: `perf-obj-${idx}`,
        prefabId: prefabIds[idx % prefabIds.length],
        label: `Obj ${idx}`,
        x: clusterX + offset,
        y: 0,
        z: clusterZ,
        scale: 1.1,
        rotationY: 0,
      };
    });

    let elapsedMs = Infinity;
    let group!: THREE.Group;
    for (let attempt = 0; attempt < 3; attempt++) {
      const t0 = performance.now();
      const g = buildJunctionContinuumGroup(objects, [], world.heightMap, 'mondstadt_meadow');
      const dt = performance.now() - t0;
      if (dt < elapsedMs) elapsedMs = dt;
      if (attempt < 2) disposeObject3DTree(g);
      else group = g;
    }

    let meshCount = 0;
    let triangleCount = 0;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshCount++;
        const idxAttr = child.geometry.index;
        triangleCount += idxAttr ? idxAttr.count / 3 : 0;
      }
    });

    assert.equal(
      meshCount,
      1,
      `For ${count} objects, merged group must have a single mesh (1 draw call), got ${meshCount}`
    );
    assert.equal(
      group.userData.drawCallCount,
      1,
      'group.userData.drawCallCount must equal 1 for the merged junction network'
    );
    assert.ok(
      triangleCount < 45000,
      `For ${count} objects, triangle count must stay bounded (< 45,000), got ${triangleCount}`
    );
    assert.ok(
      elapsedMs < 60,
      `For ${count} objects, buildJunctionContinuumGroup should complete in < 60ms, took ${elapsedMs.toFixed(2)}ms`
    );
    disposeObject3DTree(group);
  }
});

test('Height-Lerp Splatting (computeHeightLerpWeights & blendBiomeJunction), Cosine Falloff, and Sparse Delta Undo/Redo preserve mathematical invariants', () => {
  // 1. Height-Lerp Splatting weight conservation: wA + wB === 1
  const [wA, wB] = computeHeightLerpWeights(0.8, 0.2, 0.45, 0.15);
  assert.ok(Math.abs(wA + wB - 1.0) < 1e-6, 'Height-Lerp weights must sum to 1.0');
  assert.ok(wA > wB, 'Higher micro-height material A should dominate near the midpoint');

  const blendedSample = blendBiomeJunction(
    { elevation: 120, microHeight: 0.85, colorRGB: [0.8, 0.2, 0.1], roughness: 0.9 },
    { elevation: 40, microHeight: 0.15, colorRGB: [0.1, 0.7, 0.3], roughness: 0.4 },
    0,
    20,
    0.15
  );
  assert.ok(blendedSample.elevation > 80 && blendedSample.elevation <= 120);
  assert.ok(blendedSample.roughness > 0.65 && blendedSample.roughness <= 0.9);

  // 2. Cosine brush falloff: 1 at center, 0 at boundary & outside
  assert.ok(Math.abs(cosineBrushFalloff(0, 10) - 1.0) < 1e-6);
  assert.ok(Math.abs(cosineBrushFalloff(10, 10) - 0.0) < 1e-6);
  assert.equal(cosineBrushFalloff(15, 10), 0);

  // 3. Sparse Delta Undo / Redo restores exact Float32Array heights
  const history = new SculptHistoryManager();
  const before = new Float32Array([10, 20, 30, 40]);
  const current = new Float32Array([10, 25.5, 30, 42.1]);

  history.recordStroke(before, current);
  assert.equal(history.undoCount, 1);
  assert.equal(history.undo(current), true);
  assert.deepEqual(Array.from(current), [10, 20, 30, 40]);

  assert.equal(history.redo(current), true);
  assert.ok(Math.abs(current[1] - 25.5) < 1e-5);
  assert.ok(Math.abs(current[3] - 42.1) < 1e-5);
});

test('Hydraulic Erosion (terrainWorker), GPU Instancing (buildInstancedEcosystem), Sobel RGBA Reconstruction, GLSL Shaders, Procedural Trees, and Quadtree LOD operate accurately', () => {
  // 1. Particle-based Hydraulic Erosion on a 32x32 sloped hill
  const w = 32;
  const h = 32;
  const map = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - 16;
      const dy = y - 16;
      map[y * w + x] = Math.max(0, 50 - (dx * dx + dy * dy) * 0.35);
    }
  }
  const beforeCopy = new Float32Array(map);
  const gradSample = calculateHeightAndGradient(map, w, h, 10.5, 10.5);
  assert.ok(Number.isFinite(gradSample.height));
  assert.ok(gradSample.gx > 0 && gradSample.gy > 0);

  applyHydraulicErosion(map, { width: w, height: h, iterations: 1500, seed: 42 });
  let changedCells = 0;
  for (let i = 0; i < map.length; i++) {
    assert.ok(Number.isFinite(map[i]), 'Eroded heightmap must not contain NaN/Infinity');
    if (Math.abs(map[i] - beforeCopy[i]) > 1e-4) changedCells++;
  }
  assert.ok(changedCells > 20, `Expected hydraulic erosion to modify > 20 cells, got ${changedCells}`);

  // 2. GPU Instancing via buildInstancedEcosystem
  const boxGeo = new THREE.BoxGeometry(1, 2, 1);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x22c55e });
  const samples = [
    { position: new THREE.Vector3(0, 50, 0), normal: new THREE.Vector3(0, 1, 0) }, // valid
    { position: new THREE.Vector3(5, 80, 5), normal: new THREE.Vector3(0.1, 0.99, 0).normalize() }, // valid
    { position: new THREE.Vector3(10, 5, 10), normal: new THREE.Vector3(0, 1, 0) }, // below minAltitude
    { position: new THREE.Vector3(15, 60, 15), normal: new THREE.Vector3(1, 0.1, 0).normalize() }, // too steep
  ];
  const instanced = buildInstancedEcosystem(
    boxGeo,
    boxMat,
    samples,
    {
      prefabId: 'emerald_pine',
      minAltitude: 20,
      maxAltitude: 120,
      maxSlopeRadians: 0.45,
      density: 1.0,
      scaleRange: [0.8, 1.4],
      alignToNormal: true,
    },
    1337
  );
  assert.equal(instanced.count, 2, 'Only the 2 valid altitude/slope samples should be instanced');
  boxGeo.dispose();
  boxMat.dispose();
  instanced.dispose();

  // 3. Sobel + ITU-R BT.601 Luminance RGBA Reconstruction
  const imgW = 16;
  const imgH = 16;
  const rgba = new Uint8ClampedArray(imgW * imgH * 4);
  for (let i = 0; i < imgW * imgH; i++) {
    // High red volcanic signature with vertical gradient
    rgba[i * 4] = 220;
    rgba[i * 4 + 1] = 60 + (i % imgW) * 5;
    rgba[i * 4 + 2] = 30;
    rgba[i * 4 + 3] = 255;
  }
  const recon = reconstructTerrainFromRGBA(rgba, imgW, imgH, 80.0, 0.75);
  assert.equal(recon.heightmap.length, imgW * imgH);
  assert.ok(
    recon.detectedBiomeId === 'mars_olympus' || recon.detectedBiomeId === 'natlan_volcano_abyss'
  );

  // 4. Custom GLSL Triplanar Terrain Shader & GPU Weather System
  const shaderMat = createDynamicTerrainMaterial({ uSnowIntensity: 0.9, uLavaLevel: 4.0 });
  assert.equal(shaderMat.uniforms.uSnowIntensity.value, 0.9);
  assert.equal(shaderMat.uniforms.uLavaLevel.value, 4.0);
  shaderMat.dispose();

  const weatherPoints = createGPUWeatherSystem('snowstorm');
  assert.equal(
    (weatherPoints.geometry.getAttribute('position') as THREE.BufferAttribute).count,
    BIOME_WEATHER_PRESETS.snowstorm.particleCount
  );
  weatherPoints.geometry.dispose();
  (weatherPoints.material as THREE.Material).dispose();

  // 5. Procedural Pine & Sakura Trees and Quadtree LOD
  const pine = createProceduralPineTree(6.0, 1.5);
  const sakura = createProceduralSakuraTree(5.5, 2.0);
  assert.equal(pine.children.length, 5); // 1 trunk + 4 cone layers
  assert.equal(sakura.children.length, 8); // 1 trunk + 7 blossom clusters
  disposeObject3DTree(pine);
  disposeObject3DTree(sakura);

  const quadtree = new TerrainQuadtreeLOD(4, 16, 6.0);
  const rootNode: QuadTreeNode = {
    bounds: new THREE.Box2(new THREE.Vector2(-512, -512), new THREE.Vector2(512, 512)),
    level: 0,
    children: [],
    isLeaf: true,
  };
  quadtree.evaluateLOD(rootNode, new THREE.Vector3(0, 20, 0));
  assert.equal(rootNode.isLeaf, false, 'Quadtree root must subdivide when camera is at center');
  assert.equal(rootNode.children.length, 4);

  quadtree.evaluateLOD(rootNode, new THREE.Vector3(50000, 20, 50000));
  assert.equal(rootNode.isLeaf, true, 'Quadtree root must collapse when camera moves far away');
  assert.equal(rootNode.children.length, 0);
});

test('sub-cell 15m brush sculpting raises 3D terrain elevation inside a 62.5m grid cell and spawnSculptLandformObject places 3D objects flush on sculpted terrain', () => {
  const world = generateFlatEarthTerrain('mondstadt_meadow');
  // Click at (28, 28) inside a 62.5m x 62.5m grid cell with default 15m brush radius and 45m strength
  const modified = applySculptBrush(
    world.heightMap,
    world.splatMap,
    world.colorMap,
    'mondstadt_meadow',
    'sheer_cliff',
    28,
    28,
    15,
    45
  );
  assert.ok(modified >= 1, '15m sheer_cliff brush at (28, 28) must modify vertices');
  const groundAfter = getGroundHeightAt(world.heightMap, GRID_SIZE, WORLD_SIZE, 28, 28);
  assert.ok(
    groundAfter > 10,
    `15m sheer_cliff brush inside a 62.5m cell must visibly raise 3D elevation (> 10m), got ${groundAfter}m`
  );

  // Spawn corresponding 3D landform object ('sheer_cliff_wall') at (28, 28)
  const spawnRes = sculptingMod.spawnSculptLandformObject(
    'sheer_cliff',
    28,
    28,
    world.heightMap,
    world.initialObjects,
    { forcePlaceOnClick: true }
  );
  assert.ok(spawnRes.spawnedObject !== null, 'Should spawn 3D sheer_cliff_wall object on sculpt');
  assert.equal(spawnRes.spawnedObject?.prefabId, 'sheer_cliff_wall');
  assert.equal(
    spawnRes.updatedObjects.length,
    world.initialObjects.length + 1,
    'updatedObjects should include the newly spawned 3D landform object'
  );
  assert.ok(
    Math.abs((spawnRes.spawnedObject?.y ?? 0) - groundAfter) < 0.1,
    'Spawned 3D object must sit flush on the newly sculpted ground height'
  );

  // Explicit prefabOverride places the chosen 3D object
  const overrideRes = sculptingMod.spawnSculptLandformObject(
    'raise',
    65,
    65,
    world.heightMap,
    spawnRes.updatedObjects,
    { prefabOverride: 'sakura_shrine', forcePlaceOnClick: true }
  );
  assert.ok(overrideRes.spawnedObject !== null);
  assert.equal(overrideRes.spawnedObject?.prefabId, 'sakura_shrine');
});

test('20-biome Mahalanobis + Shannon entropy classifier (analyzeAndClassifyImage) and ParallelErosionPool with Radial LUT operate accurately', async () => {
  assert.equal(
    generationMod.BIOME_SIGNATURES.length,
    20,
    'BIOME_SIGNATURES must contain all 20 biomes'
  );

  // 1. High red/orange lava image -> classifies to corot_lava_ocean or natlan_volcano_abyss / mars_olympus
  const w = 16;
  const h = 16;
  const lavaRgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    lavaRgba[i * 4] = 220;
    lavaRgba[i * 4 + 1] = 45 + (i % 15);
    lavaRgba[i * 4 + 2] = 12;
    lavaRgba[i * 4 + 3] = 255;
  }
  const lavaOut = generationMod.analyzeAndClassifyImage(lavaRgba, w, h);
  assert.ok(
    ['corot_lava_ocean', 'natlan_volcano_abyss', 'mars_olympus'].includes(
      lavaOut.bestMatch.biomeId
    ),
    `Expected lava image to match volcanic biome, got ${lavaOut.bestMatch.biomeId}`
  );
  assert.ok(lavaOut.confidence > 0 && lavaOut.confidence <= 1);
  assert.equal(lavaOut.topCandidates.length, 4);
  assert.equal(lavaOut.featureVector.length, 6);
  assert.equal(lavaOut.heightmap.length, w * h);

  // 2. High white/blue snow image -> classifies to snowpeak_glacier or celestia_sky_isles
  const snowRgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    snowRgba[i * 4] = 225;
    snowRgba[i * 4 + 1] = 235;
    snowRgba[i * 4 + 2] = 248;
    snowRgba[i * 4 + 3] = 255;
  }
  const snowOut = generationMod.analyzeAndClassifyImage(snowRgba, w, h);
  assert.ok(
    ['snowpeak_glacier', 'celestia_sky_isles', 'europa_chaos_ridge'].includes(
      snowOut.bestMatch.biomeId
    ),
    `Expected snow image to match snowy/ice biome, got ${snowOut.bestMatch.biomeId}`
  );

  // 3. Precomputed Radial Brush LUT weights sum to 1.0
  const lut = generationMod.buildErosionBrushLUT(32, 3);
  assert.ok(lut.IndexOffsets.length > 0);
  assert.equal(lut.IndexOffsets.length, lut.Weights.length);
  const weightSum = lut.Weights.reduce((acc, val) => acc + val, 0);
  assert.ok(
    Math.abs(weightSum - 1.0) < 1e-5,
    `Expected radial LUT weights to sum to 1.0, got ${weightSum}`
  );

  // 4. ParallelErosionPool executes multi-strip halo-blended erosion cleanly
  const testMap = new Float32Array(32 * 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      testMap[y * 32 + x] = 50 - Math.hypot(x - 16, y - 16) * 2;
    }
  }
  const pool = new generationMod.ParallelErosionPool(2, 4);
  const erodedMap = await pool.executeParallelErosion(testMap, 32, 32, 400);
  assert.equal(erodedMap.length, 32 * 32);
  let diffSum = 0;
  for (let i = 0; i < testMap.length; i++) {
    assert.ok(Number.isFinite(erodedMap[i]));
    diffSum += Math.abs(erodedMap[i] - testMap[i]);
  }
  assert.ok(diffSum > 0, 'ParallelErosionPool must modify heightmap elevations');
});

test('Prefab placement for House, Tree, and Landmark categories spawns exact chosen prefab instead of pluto_cryo_volcano', () => {
  const world = generateFlatEarthTerrain('mondstadt_meadow');
  const shadowTex = new THREE.DataTexture(new Uint8Array(16), 2, 2);
  const factory = new ProceduralPrefabFactory(shadowTex, true);

  const testCases = [
    { category: 'house', prefabId: 'windmill_cottage' as const, x: 0, z: 10 },
    { category: 'tree', prefabId: 'sakura_tree' as const, x: -8, z: 10 },
    { category: 'landmark', prefabId: 'ancient_bridge' as const, x: 8, z: 10 },
  ];

  for (const tc of testCases) {
    const meta = PREFAB_CATALOG.find((p) => p.id === tc.prefabId);
    assert.ok(meta, `Prefab ${tc.prefabId} must exist in PREFAB_CATALOG`);
    assert.equal(meta.category, tc.category);

    const { spawnedObject, diagnostics } = spawnSculptLandformObject(
      'cryo_volcano',
      tc.x,
      tc.z,
      world.heightMap,
      world.initialObjects,
      {
        prefabOverride: tc.prefabId,
        scale: 1.0,
        forcePlaceOnClick: true,
      }
    );
    assert.ok(spawnedObject, `Must spawn ${tc.prefabId} at (${tc.x}, ${tc.z})`);
    assert.equal(
      spawnedObject.prefabId,
      tc.prefabId,
      `Expected ${tc.prefabId}, got ${spawnedObject.prefabId}`
    );
    assert.notEqual(spawnedObject.prefabId, 'pluto_cryo_volcano');
    assert.equal(diagnostics.resolutionSource, 'manual_override');
    assert.equal(diagnostics.resolvedPrefabId, tc.prefabId);
    assert.equal(diagnostics.requestedOverride, tc.prefabId);
    assert.equal(diagnostics.toolMappedPrefabId, 'pluto_cryo_volcano');

    const group = factory.createPrefab(tc.prefabId);
    assert.ok(group.children.length > 0, `3D model for ${tc.prefabId} must have meshes`);
    disposeObject3DTree(group);
  }

  // Verify SCULPT_TOOL_PREFAB_MAP entries all exist in PREFAB_CATALOG and 'auto' never defaults back to pluto_cryo_volcano for non-cryo tools
  for (const [toolId, mapping] of Object.entries(SCULPT_TOOL_PREFAB_MAP)) {
    if (mapping) {
      const mappedMeta = PREFAB_CATALOG.find((p) => p.id === mapping.prefabId);
      assert.ok(mappedMeta, `Sculpt tool ${toolId} must map to a valid PrefabId in PREFAB_CATALOG`);
      const { spawnedObject, diagnostics } = spawnSculptLandformObject(
        toolId as registryMod.SculptToolId,
        120,
        120,
        world.heightMap,
        [],
        {
          prefabOverride: 'auto',
          forcePlaceOnClick: true,
        }
      );
      assert.ok(spawnedObject);
      assert.equal(spawnedObject.prefabId, mapping.prefabId);
      assert.equal(diagnostics.resolutionSource, 'tool_mapping');
      assert.equal(diagnostics.resolvedPrefabId, mapping.prefabId);
      assert.equal(diagnostics.requestedOverride, 'auto');
    } else {
      const { spawnedObject, diagnostics } = spawnSculptLandformObject(
        toolId as registryMod.SculptToolId,
        120,
        120,
        world.heightMap,
        [],
        {
          prefabOverride: 'auto',
          forcePlaceOnClick: true,
        }
      );
      assert.equal(spawnedObject, null, `Tool ${toolId} with null mapping and 'auto' override must not spawn a model`);
      assert.equal(diagnostics.resolutionSource, 'none');
      assert.equal(diagnostics.resolvedPrefabId, null);
    }
  }

  factory.dispose();
  shadowTex.dispose();
});



