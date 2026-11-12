"use server";

/**
 * Server Actions for the admin. Every action re-verifies auth
 * (Server Actions are reachable via direct POST, not just the UI), and all DB
 * work goes through the cookie-bound client so RLS (`is_admin()`) is enforced.
 */
import { revalidatePath } from "next/cache";
import { safeNext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { parseHost } from "@/lib/site/hosts";
import { ADMIN_HOST_LABEL } from "@/lib/site/admin-host";
import { getServerClient, isAdmin } from "@/lib/db/server";
import { ingestImage } from "@/lib/media/pipeline";
import type { Media, PersonaSlug, Visibility } from "@/lib/content";

export type ActionState = { error?: string; ok?: boolean; entryId?: string; message?: string };

// ---- Auth ------------------------------------------------------------------

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await getServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(safeNext(String(formData.get("next") ?? "")) ?? "/admin");
}

// ---- One-click sign-in (magic link) ---------------------------------------------

const LINK_REPLY = "If that address is an admin, a link is on its way.";
const LINK_LIMIT = 3;
const LINK_WINDOW_MS = 10 * 60 * 1000;
/** Per-IP send times, in memory (one serverless instance; enough to blunt a loop). */
const linkHits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (linkHits.get(ip) ?? []).filter((t) => now - t < LINK_WINDOW_MS);
  if (recent.length >= LINK_LIMIT) {
    linkHits.set(ip, recent);
    return true;
  }
  recent.push(now);
  linkHits.set(ip, recent);
  if (linkHits.size > 500) for (const [k, v] of linkHits) if (!v.some((t) => now - t < LINK_WINDOW_MS)) linkHits.delete(k);
  return false;
}

/** The apex origin of this request (admin lives on the root host, never a persona subdomain). */
async function apexOrigin(): Promise<string> {
  const h = await headers();
  const hostHeader = h.get("x-forwarded-host") ?? h.get("host");
  const host = (hostHeader ?? "").toLowerCase();
  const local = /^(localhost|127\.0\.0\.1|[\w-]+\.localhost)(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  const parsed = parseHost(hostHeader);
  const port = host.match(/:\d+$/)?.[0] ?? "";
  return parsed.kind === "unrouted" ? `${proto}://${host}` : `${proto}://${ADMIN_HOST_LABEL ? `${ADMIN_HOST_LABEL}.` : ""}${parsed.root}${port}`;
}

/**
 * Email a one-time sign-in link. `shouldCreateUser: false` means a stranger can never create an account,
 * and the reply is the same for every address (no account enumeration).
 */
export async function requestSignInLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (rateLimited(ip)) return { error: "Too many requests. Try again in a few minutes." };

  const next = safeNext(String(formData.get("next") ?? ""));
  const emailRedirectTo = `${await apexOrigin()}/admin/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  try {
    const supabase = await getServerClient();
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } });
  } catch {
    // Same answer either way: never reveal whether the address exists or the send failed.
  }
  return { ok: true, message: LINK_REPLY };
}

// A Google button goes here later: `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`
// with the same apex `/admin/auth/callback` redirect. Not built yet (docs/claude-planning/16-admin-console.md, "Sign-in").

export async function signOut(): Promise<void> {
  const supabase = await getServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
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
  revalidatePath("/admin/engineer/projects");
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
    revalidatePath("/admin/engineer/projects");
    return { media };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Media processing failed." };
  }
}

// ---- Project management (master-detail editor) -------------------------------------

/** Pull the editable project fields out of a form submission (shared by create-shaped writes). */
function projectFields(formData: FormData) {
  const techStack = String(formData.get("techStack") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    title: String(formData.get("title") ?? "").trim(),
    summary: String(formData.get("summary") ?? "").trim() || null,
    body: String(formData.get("body") ?? "").trim() || null,
    visibility: String(formData.get("visibility") ?? "private") as Visibility,
    featured: formData.get("featured") === "on",
    data: {
      role: String(formData.get("role") ?? "").trim() || undefined,
      techStack,
      repoUrl: String(formData.get("repoUrl") ?? "").trim() || undefined,
      deployedUrl: String(formData.get("deployedUrl") ?? "").trim() || undefined,
      demoVideoUrl: String(formData.get("demoVideoUrl") ?? "").trim() || undefined,
    },
  };
}

const VISIBILITIES = ["private", "unlisted", "public"];

function refreshProjects(slug?: string) {
  revalidatePath("/engineer");
  if (slug) revalidatePath(`/engineer/${slug}`);
  revalidatePath("/admin/engineer/projects");
}

/** Update one project. The slug is kept stable (public URLs); everything else is editable. */
export async function updateProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return { error: "Not authorized." };
  const id = String(formData.get("id") ?? "").trim();
  const f = projectFields(formData);
  if (!id) return { error: "Missing project." };
  if (!f.title) return { error: "Title is required." };
  if (!VISIBILITIES.includes(f.visibility)) return { error: "Bad visibility." };

  const supabase = await getServerClient();
  const { data, error } = await supabase.from("entries").update(f).eq("id", id).eq("type", "project").select("id, slug").maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Project not found." };
  refreshProjects(data.slug as string);
  return { ok: true, entryId: data.id as string, message: "Saved." };
}

/** Delete one project (its media rows follow by the database's cascade). */
export async function deleteProject(id: string): Promise<ActionState> {
  if (!(await isAdmin())) return { error: "Not authorized." };
  const supabase = await getServerClient();
  const { data, error } = await supabase.from("entries").delete().eq("id", String(id)).eq("type", "project").select("slug").maybeSingle();
  if (error) return { error: error.message };
  refreshProjects(data?.slug as string | undefined);
  return { ok: true };
}

/** Copy a project's fields into a new private "-copy" entry (media is not copied). */
export async function duplicateProject(id: string): Promise<ActionState> {
  if (!(await isAdmin())) return { error: "Not authorized." };
  const supabase = await getServerClient();
  const { data: src, error: readErr } = await supabase.from("entries").select("*").eq("id", String(id)).eq("type", "project").maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!src) return { error: "Project not found." };
  for (let n = 1; n <= 20; n++) {
    const slug = `${src.slug}-copy${n > 1 ? `-${n}` : ""}`;
    const { data, error } = await supabase
      .from("entries")
      .insert({ persona_slug: src.persona_slug, type: "project", slug, title: `${src.title} (copy)`, summary: src.summary, body: src.body, visibility: "private", featured: false, data: src.data })
      .select("id")
      .single();
    if (!error) {
      refreshProjects();
      return { ok: true, entryId: data.id as string };
    }
    if (error.code !== "23505") return { error: error.message };
  }
  return { error: "Could not find a free slug." };
}
