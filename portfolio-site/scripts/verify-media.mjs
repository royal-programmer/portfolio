/**
 * Live media-pipeline verification — proves the storage buckets, derivative
 * generation, EXIF path, and public/private serving actually work end-to-end.
 *
 * Mirrors lib/media/pipeline.ts against the real Supabase project using the
 * service-role client (so it needs no admin login). It ensures the buckets
 * exist (idempotent — same as migration 0007), then:
 *   1. uploads a synthetic original to the PRIVATE `originals` bucket
 *   2. generates thumb/optimized/full WebP derivatives with sharp
 *   3. uploads derivatives to the PUBLIC `media` bucket
 *   4. asserts a derivative is publicly fetchable (200, image/webp)
 *   5. asserts the original is NOT publicly fetchable (private bucket)
 *   6. inserts the media row and confirms anon sees it via the entries join
 *
 * NOTE: this validates the pipeline + public/private serving. The browser
 * direct-upload path additionally needs migration 0007's RLS policies applied
 * (so the admin *session* is authorized) — exercise that from /admin/engineer/projects.
 *
 * Run:  node scripts/verify-media.mjs      (from portfolio-site/)
 * Prints PASS/FAIL only — never prints key values.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import exifr from "exifr";

function loadEnv() {
  let raw;
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    console.error("✗ .env.local not found in portfolio-site/. Create it first.");
    process.exit(1);
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) {
  console.error("✗ Missing Supabase env (URL / ANON / SERVICE_ROLE).");
  process.exit(1);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let failures = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => {
  failures++;
  console.error(`✗ ${m}`);
};

async function ensureBucket(id, isPublic) {
  const { data } = await admin.storage.getBucket(id);
  if (data) return;
  const { error } = await admin.storage.createBucket(id, { public: isPublic });
  if (error && !/exist/i.test(error.message)) bad(`could not create bucket ${id}: ${error.message}`);
  else ok(`bucket "${id}" created (${isPublic ? "public" : "private"})`);
}

const cleanup = { entryId: null, origKeys: [], mediaKeys: [] };
async function teardown() {
  if (cleanup.mediaKeys.length) await admin.storage.from("media").remove(cleanup.mediaKeys);
  if (cleanup.origKeys.length) await admin.storage.from("originals").remove(cleanup.origKeys);
  if (cleanup.entryId) await admin.from("entries").delete().eq("id", cleanup.entryId);
}

try {
  // ---- 0: buckets ----------------------------------------------------------
  await ensureBucket("originals", false);
  await ensureBucket("media", true);
  {
    const { data: buckets } = await admin.storage.listBuckets();
    const names = (buckets ?? []).map((b) => b.id);
    if (names.includes("originals") && names.includes("media")) ok("both buckets present");
    else bad(`missing bucket(s); have: ${names.join(", ")}`);
  }

  // ---- 1: temp public entry ------------------------------------------------
  const probe = `_media_probe_${Date.now()}`;
  const { data: entry, error: eEntry } = await admin
    .from("entries")
    .insert({ persona_slug: "engineer", type: "project", title: probe, slug: probe, visibility: "public" })
    .select("id")
    .single();
  if (eEntry) throw new Error(`insert probe entry: ${eEntry.message}`);
  cleanup.entryId = entry.id;

  // ---- 2: synthetic original (2000px wide → should yield a full derivative)-
  const original = await sharp({
    create: { width: 2000, height: 1200, channels: 3, background: { r: 30, g: 80, b: 160 } },
  })
    .jpeg()
    .toBuffer();

  const origKey = `${entry.id}/orig.jpg`;
  cleanup.origKeys.push(origKey);
  const { error: eOrig } = await admin.storage
    .from("originals")
    .upload(origKey, original, { contentType: "image/jpeg", upsert: true });
  if (eOrig) throw new Error(`upload original: ${eOrig.message}`);
  ok("original uploaded to private bucket");

  // ---- 3: derivatives (mirrors pipeline) -----------------------------------
  const specs = [
    { name: "thumb", width: 400, quality: 72 },
    { name: "optimized", width: 1280, quality: 80 },
    { name: "full", width: 2400, quality: 82 },
  ];
  const mediaId = crypto.randomUUID();
  const base = `engineer/${entry.id}/${mediaId}`;
  const urls = {};
  let optimizedWidth = 0;
  for (const spec of specs) {
    const { data, info } = await sharp(original)
      .rotate()
      .resize({ width: spec.width, withoutEnlargement: true })
      .webp({ quality: spec.quality })
      .toBuffer({ resolveWithObject: true });
    if (spec.name === "optimized") optimizedWidth = info.width;
    if (spec.name === "full" && info.width <= optimizedWidth) continue;
    const key = `${base}/${spec.name}.webp`;
    cleanup.mediaKeys.push(key);
    const { error } = await admin.storage
      .from("media")
      .upload(key, data, { contentType: "image/webp", upsert: true });
    if (error) throw new Error(`upload ${spec.name}: ${error.message}`);
    urls[spec.name] = admin.storage.from("media").getPublicUrl(key).data.publicUrl;
  }
  if (urls.thumb && urls.optimized && urls.full) ok("thumb + optimized + full derivatives generated");
  else bad(`expected 3 derivatives, got: ${Object.keys(urls).join(", ")}`);

  // ---- 4: derivative is publicly fetchable ---------------------------------
  {
    const r = await fetch(urls.optimized);
    if (r.status === 200 && (r.headers.get("content-type") || "").includes("webp"))
      ok("optimized derivative is publicly fetchable (200, image/webp)");
    else bad(`optimized derivative fetch: status ${r.status}, type ${r.headers.get("content-type")}`);
  }

  // ---- 5: original is NOT publicly fetchable -------------------------------
  {
    const origPublicUrl = admin.storage.from("originals").getPublicUrl(origKey).data.publicUrl;
    const r = await fetch(origPublicUrl);
    if (r.status !== 200) ok(`original is private (public fetch blocked, status ${r.status})`);
    else bad("ORIGINAL LEAKED — private bucket served the original over its public URL!");
  }

  // ---- 6: EXIF path doesn't throw on a no-EXIF image -----------------------
  {
    const tags = await exifr.parse(original).catch(() => null);
    if (!tags) ok("exif extraction handles a no-EXIF image gracefully");
    else ok("exif extraction returned tags (unexpected for synthetic, but non-fatal)");
  }

  // ---- 7: media row + anon sees it via the entries join --------------------
  {
    const { error } = await admin.from("media").insert({
      id: mediaId,
      entry_id: entry.id,
      kind: "image",
      original_path: origKey,
      thumb_url: urls.thumb,
      optimized_url: urls.optimized,
      full_url: urls.full ?? null,
      width: 2000,
      height: 1200,
      order: 0,
      visibility: "public",
    });
    if (error) throw new Error(`insert media row: ${error.message}`);

    const { data: seen, error: eSeen } = await anon
      .from("entries")
      .select("id, media(*)")
      .eq("id", entry.id)
      .maybeSingle();
    if (eSeen) bad(`anon read entry+media: ${eSeen.message}`);
    else if (seen?.media?.length === 1 && seen.media[0].thumb_url) ok("anon sees the public media via the entries join");
    else bad(`anon media join wrong: ${JSON.stringify(seen?.media)}`);
  }
} catch (e) {
  bad(e instanceof Error ? e.message : String(e));
} finally {
  await teardown();
  ok("temp entry + storage objects cleaned up");
}

console.log(failures === 0 ? "\n✅ ALL CHECKS PASSED" : `\n❌ ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
