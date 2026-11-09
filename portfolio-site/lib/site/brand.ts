/**
 * Brand-level presentation constants (design system v2, D31/D32).
 *
 * Persona *content* (label, eyebrow, body, points, order, publish state…)
 * lives in the content contract (`@/lib/content`). This file holds identity
 * bits that are not yet in the contract. `phrase` and `cta` are TEMPORARY
 * here: they move to the persona record (admin-editable) with the Stage 2
 * content work, so Ratul can change them without a deploy.
 */
import type { PersonaSlug } from "@/lib/content/types";
import { SUBDOMAIN_BY_PERSONA } from "./hosts";

/** Public root domain, for display. Falls back to the planned domain. */
export const DISPLAY_ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || "ratulroy.me";

export const HUB_COPY = {
  headline: "One mind. Many perspectives.",
  /** Prefix of the cycling line: "I'm Ratul Roy. I <phrase>." */
  intro: "I’m Ratul Roy. I",
  /** Between the hero and the first world. One line; nothing explained. */
  throughTitle: "Every perspective begins with the same sight.",
  moreTitle: "More colours on the way.",
  closingTitle: "Different perspectives. One person.",
  closingBody:
    "Each colour is a part of me with its own world. Together they’re the whole picture — and the picture keeps growing.",
  email: "ratul.arya.roy@gmail.com",
  /** Lines under the hero, one at a time: character, not the job (Ratul will rewrite them). */
  character: [
    "Curious by default. Disciplined when it counts. Always making something.",
    "Says it plainly. Notices the small things. Won’t call it done until it feels right.",
  ] as readonly string[],
} as const;

export type PersonaIdentity = {
  /** Plain role name, e.g. "Engineer". */
  role: string;
  /** The name this world goes by (its headline), when it has one. */
  handle?: string;
  /** Verb phrases for the cycling line ("I build systems that stay up"); the hub and the world's own page say the same ones. */
  phrases: readonly string[];
  /** The first phrase, for callers that want one. */
  phrase: string;
  /** World-specific call to action. */
  cta: string;
  /** Public host label, e.g. "code". */
  subdomain: string;
};

/** Personas whose pages carry the quiet "Hire me" pill. The Engineer's page is the terminal, which has `hire`; add a slug here to give another world one. */
export const HIRE_PERSONAS: readonly PersonaSlug[] = ["engineer"];

type IdentitySource = Omit<PersonaIdentity, "subdomain" | "phrase">;

const IDENTITY: Record<PersonaSlug, IdentitySource> = {
  engineer: { role: "Engineer", handle: "royal-programmer", phrases: ["build systems that stay up", "ship code that earns its keep", "automate the boring parts"], cta: "Step into the code" },
  trader: { role: "Trader", handle: "royal-trades", phrases: ["read markets, not rumours", "size the risk before the reward", "wait for the setup"], cta: "Open the trading desk" },
  photographer: { role: "Photographer", handle: "royal-frames", phrases: ["frame the moment before it passes", "chase light, not likes", "tell a story in one frame"], cta: "Look through my lens" },
  ride: { role: "Rider", phrases: ["chase horizons on two wheels", "take the long road home", "ride for the view"], cta: "Hit the road" },
  artist: { role: "Artist", phrases: ["paint what words miss", "draw to think", "turn blank pages into worlds"], cta: "Walk into the studio" },
  gamer: { role: "Gamer", handle: "lucifer", phrases: ["master the game, then the meta", "play to learn the system", "grind for mastery, not loot"], cta: "Press start" },
};

export function personaIdentity(slug: PersonaSlug): PersonaIdentity {
  const base = IDENTITY[slug];
  return { ...base, phrase: base.phrases[0], subdomain: SUBDOMAIN_BY_PERSONA[slug] };
}
