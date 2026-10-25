// Entry point for anu's cherry blossom island: boots the scene in small steps, then wires
// the loading screen, the intro, object clicks, dialogs and toggles.

import { revealIsland, waitForEnter } from "./loading.js";
import { loadIsland } from "./island.js";
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
  startLoop,
  warmUp,
  yieldToMain,
} from "./scene.js";

const label = document.querySelector(".object-label");
/** Created once the renderer exists (it needs the pixel ratio). */
let petals;

let hasRevealed = false;
/** Clicks and hovers pause under the loading screen and while a dialog is open. */
const isBlocked = () => !hasRevealed;

/** Runs an object's action. Links open now; dialogs arrive with the dialog code. */
function runAction(action) {
  if (!action) return;
  if (action.url) window.open(action.url, "_blank", "noopener,noreferrer");
}

setupPicking(canvas, camera, { isBlocked, onAction: runAction });

function onFrame(time, delta) {
  // Reduced motion freezes the petals in place instead of hiding them.
  if (!prefersReducedMotion) petals.material.uniforms.uTime.value = time;
  animateProps(time, delta, getHoveredObject());
  updatePicking(camera, label, isBlocked());
}

/** Loads in small tasks, waits for "enter", then reveals the island and starts the intro. */
async function boot() {
  await initScene();
  controls.addEventListener("change", requestRaycast);
  petals = createPetals(isMobile ? 120 : 300, renderer.getPixelRatio());
  scene.add(petals.points);

  const island = await loadIsland({ scene, camera, renderer, yieldToMain });
  for (const mesh of island.children) {
    if (mesh.name.includes("Canopy")) fitPetalsToCanopy(petals, mesh);
    if (mesh.name.includes("Raycaster")) {
      // Hitbox first: it is measured at the rest pose, before the intro hides the prop.
      addHitbox(mesh, scene);
      addProp(mesh);
    }
  }
  await warmUp([...island.children, petals.points]);
  startLoop(onFrame);
  document.body.dataset.state = "ready";

  await waitForEnter();

  await revealIsland();
  hasRevealed = true;
  document.querySelector("#experience").inert = false;
  startIntro(performance.now() / 1000);
}

// Start on a fresh task so module evaluation and WebGL setup are not one long task.
yieldToMain().then(boot);
