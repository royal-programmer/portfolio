import "server-only";
import { unstable_cache } from "next/cache";
import { loadEvents } from "./events-server";
import { tallyPopular, type PopularRule, type PopularTally } from "./insights";

/** The Netflix "Popular with visitors" counts: the last window's title opens and completed plays, cached one hour. Never throws. */
export const getPopularTally = unstable_cache(
  async (rule: PopularRule): Promise<PopularTally> => {
    const { rows } = await loadEvents(rule.windowDays, Object.keys(rule.weights));
    return tallyPopular(rows, rule);
  },
  ["site-events-popular"],
  { revalidate: 3600, tags: ["site-events-popular"] },
);
