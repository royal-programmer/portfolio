/**
 * Link-preview metadata (Open Graph and Twitter) that follows the terminal command a link opens:
 * `code.ratulroy.me/?run=timeline` previews the timeline, drawn by `/og`. Absolute URLs come from the
 * production root domain (or the dev mirror while developing), since crawlers do not resolve relative ones.
 */
import type { Metadata } from "next";
import { DEV_ROOT_DOMAIN } from "@/lib/site/hosts";
import { DISPLAY_ROOT } from "@/lib/site/brand";

/** The origin of a persona's host (`code`) or of the hub (null): https on the real domain, the dev mirror in development. */
export function siteOrigin(label: string | null): string {
  const dev = process.env.NODE_ENV === "development";
  const root = dev ? `${DEV_ROOT_DOMAIN}:${process.env.PORT || 3000}` : DISPLAY_ROOT;
  return `${dev ? "http" : "https"}://${label ? `${label}.` : ""}${root}`;
}

/** `/og?cmd=<cmd>` as an absolute URL (the route draws any command it knows, and `portfolio` for the rest). */
export const ogImageUrl = (origin: string, cmd: string) => `${origin}/og?cmd=${encodeURIComponent(cmd)}`;

/** The `?run=` value of a page request: one command line, in the same shape the terminal accepts, or null. */
export function runParam(v: string | string[] | undefined): string | null {
  const t = (Array.isArray(v) ? v[0] : v)?.trim();
  return t && /^[a-z][a-z0-9 ._~/-]{0,40}$/i.test(t) ? t : null;
}

/** Title, description, `openGraph` and `twitter` for a page whose preview is the terminal running `cmd`. */
export function shareMetadata(o: { title: string; description: string; cmd: string; origin: string; url?: string }): Metadata {
  const images = [{ url: ogImageUrl(o.origin, o.cmd), width: 1200, height: 630, alt: `${o.title}: the terminal output` }];
  return {
    title: o.title,
    description: o.description,
    openGraph: { type: "website", title: o.title, description: o.description, url: o.url ?? o.origin, images },
    twitter: { card: "summary_large_image", title: o.title, description: o.description, images: images.map((i) => i.url) },
  };
}
