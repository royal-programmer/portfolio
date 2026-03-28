import { NextResponse } from "next/server";

type LeadPayload = {
  name?: string;
  email?: string;
  reason?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as LeadPayload;
    const name = (payload.name ?? "").trim();
    const email = (payload.email ?? "").trim();
    const reason = (payload.reason ?? "").trim();

    if (!name || !EMAIL_RE.test(email) || reason.length < 5) {
      return NextResponse.json(
        { ok: false, error: "Please provide valid name, email, and reason." },
        { status: 400 },
      );
    }

    // Phase 1: placeholder action. Next phase will persist to Supabase and/or send email.
    console.log("lead_captured", { name, email, reason });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request payload." },
      { status: 400 },
    );
  }
}
