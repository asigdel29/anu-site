// Unit tests for the scroll tour path (src/tour.js): the camera lands on each stop, never flies
// through the tree or the island between stops, and looks at the props where the bake put them.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { STOPS, nearestStop, tourPose } from "../src/tour.js";

const pose = (progress, zoom = 1) => {
  const position = { x: 0, y: 0, z: 0 };
  const target = { x: 0, y: 0, z: 0 };
  tourPose(progress, zoom, position, target);
  return { position, target };
};

/** The mesh pack header that tools/blender/bake_export.py writes. */
function packHeader() {
  const pack = readFileSync(new URL("../public/models/island.bin", import.meta.url));
  const headerLength = pack.readUInt32LE(0);
  return JSON.parse(pack.subarray(4, 4 + headerLength).toString());
}

/** A node's bounds in site space, plus a margin, from the header (rotations are identity). */
function nodeBounds(name, margin) {
  const node = packHeader().nodes.find((n) => n.name === name);
  const corner = (key) => node[key].map((v, axis) => node.position[axis] + v * node.scale[axis]);
  const [min, max] = [corner("min"), corner("max")];
  return { min: min.map((v) => v - margin), max: max.map((v) => v + margin) };
}

const inside = ({ x, y, z }, { min, max }) =>
  x > min[0] && x < max[0] && y > min[1] && y < max[1] && z > min[2] && z < max[2];

test("the camera sits exactly on each stop", () => {
  STOPS.forEach((stop, index) => {
    const { position, target } = pose(index);
    const [azimuth, radius, height] = stop.camera;
    const angle = (azimuth * Math.PI) / 180;
    assert.ok(Math.abs(position.x - radius * Math.cos(angle)) < 1e-9, stop.id);
    assert.ok(Math.abs(position.y - height) < 1e-9, stop.id);
    assert.ok(Math.abs(position.z - radius * Math.sin(angle)) < 1e-9, stop.id);
    assert.deepEqual([target.x, target.y, target.z], stop.target);
  });
});

test("progress outside the tour holds the first and the last stop", () => {
  assert.deepEqual(pose(-3), pose(0));
  assert.deepEqual(pose(99), pose(STOPS.length - 1));
  assert.equal(nearestStop(-1), 0);
  assert.equal(nearestStop(1.4), 1);
  assert.equal(nearestStop(1.6), 2);
  assert.equal(nearestStop(99), STOPS.length - 1);
});

test("the camera never enters the canopy or the island, on desktop and on phones", () => {
  // Boxes around the baked canopy and the rest of the island (grass, pillars, trunk, props).
  const canopy = nodeBounds("Canopy", 0.3);
  const island = nodeBounds("First", 0.3);
  for (const zoom of [1, 1.4]) {
    for (let progress = 0; progress <= STOPS.length - 1; progress += 0.01) {
      const position = pose(progress, zoom).position;
      assert.ok(!inside(position, canopy), `canopy at progress ${progress.toFixed(2)}`);
      assert.ok(!inside(position, island), `island at progress ${progress.toFixed(2)}`);
    }
  }
});

test("each prop stop looks at its prop, below the marker anchor", () => {
  const { anchors } = packHeader();
  for (const stop of STOPS.filter((s) => s.marker)) {
    const anchor = anchors[stop.id];
    assert.ok(anchor, `no anchor for ${stop.id}`);
    assert.ok(Math.hypot(anchor[0] - stop.target[0], anchor[2] - stop.target[2]) < 0.05, `${stop.id} target is off its prop`);
    assert.ok(stop.target[1] < anchor[1], `${stop.id} looks above its marker`);
  }
});
