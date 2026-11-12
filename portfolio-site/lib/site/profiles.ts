/**
 * Every place Ratul is on the web (round 15). One list, read by the terminal's `profiles`, the hub's footer,
 * the Netflix "To be continued" card and the live route (`/api/profiles`). Data, so the admin console can own it later.
 * Public handles only. LinkedIn has no public API: its numbers are a dated, static `note`.
 * There is no Naukri row on purpose: its profiles open only for recruiters, so a public link would be a closed door.
 */
import type { ProfileLinkData } from "@/lib/content/types";
import { fromDb } from "@/lib/content/source";
import { LEGACY } from "@/lib/site/legacy-content";

export type ProfileGroup = ProfileLinkData["group"];
export type ProfileLive = NonNullable<ProfileLinkData["live"]>;

export type TermProfile = {
  id: string;
  label: string;
  handle: string;
  href?: string;
  group: ProfileGroup;
  /** A free public source the route can read for a one-line number. */
  live?: ProfileLive;
  /** A static, dated line (LinkedIn's counts). */
  note?: string;
  /** Shown only when the live route finds the account (LeetCode: the handle is probed). */
  optional?: boolean;
};

export const PROFILE_GROUPS: readonly ProfileGroup[] = ["code", "learn", "work", "social"];
export const isProfileGroup = (v: string): v is ProfileGroup => (PROFILE_GROUPS as readonly string[]).includes(v);

/** The active fallback: the frozen copy while `CONTENT_SOURCE=code`, empty under `db` (the `profile_link` records then carry them). */
export const PROFILES: TermProfile[] = fromDb ? [] : LEGACY.PROFILES;

/** The rows the visitor sees: an optional row only once the route has found its handle and link. */
export function visibleProfiles(list: TermProfile[], found: Record<string, { handle?: string; href?: string }> = {}): TermProfile[] {
  return list
    .map((p) => (p.optional ? { ...p, handle: found[p.id]?.handle ?? p.handle, href: found[p.id]?.href ?? p.href } : p))
    .filter((p) => !p.optional || (p.handle && p.href));
}
