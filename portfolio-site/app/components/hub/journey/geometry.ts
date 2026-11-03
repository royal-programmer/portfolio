/**
 * Shared world layout for the light journey (D36). One place for the numbers,
 * mirrored into GLSL so meshes, particles and the camera agree.
 *
 *            beam (falls from the sky, slight tilt toward the viewer)
 *              │
 *              ▼
 *            ◢ prism ◣  ← camera starts in front (+z) and passes THROUGH it
 *              │
 *     ╲  ╲  ╲  │  ╱  ╱  ╱   the spectrum spreads as a river of light along the
 *      ╲  ╲  ╲ │ ╱  ╱  ╱    ground toward the horizon (−z); each persona is a
 *       worlds at the far end of their stream
 *
 * Coordinates: y up, the river flows toward −z. `s` is the across-river
 * coordinate (0…1); a persona's spectrum position `t` maps into the inner part
 * of the river so its stream never sits on the faded edge.
 */
import * as THREE from "three";

export const MAX_BANDS = 16;

// Prism cross-section (in the z–y plane), extruded along x.
export const PRISM = {
  apex: new THREE.Vector2(0, 1.15), // (z, y)
  front: new THREE.Vector2(1.15, -0.75),
  back: new THREE.Vector2(-1.15, -0.75),
  halfLength: 0.95,
};

/** Where the falling beam meets the front face, and where light leaves the back. */
export const HIT_LOCAL = new THREE.Vector3(0, 0.3, 0.514);
export const EXIT_LOCAL = new THREE.Vector3(0, 0.15, -0.605);
/** The prism is turned so its triangular face reads from the front. */
export const PRISM_YAW = -0.62;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
export const HIT = HIT_LOCAL.clone().applyAxisAngle(Y_AXIS, PRISM_YAW);
export const EXIT = EXIT_LOCAL.clone().applyAxisAngle(Y_AXIS, PRISM_YAW);
export const BEAM_TOP = HIT.clone().add(new THREE.Vector3(0, 45.7, 8.5));

export const RIVER = {
  angle: 0.95, // half-spread (radians) of the river
  length: 80,
  floor: -2.4,
  worldR: 44, // distance of each persona world along its stream
};

export const sFromT = (t: number) => 0.06 + 0.88 * t;
export const angleFromS = (s: number) => (s * 2 - 1) * RIVER.angle;

/** Height of the river surface at radius r (falls off the prism, then flat). */
export const riverY = (r: number) => EXIT.y - (EXIT.y - RIVER.floor) * (1 - Math.exp(-r / 3.5));

export function riverPoint(s: number, r: number, out = new THREE.Vector3()) {
  const a = angleFromS(s);
  return out.set(EXIT.x + Math.sin(a) * r, riverY(r), EXIT.z - Math.cos(a) * r);
}

export function worldPosition(t: number, out = new THREE.Vector3()) {
  return riverPoint(sFromT(t), RIVER.worldR, out).setY(RIVER.floor);
}

export const GEOMETRY_GLSL = /* glsl */ `
const float RIVER_ANGLE = ${RIVER.angle.toFixed(4)};
const float RIVER_LEN = ${RIVER.length.toFixed(1)};
const float RIVER_FLOOR = ${RIVER.floor.toFixed(3)};
const vec3 EXIT_P = vec3(${EXIT.x.toFixed(3)}, ${EXIT.y.toFixed(3)}, ${EXIT.z.toFixed(3)});
float riverY(float r) { return EXIT_P.y - (EXIT_P.y - RIVER_FLOOR) * (1.0 - exp(-r / 3.5)); }
float tFromS(float s) { return (s - 0.06) / 0.88; }
vec3 riverPoint(float s, float r, float fold) {
  float a = (s * 2.0 - 1.0) * RIVER_ANGLE * (1.0 - fold);
  return vec3(EXIT_P.x + sin(a) * r, riverY(r), EXIT_P.z - cos(a) * r);
}
`;

export const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
export const easeIn = (x: number) => Math.pow(Math.min(1, Math.max(0, x)), 2.2);

/** Deterministic PRNG (mulberry32) — stable particle layouts, pure renders. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
