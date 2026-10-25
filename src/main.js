// Entry point for anu's cherry blossom island: sets up the scene in small steps.

import { initScene, startLoop, yieldToMain } from "./scene.js";

/** Sets up the renderer and starts the frame loop. */
async function boot() {
  await initScene();
  startLoop(() => {});
  document.body.dataset.state = "ready";
}

// Start on a fresh task so module evaluation and WebGL setup are not one long task.
yieldToMain().then(boot);
