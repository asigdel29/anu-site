// Renderer, camera and the frame loop for the island scene. The scroll tour (explore.js)
// moves the camera.

import { Color, PerspectiveCamera, Scene, WebGLRenderer } from "three";

/**
 * True on phone-sized screens; drives framing, rain count and pixel ratio.
 * matchMedia avoids reading innerWidth at startup, which would force an early layout.
 */
export const isMobile = window.matchMedia("(max-width: 767px)").matches;

/**
 * Sky colour per theme; the theme toggle blends between them. Day is a bright toy cyan and
 * night a deep candy indigo, so the city reads as a toy model, not a photo.
 */
export const SKY_COLORS = {
  day: new Color("#8DDCF8"),
  night: new Color("#2A1F5E"),
};

/** Phones render at most 1.5x pixels: still sharp, and far less fill work than 3x. */
const MAX_PIXEL_RATIO = isMobile ? 1.5 : 2;

export const canvas = document.querySelector("#experience-canvas");
export const scene = new Scene();
scene.background = SKY_COLORS.day.clone();

/** Far plane: the city's ground reaches 700 m out, and the haze hides its edge. */
export const camera = new PerspectiveCamera(35, 1, 0.5, 800);
/** Set by initScene(). */
export let renderer;

/** The canvas size last applied, so an unchanged size never reallocates the drawing buffer. */
let appliedSize = "";

/**
 * Matches the drawing buffer to the canvas's CSS size. Phones fire resize each time the address
 * bar moves; the canvas (100lvh tall) keeps its size then, so nothing is done.
 */
function fitToWindow() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const size = `${width}x${height}@${window.devicePixelRatio}`;
  if (size === appliedSize) return;
  appliedSize = size;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.setSize(width, height, false);
}

/**
 * Creates the WebGL context, the renderer and the canvas size in separate tasks: each step
 * makes blocking calls to the GPU process or compiles new code, and on a slow GPU any two of
 * them together pass 20 ms.
 */
export async function initScene() {
  await yieldToMain("context");
  const context = canvas.getContext("webgl2", { antialias: true });
  await yieldToMain("renderer");
  renderer = new WebGLRenderer({ canvas, context });
  await yieldToMain("canvas size");
  fitToWindow();
  window.addEventListener("resize", fitToWindow);
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
