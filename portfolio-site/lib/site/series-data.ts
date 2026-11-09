/**
 * The Series view's data (17-persona-views.md §7): the terminal's own dataset (timeline, résumé, projects,
 * posts, contact) arranged as a show. Pure, no React. A profile is an ordering of the same data, not
 * different data; the only literals here are labels.
 */
import type { BlogPost, Entry } from "@/lib/content/types";
import { personaIdentity } from "@/lib/site/brand";
import type { TermCommit, TerminalData } from "@/lib/site/terminal-data";

export type SeriesProfileId = "recruiter" | "developer" | "story";
export type SeriesProfile = { id: SeriesProfileId; name: string; line: string; /** One character, drawn in the tile's accent. */ glyph: string };

export const SERIES_PROFILES: readonly SeriesProfile[] = [
  { id: "recruiter", name: "Recruiter", line: "The short cut: work, projects, skills, how to reach me.", glyph: "R" },
  { id: "developer", name: "Developer", line: "Projects and the stack first, then the side quests.", glyph: "{}" },
  { id: "story", name: "Full story", line: "Every season since 2002, school to now.", glyph: "∞" },
];

export const isSeriesProfile = (s: string | null | undefined): s is SeriesProfileId => SERIES_PROFILES.some((p) => p.id === s);

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

export type SeriesRow =
  | { id: string; title: string; kind: "episodes"; items: Episode[] }
  | { id: string; title: string; kind: "cards"; items: ProjectCard[] }
  | { id: string; title: string; kind: "skills"; items: SkillCard[] }
  | { id: string; title: string; kind: "contact"; items: [] };

export type Series = {
  title: string;
  tagline: string;
  hero: { kicker: string; title: string; blurb: string; facts: string[] };
  /** Years with at least one episode, newest first. */
  seasons: number[];
  /** What the sticky bar offers: seasons for the full story, the rows otherwise. Each id is a row id. */
  nav: Array<{ id: string; label: string }>;
  rows: SeriesRow[];
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

export function buildSeries(profile: SeriesProfileId, data: TerminalData, entries: Entry[], posts: BlogPost[]): Series {
  void entries;
  void posts;
  const identity = personaIdentity("engineer");
  const profileName = SERIES_PROFILES.find((p) => p.id === profile)?.name ?? "";
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
  const open = data.status;

  const work: SeriesRow = { id: "work", title: "Work seasons", kind: "episodes", items: main };
  const projects: SeriesRow = { id: "projects", title: "Projects", kind: "cards", items: projectCards };
  const tbc: SeriesRow = { id: "tbc", title: "To be continued", kind: "contact", items: [] };

  let rows: SeriesRow[];
  let facts: string[];
  let nav: Series["nav"];

  if (profile === "recruiter") {
    facts = [parts[0], parts[1], open].filter((s): s is string => !!s);
    rows = [
      work,
      projects,
      { id: "skills", title: "Skills", kind: "skills", items: skills },
      { id: "certs", title: "Certifications", kind: "episodes", items: learning },
      tbc,
    ];
  } else if (profile === "developer") {
    facts = [`${publicProjects.length} projects`, `${data.stack.length} tools in the stack`, parts[0]].filter((s): s is string => !!s);
    rows = [
      projects,
      { id: "stack", title: "Stack", kind: "skills", items: stackFirst },
      { id: "side", title: "Side quests", kind: "episodes", items: side },
      work,
      ...(postCards.length ? [{ id: "writing", title: "Writing", kind: "cards", items: postCards } as SeriesRow] : []),
      tbc,
    ];
  } else {
    facts = [`${years.length} seasons`, `${episodes.length} episodes`, open].filter((s): s is string => !!s);
    const label = (year: number, first: Episode) => {
      const period = data.periods.find((p) => p.from.slice(0, 4) <= String(year) && (p.to === null || String(year) <= p.to.slice(0, 4)));
      return period?.label.split(" · ")[0] ?? first.title.split(" · ")[0];
    };
    const seasonRows: SeriesRow[] = [...years].reverse().map((y) => {
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
