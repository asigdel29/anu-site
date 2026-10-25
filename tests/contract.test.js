// Checks that public/models/island.bin and src/interactions.js agree, so a renamed
// mesh in Blender can never silently break a click, a letter or an atlas.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  findInteraction,
  interactions,
  letterNumber,
} from "../src/interactions.js";

/** Reads the JSON header of the mesh pack: a uint32 length, then the JSON. */
function readMeshNames(path) {
  const pack = readFileSync(new URL(path, import.meta.url));
  const header = JSON.parse(pack.subarray(4, 4 + pack.readUInt32LE(0)).toString("utf8"));
  return header.nodes.map((node) => node.name);
}

const meshNames = readMeshNames("../public/models/island.bin");

test("every pointer mesh has an action", () => {
  const orphans = meshNames.filter(
    (name) => name.includes("Pointer") && !findInteraction(name)
  );
  assert.deepEqual(orphans, []);
});

test("every action matches a raycaster mesh", () => {
  const unused = Object.keys(interactions).filter(
    (key) =>
      !meshNames.some((name) => name.includes(key) && name.includes("Raycaster"))
  );
  assert.deepEqual(unused, []);
});

test("name letters are numbered 1 to 3 with no gaps", () => {
  const numbers = meshNames
    .map(letterNumber)
    .filter(Boolean)
    .sort((a, b) => a - b);
  assert.deepEqual(numbers, [1, 2, 3]);
});

test("every mesh uses exactly one atlas", () => {
  const wrong = meshNames.filter(
    (name) => ["First", "Second"].filter((atlas) => name.includes(atlas)).length !== 1
  );
  assert.deepEqual(wrong, []);
});

test("findInteraction matches by substring and ignores static meshes", () => {
  assert.equal(
    findInteraction("Stone_X_Second_Raycaster_Pointer_Hover").url,
    "https://x.com/sigdel29"
  );
  assert.equal(findInteraction("Phone_Second_Raycaster").modal, "work");
  assert.equal(findInteraction("First"), undefined);
  assert.equal(letterNumber("Name_Letter_12_Second"), 12);
  assert.equal(letterNumber("Phone_Second"), null);
});
