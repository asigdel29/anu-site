// Falling cherry blossom petals: one Points draw call, moved entirely in the vertex shader.

import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";

import vertexShader from "./shaders/petals/vertex.glsl?raw";
import fragmentShader from "./shaders/petals/fragment.glsl?raw";

/**
 * Creates `count` petals. Each starts at a random point in a unit disc with a random
 * phase; the shader turns that into a looping fall, so the CPU only updates uTime.
 */
export function createPetals(count, pixelRatio) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random());
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.random();
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    seeds[i] = Math.random();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));

  const material = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTop: { value: 5 },
      uFall: { value: 9 },
      uRadius: { value: 4 },
      // ponytail: size and speed are eyeballed; tune on real phones.
      uSize: { value: 220 },
      uPixelRatio: { value: pixelRatio },
      uMixRatio: { value: 0 },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
  });

  const points = new Points(geometry, material);
  // The shader moves every point, so the attribute bounds say nothing about where petals are.
  points.frustumCulled = false;
  return { points, material };
}

/** Spawns petals inside the canopy and lets them fall about 4 m below the grass. */
export function fitPetalsToCanopy({ points, material }, canopy) {
  const box = new Box3().setFromObject(canopy);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  points.position.set(center.x, 0, center.z);
  material.uniforms.uTop.value = center.y;
  material.uniforms.uFall.value = center.y + 4;
  material.uniforms.uRadius.value = (Math.max(size.x, size.z) / 2) * 0.9;
}
