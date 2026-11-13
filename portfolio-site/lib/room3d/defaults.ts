/**
 * The default `room3d`: today's Stage data re-expressed (the clock bands' light from `STAGE_LIGHTING`, the
 * graphics tiers from `STAGE_TIERS`, the door from `STAGE_DOOR`, the desk props and their commands from
 * `STAGE_PROPS`) plus the work room's furniture from the P0 look-dev spike. Plain data, safe on server and
 * client. `scripts/settings-roundtrip.mjs` proves it parses.
 */
import { SHELF_MAX, STAGE_DOOR, STAGE_LIGHTING, STAGE_PROPS, STAGE_TIERS } from "@/lib/site/stage-data";
import type { KindId, Room, Room3d, RoomObject, Tier } from "./schema";
import { BAND_IDS } from "./schema";

type Mat = RoomObject["material"];
const M = (preset: Mat["preset"], color: string, roughness = 0.6): Mat => ({ preset, color, roughness });
const MAT_BY_KIND: Partial<Record<KindId, Mat>> = {
  desk: M("wood", "#a77a4d", 0.42),
  shelf: M("wood", "#4a3422", 0.55),
  chair: M("fabric", "#46507a", 0.9),
  rug: M("fabric", "#5b3b52", 1),
  plant: M("leaf", "#35623a", 0.7),
  frame: M("plastic", "#101116", 0.5),
  lamp: M("metal", "#e7a64a", 0.4),
  neonStrip: M("emissive", "#ff2d95", 0.5),
};
const FALLBACK = M("plastic", "#1a1c23", 0.5);

type Extra = { rotY?: number; scale?: number; material?: Mat; interaction?: RoomObject["interaction"]; hideOnPhone?: boolean };
function obj<K extends KindId>(id: string, kind: K, pos: [number, number, number], params: Extract<RoomObject, { kind: K }>["params"], x: Extra = {}): RoomObject {
  return {
    id,
    kind,
    params,
    transform: { pos, rotY: x.rotY ?? 0, scale: x.scale ?? 1 },
    material: x.material ?? MAT_BY_KIND[kind] ?? FALLBACK,
    ...(x.interaction ? { interaction: x.interaction } : {}),
    visibility: "public",
    hideOnPhone: x.hideOnPhone ?? false,
  } as RoomObject;
}

const propCmd = (id: string) => {
  const p = STAGE_PROPS.find((s) => s.id === id)!;
  return { label: p.label, cmd: p.cmd };
};

const DESK_Y = 0.77;
const OPEN_RAD = Math.round(((STAGE_DOOR.openDeg * Math.PI) / 180) * 100) / 100;

const workRoom: Room = {
  id: "work",
  label: "Work room",
  shell: { width: 6, depth: 5, height: 2.8, wallColor: "#8d93a8", floorMaterial: "wood", floorColor: "#7b5636" },
  lighting: Object.fromEntries(
    BAND_IDS.map((id) => {
      const l = STAGE_LIGHTING[id];
      return [id, { key: l.key, fill: l.fill, rim: l.rim, ambient: l.ambient, windowLight: l.windowLight, lampOn: l.lampOn, emissiveBoost: l.screenGlow }];
    }),
  ) as Room["lighting"],
  objects: [
    obj("desk", "desk", [0.3, 0, -2.12], { w: 2, h: 0.73, d: 0.72, shape: "straight" }),
    obj("monitor-low", "monitor", [0.3, DESK_Y, -2.3], { form: "curved", inches: 34, aspect: 2.33, curveRadius: 1.2, tilt: 0, lift: 0.27, screen: "terminal", stand: true }, { material: M("plastic", "#0d0e12", 0.4), interaction: { label: "terminal", cmd: "now" } }),
    obj("monitor-high", "monitor", [0.3, DESK_Y, -2.3], { form: "curved", inches: 34, aspect: 2.33, curveRadius: 1.2, tilt: -0.1, lift: 0.65, screen: "code", stand: false }, { material: M("plastic", "#0d0e12", 0.4) }),
    obj("monitor-left", "monitor", [-0.4, DESK_Y, -2.2], { form: "flat", inches: 24, aspect: 0.5625, curveRadius: 1.2, tilt: -0.06, lift: 0.3, screen: "code", stand: true }, { rotY: 0.5, material: M("plastic", "#0d0e12", 0.4) }),
    obj("monitor-right", "monitor", [1.0, DESK_Y, -2.2], { form: "flat", inches: 24, aspect: 0.5625, curveRadius: 1.2, tilt: -0.06, lift: 0.3, screen: "code", stand: true }, { rotY: -0.5, material: M("plastic", "#0d0e12", 0.4) }),
    obj("tablet", "tablet", [0.68, DESK_Y, -1.85], { inches: 11, tilt: 0.28, dock: true, screen: "code" }, { rotY: 0.15, material: M("plastic", "#0d0e12", 0.4) }),
    obj("phone", "phone", [-0.12, DESK_Y, -1.87], { inches: 6.7, tilt: 0.3, stand: true, screen: "code" }, { rotY: -0.2, material: M("plastic", "#0d0e12", 0.4), interaction: propCmd("phone") }),
    obj("keyboard", "keyboard", [0.3, DESK_Y, -1.98], { keys: "full", rgb: true }, { material: M("plastic", "#11131a", 0.5) }),
    obj("mouse", "mouse", [0.8, DESK_Y, -1.96], { mat: true, rgb: false }, { material: M("plastic", "#101116", 0.3) }),
    obj("headset", "headset", [1.15, DESK_Y, -1.9], { stand: true }, { material: M("plastic", "#14151a", 0.4), interaction: propCmd("headphones") }),
    obj("lamp", "lamp", [1.2, DESK_Y, -2.3], { form: "desk", height: 0.5, on: true }),
    obj("mug", "cylinder", [1.02, DESK_Y, -1.72], { r: 0.04, h: 0.09 }, { material: M("ceramic", "#e8e1d6", 0.35), interaction: propCmd("mug") }),
    obj("notebook", "box", [-0.35, DESK_Y, -1.8], { w: 0.2, h: 0.02, d: 0.15, round: 0.003 }, { rotY: 0.2, material: M("paper", "#cfd6f2", 0.8), interaction: propCmd("notebook") }),
    obj("sticky", "box", [-0.6, DESK_Y, -2.2], { w: 0.07, h: 0.003, d: 0.07, round: 0 }, { rotY: -0.3, material: M("paper", "#f6e27a", 0.9), interaction: propCmd("sticky") }),
    obj("pc", "pcTower", [1.7, 0, -2.2], { h: 0.5, glass: true, rgb: true, fans: 3 }, { material: M("metal", "#15161b", 0.35) }),
    obj("chair", "chair", [0.2, 0, -1.3], { style: "office" }, { rotY: Math.PI + 0.35 }),
    obj("shelf", "shelf", [-1.7, 0, -2.38], { w: 1, d: 0.24, tiers: 1, lift: 1.5 }),
    obj("books", "bookStack", [-1.95, 1.5175, -2.38], { count: 9, layout: "row" }, { material: M("paper", "#5a6aa8", 0.7) }),
    obj("plant", "plant", [2.3, 0, -2.2], { height: 0.9, leaves: 26, pot: "round" }),
    obj("window", "window", [2.2, 0, -2.49], { w: 0.8, h: 1.1, lift: 0.9, panes: 2 }, { material: M("plastic", "#d9d4cc", 0.6) }),
    obj("clock", "clock", [-0.55, 0, -2.49], { diameter: 0.34, lift: 2.1, ownerZone: "Asia/Kolkata", digital: true }, { material: M("plastic", "#e8e1d6", 0.5), interaction: { label: "time", card: "Owner time (Asia/Kolkata) and yours." } }),
    obj("neon-top", "neonStrip", [0.3, 0, -2.47], { length: 1.3, vertical: false, lift: 2.05, intensity: 3.2 }),
    obj("neon-corner", "neonStrip", [-2.95, 0, -2.45], { length: 2.2, vertical: true, lift: 0.2, intensity: 3.2 }, { material: M("emissive", "#2fd0ff", 0.5) }),
    obj("poster-a", "frame", [-2.97, 1.5, -0.6], { variant: "poster", w: 0.7, h: 0.5, title: "poster" }, { rotY: Math.PI / 2 }),
    obj("poster-b", "frame", [-2.97, 1.35, 0.1], { variant: "poster", w: 0.32, h: 0.42, title: "poster" }, { rotY: Math.PI / 2 }),
    // The Stage's own two: the project cases on the right wall, the skill stars above the desk (data comes from the page).
    obj("project-shelf", "projectShelf", [2.86, 0.72, -0.4], { max: SHELF_MAX }, { rotY: -Math.PI / 2, scale: 0.35 }),
    obj("constellation", "constellation", [0.3, 2.15, -1.9], { stars: STAGE_TIERS.best.stars }, { scale: 0.5 }),
    obj("rug", "rug", [0.2, 0, -1.1], { w: 2.2, d: 1.6, shape: "rect" }),
    obj("door", "door", [-2.98, 0, 1.2], { w: STAGE_DOOR.size[0], h: STAGE_DOOR.size[1], swing: OPEN_RAD, leadsTo: STAGE_DOOR.label }, { rotY: Math.PI / 2, material: M("wood", "#6b4a30", 0.6), interaction: { label: STAGE_DOOR.label, href: `/?${STAGE_DOOR.query}` } }),
  ],
};

const tier = (t: (typeof STAGE_TIERS)[keyof typeof STAGE_TIERS], x: Omit<Tier, "dprCap">): Tier => ({ dprCap: t.dpr, ...x });

export const ROOM3D_DEFAULT: Room3d = {
  activeRoom: "work",
  rooms: [workRoom],
  tiers: {
    low: tier(STAGE_TIERS.performance, { aoOn: false, shadowRes: 0, bloomOn: false, textureSize: 256, objectBudget: 60 }),
    medium: tier(STAGE_TIERS.balanced, { aoOn: true, shadowRes: 1024, bloomOn: false, textureSize: 512, objectBudget: 120 }),
    high: tier(STAGE_TIERS.best, { aoOn: true, shadowRes: 2048, bloomOn: true, textureSize: 512, objectBudget: 200 }),
  },
  quality: "auto",
};
