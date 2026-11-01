/**
 * Live Supabase verification — proves the schema + RLS actually work.
 *
 * Self-loads `.env.local` (so secrets stay out of the agent's context and out
 * of the shell), then checks:
 *   1. anon client sees ONLY published personas (RLS is_published filter) → 3
 *   2. service_role client bypasses RLS and sees ALL personas → 6
 *   3. anon cannot read a freshly-inserted private entry (RLS visibility gate)
 *
 * Run:  node scripts/verify-db.mjs      (from portfolio-site/)
 *
 * Prints PASS/FAIL only — never prints key values.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---- self-load .env.local --------------------------------------------------
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
  console.error("✗ Missing one of: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let failures = 0;
const ok = (msg) => console.log(`✓ ${msg}`);
const bad = (msg) => {
  failures++;
  console.error(`✗ ${msg}`);
};

// ---- 1 & 2: personas visibility -------------------------------------------
const { data: anonPersonas, error: e1 } = await anon.from("personas").select("slug,is_published");
if (e1) bad(`anon read personas errored: ${e1.message}`);
else {
  const slugs = anonPersonas.map((p) => p.slug).sort();
  if (anonPersonas.length === 3 && anonPersonas.every((p) => p.is_published)) {
    ok(`anon sees only published personas (${slugs.join(", ")})`);
  } else {
    bad(`anon should see 3 published personas, saw ${anonPersonas.length}: ${slugs.join(", ")}`);
  }
}

const { data: adminPersonas, error: e2 } = await admin.from("personas").select("slug");
if (e2) bad(`service_role read personas errored: ${e2.message}`);
else if (adminPersonas.length === 6) ok(`service_role sees all 6 personas (RLS bypassed)`);
else bad(`service_role should see 6 personas, saw ${adminPersonas.length}`);

// ---- 3: private entry is invisible to anon --------------------------------
const probe = `_verify_probe_${Date.now()}`;
const { data: inserted, error: e3 } = await admin
  .from("entries")
  .insert({ persona_slug: "engineer", type: "project", title: probe, slug: probe.replace(/_/g, "-"), visibility: "private" })
  .select("id")
  .single();

if (e3) {
  bad(`could not insert probe entry: ${e3.message}`);
} else {
  const { data: anonSees } = await anon.from("entries").select("id").eq("id", inserted.id);
  if (!anonSees || anonSees.length === 0) ok("anon cannot read a private entry (RLS visibility gate holds)");
  else bad("PRIVATE ENTRY LEAKED to anon — RLS visibility gate is broken!");
  // clean up the probe
  await admin.from("entries").delete().eq("id", inserted.id);
  ok("probe entry cleaned up");
}

console.log(failures === 0 ? "\n✅ ALL CHECKS PASSED" : `\n❌ ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
