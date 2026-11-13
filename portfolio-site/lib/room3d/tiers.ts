/**
 * Quality tiers and the object budget (18-3d-room-plan.md sections 2 and 5). Pure functions: the device
 * probe is passed in, so the same code runs in the page and in `scripts/room3d-check.mjs`.
 */
import type { Room, RoomObject, Tier, TierId } from "./schema";
import { TIER_IDS } from "./schema";

export type DeviceProbe = {
  /** `navigator.hardwareConcurrency` (0 or undefined when unknown). */
  cores?: number;
  /** `navigator.deviceMemory` in GB (Chromium only). */
  memory?: number;
  saveData?: boolean;
  /** A narrow touch screen. */
  phone?: boolean;
  /** The median frame time of the first frames, ms (undefined before it is measured). */
  frameMs?: number;
};

/** A first guess from the hardware alone; the first frames' timing can only lower it (`stepDown`). */
export function pickTier(p: DeviceProbe): TierId {
  if (p.saveData) return "low";
  const cores = p.cores ?? 4;
  const memory = p.memory ?? (p.phone ? 4 : 8);
  let tier: TierId = cores >= 8 && memory >= 8 && !p.phone ? "high" : cores >= 4 && memory >= 4 ? "medium" : "low";
  // A phone never starts above medium, whatever its core count: fill rate is the limit (plan section 5).
  if (p.phone && tier === "high") tier = "medium";
  if (p.phone && (memory < 6 || cores < 8)) tier = "low";
  if (p.frameMs !== undefined) tier = stepDown(tier, p.frameMs);
  return tier;
}

/** One tier lower when the measured frame time is over budget (30 fps = 33 ms), twice over 50 ms. */
export function stepDown(tier: TierId, frameMs: number): TierId {
  const i = TIER_IDS.indexOf(tier);
  const drop = frameMs > 50 ? 2 : frameMs > 33 ? 1 : 0;
  return TIER_IDS[Math.max(0, i - drop)];
}

/** `?q=low|medium|high|auto` (also the words the hub gate uses). Anything else is ignored. */
export function parseQuality(v: string | null | undefined): TierId | "auto" | null {
  switch ((v ?? "").toLowerCase()) {
    case "low":
    case "performance":
      return "low";
    case "medium":
    case "balanced":
      return "medium";
    case "high":
    case "best":
    case "quality":
      return "high";
    case "auto":
      return "auto";
    default:
      return null;
  }
}

/** The tier to use: the URL wins, then the visitor's saved pick, then the setting; `auto` probes the device. */
export function resolveTier(args: { query: string | null; saved: string | null; setting: TierId | "auto"; probe: DeviceProbe }): TierId {
  const want = parseQuality(args.query) ?? parseQuality(args.saved) ?? args.setting;
  return want === "auto" ? pickTier(args.probe) : want;
}

/** What is cut first when the budget bites: lower number = kept longer. Anything unlisted goes last. */
const PRIORITY: Partial<Record<RoomObject["kind"], number>> = {
  desk: 0, monitor: 0, door: 0, window: 0, chair: 1, tv: 1, bed: 1, pcTower: 1, keyboard: 1, tablet: 2, phone: 2, wardrobe: 2, lamp: 2, neonStrip: 2, clock: 3, frame: 3, shelf: 3, rug: 3,
  console: 3, mouse: 3, guitar: 4, midiKeyboard: 4, plant: 4, bag: 4, ridingSet: 4, capRow: 5, keyRack: 5, headset: 5, speaker: 5, bookStack: 6, box: 7, cylinder: 7, sphere: 7,
};

/** The objects to draw: drafts and (on a phone) `hideOnPhone` ones dropped, then cut to the budget by kind priority (stable). */
export function trimToBudget(objects: readonly RoomObject[], budget: number, opts: { phone: boolean; includeDraft: boolean }): RoomObject[] {
  const shown = objects.filter((o) => (opts.includeDraft || o.visibility === "public") && !(opts.phone && o.hideOnPhone));
  if (shown.length <= budget) return shown;
  const keep = new Set(
    shown
      .map((o, i) => ({ o, i, p: PRIORITY[o.kind] ?? 9 }))
      .sort((a, b) => a.p - b.p || a.i - b.i)
      .slice(0, budget)
      .map((x) => x.o.id),
  );
  return shown.filter((o) => keep.has(o.id));
}

/** The active room, or the first one (a settings value can name a room that is gone). */
export const activeRoom = (v: { activeRoom: string; rooms: Room[] }): Room => v.rooms.find((r) => r.id === v.activeRoom) ?? v.rooms[0];

export const tierConfig = (tiers: Record<TierId, Tier>, id: TierId): Tier => tiers[id];
