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

const MAX_BODY = 8_192;

/** A short fingerprint for logs, so a failed save is traceable without writing the address itself. */
async function fingerprint(email: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(email.toLowerCase()));
  return Array.from(new Uint8Array(buf).slice(0, 4), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  try {
    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_BODY) return NextResponse.json({ ok: false, error: "Message too long." }, { status: 413 });
    const payload = (await req.json()) as LeadPayload;
    const name = (payload.name ?? "").trim().slice(0, 120);
    const email = (payload.email ?? "").trim().slice(0, 254);
    const message = (payload.message ?? payload.reason ?? "").trim().slice(0, 4000);
    const source = SOURCES.has(payload.source ?? "") ? (payload.source as string) : "site";
    const persona = (payload.persona ?? "").trim().slice(0, 40) || null;

    if (!name || !EMAIL_RE.test(email) || message.length < 5) {
      return NextResponse.json({ ok: false, error: "Please provide a valid name, email, and message." }, { status: 400 });
    }

    try {
      const { error } = await adminClient().from("leads").insert({ name, email, message, source, persona });
      if (error) throw error;
    } catch (e) {
      // The hourly cap (migration 0010) raises a check violation; everything else is a config blip.
      const msg = e instanceof Error ? e.message : String(e);
      const capped = /leads_hourly_cap/.test(msg);
      console.error("lead_not_stored", capped ? "hourly cap" : msg, { source, who: await fingerprint(email) });
      return NextResponse.json(
        { ok: false, error: capped ? "The inbox is busy right now. Please try again in an hour." : "Could not save your message. Please try again." },
        { status: capped ? 429 : 503 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
  }
}
