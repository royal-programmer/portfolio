import { NextResponse } from "next/server";
import { adminClient, hasSupabaseEnv } from "@/lib/db/client";
import { MAX_BODY_BYTES, makeLimiter, validateBatch } from "@/lib/site/events";
import { getSetting } from "@/lib/settings/read";

/**
 * Privacy-first visitor events (`site_events`, migration 0013). The client batches a few events per
 * beacon. Nothing identifies the visitor: the IP is used for an in-memory rate limit only and is never
 * stored, DNT / Sec-GPC are honoured, and every path ends in a quiet 204 (a beacon never errors).
 */
const allow = makeLimiter(30, 60_000);
const done = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
  try {
    if (req.headers.get("dnt") === "1" || req.headers.get("sec-gpc") === "1") return done();
    if (!hasSupabaseEnv()) return done();
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return done();
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    if (!allow(ip)) return done();
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return done();
    const rows = validateBatch(JSON.parse(text));
    if (!rows.length) return done();
    const sw = (await getSetting("site.switches")).value.analytics;
    if (sw.events === false) return done();
    try {
      await adminClient().from("site_events").insert(rows);
    } catch {
      // Fire-and-forget: a storage blip is not worth a log line per visitor.
    }
  } catch {}
  return done();
}
