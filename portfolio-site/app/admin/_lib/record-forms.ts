/**
 * What the admin's record forms are made of, as data: one field list per record type, plus the pure helpers
 * the form, the server action and the tests share (clean a form value, derive title/slug, diff, reorder,
 * validate an import). The validation itself is the record's own Zod schema (`lib/content/record-schemas.ts`):
 * the form never keeps a second set of rules. Pure (client-safe, no server imports).
 */
import { RECORD_SCHEMAS } from "@/lib/content/record-schemas";
import type { RecordType } from "@/lib/content/types";

// ---- field lists ------------------------------------------------------------------------------------------

type Base = { key: string; label: string; required?: boolean; hint?: string; placeholder?: string; /** Show only when a sibling field has this value. */ when?: [string, string] };
export type RField =
  | (Base & { kind: "text" | "long" | "url" | "date" | "month" | "number" })
  | (Base & { kind: "select"; options: { value: string; label: string }[] })
  | (Base & { kind: "check" })
  | (Base & { kind: "period" })
  | (Base & { kind: "datenull" })
  | (Base & { kind: "bullets"; long?: boolean })
  | (Base & { kind: "optobj"; fields: RField[]; empty: Record<string, unknown> })
  | (Base & { kind: "rows"; fields: RField[]; empty: Record<string, unknown>; tuple?: boolean });

export type RecordForm = { type: RecordType; label: string; singular: string; fields: RField[]; blank: Record<string, unknown> };

const BRANCHES = [
  { value: "main", label: "Main (career)" },
  { value: "side", label: "Side project" },
  { value: "learn", label: "Learning" },
  { value: "life", label: "Life" },
];
const eventFields: RField[] = [
  { kind: "date", key: "date", label: "Date", required: true, hint: "YYYY-MM or YYYY-MM-DD" },
  { kind: "text", key: "subject", label: "What happened", required: true },
  { kind: "select", key: "branch", label: "Branch", required: true, options: BRANCHES },
  { kind: "bullets", key: "body", label: "Details", long: true },
  { kind: "text", key: "tag", label: "Tag", placeholder: "v2.0" },
  { kind: "text", key: "grade", label: "Grade" },
];

export const RECORD_FORMS: Record<Exclude<RecordType, "skill_group">, RecordForm> = {
  experience: {
    type: "experience",
    label: "Experience",
    singular: "role",
    blank: { company: "", role: "", period: { start: "", end: "present" }, headline: "", bullets: [] },
    fields: [
      { kind: "text", key: "company", label: "Company", required: true },
      { kind: "text", key: "role", label: "Role", required: true },
      { kind: "period", key: "period", label: "Period", required: true },
      { kind: "long", key: "headline", label: "Headline", required: true },
      { kind: "bullets", key: "bullets", label: "Bullets", required: true, long: true },
    ],
  },
  certification: {
    type: "certification",
    label: "Certifications",
    singular: "certificate",
    blank: { issuer: "", line: "" },
    fields: [
      { kind: "text", key: "issuer", label: "Issuer", required: true },
      { kind: "long", key: "line", label: "What it says", required: true },
      { kind: "bullets", key: "items", label: "Items covered" },
      { kind: "url", key: "verify", label: "Verify link", hint: "a public page that proves it" },
    ],
  },
  education: {
    type: "education",
    label: "Education",
    singular: "school",
    blank: { degree: "", school: "", period: { start: "", end: "" } },
    fields: [
      { kind: "text", key: "degree", label: "Degree", required: true },
      { kind: "text", key: "school", label: "School", required: true },
      { kind: "period", key: "period", label: "Period", required: true },
      { kind: "text", key: "note", label: "Note" },
    ],
  },
  timeline_event: { type: "timeline_event", label: "Timeline events", singular: "event", blank: { date: "", subject: "", branch: "main" }, fields: eventFields },
  milestone: {
    type: "milestone",
    label: "Milestones",
    singular: "milestone",
    blank: { kind: "event", date: "", subject: "", branch: "life" },
    fields: [
      { kind: "select", key: "kind", label: "Kind", required: true, options: [{ value: "event", label: "A moment" }, { value: "period", label: "A stretch of time" }] },
      ...eventFields.map((f) => ({ ...f, when: ["kind", "event"] }) as RField),
      { kind: "text", key: "label", label: "Label", required: true, when: ["kind", "period"] },
      { kind: "date", key: "from", label: "From", required: true, when: ["kind", "period"], hint: "YYYY-MM" },
      { kind: "datenull", key: "to", label: "To", required: true, when: ["kind", "period"] },
      { kind: "text", key: "grade", label: "Grade", when: ["kind", "period"] },
      { kind: "text", key: "note", label: "Note", when: ["kind", "period"] },
    ],
  },
  diagram: {
    type: "diagram",
    label: "Architecture diagrams",
    singular: "diagram",
    blank: { title: "", nodes: [], edges: [], notes: [], projects: [] },
    fields: [
      { kind: "text", key: "title", label: "Title", required: true },
      { kind: "text", key: "line", label: "One line" },
      {
        kind: "rows",
        key: "nodes",
        label: "Boxes",
        required: true,
        empty: { id: "", label: "", kind: "api" },
        fields: [
          { kind: "text", key: "id", label: "Short id", required: true },
          { kind: "text", key: "label", label: "Label", required: true },
          { kind: "select", key: "kind", label: "Kind", required: true, options: ["ui", "api", "db", "queue", "ext", "job"].map((v) => ({ value: v, label: v })) },
        ],
      },
      {
        kind: "rows",
        key: "edges",
        label: "Arrows",
        required: true,
        tuple: true,
        empty: ["", "", ""] as unknown as Record<string, unknown>,
        fields: [
          { kind: "text", key: "0", label: "From (id)", required: true },
          { kind: "text", key: "1", label: "To (id)", required: true },
          { kind: "text", key: "2", label: "Label" },
        ],
      },
      { kind: "bullets", key: "notes", label: "Notes", required: true, long: true },
      { kind: "bullets", key: "projects", label: "Projects it describes (slugs)", required: true },
    ],
  },
  profile_link: {
    type: "profile_link",
    label: "Profile links",
    singular: "link",
    blank: { label: "", handle: "", group: "code" },
    fields: [
      { kind: "text", key: "label", label: "Label", required: true },
      { kind: "text", key: "handle", label: "Handle", required: true },
      { kind: "url", key: "href", label: "Link" },
      { kind: "select", key: "group", label: "Group", required: true, options: ["code", "learn", "work", "social"].map((v) => ({ value: v, label: v })) },
      { kind: "select", key: "live", label: "Live count from", options: [{ value: "", label: "none" }, ...["github", "stackoverflow", "leetcode", "holopin", "hackerrank"].map((v) => ({ value: v, label: v }))] },
      { kind: "text", key: "note", label: "Note" },
      { kind: "check", key: "optional", label: "Optional (can be left out of short lists)" },
      {
        kind: "optobj",
        key: "contact",
        label: "Show in the contact list",
        empty: { label: "", rank: 50 },
        fields: [
          { kind: "text", key: "label", label: "Contact label", required: true },
          { kind: "number", key: "rank", label: "Rank (0 first)", required: true },
          { kind: "select", key: "group", label: "Placed under", options: [{ value: "", label: "the main list" }, { value: "elsewhere", label: "Elsewhere" }] },
        ],
      },
    ],
  },
};

export const RECORD_FORM_TYPES = Object.keys(RECORD_FORMS) as (keyof typeof RECORD_FORMS)[];

// ---- cleaning a form value --------------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function visible(f: RField, value: Record<string, unknown>) {
  return !f.when || value[f.when[0]] === f.when[1];
}

/** Turn what the form holds into what the schema expects: trim text, drop empty optional fields and hidden ones. */
export function cleanData(fields: RField[], value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (!visible(f, value)) continue;
    const v = value[f.key];
    switch (f.kind) {
      case "bullets": {
        const list = (Array.isArray(v) ? v : []).map((s) => String(s).trim()).filter(Boolean);
        if (list.length || f.required) out[f.key] = list;
        break;
      }
      case "rows": {
        const rows = (Array.isArray(v) ? v : []).map((r) => {
          if (f.tuple) {
            const t = (Array.isArray(r) ? r : []).map((s) => String(s ?? "").trim());
            return t[2] ? t.slice(0, 3) : t.slice(0, 2);
          }
          return cleanData(f.fields, isObj(r) ? r : {});
        });
        if (rows.length || f.required) out[f.key] = rows;
        break;
      }
      case "optobj":
        if (isObj(v)) out[f.key] = cleanData(f.fields, v);
        break;
      case "period": {
        const p = isObj(v) ? v : {};
        out[f.key] = { start: String(p.start ?? "").trim(), end: String(p.end ?? "").trim() };
        break;
      }
      case "datenull":
        out[f.key] = v === null || v === "" || v === undefined ? null : String(v).trim();
        break;
      case "check":
        if (v === true) out[f.key] = true;
        break;
      case "number": {
        const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
        if (String(v ?? "").trim() !== "" && Number.isFinite(n)) out[f.key] = n;
        else if (f.required) out[f.key] = 0;
        break;
      }
      default: {
        const s = String(v ?? "").trim();
        if (s || f.required) out[f.key] = s;
      }
    }
  }
  return out;
}

/** The first few problems the record's schema finds, as plain sentences. */
export function checkRecord(type: RecordType, data: unknown): string[] {
  const r = RECORD_SCHEMAS[type].safeParse(data);
  if (r.success) return [];
  return r.error.issues.slice(0, 4).map((i) => `${i.path.length ? `${i.path.join(" > ")}: ` : ""}${i.message}`);
}

// ---- title, slug, date ------------------------------------------------------------------------------------

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const g = (d: Record<string, unknown>, k: string) => String(d[k] ?? "");
const fullDate = (d: string) => (/^\d{4}-\d{2}(-\d{2})?$/.test(d) ? `${d.length === 7 ? `${d}-01` : d}T00:00:00Z` : undefined);

/** The row columns a record derives from its data (the same naming the importer uses). */
export function recordMeta(type: RecordType, d: Record<string, unknown>): { title: string; summary?: string; slug: string; occurredAt?: string } {
  const period = isObj(d.period) ? d.period : {};
  switch (type) {
    case "experience":
      return { title: `${g(d, "role")} · ${g(d, "company")}`, slug: `experience-${slugify(g(d, "company").split(" (")[0])}`, occurredAt: fullDate(g(period, "start")) };
    case "education":
      return { title: `${g(d, "degree")} · ${g(d, "school")}`, slug: `education-${slugify(g(d, "degree").split(",")[0])}`, occurredAt: fullDate(g(period, "start")) };
    case "certification":
      return { title: g(d, "issuer"), summary: g(d, "line") || undefined, slug: `certification-${slugify(g(d, "issuer"))}` };
    case "timeline_event":
      return { title: g(d, "subject"), slug: `timeline-${g(d, "date")}-${slugify(g(d, "subject")).slice(0, 36).replace(/-$/, "")}`, occurredAt: fullDate(g(d, "date")) };
    case "milestone":
      return d.kind === "period"
        ? { title: g(d, "label"), slug: `period-${slugify(g(d, "label"))}`, occurredAt: fullDate(g(d, "from")) }
        : { title: g(d, "subject"), slug: `milestone-${g(d, "date")}-${slugify(g(d, "subject")).slice(0, 36).replace(/-$/, "")}`, occurredAt: fullDate(g(d, "date")) };
    case "diagram":
      return { title: g(d, "title"), summary: g(d, "line") || undefined, slug: `diagram-${slugify(g(d, "title"))}` };
    case "profile_link":
      return { title: g(d, "label"), slug: `link-${slugify(g(d, "label"))}` };
    default:
      return { title: g(d, "group"), slug: `${type}-${slugify(g(d, "group"))}` };
  }
}

/** A slug not in `taken`: the base, then `-2`, `-3`, … */
export function freeSlug(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  if (!set.has(base)) return base;
  for (let n = 2; ; n++) if (!set.has(`${base}-${n}`)) return `${base}-${n}`;
}

// ---- diff ---------------------------------------------------------------------------------------------------

export type DiffRow = { path: string; before: string; after: string };
const show = (v: unknown): string => (v === undefined ? "(empty)" : v === null ? "(none)" : typeof v === "string" ? (v === "" ? "(empty)" : v) : JSON.stringify(v));

/** Every leaf that differs between two values, with a readable path ("period.end", "bullets[2]"). */
export function diffValues(before: unknown, after: unknown, path = ""): DiffRow[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (Array.isArray(before) || Array.isArray(after)) {
    const a = Array.isArray(before) ? before : [];
    const b = Array.isArray(after) ? after : [];
    const out: DiffRow[] = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const p = `${path}[${i}]`;
      const x = a[i];
      const y = b[i];
      if (isObj(x) && isObj(y)) out.push(...diffValues(x, y, p));
      else if (JSON.stringify(x) !== JSON.stringify(y)) out.push({ path: p, before: i < a.length ? show(x) : "(not there)", after: i < b.length ? show(y) : "(removed)" });
    }
    return out;
  }
  if (isObj(before) || isObj(after)) {
    const a = isObj(before) ? before : {};
    const b = isObj(after) ? after : {};
    const out: DiffRow[] = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) out.push(...diffValues(a[k], b[k], path ? `${path}.${k}` : k));
    return out;
  }
  return [{ path: path || "value", before: show(before), after: show(after) }];
}

// ---- reorder ------------------------------------------------------------------------------------------------

/** Move one item (up/down buttons on a phone, drag on a desktop both end here). Out-of-range returns the list unchanged. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const out = [...list];
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

/** New `order` values for ids in the shown sequence: steps of 10, so a later insert has room. */
export const orderValues = (ids: readonly string[]): { id: string; order: number }[] => ids.map((id, i) => ({ id, order: i * 10 }));

// ---- JSON export and import ---------------------------------------------------------------------------------

export type ExportRow = { slug: string; visibility: string; order: number; data: unknown };

export type ImportPlan = {
  ok: boolean;
  rows: { slug: string; visibility: string; order?: number; data: Record<string, unknown>; action: "create" | "update" }[];
  errors: { index: number; message: string }[];
  summary: string;
};

/** Check a pasted or uploaded export file before anything is written: the dry-run the admin shows first. */
export function validateImport(type: RecordType, text: string, existingSlugs: Iterable<string>): ImportPlan {
  const have = new Set(existingSlugs);
  const fail = (message: string): ImportPlan => ({ ok: false, rows: [], errors: [{ index: -1, message }], summary: message });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("That is not valid JSON.");
  }
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.rows) ? raw.rows : null;
  if (!list) return fail("Expected a list of records (or an object with a rows list).");
  if (list.length > 200) return fail("Too many records in one import (the limit is 200).");
  const rows: ImportPlan["rows"] = [];
  const errors: ImportPlan["errors"] = [];
  const seen = new Set<string>();
  list.forEach((item, index) => {
    if (!isObj(item)) return void errors.push({ index, message: "Not a record." });
    const parsed = RECORD_SCHEMAS[type].safeParse(item.data);
    if (!parsed.success) {
      const i = parsed.error.issues[0];
      return void errors.push({ index, message: `${i?.path.join(" > ") || "data"}: ${i?.message ?? "invalid"}` });
    }
    const data = parsed.data as Record<string, unknown>;
    const slug = typeof item.slug === "string" && /^[a-z0-9][a-z0-9-]{0,118}$/.test(item.slug) ? item.slug : recordMeta(type, data).slug;
    if (!slug) return void errors.push({ index, message: "No slug could be made." });
    if (seen.has(slug)) return void errors.push({ index, message: `The slug "${slug}" appears twice.` });
    seen.add(slug);
    const visibility = item.visibility === "public" || item.visibility === "unlisted" || item.visibility === "private" ? item.visibility : "private";
    rows.push({ slug, visibility, ...(typeof item.order === "number" ? { order: item.order } : {}), data, action: have.has(slug) ? "update" : "create" });
  });
  const create = rows.filter((r) => r.action === "create").length;
  const update = rows.length - create;
  const summary = `${create} to add, ${update} to update, ${errors.length} with problems.${errors.length ? " Nothing is imported until every record is valid." : ""}`;
  return { ok: errors.length === 0 && rows.length > 0, rows, errors, summary };
}
