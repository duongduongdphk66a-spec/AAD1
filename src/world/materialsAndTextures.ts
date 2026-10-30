import * as THREE from 'three';

/**
 * Generates smooth radial vector-gradient textures for contact shadows
 * without any raster pixel-block artifacts.
 */
export function createTerrainDetailTextures(_maxAnisotropy: number): {
  contactShadowMap: THREE.CanvasTexture;
} {
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d')!;
  const grad = sCtx.createRadialGradient(128, 128, 12, 128, 128, 120);
  grad.addColorStop(0, 'rgba(10, 15, 30, 0.55)');
  grad.addColorStop(0.55, 'rgba(10, 15, 30, 0.22)');
  grad.addColorStop(1, 'rgba(10, 15, 30, 0.0)');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 256, 256);

  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;
  contactShadowMap.minFilter = THREE.LinearFilter;
  contactShadowMap.magFilter = THREE.LinearFilter;

  return { contactShadowMap };
}
