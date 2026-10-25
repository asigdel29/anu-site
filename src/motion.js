// Frame-rate independent easing, used instead of a tween library.

/** True when the visitor asked for less motion; clouds and weather then hold still. */
export const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

/** Moves current toward target at the same speed at any frame rate. */
export function damp(current, target, smoothing, delta) {
  const next = current + (target - current) * (1 - Math.exp(-smoothing * delta));
  return Math.abs(target - next) < 0.001 ? target : next;
}
