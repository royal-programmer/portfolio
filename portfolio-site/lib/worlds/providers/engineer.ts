import { setDefaultResultOrder } from "node:dns";
import { personaIdentity } from "@/lib/site/brand";
import type { WorldProvider } from "../pulse";
import { worldHref } from "../util";

// Some networks (and this dev machine) hand out IPv6 addresses that never answer; try IPv4 first.
try {
  setDefaultResultOrder("ipv4first");
} catch {}

const USER = personaIdentity("engineer").handle ?? "royal-programmer";

/** engineer: the last push, from the public events endpoint (cached for an hour). Null when GitHub does not answer. */
export const engineer: WorldProvider = async () => {
  try {
    const r = await fetch(`https://api.github.com/users/${USER}/events/public?per_page=30`, {
      headers: { "User-Agent": "portfolio-pulse", Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return null;
    const events = (await r.json()) as Array<{ type?: string; created_at?: string }>;
    if (!Array.isArray(events)) return null;
    const push = events.find((e) => e?.type === "PushEvent" && typeof e.created_at === "string" && Number.isFinite(Date.parse(e.created_at)));
    if (!push?.created_at) return null;
    return { persona: "engineer", line: "github · last push", at: push.created_at, href: worldHref("engineer"), source: "live" };
  } catch {
    return null;
  }
};
