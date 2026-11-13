"use server";

/**
 * Server-side drafts (migration 0014, `admin_drafts`): a half-edited form follows Ratul between his laptop
 * and his phone. Cookie-bound client, so RLS (`is_admin()`) is the real lock; every action also re-checks
 * the admin. Never throws at the UI: a missing table or an error just means "no server draft", and the
 * browser copy stays the offline fallback.
 */
import { headers } from "next/headers";
import { deviceLabel } from "@/lib/admin/drafts";
import { getServerClient, isAdmin } from "@/lib/db/server";
import { isMissingTable } from "@/lib/settings/read";

export type ServerDraft = { data: unknown; updatedAt: string; by: string | null };
export type DraftLoad = { ok: boolean; draft: ServerDraft | null; note?: string };

const KEY = /^[\w:-]{3,120}$/;
const MAX_BYTES = 200_000;

export async function loadServerDraft(key: string): Promise<DraftLoad> {
  if (!KEY.test(key) || !(await isAdmin())) return { ok: false, draft: null };
  try {
    const sb = await getServerClient();
    const { data, error } = await sb.from("admin_drafts").select("data, updated_at, by").eq("key", key).maybeSingle();
    if (error) return { ok: false, draft: null, note: isMissingTable(error) ? "Apply migration 0014 to keep drafts across devices." : error.message };
    return { ok: true, draft: data ? { data: data.data, updatedAt: String(data.updated_at), by: (data.by as string | null) ?? null } : null };
  } catch {
    return { ok: false, draft: null };
  }
}

export async function saveServerDraft(key: string, data: unknown): Promise<{ ok: boolean; updatedAt?: string }> {
  if (!KEY.test(key) || !(await isAdmin())) return { ok: false };
  try {
    if (JSON.stringify(data).length > MAX_BYTES) return { ok: false };
    const by = deviceLabel((await headers()).get("user-agent") ?? "");
    const updatedAt = new Date().toISOString();
    const sb = await getServerClient();
    const { error } = await sb.from("admin_drafts").upsert({ key, data, by, updated_at: updatedAt }, { onConflict: "key" });
    return error ? { ok: false } : { ok: true, updatedAt };
  } catch {
    return { ok: false };
  }
}

export async function discardServerDraft(key: string): Promise<{ ok: boolean }> {
  if (!KEY.test(key) || !(await isAdmin())) return { ok: false };
  try {
    const sb = await getServerClient();
    const { error } = await sb.from("admin_drafts").delete().eq("key", key);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
