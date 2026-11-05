import { BIOMES, BiomeId, PREFAB_CATALOG, PrefabId, TEXTURE_INDEX_MAP, TextureBrushId } from './registry';

const num = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;

export interface SanitizedDetectedObject {
  prefabId: PrefabId;
  label: string;
  x: number;
  z: number;
  scale: number;
  rotationY: number;
}

export interface SanitizedAiAnalysis {
  regionName: string;
  summary: string;
  biome: BiomeId | null;
  dominantTexture: TextureBrushId | null;
  reliefScale: number;
  waterLevel: number;
  terraceSteps: number;
  detectedObjects: SanitizedDetectedObject[];
}

export function sanitizeAnalysis(raw: unknown): SanitizedAiAnalysis | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const prefabIds = new Set<string>(PREFAB_CATALOG.map((p) => p.id));
  const objs = Array.isArray(r.detectedObjects) ? r.detectedObjects : [];
  return {
    regionName: typeof r.regionName === 'string' ? r.regionName.slice(0, 80) : '',
    summary: typeof r.summary === 'string' ? r.summary.slice(0, 300) : '',
    biome:
      typeof r.biome === 'string' && Object.hasOwn(BIOMES, r.biome)
        ? (r.biome as BiomeId)
        : null,
    dominantTexture: (TEXTURE_INDEX_MAP as readonly string[]).includes(
      r.dominantTexture as string
    )
      ? (r.dominantTexture as TextureBrushId)
      : null,
    reliefScale: num(r.reliefScale, 0.6, 2.2, 1),
    waterLevel: num(r.waterLevel, -120, 80, 0),
    terraceSteps: Math.round(num(r.terraceSteps, 0, 8, 0)),
    detectedObjects: objs.slice(0, 14).flatMap((o) => {
      if (!o || typeof o !== 'object') return [];
      const p = o as Record<string, unknown>;
      if (typeof p.prefabId !== 'string' || !prefabIds.has(p.prefabId)) return [];
      return [
        {
          prefabId: p.prefabId as PrefabId,
          label: typeof p.label === 'string' ? p.label.slice(0, 60) : '',
          x: num(p.x, -48, 48, 0),
          z: num(p.z, -48, 48, 0),
          scale: num(p.scale, 0.5, 3, 1),
          rotationY: num(p.rotationY, -Math.PI * 2, Math.PI * 2, 0),
        },
      ];
    }),
  };
}
