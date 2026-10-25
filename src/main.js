// Entry point for anu's cherry blossom island: boots the scene in small steps, then wires
// the loading screen, the intro, object clicks, dialogs and toggles.

import { createClouds } from "./clouds.js";
import { revealIsland, waitForEnter } from "./loading.js";
import { islandMaterials, loadIsland } from "./island.js";
import { isModalOpen, setBackgroundInert, showModal } from "./modals.js";
import { prefersReducedMotion } from "./motion.js";
import { createPetals, fitPetalsToCanopy } from "./petals.js";
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
import { playClick, setMuted, startMusic, stepTheme, theme } from "./toggles.js";

const label = document.querySelector(".object-label");
/** Created once the renderer exists (it needs the pixel ratio). */
let petals;
let clouds;
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
  }
  if (stepTheme(delta)) {
    for (const material of themedMaterials) material.uniforms.uMixRatio.value = theme.mix;
    scene.background.lerpColors(SKY_COLORS.day, SKY_COLORS.night, theme.mix);
  }
  animateProps(time, delta, getHoveredObject());
  updatePicking(camera, label, isBlocked());
}

/** Loads in small tasks, waits for "enter", then reveals the island and starts the intro. */
async function boot() {
  await initScene();
  controls.addEventListener("change", requestRaycast);
  petals = createPetals(isMobile ? 120 : 300, renderer.getPixelRatio());
  scene.add(petals.points);
  clouds = createClouds();
  scene.add(clouds.mesh);
  themedMaterials = [...islandMaterials, petals.material, clouds.material];

  const island = await loadIsland({ scene, camera, renderer, yieldToMain });
  for (const mesh of island.children) {
    if (mesh.name.includes("Canopy")) fitPetalsToCanopy(petals, mesh);
    if (mesh.name.includes("Raycaster")) {
      // Hitbox first: it is measured at the rest pose, before the intro hides the prop.
      addHitbox(mesh, scene);
      addProp(mesh);
    }
  }
  await warmUp([...island.children, petals.points, clouds.mesh]);
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
