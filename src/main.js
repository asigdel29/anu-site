// Entry point for anu's cherry blossom island: loads the scene in small steps and wires
// object clicks.

import { loadIsland } from "./island.js";
import { prefersReducedMotion } from "./motion.js";
import { createPetals, fitPetalsToCanopy } from "./petals.js";
import { addHitbox, requestRaycast, setupPicking, updatePicking } from "./picking.js";
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

/** Runs an object's action. Links open now; dialogs arrive with the dialog code. */
function runAction(action) {
  if (action?.url) window.open(action.url, "_blank", "noopener,noreferrer");
}

setupPicking(canvas, camera, { isBlocked: () => false, onAction: runAction });

function onFrame(time) {
  // Reduced motion freezes the petals in place instead of hiding them.
  if (!prefersReducedMotion) petals.material.uniforms.uTime.value = time;
  updatePicking(camera, label, false);
}

/** Loads the island in small tasks, then starts the frame loop. */
async function boot() {
  await initScene();
  controls.addEventListener("change", requestRaycast);
  petals = createPetals(isMobile ? 120 : 300, renderer.getPixelRatio());
  scene.add(petals.points);

  const island = await loadIsland({ scene, camera, renderer, yieldToMain });
  for (const mesh of island.children) {
    if (mesh.name.includes("Canopy")) fitPetalsToCanopy(petals, mesh);
    if (mesh.name.includes("Raycaster")) addHitbox(mesh, scene);
  }
  await warmUp([...island.children, petals.points]);
  startLoop(onFrame);
  document.body.dataset.state = "ready";
}

// Start on a fresh task so module evaluation and WebGL setup are not one long task.
yieldToMain().then(boot);
