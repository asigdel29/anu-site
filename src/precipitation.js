// Rain and snow for the live weather: one Points draw call, moved in the vertex shader.

import { BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";

import { windVector } from "./weather.js";

import vertexShader from "./shaders/precipitation/vertex.glsl?raw";
import fragmentShader from "./shaders/precipitation/fragment.glsl?raw";

/** Creates up to `count` drops; setPrecipitation() chooses rain, snow or nothing. */
export function createPrecipitation(count, pixelRatio) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());
    positions.set([Math.cos(angle) * radius, Math.random(), Math.sin(angle) * radius], i * 3);
    seeds[i] = Math.random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  geometry.setDrawRange(0, 0);

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSnow: { value: 0 },
      uWind: { value: { x: 0, y: 0 } },
      uPixelRatio: { value: pixelRatio },
      uMixRatio: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  return { points, material, count };
}

/** Shows rain, snow or nothing; wind (degrees from, mph) tilts the fall. */
export function setPrecipitation({ points, material, count }, { precipitation, windDegrees, windMph }) {
  points.geometry.setDrawRange(0, precipitation === "none" ? 0 : count);
  material.uniforms.uSnow.value = precipitation === "snow" ? 1 : 0;
  material.uniforms.uWind.value = windVector(windDegrees, windMph * 0.02);
}
