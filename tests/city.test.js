// Checks the city layout: same city on every visit, nothing in the park, the rivers or the
// camera's path, and a building count the GPU and the worker can carry.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BOROUGH_EDGE,
  CAMERA_CLEARANCE,
  LANDMARKS,
  LOW_RISE_LIMIT,
  PARK_WATER,
  inPark,
  layoutLights,
  layoutTrees,
  layoutCity,
  manhattanHalfWidth,
  packCity,
} from "../src/city.js";

const buildings = layoutCity();

test("the layout is the same on every visit", () => {
  assert.deepEqual(layoutCity(), buildings);
});

test("the building count stays inside the budget", () => {
  assert.ok(buildings.length > 3000 && buildings.length < 12000, `${buildings.length} buildings`);
});

test("no building stands in Central Park or in a river", () => {
  for (const b of buildings) {
    assert.ok(!inPark(b.x, b.z), `building in the park at ${b.x}, ${b.z}`);
    const halfWidth = b.width / 2;
    const inManhattan = Math.abs(b.x) + halfWidth <= manhattanHalfWidth(b.z) + 0.5;
    const inBorough = Math.abs(b.x) - halfWidth >= BOROUGH_EDGE;
    assert.ok(inManhattan || inBorough, `building in a river at ${b.x}, ${b.z}`);
  }
});

test("buildings near the island stay low, so the camera never meets a wall", () => {
  for (const b of buildings) {
    // A rooftop box may add up to 1 m.
    if (Math.hypot(b.x, b.z) < CAMERA_CLEARANCE) assert.ok(b.base + b.height <= LOW_RISE_LIMIT + 1);
  }
});

test("every landmark stands, and no ordinary lot overlaps one", () => {
  const lots = buildings.filter((b) => !LANDMARKS.includes(b));
  assert.equal(new Set(buildings).size, buildings.length);
  assert.equal(buildings.length - lots.length, LANDMARKS.length);
  for (const part of LANDMARKS) {
    for (const lot of lots) {
      const apart = Math.abs(lot.x - part.x) >= (lot.width + part.width) / 2 || Math.abs(lot.z - part.z) >= (lot.depth + part.depth) / 2;
      assert.ok(apart, `lot at ${lot.x}, ${lot.z} overlaps a landmark`);
    }
  }
});

test("packing keeps one entry per building", () => {
  const { footprint, shape, look } = packCity(buildings);
  assert.equal(footprint.length, buildings.length * 4);
  assert.equal(shape.length, buildings.length * 4);
  assert.equal(look.length, buildings.length * 4);
});

test("trees grow in the park and never in its water", () => {
  const trees = layoutTrees();
  assert.ok(trees.length / 4 > 800 && trees.length / 4 < 2500, `${trees.length / 4} trees`);
  for (let i = 0; i < trees.length; i += 4) {
    const [x, z] = [trees[i], trees[i + 1]];
    assert.ok(inPark(x, z), `tree outside the park at ${x}, ${z}`);
    for (const [cx, cz, rx, rz] of PARK_WATER) assert.ok(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 >= 1, `tree in water at ${x}, ${z}`);
  }
});

test("aviation lights sit on the tall tops only", () => {
  const lights = layoutLights(buildings);
  assert.ok(lights.length / 4 > 100, `${lights.length / 4} lights`);
  for (let i = 1; i < lights.length; i += 4) assert.ok(lights[i] > 18);
});
