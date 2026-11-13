/**
 * The admin console's settings: one strict Zod schema per key (docs/claude-planning/16-admin-console.md).
 * Pure (no data, no server imports) so the admin's form generator can walk these on the client; the
 * defaults live in `defaults.ts`. A `.meta({ ui })` tag picks a widget where the type alone is not enough.
 *
 * Adding a key: add its schema here, add it to `SCHEMAS`, give it a default in `defaults.ts` and a place
 * in `GROUPS` (admin rail), then read it with `getSetting("your.key")`. `scripts/settings-roundtrip.mjs` fails on drift.
 */
import { z } from "zod";

// ---- field helpers (the `ui` meta picks the widget) ---------------------------------------------
const str = (max = 200) => z.string().max(max);
const long = (max = 2000) => z.string().max(max).meta({ ui: "long" });
const color = () => z.string().regex(/^#[0-9a-fA-F]{6}$/, "a #rrggbb colour").meta({ ui: "color" });
const month = () => z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, "YYYY-MM (or YYYY-MM-DD)").meta({ ui: "month" });
const link = () => z.string().min(1).max(500).regex(/^(https?:\/\/|mailto:|\/)/, "https://, mailto: or a /path");
const chips = (max = 40) => z.array(str(max)).max(60).meta({ ui: "chips" });

const PERSONA_SLUGS = ["engineer", "trader", "photographer", "ride", "artist", "gamer"] as const;

// ---- identity ------------------------------------------------------------------------------------
export const identitySchema = z.strictObject({
  name: str(80),
  /** The contact address on the hub, the hire pill and the terminal's `mail` row. */
  email: z.string().email().max(200),
});

// ---- personas.copy: the cycling phrases, role and call to action per world --------------------
const personaCopy = z.strictObject({
  role: str(40),
  handle: str(60).optional(),
  phrases: z.array(str(80)).min(1).max(8),
  cta: str(60),
});
export const personasCopySchema = z.strictObject({
  engineer: personaCopy,
  trader: personaCopy,
  photographer: personaCopy,
  ride: personaCopy,
  artist: personaCopy,
  gamer: personaCopy,
});
export { PERSONA_SLUGS };

// ---- hub.copy -----------------------------------------------------------------------------------
export const hubCopySchema = z.strictObject({
  headline: str(120),
  intro: str(80),
  throughTitle: str(160),
  moreTitle: str(120),
  closingTitle: str(160),
  closingBody: long(400),
  character: z.array(long(240)).min(1).max(8),
});

// ---- engineer.terminal --------------------------------------------------------------------------
const termLink = z.strictObject({ label: str(40), href: link(), group: z.enum(["elsewhere"]).optional() });
const clockBand = z.strictObject({ id: str(20), from: z.number().int().min(0).max(24), to: z.number().int().min(0).max(24), theme: str(20), greet: str(80), hint: str(160) });
const clockShape = (min: number) => z.strictObject({
  bands: z.array(clockBand).min(min).max(12),
  weekend: z.strictObject({ greet: str(80), hint: str(160) }),
  myTz: str(60),
});
const hiringShape = z.strictObject({
  roles: chips(80),
  level: str(160),
  stack: z.strictObject({ core: chips(40), plus: chips(60) }),
  location: z.strictObject({ base: str(80), modes: chips(30), relocate: z.boolean() }),
  availability: str(200),
  compensation: str(120),
  visa: str(200),
  proof: z.array(str(240)).max(10),
  /** Other places a recruiter can find me that have no public link. */
  alsoOn: chips(40).optional(),
  links: z.strictObject({ resume: str(300), site: str(300) }),
});
export const terminalSchema = z.strictObject({
  who: str(120),
  stack: chips(30),
  uptime: str(200),
  status: str(120),
  contact: z.array(termLink).max(20),
  portrait: z.strictObject({
    src: z.string().min(1).max(300),
    /** Fractions l, t, r, b of the source photo. */
    crop: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]),
  }),
  now: z.strictObject({ month: month(), lines: z.array(str(200)).max(8) }),
  clock: clockShape(0),
  hiring: hiringShape,
  resumeFiles: z.strictObject({
    submitted: z.strictObject({ href: str(300), label: str(80), updatedAt: month() }),
    generated: z.strictObject({ route: str(300) }),
  }),
});

// ---- engineer.resume ----------------------------------------------------------------------------
export const resumeSchema = z.strictObject({
  name: str(80),
  title: str(160),
  location: str(160),
  summary: long(1200),
  // The four lists below are `skill_group`, `experience`, `certification` and `education` records under
  // CONTENT_SOURCE=db (round 24); they stay here, optional, for the frozen copy that code mode still reads.
  skills: z.array(z.strictObject({ group: str(60), items: chips(60) })).max(12).optional(),
  experience: z
    .array(z.strictObject({ role: str(80), company: str(80), period: str(60), headline: long(400), bullets: z.array(long(400)).max(20) }))
    .max(12)
    .optional(),
  personalProjects: z.array(z.strictObject({ name: str(80), status: str(60), line: long(400), url: link().optional() })).max(12),
  certifications: z.array(z.strictObject({ issuer: str(80), line: long(300), items: chips(120).optional() })).max(20).optional(),
  education: z.array(z.strictObject({ degree: str(160), school: str(160), year: str(20), note: str(120).optional() })).max(6).optional(),
  /** Indices into the first role's bullets that make the one-page PDF. */
  pdfBullets: z.array(z.number().int().min(0).max(40)).max(40).optional(),
});

// ---- engineer.hiring and engineer.clock (the `hire --brief` facts and the visitor's-clock bands) ----
// Under CONTENT_SOURCE=db these two are the singletons; in code mode `engineer.terminal` still carries them.
export const hiringSchema = hiringShape;
export const clockSchema = clockShape(0);

// ---- engineer.i18n ------------------------------------------------------------------------------
const i18n = z.strictObject({ who: str(160), role: str(120), city: str(80), uptime: str(300), summary: long(1200), status: str(160), now: z.array(str(240)).max(8), proof: z.array(long(400)).max(10) });
export const i18nSchema = z.strictObject({ bn: i18n, hi: i18n });

// ---- engineer.timeline --------------------------------------------------------------------------
export const timelineSchema = z.strictObject({
  entries: z
    .array(
      z.strictObject({
        date: month(),
        subject: str(240),
        body: z.array(long(300)).max(8).optional(),
        branch: z.enum(["main", "side", "learn", "life"]),
        tag: str(40).optional(),
        grade: str(40).optional(),
      }),
    )
    .max(200),
  periods: z
    .array(z.strictObject({ id: str(40), label: str(160), from: month(), to: month().nullable(), grade: str(60).optional(), note: str(200).optional() }))
    .max(20),
});

// ---- engineer.arch ------------------------------------------------------------------------------
export const archSchema = z.strictObject({
  diagrams: z
    .array(
      z.strictObject({
        id: str(40),
        title: str(80),
        line: str(240).optional(),
        nodes: z.array(z.strictObject({ id: str(30), label: str(40), kind: z.enum(["ui", "api", "db", "queue", "ext", "job"]) })).max(40),
        /** [from node id, to node id, optional label on the arrow]. */
        edges: z.array(z.tuple([str(30), str(30), str(40).optional()])).max(80),
        notes: z.array(long(300)).max(12),
      }),
    )
    .max(20),
  /** Which diagram a project page points at: project slug -> diagram id. */
  projectArch: z.record(str(60), str(40)),
});

// ---- engineer.views -----------------------------------------------------------------------------
export const viewsSchema = z.strictObject({
  views: z.array(z.strictObject({ id: z.string().regex(/^[a-z0-9-]{2,24}$/, "lowercase letters, digits, dashes"), name: str(40), line: str(200), enabled: z.boolean() })).max(12),
  /** Stored for the picker; the page does not yet open it directly. */
  defaultView: str(24),
});

// ---- engineer.themes ----------------------------------------------------------------------------
export const THEME_IDS = ["amber", "green", "paper", "dracula", "nord", "gruvbox", "solarized", "monokai", "matrix", "cyberpunk"] as const;
export const themesSchema = z.strictObject({
  palettes: z
    .array(
      z.strictObject({
        id: z.enum(THEME_IDS),
        bg: color(),
        void: color(),
        ink: color(),
        dim: color(),
        faint: color(),
        accent: color(),
        ok: color(),
        violet: color(),
        yellow: color().optional(),
        link: color().optional(),
      }),
    )
    .max(THEME_IDS.length),
});

// ---- site.switches ------------------------------------------------------------------------------
export const switchesSchema = z.strictObject({
  /** The Experience a first-time visitor gets: immersive, normal, or chosen by their device. */
  xpDefault: z.enum(["auto", "immersive", "normal"]),
  analytics: z.strictObject({ enabled: z.boolean(), provider: z.enum(["none", "cloudflare"]), id: str(80), /** Privacy-first visitor counts (no cookies, nothing personal). Absent means on. */ events: z.boolean().optional() }),
  leadForm: z.boolean(),
  maintenance: z.strictObject({ enabled: z.boolean(), message: long(300) }),
});

// ---- netflix ------------------------------------------------------------------------------------
export const netflixSchema = z.strictObject({
  profiles: z.array(z.strictObject({ id: z.enum(["recruiter", "developer", "story"]), name: str(40), line: str(200), glyph: str(4) })).min(1).max(3),
  /** Three adjectives per branch / kind ("This series is ..."). */
  adjectives: z.record(str(20), z.tuple([str(30), str(30), str(30)])),
  /** The book-a-call link: nothing renders while `href` is empty. */
  bookCall: z.strictObject({ label: str(40), href: z.string().max(500).regex(/^(https:\/\/.+)?$/, "an https:// link, or empty") }).optional(),
  /** "Skim in 30 seconds": up to three title ids a recruiter should see first. Empty or absent means the profile's featured trio. */
  skim: z.array(str(80)).max(3).optional(),
});

// ---- registry -----------------------------------------------------------------------------------
export const SCHEMAS = {
  identity: identitySchema,
  "personas.copy": personasCopySchema,
  "hub.copy": hubCopySchema,
  "engineer.terminal": terminalSchema,
  "engineer.resume": resumeSchema,
  "engineer.hiring": hiringSchema,
  "engineer.clock": clockSchema,
  "engineer.i18n": i18nSchema,
  "engineer.timeline": timelineSchema,
  "engineer.arch": archSchema,
  "engineer.views": viewsSchema,
  "engineer.themes": themesSchema,
  "site.switches": switchesSchema,
  netflix: netflixSchema,
} as const;

export type SettingKey = keyof typeof SCHEMAS;
export type SettingValue<K extends SettingKey> = z.infer<(typeof SCHEMAS)[K]>;
export type Settings = { [K in SettingKey]: SettingValue<K> };
export const SETTING_KEYS = Object.keys(SCHEMAS) as SettingKey[];
export const isSettingKey = (k: unknown): k is SettingKey => typeof k === "string" && Object.hasOwn(SCHEMAS, k);

/** The admin rail: a group is one or more keys (tabs). Order is the rail's order. */
export const GROUPS: ReadonlyArray<{ id: string; label: string; keys: SettingKey[]; accent: string }> = [
  { id: "identity", label: "Identity", keys: ["identity"], accent: "#f3f1ec" },
  { id: "personas", label: "Personas", keys: ["personas.copy"], accent: "#ff8a3d" },
  { id: "hub", label: "Hub", keys: ["hub.copy"], accent: "#a78bfa" },
  { id: "terminal", label: "Engineer terminal", keys: ["engineer.terminal", "engineer.resume", "engineer.hiring", "engineer.clock", "engineer.i18n"], accent: "#3b82f6" },
  { id: "timeline", label: "Timeline", keys: ["engineer.timeline"], accent: "#4ade80" },
  { id: "diagrams", label: "Diagrams", keys: ["engineer.arch"], accent: "#22d3ee" },
  { id: "views", label: "Views", keys: ["engineer.views"], accent: "#f472b6" },
  { id: "themes", label: "Themes", keys: ["engineer.themes"], accent: "#fabd2f" },
  { id: "netflix", label: "Netflix", keys: ["netflix"], accent: "#ef4444" },
  { id: "switches", label: "Switches", keys: ["site.switches"], accent: "#94a3b8" },
];

/** The cookie the preview button sets (signed; see `preview.ts`). */
export const PREVIEW_COOKIE = "xp-preview";
