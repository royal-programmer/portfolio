/**
 * Two small pure helpers behind the conversion polish (17-persona-views.md section 29): the Hire sheet's one-sentence
 * first line, and which titles "Skim in 30 seconds" opens. Kept dependency-free so scripts/insights-check.mjs can test them.
 */
import type { TermHiring } from "./terminal-data";

/** One sentence from `engineer.hiring`: role, level, where, and availability. Empty fields are left out, never invented. */
export function hireLine(h: Pick<TermHiring, "roles" | "level" | "location" | "availability">): string {
  const role = h.roles.join(" / ");
  const place = [h.location.base, h.location.modes.join(" / ")].filter(Boolean).join(", ");
  const head = [role, h.level].filter(Boolean).join(", ");
  const parts = [head, place ? `based in ${place}` : "", h.availability].filter(Boolean);
  return parts.length ? `${parts.join("; ")}.` : "";
}

/** The titles "Skim in 30 seconds" opens: the `netflix.skim` ids that exist, else the profile's featured trio. */
export function skimIds(skim: readonly string[] | undefined, featured: ReadonlyArray<{ id: string }>, known: ReadonlySet<string>): string[] {
  const own = (skim ?? []).filter((id) => known.has(id));
  return (own.length ? own : featured.map((f) => f.id).filter((id) => known.has(id))).slice(0, 3);
}
