// Checks the city layout: same city on every visit, nothing in the park, the rivers or the
// camera's path, and a building count the GPU and the worker can carry.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BOROUGH_EDGE,
  CAMERA_CLEARANCE,
  LANDMARKS,
  LOW_RISE_LIMIT,
  inPark,
  layoutCity,
  manhattanHalfWidth,
  packCity,
} from "../src/city.js";

const buildings = layoutCity();

test("the layout is the same on every visit", () => {
  assert.deepEqual(layoutCity(), buildings);
});

test("the building count stays inside the budget", () => {
  assert.ok(buildings.length > 3000 && buildings.length < 9000, `${buildings.length} buildings`);
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
    if (Math.hypot(b.x, b.z) < CAMERA_CLEARANCE) assert.ok(b.height <= LOW_RISE_LIMIT);
  }
});

test("every landmark stands, and no ordinary lot overlaps one", () => {
  const lots = buildings.filter((b) => !LANDMARKS.includes(b));
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
