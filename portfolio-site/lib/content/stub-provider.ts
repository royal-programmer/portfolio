/**
 * Stub implementation of `ContentApi` over the in-memory fixtures.
 *
 * Deliberately async (returns Promises) so it is a drop-in for the future
 * Supabase-backed provider — swapping providers in `index.ts` changes nothing
 * for callers. Applies the same visibility rules the real provider will:
 * non-public rows are hidden unless `includeNonPublic` is set.
 */
import { STUB_BLOG_POSTS, STUB_ENTRIES, STUB_PERSONAS } from "./fixtures";
import type {
  BlogPost,
  ContentApi,
  ContentQueryOptions,
  Entry,
  Persona,
  PersonaSlug,
} from "./types";

function isVisible(visibility: string, opts?: ContentQueryOptions): boolean {
  if (opts?.includeNonPublic) return true;
  return visibility === "public";
}

function byOrder<T extends { order: number }>(a: T, b: T): number {
  return a.order - b.order;
}

export const stubProvider: ContentApi = {
  async listPersonas(opts) {
    return STUB_PERSONAS.filter((p) => opts?.includeNonPublic || p.isPublished).sort(byOrder);
  },

  async getPersona(slug, opts) {
    const persona = STUB_PERSONAS.find((p) => p.slug === slug);
    if (!persona) return null;
    if (!persona.isPublished && !opts?.includeNonPublic) return null;
    return persona;
  },

  async listEntries(persona: PersonaSlug, opts) {
    return STUB_ENTRIES.filter(
      (e) => e.personaSlug === persona && isVisible(e.visibility, opts),
    ).sort(byOrder) as Entry[];
  },

  async getEntry(id, opts) {
    const entry = STUB_ENTRIES.find((e) => e.id === id);
    if (!entry) return null;
    if (!isVisible(entry.visibility, opts)) return null;
    return entry as Entry;
  },

  async getEntryBySlug(persona: PersonaSlug, slug, opts) {
    const entry = STUB_ENTRIES.find((e) => e.personaSlug === persona && e.slug === slug);
    if (!entry) return null;
    if (!isVisible(entry.visibility, opts)) return null;
    return entry as Entry;
  },

  async listBlogPosts(persona: PersonaSlug, opts) {
    return STUB_BLOG_POSTS.filter(
      (b) => b.personaSlug === persona && isVisible(b.visibility, opts),
    );
  },

  async getBlogPost(persona: PersonaSlug, slug, opts) {
    const post = STUB_BLOG_POSTS.find((b) => b.personaSlug === persona && b.slug === slug);
    if (!post) return null;
    if (!isVisible(post.visibility, opts)) return null;
    return post;
  },
};

// Explicit re-exports keep this file's role obvious to readers.
export type { BlogPost, Entry, Persona };
