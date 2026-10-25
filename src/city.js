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
export const STYLE = { punched: 0, glass: 1, bands: 2, piers: 3, grid: 4 };

/**
 * Day colours (sRGB) the shader picks by index: brick, brownstone, limestone, cream, concrete,
 * three glasses, then the landmark trims: copper green, steel, gold and white.
 */
export const PALETTE = [
  "#B9785F", "#8E6A5A", "#D8CCB4", "#E6DDCB", "#B9BBBA", "#7F9DBA", "#56677E", "#7FA9A8",
  "#6FA58F", "#D9DEE6", "#D9B45A", "#EFEDE8",
];

/** How a part shows at night: plain windows, a floodlit crown, or a bare spire. */
export const LIGHT = { none: 0, crown: 1, spire: 2 };

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

/** City-space z of the block just south of a numbered Manhattan street (59th is the park's south edge). */
export function blockSouthOf(street) {
  return PARK.maxZ + 4.8 + (59 - street) * STREET_SPACING;
}

/** One level of a landmark: its footprint, its top above the street, and options that override the tower's. */
const tier = (width, depth, top, options = {}) => ({ width, depth, top, ...options });

/**
 * Stacks tiers into building records. Each tier starts where the one below ends, unless it
 * names its own base (twin towers). Options: dx, dz (offset), taper, slant (metres the south
 * edge of the roof drops), light, style and palette.
 */
function landmark(x, z, style, palette, tiers) {
  let top = 0;
  return tiers.map((t, index) => {
    const base = t.base ?? top;
    top = Math.max(top, t.top);
    return {
      x: x + (t.dx ?? 0),
      z: z + (t.dz ?? 0),
      width: t.width,
      depth: t.depth,
      base,
      height: t.top - base,
      taper: t.taper ?? 0,
      seed: Math.abs(index * 0.137 + x * 0.013 + z * 0.007) % 1,
      style: t.style ?? style,
      palette: t.palette ?? palette,
      slant: t.slant ?? 0,
      light: t.light ?? LIGHT.none,
    };
  });
}

/**
 * The towers people know New York by, at 1:10 on the street grid. Avenues: 8th x -39,
 * 7th -13, 6th 13, 5th 39, Madison 65, Park 91, Lexington 117, 10th -91.
 */
export const LANDMARKS = [
  // Central Park South: the Plaza and the Sherry-Netherland with copper roofs, then 220 CPS.
  landmark(30, blockSouthOf(59), STYLE.punched, 3, [tier(7, 5.4, 6.2), tier(7, 5.4, 7.8, { taper: 0.25, palette: 8 })]),
  landmark(46, blockSouthOf(59), STYLE.punched, 2, [
    tier(4, 4, 9), tier(2.4, 2.4, 14), tier(1.4, 1.4, 17.2, { taper: 0.9, palette: 8 }),
  ]),
  landmark(-30, blockSouthOf(59), STYLE.piers, 2, [tier(5, 5, 22), tier(3.6, 3.6, 29)]),
  // Billionaires' Row on 57th Street: Central Park Tower, Steinway Tower, One57, 432 Park.
  landmark(-18, blockSouthOf(58), STYLE.glass, 6, [
    tier(6, 3.5, 9), tier(4.4, 3, 30, { dx: 0.6 }), tier(4, 2.6, 47.2, { dx: 0.6 }),
  ]),
  landmark(4, blockSouthOf(58), STYLE.piers, 1, [
    tier(1.8, 6, 20), tier(1.8, 4.8, 30, { dz: -0.6 }), tier(1.8, 3.4, 38, { dz: -1.3 }),
    tier(1.8, 2, 43.5, { dz: -2, taper: 0.3 }),
  ]),
  landmark(-4, blockSouthOf(58), STYLE.glass, 6, [tier(4, 3, 22), tier(3.6, 2.6, 26), tier(3, 2.2, 30.6, { slant: 1.2 })]),
  landmark(86, blockSouthOf(57), STYLE.grid, 11, [tier(2.8, 2.8, 42.6)]),
  landmark(-45, blockSouthOf(57), STYLE.glass, 5, [tier(5, 2.6, 4), tier(3.6, 2.6, 18.2)]),
  // Midtown: 53W53, Citigroup's slanted roof, 30 Rock, MetLife.
  landmark(16, blockSouthOf(54), STYLE.glass, 6, [tier(3.4, 3.4, 32, { taper: 0.6 })]),
  landmark(122, blockSouthOf(54), STYLE.bands, 11, [tier(1.6, 1.6, 4), tier(4.8, 4.8, 27.9, { base: 4, slant: 5 })]),
  landmark(22, blockSouthOf(50), STYLE.piers, 2, [tier(4, 6.2, 10), tier(3.2, 5.4, 20), tier(2.6, 4.2, 25.9)]),
  landmark(91, blockSouthOf(45), STYLE.bands, 4, [tier(9, 6, 4), tier(9, 3.6, 24.6)]),
  // 42nd Street: the Chrysler crown and needle, One Vanderbilt, Bank of America.
  landmark(122, blockSouthOf(43), STYLE.piers, 3, [
    tier(6.2, 6.2, 5.5), tier(5, 5, 7.5), tier(3.8, 3.8, 24.5), tier(3.2, 3.2, 25.8, { taper: 0.2, palette: 9, light: LIGHT.crown }),
    tier(2.6, 2.6, 27, { taper: 0.25, palette: 9, light: LIGHT.crown }), tier(2, 2, 28, { taper: 0.3, palette: 9, light: LIGHT.crown }),
    tier(1.4, 1.4, 29, { taper: 0.4, palette: 9, light: LIGHT.crown }), tier(0.25, 0.25, 31.9, { taper: 0.9, palette: 9, light: LIGHT.spire }),
  ]),
  landmark(52, blockSouthOf(43), STYLE.glass, 5, [tier(5, 5, 40, { taper: 0.45 }), tier(0.25, 0.25, 42.7, { light: LIGHT.spire })]),
  landmark(20, blockSouthOf(43), STYLE.glass, 7, [tier(5, 5, 28.8, { taper: 0.25 }), tier(0.3, 0.3, 36.6, { light: LIGHT.spire })]),
  // The Empire State Building: limestone setbacks, a floodlit crown and the mast.
  landmark(30, blockSouthOf(34), STYLE.piers, 2, [
    tier(12.6, 6.2, 2.5), tier(10, 5.6, 7.2), tier(7, 4.6, 26), tier(5.4, 3.8, 32), tier(3, 2.6, 34.5),
    tier(1.6, 1.6, 38, { palette: 11, light: LIGHT.crown }), tier(0.25, 0.25, 44.3, { light: LIGHT.spire }),
  ]),
  // Hudson Yards: 30 Hudson Yards with its slanted top, and two neighbours.
  landmark(-98, blockSouthOf(34), STYLE.glass, 5, [tier(5, 5, 38.7, { slant: 3 })]),
  landmark(-112, blockSouthOf(35), STYLE.glass, 7, [tier(4.6, 4.6, 30.8)]),
  landmark(-86, blockSouthOf(31), STYLE.glass, 6, [tier(5, 5, 27.3, { slant: 2 })]),
  // New York Life's gold pyramid on Madison Square.
  landmark(70, blockSouthOf(27), STYLE.piers, 2, [tier(5, 6, 15), tier(3, 3, 17), tier(2.6, 2.6, 18.7, { taper: 0.9, palette: 10, light: LIGHT.crown })]),
  // The Upper West Side: the San Remo's twin towers and the Dakota.
  landmark(-52, blockSouthOf(74), STYLE.punched, 2, [
    tier(8, 6, 8), tier(2, 2, 11, { dx: -2.4 }), tier(2, 2, 11, { dx: 2.4, base: 8 }),
    tier(1.2, 1.2, 12.4, { dx: -2.4, taper: 0.8, palette: 8 }), tier(1.2, 1.2, 12.4, { dx: 2.4, taper: 0.8, palette: 8, base: 11 }),
  ]),
  landmark(-52, blockSouthOf(72), STYLE.punched, 3, [tier(9, 6, 5.6), tier(9, 6, 6.6, { taper: 0.2, palette: 8 })]),
  // Downtown: One World Trade Center, 3 and 4 WTC, Woolworth, 56 Leonard, 40 Wall Street.
  landmark(-45, 472, STYLE.glass, 5, [
    tier(6.2, 6.2, 5.5), tier(6.2, 6.2, 41.7, { base: 5.5, taper: 0.29 }), tier(2.4, 2.4, 42.5), tier(0.3, 0.3, 54.1, { light: LIGHT.spire }),
  ]),
  landmark(-22, 480, STYLE.glass, 6, [tier(5, 5, 32.9), tier(0.25, 0.25, 36, { light: LIGHT.spire })]),
  landmark(-28, 488, STYLE.glass, 7, [tier(5, 5, 29.8, { slant: 1.5 })]),
  landmark(-8, 440, STYLE.piers, 11, [
    tier(6, 6, 9), tier(3, 3, 20), tier(2.4, 2.4, 22), tier(2.2, 2.2, 24.1, { taper: 0.9, palette: 8 }),
  ]),
  landmark(-28, 416, STYLE.glass, 9, [
    tier(3.4, 3.4, 15), tier(3.6, 3.6, 18, { dx: 0.4 }), tier(3.4, 3.4, 21, { dx: -0.4 }), tier(3.2, 3.2, 25, { dz: 0.3 }),
  ]),
  landmark(6, 496, STYLE.piers, 2, [
    tier(4, 4, 24), tier(2.6, 2.6, 27, { taper: 0.5, palette: 8 }), tier(0.15, 0.15, 28.3, { light: LIGHT.spire }),
  ]),
].flat();

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
      slant: 0,
      light: LIGHT.none,
      ...lotLook(height, random),
    });
    x += width;
  }
}

/** True when a lot's footprint overlaps a landmark's, so the landmark takes its place. */
function underLandmark(lot) {
  return LANDMARKS.some(
    (part) => Math.abs(lot.x - part.x) < (lot.width + part.width) / 2 && Math.abs(lot.z - part.z) < (lot.depth + part.depth) / 2
  );
}

/**
 * Returns every building as a record: centre (x, z), footprint (width along x, depth along z),
 * base and height above the street, taper (top shrink, 0..1), seed, facade style, palette,
 * roof slant and night light. Landmarks replace the lots under them.
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
  return buildings.filter((lot) => !underLandmark(lot)).concat(LANDMARKS);
}

/** Ellipses in Central Park (centre x, z, radius x, z) at their real streets: water, then open lawns. */
export const PARK_WATER = [
  [0, (blockSouthOf(96) + blockSouthOf(86)) / 2, 30, 36], // the Reservoir, 86th to 96th Street
  [-10, (blockSouthOf(77) + blockSouthOf(72)) / 2, 16, 12], // the Lake
  [26, blockSouthOf(60), 7, 4], // the Pond
];
export const PARK_LAWNS = [
  [0, (blockSouthOf(85) + blockSouthOf(79)) / 2, 16, 20], // the Great Lawn
  [-14, (blockSouthOf(69) + blockSouthOf(66)) / 2, 12, 8], // Sheep Meadow
];

/** True inside any of the ellipses, grown by margin metres. */
function inEllipses(x, z, ellipses, margin = 0) {
  return ellipses.some(([cx, cz, rx, rz]) => ((x - cx) / (rx + margin)) ** 2 + ((z - cz) / (rz + margin)) ** 2 < 1);
}

/** Tree colours by index (sRGB): four greens, two cherry blossom pinks, and white pear blossom. */
export const TREE_PALETTE = ["#5E9A4E", "#6FA85A", "#4F8A48", "#83B565", "#F08AA0", "#F6A9B8", "#F4EFE6"];

/**
 * Plants Central Park on a jittered 3.2 m grid, leaving the water and the lawns open.
 * Returns packed trees: x, z, crown radius, colour index.
 */
export function layoutTrees(seed = 1858) {
  const random = seeded(seed);
  const trees = [];
  for (let x = PARK.minX + 1.5; x < PARK.maxX - 1; x += 3.2) {
    for (let z = PARK.minZ + 1.5; z < PARK.maxZ - 1; z += 3.2) {
      const tx = x + (random() - 0.5) * 2.4;
      const tz = z + (random() - 0.5) * 2.4;
      if (random() < 0.15 || !inPark(tx, tz, -1) || inEllipses(tx, tz, PARK_WATER, 1.5) || inEllipses(tx, tz, PARK_LAWNS)) continue;
      const roll = random();
      const color = roll < 0.7 ? Math.floor(random() * 4) : roll < 0.92 ? 4 + Math.floor(random() * 2) : 6;
      trees.push(tx, tz, 1.3 + random() * 1.1, color);
    }
  }
  return new Float32Array(trees);
}

/** Packs building records into the typed arrays the instanced mesh reads. */
export function packCity(buildings) {
  const footprint = new Float32Array(buildings.length * 4);
  const shape = new Float32Array(buildings.length * 4);
  const look = new Float32Array(buildings.length * 4);
  buildings.forEach((b, i) => {
    footprint.set([b.x, b.z, b.width, b.depth], i * 4);
    shape.set([b.base, b.height, b.taper, b.seed], i * 4);
    look.set([b.style, b.palette, b.slant, b.light], i * 4);
  });
  return { footprint, shape, look };
}
