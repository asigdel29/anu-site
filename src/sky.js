// The sky dome: a gradient from the horizon colour (the scene sky, which the city haze also
// fades to) up to a deeper blue overhead, a soft glow around the sun, and stars at night.
// One draw call behind everything; it follows the camera's rotation only, so it never moves.

import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from "three";

import vertexShader from "./shaders/sky/vertex.glsl?raw";
import fragmentShader from "./shaders/sky/fragment.glsl?raw";

/** Colours straight overhead (sRGB), for day and night; bad weather fades them toward the horizon. */
const ZENITH = { day: new Color("#2D6FE0"), night: new Color("#0A0A2E") };

/** Builds the dome. Its uniforms follow the theme blend and the horizon colour (see paintSkyDome). */
export function createSkyDome() {
  const material = new ShaderMaterial({
    uniforms: {
      uHorizon: { value: new Color() },
      uZenith: { value: new Color() },
      uMixRatio: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    side: BackSide,
    depthWrite: false,
  });
  const mesh = new Mesh(new SphereGeometry(1, 32, 16), material);
  mesh.name = "sky";
  // The shader puts the dome on the far plane around the camera, so bounds and order mean nothing.
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  return { mesh, material };
}

/**
 * Sets the dome's colours: horizon is the scene sky (linear), mix the day-night blend and gloom
 * the weather's gloom (0 to 1), which flattens the gradient toward the horizon colour.
 */
export function paintSkyDome({ material }, horizon, mix, gloom) {
  const { uHorizon, uZenith, uMixRatio } = material.uniforms;
  uHorizon.value.copy(horizon).convertLinearToSRGB();
  uZenith.value.lerpColors(ZENITH.day, ZENITH.night, mix).lerp(uHorizon.value, gloom * 0.8);
  uMixRatio.value = mix;
}
