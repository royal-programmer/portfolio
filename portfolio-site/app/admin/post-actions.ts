"use server";

/**
 * Server Actions for Writing (blog posts, table `blog_posts`). Same rules as the record actions: the admin is
 * re-checked, the cookie-bound client keeps RLS (`is_admin()`) as the real lock, errors come back as `{ error }`.
 * "Hidden" is `visibility: private`; Delete forever only takes a post that is already hidden.
 */
import { revalidatePath, updateTag } from "next/cache";
import { getServerClient, isAdmin } from "@/lib/db/server";
import { checkPost, postSlug, POST_VIS, type PostValue } from "./_lib/post-forms";
import { freeSlug } from "./_lib/record-forms";

export type PostResult = { ok?: boolean; error?: string; id?: string; message?: string };
const NOT_ADMIN: PostResult = { error: "Not authorized: sign in as an admin." };
const isVis = (v: unknown): v is (typeof POST_VIS)[number] => (POST_VIS as readonly unknown[]).includes(v);

function refresh() {
  updateTag("posts:engineer");
  revalidatePath("/engineer");
  revalidatePath("/admin", "layout");
}

/** Create (no `id`) or update one post. A new post's address comes from the title when none is typed; it never changes after. */
export async function savePost(input: { id?: string; value: PostValue }): Promise<PostResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  const v = input.value;
  if (!v || typeof v !== "object" || !isVis(v.visibility)) return { error: "Bad post." };
  const problems = checkPost(v);
  if (problems.length) return { error: problems[0] };
  const tags = String(v.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12);
  const fields = {
    title: v.title.trim(),
    excerpt: v.excerpt.trim() || null,
    body: v.body.trim(),
    tags,
    visibility: v.visibility,
    published_at: v.publishedAt.trim() ? `${v.publishedAt.trim()}T00:00:00Z` : null,
  };
  try {
    const sb = await getServerClient();
    if (input.id) {
      const { data, error } = await sb.from("blog_posts").update(fields).eq("id", input.id).select("id").maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: "That post no longer exists." };
      refresh();
      return { ok: true, id: String(data.id), message: v.visibility === "public" ? "Published." : "Saved (hidden from the site)." };
    }
    const { data: all } = await sb.from("blog_posts").select("slug").eq("persona_slug", "engineer");
    const slug = freeSlug(postSlug(v), (all ?? []).map((r) => String(r.slug)));
    if (!slug) return { error: "Could not make an address from the title." };
    const { data, error } = await sb.from("blog_posts").insert({ persona_slug: "engineer", slug, ...fields }).select("id").single();
    if (error) return { error: error.message };
    refresh();
    return { ok: true, id: String(data.id), message: v.visibility === "public" ? "Published." : "Added (hidden from the site)." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error." };
  }
}

/** Hide (private) or show posts: the soft delete, with the Undo in the UI. */
export async function setPostVisibility(ids: string[], visibility: string): Promise<PostResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  if (!isVis(visibility)) return { error: "Bad visibility." };
  if (!ids.length || ids.length > 100) return { error: "Pick between 1 and 100 posts." };
  try {
    const sb = await getServerClient();
    const { error } = await sb.from("blog_posts").update({ visibility }).in("id", ids);
    if (error) return { error: error.message };
    refresh();
    return { ok: true, message: `${ids.length} set to ${visibility === "private" ? "hidden" : visibility}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error." };
  }
}

/** Put each post back to the visibility it had (Undo). */
export async function restorePostVisibility(before: { id: string; visibility: string }[]): Promise<PostResult> {
  for (const vis of [...new Set(before.map((b) => b.visibility))]) {
    const r = await setPostVisibility(before.filter((b) => b.visibility === vis).map((b) => b.id), vis);
    if (r.error) return r;
  }
  return { ok: true, message: "Restored." };
}

/** Delete forever: only posts that are already hidden go. */
export async function deletePostsForever(ids: string[]): Promise<PostResult> {
  if (!(await isAdmin())) return NOT_ADMIN;
  if (!ids.length || ids.length > 100) return { error: "Pick between 1 and 100 posts." };
  try {
    const sb = await getServerClient();
    const { data, error } = await sb.from("blog_posts").delete().in("id", ids).eq("visibility", "private").select("id");
    if (error) return { error: error.message };
    const n = data?.length ?? 0;
    if (n < ids.length) return { ok: n > 0, error: n ? `${n} deleted; ${ids.length - n} were not hidden first and were kept.` : "Hide a post first, then delete it forever." };
    refresh();
    return { ok: true, message: `${n} deleted forever.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unexpected error." };
  }
}
