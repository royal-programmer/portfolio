/**
 * Keyboard shortcuts and the command palette's matching, as data and pure functions (so they are tested and the
 * `?` help lists exactly what works). `g` then a letter jumps to a section.
 */
import { NAV, sectionPath } from "../nav";

export type Shortcut = { key: string; label: string; href: string };

export const SHORTCUTS: Shortcut[] = [
  { key: "h", label: "Home", href: "/admin" },
  { key: "p", label: "Projects", href: "/admin/engineer/projects" },
  { key: "e", label: "Experience", href: "/admin/engineer/experience" },
  { key: "c", label: "Certifications", href: "/admin/engineer/certifications" },
  { key: "k", label: "Skills", href: "/admin/engineer/skills" },
  { key: "u", label: "Education", href: "/admin/engineer/education" },
  { key: "t", label: "Timeline events", href: "/admin/engineer/events" },
  { key: "m", label: "Milestones", href: "/admin/engineer/milestones" },
  { key: "a", label: "Architecture diagrams", href: "/admin/engineer/architecture" },
  { key: "l", label: "Profile links", href: "/admin/engineer/links" },
  { key: "f", label: "Hiring facts", href: "/admin/engineer/hiring" },
  { key: "b", label: "Book a call", href: "/admin/engineer/booking" },
  { key: "i", label: "Identity", href: "/admin/site/identity" },
  { key: "y", label: "History", href: "/admin/site/history" },
];

export const shortcutFor = (key: string): Shortcut | undefined => SHORTCUTS.find((s) => s.key === key.toLowerCase());

export type PaletteItem = { id: string; label: string; hint: string; href: string };

export const QUICK_ACTIONS: PaletteItem[] = [
  { id: "qa-project", label: "Add project", hint: "quick action", href: "/admin/engineer/projects?new=1" },
  { id: "qa-cert", label: "Add certificate", hint: "quick action", href: "/admin/engineer/certifications?new=1" },
  { id: "qa-exp", label: "Add experience", hint: "quick action", href: "/admin/engineer/experience?new=1" },
  { id: "qa-hiring", label: "Edit hiring facts", hint: "quick action", href: "/admin/engineer/hiring" },
  { id: "qa-resume", label: "Build résumé", hint: "quick action", href: "/admin/engineer/copy?key=engineer.resume" },
  { id: "qa-backup", label: "Backup now (download JSON)", hint: "quick action", href: "/admin/backup" },
  { id: "qa-preview", label: "Preview site", hint: "quick action", href: "/admin/preview?to=hub" },
];

/** Every section in the map, as palette rows. */
export function sectionItems(): PaletteItem[] {
  return [
    { id: "home", label: "Home", hint: "section", href: "/admin" },
    ...NAV.flatMap((g) => g.sections.filter((s) => s.kind !== "soon").map((s) => ({ id: `${g.id}/${s.id}`, label: s.label, hint: `${g.label} section`, href: sectionPath(g.id, s.id) }))),
  ];
}

/** Every word of the query must appear in the label or hint; label hits rank first, then earlier hits. */
export function filterPalette(items: readonly PaletteItem[], query: string): PaletteItem[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [...items];
  const scored: { item: PaletteItem; score: number }[] = [];
  for (const item of items) {
    const label = item.label.toLowerCase();
    const all = `${label} ${item.hint.toLowerCase()}`;
    if (!words.every((w) => all.includes(w))) continue;
    const inLabel = words.every((w) => label.includes(w));
    scored.push({ item, score: (inLabel ? 0 : 1000) + Math.min(...words.map((w) => (label.indexOf(w) < 0 ? 999 : label.indexOf(w)))) });
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.item);
}
