/**
 * A case study as data (17-persona-views.md §22, D3): which titles offer a one-page PDF, and the slug in its file name.
 * The PDF itself is drawn by `app/api/netflix/case/[id]/route.tsx` with the résumé's `@react-pdf/renderer` setup.
 */
import { buildNetflix, factsOf, indexItems, NETFLIX_PROFILES, type NfFacts } from "@/lib/site/netflix-data";
import { NF_ID_RE } from "@/lib/site/netflix-og";
import type { TerminalData } from "@/lib/site/terminal-data";

/** Rule (data): a project or episode with a metric, or a synopsis longer than this many characters. */
export const CASE_MIN_SYNOPSIS = 80;

export function caseEligible(f: NfFacts, kind: string): boolean {
  if (kind !== "episode" && kind !== "project") return false;
  return !!f.metric || (f.blurb?.length ?? 0) > CASE_MIN_SYNOPSIS;
}

export const caseSlug = (title: string) =>
  title
    .split(/[:→(]/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "case";

export function caseOf(data: TerminalData, id: string): { facts: NfFacts; kind: string } | null {
  if (!NF_ID_RE.test(id)) return null;
  const shows = NETFLIX_PROFILES.map((p) => buildNetflix(p.id, data, [], []));
  const item = indexItems(shows).get(id);
  if (!item) return null;
  const facts = factsOf(item);
  return caseEligible(facts, item.kind) ? { facts, kind: item.kind } : null;
}
