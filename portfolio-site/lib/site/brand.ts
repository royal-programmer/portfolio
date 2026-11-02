/**
 * Brand-level presentation constants (design system v2, D31).
 *
 * Persona *content* (label, eyebrow, body, publish state…) lives in the
 * content contract (`@/lib/content`). This file only holds identity bits that
 * are part of the site's design, not editable content: the handle each world
 * is known by and its spectrum colour token.
 */
import type { PersonaSlug } from "@/lib/content/types";
import { SUBDOMAIN_BY_PERSONA } from "./hosts";

/** Public root domain, for display. Falls back to the planned domain. */
export const DISPLAY_ROOT = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || "ratulroy.me";

export type PersonaIdentity = {
  /** Plain role name, e.g. "Engineer". */
  role: string;
  /** The name this world goes by, when it has one (headline on its page). */
  handle?: string;
  /** CSS colour token for this wavelength. */
  wl: string;
  /** Public host label, e.g. "code". */
  subdomain: string;
};

const ROLES: Record<PersonaSlug, { role: string; handle?: string }> = {
  engineer: { role: "Engineer", handle: "royal-programmer" },
  trader: { role: "Trader", handle: "royal-trades" },
  photographer: { role: "Photographer" },
  artist: { role: "Artist" },
  ride: { role: "Rider" },
  gamer: { role: "Gamer", handle: "lucifer" },
};

/**
 * Spectrum order — the order rays leave the prism, top → bottom, matching a
 * real dispersion (red bends least, violet most): rose → amber → green →
 * cyan → blue → violet.
 */
export const SPECTRUM_ORDER: readonly PersonaSlug[] = [
  "photographer",
  "artist",
  "trader",
  "ride",
  "engineer",
  "gamer",
];

export function personaIdentity(slug: PersonaSlug): PersonaIdentity {
  return {
    ...ROLES[slug],
    wl: `var(--wl-${slug})`,
    subdomain: SUBDOMAIN_BY_PERSONA[slug],
  };
}
