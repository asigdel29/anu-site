// The scroll tour: the camera stops around the island and the maths that moves the camera
// between them. Pure data and functions (no DOM, no WebGL), so Node tests them.

/**
 * Tour stops, in scroll order. Site space is Y-up, in metres, with the island centre at the
 * origin and the grass at y = 0.
 * - camera: [azimuth in degrees (atan2(z, x)), distance from the island's axis, height].
 * - target: the point the camera looks at. Prop stops look at the props that
 *   tools/blender/props.py places (tests/tour.test.js checks them against the mesh pack).
 * - marker and action: the bubble over the prop and what it opens (a dialog or a link).
 * From the second stop on, azimuths only grow, so the camera circles the island one way.
 */
export const STOPS = [
  { id: "hey", title: "hey, i'm anu", camera: [48.7, 27.3, 7.5], target: [0, 1.6, 0] },
  {
    id: "about",
    title: "that's me",
    marker: "about me",
    action: "about",
    camera: [22, 8.2, 2.7],
    target: [1.76, 1.6, 0.37],
  },
  {
    id: "work",
    title: "what i'm building",
    marker: "my work",
    action: "work",
    camera: [109, 6.8, 2.2],
    target: [-0.17, 1.0, 1.99],
  },
  {
    id: "writing",
    title: "things i write",
    marker: "writing",
    action: "https://sigdel29.substack.com",
    camera: [184, 6.4, 1.9],
    target: [-2.07, 0.7, 0.36],
  },
  {
    id: "contact",
    title: "say hey",
    marker: "say hey",
    action: "contact",
    camera: [294, 7.0, 2.3],
    target: [0.36, 1.45, -2.07],
  },
  { id: "city", title: "new york, live", camera: [408.7, 34, 16], target: [0, 2, 0] },
];

const LAST = STOPS.length - 1;

const lerp = (from, to, t) => from + (to - from) * t;

/** Eases in and out, so the camera settles at each stop and speeds up between them. */
const smoothstep = (t) => t * t * (3 - 2 * t);

/** Keeps a tour progress (0 = first stop, STOPS.length - 1 = last stop) inside the tour. */
export const clampProgress = (progress) => Math.min(Math.max(progress, 0), LAST);

/** The index of the stop closest to a tour progress. */
export const nearestStop = (progress) => Math.round(clampProgress(progress));

/**
 * Writes the camera position and look target for a tour progress into position and target
 * (anything with x, y and z, such as a three.js Vector3). Between stops the camera moves around
 * the island's axis, not through it. zoom above 1 steps the camera back from the target, which
 * narrow phone screens need.
 */
export function tourPose(progress, zoom, position, target) {
  const clamped = clampProgress(progress);
  const index = Math.min(Math.floor(clamped), LAST - 1);
  const t = smoothstep(clamped - index);
  const from = STOPS[index];
  const to = STOPS[index + 1];

  target.x = lerp(from.target[0], to.target[0], t);
  target.y = lerp(from.target[1], to.target[1], t);
  target.z = lerp(from.target[2], to.target[2], t);

  const angle = (lerp(from.camera[0], to.camera[0], t) * Math.PI) / 180;
  const radius = lerp(from.camera[1], to.camera[1], t);
  const height = lerp(from.camera[2], to.camera[2], t);
  position.x = target.x + (radius * Math.cos(angle) - target.x) * zoom;
  position.y = target.y + (height - target.y) * zoom;
  position.z = target.z + (radius * Math.sin(angle) - target.z) * zoom;
}
