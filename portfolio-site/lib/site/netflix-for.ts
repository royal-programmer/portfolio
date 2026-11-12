/**
 * `?for=<name>` (17-persona-views.md §22, D1): a link made for a person. The name is plain text only: at most 40
 * characters, letters, digits, spaces and `.-&'`; everything else is dropped. It is never stored server-side and is
 * only ever rendered as text.
 */
export const FOR_MAX = 40;

/** Live typing: drop the bad characters but keep the spaces being typed. */
export const typeFor = (raw: string) => raw.replace(/[^\p{L}\p{N} .\-&']/gu, "").slice(0, FOR_MAX);

export function cleanFor(raw: string | null | undefined): string {
  if (!raw) return "";
  // Letters and digits in any script (the name may be Bengali or Hindi), plus space and .-&'
  return raw.replace(/[^\p{L}\p{N} .\-&']/gu, "").replace(/\s+/g, " ").trim().slice(0, FOR_MAX).trim();
}

/** The link for a person: the persona host's `/netflix` in a profile, with the cleaned name. */
export function forLink(origin: string, profile: string, name: string): string {
  const n = cleanFor(name);
  return `${origin}/netflix?profile=${encodeURIComponent(profile)}${n ? `&for=${encodeURIComponent(n)}` : ""}`;
}
