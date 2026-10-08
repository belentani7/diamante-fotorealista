import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getSettings } from '../state';
import { getStudioEnv } from '../scene/studioEnv';
import { getBrilliantCut } from './brilliantCut';
import { createFacetMaterial, setTracerQuality, updateTracerUniforms } from './facetTracer';

export function Diamond() {
  const meshRef = useRef<THREE.Mesh>(null);
  const cut = useMemo(() => getBrilliantCut(), []);
  const env = useMemo(() => getStudioEnv(), []);
  const material = useMemo(
    () =>
      createFacetMaterial({
        planes: cut.planes,
        planeCount: cut.planeCount,
        envSharp: env.sharp,
        envSoft: env.soft,
        maxBounces: getSettings().bounces,
        dispersionOn: getSettings().dispersionOn,
      }),
    [cut, env],
  );

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const settings = getSettings();
    if (settings.autoRotate) {
      mesh.rotation.y += delta * 0.3 * settings.rotateSpeed;
      mesh.rotation.x = -0.14 + Math.sin(clock.elapsedTime * 0.24) * 0.045;
    }

    mesh.updateMatrixWorld();

    const uniforms = material.uniforms;
    (uniforms.uInvModel.value as THREE.Matrix4).copy(mesh.matrixWorld).invert();
    (uniforms.uModelRot.value as THREE.Matrix3).setFromMatrix4(mesh.matrixWorld);

    setTracerQuality(material, settings.bounces, settings.dispersionOn);
    updateTracerUniforms(material, {
      ior: settings.ior,
      uDispersion: settings.dispersion,
      uBounces: settings.bounces,
      uEnvIntensity: settings.envIntensity,
      uEnvSoftness: settings.envSoftness,
      uSaturation: settings.saturation,
      uSparkle: settings.sparkle,
    });
  });

  return <mesh ref={meshRef} geometry={cut.geometry} material={material} />;
}
