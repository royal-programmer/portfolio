"use server";

/**
 * Server Actions for the engineer's records (experience, certificates, education, timeline, milestones,
 * diagrams, profile links) and for the bulk tools. Every one re-verifies the admin, validates `data` against the
 * record's own Zod schema (the same one the form checks) and writes through the cookie-bound client, so the
 * database's RLS still applies. Nothing here throws at the UI: errors come back as `{ error }`.
 *
 * "Hidden" is `visibility: private` (the site only reads public rows). Delete is two steps: hide first (with an
 * Undo in the UI), then "Delete forever", which only accepts a row that is already hidden.
 */
import { revalidatePath, updateTag } from "next/cache";
import { RECORD_SCHEMAS } from "@/lib/content/record-schemas";
import { isRecordType, type RecordType } from "@/lib/content/types";
import { getServerClient, isAdmin } from "@/lib/db/server";
import { freeSlug, orderValues, recordMeta, validateImport } from "./_lib/record-forms";

export type RecordResult = { ok?: boolean; error?: string; id?: string; message?: string };
const VIS = ["private", "unlisted", "public"] as const;
type Vis = (typeof VIS)[number];
const isVis = (v: unknown): v is Vis => (VIS as readonly unknown[]).includes(v);

const NOT_ADMIN: RecordResult = { error: "Not authorized: sign in as an admin." };

function refresh(type?: string) {
  if (type) updateTag(`entries:${type}`);
  revalidatePath("/engineer");
  revalidatePath("/admin", "layout");
}

const typeOf = (v: unknown): RecordType | null => (typeof v === "string" && isRecordType(v) && v !== "skill_group" ? v : null);

/** Create (no `id`) or update one record. `data` must satisfy the schema; title, summary, slug and date are derived. */
export async function saveRecord(input: { type: string; id?: string; visibility: string; data: unknown }): Promise<RecordResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const type = typeOf(input.type);
  if (!type) return { error: "Unknown record type." };
  if (!isVis(input.visibility)) return { error: "Bad visibility." };
  const parsed = RECORD_SCHEMAS[type].safeParse(input.data);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `Not saved: ${i?.path.join(" > ") ? `${i.path.join(" > ")}: ` : ""}${i?.message ?? "check the form"}` };
  }
  const data = parsed.data as Record<string, unknown>;
  const meta = recordMeta(type, data);
  if (!meta.title.replace(/[·\s]/g, "")) return { error: "Give it a name first." };
  try {
    const sb = await getServerClient();
    if (input.id) {
      const { data: row, error } = await sb
        .from("entries")
        .update({ title: meta.title, summary: meta.summary ?? null, visibility: input.visibility, occurred_at: meta.occurredAt ?? null, data })
        .eq("id", input.id)
        .eq("type", type)
        .select("id")
        .maybeSingle();
      if (error) return { error: error.message };
      if (!row) return { error: "That record no longer exists." };
      refresh(type);
      return { ok: true, id: String(row.id), message: input.visibility === "public" ? "Published." : "Saved (hidden from the site)." };
    }
    const { data: all } = await sb.from("entries").select("slug, order").eq("persona_slug", "engineer").eq("type", type);
    const slug = freeSlug(meta.slug, (all ?? []).map((r) => String(r.slug)));
    const order = Math.max(-10, ...(all ?? []).map((r) => Number(r.order ?? 0))) + 10;
    const { data: row, error } = await sb
      .from("entries")
      .insert({ persona_slug: "engineer", type, slug, title: meta.title, summary: meta.summary ?? null, visibility: input.visibility, order, occurred_at: meta.occurredAt ?? null, data })
      .select("id")
      .single();
    if (error) return { error: error.message };
    refresh(type);
    return { ok: true, id: String(row.id), message: input.visibility === "public" ? "Published." : "Added (hidden from the site)." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error." };
  }
}

/** Set visibility on many rows at once (also the soft delete: `private`). */
export async function setRecordsVisibility(type: string, ids: string[], visibility: string): Promise<RecordResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const t = typeOf(type) ?? (type === "project" ? ("project" as const) : null);
  if (!t) return { error: "Unknown record type." };
  if (!isVis(visibility)) return { error: "Bad visibility." };
  if (!ids.length || ids.length > 200) return { error: "Pick between 1 and 200 rows." };
  try {
    const sb = await getServerClient();
    const { error } = await sb.from("entries").update({ visibility }).in("id", ids).eq("type", t);
    if (error) return { error: error.message };
    refresh(t);
    revalidatePath("/engineer", "layout");
    return { ok: true, message: `${ids.length} set to ${visibility}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error." };
  }
}

/** Per-row restore for Undo: put each row back to the visibility it had. */
export async function restoreVisibility(type: string, before: { id: string; visibility: string }[]): Promise<RecordResult> {
  for (const v of [...new Set(before.map((b) => b.visibility))]) {
    const r = await setRecordsVisibility(type, before.filter((b) => b.visibility === v).map((b) => b.id), v);
    if (r.error) return r;
  }
  return { ok: true, message: "Restored." };
}

/** Delete forever. Only rows that are already hidden (private) go: the second confirm of a two-step delete. */
export async function deleteRecordsForever(type: string, ids: string[]): Promise<RecordResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const t = typeOf(type) ?? (type === "project" ? ("project" as const) : null);
  if (!t) return { error: "Unknown record type." };
  if (!ids.length || ids.length > 200) return { error: "Pick between 1 and 200 rows." };
  try {
    const sb = await getServerClient();
    const { data, error } = await sb.from("entries").delete().in("id", ids).eq("type", t).eq("visibility", "private").select("id");
    if (error) return { error: error.message };
    const n = data?.length ?? 0;
    if (n < ids.length) return { ok: n > 0, error: n ? `${n} deleted; ${ids.length - n} were not hidden first and were kept.` : "Hide a record first, then delete it forever." };
    refresh(t);
    return { ok: true, message: `${n} deleted forever.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error." };
  }
}

/** A hidden copy of one record, right after it in the order. */
export async function duplicateRecord(id: string): Promise<RecordResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  try {
    const sb = await getServerClient();
    const { data: src } = await sb.from("entries").select("*").eq("id", String(id)).maybeSingle();
    if (!src || !isRecordType(String(src.type)) || src.type === "skill_group") return { error: "Record not found." };
    const { data: all } = await sb.from("entries").select("slug, order").eq("persona_slug", "engineer").eq("type", src.type);
    const slug = freeSlug(`${src.slug}-copy`, (all ?? []).map((r) => String(r.slug)));
    const order = Math.max(...(all ?? []).map((r) => Number(r.order ?? 0)), 0) + 10;
    const { data: row, error } = await sb
      .from("entries")
      .insert({ persona_slug: "engineer", type: src.type, slug, title: `${src.title} (copy)`, summary: src.summary, visibility: "private", order, occurred_at: src.occurred_at, data: src.data })
      .select("id")
      .single();
    if (error) return { error: error.message };
    refresh(String(src.type));
    return { ok: true, id: String(row.id), message: "Copied (hidden until you publish it)." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error." };
  }
}

/** Save a new sequence for one collection (drag on a desktop, Up/Down on a phone). */
export async function reorderRecords(type: string, ids: string[]): Promise<RecordResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const t = typeOf(type) ?? (type === "project" ? ("project" as const) : null);
  if (!t) return { error: "Unknown record type." };
  if (!ids.length || ids.length > 300) return { error: "Nothing to reorder." };
  try {
    const sb = await getServerClient();
    for (const { id, order } of orderValues(ids)) {
      const { error } = await sb.from("entries").update({ order }).eq("id", id).eq("type", t);
      if (error) return { error: error.message };
    }
    refresh(t);
    return { ok: true, message: "Order saved." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error." };
  }
}

/** Import after the dry run: re-validates everything on the server; one bad record stops the whole import. */
export async function importRecords(type: string, text: string): Promise<RecordResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const t = typeOf(type);
  if (!t) return { error: "Unknown record type." };
  try {
    const sb = await getServerClient();
    const { data: have } = await sb.from("entries").select("id, slug, order").eq("persona_slug", "engineer").eq("type", t);
    const bySlug = new Map((have ?? []).map((r) => [String(r.slug), r]));
    const plan = validateImport(t, text, bySlug.keys());
    if (!plan.ok) return { error: plan.summary };
    let next = Math.max(-10, ...(have ?? []).map((r) => Number(r.order ?? 0))) + 10;
    for (const r of plan.rows) {
      const meta = recordMeta(t, r.data);
      const base = { title: meta.title, summary: meta.summary ?? null, visibility: r.visibility, occurred_at: meta.occurredAt ?? null, data: r.data };
      const existing = bySlug.get(r.slug);
      const { error } = existing
        ? await sb.from("entries").update({ ...base, ...(r.order !== undefined ? { order: r.order } : {}) }).eq("id", existing.id)
        : await sb.from("entries").insert({ persona_slug: "engineer", type: t, slug: r.slug, order: r.order ?? (next += 10), ...base });
      if (error) return { error: `Stopped at "${r.slug}": ${error.message}` };
    }
    refresh(t);
    return { ok: true, message: plan.summary };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error." };
  }
}

/** Names for the command palette: every record by title, with the screen that edits it. */
export async function paletteIndex(): Promise<{ label: string; href: string; hint: string }[]> {
  if (!(await isAdmin())) return [];
  try {
    const sb = await getServerClient();
    const { data } = await sb.from("entries").select("id, type, title").eq("persona_slug", "engineer").order("order", { ascending: true }).limit(400);
    const section: Record<string, string> = {
      project: "projects",
      experience: "experience",
      certification: "certifications",
      education: "education",
      timeline_event: "events",
      milestone: "milestones",
      diagram: "architecture",
      profile_link: "links",
      skill_group: "skills",
    };
    return (data ?? []).filter((r) => section[String(r.type)]).map((r) => ({ label: String(r.title), href: `/admin/engineer/${section[String(r.type)]}?id=${r.id}`, hint: String(r.type).replace("_", " ") }));
  } catch {
    return [];
  }
}
