/**
 * The Writing form (blog posts) as pure helpers: the form's value, its comparable clean form, the checks and the
 * slug rule. Client-safe, no server imports. Posts live in `blog_posts` (not `entries`), so they have their own
 * actions (`post-actions.ts`) and screen (`_collections/posts-screen.tsx`).
 */
import { slugify } from "./record-forms";

export type PostValue = { title: string; slug: string; excerpt: string; body: string; tags: string; visibility: string; publishedAt: string };

export const BLANK_POST: PostValue = { title: "", slug: "", excerpt: "", body: "", tags: "", visibility: "private", publishedAt: "" };

export const POST_VIS = ["private", "unlisted", "public"] as const;

/** `YYYY-MM-DD` of an ISO timestamp, or "". */
export const dayOf = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : "");

export function cleanPost(v: PostValue): Record<string, unknown> {
  return {
    title: v.title.trim(),
    slug: v.slug.trim(),
    excerpt: v.excerpt.trim(),
    body: v.body.trim(),
    tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
    visibility: v.visibility,
    publishedAt: v.publishedAt.trim(),
  };
}

/** What stops a post from being saved, in plain words (empty = fine). */
export function checkPost(v: PostValue): string[] {
  const out: string[] = [];
  if (!v.title.trim()) out.push("Give the post a title first.");
  if (v.slug.trim() && !/^[a-z0-9][a-z0-9-]{0,118}$/.test(v.slug.trim())) out.push("The address can only hold lowercase letters, numbers and dashes.");
  if (v.publishedAt.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(v.publishedAt.trim())) out.push("The publish date should look like 2026-11-13.");
  if (v.visibility === "public" && !v.body.trim()) out.push("A public post needs some text.");
  return out;
}

/** The address a new post gets: the typed one, else made from the title. */
export const postSlug = (v: Pick<PostValue, "slug" | "title">) => v.slug.trim() || slugify(v.title);

/** Overlay a saved draft onto a value: unknown or mistyped keys are ignored. */
export function mergePostDraft(base: PostValue, draft: unknown): PostValue {
  if (!draft || typeof draft !== "object") return base;
  const d = draft as Record<string, unknown>;
  const out = { ...base };
  for (const k of Object.keys(base) as (keyof PostValue)[]) if (typeof d[k] === "string") out[k] = d[k] as string;
  return out;
}
