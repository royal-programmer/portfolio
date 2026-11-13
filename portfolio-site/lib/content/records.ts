/**
 * Typed readers for the engineer's records (server-only). One cached read per type (`unstable_cache`, tag
 * `entries:<type>`, 60 s), public rows only; a valid admin preview cookie reads every row, uncached, through
 * the service client, like projects. It never throws: no database, a missing enum value (migration 0012 not
 * applied), a network blip or a row whose `data` fails its schema all give fewer records, never a broken page
 * and never hard-coded ones. `loadRecords()` is what `terminalData` takes under `CONTENT_SOURCE=db`.
 */
import { unstable_cache } from "next/cache";
import { adminClient, hasSupabaseEnv, publicClient } from "@/lib/db/client";
import { previewActive } from "@/lib/settings/preview";
import { parseRecordData } from "./record-schemas";
import { emptyRecords, profilesFromRecords, type RecordRow, type Records } from "./records-assemble";
import { fromDb } from "./source";
import { RECORD_TYPES, type RecordType } from "./types";
import { PROFILES, type TermProfile } from "@/lib/site/profiles";

const warned = new Set<string>();

type Raw = { slug: string; order: number; data: unknown };

async function fetchRows(type: RecordType, drafts: boolean): Promise<Raw[]> {
  try {
    const client = drafts ? adminClient() : publicClient();
    let q = client.from("entries").select("slug, order, data").eq("persona_slug", "engineer").eq("type", type).order("order", { ascending: true });
    if (!drafts) q = q.eq("visibility", "public");
    const { data, error } = await q;
    if (error) {
      if (!warned.has(type)) {
        warned.add(type);
        console.warn(`[records] ${type}: ${error.message}; serving none.`);
      }
      return [];
    }
    return (data ?? []).map((r) => ({ slug: String(r.slug), order: Number(r.order ?? 0), data: r.data }));
  } catch {
    return [];
  }
}

const cachedRows = (type: RecordType) => unstable_cache(() => fetchRows(type, false), ["records", type], { tags: [`entries:${type}`], revalidate: 60 })();

/** Rows of one type, validated; rows that fail their schema are skipped with one warning per slug. */
export async function listRecords<T extends RecordType>(type: T, opts: { preview?: boolean } = {}): Promise<RecordRow<T>[]> {
  if (!hasSupabaseEnv()) return [];
  const preview = opts.preview ?? (await previewActive());
  const raw = preview ? await fetchRows(type, true) : await cachedRows(type);
  const out: RecordRow<T>[] = [];
  for (const r of raw) {
    const data = parseRecordData(type, r.data);
    if (data) out.push({ slug: r.slug, order: r.order, data });
    else if (!warned.has(`${type}:${r.slug}`)) {
      warned.add(`${type}:${r.slug}`);
      console.warn(`[records] ${type} "${r.slug}" failed its schema; skipped.`);
    }
  }
  return out;
}

export const listExperience = (o?: { preview?: boolean }) => listRecords("experience", o);
export const listEducation = (o?: { preview?: boolean }) => listRecords("education", o);
export const listCertifications = (o?: { preview?: boolean }) => listRecords("certification", o);
export const listSkillGroups = (o?: { preview?: boolean }) => listRecords("skill_group", o);
export const listTimelineEvents = (o?: { preview?: boolean }) => listRecords("timeline_event", o);
export const listMilestones = (o?: { preview?: boolean }) => listRecords("milestone", o);
export const listDiagrams = (o?: { preview?: boolean }) => listRecords("diagram", o);
export const listProfileLinks = (o?: { preview?: boolean }) => listRecords("profile_link", o);

/** Every record type at once (one preview check, reads in parallel). */
export async function loadRecords(): Promise<Records> {
  const preview = await previewActive();
  const lists = await Promise.all(RECORD_TYPES.map(async (t) => [t, await listRecords(t, { preview })] as const));
  return { ...emptyRecords(), ...Object.fromEntries(lists) };
}

/** The profile links the hub footer shows: records under `db`, the frozen copy otherwise. */
export async function loadProfiles(): Promise<TermProfile[]> {
  return fromDb ? profilesFromRecords({ ...emptyRecords(), profile_link: await listProfileLinks() }) : PROFILES;
}
