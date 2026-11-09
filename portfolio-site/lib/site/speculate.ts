/**
 * Speculation Rules for the hub's Normal-mode doorways (Round 1m): on hover, press or focus of a
 * persona's button the destination is prerendered (prefetched where prerender is unsupported), so
 * the click lands on a page that is already built. One persona at a time; never on data-saver.
 * Persona hosts are same-site, cross-origin, so the destination answers with
 * `Supports-Loading-Mode: credentialed-prerender` (next.config.ts).
 */
import type { PersonaSlug } from "@/lib/content/types";
import { personaHref } from "./persona-link";

let current: { slug: string; el: HTMLScriptElement | HTMLLinkElement } | null = null;

export function speculate(slug: PersonaSlug): void {
  if (typeof document === "undefined") return;
  try {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (conn?.saveData || window.matchMedia("(prefers-reduced-data: reduce)").matches) return;
    if (current?.slug === slug && current.el.isConnected) return;
    current?.el.remove();
    current = null;
    const t = personaHref(window.location.origin, slug);
    const url = new URL(t.href, window.location.href);
    url.searchParams.set("via", "normal");
    const supports = (HTMLScriptElement as unknown as { supports?: (t: string) => boolean }).supports;
    if (supports?.("speculationrules")) {
      const el = document.createElement("script");
      el.type = "speculationrules";
      el.textContent = JSON.stringify({ prerender: [{ urls: [url.href], eagerness: "immediate" }] });
      document.head.appendChild(el);
      current = { slug, el };
    } else {
      // No Speculation Rules: a plain prefetch still warms the document.
      const el = document.createElement("link");
      el.rel = "prefetch";
      el.href = url.href;
      document.head.appendChild(el);
      current = { slug, el };
    }
  } catch {}
}
