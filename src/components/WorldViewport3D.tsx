import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BiomeId,
  BIOMES,
  GRID_SIZE,
  MicroStrokeStamp,
  PlacedObject,
  PrefabId,
  SculptToolId,
  TextureBrushId,
  TEXTURE_BRUSHES,
  WeatherId,
  WEATHER_CATALOG,
  WORLD_SIZE,
} from '../world/registry';
import { computePartialVertexNormals, getGroundHeightAt } from '../world/sculpting';
import type { GridDirtyRect } from '../world/brushes';
import { computeDayNightLightingState } from '../world/generation';
import { createTerrainDetailTextures } from '../world/materialsAndTextures';
import { ProceduralPrefabFactory } from '../world/proceduralModels';
import {
  createSurfaceEcosystemPatch,
  animateSurfaceEcosystems,
  disposeObject3DTree,
} from '../world/surfaceEcosystem3D';
import { ActiveTabId } from './BottomControlDock';

export type CameraPresetId =
  | 'mountain_gallery'
  | 'pluto_cryo'
  | 'europa_rift'
  | 'alps_matterhorn'
  | 'himalaya_fishtail'
  | 'olympus_mons'
  | 'titan_mountain'
  | 'volcano_icon'
  | 'village'
  | 'sky_volcano'
  | 'closeup'
  | 'valley'
  | 'overview'
  | 'topdown';

export interface ScaleMetrics {
  metersPerPixel: number;
  cameraDistanceMeters: number;
}

// True 1:1 Real-World Meter Scale (1 Three.js unit = 1.0 meter in reality)
const WORLD_PROP_BASE_SCALE = 1.0;

interface WorldViewport3DProps {
  heightMap: Float32Array;
  splatMap: Uint8Array;
  colorMap: Float32Array;
  terrainVersion: number;
  dirtyRectRef?: React.MutableRefObject<GridDirtyRect | null>;
  biomeId: BiomeId;
  activeWeather?: WeatherId;
  sunElevation: number;
  sunAzimuth?: number;
  timeOfDay?: number;
  starlightMode?: boolean;
  waterLevel: number;
  placedObjects: PlacedObject[];
  microStrokes?: MicroStrokeStamp[];
  selectedObjectId: string | null;
  activeTab: ActiveTabId;
  sculptTool: SculptToolId;
  textureBrush: TextureBrushId;
  selectedPrefab: PrefabId;
  placementRotationDeg?: number;
  placementScale?: number;
  brushRadius: number;
  brushStrength: number;
  cameraPreset: CameraPresetId;
  cameraPresetTrigger: number;
  onTerrainStrokeStart?: () => void;
  onTerrainStroke: (worldX: number, worldZ: number) => void;
  onPlacePrefabAt: (worldX: number, worldZ: number) => void;
  onSelectObject: (id: string | null) => void;
  onHoverCoordsChange?: (coords: { x: number; y: number; z: number } | null) => void;
  onScaleMetricsChange?: (metrics: {
    metersPerPixel: number;
    cameraDistanceMeters: number;
  }) => void;
}

// Pre-allocated module-scope scratch objects to guarantee zero GC in render loop
const _mouseNdc = new THREE.Vector2();
const _camTargetGoal = new THREE.Vector3(0, 4, 0);
const _camPosGoal = new THREE.Vector3(38, 24, 48);

function buildPlanetaryWeatherGroup(weatherId: WeatherId): THREE.Group {
  const group = new THREE.Group();
  group.name = `weather_${weatherId}`;

  if (weatherId === 'mars_dust_storm') {
    // 1. Swirling Rust-Orange Martian Dust Particles
    const dustGeo = new THREE.DodecahedronGeometry(0.45, 0);
    const dustMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      emissive: 0x9a3412,
      emissiveIntensity: 0.35,
      roughness: 0.95,
      transparent: true,
      opacity: 0.65,
    });
    for (let i = 0; i < 110; i++) {
      const m = new THREE.Mesh(dustGeo, dustMat);
      const angle = (i * 2.39996) % (Math.PI * 2);
      const r = 4 + (i % 19) * 3.8;
      const h = 0.8 + (i % 14) * 2.2;
      m.position.set(Math.cos(angle) * r, h, Math.sin(angle) * r);
      m.scale.setScalar(0.5 + (i % 5) * 0.45);
      m.userData.isMarsStormParticle = true;
      m.userData.orbitRadius = r;
      m.userData.orbitAngle = angle;
      m.userData.orbitSpeed = 0.7 + (i % 5) * 0.22;
      m.userData.baseY = h;
      group.add(m);
    }

    // 2. Two Towering Martian Dust Devil Funnels (Lốc Xoáy Bụi Sao Hỏa)
    const funnelOffsets = [
      { x: -18, z: -14, scale: 1.0 },
      { x: 24, z: 12, scale: 0.8 },
    ];
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.48,
      side: THREE.DoubleSide,
    });
    for (let f = 0; f < funnelOffsets.length; f++) {
      const fo = funnelOffsets[f];
      const devil = new THREE.Group();
      devil.position.set(fo.x, 0, fo.z);
      devil.userData.isMarsDustDevil = true;
      devil.userData.baseX = fo.x;
      devil.userData.baseZ = fo.z;
      devil.userData.phase = f * 2.5;
      for (let k = 0; k < 10; k++) {
        const ringR = (0.9 + k * 0.52) * fo.scale;
        const torus = new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.18 + k * 0.03, 6, 18), ringMat);
        torus.rotation.x = Math.PI / 2 + (k % 2 === 0 ? 0.08 : -0.08);
        torus.position.y = 0.8 + k * 2.4 * fo.scale;
        devil.add(torus);
      }
      group.add(devil);
    }
  } else if (weatherId === 'venus_acid_rain') {
    // 1. Venusian Sulfuric Acid Rain Streaks (Mưa Axit Sunfuric)
    const dropGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.4, 5);
    const dropMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.72,
    });
    for (let i = 0; i < 135; i++) {
      const drop = new THREE.Mesh(dropGeo, dropMat);
      const rx = ((i * 37) % 130) - 65;
      const rz = ((i * 53) % 130) - 65;
      const ry = (i * 1.9) % 45;
      drop.position.set(rx, ry, rz);
      drop.rotation.z = 0.18;
      drop.userData.isAcidRainDrop = true;
      drop.userData.fallSpeed = 24 + (i % 7) * 3.5;
      group.add(drop);
    }

    // 2. Upper Toxic Sulfur Cloud Canopy & Lightning Bolts
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xca8a04,
      emissive: 0xa16207,
      emissiveIntensity: 0.45,
      roughness: 0.9,
      transparent: true,
      opacity: 0.5,
    });
    for (let c = 0; c < 18; c++) {
      const angle = (c / 18) * Math.PI * 2;
      const r = 12 + (c % 4) * 14;
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(4.8 + (c % 3) * 1.8, 1), cloudMat);
      puff.position.set(Math.cos(angle) * r, 32 + (c % 3) * 3.5, Math.sin(angle) * r);
      puff.scale.set(1.6, 0.45, 1.3);
      puff.userData.isVenusSulfurCloud = true;
      puff.userData.phase = c * 0.6;
      group.add(puff);
    }
  } else if (weatherId === 'exoplanet_meteor_shower') {
    // Exoplanet Shooting Meteor Shower Streaks (Mưa Sao Băng & Thiên Thạch Ngoại Hành Tinh)
    const tailGeo = new THREE.ConeGeometry(0.28, 7.5, 8);
    tailGeo.rotateZ(-Math.PI / 3);
    const headGeo = new THREE.OctahedronGeometry(0.42, 0);

    const colors = [0x38bdf8, 0xc084fc, 0xfbbf24, 0x2dd4bf];
    for (let i = 0; i < 28; i++) {
      const meteor = new THREE.Group();
      const col = colors[i % colors.length];
      const tailMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.78,
      });
      const headMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
      });
      const tail = new THREE.Mesh(tailGeo, tailMat);
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.set(-2.8, -1.6, 0);
      meteor.add(tail, head);

      const startX = ((i * 43) % 160) - 60;
      const startY = 14 + ((i * 19) % 48);
      const startZ = ((i * 61) % 140) - 70;
      meteor.position.set(startX, startY, startZ);
      meteor.userData.isMeteorStreak = true;
      meteor.userData.speed = 26 + (i % 6) * 5;
      meteor.userData.originX = startX + 45;
      meteor.userData.originY = 42 + (i % 5) * 6;
      meteor.userData.originZ = startZ;
      group.add(meteor);
    }
  } else if (weatherId === 'ion_aurora_tempest') {
    // 1. Shimmering Ion Aurora Curtains (Bão Từ Cực Quang TRAPPIST-1e)
    const auroraColors = [0x2dd4bf, 0x38bdf8, 0xf43f5e, 0xa855f7];
    for (let a = 0; a < 8; a++) {
      const col = auroraColors[a % auroraColors.length];
      const ribbonMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      });
      const ribbon = new THREE.Mesh(new THREE.TorusGeometry(22 + a * 6, 1.4, 8, 40, Math.PI * 1.35), ribbonMat);
      ribbon.rotation.x = Math.PI / 2 + (a % 2 === 0 ? 0.16 : -0.16);
      ribbon.rotation.z = a * 0.7;
      ribbon.position.y = 26 + a * 2.5;
      ribbon.userData.isAuroraRibbon = true;
      ribbon.userData.phase = a * 0.8;
      group.add(ribbon);
    }

    // 2. Floating Diamond-Dust Ice Crystals
    const iceGeo = new THREE.OctahedronGeometry(0.24, 0);
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.4,
    });
    for (let i = 0; i < 85; i++) {
      const crystal = new THREE.Mesh(iceGeo, iceMat);
      const rx = ((i * 29) % 110) - 55;
      const rz = ((i * 47) % 110) - 55;
      const ry = 1.2 + (i % 18) * 1.4;
      crystal.position.set(rx, ry, rz);
      crystal.userData.isAuroraCrystal = true;
      crystal.userData.baseY = ry;
      crystal.userData.phase = i * 0.35;
      group.add(crystal);
    }
  } else if (weatherId === 'ash_ember_fall') {
    // Volcanic Ash & Glowing Magma Embers (Mưa Tro Núi Lửa & Tàn Lửa)
    const emberGeo = new THREE.OctahedronGeometry(0.18, 0);
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const ashMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });

    for (let i = 0; i < 95; i++) {
      const isEmber = i % 2 === 0;
      const p = new THREE.Mesh(emberGeo, isEmber ? emberMat : ashMat);
      const rx = ((i * 31) % 110) - 55;
      const rz = ((i * 59) % 110) - 55;
      const ry = 0.5 + (i % 25) * 1.3;
      p.position.set(rx, ry, rz);
      p.userData.isAshEmber = true;
      p.userData.isRisingEmber = isEmber;
      p.userData.speed = 2.2 + (i % 5) * 0.8;
      p.userData.phase = i * 0.4;
      group.add(p);
    }
  } else if (weatherId === 'supersonic_mars_storm') {
    // 1. Supersonic Horizontal Dust Shockwave Streaks (Vệt Bão Bụi Siêu Thanh Ngang)
    const streakGeo = new THREE.BoxGeometry(5.8, 0.14, 0.14);
    const streakMat = new THREE.MeshBasicMaterial({
      color: 0xf97316,
      transparent: true,
      opacity: 0.78,
    });
    for (let i = 0; i < 80; i++) {
      const streak = new THREE.Mesh(streakGeo, streakMat);
      const rx = ((i * 41) % 140) - 70;
      const rz = ((i * 59) % 130) - 65;
      const ry = 0.9 + (i % 18) * 1.6;
      streak.position.set(rx, ry, rz);
      streak.scale.x = 0.8 + (i % 4) * 0.45;
      streak.userData.isSupersonicDustStreak = true;
      streak.userData.speed = 46 + (i % 6) * 8;
      group.add(streak);
    }

    // 2. Four Giant Supersonic Martian Dust Devil Vortices
    const vortexOffsets = [
      { x: -24, z: -18, scale: 1.25 },
      { x: 26, z: -12, scale: 1.1 },
      { x: -16, z: 18, scale: 0.95 },
      { x: 20, z: 16, scale: 1.15 },
    ];
    const vortexMat = new THREE.MeshBasicMaterial({
      color: 0xea580c,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    for (let f = 0; f < vortexOffsets.length; f++) {
      const vo = vortexOffsets[f];
      const devil = new THREE.Group();
      devil.position.set(vo.x, 0, vo.z);
      devil.userData.isMarsDustDevil = true;
      devil.userData.baseX = vo.x;
      devil.userData.baseZ = vo.z;
      devil.userData.phase = f * 1.7;
      for (let k = 0; k < 11; k++) {
        const ringR = (1.0 + k * 0.56) * vo.scale;
        const torus = new THREE.Mesh(
          new THREE.TorusGeometry(ringR, 0.22 + k * 0.03, 6, 18),
          vortexMat
        );
        torus.rotation.x = Math.PI / 2 + (k % 2 === 0 ? 0.1 : -0.1);
        torus.position.y = 0.8 + k * 2.5 * vo.scale;
        devil.add(torus);
      }
      group.add(devil);
    }

    // 3. Triboelectric Static Lightning Arcs inside Dust Storm
    const boltMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.9,
    });
    for (let b = 0; b < 8; b++) {
      const bolt = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), boltMat);
      bolt.scale.set(0.35, 4.5, 0.35);
      bolt.position.set(((b * 37) % 90) - 45, 6 + (b % 4) * 4.5, ((b * 53) % 90) - 45);
      bolt.rotation.z = (b % 2 === 0 ? 1 : -1) * 0.45;
      bolt.userData.isStaticLightningBolt = true;
      bolt.userData.phase = b * 0.9;
      group.add(bolt);
    }
  } else if (weatherId === 'concentrated_venus_acid') {
    // 1. Dense Concentrated Sulfuric Acid Downpour (Mưa Axit Sunfuric Cô Đặc)
    const acidGeo = new THREE.CylinderGeometry(0.055, 0.055, 3.4, 5);
    const acidMatMain = new THREE.MeshBasicMaterial({
      color: 0xbef264,
      transparent: true,
      opacity: 0.82,
    });
    const acidMatGold = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.78,
    });
    for (let i = 0; i < 155; i++) {
      const drop = new THREE.Mesh(acidGeo, i % 2 === 0 ? acidMatMain : acidMatGold);
      const rx = ((i * 31) % 130) - 65;
      const rz = ((i * 47) % 130) - 65;
      const ry = (i * 1.7) % 44;
      drop.position.set(rx, ry, rz);
      drop.rotation.z = 0.24;
      drop.userData.isAcidRainDrop = true;
      drop.userData.fallSpeed = 32 + (i % 7) * 4.5;
      group.add(drop);
    }

    // 2. Jagged 3D Super-Pressure Venusian Lightning Bolts
    const lightningMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
    });
    for (let l = 0; l < 6; l++) {
      const boltGroup = new THREE.Group();
      const bx = ((l * 43) % 96) - 48;
      const bz = ((l * 61) % 96) - 48;
      boltGroup.position.set(bx, 0, bz);
      boltGroup.userData.isStaticLightningBolt = true;
      boltGroup.userData.phase = l * 1.15;

      for (let seg = 0; seg < 5; seg++) {
        const segMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.22, 6.5, 5),
          lightningMat
        );
        segMesh.position.set((seg % 2 === 0 ? 1 : -1) * 0.65, 3.0 + seg * 5.6, 0);
        segMesh.rotation.z = (seg % 2 === 0 ? 1 : -1) * 0.28;
        boltGroup.add(segMesh);
      }
      group.add(boltGroup);
    }

    // 3. Ground Corrosion Acid Vapor Rings
    const mistRingMat = new THREE.MeshBasicMaterial({
      color: 0xa3e635,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    for (let m = 0; m < 10; m++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.4, 24), mistRingMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(((m * 29) % 90) - 45, 0.35, ((m * 43) % 90) - 45);
      ring.userData.isCryoGroundMist = true;
      ring.userData.phase = m * 0.65;
      group.add(ring);
    }
  } else if (weatherId === 'liquid_nitrogen_snow') {
    // 1. Slow-Drifting Cyan Liquid Nitrogen Snowflakes & Golden Methane Frost Crystals (Titan / Pluto)
    const flakeGeo = new THREE.OctahedronGeometry(0.32, 0);
    const nitrogenMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.72,
      roughness: 0.15,
    });
    const methaneMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.58,
      roughness: 0.2,
    });

    for (let i = 0; i < 120; i++) {
      const flake = new THREE.Mesh(flakeGeo, i % 3 === 0 ? methaneMat : nitrogenMat);
      flake.scale.set(1.25, 0.45, 1.25);
      const rx = ((i * 37) % 130) - 65;
      const rz = ((i * 53) % 130) - 65;
      const ry = 0.6 + (i % 26) * 1.5;
      flake.position.set(rx, ry, rz);
      flake.userData.isNitrogenSnowflake = true;
      flake.userData.fallSpeed = 3.2 + (i % 5) * 0.9;
      flake.userData.phase = i * 0.45;
      group.add(flake);
    }

    // 2. Cryogenic -230°C Ground Fog Rings
    const cryoMistMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
    });
    for (let m = 0; m < 8; m++) {
      const mist = new THREE.Mesh(new THREE.RingGeometry(2.0, 4.2, 28), cryoMistMat);
      mist.rotation.x = -Math.PI / 2;
      mist.position.set(((m * 31) % 88) - 44, 0.3, ((m * 47) % 88) - 44);
      mist.userData.isCryoGroundMist = true;
      mist.userData.phase = m * 0.8;
      group.add(mist);
    }
  } else if (weatherId === 'cryo_geyser_blizzard') {
    // 1. Erupting Cryovolcanic Geyser Plume Columns shooting 36m upward (Pluto / Europa)
    const geyserCoords = [
      { x: -22, z: -16 },
      { x: 22, z: -14 },
      { x: -16, z: 16 },
      { x: 20, z: 14 },
      { x: 0, z: -24 },
    ];
    const jetGeo = new THREE.ConeGeometry(0.55, 2.2, 6);
    const jetMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.78,
    });

    for (let g = 0; g < geyserCoords.length; g++) {
      const gc = geyserCoords[g];
      for (let p = 0; p < 14; p++) {
        const jet = new THREE.Mesh(jetGeo, jetMat);
        const progress = p / 14;
        jet.position.set(gc.x, 1.0 + progress * 34, gc.z);
        jet.userData.isCryoGeyserJet = true;
        jet.userData.baseX = gc.x;
        jet.userData.baseZ = gc.z;
        jet.userData.jetPhase = progress + g * 0.19;
        group.add(jet);
      }
    }

    // 2. Swirling Blizzard Ice Shards
    const shardGeo = new THREE.OctahedronGeometry(0.26, 0);
    const shardMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    for (let i = 0; i < 85; i++) {
      const shard = new THREE.Mesh(shardGeo, shardMat);
      shard.position.set(((i * 33) % 120) - 60, 1 + (i % 22) * 1.6, ((i * 49) % 120) - 60);
      shard.userData.isNitrogenSnowflake = true;
      shard.userData.fallSpeed = 6.5 + (i % 4) * 1.5;
      shard.userData.phase = i * 0.35;
      group.add(shard);
    }
  } else if (weatherId === 'molten_silicate_rain') {
    // Blazing Diagonal Molten Silicate & Quartz Rain on Exoplanet CoRoT-7b
    const silicateGeo = new THREE.ConeGeometry(0.14, 3.2, 5);
    silicateGeo.rotateZ(-0.45);
    const silicateMatHot = new THREE.MeshBasicMaterial({ color: 0xfda4af });
    const silicateMatMagma = new THREE.MeshBasicMaterial({ color: 0xf97316 });

    for (let i = 0; i < 110; i++) {
      const drop = new THREE.Mesh(
        silicateGeo,
        i % 2 === 0 ? silicateMatHot : silicateMatMagma
      );
      const rx = ((i * 37) % 130) - 65;
      const rz = ((i * 53) % 130) - 65;
      const ry = (i * 1.9) % 44;
      drop.position.set(rx, ry, rz);
      drop.userData.isAcidRainDrop = true;
      drop.userData.fallSpeed = 36 + (i % 6) * 5;
      group.add(drop);
    }
  } else if (weatherId === 'himalaya_blizzard') {
    // 1. Swirling High-Altitude Himalaya / Alps / Andes Snowflakes & Ice Crystals
    const snowGeo = new THREE.OctahedronGeometry(0.28, 0);
    const snowMatWhite = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.45,
      roughness: 0.2,
    });
    const snowMatIce = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.55,
      roughness: 0.15,
    });

    for (let i = 0; i < 130; i++) {
      const flake = new THREE.Mesh(snowGeo, i % 3 === 0 ? snowMatIce : snowMatWhite);
      const rx = ((i * 37) % 130) - 65;
      const rz = ((i * 53) % 130) - 65;
      const ry = 0.6 + (i % 26) * 1.5;
      flake.position.set(rx, ry, rz);
      flake.userData.isNitrogenSnowflake = true;
      flake.userData.fallSpeed = 5.5 + (i % 5) * 1.4;
      flake.userData.phase = i * 0.4;
      group.add(flake);
    }

    // 2. Alpine Jet-Stream Wind Gust Streaks
    const gustGeo = new THREE.BoxGeometry(5.2, 0.1, 0.1);
    const gustMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.65,
    });
    for (let g = 0; g < 55; g++) {
      const gust = new THREE.Mesh(gustGeo, gustMat);
      gust.position.set(
        ((g * 41) % 140) - 70,
        1.5 + (g % 16) * 1.8,
        ((g * 59) % 130) - 65
      );
      gust.userData.isSupersonicDustStreak = true;
      gust.userData.speed = 34 + (g % 5) * 6;
      group.add(gust);
    }
  } else if (weatherId === 'tropical_monsoon_rain') {
    // 1. Dense Amazon & Congo Equatorial Monsoon Rain Downpour
    const rainGeo = new THREE.CylinderGeometry(0.032, 0.032, 2.8, 5);
    const rainMat = new THREE.MeshBasicMaterial({
      color: 0x6ee7b7,
      transparent: true,
      opacity: 0.68,
    });
    const rainMatCyan = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.72,
    });
    for (let i = 0; i < 150; i++) {
      const drop = new THREE.Mesh(rainGeo, i % 2 === 0 ? rainMat : rainMatCyan);
      const rx = ((i * 31) % 130) - 65;
      const rz = ((i * 47) % 130) - 65;
      const ry = (i * 1.8) % 44;
      drop.position.set(rx, ry, rz);
      drop.rotation.z = 0.14;
      drop.userData.isAcidRainDrop = true;
      drop.userData.fallSpeed = 28 + (i % 6) * 4;
      group.add(drop);
    }

    // 2. Rising Equatorial Rainforest Canopy Mist Rings
    const jungleMistMat = new THREE.MeshBasicMaterial({
      color: 0xa7f3d0,
      transparent: true,
      opacity: 0.36,
      side: THREE.DoubleSide,
    });
    for (let m = 0; m < 10; m++) {
      const mist = new THREE.Mesh(new THREE.RingGeometry(2.2, 4.6, 28), jungleMistMat);
      mist.rotation.x = -Math.PI / 2;
      mist.position.set(((m * 29) % 90) - 45, 0.4 + (m % 3) * 1.2, ((m * 43) % 90) - 45);
      mist.userData.isCryoGroundMist = true;
      mist.userData.phase = m * 0.7;
      group.add(mist);
    }
  }

  return group;
}

function buildCelestialSkySystem(): {
  celestialRoot: THREE.Group;
  starDomeMat: THREE.PointsMaterial;
  milkyWayMat: THREE.PointsMaterial;
  constellationGroup: THREE.Group;
  sunOrbGroup: THREE.Group;
  moonOrbGroup: THREE.Group;
} {
  const celestialRoot = new THREE.Group();
  celestialRoot.name = 'celestial_day_night_sky';

  // 1. Multi-spectral Starfield Dome (1,800 stars spanning horizon to zenith so visible from village camera)
  const starCount = 1800;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const palette = [
    new THREE.Color(0xffffff), // Pure white
    new THREE.Color(0x93c5fd), // Sirius blue-white
    new THREE.Color(0xfde68a), // Capella gold
    new THREE.Color(0xfdba74), // Betelgeuse warm amber
    new THREE.Color(0xc4b5fd), // Vega violet-white
  ];

  for (let i = 0; i < starCount; i++) {
    const theta = ((i * 2.3999632) % (Math.PI * 2));
    // Bias elevation toward low-to-mid sky (1° to 75°) so stars fill the viewport behind buildings & mountains
    const u = (i + 0.5) / starCount;
    const phi = THREE.MathUtils.degToRad(1.5 + Math.pow(u, 1.35) * 82);
    const radius = 260 + (i % 7) * 45;

    starPositions[i * 3] = Math.cos(phi) * Math.cos(theta) * radius;
    starPositions[i * 3 + 1] = Math.sin(phi) * radius - 14;
    starPositions[i * 3 + 2] = Math.cos(phi) * Math.sin(theta) * radius;

    const c = palette[i % palette.length];
    const brightness = 0.75 + (i % 5) * 0.06;
    starColors[i * 3] = c.r * brightness;
    starColors[i * 3 + 1] = c.g * brightness;
    starColors[i * 3 + 2] = c.b * brightness;
  }

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starDomeMat = new THREE.PointsMaterial({
    size: 2.6,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const starDomePoints = new THREE.Points(starGeo, starDomeMat);
  starDomePoints.name = 'star_dome_points';
  celestialRoot.add(starDomePoints);

  // 2. Milky Way Galactic Band (900 concentrated nebula/star particles arching across the sky)
  const mwCount = 900;
  const mwPositions = new Float32Array(mwCount * 3);
  const mwColors = new Float32Array(mwCount * 3);
  for (let i = 0; i < mwCount; i++) {
    const t = (i / mwCount) * Math.PI * 2;
    const bandSpread = (((i * 73) % 100) / 100 - 0.5) * 0.32;
    const radius = 240 + (i % 5) * 20;
    const x = Math.cos(t) * radius;
    const y = Math.abs(Math.sin(t)) * 135 + 10 + bandSpread * 45;
    const z = Math.sin(t) * radius;
    // Tilt galactic plane
    mwPositions[i * 3] = x * 0.88 - y * 0.22;
    mwPositions[i * 3 + 1] = Math.max(4, y * 0.88 + Math.abs(x) * 0.12);
    mwPositions[i * 3 + 2] = z;

    const isCyan = i % 3 === 0;
    const col = isCyan ? new THREE.Color(0x38bdf8) : new THREE.Color(0xe879f9);
    mwColors[i * 3] = col.r;
    mwColors[i * 3 + 1] = col.g;
    mwColors[i * 3 + 2] = col.b;
  }
  const mwGeo = new THREE.BufferGeometry();
  mwGeo.setAttribute('position', new THREE.BufferAttribute(mwPositions, 3));
  mwGeo.setAttribute('color', new THREE.BufferAttribute(mwColors, 3));
  const milkyWayMat = new THREE.PointsMaterial({
    size: 3.4,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const milkyWayPoints = new THREE.Points(mwGeo, milkyWayMat);
  milkyWayPoints.name = 'milky_way_band';
  celestialRoot.add(milkyWayPoints);

  // 3. 3D Luminous Constellation Stars, Nocturnal Shooting Stars & Bioluminescent Starlight Motes
  const constellationGroup = new THREE.Group();
  constellationGroup.name = 'constellation_and_shooting_stars';
  const brightStarGeo = new THREE.OctahedronGeometry(0.95, 0);
  const brightStarColors = [0xfef08a, 0x7dd3fc, 0xf5d0fe, 0xffffff];

  for (let i = 0; i < 68; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: brightStarColors[i % brightStarColors.length],
      transparent: true,
      opacity: 0.98,
      fog: false,
    });
    const starMesh = new THREE.Mesh(brightStarGeo, mat);
    // Distribute half across the primary camera horizon window (-X/-Z) and half 360° around
    const angle =
      i < 34
        ? Math.PI * 1.02 + ((i / 34) - 0.5) * 1.15
        : ((i - 34) / 34) * Math.PI * 2;
    const dist = 78 + (i % 5) * 18;
    const height = 21 + (i % 8) * 2.8;
    starMesh.position.set(Math.cos(angle) * dist, height, Math.sin(angle) * dist);
    const baseScale = 0.55 + (i % 4) * 0.28;
    starMesh.scale.setScalar(baseScale);
    starMesh.userData.isTwinkleStar = true;
    starMesh.userData.baseScale = baseScale;
    starMesh.userData.phase = i * 0.65;
    constellationGroup.add(starMesh);
  }

  // 4 Nocturnal Shooting Stars (Sao băng đêm)
  const shootingGeo = new THREE.ConeGeometry(0.32, 8.5, 6);
  shootingGeo.rotateZ(Math.PI / 2);
  const shootingMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.95,
    fog: false,
  });
  for (let s = 0; s < 4; s++) {
    const streak = new THREE.Mesh(shootingGeo, shootingMat);
    const ox = -55 + s * 22;
    const oy = 25 + (s % 3) * 4;
    const oz = -68 - s * 14;
    streak.position.set(ox, oy, oz);
    streak.rotation.z = -0.28;
    streak.userData.isNightShootingStar = true;
    streak.userData.originX = ox;
    streak.userData.originY = oy;
    streak.userData.originZ = oz;
    streak.userData.speed = 32 + s * 8;
    constellationGroup.add(streak);
  }
  constellationGroup.visible = false;
  celestialRoot.add(constellationGroup);

  // 4. 3D Solar Disc & Corona Halo
  const sunOrbGroup = new THREE.Group();
  sunOrbGroup.name = 'solar_orb_group';
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(9.5, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false })
  );
  const sunHalo = new THREE.Mesh(
    new THREE.RingGeometry(10.5, 19.5, 32),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      fog: false,
    })
  );
  sunOrbGroup.add(sunCore, sunHalo);
  celestialRoot.add(sunOrbGroup);

  // 5. 3D Lunar Sphere & Silver Moon Halo
  const moonOrbGroup = new THREE.Group();
  moonOrbGroup.name = 'lunar_orb_group';
  const moonCore = new THREE.Mesh(
    new THREE.SphereGeometry(7.8, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe, fog: false })
  );
  const moonHalo = new THREE.Mesh(
    new THREE.RingGeometry(8.6, 16.0, 32),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      fog: false,
    })
  );
  moonOrbGroup.add(moonCore, moonHalo);
  celestialRoot.add(moonOrbGroup);

  return {
    celestialRoot,
    starDomeMat,
    milkyWayMat,
    constellationGroup,
    sunOrbGroup,
    moonOrbGroup,
  };
}

export const WorldViewport3D: React.FC<WorldViewport3DProps> = ({
  heightMap,
  colorMap,
  terrainVersion,
  dirtyRectRef,
  biomeId,
  activeWeather = 'clear_sky',
  sunElevation,
  sunAzimuth = 135,
  timeOfDay = 10.5,
  starlightMode = false,
  waterLevel,
  placedObjects,
  microStrokes = [],
  selectedObjectId,
  activeTab,
  placementRotationDeg = 0,
  placementScale = 1.0,
  brushRadius,
  cameraPreset,
  cameraPresetTrigger,
  onTerrainStrokeStart,
  onTerrainStroke,
  onPlacePrefabAt,
  onSelectObject,
  onHoverCoordsChange,
  onScaleMetricsChange,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  const latestPropsRef = useRef({
    activeTab,
    brushRadius,
    placementRotationDeg,
    placementScale,
    selectedObjectId,
    onTerrainStrokeStart,
    onTerrainStroke,
    onPlacePrefabAt,
    onSelectObject,
    onHoverCoordsChange,
    onScaleMetricsChange,
  });
  useEffect(() => {
    latestPropsRef.current = {
      activeTab,
      brushRadius,
      placementRotationDeg,
      placementScale,
      selectedObjectId,
      onTerrainStrokeStart,
      onTerrainStroke,
      onPlacePrefabAt,
      onSelectObject,
      onHoverCoordsChange,
      onScaleMetricsChange,
    };
  });

  const sceneHandlesRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    terrainGeo: THREE.PlaneGeometry;
    terrainMesh: THREE.Mesh;
    waterMesh: THREE.Mesh;
    distantMat: THREE.MeshStandardMaterial;
    sunLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    fog: THREE.FogExp2;
    brushRing: THREE.Group;
    selectionRing: THREE.Group;
    propsRoot: THREE.Group;
    microStrokesRoot: THREE.Group;
    weatherRoot: THREE.Group;
    celestialRoot: THREE.Group;
    starDomeMat: THREE.PointsMaterial;
    milkyWayMat: THREE.PointsMaterial;
    constellationGroup: THREE.Group;
    sunOrbGroup: THREE.Group;
    moonOrbGroup: THREE.Group;
    microCircleGeo: THREE.CircleGeometry;
    prefabFactory: ProceduralPrefabFactory;
    objectMeshMap: Map<string, THREE.Group>;
    microMeshMap: Map<string, THREE.Group>;
    animatedPropNodes: THREE.Object3D[];
    requestWake: () => void;
    triggerCameraPreset: (preset: CameraPresetId) => void;
  } | null>(null);

  // 1. Initialize WebGLRenderer & 10x10 km Vector 3D Scene once on mount
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    renderer.domElement.setAttribute('data-testid', 'world-3d-canvas');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const initialBiome = BIOMES[biomeId];
    scene.background = new THREE.Color(initialBiome.skyHorizonHex);
    const fog = new THREE.FogExp2(initialBiome.fogHex, 0.000032);
    scene.fog = fog;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      45,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.4,
      40000
    );
    // Start framing the 7-Mountain Reference Gallery (Pluto, Europa, Alps, Himalaya, Mars, Titan, Volcano)
    camera.position.set(0, 28, 52);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.485;
    controls.minDistance = 2;
    controls.maxDistance = 14500;
    controls.target.set(0, 10, -12);

    // 3-Point Warm/Cool Lighting Rig with Real-Time Directional Shadows
    const hemiLight = new THREE.HemisphereLight(
      initialBiome.hemiSkyHex,
      initialBiome.hemiGroundHex,
      0.68
    );
    hemiLight.position.set(0, 4500, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(initialBiome.sunHex, 1.35);
    sunLight.position.set(380, 480, 290);
    sunLight.castShadow = !isSoftwareGl;
    const shadowMapDim = isSoftwareGl ? 512 : 1024;
    sunLight.shadow.mapSize.width = shadowMapDim;
    sunLight.shadow.mapSize.height = shadowMapDim;
    const d = 95;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 1600;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.35);
    rimLight.position.set(-420, 250, -380);
    scene.add(rimLight);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const { contactShadowMap } = createTerrainDetailTextures(maxAniso);

    // Main Playable Open-World Vector Terrain Mesh (10,000m x 10,000m = 10x10 km, 160x160 cells = 25,921 vertices)
    // Pure vector-interpolated shading with zero blocky raster bump textures
    const terrainGeo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, GRID_SIZE, GRID_SIZE);
    terrainGeo.rotateX(-Math.PI / 2);

    const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
    const linearColorArray = new Float32Array(colorMap.length);
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setY(i, heightMap[i] ?? 0);
      linearColorArray[i * 3] = Math.pow(colorMap[i * 3] ?? 0.4, 2.2);
      linearColorArray[i * 3 + 1] = Math.pow(colorMap[i * 3 + 1] ?? 0.3, 2.2);
      linearColorArray[i * 3 + 2] = Math.pow(colorMap[i * 3 + 2] ?? 0.2, 2.2);
    }
    posAttr.needsUpdate = true;
    const colorAttr = new THREE.BufferAttribute(linearColorArray, 3);
    terrainGeo.setAttribute('color', colorAttr);
    terrainGeo.computeVertexNormals();
    terrainGeo.computeBoundingSphere();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.03,
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    terrainMesh.name = 'playable_terrain';
    scene.add(terrainMesh);

    // Crisp Vector Metric Reference Grid on the Ground (10m sub-grid & 100m major grid)
    const vectorFineGrid = new THREE.GridHelper(200, 20, 0xfbbf24, 0x785532);
    vectorFineGrid.position.y = 0.04;
    (vectorFineGrid.material as THREE.Material).transparent = true;
    (vectorFineGrid.material as THREE.Material).opacity = 0.28;
    scene.add(vectorFineGrid);

    const vectorMacroGrid = new THREE.GridHelper(WORLD_SIZE, 100, 0x94a3b8, 0x64748b);
    vectorMacroGrid.position.y = 0.08;
    (vectorMacroGrid.material as THREE.Material).transparent = true;
    (vectorMacroGrid.material as THREE.Material).opacity = 0.16;
    scene.add(vectorMacroGrid);

    // Natural Outer Perimeter Horizon Sea & Hydrological Water Plane (36km x 36km)
    const waterGeo = new THREE.PlaneGeometry(36000, 36000, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: initialBiome.waterHex,
      roughness: 0.14,
      metalness: 0.26,
      transparent: true,
      opacity: 0.88,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.y = waterLevel;
    scene.add(waterMesh);

    // Distant Perimeter Silhouettes (Natural Horizon Mountain Range beyond 10km)
    const distantRingGroup = new THREE.Group();
    const distantMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.05,
      flatShading: true,
    });
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const dist = 9400 + (i % 3) * 1250;
      const h = 340 + (i % 4) * 140;
      const r = 950 + (i % 3) * 320;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), distantMat);
      peak.position.set(Math.cos(angle) * dist, h * 0.32 - 55, Math.sin(angle) * dist);
      peak.rotation.y = angle;
      distantRingGroup.add(peak);
    }
    scene.add(distantRingGroup);

    // Interactive Vector Brush Cursor Ring with Orientation Pointer
    const brushRing = new THREE.Group();
    const brushRingGeo = new THREE.RingGeometry(0.92, 1.0, 64);
    brushRingGeo.rotateX(-Math.PI / 2);
    const brushRingMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    brushRing.add(new THREE.Mesh(brushRingGeo, brushRingMat));

    const brushArrowGeo = new THREE.ConeGeometry(0.14, 0.36, 4);
    brushArrowGeo.rotateX(Math.PI / 2);
    const brushArrow = new THREE.Mesh(brushArrowGeo, brushRingMat);
    brushArrow.position.set(0, 0.1, 1.12);
    brushRing.add(brushArrow);
    brushRing.visible = false;
    scene.add(brushRing);

    // Selected 3D Prop Highlight Ring + Orientation Arrow (True 1:1 Real-World Building Scale: ~11m diameter)
    const selectionRing = new THREE.Group();
    const selRingGeo = new THREE.RingGeometry(5.2, 5.8, 64);
    selRingGeo.rotateX(-Math.PI / 2);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    selectionRing.add(new THREE.Mesh(selRingGeo, selRingMat));

    const selArrowGeo = new THREE.ConeGeometry(0.9, 2.2, 4);
    selArrowGeo.rotateX(Math.PI / 2);
    const selArrowMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      depthWrite: false,
    });
    const selArrow = new THREE.Mesh(selArrowGeo, selArrowMat);
    selArrow.position.set(0, 0.25, 6.6);
    selectionRing.add(selArrow);
    selectionRing.visible = false;
    scene.add(selectionRing);

    const propsRoot = new THREE.Group();
    scene.add(propsRoot);

    const microStrokesRoot = new THREE.Group();
    scene.add(microStrokesRoot);

    const weatherRoot = new THREE.Group();
    weatherRoot.userData.activeWeather = activeWeather;
    weatherRoot.add(buildPlanetaryWeatherGroup(activeWeather));
    scene.add(weatherRoot);

    const {
      celestialRoot,
      starDomeMat,
      milkyWayMat,
      constellationGroup,
      sunOrbGroup,
      moonOrbGroup,
    } = buildCelestialSkySystem();
    scene.add(celestialRoot);

    // 64-segment smooth Vector Circle Geometry for infinite-sharpness surface strokes
    const microCircleGeo = new THREE.CircleGeometry(1, 64);
    microCircleGeo.rotateX(-Math.PI / 2);

    const prefabFactory = new ProceduralPrefabFactory(contactShadowMap, isSoftwareGl);
    const objectMeshMap = new Map<string, THREE.Group>();
    const microMeshMap = new Map<string, THREE.Group>();
    const animatedPropNodes: THREE.Object3D[] = [];

    const collectAnimatedPropNodes = () => {
      animatedPropNodes.length = 0;
      propsRoot.traverse((obj) => {
        const ud = obj.userData;
        if (
          ud.isWindmillRotor ||
          ud.isFloatingCrystal ||
          ud.isFloatingIsland ||
          ud.isStylizedVolcanoPlume ||
          ud.isDetachedSmokeCloud ||
          ud.isVolcanoPlume ||
          ud.isAbyssVortex
        ) {
          animatedPropNodes.push(obj);
        }
      });
    };

    // Populate initial placed objects immediately before first render at true 1:1 scale
    for (const item of placedObjects) {
      const group = prefabFactory.createPrefab(item.prefabId);
      group.userData.placedObjectId = item.id;
      const groundY = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, item.x, item.z);
      group.position.set(item.x, groundY, item.z);
      group.rotation.y = item.rotationY;
      group.scale.setScalar(item.scale * WORLD_PROP_BASE_SCALE);
      propsRoot.add(group);
      objectMeshMap.set(item.id, group);
    }
    collectAnimatedPropNodes();

    // Populate initial 3D surface ecosystems (3-5cm grass, 3D flowers, desert sand dunes, smoking lava)
    for (let idx = 0; idx < microStrokes.length; idx++) {
      const st = microStrokes[idx];
      const patchGroup = createSurfaceEcosystemPatch(st, idx + 1);
      const wy = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, st.x, st.z);
      patchGroup.position.set(st.x, wy + (idx % 12) * 0.003, st.z);
      microStrokesRoot.add(patchGroup);
      microMeshMap.set(st.id, patchGroup);
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Camera transition state
    let camTransitionActive = false;
    const cancelCamTransition = () => {
      camTransitionActive = false;
    };
    controls.addEventListener('start', cancelCamTransition);

    const triggerCameraPreset = (preset: CameraPresetId) => {
      camTransitionActive = true;
      if (preset === 'mountain_gallery') {
        _camPosGoal.set(0, 28, 52);
        _camTargetGoal.set(0, 10, -12);
      } else if (preset === 'pluto_cryo') {
        _camPosGoal.set(-15, 20, 32);
        _camTargetGoal.set(-16, 10.5, -8);
      } else if (preset === 'europa_rift') {
        _camPosGoal.set(17, 19, 30);
        _camTargetGoal.set(16, 10, -8);
      } else if (preset === 'alps_matterhorn') {
        _camPosGoal.set(-44, 18.5, 32);
        _camTargetGoal.set(-45, 12.5, -10);
      } else if (preset === 'himalaya_fishtail') {
        _camPosGoal.set(46, 19.5, 32);
        _camTargetGoal.set(45, 13, -10);
      } else if (preset === 'olympus_mons') {
        _camPosGoal.set(-74, 21, 26);
        _camTargetGoal.set(-76, 6.5, -12);
      } else if (preset === 'titan_mountain') {
        _camPosGoal.set(78, 21, 26);
        _camTargetGoal.set(76, 6.5, -12);
      } else if (preset === 'volcano_icon') {
        _camPosGoal.set(0, 18.5, 14);
        _camTargetGoal.set(0, 9.6, -26);
      } else if (preset === 'village') {
        _camPosGoal.set(38, 24, 48);
        _camTargetGoal.set(0, 6, 0);
      } else if (preset === 'sky_volcano') {
        _camPosGoal.set(-8, 28, 56);
        _camTargetGoal.set(-2, 9, -6);
      } else if (preset === 'closeup') {
        _camPosGoal.set(16, 6.5, 20);
        _camTargetGoal.set(0, 3, 0);
      } else if (preset === 'valley') {
        _camPosGoal.set(-220, 130, 280);
        _camTargetGoal.set(0, 10, 0);
      } else if (preset === 'overview') {
        _camPosGoal.set(2400, 1650, 2900);
        _camTargetGoal.set(0, 80, 0);
      } else if (preset === 'topdown') {
        _camPosGoal.set(0, 95, 6);
        _camTargetGoal.set(0, 0, 0);
      }
      // Advance 78% immediately so software-WebGL viewports frame the target right away
      camera.position.lerp(_camPosGoal, 0.78);
      controls.target.lerp(_camTargetGoal, 0.78);
      controls.update();
    };

    // Compute and report live ground scale (metersPerPixel) for the bottom-right DistanceScaleBar
    let lastReportedDist = -1;
    const emitScaleMetrics = () => {
      const dist = camera.position.distanceTo(controls.target);
      if (Math.abs(dist - lastReportedDist) < 0.2) return;
      lastReportedDist = dist;
      const vFovRad = THREE.MathUtils.degToRad(camera.fov);
      const visibleHeightMeters = 2 * dist * Math.tan(vFovRad / 2);
      const viewHeightPx = Math.max(1, renderer.domElement.clientHeight || window.innerHeight);
      const metersPerPixel = visibleHeightMeters / viewHeightPx;
      latestPropsRef.current.onScaleMetricsChange?.({
        metersPerPixel,
        cameraDistanceMeters: dist,
      });
    };
    controls.addEventListener('change', emitScaleMetrics);
    emitScaleMetrics();

    // Raycasting & Pointer Interaction
    const raycaster = new THREE.Raycaster();
    let isPointerDraggingTerrain = false;
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;

    const updateMouseFromEvent = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _mouseNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      _mouseNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const raycastTerrainPoint = (e: PointerEvent): THREE.Vector3 | null => {
      updateMouseFromEvent(e);
      raycaster.setFromCamera(_mouseNdc, camera);
      const hits = raycaster.intersectObject(terrainMesh, false);
      return hits.length > 0 ? hits[0].point : null;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || e.ctrlKey || e.altKey || e.metaKey) return;
      pointerDownPos = { x: e.clientX, y: e.clientY };
      const {
        activeTab: tab,
        onTerrainStrokeStart: strokeStart,
        onTerrainStroke: stroke,
      } = latestPropsRef.current;

      if (tab === 'sculpt' || tab === 'paint') {
        const pt = raycastTerrainPoint(e);
        if (pt) {
          isPointerDraggingTerrain = true;
          controls.enabled = false;
          strokeStart?.();
          stroke(pt.x, pt.z);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 28) return;
      lastHoverTime = now;

      const pt = raycastTerrainPoint(e);
      const {
        activeTab: tab,
        brushRadius: rad,
        placementRotationDeg: rotDeg,
        placementScale: plScale,
        onTerrainStroke: stroke,
        onHoverCoordsChange: hoverCb,
      } = latestPropsRef.current;

      if (pt) {
        brushRing.visible = tab === 'sculpt' || tab === 'paint' || tab === 'prefabs';
        const ringScale = tab === 'prefabs' ? 5.5 * plScale : Math.max(1, rad);
        brushRing.position.set(pt.x, pt.y + 0.15, pt.z);
        brushRing.scale.set(ringScale, 1, ringScale);
        brushRing.rotation.y = tab === 'prefabs' ? (rotDeg * Math.PI) / 180 : 0;

        if (isPointerDraggingTerrain && (tab === 'sculpt' || tab === 'paint')) {
          stroke(pt.x, pt.z);
        }
        hoverCb?.({ x: pt.x, y: pt.y, z: pt.z });
      } else {
        brushRing.visible = false;
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isPointerDraggingTerrain) {
        isPointerDraggingTerrain = false;
        controls.enabled = true;
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;

      updateMouseFromEvent(e);
      raycaster.setFromCamera(_mouseNdc, camera);

      const {
        activeTab: tab,
        onPlacePrefabAt: placeCb,
        onSelectObject: selectCb,
      } = latestPropsRef.current;

      const propHits = raycaster.intersectObjects(propsRoot.children, true);
      if (propHits.length > 0) {
        let curr: THREE.Object3D | null = propHits[0].object;
        while (curr && curr.parent !== propsRoot) {
          curr = curr.parent;
        }
        if (curr && curr.userData.placedObjectId) {
          selectCb(curr.userData.placedObjectId);
          return;
        }
      }

      if (tab === 'prefabs') {
        const pt = raycastTerrainPoint(e);
        if (pt) {
          placeCb(pt.x, pt.z);
        }
      } else {
        selectCb(null);
      }
    };

    // Keyboard WASD camera panning support (adaptive speed based on camera height)
    const keysPressed: Record<string, boolean> = {};
    const onBlur = () => {
      for (const key of Object.keys(keysPressed)) {
        keysPressed[key] = false;
      }
      if (isPointerDraggingTerrain) {
        isPointerDraggingTerrain = false;
        controls.enabled = true;
      }
    };
    const onVisibilityChange = () => {
      if (document.hidden) {
        onBlur();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        for (const key of Object.keys(keysPressed)) {
          keysPressed[key] = false;
        }
        return;
      }
      keysPressed[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.code] = false;
    };

    const domElem = renderer.domElement;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      onBlur();
    };
    const onContextRestored = () => {
      renderer.render(scene, camera);
    };

    domElem.addEventListener('pointerdown', onPointerDown);
    domElem.addEventListener('pointermove', onPointerMove);
    domElem.addEventListener('webglcontextlost', onContextLost, false);
    domElem.addEventListener('webglcontextrestored', onContextRestored, false);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      emitScaleMetrics();
    };
    window.addEventListener('resize', onResize);

    // Render loop with mandatory software-WebGL fenceSync pacing (`afterDraw`)
    const startTimeMs = performance.now();
    let lastTimeMs = startTimeMs;
    let frameId = 0;
    let unmounted = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (unmounted) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (unmounted) return;
      const nowMs = performance.now();
      const dt = Math.min(Math.max((nowMs - lastTimeMs) / 1000, 0.001), 0.1);
      lastTimeMs = nowMs;
      const elapsed = (nowMs - startTimeMs) / 1000;

      // Adaptive WASD camera pan speed proportional to camera distance
      const camDist = camera.position.distanceTo(controls.target);
      const panSpeed = Math.max(25, camDist * 0.65) * dt;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) {
        camera.position.z -= panSpeed;
        controls.target.z -= panSpeed;
      }
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) {
        camera.position.z += panSpeed;
        controls.target.z += panSpeed;
      }
      if (keysPressed['KeyA'] || keysPressed['ArrowLeft']) {
        camera.position.x -= panSpeed;
        controls.target.x -= panSpeed;
      }
      if (keysPressed['KeyD'] || keysPressed['ArrowRight']) {
        camera.position.x += panSpeed;
        controls.target.x += panSpeed;
      }

      if (camTransitionActive) {
        const alpha = 1 - Math.exp(-6.0 * dt);
        camera.position.lerp(_camPosGoal, alpha);
        controls.target.lerp(_camTargetGoal, alpha);
        emitScaleMetrics();
        if (
          camera.position.distanceToSquared(_camPosGoal) < 0.5 &&
          controls.target.distanceToSquared(_camTargetGoal) < 0.5
        ) {
          camTransitionActive = false;
        }
      }

      for (let i = 0; i < animatedPropNodes.length; i++) {
        const obj = animatedPropNodes[i];
        if (obj.userData.isWindmillRotor) {
          obj.rotation.z += dt * 1.15;
        } else if (obj.userData.isFloatingCrystal) {
          const baseY = typeof obj.userData.baseY === 'number' ? obj.userData.baseY : 3.6;
          obj.rotation.y += dt * 0.9;
          obj.position.y = baseY + Math.sin(elapsed * 2.2) * 0.22;
        } else if (obj.userData.isFloatingIsland) {
          const baseY = typeof obj.userData.baseY === 'number' ? obj.userData.baseY : 14.5;
          obj.position.y = baseY + Math.sin(elapsed * 1.35) * 0.42;
        } else if (obj.userData.isStylizedVolcanoPlume) {
          const baseY = typeof obj.userData.baseY === 'number' ? obj.userData.baseY : 12.25;
          obj.position.y = baseY + Math.sin(elapsed * 2.1) * 0.24;
          obj.rotation.z = Math.sin(elapsed * 1.45) * 0.035;
        } else if (obj.userData.isDetachedSmokeCloud) {
          const ph = typeof obj.userData.phase === 'number' ? obj.userData.phase : 0;
          const bx = typeof obj.userData.baseX === 'number' ? obj.userData.baseX : 5.45;
          const by = typeof obj.userData.baseY === 'number' ? obj.userData.baseY : 3.65;
          obj.position.x = bx + Math.sin(elapsed * 1.6 + ph) * 0.28;
          obj.position.y = by + Math.cos(elapsed * 2.0 + ph) * 0.22;
        } else if (obj.userData.isVolcanoPlume) {
          obj.rotation.y += dt * 0.55;
          obj.position.y = 14.2 + Math.sin(elapsed * 2.6) * 0.35;
        } else if (obj.userData.isAbyssVortex) {
          obj.rotation.y -= dt * 1.25;
          obj.position.y = 2.6 + Math.sin(elapsed * 2.0) * 0.25;
        }
      }

      // Keep weather & celestial star dome centered around the camera target
      weatherRoot.position.set(controls.target.x, 0, controls.target.z);
      celestialRoot.position.set(controls.target.x, 0, controls.target.z);
      sunOrbGroup.lookAt(camera.position);
      moonOrbGroup.lookAt(camera.position);

      if (constellationGroup.visible) {
        if (celestialRoot.children[0]) {
          celestialRoot.children[0].rotation.y = elapsed * 0.015;
        }
        constellationGroup.traverse((obj) => {
          if (obj.userData.isTwinkleStar) {
            const ph = obj.userData.phase || 0;
            const baseS = obj.userData.baseScale || 0.6;
            const pulse = 0.72 + Math.sin(elapsed * 3.4 + ph) * 0.34;
            obj.scale.setScalar(baseS * pulse);
            obj.rotation.y += dt * 1.1;
          } else if (obj.userData.isNightShootingStar) {
            const spd = obj.userData.speed || 42;
            obj.position.x += spd * 0.92 * dt;
            obj.position.y -= spd * 0.34 * dt;
            if (obj.position.y < 6 || obj.position.x > 95) {
              obj.position.x = obj.userData.originX || -65;
              obj.position.y = obj.userData.originY || 42;
              obj.position.z = obj.userData.originZ || -80;
            }
          }
        });
      }

      weatherRoot.traverse((obj) => {
        if (obj.userData.isMarsStormParticle) {
          const r = obj.userData.orbitRadius || 15;
          const speed = obj.userData.orbitSpeed || 1.0;
          const ang = (obj.userData.orbitAngle || 0) + elapsed * speed;
          obj.position.x = Math.cos(ang) * r;
          obj.position.z = Math.sin(ang) * r;
          obj.position.y = (obj.userData.baseY || 2) + Math.sin(elapsed * 2.5 + r) * 0.65;
          obj.rotation.y += dt * 1.8;
        } else if (obj.userData.isMarsDustDevil) {
          obj.rotation.y += dt * 2.6;
          const ph = obj.userData.phase || 0;
          obj.position.x = (obj.userData.baseX || 0) + Math.sin(elapsed * 0.55 + ph) * 6;
          obj.position.z = (obj.userData.baseZ || 0) + Math.cos(elapsed * 0.45 + ph) * 6;
        } else if (obj.userData.isAcidRainDrop) {
          const spd = obj.userData.fallSpeed || 25;
          obj.position.y -= spd * dt;
          obj.position.x -= spd * 0.18 * dt;
          if (obj.position.y < 0) {
            obj.position.y = 42;
            obj.position.x = ((obj.position.x + 80) % 130) - 65;
          }
        } else if (obj.userData.isVenusSulfurCloud) {
          const ph = obj.userData.phase || 0;
          obj.rotation.y += dt * 0.15;
          obj.position.y = 32 + Math.sin(elapsed * 1.2 + ph) * 0.8;
        } else if (obj.userData.isMeteorStreak) {
          const spd = obj.userData.speed || 28;
          obj.position.x -= spd * 0.85 * dt;
          obj.position.y -= spd * 0.52 * dt;
          if (obj.position.y < -2) {
            obj.position.x = obj.userData.originX || 50;
            obj.position.y = obj.userData.originY || 44;
            obj.position.z = obj.userData.originZ || 0;
          }
        } else if (obj.userData.isAuroraRibbon) {
          const ph = obj.userData.phase || 0;
          obj.rotation.z += dt * 0.18;
          obj.position.y = 26 + ph * 2.2 + Math.sin(elapsed * 1.5 + ph) * 1.2;
        } else if (obj.userData.isAuroraCrystal) {
          const ph = obj.userData.phase || 0;
          obj.rotation.y += dt * 1.6;
          obj.rotation.x += dt * 0.9;
          obj.position.y = (obj.userData.baseY || 4) + Math.sin(elapsed * 2.0 + ph) * 0.55;
        } else if (obj.userData.isAshEmber) {
          const spd = obj.userData.speed || 2.5;
          const ph = obj.userData.phase || 0;
          if (obj.userData.isRisingEmber) {
            obj.position.y += spd * dt;
            obj.position.x += Math.sin(elapsed * 2.2 + ph) * 0.04;
            if (obj.position.y > 32) obj.position.y = 0.4;
          } else {
            obj.position.y -= spd * 0.65 * dt;
            obj.position.x += Math.cos(elapsed * 1.5 + ph) * 0.03;
            if (obj.position.y < 0.2) obj.position.y = 30;
          }
        } else if (obj.userData.isSupersonicDustStreak) {
          const spd = obj.userData.speed || 50;
          obj.position.x += spd * dt;
          if (obj.position.x > 70) {
            obj.position.x = -70;
          }
        } else if (obj.userData.isStaticLightningBolt) {
          const ph = obj.userData.phase || 0;
          const flash = Math.sin(elapsed * 14 + ph * 5) > 0.35;
          obj.visible = flash;
        } else if (obj.userData.isNitrogenSnowflake) {
          const spd = obj.userData.fallSpeed || 3.8;
          const ph = obj.userData.phase || 0;
          obj.position.y -= spd * dt;
          obj.position.x += Math.sin(elapsed * 1.6 + ph) * 1.4 * dt;
          obj.position.z += Math.cos(elapsed * 1.3 + ph) * 1.1 * dt;
          obj.rotation.y += dt * 1.5;
          obj.rotation.x += dt * 0.9;
          if (obj.position.y < 0.3) {
            obj.position.y = 38;
          }
        } else if (obj.userData.isCryoGroundMist) {
          const ph = obj.userData.phase || 0;
          const s = 0.85 + ((elapsed * 0.45 + ph) % 1.0) * 1.35;
          obj.scale.set(s, s, 1);
          obj.rotation.z = elapsed * 0.25 + ph;
        } else if (obj.userData.isCryoGeyserJet) {
          const progress = (elapsed * 0.48 + (obj.userData.jetPhase || 0)) % 1.0;
          const spread = progress * 3.2;
          const ang = (obj.userData.jetPhase || 0) * 12.56 + elapsed * 2.0;
          obj.position.y = 0.8 + progress * 35;
          obj.position.x = (obj.userData.baseX || 0) + Math.cos(ang) * spread;
          obj.position.z = (obj.userData.baseZ || 0) + Math.sin(ang) * spread;
          obj.scale.setScalar(0.6 + progress * 1.6);
        }
      });

      // Animate 3-5cm 3D grass blades, 3D flowers, swirling desert sand, and rising lava smoke + magma currents
      animateSurfaceEcosystems(microStrokesRoot, elapsed);

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    sceneHandlesRef.current = {
      renderer,
      scene,
      camera,
      controls,
      terrainGeo,
      terrainMesh,
      waterMesh,
      distantMat,
      sunLight,
      hemiLight,
      fog,
      brushRing,
      selectionRing,
      propsRoot,
      microStrokesRoot,
      weatherRoot,
      celestialRoot,
      starDomeMat,
      milkyWayMat,
      constellationGroup,
      sunOrbGroup,
      moonOrbGroup,
      microCircleGeo,
      prefabFactory,
      objectMeshMap,
      microMeshMap,
      animatedPropNodes,
      requestWake: () => {},
      triggerCameraPreset,
    };

    tick();

    return () => {
      unmounted = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      domElem.removeEventListener('pointerdown', onPointerDown);
      domElem.removeEventListener('pointermove', onPointerMove);
      domElem.removeEventListener('webglcontextlost', onContextLost, false);
      domElem.removeEventListener('webglcontextrestored', onContextRestored, false);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', cancelCamTransition);
      controls.removeEventListener('change', emitScaleMetrics);
      controls.dispose();
      microCircleGeo.dispose();
      if (scene.environment) {
        scene.environment.dispose();
        scene.environment = null;
      }
      if (sunLight.shadow.map) {
        sunLight.shadow.map.dispose();
      }
      prefabFactory.dispose();
      contactShadowMap.userData.shared = false;
      contactShadowMap.dispose();
      disposeObject3DTree(scene);
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (container.contains(domElem)) {
        container.removeChild(domElem);
      }
      sceneHandlesRef.current = null;
    };
  }, []);

  // 2. Sync Terrain Geometry Heights & Vector Vertex Colors whenever terrainVersion increments
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    const posAttr = handles.terrainGeo.attributes.position as THREE.BufferAttribute;
    const colAttr = handles.terrainGeo.attributes.color as THREE.BufferAttribute;
    const normAttr = handles.terrainGeo.attributes.normal as THREE.BufferAttribute | undefined;
    const rect = dirtyRectRef?.current ?? null;
    if (dirtyRectRef) {
      dirtyRectRef.current = null;
    }

    const stride = GRID_SIZE + 1;
    const isPartialRect =
      rect !== null &&
      (rect.minIx > 0 || rect.maxIx < GRID_SIZE || rect.minIz > 0 || rect.maxIz < GRID_SIZE);

    if (isPartialRect && rect && normAttr) {
      const { minIx, maxIx, minIz, maxIz } = rect;
      for (let iz = minIz; iz <= maxIz; iz++) {
        const rowOffset = iz * stride;
        for (let ix = minIx; ix <= maxIx; ix++) {
          const i = rowOffset + ix;
          posAttr.setY(i, heightMap[i] ?? 0);
          colAttr.setXYZ(
            i,
            Math.pow(colorMap[i * 3] ?? 0.4, 2.2),
            Math.pow(colorMap[i * 3 + 1] ?? 0.3, 2.2),
            Math.pow(colorMap[i * 3 + 2] ?? 0.2, 2.2)
          );
        }
      }

      // Recompute vertex normals exclusively inside the 1-cell padded dirtyRect
      const { paddedRect } = computePartialVertexNormals(
        heightMap,
        normAttr.array as Float32Array,
        rect
      );
      const { minIx: nMinIx, maxIx: nMaxIx, minIz: nMinIz, maxIz: nMaxIz } = paddedRect;

      const startVertex = nMinIz * stride + nMinIx;
      const endVertex = nMaxIz * stride + nMaxIx;
      const floatStart = startVertex * 3;
      const floatCount = (endVertex - startVertex + 1) * 3;
      posAttr.clearUpdateRanges();
      colAttr.clearUpdateRanges();
      normAttr.clearUpdateRanges();
      posAttr.addUpdateRange(floatStart, floatCount);
      colAttr.addUpdateRange(floatStart, floatCount);
      normAttr.addUpdateRange(floatStart, floatCount);
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      normAttr.needsUpdate = true;

      const half = WORLD_SIZE / 2;
      const minWx = (nMinIx / GRID_SIZE) * WORLD_SIZE - half;
      const maxWx = (nMaxIx / GRID_SIZE) * WORLD_SIZE - half;
      const minWz = (nMinIz / GRID_SIZE) * WORLD_SIZE - half;
      const maxWz = (nMaxIz / GRID_SIZE) * WORLD_SIZE - half;
      const currentSelectedId = latestPropsRef.current.selectedObjectId;

      handles.objectMeshMap.forEach((group, id) => {
        const wx = group.position.x;
        const wz = group.position.z;
        if (wx >= minWx && wx <= maxWx && wz >= minWz && wz <= maxWz) {
          const wy = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, wx, wz);
          group.position.y = wy;
          if (id === currentSelectedId) {
            handles.selectionRing.position.set(wx, wy + 0.12, wz);
          }
        }
      });
    } else {
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setY(i, heightMap[i] ?? 0);
        colAttr.setXYZ(
          i,
          Math.pow(colorMap[i * 3] ?? 0.4, 2.2),
          Math.pow(colorMap[i * 3 + 1] ?? 0.3, 2.2),
          Math.pow(colorMap[i * 3 + 2] ?? 0.2, 2.2)
        );
      }
      posAttr.clearUpdateRanges();
      colAttr.clearUpdateRanges();
      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      handles.terrainGeo.computeVertexNormals();
      handles.terrainGeo.computeBoundingSphere();

      const currentSelectedId = latestPropsRef.current.selectedObjectId;
      handles.objectMeshMap.forEach((group, id) => {
        const wx = group.position.x;
        const wz = group.position.z;
        const wy = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, wx, wz);
        group.position.y = wy;
        if (id === currentSelectedId) {
          handles.selectionRing.position.set(wx, wy + 0.12, wz);
        }
      });
    }
  }, [terrainVersion, heightMap, colorMap, dirtyRectRef]);

  // 3. Sync Placed 3D Objects (Houses, Mountains, Trees, Landmarks) at 1:1 Real-World Scale
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    const { propsRoot, prefabFactory, objectMeshMap, selectionRing, animatedPropNodes } = handles;
    const incomingIds = new Set(placedObjects.map((o) => o.id));
    let structureChanged = false;

    objectMeshMap.forEach((group, id) => {
      if (!incomingIds.has(id)) {
        propsRoot.remove(group);
        disposeObject3DTree(group);
        objectMeshMap.delete(id);
        structureChanged = true;
      }
    });

    for (const item of placedObjects) {
      let group = objectMeshMap.get(item.id);
      if (!group) {
        group = prefabFactory.createPrefab(item.prefabId);
        group.userData.placedObjectId = item.id;
        propsRoot.add(group);
        objectMeshMap.set(item.id, group);
        structureChanged = true;
      }
      const groundY = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, item.x, item.z);
      group.position.set(item.x, groundY, item.z);
      group.rotation.y = item.rotationY;
      group.scale.setScalar(item.scale * WORLD_PROP_BASE_SCALE);
    }

    if (structureChanged) {
      animatedPropNodes.length = 0;
      propsRoot.traverse((obj) => {
        const ud = obj.userData;
        if (
          ud.isWindmillRotor ||
          ud.isFloatingCrystal ||
          ud.isFloatingIsland ||
          ud.isStylizedVolcanoPlume ||
          ud.isDetachedSmokeCloud ||
          ud.isVolcanoPlume ||
          ud.isAbyssVortex
        ) {
          animatedPropNodes.push(obj);
        }
      });
    }

    const selectedObj = placedObjects.find((o) => o.id === selectedObjectId);
    if (selectedObj) {
      const wy = getGroundHeightAt(
        heightMap,
        GRID_SIZE,
        WORLD_SIZE,
        selectedObj.x,
        selectedObj.z
      );
      selectionRing.visible = true;
      selectionRing.position.set(selectedObj.x, wy + 0.12, selectedObj.z);
      selectionRing.rotation.y = selectedObj.rotationY;
      selectionRing.scale.setScalar(selectedObj.scale);
    } else {
      selectionRing.visible = false;
    }
  }, [placedObjects, selectedObjectId, heightMap]);

  // 3b. Sync 3D Physical Surface Ecosystems (3-5cm Grass Blades, 3D Flowers, Desert Sand Dunes, Flowing Smoking Lava, Mars/Venus/Exoplanet Regolith)
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    const { microStrokesRoot, microMeshMap } = handles;
    const incomingIds = new Set(microStrokes.map((s) => s.id));

    microMeshMap.forEach((group, id) => {
      if (!incomingIds.has(id)) {
        microStrokesRoot.remove(group);
        disposeObject3DTree(group);
        microMeshMap.delete(id);
      }
    });

    for (let idx = 0; idx < microStrokes.length; idx++) {
      const st = microStrokes[idx];
      let patchGroup = microMeshMap.get(st.id);

      // Rebuild patch if parameters (grassHeightCm, flowerSpecies, flowerColorHex, brushId) changed
      const needsRebuild =
        patchGroup &&
        (patchGroup.userData.brushId !== st.brushId ||
          patchGroup.userData.grassHeightCm !== (st.grassHeightCm ?? 4.0) ||
          patchGroup.userData.flowerSpecies !== (st.flowerSpecies ?? 'sakura_bloom') ||
          patchGroup.userData.flowerColorHex !== (st.flowerColorHex ?? '#f472b6'));

      if (needsRebuild && patchGroup) {
        microStrokesRoot.remove(patchGroup);
        disposeObject3DTree(patchGroup);
        microMeshMap.delete(st.id);
        patchGroup = undefined;
      }

      if (!patchGroup) {
        try {
          patchGroup = createSurfaceEcosystemPatch(st, idx + 1);
          microStrokesRoot.add(patchGroup);
          microMeshMap.set(st.id, patchGroup);
        } catch (err) {
          console.error(`[WorldViewport3D] Failed to create surface patch for brush "${st.brushId}":`, err);
          continue;
        }
      }

      const wy = getGroundHeightAt(heightMap, GRID_SIZE, WORLD_SIZE, st.x, st.z);
      patchGroup.position.set(st.x, wy + (idx % 12) * 0.003, st.z);
    }
  }, [microStrokes, heightMap, terrainVersion]);

  // 4. Sync Biome Atmosphere, Planetary Weather, Day/Night Cycle, Sun Azimuth Shadows & Starry Sky
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles) return;

    const biome = BIOMES[biomeId];
    const weatherMeta =
      WEATHER_CATALOG.find((w) => w.id === activeWeather) || WEATHER_CATALOG[0];

    const lightingState = computeDayNightLightingState({
      timeOfDayHours: timeOfDay,
      sunElevationDeg: sunElevation,
      sunAzimuthDeg: sunAzimuth,
      starlightMode,
      biomeId,
    });

    // Rebuild 3D weather group only when activeWeather changes
    if (handles.weatherRoot.userData.activeWeather !== activeWeather) {
      disposeObject3DTree(handles.weatherRoot);
      handles.weatherRoot.clear();
      handles.weatherRoot.userData.activeWeather = activeWeather;
      handles.weatherRoot.add(buildPlanetaryWeatherGroup(activeWeather));
    }

    if (activeWeather === 'clear_sky') {
      handles.scene.background = new THREE.Color(lightingState.skyBackgroundHex);
      handles.fog.color.set(lightingState.fogHex);
      handles.fog.density = lightingState.isNightOrStarlight ? 0.000045 : 0.000032;
    } else {
      const fogHex = weatherMeta.fogOverrideHex || lightingState.fogHex;
      const blendedFog = new THREE.Color(lightingState.fogHex).lerp(
        new THREE.Color(fogHex),
        lightingState.isNightOrStarlight ? 0.35 : 0.65
      );
      handles.scene.background = new THREE.Color(lightingState.skyBackgroundHex).lerp(
        blendedFog,
        0.42
      );
      handles.fog.color.copy(blendedFog);
      handles.fog.density =
        activeWeather === 'mars_dust_storm' ||
        activeWeather === 'supersonic_mars_storm' ||
        activeWeather === 'venus_acid_rain' ||
        activeWeather === 'concentrated_venus_acid' ||
        activeWeather === 'himalaya_blizzard'
          ? 0.00018
          : activeWeather === 'liquid_nitrogen_snow' ||
            activeWeather === 'cryo_geyser_blizzard' ||
            activeWeather === 'molten_silicate_rain' ||
            activeWeather === 'tropical_monsoon_rain'
          ? 0.000095
          : 0.000045;
    }

    // Scale IBL environmentIntensity and toneMappingExposure so Nocturnal Starlight Mode
    // and Golden Hour visibly transform terrain, buildings, and horizon silhouettes
    handles.scene.environmentIntensity = lightingState.isNightOrStarlight
      ? 0.14
      : lightingState.phase === 'dawn' || lightingState.phase === 'dusk'
      ? 0.45
      : 0.92;
    handles.renderer.toneMappingExposure = lightingState.isNightOrStarlight
      ? 0.68
      : lightingState.phase === 'dawn' || lightingState.phase === 'dusk'
      ? 0.94
      : 1.12;
    handles.distantMat.color.set(
      lightingState.isNightOrStarlight
        ? '#090f24'
        : lightingState.phase === 'dawn' || lightingState.phase === 'dusk'
        ? '#7c2d12'
        : '#475569'
    );

    handles.hemiLight.color.set(lightingState.hemiSkyHex);
    handles.hemiLight.groundColor.set(lightingState.hemiGroundHex);
    handles.hemiLight.intensity = lightingState.hemiIntensity;

    handles.sunLight.color.set(lightingState.directionalLightHex);
    handles.sunLight.intensity = lightingState.directionalLightIntensity;
    handles.sunLight.position.set(
      lightingState.shadowCasterPosition.x,
      lightingState.shadowCasterPosition.y,
      lightingState.shadowCasterPosition.z
    );
    handles.sunLight.target.position.set(0, 0, 0);
    handles.sunLight.target.updateMatrixWorld();

    // Update 3D Celestial Sun & Moon orbs along solar/lunar trajectory
    const orbDist = 115;
    handles.sunOrbGroup.position.set(
      lightingState.sunDirection.x * orbDist,
      Math.max(18, lightingState.sunDirection.y * 42),
      lightingState.sunDirection.z * orbDist
    );
    handles.sunOrbGroup.visible =
      !lightingState.isNightOrStarlight && lightingState.sunElevationDeg >= -4;

    handles.moonOrbGroup.position.set(
      -42 + lightingState.moonDirection.x * 28,
      27,
      -96 + lightingState.moonDirection.z * 24
    );
    handles.moonOrbGroup.visible =
      lightingState.isNightOrStarlight || lightingState.sunElevationDeg <= 14;

    // Update Starry Night Sky Dome & Milky Way visibility
    handles.starDomeMat.opacity = lightingState.starlightIntensity * 0.98;
    handles.milkyWayMat.opacity = lightingState.starlightIntensity * 0.85;
    handles.constellationGroup.visible = lightingState.starlightIntensity > 0.12;

    // Dynamically stretch & orient ground contact shadows on every placed 3D object
    // opposite the active sun/moon azimuth & elevation for crisp real-time shadow feedback
    const activeAzimRad = THREE.MathUtils.degToRad(lightingState.sunAzimuthDeg);
    const stretchFactor = THREE.MathUtils.clamp(
      1.85 - Math.abs(lightingState.sunElevationDeg) / 65,
      1.05,
      2.15
    );
    const shadowOffsetDist = (stretchFactor - 1.0) * 1.85;
    const shadowDirX = -Math.cos(activeAzimRad);
    const shadowDirZ = -Math.sin(activeAzimRad);

    handles.objectMeshMap.forEach((group) => {
      const contactDisc = group.getObjectByName('contact_shadow') as THREE.Mesh | undefined;
      if (contactDisc) {
        // Counter-rotate local parent rotation so shadow always points away from world sun azimuth
        const localAngle = -activeAzimRad - group.rotation.y;
        contactDisc.rotation.z = localAngle;
        contactDisc.scale.set(stretchFactor, 1.0, 1.0);
        const worldOffX = shadowDirX * shadowOffsetDist;
        const worldOffZ = shadowDirZ * shadowOffsetDist;
        const cosR = Math.cos(-group.rotation.y);
        const sinR = Math.sin(-group.rotation.y);
        contactDisc.position.set(
          worldOffX * cosR - worldOffZ * sinR,
          0.03,
          worldOffX * sinR + worldOffZ * cosR
        );
      }
    });

    const waterMat = handles.waterMesh.material as THREE.MeshStandardMaterial;
    waterMat.color.set(biome.waterHex);
    handles.waterMesh.position.y = waterLevel;

    handles.renderer.render(handles.scene, handles.camera);
  }, [
    biomeId,
    activeWeather,
    sunElevation,
    sunAzimuth,
    timeOfDay,
    starlightMode,
    waterLevel,
    placedObjects,
  ]);

  // 5. Trigger smooth camera preset transitions
  useEffect(() => {
    const handles = sceneHandlesRef.current;
    if (!handles || cameraPresetTrigger === 0) return;
    handles.triggerCameraPreset(cameraPreset);
  }, [cameraPreset, cameraPresetTrigger]);

  return (
    <div
      ref={canvasMountRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none z-0"
      aria-label="Khung nhìn bản đồ 3D Vector thế giới mở 10x10km"
    />
  );
};
