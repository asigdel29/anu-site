// The New York skyline ringing the island: one open cylinder with the pixel-art data texture
// from tools/skyline/make_skyline.py, coloured for day or night by its shader.

import {
  BackSide,
  CylinderGeometry,
  ImageBitmapLoader,
  LinearMipmapLinearFilter,
  Mesh,
  NearestFilter,
  ShaderMaterial,
  Texture,
} from "three";

import vertexShader from "./shaders/skyline/vertex.glsl?raw";
import fragmentShader from "./shaders/skyline/fragment.glsl?raw";

const RADIUS = 75;
/** The city takes the top 30 m of the ring; the 20 m below are park ground fading into haze. */
const CITY_HEIGHT = 30;
const GROUND_HEIGHT = 20;
const HEIGHT = CITY_HEIGHT + GROUND_HEIGHT;

/** Loads the skyline texture off the main thread and builds the ring around the scene. */
export async function createSkyline(sky) {
  const bitmap = await new ImageBitmapLoader()
    .setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" })
    .loadAsync("/textures/skyline.png");
  const texture = new Texture(bitmap);
  texture.flipY = false;
  // Crisp pixels up close, smooth when far; the channels are data, so no colour conversion.
  texture.magFilter = NearestFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;

  const material = new ShaderMaterial({
    uniforms: {
      uSkyline: { value: texture },
      uMixRatio: { value: 0 },
      uTime: { value: 0 },
      uSky: { value: sky },
      uHaze: { value: 0.3 },
      uTextureStart: { value: GROUND_HEIGHT / HEIGHT },
    },
    vertexShader,
    fragmentShader,
    side: BackSide,
  });

  // The ring's base sits below the island so the city reads as distant, with the island above it.
  const mesh = new Mesh(new CylinderGeometry(RADIUS, RADIUS, HEIGHT, 96, 1, true), material);
  mesh.position.y = 4 - HEIGHT / 2;
  mesh.rotation.y = Math.PI * 0.7;
  return { mesh, material, texture };
}

/** Fog and gloom push the city further into the haze. */
export function setSkylineWeather({ material }, { gloom, fog }) {
  material.uniforms.uHaze.value = 0.3 + gloom * 0.25 + (fog ? 0.35 : 0);
}
