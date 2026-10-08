import { Canvas } from '@react-three/fiber';
import { Component, useEffect, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { Scene } from './scene/Scene';
import { applyPreset, setSettings, useSettings } from './state';
import { Overlay } from './ui/Overlay';

function StaticDiamond() {
  return <div className="scene-fallback" role="img" aria-label="Diamante tallado, vista estática">
    <svg viewBox="0 0 300 260" aria-hidden="true">
      <path d="M65 45h170l48 60-133 137L17 105z" fill="#b9d8fc" stroke="#edf4ff" strokeWidth="2" />
      <path d="M17 105h266M65 45l35 60 50 137 50-137 35-60M100 105l50-60 50 60" fill="none" stroke="#516886" strokeWidth="2" />
    </svg>
    <p>Vista estática · la escena 3D no está disponible en este dispositivo.</p>
  </div>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <StaticDiamond /> : this.props.children; }
}

export default function App() {
  const settings = useSettings();
  useEffect(() => {
    if (window.innerWidth < 820 || navigator.hardwareConcurrency <= 4) applyPreset('baja');
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const respectMotion = () => {
      if (preference.matches) setSettings({ autoRotate: false, sparkles: false, caustics: false });
    };
    respectMotion();
    preference.addEventListener('change', respectMotion);
    return () => preference.removeEventListener('change', respectMotion);
  }, []);
  const [contextLost, setContextLost] = useState(false);

  return (
    <>
      <SceneBoundary>
      {contextLost ? <StaticDiamond /> : <Canvas
        fallback={<StaticDiamond />}
        aria-label="Diamante interactivo. Arrastra para orbitar y usa los controles de óptica."
        dpr={settings.dpr}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.NoToneMapping,
          preserveDrawingBuffer: false,
        }}
        camera={{ position: [0, 1.0, 4.4], fov: 32, near: 0.1, far: 120 }}
        onCreated={({ gl }) => {
          gl.setClearColor(new THREE.Color('#04060a'), 1);
          gl.domElement.addEventListener('webglcontextlost', () => setContextLost(true), { once: true });
        }}
      >
        <Scene />
      </Canvas>}
      </SceneBoundary>
      <Overlay />
    </>
  );
}
