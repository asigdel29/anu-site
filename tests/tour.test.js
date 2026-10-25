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

/** Marker anchors from the mesh pack header that tools/blender/bake_export.py writes. */
function bakedAnchors() {
  const pack = readFileSync(new URL("../public/models/island.bin", import.meta.url));
  const headerLength = pack.readUInt32LE(0);
  return JSON.parse(pack.subarray(4, 4 + headerLength).toString()).anchors;
}

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
  for (const zoom of [1, 1.4]) {
    for (let progress = 0; progress <= STOPS.length - 1; progress += 0.01) {
      const { x, y, z } = pose(progress, zoom).position;
      const fromAxis = Math.hypot(x, z);
      // The canopy reaches about 5.2 m out, between about 3.2 m and 6.5 m up.
      assert.ok(!(fromAxis < 5.4 && y > 3 && y < 7), `canopy at ${progress.toFixed(2)}: ${fromAxis.toFixed(2)} m, ${y.toFixed(2)} m up`);
      // The island block is 6.1 m square, from the grass down to about 5 m below it.
      assert.ok(!(Math.abs(x) < 3.4 && Math.abs(z) < 3.4 && y < 0.5), `island at ${progress.toFixed(2)}`);
    }
  }
});

test("each prop stop looks at its prop, below the marker anchor", () => {
  const anchors = bakedAnchors();
  for (const stop of STOPS.filter((s) => s.marker)) {
    const anchor = anchors[stop.id];
    assert.ok(anchor, `no anchor for ${stop.id}`);
    assert.ok(Math.hypot(anchor[0] - stop.target[0], anchor[2] - stop.target[2]) < 0.05, `${stop.id} target is off its prop`);
    assert.ok(stop.target[1] < anchor[1], `${stop.id} looks above its marker`);
  }
});
