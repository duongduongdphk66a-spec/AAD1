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
  VIRTUAL_RESOLUTION_PX,
  VIRTUAL_SIDE_PX,
  PIXEL_SIZE_CM,
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
} from './terrainEngine';
import {
  createSurfaceEcosystemPatch,
  PATCH_BUILDERS,
  disposeObject3DTree,
} from './surfaceEcosystem3D';
import * as THREE from 'three';
import { ProceduralPrefabFactory } from './proceduralModels';
import { SAMPLE_PHOTO_PRESETS } from './samplePhotos';
import * as constantsMod from './constants';
import * as registryMod from './registry';
import * as biomesMod from './registry/biomes';
import * as prefabsMod from './registry/prefabs';
import * as brushesMod from './brushes';
import * as sculptingMod from './sculpting';
import * as generationMod from './generation';

test('world dimensions are 10x10km, 10,000,000,000px (100x increase, 10cm/px) vector resolution, 1km max elevation, multi-page brush scales (5m, 25m, 100m, 500m, 2.5km), 3-5cm real grass, customizable 3D flowers, and 1:1 real building dimensions', () => {
  assert.equal(WORLD_SIZE, 10000);
  assert.equal(WORLD_SIZE_KM, 10);
  assert.equal(MAX_ELEVATION, 1000);
  assert.equal(VIRTUAL_SIDE_PX, 100000);
  assert.equal(VIRTUAL_RESOLUTION_PX, 10000000000);
  assert.equal(PIXEL_SIZE_CM, 10);
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

  // Verify sample photo preset and starter flat earth terrain include all 7 featured reference mountains
  const volcanoPreset = SAMPLE_PHOTO_PRESETS.find((p) => p.id === 'island_volcano_ref');
  assert.ok(volcanoPreset);
  assert.equal(volcanoPreset.imageUrl, '/assets/aistudio/image_19e38ffa.png');
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

test('applySculptBrush and applyTextureBrush populate dirty-rect outBounds and compute surface normals only within dirtyRect', () => {
  const world = generateFlatEarthTerrain('mondstadt_meadow');
  const sculptBounds = { minIx: 0, maxIx: GRID_SIZE, minIz: 0, maxIz: GRID_SIZE };
  const sculptNormals = new Float32Array(TOTAL_VERTICES * 3);
  const sentinelValue = 7.5;
  sculptNormals.fill(sentinelValue);

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
    sculptBounds,
    sculptNormals
  );
  assert.ok(changed > 0);
  // Distant corner vertex normal (0, 0) outside dirtyRect must remain untouched (sentinelValue)
  assert.equal(
    sculptNormals[0],
    sentinelValue,
    'applySculptBrush must not touch normals outside the padded dirtyRect'
  );
  // Center vertex normal inside dirtyRect must be recomputed to unit length
  const centerIdx = (GRID_SIZE / 2) * (GRID_SIZE + 1) + GRID_SIZE / 2;
  const cLen = Math.hypot(
    sculptNormals[centerIdx * 3],
    sculptNormals[centerIdx * 3 + 1],
    sculptNormals[centerIdx * 3 + 2]
  );
  assert.ok(Math.abs(cLen - 1.0) < 1e-5, 'applySculptBrush must recompute unit normals inside dirtyRect');
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

  // Verify computePartialVertexNormals updates only the 1-cell padded dirtyRect instead of all 25,921 vertices
  const normalArray = new Float32Array(TOTAL_VERTICES * 3);
  for (let i = 0; i < TOTAL_VERTICES; i++) {
    normalArray[i * 3 + 1] = 1.0; // Initial flat terrain up-normal (0, 1, 0)
  }

  const { paddedRect, updatedVertexCount } = sculptingMod.computePartialVertexNormals(
    world.heightMap,
    normalArray,
    sculptBounds
  );
  assert.equal(paddedRect.minIx, Math.max(0, sculptBounds.minIx - 1));
  assert.equal(paddedRect.maxIx, Math.min(GRID_SIZE, sculptBounds.maxIx + 1));
  assert.equal(paddedRect.minIz, Math.max(0, sculptBounds.minIz - 1));
  assert.equal(paddedRect.maxIz, Math.min(GRID_SIZE, sculptBounds.maxIz + 1));
  assert.ok(
    updatedVertexCount < 100 && updatedVertexCount < TOTAL_VERTICES / 250,
    `computePartialVertexNormals should process < 100 vertices for a 120m brush instead of ${TOTAL_VERTICES}, got ${updatedVertexCount}`
  );

  // Check that a sloped vertex near the raised center has a tilted unit normal (nx !== 0 || nz !== 0)
  const slopeIdx = centerCell * (GRID_SIZE + 1) + (centerCell + 1);
  const nx = normalArray[slopeIdx * 3];
  const ny = normalArray[slopeIdx * 3 + 1];
  const nz = normalArray[slopeIdx * 3 + 2];
  assert.ok(Math.abs(Math.hypot(nx, ny, nz) - 1.0) < 1e-5, 'Computed normal must be unit length');
  assert.ok(nx > 0.01, 'East slope of a raised peak should have positive X normal component');

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

