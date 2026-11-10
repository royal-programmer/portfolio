/**
 * What each world is up to, in one line. The engineer terminal quietly points at the other five personas with
 * these (pane Live block, the `worlds` command). Each persona has one provider (`providers/<persona>.ts`,
 * `async () => WorldPulse | null`); today they read the content layer and fall back to an honest stub. Swapping
 * in a real source (the admin console round) is one file: keep the signature, change the body.
 */
import { LAUNCHED_PERSONAS, type PersonaSlug } from "@/lib/content/types";
import { artist } from "./providers/artist";
import { engineer } from "./providers/engineer";
import { gamer } from "./providers/gamer";
import { photographer } from "./providers/photographer";
import { ride } from "./providers/ride";
import { trader } from "./providers/trader";

export type WorldPulse = {
  persona: PersonaSlug;
  /** One short line, no relative time in it (the reader works that out from `at`). */
  line: string;
  detail?: string;
  /** ISO time the line is about; for a stub, when it was made. */
  at: string;
  /** That world's host, e.g. https://trade.ratulroy.me/ (the terminal re-derives it for the current origin). */
  href: string;
  /** stub: nothing real to say yet · content: from the content layer · live: from an outside source. */
  source: "stub" | "content" | "live";
};

export type WorldProvider = () => Promise<WorldPulse | null>;

const PROVIDERS: Record<PersonaSlug, WorldProvider> = { engineer, trader, photographer, artist, ride, gamer };

/** One provider's answer, or null when it throws: a failing world never takes the others down. */
async function safe(p: PersonaSlug): Promise<WorldPulse | null> {
  try {
    return await PROVIDERS[p]();
  } catch {
    return null;
  }
}

export async function getWorldPulses(): Promise<WorldPulse[]> {
  const all = await Promise.all(LAUNCHED_PERSONAS.map(safe));
  return all.filter((p): p is WorldPulse => p !== null);
}
