import { useFrame, useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { Diamond } from '../diamond/Diamond';
import { useSettings } from '../state';
import { Atmosphere } from './Atmosphere';
import { Ground } from './Ground';
import { LinearExposure, type LinearExposureEffect } from './LinearExposure';

const MIN_DPR = 0.5;
const TARGET_FPS = 42;
const HEADROOM_FPS = 58;
const SAMPLE_FRAMES = 24;

export function Scene() {
  const settings = useSettings();
  const aberration = useMemo(() => new THREE.Vector2(0.00042, 0.00062), []);
  const setDpr = useThree((state) => state.setDpr);
  const liveDpr = useThree((state) => state.viewport.dpr);
  const exposureRef = useRef<LinearExposureEffect | null>(null);

  const maxDpr = settings.dpr;
  const maxDprRef = useRef(maxDpr);
  maxDprRef.current = maxDpr;
  const dprRef = useRef(liveDpr);
  dprRef.current = liveDpr;
  const windowRef = useRef({ frames: 0, seconds: 0 });

  useFrame((_, delta) => {
    const sample = windowRef.current;
    sample.frames++;
    sample.seconds += Math.min(delta, 0.5);
    if (sample.frames < SAMPLE_FRAMES) return;

    const fps = sample.frames / sample.seconds;
    sample.frames = 0;
    sample.seconds = 0;

    const current = dprRef.current;
    let next = current;
    if (fps < TARGET_FPS) next = current - 0.15;
    else if (fps > HEADROOM_FPS) next = current + 0.1;
    next = Math.min(maxDprRef.current, Math.max(MIN_DPR, Math.round(next * 20) / 20));

    if (Math.abs(next - current) > 1e-3) setDpr(next);
  });

  useEffect(() => {
    exposureRef.current?.setExposure(settings.exposure);
  }, [settings.exposure]);

  return (
    <>
      <Atmosphere />
      <Ground />
      <Diamond />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.62}
        minDistance={2.3}
        maxDistance={9}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.02}
        target={[0, 0.1, 0]}
      />

      <EffectComposer multisampling={2} enableNormalPass={false}>
        <LinearExposure ref={exposureRef} args={[1]} />
        <Bloom
          mipmapBlur
          intensity={settings.bloom}
          luminanceThreshold={1}
          luminanceSmoothing={0.2}
          radius={0.72}
        />
        <ChromaticAberration
          offset={aberration}
          radialModulation
          modulationOffset={0.42}
        />
        <Vignette offset={0.26} darkness={settings.vignette} eskil={false} />
        <Noise opacity={settings.grain} premultiply blendFunction={BlendFunction.OVERLAY} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}