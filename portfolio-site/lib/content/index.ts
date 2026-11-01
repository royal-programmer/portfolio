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
import type { ContentApi } from "./types";

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

// Bound convenience functions (ergonomic + tree-shakeable) matching ContentApi.
export const listPersonas: ContentApi["listPersonas"] = (opts) =>
  activeProvider.listPersonas(opts);
export const getPersona: ContentApi["getPersona"] = (slug, opts) =>
  activeProvider.getPersona(slug, opts);
export const listEntries: ContentApi["listEntries"] = (persona, opts) =>
  activeProvider.listEntries(persona, opts);
export const getEntry: ContentApi["getEntry"] = (id, opts) => activeProvider.getEntry(id, opts);
export const getEntryBySlug: ContentApi["getEntryBySlug"] = (persona, slug, opts) =>
  activeProvider.getEntryBySlug(persona, slug, opts);
export const listBlogPosts: ContentApi["listBlogPosts"] = (persona, opts) =>
  activeProvider.listBlogPosts(persona, opts);
export const getBlogPost: ContentApi["getBlogPost"] = (persona, slug, opts) =>
  activeProvider.getBlogPost(persona, slug, opts);

// Re-export the whole contract so callers have one import site.
export * from "./types";
