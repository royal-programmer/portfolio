/**
 * What a skill is backed by (17-persona-views.md section 27): the projects, the work and the certificates that
 * used it, built only from the data. A skill that carries record links (`resume.skills[].links[name]`, edited in
 * the admin) shows exactly those; one without links is matched honestly by name (a project whose stack names it,
 * an experience bullet that mentions it, a credential whose title does); one with neither says so. Pure: the
 * terminal, the Netflix view, the stage and the equality test all use it, and nothing here is invented.
 */
import type { TermProject, TermResume } from "@/lib/site/terminal-data";

/** The slice of `TerminalData` the builder reads. */
export type EvidenceInput = {
  stack: readonly string[];
  projects: ReadonlyArray<Pick<TermProject, "slug" | "title" | "stack" | "summary"> & { story?: { description?: string } }>;
  resume: Pick<TermResume, "skills" | "experience" | "certifications">;
};

export type EvProject = { slug: string; title: string; line: string };
export type EvWork = { id?: string; role: string; company: string; period: string; bullets: string[] };
export type EvCert = { id?: string; name: string; issuer: string; verify?: string };

export type SkillEvidence = {
  name: string;
  group?: string;
  /** `linked`: the skill's own record links; `matched`: found by name in the data; `none`: nothing to show. */
  source: "linked" | "matched" | "none";
  projects: EvProject[];
  work: EvWork[];
  certs: EvCert[];
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Does `text` name `skill` as a whole word ("Git" is not in "GitHub", ".NET" is not in "ASP.NET")? */
export function mentions(text: string, skill: string): boolean {
  const k = skill.trim();
  if (!k) return false;
  return new RegExp(`(?<![a-z0-9])${esc(k)}(?![a-z0-9])`, "i").test(text);
}

const lower = (s: string) => s.trim().toLowerCase();
const projectLine = (p: EvidenceInput["projects"][number]) => p.summary ?? p.story?.description ?? "";

/** Every skill name, résumé groups first and then the stack, once each (case-insensitive). */
export function skillNames(data: Pick<EvidenceInput, "stack" | "resume">): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of [...data.resume.skills.flatMap((g) => g.items), ...data.stack]) {
    if (seen.has(lower(n))) continue;
    seen.add(lower(n));
    out.push(n);
  }
  return out;
}

/** The skill a typed name means: an exact (case-insensitive) match, else the only skill that starts with it. */
export function findSkill(data: Pick<EvidenceInput, "stack" | "resume">, input: string): string | null {
  const k = lower(input);
  if (!k) return null;
  const names = skillNames(data);
  const exact = names.find((n) => lower(n) === k);
  if (exact) return exact;
  const pre = names.filter((n) => lower(n).startsWith(k));
  return pre.length === 1 ? pre[0] : null;
}

export function skillEvidence(data: EvidenceInput, name: string): SkillEvidence {
  const k = lower(name);
  const g = data.resume.skills.find((x) => x.items.some((i) => lower(i) === k));
  const display = g?.items.find((i) => lower(i) === k) ?? name;
  const links = g?.links?.[display];
  const bulletsOf = (e: EvidenceInput["resume"]["experience"][number]) => e.bullets.filter((b) => mentions(b, display));

  // 1. The record links, when they point at something that still exists.
  if (links) {
    const projects = (links.projects ?? []).flatMap((s) => {
      const p = data.projects.find((x) => x.slug === s);
      return p ? [{ slug: p.slug, title: p.title, line: projectLine(p) }] : [];
    });
    const work = (links.experience ?? []).flatMap((s) => {
      const e = data.resume.experience.find((x) => x.id === s);
      return e ? [{ id: e.id, role: e.role, company: e.company, period: e.period, bullets: bulletsOf(e) }] : [];
    });
    const certs = (links.certifications ?? []).flatMap((s) => {
      const c = data.resume.certifications.find((x) => x.id === s);
      return c ? [{ id: c.id, name: c.line, issuer: c.issuer, ...(c.verify ? { verify: c.verify } : {}) }] : [];
    });
    if (projects.length + work.length + certs.length) return { name: display, group: g?.group, source: "linked", projects, work, certs };
  }

  // 2. Honest matches by name.
  const projects = data.projects.filter((p) => p.stack.some((s) => lower(s) === k)).map((p) => ({ slug: p.slug, title: p.title, line: projectLine(p) }));
  const work = data.resume.experience.flatMap((e) => {
    const bullets = bulletsOf(e);
    return bullets.length ? [{ id: e.id, role: e.role, company: e.company, period: e.period, bullets }] : [];
  });
  const certs = data.resume.certifications.flatMap((c): EvCert[] => {
    const named = (c.items ?? []).filter((i) => mentions(i, display));
    const mk = (n: string): EvCert => ({ id: c.id, name: n, issuer: c.issuer, ...(c.verify ? { verify: c.verify } : {}) });
    if (named.length) return named.map(mk);
    return mentions(c.line, display) || mentions(c.issuer, display) ? [mk(c.line)] : [];
  });
  const none = projects.length + work.length + certs.length === 0;
  return { name: display, group: g?.group, source: none ? "none" : "matched", projects, work, certs };
}

/** All skills at once, keyed by lower-case name: what a client view takes as a prop (small, and built on the server). */
export function skillEvidenceMap(data: EvidenceInput): Record<string, SkillEvidence> {
  return Object.fromEntries(skillNames(data).map((n) => [lower(n), skillEvidence(data, n)]));
}
