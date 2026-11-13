import { isAdmin } from "@/lib/db/server";
import { loadEvents } from "@/lib/site/events-server";
import { toCsv } from "@/lib/site/insights";

/** The raw event rows for the last 7 / 30 / 90 days as CSV (admin only; no session ids, nothing personal). */
export async function GET(req: Request) {
  if (!(await isAdmin())) return new Response("Not found", { status: 404 });
  const d = Number(new URL(req.url).searchParams.get("days"));
  const days = d === 7 || d === 90 ? d : 30;
  const { rows } = await loadEvents(days);
  return new Response(toCsv(rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="site-events-${days}d.csv"`, "cache-control": "no-store" },
  });
}
