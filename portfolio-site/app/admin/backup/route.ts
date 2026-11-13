/**
 * "Backup now": one JSON file with every record (all engineer entries, hidden ones included) and every setting
 * (draft and live). Admin only; read through the signed-in session and the settings service client. The file holds
 * content only: no keys, no user data.
 */
import { NextResponse } from "next/server";
import { adminClient } from "@/lib/db/client";
import { getServerClient, isAdmin } from "@/lib/db/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return new NextResponse("Not authorized", { status: 401 });
  const out: Record<string, unknown> = { kind: "portfolio-backup", version: 1, at: new Date().toISOString() };
  try {
    const sb = await getServerClient();
    const { data, error } = await sb.from("entries").select("*").order("type").order("order", { ascending: true });
    out.entries = error ? { error: error.message } : data;
  } catch (e) {
    out.entries = { error: e instanceof Error ? e.message : "unreadable" };
  }
  try {
    const { data, error } = await adminClient().from("site_settings").select("key, draft, live, updated_at");
    out.settings = error ? { error: error.message } : data;
  } catch (e) {
    out.settings = { error: e instanceof Error ? e.message : "unreadable" };
  }
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(out, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="portfolio-backup-${day}.json"`, "cache-control": "no-store" } });
}
