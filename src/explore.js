// The scroll tour on screen: page scroll moves the camera from stop to stop, the prop at the
// current stop gets a marker bubble that opens its section, and a rail shows where you are.

import { Vector3 } from "three";

import { showModal } from "./modals.js";
import { damp, prefersReducedMotion } from "./motion.js";
import { canvas, isMobile } from "./scene.js";
import { playClick } from "./toggles.js";
import { STOPS, clampProgress, nearestStop, tourPose } from "./tour.js";

/** Phones are narrow, so the camera steps back for the props to fit across the screen. */
const ZOOM = isMobile ? 1.4 : 1;
/** How fast the camera catches up with the scroll; higher is snappier. */
const FOLLOW = 4;
/** How far, in stops, a marker shows on either side of its stop. */
const MARKER_REACH = 0.3;
/** How far, in metres, the camera leans with the mouse. */
const LEAN = { x: 0.35, y: 0.2 };

const sections = [...document.querySelectorAll(".tour-stop")];
const railButtons = [...document.querySelectorAll(".tour-rail button")];
const railLabel = document.querySelector(".tour-rail-label");
const markers = new Map([...document.querySelectorAll(".marker")].map((marker) => [marker.dataset.stop, marker]));

const target = new Vector3();
const point = new Vector3();
/** Marker points in world space, by stop id. */
const anchors = new Map();
/** Mouse position from the screen centre, -1 to 1 on each axis, and the eased lean. */
const pointer = { x: 0, y: 0 };
const lean = { x: 0, y: 0 };

let started = false;
/** The camera's tour progress; it eases toward the scroll position. */
let shown = 0;
let currentStop = -1;
let visibleMarker = null;
/** Cached on resize, so the frame loop never reads layout. */
let stopHeight = 1;
let viewWidth = 1;
let viewHeight = 1;

function measure() {
  // One stop per section: its height, not the window's, sets where each stop snaps. They differ
  // on phones once the address bar hides.
  stopHeight = Math.max(1, document.querySelector(".tour-stop").offsetHeight);
  viewWidth = canvas.clientWidth;
  viewHeight = canvas.clientHeight;
}

const scrollProgress = () => window.scrollY / stopHeight;

/** Puts the camera on the tour path; the boot uses it before the first frame. */
export function placeCamera(camera, progress = shown) {
  tourPose(progress, ZOOM, camera.position, target);
  camera.lookAt(target);
}

/** Marks the stop the camera is closest to on the rail. */
function showStop(index) {
  currentStop = index;
  railLabel.textContent = STOPS[index].title;
  document.body.dataset.stop = STOPS[index].id;
  railButtons.forEach((button, i) => {
    if (i === index) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
}

/** Shows the marker of the stop the camera is at, and pins it over its prop. */
function placeMarker(camera) {
  const stop = STOPS[currentStop];
  const id = stop.marker && Math.abs(shown - currentStop) < MARKER_REACH ? stop.id : null;
  if (id !== visibleMarker) {
    markers.get(visibleMarker)?.classList.remove("is-visible");
    markers.get(id)?.classList.add("is-visible");
    visibleMarker = id;
  }
  if (!id) return;
  // lookAt sets the new rotation after it updates the matrices, so update them before projecting.
  camera.updateMatrixWorld();
  point.copy(anchors.get(id)).project(camera);
  const x = ((point.x + 1) / 2) * viewWidth;
  const y = ((1 - point.y) / 2) * viewHeight;
  // One transform, not the translate property: Safari's accessibility frames ignore translate.
  // The second step puts the marker's ground ring on the anchor.
  markers.get(id).style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
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
  const nearest = nearestStop(shown);
  if (nearest !== currentStop) showStop(nearest);
  placeMarker(camera);
}

/** Starts following the scroll. island carries the marker anchors from the mesh pack. */
export function startTour(island) {
  island.updateMatrixWorld();
  for (const [id, position] of Object.entries(island.userData.anchors)) {
    anchors.set(id, island.localToWorld(new Vector3().fromArray(position)));
  }
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
  showStop(nearestStop(shown));
  started = true;
}

for (const marker of markers.values()) {
  const { action } = STOPS.find((stop) => stop.id === marker.dataset.stop);
  marker.addEventListener("click", () => {
    playClick();
    if (action.startsWith("https://")) window.open(action, "_blank", "noopener,noreferrer");
    else showModal(action);
  });
}

railButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    playClick();
    sections[index].scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
  });
});
