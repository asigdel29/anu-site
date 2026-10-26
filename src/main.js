// Entry point for anu's island over New York: boots the scene in small steps, then wires
// the loading screen, the live weather, dialogs and toggles.

import { Color } from "three";

import { createClouds, setCloudWeather } from "./clouds.js";
import { startDocks } from "./dock.js";
import { placeCamera, startTour, stepTour } from "./explore.js";
import { revealIsland, waitForEnter } from "./loading.js";
import { canopyMaterial, islandMaterial, loadIsland } from "./island.js";
import { createPetals, fitPetalsToCanopy, setPetalWind } from "./petals.js";
import { setBackgroundInert } from "./modals.js";
import { prefersReducedMotion } from "./motion.js";
import { createPrecipitation, setPrecipitation } from "./precipitation.js";
import { createSkyDome, paintSkyDome } from "./sky.js";
import { createSkyline, setSkylineWeather } from "./skyline.js";
import {
  camera,
  initScene,
  isMobile,
  renderer,
  scene,
  SKY_COLORS,
  startLoop,
  warmUp,
  yieldToMain,
} from "./scene.js";
import { setMuted, setNight, startMusic, stepTheme, theme } from "./toggles.js";
import { noteWeather, showWeather, startClock } from "./status.js";
import { fetchWeather } from "./weather.js";

/** How often the live weather refreshes. */
const WEATHER_REFRESH_MS = 15 * 60 * 1000;
/** Sky colours in the worst weather; gloom blends toward them. Soft periwinkle, so bad weather stays toy-like. */
const GLOOM_SKY = { day: new Color("#A9B4D6"), night: new Color("#1B1740") };
/** Current sky colours for day and night, after the weather's gloom. */
const sky = { day: SKY_COLORS.day.clone(), night: SKY_COLORS.night.clone() };

/** Created once the renderer exists (it needs the pixel ratio). */
let clouds;
let petals;
let skyDome;
/** The weather's gloom (0 to 1); the sky dome flattens its gradient with it. */
let gloom = 0;
let precipitation;
let skyline;
let themedMaterials = [];

function onFrame(time, delta) {
  stepTour(camera, delta);
  // Reduced motion freezes clouds and rain in place instead of hiding them.
  if (!prefersReducedMotion) {
    clouds.material.uniforms.uTime.value = time;
    precipitation.material.uniforms.uTime.value = time;
    if (petals) petals.material.uniforms.uTime.value = time;
    canopyMaterial.uniforms.uTime.value = time;
  }
  if (skyline) skyline.material.uniforms.uTime.value = time;
  if (stepTheme(delta)) {
    for (const material of themedMaterials) material.uniforms.uMixRatio.value = theme.mix;
    paintSky();
  }
}

function paintSky() {
  scene.background.lerpColors(sky.day, sky.night, theme.mix);
  // The city shaders work in sRGB, so they get the sky converted.
  skyline?.material.uniforms.uSky.value.copy(scene.background).convertLinearToSRGB();
  if (skyDome) paintSkyDome(skyDome, scene.background, theme.mix, gloom);
}

/** Shows live New York weather on the island; night follows New York daylight on first load. */
function applyWeather(weather, isFirst) {
  setCloudWeather(clouds, weather);
  setPrecipitation(precipitation, weather);
  if (petals) setPetalWind(petals, weather);
  if (skyline) setSkylineWeather(skyline, weather);
  gloom = weather.gloom;
  sky.day.lerpColors(SKY_COLORS.day, GLOOM_SKY.day, weather.gloom);
  sky.night.lerpColors(SKY_COLORS.night, GLOOM_SKY.night, weather.gloom);
  paintSky();
  document.body.dataset.weather = weather.kind;
  showWeather(weather);
  if (isFirst) setNight(!weather.isDay);
}

/** Loads in small tasks, waits for "enter", then reveals the island. */
async function boot() {
  startClock();
  const weatherRequest = fetchWeather();
  const skylineRequest = createSkyline();
  await initScene();
  placeCamera(camera, 0);
  await yieldToMain("sky");
  skyDome = createSkyDome();
  scene.add(skyDome.mesh);
  await yieldToMain("clouds");
  clouds = createClouds();
  scene.add(clouds.mesh);
  await yieldToMain("rain and snow");
  precipitation = createPrecipitation(isMobile ? 600 : 1500, renderer.getPixelRatio());
  scene.add(precipitation.points);
  themedMaterials = [islandMaterial, clouds.material, precipitation.material];

  const island = await loadIsland({ scene, camera, renderer, yieldToMain });
  await yieldToMain("petals");
  petals = createPetals(isMobile ? 160 : 420, renderer.getPixelRatio());
  fitPetalsToCanopy(petals, island.getObjectByName("Canopy"));
  scene.add(petals.points);
  themedMaterials.push(petals.material);
  // A first draw would compile the petal shader in one long task.
  await renderer.compileAsync(petals.points, camera, scene);
  await yieldToMain("load island");

  skyline = await skylineRequest;
  scene.add(skyline.group);
  themedMaterials.push(skyline.material);
  // Compile the city shaders in the background; a first draw would compile them all in one task.
  await renderer.compileAsync(skyline.group, camera, scene);
  await yieldToMain("skyline");

  applyWeather(await weatherRequest, true);
  setInterval(() => fetchWeather().then((weather) => applyWeather(weather, false)), WEATHER_REFRESH_MS);
  await warmUp([skyDome.mesh, ...island.children, clouds.mesh, precipitation.points, petals.points, ...skyline.group.children]);
  startLoop(onFrame);
  document.body.dataset.state = "ready";

  const withSound = await waitForEnter();
  if (withSound) startMusic();
  else setMuted(true);

  await revealIsland();
  setBackgroundInert(false);
  startDocks();
  startTour(island);
  noteWeather(await weatherRequest);
}

// The tour always starts at the first stop, not where the last visit scrolled to.
history.scrollRestoration = "manual";
// Start on a fresh task so module evaluation and WebGL setup are not one long task.
yieldToMain("boot").then(boot);
