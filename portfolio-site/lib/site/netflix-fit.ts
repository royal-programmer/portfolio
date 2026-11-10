/**
 * Real ratings for the Netflix view (17-persona-views.md §7, N7): a pasted job description is read by the
 * terminal's own `fit` engine (terminal-fit.ts), then every card is rated by how much of what the description
 * asks for it shows. Pure; the description itself is never stored.
 */
import { factsOf, type NfItem } from "@/lib/site/netflix-data";
import { jdWanted, textFit, type FitPool } from "@/lib/site/terminal-fit";

/** A search box paste at least this long is a job description, not a search. */
export const JD_MIN = 200;

export type NfFit = {
  /** Skills in the description that the résumé really lists. */
  matched: number;
  /** Skills the description asked for that the matcher recognised. */
  total: number;
  /** Card id → percent, only for cards that show at least one wanted skill. */
  byId: Map<string, number>;
};

const textOf = (item: NfItem): string => {
  const f = factsOf(item);
  return [f.title, f.blurb, ...f.tags, ...f.stack].filter(Boolean).join(" \n ");
};

export function netflixFit(jd: string, pool: FitPool, items: NfItem[]): NfFit {
  const wanted = jdWanted(jd, pool);
  const byId = new Map<string, number>();
  if (wanted.total) {
    for (const it of items) {
      const pct = textFit(wanted, textOf(it));
      if (pct != null) byId.set(it.id, pct);
    }
  }
  return { matched: wanted.matched, total: wanted.total, byId };
}

/** Highest rating first; cards without one keep their order after the rated ones. */
export function sortByFit(items: NfItem[], byId: ReadonlyMap<string, number>): NfItem[] {
  return items
    .map((it, i) => ({ it, i, p: byId.get(it.id) ?? -1 }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map((x) => x.it);
}
