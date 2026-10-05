import * as THREE from 'three';

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas');
  element.width = size;
  element.height = size;
  const context = element.getContext('2d');
  if (!context) throw new Error('Canvas 2D no disponible');
  return [element, context];
}

export function radialTexture(size = 256): THREE.CanvasTexture {
  const [element, context] = canvas(size);
  const half = size / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function starFlareTexture(size = 512): THREE.CanvasTexture {
  const [element, context] = canvas(size);
  const half = size / 2;

  const glow = context.createRadialGradient(half, half, 0, half, half, half * 0.42);
  glow.addColorStop(0, 'rgba(255,255,255,0.95)');
  glow.addColorStop(0.3, 'rgba(214,232,255,0.4)');
  glow.addColorStop(1, 'rgba(180,210,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);

  context.globalCompositeOperation = 'lighter';
  const spike = (length: number, width: number, alpha: number) => {
    const gradient = context.createLinearGradient(half - length, half, half + length, half);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.save();
    context.translate(half, half);
    context.scale(1, width);
    context.translate(-half, -half);
    context.fillStyle = gradient;
    context.beginPath();
    context.ellipse(half, half, length, length * width, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  spike(half * 0.98, 0.012, 0.95);
  spike(half * 0.62, 0.02, 0.5);
  context.translate(half, half);
  context.rotate(Math.PI / 4);
  context.translate(-half, -half);
  spike(half * 0.4, 0.03, 0.32);
  spike(half * 0.22, 0.05, 0.18);

  const texture = new THREE.CanvasTexture(element);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}