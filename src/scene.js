// Renderer, camera, orbit controls and the frame loop for the island scene.

import { Color, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/**
 * True on phone-sized screens; drives framing, rain count and pixel ratio.
 * matchMedia avoids reading innerWidth at startup, which would force an early layout.
 */
export const isMobile = window.matchMedia("(max-width: 767px)").matches;

/** Sky colour per theme; the theme toggle blends between them. */
export const SKY_COLORS = {
  day: new Color("#A9D6F2"),
  night: new Color("#1E1B3A"),
};

/** Phones render at most 1.5x pixels: still sharp, and far less fill work than 3x. */
const MAX_PIXEL_RATIO = isMobile ? 1.5 : 2;

export const canvas = document.querySelector("#experience-canvas");
export const scene = new Scene();
scene.background = SKY_COLORS.day.clone();

export const camera = new PerspectiveCamera(35, 1, 0.1, 200);
/** Set by initScene(). */
export let renderer;
/** Set by initScene(). */
export let controls;

function fitToWindow() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Creates the WebGL context, the renderer and the controls in separate tasks: each step
 * makes blocking calls to the GPU process, and together they would be one long task.
 */
export async function initScene() {
  const context = canvas.getContext("webgl2", { antialias: true });
  await yieldToMain("renderer");
  renderer = new WebGLRenderer({ canvas, context });
  fitToWindow();
  window.addEventListener("resize", fitToWindow);
  await yieldToMain("controls");

  // ponytail: camera numbers are tuned by eye for the blockout; retune after the final model.
  controls = new OrbitControls(camera, canvas);
  controls.minDistance = 8;
  controls.maxDistance = 35;
  controls.minPolarAngle = 0.15 * Math.PI;
  controls.maxPolarAngle = 0.62 * Math.PI;
  controls.maxTargetRadius = 4;
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  if (isMobile) {
    camera.position.set(24, 11, 27);
    controls.target.set(0, 2.5, 0);
  } else {
    camera.position.set(18, 7.5, 20.5);
    controls.target.set(0, 1.6, 0);
  }
  controls.update();
}

/** Draws each object once in its own task, so first-draw buffer uploads never pile up. */
export async function warmUp(objects) {
  for (const object of objects) {
    renderer.render(object, camera);
    await yieldToMain(`warm up after ${object.name || object.type}`);
  }
}

/** Calls onFrame(timeSeconds, deltaSeconds) every frame, then renders. */
export function startLoop(onFrame) {
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const delta = Math.min((now - last) / 1000, 0.1);
    last = now;
    controls.update(delta);
    onFrame(now / 1000, delta);
    renderer.render(scene, camera);
  });
}

/**
 * Resolves on a fresh task, so long startup work never blocks the page in one piece.
 * nextStep names the work that follows; the perf test uses these marks to explain long tasks.
 */
export function yieldToMain(nextStep) {
  if (nextStep) performance.mark(nextStep);
  return new Promise((resolve) => setTimeout(resolve, 0));
}
