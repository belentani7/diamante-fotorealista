import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSettings } from '../state';
import { getStudioEnv } from './studioEnv';
import { radialTexture } from './textures';

const causticVertex = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const causticFragment = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform float uPetals;
uniform float uScale;
uniform vec3 uColorCore;
uniform vec3 uColorEdge;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float cell(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float causticPattern(vec2 p, float t) {
  float value = 0.0;
  for (int i = 0; i < 3; i++) {
    float f = float(i);
    vec2 q = p * (1.0 + f * 0.62) + vec2(t * 0.16 * (1.0 + f), -t * 0.11 * (1.0 + f));
    float c = cell(q);
    value += pow(1.0 - abs(c - 0.5) * 2.0, 6.0) / (1.0 + f);
  }
  return value;
}

void main() {
  vec2 centered = (vUv - 0.5) * 2.0;
  float radius = length(centered);
  float theta = atan(centered.y, centered.x);

  float petal = 0.6 + 0.4 * cos(theta * uPetals + uTime * 0.22);
  float pattern = causticPattern(centered * uScale, uTime) * petal;
  pattern *= smoothstep(1.0, 0.04, radius);
  pattern += smoothstep(0.32, 0.0, radius) * 0.42;

  vec3 color = mix(uColorEdge, uColorCore, clamp(pattern * 0.7, 0.0, 1.0));
  gl_FragColor = vec4(color * pattern * uIntensity, 1.0);
}
`;

function Caustics() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uIntensity: { value: 0.75 },
      uPetals: { value: 8 },
      uScale: { value: 4.2 },
      uColorCore: { value: new THREE.Color('#dfe9ff') },
      uColorEdge: { value: new THREE.Color('#6fa8ff') },
    }),
    [],
  );

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.elapsedTime;
  });

  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={2}>
      <circleGeometry args={[3.6, 128]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={causticVertex}
        fragmentShader={causticFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function ContactPool() {
  const texture = useMemo(() => radialTexture(256), []);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.003} renderOrder={1}>
      <circleGeometry args={[2.1, 96]} />
      <meshBasicMaterial
        map={texture}
        color="#9fc4ff"
        transparent
        opacity={0.17}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function ContactShadow() {
  const texture = useMemo(() => radialTexture(256), []);
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.001}>
      <circleGeometry args={[1.5, 96]} />
      <meshBasicMaterial map={texture} color="#000000" transparent opacity={0.72} depthWrite={false} />
    </mesh>
  );
}

export function Ground() {
  const env = useMemo(() => getStudioEnv(), []);
  const floorEnv = useMemo(() => {
    const clone = env.sharp.clone();
    clone.mapping = THREE.EquirectangularReflectionMapping;
    clone.needsUpdate = true;
    return clone;
  }, [env]);

  const settings = useSettings();

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[14, 128]} />
        <meshStandardMaterial
          color="#070a11"
          metalness={1}
          roughness={settings.floorReflections ? 0.08 : 0.62}
          envMap={floorEnv}
          envMapIntensity={0.65}
        />
      </mesh>
      <ContactShadow />
      {settings.caustics && (
        <>
          <ContactPool />
          <Caustics />
        </>
      )}
    </group>
  );
}