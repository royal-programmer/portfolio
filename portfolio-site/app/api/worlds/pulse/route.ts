import { NextResponse } from "next/server";
import { getWorldPulses } from "@/lib/worlds/pulse";

/** What each world is up to, one line each. Public content only, nothing per visitor, nothing secret. */
export const runtime = "nodejs";
export const revalidate = 1800;

export async function GET() {
  const pulses = await getWorldPulses();
  return NextResponse.json({ pulses, fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400" } });
}
