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
} from './terrainEngine';

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
    assert.ok(Math.abs(obj.x) <= 60 && Math.abs(obj.z) <= 60, 'Starter 1:1 village objects should be placed within realistic meter distances');
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
  assert.equal(PREFAB_CATALOG.length, 28);
  const prefabIds = PREFAB_CATALOG.map((p) => p.id);
  for (const expectedId of [
    'floating_sky_island',
    'sheer_cliff_wall',
    'active_volcano',
    'abyss_chasm_vortex',
    'statue_of_seven',
    'pokemon_gym_stadium',
    'berry_apricorn_tree',
    'himalaya_matterhorn_peak',
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

