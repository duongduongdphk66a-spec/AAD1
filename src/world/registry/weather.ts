import * as THREE from 'three';
import type { BiomeId, WeatherConfig as CatalogWeatherConfig, WeatherId } from './types';

export const WEATHER_CATALOG: CatalogWeatherConfig[] = [
  {
    id: 'clear_sky',
    name: 'Trời Quang Đãng (Tự Nhiên)',
    shortName: 'Quang Đãng',
    planetOrigin: 'Trái Đất / Teyvat',
    subtitle: 'Bầu trời trong trẻo, ánh nắng chuẩn theo quần xã',
    badgeColor: '#38bdf8',
    particleColorHex: '#ffffff',
    secondaryColorHex: '#bae6fd',
  },
  {
    id: 'himalaya_blizzard',
    name: 'Bão Tuyết Đỉnh Himalaya · Anpơ · Andes',
    shortName: 'Bão Tuyết Himalaya',
    planetOrigin: 'Himalaya / Anpơ / Andes',
    subtitle: 'Gió tuyết sơn cước cuốn bông tuyết trắng xóa & sương băng quanh các đỉnh núi 1km',
    badgeColor: '#bae6fd',
    fogOverrideHex: '#cbd5e1',
    particleColorHex: '#ffffff',
    secondaryColorHex: '#7dd3fc',
  },
  {
    id: 'tropical_monsoon_rain',
    name: 'Mưa Giông & Sương Mù Rừng Nhiệt Đới (Amazon / Trung Phi)',
    shortName: 'Mưa Rừng Amazon',
    planetOrigin: 'Amazon / Congo',
    subtitle: 'Mưa rào nhiệt đới mát lành kèm làn sương hơi nước bốc lên từ tán rừng mưa',
    badgeColor: '#34d399',
    fogOverrideHex: '#6ee7b7',
    particleColorHex: '#a7f3d0',
    secondaryColorHex: '#38bdf8',
  },
  {
    id: 'mars_dust_storm',
    name: 'Bão Bụi Đỏ & Lốc Xoáy Sao Hỏa',
    shortName: 'Bão Bụi Sao Hỏa',
    planetOrigin: 'Sao Hỏa (Mars)',
    subtitle: 'Bão cát oxit sắt đỏ cam toàn cầu kèm cột lốc bụi Dust Devil xoáy cao',
    badgeColor: '#ea580c',
    fogOverrideHex: '#b45309',
    particleColorHex: '#f97316',
    secondaryColorHex: '#9a3412',
  },
  {
    id: 'supersonic_mars_storm',
    name: 'Bão Bụi Siêu Thanh & Sét Tĩnh Điện (Mars)',
    shortName: 'Bão Bụi Siêu Thanh',
    planetOrigin: 'Sao Hỏa (Mars Extreme)',
    subtitle: 'Gió giật siêu thanh cuốn vệt cát ngang tốc độ cao, 4 vòi rồng bụi khổng lồ & phóng điện ma sát',
    badgeColor: '#f97316',
    fogOverrideHex: '#9a3412',
    particleColorHex: '#fb923c',
    secondaryColorHex: '#38bdf8',
  },
  {
    id: 'venus_acid_rain',
    name: 'Mưa Axit Sunfuric & Sấm Chớp Sao Kim',
    shortName: 'Mưa Axit Sao Kim',
    planetOrigin: 'Sao Kim (Venus)',
    subtitle: 'Mưa axit H₂SO₄ vàng lục đặc quánh từ tầng mây siêu quay & tia chớp áp suất cao',
    badgeColor: '#eab308',
    fogOverrideHex: '#a16207',
    particleColorHex: '#fde047',
    secondaryColorHex: '#a3e635',
  },
  {
    id: 'concentrated_venus_acid',
    name: 'Mưa Axit Cô Đặc & Sét Siêu Áp (Venus)',
    shortName: 'Mưa Axit Cô Đặc',
    planetOrigin: 'Sao Kim (Venus 92 Bar)',
    subtitle: 'Mưa axit sunfuric cô đặc xối xả, tia sét 3D đánh thẳng xuống bề mặt & hơi ăn mòn bốc khói',
    badgeColor: '#a3e635',
    fogOverrideHex: '#854d0e',
    particleColorHex: '#bef264',
    secondaryColorHex: '#facc15',
  },
  {
    id: 'liquid_nitrogen_snow',
    name: 'Tuyết Nitơ Lỏng & Sương Mêtan (Titan / Pluto)',
    shortName: 'Tuyết Nitơ Lỏng',
    planetOrigin: 'Titan / Sao Diêm Vương',
    subtitle: 'Bông tuyết nitơ lỏng xanh băng & giọt mưa mêtan vàng hổ phách rơi chậm kèm sương khói lạnh -230°C',
    badgeColor: '#22d3ee',
    fogOverrideHex: '#164e63',
    particleColorHex: '#67e8f9',
    secondaryColorHex: '#f59e0b',
  },
  {
    id: 'cryo_geyser_blizzard',
    name: 'Bão Phun Trào Núi Lửa Băng & Tinh Thể (Pluto / Europa)',
    shortName: 'Bão Phun Băng',
    planetOrigin: 'Sao Diêm Vương / Europa',
    subtitle: 'Các cột mạch phun băng nitơ & amoniac bắn vọt từ lòng đất lên trời kèm bão tuyết tinh thể',
    badgeColor: '#38bdf8',
    fogOverrideHex: '#0c4a6e',
    particleColorHex: '#e0f2fe',
    secondaryColorHex: '#38bdf8',
  },
  {
    id: 'molten_silicate_rain',
    name: 'Mưa Đá Silicat Nóng Chảy & Bão Thủy Tinh (CoRoT-7b)',
    shortName: 'Mưa Đá Nóng Chảy',
    planetOrigin: 'CoRoT-7b / HD 189733b',
    subtitle: 'Mưa đá thạch anh & thủy tinh silicat nóng chảy 2.500°C quất chéo kèm sóng nhiệt magma',
    badgeColor: '#fb7185',
    fogOverrideHex: '#7f1d1d',
    particleColorHex: '#fda4af',
    secondaryColorHex: '#f97316',
  },
  {
    id: 'exoplanet_meteor_shower',
    name: 'Mưa Sao Băng & Thiên Thạch Ngoại Hành Tinh',
    shortName: 'Mưa Sao Băng',
    planetOrigin: 'Kepler-452b / Ngoại Hành Tinh',
    subtitle: 'Mưa sao băng phát quang xanh lam - tím cắt ngang bầu trời hành tinh đá',
    badgeColor: '#a855f7',
    fogOverrideHex: '#4c1d95',
    particleColorHex: '#38bdf8',
    secondaryColorHex: '#e879f9',
  },
  {
    id: 'ion_aurora_tempest',
    name: 'Bão Từ Cực Quang & Tinh Thể Băng TRAPPIST-1e',
    shortName: 'Bão Từ Cực Quang',
    planetOrigin: 'TRAPPIST-1e / Proxima b',
    subtitle: 'Dải cực quang bức xạ sao lùn đỏ & bụi kim cương băng trôi lơ lửng',
    badgeColor: '#f43f5e',
    fogOverrideHex: '#701a75',
    particleColorHex: '#2dd4bf',
    secondaryColorHex: '#fb7185',
  },
  {
    id: 'ash_ember_fall',
    name: 'Mưa Tro Núi Lửa & Tàn Lửa Magma',
    shortName: 'Mưa Tro Lửa',
    planetOrigin: 'Natlan / Hành Tinh Dung Nham',
    subtitle: 'Tàn lửa đỏ rực bay lên cùng mưa tro xỉ bazan rơi từ miệng núi lửa',
    badgeColor: '#ef4444',
    fogOverrideHex: '#7c2d12',
    particleColorHex: '#fb923c',
    secondaryColorHex: '#475569',
  },
];

export type WeatherPresetType =
  | 'snowstorm'
  | 'sakura_petals'
  | 'volcanic_ash'
  | 'methane_rain';

export interface GPUWeatherPresetConfig {
  particleCount: number;
  boxSize: THREE.Vector3;
  terminalVelocity: THREE.Vector3;
  windVelocity: THREE.Vector3;
  turbulenceAmplitude: THREE.Vector3;
  turbulenceFrequency: number;
  particleSize: number;
  color: THREE.Color;
  snowCoverageRate: number;
}

export const BIOME_WEATHER_PRESETS: Record<WeatherPresetType, GPUWeatherPresetConfig> = {
  snowstorm: {
    particleCount: 15000,
    boxSize: new THREE.Vector3(160, 80, 160),
    terminalVelocity: new THREE.Vector3(0, -6.5, 0),
    windVelocity: new THREE.Vector3(3.2, 0, 1.8),
    turbulenceAmplitude: new THREE.Vector3(1.5, 0.4, 1.5),
    turbulenceFrequency: 2.0,
    particleSize: 3.5,
    color: new THREE.Color(0xffffff),
    snowCoverageRate: 0.95,
  },
  sakura_petals: {
    particleCount: 8000,
    boxSize: new THREE.Vector3(140, 60, 140),
    terminalVelocity: new THREE.Vector3(0, -2.2, 0),
    windVelocity: new THREE.Vector3(2.5, 0, -1.5),
    turbulenceAmplitude: new THREE.Vector3(2.8, 1.2, 2.8),
    turbulenceFrequency: 1.4,
    particleSize: 4.5,
    color: new THREE.Color(0xffb7c5),
    snowCoverageRate: 0.0,
  },
  volcanic_ash: {
    particleCount: 10000,
    boxSize: new THREE.Vector3(160, 90, 160),
    terminalVelocity: new THREE.Vector3(0, 3.8, 0), // Rising embers and hot volcanic ash
    windVelocity: new THREE.Vector3(1.2, 0, 0.9),
    turbulenceAmplitude: new THREE.Vector3(2.2, 0.8, 2.2),
    turbulenceFrequency: 2.8,
    particleSize: 4.0,
    color: new THREE.Color(0xff6a00),
    snowCoverageRate: 0.0,
  },
  methane_rain: {
    particleCount: 18000,
    boxSize: new THREE.Vector3(150, 100, 150),
    terminalVelocity: new THREE.Vector3(0, -14.0, 0),
    windVelocity: new THREE.Vector3(4.5, 0, 0.5),
    turbulenceAmplitude: new THREE.Vector3(0.3, 0.1, 0.3),
    turbulenceFrequency: 3.5,
    particleSize: 2.5,
    color: new THREE.Color(0xd4a359),
    snowCoverageRate: 0.0,
  },
};

export const WEATHER_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCameraPosition;
  uniform vec3 uBoxSize;
  uniform vec3 uTerminalVelocity;
  uniform vec3 uWindVelocity;
  uniform vec3 uTurbulenceAmp;
  uniform float uTurbulenceFreq;
  uniform float uParticleSize;

  attribute vec3 aPhase;
  varying float vAlpha;

  void main() {
    vec3 totalVelocity = uTerminalVelocity + uWindVelocity;
    vec3 turbulence = uTurbulenceAmp * sin(uTurbulenceFreq * uTime + aPhase);
    vec3 relPos = position + totalVelocity * uTime + turbulence - uCameraPosition;

    // Periodic bounding volume wrapping mod(relPos, uBoxSize) around the camera
    vec3 wrappedPos = uCameraPosition + mod(relPos, uBoxSize) - 0.5 * uBoxSize;

    // Smoothly fade particles near the bounding box edge to avoid popping
    vec3 normDist = abs(wrappedPos - uCameraPosition) / (0.5 * uBoxSize);
    float edgeFade = 1.0 - max(max(normDist.x, normDist.y), normDist.z);
    vAlpha = smoothstep(0.0, 0.25, edgeFade);

    vec4 mvPosition = modelViewMatrix * vec4(wrappedPos, 1.0);
    gl_PointSize = uParticleSize * (120.0 / max(-mvPosition.z, 1.0));
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const WEATHER_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uParticleColor;
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float softCircle = smoothstep(0.5, 0.1, dist);
    gl_FragColor = vec4(uParticleColor, softCircle * vAlpha * 0.85);
  }
`;

export function createGPUWeatherSystem(preset: WeatherPresetType): THREE.Points {
  const cfg = BIOME_WEATHER_PRESETS[preset];
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(cfg.particleCount * 3);
  const phases = new Float32Array(cfg.particleCount * 3);

  for (let i = 0; i < cfg.particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * cfg.boxSize.x;
    positions[i * 3 + 1] = (Math.random() - 0.5) * cfg.boxSize.y;
    positions[i * 3 + 2] = (Math.random() - 0.5) * cfg.boxSize.z;

    phases[i * 3] = Math.random() * Math.PI * 2;
    phases[i * 3 + 1] = Math.random() * Math.PI * 2;
    phases[i * 3 + 2] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCameraPosition: { value: new THREE.Vector3() },
      uBoxSize: { value: cfg.boxSize.clone() },
      uTerminalVelocity: { value: cfg.terminalVelocity.clone() },
      uWindVelocity: { value: cfg.windVelocity.clone() },
      uTurbulenceAmp: { value: cfg.turbulenceAmplitude.clone() },
      uTurbulenceFreq: { value: cfg.turbulenceFrequency },
      uParticleSize: { value: cfg.particleSize },
      uParticleColor: { value: cfg.color.clone() },
    },
    vertexShader: WEATHER_VERTEX_SHADER,
    fragmentShader: WEATHER_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.name = `gpu_weather_${preset}`;
  points.frustumCulled = false; // Always visible since bounding box follows camera in vertex shader
  return points;
}

export function mapBiomeOrWeatherToGPUPreset(
  biomeId: BiomeId,
  weatherId: WeatherId
): WeatherPresetType {
  if (
    weatherId === 'himalaya_blizzard' ||
    weatherId === 'liquid_nitrogen_snow' ||
    weatherId === 'cryo_geyser_blizzard' ||
    biomeId === 'snowpeak_glacier' ||
    biomeId === 'himalaya_alps_andes' ||
    biomeId === 'pluto_cryovolcano' ||
    biomeId === 'europa_chaos_ridge' ||
    biomeId === 'boreal_taiga_forest'
  ) {
    return 'snowstorm';
  }
  if (
    weatherId === 'ash_ember_fall' ||
    weatherId === 'molten_silicate_rain' ||
    biomeId === 'natlan_volcano_abyss' ||
    biomeId === 'corot_lava_ocean' ||
    biomeId === 'hawaii_shield_volcano'
  ) {
    return 'volcanic_ash';
  }
  if (
    weatherId === 'venus_acid_rain' ||
    weatherId === 'concentrated_venus_acid' ||
    weatherId === 'tropical_monsoon_rain' ||
    biomeId === 'titan_methane_sea' ||
    biomeId === 'venus_ishtar'
  ) {
    return 'methane_rain';
  }
  return 'sakura_petals';
}

