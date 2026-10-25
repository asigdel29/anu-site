// Frame-rate independent easing and springs, used instead of a tween library.

/** True when the visitor asked for less motion; springs then jump straight to their target. */
export const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/** Moves current toward target at the same speed at any frame rate. */
export function damp(current, target, smoothing, delta) {
  const next = current + (target - current) * (1 - Math.exp(-smoothing * delta));
  return Math.abs(target - next) < 0.001 ? target : next;
}

/**
 * Advances a springy value ({ value, velocity }) toward target, with a small overshoot
 * that gives pops and hovers their bounce.
 */
export function spring(state, target, delta, stiffness = 170, damping = 13) {
  if (prefersReducedMotion) {
    state.value = target;
    state.velocity = 0;
    return;
  }
  const step = Math.min(delta, 1 / 30);
  state.velocity += ((target - state.value) * stiffness - state.velocity * damping) * step;
  state.value += state.velocity * step;
}
