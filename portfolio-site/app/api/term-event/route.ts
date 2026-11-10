import { NextResponse } from "next/server";
import { adminClient } from "@/lib/db/client";

/**
 * Anonymous terminal usage (`term_events`, migration 0009). The terminal sends one beacon per
 * command with the first token only — never arguments. Nothing here identifies the visitor.
 */
type EventPayload = { command?: string; ok?: boolean; persona?: string; theme?: string; viewport?: string };

const TOKEN = /^[a-z0-9_:\-.]{1,40}$/i;
const PERSONAS = new Set(["engineer", "trader", "photographer", "artist", "ride", "gamer"]);
const THEMES = new Set(["accent", "amber", "green", "paper", "dracula", "nord", "gruvbox", "solarized", "monokai", "matrix", "cyberpunk"]);
const MAX_BODY = 512;

export async function POST(req: Request) {
  try {
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return new NextResponse(null, { status: 204 });
    const p = (await req.json()) as EventPayload;
    const command = (p.command ?? "").trim().toLowerCase();
    const persona = (p.persona ?? "").trim();
    if (!TOKEN.test(command) || !PERSONAS.has(persona)) return new NextResponse(null, { status: 204 });
    const theme = typeof p.theme === "string" && THEMES.has(p.theme) ? p.theme : null;
    const viewport = p.viewport === "phone" || p.viewport === "desktop" ? p.viewport : null;
    const ok = p.ok !== false;
    try {
      await adminClient().from("term_events").insert({ command, persona, ok, theme, viewport });
    } catch {
      // A beacon is fire-and-forget; a storage blip is not worth a log line per visitor.
    }
  } catch {}
  return new NextResponse(null, { status: 204 });
}
