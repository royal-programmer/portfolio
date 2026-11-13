import { NextResponse } from "next/server";
import { setDefaultResultOrder } from "node:dns";

/**
 * One line of live numbers for the terminal's `profiles`: GitHub, Stack Overflow, Holopin, HackerRank, LeetCode.
 * Public sources only, fetched in parallel with 4 s timeouts; any failure is just a missing `stat`.
 * Nothing per visitor is stored or logged. Cached for six hours (LeetCode's matched handle for 24 h in memory).
 */
try {
  setDefaultResultOrder("ipv4first");
} catch {}

export const runtime = "nodejs";
export const revalidate = 21600;

const CACHE = "public, s-maxage=21600, stale-while-revalidate=86400";
const UA = "portfolio-profiles";
const GH = "royal-programmer";
const SO = 22394141;
const HOLOPIN = "royalprogrammer";
const HACKERRANK = "royal_programmer";
const LEETCODE_PROBES = ["royal-programmer", "royalprogrammer", "royal_programmer"];
const T = 4000;

type Row = { id: string; stat?: string; handle?: string; href?: string };

const get = (url: string, init?: RequestInit) => fetch(url, { ...init, headers: { "User-Agent": UA, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(T) });
const kilo = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n));

async function github(): Promise<Row> {
  const [u, c] = await Promise.allSettled([
    get(`https://api.github.com/users/${GH}`, { headers: { Accept: "application/vnd.github+json" } }).then((r) => (r.ok ? (r.json() as Promise<{ public_repos?: number }>) : Promise.reject(new Error("gh")))),
    // The public contributions HTML carries the year's total in its heading.
    get(`https://github.com/users/${GH}/contributions`).then((r) => (r.ok ? r.text() : Promise.reject(new Error("gh")))),
  ]);
  const parts: string[] = [];
  if (u.status === "fulfilled" && typeof u.value?.public_repos === "number") parts.push(`${u.value.public_repos} repos`);
  if (c.status === "fulfilled") {
    const m = /([\d,]+)\s+contributions?\s+in\s+(?:the\s+last\s+year|\d{4})/i.exec(c.value);
    if (m) parts.push(`${m[1].replace(/,/g, "")} contributions`);
  }
  return { id: "github", stat: parts.length ? parts.join(" · ") : undefined };
}

/** Stats below these stay hidden: a thin number on a portfolio reads worse than none. */
const MIN_SO_REP = 50;
const MIN_LC_SOLVED = 25;

async function stackoverflow(): Promise<Row> {
  const r = await get(`https://api.stackexchange.com/2.3/users/${SO}?site=stackoverflow`);
  if (!r.ok) throw new Error("so");
  const j = (await r.json()) as { items?: Array<{ reputation?: number }> };
  const rep = j.items?.[0]?.reputation;
  if (typeof rep !== "number") throw new Error("shape");
  const a = await get(`https://api.stackexchange.com/2.3/users/${SO}/answers?site=stackoverflow&pagesize=1&filter=total`)
    .then((x) => (x.ok ? (x.json() as Promise<{ total?: number }>) : null))
    .catch(() => null);
  // A number that undersells stays out: the profile row still links, the stat appears once it is worth reading.
  if (rep < MIN_SO_REP) return { id: "stackoverflow", stat: undefined };
  return { id: "stackoverflow", stat: `${kilo(rep)} rep${typeof a?.total === "number" && a.total > 0 ? ` · ${a.total} answers` : ""}` };
}

async function holopin(): Promise<Row> {
  const r = await get(`https://www.holopin.io/@${HOLOPIN}`);
  if (!r.ok) throw new Error("holopin");
  const html = await r.text();
  const m = /(\d+)\s+Badges?\b/i.exec(html) ?? /"totalBadges"\s*:\s*(\d+)/i.exec(html) ?? /"badgeCount"\s*:\s*(\d+)/i.exec(html);
  if (!m) throw new Error("unparseable");
  return { id: "holopin", stat: `${m[1]} badges` };
}

async function hackerrank(): Promise<Row> {
  const r = await get(`https://www.hackerrank.com/rest/contests/master/hackers/${HACKERRANK}/profile`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("hr");
  const j = (await r.json()) as { model?: { username?: string; level?: number | string } };
  if (!j.model?.username) throw new Error("shape");
  const lv = j.model.level;
  return { id: "hackerrank", stat: lv !== undefined && lv !== null && lv !== "" ? `level ${lv}` : undefined };
}

let lcCache: { t: number; row: Row } | null = null;
async function leetcode(): Promise<Row> {
  if (lcCache && Date.now() - lcCache.t < 86_400_000) return lcCache.row;
  const query = "query($u:String!){ matchedUser(username:$u){ username submitStats { acSubmissionNum { difficulty count } } } }";
  for (const u of LEETCODE_PROBES) {
    try {
      const r = await get("https://leetcode.com/graphql", { method: "POST", headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" }, body: JSON.stringify({ query, variables: { u } }) });
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: { matchedUser?: { username?: string; submitStats?: { acSubmissionNum?: Array<{ difficulty?: string; count?: number }> } } | null } };
      const m = j.data?.matchedUser;
      if (!m?.username) continue;
      const all = m.submitStats?.acSubmissionNum?.find((x) => x.difficulty === "All")?.count;
      const row: Row = { id: "leetcode", handle: m.username, href: `https://leetcode.com/u/${m.username}/`, stat: typeof all === "number" && all >= MIN_LC_SOLVED ? `${all} solved` : undefined };
      lcCache = { t: Date.now(), row };
      return row;
    } catch {}
  }
  throw new Error("no handle");
}

export async function GET() {
  const done = await Promise.allSettled([github(), stackoverflow(), holopin(), hackerrank(), leetcode()]);
  const profiles = done.flatMap((d) => (d.status === "fulfilled" ? [d.value] : []));
  return NextResponse.json({ profiles, fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": CACHE } });
}
