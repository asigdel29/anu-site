// Small seeded random numbers, so the sky and the city look the same on every visit.

/** Returns a function that gives the same sequence of numbers in [0, 1) for the same seed. */
export function seeded(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
