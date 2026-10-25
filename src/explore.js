// The scroll tour on screen: page scroll moves the camera from stop to stop around the island.

import { Vector3 } from "three";

import { damp, prefersReducedMotion } from "./motion.js";
import { isMobile } from "./scene.js";
import { STOPS, clampProgress, tourPose } from "./tour.js";

/** Phones are narrow, so the camera steps back for the props to fit across the screen. */
const ZOOM = isMobile ? 1.4 : 1;
/** How fast the camera catches up with the scroll; higher is snappier. */
const FOLLOW = 4;
/** How far, in metres, the camera leans with the mouse. */
const LEAN = { x: 0.35, y: 0.2 };

const target = new Vector3();
/** Mouse position from the screen centre, -1 to 1 on each axis, and the eased lean. */
const pointer = { x: 0, y: 0 };
const lean = { x: 0, y: 0 };

let started = false;
/** The camera's tour progress; it eases toward the scroll position. */
let shown = 0;
/** Cached on resize, so the frame loop never reads layout. */
let scrollRange = 1;
let viewWidth = 1;
let viewHeight = 1;

function measure() {
  scrollRange = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  viewWidth = window.innerWidth;
  viewHeight = window.innerHeight;
}

const scrollProgress = () => (window.scrollY / scrollRange) * (STOPS.length - 1);

/** Puts the camera on the tour path; the boot uses it before the first frame. */
export function placeCamera(camera, progress = shown) {
  tourPose(progress, ZOOM, camera.position, target);
  camera.lookAt(target);
}

/** Moves the camera toward the scroll position; call it every frame once the tour has started. */
export function stepTour(camera, delta) {
  if (!started) return;
  const goal = clampProgress(scrollProgress());
  shown = prefersReducedMotion ? goal : damp(shown, goal, FOLLOW, delta);
  lean.x = damp(lean.x, pointer.x, 3, delta);
  lean.y = damp(lean.y, pointer.y, 3, delta);

  placeCamera(camera);
  if (lean.x || lean.y) {
    camera.translateX(lean.x * LEAN.x);
    camera.translateY(-lean.y * LEAN.y);
    camera.lookAt(target);
  }
}

/** Starts following the scroll. */
export function startTour() {
  measure();
  window.addEventListener("resize", measure);
  // A mouse leans the camera a little; touch screens and reduced motion keep it still.
  if (!prefersReducedMotion && window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", (event) => {
      pointer.x = (event.clientX / viewWidth) * 2 - 1;
      pointer.y = (event.clientY / viewHeight) * 2 - 1;
    }, { passive: true });
  }
  shown = clampProgress(scrollProgress());
  started = true;
}
