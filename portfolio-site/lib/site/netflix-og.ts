/**
 * The watch-party card (17-persona-views.md §7, N6): what `/og?cmd=netflix:<id>` draws for one episode, project,
 * post or skill, and the link the modal's Share button copies. Pure, no React; the route does the drawing.
 */
import { buildNetflix, factsOf, indexItems, NETFLIX_PROFILES, type NetflixProfileId } from "@/lib/site/netflix-data";
import { cleanFor } from "@/lib/site/netflix-for";
import type { TerminalData } from "@/lib/site/terminal-data";

export type NetflixCard = {
  title: string;
  /** One line (the synopsis, or the project summary), already clipped. */
  line: string;
  /** The big numeral: `S2024 E3` for an episode, the year or the kind for the rest. */
  numeral: string;
  /** The billboard colour: the branch tone, or null for the page accent. */
  tone: string | null;
  /** `Picked for <name>` (D1): drawn above the numeral when the link was made for a person. */
  pickedFor?: string;
};

/** The tone behind each branch, as in the modal's stylesheet (main and the rest use the page accent). */
export const NF_TONE_COLOR: Record<string, string> = { learn: "#2ab7b0", side: "#8b6cf0", life: "#8a8a96" };

/** An id as carried in `?title=` and `cmd=netflix:`: letters, digits and dashes only. */
export const NF_ID_RE = /^[a-z0-9][a-z0-9._-]{0,80}$/i;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export function netflixCard(data: TerminalData, id: string, forName?: string): NetflixCard | null {
  if (!NF_ID_RE.test(id)) return null;
  const who = cleanFor(forName) || undefined;
  // `home`: the series itself, for links that open the Netflix view without a title.
  if (id.toLowerCase() === "home") return { title: data.resume.name, line: clip(data.resume.summary, 100), numeral: "A series", tone: null, pickedFor: who };
  const shows = NETFLIX_PROFILES.map((p) => buildNetflix(p.id, data, [], []));
  const item = indexItems(shows).get(id);
  if (!item) return null;
  const f = factsOf(item);
  const numeral = f.season != null ? `S${f.season} E${f.n ?? 1}` : (f.year ?? (item.kind === "skill" ? "Skill" : item.kind === "post" ? "Post" : "Project"));
  return { title: f.title, line: clip(f.blurb ?? f.branchLabel, 100), numeral, tone: NF_TONE_COLOR[f.tone] ?? null, pickedFor: who };
}

/** The shareable link for one card: the persona host's `/netflix`, in the profile that shows it. */
export function netflixShareLink(origin: string, profile: NetflixProfileId, id: string): string {
  return `${origin}/netflix?profile=${encodeURIComponent(profile)}&title=${encodeURIComponent(id)}`;
}
