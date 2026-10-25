// The New York around the island: every building from src/city.js in one instanced draw call,
// Central Park's trees in another, and the street-level ground with the park and the rivers.
// All three shaders share one set of uniforms, so day, night and weather change them together.

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Vector4,
} from "three";

import {
  AVENUE_ORIGIN,
  AVENUE_SPACING,
  AVENUE_WIDTH,
  BOROUGH_EDGE,
  GROUND_Y,
  MANHATTAN,
  PALETTE,
  PARK,
  PARK_LAWNS,
  PARK_WATER,
  STREET_SPACING,
  STREET_WIDTH,
  TREE_PALETTE,
} from "./city.js";
import hazeShader from "./shaders/city/haze.glsl?raw";
import buildingVertex from "./shaders/city/building.vert?raw";
import buildingFragment from "./shaders/city/building.frag?raw";
import groundVertex from "./shaders/city/ground.vert?raw";
import groundFragment from "./shaders/city/ground.frag?raw";
import treeVertex from "./shaders/city/tree.vert?raw";
import treeFragment from "./shaders/city/tree.frag?raw";

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
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./city.worker.js", import.meta.url), { type: "module" });
    worker.onmessage = (event) => {
      resolve(event.data);
      worker.terminate();
    };
    worker.onerror = reject;
  });
}

/** Builds the instanced buildings: a unit box per record, placed and sized in the vertex shader. */
function createBuildings(uniforms, { footprint, shape, look }) {
  const geometry = new InstancedBufferGeometry().copy(new BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
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
    fragmentShader: hazeShader + buildingFragment,
  });
  const mesh = new Mesh(geometry, material);
  // The shader places every box, so the unit box's bounds say nothing useful.
  mesh.frustumCulled = false;
  return mesh;
}

/** Builds the park trees: one flat-shaded icosahedron per tree, placed in the vertex shader. */
function createTrees(uniforms, trees) {
  const geometry = new InstancedBufferGeometry().copy(new IcosahedronGeometry(1, 0));
  geometry.setAttribute("aTree", new InstancedBufferAttribute(trees, 4));
  geometry.instanceCount = trees.length / 4;
  const material = new ShaderMaterial({
    uniforms: { ...uniforms, uTreePalette: { value: srgb(TREE_PALETTE) } },
    vertexShader: treeVertex,
    fragmentShader: hazeShader + treeFragment,
  });
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
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
    },
    vertexShader: groundVertex,
    fragmentShader: hazeShader + groundFragment,
  });
  const ground = new Mesh(new CircleGeometry(GROUND_RADIUS, 72).rotateX(-Math.PI / 2), material);
  ground.position.y = GROUND_Y;
  return ground;
}

/**
 * Builds the city group off the main thread. The returned material is the buildings'; its
 * uniforms (uMixRatio, uTime, uSky, uHaze) are shared with the ground and the trees, so one
 * update sets all three.
 */
export async function createSkyline() {
  const uniforms = {
    uMixRatio: { value: 0 },
    uTime: { value: 0 },
    uSky: { value: new Color() },
    uHaze: { value: 0 },
    uGround: { value: GROUND_Y },
  };
  const layout = await layoutInWorker();
  const buildings = createBuildings(uniforms, layout);
  const group = new Group();
  group.add(createGround(uniforms), createTrees(uniforms, layout.trees), buildings);
  group.rotation.y = CITY_HEADING;
  return { group, material: buildings.material };
}

/** Fog and gloom push the city further into the haze. */
export function setSkylineWeather({ material }, { gloom, fog }) {
  material.uniforms.uHaze.value = gloom * 0.5 + (fog ? 1 : 0);
}
