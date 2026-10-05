import { wrapEffect } from '@react-three/postprocessing';
import { Effect } from 'postprocessing';
import { type ComponentType, type Ref } from 'react';
import { Uniform } from 'three';

const fragmentShader = /* glsl */ `
uniform float exposure;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * exposure, inputColor.a);
}
`;

export class LinearExposureEffect extends Effect {
  constructor(exposure = 1) {
    super('LinearExposureEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([['exposure', new Uniform(exposure)]]),
    });
  }

  setExposure(value: number) {
    this.uniforms.get('exposure')!.value = value;
  }
}

export const LinearExposure = wrapEffect(LinearExposureEffect) as unknown as ComponentType<{
  args?: number[];
  ref?: Ref<LinearExposureEffect>;
}>;