// The New York around the island: every building from src/city.js in one instanced draw call,
// coloured for day or night and hazed toward the live sky by its shader.

import {
  BoxGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from "three";

import { GROUND_Y, PALETTE } from "./city.js";
import hazeShader from "./shaders/city/haze.glsl?raw";
import buildingVertex from "./shaders/city/building.vert?raw";
import buildingFragment from "./shaders/city/building.frag?raw";

/** Turns the city so Midtown (south, +z in city space) stands behind the island in the opening view. */
const CITY_HEADING = Math.atan2(-18, -20.5);

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
  geometry.setAttribute("aLook", new InstancedBufferAttribute(look, 2));
  geometry.instanceCount = look.length / 2;

  const material = new ShaderMaterial({
    uniforms: {
      ...uniforms,
      // The shaders work in sRGB, so the palette skips three's linear conversion.
      uPalette: { value: PALETTE.map((hex) => new Color(hex).convertLinearToSRGB()) },
    },
    vertexShader: buildingVertex,
    fragmentShader: hazeShader + buildingFragment,
  });
  const mesh = new Mesh(geometry, material);
  // The shader places every box, so the unit box's bounds say nothing useful.
  mesh.frustumCulled = false;
  return mesh;
}

/** Builds the city group; the layout runs off the main thread. */
export async function createSkyline() {
  const uniforms = {
    uMixRatio: { value: 0 },
    uTime: { value: 0 },
    uSky: { value: new Color() },
    uHaze: { value: 0 },
    uGround: { value: GROUND_Y },
  };
  const buildings = createBuildings(uniforms, await layoutInWorker());
  const group = new Group();
  group.add(buildings);
  group.rotation.y = CITY_HEADING;
  return { group, material: buildings.material };
}

/** Fog and gloom push the city further into the haze. */
export function setSkylineWeather({ material }, { gloom, fog }) {
  material.uniforms.uHaze.value = gloom * 0.5 + (fog ? 1 : 0);
}
