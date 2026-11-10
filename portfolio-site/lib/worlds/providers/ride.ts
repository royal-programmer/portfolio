import { listEntries, type Entry } from "@/lib/content";
import type { WorldProvider } from "../pulse";
import { newestFirst, worldHref } from "../util";

/** ride: the newest public ride, else a stub. */
export const ride: WorldProvider = async () => {
  const href = worldHref("ride");
  const newest = newestFirst((await listEntries("ride")).filter((e): e is Extract<Entry, { type: "ride" }> => e.type === "ride"))[0];
  if (!newest) return { persona: "ride", line: "no rides logged yet", at: new Date().toISOString(), href, source: "stub" };
  return { persona: "ride", line: `last ride: ${newest.title}${newest.data.distanceKm ? ` · ${Math.round(newest.data.distanceKm)} km` : ""}`, at: newest.occurredAt ?? newest.createdAt, href, source: "content" };
};
