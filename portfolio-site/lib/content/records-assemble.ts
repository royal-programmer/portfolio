/**
 * Turns engineer records (rows of the `entries` table) into the shapes the terminal, the résumé PDF and the
 * Netflix view already consume (`TermResume`, `TermCommit[]`, `ArchDiagram[]`, `TermProfile[]`, contact links).
 * Pure: no server imports, so the reader, `terminalData` and the equality test all share it. An empty record
 * list assembles to an empty result, never to hard-coded content.
 */
import type { EntryDataMap, RecordType } from "./types";
import type { ArchDiagram } from "@/lib/site/terminal-arch";
import type { TermCommit, TermLink, TermPeriod, TermResume } from "@/lib/site/terminal-data";
import type { TermProfile } from "@/lib/site/profiles";

/** What the assembler needs of an `entries` row. */
export type RecordRow<T extends RecordType> = { slug: string; order: number; data: EntryDataMap[T] };
export type Records = { [T in RecordType]: RecordRow<T>[] };

export const emptyRecords = (): Records => ({ experience: [], education: [], certification: [], skill_group: [], timeline_event: [], milestone: [], diagram: [], profile_link: [] });

/** The part of the résumé that is not a list (`engineer.resume`): header, personal projects, the PDF's bullet picks. */
export type ResumeHead = Partial<Pick<TermResume, "name" | "title" | "location" | "summary" | "personalProjects" | "pdfBullets">>;

const byOrder = <T extends { order: number; slug: string }>(rows: T[]): T[] => [...rows].sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
const compact = <T extends Record<string, unknown>>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
/** `experience-altimetrik` -> `altimetrik`: the id a diagram, profile or tag uses. */
const idOf = (slug: string, prefix: string) => (slug.startsWith(prefix) ? slug.slice(prefix.length) : slug);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1] ?? ""} ${ym.slice(0, 4)}`.trim();
/** `Oct 2024 – present`: rendered from the structured period, never stored as text. */
export const periodText = (p: { start: string; end: string }) => `${monthYear(p.start)} – ${p.end === "present" ? "present" : monthYear(p.end)}`;

export function resumeFromRecords(r: Records, head: ResumeHead = {}): TermResume {
  return compact({
    name: head.name ?? "",
    title: head.title ?? "",
    location: head.location ?? "",
    summary: head.summary ?? "",
    skills: byOrder(r.skill_group).map((g) => {
      const links = Object.fromEntries(
        g.data.items.flatMap((it) => {
          const l = compact({ projects: it.projects?.length ? it.projects : undefined, experience: it.experience?.length ? it.experience : undefined, certifications: it.certifications?.length ? it.certifications : undefined });
          return Object.keys(l).length ? [[it.name, l]] : [];
        }),
      );
      return compact({ group: g.data.group, items: g.data.items.map((it) => it.name), links: Object.keys(links).length ? links : undefined });
    }),
    experience: byOrder(r.experience).map((e) => ({ id: e.slug, role: e.data.role, company: e.data.company, period: periodText(e.data.period), headline: e.data.headline, bullets: e.data.bullets })),
    personalProjects: head.personalProjects ?? [],
    certifications: byOrder(r.certification).map((c) => compact({ id: c.slug, issuer: c.data.issuer, line: c.data.line, items: c.data.items, verify: c.data.verify })),
    education: byOrder(r.education).map((e) => compact({ degree: e.data.degree, school: e.data.school, year: e.data.period.end === "present" ? "present" : e.data.period.end.slice(0, 4), note: e.data.note })),
    pdfBullets: head.pdfBullets,
  }) as TermResume;
}

/** Events and school/life points, in one history ordered by the records' own `order`. */
export function timelineFromRecords(r: Records): TermCommit[] {
  const rows = byOrder<{ order: number; slug: string; e: TermCommit }>([
    ...r.timeline_event.map((x) => ({ order: x.order, slug: x.slug, e: x.data })),
    ...r.milestone.flatMap((x) => (x.data.kind === "event" ? [{ order: x.order, slug: x.slug, e: x.data }] : [])),
  ]);
  return rows.map(({ e }) => compact({ date: e.date, subject: e.subject, body: e.body, branch: e.branch, tag: e.tag, grade: e.grade }));
}

export function periodsFromRecords(r: Records): TermPeriod[] {
  return byOrder(r.milestone).flatMap((x) =>
    x.data.kind === "period" ? [compact({ id: idOf(x.slug, "period-"), label: x.data.label, from: x.data.from, to: x.data.to, grade: x.data.grade, note: x.data.note })] : [],
  );
}

export function archFromRecords(r: Records): { diagrams: ArchDiagram[]; projectArch: Record<string, string> } {
  const rows = byOrder(r.diagram);
  const diagrams = rows.map((d): ArchDiagram => compact({ id: idOf(d.slug, "diagram-"), title: d.data.title, line: d.data.line, nodes: d.data.nodes, edges: d.data.edges, notes: d.data.notes }) as ArchDiagram);
  const projectArch: Record<string, string> = {};
  for (const d of rows) for (const p of d.data.projects) projectArch[p] = idOf(d.slug, "diagram-");
  return { diagrams, projectArch };
}

export function profilesFromRecords(r: Records): TermProfile[] {
  return byOrder(r.profile_link).map((p) =>
    compact({ id: idOf(p.slug, "link-"), label: p.data.label, handle: p.data.handle, href: p.data.href, group: p.data.group, live: p.data.live, note: p.data.note, optional: p.data.optional }),
  ) as TermProfile[];
}

/** The terminal's `contact` rows that come from profile links (the mail row is added by the caller from the identity). */
export function contactFromRecords(r: Records): TermLink[] {
  return byOrder(r.profile_link)
    .flatMap((p) => (p.data.contact && p.data.href ? [{ rank: p.data.contact.rank, link: compact({ label: p.data.contact.label, href: p.data.href, group: p.data.contact.group }) as TermLink }] : []))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.link);
}
