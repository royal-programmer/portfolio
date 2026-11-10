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

/** A technology on the cast row (N5): how many episodes / projects mention it. `key` is the canonical lower-case name. */
export type CastMember = { id: string; key: string; name: string; count: number };

export type NetflixRow =
  | { id: string; title: string; kind: "cast"; items: CastMember[] }
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
  /** The Recruiter cut (N3): card ids in play order, resolved from `RECRUITER_CUT`. Empty on the other profiles. */
  recruiterCut: string[];
};

/**
 * The Recruiter cut's three stops, in order (N3). Each is matched against the data, never hard-coded in the view:
 * a project card by slug, else an episode by title (and tag, when given). The first hit wins.
 */
export const RECRUITER_CUT: ReadonlyArray<{ episode?: { title: RegExp; tag?: string }; project?: string }> = [
  { episode: { title: /shift roster/i, tag: "v2.0" } },
  { episode: { title: /11 python automations/i } },
  { project: "api-test-center", episode: { title: /api test center/i } },
];

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

  const cast = buildCast(data, episodes, projectCards);
  const castRows: NetflixRow[] = cast.length ? [{ id: "cast", title: "Cast · the stack", kind: "cast", items: cast }] : [];
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
      ...castRows,
      { id: "certs", title: "Certifications", kind: "episodes", items: learning },
      tbc,
    ];
  } else if (profile === "developer") {
    facts = [`${publicProjects.length} ${publicProjects.length === 1 ? "project" : "projects"}`, `${skills.length} tools in the stack`, parts[0]].filter((s): s is string => !!s);
    rows = [
      projects,
      { id: "stack", title: "Stack", kind: "skills", items: stackFirst },
      ...castRows,
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
    rows = [...seasonRows, ...castRows, tbc];
  }

  // Newest season first on the bar, like the brief's chips (2026 … 2002); the other profiles list their rows.
  if (profile === "story") nav = [...years.map((y) => ({ id: `s${y}`, label: String(y) })), ...castRows.map(() => ({ id: "cast", label: "Cast" }))];
  else nav = rows.filter((r) => r.kind !== "contact").map((r) => ({ id: r.id, label: r.title }));

  return {
    title: data.resume.name,
    tagline: identity.phrase,
    hero: { kicker: `A SERIES · ${profileName} cut`, title: data.resume.name, blurb: data.resume.summary, facts },
    seasons: years,
    nav,
    rows,
    recruiterCut: profile === "recruiter" ? resolveCut(episodes, projectCards) : [],
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

/* ---------- N2: "Because you opened …" ---------- */

export type BecauseRow = { id: string; title: string; items: NfItem[] };

/** The tags and stack an item carries, lower-cased, for the "shares two" rule. */
const tagSet = (item: NfItem): Set<string> => {
  const f = factsOf(item);
  return new Set([...f.tags, ...f.stack].map((t) => t.toLowerCase()));
};

const dateOf = (item: NfItem) => (item.kind === "episode" ? item.e.date : item.kind === "skill" ? "" : `${item.c.year ?? ""}`);

/**
 * Up to two rows seeded by the most recently opened cards (`recent`, newest first): up to 8 cards that share the
 * seed's branch, or at least two tags / stack entries with it, newest first, never a card already in Continue
 * watching (`exclude`) or the seed itself. Derived from what is already stored; nothing new is kept.
 */
export function becauseRows(recent: string[], pool: NfItem[], index: Map<string, NfItem>, exclude: Set<string>, rows = 2, per = 8): BecauseRow[] {
  const out: BecauseRow[] = [];
  const seen = new Set<string>();
  for (const id of recent) {
    if (out.length >= rows) break;
    const seed = index.get(id);
    if (!seed || seen.has(id)) continue;
    seen.add(id);
    const mine = tagSet(seed);
    const items = pool
      .filter((o) => o.id !== seed.id && !exclude.has(o.id))
      .filter((o) => {
        if (seed.kind === "episode" && o.kind === "episode" && o.e.branch === seed.e.branch) return true;
        if (seed.kind === "skill" && o.kind === "skill" && o.s.group === seed.s.group) return true;
        let shared = 0;
        for (const t of tagSet(o)) if (mine.has(t)) shared += 1;
        return shared >= 2;
      })
      .sort((a, b) => (dateOf(a) < dateOf(b) ? 1 : dateOf(a) > dateOf(b) ? -1 : a.id < b.id ? -1 : 1))
      .slice(0, per);
    if (items.length) out.push({ id: `because-${out.length}`, title: `Because you opened ${clip(factsOf(seed).title, 60)}`, items });
  }
  return out;
}

/* ---------- N3: the Recruiter cut ---------- */

function resolveCut(episodes: Episode[], projects: ProjectCard[]): string[] {
  const ids: string[] = [];
  for (const step of RECRUITER_CUT) {
    const card = step.project ? projects.find((p) => p.id === `project-${step.project}`) : undefined;
    if (card) {
      ids.push(card.id);
      continue;
    }
    const spec = step.episode;
    const ep = spec ? (episodes.find((e) => spec.title.test(e.title) && (!spec.tag || e.tag === spec.tag)) ?? episodes.find((e) => spec.title.test(e.title))) : undefined;
    if (ep) ids.push(ep.id);
  }
  return ids;
}

/* ---------- N4: season recap ---------- */

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/** The typed recap for one season of the full story: the count, one line per episode, then the period and grade. */
export function seasonRecap(show: NetflixShow, year: number): string[] {
  const row = show.rows.find((r) => r.id === `s${year}`);
  if (!row || row.kind !== "episodes") return [];
  const eps = [...row.items].sort((a, b) => a.n - b.n);
  const label = row.title.split(" · ").slice(1).join(" · ");
  const grade = eps.find((e) => e.grade)?.grade;
  const lines = [`Season ${year} · ${eps.length} ${eps.length === 1 ? "episode" : "episodes"}`, ...eps.map((e) => clip(e.title, 70))];
  const tail = [label, grade].filter(Boolean).join(" · ");
  if (tail) lines.push(tail);
  return lines;
}

/* ---------- N5: cast and crew ---------- */

/** Spellings that mean the same technology; keyed by the canonical lower-case name. */
const CAST_ALIASES: Record<string, string[]> = {
  ".net": [".net", "dotnet", "asp.net", "dot net"],
  typescript: ["typescript", "ts"],
  javascript: ["javascript", "js", "ecmascript"],
  "c#": ["c#", "csharp"],
  postgresql: ["postgresql", "postgres"],
  "sql server": ["sql server", "mssql"],
  react: ["react", "react.js", "reactjs"],
  "next.js": ["next.js", "nextjs"],
  "node.js": ["node.js", "nodejs", "node"],
  "github actions": ["github actions"],
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9#+.]+/g, "-")
    .replace(/^-+|-+$/g, "");
const canonical = (name: string): string => {
  const n = name.trim().toLowerCase();
  for (const [key, list] of Object.entries(CAST_ALIASES)) if (key === n || list.includes(n)) return key;
  return n;
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const reCache = new Map<string, RegExp>();
const termRe = (key: string): RegExp => {
  let re = reCache.get(key);
  if (!re) {
    const terms = [...new Set([key, ...(CAST_ALIASES[key] ?? [])])];
    re = new RegExp(`(?<![a-z0-9])(?:${terms.map(escapeRe).join("|")})(?![a-z0-9#+])`, "i");
    reCache.set(key, re);
  }
  return re;
};

/** The canonical technology behind a `?cast=` value (a slug or a name), or null when empty. */
export const castKeyOf = (value: string | null | undefined): string | null => {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  for (const key of Object.keys(CAST_ALIASES)) if (slug(key) === v || key === v) return key;
  return canonical(v);
};

const haystack = (item: NfItem): string => {
  const f = factsOf(item);
  return [f.title, f.blurb, ...f.tags, ...f.stack].filter(Boolean).join(" \n ");
};

/** Does this card mention the technology? (title, synopsis, tags, project stack; case-insensitive, aliases folded.) */
export function mentionsCast(item: NfItem, key: string): boolean {
  return termRe(key).test(haystack(item));
}

/** The technologies an item mentions, from the show's cast (the modal's "Cast:" chips). */
export function castOf(item: NfItem, cast: CastMember[]): CastMember[] {
  const hay = haystack(item);
  return cast.filter((c) => termRe(c.key).test(hay));
}

const niceName = (s: string) => (s === s.toLowerCase() ? (s.length <= 3 ? s.toUpperCase() : s.charAt(0).toUpperCase() + s.slice(1)) : s);

/** data.stack ∪ résumé skills, each with the count of episodes and projects that mention it. Computed once per build. */
export function buildCast(data: TerminalData, episodes: Episode[], projects: ProjectCard[]): CastMember[] {
  const names = new Map<string, string>();
  for (const g of data.resume.skills) for (const n of g.items) if (!names.has(canonical(n))) names.set(canonical(n), n);
  for (const n of data.stack) if (!names.has(canonical(n))) names.set(canonical(n), niceName(n));
  const haystacks = [...episodes.map((e) => haystack({ id: e.id, kind: "episode", e })), ...projects.map((c) => haystack({ id: c.id, kind: c.kind, c }))];
  return [...names.entries()]
    .map(([key, name]) => {
      const re = termRe(key);
      return { id: `cast-${slug(key)}`, key, name, count: haystacks.filter((h) => re.test(h)).length };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
