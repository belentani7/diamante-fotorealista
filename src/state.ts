import { useSyncExternalStore } from 'react';

export type PresetKey = 'baja' | 'media' | 'alta' | 'ultra';

export interface Settings {
  preset: PresetKey;
  dpr: number;
  bounces: number;
  dispersionOn: boolean;
  ior: number;
  dispersion: number;
  envIntensity: number;
  envSoftness: number;
  saturation: number;
  sparkle: number;
  bloom: number;
  vignette: number;
  grain: number;
  exposure: number;
  autoRotate: boolean;
  rotateSpeed: number;
  caustics: boolean;
  sparkles: boolean;
  floorReflections: boolean;
  showStats: boolean;
}

type PresetPatch = Partial<Settings>;

export const PRESETS: Record<PresetKey, PresetPatch> = {
  ultra: {
    dpr: 2,
    bounces: 10,
    dispersionOn: true,
    envSoftness: 0.02,
    saturation: 1.35,
    sparkle: 0.2,
    bloom: 1.15,
  },
  alta: {
    dpr: 1.5,
    bounces: 5,
    dispersionOn: true,
    envSoftness: 0.06,
    saturation: 1.28,
    sparkle: 0.2,
    bloom: 1.0,
  },
  media: {
    dpr: 1,
    bounces: 5,
    dispersionOn: true,
    envSoftness: 0.12,
    saturation: 1.2,
    sparkle: 0.18,
    bloom: 0.85,
  },
  baja: {
    dpr: 0.75,
    bounces: 3,
    dispersionOn: false,
    envSoftness: 0.2,
    saturation: 1.08,
    sparkle: 0.14,
    bloom: 0.7,
  },
};

const DEFAULTS: Settings = {
  preset: 'alta',
  dpr: 1.5,
  bounces: 5,
  dispersionOn: true,
  ior: 2.42,
  dispersion: 0.044,
  envIntensity: 1,
  envSoftness: 0.06,
  saturation: 1.28,
  sparkle: 0.2,
  bloom: 1,
  vignette: 0.85,
  grain: 0.035,
  exposure: 1,
  autoRotate: true,
  rotateSpeed: 1,
  caustics: true,
  sparkles: true,
  floorReflections: true,
  showStats: true,
};

let state: Settings = DEFAULTS;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

export function getSettings(): Settings {
  return state;
}

export function setSettings(patch: Settings | Partial<Settings>) {
  state = { ...state, ...patch };
  emit();
}

export function applyPreset(key: PresetKey) {
  setSettings({ ...PRESETS[key], preset: key });
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}