import * as THREE from 'three';

interface AreaLight {
  dir: THREE.Vector3;
  tan: THREE.Vector3;
  bit: THREE.Vector3;
  peak: number;
  sizeU: number;
  sizeV: number;
  softness: number;
  color: [number, number, number];
  intensity: number;
}

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const ALT = new THREE.Vector3(0, 0, 1);

function areaLight(
  dir: THREE.Vector3,
  sizeU: number,
  sizeV: number,
  softness: number,
  color: [number, number, number],
  intensity: number,
): AreaLight {
  const helper = Math.abs(dir.y) > 0.985 ? ALT : WORLD_UP;
  const tan = new THREE.Vector3().crossVectors(helper, dir).normalize();
  const bit = new THREE.Vector3().crossVectors(dir, tan).normalize();
  return {
    dir,
    tan,
    bit,
    peak: 1 + softness * 6,
    sizeU,
    sizeV,
    softness,
    color,
    intensity,
  };
}

const KEY = areaLight(
  new THREE.Vector3(-0.55, 0.72, 0.42).normalize(),
  0.2,
  0.17,
  0.35,
  [0.92, 0.96, 1.0],
  16,
);

const FILL = areaLight(
  new THREE.Vector3(0.88, 0.22, 0.42).normalize(),
  0.26,
  0.2,
  0.5,
  [1.0, 0.95, 0.86],
  4.2,
);

const RIM = areaLight(
  new THREE.Vector3(0.12, 0.42, -0.9).normalize(),
  0.18,
  0.12,
  0.28,
  [0.82, 0.9, 1.0],
  22,
);

const STRIP_LEFT = areaLight(
  new THREE.Vector3(-0.86, 0.34, -0.18).normalize(),
  0.025,
  0.32,
  0.12,
  [1.0, 1.0, 1.0],
  46,
);

const STRIP_RIGHT = areaLight(
  new THREE.Vector3(0.78, 0.1, 0.36).normalize(),
  0.02,
  0.26,
  0.12,
  [0.94, 0.97, 1.0],
  38,
);

const TOP = areaLight(
  new THREE.Vector3(0.05, 1.0, 0.08).normalize(),
  0.18,
  0.18,
  0.4,
  [1.0, 0.98, 0.94],
  9,
);

const SPARKS: AreaLight[] = [
  areaLight(
    new THREE.Vector3(-0.3, 0.62, -0.72).normalize(),
    0.014,
    0.014,
    0.6,
    [1.0, 1.0, 1.0],
    620,
  ),
  areaLight(
    new THREE.Vector3(0.62, 0.66, 0.34).normalize(),
    0.012,
    0.012,
    0.6,
    [0.96, 0.98, 1.0],
    480,
  ),
  areaLight(
    new THREE.Vector3(-0.72, 0.05, 0.66).normalize(),
    0.01,
    0.01,
    0.6,
    [1.0, 0.98, 0.92],
    420,
  ),
];

const LIGHTS: AreaLight[] = [KEY, FILL, RIM, STRIP_LEFT, STRIP_RIGHT, TOP, ...SPARKS];

const ENV_WIDTH = 1024;
const ENV_HEIGHT = 512;

const floatView = new Float32Array(1);
const intView = new Int32Array(floatView.buffer);

function toHalf(value: number): number {
  floatView[0] = value;
  const x = intView[0];
  let bits = (x >> 16) & 0x8000;
  let m = (x >> 12) & 0x07ff;
  const e = (x >> 23) & 0xff;
  if (e < 103) return bits;
  if (e > 142) {
    bits |= 0x7c00;
    bits |= e === 255 ? 0 : 1;
    return bits;
  }
  if (e < 113) {
    m |= 0x0800;
    bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
    return bits;
  }
  bits |= ((e - 112) << 10) | (m >> 1);
  bits += m & 1;
  return bits;
}

const NO_LIGHT: [number, number, number] = [0, 0, 0];

function lightContribution(
  light: AreaLight,
  dir: THREE.Vector3,
  spread: number,
  gain: number,
): [number, number, number] {
  const facing = dir.dot(light.dir);
  if (facing <= 0.05) return NO_LIGHT;

  const radiusU = light.sizeU * spread;
  const radiusV = light.sizeV * spread;
  const u = dir.dot(light.tan) / facing;
  const v = dir.dot(light.bit) / facing;
  const q = (u * u) / (radiusU * radiusU) + (v * v) / (radiusV * radiusV);
  if (q >= 1) return NO_LIGHT;

  const falloff = 1 - q;
  const amount = light.intensity * gain * falloff * falloff * Math.sqrt(falloff);
  return [light.color[0] * amount, light.color[1] * amount, light.color[2] * amount];
}

function background(dir: THREE.Vector3): [number, number, number] {
  const horizon = Math.exp(-Math.abs(dir.y) * 2.6);
  const zenith = Math.max(dir.y, 0);
  const floor = Math.max(-dir.y, 0);
  const r = 0.012 + horizon * 0.05 + zenith * 0.02 + floor * 0.012;
  const g = 0.017 + horizon * 0.062 + zenith * 0.028 + floor * 0.01;
  const b = 0.03 + horizon * 0.085 + zenith * 0.045 + floor * 0.008;
  return [r, g, b];
}

function renderEquirect(spread: number, gain: number): Uint16Array {
  const data = new Uint16Array(ENV_WIDTH * ENV_HEIGHT * 4);
  const dir = new THREE.Vector3();

  for (let y = 0; y < ENV_HEIGHT; y++) {
    const v = (y + 0.5) / ENV_HEIGHT;
    const theta = v * Math.PI;
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);
    for (let x = 0; x < ENV_WIDTH; x++) {
      const u = (x + 0.5) / ENV_WIDTH;
      const phi = (u - 0.5) * Math.PI * 2;
      dir.set(sinT * Math.cos(phi), cosT, sinT * Math.sin(phi));

      const bg = background(dir);
      let r = bg[0];
      let g = bg[1];
      let b = bg[2];

      for (const light of LIGHTS) {
        const c = lightContribution(light, dir, spread, gain);
        r += c[0];
        g += c[1];
        b += c[2];
      }

      const index = (y * ENV_WIDTH + x) * 4;
      data[index] = toHalf(r);
      data[index + 1] = toHalf(g);
      data[index + 2] = toHalf(b);
      data[index + 3] = toHalf(0x3c00);
    }
  }

  return data;
}

function createTexture(data: Uint16Array): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, ENV_WIDTH, ENV_HEIGHT, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface StudioEnv {
  sharp: THREE.Texture;
  soft: THREE.Texture;
}

let cache: StudioEnv | null = null;

export function getStudioEnv(): StudioEnv {
  if (cache) return cache;
  cache = {
    sharp: createTexture(renderEquirect(1, 1)),
    soft: createTexture(renderEquirect(2.6, 0.148)),
  };
  return cache;
}