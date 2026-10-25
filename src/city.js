// Lays out the New York around the island as plain data: Manhattan's street grid, Central Park
// under the island, the rivers, and lower boroughs beyond them. No WebGL here, so the layout
// can be tested in Node and built in a worker; src/skyline.js turns it into meshes.
//
// City space: metres at about 1:10 of the real city. x points east, z points south, and y is
// up from the street. The island floats over the south end of Central Park at the origin.

import { seeded } from "./random.js";

/** Street level, far below the island's grass (y = 0), so the island floats over the park. */
export const GROUND_Y = -40;

/** Avenues run north-south every 26 m from AVENUE_ORIGIN, streets east-west every 8 m: Manhattan's long blocks. */
export const AVENUE_ORIGIN = -195;
export const AVENUE_SPACING = 26;
export const AVENUE_WIDTH = 3;
export const STREET_SPACING = 8;
export const STREET_WIDTH = 1.6;

/**
 * Central Park, three blocks wide; the island is over it, so no tall building comes near the
 * camera. Its edges sit just inside the bounding avenues and streets, so no block straddles it.
 */
export const PARK = { minX: -37.5, maxX: 37.5, minZ: -259.2, maxZ: 59.2 };

/** Manhattan from Harlem (north, -z) to the Battery (south, +z); it narrows after `taper`. */
export const MANHATTAN = { north: -380, south: 520, halfWidth: 185, taper: 380 };

/** The Hudson and the East River end where New Jersey, Brooklyn and Queens start. */
export const BOROUGH_EDGE = 295;
const BOROUGH_DEPTH = 220;

/** Buildings this close to the island stay low, so the camera never meets a wall. */
export const CAMERA_CLEARANCE = 55;
export const LOW_RISE_LIMIT = 12;

/** Facade styles; the building shader draws a different window pattern for each. */
export const STYLE = { punched: 0, glass: 1, bands: 2, piers: 3 };

/** Day colours (sRGB) the shader picks by index: brick, brownstone, limestone, cream, concrete, three glasses. */
export const PALETTE = ["#B9785F", "#8E6A5A", "#D8CCB4", "#E6DDCB", "#B9BBBA", "#7F9DBA", "#56677E", "#7FA9A8"];

/** Where the towers are: Midtown south of the park, the Financial District, and the waterfronts across the rivers. */
const CLUSTERS = [
  { x: 0, z: 210, radius: 110, height: 30 },
  { x: -10, z: 480, radius: 60, height: 30 },
  { x: 330, z: 170, radius: 40, height: 16 },
  { x: -330, z: 450, radius: 50, height: 18 },
];

/** Manhattan's half width at a given z: straight sides, then narrowing to the Battery. */
export function manhattanHalfWidth(z) {
  const { halfWidth, taper, south } = MANHATTAN;
  return z < taper ? halfWidth : halfWidth - ((z - taper) / (south - taper)) * (halfWidth - 60);
}

/** True where a point is inside Central Park, grown by margin. */
export function inPark(x, z, margin = 0) {
  return x > PARK.minX - margin && x < PARK.maxX + margin && z > PARK.minZ - margin && z < PARK.maxZ + margin;
}

/** Height of the tallest cluster influence at a point. */
function clusterHeight(x, z) {
  let height = 0;
  for (const c of CLUSTERS) {
    height = Math.max(height, c.height * Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / (c.radius * c.radius)));
  }
  return height;
}

/** Manhattan lot height: towers in the clusters, pre-war mid-rise elsewhere, lower in Harlem. */
function manhattanHeight(x, z, random) {
  const roll = random();
  // Squaring the roll keeps towers rare and most lots mid-rise.
  let height = 2.5 + random() * 3.5 + clusterHeight(x, z) * (0.3 + 0.9 * roll * roll);
  if (z < PARK.minZ) height *= 0.75;
  if (Math.hypot(x, z) < CAMERA_CLEARANCE) height = Math.min(height, LOW_RISE_LIMIT);
  return height;
}

/** Borough lot height: mostly row houses, with towers only at the waterfront clusters. */
function boroughHeight(x, z, random) {
  return 1.2 + random() * 2.5 + clusterHeight(x, z) * random();
}

/** Facade look for a height: tall lots are glass, setback piers or bands; low ones brick and stone. */
function lotLook(height, random) {
  const roll = random();
  const pick = (first, count) => first + Math.floor(random() * count);
  if (height > 14) {
    if (roll < 0.55) return { style: STYLE.glass, palette: pick(5, 3) };
    if (roll < 0.8) return { style: STYLE.piers, palette: pick(2, 3) };
    return { style: STYLE.bands, palette: pick(3, 2) };
  }
  if (height > 7 && roll < 0.3) return { style: STYLE.bands, palette: pick(3, 2) };
  return { style: STYLE.punched, palette: pick(0, 4) };
}

/**
 * Fills one block (between two avenues and two streets) with lots from west to east.
 * Each lot is one building record; towers take more frontage.
 */
function fillBlock(buildings, block, heightAt, random) {
  const { west, east, north, south } = block;
  const z = (north + south) / 2;
  let x = west;
  while (east - x > 2) {
    const height = heightAt(x, z, random);
    let width = height > 14 ? 7 + random() * 7 : 4 + random() * 5;
    if (east - (x + width) < 3) width = east - x;
    buildings.push({
      x: x + width / 2,
      z,
      width: width - 0.3,
      depth: south - north - random() * 0.6,
      base: 0,
      height,
      taper: 0,
      seed: random(),
      ...lotLook(height, random),
    });
    x += width;
  }
}

/**
 * Returns every building as a record: centre (x, z), footprint (width along x, depth along z),
 * base and height above the street, taper (top shrink, 0..1), seed, facade style and palette.
 */
export function layoutCity(seed = 1625) {
  const random = seeded(seed);
  const buildings = [];
  const halfAvenue = AVENUE_WIDTH / 2;
  const halfStreet = STREET_WIDTH / 2;
  const { north: top, south: bottom, halfWidth: maxHalf } = MANHATTAN;

  for (let z = top; z < bottom; z += STREET_SPACING) {
    const north = z + halfStreet;
    const south = z + STREET_SPACING - halfStreet;
    const halfWidth = manhattanHalfWidth(z + STREET_SPACING / 2);
    for (let avenue = AVENUE_ORIGIN; avenue < maxHalf; avenue += AVENUE_SPACING) {
      const west = Math.max(avenue + halfAvenue, -halfWidth);
      const east = Math.min(avenue + AVENUE_SPACING - halfAvenue, halfWidth);
      if (east - west < 4 || inPark((west + east) / 2, (north + south) / 2, 2)) continue;
      fillBlock(buildings, { west, east, north, south }, manhattanHeight, random);
    }
  }

  // New Jersey to the west, Brooklyn and Queens to the east: double-depth blocks, some empty.
  for (let z = top; z < bottom; z += STREET_SPACING * 2) {
    for (let offset = 0; offset < BOROUGH_DEPTH; offset += AVENUE_SPACING) {
      for (const side of [-1, 1]) {
        if (random() < 0.45) continue;
        const near = BOROUGH_EDGE + offset + 2;
        const far = near + AVENUE_SPACING - 4;
        const [west, east] = side > 0 ? [near, far] : [-far, -near];
        fillBlock(buildings, { west, east, north: z + 1, south: z + STREET_SPACING * 2 - 1 }, boroughHeight, random);
      }
    }
  }
  return buildings;
}

/** Packs building records into the typed arrays the instanced mesh reads. */
export function packCity(buildings) {
  const footprint = new Float32Array(buildings.length * 4);
  const shape = new Float32Array(buildings.length * 4);
  const look = new Float32Array(buildings.length * 2);
  buildings.forEach((b, i) => {
    footprint.set([b.x, b.z, b.width, b.depth], i * 4);
    shape.set([b.base, b.height, b.taper, b.seed], i * 4);
    look.set([b.style, b.palette], i * 2);
  });
  return { footprint, shape, look };
}
