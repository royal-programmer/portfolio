/**
 * The football's physics (round 37d), hand-rolled: gravity, a bounce that keeps about 0.6 of the speed, rolling friction, sleep after
 * 2 s at rest, and collisions with the floor, the walls, the ceiling and the floor items' footprints (each a box with its height).
 * One ball, a few dozen lines: no physics library. Pure (no three.js, no React), so the page and `scripts/room3d-check.mjs` run
 * the same code. Units are metres and seconds, world coordinates (the room is centred on the origin, the floor is y = 0).
 */
export type V3 = [number, number, number];
export type BallBox = { x0: number; x1: number; z0: number; z1: number; h: number };
export type BallWorld = { W: number; D: number; H: number; boxes: readonly BallBox[] };
export type Ball = { p: V3; v: V3; /** Seconds spent (almost) still while resting on something. */ rest: number; asleep: boolean };

export const GRAVITY = 9.81;
export const RESTITUTION = 0.6;
/** Speed lost per second while rolling on a surface (m/s^2). */
export const ROLL_DECEL = 0.7;
export const SLEEP_AFTER = 2;
const STEP = 1 / 120;
const WALL_BOUNCE = 0.55;

export const newBall = (p: V3): Ball => ({ p: [...p], v: [0, 0, 0], rest: 0, asleep: false });
const finite = (a: readonly number[]) => a.every((x) => Number.isFinite(x));

/** Wakes the ball with an impulse (a kick): a new velocity, added to what it has. */
export function kick(b: Ball, dv: V3): void {
  b.v = [b.v[0] + dv[0], b.v[1] + dv[1], b.v[2] + dv[2]];
  b.asleep = false;
  b.rest = 0;
}

/** The kick a click gives: away from the camera along its ray (flattened), a little random sideways, with an upward part. `rand` is -1..1. */
export function kickFromRay(dir: V3, speed = 4.2, up = 2.4, rand = 0): V3 {
  const h = Math.hypot(dir[0], dir[2]) || 1;
  const a = rand * 0.22;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const x = dir[0] / h;
  const z = dir[2] / h;
  return [(x * c - z * s) * speed, up, (x * s + z * c) * speed];
}

function substep(b: Ball, dt: number, r: number, w: BallWorld): void {
  const [p, v] = [b.p, b.v];
  let grounded = false;
  v[1] -= GRAVITY * dt;
  p[0] += v[0] * dt;
  p[1] += v[1] * dt;
  p[2] += v[2] * dt;
  // The boxes first (a ball on a unit's top, or against its side), then the room's own surfaces.
  for (const bx of w.boxes) {
    if (p[1] - r >= bx.h) continue;
    const cx = Math.min(Math.max(p[0], bx.x0), bx.x1);
    const cz = Math.min(Math.max(p[2], bx.z0), bx.z1);
    const dx = p[0] - cx;
    const dz = p[2] - cz;
    const d = Math.hypot(dx, dz);
    if (d === 0) {
      // The centre is over the footprint: land on top when above it, else push out through the nearest side.
      if (p[1] >= bx.h - 0.02) {
        p[1] = bx.h + r;
        if (v[1] < -0.4) v[1] = -v[1] * RESTITUTION;
        else v[1] = 0;
        grounded = true;
      } else {
        const out = [p[0] - bx.x0, bx.x1 - p[0], p[2] - bx.z0, bx.z1 - p[2]];
        const k = out.indexOf(Math.min(...out));
        if (k === 0) { p[0] = bx.x0 - r; v[0] = -Math.abs(v[0]) * WALL_BOUNCE; }
        else if (k === 1) { p[0] = bx.x1 + r; v[0] = Math.abs(v[0]) * WALL_BOUNCE; }
        else if (k === 2) { p[2] = bx.z0 - r; v[2] = -Math.abs(v[2]) * WALL_BOUNCE; }
        else { p[2] = bx.z1 + r; v[2] = Math.abs(v[2]) * WALL_BOUNCE; }
      }
    } else if (d < r) {
      const nx = dx / d;
      const nz = dz / d;
      p[0] = cx + nx * r;
      p[2] = cz + nz * r;
      const vn = v[0] * nx + v[2] * nz;
      if (vn < 0) {
        v[0] -= (1 + WALL_BOUNCE) * vn * nx;
        v[2] -= (1 + WALL_BOUNCE) * vn * nz;
      }
    }
  }
  if (p[1] < r) {
    p[1] = r;
    if (v[1] < -0.4) v[1] = -v[1] * RESTITUTION;
    else v[1] = 0;
    grounded = true;
  }
  if (p[1] > w.H - r) {
    p[1] = w.H - r;
    if (v[1] > 0) v[1] = -v[1] * 0.4;
  }
  const hx = w.W / 2 - r;
  const hz = w.D / 2 - r;
  if (p[0] < -hx) { p[0] = -hx; v[0] = Math.abs(v[0]) * WALL_BOUNCE; }
  if (p[0] > hx) { p[0] = hx; v[0] = -Math.abs(v[0]) * WALL_BOUNCE; }
  if (p[2] < -hz) { p[2] = -hz; v[2] = Math.abs(v[2]) * WALL_BOUNCE; }
  if (p[2] > hz) { p[2] = hz; v[2] = -Math.abs(v[2]) * WALL_BOUNCE; }
  // Rolling friction (only while it touches something), a touch of air drag.
  const sp = Math.hypot(v[0], v[2]);
  if (sp > 0) {
    const k = grounded ? Math.max(0, sp - ROLL_DECEL * dt) / sp : 1;
    const drag = Math.exp(-0.15 * dt);
    v[0] *= k * drag;
    v[2] *= k * drag;
  }
  const slow = Math.hypot(v[0], v[1], v[2]) < 0.1;
  b.rest = grounded && slow ? b.rest + dt : 0;
  if (b.rest >= SLEEP_AFTER) {
    b.asleep = true;
    b.v = [0, 0, 0];
  }
}

/** Advances the ball by `dt` seconds in fixed sub-steps (a long frame cannot tunnel). A bad number resets it to `home`; the ball is always clamped inside the room. */
export function stepBall(b: Ball, dt: number, r: number, w: BallWorld, home: V3): void {
  if (b.asleep) return;
  let left = Math.min(Math.max(dt, 0), 0.1);
  while (left > 1e-6 && !b.asleep) {
    const d = Math.min(STEP, left);
    substep(b, d, r, w);
    left -= d;
  }
  if (!finite(b.p) || !finite(b.v)) {
    b.p = [...home];
    b.v = [0, 0, 0];
    b.rest = 0;
    b.asleep = false;
  }
  b.p[0] = Math.min(Math.max(b.p[0], -w.W / 2 + r), w.W / 2 - r);
  b.p[2] = Math.min(Math.max(b.p[2], -w.D / 2 + r), w.D / 2 - r);
  b.p[1] = Math.min(Math.max(b.p[1], r), w.H - r);
}
