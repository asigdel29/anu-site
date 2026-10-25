// Hover, click and two-tap touch for the island's interactive objects, plus the label
// that follows the hovered one.

import {
  Box3,
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

import { findInteraction } from "./interactions.js";

const raycaster = new Raycaster();
/** Normalized pointer; starts off-screen so nothing is hovered before the first move. */
const pointer = new Vector2(10, 10);
const hitboxes = [];
const hitboxMaterial = new MeshBasicMaterial({ visible: false });
const labelPosition = new Vector3();

let hovered = null;
/** Raycasting runs only after the pointer or the camera moved. */
let needsRaycast = false;
/** True while a finger is down, so an orbit drag does not sweep hover across objects. */
let touchDown = false;
const pressPoint = { x: 0, y: 0, moved: false };
let lastTapped = null;

/**
 * Adds an invisible box around an object at its rest pose. A box is steadier to hover
 * than the mesh itself, which moves while it animates.
 */
export function addHitbox(object, scene) {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3());
  const center = box.getCenter(new Vector3());

  const hitbox = new Mesh(
    new BoxGeometry(size.x * 1.1, size.y * 1.75, size.z * 1.1),
    hitboxMaterial
  );
  hitbox.position.copy(center);
  hitbox.userData = {
    object,
    action: findInteraction(object.name),
    labelAnchor: new Vector3(center.x, box.max.y, center.z),
  };
  scene.add(hitbox);
  hitboxes.push(hitbox);
}

/** The object under the pointer, or null. */
export function getHoveredObject() {
  return hovered?.userData.object ?? null;
}

/** Raycasts from the pointer when needed and updates hover, cursor and label. */
export function updatePicking(camera, label, blocked) {
  if (blocked || touchDown) {
    if (blocked) setHovered(null);
  } else if (needsRaycast) {
    setHovered(raycastAt(camera));
  }

  if (!hovered) {
    label.classList.remove("is-visible");
    return;
  }
  labelPosition.copy(hovered.userData.labelAnchor).project(camera);
  const x = ((labelPosition.x + 1) / 2) * window.innerWidth;
  const y = ((1 - labelPosition.y) / 2) * window.innerHeight;
  label.style.transform = `translate(${x}px, ${y}px) translate(-50%, -130%)`;
  label.classList.add("is-visible");
}

/** Returns the hitbox under the pointer, or null. */
function raycastAt(camera) {
  needsRaycast = false;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(hitboxes, false)[0]?.object ?? null;
}

function setHovered(hitbox) {
  if (hitbox === hovered) return;
  hovered = hitbox;
  document.body.style.cursor = hitbox ? "pointer" : "";
  const label = document.querySelector(".object-label");
  if (hitbox) label.textContent = hitbox.userData.action?.label ?? "";
}

/** Asks for a fresh raycast, for example after the camera moved. */
export function requestRaycast() {
  needsRaycast = true;
}

function setPointer(event) {
  pointer.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
  needsRaycast = true;
}

/**
 * Wires mouse and touch input. A mouse click runs the hovered object's action; on touch
 * the first tap selects (hover and label) and a second tap on the same object runs it.
 * A press that moves more than 6 px is a camera drag, never a click.
 */
export function setupPicking(canvas, camera, { isBlocked, onAction }) {
  canvas.addEventListener("pointerdown", (event) => {
    setPointer(event);
    pressPoint.x = event.clientX;
    pressPoint.y = event.clientY;
    pressPoint.moved = false;
    touchDown = event.pointerType === "touch";
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerType === "mouse") setPointer(event);
    if (Math.hypot(event.clientX - pressPoint.x, event.clientY - pressPoint.y) > 6) {
      pressPoint.moved = true;
    }
  });

  const endTouch = (event) => {
    if (event.pointerType !== "touch") return;
    touchDown = false;
    if (pressPoint.moved) pointer.set(10, 10);
    needsRaycast = true;
  };
  canvas.addEventListener("pointerup", endTouch);
  canvas.addEventListener("pointercancel", endTouch);

  canvas.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") setPointer({ clientX: -1e4, clientY: -1e4 });
  });

  canvas.addEventListener("click", () => {
    if (isBlocked() || pressPoint.moved) return;
    const hit = raycastAt(camera);
    if (hit) onAction(hit.userData.action);
  });

  canvas.addEventListener(
    "touchend",
    (event) => {
      // Stops the emulated click, which would run the action a second time.
      event.preventDefault();
      if (isBlocked() || pressPoint.moved) return;
      // touchend arrives before the next frame's raycast, so pick right here.
      const hit = raycastAt(camera);
      setHovered(hit);
      if (hit && hit === lastTapped) {
        lastTapped = null;
        // Move the touch point away so the label does not linger after the action.
        pointer.set(10, 10);
        needsRaycast = true;
        onAction(hit.userData.action);
      } else {
        lastTapped = hit;
      }
    },
    { passive: false }
  );
}
