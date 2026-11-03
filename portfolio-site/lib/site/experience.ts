/**
 * Experience modes (D26, revised by D36): Immersive / Normal — no "Auto".
 *
 * - `immersive`: the 3D light journey (WebGL), sound optional.
 * - `normal`: same story and content without WebGL — still fully animated
 *   (scroll choreography, motion graphics). Not a "lite"/static mode.
 *
 * The visitor chooses at the entry gate (the hub's loader), where the device
 * is analysed and a suggestion is made — but nothing is decided silently.
 * Immersive also has a QUALITY level (game-style: Performance / Balanced /
 * Best), pre-set from the device analysis and adjustable.
 *
 * Choices are cookies scoped to the root domain, so `code.` / `trade.` / the
 * hub share them. An inline boot script stamps `<html data-experience>` before
 * first paint so CSS can branch without a flash.
 */

export type Experience = "immersive" | "normal";
export type Quality = "performance" | "balanced" | "best";

export const EXPERIENCE_COOKIE = "xp";
export const QUALITY_COOKIE = "xpq";
export const SOUND_COOKIE = "xps";
export const QUALITIES: readonly Quality[] = ["performance", "balanced", "best"];

export function isExperience(v: unknown): v is Experience {
  return v === "immersive" || v === "normal";
}
export function isQuality(v: unknown): v is Quality {
  return typeof v === "string" && (QUALITIES as readonly string[]).includes(v);
}

function readCookie(name: string): string | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? m[1] : null;
}

/** The saved mode, or null if the visitor has never chosen. Legacy "lite" → normal. */
export function readExperienceCookie(): Experience | null {
  const v = readCookie(EXPERIENCE_COOKIE);
  if (v === "lite") return "normal";
  return isExperience(v) ? v : null;
}
export function readQualityCookie(): Quality | null {
  const v = readCookie(QUALITY_COOKIE);
  return isQuality(v) ? v : null;
}
export function readSoundCookie(): boolean {
  return readCookie(SOUND_COOKIE) === "on";
}

/**
 * Cookie domain shared by every persona subdomain, e.g. `.ratulroy.me`.
 * Returns null on hosts outside the configured roots (host-only cookie).
 */
export function sharedCookieDomain(hostname: string, roots: string[]): string | null {
  for (const root of roots) {
    if (hostname === root || hostname.endsWith(`.${root}`)) return root;
  }
  return null;
}

export function writeCookie(name: string, value: string, roots: string[]) {
  const domain = sharedCookieDomain(window.location.hostname, roots);
  const parts = [`${name}=${value}`, "path=/", `max-age=${60 * 60 * 24 * 365}`, "samesite=lax"];
  if (domain) parts.push(`domain=${domain}`);
  document.cookie = parts.join("; ");
}

/** The mode to pre-select when the visitor hasn't chosen yet. */
export function defaultExperience(): Experience {
  // Motion-sensitive visitors get Normal pre-selected (they can still choose).
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "normal" : "immersive";
}

export function stampExperience(experience: Experience) {
  document.documentElement.dataset.experience = experience;
}

/** Inline script for the root layout: runs before paint, no imports. */
export const EXPERIENCE_BOOT_SCRIPT = `(function(){var r=document.documentElement;try{
var m=document.cookie.match(/(?:^|; )${EXPERIENCE_COOKIE}=([^;]*)/);var v=m?m[1]:"";
if(v==="lite")v="normal";
if(v!=="immersive"&&v!=="normal")v=matchMedia("(prefers-reduced-motion: reduce)").matches?"normal":"immersive";
r.dataset.experience=v;
}catch(e){r.dataset.experience="normal";}})();`;
