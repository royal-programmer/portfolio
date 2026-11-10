import { NextResponse } from "next/server";
import { personaIdentity } from "@/lib/site/brand";
import { setDefaultResultOrder } from "node:dns";

/**
 * The GitHub year for the terminal's `stats` command: a contribution calendar, streaks and languages
 * for the engineer handle. Two sources, same response shape:
 *   1. `GITHUB_TOKEN` (server env only) -> the GraphQL API;
 *   2. no token -> the public contributions HTML and the REST repo list.
 * The route is cached for six hours; the token never leaves this file and is never logged.
 */
// Some networks (and this dev machine) hand out IPv6 addresses that never answer; try IPv4 first.
try {
  setDefaultResultOrder("ipv4first");
} catch {}

export const runtime = "nodejs";
export const revalidate = 21600;

const USER = personaIdentity("engineer").handle ?? "royal-programmer";
const CACHE = "public, s-maxage=21600, stale-while-revalidate=86400";
const MIN_DAYS = 300;
const UA = "portfolio-stats";

type Level = 0 | 1 | 2 | 3 | 4;
type Day = { date: string; count: number; level: Level };
type Lang = { name: string; pct: number };
type Source = { days: Day[]; langs: Lang[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LEVELS: Record<string, Level> = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

const utcMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Language shares, largest first: the top six, in whole percent. */
function shares(sizes: Map<string, number>): Lang[] {
  const total = [...sizes.values()].reduce((a, b) => a + b, 0);
  if (!total) return [];
  return [...sizes.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, v]) => ({ name, pct: Math.round((v / total) * 100) }))
    .filter((l) => l.pct > 0);
}

/** Source 1: the GraphQL API. Throws on anything unexpected, so the caller can fall back to the HTML. */
async function fromGraphql(token: string): Promise<Source> {
  const query = `query($login:String!){ user(login:$login){
    contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount contributionLevel } } } }
    repositories(first:100, ownerAffiliations:OWNER, isFork:false){ nodes { languages(first:5, orderBy:{field:SIZE, direction:DESC}){ edges { size node { name } } } } }
  } }`;
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({ query, variables: { login: USER } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`graphql ${r.status}`);
  const j = (await r.json()) as {
    data?: {
      user?: {
        contributionsCollection?: { contributionCalendar?: { weeks?: Array<{ contributionDays?: Array<{ date?: string; contributionCount?: number; contributionLevel?: string }> }> } };
        repositories?: { nodes?: Array<{ languages?: { edges?: Array<{ size?: number; node?: { name?: string } }> } } | null> };
      };
    };
  };
  const u = j.data?.user;
  const weeks = u?.contributionsCollection?.contributionCalendar?.weeks;
  if (!u || !Array.isArray(weeks)) throw new Error("graphql shape");
  const days: Day[] = [];
  for (const w of weeks)
    for (const d of w.contributionDays ?? [])
      if (typeof d.date === "string" && DATE.test(d.date)) days.push({ date: d.date, count: Math.max(0, Number(d.contributionCount) || 0), level: LEVELS[d.contributionLevel ?? ""] ?? 0 });
  const sizes = new Map<string, number>();
  for (const repo of u.repositories?.nodes ?? [])
    for (const e of repo?.languages?.edges ?? []) if (e.node?.name) sizes.set(e.node.name, (sizes.get(e.node.name) ?? 0) + (Number(e.size) || 0));
  return { days, langs: shares(sizes) };
}

/** Source 2: the public contributions HTML (each cell's data-date/data-level and its tooltip's count). */
async function fromHtml(): Promise<Source> {
  const r = await fetch(`https://github.com/users/${USER}/contributions`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error(`html ${r.status}`);
  const html = await r.text();
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="(contribution-day-component-[\w-]+)"[^>]*>\s*([^<]*)/g)) {
    const t = m[2].trim();
    const n = /^No contributions/i.test(t) ? 0 : Number(/^([\d,]+)\s+contributions?\b/i.exec(t)?.[1].replace(/,/g, ""));
    if (Number.isFinite(n)) counts.set(m[1], n);
  }
  const days: Day[] = [];
  for (const m of html.matchAll(/<td\b[^>]*>/g)) {
    const tag = m[0];
    const date = /\bdata-date="(\d{4}-\d{2}-\d{2})"/.exec(tag)?.[1];
    const lv = Number(/\bdata-level="(\d)"/.exec(tag)?.[1]);
    const id = /\bid="(contribution-day-component-[\w-]+)"/.exec(tag)?.[1];
    if (!date || !(lv >= 0 && lv <= 4)) continue;
    days.push({ date, count: (id ? counts.get(id) : undefined) ?? (lv ? 1 : 0), level: lv as Level });
  }
  // Languages: the repo count per primary language (the HTML has no sizes).
  const sizes = new Map<string, number>();
  try {
    const rr = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100`, { headers: { "User-Agent": UA, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(10_000) });
    if (rr.ok) {
      const repos = (await rr.json()) as Array<{ language?: string | null; fork?: boolean }>;
      if (Array.isArray(repos)) for (const p of repos) if (p && !p.fork && typeof p.language === "string") sizes.set(p.language, (sizes.get(p.language) ?? 0) + 1);
    }
  } catch {}
  return { days, langs: shares(sizes) };
}

/** Longest run of days with a contribution, and the run that ends today (or yesterday, if today is still empty). */
function streaks(days: Day[]) {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--;
  let current = 0;
  for (; i >= 0 && days[i].count > 0; i--) current++;
  return { current, longest };
}

export async function GET() {
  const token = process.env.GITHUB_TOKEN?.trim();
  let src: Source | null = null;
  if (token) {
    try {
      src = await fromGraphql(token);
    } catch {}
  }
  if (!src || src.days.length < MIN_DAYS) {
    try {
      src = await fromHtml();
    } catch {
      return NextResponse.json({ error: "upstream" }, { status: 502 });
    }
  }
  const byDate = new Map<string, Day>();
  for (const d of src.days) byDate.set(d.date, d);
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < MIN_DAYS) return NextResponse.json({ error: "shape" }, { status: 502 });

  // Sunday-first weeks, as the calendar draws them.
  const weeks: Array<{ days: Day[] }> = [];
  let key = -1;
  for (const d of days) {
    const ms = utcMs(d.date);
    const sunday = ms - new Date(ms).getUTCDay() * 86_400_000;
    if (sunday !== key) {
      weeks.push({ days: [] });
      key = sunday;
    }
    weeks[weeks.length - 1].days.push(d);
  }

  return NextResponse.json(
    {
      user: USER,
      from: days[0].date,
      to: days[days.length - 1].date,
      total: days.reduce((a, d) => a + d.count, 0),
      weeks,
      streak: streaks(days),
      languages: src.langs,
      fetchedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": CACHE } },
  );
}
