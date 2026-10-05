import { Canvas } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { Scene } from './scene/Scene';
import { useSettings } from './state';
import { Overlay } from './ui/Overlay';

function useSceneReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 260);
    return () => window.clearTimeout(id);
  }, []);
  return ready;
}

export default function App() {
  const settings = useSettings();
  const ready = useSceneReady();

  useEffect(() => {
    const boot = document.getElementById('boot');
    if (!boot) return;
    boot.setAttribute('data-hidden', ready ? 'true' : 'false');
  }, [ready]);

  return (
    <>
      <Canvas
        dpr={settings.dpr}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.NoToneMapping,
          preserveDrawingBuffer: true,
        }}
        camera={{ position: [0, 1.0, 4.4], fov: 32, near: 0.1, far: 120 }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#04060a'), 1);
        }}
      >
        <Scene />
      </Canvas>
      <Overlay />
    </>
  );
}