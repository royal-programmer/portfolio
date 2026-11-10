import type { PersonaSlug } from "@/lib/content/types";
import { personaIdentity, DISPLAY_ROOT } from "@/lib/site/brand";

/** A world's public address on the configured root domain. */
export function worldHref(persona: PersonaSlug): string {
  return `https://${personaIdentity(persona).subdomain}.${DISPLAY_ROOT}/`;
}

/** Newest first by when the thing happened, else when it was added. */
export function newestFirst<T extends { occurredAt?: string; createdAt: string }>(items: T[]): T[] {
  const t = (e: T) => Date.parse(e.occurredAt ?? e.createdAt) || 0;
  return [...items].sort((a, b) => t(b) - t(a));
}
