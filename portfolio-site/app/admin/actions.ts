"use server";

/**
 * Server Actions for the admin console's settings. Each one re-verifies the admin (Server Actions are
 * reachable by direct POST, not only the UI), validates against the key's Zod schema, writes through the
 * service client (the table has no policies for anyone else) and records a `settings_history` row.
 * Errors come back as `{ ok: false, message }` for the form to show inline; nothing here throws at the UI.
 */
import { updateTag } from "next/cache";
import { adminClient } from "@/lib/db/client";
import { getUser, isAdmin } from "@/lib/db/server";
import { DEFAULTS } from "@/lib/settings/defaults";
import { isMissingTable } from "@/lib/settings/read";
import { isSettingKey, SCHEMAS, type SettingKey } from "@/lib/settings/schema";

export type SettingActionResult = { ok: true; message: string; draft?: unknown } | { ok: false; message: string };

const MIGRATION_HINT = "The settings table is not there yet: apply supabase/migrations/0011_site_settings.sql in the Supabase SQL editor, then try again.";

type DbError = { code?: string; message?: string } | null;
const fail = (message: string): SettingActionResult => ({ ok: false, message });
const dbFail = (error: NonNullable<DbError>): SettingActionResult => fail(isMissingTable(error) ? MIGRATION_HINT : `Database error: ${error.message ?? "unknown"}`);

async function guard(): Promise<{ ok: true; uid: string | null } | { ok: false; message: string }> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized: sign in as an admin." };
  const user = await getUser();
  return { ok: true, uid: user?.id ?? null };
}

/** Validate `value` for `key`; the parsed (stripped, typed) value comes back. */
function validate(key: string, value: unknown): { ok: true; key: SettingKey; value: unknown } | { ok: false; message: string } {
  if (!isSettingKey(key)) return { ok: false, message: `Unknown setting "${key}".` };
  const parsed = SCHEMAS[key].safeParse(value);
  if (parsed.success) return { ok: true, key, value: parsed.data };
  const issues = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".") || "value"}: ${i.message}`);
  return { ok: false, message: `Not saved. ${issues.join(" · ")}${parsed.error.issues.length > 4 ? " · …" : ""}` };
}

type Row = { draft: unknown; live: unknown };
async function readRow(key: SettingKey): Promise<{ row: Row | null; error: DbError }> {
  const { data, error } = await adminClient().from("site_settings").select("draft, live").eq("key", key).maybeSingle();
  return { row: (data as Row | null) ?? null, error };
}

async function logHistory(key: SettingKey, action: "draft" | "publish" | "discard" | "revert", before: unknown, after: unknown, by: string | null) {
  // History is best-effort once the write itself has landed: a failed log must not undo or hide the save.
  const { error } = await adminClient().from("settings_history").insert({ key, action, before, after, by });
  if (error) console.error("[settings] history insert failed:", error.message);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Save to the DRAFT only. The live site does not change until `publishSetting`. */
export async function saveDraft(key: string, value: unknown): Promise<SettingActionResult> {
  const g = await guard();
  if (!g.ok) return fail(g.message);
  const v = validate(key, value);
  if (!v.ok) return fail(v.message);
  try {
    const { row, error } = await readRow(v.key);
    if (error) return dbFail(error);
    const before = row ? row.draft : DEFAULTS[v.key];
    if (same(before, v.value) && row) return { ok: true, message: "Draft already up to date.", draft: v.value };
    const now = new Date().toISOString();
    const write = row
      ? await adminClient().from("site_settings").update({ draft: v.value, updated_by: g.uid, updated_at: now }).eq("key", v.key)
      : // First edit of this key: live starts as today's code default so nothing visible changes.
        await adminClient().from("site_settings").insert({ key: v.key, draft: v.value, live: DEFAULTS[v.key], updated_by: g.uid, updated_at: now });
    if (write.error) return dbFail(write.error);
    await logHistory(v.key, "draft", before, v.value, g.uid);
    return { ok: true, message: "Draft saved. Visitors still see the live version until you publish.", draft: v.value };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unexpected error.");
  }
}

/** Copy draft to live, log it and expire the cache tag so the site updates now. */
export async function publishSetting(key: string): Promise<SettingActionResult> {
  const g = await guard();
  if (!g.ok) return fail(g.message);
  if (!isSettingKey(key)) return fail(`Unknown setting "${key}".`);
  try {
    const { row, error } = await readRow(key);
    if (error) return dbFail(error);
    if (!row) return fail("Nothing to publish: save a draft first.");
    const v = validate(key, row.draft);
    if (!v.ok) return fail(`The draft no longer passes its schema. ${v.message}`);
    if (same(row.live, v.value)) return { ok: true, message: "Already live: the draft equals the live value." };
    const { error: upErr } = await adminClient().from("site_settings").update({ live: v.value, updated_by: g.uid, updated_at: new Date().toISOString() }).eq("key", key);
    if (upErr) return dbFail(upErr);
    await logHistory(key, "publish", row.live, v.value, g.uid);
    updateTag(`settings:${key}`);
    return { ok: true, message: "Published. The live site now shows this value." };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unexpected error.");
  }
}

/** Throw the draft away: it becomes the live value again. */
export async function discardDraft(key: string): Promise<SettingActionResult> {
  const g = await guard();
  if (!g.ok) return fail(g.message);
  if (!isSettingKey(key)) return fail(`Unknown setting "${key}".`);
  try {
    const { row, error } = await readRow(key);
    if (error) return dbFail(error);
    if (!row) return { ok: true, message: "No draft to discard.", draft: DEFAULTS[key] };
    if (same(row.draft, row.live)) return { ok: true, message: "The draft already equals live.", draft: row.live };
    const { error: upErr } = await adminClient().from("site_settings").update({ draft: row.live, updated_by: g.uid, updated_at: new Date().toISOString() }).eq("key", key);
    if (upErr) return dbFail(upErr);
    await logHistory(key, "discard", row.draft, row.live, g.uid);
    return { ok: true, message: "Draft discarded.", draft: row.live };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unexpected error.");
  }
}

/** Put a history row's `before` value back into the DRAFT (publish it to make it live). */
export async function revertToHistory(historyId: number): Promise<SettingActionResult> {
  const g = await guard();
  if (!g.ok) return fail(g.message);
  if (!Number.isInteger(historyId) || historyId <= 0) return fail("Bad history id.");
  try {
    const { data: h, error } = await adminClient().from("settings_history").select("key, before").eq("id", historyId).maybeSingle();
    if (error) return dbFail(error);
    if (!h) return fail("That history row no longer exists.");
    if (h.before === null || h.before === undefined) return fail("That change has no earlier value to go back to.");
    const v = validate(h.key as string, h.before);
    if (!v.ok) return fail(`The earlier value no longer passes its schema. ${v.message}`);
    const { row, error: rErr } = await readRow(v.key);
    if (rErr) return dbFail(rErr);
    const now = new Date().toISOString();
    const write = row
      ? await adminClient().from("site_settings").update({ draft: v.value, updated_by: g.uid, updated_at: now }).eq("key", v.key)
      : await adminClient().from("site_settings").insert({ key: v.key, draft: v.value, live: DEFAULTS[v.key], updated_by: g.uid, updated_at: now });
    if (write.error) return dbFail(write.error);
    await logHistory(v.key, "revert", row ? row.draft : DEFAULTS[v.key], v.value, g.uid);
    return { ok: true, message: `Reverted ${v.key}: the earlier value is now the draft. Open it and Publish to make it live.` };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Unexpected error.");
  }
}
