import { listEntries, type Entry } from "@/lib/content";
import type { WorldProvider } from "../pulse";
import { newestFirst, worldHref } from "../util";

/** gamer: the newest public game, else a stub. */
export const gamer: WorldProvider = async () => {
  const href = worldHref("gamer");
  const newest = newestFirst((await listEntries("gamer")).filter((e): e is Extract<Entry, { type: "game" }> => e.type === "game"))[0];
  if (!newest) return { persona: "gamer", line: "season in progress", at: new Date().toISOString(), href, source: "stub" };
  return { persona: "gamer", line: `${newest.data.status === "playing" ? "playing" : "last played"}: ${newest.title}`, at: newest.occurredAt ?? newest.createdAt, href, source: "content" };
};
