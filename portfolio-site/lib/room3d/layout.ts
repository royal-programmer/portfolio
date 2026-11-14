/**
 * Floor plan rules for the room (round 37a): the footprints of what stands on the floor, whether the walking lane
 * stays clear, and whether a camera stop stands inside furniture. Pure (no three.js, no React), so the page's data
 * and `scripts/room3d-check.mjs` run the same code. Coordinates are metres, as in `schema.ts`; an object's `pos`
 * is the middle of its base and it faces +z before `rotY`, so a point (x, z) of the object lands at
 * `x' = px + x cos + z sin`, `z' = pz - x sin + z cos`.
 */
import type { Room, RoomObject } from "./schema";

export type Rect = { x0: number; x1: number; z0: number; z1: number };
export type FloorItem = { id: string; kind: RoomObject["kind"]; rect: Rect; h: number };

/** The width a visitor needs to walk between things (metres). */
export const LANE = 1.2;

type Local = { x0: number; x1: number; z0: number; z1: number; h: number };

/** The footprint in the object's own frame, for what stands on the floor; null for wall pieces and small things. */
function local(o: RoomObject): Local | null {
  const [, y] = o.transform.pos;
  const s = o.transform.scale;
  const box = (w: number, d: number, h: number, cx = 0, cz = 0): Local => ({ x0: cx - (w * s) / 2, x1: cx + (w * s) / 2, z0: cz - (d * s) / 2, z1: cz + (d * s) / 2, h: h * s });
  switch (o.kind) {
    case "desk":
      return box(o.params.w, o.params.d, o.params.h);
    case "bed":
      return box(o.params.size === "single" ? 0.98 : 1.53, 2.06, 0.9);
    case "wardrobe":
      return box(o.params.w, o.params.d, o.params.h);
    case "chair":
      return box(0.62, 0.62, 1.0);
    case "pcTower":
      return box(0.24, 0.5, o.params.h);
    case "plant":
      return box(0.34 * (o.params.height / 0.9), 0.34 * (o.params.height / 0.9), o.params.height);
    case "guitar":
      return o.params.stand ? box(0.5, 0.5, 1.2) : null;
    case "ridingSet":
      return box(0.8, 0.4, 0.3, 0, 0.15);
    case "box":
      return y < 0.05 && o.params.h >= 0.3 ? box(o.params.w, o.params.d, o.params.h) : null;
    case "cylinder":
      return y < 0.05 && o.params.h >= 0.3 ? box(o.params.r * 2, o.params.r * 2, o.params.h) : null;
    default:
      return null;
  }
}

/** Every object that stands on the floor, as a rectangle in room coordinates (rotated, then the bounding box). */
export function floorItems(room: Pick<Room, "objects">): FloorItem[] {
  const out: FloorItem[] = [];
  for (const o of room.objects) {
    const l = local(o);
    if (!l) continue;
    const c = Math.cos(o.transform.rotY);
    const sn = Math.sin(o.transform.rotY);
    const xs: number[] = [];
    const zs: number[] = [];
    for (const [x, z] of [[l.x0, l.z0], [l.x1, l.z0], [l.x0, l.z1], [l.x1, l.z1]]) {
      xs.push(o.transform.pos[0] + x * c + z * sn);
      zs.push(o.transform.pos[2] - x * sn + z * c);
    }
    out.push({ id: o.id, kind: o.kind, h: l.h, rect: { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) } });
  }
  return out;
}

export type LaneReport = {
  /** The cells (0.1 m) where a visitor of lane width fits: the whole disc is free of furniture and inside the walls. */
  cells: number;
  /** The biggest connected stretch of them, in cells. */
  main: number;
  /** True when the free stretch is one piece that holds the room's middle. */
  connected: boolean;
  /** Ids of floor objects with no lane cell within `reach` metres (a thing nobody can walk up to). */
  unreachable: string[];
};

/** Does a walking lane `width` wide run through the room, as one connected stretch, and can every floor object be reached? */
export function laneReport(room: Pick<Room, "objects" | "shell">, width = LANE, reach = 1.6): LaneReport {
  const cell = 0.1;
  const { width: W, depth: D } = room.shell;
  const nx = Math.round(W / cell);
  const nz = Math.round(D / cell);
  const items = floorItems(room);
  const blocked = new Uint8Array(nx * nz);
  const cx = (i: number) => -W / 2 + (i + 0.5) * cell;
  const cz = (j: number) => -D / 2 + (j + 0.5) * cell;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = cx(i);
      const z = cz(j);
      if (items.some((f) => x >= f.rect.x0 && x <= f.rect.x1 && z >= f.rect.z0 && z <= f.rect.z1)) blocked[i * nz + j] = 1;
    }
  const r = width / 2;
  const rc = Math.ceil(r / cell);
  const ok = new Uint8Array(nx * nz);
  let cells = 0;
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++) {
      const x = cx(i);
      const z = cz(j);
      if (x - r < -W / 2 || x + r > W / 2 || z - r < -D / 2 || z + r > D / 2) continue;
      let free = true;
      for (let a = -rc; a <= rc && free; a++)
        for (let b = -rc; b <= rc; b++) {
          if (a * a + b * b > (r / cell) * (r / cell)) continue;
          const ii = i + a;
          const jj = j + b;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || blocked[ii * nz + jj]) {
            free = false;
            break;
          }
        }
      if (free) {
        ok[i * nz + j] = 1;
        cells++;
      }
    }
  // Connected components (4-neighbour flood fill).
  const comp = new Int32Array(nx * nz).fill(-1);
  const sizes: number[] = [];
  for (let s = 0; s < nx * nz; s++) {
    if (!ok[s] || comp[s] >= 0) continue;
    const id = sizes.length;
    let n = 0;
    const stack = [s];
    comp[s] = id;
    while (stack.length) {
      const k = stack.pop()!;
      n++;
      const i = Math.floor(k / nz);
      const j = k % nz;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const t = ii * nz + jj;
        if (ok[t] && comp[t] < 0) {
          comp[t] = id;
          stack.push(t);
        }
      }
    }
    sizes.push(n);
  }
  const main = sizes.length ? Math.max(...sizes) : 0;
  const mainId = sizes.indexOf(main);
  const mid = comp[Math.min(nx - 1, Math.floor(nx / 2)) * nz + Math.min(nz - 1, Math.floor(nz / 2))];
  const unreachable: string[] = [];
  for (const f of items) {
    let near = false;
    for (let i = 0; i < nx && !near; i++)
      for (let j = 0; j < nz; j++) {
        if (comp[i * nz + j] !== mainId) continue;
        const x = cx(i);
        const z = cz(j);
        const dx = Math.max(f.rect.x0 - x, 0, x - f.rect.x1);
        const dz = Math.max(f.rect.z0 - z, 0, z - f.rect.z1);
        if (Math.hypot(dx, dz) <= reach) {
          near = true;
          break;
        }
      }
    if (!near) unreachable.push(f.id);
  }
  return { cells, main, connected: main > 0 && mid === mainId, unreachable };
}

/** A camera stop stands inside furniture when its eye is within the footprint (grown by `margin`) and lower than the piece's top. */
export function eyeInFurniture(eye: [number, number, number], items: readonly FloorItem[], margin = 0.12): string | null {
  for (const f of items) {
    if (eye[1] > f.h + 0.1) continue;
    if (eye[0] >= f.rect.x0 - margin && eye[0] <= f.rect.x1 + margin && eye[2] >= f.rect.z0 - margin && eye[2] <= f.rect.z1 + margin) return f.id;
  }
  return null;
}
