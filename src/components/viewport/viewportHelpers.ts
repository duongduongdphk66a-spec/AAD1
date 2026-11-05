import * as THREE from 'three';
import {
  BIOME_WEATHER_PRESETS,
  createGPUWeatherSystem,
  WeatherId,
  WeatherPresetType,
} from '../../world/registry';
import { createDynamicTerrainMaterial } from '../../world/materialsAndTextures';

export class WorldEnvironmentController {
  private terrainMaterial: THREE.ShaderMaterial;
  private weatherPoints: THREE.Points;
  private targetSnowIntensity = 0.85;
  private clock = new THREE.Clock();

  constructor(scene: THREE.Scene, initialPreset: WeatherPresetType = 'snowstorm') {
    this.terrainMaterial = createDynamicTerrainMaterial();
    this.weatherPoints = createGPUWeatherSystem(initialPreset);
    this.targetSnowIntensity = BIOME_WEATHER_PRESETS[initialPreset].snowCoverageRate;
    scene.add(this.weatherPoints);
  }

  public getTerrainMaterial(): THREE.ShaderMaterial {
    return this.terrainMaterial;
  }

  public getWeatherPoints(): THREE.Points {
    return this.weatherPoints;
  }

  public setTargetSnowIntensity(val: number): void {
    this.targetSnowIntensity = THREE.MathUtils.clamp(val, 0, 1);
  }

  public setShaderParameters(params: {
    snowIntensity?: number;
    snowAltitude?: number;
    lavaLevel?: number;
    lavaEmissiveIntensity?: number;
    triplanarSharpness?: number;
    sunDirection?: THREE.Vector3;
  }): void {
    const u = this.terrainMaterial.uniforms;
    if (params.snowIntensity !== undefined) {
      this.targetSnowIntensity = THREE.MathUtils.clamp(params.snowIntensity, 0, 1);
      u.uSnowIntensity.value = this.targetSnowIntensity;
    }
    if (params.snowAltitude !== undefined) {
      u.uSnowAltitude.value = params.snowAltitude;
    }
    if (params.lavaLevel !== undefined) {
      u.uLavaLevel.value = params.lavaLevel;
    }
    if (params.lavaEmissiveIntensity !== undefined) {
      u.uLavaEmissiveIntensity.value = params.lavaEmissiveIntensity;
    }
    if (params.triplanarSharpness !== undefined) {
      u.uTriplanarSharpness.value = params.triplanarSharpness;
    }
    if (params.sunDirection !== undefined) {
      u.uSunDirection.value.copy(params.sunDirection).normalize();
    }
  }

  public switchWeatherPreset(preset: WeatherPresetType): void {
    const cfg = BIOME_WEATHER_PRESETS[preset];
    const mat = this.weatherPoints.material as THREE.ShaderMaterial;

    mat.uniforms.uTerminalVelocity.value.copy(cfg.terminalVelocity);
    mat.uniforms.uWindVelocity.value.copy(cfg.windVelocity);
    mat.uniforms.uTurbulenceAmp.value.copy(cfg.turbulenceAmplitude);
    mat.uniforms.uTurbulenceFreq.value = cfg.turbulenceFrequency;
    mat.uniforms.uParticleSize.value = cfg.particleSize;
    mat.uniforms.uParticleColor.value.copy(cfg.color);

    this.targetSnowIntensity = cfg.snowCoverageRate;
  }

  public updateFrame(camera: THREE.Camera): void {
    const elapsedTime = this.clock.getElapsedTime();

    this.terrainMaterial.uniforms.uTime.value = elapsedTime;
    const currentSnow = this.terrainMaterial.uniforms.uSnowIntensity.value;
    this.terrainMaterial.uniforms.uSnowIntensity.value = THREE.MathUtils.lerp(
      currentSnow,
      this.targetSnowIntensity,
      0.03
    );

    const weatherMat = this.weatherPoints.material as THREE.ShaderMaterial;
    weatherMat.uniforms.uTime.value = elapsedTime;
    weatherMat.uniforms.uCameraPosition.value.copy(camera.position);
  }

  public dispose(scene?: THREE.Scene): void {
    if (scene) {
      scene.remove(this.weatherPoints);
    }
    this.weatherPoints.geometry.dispose();
    (this.weatherPoints.material as THREE.Material).dispose();
    this.terrainMaterial.dispose();
  }
}

export function buildPlanetaryWeatherGroup(weatherId: WeatherId): THREE.Group {
  const group = new THREE.Group();
  group.name = `weather_${weatherId}`;

  if (weatherId === 'mars_dust_storm') {
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
        const torus = new THREE.Mesh(
          new THREE.TorusGeometry(ringR, 0.18 + k * 0.03, 6, 18),
          ringMat
        );
        torus.rotation.x = Math.PI / 2 + (k % 2 === 0 ? 0.08 : -0.08);
        torus.position.y = 0.8 + k * 2.4 * fo.scale;
        devil.add(torus);
      }
      group.add(devil);
    }
  } else if (weatherId === 'venus_acid_rain') {
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
    const auroraColors = [0x2dd4bf, 0x38bdf8, 0xf43f5e, 0xa855f7];
    for (let a = 0; a < 8; a++) {
      const col = auroraColors[a % auroraColors.length];
      const ribbonMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
      });
      const ribbon = new THREE.Mesh(
        new THREE.TorusGeometry(22 + a * 6, 1.4, 8, 40, Math.PI * 1.35),
        ribbonMat
      );
      ribbon.rotation.x = Math.PI / 2 + (a % 2 === 0 ? 0.16 : -0.16);
      ribbon.rotation.z = a * 0.7;
      ribbon.position.y = 26 + a * 2.5;
      ribbon.userData.isAuroraRibbon = true;
      ribbon.userData.phase = a * 0.8;
      group.add(ribbon);
    }

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

export function buildCelestialSkySystem(): {
  celestialRoot: THREE.Group;
  starDomeMat: THREE.PointsMaterial;
  milkyWayMat: THREE.PointsMaterial;
  constellationGroup: THREE.Group;
  sunOrbGroup: THREE.Group;
  moonOrbGroup: THREE.Group;
} {
  const celestialRoot = new THREE.Group();
  celestialRoot.name = 'celestial_day_night_sky';

  const starCount = 1800;
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const palette = [
    new THREE.Color(0xffffff),
    new THREE.Color(0x93c5fd),
    new THREE.Color(0xfde68a),
    new THREE.Color(0xfdba74),
    new THREE.Color(0xc4b5fd),
  ];

  for (let i = 0; i < starCount; i++) {
    const theta = (i * 2.3999632) % (Math.PI * 2);
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
    const angle =
      i < 34
        ? Math.PI * 1.02 + (i / 34 - 0.5) * 1.15
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

export function animatePropNodes(
  animatedPropNodes: THREE.Object3D[],
  elapsed: number,
  dt: number
): void {
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
}

export function animateCelestialAndWeather(
  celestialRoot: THREE.Group,
  constellationGroup: THREE.Group,
  weatherRoot: THREE.Group,
  elapsed: number,
  dt: number
): void {
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
}
