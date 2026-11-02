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
  moreTitle: "More colours on the way.",
  closingTitle: "Different perspectives. One person.",
  closingBody:
    "Each colour is a part of me with its own world. Together they’re the whole picture — and the picture keeps growing.",
  email: "ratul.arya.roy@gmail.com",
} as const;

export type PersonaIdentity = {
  /** Plain role name, e.g. "Engineer". */
  role: string;
  /** The name this world goes by (its headline), when it has one. */
  handle?: string;
  /** Verb phrase for the cycling line: "I build systems". */
  phrase: string;
  /** World-specific call to action. */
  cta: string;
  /** Public host label, e.g. "code". */
  subdomain: string;
};

const IDENTITY: Record<PersonaSlug, Omit<PersonaIdentity, "subdomain">> = {
  engineer: { role: "Engineer", handle: "royal-programmer", phrase: "build systems", cta: "Step into the code" },
  trader: { role: "Trader", handle: "royal-trades", phrase: "read markets", cta: "Open the trading desk" },
  photographer: { role: "Photographer", handle: "royal-frames", phrase: "frame stories", cta: "Look through my lens" },
  ride: { role: "Rider", phrase: "chase horizons", cta: "Hit the road" },
  artist: { role: "Artist", phrase: "paint dreams", cta: "Walk into the studio" },
  gamer: { role: "Gamer", handle: "lucifer", phrase: "master games", cta: "Press start" },
};

export function personaIdentity(slug: PersonaSlug): PersonaIdentity {
  return { ...IDENTITY[slug], subdomain: SUBDOMAIN_BY_PERSONA[slug] };
}
