/**
 * Admin smoke test against the REAL database, signed in (round 33 G3).
 *
 * What it does, from portfolio-site/ with the dev server running:
 *   1. Reads ADMIN_TEST_EMAIL, SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL from .env.local (nothing else).
 *   2. Asks Supabase's admin API for a one-time magic-link token for that email (`generateLink`), and opens
 *      the app's own /auth/callback with it in Playwright, so the browser holds a normal admin session.
 *   3. Walks every admin screen at 1280 and 393 wide.
 *   4. In each collection creates a record named `zz-smoke...`, edits it (checking the "What will change" table),
 *      hides it with Undo, and deletes it forever. Projects and records also go through JSON import.
 *   5. Edits a settings key, checks History shows it and that Revert works, then puts the original back.
 *   6. Prints a pass/fail table. Everything it created is deleted at the end, also when it fails or you press Ctrl+C.
 *
 * ADMIN_TEST_EMAIL must be the email of an existing admin (a row in `admins`). Put it in .env.local.
 *
 * Run:    node scripts/admin-smoke.mjs                      (default base http://admin.ratulroy.localhost:3000)
 *         node scripts/admin-smoke.mjs --base http://localhost:3000
 *         node scripts/admin-smoke.mjs --self-test          (pure parts only, no network, no browser)
 *         node scripts/admin-smoke.mjs --headed             (watch it)
 *
 * Refuses to run when NODE_ENV=production, when a NEXT_PUBLIC_SUPABASE_URL set in the shell differs from the one in
 * .env.local, or when the base URL is not a local address. Never prints keys, links or tokens.
 */
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const MARK = "zz-smoke";

// ---- pure parts (run by --self-test) ---------------------------------------------------------------------------
export function parseEnvFile(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

/** Why the run must not start, or null when it may. `shellEnv` is process.env, `fileEnv` the parsed .env.local. */
export function refuseReason(shellEnv, fileEnv, base) {
  if (shellEnv.NODE_ENV === "production") return "NODE_ENV is production.";
  if (!fileEnv.NEXT_PUBLIC_SUPABASE_URL) return "NEXT_PUBLIC_SUPABASE_URL is missing from .env.local.";
  if (shellEnv.NEXT_PUBLIC_SUPABASE_URL && shellEnv.NEXT_PUBLIC_SUPABASE_URL !== fileEnv.NEXT_PUBLIC_SUPABASE_URL) return "The shell's NEXT_PUBLIC_SUPABASE_URL is not the one in .env.local.";
  if (!fileEnv.SUPABASE_SERVICE_ROLE_KEY) return "SUPABASE_SERVICE_ROLE_KEY is missing from .env.local.";
  if (!fileEnv.ADMIN_TEST_EMAIL || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fileEnv.ADMIN_TEST_EMAIL)) return "ADMIN_TEST_EMAIL is missing or not an email in .env.local.";
  let host;
  try {
    host = new URL(base).hostname;
  } catch {
    return "The base URL is not a URL.";
  }
  if (!(host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost"))) return "The base URL is not a local address; this script only runs against a local dev server.";
  return null;
}

/** The path of an admin page for the base: clean on the admin host, `/admin/...` elsewhere. */
export function adminPath(base, p) {
  const onAdminHost = new URL(base).hostname.startsWith("admin.");
  if (onAdminHost) return p === "/admin" ? "/" : p.replace(/^\/admin/, "") || "/";
  return p;
}

export const callbackPath = (base, hashed) => adminPath(base, "/admin/auth/callback") + `?token_hash=${encodeURIComponent(hashed)}&type=magiclink`;

/** One record import body per type, from a sample row (the slug is ours, so cleanup can find it). */
export function importBody(sample, type) {
  return JSON.stringify([{ slug: `${MARK}-${type}`, visibility: "private", data: sample }]);
}

export function renderTable(rows) {
  const w = Math.max(10, ...rows.map((r) => r.name.length));
  const line = (a, b, c) => `${a.padEnd(w)}  ${b.padEnd(5)}  ${c}`;
  return [line("check", "", "note"), ...rows.map((r) => line(r.name, r.ok ? "PASS" : "FAIL", r.note ?? ""))].join("\n");
}

if (flag("--self-test")) {
  assert.equal(refuseReason({ NODE_ENV: "production" }, {}, "http://localhost:3000"), "NODE_ENV is production.");
  const file = { NEXT_PUBLIC_SUPABASE_URL: "https://a.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", ADMIN_TEST_EMAIL: "me@example.com" };
  assert.equal(refuseReason({}, file, "http://admin.ratulroy.localhost:3000"), null);
  assert.match(refuseReason({ NEXT_PUBLIC_SUPABASE_URL: "https://b.supabase.co" }, file, "http://localhost:3000"), /not the one in \.env\.local/);
  assert.match(refuseReason({}, file, "https://ratulroy.me"), /not a local address/);
  assert.match(refuseReason({}, { ...file, ADMIN_TEST_EMAIL: "" }, "http://localhost:3000"), /ADMIN_TEST_EMAIL/);
  assert.match(refuseReason({}, { ...file, SUPABASE_SERVICE_ROLE_KEY: "" }, "http://localhost:3000"), /SERVICE_ROLE/);
  assert.deepEqual(parseEnvFile('A=1\n# c\nB="x y"\nbad line\n'), { A: "1", B: "x y" });
  assert.equal(adminPath("http://admin.ratulroy.localhost:3000", "/admin"), "/");
  assert.equal(adminPath("http://admin.ratulroy.localhost:3000", "/admin/engineer/projects"), "/engineer/projects");
  assert.equal(adminPath("http://localhost:3000", "/admin/engineer/projects"), "/admin/engineer/projects");
  assert.equal(callbackPath("http://admin.ratulroy.localhost:3000", "abc"), "/auth/callback?token_hash=abc&type=magiclink");
  assert.equal(callbackPath("http://localhost:3000", "a b"), "/admin/auth/callback?token_hash=a%20b&type=magiclink");
  assert.equal(JSON.parse(importBody({ a: 1 }, "experience"))[0].slug, "zz-smoke-experience");
  assert.match(renderTable([{ name: "x", ok: true }, { name: "y", ok: false, note: "boom" }]), /FAIL\s+boom/);
  console.log("admin-smoke self-test: pure parts ok (no network, no browser)");
  process.exit(0);
}

// ---- real run ------------------------------------------------------------------------------------------------
const base = (opt("--base", "http://admin.ratulroy.localhost:3000") ?? "").replace(/\/+$/, "");
let fileEnv = {};
try {
  fileEnv = parseEnvFile(readFileSync(path.join(root, ".env.local"), "utf8"));
} catch {
  console.error("Refusing to run: .env.local not found in portfolio-site/.");
  process.exit(1);
}
const refuse = refuseReason(process.env, fileEnv, base);
if (refuse) {
  console.error(`Refusing to run: ${refuse}`);
  process.exit(1);
}

const require = createRequire(import.meta.url);
const { createClient } = require("@supabase/supabase-js");
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": root }, interopDefault: true });

function loadPlaywright() {
  const tries = [];
  try {
    const g = execSync("npm root -g", { encoding: "utf8" }).trim();
    tries.push(path.join(g, "playwright"), path.join(g, "@playwright", "mcp", "node_modules", "playwright"), path.join(g, "playwright-core"));
  } catch {
    /* no npm on PATH */
  }
  if (process.env.PLAYWRIGHT_PATH) tries.unshift(process.env.PLAYWRIGHT_PATH);
  for (const t of tries) {
    try {
      return require(t);
    } catch {
      /* try the next */
    }
  }
  console.error("Playwright not found. Install it globally (npm i -g playwright) or set PLAYWRIGHT_PATH to its folder.");
  process.exit(1);
}

const sb = createClient(fileEnv.NEXT_PUBLIC_SUPABASE_URL, fileEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const results = [];
const record = (name, ok, note) => {
  results.push({ name, ok, note: ok ? note : String(note ?? "failed").replace(/\s+/g, " ").slice(0, 160) });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && note ? `  ${String(note).split("\n")[0].slice(0, 120)}` : ""}`);
};
const check = async (name, fn) => {
  try {
    const note = await fn();
    record(name, true, typeof note === "string" ? note : "");
  } catch (e) {
    record(name, false, e instanceof Error ? e.message : e);
  }
};

// What existed before, so cleanup removes only what this run made.
const snapshot = { drafts: new Set(), historyMax: 0, setting: null };
async function takeSnapshot() {
  const { data: d } = await sb.from("admin_drafts").select("key");
  for (const r of d ?? []) snapshot.drafts.add(r.key);
  const { data: h } = await sb.from("settings_history").select("id").order("id", { ascending: false }).limit(1);
  snapshot.historyMax = h?.[0]?.id ?? 0;
  const { data: s } = await sb.from("site_settings").select("key, draft, live, updated_by, updated_at").eq("key", "identity").maybeSingle();
  snapshot.setting = s ?? null;
}

let cleaned = false;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  const steps = [
    ["entries", () => sb.from("entries").delete().like("slug", `${MARK}%`)],
    ["posts", () => sb.from("blog_posts").delete().like("slug", `${MARK}%`)],
    ["drafts", async () => {
      const { data } = await sb.from("admin_drafts").select("key");
      const mine = (data ?? []).map((r) => r.key).filter((k) => !snapshot.drafts.has(k));
      return mine.length ? sb.from("admin_drafts").delete().in("key", mine) : { error: null };
    }],
    ["history", () => sb.from("settings_history").delete().gt("id", snapshot.historyMax)],
    ["setting", async () => {
      if (snapshot.setting) return sb.from("site_settings").update({ draft: snapshot.setting.draft, live: snapshot.setting.live }).eq("key", "identity");
      return sb.from("site_settings").delete().eq("key", "identity");
    }],
  ];
  for (const [name, run] of steps) {
    try {
      const { error } = (await run()) ?? {};
      if (error && !/does not exist|could not find the table/i.test(error.message ?? "")) console.error(`cleanup ${name}: ${error.message}`);
    } catch (e) {
      console.error(`cleanup ${name}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }
  const { count } = await sb.from("entries").select("id", { count: "exact", head: true }).like("slug", `${MARK}%`);
  console.log(`cleanup done; ${count ?? 0} zz-smoke entries left`);
}
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => void cleanup().finally(() => process.exit(130)));

async function main() {
  await takeSnapshot();
  const { chromium } = loadPlaywright();
  // Use the bundled Chromium when it is installed; otherwise fall back to the Chrome or Edge already on the PC.
  let browser;
  for (const channel of [undefined, "chrome", "msedge"]) {
    try {
      browser = await chromium.launch({ headless: !flag("--headed"), ...(channel ? { channel } : {}) });
      break;
    } catch (e) {
      if (channel === "msedge") throw e;
    }
  }
  try {
    // ---- sign in with a one-time token --------------------------------------------------------------------
    const gen = await sb.auth.admin.generateLink({ type: "magiclink", email: fileEnv.ADMIN_TEST_EMAIL });
    const hashed = gen.data?.properties?.hashed_token;
    if (gen.error || !hashed) throw new Error("Could not create a sign-in token (is ADMIN_TEST_EMAIL a real user?).");
    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await desktop.newPage();
    page.on("dialog", (d) => void d.accept());
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // Clicking or typing before React has hydrated is lost (a controlled input snaps back, a click does nothing),
    // so wait until the screen's own buttons carry React handlers before the script touches anything.
    const hydrated = (pg) =>
      pg.waitForFunction(
        () => {
          const els = [...document.querySelectorAll("main button, .adm-master button, .adm-editor button, form button, button")];
          return els.length > 0 && els.some((e) => Object.keys(e).some((k) => k.startsWith("__reactProps")));
        },
        null,
        { timeout: 30000 },
      );
    const go = async (p) => {
      const res = await page.goto(base + adminPath(base, p), { waitUntil: "domcontentloaded", timeout: 60000 });
      await hydrated(page);
      return res;
    };

    await check("sign in (one-time link)", async () => {
      await page.goto(base + callbackPath(base, hashed), { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForSelector(".adm-root, .adm-shell, nav", { timeout: 30000 });
      if (/login/.test(new URL(page.url()).pathname)) throw new Error("Landed on the login page: the account is not an admin or the link failed.");
    });
    const state = await desktop.storageState();

    // ---- every screen, two widths -------------------------------------------------------------------------
    const { NAV } = await jiti.import(path.join(root, "app/admin/nav.ts"));
    const screens = ["/admin"];
    for (const g of NAV) {
      screens.push(`/admin/${g.id}`);
      for (const s of g.sections) if (s.kind !== "soon") screens.push(`/admin/${g.id}/${s.id}`);
    }
    for (const [label, w, h] of [["1280", 1280, 800], ["393", 393, 852]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, storageState: state });
      const p = await ctx.newPage();
      p.on("dialog", (d) => void d.accept());
      const pageErrors = [];
      p.on("pageerror", (e) => pageErrors.push(e.message));
      for (const s of screens) {
        await check(`screen ${s} @${label}`, async () => {
          pageErrors.length = 0;
          const res = await p.goto(base + adminPath(base, s), { waitUntil: "domcontentloaded", timeout: 60000 });
          if (!res || res.status() >= 400) throw new Error(`HTTP ${res?.status()}`);
          await p.waitForSelector("h1, .adm-editor, .adm-overview", { timeout: 20000 });
          if (/\/login/.test(p.url())) throw new Error("Sent to the login page.");
          const bodyText = await p.evaluate(() => document.body.innerText);
          if (/Application error|Internal Server Error|This page could not be found/i.test(bodyText)) throw new Error("Error page shown.");
          if (pageErrors.length) throw new Error(`Page error: ${pageErrors[0]}`);
          const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          if (overflow > 8) throw new Error(`Sideways scroll of ${overflow}px.`);
        });
      }
      await ctx.close();
    }

    const ok = page.locator(".adm-note.is-ok");
    const save = async (publish = false) => {
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByRole("button", { name: publish ? "Yes, publish" : "Yes, save" }).click();
      await ok.first().waitFor({ timeout: 20000 });
    };
    const toastUndo = () => page.locator(".adm-toast").getByRole("button", { name: "Undo" });
    const row = (text) => page.locator(".adm-reclist li, .adm-records li").filter({ hasText: text });

    // ---- projects: create, edit with diff, hide + undo, delete forever ------------------------------------
    await check("projects: create, edit, hide with Undo, delete forever", async () => {
      await go("/admin/engineer/projects");
      await page.getByRole("button", { name: "New project", exact: true }).click();
      await page.locator('input[name="title"]').fill(`${MARK} project`);
      await page.getByRole("button", { name: "Create project" }).click();
      await page.getByRole("button", { name: "Yes, save" }).click();
      await row(`${MARK} project`).first().waitFor({ timeout: 20000 });
      await row(`${MARK} project`).first().locator(".adm-recmain").click();
      await page.locator('input[name="summary"]').fill("zz edited");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      const diff = page.locator(".adm-review table");
      await diff.waitFor({ timeout: 10000 });
      assert.match(await diff.innerText(), /summary/);
      await page.getByRole("button", { name: "Yes, save" }).click();
      await ok.first().waitFor({ timeout: 20000 });
      await page.locator('select[name="visibility"]').selectOption("unlisted");
      await save();
      await page.getByRole("button", { name: /Hide \(delete, can undo\)/ }).click();
      await toastUndo().click();
      await page.waitForFunction((m) => [...document.querySelectorAll(".adm-reclist li")].some((li) => li.textContent.includes(m) && /unlisted/.test(li.textContent)), `${MARK} project`, { timeout: 15000 });
      await page.getByRole("button", { name: /Hide \(delete, can undo\)/ }).click();
      await page.getByRole("button", { name: "Delete forever" }).click();
      await page.waitForFunction((m) => ![...document.querySelectorAll(".adm-reclist li")].some((li) => li.textContent.includes(m)), `${MARK} project`, { timeout: 20000 });
      const { count } = await sb.from("entries").select("id", { count: "exact", head: true }).eq("slug", `${MARK}-project`);
      assert.equal(count, 0, "the row is still in the database");
    });

    await check("projects: JSON import adds a project", async () => {
      await go("/admin/engineer/projects");
      await page.getByRole("button", { name: "Import JSON" }).click();
      await page.locator(".adm-review textarea").fill(JSON.stringify([{ slug: `${MARK}-import`, title: `${MARK} import`, visibility: "private", data: { role: "test" } }]));
      await page.getByText(/Dry run: 1 to add/).waitFor({ timeout: 10000 });
      await page.getByRole("button", { name: "Import 1" }).click();
      await row(`${MARK} import`).first().waitFor({ timeout: 20000 });
    });

    // ---- the record types: import, edit, publish-ish, hide + undo, delete ------------------------------------
    const { buildSeed } = await jiti.import(path.join(root, "lib/content/records-seed.ts"));
    const seed = buildSeed();
    const cols = [
      ["experience", "experience"],
      ["certification", "certifications"],
      ["education", "education"],
      ["timeline_event", "events"],
      ["milestone", "milestones"],
      ["diagram", "architecture"],
      ["profile_link", "links"],
    ];
    for (const [type, section] of cols) {
      await check(`${section}: import, edit, hide with Undo, delete forever`, async () => {
        const sample = seed.rows.find((r) => r.type === type)?.data;
        if (!sample) throw new Error("No sample record in the seed for this type.");
        await go(`/admin/engineer/${section}`);
        await page.getByRole("button", { name: "Import JSON" }).click();
        await page.locator(".adm-review textarea").fill(importBody(sample, type));
        await page.getByText(/Dry run: 1 to add/).waitFor({ timeout: 10000 });
        await page.getByRole("button", { name: "Import 1" }).click();
        const mine = row(`${MARK}-${type}`);
        await mine.first().waitFor({ timeout: 20000 });
        await mine.first().locator(".adm-recmain").click();
        // Edit the first text field and check the "What will change" table names it.
        const field = page.locator(".adm-detail .adm-form input.adm-input[type='text'], .adm-detail .adm-form input.adm-input:not([type])").first();
        await field.fill(`${await field.inputValue()} zz`);
        await page.getByRole("button", { name: /^(Publish|Save \(hidden\))$/ }).click();
        const diff = page.locator(".adm-review table");
        await diff.waitFor({ timeout: 10000 });
        assert.ok((await diff.locator("tbody tr").count()) >= 1, "the diff table is empty");
        await page.getByRole("button", { name: /Yes, (save|publish)/ }).click();
        await ok.first().waitFor({ timeout: 20000 });
        // Unlisted so it can be hidden (and brought back) without ever being public.
        await page.locator(".adm-detail select.adm-input").last().selectOption("unlisted");
        await page.getByRole("button", { name: /^(Publish|Save \(hidden\))$/ }).click();
        await page.getByRole("button", { name: /Yes, (save|publish)/ }).click();
        await ok.first().waitFor({ timeout: 20000 });
        await page.getByRole("button", { name: /Hide \(delete, can undo\)/ }).click();
        await toastUndo().click();
        await page.waitForFunction((m) => [...document.querySelectorAll(".adm-reclist li")].some((li) => li.textContent.includes(m) && /unlisted/.test(li.textContent)), `${MARK}-${type}`, { timeout: 15000 });
        await page.getByRole("button", { name: /Hide \(delete, can undo\)/ }).click();
        await page.getByRole("button", { name: "Delete forever" }).click();
        await page.waitForFunction((m) => ![...document.querySelectorAll(".adm-reclist li")].some((li) => li.textContent.includes(m)), `${MARK}-${type}`, { timeout: 20000 });
      });
    }

    // ---- skills ---------------------------------------------------------------------------------------------
    await check("skills: new group, save hidden, edit, delete forever", async () => {
      await go("/admin/engineer/skills");
      await page.getByRole("button", { name: "New skill group", exact: true }).click();
      await page.locator(".adm-detail input.adm-input").first().fill(`${MARK} group`);
      await page.getByRole("button", { name: "Add a skill" }).click();
      await page.getByLabel("Skill name").fill("zz skill");
      await page.getByRole("button", { name: "Save hidden" }).click();
      await ok.first().waitFor({ timeout: 20000 });
      await page.locator(".adm-records li").filter({ hasText: `${MARK} group` }).first().waitFor({ timeout: 20000 });
      await page.getByRole("button", { name: "Delete forever" }).click();
      await page.waitForFunction((m) => ![...document.querySelectorAll(".adm-records li")].some((li) => li.textContent.includes(m)), `${MARK} group`, { timeout: 20000 });
    });

    // ---- writing --------------------------------------------------------------------------------------------
    await check("writing: new post, edit, hide with Undo, delete forever", async () => {
      await go("/admin/engineer/writing");
      await page.getByRole("button", { name: "New post", exact: true }).click();
      await page.locator(".adm-detail input.adm-input").first().fill(`${MARK} post`);
      await page.getByRole("button", { name: "Create post" }).click();
      await page.getByRole("button", { name: "Yes, save" }).click();
      await row(`${MARK} post`).first().waitFor({ timeout: 20000 });
      await row(`${MARK} post`).first().locator(".adm-recmain").click();
      await page.locator(".adm-detail textarea").fill("zz body");
      await page.locator(".adm-detail select.adm-input").last().selectOption("unlisted");
      await save();
      await page.getByRole("button", { name: /Hide \(delete, can undo\)/ }).click();
      await toastUndo().click();
      await page.waitForFunction((m) => [...document.querySelectorAll(".adm-reclist li")].some((li) => li.textContent.includes(m) && /unlisted/.test(li.textContent)), `${MARK} post`, { timeout: 15000 });
      await page.getByRole("button", { name: /Hide \(delete, can undo\)/ }).click();
      await page.getByRole("button", { name: "Delete forever" }).click();
      await page.waitForFunction((m) => ![...document.querySelectorAll(".adm-reclist li")].some((li) => li.textContent.includes(m)), `${MARK} post`, { timeout: 20000 });
    });

    // ---- a settings key: save a draft, History shows it, Revert, restore ------------------------------------
    await check("settings: draft, History row, Revert (original restored after)", async () => {
      await go("/admin/site/identity");
      const field = page.locator(".adm-form input[type='text'], .adm-form input:not([type])").first();
      await field.waitFor({ timeout: 15000 });
      await field.fill(`${await field.inputValue()} zz`);
      await page.getByRole("button", { name: "Save draft" }).click();
      await page.locator("[role='status']").filter({ hasText: /Draft saved/ }).first().waitFor({ timeout: 20000 });
      await go("/admin/site/history");
      const hrow = page.locator("tbody tr").filter({ hasText: "identity" }).filter({ hasText: "draft" }).first();
      await hrow.waitFor({ timeout: 15000 });
      await hrow.getByRole("button", { name: "Revert" }).click();
      await page.waitForFunction(() => /Reverted identity/.test(document.body.innerText), null, { timeout: 15000 });
      const { data } = await sb.from("site_settings").select("draft").eq("key", "identity").maybeSingle();
      assert.ok(data, "the settings row is missing");
    });

    // ---- the draft follows you: a draft written by the server comes back in a new session ---------------------
    await check("drafts: a typed draft reaches the server and comes back", async () => {
      await go("/admin/engineer/experience");
      await page.getByRole("button", { name: "New role", exact: true }).click();
      const field = page.locator(".adm-detail .adm-form input.adm-input[type='text'], .adm-detail .adm-form input.adm-input:not([type])").first();
      await field.fill(`${MARK} draft`);
      await page.waitForTimeout(3500); // the server write is debounced 2 s
      const { data } = await sb.from("admin_drafts").select("key").like("key", "experience:%");
      assert.ok((data ?? []).some((r) => !snapshot.drafts.has(r.key)), "no draft row appeared (is migration 0014 applied?)");
      const ctx2 = await browser.newContext({ viewport: { width: 393, height: 852 }, storageState: state });
      const p2 = await ctx2.newPage();
      await p2.goto(base + adminPath(base, "/admin/engineer/experience?new=1"), { waitUntil: "domcontentloaded", timeout: 60000 });
      await p2.getByText(/Draft from your (laptop|phone|another device)/).waitFor({ timeout: 20000 });
      await ctx2.close();
    });

    if (errors.length) record("no uncaught page errors on the signed-in desktop page", false, errors[0]);
    else record("no uncaught page errors on the signed-in desktop page", true);
    await desktop.close();
  } finally {
    await browser.close().catch(() => {});
  }
}

try {
  await main();
} catch (e) {
  record("run", false, e instanceof Error ? e.message : e);
} finally {
  await cleanup();
}
console.log("\n" + renderTable(results));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
