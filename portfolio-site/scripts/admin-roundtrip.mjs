/**
 * Admin console pure functions (round 29): the record forms' clean-up and schema check, the title/slug
 * derivation, the diff builder, reorder, the JSON import validator and the site health checklist.
 * Run from portfolio-site/: node scripts/admin-roundtrip.mjs   (no network, no secrets; exits 1 on failure)
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": root }, interopDefault: true });
const load = (p) => jiti.import(path.join(root, p));

const F = await load("app/admin/_lib/record-forms.ts");
const H = await load("app/admin/_lib/health.ts");
const { buildSeed } = await load("lib/content/records-seed.ts");

let n = 0;
const t = (name, fn) => {
  fn();
  n++;
  console.log(`ok  ${name}`);
};

// The seed rows survive: form fields -> clean -> schema, for every record type with a form.
t("every seeded record round-trips through its form fields", () => {
  const seed = buildSeed();
  let checked = 0;
  for (const r of seed.rows) {
    const form = F.RECORD_FORMS[r.type];
    if (!form) continue;
    const cleaned = F.cleanData(form.fields, r.data);
    assert.deepEqual(F.checkRecord(r.type, cleaned), [], `${r.type} ${r.slug}`);
    assert.deepEqual(cleaned, JSON.parse(JSON.stringify(r.data)), `${r.type} ${r.slug} unchanged by the form`);
    checked++;
  }
  assert.ok(checked > 20);
});

t("clean drops empty optional fields and keeps required ones", () => {
  const c = F.cleanData(F.RECORD_FORMS.certification.fields, { issuer: " IBM ", line: "x", items: ["", "a "], verify: "" });
  assert.deepEqual(c, { issuer: "IBM", line: "x", items: ["a"] });
  const bad = F.cleanData(F.RECORD_FORMS.certification.fields, { issuer: "", line: "", verify: "ftp://x" });
  assert.ok(F.checkRecord("certification", bad).length >= 1);
  const m = F.cleanData(F.RECORD_FORMS.milestone.fields, { kind: "period", label: "College", from: "2020-08", to: "", date: "ignored", subject: "ignored" });
  assert.deepEqual(m, { kind: "period", label: "College", from: "2020-08", to: null });
});

t("title and slug match the importer's naming", () => {
  const m = F.recordMeta("experience", { company: "Altimetrik (Pune)", role: "SDE", period: { start: "2024-10", end: "present" } });
  assert.equal(m.slug, "experience-altimetrik");
  assert.equal(m.title, "SDE · Altimetrik (Pune)");
  assert.equal(m.occurredAt, "2024-10-01T00:00:00Z");
  assert.equal(F.freeSlug("a", ["a", "a-2"]), "a-3");
  assert.equal(F.freeSlug("b", ["a"]), "b");
});

t("diff lists each changed leaf with a readable path", () => {
  const d = F.diffValues({ a: "x", b: { c: 1 }, l: ["p", "q"] }, { a: "y", b: { c: 1 }, l: ["p", "z", "w"] });
  assert.deepEqual(d.map((r) => r.path), ["a", "l[1]", "l[2]"]);
  assert.equal(d[0].before, "x");
  assert.equal(d[2].before, "(not there)");
  assert.deepEqual(F.diffValues({ a: 1 }, { a: 1 }), []);
  assert.equal(F.diffValues({ a: 1 }, { a: 1, b: "n" })[0].before, "(empty)");
});

t("reorder moves one item and renumbers in steps of 10", () => {
  assert.deepEqual(F.moveItem(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  assert.deepEqual(F.moveItem(["a", "b", "c"], 2, 1), ["a", "c", "b"]);
  assert.deepEqual(F.moveItem(["a", "b"], 0, 5), ["a", "b"]);
  assert.deepEqual(F.orderValues(["x", "y"]), [{ id: "x", order: 0 }, { id: "y", order: 10 }]);
});

t("import validator: dry run, bad rows, duplicates, update vs create", () => {
  const good = { company: "A", role: "B", period: { start: "2024-01", end: "present" }, headline: "h", bullets: [] };
  const ok = F.validateImport("experience", JSON.stringify([{ slug: "experience-a", data: good }, { data: { ...good, company: "Z" } }]), ["experience-a"]);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.rows.map((r) => [r.slug, r.action, r.visibility]), [["experience-a", "update", "private"], ["experience-z", "create", "private"]]);
  const bad = F.validateImport("experience", JSON.stringify([{ data: { company: "A" } }, { slug: "experience-a", data: good }, { slug: "experience-a", data: good }]), []);
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 2);
  assert.equal(F.validateImport("experience", "not json", []).ok, false);
  assert.equal(F.validateImport("experience", "{}", []).ok, false);
  assert.equal(F.validateImport("experience", "[]", []).ok, false);
});

t("health checklist: red and green come from the data, unknown is never green", () => {
  const base = {
    bookCallHref: "https://cal.example/x",
    certs: [{ slug: "c1", title: "IBM", verify: "https://v" }],
    projects: [{ slug: "p", title: "P", summary: "s", hasPoster: true, liveUrl: "https://p" }],
    hiring: { roles: ["a"], level: "x", stack: { core: ["a"], plus: [] }, location: { base: "Pune", modes: ["remote"], relocate: false }, availability: "now", compensation: "open", visa: "n/a", proof: ["p"], links: { resume: "r", site: "s" } },
    resumeBuilt: "2026-11",
    latestChange: "2026-11-10T00:00:00Z",
    ogOk: true,
    invalid: [],
    touched: [{ label: "x", href: "/admin", updatedAt: "2026-11-01T00:00:00Z" }],
    now: Date.parse("2026-11-13T00:00:00Z"),
  };
  const byId = (items) => Object.fromEntries(items.map((x) => [x.id, x]));
  let h = byId(H.computeHealth(base));
  // plus: [] is empty but allowed? it is a list inside stack, so it counts as empty.
  assert.equal(h.booking.status, "ok");
  assert.equal(h.verify.status, "ok");
  assert.equal(h.projects.status, "ok");
  assert.equal(h.resume.status, "ok");
  assert.equal(h.stale.status, "ok");
  assert.equal(h.hiring.status, "warn");
  assert.deepEqual(h.hiring.examples, ["stack.plus"]);
  h = byId(H.computeHealth({ ...base, bookCallHref: "", certs: [{ slug: "c", title: "C" }], projects: [{ slug: "p", title: "P", hasPoster: false }], resumeBuilt: "2026-01", ogOk: null, touched: [{ label: "old", href: "/admin/x", updatedAt: "2026-01-01T00:00:00Z" }], invalid: [{ label: "bad one", href: "/admin/y" }], hiring: null }));
  assert.equal(h.booking.status, "warn");
  assert.equal(h.verify.count, 1);
  assert.match(h.projects.examples[0], /summary, poster, live or repo link/);
  assert.equal(h.resume.status, "warn");
  assert.equal(h.og.status, "warn");
  assert.equal(h.og.detail, "not checked");
  assert.equal(h.stale.count, 1);
  assert.equal(h.empty.href, "/admin/y");
  assert.equal(h.hiring.detail, "could not be read");
  assert.equal(H.healthSummary(H.computeHealth(base)), "7 of 8 green");
});

t("empty required fields are named", () => {
  assert.deepEqual(F.emptyRequired("experience", { company: "A", role: " ", period: { start: "2024-01", end: "" }, headline: "", bullets: [] }), ["Role", "Period", "Headline"]);
  assert.deepEqual(F.emptyRequired("certification", { issuer: "IBM", line: "x" }), []);
  assert.deepEqual(F.emptyRequired("skill_group", {}), []);
});

console.log(`\n${n} groups passed`);
