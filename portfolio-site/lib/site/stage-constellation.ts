/**
 * The Stage's skill constellation (S5), as pure data: one star per technology (the terminal's `stack`
 * then the resume's skills, deduplicated, capped), placed on a sphere cap by a hash of its name (the same
 * name always lands on the same spot), joined to the technologies it appears with in an `arch` diagram or
 * in one project's stack. No three.js here: the component turns this into Points and LineSegments.
 */
import type { ArchDiagram } from "./terminal-arch";

export type Star = {
  name: string;
  /** Position on the cap, in the assembly's frame. */
  pos: [number, number, number];
  /** The terminal command a click runs. */
  cmd: string;
};
export type Constellation = { stars: Star[]; edges: Array<[number, number]> };

/** The cap: a sphere above and behind the desk, seen from the front (assembly units). */
export const CAP = { centre: [0.3, 1.2, 0.4] as const, radius: 2.9, azimuth: 0.95, elevation: [0.62, 1.3] as const };
/** Technologies whose click opens the languages chart. */
export const LANGUAGES = ["c#", "python", "typescript", "t-sql", "javascript"];

const norm = (s: string) => s.trim().toLowerCase();
const tokens = (s: string) => norm(s).split(/[^a-z0-9#.+]+/).filter(Boolean);

/** FNV-1a, 32 bit, then split into three 0..1 numbers. */
export function hash3(name: string): [number, number, number] {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const next = () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
  return [next(), next(), next()];
}

/** Does this diagram node label name the technology (every word of the technology is a word of the label)? */
function labelHas(label: string, tech: string): boolean {
  const l = tokens(label);
  const t = tokens(tech);
  return t.length > 0 && t.every((w) => l.includes(w));
}

export function buildConstellation(input: { stack: string[]; skills: string[]; arch: ArchDiagram[]; projects: Array<{ stack: string[] }> }, max: number): Constellation {
  // The names: stack first (the headline technologies), then the resume's, one star each.
  const seen = new Map<string, string>();
  const display = new Map<string, string>();
  for (const s of input.skills) display.set(norm(s), s);
  for (const s of [...input.stack, ...input.skills]) {
    const k = norm(s);
    if (!seen.has(k) && seen.size < max) seen.set(k, display.get(k) ?? s);
  }
  const names = [...seen.values()];
  const keys = names.map(norm);

  const groups: number[][] = [];
  for (const d of input.arch) {
    const g = names.map((n, i) => (d.nodes.some((node) => labelHas(node.label, n)) ? i : -1)).filter((i) => i >= 0);
    if (g.length > 1) groups.push(g);
  }
  for (const p of input.projects) {
    const set = new Set(p.stack.map(norm));
    const g = keys.map((k, i) => (set.has(k) ? i : -1)).filter((i) => i >= 0);
    if (g.length > 1) groups.push(g);
  }
  const edgeSet = new Set<string>();
  for (const g of groups) for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) edgeSet.add(`${g[a]}:${g[b]}`);
  const edges = [...edgeSet].map((e) => e.split(":").map(Number) as [number, number]);

  // Place by hash (azimuth, elevation, a little depth), then ease apart so no two stars sit on top of each other.
  const az = names.map((n) => (hash3(n)[0] * 2 - 1) * CAP.azimuth);
  const el = names.map((n) => CAP.elevation[0] + hash3(n)[1] * (CAP.elevation[1] - CAP.elevation[0]));
  const dep = names.map((n) => 0.94 + hash3(n)[2] * 0.12);
  for (let iter = 0; iter < 40; iter++) {
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const dx = az[j] - az[i];
        const dy = el[j] - el[i];
        const d = Math.hypot(dx, dy) || 0.001;
        const min = 0.2;
        if (d < min) {
          const push = (min - d) / 2;
          az[i] -= (dx / d) * push;
          az[j] += (dx / d) * push;
          el[i] -= (dy / d) * push;
          el[j] += (dy / d) * push;
        }
      }
      az[i] = Math.max(-CAP.azimuth, Math.min(CAP.azimuth, az[i]));
      el[i] = Math.max(CAP.elevation[0], Math.min(CAP.elevation[1], el[i]));
    }
  }
  const stars = names.map((name, i): Star => {
    const r = CAP.radius * dep[i];
    const pos: [number, number, number] = [CAP.centre[0] + Math.sin(az[i]) * Math.cos(el[i]) * r, CAP.centre[1] + Math.sin(el[i]) * r, CAP.centre[2] - Math.cos(az[i]) * Math.cos(el[i]) * r];
    // A star opens what that technology is backed by (`skill <name>` in the terminal); `commandFor` stays for the old routes.
    return { name, pos, cmd: `skill ${name}` };
  });
  return { stars, edges };
}

/** Languages → the languages chart; a technology in exactly one diagram → that diagram; the rest → `stack`. */
export function commandFor(key: string, diagrams: string[]): string {
  if (LANGUAGES.includes(key)) return "stats langs";
  if (diagrams.length === 1) return `arch ${diagrams[0]}`;
  return "stack";
}
