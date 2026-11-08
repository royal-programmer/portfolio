import { NextResponse } from "next/server";
import { adminClient } from "@/lib/db/client";

/**
 * Contact requests (`leads`, migration 0008). Called by the home page's connect flow and the
 * Engineer terminal's `mail` command. Server-only write through the service role; the browser
 * never sees the table.
 */
type LeadPayload = {
  name?: string;
  email?: string;
  /** The home page sends `reason`; the terminal sends `message`. Same field. */
  reason?: string;
  message?: string;
  source?: string;
  persona?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCES = new Set(["site", "terminal"]);

// A small per-instance guard against a stuck Enter key or a script: 5 requests per IP per hour.
const recent = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > 5;
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as LeadPayload;
    const name = (payload.name ?? "").trim().slice(0, 120);
    const email = (payload.email ?? "").trim().slice(0, 254);
    const message = (payload.message ?? payload.reason ?? "").trim().slice(0, 4000);
    const source = SOURCES.has(payload.source ?? "") ? (payload.source as string) : "site";
    const persona = (payload.persona ?? "").trim().slice(0, 40) || null;

    if (!name || !EMAIL_RE.test(email) || message.length < 5) {
      return NextResponse.json({ ok: false, error: "Please provide a valid name, email, and message." }, { status: 400 });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (tooMany(ip)) {
      return NextResponse.json({ ok: false, error: "Too many requests. Try again later." }, { status: 429 });
    }

    try {
      const { error } = await adminClient().from("leads").insert({ name, email, message, source, persona });
      if (error) throw error;
    } catch (e) {
      // Never lose a lead to a config blip: it still lands in the server log.
      console.error("lead_not_stored", e instanceof Error ? e.message : e, { name, email, source });
      return NextResponse.json({ ok: false, error: "Could not save your message. Please try again." }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
  }
}
