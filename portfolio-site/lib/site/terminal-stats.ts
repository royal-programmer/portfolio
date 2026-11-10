/**
 * `stats`: the GitHub year as a heatmap. Pure helpers (types, validation, the week grid, the language
 * bar) so the terminal only draws; the data comes from /api/github/contributions.
 */
export type StatsDay = { date: string; count: number; level: 0 | 1 | 2 | 3 | 4 };
export type StatsData = {
  user: string;
  from: string;
  to: string;
  total: number;
  weeks: Array<{ days: StatsDay[] }>;
  streak: { current: number; longest: number };
  languages: Array<{ name: string; pct: number }>;
  fetchedAt: string;
};
export type StatsCache = { t: number; d: StatsData };

export const STATS_KEY = "xp-gh-stats";
export const STATS_TTL = 6 * 3_600_000;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A cache or a response is only used when it has the shape the drawing code reads. */
export function statsValid(d: unknown): d is StatsData {
  const s = d as StatsData | null;
  return (
    !!s &&
    typeof s === "object" &&
    typeof s.total === "number" &&
    !!s.streak &&
    typeof s.streak.current === "number" &&
    typeof s.streak.longest === "number" &&
    Array.isArray(s.languages) &&
    s.languages.every((l) => l && typeof l.name === "string" && typeof l.pct === "number") &&
    Array.isArray(s.weeks) &&
    s.weeks.length > 0 &&
    s.weeks.every((w) => w && Array.isArray(w.days) && w.days.every((x) => x && DATE.test(x.date) && typeof x.count === "number" && x.level >= 0 && x.level <= 4))
  );
}

export type HeatCell = StatsDay | null;
export type HeatMonth = { col: number; label: string };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The last `keep` weeks as Sunday-first columns of seven cells (null: before the first day or after the last), with month labels. */
export function heatGrid(d: StatsData, keep: number): { weeks: HeatCell[][]; months: HeatMonth[] } {
  const weeks = d.weeks.slice(-keep).map((w) => {
    const col: HeatCell[] = Array<HeatCell>(7).fill(null);
    for (const day of w.days) col[new Date(`${day.date}T00:00:00Z`).getUTCDay()] = day;
    return col;
  });
  const months: HeatMonth[] = [];
  let prev = -1;
  weeks.forEach((w, col) => {
    const first = w.find(Boolean);
    if (!first) return;
    const m = Number(first.date.slice(5, 7)) - 1;
    if (m === prev) return;
    prev = m;
    // Three columns is the width of "Jan"; a label that would run into the last one is dropped.
    if (months.length && col - months[months.length - 1].col < 3) return;
    months.push({ col, label: MONTHS[m] });
  });
  return { weeks, months };
}

/** `3 contributions · 2026-04-12`. */
export const cellTitle = (c: StatsDay) => `${c.count === 0 ? "no contributions" : `${c.count} contribution${c.count === 1 ? "" : "s"}`} · ${c.date}`;

/** Block counts per language for a bar `width` characters wide: at least one block each, summing to the width. */
export function langBlocks(langs: StatsData["languages"], width: number): number[] {
  const total = langs.reduce((a, l) => a + l.pct, 0) || 1;
  const n = langs.map((l) => Math.max(1, Math.round((l.pct / total) * width)));
  let diff = width - n.reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0 && i < 1000; i++) {
    const k = i % n.length;
    if (diff > 0) {
      n[k]++;
      diff--;
    } else if (n[k] > 1) {
      n[k]--;
      diff++;
    }
  }
  return n;
}
