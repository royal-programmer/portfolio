/**
 * Host-based routing map (decision D31): every persona gets its own subdomain
 * on the root domain, e.g. `code.ratulroy.me` → the Engineer world.
 *
 * Pure module (no runtime deps) so it can be imported by `proxy.ts` and by UI
 * code that needs to build cross-persona links.
 *
 * The App Router still serves everything from `/[persona]/…` paths; `proxy.ts`
 * rewrites `code.<root>/x` → `/engineer/x` invisibly. On hosts that are not
 * under a configured root domain (e.g. `*.vercel.app` previews) nothing is
 * rewritten and the plain path URLs keep working.
 */
import type { PersonaSlug } from "@/lib/content/types";
import { adminHostLabel } from "@/lib/site/admin-host";

/** Subdomain label → persona. Short, human words; the page headline carries the persona name. */
export const PERSONA_BY_SUBDOMAIN: Readonly<Record<string, PersonaSlug>> = {
  code: "engineer",
  trade: "trader",
  lens: "photographer",
  play: "gamer",
  ride: "ride",
  art: "artist",
};

/** Persona → its subdomain label (inverse of the map above). */
export const SUBDOMAIN_BY_PERSONA: Readonly<Record<PersonaSlug, string>> = Object.fromEntries(
  Object.entries(PERSONA_BY_SUBDOMAIN).map(([label, persona]) => [persona, label]),
) as Record<PersonaSlug, string>;

/** Labels that are aliases of the hub (redirected to the bare root domain). */
export const HUB_ALIASES: readonly string[] = ["www", "who"];

/**
 * Dev mirror of the production root: `ratulroy.localhost:3000` is the hub and
 * `code.ratulroy.localhost:3000` the Engineer world (browsers resolve every
 * `*.localhost` name to loopback). Plain `localhost:3000` is deliberately NOT a
 * root: Next relativises redirects aimed at its own `localhost` origin, which
 * would loop on a subdomain. It stays unrouted, like `*.vercel.app`.
 */
export const DEV_ROOT_DOMAIN = "ratulroy.localhost";

/**
 * Root domains whose subdomains are routed. Production root comes from
 * `NEXT_PUBLIC_ROOT_DOMAIN` (e.g. `ratulroy.me`); the dev root is always on.
 */
export function rootDomains(): string[] {
  const configured = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase();
  return configured ? [configured, DEV_ROOT_DOMAIN] : [DEV_ROOT_DOMAIN];
}

export type ParsedHost =
  | { kind: "unrouted" }
  | { kind: "hub"; root: string }
  | { kind: "hub-alias"; root: string; label: string }
  | { kind: "admin"; root: string; label: string }
  | { kind: "persona"; root: string; label: string; persona: PersonaSlug }
  | { kind: "unknown"; root: string; label: string };

/** Classify a `Host` header (port is ignored). */
export function parseHost(hostHeader: string | null, roots: string[] = rootDomains(), adminLabel: string | null = adminHostLabel()): ParsedHost {
  const host = (hostHeader ?? "").toLowerCase().replace(/:\d+$/, "");
  for (const root of roots) {
    if (host === root) return { kind: "hub", root };
    if (!host.endsWith(`.${root}`)) continue;
    const label = host.slice(0, -(root.length + 1));
    if (label.includes(".")) return { kind: "unrouted" };
    if (HUB_ALIASES.includes(label)) return { kind: "hub-alias", root, label };
    if (adminLabel && label === adminLabel) return { kind: "admin", root, label };
    const persona = PERSONA_BY_SUBDOMAIN[label];
    if (persona) return { kind: "persona", root, label, persona };
    return { kind: "unknown", root, label };
  }
  return { kind: "unrouted" };
}
