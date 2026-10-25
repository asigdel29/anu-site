// Entry point for anu's cherry blossom island: boots the scene in small steps, then wires
// the loading screen, the intro, object clicks, dialogs and toggles.

import { Color } from "three";

import { createClouds, setCloudWeather } from "./clouds.js";
import { revealIsland, waitForEnter } from "./loading.js";
import { islandMaterials, loadIsland } from "./island.js";
import { isModalOpen, setBackgroundInert, showModal } from "./modals.js";
import { prefersReducedMotion } from "./motion.js";
import { createPetals, fitPetalsToCanopy } from "./petals.js";
import { createPrecipitation, setPrecipitation } from "./precipitation.js";
import { createSkyline, setSkylineWeather } from "./skyline.js";
import {
  addHitbox,
  getHoveredObject,
  requestRaycast,
  setupPicking,
  updatePicking,
} from "./picking.js";
import { addProp, animateProps, startIntro } from "./props.js";
import {
  camera,
  canvas,
  controls,
  initScene,
  isMobile,
  renderer,
  scene,
  SKY_COLORS,
  startLoop,
  warmUp,
  yieldToMain,
} from "./scene.js";
import { playClick, setMuted, setNight, startMusic, stepTheme, theme } from "./toggles.js";
import { fetchWeather, windVector } from "./weather.js";

/** How often the live weather refreshes. */
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
/** Sky colours in the worst weather; gloom blends toward them. */
const GLOOM_SKY = { day: new Color("#9aa5b1"), night: new Color("#15151f") };
/** Current sky colours for day and night, after the weather's gloom. */
const sky = { day: SKY_COLORS.day.clone(), night: SKY_COLORS.night.clone() };

const label = document.querySelector(".object-label");
/** Created once the renderer exists (it needs the pixel ratio). */
let petals;
let clouds;
let precipitation;
let skyline;
let themedMaterials = [];

let hasRevealed = false;
/** Clicks and hovers pause under the loading screen and while a dialog is open. */
const isBlocked = () => !hasRevealed || isModalOpen();

/** Runs an object's action: open its link in a new tab, or its dialog. */
function runAction(action) {
  if (!action) return;
  playClick();
  if (action.url) window.open(action.url, "_blank", "noopener,noreferrer");
  else showModal(action.modal);
}

setupPicking(canvas, camera, { isBlocked, onAction: runAction });

function onFrame(time, delta) {
  // Reduced motion freezes petals and clouds in place instead of hiding them.
  if (!prefersReducedMotion) {
    petals.material.uniforms.uTime.value = time;
    clouds.material.uniforms.uTime.value = time;
    precipitation.material.uniforms.uTime.value = time;
  }
  if (skyline) skyline.material.uniforms.uTime.value = time;
  if (stepTheme(delta)) {
    for (const material of themedMaterials) material.uniforms.uMixRatio.value = theme.mix;
    paintSky();
  }
  animateProps(time, delta, getHoveredObject());
  updatePicking(camera, label, isBlocked());
}

function paintSky() {
  scene.background.lerpColors(sky.day, sky.night, theme.mix);
  // The skyline shader works in sRGB, so it gets the sky converted.
  skyline?.material.uniforms.uSky.value.copy(scene.background).convertLinearToSRGB();
}

/** Shows live New York weather on the island; night follows New York daylight on first load. */
function applyWeather(weather, isFirst) {
  setCloudWeather(clouds, weather);
  setPrecipitation(precipitation, weather);
  if (skyline) setSkylineWeather(skyline, weather);
  petals.material.uniforms.uWind.value = windVector(weather.windDegrees, weather.windMph * 0.03);
  sky.day.lerpColors(SKY_COLORS.day, GLOOM_SKY.day, weather.gloom);
  sky.night.lerpColors(SKY_COLORS.night, GLOOM_SKY.night, weather.gloom);
  paintSky();
  document.body.dataset.weather = weather.kind;
  if (isFirst) setNight(!weather.isDay);
}

/** Loads in small tasks, waits for "enter", then reveals the island and starts the intro. */
async function boot() {
  const weatherRequest = fetchWeather();
  const skylineRequest = createSkyline(new Color());
  await initScene();
  controls.addEventListener("change", requestRaycast);
  petals = createPetals(isMobile ? 120 : 300, renderer.getPixelRatio());
  scene.add(petals.points);
  clouds = createClouds();
  scene.add(clouds.mesh);
  precipitation = createPrecipitation(isMobile ? 600 : 1500, renderer.getPixelRatio());
  scene.add(precipitation.points);
  themedMaterials = [...islandMaterials, petals.material, clouds.material, precipitation.material];

  const island = await loadIsland({ scene, camera, renderer, yieldToMain });
  for (const mesh of island.children) {
    if (mesh.name.includes("Canopy")) fitPetalsToCanopy(petals, mesh);
    if (mesh.name.includes("Raycaster")) {
      // Hitbox first: it is measured at the rest pose, before the intro hides the prop.
      addHitbox(mesh, scene);
      addProp(mesh);
    }
  }
  skyline = await skylineRequest;
  scene.add(skyline.mesh);
  themedMaterials.push(skyline.material);
  renderer.initTexture(skyline.texture);
  await yieldToMain();

  applyWeather(await weatherRequest, true);
  setInterval(() => fetchWeather().then((weather) => applyWeather(weather, false)), WEATHER_REFRESH_MS);
  await warmUp([...island.children, petals.points, clouds.mesh, precipitation.points, skyline.mesh]);
  startLoop(onFrame);
  document.body.dataset.state = "ready";

  const withSound = await waitForEnter();
  if (withSound) startMusic();
  else setMuted(true);

  await revealIsland();
  hasRevealed = true;
  setBackgroundInert(false);
  startIntro(performance.now() / 1000);
}

// Start on a fresh task so module evaluation and WebGL setup are not one long task.
yieldToMain().then(boot);
