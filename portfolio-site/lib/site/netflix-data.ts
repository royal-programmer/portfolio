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

/**
 * A figure from the item's own text (C1, E1): `value` and `label` read `200+ active users`; `context` is the plain
 * words that say where it comes from (`internal tool`). It is shown as a small quiet label, never as a headline
 * number. An explicit text, never invented.
 */
export type Metric = { value: string; label: string; context?: string };

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
  /** A figure found in the title or synopsis (`metricOf`); never invented. */
  metric?: Metric;
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
  metric?: Metric;
  /** Real product imagery (E2): a poster, screenshots and short clips. Only some projects have it. */
  media?: ProjectMedia;
  /** The project's story (F2): who it is for, why it exists, what it does in beats, and where it stands. */
  audience?: string;
  problem?: string;
  /** What it does, one beat each; `clip` is an id from `media.clips`. */
  beats?: ProjectBeat[];
  status?: ProjectStatus;
  /** One line that replaces the summary in the trailer's title chapter. */
  description?: string;
};

/** `clip` is a clip id from `media.clips`; `clipMs` cuts a long clip (default 8 s). */
export type ProjectBeat = { text: string; clip?: string; clipMs?: number };
export type ProjectStatus = "in-development" | "live";
export type ProjectStory = { description?: string; audience?: string; problem?: string; beats?: ProjectBeat[]; status?: ProjectStatus };

/**
 * The story fields per project slug (F2). Plain, factual, no claims beyond the product's own README. This is the one
 * function that reads them (`storyOf`), so moving them to records (round 24) changes only that function.
 */
const PROJECT_STORY: Record<string, ProjectStory> = {
  "api-test-center": {
    description: "API and performance testing on your own computer.",
    audience: "For developers and testers who check an API before it ships.",
    problem: "Checking an API usually means one tool for a single request and another for load. This one does both from the same request, and keeps every result on your computer.",
    beats: [
      { text: "Send a request and see the checks on status, JSON, body, headers and time pass or fail.", clip: "send", clipMs: 7000 },
      { text: "Run a load test, through k6, from that same request.", clip: "load-test", clipMs: 8000 },
      { text: "Every run is saved on your computer, so you can keep it and compare it later.", clip: "history", clipMs: 7000 },
    ],
    status: "in-development",
  },
};

/** The story of a project by slug; an empty story when none is written (the trailer then falls back to title, summary and stack). */
export function storyOf(slug: string): ProjectStory {
  return PROJECT_STORY[slug] ?? {};
}

/** A project's own imagery, as data (this moves to the media table in round 24). Paths are under `public/`. */
export type ProjectMedia = {
  poster: { src: string; w: number; h: number; alt: string };
  screens: Array<{ id: string; label: string; src: string; w: number; h: number }>;
  clips: Array<{ id: string; label: string; poster: string; src: string }>;
};

/**
 * Real imagery per project slug (E2). Files are made by `scripts/netflix-media.mjs` from the product's own assets: the
 * poster and screenshots as 1280-wide WebP, the clips and their posters as they are. Plain labels, no claims.
 */
export const PROJECT_MEDIA: Record<string, ProjectMedia> = {
  "api-test-center": {
    poster: { src: "/projects/api-test-center/poster.webp", w: 1280, h: 800, alt: "API Test Center: a GET request with a load test running" },
    screens: [
      { id: "builder", label: "Report builder", src: "/projects/api-test-center/screens/builder.webp", w: 1280, h: 800 },
      { id: "chain", label: "Run first: reuse a sign-in token", src: "/projects/api-test-center/screens/chain.webp", w: 1280, h: 800 },
      { id: "charts", label: "Charts", src: "/projects/api-test-center/screens/charts.webp", w: 1280, h: 800 },
      { id: "report", label: "Load report", src: "/projects/api-test-center/screens/report.webp", w: 1280, h: 800 },
      { id: "send", label: "Send a request", src: "/projects/api-test-center/screens/send.webp", w: 1280, h: 800 },
      { id: "help", label: "Help in plain words", src: "/projects/api-test-center/screens/help.webp", w: 1280, h: 800 },
    ],
    clips: [
      { id: "send", label: "Send a request", poster: "/projects/api-test-center/clips/send.jpg", src: "/projects/api-test-center/clips/send.webm" },
      { id: "load-test", label: "Run a load test", poster: "/projects/api-test-center/clips/load-test.jpg", src: "/projects/api-test-center/clips/load-test.webm" },
      { id: "sign-in", label: "Sign in first, then reuse the token", poster: "/projects/api-test-center/clips/sign-in.jpg", src: "/projects/api-test-center/clips/sign-in.webm" },
      { id: "collection", label: "Run a collection", poster: "/projects/api-test-center/clips/collection.jpg", src: "/projects/api-test-center/clips/collection.webm" },
      { id: "history", label: "History", poster: "/projects/api-test-center/clips/history.jpg", src: "/projects/api-test-center/clips/history.webm" },
      { id: "upload", label: "Upload a file", poster: "/projects/api-test-center/clips/upload.jpg", src: "/projects/api-test-center/clips/upload.webm" },
      { id: "websocket", label: "WebSocket", poster: "/projects/api-test-center/clips/websocket.jpg", src: "/projects/api-test-center/clips/websocket.webm" },
    ],
  },
};

/** A technology on the cast row (N5): how many episodes / projects mention it. `key` is the canonical lower-case name. */
export type CastMember = { id: string; key: string; name: string; count: number };

export type NetflixRow =
  | { id: string; title: string; kind: "cast"; items: CastMember[] }
  | { id: string; title: string; kind: "episodes"; items: Episode[] }
  | { id: string; title: string; kind: "cards"; items: ProjectCard[] }
  | { id: string; title: string; kind: "skills"; items: SkillCard[] }
  | { id: string; title: string; kind: "series"; items: CertSeason[] }
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
  /** The hero carousel (C3): up to three card ids with their tab labels, resolved from `FEATURED`. */
  featured: Array<{ id: string; label: string }>;
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


/* ---------- C1: the figure on a card (a quiet label since E1) ---------- */

/**
 * Explicit overrides, checked first: a title (and tag, when given) mapped to its figure, or to `null` to say
 * "no figure". Every value here is a number that already appears in the item's own text (the timeline, the
 * hiring proof lines); this table only pins the wording of the label.
 */
export const METRIC_OVERRIDES: ReadonlyArray<{ title: RegExp; tag?: string; metric: Metric | null }> = [
  { title: /shift roster/i, tag: "v2.0", metric: { value: "200+", label: "active users", context: "internal tool" } },
  { title: /11 python automations/i, metric: { value: "11", label: "automations", context: "finance and sync" } },
  { title: /vms query/i, metric: { value: "5–10 → 2–3", label: "min", context: "query time" } },
  { title: /7 openai partneru/i, metric: { value: "7", label: "credentials", context: "OpenAI PartnerU" } },
];

const NUM = String.raw`\d[\d,]*(?:\.\d+)?`;
const RANGE = String.raw`${NUM}(?:\s?[–-]\s?${NUM})?`;
const WORD_NUM: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12" };
const num = (s: string) => WORD_NUM[s.toLowerCase()] ?? s;

/**
 * The regex rules, tried in this order over "title. synopsis" (the first rule that matches wins, wherever it sits
 * in the text): a before/after time (`5–10 minutes to 2–3` -> `5–10 → 2–3 min`), a user count, a count of
 * automations, a count of credentials, a count of records. No match: no figure, pure art.
 */
const METRIC_RULES: ReadonlyArray<{ re: RegExp; make: (m: RegExpExecArray) => Metric }> = [
  { re: new RegExp(String.raw`(${RANGE})\s*min(?:ute)?s?\s+(?:to|→|->)\s+(${RANGE})`, "i"), make: (m) => ({ value: `${m[1]} → ${m[2]}`, label: "min" }) },
  { re: new RegExp(String.raw`(${NUM}\+?)\s+(?:active\s+)?users\b`, "i"), make: (m) => ({ value: m[1], label: "users" }) },
  { re: new RegExp(String.raw`\b(\d+|${Object.keys(WORD_NUM).join("|")})\s+(?:python\s+)?automations\b`, "i"), make: (m) => ({ value: num(m[1]), label: "automations" }) },
  { re: new RegExp(String.raw`\b(\d+)\s+(?:[\w-]+\s+){0,2}(?:credentials|certifications|certs)\b`, "i"), make: (m) => ({ value: m[1], label: "credentials" }) },
  { re: new RegExp(String.raw`(${NUM}K?\+?)\s+(?:employee-)?(?:shift\s+)?records\b`, "i"), make: (m) => ({ value: m[1], label: "records" }) },
];

/** The item's figure: an override when one names it, else the first regex rule that matches its text. */
export function metricOf(title: string, synopsis?: string, tag?: string): Metric | undefined {
  const o = METRIC_OVERRIDES.find((x) => x.title.test(title) && (!x.tag || x.tag === tag));
  if (o) return o.metric ?? undefined;
  const text = `${title}. ${synopsis ?? ""}`;
  for (const rule of METRIC_RULES) {
    const m = rule.re.exec(text);
    if (m) return rule.make(m);
  }
  return undefined;
}

/**
 * The hero carousel's three titles per profile (C3). Each is matched against the data like the Recruiter cut:
 * a project card by slug, else an episode by title (and tag); `label` is the tab text.
 */
export const FEATURED: Record<NetflixProfileId, ReadonlyArray<{ label: string; episode?: { title: RegExp; tag?: string }; project?: string }>> = {
  recruiter: [
    { label: "Shift Roster", episode: { title: /shift roster/i, tag: "v2.0" } },
    { label: "11 automations", episode: { title: /11 python automations/i } },
    { label: "API Test Center", project: "api-test-center", episode: { title: /api test center/i } },
  ],
  developer: [
    { label: "API Test Center", project: "api-test-center", episode: { title: /api test center/i } },
    { label: "11 automations", episode: { title: /11 python automations/i } },
    { label: "Shift Roster", episode: { title: /shift roster/i, tag: "v2.0" } },
  ],
  story: [
    { label: "Shift Roster", episode: { title: /shift roster/i, tag: "v2.0" } },
    { label: "VMS query", episode: { title: /vms query/i } },
    { label: "This terminal", episode: { title: /build this terminal/i } },
  ],
};

/** `5–10 min to 2–3 min` for a before/after figure, `200+ active users` for the rest. */
export const metricLine = (m: Metric): string => (m.value.includes(" → ") ? m.value.split(" → ").map((v) => `${v} ${m.label}`).join(" to ") : `${m.value} ${m.label}`);

/**
 * The quiet label under a title (E1): the figure with its context in plain words. A before/after figure leads with its
 * context (`query time 5–10 min to 2–3 min`); a count follows it (`200+ active users · internal tool`).
 */
export const metricLabel = (m: Metric): string => (m.value.includes(" → ") ? [m.context, metricLine(m)].filter(Boolean).join(" ") : [metricLine(m), m.context].filter(Boolean).join(" · "));

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
      metric: metricOf(c.subject, c.body?.join(" "), c.tag),
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
    metric: metricOf(p.title, p.summary),
    media: PROJECT_MEDIA[p.slug],
    ...storyOf(p.slug),
  }));
  const postCards: ProjectCard[] = data.posts.map((p) => ({ id: `post-${p.slug}`, title: p.title, summary: p.excerpt, stack: [], year: p.date?.slice(0, 4), kind: "post", metric: metricOf(p.title, p.excerpt) }));

  const inStack = new Set(data.stack.map((s) => s.toLowerCase()));
  const skills: SkillCard[] = data.resume.skills.flatMap((g) => g.items.map((name) => ({ id: `skill-${name}`, name, group: g.group })));
  const stackFirst = [...skills].sort((a, b) => Number(inStack.has(b.name.toLowerCase())) - Number(inStack.has(a.name.toLowerCase())));

  const cast = buildCast(data, episodes, projectCards);
  const castRows: NetflixRow[] = cast.length ? [{ id: "cast", title: "Cast · the stack", kind: "cast", items: cast }] : [];
  const main = episodes.filter((e) => e.branch === "main").sort(newestFirst);
  const side = episodes.filter((e) => e.branch === "side").sort(newestFirst);

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
      { id: "certs", title: "Certifications", kind: "series", items: buildCertSeries(data.resume.certifications) },
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
  else {
    nav = rows.filter((r) => r.kind !== "contact").map((r) => ({ id: r.id, label: r.title }));
    // The Top 10 row is added by the view (it sits after Continue / Because): first for Recruiter, after Projects for Developer.
    nav.splice(profile === "recruiter" ? 0 : 1, 0, { id: "top10", label: "Top 10" });
  }

  return {
    title: data.resume.name,
    tagline: identity.phrase,
    hero: { kicker: `A SERIES · ${profileName} cut`, title: data.resume.name, blurb: data.resume.summary, facts },
    seasons: years,
    nav,
    rows,
    recruiterCut: profile === "recruiter" ? resolveCut(episodes, projectCards) : [],
    featured: resolveSteps(FEATURED[profile], episodes, projectCards),
  };
}

/* ---------- E3: certificates as a series ---------- */

/** A credential, shown as an episode. `issued` and `validThrough` only when the data states them; `verify` only when a link exists. */
export type CertEpisode = { id: string; issuer: string; name: string; issued?: string; validThrough?: string; verify?: string };
/** An issuer, shown as a season. */
export type CertSeason = { id: string; label: string; hue: string; episodes: CertEpisode[] };

/** The seasons' order, names and badge colours. The first rule that matches the résumé's issuer wins; the last catches the rest. Data. */
export const CERT_SEASONS: ReadonlyArray<{ id: string; match: RegExp; label: string; hue: string }> = [
  { id: "openai", match: /openai/i, label: "OpenAI PartnerU", hue: "#10a37f" },
  { id: "cisco", match: /cisco/i, label: "Cisco Networking Academy", hue: "#049fd9" },
  { id: "ibm", match: /(?:^|[^a-z])ibm(?:[^a-z]|$)/i, label: "IBM", hue: "#4f6dff" },
  { id: "other", match: /./, label: "Other", hue: "#b08a3a" },
];

const CERT_ISSUED = /\s*·\s*([A-Z][a-z]{2} \d{4})\s*$/;
const CERT_VALID = /valid through\s+([^;·]+?)\s*$/i;

/**
 * Group the résumé's certifications into seasons by issuer (E3). It takes the plain list, so it keeps working when the
 * list moves to records. Dates come only from the text (`· Jul 2022`, `valid through Jul–Aug 2027`); nothing is invented.
 */
export function buildCertSeries(certs: ReadonlyArray<{ issuer: string; line: string; items?: string[]; verify?: string }>): CertSeason[] {
  const seasons = new Map<string, CertSeason>();
  for (const c of certs) {
    const rule = CERT_SEASONS.find((r) => r.match.test(c.issuer)) ?? CERT_SEASONS[CERT_SEASONS.length - 1];
    const season = seasons.get(rule.id) ?? { id: rule.id, label: rule.label, hue: rule.hue, episodes: [] };
    seasons.set(rule.id, season);
    const issued = CERT_ISSUED.exec(c.line)?.[1];
    const validThrough = CERT_VALID.exec(c.line)?.[1];
    const names = c.items?.length ? c.items : [c.line.replace(CERT_ISSUED, "").trim()];
    for (const name of names) season.episodes.push({ id: `cert-${rule.id}-${season.episodes.length + 1}`, issuer: rule.label, name, issued, validThrough, verify: c.verify });
  }
  return CERT_SEASONS.flatMap((r) => seasons.get(r.id) ?? []);
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
  main: ["Hands-on", "In production", "Measured"],
  learn: ["Curious", "Steady", "Foundational"],
  side: ["Playful", "Experimental", "Hands-on"],
  life: ["Personal", "Formative", "Human"],
  project: ["Built", "Shipped", "Open"],
  post: ["Written", "Reflective", "Plain"],
  skill: ["Practiced", "Familiar", "Ongoing"],
};

export const NF_BRANCH_LABEL: Record<Episode["branch"], string> = { main: "work", learn: "learning", side: "side quest", life: "life" };

/** What the modal needs from an item, flattened. */
export type NfFacts = {
  id: string;
  title: string;
  metric?: Metric;
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
  /** Real imagery (E2), for projects that have it. */
  media?: ProjectMedia;
  /** The project's story (F2), for the trailer. */
  story?: ProjectStory;
  /** "episode" | "project" | "post" | "skill". */
  kind?: NfItem["kind"];
};

export function factsOf(item: NfItem): NfFacts {
  if (item.kind === "episode") {
    const e = item.e;
    return {
      id: item.id,
      metric: e.metric,
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
      kind: "episode",
    };
  }
  if (item.kind === "skill") {
    return { id: item.id, title: item.s.name, blurb: `${item.s.name}, in the ${item.s.group} group of the résumé's skills.`, tone: "skill", branchLabel: item.s.group, tags: [item.s.group], stack: [], letter: item.s.name.trim().charAt(0).toUpperCase(), kind: "skill" };
  }
  const c = item.c;
  return {
    id: item.id,
    metric: c.metric,
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
    media: c.media,
    story: { description: c.description, audience: c.audience, problem: c.problem, beats: c.beats, status: c.status },
    kind: item.kind,
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


/* ---------- C2: Top 10, ranked by scope ---------- */

/**
 * The ranking formula, all weights here. score = metric + recency + branch + kind:
 *  - metric: +100 when the item has a figure (`metricOf`), else 0 (it ranks lower, never hidden);
 *  - recency: 0..30, linear from `from` (college start) to the newest date among the ranked items;
 *  - branch: main 20, side 10, learn 6, life 0 (episodes); project 14, post 2 (cards);
 *  - ties break by date, newest first, then by id.
 * Skills have no date or figure and are not ranked.
 */
export const SCOPE = { metric: 100, recency: 30, from: "2020-08", branch: { main: 20, side: 10, learn: 6, life: 0, project: 14, post: 2 } as Record<string, number> };

const scopeDate = (it: NfItem) => (it.kind === "episode" ? it.e.date : it.kind === "skill" ? "" : it.c.year ? `${it.c.year}-06` : "");
const scopeMetric = (it: NfItem) => (it.kind === "episode" ? it.e.metric : it.kind === "skill" ? undefined : it.c.metric);

/** Ranked by scope, largest first. Items are the rankable ones only (no skills, no life episodes); never filters by metric. */
export function scopeRank(items: NfItem[]): NfItem[] {
  const pool = items.filter((it) => it.kind !== "skill" && !(it.kind === "episode" && it.e.branch === "life"));
  const dates = pool.map(scopeDate).filter(Boolean).map(monthIndex);
  const lo = monthIndex(SCOPE.from);
  const hi = Math.max(lo + 1, ...dates);
  const score = (it: NfItem) => {
    const d = scopeDate(it);
    const rec = d ? Math.max(0, Math.min(1, (monthIndex(d) - lo) / (hi - lo))) * SCOPE.recency : 0;
    const key = it.kind === "episode" ? it.e.branch : it.kind;
    return (scopeMetric(it) ? SCOPE.metric : 0) + rec + (SCOPE.branch[key] ?? 0);
  };
  const scored = new Map(pool.map((it) => [it.id, score(it)]));
  return [...pool].sort((a, b) => (scored.get(b.id) ?? 0) - (scored.get(a.id) ?? 0) || (scopeDate(a) < scopeDate(b) ? 1 : scopeDate(a) > scopeDate(b) ? -1 : a.id < b.id ? -1 : 1));
}

/** The ten cards of a profile's "Top 10" row: the rankable items in its rows, deduplicated. */
export function top10Of(show: NetflixShow): NfItem[] {
  const seen = new Set<string>();
  const pool = show.rows.flatMap(rowItems).filter((it) => !seen.has(it.id) && !!seen.add(it.id));
  return scopeRank(pool).slice(0, 10);
}

/** Does this profile get the row, and where: Recruiter first, Developer after Projects (an index into `rows`). */
export const TOP10_ROW_TITLE = "Top 10";

/** The episode that wears the "Top 10" badge: Shift Roster, v2.0. */
export function topEpisodeId(shows: NetflixShow[]): string | null {
  const top = new Set(scopeRank([...indexItems(shows).values()]).slice(0, 10).map((i) => i.id));
  for (const s of shows)
    for (const r of s.rows)
      if (r.kind === "episodes") {
        const hit = r.items.find((e) => e.tag === "v2.0" && /shift roster/i.test(e.title)) ?? r.items.find((e) => /shift roster/i.test(e.title));
        if (hit) return top.has(hit.id) ? hit.id : null;
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

type CutStep = { label?: string; episode?: { title: RegExp; tag?: string }; project?: string };

function resolveSteps<T extends CutStep>(steps: ReadonlyArray<T>, episodes: Episode[], projects: ProjectCard[]): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  for (const step of steps) {
    const card = step.project ? projects.find((p) => p.id === `project-${step.project}`) : undefined;
    const spec = step.episode;
    const ep = spec ? (episodes.find((e) => spec.title.test(e.title) && (!spec.tag || e.tag === spec.tag)) ?? episodes.find((e) => spec.title.test(e.title))) : undefined;
    const id = card?.id ?? ep?.id;
    if (id) out.push({ id, label: step.label ?? "" });
  }
  return out;
}

function resolveCut(episodes: Episode[], projects: ProjectCard[]): string[] {
  return resolveSteps(RECRUITER_CUT, episodes, projects).map((s) => s.id);
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

/* ---------- N10: end-of-season card ---------- */

export type EndCard = {
  complete: string;
  /** "Next season starts in 42 days" only when the data's `now.month` is later than this season's year; otherwise "This is the current season". */
  next: string;
  /** The first episode of the next season in the data, for "Watch next season". */
  nextFirst: NfItem | null;
};

/**
 * What the modal shows after a season's last episode. The countdown is the gap, in days, between this season's
 * last episode and the next season's first one in the data (a season that is over has a next one already).
 */
export function endCardOf(season: number, index: Map<string, NfItem>, nowMonth?: string): EndCard {
  const eps = [...index.values()].flatMap((o) => (o.kind === "episode" ? [o] : []));
  const mine = eps.filter((o) => o.e.season === season);
  const later = eps.filter((o) => o.e.season > season);
  const nextSeason = later.length ? Math.min(...later.map((o) => o.e.season)) : null;
  const nextEps = nextSeason == null ? [] : later.filter((o) => o.e.season === nextSeason).sort((a, b) => a.e.n - b.e.n);
  const nextFirst = nextEps[0] ?? null;
  const nowYear = nowMonth ? Number(nowMonth.slice(0, 4)) : NaN;
  let next = "This is the current season";
  if (nowYear > season) {
    const lastEnd = Math.max(...mine.map((o) => monthIndex(o.e.date)), 0);
    const nextStart = nextFirst ? monthIndex(nextFirst.e.date) : null;
    const days = nextStart == null ? null : Math.max(1, Math.round((nextStart - lastEnd) * 30.4));
    next = days == null ? "The next season is already running" : `Next season starts in ${days} ${days === 1 ? "day" : "days"}`;
  }
  return { complete: `Season ${season} complete`, next, nextFirst };
}

/* ---------- C4: the phone Hire sheet ---------- */

export type HireSheet = { email?: string; resume: string; brief: string; /** The one availability line (`hiring.availability`). */ availability: string };

/** When the contextual Hire bar appears (D5): after this many opened titles or this long on the page; a dismissal is remembered this many days. Data. */
export const HIRE_BAR = { afterOpens: 2, afterMs: 45_000, rememberDays: 7 } as const;

/** What the Hire sheet offers, from the existing contact and `hiring` data: the mail address, the résumé path and the `hire --brief` text. */
export function hireSheetOf(data: TerminalData): HireSheet {
  const h = data.hiring;
  const link = (kind: string) => data.contact.find((c) => c.label === kind && /^https:\/\//i.test(c.href))?.href;
  const email = data.contact.find((c) => c.label === "mail")?.href.replace(/^mailto:/i, "");
  const lines = [
    `$ hire --brief · ${data.resume.name}`,
    `Roles: ${h.roles.join(" / ")}`,
    `Level: ${h.level}`,
    `Stack: ${[...h.stack.core, ...h.stack.plus].join(", ")}`,
    `Where: ${[h.location.base, h.location.modes.join(" / "), ...(h.location.relocate ? ["open to relocate"] : [])].join(" · ")}`,
    `Availability: ${h.availability}`,
    "Proof:",
    ...h.proof.map((p) => `  - ${p}`),
    "Reach:",
    ...(email ? [`  mail      ${email}`] : []),
    ...(["linkedin", "github"] as const).flatMap((k) => (link(k) ? [`  ${k.padEnd(9)} ${link(k)}`] : [])),
    `  resume    ${h.links.site}${h.links.resume}`,
  ];
  return { email, resume: h.links.resume, brief: lines.join("\n"), availability: h.availability };
}

/* ---------- C5: Previously on... ---------- */

/** The line a modal types above the synopsis: the previous episode of the same season, with its figure. First episodes (and non-episodes) have none. */
export function previouslyLine(item: NfItem, index: Map<string, NfItem>): string | null {
  if (item.kind !== "episode" || item.e.n <= 1) return null;
  for (const o of index.values()) {
    if (o.kind === "episode" && o.e.season === item.e.season && o.e.n === item.e.n - 1) return [clip(o.e.title, 80), o.e.metric ? metricLabel(o.e.metric) : ""].filter(Boolean).join(" · ");
  }
  return null;
}
