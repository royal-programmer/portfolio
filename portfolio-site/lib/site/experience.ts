/**
 * Experience modes (decision D26): Auto / Immersive / Lite.
 *
 * - `immersive`: full motion, WebGL scenes, glow filters.
 * - `lite`: same content and layout, static visuals, no WebGL — for slow
 *   devices, slow/metered connections, and reduced-motion users.
 * - `auto` (default): pick one from the device/network signals below.
 *
 * The resolved mode is written to `<html data-experience="…">` by an inline
 * boot script BEFORE first paint (no flash), so CSS and components can branch
 * on it. The preference is a cookie scoped to the root domain when possible,
 * so `code.` / `trade.` / the hub all share one choice.
 */

export type ExperiencePref = "auto" | "immersive" | "lite";
export type Experience = "immersive" | "lite";

export const EXPERIENCE_COOKIE = "xp";
export const EXPERIENCE_PREFS: readonly ExperiencePref[] = ["auto", "immersive", "lite"];

export type AutoReason =
  | "reduced-motion"
  | "data-saver"
  | "slow-network"
  | "low-memory"
  | "few-cores"
  | "capable";

/**
 * Self-contained detector. Stringified into the boot script, so it must not
 * reference anything outside its own body.
 */
function detect(): { experience: "immersive" | "lite"; reason: string } {
  type Nav = Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
    deviceMemory?: number;
  };
  const nav = navigator as Nav;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return { experience: "lite", reason: "reduced-motion" };
  }
  if (nav.connection?.saveData) return { experience: "lite", reason: "data-saver" };
  if (/(^|-)(2g|3g)$/.test(nav.connection?.effectiveType ?? "")) {
    return { experience: "lite", reason: "slow-network" };
  }
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) {
    return { experience: "lite", reason: "low-memory" };
  }
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency < 4) {
    return { experience: "lite", reason: "few-cores" };
  }
  return { experience: "immersive", reason: "capable" };
}

export function detectExperience(): { experience: Experience; reason: AutoReason } {
  return detect() as { experience: Experience; reason: AutoReason };
}

export function isExperiencePref(v: unknown): v is ExperiencePref {
  return typeof v === "string" && (EXPERIENCE_PREFS as readonly string[]).includes(v);
}

export function readPrefCookie(): ExperiencePref {
  const m = document.cookie.match(new RegExp(`(?:^|; )${EXPERIENCE_COOKIE}=([^;]*)`));
  return m && isExperiencePref(m[1]) ? m[1] : "auto";
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

export function writePrefCookie(pref: ExperiencePref, roots: string[]) {
  const domain = sharedCookieDomain(window.location.hostname, roots);
  const parts = [
    `${EXPERIENCE_COOKIE}=${pref}`,
    "path=/",
    `max-age=${60 * 60 * 24 * 365}`,
    "samesite=lax",
  ];
  if (domain) parts.push(`domain=${domain}`);
  document.cookie = parts.join("; ");
}

/** Resolve a preference to the mode actually used, and stamp it on <html>. */
export function applyExperience(pref: ExperiencePref): { experience: Experience; reason: AutoReason | "chosen" } {
  const resolved =
    pref === "auto" ? detectExperience() : { experience: pref, reason: "chosen" as const };
  const root = document.documentElement;
  root.dataset.experience = resolved.experience;
  root.dataset.experiencePref = pref;
  return resolved;
}

/**
 * Inline script for the root layout: runs before paint, no imports.
 * Plain JS mirror of `detect()` above — keep the two in sync.
 */
export const EXPERIENCE_BOOT_SCRIPT = `(function(){var r=document.documentElement;try{
var m=document.cookie.match(/(?:^|; )${EXPERIENCE_COOKIE}=([^;]*)/);
var p=m&&/^(auto|immersive|lite)$/.test(m[1])?m[1]:"auto";
var n=navigator,c=n.connection||{},x="immersive";
if(matchMedia("(prefers-reduced-motion: reduce)").matches||c.saveData||/(^|-)(2g|3g)$/.test(c.effectiveType||"")||(n.deviceMemory!==undefined&&n.deviceMemory<4)||(n.hardwareConcurrency!==undefined&&n.hardwareConcurrency<4))x="lite";
r.dataset.experiencePref=p;r.dataset.experience=p==="auto"?x:p;
}catch(e){r.dataset.experience="lite";}})();`;
