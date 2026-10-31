/**
 * Terrain Engine Modular Entrypoint:
 * - `./registry`: Modular registry of individual biomes (`src/world/registry/biomes/*`), prefabs (`src/world/registry/prefabs/*`), weather (`WEATHER_CATALOG`), textures (`TEXTURE_BRUSHES`, `TEXTURE_INDEX_MAP`), and world configuration constants.
 * - `./brushes`: Surface texture painting (`applyTextureBrush`), dirty-rect vertex coloring (`recomputeTerrainColors`), and brush scale helpers.
 * - `./sculpting`: Elevation sculpting (`applySculptBrush`), table-driven kernel handlers (`SCULPT_TOOL_HANDLERS`), bilinear ground height query (`getGroundHeightAt`), elevation stats (`getTerrainElevationStats`), and deterministic procedural noise (`hash2D`, `valueNoise2D`, `fbm2D`).
 * - `./generation`: Procedural terrain generation (`generateFlatEarthTerrain`, `generateBiomeTerrain`), RGBA reconstruction (`reconstructFromRgbaBuffer`), rule-based execution (`executeTerrainRules`), Day/Night lighting (`computeDayNightLightingState`), and save/load serialization.
 */
export * from './registry';
export * from './brushes';
export * from './sculpting';
export * from './generation';
