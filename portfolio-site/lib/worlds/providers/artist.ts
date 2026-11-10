import { listEntries, type Entry } from "@/lib/content";
import type { WorldProvider } from "../pulse";
import { newestFirst, worldHref } from "../util";

/** artist: the newest public artwork, else a stub. */
export const artist: WorldProvider = async () => {
  const href = worldHref("artist");
  const newest = newestFirst((await listEntries("artist")).filter((e): e is Extract<Entry, { type: "artwork" }> => e.type === "artwork"))[0];
  if (!newest) return { persona: "artist", line: "the sketchbook is private for now", at: new Date().toISOString(), href, source: "stub" };
  return { persona: "artist", line: `latest piece: ${newest.title}`, at: newest.occurredAt ?? newest.createdAt, href, source: "content" };
};
