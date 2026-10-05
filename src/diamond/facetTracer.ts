import * as THREE from 'three';
import { MAX_PLANES } from './brilliantCut';

export interface TracerConfig {
  planes: Float32Array;
  planeCount: number;
  envSharp: THREE.Texture;
  envSoft: THREE.Texture;
  maxBounces: number;
  dispersionOn: boolean;
}

const vertexShader = /* glsl */ `
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = /* glsl */ `
uniform vec4 uPlanes[MAX_PLANES];
uniform int uPlaneCount;
uniform sampler2D uEnvSharp;
uniform sampler2D uEnvSoft;
uniform float uEnvIntensity;
uniform float uEnvSoftness;
uniform float uIor;
uniform float uDispersion;
uniform float uAbsorption;
uniform float uBounces;
uniform float uSaturation;
uniform float uSparkle;

uniform mat4 uInvModel;
uniform mat3 uModelRot;

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

const float INV_TAU = 0.15915494;
const float INV_PI = 0.31830989;

vec2 dirToEquirect(vec3 dir) {
  vec3 d = normalize(dir);
  return vec2(atan(d.z, d.x) * INV_TAU + 0.5, acos(clamp(d.y, -1.0, 1.0)) * INV_PI);
}

vec3 sampleEnv(vec3 dir) {
  vec2 uv = dirToEquirect(dir);
  vec3 sharp = texture2D(uEnvSharp, uv).rgb;
  vec3 soft = texture2D(uEnvSoft, uv).rgb;
  return mix(sharp, soft, uEnvSoftness) * uEnvIntensity;
}

float fresnelAirGem(float cosTheta, float ior) {
  float sinT2 = (1.0 - cosTheta * cosTheta) / (ior * ior);
  if (sinT2 >= 1.0) return 1.0;
  float cosT = sqrt(1.0 - sinT2);
  float rs = (cosTheta - ior * cosT) / (cosTheta + ior * cosT);
  float rp = (ior * cosTheta - cosT) / (ior * cosTheta + cosT);
  return 0.5 * (rs * rs + rp * rp);
}

float fresnelGemAir(float cosTheta, float ior) {
  float sinT2 = (1.0 - cosTheta * cosTheta) * ior * ior;
  if (sinT2 >= 1.0) return 1.0;
  float cosT = sqrt(1.0 - sinT2);
  float rs = (ior * cosTheta - cosT) / (ior * cosTheta + cosT);
  float rp = (ior * cosT - cosTheta) / (ior * cosT + cosTheta);
  return 0.5 * (rs * rs + rp * rp);
}

vec3 traceInside(vec3 origin, vec3 dir, float ior) {
  vec3 throughput = vec3(1.0);
  vec3 radiance = vec3(0.0);
  bool escaped = false;

  for (int bounce = 0; bounce < MAX_BOUNCES; bounce++) {
    if (float(bounce) >= uBounces) break;

    float best = 1e20;
    vec4 bestPlane = vec4(0.0);

    for (int i = 0; i < MAX_PLANES; i++) {
      if (i >= uPlaneCount) break;
      vec4 plane = uPlanes[i];
      float denom = dot(plane.xyz, dir);
      if (denom < 1e-5) continue;
      float t = (plane.w - dot(plane.xyz, origin)) / denom;
      if (t > 1e-4 && t < best) {
        best = t;
        bestPlane = plane;
      }
    }

    if (best > 1e19) {
      escaped = true;
      break;
    }

    vec3 hit = origin + dir * best;
    vec3 normal = bestPlane.xyz;
    throughput *= exp(-uAbsorption * best * vec3(0.9, 1.0, 1.14));

    float cosTheta = clamp(dot(dir, normal), 0.0, 1.0);
    vec3 refracted = refract(dir, -normal, ior);

    origin = hit - normal * 2e-4;
    dir = normalize(reflect(dir, normal));

    if (dot(refracted, refracted) < 1e-6) continue;

    float f = fresnelGemAir(cosTheta, ior);
    radiance += throughput * (1.0 - f) * sampleEnv(uModelRot * normalize(refracted));
    throughput *= f;
  }

  if (!escaped) radiance += throughput * sampleEnv(uModelRot * dir);

  return radiance;
}

void main() {
  vec3 worldNormal = normalize(vWorldNormal);
  vec3 viewDir = normalize(vWorldPosition - cameraPosition);

  float cosFront = clamp(dot(-viewDir, worldNormal), 0.0, 1.0);
  float frontFresnel = fresnelAirGem(cosFront, uIor);

  vec3 color = sampleEnv(reflect(viewDir, worldNormal)) * frontFresnel;

  vec3 localDir = normalize((uInvModel * vec4(viewDir, 0.0)).xyz);
  vec3 localNormal = normalize((uInvModel * vec4(worldNormal, 0.0)).xyz);
  vec3 localOrigin = (uInvModel * vec4(vWorldPosition, 1.0)).xyz - localNormal * 3e-4;

  vec3 enterDir = refract(localDir, -localNormal, 1.0 / uIor);
  if (dot(enterDir, enterDir) < 1e-6) enterDir = localDir;

  vec3 traced;
  #if DISPERSE
    traced.r = traceInside(localOrigin, normalize(enterDir), uIor - uDispersion * 0.5).r;
    traced.g = traceInside(localOrigin, normalize(enterDir), uIor).g;
    traced.b = traceInside(localOrigin, normalize(enterDir), uIor + uDispersion * 0.5).b;
  #else
    traced = traceInside(localOrigin, normalize(enterDir), uIor);
  #endif

  color += traced * (1.0 - frontFresnel);

  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(vec3(luminance), color, uSaturation);
  color += max(color - 1.0, 0.0) * uSparkle;

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createFacetMaterial(config: TracerConfig): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    defines: {
      MAX_PLANES,
      MAX_BOUNCES: Math.max(3, config.maxBounces),
      DISPERSE: config.dispersionOn ? 1 : 0,
    },
    uniforms: {
      uPlanes: { value: config.planes },
      uPlaneCount: { value: config.planeCount },
      uEnvSharp: { value: config.envSharp },
      uEnvSoft: { value: config.envSoft },
      uEnvIntensity: { value: 1 },
      uEnvSoftness: { value: 0.06 },
      uIor: { value: 2.42 },
      uDispersion: { value: 0.044 },
      uAbsorption: { value: 0.16 },
      uBounces: { value: config.maxBounces },
      uSaturation: { value: 1.28 },
      uSparkle: { value: 0.3 },
      uInvModel: { value: new THREE.Matrix4() },
      uModelRot: { value: new THREE.Matrix3() },
    },
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
    transparent: false,
    depthWrite: true,
  });

  material.name = 'facet-tracer';
  return material;
}

export function setTracerQuality(
  material: THREE.ShaderMaterial,
  maxBounces: number,
  dispersionOn: boolean,
) {
  const defines = material.defines;
  if (
    defines.MAX_BOUNCES === maxBounces &&
    defines.DISPERSE === (dispersionOn ? 1 : 0)
  ) {
    return;
  }
  defines.MAX_BOUNCES = maxBounces;
  defines.DISPERSE = dispersionOn ? 1 : 0;
  material.needsUpdate = true;
}

export function updateTracerUniforms(material: THREE.ShaderMaterial, patch: Record<string, number>) {
  const uniforms = material.uniforms;
  for (const key of Object.keys(patch)) {
    const uniform = uniforms[key];
    if (uniform && typeof uniform.value === 'number') uniform.value = patch[key];
  }
}

export { MAX_PLANES };