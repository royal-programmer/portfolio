/**
 * The admin's map, in one constant: persona groups, their sections, and what is editable now versus
 * coming. The sidebar, the URLs (`/admin/<group>/<section>`), the legacy redirects, the home and the
 * persona homes all read this (and `collections.ts`), so the map is never written twice. Pure.
 */
import { LAUNCHED_PERSONAS } from "@/lib/content/types";
import type { SettingKey } from "@/lib/settings/schema";
import { collectionsFor } from "./collections";

export type NavSection = {
  id: string;
  label: string;
  cluster?: "Content" | "Views" | "Copy";
  /** `settings`: the typed Zod forms (tabs when several keys). `collection`: master-detail. `history`: change log. `booking`: the book-a-call link. `soon`: placeholder. */
  kind: "settings" | "collection" | "history" | "booking" | "soon";
  keys?: SettingKey[];
  note?: string;
};

export type NavGroup = { id: string; label: string; accent: string; sections: NavSection[] };

const PERSONA_LABEL: Record<string, string> = {
  engineer: "Engineer",
  trader: "Trader",
  photographer: "Photographer",
  artist: "Artist",
  ride: "Rider",
  gamer: "Gamer",
};

const ENGINEER_SETTINGS: NavSection[] = [
  { id: "timeline", label: "Timeline", cluster: "Content", kind: "settings", keys: ["engineer.timeline"] },
  { id: "diagrams", label: "Diagrams", cluster: "Content", kind: "settings", keys: ["engineer.arch"] },
  { id: "views", label: "Views", cluster: "Views", kind: "settings", keys: ["engineer.views", "netflix", "engineer.themes"] },
  { id: "stage", label: "3D room and Swarm", cluster: "Views", kind: "soon", note: "Coming with the 3D round (gizmo editor) and the Swarm round." },
  { id: "copy", label: "Copy", cluster: "Copy", kind: "settings", keys: ["engineer.terminal", "engineer.resume", "engineer.i18n"] },
  { id: "hiring", label: "Hiring facts", cluster: "Copy", kind: "settings", keys: ["engineer.hiring"] },
  { id: "clock", label: "Visitor's clock", cluster: "Copy", kind: "settings", keys: ["engineer.clock"] },
  { id: "booking", label: "Book a call", cluster: "Copy", kind: "booking" },
];

const COMING: NavSection[] = [{ id: "soon", label: "Coming", kind: "soon", note: "This world's content and views are edited here once it ships." }];

function personaSections(p: string): NavSection[] {
  const cols = collectionsFor(p);
  if (!cols.length) return COMING;
  return [
    ...cols.map<NavSection>((c) => ({ id: c.id, label: c.label, cluster: "Content", kind: c.status === "live" ? "collection" : "soon", note: c.note })),
    ...(p === "engineer" ? ENGINEER_SETTINGS : []),
  ];
}

export const NAV: NavGroup[] = [
  {
    id: "site",
    label: "Site",
    accent: "#94a3b8",
    sections: [
      { id: "identity", label: "Identity", kind: "settings", keys: ["identity"] },
      { id: "hub", label: "Hub copy", kind: "settings", keys: ["hub.copy"] },
      { id: "personas", label: "Persona copy", kind: "settings", keys: ["personas.copy"], note: "Role, phrases and call to action for every world." },
      { id: "switches", label: "Switches", kind: "settings", keys: ["site.switches"] },
      { id: "insights", label: "Insights", kind: "history", note: "What visitors opened and played, counted without cookies." },
      { id: "history", label: "History", kind: "history" },
      { id: "previews", label: "Previews", kind: "soon", note: "Use Preview site in any editor; a preview list is coming." },
    ],
  },
  ...LAUNCHED_PERSONAS.map((p) => ({ id: p, label: PERSONA_LABEL[p] ?? p, accent: p === "engineer" ? "#3b82f6" : "#6d6b67", sections: personaSections(p) })),
];

export const sectionPath = (g: string, s?: string) => (s ? `/admin/${g}/${s}` : `/admin/${g}`);

export function findSection(group: string, section: string): { group: NavGroup; section: NavSection } | null {
  const g = NAV.find((x) => x.id === group);
  const s = g?.sections.find((x) => x.id === section);
  return g && s ? { group: g, section: s } : null;
}

/** Old flat `/admin/<settings group id>` paths map to their new home (the old group ids). */
const LEGACY: Record<string, string> = {
  identity: "site/identity",
  personas: "site/personas",
  hub: "site/hub",
  switches: "site/switches",
  history: "site/history",
  terminal: "engineer/copy",
  timeline: "engineer/timeline",
  diagrams: "engineer/diagrams",
  views: "engineer/views",
  themes: "engineer/views?key=engineer.themes",
  netflix: "engineer/views?key=netflix",
};
export const legacyPath = (old: string): string | null => (LEGACY[old] ? `/admin/${LEGACY[old]}` : null);

/** What is editable now and what is coming, per group. */
export function mapOverview() {
  return NAV.map((g) => ({ group: g, now: g.sections.filter((s) => s.kind !== "soon"), soon: g.sections.filter((s) => s.kind === "soon") }));
}
