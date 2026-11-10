/**
 * The typed settings reader (server-only). `getSetting(key)` returns the live value from the
 * `site_settings_live` view (cached 60 s, tag `settings:<key>`), or the draft column through the service
 * client when an admin's preview cookie is present, or the code default. It never throws: a missing
 * table (migration 0011 not applied yet), a network blip, a row with no value or a value that fails its
 * schema all fall back to the default for THAT key only.
 */
import { unstable_cache } from "next/cache";
import { adminClient, hasSupabaseEnv, publicClient } from "@/lib/db/client";
import { DEFAULTS } from "./defaults";
import { previewActive } from "./preview";
import { SCHEMAS, SETTING_KEYS, type SettingKey, type SettingValue, type Settings } from "./schema";

export type SettingSource = "live" | "draft" | "default";
export type SettingResult<K extends SettingKey> = { value: SettingValue<K>; source: SettingSource };

const warned = new Set<string>();

/** Parse a stored value; on failure log once per key and return null. */
function parseStored<K extends SettingKey>(key: K, raw: unknown): SettingValue<K> | null {
  if (raw === null || raw === undefined) return null;
  const result = SCHEMAS[key].safeParse(raw);
  if (result.success) return result.data as SettingValue<K>;
  if (!warned.has(key)) {
    warned.add(key);
    const why = result.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    console.error(`[settings] "${key}" failed its schema; using the default. ${why}`);
  }
  return null;
}

/** PostgREST / Postgres signs for "the table or view is not there yet". */
export const isMissingTable = (err: { code?: string; message?: string } | null | undefined) =>
  Boolean(err && (err.code === "42P01" || err.code === "PGRST205" || /could not find the (table|view)|does not exist/i.test(err.message ?? "")));

const liveRow = (key: SettingKey) =>
  unstable_cache(
    async (): Promise<unknown> => {
      try {
        const { data, error } = await publicClient().from("site_settings_live").select("value").eq("key", key).maybeSingle();
        return error || !data ? null : (data.value as unknown);
      } catch {
        return null;
      }
    },
    ["settings-live", key],
    { tags: [`settings:${key}`], revalidate: 60 },
  )();

async function draftRow(key: SettingKey): Promise<unknown> {
  try {
    const { data, error } = await adminClient().from("site_settings").select("draft").eq("key", key).maybeSingle();
    return error || !data ? null : (data.draft as unknown);
  } catch {
    return null;
  }
}

export async function getSetting<K extends SettingKey>(key: K, opts: { preview?: boolean } = {}): Promise<SettingResult<K>> {
  if (hasSupabaseEnv()) {
    const preview = opts.preview ?? (await previewActive());
    if (preview) {
      const draft = parseStored(key, await draftRow(key));
      if (draft) return { value: draft, source: "draft" };
    }
    const live = parseStored(key, await liveRow(key));
    if (live) return { value: live, source: "live" };
  }
  return { value: DEFAULTS[key], source: "default" };
}

/** Several keys at once (one preview check, reads in parallel). */
export async function getSettings<K extends SettingKey>(keys: readonly K[]): Promise<{ [P in K]: SettingResult<P> }> {
  const preview = await previewActive();
  const entries = await Promise.all(keys.map(async (k) => [k, await getSetting(k, { preview })] as const));
  return Object.fromEntries(entries) as { [P in K]: SettingResult<P> };
}

/** Just the values, for pages that do not care where they came from. */
export async function getSettingValues<K extends SettingKey>(keys: readonly K[]): Promise<Pick<Settings, K>> {
  const all = await getSettings(keys);
  return Object.fromEntries(keys.map((k) => [k, all[k].value])) as Pick<Settings, K>;
}

export type AdminSettingState = {
  key: SettingKey;
  /** What the code ships with. */
  fallback: unknown;
  /** The draft (the live value, or the default, when nothing is staged). */
  draft: unknown;
  live: unknown;
  /** A row exists. */
  stored: boolean;
  /** Draft differs from live. */
  differs: boolean;
  updatedAt: string | null;
};

/** Every key's draft and live value for the admin (service client). `tableReady` is false until 0011 is applied. */
export async function getAllSettings(): Promise<{ tableReady: boolean; error?: string; items: Record<SettingKey, AdminSettingState> }> {
  const items = Object.fromEntries(
    SETTING_KEYS.map((key) => [key, { key, fallback: DEFAULTS[key], draft: DEFAULTS[key], live: DEFAULTS[key], stored: false, differs: false, updatedAt: null } satisfies AdminSettingState]),
  ) as Record<SettingKey, AdminSettingState>;
  try {
    const { data, error } = await adminClient().from("site_settings").select("key, draft, live, updated_at");
    if (error) return { tableReady: !isMissingTable(error), error: isMissingTable(error) ? undefined : error.message, items };
    for (const row of data ?? []) {
      const key = row.key as SettingKey;
      if (!(key in items)) continue;
      const draft = parseStored(key, row.draft) ?? DEFAULTS[key];
      const live = parseStored(key, row.live) ?? DEFAULTS[key];
      items[key] = { key, fallback: DEFAULTS[key], draft, live, stored: true, differs: JSON.stringify(draft) !== JSON.stringify(live), updatedAt: row.updated_at as string };
    }
    return { tableReady: true, items };
  } catch (e) {
    return { tableReady: false, error: e instanceof Error ? e.message : "unknown error", items };
  }
}
