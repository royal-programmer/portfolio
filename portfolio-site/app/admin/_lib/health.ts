/**
 * The site health checklist, computed from real data and nothing else: each item says what it checked, how many
 * things fail, and where to fix them. Never fakes a pass: an input that could not be read is "unknown" (amber),
 * not green. Pure.
 */
export type HealthInput = {
  bookCallHref: string | null;
  certs: { slug: string; title: string; verify?: string }[];
  projects: { slug: string; title: string; summary?: string; hasPoster: boolean; liveUrl?: string; repoUrl?: string }[];
  /** The hiring facts, as stored (`null` when it could not be read). */
  hiring: Record<string, unknown> | null;
  /** `YYYY-MM` of the submitted résumé PDF, and the most recent data change (ISO). */
  resumeBuilt: string | null;
  latestChange: string | null;
  /** `true` resolves, `false` does not, `null` was not checked. */
  ogOk: boolean | null;
  /** Records whose data fails its schema or has an empty required field. */
  invalid: { label: string; href: string }[];
  /** Everything that carries an `updatedAt` (ISO) and a screen. */
  touched: { label: string; href: string; updatedAt: string }[];
  now: number;
};

export type HealthItem = { id: string; label: string; status: "ok" | "warn"; count: number; detail: string; href: string; examples: string[] };

const DAY = 86_400_000;
export const STALE_DAYS = 90;

/** True when a value is empty: blank text, an empty list, or an object holding only empty things. */
export function hasEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).some(hasEmpty);
  return false;
}

/** Hiring facts that are empty, by name (`alsoOn` is allowed to be empty, and so is a `false` flag). */
export function emptyHiringFields(h: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(h)) {
    if (k === "alsoOn") continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) if (typeof v2 !== "boolean" && hasEmpty(v2)) out.push(`${k}.${k2}`);
    } else if (hasEmpty(v)) out.push(k);
  }
  return out;
}

const item = (id: string, label: string, bad: string[], okText: string, href: string, unknown?: string): HealthItem => ({
  id,
  label,
  status: bad.length || unknown ? "warn" : "ok",
  count: bad.length,
  detail: unknown ?? (bad.length ? `${bad.length} to fix` : okText),
  href,
  examples: bad.slice(0, 3),
});

export function computeHealth(i: HealthInput): HealthItem[] {
  const items: HealthItem[] = [];
  items.push(item("booking", "Booking link is set", i.bookCallHref === null ? [] : i.bookCallHref.trim() ? [] : ["no link"], "set", "/admin/engineer/booking", i.bookCallHref === null ? "could not be read" : undefined));
  items.push(item("verify", "Every certificate has a verify link", i.certs.filter((c) => !c.verify?.trim()).map((c) => c.title), "all have one", "/admin/engineer/certifications"));
  const projectBad: string[] = [];
  for (const p of i.projects) {
    const miss = [!p.summary?.trim() && "summary", !p.hasPoster && "poster", !p.liveUrl?.trim() && !p.repoUrl?.trim() && "live or repo link"].filter(Boolean);
    if (miss.length) projectBad.push(`${p.title}: no ${miss.join(", ")}`);
  }
  items.push(item("projects", "Every project has a summary, a poster and a link", projectBad, "all complete", "/admin/engineer/projects"));
  if (i.hiring) {
    const e = emptyHiringFields(i.hiring);
    items.push(item("hiring", "Hiring facts are complete", e, "complete", "/admin/engineer/hiring"));
  } else items.push(item("hiring", "Hiring facts are complete", [], "", "/admin/engineer/hiring", "could not be read"));
  if (i.resumeBuilt && i.latestChange) {
    const built = Date.parse(`${i.resumeBuilt}-01T00:00:00Z`);
    const changed = Date.parse(i.latestChange);
    const behind = Number.isFinite(built) && Number.isFinite(changed) && changed - built > 31 * DAY;
    items.push(item("resume", "Résumé is newer than the data", behind ? [`résumé from ${i.resumeBuilt}, data changed ${i.latestChange.slice(0, 10)}`] : [], "up to date", "/admin/engineer/copy?key=engineer.resume"));
  } else items.push(item("resume", "Résumé is newer than the data", [], "", "/admin/engineer/copy?key=engineer.resume", "no résumé date or no change date to compare"));
  items.push(item("og", "Share image (OG) loads", i.ogOk === false ? ["the image did not load"] : [], "loads", "/admin/site/identity", i.ogOk === null ? "not checked" : undefined));
  items.push(item("empty", "No record has an empty required field", i.invalid.map((x) => x.label), "none empty", i.invalid[0]?.href ?? "/admin/engineer"));
  const stale = i.touched.filter((t) => i.now - Date.parse(t.updatedAt) > STALE_DAYS * DAY);
  items.push(item("stale", `Nothing untouched for ${STALE_DAYS} days`, stale.map((s) => s.label), "all recent", stale[0]?.href ?? "/admin/engineer"));
  return items;
}

/** The overall line: how many are green. */
export const healthSummary = (items: HealthItem[]) => `${items.filter((x) => x.status === "ok").length} of ${items.length} green`;
