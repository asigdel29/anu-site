// Entry point for anu's cherry blossom island: loads the scene in small steps.

import { loadIsland } from "./island.js";
import { camera, initScene, renderer, scene, startLoop, warmUp, yieldToMain } from "./scene.js";

/** Loads the island in small tasks, then starts the frame loop. */
async function boot() {
  await initScene();
  const island = await loadIsland({ scene, camera, renderer, yieldToMain });
  await warmUp(island.children);
  startLoop(() => {});
  document.body.dataset.state = "ready";
}

// Start on a fresh task so module evaluation and WebGL setup are not one long task.
yieldToMain().then(boot);
