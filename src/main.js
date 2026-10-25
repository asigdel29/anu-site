// Entry point for anu's cherry blossom island: loads the scene in small steps.

import { loadIsland } from "./island.js";
import { prefersReducedMotion } from "./motion.js";
import { createPetals, fitPetalsToCanopy } from "./petals.js";
import {
  camera,
  initScene,
  isMobile,
  renderer,
  scene,
  startLoop,
  warmUp,
  yieldToMain,
} from "./scene.js";

/** Created once the renderer exists (it needs the pixel ratio). */
let petals;

function onFrame(time) {
  // Reduced motion freezes the petals in place instead of hiding them.
  if (!prefersReducedMotion) petals.material.uniforms.uTime.value = time;
}

/** Loads the island in small tasks, then starts the frame loop. */
async function boot() {
  await initScene();
  petals = createPetals(isMobile ? 120 : 300, renderer.getPixelRatio());
  scene.add(petals.points);

  const island = await loadIsland({ scene, camera, renderer, yieldToMain });
  for (const mesh of island.children) {
    if (mesh.name.includes("Canopy")) fitPetalsToCanopy(petals, mesh);
  }
  await warmUp([...island.children, petals.points]);
  startLoop(onFrame);
  document.body.dataset.state = "ready";
}

// Start on a fresh task so module evaluation and WebGL setup are not one long task.
yieldToMain().then(boot);
