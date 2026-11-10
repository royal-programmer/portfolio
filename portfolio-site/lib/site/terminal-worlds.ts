/**
 * The other five worlds as the terminal shows them (pane Live lines, the `worlds` card). Pure: the data comes
 * from `/api/worlds/pulse` (`lib/worlds/pulse.ts`), the words from `terminal-strings.ts`.
 */
import { LAUNCHED_PERSONAS, type PersonaSlug } from "@/lib/content/types";
import { personaIdentity } from "@/lib/site/brand";
import { placeOnSpectrum } from "@/lib/site/spectrum";
import type { TerminalStrings } from "@/lib/site/terminal-strings";
import type { WorldPulse } from "@/lib/worlds/pulse";

export const WORLDS_KEY = "xp-worlds-pulse";
export const WORLDS_TTL = 30 * 60_000;
export type WorldsCache = { t: number; pulses: WorldPulse[] };

/** The worlds that are not this one. */
export const OTHER_WORLDS: readonly PersonaSlug[] = LAUNCHED_PERSONAS.filter((p) => p !== "engineer");

const COLORS = new Map(placeOnSpectrum([...LAUNCHED_PERSONAS]).map((p) => [p.slug, p.color]));
export const worldColor = (p: PersonaSlug) => COLORS.get(p) ?? "currentColor";
export const worldName = (p: PersonaSlug) => personaIdentity(p).role.toLowerCase();

/** A response or a cache is only used if every pulse has the shape the output code reads. */
export function pulsesValid(x: unknown): x is WorldPulse[] {
  return (
    Array.isArray(x) &&
    x.every(
      (p) =>
        p &&
        typeof p === "object" &&
        (LAUNCHED_PERSONAS as readonly string[]).includes(p.persona) &&
        typeof p.line === "string" &&
        typeof p.at === "string" &&
        (p.source === "stub" || p.source === "content" || p.source === "live"),
    )
  );
}

/** Only the other worlds, in the brand's order. */
export const otherPulses = (all: WorldPulse[]): WorldPulse[] => OTHER_WORLDS.map((p) => all.find((x) => x.persona === p)).filter((x): x is WorldPulse => !!x);

/** The words for one pulse: a stub says `soon` (nothing pretends to be live), the rest say how long ago. */
export function pulseText(S: TerminalStrings, p: WorldPulse, agoText: (ms: number) => string, now = Date.now()): string {
  return p.source === "stub" ? `${p.line} · ${S["worlds.soon"]}` : `${p.line} · ${agoText(now - Date.parse(p.at))}`;
}
