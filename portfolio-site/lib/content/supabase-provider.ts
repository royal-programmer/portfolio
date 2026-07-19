/**
 * Supabase-backed implementation of `ContentApi`.
 *
 * Same interface as the stub, so `index.ts` can swap between them with no
 * caller changes. Reads use the anon client (RLS lets it see only non-private
 * rows); `includeNonPublic` reads use the admin client (server-only).
 *
 * Row shape is snake_case (Postgres) and mapped to the camelCase domain types.
 */
import { adminClient, publicClient } from "../db/client";
import type {
  BaseEntry,
  BlogPost,
  ContentApi,
  ContentQueryOptions,
  Entry,
  EntryType,
  Group,
  Media,
  Persona,
  PersonaSlug,
  Visibility,
} from "./types";

// Minimal row typings for what we select.
type Row = Record<string, unknown>;

function db(opts?: ContentQueryOptions) {
  return opts?.includeNonPublic ? adminClient() : publicClient();
}

function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function mapPersona(r: Row): Persona {
  return {
    slug: r.slug as PersonaSlug,
    label: (r.label as string) ?? "",
    eyebrow: (r.eyebrow as string) ?? "",
    heading: (r.heading as string) ?? "",
    body: (r.body as string) ?? "",
    accent: (r.accent as string) ?? "#3b82f6",
    cta: (r.cta as string) ?? "",
    points: (r.points as string[]) ?? [],
    isPublished: Boolean(r.is_published),
    order: (r.order as number) ?? 0,
  };
}

function mapMedia(r: Row): Media {
  return {
    id: r.id as string,
    entryId: r.entry_id as string,
    kind: (r.kind as Media["kind"]) ?? "image",
    thumbUrl: (r.thumb_url as string) ?? "",
    optimizedUrl: (r.optimized_url as string) ?? "",
    fullUrl: (r.full_url as string) ?? undefined,
    width: num(r.width),
    height: num(r.height),
    alt: (r.alt as string) ?? undefined,
    caption: (r.caption as string) ?? undefined,
    exif: (r.exif as Media["exif"]) ?? undefined,
    lat: num(r.lat),
    lng: num(r.lng),
    capturedAt: (r.captured_at as string) ?? undefined,
    order: (r.order as number) ?? 0,
  };
}

function mapGroup(r: Row): Group {
  return {
    id: r.id as string,
    personaSlug: r.persona_slug as PersonaSlug,
    name: r.name as string,
    slug: r.slug as string,
    kind: (r.kind as string) ?? "tag",
  };
}

function mapEntry(r: Row): Entry {
  const media = Array.isArray(r.media) ? (r.media as Row[]).map(mapMedia) : [];
  const groups = Array.isArray(r.entry_groups)
    ? (r.entry_groups as Row[])
        .map((eg) => eg.groups as Row | undefined)
        .filter((g): g is Row => Boolean(g))
        .map(mapGroup)
    : [];

  const entry: BaseEntry = {
    id: r.id as string,
    personaSlug: r.persona_slug as PersonaSlug,
    type: r.type as EntryType,
    slug: (r.slug as string) ?? "",
    title: r.title as string,
    summary: (r.summary as string) ?? undefined,
    body: (r.body as string) ?? undefined,
    visibility: r.visibility as Visibility,
    featured: Boolean(r.featured),
    order: (r.order as number) ?? 0,
    occurredAt: (r.occurred_at as string) ?? undefined,
    createdAt: r.created_at as string,
    media: media.sort((a, b) => a.order - b.order),
    groups,
    // jsonb column; shape is guaranteed by the writer, narrowed by `type`.
    data: (r.data ?? {}) as BaseEntry["data"],
  };
  return entry as Entry;
}

function mapBlogPost(r: Row): BlogPost {
  return {
    id: r.id as string,
    personaSlug: r.persona_slug as PersonaSlug,
    title: r.title as string,
    slug: r.slug as string,
    excerpt: (r.excerpt as string) ?? undefined,
    body: (r.body as string) ?? "",
    coverMediaId: (r.cover_media_id as string) ?? undefined,
    tags: (r.tags as string[]) ?? [],
    visibility: r.visibility as Visibility,
    publishedAt: (r.published_at as string) ?? undefined,
  };
}

const ENTRY_SELECT = "*, media(*), entry_groups(groups(*))";

export const supabaseProvider: ContentApi = {
  async listPersonas(opts) {
    const client = db(opts);
    let query = client.from("personas").select("*").order("order", { ascending: true });
    if (!opts?.includeNonPublic) query = query.eq("is_published", true);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapPersona);
  },

  async getPersona(slug, opts) {
    const { data, error } = await db(opts)
      .from("personas")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const persona = mapPersona(data);
    if (!persona.isPublished && !opts?.includeNonPublic) return null;
    return persona;
  },

  async listEntries(persona: PersonaSlug, opts) {
    let query = db(opts)
      .from("entries")
      .select(ENTRY_SELECT)
      .eq("persona_slug", persona)
      .order("order", { ascending: true });
    // Public listings show only public rows (unlisted are reachable by link,
    // never listed). Admin listings see everything.
    if (!opts?.includeNonPublic) query = query.eq("visibility", "public");
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapEntry);
  },

  async getEntry(id, opts) {
    // No visibility filter here: RLS already blocks private rows for anon,
    // while allowing 'unlisted' to be fetched by direct link.
    const { data, error } = await db(opts)
      .from("entries")
      .select(ENTRY_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapEntry(data) : null;
  },

  async getEntryBySlug(persona: PersonaSlug, slug, opts) {
    const { data, error } = await db(opts)
      .from("entries")
      .select(ENTRY_SELECT)
      .eq("persona_slug", persona)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data ? mapEntry(data) : null;
  },

  async listBlogPosts(persona: PersonaSlug, opts) {
    let query = db(opts)
      .from("blog_posts")
      .select("*")
      .eq("persona_slug", persona)
      .order("published_at", { ascending: false, nullsFirst: false });
    if (!opts?.includeNonPublic) query = query.eq("visibility", "public");
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(mapBlogPost);
  },

  async getBlogPost(persona: PersonaSlug, slug, opts) {
    const { data, error } = await db(opts)
      .from("blog_posts")
      .select("*")
      .eq("persona_slug", persona)
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    return data ? mapBlogPost(data) : null;
  },
};
