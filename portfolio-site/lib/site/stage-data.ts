/**
 * The Stage's own data (17-persona-views.md section 18): how the desk is lit through the day.
 * Plain data, no three.js, so the admin console can edit it later. The bands are round 9's
 * (`CLOCK.bands` in terminal-data.ts); every band id there has a preset here.
 */
import type { Entry } from "@/lib/content";

export type StageLight = {
  color: string;
  intensity: number;
  /** Offset from the camera: x to the right, y up, z back (behind the camera). */
  position: [number, number, number];
};

export type StageLighting = {
  key: StageLight;
  fill: StageLight;
  rim: StageLight;
  ambient: { color: string; intensity: number };
  /** How strongly the laptop screen glows (a multiplier on the halo). */
  screenGlow: number;
  lampOn: boolean;
  /** The window behind the desk: its colour and how bright it is (0 = off, a dark pane). */
  windowLight: { color: string; intensity: number };
};

export const STAGE_LIGHTING: Record<string, StageLighting> = {
  night: {
    key: { color: "#6f84ff", intensity: 0.35, position: [-3, 3, 4] },
    fill: { color: "#223355", intensity: 0.15, position: [4, 1, 3] },
    rim: { color: "#4fd1ff", intensity: 0.7, position: [2, 3, -4] },
    ambient: { color: "#101828", intensity: 0.12 },
    screenGlow: 1.5,
    lampOn: true,
    windowLight: { color: "#0a1020", intensity: 0 },
  },
  dawn: {
    key: { color: "#ffc58a", intensity: 1.1, position: [3, 2, 4] },
    fill: { color: "#8fb4ff", intensity: 0.3, position: [-4, 1, 3] },
    rim: { color: "#ffd9b0", intensity: 0.8, position: [-2, 3, -4] },
    ambient: { color: "#3a3040", intensity: 0.25 },
    screenGlow: 1.15,
    lampOn: true,
    windowLight: { color: "#ffb27a", intensity: 0.75 },
  },
  day: {
    key: { color: "#ffffff", intensity: 1.5, position: [-3, 4, 4] },
    fill: { color: "#cfe0ff", intensity: 0.5, position: [4, 1, 3] },
    rim: { color: "#ffffff", intensity: 0.8, position: [2, 3, -4] },
    ambient: { color: "#ffffff", intensity: 0.35 },
    screenGlow: 0.8,
    lampOn: false,
    windowLight: { color: "#dfe9ff", intensity: 0.5 },
  },
  evening: {
    key: { color: "#ffab5c", intensity: 1.3, position: [3, 2, 4] },
    fill: { color: "#7a6ad8", intensity: 0.25, position: [-4, 1, 3] },
    rim: { color: "#ff8a4c", intensity: 0.9, position: [-2, 3, -4] },
    ambient: { color: "#3b2a24", intensity: 0.22 },
    screenGlow: 1.2,
    lampOn: true,
    windowLight: { color: "#ff9a4a", intensity: 0.8 },
  },
  late: {
    key: { color: "#9d8cff", intensity: 0.6, position: [-3, 3, 4] },
    fill: { color: "#2a3a66", intensity: 0.2, position: [4, 1, 3] },
    rim: { color: "#ff6ad5", intensity: 0.7, position: [2, 3, -4] },
    ambient: { color: "#161a30", intensity: 0.15 },
    screenGlow: 1.4,
    lampOn: true,
    windowLight: { color: "#1b2448", intensity: 0.15 },
  },
};

/** The preset for a band id (an unknown id gets the day's). */
export const lightingFor = (bandId: string): StageLighting => STAGE_LIGHTING[bandId] ?? STAGE_LIGHTING.day;

/** A command-prop on the desk (S3): hover shows `label`, a click runs `cmd` in the terminal (`sound` toggles the site setting instead). */
export type StageProp = { id: string; label: string; cmd: string; kind: "mug" | "notebook" | "phone" | "headphones" | "sticky" };

export const STAGE_PROPS: StageProp[] = [
  { id: "mug", label: "now", cmd: "now", kind: "mug" },
  { id: "notebook", label: "timeline", cmd: "timeline", kind: "notebook" },
  { id: "phone", label: "contact", cmd: "contact", kind: "phone" },
  { id: "headphones", label: "sound", cmd: "sound", kind: "headphones" },
  { id: "sticky", label: "hire", cmd: "hire", kind: "sticky" },
];

/** A case on the project shelf (S4): a public project, an in-development one, or the "+n more" case. */
export type ShelfCase = { id: string; title: string; kind: "project" | "dev" | "more"; /** The project's slug (a project case opens `/engineer/<slug>`). */ slug?: string; /** Shown under the title on hover: the status of an in-development one, a count for "more". */ note?: string };

/** Projects in development that have no page of their own yet (a dim case; a click opens `projects` in the terminal). */
export const STAGE_DEV_PROJECTS: Array<{ id: string; title: string; note: string }> = [{ id: "api-test-center", title: "API Test Center", note: "in development" }];

/** The shelf holds at most this many cases; more projects become a last "+n more" case. */
export const SHELF_MAX = 8;

/** The cases for a list of public projects (already ordered): projects first, then the dev ones, capped at SHELF_MAX. */
export function shelfCases(projects: Array<{ slug: string; title: string }>): ShelfCase[] {
  const all: ShelfCase[] = [
    ...projects.map((p): ShelfCase => ({ id: `p:${p.slug}`, title: p.title, kind: "project", slug: p.slug })),
    ...STAGE_DEV_PROJECTS.filter((d) => !projects.some((p) => p.title.toLowerCase() === d.title.toLowerCase())).map((d): ShelfCase => ({ id: `d:${d.id}`, title: d.title, kind: "dev", note: d.note })),
  ];
  if (all.length <= SHELF_MAX) return all;
  const shown = all.slice(0, SHELF_MAX - 1);
  const rest = all.length - shown.length;
  return [...shown, { id: "more", title: `+${rest} more`, kind: "more", note: "open projects" }];
}

/** The shelf's cases from the content layer's entries: public projects in their order. */
export function shelfFromEntries(entries: Entry[] | undefined): ShelfCase[] {
  return shelfCases(
    (entries ?? [])
      .filter((e) => e.type === "project" && e.visibility === "public")
      .sort((a, b) => a.order - b.order)
      .map((e) => ({ slug: e.slug, title: e.title })),
  );
}
