"use server";

/**
 * Server Actions for the capture/admin surface. Every action re-verifies auth
 * (Server Actions are reachable via direct POST, not just the UI), and all DB
 * work goes through the cookie-bound client so RLS (`is_admin()`) is enforced.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerClient, isAdmin } from "@/lib/db/server";
import { ingestImage } from "@/lib/media/pipeline";
import type { Media, PersonaSlug, Visibility } from "@/lib/content";

export type ActionState = { error?: string; ok?: boolean; entryId?: string };

// ---- Auth ------------------------------------------------------------------

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/capture/admin");
}

export async function signOut(): Promise<void> {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect("/capture/login");
}

// ---- Content ---------------------------------------------------------------

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Create an Engineer project entry. */
export async function createProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return { error: "Not authorized." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };

  const slug = slugify(String(formData.get("slug") ?? "") || title);
  if (!slug) return { error: "Could not derive a slug from the title." };

  const persona: PersonaSlug = "engineer";
  const techStack = String(formData.get("techStack") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const row = {
    persona_slug: persona,
    type: "project" as const,
    slug,
    title,
    summary: String(formData.get("summary") ?? "").trim() || null,
    body: String(formData.get("body") ?? "").trim() || null,
    visibility: (String(formData.get("visibility") ?? "private") as Visibility),
    featured: formData.get("featured") === "on",
    data: {
      role: String(formData.get("role") ?? "").trim() || undefined,
      techStack,
      repoUrl: String(formData.get("repoUrl") ?? "").trim() || undefined,
      deployedUrl: String(formData.get("deployedUrl") ?? "").trim() || undefined,
      demoVideoUrl: String(formData.get("demoVideoUrl") ?? "").trim() || undefined,
    },
  };

  const supabase = await getServerClient();
  const { data, error } = await supabase.from("entries").insert(row).select("id").single();
  if (error) {
    if (error.code === "23505") return { error: `A project with slug "${slug}" already exists.` };
    return { error: error.message };
  }

  // Refresh the public engineer page + the admin list.
  revalidatePath("/engineer");
  revalidatePath("/capture/admin");
  // Return the new id so the client can attach media to it (direct upload).
  return { ok: true, entryId: data.id as string };
}

// ---- Media -----------------------------------------------------------------

export type MediaResult = { error?: string; media?: Media };

/**
 * Finalize a media upload. The browser has ALREADY streamed the original
 * directly to the private `originals` bucket (bypassing the Vercel body limit);
 * this verifies admin, then runs the ingest pipeline (derivatives + EXIF +
 * media row) using the RLS-bound session client.
 */
export async function registerUploadedMedia(input: {
  entryId: string;
  originalPath: string;
  order?: number;
  alt?: string;
  caption?: string;
}): Promise<MediaResult> {
  if (!(await isAdmin())) return { error: "Not authorized." };

  const entryId = String(input.entryId ?? "").trim();
  const originalPath = String(input.originalPath ?? "").trim();
  if (!entryId || !originalPath) return { error: "Missing entry or upload reference." };
  // The original must live under this entry's prefix (paths are `${entryId}/…`).
  if (!originalPath.startsWith(`${entryId}/`)) return { error: "Upload path mismatch." };

  const supabase = await getServerClient();
  const { data: entry, error: entryErr } = await supabase
    .from("entries")
    .select("persona_slug, visibility, slug")
    .eq("id", entryId)
    .maybeSingle();
  if (entryErr) return { error: entryErr.message };
  if (!entry) return { error: "Entry not found." };

  try {
    const media = await ingestImage(supabase, {
      entryId,
      personaSlug: entry.persona_slug as PersonaSlug,
      originalPath,
      visibility: entry.visibility as Visibility,
      order: input.order,
      alt: input.alt,
      caption: input.caption,
    });

    const persona = entry.persona_slug as string;
    revalidatePath(`/${persona}`);
    revalidatePath(`/${persona}/${entry.slug}`);
    revalidatePath("/capture/admin");
    return { media };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Media processing failed." };
  }
}
