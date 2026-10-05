import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSettings } from '../state';
import { starFlareTexture } from './textures';

const backdropVertex = /* glsl */ `
varying vec3 vDir;

void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const backdropFragment = /* glsl */ `
varying vec3 vDir;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(21.98, 78.233))) * 43758.5453);
}

void main() {
  float h = vDir.y;
  vec3 top = vec3(0.006, 0.009, 0.018);
  vec3 mid = vec3(0.028, 0.038, 0.068);
  vec3 bottom = vec3(0.003, 0.004, 0.008);

  vec3 color = h > 0.0 ? mix(mid, top, pow(h, 0.65)) : mix(mid, bottom, pow(-h, 0.5));

  vec2 centered = vec2(vDir.x, vDir.y - 0.16);
  float glow = exp(-dot(centered, centered) * 3.2);
  color += vec3(0.052, 0.072, 0.115) * glow;

  color += (hash(gl_FragCoord.xy) - 0.5) * 0.0045;

  gl_FragColor = vec4(color, 1.0);
}
`;

function Backdrop() {
  const uniforms = useMemo(() => ({}), []);
  return (
    <mesh scale={40}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        vertexShader={backdropVertex}
        fragmentShader={backdropFragment}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}

interface FlareConfig {
  position: [number, number, number];
  size: number;
  phase: number;
  speed: number;
}

const FLARES: FlareConfig[] = [
  { position: [-1.05, 0.92, 0.55], size: 0.95, phase: 0.0, speed: 0.7 },
  { position: [1.24, 0.5, 0.28], size: 0.72, phase: 1.9, speed: 0.53 },
  { position: [0.42, 1.16, -0.85], size: 0.62, phase: 3.4, speed: 0.61 },
  { position: [-0.78, -0.34, 0.82], size: 0.5, phase: 5.1, speed: 0.44 },
  { position: [0.1, -0.72, -0.66], size: 0.42, phase: 2.4, speed: 0.58 },
];

function Flare({ config, texture }: { config: FlareConfig; texture: THREE.Texture }) {
  const sprite = useRef<THREE.Sprite>(null);
  const materialRef = useRef<THREE.SpriteMaterial>(null);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    const t = clock.elapsedTime * config.speed + config.phase;
    const pulse = Math.pow(Math.max(0, Math.sin(t)), 6);
    material.opacity = 0.12 + pulse * 0.88;
    const sprite3d = sprite.current;
    if (sprite3d) {
      const scale = config.size * (0.7 + pulse * 0.7);
      sprite3d.scale.set(scale, scale, 1);
    }
  });

  return (
    <sprite ref={sprite} position={config.position} renderOrder={3}>
      <spriteMaterial
        ref={materialRef}
        map={texture}
        color="#e6f0ff"
        transparent
        opacity={0.2}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  );
}

function Flares() {
  const texture = useMemo(() => starFlareTexture(512), []);
  return (
    <group>
      {FLARES.map((config, index) => (
        <Flare key={index} config={config} texture={texture} />
      ))}
    </group>
  );
}

export function Atmosphere() {
  const settings = useSettings();
  return (
    <group>
      <Backdrop />
      {settings.sparkles && (
        <>
          <Sparkles
            count={70}
            scale={[7, 4, 7]}
            position={[0, 0.6, 0]}
            size={2.6}
            speed={0.28}
            opacity={0.45}
            noise={1.2}
            color="#cfe0ff"
          />
          <Flares />
        </>
      )}
    </group>
  );
}