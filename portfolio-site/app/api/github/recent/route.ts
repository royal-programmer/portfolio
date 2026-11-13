import { NextResponse } from "next/server";
import { personaIdentity } from "@/lib/site/brand";
import { setDefaultResultOrder } from "node:dns";

/**
 * The "Trending now" row of the Netflix view (17-persona-views.md §22, D2): the latest pushed commits from the
 * engineer handle's public activity. Public data only, no token; cached for 30 minutes. Fails quietly: an empty
 * list (the row then does not render). Commit messages that look like a secret are skipped.
 */
try {
  setDefaultResultOrder("ipv4first");
} catch {}

export const runtime = "nodejs";
export const revalidate = 1800;

const USER = personaIdentity("engineer").handle ?? "royal-programmer";
const CACHE = "public, s-maxage=1800, stale-while-revalidate=3600";
const MAX = 10;

type RecentCommit = { id: string; message: string; repo: string; at: string; url: string };

/** A message that mentions a credential word, or carries a long hex / token-like string, is never shown. */
function looksSecret(message: string): boolean {
  return /\b(key|token|password|passwd|secret|credential)s?\b/i.test(message) || /\b[a-f0-9]{32,}\b/i.test(message) || /\b(ghp|gho|sk|pk|xox[a-z])[-_][A-Za-z0-9_-]{16,}/.test(message);
}

type Ev = { type?: string; created_at?: string; repo?: { name?: string }; payload?: { head?: string; commits?: Array<{ sha?: string; message?: string; distinct?: boolean }> } };

const HEADERS = { Accept: "application/vnd.github+json", "User-Agent": "portfolio-recent" };
const SHA = /^[a-f0-9]{40}$/;

/** The public events feed no longer lists a push's commits, so each push's head commit is read from the repo (public only). */
async function headCommit(repo: string, sha: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.github.com/repos/${repo}/commits/${sha}`, { headers: HEADERS, signal: AbortSignal.timeout(6_000), next: { revalidate: 1800 } });
    if (!r.ok) return null;
    const j = (await r.json()) as { commit?: { message?: string } };
    return (j.commit?.message ?? "").split("\n")[0].trim().slice(0, 120) || null;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const r = await fetch(`https://api.github.com/users/${encodeURIComponent(USER)}/events/public?per_page=30`, { headers: HEADERS, signal: AbortSignal.timeout(8_000), next: { revalidate: 1800 } });
    if (!r.ok) throw new Error(`events ${r.status}`);
    const events = (await r.json()) as Ev[];
    const pushes = (Array.isArray(events) ? events : []).filter((e) => e.type === "PushEvent" && e.created_at && e.repo?.name).slice(0, MAX);
    const found = await Promise.all(
      pushes.map(async (e): Promise<RecentCommit | null> => {
        const repoFull = e.repo?.name as string;
        const sha = e.payload?.head ?? e.payload?.commits?.at(-1)?.sha;
        if (!sha || !SHA.test(sha)) return null;
        const message = e.payload?.commits?.at(-1)?.message?.split("\n")[0].trim().slice(0, 120) || (await headCommit(repoFull, sha));
        if (!message || looksSecret(message)) return null;
        return { id: sha.slice(0, 12), message, repo: repoFull.split("/").pop() ?? repoFull, at: e.created_at as string, url: `https://github.com/${repoFull}/commit/${sha}` };
      }),
    );
    const out = found.filter((c): c is RecentCommit => !!c);
    return NextResponse.json({ commits: out, at: new Date().toISOString() }, { headers: { "Cache-Control": CACHE } });
  } catch {
    return NextResponse.json({ commits: [] }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  }
}
