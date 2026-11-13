"use server";

/**
 * Server Actions for the admin. Every action re-verifies auth
 * (Server Actions are reachable via direct POST, not just the UI), and all DB
 * work goes through the cookie-bound client so RLS (`is_admin()`) is enforced.
 */
import { revalidatePath, updateTag } from "next/cache";
import { projectMediaSchema, projectStorySchema, RECORD_SCHEMAS } from "@/lib/content/record-schemas";
import { safeNext } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { parseHost } from "@/lib/site/hosts";
import { ADMIN_HOST_LABEL, adminOrigin } from "@/lib/site/admin-host";
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

/** The admin origin of this request: `admin.<root>` in production, the request's own host when unrouted. */
async function adminSiteOrigin(): Promise<string> {
  const h = await headers();
  const hostHeader = h.get("x-forwarded-host") ?? h.get("host");
  const host = (hostHeader ?? "").toLowerCase();
  const local = /^(localhost|127\.0\.0\.1|[\w-]+\.localhost)(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  const parsed = parseHost(hostHeader);
  return adminOrigin({ host, proto, root: parsed.kind === "unrouted" ? null : parsed.root, label: ADMIN_HOST_LABEL });
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
  const origin = await adminSiteOrigin();
  // On the admin host the callback is /auth/callback (the proxy rewrites it); elsewhere it is the path style.
  const callback = ADMIN_HOST_LABEL && origin.includes(`//${ADMIN_HOST_LABEL}.`) ? "/auth/callback" : "/admin/auth/callback";
  const emailRedirectTo = `${origin}${callback}${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  try {
    const supabase = await getServerClient();
    await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } });
  } catch {
    // Same answer either way: never reveal whether the address exists or the send failed.
  }
  return { ok: true, message: LINK_REPLY };
}

// A Google button goes here later: `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })`
// with the same admin-host `/auth/callback` redirect. Not built yet (docs/claude-planning/16-admin-console.md, "Sign-in").

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

  const extra = storyAndMedia(formData);
  if (extra.error) return { error: extra.error };
  Object.assign(row.data, extra.patch);

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

/**
 * The story and media a project form posts as JSON (`story`, `assets`). Absent fields mean "not on this form":
 * the stored values stay. An empty story or no assets removes the key. Both are checked with the record schemas.
 */
function storyAndMedia(formData: FormData): { error?: string; patch: Record<string, unknown>; drop: string[] } {
  const patch: Record<string, unknown> = {};
  const drop: string[] = [];
  const story = formData.get("story");
  if (typeof story === "string") {
    let raw: unknown;
    try {
      raw = story.trim() ? JSON.parse(story) : {};
    } catch {
      return { error: "Could not read the story.", patch, drop };
    }
    if (raw && typeof raw === "object" && Object.keys(raw).length) {
      const r = projectStorySchema.safeParse(raw);
      if (!r.success) return { error: `Story: ${r.error.issues[0]?.path.join(" > ") ? `${r.error.issues[0].path.join(" > ")}: ` : ""}${r.error.issues[0]?.message ?? "check it"}`, patch, drop };
      patch.story = r.data;
    } else drop.push("story");
  }
  const assets = formData.get("assets");
  if (typeof assets === "string") {
    if (assets.trim()) {
      let raw: unknown;
      try {
        raw = JSON.parse(assets);
      } catch {
        return { error: "Could not read the media.", patch, drop };
      }
      const r = projectMediaSchema.safeParse(raw);
      if (!r.success) return { error: `Media: ${r.error.issues[0]?.path.join(" > ") ? `${r.error.issues[0].path.join(" > ")}: ` : ""}${r.error.issues[0]?.message ?? "a poster is needed"}`, patch, drop };
      patch.media = r.data;
    } else drop.push("media");
  }
  return { patch, drop };
}

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

  const extra = storyAndMedia(formData);
  if (extra.error) return { error: extra.error };

  const supabase = await getServerClient();
  // Keep what this form does not edit (story and media, the Netflix trailer's fields) instead of replacing `data` wholesale.
  const { data: cur } = await supabase.from("entries").select("data").eq("id", id).eq("type", "project").maybeSingle();
  const merged: Record<string, unknown> = { ...((cur?.data as Record<string, unknown> | null) ?? {}), ...f.data, ...extra.patch };
  for (const k of extra.drop) delete merged[k];
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
  const { data, error } = await supabase.from("entries").update({ ...f, data: merged }).eq("id", id).eq("type", "project").select("id, slug").maybeSingle();
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

// ---- Skill groups (records: which projects, roles and certificates used each skill) ------------------------

/**
 * Save one skill group. `payload` is the JSON the form builds ({ group, items: [{ name, projects?, experience?,
 * certifications? }] }, each list holding record slugs in the order shown); it must satisfy the record's own
 * schema. `intent` is "draft" (private: the site does not read it) or "publish" (public). No id creates the group.
 */
export async function saveSkillGroup(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (!(await isAdmin())) return { error: "Not authorized." };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Could not read the form." };
  }
  const parsed = RECORD_SCHEMAS.skill_group.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ? `Check the form: ${parsed.error.issues[0].message}` : "Check the form." };
  const data = parsed.data;
  if (!data.group.trim()) return { error: "The group needs a name." };
  if (data.items.some((i) => !i.name.trim())) return { error: "Every skill needs a name." };
  const names = data.items.map((i) => i.name.trim().toLowerCase());
  if (new Set(names).size !== names.length) return { error: "A skill name appears twice." };
  const visibility: Visibility = formData.get("intent") === "publish" ? "public" : "private";
  const id = String(formData.get("id") ?? "").trim();
  const supabase = await getServerClient();

  let entryId = id;
  if (id) {
    const { error } = await supabase.from("entries").update({ title: data.group, visibility, data }).eq("id", id).eq("type", "skill_group");
    if (error) return { error: error.message };
  } else {
    const slug = `skills-${slugify(data.group)}`;
    const { data: last } = await supabase.from("entries").select("order").eq("persona_slug", "engineer").eq("type", "skill_group").order("order", { ascending: false }).limit(1).maybeSingle();
    const { data: row, error } = await supabase
      .from("entries")
      .insert({ persona_slug: "engineer", type: "skill_group", slug, title: data.group, visibility, order: Number(last?.order ?? 0) + 10, data })
      .select("id")
      .single();
    if (error) return { error: error.code === "23505" ? `A skill group "${slug}" already exists.` : error.message };
    entryId = row.id as string;
  }
  updateTag("entries:skill_group");
  revalidatePath("/engineer");
  revalidatePath("/admin/engineer/skills");
  return { ok: true, entryId, message: visibility === "public" ? "Published." : "Saved as a draft (the site keeps showing the last published version)." };
}

// ---- One entry point for the project editor -------------------------------------------------------------------

export type ProjectInput = {
  id?: string;
  title: string;
  summary: string;
  body: string;
  role: string;
  techStack: string[];
  deployedUrl: string;
  repoUrl: string;
  demoVideoUrl: string;
  visibility: string;
  featured: boolean;
  /** The cleaned story object ({} removes it) and media object (null removes it), checked here with the record schemas. */
  story: Record<string, unknown>;
  assets: Record<string, unknown> | null;
};

/**
 * Create or update a project from the editor's value (a plain action call, no form post). It builds the same
 * form data the older actions read and hands it to them, so the merge-not-replace rule (story, media and the
 * trailer's fields the form does not edit stay) and every validation stay in one place.
 */
export async function saveProject(input: ProjectInput): Promise<ActionState> {
  if (!(await isAdmin())) return { error: "Not authorized." };
  const fd = new FormData();
  if (input.id) fd.set("id", String(input.id));
  for (const k of ["title", "summary", "body", "role", "deployedUrl", "repoUrl", "demoVideoUrl", "visibility"] as const) fd.set(k, String(input[k] ?? ""));
  fd.set("techStack", (Array.isArray(input.techStack) ? input.techStack : []).map(String).join(", "));
  if (input.featured) fd.set("featured", "on");
  fd.set("story", JSON.stringify(input.story ?? {}));
  fd.set("assets", input.assets ? JSON.stringify(input.assets) : "");
  const r = await (input.id ? updateProject({}, fd) : createProject({}, fd));
  return r.ok ? { ...r, message: r.message ?? "Created." } : r;
}
