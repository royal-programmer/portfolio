import { listEntries, type Entry } from "@/lib/content";
import type { WorldProvider } from "../pulse";
import { newestFirst, worldHref } from "../util";

/** trader: the newest public trade, else a stub. */
export const trader: WorldProvider = async () => {
  const href = worldHref("trader");
  const newest = newestFirst((await listEntries("trader")).filter((e): e is Extract<Entry, { type: "trade" }> => e.type === "trade"))[0];
  if (!newest) return { persona: "trader", line: "watching the open · notes resume soon", at: new Date().toISOString(), href, source: "stub" };
  return { persona: "trader", line: `last trade: ${newest.data.instrument} ${newest.data.direction}`, at: newest.occurredAt ?? newest.createdAt, href, source: "content" };
};
