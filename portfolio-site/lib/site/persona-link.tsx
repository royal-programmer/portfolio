"use client";

/**
 * Host-aware links into persona worlds (D31).
 *
 * On `code.ratulroy.me` a link to Engineer's "/roster" must be `/roster`
 * (client-side nav; proxy.ts rewrites it to /engineer/roster), while a link to
 * the Trader world must be a full navigation to `trade.ratulroy.me`. On hosts
 * without subdomain routing (vercel.app, plain localhost) it stays the classic
 * `/engineer/roster` path.
 *
 * Server render + hydration use the path form; the client then swaps in the
 * host-aware form (useSyncExternalStore keeps hydration mismatch-free).
 */
import Link from "next/link";
import { useSyncExternalStore, type ComponentProps } from "react";
import type { PersonaSlug } from "@/lib/content/types";
import { parseHost, SUBDOMAIN_BY_PERSONA } from "./hosts";

const noopSubscribe = () => () => {};

/** Current origin on the client; `null` during SSR/hydration. */
export function useOrigin(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => null,
  );
}

/** Pure: resolve a persona-relative path for the given origin. */
export function personaHref(
  origin: string | null,
  persona: PersonaSlug,
  path = "/",
): { href: string; crossOrigin: boolean } {
  const clean = path === "/" ? "" : path;
  const pathStyle = { href: `/${persona}${clean}`, crossOrigin: false };
  if (!origin) return pathStyle;

  const url = new URL(origin);
  const parsed = parseHost(url.host);
  if (parsed.kind === "unrouted") return pathStyle;
  if (parsed.kind === "persona" && parsed.persona === persona) {
    return { href: clean || "/", crossOrigin: false };
  }
  const port = url.port ? `:${url.port}` : "";
  return {
    href: `${url.protocol}//${SUBDOMAIN_BY_PERSONA[persona]}.${parsed.root}${port}${clean || "/"}`,
    crossOrigin: true,
  };
}

export function usePersonaHref(persona: PersonaSlug, path = "/") {
  return personaHref(useOrigin(), persona, path);
}

/** Pure: the hub ("who am I") URL for the given origin. */
export function hubHref(origin: string | null): { href: string; crossOrigin: boolean } {
  if (!origin) return { href: "/", crossOrigin: false };
  const url = new URL(origin);
  const parsed = parseHost(url.host);
  if (parsed.kind === "unrouted" || parsed.kind === "hub") return { href: "/", crossOrigin: false };
  const port = url.port ? `:${url.port}` : "";
  return { href: `${url.protocol}//${parsed.root}${port}/`, crossOrigin: true };
}

type PersonaLinkProps =Omit<ComponentProps<typeof Link>, "href"> & {
  persona: PersonaSlug;
  /** Path inside the persona world, e.g. "/roster" or "/blog/my-post". */
  path?: string;
};

export function PersonaLink({ persona, path = "/", ...rest }: PersonaLinkProps) {
  return <HostAwareLink {...usePersonaHref(persona, path)} {...rest} />;
}

/** Link to the hub (bare root domain) from any host. */
export function HubLink(props: Omit<ComponentProps<typeof Link>, "href">) {
  return <HostAwareLink {...hubHref(useOrigin())} {...props} />;
}

function HostAwareLink({
  href,
  crossOrigin,
  ...rest
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string; crossOrigin: boolean }) {
  if (crossOrigin) {
    // Different host → full navigation (Next's client router can't cross origins).
    // Drop next/link-only props so they never reach the DOM.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { prefetch, replace, scroll, shallow, ...anchorProps } = rest;
    return <a href={href} {...(anchorProps as ComponentProps<"a">)} />;
  }
  return <Link href={href} {...rest} />;
}
