/**
 * Every place Ratul is on the web (round 15). One list, read by the terminal's `profiles`, the hub's footer,
 * the Netflix "To be continued" card and the live route (`/api/profiles`). Data, so the admin console can own it later.
 * Public handles only. LinkedIn has no public API: its numbers are a dated, static `note`.
 * There is no Naukri row on purpose: its profiles open only for recruiters, so a public link would be a closed door.
 */
export type ProfileGroup = "code" | "learn" | "work" | "social";
export type ProfileLive = "github" | "stackoverflow" | "leetcode" | "holopin" | "hackerrank";

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

export const PROFILES: TermProfile[] = [
  { id: "github", label: "github", handle: "royal-programmer", href: "https://github.com/royal-programmer", group: "code", live: "github" },
  { id: "stackoverflow", label: "stack overflow", handle: "royal-programmer", href: "https://stackoverflow.com/users/22394141/royal-programmer", group: "code", live: "stackoverflow" },
  { id: "holopin", label: "holopin", handle: "royalprogrammer", href: "https://www.holopin.io/@royalprogrammer", group: "code", live: "holopin" },
  { id: "leetcode", label: "leetcode", handle: "", group: "code", live: "leetcode", optional: true },
  { id: "hackerrank", label: "hackerrank", handle: "royal_programmer", href: "https://www.hackerrank.com/profile/royal_programmer", group: "learn", live: "hackerrank" },
  { id: "geeksforgeeks", label: "geeksforgeeks", handle: "royal_programmer", href: "https://www.geeksforgeeks.org/profile/royal_programmer", group: "learn" },
  { id: "gdev", label: "google developer", handle: "royalprogrammer", href: "https://g.dev/royalprogrammer", group: "learn" },
  { id: "skills", label: "google skills", handle: "public profile", href: "https://www.skills.google/public_profiles/369b718d-7bea-4e4b-9741-63c8d2250b64", group: "learn" },
  { id: "linkedin", label: "linkedin", handle: "royal-programmer", href: "https://www.linkedin.com/in/royal-programmer", group: "work", note: "927 followers · 500+ connections · as of 2026-11" },
];

/** The rows the visitor sees: an optional row only once the route has found its handle and link. */
export function visibleProfiles(list: TermProfile[], found: Record<string, { handle?: string; href?: string }> = {}): TermProfile[] {
  return list
    .map((p) => (p.optional ? { ...p, handle: found[p.id]?.handle ?? p.handle, href: found[p.id]?.href ?? p.href } : p))
    .filter((p) => !p.optional || (p.handle && p.href));
}
