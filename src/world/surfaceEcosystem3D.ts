import * as THREE from 'three';
import {
  DEFAULT_GRASS_HEIGHT_CM,
  FLOWER_SPECIES_CATALOG,
  FlowerSpeciesId,
  MicroStrokeStamp,
  TextureBrushId,
  TEXTURE_BRUSHES,
} from './registry';

// Deterministic pseudo-random helper from seed integer
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Builds a single 3D flower stem + leaves + multi-petal blossom head
 * for the requested species (`cecilia_star`, `sakura_bloom`, `sun_daisy`, `lotus_waterlily`, `tulip_cup`)
 * and user-selected petal color (`flowerColorHex`).
 */
function build3DFlowerModel(
  speciesId: FlowerSpeciesId,
  colorHex: string,
  scaleMultiplier: number
): THREE.Group {
  const flowerGroup = new THREE.Group();
  const speciesCfg =
    FLOWER_SPECIES_CATALOG.find((s) => s.id === speciesId) || FLOWER_SPECIES_CATALOG[0];

  const stemMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.75,
  });
  const petalMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 0.18,
    roughness: 0.42,
    side: THREE.DoubleSide,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: speciesCfg.coreColorHex,
    emissive: speciesCfg.coreColorHex,
    emissiveIntensity: 0.32,
    roughness: 0.35,
  });

  const stemHeight = 0.52 * scaleMultiplier;
  const stemGeo = new THREE.CylinderGeometry(
    0.025 * scaleMultiplier,
    0.035 * scaleMultiplier,
    stemHeight,
    5
  );
  const stemMesh = new THREE.Mesh(stemGeo, stemMat);
  stemMesh.position.y = stemHeight * 0.5;
  flowerGroup.add(stemMesh);

  // Two small 3D stem leaves
  const leafGeo = new THREE.ConeGeometry(0.08 * scaleMultiplier, 0.22 * scaleMultiplier, 4);
  for (let side = -1; side <= 1; side += 2) {
    const leaf = new THREE.Mesh(leafGeo, stemMat);
    leaf.position.set(side * 0.08 * scaleMultiplier, stemHeight * 0.45, 0);
    leaf.rotation.z = -side * 0.85;
    flowerGroup.add(leaf);
  }

  // Blossom head group at top of stem
  const headGroup = new THREE.Group();
  headGroup.position.y = stemHeight;

  const coreRadius =
    speciesCfg.petalShape === 'ray' ? 0.14 * scaleMultiplier : 0.095 * scaleMultiplier;
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(coreRadius, 8, 6), coreMat);
  coreMesh.scale.y = 0.65;
  headGroup.add(coreMesh);

  const pCount = speciesCfg.petalCount;
  if (speciesCfg.petalShape === 'pointed') {
    // Cecilia Star: 5 pointed star petals radiating outward
    const petalGeo = new THREE.ConeGeometry(0.095 * scaleMultiplier, 0.28 * scaleMultiplier, 4);
    petalGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < pCount; i++) {
      const ang = (i / pCount) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set(
        Math.cos(ang) * 0.15 * scaleMultiplier,
        0.02 * scaleMultiplier,
        Math.sin(ang) * 0.15 * scaleMultiplier
      );
      petal.rotation.y = -ang + Math.PI / 2;
      headGroup.add(petal);
    }
  } else if (speciesCfg.petalShape === 'rounded') {
    // Sakura Bloom: 5 rounded cupped petals
    const petalGeo = new THREE.SphereGeometry(0.115 * scaleMultiplier, 8, 6);
    for (let i = 0; i < pCount; i++) {
      const ang = (i / pCount) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.scale.set(1.15, 0.28, 0.88);
      petal.position.set(
        Math.cos(ang) * 0.14 * scaleMultiplier,
        0.03 * scaleMultiplier,
        Math.sin(ang) * 0.14 * scaleMultiplier
      );
      petal.rotation.y = -ang;
      petal.rotation.z = 0.25;
      headGroup.add(petal);
    }
  } else if (speciesCfg.petalShape === 'ray') {
    // Sun Daisy: 8 slender radiating petals around golden dome
    const petalGeo = new THREE.BoxGeometry(
      0.24 * scaleMultiplier,
      0.025 * scaleMultiplier,
      0.075 * scaleMultiplier
    );
    for (let i = 0; i < pCount; i++) {
      const ang = (i / pCount) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set(
        Math.cos(ang) * 0.18 * scaleMultiplier,
        0.01 * scaleMultiplier,
        Math.sin(ang) * 0.18 * scaleMultiplier
      );
      petal.rotation.y = -ang;
      headGroup.add(petal);
    }
  } else if (speciesCfg.petalShape === 'double_cup') {
    // Glaze Lotus: Double-layered upward-cupped chalice petals
    const petalGeo = new THREE.ConeGeometry(0.09 * scaleMultiplier, 0.25 * scaleMultiplier, 4);
    for (let i = 0; i < pCount; i++) {
      const layer = i < 5 ? 0 : 1;
      const ang = ((i % 5) / 5) * Math.PI * 2 + layer * 0.62;
      const dist = (layer === 0 ? 0.12 : 0.17) * scaleMultiplier;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.position.set(Math.cos(ang) * dist, 0.06 * scaleMultiplier, Math.sin(ang) * dist);
      petal.rotation.y = -ang;
      petal.rotation.z = layer === 0 ? -0.45 : -0.78;
      headGroup.add(petal);
    }
  } else {
    // Tulip Cup: 6 upright bell-shaped petals forming a 3D chalice
    const petalGeo = new THREE.SphereGeometry(0.11 * scaleMultiplier, 7, 6);
    for (let i = 0; i < pCount; i++) {
      const ang = (i / pCount) * Math.PI * 2;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      petal.scale.set(0.65, 1.35, 0.35);
      petal.position.set(
        Math.cos(ang) * 0.1 * scaleMultiplier,
        0.09 * scaleMultiplier,
        Math.sin(ang) * 0.1 * scaleMultiplier
      );
      petal.rotation.y = -ang + Math.PI / 2;
      petal.rotation.x = 0.22;
      headGroup.add(petal);
    }
  }

  flowerGroup.add(headGroup);
  return flowerGroup;
}

/**
 * Populates a 3D grass blade carpet (`3.0 - 5.0 cm` real blade specification + multi-blade tufts)
 * inside the target group.
 */
function populate3DGrassBlades(
  targetGroup: THREE.Group,
  radius: number,
  grassHeightCm: number,
  seedBase: number,
  densityMultiplier = 1.0,
  tintHex?: number
) {
  const clampedCm = Math.max(3.0, Math.min(5.0, grassHeightCm || DEFAULT_GRASS_HEIGHT_CM));
  // Scale factor strictly proportional to 3cm..5cm setting (0.75x at 3cm -> 1.25x at 5cm)
  const cmRatio = clampedCm / 4.0;

  const bladeMatDark = new THREE.MeshStandardMaterial({
    color: tintHex ?? 0x16a34a,
    roughness: 0.68,
    flatShading: true,
  });
  const bladeMatLight = new THREE.MeshStandardMaterial({
    color: 0x4ade80,
    emissive: 0x15803d,
    emissiveIntensity: 0.12,
    roughness: 0.58,
    flatShading: true,
  });

  // 1) True 3-5cm (0.03m - 0.05m) physical micro-blade carpet + visible 3D multi-blade tufts
  const tuftCount = Math.min(
    42,
    Math.max(14, Math.round(Math.sqrt(radius) * 7.5 * densityMultiplier))
  );

  const bladeHeight = 0.46 * cmRatio * Math.min(1.6, Math.max(0.85, radius / 8));
  const bladeRadius = 0.065 * Math.min(1.5, Math.max(0.85, radius / 8));
  const centerBladeGeo = new THREE.ConeGeometry(bladeRadius, bladeHeight, 4);
  const sideBladeGeo = new THREE.ConeGeometry(bladeRadius * 0.85, bladeHeight * 0.82, 4);

  // Also add true 3-5cm (0.03m-0.05m) micro-tufts near the patch center for 1:1 close-up inspection
  const exactCmMeters = clampedCm * 0.01; // 0.03m to 0.05m
  const microBladeGeo = new THREE.ConeGeometry(exactCmMeters * 0.28, exactCmMeters, 3);

  for (let i = 0; i < tuftCount; i++) {
    const rNorm = Math.sqrt(seededRandom(seedBase + i * 17)) * 0.88;
    const angle = seededRandom(seedBase + i * 31) * Math.PI * 2;
    const tx = Math.cos(angle) * rNorm * radius;
    const tz = Math.sin(angle) * rNorm * radius;

    const tuft = new THREE.Group();
    tuft.position.set(tx, 0.02, tz);
    tuft.rotation.y = seededRandom(seedBase + i * 47) * Math.PI * 2;
    tuft.userData.isGrassTuft = true;
    tuft.userData.swayPhase = i * 0.73;
    tuft.userData.grassHeightCm = clampedCm;

    // Center tall blade
    const centerBlade = new THREE.Mesh(
      centerBladeGeo,
      i % 2 === 0 ? bladeMatLight : bladeMatDark
    );
    centerBlade.position.y = bladeHeight * 0.5;
    tuft.add(centerBlade);

    // 4 angled surrounding blades per tuft
    for (let b = 0; b < 4; b++) {
      const bAng = (b / 4) * Math.PI * 2 + 0.4;
      const sideBlade = new THREE.Mesh(
        sideBladeGeo,
        (i + b) % 2 === 0 ? bladeMatDark : bladeMatLight
      );
      sideBlade.position.set(
        Math.cos(bAng) * bladeRadius * 1.1,
        bladeHeight * 0.38,
        Math.sin(bAng) * bladeRadius * 1.1
      );
      sideBlade.rotation.z = Math.cos(bAng) * 0.34;
      sideBlade.rotation.x = Math.sin(bAng) * 0.34;
      tuft.add(sideBlade);
    }

    // Exact 3-5cm (0.03m-0.05m) physical blade right at the base
    const exactBlade = new THREE.Mesh(microBladeGeo, bladeMatLight);
    exactBlade.position.set(bladeRadius * 1.6, exactCmMeters * 0.5, 0);
    tuft.add(exactBlade);

    targetGroup.add(tuft);
  }
}

function populate3DFlowers(
  targetGroup: THREE.Group,
  radius: number,
  species: FlowerSpeciesId,
  colorHex: string,
  seedBase: number,
  countMultiplier = 1.0
) {
  const flowerCount = Math.min(
    28,
    Math.max(8, Math.round(Math.sqrt(radius) * 6.5 * countMultiplier))
  );
  const flowerScale = Math.min(1.55, Math.max(0.85, radius / 7));

  for (let i = 0; i < flowerCount; i++) {
    const rNorm = Math.sqrt(seededRandom(seedBase + i * 23 + 9)) * 0.84;
    const angle = seededRandom(seedBase + i * 41 + 3) * Math.PI * 2;
    const fx = Math.cos(angle) * rNorm * radius;
    const fz = Math.sin(angle) * rNorm * radius;

    const flower = build3DFlowerModel(
      species,
      colorHex,
      flowerScale * (0.85 + seededRandom(seedBase + i * 11) * 0.35)
    );
    flower.position.set(fx, 0.02, fz);
    flower.rotation.y = seededRandom(seedBase + i * 59) * Math.PI * 2;
    flower.userData.isFlowerStem = true;
    flower.userData.swayPhase = i * 0.9;
    targetGroup.add(flower);
  }
}

export interface PatchBuildContext {
  root: THREE.Group;
  st: MicroStrokeStamp;
  radius: number;
  seedBase: number;
  grassHeightCm: number;
  flowerSpecies: FlowerSpeciesId;
  flowerColorHex: string;
}

export type PatchBuilder = (ctx: PatchBuildContext) => void;

/**
 * Exhaustive compile-time registry of all 18 TextureBrushId surface builders.
 * If a new TextureBrushId is added to terrainEngine.ts without registering here,
 * TypeScript will immediately fail compilation (`tsc --noEmit`).
 */
export const PATCH_BUILDERS: Record<TextureBrushId, PatchBuilder> = {
  earth_soil: ({ root, radius, seedBase }) => {
    const soilClodMat = new THREE.MeshStandardMaterial({
      color: 0x785532,
      roughness: 0.92,
      flatShading: true,
    });
    const pebbleMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.88,
      flatShading: true,
    });
    const clodCount = Math.min(12, Math.max(5, Math.round(radius * 0.85)));
    for (let i = 0; i < clodCount; i++) {
      const rNorm = Math.sqrt(seededRandom(seedBase + i * 17)) * 0.78;
      const ang = seededRandom(seedBase + i * 31) * Math.PI * 2;
      const cSize = Math.max(0.22, Math.min(0.75, radius * 0.08));
      const clod = new THREE.Mesh(
        new THREE.DodecahedronGeometry(cSize, 0),
        i % 3 === 0 ? pebbleMat : soilClodMat
      );
      clod.scale.set(1.3, 0.45, 1.1);
      clod.position.set(
        Math.cos(ang) * rNorm * radius,
        cSize * 0.18,
        Math.sin(ang) * rNorm * radius
      );
      clod.rotation.y = i * 0.7;
      root.add(clod);
    }
  },
  emerald_grass: ({ root, radius, grassHeightCm, seedBase }) => {
    populate3DGrassBlades(root, radius, grassHeightCm, seedBase, 1.15);
  },
  flower_meadow: ({ root, radius, grassHeightCm, flowerSpecies, flowerColorHex, seedBase }) => {
    populate3DGrassBlades(root, radius, grassHeightCm, seedBase, 0.85);
    populate3DFlowers(root, radius, flowerSpecies, flowerColorHex, seedBase, 1.0);
  },
  desert_sand: ({ root, radius, seedBase }) => {
    const duneMatMain = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.86,
      flatShading: true,
    });
    const duneMatCrest = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.78,
      flatShading: true,
    });

    const duneCount = Math.min(12, Math.max(5, Math.round(radius * 0.85)));
    for (let i = 0; i < duneCount; i++) {
      const rNorm = Math.sqrt(seededRandom(seedBase + i * 19)) * 0.75;
      const ang = seededRandom(seedBase + i * 29) * Math.PI * 2;
      const duneR = Math.max(0.7, radius * (0.18 + seededRandom(seedBase + i * 7) * 0.14));
      const duneH = duneR * 0.34;
      const duneGeo = new THREE.ConeGeometry(duneR, duneH, 6);
      const dune = new THREE.Mesh(duneGeo, i % 2 === 0 ? duneMatMain : duneMatCrest);
      dune.position.set(
        Math.cos(ang) * rNorm * radius,
        duneH * 0.45,
        Math.sin(ang) * rNorm * radius
      );
      dune.scale.set(1.35, 1, 0.75);
      dune.rotation.y = 0.4;
      root.add(dune);
    }

    for (let rIdx = 1; rIdx <= 3; rIdx++) {
      const innerR = radius * (rIdx * 0.24);
      const outerR = innerR + Math.max(0.18, radius * 0.035);
      const rippleGeo = new THREE.RingGeometry(innerR, outerR, 48);
      rippleGeo.rotateX(-Math.PI / 2);
      const ripple = new THREE.Mesh(rippleGeo, duneMatCrest);
      ripple.position.y = 0.05 + rIdx * 0.01;
      root.add(ripple);
    }

    const grainGeo = new THREE.OctahedronGeometry(Math.max(0.08, Math.min(0.22, radius * 0.025)), 0);
    const grainMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.85,
    });
    for (let g = 0; g < 20; g++) {
      const grain = new THREE.Mesh(grainGeo, grainMat);
      const ang = (g / 20) * Math.PI * 2;
      const dist = (0.15 + (g % 5) * 0.16) * radius;
      grain.position.set(Math.cos(ang) * dist, 0.35 + (g % 4) * 0.28, Math.sin(ang) * dist);
      grain.userData.isSandSwirlParticle = true;
      grain.userData.orbitRadius = dist;
      grain.userData.orbitAngle = ang;
      grain.userData.baseHeight = 0.3 + (g % 4) * 0.25;
      root.add(grain);
    }
  },
  volcanic_lava: ({ root, radius, seedBase }) => {
    const rimGeo = new THREE.RingGeometry(radius * 0.86, radius * 1.03, 48);
    rimGeo.rotateX(-Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.92,
      flatShading: true,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.position.y = 0.06;
    root.add(rimMesh);

    const flowMatOrange = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const flowMatYellow = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    for (let w = 0; w < 6; w++) {
      const waveRadius = radius * (0.16 + w * 0.12);
      const waveGeo = new THREE.RingGeometry(
        waveRadius,
        waveRadius + Math.max(0.22, radius * 0.055),
        36
      );
      waveGeo.rotateX(-Math.PI / 2);
      const waveMesh = new THREE.Mesh(waveGeo, w % 2 === 0 ? flowMatYellow : flowMatOrange);
      waveMesh.position.y = 0.08 + w * 0.005;
      waveMesh.userData.isLavaFlowWave = true;
      waveMesh.userData.flowIndex = w;
      waveMesh.userData.patchRadius = radius;
      root.add(waveMesh);
    }

    const smokeMatDark = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      roughness: 0.95,
      transparent: true,
      opacity: 0.72,
      flatShading: true,
    });
    const smokeMatAsh = new THREE.MeshStandardMaterial({
      color: 0x71717a,
      roughness: 0.9,
      transparent: true,
      opacity: 0.58,
      flatShading: true,
    });
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });

    const basePuffSize = Math.max(0.28, Math.min(1.2, radius * 0.11));
    const smokeGeo = new THREE.DodecahedronGeometry(basePuffSize, 0);
    const maxRise = Math.max(4.5, Math.min(16, radius * 0.85));

    for (let s = 0; s < 14; s++) {
      const ang = (s / 14) * Math.PI * 2 + seededRandom(seedBase + s * 13);
      const rDist = seededRandom(seedBase + s * 29) * radius * 0.65;
      const bx = Math.cos(ang) * rDist;
      const bz = Math.sin(ang) * rDist;
      const phase = s / 14;

      const puff = new THREE.Mesh(smokeGeo, s % 2 === 0 ? smokeMatDark : smokeMatAsh);
      puff.position.set(bx, 0.5 + phase * maxRise, bz);
      puff.userData.isLavaSmokePuff = true;
      puff.userData.smokePhase = phase;
      puff.userData.baseX = bx;
      puff.userData.baseZ = bz;
      puff.userData.maxRiseHeight = maxRise;
      root.add(puff);
    }

    const emberGeo = new THREE.OctahedronGeometry(basePuffSize * 0.32, 0);
    for (let e = 0; e < 10; e++) {
      const ang = (e / 10) * Math.PI * 2;
      const rDist = seededRandom(seedBase + e * 37) * radius * 0.6;
      const bx = Math.cos(ang) * rDist;
      const bz = Math.sin(ang) * rDist;
      const phase = e / 10;

      const ember = new THREE.Mesh(emberGeo, emberMat);
      ember.position.set(bx, 0.3 + phase * maxRise * 0.85, bz);
      ember.userData.isLavaSmokePuff = true;
      ember.userData.isEmberSpark = true;
      ember.userData.smokePhase = phase;
      ember.userData.baseX = bx;
      ember.userData.baseZ = bz;
      ember.userData.maxRiseHeight = maxRise * 0.9;
      root.add(ember);
    }
  },
  river_stream: ({ root, radius }) => {
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.65,
    });
    for (let r = 0; r < 4; r++) {
      const rInner = radius * (0.2 + r * 0.18);
      const ringGeo = new THREE.RingGeometry(rInner, rInner + Math.max(0.14, radius * 0.03), 48);
      ringGeo.rotateX(-Math.PI / 2);
      const ripple = new THREE.Mesh(ringGeo, foamMat);
      ripple.position.y = 0.06 + r * 0.004;
      ripple.userData.isWaterRipple = true;
      ripple.userData.rippleIndex = r;
      root.add(ripple);
    }
  },
  lake_water: ({ root, radius }) => {
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.65,
    });
    for (let r = 0; r < 4; r++) {
      const rInner = radius * (0.2 + r * 0.18);
      const ringGeo = new THREE.RingGeometry(rInner, rInner + Math.max(0.14, radius * 0.03), 48);
      ringGeo.rotateX(-Math.PI / 2);
      const ripple = new THREE.Mesh(ringGeo, foamMat);
      ripple.position.y = 0.06 + r * 0.004;
      ripple.userData.isWaterRipple = true;
      ripple.userData.rippleIndex = r;
      root.add(ripple);
    }
  },
  dirt_cobble_road: ({ root, radius, seedBase }) => {
    const stoneMat1 = new THREE.MeshStandardMaterial({
      color: 0xa8a29e,
      roughness: 0.85,
      flatShading: true,
    });
    const stoneMat2 = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.9,
      flatShading: true,
    });
    const stoneCount = Math.min(20, Math.max(8, Math.round(radius * 1.6)));
    const stoneSize = Math.max(0.28, Math.min(0.85, radius * 0.1));
    const stoneGeo = new THREE.CylinderGeometry(stoneSize, stoneSize * 1.1, 0.12, 6);

    for (let i = 0; i < stoneCount; i++) {
      const rNorm = Math.sqrt(seededRandom(seedBase + i * 19)) * 0.8;
      const ang = seededRandom(seedBase + i * 37) * Math.PI * 2;
      const stone = new THREE.Mesh(stoneGeo, i % 2 === 0 ? stoneMat1 : stoneMat2);
      stone.position.set(
        Math.cos(ang) * rNorm * radius,
        0.05,
        Math.sin(ang) * rNorm * radius
      );
      stone.rotation.y = i * 0.6;
      root.add(stone);
    }
  },
  limestone_cliff: ({ root, radius, seedBase }) => {
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.88,
      flatShading: true,
    });
    const rockCount = Math.min(10, Math.max(4, Math.round(radius * 0.7)));
    for (let i = 0; i < rockCount; i++) {
      const rNorm = Math.sqrt(seededRandom(seedBase + i * 23)) * 0.72;
      const ang = seededRandom(seedBase + i * 41) * Math.PI * 2;
      const rSize = Math.max(0.45, Math.min(1.8, radius * 0.16));
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rSize, 0), rockMat);
      rock.position.set(
        Math.cos(ang) * rNorm * radius,
        rSize * 0.55,
        Math.sin(ang) * rNorm * radius
      );
      rock.rotation.set(i * 0.4, i * 0.8, 0);
      root.add(rock);
    }
  },
  glacier_snow: ({ root, radius, seedBase }) => {
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.22,
      roughness: 0.25,
      flatShading: true,
    });
    for (let i = 0; i < 8; i++) {
      const rNorm = Math.sqrt(seededRandom(seedBase + i * 17)) * 0.75;
      const ang = (i / 8) * Math.PI * 2;
      const shardH = Math.max(0.6, Math.min(2.2, radius * 0.22));
      const shard = new THREE.Mesh(new THREE.ConeGeometry(shardH * 0.35, shardH, 5), iceMat);
      shard.position.set(
        Math.cos(ang) * rNorm * radius,
        shardH * 0.45,
        Math.sin(ang) * rNorm * radius
      );
      root.add(shard);
    }
  },
  mars_regolith: ({ root, radius, seedBase }) => {
    const marsRockMat = new THREE.MeshStandardMaterial({
      color: 0xc2410c,
      roughness: 0.9,
      flatShading: true,
    });
    const marsDustMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0x9a3412,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.72,
    });
    const rockCount = Math.min(12, Math.max(5, Math.round(radius * 0.85)));
    for (let i = 0; i < rockCount; i++) {
      const rNorm = Math.sqrt(seededRandom(seedBase + i * 19)) * 0.78;
      const ang = seededRandom(seedBase + i * 37) * Math.PI * 2;
      const rSize = Math.max(0.35, Math.min(1.5, radius * 0.14));
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rSize, 0), marsRockMat);
      rock.scale.set(1.2, 0.68, 0.95);
      rock.position.set(
        Math.cos(ang) * rNorm * radius,
        rSize * 0.32,
        Math.sin(ang) * rNorm * radius
      );
      rock.rotation.set(i * 0.3, i * 0.9, 0);
      root.add(rock);
    }
    for (let p = 0; p < 8; p++) {
      const dustGrain = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), marsDustMat);
      dustGrain.userData.isSandSwirlParticle = true;
      dustGrain.userData.orbitRadius = (0.25 + (p / 8) * 0.6) * radius;
      dustGrain.userData.orbitAngle = (p / 8) * Math.PI * 2;
      dustGrain.userData.baseHeight = 0.45 + (p % 3) * 0.35;
      root.add(dustGrain);
    }
  },
  venus_sulfur: ({ root, radius, seedBase }) => {
    const sulfurConeMat = new THREE.MeshStandardMaterial({
      color: 0xca8a04,
      roughness: 0.82,
      flatShading: true,
    });
    const acidGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xeab308,
      emissiveIntensity: 0.65,
      roughness: 0.3,
    });
    const gasPuffMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xa16207,
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.58,
    });
    for (let i = 0; i < 5; i++) {
      const rNorm = Math.sqrt(seededRandom(seedBase + i * 23)) * 0.68;
      const ang = (i / 5) * Math.PI * 2;
      const vx = Math.cos(ang) * rNorm * radius;
      const vz = Math.sin(ang) * rNorm * radius;
      const coneH = Math.max(0.55, Math.min(1.6, radius * 0.16));
      const cone = new THREE.Mesh(
        new THREE.CylinderGeometry(coneH * 0.25, coneH * 0.65, coneH, 7),
        sulfurConeMat
      );
      cone.position.set(vx, coneH * 0.5, vz);
      root.add(cone);

      const rim = new THREE.Mesh(new THREE.RingGeometry(coneH * 0.1, coneH * 0.26, 8), acidGlowMat);
      rim.rotation.x = -Math.PI / 2;
      rim.position.set(vx, coneH + 0.02, vz);
      root.add(rim);

      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28, 0), gasPuffMat);
      puff.position.set(vx, coneH + 0.4, vz);
      puff.userData.isLavaSmokePuff = true;
      puff.userData.baseX = vx;
      puff.userData.baseZ = vz;
      puff.userData.smokePhase = i * 0.21;
      puff.userData.maxRiseHeight = Math.max(3.5, radius * 0.5);
      root.add(puff);
    }
  },
  exoplanet_basalt: ({ root, radius, seedBase }) => {
    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x3b0764,
      roughness: 0.72,
      flatShading: true,
    });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0xa855f7,
      emissiveIntensity: 0.65,
      roughness: 0.2,
      metalness: 0.45,
      flatShading: true,
    });
    for (let i = 0; i < 9; i++) {
      const rNorm = Math.sqrt(seededRandom(seedBase + i * 29)) * 0.76;
      const ang = (i / 9) * Math.PI * 2;
      const cx = Math.cos(ang) * rNorm * radius;
      const cz = Math.sin(ang) * rNorm * radius;
      const h = Math.max(0.65, Math.min(2.4, radius * 0.22));
      const shard = new THREE.Mesh(
        new THREE.ConeGeometry(h * 0.26, h, 5),
        i % 3 === 0 ? basaltMat : crystalMat
      );
      shard.position.set(cx, h * 0.48, cz);
      shard.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.18;
      root.add(shard);
    }
  },
  pluto_nitrogen_ice: ({ root, radius, seedBase }) => {
    const cryoSpikeMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.18,
      metalness: 0.45,
      flatShading: true,
    });
    const tholinRockMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      roughness: 0.85,
      flatShading: true,
    });
    for (let i = 0; i < 10; i++) {
      const rNorm = Math.sqrt(seededRandom(seedBase + i * 19)) * 0.78;
      const ang = (i / 10) * Math.PI * 2;
      const px = Math.cos(ang) * rNorm * radius;
      const pz = Math.sin(ang) * rNorm * radius;
      const h = Math.max(0.7, Math.min(2.5, radius * 0.24));
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(h * 0.28, h, 4),
        i % 4 === 0 ? tholinRockMat : cryoSpikeMat
      );
      blade.scale.set(1.2, 1.0, 0.5);
      blade.position.set(px, h * 0.48, pz);
      blade.rotation.z = 0.15;
      root.add(blade);
    }
  },
  titan_methane_liquid: ({ root, radius, seedBase }) => {
    const methaneWaveMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.65,
    });
    const icePebbleMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.42,
      flatShading: true,
    });
    const bubbleMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.8,
    });

    for (let r = 0; r < 4; r++) {
      const rInner = radius * (0.18 + r * 0.18);
      const ringGeo = new THREE.RingGeometry(rInner, rInner + Math.max(0.16, radius * 0.035), 40);
      ringGeo.rotateX(-Math.PI / 2);
      const ripple = new THREE.Mesh(ringGeo, methaneWaveMat);
      ripple.position.y = 0.06 + r * 0.004;
      ripple.userData.isWaterRipple = true;
      ripple.userData.rippleIndex = r;
      root.add(ripple);
    }

    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + 0.3;
      const dist = radius * (0.72 + (i % 2) * 0.12);
      const pSize = Math.max(0.32, Math.min(1.1, radius * 0.11));
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(pSize, 0), icePebbleMat);
      pebble.scale.set(1.25, 0.65, 1.05);
      pebble.position.set(Math.cos(ang) * dist, pSize * 0.3, Math.sin(ang) * dist);
      root.add(pebble);
    }

    for (let b = 0; b < 8; b++) {
      const ang = (b / 8) * Math.PI * 2;
      const rDist = seededRandom(seedBase + b * 31) * radius * 0.55;
      const bx = Math.cos(ang) * rDist;
      const bz = Math.sin(ang) * rDist;
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), bubbleMat);
      bubble.position.set(bx, 0.25 + (b / 8) * 3.5, bz);
      bubble.userData.isLavaSmokePuff = true;
      bubble.userData.isEmberSpark = true;
      bubble.userData.smokePhase = b / 8;
      bubble.userData.baseX = bx;
      bubble.userData.baseZ = bz;
      bubble.userData.maxRiseHeight = Math.max(3.2, radius * 0.45);
      root.add(bubble);
    }
  },
  atacama_salt_crust: ({ root, radius, seedBase }) => {
    const saltRidgeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef2f2,
      emissiveIntensity: 0.18,
      roughness: 0.45,
      flatShading: true,
    });
    const pinkSaltMat = new THREE.MeshStandardMaterial({
      color: 0xfecdd3,
      roughness: 0.55,
      flatShading: true,
    });
    const gobiPebbleMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.88,
      flatShading: true,
    });

    for (let r = 0; r < 6; r++) {
      const ang = (r / 6) * Math.PI * 2 + 0.25;
      const dist = radius * (0.28 + (r % 2) * 0.28);
      const hexRing = new THREE.Mesh(
        new THREE.TorusGeometry(Math.max(0.55, radius * 0.18), 0.08, 4, 6),
        r % 2 === 0 ? saltRidgeMat : pinkSaltMat
      );
      hexRing.rotation.x = Math.PI / 2;
      hexRing.position.set(Math.cos(ang) * dist, 0.07, Math.sin(ang) * dist);
      root.add(hexRing);
    }

    for (let i = 0; i < 8; i++) {
      const ang = seededRandom(seedBase + i * 23) * Math.PI * 2;
      const dist = Math.sqrt(seededRandom(seedBase + i * 41)) * radius * 0.82;
      const pSize = Math.max(0.24, Math.min(0.85, radius * 0.09));
      const pebble = new THREE.Mesh(new THREE.DodecahedronGeometry(pSize, 0), gobiPebbleMat);
      pebble.scale.set(1.25, 0.52, 1.05);
      pebble.position.set(Math.cos(ang) * dist, pSize * 0.22, Math.sin(ang) * dist);
      root.add(pebble);
    }
  },
  tropical_rainforest_floor: ({ root, radius, grassHeightCm, seedBase }) => {
    populate3DGrassBlades(root, radius, grassHeightCm, seedBase, 0.85, 0x059669);
    populate3DFlowers(root, radius, 'lotus_waterlily', '#fb7185', seedBase + 303);

    const fernMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.65,
      side: THREE.DoubleSide,
    });
    const fernCount = Math.min(18, Math.max(6, Math.round(radius * 1.2)));
    for (let f = 0; f < fernCount; f++) {
      const r1 = seededRandom(seedBase + f * 19 + 5);
      const r2 = seededRandom(seedBase + f * 37 + 11);
      const dist = Math.sqrt(r1) * radius * 0.86;
      const ang = r2 * Math.PI * 2;
      const fx = Math.cos(ang) * dist;
      const fz = Math.sin(ang) * dist;

      const frondGroup = new THREE.Group();
      frondGroup.position.set(fx, 0.04, fz);
      frondGroup.userData.isGrassTuft = true;
      frondGroup.userData.swayPhase = r1 * Math.PI * 2;

      for (let leaf = 0; leaf < 5; leaf++) {
        const lAng = (leaf / 5) * Math.PI * 2;
        const frond = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.68, 4), fernMat);
        frond.scale.set(1.0, 1.0, 0.28);
        frond.position.set(Math.cos(lAng) * 0.16, 0.24, Math.sin(lAng) * 0.16);
        frond.rotation.z = -Math.cos(lAng) * 0.65;
        frond.rotation.x = Math.sin(lAng) * 0.65;
        frondGroup.add(frond);
      }
      root.add(frondGroup);
    }
  },
  taiga_moss_needles: ({ root, radius, grassHeightCm, seedBase }) => {
    populate3DGrassBlades(root, radius, grassHeightCm * 0.85, seedBase, 0.72, 0x15803d);

    const coneMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.9,
      flatShading: true,
    });
    const graniteMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      flatShading: true,
    });
    const frostMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.35,
      flatShading: true,
    });

    for (let i = 0; i < 10; i++) {
      const ang = seededRandom(seedBase + i * 29) * Math.PI * 2;
      const dist = Math.sqrt(seededRandom(seedBase + i * 47)) * radius * 0.82;
      const cx = Math.cos(ang) * dist;
      const cz = Math.sin(ang) * dist;
      if (i % 3 === 0) {
        const rockSize = Math.max(0.32, Math.min(1.1, radius * 0.1));
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(rockSize, 0), graniteMat);
        rock.scale.set(1.2, 0.7, 1.0);
        rock.position.set(cx, rockSize * 0.3, cz);
        const snowCap = new THREE.Mesh(
          new THREE.DodecahedronGeometry(rockSize * 0.75, 0),
          frostMat
        );
        snowCap.scale.set(1.15, 0.35, 0.95);
        snowCap.position.set(cx, rockSize * 0.62, cz);
        root.add(rock, snowCap);
      } else {
        const pineCone = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.36, 6), coneMat);
        pineCone.position.set(cx, 0.14, cz);
        pineCone.rotation.z = 0.9;
        pineCone.rotation.y = ang;
        root.add(pineCone);
      }
    }
  },
};

const MATERIAL_TEXTURE_SLOTS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'specularMap',
  'gradientMap',
] as const;

function disposeMaterialWithTextures(mat: THREE.Material): void {
  if (mat.userData?.shared) return;
  const matRecord = mat as unknown as Record<string, unknown>;
  for (const slot of MATERIAL_TEXTURE_SLOTS) {
    const tex = matRecord[slot] as THREE.Texture | null | undefined;
    if (tex && typeof tex.dispose === 'function' && !tex.userData?.shared) {
      tex.dispose();
    }
  }
  mat.dispose();
}

/**
 * Recursively disposes geometries, textures, and materials of a 3D Group/Object3D
 * to prevent GPU memory leaks when surface patches or prefabs are removed.
 */
export function disposeObject3DTree(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !mesh.geometry.userData?.shared) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        for (const m of mesh.material) {
          disposeMaterialWithTextures(m);
        }
      } else {
        disposeMaterialWithTextures(mesh.material);
      }
    }
  });
}


/**
 * Builds a complete, animated 3D surface ecosystem patch for a MicroStrokeStamp:
 * - `emerald_grass`: Real 3D grass blades (`3-5 cm` adjustable height) swaying in the wind
 * - `flower_meadow`: Real 3D multi-petal flowers (customizable species & color) on a 3-5cm 3D grass bed
 * - `desert_sand`: 3D sculpted golden sand dunes, wind-ripple ridges & swirling sand particles
 * - `volcanic_lava`: Glowing flowing molten magma veins + rising 3D volcanic smoke plumes & glowing embers
 * - `river_stream` / `lake_water`: Animated 3D water current ripples & whitewater foam rings
 * - `dirt_cobble_road`: 3D cobblestone pavers & roadside grass tufts
 * - `limestone_cliff`: 3D craggy rock boulders
 * - `glacier_snow`: 3D snowdrifts, ice crystals & falling snowflakes
 */
export function createSurfaceEcosystemPatch(st: MicroStrokeStamp, indexSeed = 1): THREE.Group {
  const root = new THREE.Group();
  const radius = Math.max(1, st.radius);
  const bCfg = TEXTURE_BRUSHES[st.brushId] || TEXTURE_BRUSHES.emerald_grass;
  const seedBase = Math.round(Math.abs(st.x * 37 + st.z * 53 + indexSeed * 19));

  root.userData.strokeId = st.id;
  root.userData.brushId = st.brushId;
  root.userData.grassHeightCm = st.grassHeightCm ?? DEFAULT_GRASS_HEIGHT_CM;
  root.userData.flowerSpecies = st.flowerSpecies ?? 'sakura_bloom';
  root.userData.flowerColorHex = st.flowerColorHex ?? '#f472b6';

  // 1. Smooth 64-segment Vector Base Disc
  const discGeo = new THREE.CircleGeometry(radius, 64);
  discGeo.rotateX(-Math.PI / 2);

  const isWater = st.brushId === 'river_stream' || st.brushId === 'lake_water';
  const isLava = st.brushId === 'volcanic_lava';

  const baseMat = new THREE.MeshStandardMaterial({
    color: bCfg.swatchHex,
    emissive: isLava ? 0xdc2626 : 0x000000,
    emissiveIntensity: isLava ? 0.45 : 0,
    roughness: bCfg.roughness,
    metalness: isWater ? 0.28 : 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const baseDisc = new THREE.Mesh(discGeo, baseMat);
  baseDisc.position.y = 0.02;
  root.add(baseDisc);

  // 2. Specialized 3D Physical Details via exhaustive PATCH_BUILDERS registry
  const grassHeightCm = st.grassHeightCm ?? DEFAULT_GRASS_HEIGHT_CM;
  const flowerSpecies: FlowerSpeciesId = st.flowerSpecies ?? 'sakura_bloom';
  const flowerColorHex = st.flowerColorHex ?? '#f472b6';

  const builder = PATCH_BUILDERS[st.brushId] || PATCH_BUILDERS.earth_soil;
  builder({
    root,
    st,
    radius,
    seedBase,
    grassHeightCm,
    flowerSpecies,
    flowerColorHex,
  });

  return root;
}

/**
 * Animates all live 3D surface ecosystems in the scene on every frame (`tick`):
 * - 3-5cm Grass Blades & 3D Flowers swaying gently in the breeze
 * - Desert Sand Grains swirling in the wind
 * - Volcanic Lava currents flowing & Smoke Plumes + Embers rising into the sky
 * - River & Lake Water ripples undulating
 */
export function animateSurfaceEcosystems(microStrokesRoot: THREE.Group, elapsed: number) {
  for (let i = 0; i < microStrokesRoot.children.length; i++) {
    const patchGroup = microStrokesRoot.children[i];
    for (let j = 0; j < patchGroup.children.length; j++) {
      const child = patchGroup.children[j];
      const ud = child.userData;

      if (ud.isGrassTuft || ud.isFlowerStem) {
        const phase = ud.swayPhase || 0;
        child.rotation.z = Math.sin(elapsed * 2.5 + phase) * 0.11;
        child.rotation.x = Math.cos(elapsed * 1.9 + phase) * 0.07;
      } else if (ud.isLavaSmokePuff) {
        const maxRise = ud.maxRiseHeight || 6.0;
        const speed = ud.isEmberSpark ? 0.34 : 0.22;
        const progress = (elapsed * speed + (ud.smokePhase || 0)) % 1.0;
        child.position.y = 0.25 + progress * maxRise;
        child.position.x =
          (ud.baseX || 0) + Math.sin(elapsed * 1.6 + (ud.smokePhase || 0) * 6.28) * 0.45 * progress;
        child.position.z =
          (ud.baseZ || 0) + Math.cos(elapsed * 1.4 + (ud.smokePhase || 0) * 6.28) * 0.45 * progress;

        if (ud.isEmberSpark) {
          const emberScale = Math.max(0.2, 1.15 - progress * 0.85);
          child.scale.setScalar(emberScale);
        } else {
          const puffScale = 0.55 + progress * 1.35;
          child.scale.setScalar(puffScale);
        }
        child.rotation.y = elapsed * 0.8 + (ud.smokePhase || 0) * 3.14;
      } else if (ud.isLavaFlowWave) {
        const flowIdx = ud.flowIndex || 0;
        const pulse = 1.0 + Math.sin(elapsed * 3.2 - flowIdx * 0.9) * 0.08;
        child.scale.set(pulse, 1, pulse);
        child.rotation.y = elapsed * (flowIdx % 2 === 0 ? 0.35 : -0.28);
      } else if (ud.isSandSwirlParticle) {
        const orbitR = ud.orbitRadius || 2.0;
        const ang = (ud.orbitAngle || 0) + elapsed * 1.35;
        child.position.x = Math.cos(ang) * orbitR;
        child.position.z = Math.sin(ang) * orbitR;
        child.position.y = (ud.baseHeight || 0.4) + Math.sin(elapsed * 3.0 + ang) * 0.16;
        child.rotation.y = elapsed * 2.2;
      } else if (ud.isWaterRipple) {
        const rIdx = ud.rippleIndex || 0;
        const waveScale = 1.0 + Math.sin(elapsed * 2.6 - rIdx * 1.1) * 0.06;
        child.scale.set(waveScale, 1, waveScale);
      }
    }
  }
}

export interface EcosystemSpawnRule {
  prefabId: string;
  minAltitude: number;
  maxAltitude: number;
  maxSlopeRadians: number;
  density: number; // Spawn probability per sample point in [0, 1]
  scaleRange: [number, number];
  alignToNormal: boolean;
}

export interface TerrainSamplePoint {
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

/**
 * Builds a GPU-instanced `THREE.InstancedMesh` for surface ecosystem entities,
 * filtering sample points by altitude range `[minAltitude, maxAltitude]`, surface slope angle
 * `acos(n · u) <= maxSlopeRadians`, and deterministic LCG spawn probability, packing all
 * 4x4 homogeneous transforms into a single GPU draw call.
 */
export function buildInstancedEcosystem(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  samples: TerrainSamplePoint[],
  rule: EcosystemSpawnRule,
  seed = 1337
): THREE.InstancedMesh {
  const validTransforms: THREE.Matrix4[] = [];
  const upVector = new THREE.Vector3(0, 1, 0);
  const dummyObject = new THREE.Object3D();

  // Deterministic LCG PRNG
  let s = seed >>> 0;
  const nextRand = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  for (const sample of samples) {
    const { position, normal } = sample;
    if (position.y < rule.minAltitude || position.y > rule.maxAltitude) {
      continue;
    }

    const unitNormal = normal.clone().normalize();
    const slope = Math.acos(THREE.MathUtils.clamp(unitNormal.dot(upVector), -1, 1));
    if (slope > rule.maxSlopeRadians) {
      continue;
    }

    if (nextRand() > rule.density) {
      continue;
    }

    dummyObject.position.copy(position);
    dummyObject.rotation.set(0, 0, 0);

    if (rule.alignToNormal) {
      const alignQuat = new THREE.Quaternion().setFromUnitVectors(upVector, unitNormal);
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(
        upVector,
        nextRand() * Math.PI * 2
      );
      dummyObject.quaternion.copy(alignQuat.multiply(yawQuat));
    } else {
      dummyObject.rotation.y = nextRand() * Math.PI * 2;
    }

    const [minS, maxS] = rule.scaleRange;
    const scale = minS + nextRand() * (maxS - minS);
    dummyObject.scale.set(scale, scale, scale);

    dummyObject.updateMatrix();
    validTransforms.push(dummyObject.matrix.clone());
  }

  const instancedMesh = new THREE.InstancedMesh(
    geometry,
    material,
    validTransforms.length
  );
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instancedMesh.castShadow = true;
  instancedMesh.receiveShadow = true;

  for (let i = 0; i < validTransforms.length; i++) {
    instancedMesh.setMatrixAt(i, validTransforms[i]);
  }
  instancedMesh.instanceMatrix.needsUpdate = true;

  return instancedMesh;
}

