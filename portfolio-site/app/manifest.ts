import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getPersona } from "@/lib/content";
import { parseHost } from "@/lib/site/hosts";

/** The hub's void: the manifest's background, and the theme colour where a host has no accent of its own. */
const VOID = "#05060a";

/**
 * The web app manifest, per host: the engineer host installs as "Ratul Roy · code" and takes the
 * persona's accent for the title bar; every other host is the plain hub. `start_url` carries
 * `?via=pwa` so the terminal knows it was opened from the home screen (no hub hand-off).
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const parsed = parseHost((await headers()).get("host"));
  const engineer = parsed.kind === "persona" && parsed.persona === "engineer";
  const accent = engineer ? ((await getPersona("engineer").catch(() => null))?.accent ?? "#3b82f6") : VOID;
  return {
    id: engineer ? "/?app=code" : "/?app=hub",
    name: engineer ? "Ratul Roy · code" : "Ratul Roy",
    short_name: "ratulroy",
    description: engineer
      ? "Ratul Roy's engineer portfolio as a terminal. Works offline once opened."
      : "Ratul Roy: engineer, trader, photographer, and more wavelengths on the way.",
    start_url: "/?via=pwa",
    scope: "/",
    display: "standalone",
    background_color: VOID,
    theme_color: accent,
    lang: "en",
    categories: ["portfolio"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
