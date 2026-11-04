import { NextResponse } from "next/server";

/**
 * Jamendo search for the hub's music dock. The client id stays on the server
 * (JAMENDO_CLIENT_ID; free at devportal.jamendo.com — without it the dock says
 * search is not set up and links still work). Non-commercial use, each
 * track is linked back to its Jamendo page (API terms 4.1), responses are
 * cached only briefly (3.3).
 */
export const runtime = "nodejs";

type JamendoRow = { id: number | string; name: string; artist_name: string; audio: string; image?: string; shareurl: string; duration: number; license_ccurl?: string };

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 80) ?? "";
  if (!q) return NextResponse.json({ tracks: [] });
  // No id, no search (Jamendo's public test id is suspended, so there is no fallback).
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "not-configured", tracks: [] }, { status: 503 });
  const url = new URL("https://api.jamendo.com/v3.0/tracks/");
  url.search = new URLSearchParams({ client_id: clientId, format: "json", limit: "12", search: q, audioformat: "mp32", imagesize: "100", include: "licenses" }).toString();
  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return NextResponse.json({ error: "upstream", tracks: [] }, { status: 502 });
    const data = (await res.json()) as { headers?: { status?: string; code?: number; error_message?: string }; results?: JamendoRow[] };
    if (data.headers?.status === "failed") {
      // Code 11 is an invalid / suspended application: the id is the problem, not Jamendo.
      return NextResponse.json({ error: data.headers.code === 11 ? "not-configured" : "upstream", tracks: [] }, { status: data.headers.code === 11 ? 503 : 502 });
    }
    const tracks = (data.results ?? [])
      .filter((t) => t.audio)
      .map((t) => ({ id: String(t.id), name: t.name, artist: t.artist_name, audio: t.audio, image: t.image || undefined, shareurl: t.shareurl, duration: t.duration, license: t.license_ccurl }));
    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json({ error: "upstream", tracks: [] }, { status: 502 });
  }
}
