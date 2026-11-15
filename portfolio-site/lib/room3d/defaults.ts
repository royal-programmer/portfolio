/**
 * The default `room3d`: today's Stage data re-expressed (the clock bands' light from `STAGE_LIGHTING`, the
 * graphics tiers from `STAGE_TIERS`, the door from `STAGE_DOOR`, the desk props and their commands from
 * `STAGE_PROPS`) plus the work room's furniture from the P0 look-dev spike. Plain data, safe on server and
 * client. `scripts/settings-roundtrip.mjs` proves it parses.
 */
import { SHELF_MAX, STAGE_DOOR, STAGE_LIGHTING, STAGE_PROPS, STAGE_TIERS } from "@/lib/site/stage-data";
import type { KindId, Room, Room3d, RoomObject, Tier } from "./schema";
import { BAND_IDS } from "./schema";
import { DEFAULT_ZONES } from "./zones";

type Mat = RoomObject["material"];
const M = (preset: Mat["preset"], color: string, roughness = 0.6): Mat => ({ preset, color, roughness });
const MAT_BY_KIND: Partial<Record<KindId, Mat>> = {
  desk: M("wood", "#d8b98c", 0.42),
  shelf: M("wood", "#4a3422", 0.55),
  chair: M("fabric", "#46507a", 0.9),
  rug: M("fabric", "#f1f1f5", 1),
  plant: M("leaf", "#35623a", 0.7),
  frame: M("plastic", "#101116", 0.5),
  lamp: M("metal", "#e7a64a", 0.4),
  neonStrip: M("emissive", "#b9a7ff", 0.5),
};
const FALLBACK = M("plastic", "#1a1c23", 0.5);

type Extra = { rotY?: number; scale?: number; material?: Mat; interaction?: RoomObject["interaction"]; hideOnPhone?: boolean; model?: string };
function obj<K extends KindId>(id: string, kind: K, pos: [number, number, number], params: Extract<RoomObject, { kind: K }>["params"], x: Extra = {}): RoomObject {
  return {
    id,
    kind,
    params,
    transform: { pos, rotY: x.rotY ?? 0, scale: x.scale ?? 1 },
    material: x.material ?? MAT_BY_KIND[kind] ?? FALLBACK,
    ...(x.interaction ? { interaction: x.interaction } : {}),
    ...(x.model ? { model: x.model } : {}),
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
  shell: { width: 8, depth: 6, height: 3, wallColor: "#e8ebf3", floorMaterial: "tile", floorColor: "#f2f4f9", hdri: "/hdri/unfinished_office_1k.exr" },
  lighting: Object.fromEntries(
    BAND_IDS.map((id) => {
      const l = STAGE_LIGHTING[id];
      return [id, { key: l.key, fill: l.fill, rim: l.rim, ambient: l.ambient, windowLight: l.windowLight, lampOn: l.lampOn, emissiveBoost: l.screenGlow }];
    }),
  ) as Room["lighting"],
  objects: [
    // Work (back wall, left): the desk with its screens and props.
    obj("desk", "desk", [-1.2, 0, -2.62], { w: 2, h: 0.73, d: 0.72, shape: "straight" }),
    obj("monitor-low", "monitor", [-1.2, DESK_Y, -2.8], { form: "curved", inches: 34, aspect: 2.33, curveRadius: 1.2, tilt: 0, lift: 0.27, screen: "terminal", stand: true }, { material: M("plastic", "#0d0e12", 0.4), interaction: { label: "terminal", cmd: "now" } }),
    obj("monitor-high", "monitor", [-1.2, DESK_Y, -2.8], { form: "curved", inches: 34, aspect: 2.33, curveRadius: 1.2, tilt: -0.1, lift: 0.65, screen: "projects", stand: false }, { material: M("plastic", "#0d0e12", 0.4), interaction: { label: "projects", cmd: "panel:projects" } }),
    obj("monitor-left", "monitor", [-1.9, DESK_Y, -2.7], { form: "flat", inches: 24, aspect: 0.5625, curveRadius: 1.2, tilt: -0.06, lift: 0.3, screen: "code", stand: true }, { rotY: 0.5, material: M("plastic", "#0d0e12", 0.4) }),
    obj("monitor-right", "monitor", [-0.5, DESK_Y, -2.7], { form: "flat", inches: 24, aspect: 0.5625, curveRadius: 1.2, tilt: -0.06, lift: 0.3, screen: "code", stand: true }, { rotY: -0.5, material: M("plastic", "#0d0e12", 0.4) }),
    obj("tablet", "tablet", [-0.82, DESK_Y, -2.35], { inches: 11, tilt: 0.28, dock: true, screen: "code" }, { rotY: 0.15, material: M("plastic", "#0d0e12", 0.4) }),
    obj("phone", "phone", [-1.62, DESK_Y, -2.37], { inches: 6.7, tilt: 0.3, stand: true, screen: "code" }, { rotY: -0.2, material: M("plastic", "#0d0e12", 0.4), interaction: { label: "hire me", cmd: "panel:hire" } }),
    obj("keyboard", "keyboard", [-1.2, DESK_Y, -2.48], { keys: "full", rgb: true }, { material: M("plastic", "#11131a", 0.5) }),
    obj("mouse", "mouse", [-0.7, DESK_Y, -2.46], { mat: true, rgb: false }, { material: M("plastic", "#101116", 0.3) }),
    obj("headset", "headset", [-0.35, DESK_Y, -2.4], { stand: true }, { material: M("plastic", "#14151a", 0.4), interaction: propCmd("headphones") }),
    obj("lamp", "lamp", [-0.3, DESK_Y, -2.8], { form: "desk", height: 0.5, on: true }),
    obj("mug", "cylinder", [-0.48, DESK_Y, -2.22], { r: 0.04, h: 0.09 }, { material: M("ceramic", "#e8e1d6", 0.35), interaction: { label: "now", cmd: "panel:now" } }),
    obj("notebook", "box", [-1.85, DESK_Y, -2.3], { w: 0.2, h: 0.02, d: 0.15, round: 0.003 }, { rotY: 0.2, material: M("paper", "#cfd6f2", 0.8), interaction: { label: "timeline", cmd: "panel:moments" } }),
    obj("sticky", "box", [-2.1, DESK_Y, -2.7], { w: 0.07, h: 0.003, d: 0.07, round: 0 }, { rotY: -0.3, material: M("paper", "#f6e27a", 0.9), interaction: { label: "hire me", cmd: "panel:hire" } }),
    obj("pc", "pcTower", [0.2, 0, -2.7], { h: 0.5, glass: true, rgb: true, fans: 3 }, { material: M("metal", "#f1f2f6", 0.35) }),
    obj("chair", "chair", [-0.3, 0, -1.75], { style: "gaming" }, { rotY: Math.PI + 0.95, material: M("fabric", "#2a4fb0", 0.8) }),
    obj("shelf", "shelf", [-3.2, 0, -2.88], { w: 1, d: 0.24, tiers: 1, lift: 1.5 }),
    obj("books", "bookStack", [-3.45, 1.5175, -2.88], { count: 9, layout: "row" }, { material: M("paper", "#5a6aa8", 0.7) }),
    obj("plant", "plant", [0.8, 0, -2.7], { height: 0.9, leaves: 26, pot: "round" }, { model: "/models/plant.glb" }),
    obj("clock", "clock", [-2.05, 0, -2.99], { diameter: 0.34, lift: 2.1, ownerZone: "Asia/Kolkata", digital: true }, { material: M("plastic", "#e8e1d6", 0.5), interaction: { label: "time", card: "Owner time (Asia/Kolkata) and yours." } }),
    obj("neon-top", "neonStrip", [-1.2, 0, -2.97], { length: 1.3, vertical: false, lift: 2.05, intensity: 3.2 }),
    obj("neon-corner", "neonStrip", [-3.95, 0, -2.95], { length: 2.2, vertical: true, lift: 0.2, intensity: 3.2 }, { material: M("emissive", "#cfe6ff", 0.5) }),
    obj("rug", "rug", [-1.3, 0, -1.6], { w: 2.2, d: 1.6, shape: "rect" }),
    // Window wall (back wall, right): a frame and a sky plane for now; the real window and the weather come in round 37b.
    obj("window", "window", [1.7, 0, -2.99], { w: 1.4, h: 1.3, lift: 0.85, panes: 2 }, { material: M("plastic", "#d9d4cc", 0.6) }),
    // Wall (left wall, back half): the credentials and the key moments, drawn from the content layer by the page.
    obj("board-credentials", "board", [-3.97, 0, -2.05], { source: "credentials", style: "frames", w: 1.3, h: 0.85, lift: 1.0 }, { rotY: Math.PI / 2, interaction: { label: "certificates and education", cmd: "panel:credentials" } }),
    obj("board-moments", "board", [-3.97, 0, -0.65], { source: "moments", style: "cards", w: 1.2, h: 0.85, lift: 1.0 }, { rotY: Math.PI / 2, interaction: { label: "key moments", cmd: "panel:moments" } }),
    // Sleep (right wall, back half): a single bed, a guitar on its stand, a MIDI keyboard on a small table.
    obj("bed", "bed", [2.95, 0, -2.45], { size: "single", pillows: 1, blanket: true, headboard: true }, { rotY: -Math.PI / 2, material: M("fabric", "#f3f3f6", 0.92) }),
    obj("guitar", "guitar", [3.5, 0, -1.3], { stand: true, chords: ["Em", "C", "G", "D"] }, { rotY: -Math.PI / 2 - 0.25, material: M("wood", "#17171b", 0.3), interaction: { label: "guitar", cmd: "play:guitar" } }),
    obj("midi-table", "box", [3.72, 0, -0.45], { w: 1.0, h: 0.72, d: 0.4, round: 0.01 }, { rotY: -Math.PI / 2, material: M("wood", "#4a3422", 0.5) }),
    obj("midi", "midiKeyboard", [3.72, 0.72, -0.45], { keys: 49 }, { rotY: -Math.PI / 2, material: M("plastic", "#1a1c23", 0.4), hideOnPhone: true }),
    // Shelf (right wall, front half): the Stage's project cases, the skills board and the skill stars.
    obj("project-shelf", "projectShelf", [3.86, 0.72, 0.9], { max: SHELF_MAX }, { rotY: -Math.PI / 2, scale: 0.35 }),
    obj("board-skills", "board", [3.97, 0, 2.3], { source: "skills", style: "spines", w: 1.3, h: 0.95, lift: 0.85 }, { rotY: -Math.PI / 2, interaction: { label: "skills", cmd: "panel:skills" } }),
    obj("constellation", "constellation", [3.3, 2.2, 2.2], { stars: STAGE_TIERS.best.stars }, { rotY: -Math.PI / 2, scale: 0.4 }),
    // Chill (front wall, right): the TV on its low unit with the console, a football, a Rubik's cube.
    obj("tv-unit", "box", [1.4, 0, 2.79], { w: 1.8, h: 0.42, d: 0.42, round: 0.012 }, { material: M("wood", "#4a3422", 0.5) }),
    obj("tv", "tv", [1.4, 0, 2.97], { inches: 55, lift: 0.44, mode: "reel" }, { rotY: Math.PI, material: M("plastic", "#0b0c10", 0.4), interaction: { label: "project reel", cmd: "panel:tv" } }),
    obj("console", "console", [0.8, 0.42, 2.8], { controllers: 2 }, { rotY: Math.PI, material: M("plastic", "#e8e8ee", 0.4), interaction: { label: "the worlds", cmd: "panel:worlds" } }),
    obj("football", "football", [1.2, 0, 2.1], { r: 0.11 }, { material: M("plastic", "#f1f1f1", 0.5), interaction: { label: "kick", cmd: "kick:football" } }),
    obj("cube", "puzzleCube", [1.95, 0.42, 2.8], { size: 0.057 }, { rotY: 0.5, material: M("plastic", "#111216", 0.4), hideOnPhone: true }),
    // Wardrobe and entry (front wall, left; left wall, front half): the wardrobe whose doors open, the caps, the key rack, the riding set, the door.
    obj("wardrobe", "wardrobe", [-2.6, 0, 2.7], { w: 1.2, h: 2.1, d: 0.6, open: false, clothes: 14 }, { rotY: Math.PI, material: M("wood", "#8a6a4a", 0.5), interaction: { label: "wardrobe", card: "Jackets and shirts." } }),
    obj("caps", "capRow", [-1.0, 0, 2.97], { count: 4, spacing: 0.2, lift: 1.7 }, { rotY: Math.PI }),
    obj("door", "door", [-3.98, 0, 0.8], { w: STAGE_DOOR.size[0], h: STAGE_DOOR.size[1], swing: OPEN_RAD, leadsTo: STAGE_DOOR.label }, { rotY: Math.PI / 2, material: M("wood", "#6b4a30", 0.6), interaction: { label: STAGE_DOOR.label, cmd: "panel:worlds" } }),
    obj("key-rack", "keyRack", [-3.97, 0, 1.75], { keys: 2, w: 0.5, lift: 1.35, labels: ["Bike", "Car"] }, { rotY: Math.PI / 2, material: M("wood", "#4a3422", 0.5), hideOnPhone: true }),
    obj("riding-set", "ridingSet", [-3.95, 0, 2.5], { helmet: true, jacket: true, pants: true, gloves: true, boots: true }, { rotY: Math.PI / 2, material: M("fabric", "#e2321f", 0.7) }),
  ],
  zones: DEFAULT_ZONES,
};

const tier = (t: (typeof STAGE_TIERS)[keyof typeof STAGE_TIERS], x: Omit<Tier, "dprCap">): Tier => ({ dprCap: t.dpr, ...x });

export const ROOM3D_DEFAULT: Room3d = {
  activeRoom: "work",
  rooms: [workRoom],
  tiers: {
    low: tier(STAGE_TIERS.performance, { aoOn: false, shadowRes: 0, bloomOn: false, textureSize: 256, envMap: "lightformers", objectBudget: 60 }),
    medium: tier(STAGE_TIERS.balanced, { aoOn: true, shadowRes: 1024, bloomOn: false, textureSize: 512, envMap: "hdri", objectBudget: 120 }),
    high: tier(STAGE_TIERS.best, { aoOn: true, shadowRes: 2048, bloomOn: true, textureSize: 512, envMap: "hdri", objectBudget: 200 }),
  },
  quality: "auto",
};
