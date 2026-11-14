/**
 * The project form as data, plus the pure helpers the editor, the server action and the checks share: the
 * form's value, its clean (comparable) form, the story and media field lists, and the JSON import validator.
 * Pure (client-safe, no server imports).
 */
import { projectMediaSchema, projectStorySchema } from "@/lib/content/record-schemas";
import { cleanData, slugify, type RField } from "./record-forms";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

/** What the project form edits. `techStack` is the comma-separated text the field shows. */
export type ProjectValue = {
  title: string;
  summary: string;
  body: string;
  role: string;
  techStack: string;
  deployedUrl: string;
  repoUrl: string;
  demoVideoUrl: string;
  visibility: string;
  featured: boolean;
  story: Obj;
  assets: Obj;
};

export const BLANK_PROJECT: ProjectValue = { title: "", summary: "", body: "", role: "", techStack: "", deployedUrl: "", repoUrl: "", demoVideoUrl: "", visibility: "private", featured: false, story: {}, assets: {} };

export const PROJECT_STATUS = [
  { value: "", label: "Not set" },
  { value: "in-development", label: "In development" },
  { value: "live", label: "Live" },
  { value: "live-building", label: "Live, still building" },
];

export function storyFieldDefs(clips: Obj[]): RField[] {
  return [
    { kind: "long", key: "description", label: "What it is (one or two lines)" },
    { kind: "long", key: "audience", label: "Who it is for" },
    { kind: "long", key: "problem", label: "The problem it solves" },
    { kind: "select", key: "status", label: "Status", options: PROJECT_STATUS },
    {
      kind: "rows",
      key: "beats",
      label: "Beats (what it does, in order)",
      empty: { text: "", clip: "" },
      fields: [
        { kind: "long", key: "text", label: "Text", required: true },
        { kind: "select", key: "clip", label: "Clip to show", options: [{ value: "", label: "No clip" }, ...clips.filter((c) => c.id).map((c) => ({ value: String(c.id), label: String(c.label || c.id) }))] },
        { kind: "number", key: "clipMs", label: "Clip length (ms, 500 to 60000)", hint: "optional" },
      ],
    },
  ];
}

export const ASSET_FIELDS: RField[] = [
  {
    kind: "optobj",
    key: "poster",
    label: "Has a poster image",
    empty: { src: "", w: 1200, h: 675, alt: "" },
    fields: [
      { kind: "text", key: "src", label: "Image path", required: true, hint: "/projects/name/poster.jpg" },
      { kind: "number", key: "w", label: "Width", required: true },
      { kind: "number", key: "h", label: "Height", required: true },
      { kind: "text", key: "alt", label: "Describe it (alt text)", required: true },
    ],
  },
  {
    kind: "rows",
    key: "screens",
    label: "Screenshots",
    required: true,
    empty: { id: "", label: "", src: "", w: 1200, h: 675 },
    fields: [
      { kind: "text", key: "id", label: "Short id", required: true },
      { kind: "text", key: "label", label: "Caption", required: true },
      { kind: "text", key: "src", label: "Image path", required: true },
      { kind: "number", key: "w", label: "Width", required: true },
      { kind: "number", key: "h", label: "Height", required: true },
    ],
  },
  {
    kind: "rows",
    key: "clips",
    label: "Clips",
    required: true,
    empty: { id: "", label: "", poster: "", src: "" },
    fields: [
      { kind: "text", key: "id", label: "Short id", required: true },
      { kind: "text", key: "label", label: "Caption", required: true },
      { kind: "text", key: "poster", label: "Still image path", required: true },
      { kind: "text", key: "src", label: "Video path", required: true },
    ],
  },
];

/** The story and media as they are stored: empty parts removed, so "nothing" compares equal to "nothing". */
export function cleanExtras(story: Obj, assets: Obj): { story: Obj; assets: Obj | null } {
  const clips = (Array.isArray(assets.clips) ? assets.clips : []) as Obj[];
  const cs = cleanData(storyFieldDefs(clips), story);
  if (!cs.status) delete cs.status;
  if (Array.isArray(cs.beats)) cs.beats = (cs.beats as Obj[]).map((b) => (b.clip ? b : Object.fromEntries(Object.entries(b).filter(([k]) => k !== "clip"))));
  if (!cs.beats || !(cs.beats as unknown[]).length) delete cs.beats;
  const ca = cleanData(ASSET_FIELDS, assets);
  const has = Boolean(ca.poster) || (ca.screens as unknown[]).length > 0 || (ca.clips as unknown[]).length > 0;
  return { story: cs, assets: has ? ca : null };
}

/** The comparable form of a project value: what the diff table and the dirty check look at. */
export function cleanProject(v: ProjectValue): Obj {
  const x = cleanExtras(v.story, v.assets);
  return {
    title: v.title.trim(),
    summary: v.summary.trim(),
    body: v.body.trim(),
    role: v.role.trim(),
    techStack: v.techStack.split(",").map((s) => s.trim()).filter(Boolean),
    deployedUrl: v.deployedUrl.trim(),
    repoUrl: v.repoUrl.trim(),
    demoVideoUrl: v.demoVideoUrl.trim(),
    visibility: v.visibility,
    featured: v.featured,
    story: x.story,
    media: x.assets ?? {},
  };
}

/** Overlay a saved draft (possibly from an older shape) onto a value: unknown or mistyped keys are ignored. */
export function mergeProjectDraft(base: ProjectValue, draft: unknown): ProjectValue {
  if (!isObj(draft)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(base) as (keyof ProjectValue)[]) {
    const d = draft[k];
    if (d === undefined) continue;
    if (typeof base[k] === "string" && typeof d === "string") out[k] = d;
    else if (typeof base[k] === "boolean" && typeof d === "boolean") out[k] = d;
    else if (isObj(base[k]) && isObj(d)) out[k] = d;
  }
  return out as ProjectValue;
}

// ---- JSON import --------------------------------------------------------------------------------------------

export type ProjectImportRow = { slug: string; title: string; summary: string | null; body: string | null; featured: boolean; visibility: string; order?: number; data: Obj; action: "create" | "update" };
export type ProjectImportPlan = { ok: boolean; rows: ProjectImportRow[]; errors: { index: number; message: string }[]; summary: string };

const VIS = new Set(["public", "unlisted", "private"]);
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Check a pasted export of projects before anything is written (the dry run). Story and media use the same schemas as the form. */
export function validateProjectImport(text: string, existingSlugs: Iterable<string>): ProjectImportPlan {
  const have = new Set(existingSlugs);
  const fail = (message: string): ProjectImportPlan => ({ ok: false, rows: [], errors: [{ index: -1, message }], summary: message });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("That is not valid JSON.");
  }
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.rows) ? raw.rows : null;
  if (!list) return fail("Expected a list of projects (or an object with a rows list).");
  if (list.length > 100) return fail("Too many projects in one import (the limit is 100).");
  const rows: ProjectImportRow[] = [];
  const errors: ProjectImportPlan["errors"] = [];
  const seen = new Set<string>();
  list.forEach((item, index) => {
    const bad = (message: string) => void errors.push({ index, message });
    if (!isObj(item)) return bad("Not a project.");
    const title = str(item.title);
    if (!title) return bad("A project needs a title.");
    const slug = typeof item.slug === "string" && /^[a-z0-9][a-z0-9-]{0,118}$/.test(item.slug) ? item.slug : slugify(title);
    if (!slug) return bad("No slug could be made.");
    if (seen.has(slug)) return bad(`The slug "${slug}" appears twice.`);
    seen.add(slug);
    const d = isObj(item.data) ? item.data : {};
    const data: Obj = {};
    for (const k of ["role", "repoUrl", "deployedUrl", "demoVideoUrl"] as const) if (str(d[k])) data[k] = str(d[k]);
    if (d.techStack !== undefined) {
      if (!Array.isArray(d.techStack) || d.techStack.some((t) => typeof t !== "string")) return bad("techStack must be a list of words.");
      data.techStack = (d.techStack as string[]).map((t) => t.trim()).filter(Boolean);
    }
    if (isObj(d.story) && Object.keys(d.story).length) {
      const r = projectStorySchema.safeParse(d.story);
      if (!r.success) return bad(`story: ${r.error.issues[0]?.path.join(" > ") || "value"}: ${r.error.issues[0]?.message ?? "invalid"}`);
      data.story = r.data;
    }
    if (isObj(d.media) && Object.keys(d.media).length) {
      const r = projectMediaSchema.safeParse(d.media);
      if (!r.success) return bad(`media: ${r.error.issues[0]?.path.join(" > ") || "value"}: ${r.error.issues[0]?.message ?? "invalid"}`);
      data.media = r.data;
    }
    rows.push({
      slug,
      title,
      summary: str(item.summary) || null,
      body: str(item.body) || null,
      featured: item.featured === true,
      visibility: typeof item.visibility === "string" && VIS.has(item.visibility) ? item.visibility : "private",
      ...(typeof item.order === "number" ? { order: item.order } : {}),
      data,
      action: have.has(slug) ? "update" : "create",
    });
  });
  const create = rows.filter((r) => r.action === "create").length;
  const summary = `${create} to add, ${rows.length - create} to update, ${errors.length} with problems.${errors.length ? " Nothing is imported until every project is valid." : ""}`;
  return { ok: errors.length === 0 && rows.length > 0, rows, errors, summary };
}
