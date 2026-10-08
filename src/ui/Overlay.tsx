import { useEffect, useRef, useState } from 'react';
import { getBrilliantCut } from '../diamond/brilliantCut';
import { applyPreset, setSettings, useSettings, type PresetKey, type Settings } from '../state';

const PRESET_LABELS: { key: PresetKey; label: string }[] = [
  { key: 'baja', label: 'Bajo' },
  { key: 'media', label: 'Medio' },
  { key: 'alta', label: 'Alto' },
  { key: 'ultra', label: 'Ultra' },
];

function FpsMeter() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let raf = 0;

    const tick = () => {
      frame++;
      const now = performance.now();
      if (now - last >= 500) {
        const fps = (frame * 1000) / (now - last);
        if (ref.current) ref.current.textContent = `${fps.toFixed(0)} fps`;
        frame = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <span ref={ref}>-- fps</span>;
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="control">
      <span className="control__row">
        <span className="control__label">{label}</span>
        <span className="control__value">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Toggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`toggle${active ? ' toggle--on' : ''}`}
      onClick={onToggle}
      aria-pressed={active}
    >
      <span className="toggle__dot" />
      {label}
    </button>
  );
}

function Panel({
  title,
  children,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={`panel${compact ? ' panel--compact' : ''}`}>
      <h2 className="panel__title">{title}</h2>
      {children}
    </section>
  );
}

export function Overlay() {
  const settings = useSettings();
  const [panelVisible, setPanelVisible] = useState(true);
  const { metrics, counts, planeCount } = getBrilliantCut();
  const patch = (values: Partial<Settings>) => setSettings(values);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, button, a, [contenteditable]')) return;
      const map: Record<string, PresetKey> = { '1': 'baja', '2': 'media', '3': 'alta', '4': 'ultra' };
      if (map[event.key]) applyPreset(map[event.key]);
      if (event.key === ' ') {
        event.preventDefault();
        setSettings({ autoRotate: !settings.autoRotate });
      }
      if (event.key.toLowerCase() === 'h') setPanelVisible(value => !value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settings.autoRotate]);

  return (
    <div className="ui">
      <header className="ui__header">
        <div className="ui__brand">
          <span className="ui__mark" />
          <div>
            <h1>Diamante · estudio optico</h1>
            <p>
              Corte brillante de {counts.table + counts.star + counts.kite + counts.upper + counts.main + counts.lower}{' '}
              facetas · {planeCount} planos trazado
            </p>
          </div>
        </div>
        <button type="button" className="toggle" aria-controls="optical-controls" aria-expanded={panelVisible} onClick={() => setPanelVisible(value => !value)}>
          {panelVisible ? 'Ocultar controles' : 'Mostrar controles'}
        </button>
        {settings.showStats && (
          <div className="ui__stats">
            <FpsMeter />
            <span>{metrics.tablePct.toFixed(1)}% mesa</span>
            <span>{metrics.crownAngle.toFixed(1)}° corona</span>
            <span>{metrics.pavilionAngle.toFixed(1)}° pavilion</span>
            <span>{metrics.depthPct.toFixed(1)}% profundidad</span>
          </div>
        )}
      </header>

      <div id="optical-controls" className="panels" hidden={!panelVisible}>
        <Panel title="Calidad">
        <div className="presets">
          {PRESET_LABELS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`preset${settings.preset === key ? ' preset--on' : ''}`}
              onClick={() => applyPreset(key)}
              aria-pressed={settings.preset === key}
            >
              {label}
            </button>
          ))}
        </div>
        <Slider
          label="Rebotes"
          value={settings.bounces}
          min={1}
          max={12}
          step={1}
          format={(value) => String(value)}
          onChange={(bounces) => patch({ bounces })}
        />
        <div className="toggles">
          <Toggle
            label="Dispersion RGB"
            active={settings.dispersionOn}
            onToggle={() => patch({ dispersionOn: !settings.dispersionOn })}
          />
        </div>
      </Panel>

      <Panel title="Optica">
        <Slider
          label="Indice de refraccion"
          value={settings.ior}
          min={1.6}
          max={3}
          step={0.005}
          format={(value) => value.toFixed(3)}
          onChange={(ior) => patch({ ior })}
        />
        <Slider
          label="Dispersion"
          value={settings.dispersion}
          min={0}
          max={0.12}
          step={0.002}
          format={(value) => value.toFixed(3)}
          onChange={(dispersion) => patch({ dispersion })}
        />
        <Slider
          label="Saturacion"
          value={settings.saturation}
          min={1}
          max={2}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(saturation) => patch({ saturation })}
        />
        <Slider
          label="Dureza del entorno"
          value={settings.envSoftness}
          min={0}
          max={0.6}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(envSoftness) => patch({ envSoftness })}
        />
        <Slider
          label="Intensidad del entorno"
          value={settings.envIntensity}
          min={0.3}
          max={2}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(envIntensity) => patch({ envIntensity })}
        />
      </Panel>

      <Panel title="Escena">
        <Slider
          label="Exposicion"
          value={settings.exposure}
          min={0.35}
          max={2.4}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(exposure) => patch({ exposure })}
        />
        <Slider
          label="Rotacion"
          value={settings.rotateSpeed}
          min={0}
          max={3}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(rotateSpeed) => patch({ rotateSpeed })}
        />
        <Slider
          label="Bloom"
          value={settings.bloom}
          min={0}
          max={2.5}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(bloom) => patch({ bloom })}
        />
        <Slider
          label="Grano"
          value={settings.grain}
          min={0}
          max={0.15}
          step={0.005}
          format={(value) => value.toFixed(3)}
          onChange={(grain) => patch({ grain })}
        />
        <Slider
          label="Vineta"
          value={settings.vignette}
          min={0}
          max={1.4}
          step={0.01}
          format={(value) => value.toFixed(2)}
          onChange={(vignette) => patch({ vignette })}
        />
        <div className="toggles">
          <Toggle
            label="Rotar"
            active={settings.autoRotate}
            onToggle={() => patch({ autoRotate: !settings.autoRotate })}
          />
          <Toggle
            label="Causticas"
            active={settings.caustics}
            onToggle={() => patch({ caustics: !settings.caustics })}
          />
          <Toggle
            label="Destellos"
            active={settings.sparkles}
            onToggle={() => patch({ sparkles: !settings.sparkles })}
          />
          <Toggle
            label="Suelo espejo"
            active={settings.floorReflections}
            onToggle={() => patch({ floorReflections: !settings.floorReflections })}
          />
        </div>
      </Panel>
      </div>

      <footer className="ui__hint">
        1-4 calidad · espacio rotacion · H ocultar panel · arrastrar orbitar · rueda zoom
      </footer>
    </div>
  );
}
