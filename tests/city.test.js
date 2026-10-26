// Checks the city layout: same city on every visit, nothing in the park, the rivers or the
// camera's path, and a building count the GPU and the worker can carry.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  BOROUGH_EDGE,
  CAMERA_CLEARANCE,
  LANDMARKS,
  LOW_RISE_LIMIT,
  MANHATTAN,
  PALETTE,
  PARK,
  PARK_TRANSVERSES,
  PARK_WATER,
  STREET_SPACING,
  STYLE,
  TOWER_RADIUS,
  TREE_PALETTE,
  inPark,
  layoutLights,
  layoutTrees,
  layoutCity,
  layoutWaterTowers,
  buildCityArrays,
  manhattanHalfWidth,
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

test("the arrays the meshes read hold one entry per building, tree and light", () => {
  const { footprint, shape, look, trees, lights, towers } = buildCityArrays();
  assert.equal(footprint.length, buildings.length * 4);
  assert.equal(shape.length, buildings.length * 4);
  assert.equal(look.length, buildings.length * 4);
  assert.equal(trees.length, layoutTrees().length);
  assert.equal(lights.length, layoutLights(buildings).length);
  assert.equal(towers.length, layoutWaterTowers(buildings).length);
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

test("every building names a facade style and a colour that the shader has", () => {
  const styles = Object.values(STYLE);
  for (const b of buildings) {
    assert.ok(styles.includes(b.style), `style ${b.style}`);
    assert.ok(Number.isInteger(b.palette) && b.palette >= 0 && b.palette < PALETTE.length, `palette ${b.palette}`);
  }
});

test("the transverse roads cross the park on street lines", () => {
  for (const z of PARK_TRANSVERSES) {
    assert.ok(z > PARK.minZ && z < PARK.maxZ, `transverse at ${z}`);
    const streets = (z - MANHATTAN.north) / STREET_SPACING;
    assert.ok(Math.abs(streets - Math.round(streets)) < 1e-9, `transverse at ${z} is off the street grid`);
  }
});

test("every tree has a colour, and blossom trees stay a minority", () => {
  const trees = layoutTrees();
  let blossoms = 0;
  for (let i = 3; i < trees.length; i += 4) {
    assert.ok(Number.isInteger(trees[i]) && trees[i] >= 0 && trees[i] < TREE_PALETTE.length, `colour ${trees[i]}`);
    if (trees[i] === 4 || trees[i] === 5) blossoms++;
  }
  const share = blossoms / (trees.length / 4);
  assert.ok(share > 0.08 && share < 0.3, `blossom share ${share}`);
});

test("water towers stand on mid-rise roofs, clear of the roof's edge and its bulkhead", () => {
  const towers = layoutWaterTowers(buildings);
  assert.deepEqual(layoutWaterTowers(buildings), towers);
  assert.ok(towers.length / 4 > 300 && towers.length / 4 < 1200, `${towers.length / 4} towers`);
  const inside = (x, z, radius, part) =>
    Math.abs(x - part.x) + radius <= part.width / 2 && Math.abs(z - part.z) + radius <= part.depth / 2;
  const overlaps = (x, z, radius, part) =>
    Math.abs(x - part.x) < part.width / 2 + radius && Math.abs(z - part.z) < part.depth / 2 + radius;
  for (let i = 0; i < towers.length; i += 4) {
    const [x, z, roof, size] = towers.subarray(i, i + 4);
    const radius = TOWER_RADIUS * size;
    const under = buildings.filter((b) => Math.abs(b.base + b.height - roof) < 1e-4 && inside(x, z, radius, b));
    assert.ok(under.length > 0, `tower at ${x}, ${z} is not on a roof`);
    assert.ok(roof >= 3 && roof <= 14, `tower on a ${roof} m roof`);
    for (const b of buildings) {
      if (b.base >= roof - 1e-4 && overlaps(x, z, radius, b)) assert.fail(`tower at ${x}, ${z} meets a rooftop box`);
    }
    if (Math.hypot(x, z) < CAMERA_CLEARANCE) assert.ok(roof <= LOW_RISE_LIMIT);
  }
});
