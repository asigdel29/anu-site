// Springy motion for the island's interactive props: the intro pop-in and the hover
// grow-and-lift. Runs every frame for about a dozen objects.

import { findInteraction, letterNumber } from "./interactions.js";
import { spring } from "./motion.js";

const props = [];

/** Hover scale per object: the lying figure only breathes, stones barely grow. */
function hoverScaleFor(name) {
  if (name.includes("Anu_Figure")) return 1.05;
  if (name.includes("Stone_")) return 1.15;
  return 1.3;
}

/** Registers a prop at its rest pose. Intro props start hidden until startIntro(). */
export function addProp(object) {
  const letter = letterNumber(object.name);
  const hidden = Boolean(letter || findInteraction(object.name)?.intro);
  object.userData.motion = {
    restScale: object.scale.clone(),
    restY: object.position.y,
    hoverScale: hoverScaleFor(object.name),
    lifts: Boolean(letter) || object.name.includes("Stone_"),
    // Letters pop after every other prop, in their own order.
    introOrder: letter ? 100 + letter : props.length,
    popAt: hidden ? Infinity : 0,
    scale: { value: hidden ? 0 : 1, velocity: 0 },
    lift: { value: 0, velocity: 0 },
  };
  if (hidden) object.scale.setScalar(0);
  props.push(object);
}

/** Schedules the intro: props pop in one after another, then the letters bounce in. */
export function startIntro(time) {
  props
    .map((object) => object.userData.motion)
    .filter((motion) => motion.popAt === Infinity)
    .sort((a, b) => a.introOrder - b.introOrder)
    .forEach((motion, index) => {
      motion.popAt = time + index * 0.12;
    });
}

/** Steps every prop's springs toward its target: hidden, resting or hovered. */
export function animateProps(time, delta, hoveredObject) {
  for (const object of props) {
    const motion = object.userData.motion;
    const popped = time >= motion.popAt;
    const isHovered = object === hoveredObject;

    if (popped && motion.lifts && motion.scale.value === 0) motion.lift.velocity = 3;
    spring(motion.scale, popped ? (isHovered ? motion.hoverScale : 1) : 0, delta);
    spring(motion.lift, isHovered && motion.lifts ? 0.2 : 0, delta);

    object.scale.copy(motion.restScale).multiplyScalar(Math.max(motion.scale.value, 0));
    object.position.y = motion.restY + motion.lift.value;
  }
}
