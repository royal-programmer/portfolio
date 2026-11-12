/**
 * The importer's input: the frozen copy (`lib/site/legacy-content.ts`) turned into `entries` rows, settings
 * values and project patches. Pure (no network, no env), so `scripts/import-content.mjs` and
 * `scripts/content-roundtrip.mjs` build exactly the same thing. Every record gets a stable slug, so the import
 * is an idempotent upsert; `order` keeps the frozen copy's own order (steps of 10, room to insert between).
 * Delete this file with `legacy-content.ts` once the import is confirmed.
 */
import { LEGACY } from "@/lib/site/legacy-content";
import { DEFAULT_TERMINAL } from "@/lib/site/terminal-data";
import type { EntryDataMap, ProjectMedia, ProjectStory, RecordType, SkillLinks } from "./types";

export type SeedRow<T extends RecordType = RecordType> = {
  persona_slug: "engineer";
  type: T;
  slug: string;
  title: string;
  summary?: string;
  visibility: "public";
  featured: boolean;
  order: number;
  occurred_at?: string;
  data: EntryDataMap[T];
};
export type ProjectPatch = { slug: string; story?: ProjectStory; media?: ProjectMedia };

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const fullDate = (d: string) => `${d.length === 7 ? `${d}-01` : d}T00:00:00Z`;
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const ym = (s: string) => {
  const m = /^([A-Za-z]{3})\w* (\d{4})$/.exec(s.trim());
  if (!m) throw new Error(`cannot read the month in "${s}"`);
  return `${m[2]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}`;
};
/** `Oct 2024 – present` -> `{ start: "2024-10", end: "present" }`. */
const periodOf = (text: string) => {
  const [a, b] = text.split(/\s[–-]\s/);
  return { start: ym(a), end: /present/i.test(b) ? "present" : ym(b) };
};

/**
 * Which records each skill relates to, from the résumé's own statements (the .NET APIs and the SQL Server
 * redesign of Shift Roster, the Python automations and credentials, the CI/CD work). Seed data like the rest:
 * editable in the admin, and a slug that matches no record is simply not shown.
 */
const EXP = "experience-altimetrik";
const SR = "shift-roster";
const SKILL_LINKS: Record<string, SkillLinks> = {
  "C#": { experience: [EXP], projects: [SR] },
  ".NET": { experience: [EXP], projects: [SR] },
  "ASP.NET MVC": { experience: [EXP], projects: [SR] },
  React: { experience: [EXP], projects: [SR] },
  TypeScript: { experience: [EXP], projects: [SR] },
  Python: { experience: [EXP], certifications: ["certification-cisco-networking-academy", "certification-ibm"] },
  FastAPI: { experience: [EXP] },
  "REST APIs": { experience: [EXP] },
  "SQL Server": { experience: [EXP], projects: [SR] },
  "T-SQL": { experience: [EXP], projects: [SR] },
  RabbitMQ: { experience: [EXP] },
  NetSuite: { experience: [EXP] },
  "Oracle E-Business Suite": { experience: [EXP] },
  "GitHub Actions": { experience: [EXP] },
  "CI/CD": { experience: [EXP] },
  "Microsoft Entra ID": { experience: [EXP] },
};

export type Seed = {
  rows: SeedRow[];
  projectPatches: ProjectPatch[];
  /** Settings values the import writes (when a key has no row yet). */
  settings: {
    "engineer.resume": { name: string; title: string; location: string; summary: string; personalProjects: typeof LEGACY.RESUME.personalProjects; pdfBullets?: number[] };
    "engineer.hiring": typeof LEGACY.HIRING;
    "engineer.clock": typeof LEGACY.CLOCK;
  };
  /** Merged into the existing `netflix` setting (never replaces its profiles or adjectives). */
  bookCall: { label: string; href: string };
};

export function buildSeed(): Seed {
  const L = LEGACY;
  const rows: SeedRow[] = [];
  const add = <T extends RecordType>(r: Omit<SeedRow<T>, "persona_slug" | "visibility" | "featured"> & { featured?: boolean }) => {
    rows.push({ persona_slug: "engineer", visibility: "public", featured: false, ...r } as SeedRow);
  };

  L.RESUME.experience.forEach((e, i) =>
    add({ type: "experience", slug: `experience-${slugify(e.company.split(" (")[0])}`, title: `${e.role} · ${e.company}`, order: i * 10, occurred_at: fullDate(periodOf(e.period).start), data: { company: e.company, role: e.role, period: periodOf(e.period), headline: e.headline, bullets: e.bullets } }),
  );

  const college = L.TIMELINE_PERIODS.find((p) => p.id === "college");
  L.RESUME.education.forEach((e, i) =>
    add({
      type: "education",
      slug: `education-${slugify(e.degree.split(",")[0])}`,
      title: `${e.degree} · ${e.school}`,
      order: i * 10,
      occurred_at: fullDate(college?.from ?? `${e.year}-01`),
      data: { degree: e.degree, school: e.school, period: { start: college?.from ?? `${e.year}-01`, end: college?.to ?? `${e.year}-07` }, ...(e.note ? { note: e.note } : {}) },
    }),
  );

  L.RESUME.certifications.forEach((c, i) =>
    add({ type: "certification", slug: `certification-${slugify(c.issuer)}`, title: c.issuer, summary: c.line, order: i * 10, data: { issuer: c.issuer, line: c.line, ...(c.items ? { items: c.items } : {}), ...(c.verify ? { verify: c.verify } : {}) } }),
  );

  L.RESUME.skills.forEach((g, i) =>
    add({ type: "skill_group", slug: `skills-${slugify(g.group)}`, title: g.group, order: i * 10, data: { group: g.group, items: g.items.map((name) => ({ name, ...(SKILL_LINKS[name] ?? {}) })) } }),
  );

  // School and life are milestones; the career and its learning are timeline events. One shared order keeps the history in sequence.
  const seen = new Set<string>();
  L.TIMELINE.forEach((c, i) => {
    const milestone = c.branch === "life" || c.date < "2020-08";
    const type = milestone ? "milestone" : "timeline_event";
    let slug = `${milestone ? "milestone" : "timeline"}-${c.date}-${slugify(c.subject).slice(0, 36).replace(/-$/, "")}`;
    for (let n = 2; seen.has(slug); n++) slug = `${slug}-${n}`;
    seen.add(slug);
    const event = { date: c.date, subject: c.subject, branch: c.branch, ...(c.body ? { body: c.body } : {}), ...(c.tag ? { tag: c.tag } : {}), ...(c.grade ? { grade: c.grade } : {}) };
    add({ type, slug, title: c.subject, order: i * 10, occurred_at: fullDate(c.date), data: milestone ? { kind: "event", ...event } : event } as SeedRow<"milestone" | "timeline_event">);
  });
  L.TIMELINE_PERIODS.forEach((p, i) =>
    add({ type: "milestone", slug: `period-${p.id}`, title: p.label, order: 10000 + i * 10, occurred_at: fullDate(p.from), data: { kind: "period", label: p.label, from: p.from, to: p.to, ...(p.grade ? { grade: p.grade } : {}), ...(p.note ? { note: p.note } : {}) } }),
  );

  L.ARCH.forEach((d, i) =>
    add({
      type: "diagram",
      slug: `diagram-${d.id}`,
      title: d.title,
      summary: d.line,
      order: i * 10,
      data: { title: d.title, ...(d.line ? { line: d.line } : {}), nodes: d.nodes, edges: d.edges, notes: d.notes, projects: Object.entries(L.PROJECT_ARCH).filter(([, id]) => id === d.id).map(([slug]) => slug) },
    }),
  );

  // Contact rows come from the terminal's own list (mail excluded: it follows the identity); each is matched to its profile by link.
  const contact = DEFAULT_TERMINAL.contact;
  L.PROFILES.forEach((p, i) => {
    const at = contact.findIndex((c) => c.href === p.href);
    const c = at >= 0 ? contact[at] : undefined;
    add({
      type: "profile_link",
      slug: `link-${p.id}`,
      title: p.label,
      order: i * 10,
      data: { label: p.label, handle: p.handle, ...(p.href ? { href: p.href } : {}), group: p.group, ...(p.live ? { live: p.live } : {}), ...(p.note ? { note: p.note } : {}), ...(p.optional ? { optional: true } : {}), ...(c ? { contact: { label: c.label, rank: at, ...(c.group ? { group: c.group } : {}) } } : {}) },
    });
  });

  const slugs = new Set([...Object.keys(L.PROJECT_STORY), ...Object.keys(L.PROJECT_MEDIA)]);
  const projectPatches: ProjectPatch[] = [...slugs].map((slug) => ({ slug, ...(L.PROJECT_STORY[slug] ? { story: L.PROJECT_STORY[slug] } : {}), ...(L.PROJECT_MEDIA[slug] ? { media: L.PROJECT_MEDIA[slug] } : {}) }));

  const r = L.RESUME;
  return {
    rows,
    projectPatches,
    settings: {
      "engineer.resume": { name: r.name, title: r.title, location: r.location, summary: r.summary, personalProjects: r.personalProjects, ...(r.pdfBullets ? { pdfBullets: r.pdfBullets } : {}) },
      "engineer.hiring": L.HIRING,
      "engineer.clock": L.CLOCK,
    },
    bookCall: L.BOOK_CALL,
  };
}
