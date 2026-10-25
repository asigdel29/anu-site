// Clouds that drift around the island on their own: one instanced draw call of puffs,
// moved by the vertex shader. Weather sets the wind, the cover and the gloom.

import {
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from "three";

import { seeded } from "./random.js";
import { windVector } from "./weather.js";
import vertexShader from "./shaders/clouds/vertex.glsl?raw";
import fragmentShader from "./shaders/clouds/fragment.glsl?raw";

const MAX_CLOUDS = 18;
const PUFFS_PER_CLOUD = 10;
const FIELD = 45;
/** Clouds that show even on a clear day: five around the island and five over the city. */
const MIN_CLOUDS = 10;
/** Every second cloud drifts low over the city, between the rooftops and the island (the shader also flattens it). */
const LOW_EVERY = 2;

/**
 * Builds the cloud field. Puffy clouds drift on lanes at least 9 m from the island's centre
 * line; every second cloud is a big flat one 13 to 21 m below the island, above most rooftops (the
 * street is 40 m down), so only the towers rise through it. Each
 * cloud is a row of puffs with a few more on top, the classic cumulus shape.
 */
export function createClouds() {
  const random = seeded(29);
  const cloudData = new Float32Array(MAX_CLOUDS * PUFFS_PER_CLOUD * 4);
  const puffData = new Float32Array(MAX_CLOUDS * PUFFS_PER_CLOUD * 4);

  for (let cloud = 0; cloud < MAX_CLOUDS; cloud++) {
    const low = cloud % LOW_EVERY === LOW_EVERY - 1;
    const start = (random() * 2 - 1) * FIELD;
    const lane = (random() < 0.5 ? -1 : 1) * (low ? 10 + random() * 40 : 9 + random() * 24);
    const height = low ? -13 - random() * 8 : -8 + random() * 17;
    const seed = random();
    const scale = low ? 2.2 + random() * 1.0 : 0.8 + random() * 0.7;
    for (let puff = 0; puff < PUFFS_PER_CLOUD; puff++) {
      const i = (cloud * PUFFS_PER_CLOUD + puff) * 4;
      cloudData.set([start, lane, height, seed], i);
      if (puff < 7) {
        // The base row: middle puffs sit higher and bigger, giving the hump.
        const hump = 1 - Math.abs(puff / 6 - 0.5) * 2;
        const along = ((puff / 6 - 0.5) * 3.6 + (random() - 0.5) * 0.4) * scale;
        puffData.set([along, hump * 0.5 * scale, (random() - 0.5) * 1.4 * scale, (0.6 + hump * 0.6) * scale], i);
      } else {
        // Top puffs: the cauliflower crown.
        puffData.set([(random() - 0.5) * 1.6 * scale, (0.7 + random() * 0.4) * scale, (random() - 0.5) * 0.8 * scale, (0.55 + random() * 0.3) * scale], i);
      }
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
  mesh.geometry.instanceCount = Math.max(visible, MIN_CLOUDS) * PUFFS_PER_CLOUD;
  material.uniforms.uWind.value = windVector(windDegrees, 1);
  material.uniforms.uSpeed.value = 0.4 + windMph * 0.12;
  material.uniforms.uGloom.value = gloom;
}
