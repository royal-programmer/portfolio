/**
 * Content round trip (round 24): the importer's rows validate against their Zod schemas, slugs are unique, and
 * `terminalData` built from those rows (the CONTENT_SOURCE=db path) equals what the frozen copy produces for the
 * resume, timeline, `hire --brief`, diagrams, profiles, contact, clock and the Netflix seasons. Run from
 * portfolio-site/ in code mode (the default):
 *
 *   node scripts/content-roundtrip.mjs
 *
 * No network, no secrets. Exits 1 on any failure.
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

const { buildSeed } = await load("lib/content/records-seed.ts");
const { RECORD_SCHEMAS, projectStorySchema, projectMediaSchema } = await load("lib/content/record-schemas.ts");
const { SCHEMAS } = await load("lib/settings/schema.ts");
const { emptyRecords } = await load("lib/content/records-assemble.ts");
const { terminalData } = await load("lib/site/terminal-data.ts");
const { buildNetflix, NETFLIX_PROFILES, hireSheetOf, storyOf, mediaOf } = await load("lib/site/netflix-data.ts");
const { LEGACY } = await load("lib/site/legacy-content.ts");
const { skillEvidence, skillEvidenceMap, findSkill, mentions } = await load("lib/site/skill-evidence.ts");
const { CONTENT_SOURCE } = await load("lib/content/source.ts");

let failed = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${String(e.message).split("\n").slice(0, 12).join("\n  ")}`);
  }
};
if (CONTENT_SOURCE !== "code") {
  console.log("Run in code mode (unset CONTENT_SOURCE): the expected side is the frozen copy.");
  process.exit(1);
}

const seed = buildSeed();
const counts = {};
for (const r of seed.rows) counts[r.type] = (counts[r.type] ?? 0) + 1;
console.log("rows per type:", JSON.stringify(counts), `- project patches: ${seed.projectPatches.length} - settings: ${Object.keys(seed.settings).length} + netflix.bookCall`);

check("every row validates against its Zod schema", () => {
  for (const r of seed.rows) {
    const res = RECORD_SCHEMAS[r.type].safeParse(r.data);
    assert.ok(res.success, `${r.type} ${r.slug}: ${res.success ? "" : res.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    assert.deepEqual(JSON.parse(JSON.stringify(res.data)), JSON.parse(JSON.stringify(r.data)), `${r.slug}: parsing changes the data`);
  }
});
check("slugs are unique", () => assert.equal(new Set(seed.rows.map((r) => r.slug)).size, seed.rows.length));
check("project story and media validate", () => {
  for (const p of seed.projectPatches) {
    if (p.story) assert.ok(projectStorySchema.safeParse(p.story).success, `${p.slug} story`);
    if (p.media) assert.ok(projectMediaSchema.safeParse(p.media).success, `${p.slug} media`);
  }
});
check("settings values validate", () => {
  for (const [k, v] of Object.entries(seed.settings)) assert.ok(SCHEMAS[k].safeParse(v).success, k);
});
check("skill links point at records that exist (or at a project slug)", () => {
  const slugs = new Set(seed.rows.map((r) => r.slug));
  const projects = new Set(["shift-roster"]);
  for (const g of seed.rows.filter((r) => r.type === "skill_group"))
    for (const it of g.data.items) {
      for (const s of it.experience ?? []) assert.ok(slugs.has(s), `${it.name} -> ${s}`);
      for (const s of it.certifications ?? []) assert.ok(slugs.has(s), `${it.name} -> ${s}`);
      for (const s of it.projects ?? []) assert.ok(projects.has(s) || slugs.has(s), `${it.name} -> ${s}`);
    }
});

// The same engineer entries both ways: the project exists in the database; only the db side has story/media on it.
const base = { id: "p1", personaSlug: "engineer", type: "project", slug: "api-test-center", title: "API Test Center", summary: "An API testing tool.", visibility: "public", featured: true, order: 0, createdAt: "2026-04-01T00:00:00Z", media: [], groups: [] };
const project = (extra) => ({ ...base, data: { techStack: ["Electron", "k6"], deployedUrl: "https://apitestcenter.com", ...extra } });
const patch = seed.projectPatches.find((p) => p.slug === "api-test-center");
const codeData = terminalData(undefined, [project({})], [], []);
const records = Object.fromEntries(Object.keys(emptyRecords()).map((t) => [t, seed.rows.filter((r) => r.type === t).map((r) => ({ slug: r.slug, order: r.order, data: r.data }))]));
const dbData = terminalData(undefined, [project({ story: patch.story, media: patch.media })], [], [], { records, resume: seed.settings["engineer.resume"], hiring: seed.settings["engineer.hiring"], clock: seed.settings["engineer.clock"], netflix: { profiles: [], adjectives: {}, bookCall: seed.bookCall } });
const json = (v) => JSON.parse(JSON.stringify(v));
const strip = (r) => ({ ...r, experience: r.experience.map(({ id, ...e }) => e), certifications: r.certifications.map(({ id, ...c }) => c), skills: r.skills.map(({ links, ...g }) => g) });

check("resume equals the frozen copy (ids and skill links aside)", () => assert.deepEqual(json(strip(dbData.resume)), json(strip(codeData.resume))));
check("skill links carry the Python story", () => {
  const py = dbData.resume.skills.find((g) => g.group === "development").links.Python;
  assert.deepEqual(py.experience, ["experience-altimetrik"]);
  assert.equal(py.certifications.length, 2);
});
check("timeline and periods equal", () => {
  assert.deepEqual(json(dbData.timeline), json(codeData.timeline));
  assert.deepEqual(json(dbData.periods), json(codeData.periods));
});
check("diagrams and project map equal", () => {
  assert.deepEqual(json(dbData.arch), json(codeData.arch));
  assert.deepEqual(json(dbData.projectArch), json(codeData.projectArch));
});
check("profiles and contact equal", () => {
  assert.deepEqual(json(dbData.profiles), json(codeData.profiles));
  assert.deepEqual(json(dbData.contact), json(codeData.contact));
});
check("hiring and clock equal", () => {
  assert.deepEqual(json(dbData.hiring), json(codeData.hiring));
  assert.deepEqual(json(dbData.clock), json(codeData.clock));
});
check("hire --brief text equals", () => assert.equal(hireSheetOf(dbData).brief, hireSheetOf(codeData).brief));
check("story and media come from the record and equal the frozen copy", () => {
  const p = dbData.projects[0];
  assert.deepEqual(json(p.story), json(LEGACY.PROJECT_STORY["api-test-center"]));
  assert.deepEqual(json(storyOf(p)), json(storyOf(codeData.projects[0])));
  assert.deepEqual(json(mediaOf(p)), json(mediaOf(codeData.projects[0])));
});
check("Netflix seasons equal on every profile", () => {
  for (const pr of NETFLIX_PROFILES) assert.deepEqual(json(buildNetflix(pr.id, dbData, [], [])), json(buildNetflix(pr.id, codeData, [], [])), pr.id);
});
check("skill evidence: linked records win, a dangling slug is dropped", () => {
  const ev = skillEvidence(dbData, "C#");
  assert.equal(ev.source, "linked");
  assert.ok(ev.work[0]?.company.startsWith("Altimetrik"));
  assert.ok(ev.projects.every((p) => dbData.projects.some((x) => x.slug === p.slug)));
});
check("skill evidence: unlinked skills match by name only (code copy)", () => {
  const py = skillEvidence(codeData, "python");
  assert.equal(py.source, "matched");
  assert.equal(py.name, "Python");
  assert.ok(py.work[0].bullets.every((b) => /python/i.test(b)));
  assert.ok(py.certs.some((c) => /Python/.test(c.name)));
  const git = skillEvidence(codeData, "Git");
  assert.ok(git.work.every((w) => w.bullets.every((b) => mentions(b, "Git"))));
});
check("skill evidence: nothing found says none, never invents", () => {
  const empty = skillEvidence({ stack: [], projects: [], resume: { skills: [], experience: [], certifications: [] } }, "Rust");
  assert.equal(empty.source, "none");
  assert.equal(empty.projects.length + empty.work.length + empty.certs.length, 0);
});
check("skill evidence: whole-word matching and lookup", () => {
  assert.equal(mentions("GitHub Actions", "Git"), false);
  assert.equal(mentions("React/TypeScript and .NET APIs", ".NET"), true);
  assert.equal(mentions("ASP.NET MVC", ".NET"), false);
  assert.equal(mentions("written in c# and sql", "C#"), true);
  assert.equal(findSkill(codeData, "c#"), "C#");
  assert.equal(findSkill(codeData, "nope-skill"), null);
  assert.ok(Object.keys(skillEvidenceMap(codeData)).includes("c#"));
});
check("empty records give an honest empty state, not hard-coded content", () => {
  const e = terminalData(undefined, [], [], [], { records: emptyRecords() });
  assert.equal(e.timeline.length + e.arch.length + e.profiles.length + e.resume.experience.length + e.resume.skills.length + e.clock.bands.length, 0);
  assert.deepEqual(e.contact.map((c) => c.label), ["mail"]);
});

console.log(failed ? `\n${failed} failing` : "\nall content round-trip checks pass");
process.exit(failed ? 1 : 0);
