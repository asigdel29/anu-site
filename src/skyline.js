// The New York around the island: every building from src/city.js in one instanced draw call,
// Central Park's trees in another, rooftop water towers in a third, the traffic in a fourth, the
// East River bridges in a fifth, red aviation lights on the tall tops, and the street-level
// ground with the park and the rivers. All the city shaders share one set of uniforms, so day,
// night and weather change them together.

import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  Vector4,
} from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

import {
  AVENUE_ORIGIN,
  AVENUE_SPACING,
  AVENUE_WIDTH,
  BOROUGH_EDGE,
  BRIDGES,
  CAR,
  CAR_PALETTE,
  GROUND_Y,
  MANHATTAN,
  PALETTE,
  PARK,
  PARK_LAWNS,
  PARK_TRANSVERSES,
  PARK_WATER,
  STREET_SPACING,
  STREET_WIDTH,
  TOWER_RADIUS,
  TREE_PALETTE,
  bridgeSpan,
  buildCityArrays,
} from "./city.js";
import { prefersReducedMotion } from "./motion.js";
import { yieldToMain } from "./scene.js";
import commonShader from "./shaders/city/common.glsl?raw";
import buildingVertex from "./shaders/city/building.vert?raw";
import buildingFragment from "./shaders/city/building.frag?raw";
import groundVertex from "./shaders/city/ground.vert?raw";
import groundFragment from "./shaders/city/ground.frag?raw";
import treeVertex from "./shaders/city/tree.vert?raw";
import treeFragment from "./shaders/city/tree.frag?raw";
import lightVertex from "./shaders/city/light.vert?raw";
import lightFragment from "./shaders/city/light.frag?raw";
import bridgeVertex from "./shaders/city/bridge.vert?raw";
import bridgeFragment from "./shaders/city/bridge.frag?raw";
import trafficVertex from "./shaders/city/traffic.vert?raw";
import trafficFragment from "./shaders/city/traffic.frag?raw";
import waterTowerVertex from "./shaders/city/water-tower.vert?raw";
import waterTowerFragment from "./shaders/city/water-tower.frag?raw";

/** Turns the city so Midtown (south, +z in city space) stands behind the island in the opening view. */
const CITY_HEADING = Math.atan2(-18, -20.5);
/** The ground reaches past the haze, so its edge is never seen. */
const GROUND_RADIUS = 700;

/** Hex colours as sRGB vectors: the shaders work in sRGB, so they skip three's linear conversion. */
const srgb = (colors) => colors.map((hex) => new Color(hex).convertLinearToSRGB());

/** Writes numbers as a GLSL vector literal for a define. */
const vec = (...values) => `vec${values.length}(${values.map((v) => v.toFixed(2)).join(", ")})`;

/** Lays the city out in a worker; resolves with the packed instance arrays. */
function layoutInWorker() {
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./city.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (event) => {
      resolve(event.data);
      worker.terminate();
    };
    // Browsers without module workers build it here instead: one long task, but the city still shows.
    worker.onerror = () => resolve(buildCityArrays());
  });
}

/**
 * A box with its base at y = 0 and no bottom face, which no camera sees: ten triangles instead
 * of twelve, across thousands of buildings and cars.
 */
function openBox(width, height, depth) {
  const box = new BoxGeometry(width, height, depth).translate(0, height / 2, 0);
  const bottom = box.groups[3];
  const corners = Array.from(box.getIndex().array);
  corners.splice(bottom.start, bottom.count);
  box.setIndex(corners);
  box.clearGroups();
  return box;
}

/** Builds the instanced buildings: a unit box per record, placed and sized in the vertex shader. */
function createBuildings(uniforms, { footprint, shape, look }) {
  const geometry = new InstancedBufferGeometry().copy(openBox(1, 1, 1));
  geometry.setAttribute("aFootprint", new InstancedBufferAttribute(footprint, 4));
  geometry.setAttribute("aShape", new InstancedBufferAttribute(shape, 4));
  geometry.setAttribute("aLook", new InstancedBufferAttribute(look, 4));
  geometry.instanceCount = look.length / 4;

  const material = new ShaderMaterial({
    uniforms: {
      ...uniforms,
      uPalette: { value: srgb(PALETTE) },
    },
    vertexShader: buildingVertex,
    fragmentShader: commonShader + buildingFragment,
  });
  const mesh = new Mesh(geometry, material);
  // The shader places every box, so the unit box's bounds say nothing useful.
  mesh.frustumCulled = false;
  return mesh;
}

/** Canopy lobes of one tree in units of its crown radius: centre x, y, z and radius (a core, two sides and a top). */
const TREE_LOBES = [
  [0, 1.02, 0, 0.78],
  [0.5, 0.86, 0.22, 0.58],
  [-0.44, 0.9, -0.3, 0.58],
  [0.05, 1.5, 0.05, 0.5],
];

/**
 * One canopy lobe: a 20-face icosahedron with sphere normals, so it shades round, less the six
 * faces underneath, which the tour's high cameras never see. Few triangles keep the park cheap in
 * software WebGL.
 */
function lobeGeometry([x, y, z, radius]) {
  const lobe = new IcosahedronGeometry(radius, 0).deleteAttribute("uv");
  lobe.setAttribute("normal", lobe.getAttribute("position").clone());
  lobe.normalizeNormals();
  const indexed = mergeVertices(lobe);
  const position = indexed.getAttribute("position");
  const corners = Array.from(indexed.getIndex().array);
  const kept = [];
  for (let i = 0; i < corners.length; i += 3) {
    const face = corners.slice(i, i + 3);
    const centreY = face.reduce((sum, corner) => sum + position.getY(corner), 0) / 3;
    if (centreY > -0.4 * radius) kept.push(...face);
  }
  indexed.setIndex(kept);
  return indexed.translate(x, y, z);
}

/**
 * One stylized tree in units of its crown radius: a tapered trunk under clustered round canopy
 * lobes. aCanopy gives each vertex its height in the canopy (0 at the bottom, 1 at the top, -1 on
 * the trunk) and how far out from the core it sits, so the shader can darken the core.
 */
function treeGeometry() {
  const trunk = new CylinderGeometry(0.09, 0.14, 0.9, 5, 1, true).translate(0, 0.45, 0).deleteAttribute("uv");
  const lobes = TREE_LOBES.map(lobeGeometry);
  const geometry = mergeGeometries([trunk, ...lobes]);
  // The trunk and the core lobe come first, so a draw range of this many indices draws just them.
  geometry.userData.coreIndices = trunk.getIndex().count + lobes[0].getIndex().count;
  const bottom = Math.min(...TREE_LOBES.map(([, y, , radius]) => y - radius));
  const top = Math.max(...TREE_LOBES.map(([, y, , radius]) => y + radius));
  const [, coreY] = TREE_LOBES[0];
  const reach = Math.max(...TREE_LOBES.map(([x, y, z, radius]) => Math.hypot(x, y - coreY, z) + radius));
  const trunkCount = trunk.getAttribute("position").count;
  const position = geometry.getAttribute("position");
  const canopy = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const out = Math.hypot(position.getX(i), y - coreY, position.getZ(i)) / reach;
    canopy.set(i < trunkCount ? [-1, 0] : [(y - bottom) / (top - bottom), out], i * 2);
  }
  geometry.setAttribute("aCanopy", new BufferAttribute(canopy, 2));
  return geometry;
}

/** Builds the park trees: one clustered stylized tree per record, placed and swayed in the vertex shader. */
function createTrees(uniforms, trees) {
  const geometry = new InstancedBufferGeometry().copy(treeGeometry());
  geometry.setAttribute("aTree", new InstancedBufferAttribute(trees, 4));
  geometry.instanceCount = trees.length / 4;
  const material = new ShaderMaterial({
    uniforms: { ...uniforms, uTreePalette: { value: srgb(TREE_PALETTE) } },
    vertexShader: treeVertex,
    fragmentShader: commonShader + treeFragment,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

/** Water tower proportions at size 1, in metres: leg height, tank height and roof height. */
const TOWER = { legs: TOWER_RADIUS, tank: TOWER_RADIUS * 1.6, roof: TOWER_RADIUS * 0.55 };

/**
 * One water tower at size 1, in metres above its roof: four steel legs (part 0), each a thin
 * strip facing out from the corner, an eight-sided wooden tank (part 1) and a conical roof
 * (part 2). About 30 triangles, since software WebGL pays for every one, seen or not.
 */
function waterTowerGeometry() {
  const legs = [0, 1, 2, 3].map((corner) => {
    const angle = (corner * Math.PI) / 2 + Math.PI / 4;
    const reach = TOWER_RADIUS * 0.75;
    return new PlaneGeometry(0.07, TOWER.legs)
      .rotateY(Math.PI / 2 - angle)
      .translate(Math.cos(angle) * reach, TOWER.legs / 2, Math.sin(angle) * reach);
  });
  const tank = new CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS, TOWER.tank, 8, 1, true).translate(0, TOWER.legs + TOWER.tank / 2, 0);
  const roof = new ConeGeometry(TOWER_RADIUS * 1.1, TOWER.roof, 8, 1, true).translate(0, TOWER.legs + TOWER.tank + TOWER.roof / 2, 0);
  const parts = [...legs, tank, roof];
  const kinds = [0, 0, 0, 0, 1, 2];
  for (const [index, part] of parts.entries()) {
    part.deleteAttribute("uv");
    part.setAttribute("aPart", new BufferAttribute(new Float32Array(part.getAttribute("position").count).fill(kinds[index]), 1));
  }
  return mergeGeometries(parts);
}

/** Builds the rooftop water towers: one instanced draw call, placed from the packed layout. */
function createWaterTowers(uniforms, towers) {
  const geometry = new InstancedBufferGeometry().copy(waterTowerGeometry());
  geometry.setAttribute("aTower", new InstancedBufferAttribute(towers, 4));
  geometry.instanceCount = towers.length / 4;
  const material = new ShaderMaterial({
    uniforms,
    defines: { TANK: vec(TOWER.legs, TOWER.legs + TOWER.tank) },
    vertexShader: waterTowerVertex,
    fragmentShader: commonShader + waterTowerFragment,
    // The legs are single strips, seen from both sides.
    side: DoubleSide,
  });
  const mesh = new Mesh(geometry, material);
  // The shader places every tower, so the geometry's own bounds say nothing useful.
  mesh.frustumCulled = false;
  return mesh;
}

/** Car height in metres, body and cabin together. */
const CAR_HEIGHT = 0.17;

/**
 * Builds the traffic: one box per car, driven along its lane in the vertex shader from uTime, so
 * moving thousands of metres of traffic costs the main thread nothing. One draw call.
 */
function createTraffic(uniforms, traffic) {
  const geometry = new InstancedBufferGeometry().copy(openBox(CAR.length, CAR_HEIGHT, CAR.width));
  const packed = new InstancedInterleavedBuffer(traffic, 8);
  geometry.setAttribute("aLane", new InterleavedBufferAttribute(packed, 4, 0));
  geometry.setAttribute("aCar", new InterleavedBufferAttribute(packed, 4, 4));
  geometry.instanceCount = traffic.length / 8;
  const material = new ShaderMaterial({
    uniforms: { ...uniforms, uCarPalette: { value: srgb(CAR_PALETTE) } },
    defines: { CAR_SIZE: vec(CAR.length, CAR_HEIGHT, CAR.width) },
    vertexShader: trafficVertex,
    fragmentShader: commonShader + trafficFragment,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

/** Bridge paint (sRGB): the Brooklyn Bridge's granite and cream cables, Manhattan's steel blue, Williamsburg's red. */
const BRIDGE_PAINT = { Brooklyn: "#E2C9A0", Manhattan: "#5F8FC4", Williamsburg: "#C9503C" };

/** Bridge parts, as the number the bridge shader reads. */
const BRIDGE_PART = { deck: 0, stone: 1, steel: 2, cables: 3 };

/** Gives a part the attributes every bridge part shares: its kind, its paint and its cable data. */
function bridgePart(geometry, part, paint, cable) {
  const count = geometry.getAttribute("position").count;
  geometry.setAttribute("aPart", new BufferAttribute(new Float32Array(count).fill(part), 1));
  geometry.setAttribute("aPaint", new BufferAttribute(new Float32Array(count * 3).map((_, i) => paint[i % 3]), 3));
  geometry.setAttribute("aCable", cable ?? new BufferAttribute(new Float32Array(count * 3), 3));
  return geometry;
}

/**
 * The curtain under one main cable: a vertical strip from the cable down to the deck, from the
 * anchorage on one shore over both towers to the other. The cable sags between the towers and
 * rises to them from the anchorages. aCable gives the shader each point's metres along the
 * bridge, its metres below the cable, and how much of the Brooklyn Bridge's diagonal web
 * reaches it.
 */
function cableCurtain(bridge, span, side, paint) {
  const z = bridge.z + side * (bridge.width / 2 + 0.05);
  const anchors = [span.west - 4, span.east + 4];
  const top = bridge.towers - 0.3;
  const low = bridge.deck + 0.6;
  const heightAt = (x) => {
    const [first, second] = span.towers;
    if (x < first) return bridge.deck + 0.4 + (top - bridge.deck - 0.4) * ((x - anchors[0]) / (first - anchors[0])) ** 2;
    if (x > second) return bridge.deck + 0.4 + (top - bridge.deck - 0.4) * ((anchors[1] - x) / (anchors[1] - second)) ** 2;
    return low + (top - low) * (2 * (x - first) / (second - first) - 1) ** 2;
  };
  const stops = [
    ...Array.from({ length: 10 }, (_, i) => anchors[0] + ((span.towers[0] - anchors[0]) * i) / 10),
    ...Array.from({ length: 16 }, (_, i) => span.towers[0] + ((span.towers[1] - span.towers[0]) * i) / 16),
    ...Array.from({ length: 11 }, (_, i) => span.towers[1] + ((anchors[1] - span.towers[1]) * i) / 10),
  ];
  const reach = (span.towers[1] - span.towers[0]) * 0.3;
  const positions = [];
  const cable = [];
  for (const x of stops) {
    const height = heightAt(x);
    const web = bridge.stone ? Math.max(0, 1 - Math.min(...span.towers.map((tower) => Math.abs(x - tower))) / reach) : 0;
    positions.push(x, height, z, x, bridge.deck, z);
    cable.push(x, 0, web, x, height - bridge.deck, web);
  }
  const corners = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = i * 2;
    corners.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const curtain = new BufferGeometry();
  curtain.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  curtain.setAttribute("normal", new BufferAttribute(new Float32Array(positions.length).map((_, i) => (i % 3 === 2 ? side : 0)), 3));
  curtain.setAttribute("uv", new BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  curtain.setIndex(corners);
  return bridgePart(curtain, BRIDGE_PART.cables, paint, new BufferAttribute(new Float32Array(cable), 3));
}

/** One bridge in city space (y up from the street): deck, ramps to both shores, towers and cable curtains. */
function bridgeGeometry(bridge) {
  const span = bridgeSpan(bridge);
  const paint = srgb([BRIDGE_PAINT[bridge.name]])[0].toArray();
  const deckPaint = paint.map((channel) => channel * 0.7);
  const ramp = Math.hypot(span.west - span.start, bridge.deck);
  const slope = Math.atan2(bridge.deck, span.west - span.start);
  const parts = [
    new BoxGeometry(span.east - span.west, 0.35, bridge.width).translate((span.west + span.east) / 2, bridge.deck - 0.175, bridge.z),
    new BoxGeometry(ramp, 0.35, bridge.width).rotateZ(slope).translate((span.start + span.west) / 2, bridge.deck / 2 - 0.175, bridge.z),
    new BoxGeometry(ramp, 0.35, bridge.width).rotateZ(-slope).translate((span.east + span.end) / 2, bridge.deck / 2 - 0.175, bridge.z),
  ].map((deck) => bridgePart(deck, BRIDGE_PART.deck, deckPaint));
  for (const x of span.towers) {
    if (bridge.stone) {
      parts.push(bridgePart(new BoxGeometry(2, bridge.towers, bridge.width + 1.2).translate(x, bridge.towers / 2, bridge.z), BRIDGE_PART.stone, paint));
      continue;
    }
    const legs = [-1, 1].map((side) =>
      new BoxGeometry(0.9, bridge.towers, 0.9).translate(x, bridge.towers / 2, bridge.z + side * (bridge.width / 2 + 0.45))
    );
    const beams = [bridge.towers * 0.62, bridge.towers - 0.25].map((height) =>
      new BoxGeometry(0.6, 0.6, bridge.width + 1.8).translate(x, height, bridge.z)
    );
    parts.push(...[...legs, ...beams].map((piece) => bridgePart(piece, BRIDGE_PART.steel, paint)));
  }
  parts.push(cableCurtain(bridge, span, -1, paint), cableCurtain(bridge, span, 1, paint));
  return mergeGeometries(parts);
}

/** Builds the East River bridges: plain geometry from the layout data, one draw call for all three. */
function createBridges(uniforms) {
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: bridgeVertex,
    fragmentShader: commonShader + bridgeFragment,
    // The cable curtains are single strips, seen from both sides.
    side: DoubleSide,
  });
  const mesh = new Mesh(mergeGeometries(BRIDGES.map(bridgeGeometry)), material);
  mesh.position.y = GROUND_Y;
  return mesh;
}

/** Builds the aviation lights: points read straight from the packed x, top, z, phase array. */
function createLights(uniforms, lights) {
  const packed = new InterleavedBuffer(lights, 4);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new InterleavedBufferAttribute(packed, 3, 0));
  geometry.setAttribute("aPhase", new InterleavedBufferAttribute(packed, 1, 3));
  const material = new ShaderMaterial({
    uniforms: { ...uniforms, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
    vertexShader: lightVertex,
    fragmentShader: commonShader + lightFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geometry, material);
  // Heights are above the street; the shader adds the street level, so the bounds would be wrong.
  points.frustumCulled = false;
  return points;
}

function createGround(uniforms) {
  const ellipses = (list) => list.map(([x, z, rx, rz]) => new Vector4(x, z, rx, rz));
  const material = new ShaderMaterial({
    uniforms: {
      ...uniforms,
      uParkWater: { value: ellipses(PARK_WATER) },
      uParkLawns: { value: ellipses(PARK_LAWNS) },
    },
    defines: {
      PARK: vec(PARK.minX, PARK.maxX, PARK.minZ, PARK.maxZ),
      MANHATTAN: vec(MANHATTAN.north, MANHATTAN.south, MANHATTAN.halfWidth, MANHATTAN.taper),
      GRID: vec(AVENUE_SPACING, AVENUE_WIDTH, STREET_SPACING, STREET_WIDTH),
      BOROUGH_EDGE: BOROUGH_EDGE.toFixed(1),
      AVENUE_ORIGIN: AVENUE_ORIGIN.toFixed(1),
      TRANSVERSES: vec(...PARK_TRANSVERSES),
    },
    vertexShader: groundVertex,
    fragmentShader: commonShader + groundFragment,
  });
  const ground = new Mesh(new CircleGeometry(GROUND_RADIUS, 72).rotateX(-Math.PI / 2), material);
  ground.position.y = GROUND_Y;
  return ground;
}

/**
 * True when WebGL draws in software, without a GPU: in CI, or when the browser blocks the GPU.
 * Software WebGL pays for every triangle on the CPU, seen or not, so the city draws less there.
 */
function drawsInSoftware(gl) {
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return /swiftshader|llvmpipe|software/i.test(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
}

/**
 * Lightens the city when WebGL draws in software: the trees draw only their trunk and core lobe,
 * and the water towers and the cars stay hidden. The check needs the renderer, so it runs once,
 * at the trees' first draw (during the warm-up, before the towers' and the cars' turn).
 */
function lightenWithoutGpu(group) {
  const trees = group.getObjectByName("city trees");
  const hidden = ["city water towers", "city traffic"].map((name) => group.getObjectByName(name));
  trees.onBeforeRender = (renderer) => {
    trees.onBeforeRender = () => {};
    if (!drawsInSoftware(renderer.getContext())) return;
    trees.geometry.setDrawRange(0, trees.geometry.userData.coreIndices);
    for (const part of hidden) part.visible = false;
  };
}

/**
 * Builds the city group off the main thread. The returned material is the buildings'; its
 * uniforms (uMixRatio, uTime, uSky, uHaze, uMotion) are shared with the ground, the trees and
 * the lights, so one update sets them all.
 */
export async function createSkyline() {
  const uniforms = {
    uMixRatio: { value: 0 },
    uTime: { value: 0 },
    uSky: { value: new Color() },
    uHaze: { value: 0 },
    uGround: { value: GROUND_Y },
    // Trees sway and cars drive only when the visitor allows motion.
    uMotion: { value: prefersReducedMotion ? 0 : 1 },
  };
  const layout = await layoutInWorker();
  // The buildings' material is made first, so they draw first and hide most of the ground.
  const buildings = createBuildings(uniforms, layout);
  const group = new Group();
  const parts = [
    ["ground", () => createGround(uniforms)],
    ["trees", () => createTrees(uniforms, layout.trees)],
    ["buildings", () => buildings],
    ["water towers", () => createWaterTowers(uniforms, layout.towers)],
    ["traffic", () => createTraffic(uniforms, layout.traffic)],
    ["bridges", () => createBridges(uniforms)],
    ["aviation lights", () => createLights(uniforms, layout.lights)],
  ];
  // Each part is built in its own task, so the city never holds the page for long.
  for (const [name, build] of parts) {
    await yieldToMain(`city ${name}`);
    const part = build();
    // The name tells the perf test's marks which part a warm-up task drew.
    part.name = `city ${name}`;
    group.add(part);
  }
  lightenWithoutGpu(group);
  group.rotation.y = CITY_HEADING;
  return { group, material: buildings.material };
}

/** Fog and gloom push the city further into the haze. */
export function setSkylineWeather({ material }, { gloom, fog }) {
  material.uniforms.uHaze.value = gloom * 0.5 + (fog ? 1 : 0);
}
