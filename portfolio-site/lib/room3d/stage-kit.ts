/**
 * The Stage on the room kit (17-persona-views.md section 33): the pure rules that decide whether the Stage draws
 * through `<Room>`, which quality tier it gets from the hub gate's Performance / Balanced / Quality pick, where the
 * scroll story's camera stops stand in a room, and what a click on an object means. No three.js, no React: the page
 * and `scripts/room3d-check.mjs` run the same code.
 */
import type { StageTierId } from "@/lib/site/stage-data";
import type { Room, RoomObject, TierId } from "./schema";
import { TIER_IDS } from "./schema";
import { parseQuality, pickTier, type DeviceProbe } from "./tiers";

/**
 * Is the engineer's 3D view the full-screen room (the kit)? `?kit=0` (or false / off) falls back to the old scene for
 * this release and `?kit=1` forces the room; without a query the build's `NEXT_PUBLIC_STAGE_KIT` decides: the room
 * is the default (round 36), so only 0, false or off turns it off.
 */
export function stageKitOn(search: string, env?: string | null): boolean {
  const q = new URLSearchParams(search).get("kit")?.toLowerCase();
  if (q === "1" || q === "true" || q === "on") return true;
  if (q === "0" || q === "false" || q === "off") return false;
  const e = (env ?? "").trim().toLowerCase();
  return !(e === "0" || e === "false" || e === "off");
}

/** The hub gate's three choices, as the kit's tiers. */
export const GATE_TIER: Record<StageTierId, TierId> = { performance: "low", balanced: "medium", best: "high" };

const lower = (a: TierId, b: TierId): TierId => TIER_IDS[Math.min(TIER_IDS.indexOf(a), TIER_IDS.indexOf(b))];

/**
 * The kit tier for the Stage. `?q=` wins; then the visitor's gate pick; else the `room3d` setting (`auto` probes the
 * device). A step-down from the first seconds' frame times (`stepped`, in the gate's words) only ever lowers it.
 */
export function stageKitTier(a: { query: string | null; gate: StageTierId | null; stepped: StageTierId | null; setting: TierId | "auto"; probe: DeviceProbe }): TierId {
  const q = parseQuality(a.query);
  if (q && q !== "auto") return q;
  const base: TierId = a.gate ? GATE_TIER[a.gate] : a.setting === "auto" ? pickTier(a.probe) : a.setting;
  return a.stepped ? lower(base, GATE_TIER[a.stepped]) : base;
}

/** The desk props of the old Stage and the room object each one is (the headphones are the room's headset). */
export const STAGE_PROP_OBJECT: Record<string, string> = { mug: "mug", notebook: "notebook", phone: "phone", headphones: "headset", sticky: "sticky" };
const OBJECT_PROP = Object.fromEntries(Object.entries(STAGE_PROP_OBJECT).map(([p, o]) => [o, p]));
/** The prop id for a room object (the old Stage's `STAGE_PROPS` id), if it is one. */
export const propForObject = (objectId: string): string | null => OBJECT_PROP[objectId] ?? null;

/** What a click on an object does on the Stage. */
export type StageAction = { do: "zoom" } | { do: "door" } | { do: "prop"; prop: string } | { do: "cmd"; cmd: string } | { do: "href"; href: string } | { do: "card"; text: string } | { do: "none" };

export function stageAction(o: Pick<RoomObject, "id" | "kind" | "interaction"> & { params?: unknown }): StageAction {
  // The terminal monitor is the laptop's screen of the old Stage: a click zooms into it and opens the terminal.
  if (o.kind === "monitor" && (o.params as { screen?: string } | undefined)?.screen === "terminal") return { do: "zoom" };
  if (o.kind === "door") return { do: "door" };
  const prop = propForObject(o.id);
  if (prop) return { do: "prop", prop };
  const it = o.interaction;
  if (!it) return { do: "none" };
  if ("cmd" in it) return it.cmd ? { do: "cmd", cmd: it.cmd } : { do: "none" };
  if ("href" in it) return { do: "href", href: it.href };
  return { do: "card", text: it.card };
}

export type Vec3 = [number, number, number];
export type KitStop = { id: "shelf" | "constellation" | "window"; eye: Vec3; look: Vec3 };

/** Where the eye stands for an object that faces `rotY`: `dist` out along its normal, a little above its middle. */
function standIn(o: RoomObject, lookUp: number, dist: number, room: Room): { eye: Vec3; look: Vec3 } {
  const [x, y, z] = o.transform.pos;
  const nx = Math.sin(o.transform.rotY);
  const nz = Math.cos(o.transform.rotY);
  const look: Vec3 = [x, y + lookUp, z];
  const limX = room.shell.width / 2 - 0.15;
  const limZ = room.shell.depth / 2 - 0.15;
  const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
  return { look, eye: [clamp(x + nx * dist, limX), look[1] + 0.25, clamp(z + nz * dist, limZ)] };
}

/**
 * The scroll story's stops 1 to 3 (the desk, stop 0, is the resting camera), from where the room keeps the project
 * shelf, the constellation and the window. A room without one of them simply has no stop for it (the rig skips it).
 */
export function stageStops(room: Room): KitStop[] {
  const out: KitStop[] = [];
  const find = (k: RoomObject["kind"]) => room.objects.find((o) => o.kind === k);
  const shelf = find("projectShelf");
  if (shelf) out.push({ id: "shelf", ...standIn(shelf, 2.4 * shelf.transform.scale, Math.min(4.2, Math.max(1.8, 7.5 * shelf.transform.scale)), room) });
  const sky = find("constellation");
  if (sky) out.push({ id: "constellation", ...standIn(sky, 2.2 * sky.transform.scale, Math.min(4.2, Math.max(1.8, 7 * sky.transform.scale)), room) });
  const win = find("window");
  if (win) {
    const w = win.params as { lift: number; h: number };
    out.push({ id: "window", ...standIn(win, w.lift + w.h / 2, 2.6, room) });
  }
  return out;
}
