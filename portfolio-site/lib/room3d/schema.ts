/**
 * The 3D room's data (docs/claude-planning/18-3d-room-plan.md section 2): one settings key, `room3d`.
 * Pure (no three.js, no server imports) so the admin's form generator can walk it on the client and the
 * kit can validate on the page. Units are metres; the room is centred on the origin, the floor is y = 0,
 * an object's `transform.pos` is the centre of its base, and it faces +z before `rotY` (radians).
 *
 * One strict schema per object kind (`params`); `objectSchema` is their discriminated union. Hard caps
 * (200 objects a room, scale range, positions inside the shell) are refinements, so a draft that breaks
 * them is rejected whole and the page falls back to the last good room, then the default room.
 */
import { z } from "zod";

const str = (max = 120) => z.string().max(max);
const color = () => z.string().regex(/^#[0-9a-fA-F]{6}$/, "a #rrggbb colour").meta({ ui: "color" });
const num = (min: number, max: number) => z.number().min(min).max(max);
const metres = (max = 12) => num(-max, max);
const vec3 = () => z.tuple([metres(), metres(6), metres()]).meta({ ui: "vec3" });

export const MAX_OBJECTS = 200;
export const SCALE_RANGE = [0.1, 8] as const;

export const BAND_IDS = ["night", "dawn", "day", "evening", "late"] as const;
export const MATERIAL_PRESETS = ["wood", "metal", "plastic", "fabric", "ceramic", "paper", "glass", "rubber", "plaster", "leaf", "emissive"] as const;

/** An image field: an https URL (its host must allow cross-origin use as a texture), a /path in public/, or an upload id. */
export const imageSchema = z
  .strictObject({
    src: z.string().max(500).regex(/^(https:\/\/|\/|upload:)/, "an https:// URL, a /path or an upload"),
    alt: str(120),
  })
  .meta({ ui: "image" });

export const transformSchema = z.strictObject({
  pos: vec3(),
  rotY: num(-Math.PI * 2, Math.PI * 2),
  scale: num(SCALE_RANGE[0], SCALE_RANGE[1]),
});

export const materialSchema = z.strictObject({
  preset: z.enum(MATERIAL_PRESETS),
  color: color(),
  roughness: num(0, 1),
});

/** What a click does: run a terminal command, open a link, or show a card (a short text). */
export const interactionSchema = z.union([
  z.strictObject({ label: str(60), cmd: str(80) }),
  z.strictObject({ label: str(60), href: z.string().max(500).regex(/^(https?:\/\/|mailto:|\/)/, "https://, mailto: or a /path") }),
  z.strictObject({ label: str(60), card: str(240) }),
]);

const base = {
  id: z.string().min(1).max(40).regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and dashes"),
  transform: transformSchema,
  material: materialSchema,
  interaction: interactionSchema.optional(),
  visibility: z.enum(["public", "draft"]),
  hideOnPhone: z.boolean(),
};

const kind = <K extends string, P extends z.ZodType>(k: K, params: P) => z.strictObject({ ...base, kind: z.literal(k), params });

/** `projects`: the project carousel drawn from the content layer; `terminal`: the live terminal; `reel`/`console`: see the TV. */
const screenSource = z.enum(["terminal", "code", "console", "image", "projects"]);
const dims = (w: [number, number], h: [number, number], d: [number, number]) => ({ w: num(...w), h: num(...h), d: num(...d) });

export const KIND_SCHEMAS = {
  desk: kind("desk", z.strictObject({ ...dims([0.6, 4], [0.4, 1.2], [0.4, 1.4]), shape: z.enum(["straight", "l"]) })),
  monitor: kind(
    "monitor",
    z.strictObject({
      form: z.enum(["curved", "flat"]),
      /** Diagonal in inches; the width follows from the aspect. */
      inches: num(10, 60),
      aspect: num(0.4, 3.6),
      /** Curve radius in metres (curved only); smaller is deeper. */
      curveRadius: num(0.6, 4),
      /** Tilt up (+) or down (-), radians: an arm that tilts. */
      tilt: num(-0.6, 0.6),
      /** Height of the screen's centre above the object's base, metres. */
      lift: num(0, 3),
      screen: screenSource,
      image: imageSchema.optional(),
      /** The standing neck below the screen (a stacked second screen has none). */
      stand: z.boolean(),
    }),
  ),
  tablet: kind("tablet", z.strictObject({ inches: num(6, 14), tilt: num(0, 1.2), dock: z.boolean(), screen: screenSource })),
  phone: kind("phone", z.strictObject({ inches: num(3, 8), tilt: num(0, 1.2), stand: z.boolean(), screen: screenSource })),
  keyboard: kind("keyboard", z.strictObject({ keys: z.enum(["full", "tkl", "compact"]), rgb: z.boolean() })),
  mouse: kind("mouse", z.strictObject({ mat: z.boolean(), rgb: z.boolean() })),
  headset: kind("headset", z.strictObject({ stand: z.boolean() })),
  lamp: kind("lamp", z.strictObject({ form: z.enum(["desk", "floor"]), height: num(0.2, 2), on: z.boolean() })),
  shelf: kind("shelf", z.strictObject({ w: num(0.3, 3), d: num(0.1, 0.5), tiers: z.number().int().min(1).max(5), lift: num(0, 3) })),
  bookStack: kind("bookStack", z.strictObject({ count: z.number().int().min(1).max(30), layout: z.enum(["row", "pile"]) })),
  plant: kind("plant", z.strictObject({ height: num(0.2, 2.5), leaves: z.number().int().min(4).max(60), pot: z.enum(["round", "square"]) })),
  chair: kind("chair", z.strictObject({ style: z.enum(["office", "gaming", "stool"]) })),
  bed: kind("bed", z.strictObject({ size: z.enum(["single", "double"]), pillows: z.number().int().min(0).max(4) })),
  wardrobe: kind("wardrobe", z.strictObject({ w: num(0.6, 3), h: num(1.2, 2.6), d: num(0.4, 0.8), open: z.boolean(), clothes: z.number().int().min(0).max(40) })),
  frame: kind(
    "frame",
    z.strictObject({
      variant: z.enum(["frame", "poster", "canvas"]),
      w: num(0.1, 3),
      h: num(0.1, 3),
      image: imageSchema.optional(),
      /** Shown on a blank frame and as the hover title. */
      title: str(60),
    }),
  ),
  window: kind("window", z.strictObject({ w: num(0.4, 3), h: num(0.4, 2.2), lift: num(0.2, 2.2), panes: z.number().int().min(1).max(4) })),
  door: kind("door", z.strictObject({ w: num(0.6, 1.4), h: num(1.8, 2.5), swing: num(0, 2), leadsTo: str(40) })),
  rug: kind("rug", z.strictObject({ w: num(0.4, 6), d: num(0.4, 6), shape: z.enum(["rect", "round"]) })),
  neonStrip: kind("neonStrip", z.strictObject({ length: num(0.1, 4), vertical: z.boolean(), lift: num(0, 3), intensity: num(0.5, 6) })),
  speaker: kind("speaker", z.strictObject({ h: num(0.1, 1.2) })),
  clock: kind(
    "clock",
    z.strictObject({
      diameter: num(0.15, 0.8),
      lift: num(0.5, 2.6),
      /** The owner's zone (shown on the digital line) next to the visitor's. */
      ownerZone: str(40),
      digital: z.boolean(),
    }),
  ),
  tv: kind("tv", z.strictObject({ inches: num(20, 100), lift: num(0.2, 2), mode: z.enum(["idle", "home", "reel"]), image: imageSchema.optional() })),
  console: kind("console", z.strictObject({ controllers: z.number().int().min(0).max(4) })),
  pcTower: kind("pcTower", z.strictObject({ h: num(0.3, 0.7), glass: z.boolean(), rgb: z.boolean(), fans: z.number().int().min(0).max(6) })),
  guitar: kind("guitar", z.strictObject({ stand: z.boolean() })),
  midiKeyboard: kind("midiKeyboard", z.strictObject({ keys: z.number().int().min(25).max(88) })),
  capRow: kind("capRow", z.strictObject({ count: z.number().int().min(1).max(30), spacing: num(0.08, 0.4), lift: num(0.5, 2.5) })),
  keyRack: kind("keyRack", z.strictObject({ keys: z.number().int().min(1).max(30), w: num(0.2, 1.5), lift: num(0.5, 2.5) })),
  bag: kind("bag", z.strictObject({ label: str(40), image: imageSchema.optional() })),
  ridingSet: kind("ridingSet", z.strictObject({ helmet: z.boolean(), jacket: z.boolean(), gloves: z.boolean(), boots: z.boolean() })),
  box: kind("box", z.strictObject({ w: num(0.001, 4), h: num(0.001, 4), d: num(0.001, 4), round: num(0, 0.2) })),
  cylinder: kind("cylinder", z.strictObject({ r: num(0.01, 2), h: num(0.01, 4) })),
  sphere: kind("sphere", z.strictObject({ r: num(0.01, 2) })),
  /** The Stage's project shelf: one case per public project (the cases come from the content layer, not from here); the object's scale sizes it. */
  projectShelf: kind("projectShelf", z.strictObject({ max: z.number().int().min(1).max(12) })),
  /** The Stage's skill constellation: one star per technology (from the terminal's stack, at most `stars`); the object's scale sizes the cap. */
  constellation: kind("constellation", z.strictObject({ stars: z.number().int().min(4).max(40) })),
  /**
   * A content board: a flat panel whose face is drawn from the content layer (never from this object): skill spines
   * for a shelf, certificate and education frames or key-moment cards for a wall. Clicking it opens the matching
   * panel; the item under the pointer is found from the layout (lib/room3d/board-layout.ts).
   */
  board: kind("board", z.strictObject({ source: z.enum(["skills", "credentials", "moments"]), style: z.enum(["spines", "frames", "cards"]), w: num(0.3, 3), h: num(0.2, 2), lift: num(0, 2.6) })),
} as const;

export type KindId = keyof typeof KIND_SCHEMAS;
export const KIND_IDS = Object.keys(KIND_SCHEMAS) as KindId[];
export type KindParams<K extends KindId> = z.infer<(typeof KIND_SCHEMAS)[K]>["params"];

export const objectSchema = z.discriminatedUnion("kind", [
  KIND_SCHEMAS.desk,
  KIND_SCHEMAS.monitor,
  KIND_SCHEMAS.tablet,
  KIND_SCHEMAS.phone,
  KIND_SCHEMAS.keyboard,
  KIND_SCHEMAS.mouse,
  KIND_SCHEMAS.headset,
  KIND_SCHEMAS.lamp,
  KIND_SCHEMAS.shelf,
  KIND_SCHEMAS.bookStack,
  KIND_SCHEMAS.plant,
  KIND_SCHEMAS.chair,
  KIND_SCHEMAS.bed,
  KIND_SCHEMAS.wardrobe,
  KIND_SCHEMAS.frame,
  KIND_SCHEMAS.window,
  KIND_SCHEMAS.door,
  KIND_SCHEMAS.rug,
  KIND_SCHEMAS.neonStrip,
  KIND_SCHEMAS.speaker,
  KIND_SCHEMAS.clock,
  KIND_SCHEMAS.tv,
  KIND_SCHEMAS.console,
  KIND_SCHEMAS.pcTower,
  KIND_SCHEMAS.guitar,
  KIND_SCHEMAS.midiKeyboard,
  KIND_SCHEMAS.capRow,
  KIND_SCHEMAS.keyRack,
  KIND_SCHEMAS.bag,
  KIND_SCHEMAS.ridingSet,
  KIND_SCHEMAS.box,
  KIND_SCHEMAS.cylinder,
  KIND_SCHEMAS.sphere,
  KIND_SCHEMAS.projectShelf,
  KIND_SCHEMAS.constellation,
  KIND_SCHEMAS.board,
]);
export type RoomObject = z.infer<typeof objectSchema>;
export type ObjectOf<K extends KindId> = Extract<RoomObject, { kind: K }>;

const light = z.strictObject({ color: color(), intensity: num(0, 8), position: z.tuple([metres(20), metres(20), metres(20)]) });
/** One part of the day's light (the Stage's clock bands): the same fields `stage-data.ts` carries. */
export const lightingSchema = z.strictObject({
  key: light,
  fill: light,
  rim: light,
  ambient: z.strictObject({ color: color(), intensity: num(0, 4) }),
  windowLight: z.strictObject({ color: color(), intensity: num(0, 4) }),
  lampOn: z.boolean(),
  /** Multiplies every emissive (screens, neon): the room glows more at night. */
  emissiveBoost: num(0, 4),
});

export const shellSchema = z.strictObject({
  width: num(2, 14),
  depth: num(2, 14),
  height: num(2, 5),
  wallColor: color(),
  floorMaterial: z.enum(["wood", "plaster", "fabric"]),
  floorColor: color(),
});

/**
 * A camera zone: where the camera stands and looks (metres, inside the room), the objects it is about, and what
 * Enter opens (`panel`, one of lib/room3d/panels.ts's ids; empty = nothing). `order` sets the chip order and the
 * wheel / swipe / arrow stepping.
 */
export const zoneSchema = z.strictObject({
  id: z.string().min(1).max(40).regex(/^[a-z0-9][a-z0-9-]*$/, "lowercase letters, digits and dashes"),
  label: str(30),
  order: num(0, 99),
  eye: vec3(),
  look: vec3(),
  objects: z.array(z.string().max(40)).max(16),
  panel: str(24).optional(),
});
export type Zone = z.infer<typeof zoneSchema>;

export const roomSchema = z
  .strictObject({
    id: z.string().min(1).max(40).regex(/^[a-z0-9][a-z0-9-]*$/),
    label: str(60),
    shell: shellSchema,
    lighting: z.record(z.enum(BAND_IDS), lightingSchema),
    objects: z.array(objectSchema).max(MAX_OBJECTS),
    /** Camera zones; absent means the defaults in lib/room3d/zones.ts. At most 16. */
    zones: z.array(zoneSchema).max(16).optional(),
  })
  .superRefine((room, ctx) => {
    const seen = new Set<string>();
    const { width, depth, height } = room.shell;
    const zoneIds = new Set<string>();
    (room.zones ?? []).forEach((zn, i) => {
      if (zoneIds.has(zn.id)) ctx.addIssue({ code: "custom", path: ["zones", i, "id"], message: `duplicate zone id "${zn.id}"` });
      zoneIds.add(zn.id);
      if (Math.abs(zn.eye[0]) > width / 2 || Math.abs(zn.eye[2]) > depth / 2 || zn.eye[1] > height) ctx.addIssue({ code: "custom", path: ["zones", i, "eye"], message: "the camera would stand outside the room" });
    });
    room.objects.forEach((o, i) => {
      if (seen.has(o.id)) ctx.addIssue({ code: "custom", path: ["objects", i, "id"], message: `duplicate id "${o.id}"` });
      seen.add(o.id);
      const [x, y, z] = o.transform.pos;
      if (Math.abs(x) > width / 2 + 0.05 || Math.abs(z) > depth / 2 + 0.05 || y > height) ctx.addIssue({ code: "custom", path: ["objects", i, "transform", "pos"], message: "outside the room" });
    });
  });
export type Room = z.infer<typeof roomSchema>;

export const tierSchema = z.strictObject({
  /** Cap on the pixel ratio (a phone at 3x is the fill-rate problem). */
  dprCap: num(1, 3),
  /** Accumulated ambient shadows on (desktop) or a single contact shadow (phone). */
  aoOn: z.boolean(),
  /** Directional shadow map size; 0 = no shadow map. */
  shadowRes: z.union([z.literal(0), z.literal(512), z.literal(1024), z.literal(2048)]),
  /** Post-processing (SMAA + bloom) on; off falls back to MSAA and glow sprites. */
  bloomOn: z.boolean(),
  textureSize: z.union([z.literal(128), z.literal(256), z.literal(512)]),
  /** Most objects drawn; the rest are trimmed by priority (see `trimToBudget`). */
  objectBudget: z.number().int().min(10).max(MAX_OBJECTS),
});
export type Tier = z.infer<typeof tierSchema>;
export const TIER_IDS = ["low", "medium", "high"] as const;
export type TierId = (typeof TIER_IDS)[number];

export const room3dSchema = z
  .strictObject({
    activeRoom: z.string().max(40),
    rooms: z.array(roomSchema).min(1).max(4),
    tiers: z.strictObject({ low: tierSchema, medium: tierSchema, high: tierSchema }),
    /** `auto` picks a tier from the device; the visitor's control and `?q=` override it. */
    quality: z.enum(["auto", "low", "medium", "high"]),
  })
  .superRefine((v, ctx) => {
    if (!v.rooms.some((r) => r.id === v.activeRoom)) ctx.addIssue({ code: "custom", path: ["activeRoom"], message: "no room has this id" });
  });
export type Room3d = z.infer<typeof room3dSchema>;
