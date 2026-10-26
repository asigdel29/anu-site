// Falling cherry blossom petals: one Points draw call, moved entirely in the vertex shader, so the
// CPU only sets uniforms. Petals start inside the canopy, tumble down past the island and drift
// with the live wind.

import { Box3, BufferAttribute, BufferGeometry, Points, ShaderMaterial, Vector3 } from "three";

import { seeded } from "./random.js";
import { windVector } from "./weather.js";
import vertexShader from "./shaders/petals/vertex.glsl?raw";
import fragmentShader from "./shaders/petals/fragment.glsl?raw";

/** How far, in metres, petals fall below the canopy centre before they loop back up. */
const FALL_BELOW = 12;
/** Petal drift per metre of fall, per mph of wind. */
const DRIFT_PER_MPH = 0.012;

/**
 * Creates count petals. Each starts at a point in a unit disc with its own phase and seed; the
 * shader turns that into a looping, tumbling fall.
 */
export function createPetals(count, pixelRatio) {
  const random = seeded(7);
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random());
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = random();
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    seeds[i] = random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: 5 },
      uFall: { value: 17 },
      uRadius: { value: 4 },
      // ponytail: size is tuned by eye at the tour's close stops; retune if the props change scale.
      uSize: { value: 150 },
      uPixelRatio: { value: pixelRatio },
      uMixRatio: { value: 0 },
      uWind: { value: { x: 0, y: 0 } },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  points.name = "petals";
  // The shader moves every point, so the attribute bounds say nothing about where petals are.
  points.frustumCulled = false;
  return { points, material };
}

/** Spawns the petals inside the canopy's bounds (from the mesh pack) and lets them fall below the island. */
export function fitPetalsToCanopy({ points, material }, canopy) {
  const box = new Box3().setFromObject(canopy);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());
  points.position.set(center.x, 0, center.z);
  material.uniforms.uTop.value = center.y;
  material.uniforms.uFall.value = center.y + FALL_BELOW;
  material.uniforms.uRadius.value = (Math.max(size.x, size.z) / 2) * 0.9;
}

/** Lets the live wind carry the petals: wind (from, degrees) and speed (mph). */
export function setPetalWind({ material }, { windDegrees, windMph }) {
  material.uniforms.uWind.value = windVector(windDegrees, windMph * DRIFT_PER_MPH);
}
