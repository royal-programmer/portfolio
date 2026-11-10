import { listEntries, type Entry } from "@/lib/content";
import type { WorldProvider } from "../pulse";
import { newestFirst, worldHref } from "../util";

/** photographer: the newest public photo, else a stub. */
export const photographer: WorldProvider = async () => {
  const href = worldHref("photographer");
  const newest = newestFirst((await listEntries("photographer")).filter((e): e is Extract<Entry, { type: "photo" }> => e.type === "photo"))[0];
  if (!newest) return { persona: "photographer", line: "last frame: none yet · gallery in the making", at: new Date().toISOString(), href, source: "stub" };
  return { persona: "photographer", line: `last frame: ${newest.title}`, at: newest.occurredAt ?? newest.createdAt, href, source: "content" };
};
