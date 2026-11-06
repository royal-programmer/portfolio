/** Small shared maths for the VR journey scene. */
import * as THREE from "three";

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeIn = (x: number) => Math.pow(clamp01(x), 2.2);
export const easeInOut = (x: number) => {
  const u = clamp01(x);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};

/** Deterministic PRNG (mulberry32) — stable layouts, pure renders. */
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

/**
 * The world. The viewer (camera) waits at the origin looking −z. The light
 * comes from LIGHT_FROM. After impact the split opens as a cone whose apex
 * is just below the viewer, axis +y.
 */
export const WORLD = {
  lightFrom: new THREE.Vector3(0, 0, -60),
  coneApex: new THREE.Vector3(0, -4.2, 0),
  coneHalfAngle: 0.6, // radians (~34°): ~2.9 wide at eye level, ~5 wide where the climb starts
  coneHeight: 140,
  /** Height gained per page section while climbing. */
  climbRise: 9,
  /** Turn per section (radians). */
  climbTurn: Math.PI * 0.5,
  /** Pitch the J ends on (radians up from level). */
  splitPitch: THREE.MathUtils.degToRad(78),
};

/** Radius of the cone at height h above the apex. */
export const coneRadius = (h: number) => Math.max(0, h) * Math.tan(WORLD.coneHalfAngle);

/** Height the J ends on; the climb starts here. */
export const CLIMB_BASE_Y = 3.2;

export type Pose = { pos: THREE.Vector3; yaw: number; pitch: number; fwd: THREE.Vector3; right: THREE.Vector3 };
export const makePose = (): Pose => ({ pos: new THREE.Vector3(), yaw: 0, pitch: 0, fwd: new THREE.Vector3(), right: new THREE.Vector3() });

/**
 * Where the camera is and where it looks at climb progress `c` (page
 * sections): a helix inside the cone, tilting from the J's pitch back to level.
 * The object field is laid out against the same curve, so what the camera
 * meets is always in front of it.
 */
export function climbPose(c: number, out: Pose = makePose()): Pose {
  const y = CLIMB_BASE_Y + c * WORLD.climbRise;
  const theta = c * WORLD.climbTurn;
  const rCone = coneRadius(y - WORLD.coneApex.y);
  // Stay well inside the cone: the rays are the view, the wall is the horizon.
  const r = THREE.MathUtils.lerp(0.3, rCone * 0.22, THREE.MathUtils.smoothstep(c, 0, 0.7));
  out.pos.set(Math.sin(theta) * r, y, -Math.cos(theta) * r);
  out.pitch = WORLD.splitPitch * (1 - THREE.MathUtils.smoothstep(c, 0, 1.05));
  out.yaw = -Math.PI / 2 - theta; // along the tangent
  const cp = Math.cos(out.pitch);
  out.fwd.set(Math.sin(out.yaw) * cp, Math.sin(out.pitch), -Math.cos(out.yaw) * cp);
  out.right.set(Math.cos(out.yaw), 0, Math.sin(out.yaw));
  return out;
}

export const SOFT_POINT_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a * 2.0, a);
}
`;
