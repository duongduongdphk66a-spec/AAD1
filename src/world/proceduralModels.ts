import * as THREE from 'three';
import { PrefabId } from './terrainEngine';

/**
 * Shared material cache and procedural 3-12 part composite models
 * styled after Genshin Impact (Mondstadt, Inazuma, Liyue) & Pokémon (Paldea, Hisui).
 * Every model pivots at bottom-center (y = 0) and includes a soft radial contact shadow disc.
 */
export class ProceduralPrefabFactory {
  private contactShadowMat: THREE.MeshBasicMaterial;
  private isSoftwareGl: boolean;

  constructor(contactShadowTexture: THREE.Texture, isSoftwareGl: boolean) {
    this.isSoftwareGl = isSoftwareGl;
    this.contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
  }

  private addContactShadow(group: THREE.Group, radius: number): void {
    const geo = new THREE.CircleGeometry(radius, 24);
    geo.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(geo, this.contactShadowMat);
    disc.position.y = 0.03;
    disc.name = 'contact_shadow';
    group.add(disc);
  }

  public createPrefab(prefabId: PrefabId): THREE.Group {
    switch (prefabId) {
      case 'himalaya_matterhorn_peak':
        return this.createHimalayaMatterhornPeak();
      case 'sahara_atacama_oasis':
        return this.createSaharaAtacamaOasis();
      case 'hawaii_kilauea_shield':
        return this.createHawaiiKilaueaShield();
      case 'amazon_congo_canopy_tree':
        return this.createAmazonCongoCanopyTree();
      case 'taiga_spruce_grove':
        return this.createTaigaSpruceGrove();
      case 'pluto_cryo_volcano':
        return this.createPlutoCryoVolcano();
      case 'titan_methane_geyser':
        return this.createTitanMethaneGeyser();
      case 'europa_penitentes_spire':
        return this.createEuropaPenitentesSpire();
      case 'mars_olympus_shield':
        return this.createMarsOlympusShield();
      case 'venus_pancake_dome':
        return this.createVenusPancakeDome();
      case 'meteor_impact_crater':
        return this.createMeteorImpactCrater();
      case 'exoplanet_crystal_spire':
        return this.createExoplanetCrystalSpire();
      case 'floating_sky_island':
        return this.createFloatingSkyIsland();
      case 'sheer_cliff_wall':
        return this.createSheerCliffWall();
      case 'active_volcano':
        return this.createActiveVolcano();
      case 'abyss_chasm_vortex':
        return this.createAbyssChasmVortex();
      case 'statue_of_seven':
        return this.createStatueOfSeven();
      case 'pokemon_gym_stadium':
        return this.createPokemonGymStadium();
      case 'berry_apricorn_tree':
        return this.createBerryApricornTree();
      case 'windmill_cottage':
        return this.createWindmillCottage();
      case 'sakura_shrine':
        return this.createSakuraShrine();
      case 'pokemon_center':
        return this.createPokemonCenter();
      case 'karst_mountain':
        return this.createKarstMountain();
      case 'volcanic_peak':
        return this.createVolcanicPeak();
      case 'sakura_tree':
        return this.createSakuraTree();
      case 'emerald_pine':
        return this.createEmeraldPine();
      case 'aether_crystal':
        return this.createAetherCrystal();
      case 'ancient_bridge':
        return this.createAncientBridge();
      default:
        return this.createWindmillCottage();
    }
  }

  /**
   * NEW 1. Đảo Bay Celestia / Khánh Vân Đỉnh (11 distinct parts, levitating at y = 14.5m)
   */
  private createFloatingSkyIsland(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 8.5);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.85,
      metalness: 0.1,
      flatShading: true,
    });
    const amberRockMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.82,
      metalness: 0.12,
      flatShading: true,
    });
    const grassTopMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.65,
      metalness: 0.05,
    });
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.35,
      metalness: 0.15,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.88,
    });
    const skyCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.7,
    });
    const waterfallMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.82,
      roughness: 0.15,
    });
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.25,
      roughness: 0.9,
    });

    // Part 1: Ground-level Ancient Wind/Adepti Resonance Anchor Pad
    const groundAnchor = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.35, 12), marbleMat);
    groundAnchor.position.y = 0.18;
    group.add(groundAnchor);

    const groundRuneRing = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.08, 8, 24), skyCrystalMat);
    groundRuneRing.rotation.x = Math.PI / 2;
    groundRuneRing.position.y = 0.38;
    group.add(groundRuneRing);

    // Levitating Island Assembly hovering at y = 14.5m
    const skyIsland = new THREE.Group();
    skyIsland.position.y = 14.5;
    skyIsland.userData.isFloatingIsland = true;
    skyIsland.userData.baseY = 14.5;

    // Part 2: Inverted Conical Floating Rock Mass
    const mainRockCone = new THREE.Mesh(new THREE.ConeGeometry(6.8, 8.5, 7), stoneMat);
    mainRockCone.rotation.x = Math.PI; // Pointing downward
    mainRockCone.position.y = -4.2;
    mainRockCone.castShadow = !this.isSoftwareGl;
    skyIsland.add(mainRockCone);

    // Part 3 & 4: Jagged Hanging Root Crags + Glowing Plaustrite Core Crystal underneath
    const subRoot1 = new THREE.Mesh(new THREE.ConeGeometry(2.8, 5.5, 5), amberRockMat);
    subRoot1.rotation.x = Math.PI;
    subRoot1.position.set(-2.6, -3.8, 1.4);
    skyIsland.add(subRoot1);

    const plaustriteCore = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), goldMat);
    plaustriteCore.position.set(0, -8.2, 0);
    skyIsland.add(plaustriteCore);

    // Part 5: Lush Emerald Grass Terrace Cap on Top of the Island
    const grassCap = new THREE.Mesh(new THREE.CylinderGeometry(6.9, 6.5, 1.1, 7), grassTopMat);
    grassCap.position.y = 0.45;
    grassCap.receiveShadow = !this.isSoftwareGl;
    skyIsland.add(grassCap);

    // Part 6: Celestia / Qingyun White Marble Sanctuary Pavilion
    const pavilionBase = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 0.65, 8), marbleMat);
    pavilionBase.position.y = 1.25;
    skyIsland.add(pavilionBase);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.8, 8), marbleMat);
      col.position.set(Math.cos(a) * 2.4, 2.8, Math.sin(a) * 2.4);
      skyIsland.add(col);
    }

    // Part 7: Golden Upturned Celestial Pagoda Roof
    const skyRoof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 2.1, 8), goldMat);
    skyRoof.position.y = 5.1;
    skyRoof.castShadow = !this.isSoftwareGl;
    skyIsland.add(skyRoof);

    // Part 8: Rotating Celestial Halo Ring around the Pavilion
    const haloRing = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.12, 8, 32), goldMat);
    haloRing.rotation.x = Math.PI * 0.38;
    haloRing.position.y = 3.2;
    skyIsland.add(haloRing);

    // Part 9: Cascading Sky Waterfall pouring over the Island Edge
    const waterfallStream = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9.8, 0.35), waterfallMat);
    waterfallStream.position.set(0, -4.1, 6.2);
    waterfallStream.rotation.x = -0.12;
    skyIsland.add(waterfallStream);

    // Part 10 & 11: Orbiting Floating Stepping-Stone Islets & Cloud Puffs
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3 + 0.5;
      const islet = new THREE.Group();
      islet.position.set(Math.cos(angle) * 9.2, -1.5 + i * 1.1, Math.sin(angle) * 9.2);
      const miniRock = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.4, 5), stoneMat);
      miniRock.rotation.x = Math.PI;
      const miniTop = new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.5, 0.4, 5), grassTopMat);
      miniTop.position.y = 1.3;
      islet.add(miniRock, miniTop);
      skyIsland.add(islet);

      const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(1.45, 1), cloudMat);
      cloud.scale.set(1.5, 0.55, 1.2);
      cloud.position.set(Math.cos(angle + 0.5) * 6.8, -2.2, Math.sin(angle + 0.5) * 6.8);
      skyIsland.add(cloud);
    }

    group.add(skyIsland);
    return group;
  }

  /**
   * NEW 2. Vách Đá Dựng Đứng Tuyệt Vân / Sheer Vertical Cliff Wall (9 distinct parts)
   */
  private createSheerCliffWall(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 9.5);

    const cliffStoneMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.9,
      metalness: 0.08,
      flatShading: true,
    });
    const strataLightMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.86,
      metalness: 0.08,
      flatShading: true,
    });
    const mossCapMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.68,
      metalness: 0.05,
    });
    const woodPlankMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.85,
      metalness: 0.08,
    });
    const amberOreMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });

    // Part 1: Sheer 90-Degree Vertical Monolith Wall (21m tall)
    const mainWall = new THREE.Mesh(new THREE.BoxGeometry(14.5, 21.0, 5.8), cliffStoneMat);
    mainWall.position.set(0, 10.5, 0);
    mainWall.castShadow = !this.isSoftwareGl;
    mainWall.receiveShadow = !this.isSoftwareGl;
    group.add(mainWall);

    // Part 2 & 3: Flanking Vertical Stratified Cliff Buttresses
    const leftButtress = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.8, 19.5, 6), strataLightMat);
    leftButtress.position.set(-7.2, 9.75, 0.8);
    leftButtress.castShadow = !this.isSoftwareGl;
    group.add(leftButtress);

    const rightButtress = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.6, 18.0, 6), strataLightMat);
    rightButtress.position.set(7.2, 9.0, 0.6);
    rightButtress.castShadow = !this.isSoftwareGl;
    group.add(rightButtress);

    // Part 4: Dramatic Overhanging Cliff Ledge at y = 17.5m
    const overhang = new THREE.Mesh(new THREE.BoxGeometry(15.6, 2.2, 7.6), strataLightMat);
    overhang.position.set(0, 18.8, 1.1);
    overhang.castShadow = !this.isSoftwareGl;
    group.add(overhang);

    // Part 5: Lush Top Plateau Grass Crown at y = 20.5m
    const topCrown = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.95, 7.2), mossCapMat);
    topCrown.position.set(0, 20.3, 1.0);
    group.add(topCrown);

    // Part 6 & 7: Liyue Cliffside Wooden Plank Walk (Cầu Ván Treo Vách Đá) at y = 10.5m
    const cliffWalkDeck = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.38, 2.2), woodPlankMat);
    cliffWalkDeck.position.set(0, 10.2, 3.7);
    group.add(cliffWalkDeck);

    for (let x = -6.5; x <= 6.5; x += 3.25) {
      const supportStrut = new THREE.Mesh(new THREE.BoxGeometry(0.32, 2.6, 0.32), woodPlankMat);
      supportStrut.position.set(x, 9.1, 3.5);
      supportStrut.rotation.x = -0.55;
      group.add(supportStrut);

      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.3, 0.24), woodPlankMat);
      post.position.set(x, 10.9, 4.65);
      group.add(post);
    }

    // Part 8 & 9: Glowing Cor Lapis / Geo Amber Veins on the Sheer Cliff Face
    for (const pos of [
      [-4.2, 14.5, 3.1],
      [3.8, 6.2, 3.1],
      [0.5, 15.2, 3.1],
    ]) {
      const ore = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 0), amberOreMat);
      ore.position.set(pos[0], pos[1], pos[2]);
      group.add(ore);
    }

    return group;
  }

  /**
   * NEW 3. Núi Lửa Phun Trào Natlan / Mt. Chimney Active Volcano (10 distinct parts + animated smoke plume)
   */
  private createActiveVolcano(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 10.5);

    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.92,
      metalness: 0.1,
      flatShading: true,
    });
    const scorchedRockMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.88,
      metalness: 0.12,
      flatShading: true,
    });
    const magmaBrightMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xf97316,
      emissiveIntensity: 1.15,
      roughness: 0.18,
    });
    const lavaStreamMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xdc2626,
      emissiveIntensity: 0.95,
      roughness: 0.25,
    });
    const smokeDarkMat = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      emissive: 0x7c2d12,
      emissiveIntensity: 0.28,
      roughness: 0.92,
      transparent: true,
      opacity: 0.84,
    });

    // Part 1: Massive Truncated Volcanic Cone
    const mainCone = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 9.2, 13.5, 9), basaltMat);
    mainCone.position.y = 6.75;
    mainCone.castShadow = !this.isSoftwareGl;
    mainCone.receiveShadow = !this.isSoftwareGl;
    group.add(mainCone);

    // Part 2: Jagged Crater Rim Crown
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const rimPeak = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3.2, 5), scorchedRockMat);
      rimPeak.position.set(Math.cos(a) * 3.7, 13.6, Math.sin(a) * 3.7);
      rimPeak.rotation.z = (Math.random() - 0.5) * 0.2;
      group.add(rimPeak);
    }

    // Part 3: Boiling Molten Magma Caldera Pool at the Summit
    const craterPool = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 2.8, 0.8, 9), magmaBrightMat);
    craterPool.position.y = 13.3;
    group.add(craterPool);

    // Part 4, 5, 6: 3 Flowing Molten Lava Rivers down the Flanks
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + 0.35;
      const stream = new THREE.Mesh(new THREE.BoxGeometry(1.55, 12.8, 0.45), lavaStreamMat);
      stream.position.set(Math.cos(a) * 6.1, 6.2, Math.sin(a) * 6.1);
      stream.rotation.y = -a + Math.PI / 2;
      stream.rotation.x = 0.42;
      group.add(stream);
    }

    // Part 7: Basal Magma Pool Apron at Foot of Volcano
    const baseLavaPool = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.2, 0.28, 12), lavaStreamMat);
    baseLavaPool.position.y = 0.14;
    group.add(baseLavaPool);

    // Part 8, 9, 10: Animated Erupting Volcanic Smoke Plume & Glowing Ash Embers
    const plumeGroup = new THREE.Group();
    plumeGroup.position.y = 14.2;
    plumeGroup.userData.isVolcanoPlume = true;

    for (let i = 0; i < 5; i++) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3 + i * 0.38, 1), smokeDarkMat);
      puff.position.set(
        Math.sin(i * 1.7) * 0.9,
        i * 1.55,
        Math.cos(i * 1.7) * 0.9
      );
      puff.userData.puffIndex = i;
      plumeGroup.add(puff);
    }

    for (let i = 0; i < 6; i++) {
      const ember = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 0), magmaBrightMat);
      const a = (i / 6) * Math.PI * 2;
      ember.position.set(Math.cos(a) * 1.8, 1.2 + (i % 3) * 1.6, Math.sin(a) * 1.8);
      plumeGroup.add(ember);
    }

    group.add(plumeGroup);
    return group;
  }

  /**
   * NEW 4. Vực Sâu Vực Đá & Hố Area Zero / Abyss Chasm Vortex (10 distinct parts)
   */
  private createAbyssChasmVortex(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 8.8);

    const obsidianRimMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.78,
      metalness: 0.25,
      flatShading: true,
    });
    const voidPitMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.95,
      metalness: 0.05,
    });
    const abyssPurpleMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 0.95,
      roughness: 0.18,
      metalness: 0.6,
    });
    const terastalCyanMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
      roughness: 0.12,
      metalness: 0.75,
    });

    // Part 1: Dark Abyss Void Crater Floor Disc
    const voidFloor = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.8, 0.25, 16), voidPitMat);
    voidFloor.position.y = 0.12;
    group.add(voidFloor);

    // Part 2: Raised Jagged Crater Rim Ring
    const outerRim = new THREE.Mesh(new THREE.TorusGeometry(6.0, 1.15, 7, 16), obsidianRimMat);
    outerRim.rotation.x = Math.PI / 2;
    outerRim.position.y = 0.65;
    group.add(outerRim);

    // Part 3..6: 6 Inward-Cantilevered Abyssal Ruin Fang Pillars
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const fang = new THREE.Mesh(new THREE.ConeGeometry(1.15, 6.2, 5), obsidianRimMat);
      fang.position.set(Math.cos(a) * 6.2, 2.8, Math.sin(a) * 6.2);
      fang.rotation.z = Math.cos(a) * 0.32;
      fang.rotation.x = -Math.sin(a) * 0.32;
      fang.castShadow = !this.isSoftwareGl;
      group.add(fang);

      // Glowing Terastal / Abyss Crystal Spike inside Rim
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.85, 0),
        i % 2 === 0 ? abyssPurpleMat : terastalCyanMat
      );
      crystal.scale.set(0.65, 1.8, 0.65);
      crystal.position.set(Math.cos(a + 0.4) * 4.4, 1.2, Math.sin(a + 0.4) * 4.4);
      group.add(crystal);
    }

    // Part 7..10: Animated Swirling Abyssal / Area Zero Vortex Portal
    const vortexGroup = new THREE.Group();
    vortexGroup.position.y = 2.6;
    vortexGroup.userData.isAbyssVortex = true;

    const ringOuter = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.14, 8, 32), abyssPurpleMat);
    ringOuter.rotation.x = Math.PI / 2;
    vortexGroup.add(ringOuter);

    const ringInner = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.12, 8, 24), terastalCyanMat);
    ringInner.rotation.x = Math.PI * 0.38;
    vortexGroup.add(ringInner);

    const abyssCore = new THREE.Mesh(new THREE.OctahedronGeometry(1.35, 0), abyssPurpleMat);
    abyssCore.position.y = 1.6;
    vortexGroup.add(abyssCore);

    group.add(vortexGroup);
    return group;
  }

  /**
   * NEW 5. Thất Thiên Thần Tượng Genshin / Statue of the Seven (9 distinct parts)
   */
  private createStatueOfSeven(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 4.2);

    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.32,
      metalness: 0.12,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.22,
      metalness: 0.85,
    });
    const anemoGlowMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      emissive: 0x0d9488,
      emissiveIntensity: 0.95,
      roughness: 0.15,
      metalness: 0.5,
    });

    // Part 1 & 2: Two-Tiered Circular Sanctuary Plinth
    const baseTier1 = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.0, 0.55, 16), marbleMat);
    baseTier1.position.y = 0.28;
    group.add(baseTier1);

    const baseTier2 = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.2, 0.65, 16), marbleMat);
    baseTier2.position.y = 0.85;
    group.add(baseTier2);

    // Part 3: Golden Resonance Ring on Plinth
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.08, 8, 24), goldMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.6;
    group.add(baseRing);

    // Part 4: Fluted Celestial Pedestal Column
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.05, 3.2, 12), marbleMat);
    column.position.y = 2.75;
    column.castShadow = !this.isSoftwareGl;
    group.add(column);

    // Part 5: Sculpted Robed Archon Figure
    const robeBody = new THREE.Mesh(new THREE.ConeGeometry(0.95, 3.1, 10), marbleMat);
    robeBody.position.y = 5.4;
    robeBody.castShadow = !this.isSoftwareGl;
    group.add(robeBody);

    const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), marbleMat);
    headSphere.position.y = 7.15;
    group.add(headSphere);

    // Part 6 & 7: Twin Sculpted Celestial Angel Wings
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.9, 1.35), marbleMat);
      wing.position.set(side * 0.95, 6.4, -0.35);
      wing.rotation.z = -side * 0.42;
      wing.rotation.y = side * 0.35;
      group.add(wing);
    }

    // Part 8: Divine Golden Halo Ring behind the Archon
    const divineHalo = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.09, 8, 28), goldMat);
    divineHalo.position.set(0, 6.8, -0.55);
    group.add(divineHalo);

    // Part 9: Levitating Glowing Celestial / Anemo Orb in the Statue's Hands
    const orbGroup = new THREE.Group();
    orbGroup.position.set(0, 6.0, 0.85);
    orbGroup.userData.isFloatingCrystal = true;
    orbGroup.userData.baseY = 6.0;
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 14), anemoGlowMat);
    const orbRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.05, 8, 20), goldMat);
    orbRing.rotation.x = Math.PI / 3;
    orbGroup.add(orb, orbRing);
    group.add(orbGroup);

    return group;
  }

  /**
   * NEW 6. Sân Đấu Pokémon Gym Stadium (11 distinct parts)
   */
  private createPokemonGymStadium(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 9.5);

    const stadiumWallMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.45,
      metalness: 0.18,
    });
    const crimsonArchMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.25,
      metalness: 0.38,
    });
    const turfGreenMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.72,
      metalness: 0.05,
    });
    const chalkLineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf8fafc,
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });
    const floodlightMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.95,
      roughness: 0.1,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.55,
      roughness: 0.2,
      metalness: 0.85,
    });

    // Part 1: Outer Stadium Bowl Colosseum Rim
    const outerBowl = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 7.4, 2.6, 24, 1, true), stadiumWallMat);
    outerBowl.position.y = 1.3;
    outerBowl.material.side = THREE.DoubleSide;
    outerBowl.castShadow = !this.isSoftwareGl;
    group.add(outerBowl);

    // Part 2: Emerald Turf Battle Pitch
    const pitch = new THREE.Mesh(new THREE.CylinderGeometry(7.3, 7.3, 0.35, 24), turfGreenMat);
    pitch.position.y = 0.18;
    pitch.receiveShadow = !this.isSoftwareGl;
    group.add(pitch);

    // Part 3 & 4: Official Pokémon Battle Court Markings (Pokéball Center Ring + Midline)
    const centerCircle = new THREE.Mesh(new THREE.RingGeometry(1.9, 2.15, 24), chalkLineMat);
    centerCircle.rotation.x = -Math.PI / 2;
    centerCircle.position.y = 0.38;
    group.add(centerCircle);

    const midLine = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.04, 0.22), chalkLineMat);
    midLine.position.y = 0.38;
    group.add(midLine);

    // Part 5 & 6: Twin Sweeping Crimson Poké-Dome Roof Arches
    for (const zOff of [-2.4, 2.4]) {
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(7.6, 0.48, 10, 32, Math.PI),
        crimsonArchMat
      );
      arch.position.set(0, 1.2, zOff);
      arch.castShadow = !this.isSoftwareGl;
      group.add(arch);
    }

    // Part 7..10: 4 Towering Stadium Floodlight Pylons
    for (const [px, pz] of [
      [-6.2, -5.2],
      [6.2, -5.2],
      [-6.2, 5.2],
      [6.2, 5.2],
    ]) {
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 8.2, 8), stadiumWallMat);
      pylon.position.set(px, 4.1, pz);
      group.add(pylon);

      const lightBank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.85, 0.45), floodlightMat);
      lightBank.position.set(px, 8.3, pz);
      lightBank.lookAt(0, 1.0, 0);
      group.add(lightBank);
    }

    // Part 11: Floating Golden Pokéball Gym Crest at Apex
    const crestGroup = new THREE.Group();
    crestGroup.position.set(0, 9.2, 0);
    crestGroup.userData.isFloatingCrystal = true;
    crestGroup.userData.baseY = 9.2;
    const crestSphere = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 16), crimsonArchMat);
    const crestBelt = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.14, 8, 24), goldMat);
    crestGroup.add(crestSphere, crestBelt);
    group.add(crestGroup);

    return group;
  }

  /**
   * NEW 7. Cây Quả Berry & Apricorn Pokémon (9 distinct parts)
   */
  private createBerryApricornTree(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 4.2);

    const barkMat = new THREE.MeshStandardMaterial({ color: 0x65371d, roughness: 0.88, metalness: 0.05 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55, metalness: 0.06 });
    const canopyBrightMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.42, metalness: 0.08 });
    const oranBlueMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.22,
    });
    const sitrusGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
      roughness: 0.22,
    });
    const pechaPinkMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xdb2777,
      emissiveIntensity: 0.35,
      roughness: 0.22,
    });

    // Part 1: Sculpted Fruit-Tree Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.78, 3.8, 9), barkMat);
    trunk.position.y = 1.9;
    trunk.castShadow = !this.isSoftwareGl;
    group.add(trunk);

    // Part 2, 3, 4: Lush Cel-Shaded Foliage Clusters
    const foliageClusters = [
      { x: 0, y: 5.2, z: 0, r: 2.55, mat: canopyMat },
      { x: -1.4, y: 4.5, z: 0.8, r: 1.75, mat: canopyBrightMat },
      { x: 1.5, y: 4.6, z: -0.7, r: 1.8, mat: canopyBrightMat },
      { x: 0.2, y: 6.5, z: 0.3, r: 1.65, mat: canopyBrightMat },
    ];
    for (const c of foliageClusters) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(c.r, 1), c.mat);
      puff.position.set(c.x, c.y, c.z);
      puff.castShadow = !this.isSoftwareGl;
      group.add(puff);
    }

    // Part 5..8: 12 Colorful 3D Berries & Apricorns hanging around the Canopy
    const berryMats = [oranBlueMat, sitrusGoldMat, pechaPinkMat];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rad = 2.15 + (i % 2) * 0.45;
      const berry = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 10),
        berryMats[i % berryMats.length]
      );
      berry.scale.set(1.0, 1.22, 1.0);
      berry.position.set(Math.cos(a) * rad, 4.1 + (i % 3) * 0.75, Math.sin(a) * rad);
      group.add(berry);
    }

    // Part 9: Harvested Berry Basket at Trunk Base
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.45, 0.55, 10), barkMat);
    basket.position.set(1.2, 0.28, 0.9);
    group.add(basket);

    return group;
  }

  /**
   * 1. Nhà Cối Xay Gió Mondstadt (9 distinct parts)
   */
  private createWindmillCottage(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 5.8);

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.9,
      metalness: 0.05,
    });
    const stuccoMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      roughness: 0.62,
      metalness: 0.05,
    });
    const timberMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.85,
      metalness: 0.1,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.45,
      metalness: 0.18,
    });
    const goldMetalMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.25,
      metalness: 0.82,
    });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.75,
      roughness: 0.2,
    });
    const sailCanvasMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.7,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    // Part 1: Beveled Stone Plinth Base
    const baseMesh = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4.3, 1.2, 8), stoneMat);
    baseMesh.position.y = 0.6;
    baseMesh.castShadow = !this.isSoftwareGl;
    baseMesh.receiveShadow = !this.isSoftwareGl;
    group.add(baseMesh);

    // Part 2: Main Stucco Cottage Hall
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.6, 4.2), stuccoMat);
    bodyMesh.position.set(-0.6, 2.9, 0);
    bodyMesh.castShadow = !this.isSoftwareGl;
    bodyMesh.receiveShadow = !this.isSoftwareGl;
    group.add(bodyMesh);

    // Part 3: Timber Framing Beams
    const beamFrame = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.35, 4.4), timberMat);
    beamFrame.position.set(-0.6, 4.6, 0);
    group.add(beamFrame);

    // Part 4: Steep Pitched Extruded Gable Roof
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-2.9, 0);
    roofShape.lineTo(0, 2.7);
    roofShape.lineTo(2.9, 0);
    roofShape.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
      depth: 4.8,
      bevelEnabled: true,
      bevelThickness: 0.15,
      bevelSize: 0.12,
      bevelSegments: 2,
    });
    roofGeo.center();
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.set(-0.6, 6.0, 0);
    roofMesh.castShadow = !this.isSoftwareGl;
    group.add(roofMesh);

    // Part 5: Tall Octagonal Windmill Tower
    const towerMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.0, 8.2, 8), stuccoMat);
    towerMesh.position.set(1.9, 4.8, 0);
    towerMesh.castShadow = !this.isSoftwareGl;
    group.add(towerMesh);

    // Part 6: Conical Tower Turret Roof
    const coneRoof = new THREE.Mesh(new THREE.ConeGeometry(2.1, 2.8, 8), roofMat);
    coneRoof.position.set(1.9, 10.1, 0);
    coneRoof.castShadow = !this.isSoftwareGl;
    group.add(coneRoof);

    // Part 7: Stone Chimney Stack
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.0, 0.8), stoneMat);
    chimney.position.set(-2.1, 6.6, -1.2);
    group.add(chimney);

    // Part 8: Glowing Cottage Windows
    const winFront = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.3, 4.35), windowMat);
    winFront.position.set(-0.8, 3.1, 0);
    group.add(winFront);

    // Part 9: Rotating 4-Blade Windmill Rotor Assembly
    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(1.9, 8.1, 1.85);
    rotorGroup.userData.isWindmillRotor = true;

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.7, 12), goldMetalMat);
    hub.rotation.x = Math.PI / 2;
    rotorGroup.add(hub);

    for (let i = 0; i < 4; i++) {
      const bladePivot = new THREE.Group();
      bladePivot.rotation.z = (i * Math.PI) / 2;

      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 4.4, 0.14), timberMat);
      spar.position.y = 2.2;
      bladePivot.add(spar);

      const sail = new THREE.Mesh(new THREE.BoxGeometry(1.05, 3.5, 0.05), sailCanvasMat);
      sail.position.set(0.5, 2.4, 0.06);
      bladePivot.add(sail);

      rotorGroup.add(bladePivot);
    }
    group.add(rotorGroup);

    return group;
  }

  /**
   * 2. Đền Thờ Anh Đào Inazuma (8 distinct parts)
   */
  private createSakuraShrine(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 6.0);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85, metalness: 0.08 });
    const vermilionMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.22 });
    const darkRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.48, metalness: 0.32 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2, metalness: 0.88 });
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf43f5e,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });

    // Part 1: Stepped Stone Sanctuary Terrace
    const base1 = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.9, 6.0), stoneMat);
    base1.position.y = 0.45;
    base1.receiveShadow = !this.isSoftwareGl;
    group.add(base1);

    // Part 2: Vermilion Sanctuary Chamber
    const hall = new THREE.Mesh(new THREE.BoxGeometry(4.8, 3.2, 4.0), vermilionMat);
    hall.position.y = 2.5;
    hall.castShadow = !this.isSoftwareGl;
    group.add(hall);

    // Part 3: Lower Sweeping Pagoda Roof
    const lowerRoof = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 4.6, 1.6, 4), darkRoofMat);
    lowerRoof.rotation.y = Math.PI / 4;
    lowerRoof.position.y = 4.7;
    lowerRoof.castShadow = !this.isSoftwareGl;
    group.add(lowerRoof);

    // Part 4: Upper Sanctuary Tier
    const upperHall = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.8, 2.6), vermilionMat);
    upperHall.position.y = 6.0;
    group.add(upperHall);

    // Part 5: Upper Pagoda Roof
    const upperRoof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2.1, 4), darkRoofMat);
    upperRoof.rotation.y = Math.PI / 4;
    upperRoof.position.y = 7.7;
    upperRoof.castShadow = !this.isSoftwareGl;
    group.add(upperRoof);

    // Part 6: Golden Spire Finial (LatheGeometry)
    const finialPoints = [
      new THREE.Vector2(0.05, 0),
      new THREE.Vector2(0.32, 0.3),
      new THREE.Vector2(0.14, 0.9),
      new THREE.Vector2(0.26, 1.3),
      new THREE.Vector2(0.02, 2.0),
    ];
    const finial = new THREE.Mesh(new THREE.LatheGeometry(finialPoints, 12), goldMat);
    finial.position.y = 8.6;
    group.add(finial);

    // Part 7: Sacred Front Torii Gate
    const toriiGroup = new THREE.Group();
    toriiGroup.position.set(0, 0, 4.2);
    const pillarL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.8, 10), vermilionMat);
    pillarL.position.set(-1.4, 1.9, 0);
    const pillarR = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.8, 10), vermilionMat);
    pillarR.position.set(1.4, 1.9, 0);
    const lintelTop = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.32, 0.42), darkRoofMat);
    lintelTop.position.set(0, 3.8, 0);
    const lintelMid = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.22, 0.3), vermilionMat);
    lintelMid.position.set(0, 3.15, 0);
    toriiGroup.add(pillarL, pillarR, lintelTop, lintelMid);
    group.add(toriiGroup);

    // Part 8: Twin Glowing Shrine Lanterns
    for (const side of [-1.8, 1.8]) {
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), lanternMat);
      lantern.position.set(side, 3.6, 2.3);
      group.add(lantern);
    }

    return group;
  }

  /**
   * 3. Trung Tâm Lữ Hành Paldea / Pokémon Center (8 distinct parts)
   */
  private createPokemonCenter(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 6.2);

    const whiteWallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, metalness: 0.12 });
    const coralDomeMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.22, metalness: 0.35 });
    const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.45 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.45,
      roughness: 0.12,
      metalness: 0.7,
    });
    const goldEmblemMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.85,
    });

    // Part 1: Circular Foundation Deck
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.0, 0.7, 20), darkTrimMat);
    deck.position.y = 0.35;
    deck.receiveShadow = !this.isSoftwareGl;
    group.add(deck);

    // Part 2: Primary Cylindrical Pavilion Body
    const pavilion = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.9, 3.2, 20), whiteWallMat);
    pavilion.position.y = 2.2;
    pavilion.castShadow = !this.isSoftwareGl;
    group.add(pavilion);

    // Part 3: Twin Side Service Wings
    const wing = new THREE.Mesh(new THREE.BoxGeometry(8.8, 2.3, 3.2), whiteWallMat);
    wing.position.y = 1.8;
    wing.castShadow = !this.isSoftwareGl;
    group.add(wing);

    // Part 4: Iconic Coral-Red Poké-Dome Roof
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(3.95, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      coralDomeMat
    );
    dome.position.y = 3.7;
    dome.castShadow = !this.isSoftwareGl;
    group.add(dome);

    // Part 5: Equatorial Pokéball Belt Ring
    const beltRing = new THREE.Mesh(new THREE.TorusGeometry(3.92, 0.22, 10, 28), darkTrimMat);
    beltRing.rotation.x = Math.PI / 2;
    beltRing.position.y = 3.85;
    group.add(beltRing);

    // Part 6: Glowing Front Poké-Emblem Medallion
    const medallion = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.35, 16), goldEmblemMat);
    medallion.rotation.x = Math.PI / 2;
    medallion.position.set(0, 4.1, 3.85);
    group.add(medallion);

    // Part 7: Panoramic Sky-Blue Glass Entrance Bay
    const entranceBay = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 1.4), glassMat);
    entranceBay.position.set(0, 1.8, 3.5);
    group.add(entranceBay);

    // Part 8: Rooftop Communication Beacon Spire
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 2.2, 10), goldEmblemMat);
    spire.position.y = 8.2;
    group.add(spire);

    return group;
  }

  /**
   * 4. Đỉnh Đá Thạch Anh Liyue / Karst Mountain (7 distinct parts)
   */
  private createKarstMountain(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 8.2);

    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.88,
      metalness: 0.08,
      flatShading: true,
    });
    const darkRockMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.92,
      metalness: 0.05,
      flatShading: true,
    });
    const mossCapMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.62,
      metalness: 0.05,
    });
    const amberOreMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.55,
      roughness: 0.22,
      metalness: 0.65,
    });

    // Part 1: Towering Central Karst Pillar
    const mainSpire = new THREE.Mesh(new THREE.ConeGeometry(4.6, 16.5, 6), cliffMat);
    mainSpire.position.y = 8.2;
    mainSpire.castShadow = !this.isSoftwareGl;
    mainSpire.receiveShadow = !this.isSoftwareGl;
    group.add(mainSpire);

    // Part 2: North-West Tilted Flanking Crag
    const subSpire1 = new THREE.Mesh(new THREE.ConeGeometry(3.4, 11.5, 5), darkRockMat);
    subSpire1.position.set(-3.2, 5.5, -1.5);
    subSpire1.rotation.z = 0.14;
    subSpire1.castShadow = !this.isSoftwareGl;
    group.add(subSpire1);

    // Part 3: South-East Stepped Rock Column
    const subSpire2 = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 3.2, 9.2, 6), cliffMat);
    subSpire2.position.set(3.1, 4.6, 1.6);
    subSpire2.rotation.z = -0.1;
    subSpire2.castShadow = !this.isSoftwareGl;
    group.add(subSpire2);

    // Part 4: Lush Emerald Moss Plateau Cap
    const mossCap = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.7, 1.1, 6), mossCapMat);
    mossCap.position.set(3.0, 9.3, 1.5);
    group.add(mossCap);

    // Part 5 & 6: Glowing Cor Lapis / Amber Crystal Ore Clusters
    const ore1 = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), amberOreMat);
    ore1.position.set(1.8, 3.2, 3.1);
    ore1.rotation.set(0.4, 0.6, 0.2);
    group.add(ore1);

    const ore2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), amberOreMat);
    ore2.position.set(-2.4, 2.5, 2.8);
    group.add(ore2);

    // Part 7: Base Boulder Apron
    const baseBoulder = new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 0), darkRockMat);
    baseBoulder.position.set(0.4, 1.4, -3.4);
    group.add(baseBoulder);

    return group;
  }

  /**
   * 5. Núi Đá Nham Cổ Đại / Volcanic Peak (6 distinct parts)
   */
  private createVolcanicPeak(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 7.5);

    const basaltMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.12,
      flatShading: true,
    });
    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.32,
      metalness: 0.72,
      flatShading: true,
    });
    const magmaMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });

    // Part 1: Primary Truncated Caldera Cone
    const caldera = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 5.8, 10.5, 7), basaltMat);
    caldera.position.y = 5.25;
    caldera.castShadow = !this.isSoftwareGl;
    group.add(caldera);

    // Part 2: Glowing Magma Crater Core
    const craterLava = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.8, 0.6, 7), magmaMat);
    craterLava.position.y = 10.35;
    group.add(craterLava);

    // Part 3 & 4: Jagged Obsidian Fang Spires
    const fang1 = new THREE.Mesh(new THREE.ConeGeometry(1.8, 7.8, 5), obsidianMat);
    fang1.position.set(-3.4, 3.9, 1.8);
    fang1.rotation.z = 0.22;
    group.add(fang1);

    const fang2 = new THREE.Mesh(new THREE.ConeGeometry(1.5, 6.5, 5), obsidianMat);
    fang2.position.set(3.5, 3.2, -1.6);
    fang2.rotation.z = -0.25;
    group.add(fang2);

    // Part 5 & 6: Glowing Thermal Crystal Veins
    const vein = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), magmaMat);
    vein.position.set(0.6, 3.6, 4.1);
    group.add(vein);

    return group;
  }

  /**
   * 6. Cây Anh Đào Thần Thụ / Sacred Sakura Tree (7 distinct parts)
   */
  private createSakuraTree(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 4.5);

    const barkMat = new THREE.MeshStandardMaterial({ color: 0x5c2d24, roughness: 0.88, metalness: 0.05 });
    const sakuraMainMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      roughness: 0.58,
      metalness: 0.05,
    });
    const sakuraLightMat = new THREE.MeshStandardMaterial({
      color: 0xfbcfe8,
      emissive: 0xf472b6,
      emissiveIntensity: 0.18,
      roughness: 0.32,
      metalness: 0.05,
    });
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x9333ea,
      emissiveIntensity: 0.6,
      roughness: 0.25,
    });

    // Part 1: Sculpted Lathe Trunk
    const trunkPts = [
      new THREE.Vector2(0.85, 0),
      new THREE.Vector2(0.55, 1.4),
      new THREE.Vector2(0.45, 3.2),
      new THREE.Vector2(0.28, 4.8),
    ];
    const trunk = new THREE.Mesh(new THREE.LatheGeometry(trunkPts, 10), barkMat);
    trunk.castShadow = !this.isSoftwareGl;
    group.add(trunk);

    // Part 2: Sacred Shimenawa Electro Ribbon around Trunk
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.09, 8, 16), ribbonMat);
    ribbon.rotation.x = Math.PI / 2;
    ribbon.position.y = 2.2;
    group.add(ribbon);

    // Parts 3, 4, 5, 6: Multi-tiered Blossom Canopy Clouds
    const canopySpecs = [
      { x: 0, y: 5.5, z: 0, r: 2.6, mat: sakuraMainMat },
      { x: -1.6, y: 4.8, z: 0.9, r: 1.85, mat: sakuraLightMat },
      { x: 1.7, y: 4.9, z: -0.7, r: 1.9, mat: sakuraLightMat },
      { x: 0.3, y: 6.6, z: 0.5, r: 1.75, mat: sakuraMainMat },
    ];
    for (const c of canopySpecs) {
      const cloud = new THREE.Mesh(new THREE.IcosahedronGeometry(c.r, 1), c.mat);
      cloud.scale.set(1.15, 0.78, 1.15);
      cloud.position.set(c.x, c.y, c.z);
      cloud.castShadow = !this.isSoftwareGl;
      group.add(cloud);
    }

    // Part 7: Fallen Petal Ring on Ground
    const petalRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 2.8, 16), sakuraLightMat);
    petalRing.rotation.x = -Math.PI / 2;
    petalRing.position.y = 0.05;
    group.add(petalRing);

    return group;
  }

  /**
   * 7. Cây Thông Ngọc Lục Bảo / Emerald Cel-Pine (6 distinct parts)
   */
  private createEmeraldPine(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 3.8);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.9, metalness: 0.05 });
    const leafDarkMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75, metalness: 0.05 });
    const leafMidMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5, metalness: 0.08 });
    const leafBrightMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.32, metalness: 0.1 });

    // Part 1: Cedar Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.58, 3.2, 8), trunkMat);
    trunk.position.y = 1.6;
    trunk.castShadow = !this.isSoftwareGl;
    group.add(trunk);

    // Parts 2, 3, 4, 5: 4 Tiered Cel-Shaded Foliage Cones
    const tiers = [
      { y: 3.1, r: 2.5, h: 2.6, mat: leafDarkMat },
      { y: 4.6, r: 2.1, h: 2.4, mat: leafMidMat },
      { y: 6.0, r: 1.6, h: 2.2, mat: leafBrightMat },
      { y: 7.3, r: 1.0, h: 1.8, mat: leafBrightMat },
    ];
    for (const t of tiers) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 9), t.mat);
      cone.position.y = t.y;
      cone.castShadow = !this.isSoftwareGl;
      group.add(cone);
    }

    return group;
  }

  /**
   * 8. Đài Tinh Thể Phong Thần / Aether Teleport Crystal (7 distinct parts)
   */
  private createAetherCrystal(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 3.6);

    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.75, metalness: 0.15 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.22, metalness: 0.88 });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.85,
      roughness: 0.12,
      metalness: 0.65,
    });

    // Part 1: Carved Pedestal Base (LatheGeometry)
    const pts = [
      new THREE.Vector2(1.8, 0),
      new THREE.Vector2(1.6, 0.4),
      new THREE.Vector2(1.0, 0.9),
      new THREE.Vector2(1.25, 1.4),
      new THREE.Vector2(0, 1.4),
    ];
    const pedestal = new THREE.Mesh(new THREE.LatheGeometry(pts, 12), pedestalMat);
    pedestal.castShadow = !this.isSoftwareGl;
    group.add(pedestal);

    // Part 2: Floating Golden Rune Halo
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.08, 8, 24), goldMat);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.65;
    group.add(halo);

    // Part 3, 4, 5, 6: Levitating Core Prism + 3 Orbiting Shards
    const floatGroup = new THREE.Group();
    floatGroup.position.y = 3.6;
    floatGroup.userData.isFloatingCrystal = true;
    floatGroup.userData.baseY = 3.6;

    const mainPrism = new THREE.Mesh(new THREE.OctahedronGeometry(1.15, 0), crystalMat);
    mainPrism.scale.set(0.75, 1.45, 0.75);
    floatGroup.add(mainPrism);

    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), crystalMat);
      shard.scale.set(0.6, 1.4, 0.6);
      shard.position.set(Math.cos(angle) * 1.45, (i - 1) * 0.25, Math.sin(angle) * 1.45);
      shard.rotation.z = 0.25;
      floatGroup.add(shard);
    }

    group.add(floatGroup);
    return group;
  }

  /**
   * 9. Cầu Đá & Đèn Cổ Thị Trấn / Ancient Stone Bridge (7 distinct parts)
   */
  private createAncientBridge(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 6.5);

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85, metalness: 0.08 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.55, metalness: 0.2 });
    const lanternGlow = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    });

    // Part 1: Arched Bridge Deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.6, 3.6), stoneMat);
    deck.position.y = 1.4;
    deck.castShadow = !this.isSoftwareGl;
    deck.receiveShadow = !this.isSoftwareGl;
    group.add(deck);

    // Part 2 & 3: Sloped Approach Ramps
    const rampL = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.45, 3.5), stoneMat);
    rampL.position.set(-5.6, 0.75, 0);
    rampL.rotation.z = 0.35;
    group.add(rampL);

    const rampR = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.45, 3.5), stoneMat);
    rampR.position.set(5.6, 0.75, 0);
    rampR.rotation.z = -0.35;
    group.add(rampR);

    // Part 4 & 5: Twin Carved Stone Parapet Rails
    for (const zSide of [-1.55, 1.55]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.75, 0.3), trimMat);
      rail.position.set(0, 2.05, zSide);
      group.add(rail);
    }

    // Part 6 & 7: 4 Guardian Stone Lantern Posts
    for (const xSide of [-4.4, 4.4]) {
      for (const zSide of [-1.55, 1.55]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.48, 1.5, 0.48), trimMat);
        post.position.set(xSide, 2.4, zSide);
        group.add(post);

        const lightCore = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), lanternGlow);
        lightCore.position.set(xSide, 3.3, zSide);
        group.add(lightCore);
      }
    }

    return group;
  }

  /**
   * PLANETARY 1. Núi Lửa Khiên Olympus Mons (Sao Hỏa)
   * Broad terraced Martian shield volcano with nested summit calderas & swirling red dust plume
   */
  private createMarsOlympusShield(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 10.5);

    const rustBasaltMat = new THREE.MeshStandardMaterial({
      color: 0x9a3412,
      roughness: 0.9,
      flatShading: true,
    });
    const upperOxideMat = new THREE.MeshStandardMaterial({
      color: 0xc2410c,
      roughness: 0.85,
      flatShading: true,
    });
    const scarpCliffMat = new THREE.MeshStandardMaterial({
      color: 0x7c2d12,
      roughness: 0.88,
      flatShading: true,
    });
    const calderaFloorMat = new THREE.MeshStandardMaterial({
      color: 0x431407,
      emissive: 0x9a3412,
      emissiveIntensity: 0.35,
      roughness: 0.7,
    });
    const dustPlumeMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xc2410c,
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.68,
      flatShading: true,
    });

    // Part 1: Outer Basal Escarpment (8km cliff analog at 1:1 prop scale)
    const basalScarp = new THREE.Mesh(
      new THREE.CylinderGeometry(8.6, 10.2, 4.2, 12),
      scarpCliffMat
    );
    basalScarp.position.y = 2.1;
    basalScarp.castShadow = !this.isSoftwareGl;
    group.add(basalScarp);

    // Part 2: Mid Shield Slope
    const midShield = new THREE.Mesh(
      new THREE.CylinderGeometry(5.4, 8.5, 6.2, 12),
      rustBasaltMat
    );
    midShield.position.y = 7.3;
    midShield.castShadow = !this.isSoftwareGl;
    group.add(midShield);

    // Part 3: Upper Summit Shield Cone
    const upperShield = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 5.3, 4.4, 12),
      upperOxideMat
    );
    upperShield.position.y = 12.6;
    upperShield.castShadow = !this.isSoftwareGl;
    group.add(upperShield);

    // Part 4: Nested Summit Caldera Bowl
    const calderaRim = new THREE.Mesh(
      new THREE.TorusGeometry(2.85, 0.55, 7, 14),
      scarpCliffMat
    );
    calderaRim.rotation.x = Math.PI / 2;
    calderaRim.position.y = 14.8;
    group.add(calderaRim);

    const calderaFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 2.3, 0.5, 10),
      calderaFloorMat
    );
    calderaFloor.position.y = 14.55;
    group.add(calderaFloor);

    // Parts 5-8: Radial Martian Lava Channels & Flank Outcrops
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + 0.35;
      const ridge = new THREE.Mesh(new THREE.DodecahedronGeometry(1.85, 0), upperOxideMat);
      ridge.scale.set(1.4, 0.7, 0.8);
      ridge.position.set(Math.cos(ang) * 6.8, 5.2, Math.sin(ang) * 6.8);
      ridge.rotation.y = -ang;
      group.add(ridge);
    }

    // Part 9 & 10: Swirling Martian Red Dust Plume above Summit
    const plumeGroup = new THREE.Group();
    plumeGroup.position.y = 14.2;
    plumeGroup.userData.isVolcanoPlume = true;
    for (let p = 0; p < 3; p++) {
      const dustCloud = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.25 + p * 0.35, 0),
        dustPlumeMat
      );
      dustCloud.scale.set(1.5, 0.65, 1.5);
      dustCloud.position.set((p - 1) * 0.9, 1.6 + p * 1.15, 0);
      plumeGroup.add(dustCloud);
    }
    group.add(plumeGroup);

    return group;
  }

  /**
   * PLANETARY 2. Vòm Dung Nham Lưu Huỳnh (Sao Kim — Venusian Pancake Dome)
   * Broad flat circular lava dome with glowing yellow-orange sulfur fractures & sulfuric gas plumes
   */
  private createVenusPancakeDome(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 9.2);

    const sulfurCrustMat = new THREE.MeshStandardMaterial({
      color: 0xa16207,
      roughness: 0.86,
      flatShading: true,
    });
    const yellowSulfurMat = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      roughness: 0.74,
      flatShading: true,
    });
    const moltenFissureMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.92,
      roughness: 0.25,
    });
    const acidCloudMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xca8a04,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.62,
      flatShading: true,
    });

    // Part 1: Steep-sided Flat-Topped Pancake Lava Dome
    const domeBase = new THREE.Mesh(
      new THREE.CylinderGeometry(7.4, 8.6, 4.6, 16),
      sulfurCrustMat
    );
    domeBase.position.y = 2.3;
    domeBase.castShadow = !this.isSoftwareGl;
    group.add(domeBase);

    // Part 2: Upper Sulfur Plateau Cap
    const domeCap = new THREE.Mesh(
      new THREE.CylinderGeometry(6.2, 7.3, 1.6, 16),
      yellowSulfurMat
    );
    domeCap.position.y = 5.4;
    group.add(domeCap);

    // Part 3 & 4: Concentric Glowing Magma Fracture Rings on Top
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.1, 14),
      moltenFissureMat
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 6.24;
    group.add(innerRing);

    const outerRing = new THREE.Mesh(
      new THREE.RingGeometry(3.8, 4.3, 16),
      moltenFissureMat
    );
    outerRing.rotation.x = -Math.PI / 2;
    outerRing.position.y = 6.24;
    group.add(outerRing);

    // Part 5: Central Vent Pit
    const centralVent = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 0.7, 0.8, 10),
      moltenFissureMat
    );
    centralVent.position.y = 6.0;
    group.add(centralVent);

    // Parts 6-8: Sulfur Fumarole Chimneys around Dome
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2 + 0.5;
      const chimney = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 2.8, 7),
        yellowSulfurMat
      );
      chimney.position.set(Math.cos(ang) * 4.8, 7.2, Math.sin(ang) * 4.8);
      group.add(chimney);
    }

    // Part 9 & 10: Rising Sulfuric Acid Gas Plume
    const gasGroup = new THREE.Group();
    gasGroup.position.y = 14.2;
    gasGroup.userData.isVolcanoPlume = true;
    for (let c = 0; c < 3; c++) {
      const cloud = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.35 + c * 0.3, 0),
        acidCloudMat
      );
      cloud.scale.set(1.6, 0.55, 1.6);
      cloud.position.set((c - 1) * 1.1, -5.2 + c * 1.1, 0);
      gasGroup.add(cloud);
    }
    group.add(gasGroup);

    return group;
  }

  /**
   * PLANETARY 3. Hố Thiên Thạch & Lõi Sao Băng (Meteor Impact Crater)
   * Circular impact crater rim wall, radial ejecta boulders & glowing meteorite core
   */
  private createMeteorImpactCrater(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 8.2);

    const craterRimMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.88,
      flatShading: true,
    });
    const scorchedFloorMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      emissive: 0x9a3412,
      emissiveIntensity: 0.32,
      roughness: 0.75,
    });
    const meteoriteCoreMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.95,
      roughness: 0.25,
      metalness: 0.65,
      flatShading: true,
    });
    const shockwaveMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.72,
    });

    // Part 1: Raised Impact Crater Rim Torus
    const rimTorus = new THREE.Mesh(
      new THREE.TorusGeometry(5.6, 1.45, 8, 18),
      craterRimMat
    );
    rimTorus.rotation.x = Math.PI / 2;
    rimTorus.scale.set(1, 1, 0.85);
    rimTorus.position.y = 1.1;
    rimTorus.castShadow = !this.isSoftwareGl;
    group.add(rimTorus);

    // Part 2: Scorched Molten Impact Basin Floor
    const basinFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 4.4, 0.35, 16),
      scorchedFloorMat
    );
    basinFloor.position.y = 0.2;
    group.add(basinFloor);

    // Parts 3-7: Jagged Ejecta Boulders around Rim
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const boulder = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.15 + (i % 2) * 0.45, 0),
        craterRimMat
      );
      boulder.position.set(Math.cos(ang) * 5.8, 2.1, Math.sin(ang) * 5.8);
      boulder.rotation.set(i * 0.5, i * 1.1, 0);
      group.add(boulder);
    }

    // Part 8 & 9: Levitating Glowing Meteorite Core & Shockwave Ring
    const coreGroup = new THREE.Group();
    coreGroup.position.y = 3.2;
    coreGroup.userData.isFloatingCrystal = true;
    coreGroup.userData.baseY = 3.2;

    const meteorite = new THREE.Mesh(
      new THREE.DodecahedronGeometry(1.65, 0),
      meteoriteCoreMat
    );
    coreGroup.add(meteorite);

    const shockRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.12, 8, 24),
      shockwaveMat
    );
    shockRing.rotation.x = Math.PI / 2;
    coreGroup.add(shockRing);

    group.add(coreGroup);
    return group;
  }

  /**
   * PLANETARY 4. Tháp Tinh Thể Silicat Ngoại Hành Tinh (Kepler-452b / TRAPPIST-1e)
   * Towering bioluminescent purple-cyan crystal monoliths & orbiting plasma rings
   */
  private createExoplanetCrystalSpire(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 6.2);

    const alienBasaltMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      roughness: 0.78,
      metalness: 0.25,
      flatShading: true,
    });
    const mainCrystalMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.78,
      roughness: 0.16,
      metalness: 0.55,
      flatShading: true,
    });
    const cyanCrystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.85,
      roughness: 0.14,
      metalness: 0.6,
      flatShading: true,
    });

    // Part 1: Hexagonal Alien Basalt Pedestal
    const baseHex = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 5.2, 2.6, 6),
      alienBasaltMat
    );
    baseHex.position.y = 1.3;
    baseHex.castShadow = !this.isSoftwareGl;
    group.add(baseHex);

    // Part 2: Central Towering Silicate Spire (19m tall)
    const centralSpire = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, 17.5, 6),
      mainCrystalMat
    );
    centralSpire.position.y = 10.2;
    centralSpire.castShadow = !this.isSoftwareGl;
    group.add(centralSpire);

    // Parts 3-8: 6 Angled Secondary Bioluminescent Crystal Monoliths
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const h = 8.5 + (i % 3) * 2.4;
      const spire = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, h, 5),
        i % 2 === 0 ? cyanCrystalMat : mainCrystalMat
      );
      spire.position.set(Math.cos(ang) * 3.1, h * 0.48 + 1.2, Math.sin(ang) * 3.1);
      spire.rotation.z = -Math.cos(ang) * 0.24;
      spire.rotation.x = Math.sin(ang) * 0.24;
      group.add(spire);
    }

    // Part 9 & 10: Orbiting Exoplanet Magnetic Ring
    const vortexGroup = new THREE.Group();
    vortexGroup.position.y = 2.6;
    vortexGroup.userData.isAbyssVortex = true;

    const magRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.2, 0.14, 8, 24),
      cyanCrystalMat
    );
    magRing.rotation.x = Math.PI / 2;
    magRing.position.y = 7.5;
    vortexGroup.add(magRing);

    group.add(vortexGroup);
    return group;
  }

  /**
   * PLANETARY 5. Núi Lửa Băng Wright Mons (Sao Diêm Vương - Pluto Cryovolcano)
   * Hummocky nitrogen-water ice volcano stained with dark red Cthulhu tholins,
   * deep glowing cyan cryomagma caldera, frozen nitrogen flows & erupting cryo-geyser plume.
   */
  private createPlutoCryoVolcano(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 10.2);

    const tholinBaseMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      roughness: 0.84,
      metalness: 0.08,
      flatShading: true,
    });
    const nitrogenIceMat = new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x0284c7,
      emissiveIntensity: 0.22,
      roughness: 0.28,
      metalness: 0.35,
      flatShading: true,
    });
    const cryoMagmaMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 1.05,
      roughness: 0.14,
      metalness: 0.55,
    });
    const cryoPlumeMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.76,
      flatShading: true,
    });

    // Part 1: Broad Hummocky Tholin-Stained Basal Massif
    const basalCone = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 9.8, 5.2, 11),
      tholinBaseMat
    );
    basalCone.position.y = 2.6;
    basalCone.castShadow = !this.isSoftwareGl;
    group.add(basalCone);

    // Part 2: Upper Glacial Nitrogen-Ice Cone
    const upperIceCone = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 7.1, 7.6, 11),
      nitrogenIceMat
    );
    upperIceCone.position.y = 8.9;
    upperIceCone.castShadow = !this.isSoftwareGl;
    group.add(upperIceCone);

    // Part 3: Jagged Ice Caldera Crown Rim
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const icePeak = new THREE.Mesh(
        new THREE.ConeGeometry(1.3, 3.4, 5),
        nitrogenIceMat
      );
      icePeak.position.set(Math.cos(a) * 3.7, 13.4, Math.sin(a) * 3.7);
      group.add(icePeak);
    }

    // Part 4: Glowing Liquid Nitrogen-Ammonia Cryomagma Caldera Pool
    const cryoPool = new THREE.Mesh(
      new THREE.CylinderGeometry(3.3, 2.7, 0.8, 10),
      cryoMagmaMat
    );
    cryoPool.position.y = 12.6;
    group.add(cryoPool);

    // Parts 5-7: 3 Frozen Cryo-Lava Streams Down the Slopes
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3 + 0.4;
      const cryoStream = new THREE.Mesh(
        new THREE.BoxGeometry(1.45, 11.8, 0.45),
        cryoMagmaMat
      );
      cryoStream.position.set(Math.cos(a) * 5.8, 6.0, Math.sin(a) * 5.8);
      cryoStream.rotation.y = -a + Math.PI / 2;
      cryoStream.rotation.x = 0.44;
      group.add(cryoStream);
    }

    // Parts 8-11: Animated Erupting Cryovolcanic Plume & Ice Crystals
    const plumeGroup = new THREE.Group();
    plumeGroup.position.y = 14.2;
    plumeGroup.userData.isVolcanoPlume = true;

    for (let p = 0; p < 4; p++) {
      const puff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.15 + p * 0.36, 0),
        cryoPlumeMat
      );
      puff.position.set(
        Math.sin(p * 1.6) * 0.75,
        p * 1.45,
        Math.cos(p * 1.6) * 0.75
      );
      plumeGroup.add(puff);
    }
    group.add(plumeGroup);

    return group;
  }

  /**
   * PLANETARY 6. Hồ Mêtan & Mạch Phun Hydrocarbon (Vệ tinh Titan - Kraken Mare)
   * Dark amber liquid-methane pool, rounded water-ice pebbles (Huygens landing site),
   * and an active hydrocarbon geyser fountain.
   */
  private createTitanMethaneGeyser(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 9.0);

    const hydrocarbonShoreMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.86,
      metalness: 0.1,
      flatShading: true,
    });
    const liquidMethaneMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0xb45309,
      emissiveIntensity: 0.55,
      roughness: 0.12,
      metalness: 0.45,
    });
    const icePebbleMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.42,
      metalness: 0.2,
      flatShading: true,
    });
    const geyserMistMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.78,
    });

    // Part 1: Terraced Hydrocarbon Shoreline Rim
    const shoreRim = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 1.35, 8, 20),
      hydrocarbonShoreMat
    );
    shoreRim.rotation.x = Math.PI / 2;
    shoreRim.scale.set(1, 1, 0.55);
    shoreRim.position.y = 0.65;
    group.add(shoreRim);

    // Part 2: Glossy Liquid Methane-Ethane Sea Mirror Pool
    const methanePool = new THREE.Mesh(
      new THREE.CylinderGeometry(6.5, 6.2, 0.45, 20),
      liquidMethaneMat
    );
    methanePool.position.y = 0.25;
    group.add(methanePool);

    // Parts 3-7: Rounded Huygens Hydrocarbon Ice Pebbles along Shoreline
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.2;
      const pebble = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.95 + (i % 2) * 0.35, 1),
        icePebbleMat
      );
      pebble.scale.set(1.25, 0.72, 1.1);
      pebble.position.set(Math.cos(a) * 5.8, 0.95, Math.sin(a) * 5.8);
      group.add(pebble);
    }

    // Part 8: Central Hydrocarbon Geyser Vent Cone
    const ventCone = new THREE.Mesh(
      new THREE.ConeGeometry(2.1, 4.2, 8),
      hydrocarbonShoreMat
    );
    ventCone.position.y = 2.1;
    group.add(ventCone);

    // Parts 9 & 10: Animated Bubbling Methane Geyser Plume & Mist Rings
    const vortexGroup = new THREE.Group();
    vortexGroup.position.y = 2.6;
    vortexGroup.userData.isAbyssVortex = true;

    for (let r = 0; r < 3; r++) {
      const mistRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.4 + r * 0.85, 0.16, 8, 20),
        geyserMistMat
      );
      mistRing.rotation.x = Math.PI / 2;
      mistRing.position.y = 2.0 + r * 2.2;
      vortexGroup.add(mistRing);
    }
    group.add(vortexGroup);

    return group;
  }

  /**
   * PLANETARY 7. Rừng Tháp Băng Penitentes & Rãnh Muối Đỏ (Pluto Tartarus Dorsa / Europa)
   * Towering blade-like methane/nitrogen ice spires angled toward the sun over a red-salt Chaos ridge.
   */
  private createEuropaPenitentesSpire(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 6.8);

    const redSaltChaosMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.82,
      metalness: 0.12,
      flatShading: true,
    });
    const cyanBladeIceMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.52,
      roughness: 0.15,
      metalness: 0.55,
      flatShading: true,
    });
    const deepGlacierMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0369a1,
      emissiveIntensity: 0.38,
      roughness: 0.22,
      metalness: 0.45,
      flatShading: true,
    });

    // Part 1: Fractured Red-Salt Chaos Ice Base
    const chaosBase = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 5.6, 2.2, 7),
      redSaltChaosMat
    );
    chaosBase.position.y = 1.1;
    chaosBase.castShadow = !this.isSoftwareGl;
    group.add(chaosBase);

    // Part 2: Central Towering Penitentes Ice Blade (17.5m tall, flattened blade cross-section)
    const centralBlade = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 16.5, 4),
      cyanBladeIceMat
    );
    centralBlade.scale.set(1.25, 1.0, 0.48);
    centralBlade.position.y = 9.5;
    centralBlade.rotation.z = 0.12;
    centralBlade.castShadow = !this.isSoftwareGl;
    group.add(centralBlade);

    // Parts 3-9: 7 Surrounding Parallel Angled Penitentes Ice Blades
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2;
      const dist = 2.6 + (i % 2) * 1.15;
      const h = 8.2 + (i % 3) * 2.8;
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(1.35, h, 4),
        i % 2 === 0 ? cyanBladeIceMat : deepGlacierMat
      );
      blade.scale.set(1.2, 1.0, 0.45);
      blade.position.set(Math.cos(ang) * dist, h * 0.48 + 1.0, Math.sin(ang) * dist);
      blade.rotation.z = 0.14; // All Penitentes blades tilt toward the same solar angle
      group.add(blade);
    }

    return group;
  }

  /**
   * EARTH 1. Đỉnh Sừng Băng Himalaya / Matterhorn Anpơ & Hồ Băng Andes (10 distinct parts)
   * Sharp 4-faceted pyramidal horn spire (Matterhorn/Everest), hanging blue glacier seracs,
   * turquoise Andean glacial cirque tarn, and summit snow plume.
   */
  private createHimalayaMatterhornPeak(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 10.2);

    const gneissCliffMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.88,
      metalness: 0.08,
      flatShading: true,
    });
    const snowCorniceMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.16,
      roughness: 0.35,
      flatShading: true,
    });
    const blueGlacierMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.28,
      roughness: 0.2,
      metalness: 0.35,
      flatShading: true,
    });
    const tarnLakeMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x0891b2,
      emissiveIntensity: 0.35,
      roughness: 0.12,
      metalness: 0.45,
    });

    // Part 1: Broad Alpine Basal Ridge
    const basalMassif = new THREE.Mesh(
      new THREE.CylinderGeometry(6.8, 9.4, 5.2, 7),
      gneissCliffMat
    );
    basalMassif.position.y = 2.6;
    basalMassif.castShadow = !this.isSoftwareGl;
    group.add(basalMassif);

    // Part 2: Iconic 4-Sided Pyramidal Horn Spire (Matterhorn / Everest)
    const hornSpire = new THREE.Mesh(
      new THREE.ConeGeometry(5.6, 17.5, 4),
      gneissCliffMat
    );
    hornSpire.position.set(-0.6, 12.2, -0.4);
    hornSpire.rotation.y = Math.PI * 0.22;
    hornSpire.rotation.z = -0.09; // Classic Matterhorn summit tilt
    hornSpire.castShadow = !this.isSoftwareGl;
    group.add(hornSpire);

    // Part 3: Snow-Clad Summit Crown & Arête Cornice
    const snowCap = new THREE.Mesh(
      new THREE.ConeGeometry(3.4, 9.8, 4),
      snowCorniceMat
    );
    snowCap.position.set(-0.9, 16.4, -0.4);
    snowCap.rotation.y = Math.PI * 0.22;
    snowCap.rotation.z = -0.11;
    group.add(snowCap);

    // Part 4 & 5: Flanking Andean / Himalayan Sub-Peaks
    const eastPeak = new THREE.Mesh(
      new THREE.ConeGeometry(3.8, 12.6, 5),
      snowCorniceMat
    );
    eastPeak.position.set(4.2, 7.8, 1.4);
    eastPeak.rotation.z = 0.14;
    group.add(eastPeak);

    const westCrag = new THREE.Mesh(
      new THREE.ConeGeometry(3.2, 10.5, 5),
      gneissCliffMat
    );
    westCrag.position.set(-4.8, 6.5, 1.8);
    westCrag.rotation.z = -0.16;
    group.add(westCrag);

    // Part 6 & 7: Hanging Blue Glacier Icefalls (Khumbu / Aletsch Glacier)
    for (let i = 0; i < 2; i++) {
      const glacier = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 9.5, 1.2),
        blueGlacierMat
      );
      glacier.position.set(i === 0 ? -1.4 : 2.1, 6.2, 3.8);
      glacier.rotation.x = 0.45;
      group.add(glacier);
    }

    // Part 8 & 9: Turquoise Andean Glacial Cirque Tarn at Foot of Peak
    const tarnRim = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 3.8, 0.45, 14),
      snowCorniceMat
    );
    tarnRim.position.set(0.5, 0.22, 5.8);
    group.add(tarnRim);

    const tarnWater = new THREE.Mesh(
      new THREE.CylinderGeometry(3.1, 3.0, 0.52, 14),
      tarnLakeMat
    );
    tarnWater.position.set(0.5, 0.26, 5.8);
    group.add(tarnWater);

    return group;
  }

  /**
   * EARTH 2. Ốc Đảo Cọ Sahara & Đá Gió Mòn Atacama - Gobi (10 distinct parts)
   * Crescent golden Barchan sand dune (Sahara), turquoise desert spring oasis,
   * 3 date palm trees, white Atacama salt-flat crust rim, and Gobi wind-eroded yardang rock arch.
   */
  private createSaharaAtacamaOasis(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 8.8);

    const saharaSandMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.82,
      flatShading: true,
    });
    const atacamaSaltMat = new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      roughness: 0.65,
      flatShading: true,
    });
    const gobiSandstoneMat = new THREE.MeshStandardMaterial({
      color: 0xc2410c,
      roughness: 0.86,
      flatShading: true,
    });
    const oasisWaterMat = new THREE.MeshStandardMaterial({
      color: 0x14b8a6,
      emissive: 0x0d9488,
      emissiveIntensity: 0.35,
      roughness: 0.14,
      metalness: 0.35,
    });
    const palmTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.88,
    });
    const palmFrondMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.58,
      flatShading: true,
    });

    // Part 1: Sweeping Crescent Barchan Dune Backing (Sahara)
    const barchanDune = new THREE.Mesh(
      new THREE.TorusGeometry(5.6, 2.1, 7, 16, Math.PI * 1.15),
      saharaSandMat
    );
    barchanDune.rotation.x = Math.PI / 2;
    barchanDune.rotation.z = Math.PI * 0.92;
    barchanDune.scale.set(1.15, 1.0, 1.45);
    barchanDune.position.set(0, 1.2, -1.2);
    group.add(barchanDune);

    // Part 2: White Salar de Atacama Salt-Flat Rim around Oasis
    const saltRim = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.6, 0.32, 16),
      atacamaSaltMat
    );
    saltRim.position.set(0, 0.16, 1.8);
    group.add(saltRim);

    // Part 3: Emerald-Turquoise Sahara Oasis Lagoon
    const oasisPool = new THREE.Mesh(
      new THREE.CylinderGeometry(3.5, 3.3, 0.38, 16),
      oasisWaterMat
    );
    oasisPool.position.set(0, 0.2, 1.8);
    group.add(oasisPool);

    // Parts 4-6: Gobi Flaming Cliffs / Atacama Valle de la Luna Wind-Carved Yardang Pillars
    for (let i = 0; i < 3; i++) {
      const pillarH = 5.5 + i * 1.8;
      const yardang = new THREE.Mesh(
        new THREE.CylinderGeometry(1.35 - i * 0.15, 0.85, pillarH, 6),
        gobiSandstoneMat
      );
      yardang.position.set(-4.6 + i * 1.8, pillarH * 0.5, -3.2 + (i % 2) * 1.2);
      yardang.rotation.z = (i - 1) * 0.08;
      group.add(yardang);
    }

    // Parts 7-10: 3 Desert Date Palm Trees around the Oasis
    const palmPositions = [
      { x: 3.6, z: 0.6, h: 6.4, tilt: 0.16 },
      { x: 2.8, z: 3.4, h: 5.4, tilt: -0.12 },
      { x: -3.2, z: 2.8, h: 5.8, tilt: -0.18 },
    ];
    for (const p of palmPositions) {
      const palmGroup = new THREE.Group();
      palmGroup.position.set(p.x, 0, p.z);
      palmGroup.rotation.z = p.tilt;

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.32, p.h, 7),
        palmTrunkMat
      );
      trunk.position.y = p.h * 0.5;
      palmGroup.add(trunk);

      for (let f = 0; f < 6; f++) {
        const ang = (f / 6) * Math.PI * 2;
        const frond = new THREE.Mesh(
          new THREE.ConeGeometry(0.42, 2.4, 4),
          palmFrondMat
        );
        frond.scale.set(1.0, 1.0, 0.28);
        frond.position.set(Math.cos(ang) * 0.9, p.h - 0.1, Math.sin(ang) * 0.9);
        frond.rotation.y = -ang;
        frond.rotation.z = -1.1;
        palmGroup.add(frond);
      }
      group.add(palmGroup);
    }

    return group;
  }

  /**
   * EARTH 3. Núi Lửa Khiên Hawaii · Kīlauea & Mauna Loa (10 distinct parts)
   * Broad low-angle black basalt shield volcano, boiling Halemaʻumaʻu magma lake,
   * braided glowing Pahoehoe lava rivers pouring into turquoise Pacific water & white coastal steam plumes.
   */
  private createHawaiiKilaueaShield(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 10.5);

    const blackBasaltMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85,
      metalness: 0.15,
      flatShading: true,
    });
    const tropicalMossMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.72,
      flatShading: true,
    });
    const pahoehoeLavaMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xea580c,
      emissiveIntensity: 1.1,
      roughness: 0.2,
    });
    const steamWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.78,
      flatShading: true,
    });

    // Part 1: Broad Low-Profile Hawaiian Shield Volcano Base (Mauna Loa / Kīlauea profile)
    const shieldBase = new THREE.Mesh(
      new THREE.CylinderGeometry(6.2, 10.2, 6.4, 14),
      blackBasaltMat
    );
    shieldBase.position.y = 3.2;
    shieldBase.castShadow = !this.isSoftwareGl;
    group.add(shieldBase);

    // Part 2: Lush Kauai / Big Island Windward Tropical Green Flank Ridge
    const greenFlank = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 8.8, 3.6, 10, 1, false, 0, Math.PI),
      tropicalMossMat
    );
    greenFlank.position.set(0, 1.85, -0.4);
    group.add(greenFlank);

    // Part 3: Sunken Halemaʻumaʻu Summit Caldera Rim
    const calderaRim = new THREE.Mesh(
      new THREE.TorusGeometry(4.8, 0.95, 8, 18),
      blackBasaltMat
    );
    calderaRim.rotation.x = Math.PI / 2;
    calderaRim.position.y = 6.4;
    group.add(calderaRim);

    // Part 4: Boiling Golden-Orange Lava Lake in Summit Caldera
    const lavaLake = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.1, 0.6, 16),
      pahoehoeLavaMat
    );
    lavaLake.position.y = 6.35;
    group.add(lavaLake);

    // Parts 5-7: 3 Braided Pahoehoe Lava Rivers Flowing Down to the Coast
    for (let i = -1; i <= 1; i++) {
      const lavaChannel = new THREE.Mesh(
        new THREE.BoxGeometry(1.35, 8.2, 0.42),
        pahoehoeLavaMat
      );
      lavaChannel.position.set(i * 2.2, 3.2, 6.8);
      lavaChannel.rotation.x = 0.78;
      lavaChannel.rotation.z = -i * 0.15;
      group.add(lavaChannel);
    }

    // Parts 8-10: Animated White Ocean-Entry Steam Plume & Lava Fountain
    const plumeGroup = new THREE.Group();
    plumeGroup.position.y = 14.2;
    plumeGroup.userData.isVolcanoPlume = true;

    for (let s = 0; s < 4; s++) {
      const steam = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.25 + s * 0.35, 0),
        steamWhiteMat
      );
      steam.position.set((s - 1.5) * 1.1, -5.5 + s * 1.35, 4.5);
      plumeGroup.add(steam);
    }
    group.add(plumeGroup);

    return group;
  }

  /**
   * EARTH 4. Đại Thụ Kapok Amazon & Baobab Trung Phi Congo (10 distinct parts)
   * Towering emergent rainforest tree with massive plank buttress roots,
   * thick sculpted trunk, 4 multi-tiered emerald rainforest canopy domes & hanging liana vines.
   */
  private createAmazonCongoCanopyTree(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 6.2);

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.88,
      flatShading: true,
    });
    const canopyDeepMat = new THREE.MeshStandardMaterial({
      color: 0x14532d,
      roughness: 0.65,
      flatShading: true,
    });
    const canopyLushMat = new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      roughness: 0.52,
      flatShading: true,
    });
    const canopyEmergentMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.45,
      flatShading: true,
    });
    const lianaMat = new THREE.MeshStandardMaterial({
      color: 0x3f6212,
      roughness: 0.8,
    });

    // Part 1: Massive Columnar Kapok / Baobab Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 1.65, 9.6, 9),
      trunkMat
    );
    trunk.position.y = 4.8;
    trunk.castShadow = !this.isSoftwareGl;
    group.add(trunk);

    // Parts 2-5: 5 Giant Radial Buttress Roots (Rễ Bạnh Vè Rừng Mưa Amazon)
    for (let r = 0; r < 5; r++) {
      const ang = (r / 5) * Math.PI * 2;
      const buttress = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 4.2, 4),
        trunkMat
      );
      buttress.scale.set(1.8, 1.0, 0.35);
      buttress.position.set(Math.cos(ang) * 1.55, 1.8, Math.sin(ang) * 1.55);
      buttress.rotation.y = -ang;
      buttress.rotation.z = -0.38;
      group.add(buttress);
    }

    // Parts 6-9: Multi-Layered Broad Umbrella Rainforest Canopy
    const canopyLayers = [
      { x: 0, y: 10.6, z: 0, rx: 5.2, ry: 2.2, rz: 5.2, mat: canopyDeepMat },
      { x: -2.4, y: 9.4, z: 1.6, rx: 3.4, ry: 1.7, rz: 3.4, mat: canopyLushMat },
      { x: 2.6, y: 9.6, z: -1.4, rx: 3.6, ry: 1.8, rz: 3.6, mat: canopyLushMat },
      { x: 0, y: 12.4, z: 0, rx: 3.8, ry: 1.9, rz: 3.8, mat: canopyEmergentMat },
    ];
    for (const c of canopyLayers) {
      const dome = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), c.mat);
      dome.scale.set(c.rx, c.ry, c.rz);
      dome.position.set(c.x, c.y, c.z);
      dome.castShadow = !this.isSoftwareGl;
      group.add(dome);
    }

    // Part 10: Hanging Tropical Liana Vines
    for (let v = 0; v < 4; v++) {
      const ang = (v / 4) * Math.PI * 2 + 0.4;
      const vine = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 5.8, 5),
        lianaMat
      );
      vine.position.set(Math.cos(ang) * 3.1, 6.2, Math.sin(ang) * 3.1);
      group.add(vine);
    }

    return group;
  }

  /**
   * EARTH 5. Quần Thể Thông Vân Sam Rừng Lá Kim Taiga (Siberia · Bắc Âu · Canada) (9 distinct parts)
   * Cluster of 3 tall slender boreal spruce/pine conifers with snow-frosted tiers & mossy granite boulder base.
   */
  private createTaigaSpruceGrove(): THREE.Group {
    const group = new THREE.Group();
    this.addContactShadow(group, 5.2);

    const barkMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.9,
    });
    const spruceNeedleMat = new THREE.MeshStandardMaterial({
      color: 0x065f46,
      roughness: 0.72,
      flatShading: true,
    });
    const frostTipMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      roughness: 0.48,
      flatShading: true,
    });
    const graniteBoulderMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.86,
      flatShading: true,
    });

    const trees = [
      { x: 0, z: 0, scale: 1.15 },
      { x: -2.4, z: 1.5, scale: 0.85 },
      { x: 2.2, z: 1.2, scale: 0.75 },
    ];

    for (const t of trees) {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(t.x, 0, t.z);
      treeGroup.scale.setScalar(t.scale);

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.48, 4.2, 7),
        barkMat
      );
      trunk.position.y = 2.1;
      treeGroup.add(trunk);

      for (let tier = 0; tier < 5; tier++) {
        const coneR = 2.3 - tier * 0.36;
        const coneH = 2.8 - tier * 0.22;
        const yPos = 3.2 + tier * 1.65;
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(coneR, coneH, 8),
          tier === 4 ? frostTipMat : spruceNeedleMat
        );
        cone.position.y = yPos;
        cone.castShadow = !this.isSoftwareGl;
        treeGroup.add(cone);
      }
      group.add(treeGroup);
    }

    // Mossy Boreal Granite Boulders at Base
    for (let b = 0; b < 3; b++) {
      const boulder = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.85 + b * 0.2, 0),
        graniteBoulderMat
      );
      boulder.scale.set(1.2, 0.7, 1.0);
      boulder.position.set((b - 1) * 1.9, 0.4, -1.6 + (b % 2) * 0.8);
      group.add(boulder);
    }

    return group;
  }
}



