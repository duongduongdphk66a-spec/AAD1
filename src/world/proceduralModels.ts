import * as THREE from 'three';
import { PrefabId } from './registry';

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
    contactShadowTexture.userData = { ...contactShadowTexture.userData, shared: true };
    this.contactShadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.contactShadowMat.userData = { shared: true };
  }

  public dispose(): void {
    this.contactShadowMat.userData.shared = false;
    this.contactShadowMat.dispose();
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
    const group = this.createPrefabInternal(prefabId);
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh && child.name !== 'contact_shadow') {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return group;
  }

  private createPrefabInternal(prefabId: PrefabId): THREE.Group {
    switch (prefabId) {
      case 'island_volcano_icon':
        return this.createIslandVolcanoIcon();
      case 'himalaya_matterhorn_peak':
        return this.createHimalayaMatterhornPeak();
      case 'himalaya_fishtail_peak':
        return this.createHimalayaFishtailPeak();
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
      case 'titan_mithrim_montes':
        return this.createTitanMithrimMontes();
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
   * FEATURED: Núi Lửa Đảo Nhiệt Đới — Dựng 3D Trực Tiếp Từ Ảnh Mẫu (image_19e38ffa.png) (14 distinct parts)
   * Faithfully reproduces every visual layer of the reference illustration:
   * 1. Scalloped golden-orange sandy beach base ring (#f4b256 / #e59934) with wavy shoreline lobes at y = 0.
   * 2. Lush emerald-green bushy foliage collar (#15992b / #0b6e1c / #22c55e) wrapping the foot of the volcano.
   * 3. Steep fluted mahogany-brown volcanic cone (#6b3814) with 12 sculpted dark-brown vertical ribs & gullies (#4a240b / #7e441b).
   * 4. Bright yellow-gold molten crater crown (#facc15) & two-tone yellow/orange cascading lava streams (#f97316 / #facc15) + glowing mid-slope fissures.
   * 5. Signature diagonal billowing two-tone smoke plume (cream-white upper domes #f5f5f4 + warm brown-taupe shaded undersides #a6826c)
   *    plus 2 detached floating smoke cloud puffs drifting to the upper-right.
   */
  private createIslandVolcanoIcon(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'island_volcano_icon_root';
    this.addContactShadow(group, 12.2);

    // 1. Golden-Orange Sandy Beach Materials
    const sandBeachPrimaryMat = new THREE.MeshStandardMaterial({
      color: 0xf4b256,
      roughness: 0.78,
      metalness: 0.04,
      flatShading: true,
    });
    const sandBeachRimMat = new THREE.MeshStandardMaterial({
      color: 0xe59934,
      roughness: 0.82,
      metalness: 0.04,
      flatShading: true,
    });

    // 2. Lush Emerald-Green Bushy Foliage Materials
    const foliageMainMat = new THREE.MeshStandardMaterial({
      color: 0x15992b,
      roughness: 0.62,
      metalness: 0.04,
      flatShading: true,
    });
    const foliageDarkShadowMat = new THREE.MeshStandardMaterial({
      color: 0x0b6e1c,
      roughness: 0.7,
      metalness: 0.04,
      flatShading: true,
    });
    const foliageHighlightMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.56,
      metalness: 0.04,
      flatShading: true,
    });

    // 3. Fluted Mahogany-Brown Volcanic Cone & Dark Rib Materials
    const coneBrownMainMat = new THREE.MeshStandardMaterial({
      color: 0x6b3814,
      roughness: 0.86,
      metalness: 0.06,
      flatShading: true,
    });
    const coneDarkFluteMat = new THREE.MeshStandardMaterial({
      color: 0x4a240b,
      roughness: 0.9,
      metalness: 0.06,
      flatShading: true,
    });
    const coneLitRidgeMat = new THREE.MeshStandardMaterial({
      color: 0x7e441b,
      roughness: 0.82,
      metalness: 0.06,
      flatShading: true,
    });

    // 4. Molten Yellow-Gold Crater Crown & Orange-Gold Lava Tongue Materials
    const lavaYellowBrightMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      metalness: 0.05,
    });
    const lavaOrangeFlowMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.75,
      roughness: 0.24,
      metalness: 0.05,
    });

    // 5. Stylized Two-Tone Billowing Smoke Materials (Cream-White Top + Taupe-Brown Shaded Underside)
    const smokeCreamTopMat = new THREE.MeshStandardMaterial({
      color: 0xf5f5f4,
      emissive: 0xe7e5e4,
      emissiveIntensity: 0.22,
      roughness: 0.75,
      metalness: 0.02,
    });
    const smokeTaupeUnderMat = new THREE.MeshStandardMaterial({
      color: 0xa6826c,
      emissive: 0x785540,
      emissiveIntensity: 0.14,
      roughness: 0.84,
      metalness: 0.03,
    });

    // =========================================================================
    // LAYER 1 (Parts 1 & 2): Scalloped Golden Sand Beach Base Ring (y = 0..0.56m)
    // =========================================================================
    const sandBeachGroup = new THREE.Group();
    sandBeachGroup.name = 'sand_beach_base';

    const coreBeachDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(10.6, 11.4, 0.52, 24),
      sandBeachPrimaryMat
    );
    coreBeachDisc.position.y = 0.26;
    sandBeachGroup.add(coreBeachDisc);

    // 12 organic scalloped shoreline lobes matching the wavy golden beach in image_19e38ffa.png
    const beachLobes = [
      { ang: 0.0, dist: 10.6, rx: 3.5, rz: 2.2, h: 0.48 },
      { ang: 0.52, dist: 9.8, rx: 3.1, rz: 2.2, h: 0.50 },
      { ang: 1.08, dist: 9.6, rx: 3.3, rz: 2.5, h: 0.52 },
      { ang: 1.57, dist: 9.9, rx: 3.8, rz: 2.5, h: 0.54 }, // Front-center protruding sand lobe
      { ang: 2.12, dist: 9.6, rx: 3.2, rz: 2.4, h: 0.50 },
      { ang: 2.65, dist: 10.2, rx: 3.4, rz: 2.2, h: 0.48 },
      { ang: Math.PI, dist: 10.8, rx: 3.6, rz: 2.2, h: 0.48 }, // Leftmost sand lobe
      { ang: 3.68, dist: 9.8, rx: 3.0, rz: 2.1, h: 0.48 },
      { ang: 4.2, dist: 9.5, rx: 3.1, rz: 2.2, h: 0.48 },
      { ang: 4.71, dist: 9.6, rx: 3.3, rz: 2.2, h: 0.48 },
      { ang: 5.25, dist: 9.8, rx: 3.0, rz: 2.1, h: 0.48 },
      { ang: 5.78, dist: 10.3, rx: 3.3, rz: 2.1, h: 0.49 },
    ];
    beachLobes.forEach((lobe, idx) => {
      const lobeMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.12, lobe.h, 14),
        idx % 3 === 1 ? sandBeachRimMat : sandBeachPrimaryMat
      );
      lobeMesh.scale.set(lobe.rx, 1.0, lobe.rz);
      lobeMesh.position.set(
        Math.cos(lobe.ang) * lobe.dist,
        lobe.h * 0.5,
        Math.sin(lobe.ang) * lobe.dist
      );
      lobeMesh.rotation.y = -lobe.ang;
      sandBeachGroup.add(lobeMesh);
    });
    group.add(sandBeachGroup);

    // =========================================================================
    // LAYER 2 (Parts 3 & 4): Lush Scalloped Green Jungle / Bush Collar (y = 0.35..2.3m)
    // =========================================================================
    const foliageGroup = new THREE.Group();
    foliageGroup.name = 'foliage_jungle_collar';

    // Inner dark-green forest base ring
    const foliageCoreRing = new THREE.Mesh(
      new THREE.CylinderGeometry(7.2, 8.6, 1.45, 20),
      foliageDarkShadowMat
    );
    foliageCoreRing.position.y = 0.88;
    foliageGroup.add(foliageCoreRing);

    // 18 puffed cel-shaded bush clusters ringing the foot of the brown cone
    const bushCount = 18;
    for (let i = 0; i < bushCount; i++) {
      const ang = (i / bushCount) * Math.PI * 2;
      const radialDist = 7.45 + Math.sin(i * 2.3) * 0.55;
      const bushRadius = 1.55 + (i % 3) * 0.22;
      const mat =
        i % 4 === 0
          ? foliageHighlightMat
          : i % 3 === 0
          ? foliageDarkShadowMat
          : foliageMainMat;

      const bushPuff = new THREE.Mesh(
        new THREE.IcosahedronGeometry(bushRadius, 1),
        mat
      );
      bushPuff.scale.set(1.28, 0.76, 1.15);
      bushPuff.position.set(
        Math.cos(ang) * radialDist,
        1.05 + (i % 2) * 0.22,
        Math.sin(ang) * radialDist
      );
      bushPuff.rotation.y = ang;
      foliageGroup.add(bushPuff);

      // Upper bush sub-puff hugging the lower brown rock flank
      const upperBush = new THREE.Mesh(
        new THREE.DodecahedronGeometry(bushRadius * 0.74, 1),
        i % 2 === 0 ? foliageMainMat : foliageHighlightMat
      );
      upperBush.scale.set(1.2, 0.82, 1.05);
      upperBush.position.set(
        Math.cos(ang + 0.14) * (radialDist - 0.85),
        1.65 + (i % 3) * 0.14,
        Math.sin(ang + 0.14) * (radialDist - 0.85)
      );
      foliageGroup.add(upperBush);
    }
    group.add(foliageGroup);

    // =========================================================================
    // LAYER 3 (Parts 5, 6 & 7): Steep Fluted Brown Volcanic Cone & Dark Ribs (y = 0.8..12.2m)
    // =========================================================================
    const coneGroup = new THREE.Group();
    coneGroup.name = 'volcano_brown_cone';

    // Core truncated volcanic cone
    const mainBrownCone = new THREE.Mesh(
      new THREE.CylinderGeometry(3.45, 7.85, 11.6, 18),
      coneBrownMainMat
    );
    mainBrownCone.position.y = 6.2;
    mainBrownCone.castShadow = !this.isSoftwareGl;
    mainBrownCone.receiveShadow = !this.isSoftwareGl;
    coneGroup.add(mainBrownCone);

    // 14 vertical sculpted mountain ribs & dark gullies matching the hand-illustrated brown ridges
    const fluteGroup = new THREE.Group();
    fluteGroup.name = 'volcano_dark_flutes';
    const ribCount = 14;
    for (let i = 0; i < ribCount; i++) {
      const ang = (i / ribCount) * Math.PI * 2;
      const isDarkGully = i % 2 === 0;
      const ribMat = isDarkGully
        ? coneDarkFluteMat
        : i % 3 === 0
        ? coneLitRidgeMat
        : coneBrownMainMat;

      // Sloped triangular buttress rib from crater rim down to green foliage skirt
      const ribHeight = 11.2;
      const rib = new THREE.Mesh(
        new THREE.ConeGeometry(isDarkGully ? 1.15 : 1.45, ribHeight, 4),
        ribMat
      );
      const midRadius = isDarkGully ? 5.55 : 5.72;
      const slopeTilt = 0.36; // Matches atan((7.85 - 3.45) / 11.6)
      rib.scale.set(0.78, 1.0, 1.25);
      rib.position.set(
        Math.cos(ang) * midRadius,
        5.9,
        Math.sin(ang) * midRadius
      );
      rib.rotation.order = 'YXZ';
      rib.rotation.y = -ang + Math.PI * 0.5;
      rib.rotation.x = -slopeTilt;
      fluteGroup.add(rib);

      // Lower flaring root crag at the base of the brown cone
      const lowerCrag = new THREE.Mesh(
        new THREE.ConeGeometry(1.35, 5.4, 4),
        isDarkGully ? coneDarkFluteMat : coneBrownMainMat
      );
      lowerCrag.position.set(
        Math.cos(ang + 0.12) * 6.55,
        3.2,
        Math.sin(ang + 0.12) * 6.55
      );
      lowerCrag.rotation.order = 'YXZ';
      lowerCrag.rotation.y = -ang + Math.PI * 0.5;
      lowerCrag.rotation.x = -0.42;
      fluteGroup.add(lowerCrag);
    }
    coneGroup.add(fluteGroup);
    group.add(coneGroup);

    // =========================================================================
    // LAYER 4 (Parts 8, 9 & 10): Molten Yellow-Gold Crater Rim & Cascading Lava Tongues
    // =========================================================================
    const lavaCrownGroup = new THREE.Group();
    lavaCrownGroup.name = 'crater_lava_crown';

    // Flat-topped glowing yellow-gold magma cap at summit (y = 11.5..12.3m)
    const summitLavaCap = new THREE.Mesh(
      new THREE.CylinderGeometry(3.55, 3.95, 0.95, 20),
      lavaYellowBrightMat
    );
    summitLavaCap.position.y = 11.85;
    lavaCrownGroup.add(summitLavaCap);

    // Wavy overflowing crater rim collar
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2;
      const rimLobe = new THREE.Mesh(
        new THREE.SphereGeometry(0.76 + (i % 2) * 0.16, 10, 8),
        i % 3 === 0 ? lavaOrangeFlowMat : lavaYellowBrightMat
      );
      rimLobe.scale.set(1.25, 0.72, 1.05);
      rimLobe.position.set(
        Math.cos(ang) * 3.45,
        11.82 - (i % 2) * 0.14,
        Math.sin(ang) * 3.45
      );
      lavaCrownGroup.add(rimLobe);

      // Short upper crater lip lava drips
      const lipDrip = new THREE.Mesh(
        new THREE.ConeGeometry(0.56, 2.3 + (i % 3) * 0.55, 5),
        i % 2 === 0 ? lavaOrangeFlowMat : lavaYellowBrightMat
      );
      lipDrip.rotation.order = 'YXZ';
      lipDrip.rotation.y = -ang + Math.PI * 0.5;
      lipDrip.rotation.x = Math.PI - 0.36;
      lipDrip.position.set(
        Math.cos(ang) * 3.92,
        10.75,
        Math.sin(ang) * 3.92
      );
      lavaCrownGroup.add(lipDrip);
    }
    group.add(lavaCrownGroup);

    // Cascading Two-Tone Lava Streams & Mid-Slope Lava Fissures matching image_19e38ffa.png
    const lavaStreamsGroup = new THREE.Group();
    lavaStreamsGroup.name = 'cascading_lava_streams';

    const lavaStreamSpecs = [
      // Front-right long signature lava river cascading almost to the green bushes
      { ang: 1.18, len: 9.6, topR: 3.65, botR: 6.95, width: 0.82, hasYellowCore: true },
      // Front-center upper-mid lava tongue
      { ang: 1.62, len: 5.6, topR: 3.65, botR: 5.55, width: 0.72, hasYellowCore: true },
      // Front-left cascading lava stream
      { ang: 2.18, len: 8.4, topR: 3.65, botR: 6.55, width: 0.78, hasYellowCore: true },
      // Left flank lava stream
      { ang: 2.85, len: 6.8, topR: 3.65, botR: 6.0, width: 0.68, hasYellowCore: true },
      // Right flank lava stream
      { ang: 0.52, len: 7.4, topR: 3.65, botR: 6.2, width: 0.72, hasYellowCore: true },
      // Rear-right lava stream (for 360° completeness)
      { ang: 5.65, len: 8.2, topR: 3.65, botR: 6.45, width: 0.74, hasYellowCore: true },
      // Rear-center lava stream
      { ang: 4.71, len: 6.5, topR: 3.65, botR: 5.85, width: 0.68, hasYellowCore: false },
      // Rear-left lava stream
      { ang: 3.75, len: 7.8, topR: 3.65, botR: 6.3, width: 0.72, hasYellowCore: true },
    ];

    for (const st of lavaStreamSpecs) {
      const midR = (st.topR + st.botR) * 0.5;
      const midY = 11.6 - st.len * 0.44;
      const slopeAngle = Math.atan2(st.botR - st.topR, st.len * 0.88);

      // Outer orange-gold lava tongue
      const orangeChannel = new THREE.Mesh(
        new THREE.ConeGeometry(st.width, st.len, 5),
        lavaOrangeFlowMat
      );
      orangeChannel.scale.set(1.0, 1.0, 0.42);
      orangeChannel.position.set(
        Math.cos(st.ang) * midR,
        midY,
        Math.sin(st.ang) * midR
      );
      orangeChannel.rotation.order = 'YXZ';
      orangeChannel.rotation.y = -st.ang + Math.PI * 0.5;
      orangeChannel.rotation.x = Math.PI - slopeAngle;
      lavaStreamsGroup.add(orangeChannel);

      // Inner bright yellow-gold molten core inside the orange stream
      if (st.hasYellowCore) {
        const yellowCore = new THREE.Mesh(
          new THREE.ConeGeometry(st.width * 0.58, st.len * 0.82, 5),
          lavaYellowBrightMat
        );
        yellowCore.scale.set(1.0, 1.0, 0.48);
        yellowCore.position.set(
          Math.cos(st.ang) * (midR + 0.08),
          midY + 0.18,
          Math.sin(st.ang) * (midR + 0.08)
        );
        yellowCore.rotation.order = 'YXZ';
        yellowCore.rotation.y = -st.ang + Math.PI * 0.5;
        yellowCore.rotation.x = Math.PI - slopeAngle;
        lavaStreamsGroup.add(yellowCore);
      }
    }

    // 4 Mid-slope glowing diamond lava pockets/fissures (visible on front-center and flanks in image_19e38ffa.png)
    const fissureAngles = [1.55, 1.38, 1.95, 0.85];
    fissureAngles.forEach((ang, idx) => {
      const fY = idx === 0 ? 4.4 : idx === 1 ? 8.3 : idx === 2 ? 5.8 : 6.2;
      const fR = 7.75 - ((fY - 1.0) / 11.0) * 4.1;
      const outerFissure = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.58, 0),
        lavaOrangeFlowMat
      );
      outerFissure.scale.set(0.55, 2.35, 0.45);
      outerFissure.position.set(Math.cos(ang) * fR, fY, Math.sin(ang) * fR);
      outerFissure.rotation.order = 'YXZ';
      outerFissure.rotation.y = -ang + Math.PI * 0.5;
      outerFissure.rotation.x = -0.35;
      lavaStreamsGroup.add(outerFissure);

      const innerFissure = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.38, 0),
        lavaYellowBrightMat
      );
      innerFissure.scale.set(0.52, 1.85, 0.52);
      innerFissure.position.set(
        Math.cos(ang) * (fR + 0.07),
        fY,
        Math.sin(ang) * (fR + 0.07)
      );
      innerFissure.rotation.order = 'YXZ';
      innerFissure.rotation.y = -ang + Math.PI * 0.5;
      innerFissure.rotation.x = -0.35;
      lavaStreamsGroup.add(innerFissure);
    });

    group.add(lavaStreamsGroup);

    // =========================================================================
    // LAYER 5 (Parts 11, 12, 13 & 14): Diagonal Two-Tone Billowing Smoke Plume
    // + 2 Detached Floating Smoke Clouds Drifting Upper-Right
    // =========================================================================
    const smokeRoot = new THREE.Group();
    smokeRoot.name = 'diagonal_smoke_plume';
    smokeRoot.position.set(0, 12.25, 0);
    smokeRoot.userData.isStylizedVolcanoPlume = true;
    smokeRoot.userData.baseY = 12.25;

    // Helper that creates a cel-shaded two-tone cloud cluster (Cream-White upper dome + Taupe-Brown lower contour)
    const addTwoToneSmokeLobe = (
      target: THREE.Group,
      x: number,
      y: number,
      z: number,
      rx: number,
      ry: number,
      rz: number,
      underOffsetX = 0.22,
      underOffsetY = -0.34
    ) => {
      // Shaded warm taupe-brown lower belly (#a6826c)
      const underMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 14, 12),
        smokeTaupeUnderMat
      );
      underMesh.scale.set(rx * 1.04, ry * 0.88, rz * 0.98);
      underMesh.position.set(x + underOffsetX, y + underOffsetY, z - 0.05);
      target.add(underMesh);

      // Bright warm cream-white upper puff (#f5f5f4)
      const topMesh = new THREE.Mesh(
        new THREE.SphereGeometry(1.0, 14, 12),
        smokeCreamTopMat
      );
      topMesh.scale.set(rx, ry, rz);
      topMesh.position.set(x, y + 0.14, z + 0.05);
      target.add(topMesh);
    };

    // Main diagonal smoke column rising from crater at (0,0) up and to the right (+X)
    const mainPlumeLobes = [
      // Wide base smoke cushion resting directly on the yellow crater rim
      { x: -1.35, y: 0.65, z: 0.1, rx: 1.55, ry: 0.95, rz: 1.35, ux: -0.18, uy: -0.28 },
      { x: 0.0, y: 0.72, z: 0.2, rx: 1.85, ry: 1.02, rz: 1.55, ux: 0.15, uy: -0.32 },
      { x: 1.45, y: 0.68, z: 0.1, rx: 1.45, ry: 0.92, rz: 1.32, ux: 0.25, uy: -0.28 },
      // Mid-lower billowing puffs curving diagonally right
      { x: -0.55, y: 1.95, z: 0.12, rx: 1.52, ry: 1.12, rz: 1.35, ux: 0.24, uy: -0.34 },
      { x: 0.95, y: 2.25, z: 0.15, rx: 1.68, ry: 1.18, rz: 1.42, ux: 0.34, uy: -0.36 },
      // Mid-upper diagonal puffs
      { x: 0.45, y: 3.55, z: 0.08, rx: 1.48, ry: 1.15, rz: 1.28, ux: 0.26, uy: -0.32 },
      { x: 2.15, y: 3.95, z: 0.12, rx: 1.72, ry: 1.22, rz: 1.38, ux: 0.38, uy: -0.38 },
      // High billowing crown puffs tilted upper-right
      { x: 1.75, y: 5.25, z: 0.05, rx: 1.55, ry: 1.18, rz: 1.25, ux: 0.28, uy: -0.32 },
      { x: 3.35, y: 5.65, z: 0.08, rx: 1.78, ry: 1.25, rz: 1.32, ux: 0.38, uy: -0.38 },
      { x: 4.55, y: 6.35, z: 0.0, rx: 1.42, ry: 1.05, rz: 1.18, ux: 0.32, uy: -0.32 },
    ];

    for (const lobe of mainPlumeLobes) {
      addTwoToneSmokeLobe(
        smokeRoot,
        lobe.x,
        lobe.y,
        lobe.z,
        lobe.rx,
        lobe.ry,
        lobe.rz,
        lobe.ux,
        lobe.uy
      );
    }

    // Detached Floating Smoke Cloud 1 (Medium puff lower-right of main plume, matching image_19e38ffa.png)
    const detachedCloud1 = new THREE.Group();
    detachedCloud1.name = 'detached_smoke_cloud_1';
    detachedCloud1.position.set(5.45, 3.65, 0.15);
    detachedCloud1.rotation.z = 0.22;
    detachedCloud1.userData.isDetachedSmokeCloud = true;
    detachedCloud1.userData.baseX = 5.45;
    detachedCloud1.userData.baseY = 3.65;
    detachedCloud1.userData.phase = 0.8;
    addTwoToneSmokeLobe(detachedCloud1, -0.55, 0, 0, 1.08, 0.78, 0.92, 0.15, -0.28);
    addTwoToneSmokeLobe(detachedCloud1, 0.35, 0.18, 0.04, 1.22, 0.85, 0.96, 0.22, -0.3);
    addTwoToneSmokeLobe(detachedCloud1, 1.05, 0.32, 0, 0.88, 0.68, 0.82, 0.2, -0.25);
    smokeRoot.add(detachedCloud1);

    // Detached Floating Smoke Cloud 2 (Smaller puff higher & further right, matching image_19e38ffa.png)
    const detachedCloud2 = new THREE.Group();
    detachedCloud2.name = 'detached_smoke_cloud_2';
    detachedCloud2.position.set(7.55, 6.85, 0.05);
    detachedCloud2.rotation.z = 0.08;
    detachedCloud2.userData.isDetachedSmokeCloud = true;
    detachedCloud2.userData.baseX = 7.55;
    detachedCloud2.userData.baseY = 6.85;
    detachedCloud2.userData.phase = 2.1;
    addTwoToneSmokeLobe(detachedCloud2, -0.42, 0, 0, 0.86, 0.56, 0.75, 0.12, -0.22);
    addTwoToneSmokeLobe(detachedCloud2, 0.35, 0.06, 0.02, 0.95, 0.62, 0.78, 0.16, -0.24);
    smokeRoot.add(detachedCloud2);

    group.add(smokeRoot);
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
      stream.position.set(Math.cos(a) * 6.4, 6.6, Math.sin(a) * 6.4);
      stream.rotation.order = 'YXZ';
      stream.rotation.y = -a + Math.PI / 2;
      stream.rotation.x = -0.38;
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
   * PLANETARY 1. Núi Lửa Khiên Olympus Mons (Sao Hỏa — Từ Ảnh Mẫu m8uek02co8l91_09cb37ea.png)
   * Reconstructed directly from the user's NASA MOLA / Wolfgang Wieser orbital 3D photo:
   * - Layer 1 (aureole_plains_apron): Ochre-tan Tharsis plains (#c58b56) & wrinkled radial aureole landslide aprons
   * - Layer 2 (basal_scarp_cliff_ring): Iconic 8km vertical perimeter cliff escarpment with sunlit cream-gold left faces (#f3d59b) & deep shadow right faces (#23170d)
   * - Layer 3 (shield_gentle_dome & radial_flow_ribs): Ultra-broad low-angle dusty buff-ochre shield dome (#bfa06f / #8c7248) with radial lava flow ribs
   * - Layer 4 (nested_caldera_complex): Central sunken summit caldera complex with 6 overlapping collapse pits + 2 small plateau impact craters
   */
  private createMarsOlympusShield(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'mars_olympus_shield_root';
    this.addContactShadow(group, 11.8);

    const tharsisPlainMat = new THREE.MeshStandardMaterial({
      color: 0xc58b56,
      roughness: 0.9,
      flatShading: true,
    });
    const aureoleWrinkleMat = new THREE.MeshStandardMaterial({
      color: 0xa46d3d,
      roughness: 0.92,
      flatShading: true,
    });
    const scarpSunlitMat = new THREE.MeshStandardMaterial({
      color: 0xf3d59b,
      emissive: 0xd6a56a,
      emissiveIntensity: 0.14,
      roughness: 0.72,
      flatShading: true,
    });
    const scarpShadowMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a0e,
      roughness: 0.94,
      flatShading: true,
    });
    const shieldSunlitDomeMat = new THREE.MeshStandardMaterial({
      color: 0xccb07e,
      roughness: 0.84,
      flatShading: true,
    });
    const shieldMidDomeMat = new THREE.MeshStandardMaterial({
      color: 0x9b8052,
      roughness: 0.88,
      flatShading: true,
    });
    const shieldShadowDomeMat = new THREE.MeshStandardMaterial({
      color: 0x6b5635,
      roughness: 0.9,
      flatShading: true,
    });
    const calderaFloorMat = new THREE.MeshStandardMaterial({
      color: 0x3d2e1b,
      roughness: 0.92,
      flatShading: true,
    });

    // 1. LAYER 1: Tharsis Ochre Plains & Wrinkled Radial Aureole Landslide Aprons
    const aureoleGroup = new THREE.Group();
    aureoleGroup.name = 'aureole_plains_apron';

    const basePlain = new THREE.Mesh(
      new THREE.CylinderGeometry(11.4, 12.0, 0.45, 28),
      tharsisPlainMat
    );
    basePlain.position.y = 0.22;
    aureoleGroup.add(basePlain);

    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + 0.15;
      const dist = 9.8 + (i % 3) * 0.65;
      const lobe = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.15 + (i % 2) * 0.35, 1),
        i % 2 === 0 ? aureoleWrinkleMat : tharsisPlainMat
      );
      lobe.scale.set(1.65, 0.32, 0.95);
      lobe.position.set(Math.cos(ang) * dist, 0.48, Math.sin(ang) * dist);
      lobe.rotation.y = -ang + 0.3;
      aureoleGroup.add(lobe);
    }
    group.add(aureoleGroup);

    // 2. LAYER 2: Iconic Jagged 8km Vertical Basal Scarp Cliff Ring
    const scarpGroup = new THREE.Group();
    scarpGroup.name = 'basal_scarp_cliff_ring';

    const scarpCore = new THREE.Mesh(
      new THREE.CylinderGeometry(8.9, 9.6, 3.2, 24),
      shieldMidDomeMat
    );
    scarpCore.position.y = 1.95;
    scarpGroup.add(scarpCore);

    const scarpSegments = 20;
    for (let i = 0; i < scarpSegments; i++) {
      const ang = (i / scarpSegments) * Math.PI * 2;
      // Indentations / cliff bays matching the jagged perimeter in m8uek02co8l91_09cb37ea.png
      const bayIndent =
        i === 3 || i === 4 || i === 13 || i === 14
          ? -0.75
          : ((i * 7) % 5) * 0.16 - 0.25;
      const r = 8.95 + bayIndent;
      const isSunlitLeft = Math.cos(ang - 2.35) > -0.1;
      const cliffBlock = new THREE.Mesh(
        new THREE.BoxGeometry(2.95, 3.15 + (i % 3) * 0.22, 1.35),
        isSunlitLeft ? scarpSunlitMat : scarpShadowMat
      );
      cliffBlock.position.set(Math.cos(ang) * r, 1.95, Math.sin(ang) * r);
      cliffBlock.rotation.order = 'YXZ';
      cliffBlock.rotation.y = -ang + Math.PI * 0.5 + ((i % 3) - 1) * 0.08;
      cliffBlock.rotation.x = -0.14;
      scarpGroup.add(cliffBlock);
    }
    group.add(scarpGroup);

    // 3. LAYER 3: Broad Low-Angle Shield Dome & Radial Lava Flow Ribs
    const domeGroup = new THREE.Group();
    domeGroup.name = 'shield_gentle_dome';

    const lowerShield = new THREE.Mesh(
      new THREE.CylinderGeometry(6.8, 8.95, 2.6, 28),
      shieldMidDomeMat
    );
    lowerShield.position.y = 4.65;
    domeGroup.add(lowerShield);

    const midShieldSunlit = new THREE.Mesh(
      new THREE.CylinderGeometry(4.6, 6.85, 2.2, 24, 1, false, Math.PI * 0.35, Math.PI * 1.15),
      shieldSunlitDomeMat
    );
    midShieldSunlit.position.set(-0.15, 6.85, 0.1);
    domeGroup.add(midShieldSunlit);

    const midShieldShadow = new THREE.Mesh(
      new THREE.CylinderGeometry(4.55, 6.8, 2.18, 24),
      shieldShadowDomeMat
    );
    midShieldShadow.position.y = 6.82;
    domeGroup.add(midShieldShadow);

    const upperPlateau = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 4.65, 1.45, 24),
      shieldSunlitDomeMat
    );
    upperPlateau.position.y = 8.55;
    domeGroup.add(upperPlateau);

    const ribsGroup = new THREE.Group();
    ribsGroup.name = 'radial_flow_ribs';
    for (let r = 0; r < 14; r++) {
      const ang = (r / 14) * Math.PI * 2 + 0.12;
      const isLit = Math.cos(ang - 2.35) > 0;
      const rib = new THREE.Mesh(
        new THREE.ConeGeometry(0.68, 5.4, 5),
        isLit ? shieldSunlitDomeMat : shieldMidDomeMat
      );
      rib.scale.set(1.15, 1.0, 0.36);
      rib.position.set(Math.cos(ang) * 5.8, 6.1, Math.sin(ang) * 5.8);
      rib.rotation.order = 'YXZ';
      rib.rotation.y = -ang + Math.PI * 0.5;
      rib.rotation.x = -0.92;
      ribsGroup.add(rib);
    }
    domeGroup.add(ribsGroup);
    group.add(domeGroup);

    // 4. LAYER 4: Sunken 6-Pit Nested Summit Caldera Complex + 2 Satellite Impact Craters
    const calderaGroup = new THREE.Group();
    calderaGroup.name = 'nested_caldera_complex';

    const outerCalderaRim = new THREE.Mesh(
      new THREE.TorusGeometry(2.15, 0.32, 8, 24),
      scarpSunlitMat
    );
    outerCalderaRim.rotation.x = Math.PI / 2;
    outerCalderaRim.scale.set(1.15, 0.92, 0.75);
    outerCalderaRim.position.set(-0.15, 9.28, -0.1);
    calderaGroup.add(outerCalderaRim);

    const nestedPits = [
      { x: -0.55, z: -0.15, r: 1.05 },
      { x: 0.45, z: 0.12, r: 0.88 },
      { x: 0.05, z: -0.48, r: 0.72 },
      { x: -0.85, z: 0.32, r: 0.64 },
      { x: 0.85, z: -0.22, r: 0.58 },
      { x: -0.15, z: 0.48, r: 0.62 },
    ];
    for (const pit of nestedPits) {
      const pitWall = new THREE.Mesh(
        new THREE.TorusGeometry(pit.r, 0.14, 6, 16),
        shieldShadowDomeMat
      );
      pitWall.rotation.x = Math.PI / 2;
      pitWall.position.set(pit.x, 9.22, pit.z);
      calderaGroup.add(pitWall);

      const pitFloor = new THREE.Mesh(
        new THREE.CylinderGeometry(pit.r * 0.92, pit.r * 0.85, 0.24, 14),
        calderaFloorMat
      );
      pitFloor.position.set(pit.x, 9.12, pit.z);
      calderaGroup.add(pitFloor);
    }

    // Two small circular impact craters on the upper shield plateau (visible left & right of caldera in photo)
    for (const ic of [
      { x: -2.55, z: -0.65, r: 0.36 },
      { x: 1.95, z: -0.85, r: 0.32 },
    ]) {
      const craterRim = new THREE.Mesh(
        new THREE.TorusGeometry(ic.r, 0.08, 6, 14),
        scarpSunlitMat
      );
      craterRim.rotation.x = Math.PI / 2;
      craterRim.position.set(ic.x, 8.95, ic.z);
      calderaGroup.add(craterRim);
    }

    group.add(calderaGroup);
    return group;
  }

  /**
   * PLANETARY 1B. Núi Rãnh Sao Mithrim / Doom Mons (Vệ Tinh Titan — Ảnh NASA JPL images_1f7cdcc6.jpg)
   * Reconstructed directly from the user's NASA Jet Propulsion Laboratory Cassini 3D radar/VIMS image:
   * - Layer 1 (titan_dune_basin_floor): Dark golden-brown / amber-sepia organic tholin plain (#5c3812) with longitudinal dune waves & bright golden-orange left alluvial apron (#e09a48)
   * - Layer 2 (titan_dendritic_ridges): Star-shaped spider-like cluster of 8 sharp, bifurcating rocky/icy ridges radiating outward with bright cream-gold sunlit ice crests (#f5d096) and deep dark-chocolate shadow flanks (#261405) separated by deep V-valleys
   * - Layer 3 (titan_summit_peak_crater): Sharp jagged white-gold hydrocarbon-ice central apex (#fef3c7) adjacent to a deep cryovolcanic depression
   */
  private createTitanMithrimMontes(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'titan_mithrim_montes_root';
    this.addContactShadow(group, 11.4);

    const tholinBasinMat = new THREE.MeshStandardMaterial({
      color: 0x5c3812,
      roughness: 0.88,
      flatShading: true,
    });
    const duneWaveMat = new THREE.MeshStandardMaterial({
      color: 0x784918,
      roughness: 0.85,
      flatShading: true,
    });
    const goldenApronMat = new THREE.MeshStandardMaterial({
      color: 0xe09a48,
      emissive: 0xb45309,
      emissiveIntensity: 0.14,
      roughness: 0.72,
      flatShading: true,
    });
    const sunlitIceCrestMat = new THREE.MeshStandardMaterial({
      color: 0xf5d096,
      emissive: 0xd97706,
      emissiveIntensity: 0.18,
      roughness: 0.48,
      flatShading: true,
    });
    const shadowBitumenFlankMat = new THREE.MeshStandardMaterial({
      color: 0x261405,
      roughness: 0.94,
      flatShading: true,
    });
    const apexIceMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.24,
      roughness: 0.35,
      flatShading: true,
    });

    // 1. LAYER 1: Dark Amber-Brown Tholin Dune Basin & Bright Golden Left Alluvial Apron
    const basinGroup = new THREE.Group();
    basinGroup.name = 'titan_dune_basin_floor';

    const basinDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(10.8, 11.4, 0.55, 24),
      tholinBasinMat
    );
    basinDisc.position.y = 0.28;
    basinGroup.add(basinDisc);

    // Bright golden-orange sunlit alluvial fan on the left side (as seen in images_1f7cdcc6.jpg)
    const leftGoldenApron = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.9, 0.75, 14),
      goldenApronMat
    );
    leftGoldenApron.scale.set(1.15, 0.65, 1.55);
    leftGoldenApron.position.set(-5.8, 0.52, -0.4);
    basinGroup.add(leftGoldenApron);

    // Longitudinal hydrocarbon dune waves in foreground & right background
    for (let d = 0; d < 8; d++) {
      const dune = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.45, 5.2, 4, 8),
        d % 2 === 0 ? duneWaveMat : goldenApronMat
      );
      dune.rotation.z = Math.PI / 2;
      dune.rotation.y = 0.28;
      dune.scale.set(1.0, 0.38, 1.4);
      dune.position.set(-2.5 + d * 1.35, 0.55, 5.8 - (d % 3) * 1.4);
      basinGroup.add(dune);
    }
    group.add(basinGroup);

    // 2. LAYER 2: Star-Shaped / Spider-Like Cluster of 8 Bifurcating Dendritic Mountain Ridges
    const ridgesGroup = new THREE.Group();
    ridgesGroup.name = 'titan_dendritic_ridges';

    const ridgeSpecs = [
      { ang: 1.95, len: 8.8, h: 9.2, width: 1.55 }, // Front-left sweeping bright ridge
      { ang: 1.58, len: 8.2, h: 9.6, width: 1.45 }, // Front-center-left bifurcated ridge
      { ang: 1.24, len: 7.9, h: 9.4, width: 1.45 }, // Front-center-right dark/bright ridge
      { ang: 0.82, len: 8.4, h: 8.8, width: 1.5 },  // Front-right radiating ridge
      { ang: 0.25, len: 8.6, h: 8.2, width: 1.65 }, // East-right massive dark/amber ridge
      { ang: -0.45, len: 8.4, h: 8.5, width: 1.75 }, // Back-right wide corrugated ridge
      { ang: -1.45, len: 6.4, h: 7.8, width: 1.4 },  // North-back ridge
      { ang: 2.55, len: 7.6, h: 8.4, width: 1.45 },  // West-left ridge
    ];

    for (let i = 0; i < ridgeSpecs.length; i++) {
      const rs = ridgeSpecs[i];
      const ridgeArm = new THREE.Group();
      const midDist = rs.len * 0.48;

      // Dark-chocolate bitumen shadow flank (creating the high-contrast dark V-valleys)
      const darkSpine = new THREE.Mesh(
        new THREE.ConeGeometry(rs.width, rs.len * 1.18, 4),
        shadowBitumenFlankMat
      );
      darkSpine.scale.set(0.85, 1.0, 0.52);
      darkSpine.position.set(
        Math.cos(rs.ang) * midDist,
        rs.h * 0.46,
        Math.sin(rs.ang) * midDist
      );
      darkSpine.rotation.order = 'YXZ';
      darkSpine.rotation.y = -rs.ang + Math.PI * 0.5;
      darkSpine.rotation.x = -0.68;
      ridgeArm.add(darkSpine);

      // Bright cream-gold sunlit hydrocarbon-ice crest offset along the sunlit edge of the arête
      const litCrest = new THREE.Mesh(
        new THREE.ConeGeometry(rs.width * 0.72, rs.len * 1.12, 4),
        sunlitIceCrestMat
      );
      litCrest.scale.set(0.68, 1.0, 0.42);
      litCrest.position.set(
        Math.cos(rs.ang - 0.08) * (midDist - 0.15),
        rs.h * 0.49 + 0.25,
        Math.sin(rs.ang - 0.08) * (midDist - 0.15)
      );
      litCrest.rotation.order = 'YXZ';
      litCrest.rotation.y = -rs.ang + Math.PI * 0.5;
      litCrest.rotation.x = -0.68;
      ridgeArm.add(litCrest);

      // Secondary bifurcating distal spur at the foot of the ridge
      const forkAng = rs.ang + (i % 2 === 0 ? 0.16 : -0.16);
      const forkDist = rs.len * 0.76;
      const spur = new THREE.Mesh(
        new THREE.ConeGeometry(rs.width * 0.58, rs.len * 0.55, 4),
        i % 2 === 0 ? sunlitIceCrestMat : goldenApronMat
      );
      spur.scale.set(0.75, 1.0, 0.45);
      spur.position.set(
        Math.cos(forkAng) * forkDist,
        rs.h * 0.22,
        Math.sin(forkAng) * forkDist
      );
      spur.rotation.order = 'YXZ';
      spur.rotation.y = -forkAng + Math.PI * 0.5;
      spur.rotation.x = -0.78;
      ridgeArm.add(spur);

      ridgesGroup.add(ridgeArm);
    }
    group.add(ridgesGroup);

    // 3. LAYER 3: Central Jagged White-Gold Hydrocarbon-Ice Apex & Deep Cryo-Depression
    const summitGroup = new THREE.Group();
    summitGroup.name = 'titan_summit_peak_crater';

    const mainApex = new THREE.Mesh(
      new THREE.ConeGeometry(2.35, 11.8, 4),
      apexIceMat
    );
    mainApex.position.set(-0.6, 5.9, -0.8);
    mainApex.rotation.y = 0.45;
    mainApex.rotation.z = -0.12;
    summitGroup.add(mainApex);

    const shadowApex = new THREE.Mesh(
      new THREE.ConeGeometry(2.45, 11.2, 4),
      shadowBitumenFlankMat
    );
    shadowApex.position.set(0.45, 5.6, -0.4);
    shadowApex.rotation.y = 1.1;
    shadowApex.rotation.z = 0.14;
    summitGroup.add(shadowApex);

    const cryoPit = new THREE.Mesh(
      new THREE.CylinderGeometry(1.65, 1.1, 1.4, 10),
      shadowBitumenFlankMat
    );
    cryoPit.position.set(0.2, 6.2, 0.4);
    summitGroup.add(cryoPit);

    group.add(summitGroup);
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
   * PLANETARY 5. Núi Lửa Băng Wright Mons (Sao Diêm Vương — Từ Ảnh Mẫu NASA/JHUAPL/SwRI images.jpg)
   * Reconstructed directly from the user's "CRYOPLUME ERUPTION DETECTED" NASA/JHUAPL/SwRI image:
   * - Layer 1 (tholin_hummocky_bedrock): Dark reddish-brown / mahogany organic tholin hummocky terrain (#57362b / #3e241b) with foreground boulders, fractures & small impact craters
   * - Layer 2 (nitrogen_glacier_lobes): Massive cascading white & pale-cyan nitrogen/water-ice lava flows (#f1f5f9 / #bae6fd) spilling out of the breached front-right rim down into the valley
   * - Layer 3 (wright_mons_conical_caldera): Broad terraced cryovolcanic cone (#64748b / #94a3b8) topped by a deep, circular striated sunken caldera bowl (#cbd5e1 sunlit rim, #475569 striated inner wall)
   * - Layer 4 (cryoplume_eruption_jet): Towering multi-columnar white-and-cyan cryoplume geyser jet (#ffffff / #e0f2fe) shooting vertically from the caldera vent with ice crystal spray
   */
  private createPlutoCryoVolcano(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'pluto_cryo_volcano_root';
    this.addContactShadow(group, 11.6);

    const tholinDarkMat = new THREE.MeshStandardMaterial({
      color: 0x3e241b,
      roughness: 0.9,
      flatShading: true,
    });
    const tholinRedBrownMat = new THREE.MeshStandardMaterial({
      color: 0x57362b,
      roughness: 0.86,
      flatShading: true,
    });
    const cryoSlateConeMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.82,
      flatShading: true,
    });
    const sunlitCalderaRimMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.16,
      roughness: 0.38,
      flatShading: true,
    });
    const nitrogenGlacierMat = new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.22,
      roughness: 0.28,
      metalness: 0.22,
      flatShading: true,
    });
    const cyanIceFlowMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.34,
      roughness: 0.22,
      metalness: 0.25,
      flatShading: true,
    });
    const cryoPlumeWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.88,
      flatShading: true,
    });
    const cryoPlumeMistMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.62,
      flatShading: true,
    });

    // 1. LAYER 1: Dark Reddish-Brown Tholin Hummocky Bedrock & Small Foreground Craters
    const bedrockGroup = new THREE.Group();
    bedrockGroup.name = 'tholin_hummocky_bedrock';

    const basalPlatform = new THREE.Mesh(
      new THREE.CylinderGeometry(10.6, 11.4, 2.2, 18),
      tholinDarkMat
    );
    basalPlatform.position.y = 1.1;
    bedrockGroup.add(basalPlatform);

    // Hummocky red-brown tholin mounds in foreground & left slope (matching NASA/JHUAPL/SwRI foreground)
    for (let h = 0; h < 14; h++) {
      const ang = (h / 14) * Math.PI * 2 + 0.2;
      const dist = 6.8 + (h % 3) * 1.45;
      const mound = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.45 + (h % 3) * 0.35, 1),
        h % 2 === 0 ? tholinRedBrownMat : tholinDarkMat
      );
      mound.scale.set(1.35, 0.72, 1.15);
      mound.position.set(Math.cos(ang) * dist, 1.85 + (h % 2) * 0.45, Math.sin(ang) * dist);
      mound.rotation.y = h * 0.7;
      bedrockGroup.add(mound);
    }

    // Small circular pockmark craters in foreground tholin crust
    for (const cr of [
      { x: -4.2, z: 7.4, r: 0.65 },
      { x: -1.8, z: 8.2, r: 0.52 },
    ]) {
      const pock = new THREE.Mesh(
        new THREE.TorusGeometry(cr.r, 0.14, 6, 14),
        tholinRedBrownMat
      );
      pock.rotation.x = Math.PI / 2;
      pock.position.set(cr.x, 2.25, cr.z);
      bedrockGroup.add(pock);
    }
    group.add(bedrockGroup);

    // 2. LAYER 2: Cascading White & Pale-Cyan Nitrogen-Ice Glacier Lobes (Front-Right Spillway)
    const glacierGroup = new THREE.Group();
    glacierGroup.name = 'nitrogen_glacier_lobes';

    // Main broad cascading glacier lobe spilling from caldera breach toward front-right (as in images.jpg)
    for (let l = 0; l < 9; l++) {
      const t = l / 8;
      const lobeX = -0.5 + t * 6.4;
      const lobeZ = 0.8 + t * 6.6;
      const lobeY = 8.4 - t * 6.4;
      const lobeR = 2.1 + Math.sin(t * Math.PI) * 1.15;
      const lobe = new THREE.Mesh(
        new THREE.DodecahedronGeometry(lobeR, 1),
        l % 3 === 0 ? cyanIceFlowMat : nitrogenGlacierMat
      );
      lobe.scale.set(1.35, 0.48, 1.15);
      lobe.position.set(lobeX, lobeY, lobeZ);
      lobe.rotation.y = 0.65;
      glacierGroup.add(lobe);
    }

    // Secondary frozen nitrogen-ice ribs down the upper cone flanks
    for (let r = 0; r < 6; r++) {
      const ang = -0.35 + r * 0.42;
      const rib = new THREE.Mesh(
        new THREE.ConeGeometry(0.95, 7.6, 5),
        nitrogenGlacierMat
      );
      rib.scale.set(1.1, 1.0, 0.42);
      rib.position.set(Math.cos(ang) * 5.2, 6.2, Math.sin(ang) * 5.2);
      rib.rotation.order = 'YXZ';
      rib.rotation.y = -ang + Math.PI * 0.5;
      rib.rotation.x = -0.68;
      glacierGroup.add(rib);
    }
    group.add(glacierGroup);

    // 3. LAYER 3: Conical Wright Mons Cryovolcano & Deep Circular Striated Summit Caldera Bowl
    const calderaGroup = new THREE.Group();
    calderaGroup.name = 'wright_mons_conical_caldera';

    const mainCone = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 8.6, 7.8, 20),
      cryoSlateConeMat
    );
    mainCone.position.set(-1.1, 5.8, -0.8);
    calderaGroup.add(mainCone);

    const upperFrostedShoulders = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 6.4, 3.8, 20),
      nitrogenGlacierMat
    );
    upperFrostedShoulders.position.set(-1.1, 8.1, -0.8);
    calderaGroup.add(upperFrostedShoulders);

    // Circular steep-walled sunken caldera rim (bright sunlit inner-left wall)
    const calderaRim = new THREE.Mesh(
      new THREE.TorusGeometry(3.65, 0.62, 10, 24),
      sunlitCalderaRimMat
    );
    calderaRim.rotation.x = Math.PI / 2;
    calderaRim.scale.set(1.12, 0.95, 0.85);
    calderaRim.position.set(-1.1, 9.95, -0.8);
    calderaGroup.add(calderaRim);

    const calderaFloor = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 2.4, 1.2, 18),
      cryoSlateConeMat
    );
    calderaFloor.position.set(-1.1, 9.1, -0.8);
    calderaGroup.add(calderaFloor);

    group.add(calderaGroup);

    // 4. LAYER 4: Towering Multi-Columnar Cryoplume Eruption Jet & Ice-Crystal Spray Halo
    const plumeGroup = new THREE.Group();
    plumeGroup.name = 'cryoplume_eruption_jet';
    plumeGroup.position.set(-1.1, 14.2, -0.8);
    plumeGroup.userData.isVolcanoPlume = true;

    // Dense central vertical white cryoplume column shooting out of the caldera
    const coreJet = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 0.85, 10.5, 14),
      cryoPlumeWhiteMat
    );
    coreJet.position.y = 0.2;
    plumeGroup.add(coreJet);

    // Outer translucent ice-crystal spray cone & billowing cryo-cloud puffs
    const sprayHalo = new THREE.Mesh(
      new THREE.ConeGeometry(4.2, 11.8, 16),
      cryoPlumeMistMat
    );
    sprayHalo.rotation.x = Math.PI; // inverted cone flaring upward like a geyser fountain
    sprayHalo.position.y = 1.2;
    plumeGroup.add(sprayHalo);

    for (let p = 0; p < 6; p++) {
      const puff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.35 + (p % 3) * 0.45, 1),
        p % 2 === 0 ? cryoPlumeWhiteMat : cryoPlumeMistMat
      );
      const ang = (p / 6) * Math.PI * 2;
      puff.position.set(
        Math.cos(ang) * (0.9 + (p % 2) * 0.6),
        -2.2 + p * 1.65,
        Math.sin(ang) * (0.9 + (p % 2) * 0.6)
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
   * PLANETARY 7. Mặt Cắt Rãnh Nứt Băng & Đại Dương Ngầm Europa (Từ Ảnh Mẫu image.png)
   * Reconstructed directly from the user's 3D Europa geological block cutaway diagram:
   * - Layer 1 (europa_mantle_magma_core): Rocky seafloor crust (#1c1917) with glowing red-orange tidal-heated magma chamber (#ea580c / #facc15) in the front cutaway face
   * - Layer 2 (hydrothermal_seafloor_smokers): Craggy submarine hydrothermal vents (#475569) spewing 2 rising columns of white-cyan hydrothermal plumes (#99f6e4)
   * - Layer 3 (subsurface_turquoise_ocean): Deep translucent turquoise-cyan subsurface liquid ocean block (#0891b2 / #06b6d4) with a vertical water conduit channel
   * - Layer 4 (white_ice_shell_crust & chaos_ridge_surface): Split white floating ice shell (#e2e8f0) with a deep V-shaped fracture cleft, topped by golden-ochre & reddish-salt Chaos Terrain ridges (#d97706 / #b45309)
   * - Layer 5 (europa_cryo_geyser_plume): Fan-shaped translucent white-and-cyan water-vapor geyser plume (#ffffff / #bae6fd) erupting from the surface fracture cleft
   */
  private createEuropaPenitentesSpire(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'europa_ocean_rift_cutaway_root';
    this.addContactShadow(group, 10.4);

    const mantleRockMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.92,
      flatShading: true,
    });
    const magmaCoreMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xdc2626,
      emissiveIntensity: 0.95,
      roughness: 0.28,
      flatShading: true,
    });
    const hydrothermalMountMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.88,
      flatShading: true,
    });
    const smokerPlumeMat = new THREE.MeshStandardMaterial({
      color: 0xccfbf1,
      emissive: 0x2dd4bf,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.85,
      flatShading: true,
    });
    const subsurfaceOceanMat = new THREE.MeshStandardMaterial({
      color: 0x0891b2,
      emissive: 0x0e7490,
      emissiveIntensity: 0.38,
      roughness: 0.16,
      metalness: 0.15,
      transparent: true,
      opacity: 0.82,
    });
    const conduitCyanMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.65,
      roughness: 0.15,
    });
    const whiteIceShellMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.15,
      roughness: 0.32,
      flatShading: true,
    });
    const goldenChaosSurfaceMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: 0x92400e,
      emissiveIntensity: 0.18,
      roughness: 0.65,
      flatShading: true,
    });
    const creamSaltRidgeMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.52,
      flatShading: true,
    });
    const spaceGeyserMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x7dd3fc,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.82,
      flatShading: true,
    });

    // 1. LAYER 1: Rocky Mantle Seafloor & Glowing Tidal-Heated Magma Chamber (y = 0..2.2m)
    const mantleGroup = new THREE.Group();
    mantleGroup.name = 'europa_mantle_magma_core';

    const seafloorBlock = new THREE.Mesh(
      new THREE.BoxGeometry(12.4, 2.2, 9.6),
      mantleRockMat
    );
    seafloorBlock.position.y = 1.1;
    mantleGroup.add(seafloorBlock);

    // Glowing red-orange magma chamber dome exposed on the front-left cutaway face
    const magmaChamber = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 2.1, 7),
      magmaCoreMat
    );
    magmaChamber.scale.set(1.25, 1.0, 0.45);
    magmaChamber.position.set(-1.6, 1.15, 4.35);
    mantleGroup.add(magmaChamber);
    group.add(mantleGroup);

    // 2. LAYER 2: Submarine Hydrothermal Vents & 2 Rising White-Cyan Plume Columns (y = 2.2..7.5m)
    const hydrothermalGroup = new THREE.Group();
    hydrothermalGroup.name = 'hydrothermal_seafloor_smokers';

    for (const vm of [
      { x: -1.8, z: 3.8, r: 2.3, h: 2.6 },
      { x: 1.4, z: 3.7, r: 1.9, h: 2.2 },
      { x: 3.8, z: 3.6, r: 1.7, h: 1.8 },
    ]) {
      const ventMount = new THREE.Mesh(
        new THREE.ConeGeometry(vm.r, vm.h, 6),
        hydrothermalMountMat
      );
      ventMount.position.set(vm.x, 2.2 + vm.h * 0.45, vm.z);
      hydrothermalGroup.add(ventMount);
    }

    // Two turbulent rising white-cyan hydrothermal plumes inside the ocean cutaway
    for (const sp of [
      { x: -1.8, y: 5.8, r: 1.25 },
      { x: 1.2, y: 5.5, r: 1.05 },
    ]) {
      for (let k = 0; k < 3; k++) {
        const plumePuff = new THREE.Mesh(
          new THREE.DodecahedronGeometry(sp.r * (0.75 + k * 0.2), 1),
          smokerPlumeMat
        );
        plumePuff.position.set(sp.x, 3.8 + k * 1.15, 3.95);
        hydrothermalGroup.add(plumePuff);
      }
    }
    group.add(hydrothermalGroup);

    // 3. LAYER 3: Deep Turquoise-Cyan Subsurface Liquid Ocean Block (y = 2.2..11.2m)
    const oceanGroup = new THREE.Group();
    oceanGroup.name = 'subsurface_turquoise_ocean';

    const oceanBlock = new THREE.Mesh(
      new THREE.BoxGeometry(12.2, 8.8, 9.4),
      subsurfaceOceanMat
    );
    oceanBlock.position.y = 6.6;
    oceanGroup.add(oceanBlock);

    // Vertical cyan water conduit rising through the split ice shell
    const waterConduit = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 3.6, 9.5),
      conduitCyanMat
    );
    waterConduit.position.set(-1.35, 12.4, 0);
    oceanGroup.add(waterConduit);
    group.add(oceanGroup);

    // 4. LAYER 4: Split White Ice Shell Crust & Golden-Ochre Chaos Terrain Ridges (y = 11.0..14.8m)
    const iceShellGroup = new THREE.Group();
    iceShellGroup.name = 'white_ice_shell_crust';

    // Left ice crust slab (to the left of the fracture cleft)
    const leftIceSlab = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.8, 9.6),
      whiteIceShellMat
    );
    leftIceSlab.position.set(-4.0, 12.4, 0);
    iceShellGroup.add(leftIceSlab);

    // Right ice crust slab (to the right of the fracture cleft)
    const rightIceSlab = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 2.8, 9.6),
      whiteIceShellMat
    );
    rightIceSlab.position.set(2.55, 12.4, 0);
    iceShellGroup.add(rightIceSlab);

    // Golden-ochre & reddish-salt irradiated Chaos Terrain & Linea ridges on top of the ice shell
    const chaosSurfaceGroup = new THREE.Group();
    chaosSurfaceGroup.name = 'chaos_ridge_surface';

    const leftChaosTop = new THREE.Mesh(
      new THREE.BoxGeometry(4.1, 0.55, 9.5),
      goldenChaosSurfaceMat
    );
    leftChaosTop.position.set(-4.0, 14.05, 0);
    chaosSurfaceGroup.add(leftChaosTop);

    const rightChaosTop = new THREE.Mesh(
      new THREE.BoxGeometry(7.1, 0.55, 9.5),
      goldenChaosSurfaceMat
    );
    rightChaosTop.position.set(2.55, 14.05, 0);
    chaosSurfaceGroup.add(rightChaosTop);

    // Craggy golden & cream Chaos Terrain ridge mounds on the top surface
    for (let c = 0; c < 8; c++) {
      const cx = c < 3 ? -4.8 + c * 1.1 : 0.2 + (c - 3) * 1.15;
      const cz = -2.8 + ((c * 3) % 5) * 1.35;
      const ridgeMound = new THREE.Mesh(
        new THREE.ConeGeometry(1.15, 1.45, 5),
        c % 2 === 0 ? goldenChaosSurfaceMat : creamSaltRidgeMat
      );
      ridgeMound.scale.set(1.4, 0.75, 0.9);
      ridgeMound.position.set(cx, 14.65, cz);
      ridgeMound.rotation.y = c * 0.6;
      chaosSurfaceGroup.add(ridgeMound);
    }
    iceShellGroup.add(chaosSurfaceGroup);
    group.add(iceShellGroup);

    // 5. LAYER 5: Erupting Fan-Shaped Space Cryo-Geyser Spray Plume (y = 14.2..22.5m)
    const plumeGroup = new THREE.Group();
    plumeGroup.name = 'europa_cryo_geyser_plume';
    plumeGroup.position.set(-1.35, 14.2, 0.8);
    plumeGroup.userData.isVolcanoPlume = true;

    const geyserFan = new THREE.Mesh(
      new THREE.ConeGeometry(3.6, 8.2, 14),
      spaceGeyserMat
    );
    geyserFan.rotation.x = Math.PI; // Flaring upward from the ice-shell fracture cleft
    geyserFan.scale.set(1.15, 1.0, 0.65);
    geyserFan.position.y = 3.8;
    plumeGroup.add(geyserFan);

    for (let s = -1; s <= 1; s++) {
      const jetRay = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.18, 7.6, 8),
        spaceGeyserMat
      );
      jetRay.position.set(s * 0.85, 3.6, 0);
      jetRay.rotation.z = -s * 0.22;
      plumeGroup.add(jetRay);
    }
    group.add(plumeGroup);

    return group;
  }

  /**
   * EARTH 1. Đỉnh Sừng Băng Himalaya / Matterhorn Anpơ & Hồ Băng Andes (10 distinct parts)
   * Sharp 4-faceted pyramidal horn spire (Matterhorn/Everest), hanging blue glacier seracs,
   * turquoise Andean glacial cirque tarn, and summit snow plume.
   */
  /**
   * EARTH 1A. Đỉnh Sừng Băng Matterhorn Dãy Anpơ (Thụy Sĩ — Từ Ảnh Mẫu images.jpg)
   * Reconstructed directly from the user's Alps Matterhorn photograph:
   * - Layer 1 (alpine_rhododendron_meadow): Lush yellow-green & emerald alpine meadow foreground slope (#65a30d / #84cc16) with pink alpine rhododendron flowers (#ec4899) & golden shrub tips (#d97706)
   * - Layer 2 (glacier_saddle_col): Broad grey-brown alpine gneiss ridge (#57534e) draped with sweeping white snowfields & hanging glaciers (#f8fafc)
   * - Layer 3 (matterhorn_horn_pyramid): Iconic crooked 4-sided pyramidal horn with sunlit grey-tan left East face (#a8a29e), steep dark navy-slate shadowed North face (#1e3a8a / #1e293b), and hooked snow-capped summit crest (#ffffff)
   */
  private createHimalayaMatterhornPeak(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'alps_matterhorn_peak_root';
    this.addContactShadow(group, 11.2);

    const meadowGreenMat = new THREE.MeshStandardMaterial({
      color: 0x65a30d,
      roughness: 0.78,
      flatShading: true,
    });
    const meadowBrightMat = new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      roughness: 0.72,
      flatShading: true,
    });
    const goldenBushMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.75,
      flatShading: true,
    });
    const pinkRhododendronMat = new THREE.MeshStandardMaterial({
      color: 0xec4899,
      emissive: 0xdb2777,
      emissiveIntensity: 0.22,
      roughness: 0.45,
      flatShading: true,
    });
    const gneissBaseMat = new THREE.MeshStandardMaterial({
      color: 0x57534e,
      roughness: 0.88,
      flatShading: true,
    });
    const sunlitEastRockMat = new THREE.MeshStandardMaterial({
      color: 0xa8a29e,
      roughness: 0.82,
      flatShading: true,
    });
    const shadowNorthSlateMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      roughness: 0.86,
      flatShading: true,
    });
    const deepCliffMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      flatShading: true,
    });
    const alpineSnowMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.16,
      roughness: 0.32,
      flatShading: true,
    });

    // 1. LAYER 1: Lush Green Alpine Meadow Foreground with Pink Rhododendron Blossoms
    const meadowGroup = new THREE.Group();
    meadowGroup.name = 'alpine_rhododendron_meadow';

    const foregroundRightHill = new THREE.Mesh(
      new THREE.CylinderGeometry(5.6, 7.2, 2.8, 16),
      meadowBrightMat
    );
    foregroundRightHill.scale.set(1.25, 1.0, 0.85);
    foregroundRightHill.position.set(3.2, 1.35, 5.2);
    meadowGroup.add(foregroundRightHill);

    const foregroundLeftHill = new THREE.Mesh(
      new THREE.CylinderGeometry(4.8, 6.4, 2.1, 14),
      meadowGreenMat
    );
    foregroundLeftHill.scale.set(1.2, 1.0, 0.85);
    foregroundLeftHill.position.set(-3.4, 1.05, 5.4);
    meadowGroup.add(foregroundLeftHill);

    // Golden-ochre alpine bushes & pink rhododendron flower clusters in foreground
    for (let b = 0; b < 16; b++) {
      const bx = -6.2 + (b / 15) * 12.8;
      const bz = 4.6 + ((b * 7) % 5) * 0.72;
      const by = bx > 0 ? 2.45 - Math.abs(bx - 3.2) * 0.12 : 1.95 - Math.abs(bx + 3.4) * 0.1;
      const bush = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.65 + (b % 3) * 0.18, 0),
        b % 3 === 0 ? goldenBushMat : meadowBrightMat
      );
      bush.scale.set(1.3, 0.68, 1.1);
      bush.position.set(bx, by, bz);
      meadowGroup.add(bush);

      if (b % 2 === 0) {
        const blossom = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.32, 0),
          pinkRhododendronMat
        );
        blossom.position.set(bx + 0.15, by + 0.36, bz + 0.25);
        meadowGroup.add(blossom);
      }
    }
    group.add(meadowGroup);

    // 2. LAYER 2: Broad Alpine Gneiss Saddle Col & Sweeping White Glacier Snowfields
    const saddleGroup = new THREE.Group();
    saddleGroup.name = 'glacier_saddle_col';

    const basalMassif = new THREE.Mesh(
      new THREE.CylinderGeometry(6.8, 9.8, 6.2, 10),
      gneissBaseMat
    );
    basalMassif.scale.set(1.25, 1.0, 0.88);
    basalMassif.position.set(0, 3.1, -0.6);
    saddleGroup.add(basalMassif);

    // Left & right sweeping snowfields across the col (Hörnli & Furgg glaciers)
    const leftSnowfield = new THREE.Mesh(
      new THREE.ConeGeometry(4.6, 8.2, 5),
      alpineSnowMat
    );
    leftSnowfield.scale.set(1.25, 1.0, 0.55);
    leftSnowfield.position.set(-4.6, 5.4, 0.6);
    leftSnowfield.rotation.z = 0.48;
    leftSnowfield.rotation.x = 0.25;
    saddleGroup.add(leftSnowfield);

    const rightSnowShoulder = new THREE.Mesh(
      new THREE.ConeGeometry(4.8, 9.4, 5),
      alpineSnowMat
    );
    rightSnowShoulder.scale.set(1.3, 1.0, 0.58);
    rightSnowShoulder.position.set(3.8, 6.2, 0.5);
    rightSnowShoulder.rotation.z = -0.52;
    rightSnowShoulder.rotation.x = 0.28;
    saddleGroup.add(rightSnowShoulder);

    group.add(saddleGroup);

    // 3. LAYER 3: Iconic Crooked 4-Sided Pyramidal Matterhorn Horn Spire
    const hornGroup = new THREE.Group();
    hornGroup.name = 'matterhorn_horn_pyramid';

    // Sunlit Left/East Face (warm grey-tan granite strata)
    const sunlitLeftHorn = new THREE.Mesh(
      new THREE.ConeGeometry(4.8, 17.8, 4),
      sunlitEastRockMat
    );
    sunlitLeftHorn.position.set(-0.65, 13.8, -0.8);
    sunlitLeftHorn.rotation.y = Math.PI * 0.24;
    sunlitLeftHorn.rotation.z = -0.08;
    hornGroup.add(sunlitLeftHorn);

    // Dramatic Dark Navy-Slate North/Right Shadow Face (signature feature of user's Matterhorn photo)
    const shadowRightFace = new THREE.Mesh(
      new THREE.ConeGeometry(4.3, 16.8, 4),
      shadowNorthSlateMat
    );
    shadowRightFace.position.set(0.45, 13.4, -0.55);
    shadowRightFace.rotation.y = Math.PI * 0.32;
    shadowRightFace.rotation.z = 0.06;
    hornGroup.add(shadowRightFace);

    // Central Hörnli Arête Crest Spine
    const centralArete = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 15.6, 4),
      deepCliffMat
    );
    centralArete.scale.set(0.65, 1.0, 1.15);
    centralArete.position.set(-0.15, 12.2, 0.65);
    centralArete.rotation.x = 0.22;
    hornGroup.add(centralArete);

    // Hooked Snow-Capped Summit Crest (curving slightly to the left/east at y = 23.5..24.5m)
    const hookedSummit = new THREE.Mesh(
      new THREE.ConeGeometry(2.15, 5.8, 4),
      alpineSnowMat
    );
    hookedSummit.name = 'matterhorn_hooked_summit';
    hookedSummit.position.set(-0.95, 21.6, -0.75);
    hookedSummit.rotation.y = Math.PI * 0.24;
    hookedSummit.rotation.z = -0.18;
    hornGroup.add(hookedSummit);

    // Horizontal snow ledges & couloir bands on the horn
    for (let s = 0; s < 3; s++) {
      const snowBand = new THREE.Mesh(
        new THREE.BoxGeometry(3.8 - s * 0.7, 0.55, 2.2 - s * 0.3),
        alpineSnowMat
      );
      snowBand.position.set(-0.5, 11.2 + s * 3.1, 0.4 - s * 0.25);
      snowBand.rotation.z = -0.18;
      snowBand.rotation.y = 0.35;
      hornGroup.add(snowBand);
    }

    group.add(hornGroup);
    return group;
  }

  /**
   * EARTH 1B. Đỉnh Đuôi Cá Machapuchare / Everest (Dãy Himalaya — Từ Ảnh Mẫu image.png)
   * Reconstructed directly from the user's Nepal Annapurna / Machapuchare ("Fishtail" Peak) photograph:
   * - Layer 1 (himalaya_golden_foothill): Warm golden-brown & russet-ochre Himalayan sub-alpine ridge on the front-left (#92400e / #78350f / #b45309) + dark silhouette rhododendron foliage on front-right (#1c1917)
   * - Layer 2 (annapurna_fluted_buttresses): Massive steep white snow slopes (#f8fafc) heavily ribbed with craggy dark slate-blue granite buttresses (#334155 / #1e293b) & sweeping diagonal glacier avalanche chute on lower right
   * - Layer 3 (machapuchare_fishtail_summit): Soaring ultra-steep granite-and-ice spire splitting at the top into TWO distinct jagged twin horns (the iconic "Fishtail" notch / Đỉnh Đuôi Cá) with a sheer sunlit triangular rock face (#cbd5e1)
   */
  private createHimalayaFishtailPeak(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'himalaya_fishtail_peak_root';
    this.addContactShadow(group, 11.6);

    const russetFoothillMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.88,
      flatShading: true,
    });
    const goldenOchreGrassMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.84,
      flatShading: true,
    });
    const darkFoothillShadowMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.92,
      flatShading: true,
    });
    const silhouetteFoliageMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.9,
      flatShading: true,
    });
    const himalayaSnowMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.18,
      roughness: 0.3,
      flatShading: true,
    });
    const slateGraniteMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.86,
      flatShading: true,
    });
    const darkNavyCragMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      flatShading: true,
    });
    const sunlitGraniteTriangleMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.72,
      flatShading: true,
    });

    // 1. LAYER 1: Warm Golden-Brown & Russet Himalayan Foreground Foothill Ridge (Front-Left)
    const foothillGroup = new THREE.Group();
    foothillGroup.name = 'himalaya_golden_foothill';

    const leftRussetRidge = new THREE.Mesh(
      new THREE.ConeGeometry(6.2, 8.8, 6),
      russetFoothillMat
    );
    leftRussetRidge.scale.set(1.35, 1.0, 0.85);
    leftRussetRidge.position.set(-4.8, 3.8, 4.8);
    leftRussetRidge.rotation.z = -0.35;
    foothillGroup.add(leftRussetRidge);

    const centerGoldenMound = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 6.4, 3.6, 9),
      goldenOchreGrassMat
    );
    centerGoldenMound.scale.set(1.3, 1.0, 0.82);
    centerGoldenMound.position.set(-1.4, 1.8, 5.6);
    foothillGroup.add(centerGoldenMound);

    const shadowOutcrop = new THREE.Mesh(
      new THREE.DodecahedronGeometry(2.6, 0),
      darkFoothillShadowMat
    );
    shadowOutcrop.scale.set(1.4, 0.75, 0.9);
    shadowOutcrop.position.set(-5.6, 1.9, 5.9);
    foothillGroup.add(shadowOutcrop);

    // Dark silhouette sub-alpine rhododendron/oak branches on the front-right (matching image.png bottom-right)
    for (let t = 0; t < 5; t++) {
      const tree = new THREE.Mesh(
        new THREE.ConeGeometry(0.75 + (t % 2) * 0.2, 2.8 + (t % 3) * 0.6, 6),
        silhouetteFoliageMat
      );
      tree.position.set(4.2 + t * 0.95, 1.4 + (t % 2) * 0.3, 5.8 - (t % 2) * 0.5);
      foothillGroup.add(tree);
    }
    group.add(foothillGroup);

    // 2. LAYER 2: Fluted White Snow Slopes, Craggy Slate-Blue Granite Ribs & Diagonal Glacier Chute
    const buttressGroup = new THREE.Group();
    buttressGroup.name = 'annapurna_fluted_buttresses';

    const mainSnowMassif = new THREE.Mesh(
      new THREE.ConeGeometry(9.6, 16.5, 8),
      himalayaSnowMat
    );
    mainSnowMassif.scale.set(1.18, 1.0, 0.88);
    mainSnowMassif.position.set(0.4, 8.2, -0.6);
    buttressGroup.add(mainSnowMassif);

    // Craggy dark slate-blue granite ribs & sub-peaks protruding through the snow face
    const cragSpecs = [
      { x: -5.4, y: 8.6, z: -0.4, r: 2.8, h: 11.2, tiltZ: 0.28, mat: darkNavyCragMat },
      { x: 4.8, y: 9.8, z: -0.5, r: 3.6, h: 12.8, tiltZ: -0.22, mat: slateGraniteMat },
      { x: 7.2, y: 7.4, z: 0.4, r: 2.9, h: 9.6, tiltZ: -0.35, mat: darkNavyCragMat },
      { x: -1.6, y: 9.2, z: 1.8, r: 2.4, h: 10.4, tiltZ: 0.12, mat: slateGraniteMat },
      { x: 2.2, y: 8.8, z: 2.1, r: 2.5, h: 9.8, tiltZ: -0.15, mat: darkNavyCragMat },
      { x: 0.2, y: 6.4, z: 3.2, r: 2.8, h: 7.8, tiltZ: 0.05, mat: slateGraniteMat },
    ];
    for (const cs of cragSpecs) {
      const crag = new THREE.Mesh(
        new THREE.ConeGeometry(cs.r, cs.h, 5),
        cs.mat
      );
      crag.scale.set(1.1, 1.0, 0.65);
      crag.position.set(cs.x, cs.y, cs.z);
      crag.rotation.z = cs.tiltZ;
      buttressGroup.add(crag);
    }

    // Sweeping white diagonal glacier avalanche chute on the lower-right slope (as seen in image.png)
    const glacierChute = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 9.8, 0.95),
      himalayaSnowMat
    );
    glacierChute.position.set(4.6, 4.8, 3.1);
    glacierChute.rotation.z = 0.58;
    glacierChute.rotation.x = 0.42;
    buttressGroup.add(glacierChute);

    group.add(buttressGroup);

    // 3. LAYER 3: Iconic Twin-Horned "Fishtail" (Machapuchare) Summit Spire
    const summitGroup = new THREE.Group();
    summitGroup.name = 'machapuchare_fishtail_summit';

    // Sheer sunlit triangular upper rock face (#cbd5e1) below the twin horns
    const triangularFace = new THREE.Mesh(
      new THREE.ConeGeometry(4.4, 14.2, 4),
      sunlitGraniteTriangleMat
    );
    triangularFace.scale.set(1.05, 1.0, 0.72);
    triangularFace.position.set(-0.6, 16.2, -0.8);
    triangularFace.rotation.y = Math.PI * 0.25;
    summitGroup.add(triangularFace);

    // Left Horn of the Fishtail Notch (sharp white-and-slate tooth at y = 24.2m)
    const leftFishtailHorn = new THREE.Mesh(
      new THREE.ConeGeometry(1.85, 7.6, 4),
      himalayaSnowMat
    );
    leftFishtailHorn.name = 'fishtail_left_horn';
    leftFishtailHorn.position.set(-2.15, 20.4, -0.85);
    leftFishtailHorn.rotation.z = 0.14;
    summitGroup.add(leftFishtailHorn);

    // Right Main Horn of the Fishtail Notch (higher sharp spire at y = 25.5m)
    const rightFishtailHorn = new THREE.Mesh(
      new THREE.ConeGeometry(2.15, 9.2, 4),
      himalayaSnowMat
    );
    rightFishtailHorn.name = 'fishtail_right_horn';
    rightFishtailHorn.position.set(-0.25, 21.2, -0.75);
    rightFishtailHorn.rotation.z = -0.09;
    summitGroup.add(rightFishtailHorn);

    // Knife-edge West Ice Arête sweeping down to the left
    const westIceArete = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 13.5, 4),
      himalayaSnowMat
    );
    westIceArete.scale.set(0.65, 1.0, 0.85);
    westIceArete.position.set(-3.2, 14.5, -0.6);
    westIceArete.rotation.z = 0.36;
    summitGroup.add(westIceArete);

    group.add(summitGroup);
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



