/**
 * Camera zones (docs/claude-planning/18-3d-room-plan.md, round 36): one room, a camera that moves between places in
 * it. A zone is data (`room.zones`): where the camera stands and looks, the objects it is about, what Enter opens.
 * This file holds the defaults and the pure rules (order, stepping, picking a zone for an object, the look-around
 * limits), so the page and `scripts/room3d-check.mjs` run the same code. No three.js, no React.
 */
import type { Room, Zone } from "./schema";

/**
 * The defaults for the 6.0 x 5.0 x 2.8 m room. The desk stands against the back wall, the Stage's project cases and
 * the skills board on the right wall, the TV on the front wall, the certificate and moment boards and the door on
 * the left wall. `panel` names what Enter opens (see panels.ts).
 */
export const DEFAULT_ZONES: Zone[] = [
  { id: "desk", label: "Desk", order: 0, eye: [0.3, 1.5, -0.2], look: [0.3, 1.1, -2.3], objects: ["monitor-low", "keyboard", "mug", "notebook", "headset"], panel: "terminal" },
  { id: "screens", label: "Projects", order: 1, eye: [0.3, 1.4, -0.6], look: [0.3, 1.3, -2.3], objects: ["monitor-high"], panel: "projects" },
  { id: "shelf", label: "Shelf", order: 2, eye: [-0.3, 1.45, 0.55], look: [2.95, 1.15, 0.55], objects: ["board-skills", "project-shelf"], panel: "skills" },
  { id: "tv", label: "TV", order: 3, eye: [0.4, 1.2, -0.2], look: [0.4, 0.85, 2.45], objects: ["tv", "console"], panel: "tv" },
  { id: "wall", label: "Wall", order: 4, eye: [0.3, 1.4, -0.6], look: [-3, 1.15, -0.75], objects: ["board-credentials", "board-moments"], panel: "credentials" },
  { id: "door", label: "Door", order: 5, eye: [1.0, 1.45, 1.2], look: [-3, 1.1, 1.2], objects: ["door"], panel: "worlds" },
  { id: "hire", label: "Hire", order: 6, eye: [0.1, 1.3, -0.4], look: [-0.15, 0.9, -1.87], objects: ["phone", "sticky"], panel: "hire" },
];

/** The room's zones, in chip order (a room without any gets the defaults). Ties keep the stored order. */
export function orderedZones(room: Pick<Room, "zones">): Zone[] {
  const z = room.zones && room.zones.length > 0 ? room.zones : DEFAULT_ZONES;
  return z.map((x, i) => ({ x, i })).sort((a, b) => a.x.order - b.x.order || a.i - b.i).map((p) => p.x);
}

/** The zone one step on (`dir` 1) or back (-1) from `id`, wrapping at both ends; the first zone when `id` is unknown. */
export function stepZone(zones: readonly Zone[], id: string | null, dir: 1 | -1): Zone {
  const i = zones.findIndex((z) => z.id === id);
  if (i < 0) return zones[0];
  return zones[(i + dir + zones.length) % zones.length];
}

/** The zone whose `objects` name this object (the first, in order), else null. */
export function zoneForObject(zones: readonly Zone[], objectId: string): Zone | null {
  return zones.find((z) => z.objects.includes(objectId)) ?? null;
}

/** Look-around limits: how far the visitor may turn the camera from the zone's own view (radians). */
export const LOOK_LIMIT = { yaw: 0.42, pitch: 0.22 } as const;

/** A drag turns the camera by this many radians per pixel of the viewport's height, then is clamped to `LOOK_LIMIT`. */
export function lookFromDrag(start: { yaw: number; pitch: number }, dx: number, dy: number, viewportH: number): { yaw: number; pitch: number } {
  const k = 1.1 / Math.max(240, viewportH);
  const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
  return { yaw: clamp(start.yaw + dx * k, LOOK_LIMIT.yaw), pitch: clamp(start.pitch + dy * k, LOOK_LIMIT.pitch) };
}

/** A sideways flick (fast, mostly horizontal, long enough) steps to the next or the previous zone; anything else is a look-around drag. */
export function flick(dx: number, dy: number, ms: number): 1 | -1 | 0 {
  if (ms <= 0 || ms > 450) return 0;
  const ax = Math.abs(dx);
  if (ax < 90 || ax < Math.abs(dy) * 1.8) return 0;
  return dx < 0 ? 1 : -1;
}

/** The camera's vertical field of view: 34 degrees on a landscape screen, wider as the screen narrows so the same view still fits across (portrait 393 x 852 is about 70). */
export function fovFor(aspect: number): number {
  return 34 + Math.max(0, Math.min(36, (1.4 - aspect) * 45));
}

/** Frame rate independent easing: the fraction of the remaining distance to cover this frame (`rate` per second; 0 = at once, for reduced motion). */
export function damp(dt: number, rate: number): number {
  return rate <= 0 ? 1 : 1 - Math.exp(-rate * Math.max(0, dt));
}
