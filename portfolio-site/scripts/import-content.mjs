/**
 * Import the engineer's records into the database (round 24). Run from portfolio-site/:
 *
 *   node scripts/import-content.mjs              dry run: validates everything, prints the counts per type
 *                                                (and, when .env.local has the keys, what already exists)
 *   node scripts/import-content.mjs --apply      writes what is missing (public visibility)
 *   node scripts/import-content.mjs --apply --overwrite   also replaces rows that already exist
 *
 * Reads the frozen copy (lib/site/legacy-content.ts, through lib/content/records-seed.ts) once. Idempotent: each
 * record has a stable slug and is upserted by (persona_slug, slug); a re-run changes nothing unless --overwrite.
 * Project story and media are merged into the EXISTING project row's data (a project that is not there is
 * reported and skipped, never created). Settings (engineer.resume header, engineer.hiring, engineer.clock) are
 * written only when the key has no row; `netflix` only gains its `bookCall`. Needs migration 0012 applied first
 * (new enum values). Service role from .env.local; secrets are never printed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": root }, interopDefault: true });
const load = (p) => jiti.import(path.join(root, p));

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const overwrite = args.has("--overwrite");

// ---- env (no dependency: a plain KEY=VALUE reader) ----------------------------------------------------
function readEnv() {
  const env = { ...process.env };
  for (const f of [".env.local", ".env"]) {
    const file = path.join(root, f);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

const { buildSeed } = await load("lib/content/records-seed.ts");
const { RECORD_SCHEMAS, projectStorySchema, projectMediaSchema } = await load("lib/content/record-schemas.ts");
const { SCHEMAS } = await load("lib/settings/schema.ts");
const seed = buildSeed();

// ---- validate before anything else --------------------------------------------------------------------
const problems = [];
for (const r of seed.rows) {
  const res = RECORD_SCHEMAS[r.type].safeParse(r.data);
  if (!res.success) problems.push(`${r.type} ${r.slug}: ${res.error.issues.slice(0, 2).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
}
for (const p of seed.projectPatches) {
  if (p.story && !projectStorySchema.safeParse(p.story).success) problems.push(`project ${p.slug}: story`);
  if (p.media && !projectMediaSchema.safeParse(p.media).success) problems.push(`project ${p.slug}: media`);
}
for (const [k, v] of Object.entries(seed.settings)) if (!SCHEMAS[k].safeParse(v).success) problems.push(`setting ${k}`);
if (problems.length) {
  console.error(`Seed does not validate (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

const counts = {};
for (const r of seed.rows) counts[r.type] = (counts[r.type] ?? 0) + 1;
const line = (k, v) => console.log(`  ${k.padEnd(28)}${v}`);
console.log(`${apply ? "APPLY" : "DRY RUN"}${overwrite ? " (overwrite)" : ""}: engineer records, all validated`);
for (const [t, n] of Object.entries(counts)) line(t, `${n} records`);
line("total records", `${seed.rows.length}`);
line("project story + media", `${seed.projectPatches.length} project(s): ${seed.projectPatches.map((p) => p.slug).join(", ")}`);
line("settings", `${Object.keys(seed.settings).join(", ")} (only if no row) + netflix.bookCall (merged)`);

// ---- database -----------------------------------------------------------------------------------------
const env = readEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log(apply ? "\nNo NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local: cannot write." : "\nNo Supabase keys in .env.local: dry run stops here (offline counts above).");
  process.exit(apply ? 1 : 0);
}
const { createClient } = require("@supabase/supabase-js");
const db = createClient(url, key, { auth: { persistSession: false } });

const existing = await db.from("entries").select("slug, type, data").eq("persona_slug", "engineer");
if (existing.error) {
  console.error(`
Cannot read entries: ${existing.error.message}${apply ? "" : " (dry run: the offline counts above stand)"}`);
  process.exit(apply ? 1 : 0);
}
const have = new Map(existing.data.map((r) => [r.slug, r]));
const fresh = seed.rows.filter((r) => !have.has(r.slug));
const present = seed.rows.length - fresh.length;
line("already in the database", `${present} of ${seed.rows.length} records${overwrite ? " (will be replaced)" : " (left alone)"}`);
line("new", `${fresh.length}`);
const settingRows = await db.from("site_settings").select("key, draft, live").in("key", [...Object.keys(seed.settings), "netflix"]);
if (settingRows.error) line("settings table", `not readable: ${settingRows.error.message}`);
const haveKey = new Map((settingRows.data ?? []).map((r) => [r.key, r]));

if (!apply) {
  console.log("\nDry run only. Nothing was written. Apply migration 0012 first, then re-run with --apply.");
  process.exit(0);
}

// ---- apply --------------------------------------------------------------------------------------------
let wrote = 0;
const todo = overwrite ? seed.rows : fresh;
for (let i = 0; i < todo.length; i += 25) {
  const batch = todo.slice(i, i + 25);
  const { error } = await db.from("entries").upsert(batch, { onConflict: "persona_slug,slug" });
  if (error) {
    console.error(`\nWrite failed: ${error.message}${/enum/i.test(error.message) ? "\nMigration 0012 (new entry_type values) is not applied yet." : ""}`);
    process.exit(1);
  }
  wrote += batch.length;
}
line("records written", `${wrote}`);

for (const p of seed.projectPatches) {
  const row = have.get(p.slug);
  if (!row || row.type !== "project") {
    line(`project ${p.slug}`, "no such project: skipped (create it in the admin, then re-run)");
    continue;
  }
  const data = { ...(row.data ?? {}) };
  const next = { ...data, ...(p.story && (overwrite || !data.story) ? { story: p.story } : {}), ...(p.media && (overwrite || !data.media) ? { media: p.media } : {}) };
  if (JSON.stringify(next) === JSON.stringify(data)) {
    line(`project ${p.slug}`, "already has story and media");
    continue;
  }
  const { error } = await db.from("entries").update({ data: next }).eq("persona_slug", "engineer").eq("slug", p.slug);
  line(`project ${p.slug}`, error ? `FAILED: ${error.message}` : "story and media merged");
}

async function writeSetting(k, value, before) {
  const row = { key: k, draft: value, live: value };
  const { error } = await db.from("site_settings").upsert(row, { onConflict: "key" });
  if (error) return line(`setting ${k}`, `FAILED: ${error.message}`);
  await db.from("settings_history").insert({ key: k, action: "publish", before: before ?? null, after: value });
  line(`setting ${k}`, before ? "bookCall merged" : "written");
}
for (const [k, v] of Object.entries(seed.settings)) {
  if (haveKey.has(k) && !overwrite) line(`setting ${k}`, "already set: left alone");
  else await writeSetting(k, v, haveKey.get(k)?.live);
}
// netflix: only add bookCall to what is there; with no row, start from the code defaults.
{
  const row = haveKey.get("netflix");
  const { DEFAULTS } = await load("lib/settings/defaults.ts");
  const withBook = (v) => (v && v.bookCall && !overwrite ? v : { ...(v ?? DEFAULTS.netflix), bookCall: seed.bookCall });
  const live = withBook(row?.live);
  if (row && live === row.live) line("setting netflix", "bookCall already set");
  else {
    const draft = withBook(row?.draft);
    const { error } = await db.from("site_settings").upsert({ key: "netflix", draft, live }, { onConflict: "key" });
    line("setting netflix", error ? `FAILED: ${error.message}` : "bookCall merged");
  }
}
console.log("\nDone. Flip CONTENT_SOURCE=db (Vercel env and .env.local) after checking the site with it.");
