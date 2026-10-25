// Clouds that drift around the island on their own: one instanced draw call of puffs,
// moved by the vertex shader. Weather sets the wind, the cover and the gloom.

import {
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from "three";

import { windVector } from "./weather.js";
import vertexShader from "./shaders/clouds/vertex.glsl?raw";
import fragmentShader from "./shaders/clouds/fragment.glsl?raw";

const MAX_CLOUDS = 12;
const PUFFS_PER_CLOUD = 6;
const FIELD = 45;

/** Small seeded random, so every visit shows the same sky layout. */
function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Builds the cloud field. Lanes keep at least 9 m from the island's centre line. */
export function createClouds() {
  const random = seeded(29);
  const cloudData = new Float32Array(MAX_CLOUDS * PUFFS_PER_CLOUD * 4);
  const puffData = new Float32Array(MAX_CLOUDS * PUFFS_PER_CLOUD * 4);

  for (let cloud = 0; cloud < MAX_CLOUDS; cloud++) {
    const start = (random() * 2 - 1) * FIELD;
    const lane = (random() < 0.5 ? -1 : 1) * (9 + random() * 24);
    const height = -8 + random() * 17;
    const seed = random();
    const scale = 0.8 + random() * 0.7;
    for (let puff = 0; puff < PUFFS_PER_CLOUD; puff++) {
      const i = (cloud * PUFFS_PER_CLOUD + puff) * 4;
      cloudData.set([start, lane, height, seed], i);
      const along = (puff / (PUFFS_PER_CLOUD - 1) - 0.5) * 3.4 * scale;
      // Middle puffs sit higher and bigger, giving the classic cumulus hump.
      const hump = 1 - Math.abs(puff / (PUFFS_PER_CLOUD - 1) - 0.5) * 2;
      puffData.set([along, hump * 0.6 * scale, (random() - 0.5) * 1.2, (0.7 + hump * 0.6) * scale], i);
    }
  }

  const geometry = new InstancedBufferGeometry().copy(new IcosahedronGeometry(1, 2));
  geometry.setAttribute("aCloud", new InstancedBufferAttribute(cloudData, 4));
  geometry.setAttribute("aPuff", new InstancedBufferAttribute(puffData, 4));
  geometry.instanceCount = 0;

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uWind: { value: { x: 1, y: 0 } },
      uSpeed: { value: 0.8 },
      uField: { value: FIELD },
      uMixRatio: { value: 0 },
      uGloom: { value: 0 },
    },
    vertexShader,
    fragmentShader,
  });

  const mesh = new Mesh(geometry, material);
  // The shader places every puff, so the base geometry bounds say nothing useful.
  mesh.frustumCulled = false;
  const clouds = { mesh, material };
  setCloudWeather(clouds, { cover: 0.5, windDegrees: 270, windMph: 5, gloom: 0 });
  return clouds;
}

/**
 * Applies weather to the clouds: cover 0..1 sets how many clouds exist, wind (direction it
 * blows from, in degrees, and speed in mph) sets their drift, gloom 0..1 greys them.
 */
export function setCloudWeather({ mesh, material }, { cover, windDegrees, windMph, gloom }) {
  const visible = Math.round(Math.min(Math.max(cover, 0), 1) * MAX_CLOUDS);
  mesh.geometry.instanceCount = Math.max(visible, 2) * PUFFS_PER_CLOUD;
  material.uniforms.uWind.value = windVector(windDegrees, 1);
  material.uniforms.uSpeed.value = 0.4 + windMph * 0.12;
  material.uniforms.uGloom.value = gloom;
}
