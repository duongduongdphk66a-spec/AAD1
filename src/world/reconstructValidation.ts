import {
  BIOMES,
  BiomeId,
  FLOWER_SPECIES_CATALOG,
  FlowerSpeciesId,
  PREFAB_CATALOG,
  PrefabId,
  WEATHER_CATALOG,
  WeatherId,
} from './registry';

export interface ValidatedReconstructObject {
  prefabId: PrefabId;
  x: number;
  z: number;
  scale: number;
  rotationDeg: number;
}

export interface ValidatedReconstructPayload {
  regionName: string;
  summary: string;
  biomeId: BiomeId;
  weatherId: WeatherId;
  waterLevel: number;
  elevationScale: number;
  smoothingPasses: number;
  terraceSteps: number;
  grassHeightCm: number;
  flowerSpecies: FlowerSpeciesId;
  flowerColorHex: string;
  detectedObjects: ValidatedReconstructObject[];
}

const VALID_BIOME_IDS = new Set<string>(Object.keys(BIOMES));
const VALID_WEATHER_IDS = new Set<string>(WEATHER_CATALOG.map((w) => w.id));
const VALID_PREFAB_IDS = new Set<string>(PREFAB_CATALOG.map((p) => p.id));
const VALID_FLOWER_IDS = new Set<string>(FLOWER_SPECIES_CATALOG.map((f) => f.id));

export function sniffImageMimeType(bytes: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (bytes.byteLength < 12) return null;
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function validateReconstructAiPayload(
  raw: unknown,
  fallbackBiome: BiomeId = 'mondstadt_meadow'
): ValidatedReconstructPayload {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const biomeId: BiomeId =
    typeof obj.biomeId === 'string' && VALID_BIOME_IDS.has(obj.biomeId)
      ? (obj.biomeId as BiomeId)
      : fallbackBiome;

  const weatherId: WeatherId =
    typeof obj.weatherId === 'string' && VALID_WEATHER_IDS.has(obj.weatherId)
      ? (obj.weatherId as WeatherId)
      : (BIOMES[biomeId].defaultWeather ?? 'clear_sky');

  const regionName =
    typeof obj.regionName === 'string' && obj.regionName.trim().length > 0
      ? obj.regionName.trim().slice(0, 80)
      : BIOMES[biomeId].name;

  const summary =
    typeof obj.summary === 'string' && obj.summary.trim().length > 0
      ? obj.summary.trim().slice(0, 240)
      : 'Đã tái tạo địa hình 3D từ ảnh tham chiếu.';

  const waterLevel =
    typeof obj.waterLevel === 'number' && Number.isFinite(obj.waterLevel)
      ? Math.max(-25, Math.min(25, obj.waterLevel))
      : BIOMES[biomeId].waterLevel;

  const elevationScale =
    typeof obj.elevationScale === 'number' && Number.isFinite(obj.elevationScale)
      ? Math.max(8, Math.min(85, obj.elevationScale))
      : 32;

  const smoothingPasses =
    typeof obj.smoothingPasses === 'number' && Number.isFinite(obj.smoothingPasses)
      ? Math.max(0, Math.min(5, Math.round(obj.smoothingPasses)))
      : 2;

  const terraceSteps =
    typeof obj.terraceSteps === 'number' && Number.isFinite(obj.terraceSteps)
      ? Math.max(0, Math.min(18, Math.round(obj.terraceSteps)))
      : 0;

  const grassHeightCm =
    typeof obj.grassHeightCm === 'number' && Number.isFinite(obj.grassHeightCm)
      ? Math.max(3.0, Math.min(5.0, Number(obj.grassHeightCm.toFixed(1))))
      : 4.0;

  const flowerSpecies: FlowerSpeciesId =
    typeof obj.flowerSpecies === 'string' && VALID_FLOWER_IDS.has(obj.flowerSpecies)
      ? (obj.flowerSpecies as FlowerSpeciesId)
      : 'sakura_bloom';

  const flowerColorHex =
    typeof obj.flowerColorHex === 'string' && /^#[0-9a-fA-F]{6}$/.test(obj.flowerColorHex)
      ? obj.flowerColorHex
      : '#f472b6';

  const detectedObjects: ValidatedReconstructObject[] = [];
  if (Array.isArray(obj.detectedObjects)) {
    for (const item of obj.detectedObjects.slice(0, 28)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.prefabId !== 'string' || !VALID_PREFAB_IDS.has(rec.prefabId)) continue;
      const x = typeof rec.x === 'number' && Number.isFinite(rec.x) ? Math.max(-45, Math.min(45, rec.x)) : 0;
      const z = typeof rec.z === 'number' && Number.isFinite(rec.z) ? Math.max(-45, Math.min(45, rec.z)) : 0;
      const scale =
        typeof rec.scale === 'number' && Number.isFinite(rec.scale)
          ? Math.max(0.5, Math.min(2.2, Number(rec.scale.toFixed(2))))
          : 1.0;
      const rotationDeg =
        typeof rec.rotationDeg === 'number' && Number.isFinite(rec.rotationDeg)
          ? ((Math.round(rec.rotationDeg) % 360) + 360) % 360
          : 0;

      detectedObjects.push({
        prefabId: rec.prefabId as PrefabId,
        x,
        z,
        scale,
        rotationDeg,
      });
    }
  }

  return {
    regionName,
    summary,
    biomeId,
    weatherId,
    waterLevel,
    elevationScale,
    smoothingPasses,
    terraceSteps,
    grassHeightCm,
    flowerSpecies,
    flowerColorHex,
    detectedObjects,
  };
}
