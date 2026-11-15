/**
 * Camera zones (docs/claude-planning/18-3d-room-plan.md, round 36): one room, a camera that moves between places in
 * it. A zone is data (`room.zones`): where the camera stands and looks, the objects it is about, what Enter opens.
 * This file holds the defaults and the pure rules (order, stepping, picking a zone for an object, the look-around
 * limits), so the page and `scripts/room3d-check.mjs` run the same code. No three.js, no React.
 */
import type { Room, Zone } from "./schema";

/**
 * The defaults for the 8.0 x 6.0 x 3.0 m room (round 37a). Work: the desk on the back wall, left. Window wall: the
 * back wall, right. Sleep: the bed, the guitar and the MIDI keyboard on the right wall, back half. Shelf: the project
 * cases, the skills board and the skill stars on the right wall, front half. Chill: the TV, the console, the football and
 * the cube on the front wall, right. Wardrobe and entry: the wardrobe and the caps on the front wall, left; the key rack
 * and the riding set on the left wall, front half, with the door beside them; Wall: the certificates and the key moments
 * on the left wall, back half. `panel` names what Enter opens (see panels.ts); `act` names the object Enter acts on as a
 * click would (the wardrobe's doors, the guitar's chord). Zone ids are stable: the page, the tests and saved rooms use them.
 */
export const DEFAULT_ZONES: Zone[] = [
  { id: "desk", label: "Desk", order: 0, eye: [-1.2, 1.6, -0.3], look: [-1.2, 1.1, -2.8], objects: ["monitor-low", "keyboard", "mug", "notebook", "headset"], panel: "terminal" },
  { id: "screens", label: "Projects", order: 1, eye: [-1.2, 1.4, -1.1], look: [-1.2, 1.3, -2.8], objects: ["monitor-high"], panel: "projects" },
  { id: "hire", label: "Hire", order: 2, eye: [-1.9, 1.3, -0.9], look: [-1.62, 0.9, -2.37], objects: ["phone", "sticky"], panel: "hire" },
  { id: "window", label: "Window", order: 3, eye: [0.6, 1.55, 1.2], look: [1.9, 1.25, -3], objects: ["window"] },
  { id: "sleep", label: "Sleep", order: 4, eye: [0.2, 1.7, 0.3], look: [3.5, 0.6, -1.9], objects: ["bed", "guitar", "midi"], act: "guitar" },
  { id: "shelf", label: "Shelf", order: 5, eye: [-0.9, 1.6, 2.3], look: [3.95, 1.6, 2.3], objects: ["board-skills", "project-shelf", "constellation"], panel: "skills" },
  { id: "tv", label: "TV", order: 6, eye: [1.4, 1.15, 0.6], look: [1.4, 0.8, 2.95], objects: ["tv", "console"], panel: "tv" },
  { id: "chill", label: "Chill", order: 7, eye: [-1.2, 1.6, -0.3], look: [1.4, 0.55, 2.8], objects: ["football", "cube"] },
  { id: "wardrobe", label: "Wardrobe", order: 8, eye: [1.0, 1.8, -0.2], look: [-2.6, 1.0, 2.7], objects: ["wardrobe", "caps"], act: "wardrobe" },
  { id: "gear", label: "Riding", order: 9, eye: [-1.4, 1.5, -0.2], look: [-4, 1.15, 2.4], objects: ["riding-set", "key-rack"] },
  { id: "door", label: "Door", order: 10, eye: [-0.8, 1.45, 0.8], look: [-4, 1.1, 0.8], objects: ["door"], panel: "worlds" },
  { id: "wall", label: "Wall", order: 11, eye: [-0.8, 1.4, -1.1], look: [-4, 1.15, -1.35], objects: ["board-credentials", "board-moments"], panel: "credentials" },
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

/** The camera's vertical field of view: 34 degrees on a landscape screen, wider as the screen narrows so more of the same view fits across (portrait 393 x 852 is about 62). */
export function fovFor(aspect: number): number {
  return 34 + Math.max(0, Math.min(28, (1.4 - aspect) * 38));
}

/** How much closer to its target the camera stands on a narrow screen (1 = as the zone says): a phone sees a 1.3 m board only if it comes in. */
export function approachFor(aspect: number): number {
  return 1 - Math.max(0, Math.min(1, (1.2 - aspect) / 0.8)) * 0.3;
}

/** Frame rate independent easing: the fraction of the remaining distance to cover this frame (`rate` per second; 0 = at once, for reduced motion). */
export function damp(dt: number, rate: number): number {
  return rate <= 0 ? 1 : 1 - Math.exp(-rate * Math.max(0, dt));
}
