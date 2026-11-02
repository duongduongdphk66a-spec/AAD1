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

export interface DynamicTerrainMaterialUniforms {
  uTime: { value: number };
  uTextureScale: { value: number };
  uTriplanarSharpness: { value: number };
  uSnowIntensity: { value: number };
  uSnowAltitude: { value: number };
  uSnowTransition: { value: number };
  uMaxSnowCosAngle: { value: number };
  uLavaLevel: { value: number };
  uLavaTransition: { value: number };
  uLavaEmissiveIntensity: { value: number };
  uFlowVelocity: { value: THREE.Vector2 };
  uSunDirection: { value: THREE.Vector3 };
  uRockColor: { value: THREE.Color };
  uGrassColor: { value: THREE.Color };
  uSnowColor: { value: THREE.Color };
  uLavaCoreColor: { value: THREE.Color };
  uLavaCrustColor: { value: THREE.Color };
}

export const TERRAIN_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uLavaLevel;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vWaveDisplacement;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWaveDisplacement = 0.0;

    // Tạo gợn sóng động nếu đỉnh nằm trong vùng chất lỏng / dung nham thấp
    if (worldPos.y <= uLavaLevel + 0.5) {
      float wave1 = sin(worldPos.x * 0.4 + uTime * 2.2) * 0.15;
      float wave2 = cos(worldPos.z * 0.35 - uTime * 1.8) * 0.15;
      vWaveDisplacement = wave1 + wave2;
      worldPos.y += vWaveDisplacement;
    }

    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

export const TERRAIN_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uTextureScale;
  uniform float uTriplanarSharpness;
  uniform float uSnowIntensity;
  uniform float uSnowAltitude;
  uniform float uSnowTransition;
  uniform float uMaxSnowCosAngle;
  uniform float uLavaLevel;
  uniform float uLavaTransition;
  uniform float uLavaEmissiveIntensity;
  uniform vec2 uFlowVelocity;
  uniform vec3 uSunDirection;

  uniform vec3 uRockColor;
  uniform vec3 uGrassColor;
  uniform vec3 uSnowColor;
  uniform vec3 uLavaCoreColor;
  uniform vec3 uLavaCrustColor;

  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying float vWaveDisplacement;

  // Hàm băm nhiễu giả ngẫu nhiên trên GPU phục vụ kết cấu thủ tục (Procedural Noise)
  float hash2D(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash2D(i + vec2(0.0, 0.0)), hash2D(i + vec2(1.0, 0.0)), u.x),
      mix(hash2D(i + vec2(0.0, 1.0)), hash2D(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      v += amp * valueNoise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return v;
  }

  // Lấy mẫu Triplanar 3 mặt phẳng trực giao
  float sampleTriplanarNoise(vec3 worldPos, vec3 normal, float scale, float sharpness) {
    vec3 weights = pow(abs(normal), vec3(sharpness));
    weights /= max(weights.x + weights.y + weights.z, 1e-5);

    float sampleX = fbm(worldPos.yz * scale);
    float sampleY = fbm(worldPos.xz * scale);
    float sampleZ = fbm(worldPos.xy * scale);

    return sampleX * weights.x + sampleY * weights.y + sampleZ * weights.z;
  }

  void main() {
    vec3 N = normalize(vWorldNormal);
    vec3 up = vec3(0.0, 1.0, 0.0);
    float upDot = clamp(dot(N, up), 0.0, 1.0);

    // 1. Tính kết cấu nền Triplanar giữa Vách đá (Rock) và Thảm thực vật (Grass)
    float detailNoise = sampleTriplanarNoise(vWorldPosition, N, uTextureScale, uTriplanarSharpness);
    float grassMask = smoothstep(0.55, 0.82, upDot);
    vec3 baseAlbedo = mix(
      uRockColor * (0.75 + 0.5 * detailNoise),
      uGrassColor * (0.85 + 0.3 * detailNoise),
      grassMask
    );

    // 2. Tính hệ số phủ tuyết động M_snow(p, n)
    float slopeFactor = clamp(
      ((upDot - uMaxSnowCosAngle) / max(1.0 - uMaxSnowCosAngle, 1e-4)) * uSnowIntensity,
      0.0,
      1.0
    );
    float altitudeFactor = smoothstep(
      uSnowAltitude,
      uSnowAltitude + uSnowTransition,
      vWorldPosition.y + detailNoise * 4.0
    );
    float snowMask = slopeFactor * altitudeFactor;
    baseAlbedo = mix(baseAlbedo, uSnowColor, snowMask);

    // 3. Tính dòng chảy và phát xạ dung nham E_lava(p, t) ở vùng trũng
    vec2 lavaUV = vWorldPosition.xz * (uTextureScale * 1.5) + uFlowVelocity * uTime;
    lavaUV.x += 0.25 * sin(vWorldPosition.z * 0.5 + uTime * 1.5);
    lavaUV.y += 0.25 * cos(vWorldPosition.x * 0.5 + uTime * 1.5);

    float lavaPattern = fbm(lavaUV);
    float lavaMask = 1.0 - smoothstep(uLavaLevel, uLavaLevel + uLavaTransition, vWorldPosition.y);
    float pulse = 0.5 + 0.5 * sin(uTime * 3.0 + dot(vWorldPosition.xz, vec2(0.2, 0.2)));

    vec3 lavaColor = mix(uLavaCrustColor, uLavaCoreColor, smoothstep(0.35, 0.75, lavaPattern));
    vec3 emissive =
      lavaColor *
      lavaMask *
      uLavaEmissiveIntensity *
      (0.7 + 0.3 * pulse) *
      smoothstep(0.3, 0.8, lavaPattern);

    // 4. Chiếu sáng khuếch tán Lambert kết hợp Hemispheric Ambient
    float diff = max(dot(N, normalize(uSunDirection)), 0.0);
    float ambient = 0.35 + 0.25 * upDot;
    vec3 finalSurface = mix(baseAlbedo * (diff * 0.75 + ambient), lavaColor, lavaMask);

    gl_FragColor = vec4(finalSurface + emissive, 1.0);
  }
`;

export function createDynamicTerrainMaterial(
  overrides?: Partial<{
    [K in keyof DynamicTerrainMaterialUniforms]: DynamicTerrainMaterialUniforms[K]['value'];
  }>
): THREE.ShaderMaterial {
  const uniforms: DynamicTerrainMaterialUniforms = {
    uTime: { value: overrides?.uTime ?? 0 },
    uTextureScale: { value: overrides?.uTextureScale ?? 0.08 },
    uTriplanarSharpness: { value: overrides?.uTriplanarSharpness ?? 6.0 },
    uSnowIntensity: { value: overrides?.uSnowIntensity ?? 0.85 },
    uSnowAltitude: { value: overrides?.uSnowAltitude ?? 28.0 },
    uSnowTransition: { value: overrides?.uSnowTransition ?? 10.0 },
    uMaxSnowCosAngle: { value: overrides?.uMaxSnowCosAngle ?? 0.45 },
    uLavaLevel: { value: overrides?.uLavaLevel ?? 2.5 },
    uLavaTransition: { value: overrides?.uLavaTransition ?? 3.0 },
    uLavaEmissiveIntensity: { value: overrides?.uLavaEmissiveIntensity ?? 2.2 },
    uFlowVelocity: {
      value: overrides?.uFlowVelocity ?? new THREE.Vector2(0.12, 0.08),
    },
    uSunDirection: {
      value:
        overrides?.uSunDirection ?? new THREE.Vector3(0.6, 0.8, 0.4).normalize(),
    },
    uRockColor: { value: overrides?.uRockColor ?? new THREE.Color(0x4a4e54) },
    uGrassColor: { value: overrides?.uGrassColor ?? new THREE.Color(0x3b6e38) },
    uSnowColor: { value: overrides?.uSnowColor ?? new THREE.Color(0xf4f8ff) },
    uLavaCoreColor: {
      value: overrides?.uLavaCoreColor ?? new THREE.Color(0xff5500),
    },
    uLavaCrustColor: {
      value: overrides?.uLavaCrustColor ?? new THREE.Color(0x2b0900),
    },
  };

  return new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: TERRAIN_VERTEX_SHADER,
    fragmentShader: TERRAIN_FRAGMENT_SHADER,
  });
}

