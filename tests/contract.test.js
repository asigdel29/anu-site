// Checks the mesh pack in public/models/island.bin follows the naming contract,
// so a renamed mesh in Blender can never silently lose its atlas.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/** Reads the JSON header of the mesh pack: a uint32 length, then the JSON. */
function readMeshNames(path) {
  const pack = readFileSync(new URL(path, import.meta.url));
  const header = JSON.parse(pack.subarray(4, 4 + pack.readUInt32LE(0)).toString("utf8"));
  return header.nodes.map((node) => node.name);
}

const meshNames = readMeshNames("../public/models/island.bin");

test("every mesh uses exactly one atlas", () => {
  const wrong = meshNames.filter(
    (name) => ["First", "Second"].filter((atlas) => name.includes(atlas)).length !== 1
  );
  assert.deepEqual(wrong, []);
});
