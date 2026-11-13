/**
 * Visitor insights, as pure functions over `site_events` rows (17-persona-views.md section 29). The admin
 * Insights page and the Netflix "Popular with visitors" row both read through these, so the numbers are
 * counted, never estimated: an empty log gives zeros and `null` rates, and the page says "No data yet".
 */
import type { EventKind } from "./events";

export type InsightRow = {
  at: string;
  view: string;
  kind: EventKind | string;
  ref: string | null;
  profile: string | null;
  session: string | null;
  device: string | null;
  referrer_host: string | null;
};

export type Count = { key: string; n: number };

/** The steps after a title is opened that count as reaching out. */
export const ACTION_KINDS = ["hire_open", "mail_click", "book_click", "resume_download"] as const;

const DAY = 86_400_000;

/** Rows from the last `days` days (inclusive of now), by their own timestamp. */
export const withinDays = (rows: readonly InsightRow[], days: number, now = Date.now()): InsightRow[] => {
  const from = now - days * DAY;
  return rows.filter((r) => {
    const t = Date.parse(r.at);
    return Number.isFinite(t) && t >= from && t <= now + 60_000;
  });
};

/** Count rows by a key, most first (ties by key, so the order is stable). Rows with no key are skipped. */
export function countBy(rows: readonly InsightRow[], pick: (r: InsightRow) => string | null | undefined, only?: (r: InsightRow) => boolean): Count[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (only && !only(r)) continue;
    const k = pick(r);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].map(([key, n]) => ({ key, n })).sort((a, b) => b.n - a.n || a.key.localeCompare(b.key));
}

/** Played-to-the-end over started. `null` (not 0) when nothing started: there is no rate to show. */
export function completionRate(rows: readonly InsightRow[]): { starts: number; completes: number; rate: number | null } {
  const starts = rows.filter((r) => r.kind === "play_start").length;
  const completes = rows.filter((r) => r.kind === "play_complete").length;
  return { starts, completes, rate: starts ? Math.min(1, completes / starts) : null };
}

export type FunnelStep = { label: string; sessions: number };

/**
 * Sessions that opened a title, of those the ones that also played, of those the ones that then reached
 * out (Hire sheet, mail, book a call, résumé). Counted per session id, so rows with no session are left out.
 */
export function funnel(rows: readonly InsightRow[]): FunnelStep[] {
  const by = (match: (k: string) => boolean, within?: Set<string>) => {
    const s = new Set<string>();
    for (const r of rows) if (r.session && match(r.kind) && (!within || within.has(r.session))) s.add(r.session);
    return s;
  };
  const opened = by((k) => k === "title_open");
  const played = by((k) => k === "play_start", opened);
  const acted = by((k) => (ACTION_KINDS as readonly string[]).includes(k), played);
  return [
    { label: "Opened a title", sessions: opened.size },
    { label: "Played it", sessions: played.size },
    { label: "Then hire, mail, book or résumé", sessions: acted.size },
  ];
}

/** One bucket per day for the last `days` days, oldest first, zeros included (UTC days). */
export function perDay(rows: readonly InsightRow[], days: number, now = Date.now()): { day: string; n: number }[] {
  const end = Math.floor(now / DAY);
  const out: { day: string; n: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date((end - i) * DAY).toISOString().slice(0, 10);
    idx.set(day, out.length);
    out.push({ day, n: 0 });
  }
  for (const r of rows) {
    const t = Date.parse(r.at);
    if (!Number.isFinite(t)) continue;
    const i = idx.get(new Date(t).toISOString().slice(0, 10));
    if (i !== undefined) out[i].n += 1;
  }
  return out;
}

export type Insights = {
  total: number;
  visits: Count[];
  profilePicks: Count[];
  topTitles: Count[];
  completion: ReturnType<typeof completionRate>;
  funnel: FunnelStep[];
  skills: Count[];
  referrers: Count[];
  devices: Count[];
  commands: Count[];
  days: { day: string; n: number }[];
};

/** Everything the Insights page shows, for the last `days` days. */
export function summarize(all: readonly InsightRow[], days: number, now = Date.now()): Insights {
  const rows = withinDays(all, days, now);
  const kind = (k: string) => (r: InsightRow) => r.kind === k;
  return {
    total: rows.length,
    visits: countBy(rows, (r) => r.view, kind("view_open")),
    profilePicks: countBy(rows, (r) => r.ref, (r) => r.kind === "profile_pick" && r.view === "netflix"),
    topTitles: countBy(rows, (r) => r.ref, kind("title_open")).slice(0, 10),
    completion: completionRate(rows),
    funnel: funnel(rows),
    skills: countBy(rows, (r) => r.ref, kind("skill_open")).slice(0, 10),
    referrers: countBy(rows, (r) => r.referrer_host, kind("view_open")).slice(0, 10),
    devices: countBy(rows, (r) => r.device, kind("view_open")),
    commands: countBy(rows, (r) => r.ref, kind("terminal_cmd")).slice(0, 10),
    days: perDay(rows, days, now),
  };
}

/** A CSV cell: quoted when it holds a comma, quote or newline, and never a formula (a leading = + - @ is defused). */
export const csvCell = (v: unknown): string => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(rows: readonly InsightRow[]): string {
  const head = ["at", "view", "kind", "ref", "profile", "device", "referrer_host"];
  const lines = rows.map((r) => [r.at, r.view, r.kind, r.ref, r.profile, r.device, r.referrer_host].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\n") + "\n";
}

/* ----- "Popular with visitors" ----- */

export type PopularRule = {
  /** How far back the counts look. */
  windowDays: number;
  /** Below this many events in the window the row stays hidden: nothing is faked. */
  minEvents: number;
  /** What each kind is worth in the ranking. */
  weights: Partial<Record<string, number>>;
  /** How many titles the row shows. */
  max: number;
};

/** What the ranking is built from: counted events in the window and each title's weighted score. Small enough to cache. */
export type PopularTally = { events: number; scores: Record<string, number> };

/** Weighted score per title over the window. `events` counts every weighted event, known title or not. */
export function tallyPopular(all: readonly InsightRow[], rule: PopularRule, now = Date.now()): PopularTally {
  const scores: Record<string, number> = {};
  let events = 0;
  for (const r of withinDays(all, rule.windowDays, now)) {
    const w = rule.weights[r.kind] ?? 0;
    if (!r.ref || w <= 0) continue;
    events += 1;
    scores[r.ref] = (scores[r.ref] ?? 0) + w;
  }
  return { events, scores };
}

/** Ids ranked by score, only titles that exist; `null` below `minEvents` events (or when no title qualifies): the row stays hidden. */
export function pickPopular(tally: PopularTally, rule: PopularRule, known: ReadonlySet<string>): string[] | null {
  if (tally.events < rule.minEvents) return null;
  const ranked = Object.entries(tally.scores)
    .filter(([id]) => known.has(id))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, rule.max);
  return ranked.length ? ranked.map(([id]) => id) : null;
}

/** The two steps together, for tests and one-shot callers. */
export const rankPopular = (all: readonly InsightRow[], rule: PopularRule, known: ReadonlySet<string>, now = Date.now()) => pickPopular(tallyPopular(all, rule, now), rule, known);
