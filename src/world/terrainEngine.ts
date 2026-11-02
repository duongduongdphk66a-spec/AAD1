/**
 * Terrain Engine Modular Entrypoint:
 * - `./registry`: Modular registry of individual biomes (`src/world/registry/biomes/*`), prefabs (`src/world/registry/prefabs/*`), weather (`WEATHER_CATALOG`), textures (`TEXTURE_BRUSHES`, `TEXTURE_INDEX_MAP`), and world configuration constants.
 * - `./brushes`: Surface texture painting (`applyTextureBrush`), dirty-rect vertex coloring (`recomputeTerrainColors`), and brush scale helpers.
 * - `./sculpting`: Elevation sculpting (`applySculptBrush`), table-driven kernel handlers (`SCULPT_TOOL_HANDLERS`), bilinear ground height query (`getGroundHeightAt`), elevation stats (`getTerrainElevationStats`), and deterministic procedural noise (`hash2D`, `valueNoise2D`, `fbm2D`).
 * - `./generation`: Procedural terrain generation (`generateFlatEarthTerrain`, `generateBiomeTerrain`), RGBA reconstruction (`reconstructFromRgbaBuffer`), rule-based execution (`executeTerrainRules`), Day/Night lighting (`computeDayNightLightingState`), and save/load serialization.
 */
import * as THREE from 'three';

export * from './registry';
export * from './brushes';
export * from './sculpting';
export * from './generation';
export * from './junctionBlending';
export * from './terrainWorker';

export interface QuadTreeNode {
  bounds: THREE.Box2;
  level: number;
  children: QuadTreeNode[];
  isLeaf: boolean;
}

export class TerrainQuadtreeLOD {
  private maxLevel: number;
  private minSize: number;
  private lodThresholdMultiplier: number;

  constructor(maxLevel = 5, minSize = 16, lodThresholdMultiplier = 6.0) {
    this.maxLevel = maxLevel;
    this.minSize = minSize;
    this.lodThresholdMultiplier = lodThresholdMultiplier;
  }

  public evaluateLOD(node: QuadTreeNode, cameraPosition: THREE.Vector3): void {
    const centerBox = new THREE.Vector2();
    node.bounds.getCenter(centerBox);
    const sizeBox = new THREE.Vector2();
    node.bounds.getSize(sizeBox);

    const distance = Math.hypot(
      centerBox.x - cameraPosition.x,
      centerBox.y - cameraPosition.z
    );

    const threshold = sizeBox.x * this.lodThresholdMultiplier;

    if (
      node.level < this.maxLevel &&
      sizeBox.x > this.minSize &&
      distance < threshold
    ) {
      if (node.isLeaf) {
        this.subdivide(node);
      }
      for (const child of node.children) {
        this.evaluateLOD(child, cameraPosition);
      }
    } else {
      // Collapse if camera is far away
      node.isLeaf = true;
      node.children = [];
    }
  }

  private subdivide(node: QuadTreeNode): void {
    node.isLeaf = false;
    const min = node.bounds.min;
    const max = node.bounds.max;
    const center = new THREE.Vector2();
    node.bounds.getCenter(center);

    const nextLevel = node.level + 1;

    node.children = [
      {
        bounds: new THREE.Box2(
          new THREE.Vector2(min.x, min.y),
          new THREE.Vector2(center.x, center.y)
        ),
        level: nextLevel,
        children: [],
        isLeaf: true,
      },
      {
        bounds: new THREE.Box2(
          new THREE.Vector2(center.x, min.y),
          new THREE.Vector2(max.x, center.y)
        ),
        level: nextLevel,
        children: [],
        isLeaf: true,
      },
      {
        bounds: new THREE.Box2(
          new THREE.Vector2(min.x, center.y),
          new THREE.Vector2(center.x, max.y)
        ),
        level: nextLevel,
        children: [],
        isLeaf: true,
      },
      {
        bounds: new THREE.Box2(
          new THREE.Vector2(center.x, center.y),
          new THREE.Vector2(max.x, max.y)
        ),
        level: nextLevel,
        children: [],
        isLeaf: true,
      },
    ];
  }
}


