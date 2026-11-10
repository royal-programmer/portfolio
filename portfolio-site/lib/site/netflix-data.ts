/**
 * The NetflixShow view's data (17-persona-views.md §7): the terminal's own dataset (timeline, résumé, projects,
 * posts, contact) arranged as a show. Pure, no React. A profile is an ordering of the same data, not
 * different data; the only literals here are labels.
 */
import type { BlogPost, Entry } from "@/lib/content/types";
import { personaIdentity } from "@/lib/site/brand";
import type { TermCommit, TerminalData } from "@/lib/site/terminal-data";

export type NetflixProfileId = "recruiter" | "developer" | "story";
export type NetflixProfile = { id: NetflixProfileId; name: string; line: string; /** One character, drawn in the tile's accent. */ glyph: string };

export const NETFLIX_PROFILES: readonly NetflixProfile[] = [
  { id: "recruiter", name: "Recruiter", line: "The short cut: work, projects, skills, how to reach me.", glyph: "R" },
  { id: "developer", name: "Developer", line: "Projects and the stack first, then the side quests.", glyph: "{}" },
  { id: "story", name: "Full story", line: "Every season since 2002, school to now.", glyph: "∞" },
];

export const isNetflixProfile = (s: string | null | undefined): s is NetflixProfileId => NETFLIX_PROFILES.some((p) => p.id === s);

export type Episode = {
  id: string;
  /** The year. */
  season: number;
  /** Order within the year. */
  n: number;
  title: string;
  synopsis?: string;
  tag?: string;
  branch: TermCommit["branch"];
  date: string;
  /** "3 mo" until the next commit on the same branch, "1 ep" when under a month. */
  runtime: string;
  grade?: string;
  /** A project / view link when the episode is one. */
  href?: string;
};

export type SkillCard = { id: string; name: string; group: string };
export type ProjectCard = {
  id: string;
  title: string;
  summary?: string;
  stack: string[];
  live?: string;
  repo?: string;
  year?: string;
  /** Internal page, when there is one. */
  href?: string;
  kind: "project" | "post";
};

export type NetflixRow =
  | { id: string; title: string; kind: "episodes"; items: Episode[] }
  | { id: string; title: string; kind: "cards"; items: ProjectCard[] }
  | { id: string; title: string; kind: "skills"; items: SkillCard[] }
  | { id: string; title: string; kind: "contact"; items: [] };

export type NetflixShow = {
  title: string;
  tagline: string;
  hero: { kicker: string; title: string; blurb: string; facts: string[] };
  /** Years with at least one episode, newest first. */
  seasons: number[];
  /** What the sticky bar offers: seasons for the full story, the rows otherwise. Each id is a row id. */
  nav: Array<{ id: string; label: string }>;
  rows: NetflixRow[];
};

const monthIndex = (date: string) => {
  const [y, m] = date.split("-");
  return Number(y) * 12 + (Number(m) || 1) - 1;
};

export function buildEpisodes(data: TerminalData, projects: Array<{ slug: string }> = []): Episode[] {
  const sorted = data.timeline.map((c, i) => ({ c, i })).sort((a, b) => monthIndex(a.c.date) - monthIndex(b.c.date) || a.i - b.i);
  const perYear = new Map<number, number>();
  const slugs = new Set(projects.map((p) => p.slug));
  return sorted.map(({ c }, k) => {
    const season = Number(c.date.slice(0, 4));
    const n = (perYear.get(season) ?? 0) + 1;
    perYear.set(season, n);
    const next = sorted.slice(k + 1).find((o) => o.c.branch === c.branch);
    const months = next ? monthIndex(next.c.date) - monthIndex(c.date) : 0;
    return {
      id: `${c.date}-${k}`,
      season,
      n,
      title: c.subject,
      synopsis: c.body?.join(" "),
      tag: c.tag,
      branch: c.branch,
      date: c.date,
      runtime: months >= 24 ? `${Math.round(months / 12)} yr` : months >= 1 ? `${months} mo` : "1 ep",
      grade: c.grade,
      href: c.tag && slugs.has(c.tag) ? `/engineer/${c.tag}` : undefined,
    };
  });
}

const newestFirst = (a: Episode, b: Episode) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.n - a.n);

export function buildNetflix(profile: NetflixProfileId, data: TerminalData, entries: Entry[], posts: BlogPost[]): NetflixShow {
  void entries;
  void posts;
  const identity = personaIdentity("engineer");
  const profileName = NETFLIX_PROFILES.find((p) => p.id === profile)?.name ?? "";
  const publicProjects = data.projects;
  const episodes = buildEpisodes(data, publicProjects);
  const years = [...new Set(episodes.map((e) => e.season))].sort((a, b) => b - a);

  const projectCards: ProjectCard[] = publicProjects.map((p) => ({
    id: `project-${p.slug}`,
    title: p.title,
    summary: p.summary,
    stack: p.stack,
    live: p.deployedUrl,
    repo: p.repoUrl,
    year: p.year,
    href: `/engineer/${p.slug}`,
    kind: "project",
  }));
  const postCards: ProjectCard[] = data.posts.map((p) => ({ id: `post-${p.slug}`, title: p.title, summary: p.excerpt, stack: [], year: p.date?.slice(0, 4), kind: "post" }));

  const inStack = new Set(data.stack.map((s) => s.toLowerCase()));
  const skills: SkillCard[] = data.resume.skills.flatMap((g) => g.items.map((name) => ({ id: `skill-${name}`, name, group: g.group })));
  const stackFirst = [...skills].sort((a, b) => Number(inStack.has(b.name.toLowerCase())) - Number(inStack.has(a.name.toLowerCase())));

  const main = episodes.filter((e) => e.branch === "main").sort(newestFirst);
  const side = episodes.filter((e) => e.branch === "side").sort(newestFirst);
  const collegeFrom = data.periods.find((p) => p.id === "college")?.from ?? "2020-08";
  const learning = episodes.filter((e) => e.branch === "learn" && e.date >= collegeFrom).sort(newestFirst);

  const parts = data.uptime.split(" · ").map((s) => s.trim()).filter(Boolean);

  const work: NetflixRow = { id: "work", title: "Work seasons", kind: "episodes", items: main };
  const projects: NetflixRow = { id: "projects", title: "Projects", kind: "cards", items: projectCards };
  const tbc: NetflixRow = { id: "tbc", title: "To be continued", kind: "contact", items: [] };

  let rows: NetflixRow[];
  let facts: string[];
  let nav: NetflixShow["nav"];

  if (profile === "recruiter") {
    facts = [parts[0], parts[1], parts[2]].filter((s): s is string => !!s);
    rows = [
      work,
      projects,
      { id: "skills", title: "Skills", kind: "skills", items: skills },
      { id: "certs", title: "Certifications", kind: "episodes", items: learning },
      tbc,
    ];
  } else if (profile === "developer") {
    facts = [`${publicProjects.length} ${publicProjects.length === 1 ? "project" : "projects"}`, `${skills.length} tools in the stack`, parts[0]].filter((s): s is string => !!s);
    rows = [
      projects,
      { id: "stack", title: "Stack", kind: "skills", items: stackFirst },
      { id: "side", title: "Side quests", kind: "episodes", items: side },
      work,
      ...(postCards.length ? [{ id: "writing", title: "Writing", kind: "cards", items: postCards } as NetflixRow] : []),
      tbc,
    ];
  } else {
    facts = [`${years.length} seasons`, `${episodes.length} episodes`, parts[1]].filter((s): s is string => !!s);
    const label = (year: number, first: Episode) => {
      const period = data.periods.find((p) => p.from.slice(0, 4) <= String(year) && (p.to === null || String(year) <= p.to.slice(0, 4)));
      return period?.label.split(" · ")[0] ?? first.title.split(" · ")[0];
    };
    const seasonRows: NetflixRow[] = [...years].reverse().map((y) => {
      const items = episodes.filter((e) => e.season === y);
      return { id: `s${y}`, title: `Season ${y} · ${label(y, items[0])}`, kind: "episodes", items };
    });
    rows = [...seasonRows, tbc];
  }

  // Newest season first on the bar, like the brief's chips (2026 … 2002); the other profiles list their rows.
  if (profile === "story") nav = years.map((y) => ({ id: `s${y}`, label: String(y) }));
  else nav = rows.filter((r) => r.kind !== "contact").map((r) => ({ id: r.id, label: r.title }));

  return {
    title: data.resume.name,
    tagline: identity.phrase,
    hero: { kicker: `A SERIES · ${profileName} cut`, title: data.resume.name, blurb: data.resume.summary, facts },
    seasons: years,
    nav,
    rows,
  };
}

/* ---------- The modal's unified item (17-persona-views.md §7) ---------- */

/** Any card, whichever row it sits in: what the detail modal, My List and progress all key on. */
export type NfItem =
  | { id: string; kind: "episode"; e: Episode }
  | { id: string; kind: "project" | "post"; c: ProjectCard }
  | { id: string; kind: "skill"; s: SkillCard };

export const rowItems = (row: NetflixRow): NfItem[] => {
  if (row.kind === "episodes") return row.items.map((e) => ({ id: e.id, kind: "episode", e }));
  if (row.kind === "cards") return row.items.map((c) => ({ id: c.id, kind: c.kind, c }));
  if (row.kind === "skills") return row.items.map((s) => ({ id: s.id, kind: "skill", s }));
  return [];
};

/** Three adjectives per branch / kind, shown as "This series is". Labels, not data about Ratul's work. */
export const NF_ADJECTIVES: Record<string, [string, string, string]> = {
  main: ["Hands-on", "Production", "Measured"],
  learn: ["Curious", "Rigorous", "Foundational"],
  side: ["Playful", "Experimental", "Self-driven"],
  life: ["Personal", "Formative", "Human"],
  project: ["Built", "Shipped", "Open"],
  post: ["Written", "Reflective", "Plain"],
  skill: ["Practiced", "Daily", "Reliable"],
};

export const NF_BRANCH_LABEL: Record<Episode["branch"], string> = { main: "work", learn: "learning", side: "side quest", life: "life" };

/** What the modal needs from an item, flattened. */
export type NfFacts = {
  title: string;
  blurb?: string;
  /** "main" | "learn" | … for episodes; the kind for the rest. */
  tone: string;
  branchLabel: string;
  tags: string[];
  stack: string[];
  season?: number;
  n?: number;
  runtime?: string;
  grade?: string;
  /** ISO date (episodes), used for the "New" badge. */
  date?: string;
  year?: string;
  live?: string;
  repo?: string;
  href?: string;
  letter: string;
};

export function factsOf(item: NfItem): NfFacts {
  if (item.kind === "episode") {
    const e = item.e;
    return {
      title: e.title,
      blurb: e.synopsis,
      tone: e.branch,
      branchLabel: NF_BRANCH_LABEL[e.branch],
      tags: e.tag ? [e.tag] : [],
      stack: [],
      season: e.season,
      n: e.n,
      runtime: e.runtime,
      grade: e.grade,
      date: e.date,
      year: String(e.season),
      href: e.href,
      letter: e.title.trim().charAt(0).toUpperCase(),
    };
  }
  if (item.kind === "skill") {
    return { title: item.s.name, blurb: `${item.s.name}, in the ${item.s.group} group of the résumé's skills.`, tone: "skill", branchLabel: item.s.group, tags: [item.s.group], stack: [], letter: item.s.name.trim().charAt(0).toUpperCase() };
  }
  const c = item.c;
  return {
    title: c.title,
    blurb: c.summary,
    tone: item.kind,
    branchLabel: item.kind === "post" ? "writing" : "projects",
    tags: [],
    stack: c.stack,
    year: c.year,
    live: c.live,
    repo: c.repo,
    href: c.href,
    letter: c.title.trim().charAt(0).toUpperCase(),
  };
}

/** Every distinct item across all profiles (the modal and `?title=` look ids up here). */
export function indexItems(shows: NetflixShow[]): Map<string, NfItem> {
  const map = new Map<string, NfItem>();
  for (const s of shows) for (const r of s.rows) for (const it of rowItems(r)) if (!map.has(it.id)) map.set(it.id, it);
  return map;
}

/** Up to `max` neighbours: same branch for an episode, shared stack for a project, same group for a skill. */
export function moreLike(item: NfItem, index: Map<string, NfItem>, max = 6): NfItem[] {
  const all = [...index.values()].filter((o) => o.id !== item.id && o.kind === item.kind);
  let pool: NfItem[];
  if (item.kind === "episode") pool = all.filter((o) => o.kind === "episode" && o.e.branch === item.e.branch).sort((a, b) => (a.kind === "episode" && b.kind === "episode" ? (a.e.date < b.e.date ? 1 : -1) : 0));
  else if (item.kind === "skill") pool = all.filter((o) => o.kind === "skill" && o.s.group === item.s.group);
  else {
    const mine = new Set(item.c.stack);
    const score = (o: NfItem) => (o.kind === "project" || o.kind === "post" ? o.c.stack.filter((t) => mine.has(t)).length : 0);
    pool = all.sort((a, b) => score(b) - score(a));
  }
  return pool.slice(0, max);
}

/** The episode that wears the "Top 10" badge: Shift Roster, v2.0. */
export function topEpisodeId(shows: NetflixShow[]): string | null {
  for (const s of shows)
    for (const r of s.rows)
      if (r.kind === "episodes") {
        const hit = r.items.find((e) => e.tag === "v2.0" && /shift roster/i.test(e.title)) ?? r.items.find((e) => /shift roster/i.test(e.title));
        if (hit) return hit.id;
      }
  return null;
}
