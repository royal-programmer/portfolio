import "server-only";
import { adminClient, hasSupabaseEnv } from "@/lib/db/client";
import type { InsightRow } from "./insights";

/**
 * Reads `site_events` (migration 0013) through the service client. Server-only. Pages through PostgREST's
 * 1000-row limit, newest window first, and never throws: a missing table or a blip gives `rows: []` with a
 * `note` so the page can say so honestly.
 */
const COLS = "at, view, kind, ref, profile, session, device, referrer_host";
const PAGE = 1000;
const MAX_PAGES = 30;

export async function loadEvents(days: number, kinds?: readonly string[]): Promise<{ rows: InsightRow[]; note: string | null; capped: boolean }> {
  if (!hasSupabaseEnv()) return { rows: [], note: "Supabase is not configured here.", capped: false };
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows: InsightRow[] = [];
  try {
    const db = adminClient();
    for (let p = 0; p < MAX_PAGES; p++) {
      let q = db.from("site_events").select(COLS).gte("at", from).order("at", { ascending: false }).range(p * PAGE, p * PAGE + PAGE - 1);
      if (kinds) q = q.in("kind", [...kinds]);
      const { data, error } = await q;
      if (error) {
        const missing = error.code === "42P01" || error.code === "PGRST205" || /does not exist|could not find the table/i.test(error.message);
        return { rows, note: missing ? "Migration 0013 is not applied yet, so nothing is counted." : `Could not read events: ${error.message}`, capped: false };
      }
      rows.push(...((data ?? []) as InsightRow[]));
      if ((data?.length ?? 0) < PAGE) return { rows, note: null, capped: false };
    }
    return { rows, note: null, capped: true };
  } catch (e) {
    return { rows, note: e instanceof Error ? e.message : "Could not read events.", capped: false };
  }
}
