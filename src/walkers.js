// Little walkers on the island (New York pigeons, a cat, two agent bots). Each wanders on its
// own: it picks a free spot, steers around props, pauses, and bobs or waddles as it goes.

import {
  Box3,
  BoxGeometry,
  BufferAttribute,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  SphereGeometry,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import vertexShader from "./shaders/walkers/vertex.glsl?raw";
import fragmentShader from "./shaders/walkers/fragment.glsl?raw";

/** Half size of the walkable grass, in metres. */
const BOUND = 2.7;

/** Colours one primitive and moves it into place; glow 1 keeps its colour at night. */
function part(geometry, hex, [x, y, z], { glow = 0, scale = [1, 1, 1], rotateX = 0, rotateZ = 0 } = {}) {
  geometry.scale(...scale);
  if (rotateX) geometry.rotateX(rotateX);
  if (rotateZ) geometry.rotateZ(rotateZ);
  geometry.translate(x, y, z);
  const count = geometry.attributes.position.count;
  // The shader writes colours straight out (sRGB), so keep the hex values as they are.
  const rgb = new Color(hex).convertLinearToSRGB().toArray();
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set(rgb, i * 3);
  geometry.setAttribute("color", new BufferAttribute(colors, 3));
  geometry.setAttribute("aGlow", new BufferAttribute(new Float32Array(count).fill(glow), 1));
  return geometry.toNonIndexed();
}

/** Body plans, all facing +z with feet at y = 0. */
const MODELS = {
  pigeon: () => [
    part(new SphereGeometry(0.13, 10, 8), "#8a8f9c", [0, 0.16, 0], { scale: [0.85, 0.8, 1.25] }),
    part(new SphereGeometry(0.08, 8, 6), "#5d6274", [0, 0.29, 0.13]),
    part(new SphereGeometry(0.075, 8, 6), "#4f7a72", [0, 0.23, 0.1]),
    part(new ConeGeometry(0.025, 0.07, 6), "#e3a14b", [0, 0.29, 0.22], { rotateX: Math.PI / 2 }),
    part(new BoxGeometry(0.12, 0.03, 0.16), "#6b7080", [0, 0.17, -0.2], { rotateX: -0.3 }),
    part(new CylinderGeometry(0.012, 0.012, 0.08), "#d4806a", [0.04, 0.04, 0]),
    part(new CylinderGeometry(0.012, 0.012, 0.08), "#d4806a", [-0.04, 0.04, 0]),
  ],
  cat: () => [
    part(new SphereGeometry(0.16, 10, 8), "#e0904a", [0, 0.24, 0], { scale: [0.8, 0.75, 1.6] }),
    part(new SphereGeometry(0.12, 10, 8), "#e9a160", [0, 0.36, 0.25]),
    part(new ConeGeometry(0.045, 0.09, 4), "#c97a3a", [0.06, 0.48, 0.25]),
    part(new ConeGeometry(0.045, 0.09, 4), "#c97a3a", [-0.06, 0.48, 0.25]),
    part(new CylinderGeometry(0.025, 0.02, 0.32), "#c97a3a", [0, 0.36, -0.3], { rotateX: -0.7 }),
    ...[[0.07, 0.12], [-0.07, 0.12], [0.07, -0.14], [-0.07, -0.14]].map(([x, z]) =>
      part(new CylinderGeometry(0.03, 0.03, 0.16), "#e9a160", [x, 0.08, z])
    ),
  ],
  bot: () => [
    part(new BoxGeometry(0.3, 0.32, 0.24), "#e9eef2", [0, 0.28, 0]),
    part(new BoxGeometry(0.22, 0.14, 0.02), "#1d2330", [0, 0.31, 0.125]),
    part(new BoxGeometry(0.04, 0.04, 0.01), "#5eead4", [0.05, 0.32, 0.137], { glow: 1 }),
    part(new BoxGeometry(0.04, 0.04, 0.01), "#5eead4", [-0.05, 0.32, 0.137], { glow: 1 }),
    part(new CylinderGeometry(0.01, 0.01, 0.12), "#9aa3ae", [0, 0.5, 0]),
    part(new SphereGeometry(0.03, 8, 6), "#f0506e", [0, 0.57, 0], { glow: 1 }),
    part(new CylinderGeometry(0.04, 0.05, 0.12), "#9aa3ae", [0.08, 0.06, 0]),
    part(new CylinderGeometry(0.04, 0.05, 0.12), "#9aa3ae", [-0.08, 0.06, 0]),
  ],
};

/** Walking style per kind: speed (m/s), bob height, waddle angle, step rate, pause odds. */
const GAITS = {
  pigeon: { speed: 0.35, bob: 0.02, waddle: 0.12, steps: 9, pause: 0.5 },
  cat: { speed: 0.45, bob: 0.015, waddle: 0.03, steps: 6, pause: 0.35 },
  bot: { speed: 0.3, bob: 0.03, waddle: 0.15, steps: 5, pause: 0.25 },
};

const CAST = ["pigeon", "pigeon", "pigeon", "cat", "bot", "bot"];

/**
 * Creates the walkers. Obstacles are { x, z, r } circles they keep out of (trunk, props);
 * returns the group to add to the scene and its material (for the night blend).
 */
export function createWalkers(obstacles) {
  const material = new ShaderMaterial({ uniforms: { uMixRatio: { value: 0 } }, vertexShader, fragmentShader });
  const shadowMaterial = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false });
  const shadowGeometry = new CircleGeometry(0.16, 16).rotateX(-Math.PI / 2);
  const geometries = Object.fromEntries(Object.entries(MODELS).map(([kind, build]) => [kind, mergeGeometries(build())]));

  const group = new Group();
  const walkers = CAST.map((kind) => {
    const body = new Mesh(geometries[kind], material);
    const shadow = new Mesh(shadowGeometry, shadowMaterial);
    shadow.position.y = 0.01;
    shadow.scale.setScalar(kind === "cat" ? 1.6 : 1);
    const root = new Group();
    root.add(shadow, body);
    // Larger than life, like the props, so they read at island scale.
    root.scale.setScalar(1.4);
    group.add(root);
    const spot = freeSpot(obstacles);
    root.position.set(spot.x, 0, spot.z);
    return { kind, root, body, gait: GAITS[kind], target: freeSpot(obstacles), pause: Math.random() * 2, phase: Math.random() * 10 };
  });

  return { group, material, walkers, obstacles };
}

/** A circle around a prop at its rest pose, for walkers to keep out of. */
export function obstacleFor(mesh) {
  const box = new Box3().setFromObject(mesh);
  return {
    x: (box.min.x + box.max.x) / 2,
    z: (box.min.z + box.max.z) / 2,
    r: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) / 2,
  };
}

function blocked(x, z, obstacles, margin = 0.15) {
  return Math.abs(x) > BOUND || Math.abs(z) > BOUND || obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + margin);
}

function freeSpot(obstacles) {
  for (let i = 0; i < 50; i++) {
    const x = (Math.random() * 2 - 1) * BOUND;
    const z = (Math.random() * 2 - 1) * BOUND;
    if (!blocked(x, z, obstacles, 0.3)) return { x, z };
  }
  return { x: BOUND - 0.3, z: BOUND - 0.3 };
}

/** Moves every walker one frame: turn toward the target, step, pause on arrival. */
export function stepWalkers({ walkers, obstacles }, delta) {
  for (const walker of walkers) {
    const { root, body, gait } = walker;
    walker.phase += delta * gait.steps;
    if (walker.pause > 0) {
      walker.pause -= delta;
      // Pigeons peck while they wait; everyone settles their bob.
      body.rotation.x = walker.kind === "pigeon" ? Math.max(0, Math.sin(walker.phase * 0.7)) * 0.5 : 0;
      body.position.y = 0;
      body.rotation.z = 0;
      continue;
    }

    const dx = walker.target.x - root.position.x;
    const dz = walker.target.z - root.position.z;
    const goal = Math.atan2(dx, dz);
    const offset = goal - root.rotation.y;
    const turn = Math.atan2(Math.sin(offset), Math.cos(offset));
    root.rotation.y += Math.max(-delta * 3, Math.min(delta * 3, turn));

    const step = gait.speed * delta;
    const nextX = root.position.x + Math.sin(root.rotation.y) * step;
    const nextZ = root.position.z + Math.cos(root.rotation.y) * step;
    if (blocked(nextX, nextZ, obstacles)) {
      walker.target = freeSpot(obstacles);
    } else {
      root.position.x = nextX;
      root.position.z = nextZ;
    }

    body.position.y = Math.abs(Math.sin(walker.phase)) * gait.bob;
    body.rotation.z = Math.sin(walker.phase) * gait.waddle;
    body.rotation.x = 0;

    if (Math.hypot(dx, dz) < 0.15) {
      walker.target = freeSpot(obstacles);
      if (Math.random() < gait.pause) walker.pause = 1 + Math.random() * 3;
    }
  }
}
