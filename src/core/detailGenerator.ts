import { MAX_LEVEL, deterministicGradientNoise2D, spacing } from './units';
import { BIOMES, BiomeId } from '../world/registry';

export interface DetailParams {
  seed: number;
  amplitude: number;
  persistence: number;
  maxDetailMeters: number;
}

export interface DetailGenerator {
  readonly maxDetailMeters: number;
  configure(p: Partial<DetailParams>): void;
  getParams(): DetailParams;
  setBiome(biomeId: string): void;
  getBiomeRoughness(): number;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  sample(x: number, z: number, level: number, baseSlope?: number): number;
  fillWindow(
    level: number,
    originX: number,
    originZ: number,
    w: number,
    h: number,
    baseSlope: Float32Array | null,
    out: Float32Array
  ): void;
}

export class DeterministicDetailGenerator implements DetailGenerator {
  private params: DetailParams = {
    seed: 1337,
    amplitude: 0.85,
    persistence: 0.52,
    maxDetailMeters: 2.0,
  };
  private biomeId = 'mondstadt_meadow';
  private biomeRoughness = BIOMES.mondstadt_meadow.roughness;
  private enabled = true;

  private octaveTableByLevel: Array<
    Array<{ invLambda: number; ampWeight: number; seed: number }>
  > = [];

  constructor(seed = 1337, maxDetailMeters = 2.0) {
    this.params.seed = seed;
    this.params.maxDetailMeters = maxDetailMeters;
    this.rebuildOctaveTable();
  }

  get maxDetailMeters(): number {
    return this.params.maxDetailMeters;
  }

  configure(p: Partial<DetailParams>): void {
    this.params = {
      ...this.params,
      ...p,
      maxDetailMeters: Math.max(
        0.1,
        Math.min(8.0, p.maxDetailMeters ?? this.params.maxDetailMeters)
      ),
    };
    this.rebuildOctaveTable();
  }

  getParams(): DetailParams {
    return { ...this.params };
  }

  setBiome(biomeId: string): void {
    this.biomeId = biomeId;
    this.biomeRoughness =
      Object.hasOwn(BIOMES, biomeId)
        ? BIOMES[biomeId as BiomeId].roughness
        : 0.85;
    this.rebuildOctaveTable();
  }

  getBiomeRoughness(): number {
    return this.biomeRoughness;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private rebuildOctaveTable(): void {
    this.octaveTableByLevel = new Array(MAX_LEVEL + 1);
    for (let level = 0; level <= MAX_LEVEL; level++) {
      const sL = spacing(level);
      const nyquist = 2.0 * sL;
      const list: Array<{ invLambda: number; ampWeight: number; seed: number }> = [];
      for (let k = 0; k < 10; k++) {
        const wavelength = 62.5 / 2 ** k;
        if (wavelength < nyquist) break;
        const ratio = wavelength / sL;
        const nyquistFade = ratio >= 4.0 ? 1.0 : Math.fround((ratio - 2.0) * 0.5);
        const ampWeight = Math.fround(
          this.params.amplitude *
            Math.pow(this.params.persistence, k) *
            this.biomeRoughness *
            nyquistFade
        );
        if (ampWeight <= 1e-5) break;
        list.push({
          invLambda: Math.fround(1.0 / wavelength),
          ampWeight,
          seed: (this.params.seed + k * 1013) | 0,
        });
      }
      this.octaveTableByLevel[level] = list;
    }
  }

  sample(x: number, z: number, level: number, baseSlope = 0.25): number {
    if (!this.enabled || this.params.amplitude <= 0) return 0;

    const clampedLevel = level <= 0 ? 0 : level >= MAX_LEVEL ? MAX_LEVEL : level | 0;
    const activeOctaves = this.octaveTableByLevel[clampedLevel];
    const numOctaves = activeOctaves.length;
    if (numOctaves === 0) return 0;

    const slopeFactor = Math.fround(0.45 + Math.min(1.55, Math.abs(baseSlope) * 1.25));
    let sum = 0;

    for (let o = 0; o < numOctaves; o++) {
      const oct = activeOctaves[o];
      const n = deterministicGradientNoise2D(
        Math.fround(x * oct.invLambda),
        Math.fround(z * oct.invLambda),
        oct.seed
      );
      sum = Math.fround(sum + n * oct.ampWeight * slopeFactor);
    }

    const maxD = this.params.maxDetailMeters;
    return Math.fround(Math.max(-maxD, Math.min(maxD, sum)));
  }

  fillWindow(
    level: number,
    originX: number,
    originZ: number,
    w: number,
    h: number,
    baseSlope: Float32Array | null,
    out: Float32Array
  ): void {
    const total = w * h;
    if (!this.enabled || this.params.amplitude <= 0) {
      out.fill(0, 0, total);
      return;
    }

    const clampedLevel = level <= 0 ? 0 : level >= MAX_LEVEL ? MAX_LEVEL : level | 0;
    const activeOctaves = this.octaveTableByLevel[clampedLevel];
    const numOctaves = activeOctaves.length;
    if (numOctaves === 0) {
      out.fill(0, 0, total);
      return;
    }

    const sL = spacing(clampedLevel);
    const maxD = this.params.maxDetailMeters;

    let ptr = 0;
    for (let j = 0; j < h; j++) {
      const wz = Math.fround(originZ + j * sL);
      for (let i = 0; i < w; i++) {
        const wx = Math.fround(originX + i * sL);
        const slope = baseSlope ? baseSlope[ptr] : 0.25;
        const slopeFactor = Math.fround(0.45 + Math.min(1.55, Math.abs(slope) * 1.25));
        let sum = 0;
        for (let o = 0; o < numOctaves; o++) {
          const oct = activeOctaves[o];
          const n = deterministicGradientNoise2D(
            Math.fround(wx * oct.invLambda),
            Math.fround(wz * oct.invLambda),
            oct.seed
          );
          sum = Math.fround(sum + n * oct.ampWeight * slopeFactor);
        }
        out[ptr++] = Math.fround(Math.max(-maxD, Math.min(maxD, sum)));
      }
    }
  }
}
