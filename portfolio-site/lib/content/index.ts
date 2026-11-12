/**
 * Public entrypoint for the content layer.
 *
 * Import everything content-related from `@/lib/content`:
 *
 *   import { getPersona, listEntries, type Persona } from "@/lib/content";
 *
 * `activeProvider` is the single switch between implementations. It points at
 * the stub today and will point at the Supabase-backed provider once that
 * lands — no caller changes, because both satisfy `ContentApi`.
 */
import { hasSupabaseEnv } from "../db/client";
import { stubProvider } from "./stub-provider";
import { supabaseProvider } from "./supabase-provider";
import { isRecordType, type ContentApi } from "./types";

/**
 * Provider selection is by environment:
 *   - Supabase env present  → real, DB-backed content.
 *   - Supabase env absent    → in-memory fixtures (local dev, CI, previews).
 *
 * Deterministic per environment, so Cursor's local dev (no `.env.local`) always
 * gets the stub, and production (env set + schema applied) gets Supabase — with
 * zero caller changes either way.
 */
const activeProvider: ContentApi = hasSupabaseEnv() ? supabaseProvider : stubProvider;

/**
 * Public listings never take a page down. A live read that fails (a paused project, a network
 * blip, a slow cold start past the deadline) is logged and answered with the last good result
 * for that query — or an empty list on the very first miss. Single-row reads keep throwing: a
 * missing row is a 404, not an outage.
 */
const lastGood = new Map<string, unknown>();
const DEADLINE_MS = 9000;
async function resilient<T>(key: string, run: () => Promise<T>, empty: T): Promise<T> {
  if (activeProvider !== supabaseProvider) return run();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const v = await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`content read past ${DEADLINE_MS} ms`)), DEADLINE_MS);
      }),
    ]);
    lastGood.set(key, v);
    return v;
  } catch (e) {
    const had = lastGood.has(key);
    console.warn(`[content] ${key} failed — serving ${had ? "the last good result" : "an empty list"}.`, e instanceof Error ? e.message : e);
    return had ? (lastGood.get(key) as T) : empty;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Bound convenience functions (ergonomic + tree-shakeable) matching ContentApi.
export const listPersonas: ContentApi["listPersonas"] = (opts) =>
  resilient(`personas:${JSON.stringify(opts ?? {})}`, () => activeProvider.listPersonas(opts), []);
export const getPersona: ContentApi["getPersona"] = (slug, opts) =>
  activeProvider.getPersona(slug, opts);
export const listEntries: ContentApi["listEntries"] = (persona, opts) =>
  resilient(`entries:${persona}:${JSON.stringify(opts ?? {})}`, () => activeProvider.listEntries(persona, opts), []);
// A record (experience, timeline event, ...) is never a page: a direct read of one answers "not found".
export const getEntry: ContentApi["getEntry"] = async (id, opts) => {
  const e = await activeProvider.getEntry(id, opts);
  return e && !isRecordType(e.type) ? e : null;
};
export const getEntryBySlug: ContentApi["getEntryBySlug"] = async (persona, slug, opts) => {
  const e = await activeProvider.getEntryBySlug(persona, slug, opts);
  return e && !isRecordType(e.type) ? e : null;
};
export const listBlogPosts: ContentApi["listBlogPosts"] = (persona, opts) =>
  resilient(`posts:${persona}:${JSON.stringify(opts ?? {})}`, () => activeProvider.listBlogPosts(persona, opts), []);
export const getBlogPost: ContentApi["getBlogPost"] = (persona, slug, opts) =>
  activeProvider.getBlogPost(persona, slug, opts);

// Re-export the whole contract so callers have one import site.
export * from "./types";
