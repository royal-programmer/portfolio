// Checks for the pure visitor-event code: the validator, link classifier, limiter and the aggregations.
// Run: node --experimental-strip-types scripts/insights-check.mjs
import assert from "node:assert/strict";
import { classifyLink, cleanRef, makeLimiter, validateBatch, EVENT_KINDS } from "../lib/site/events.ts";
import { hireLine, skimIds } from "../lib/site/hire-line.ts";
import { completionRate, csvCell, funnel, perDay, rankPopular, summarize, toCsv, withinDays } from "../lib/site/insights.ts";

let n = 0;
const ok = (name, fn) => {
  fn();
  n++;
  console.log("ok", name);
};

const base = { persona: "engineer", view: "netflix", session: "abc123", device: "phone", lang: "en" };

ok("validator keeps allowlisted kinds and drops the rest", () => {
  const rows = validateBatch({ ...base, events: [{ kind: "title_open", ref: "p-keel" }, { kind: "keylogger" }, { kind: 5 }, null] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "title_open");
  assert.equal(rows[0].ref, "p-keel");
  assert.equal(rows[0].device, "phone");
});
ok("every allowlisted kind passes", () => {
  const rows = validateBatch({ ...base, events: EVENT_KINDS.map((kind) => ({ kind })) });
  assert.equal(rows.length, EVENT_KINDS.length);
});
ok("terminal_cmd keeps the command name only, never arguments", () => {
  const [r] = validateBatch({ ...base, view: "terminal", events: [{ kind: "terminal_cmd", ref: "Skill  secret thing" }] });
  assert.equal(r.ref, "skill");
});
ok("a bad envelope gives nothing", () => {
  assert.deepEqual(validateBatch({ ...base, view: "admin", events: [{ kind: "view_open" }] }), []);
  assert.deepEqual(validateBatch({ ...base, events: [] }), []);
  assert.deepEqual(validateBatch({ ...base, session: "has space!", events: [{ kind: "view_open" }] }), []);
  assert.deepEqual(validateBatch("nope"), []);
  assert.deepEqual(validateBatch({ ...base, events: Array.from({ length: 21 }, () => ({ kind: "view_open" })) }), []);
});
ok("ref is trimmed, stripped of control characters and capped at 80", () => {
  assert.equal(cleanRef("  a\u0000b\n "), "ab");
  assert.equal(cleanRef("x".repeat(200))?.length, 80);
  assert.equal(cleanRef("   "), null);
  assert.equal(cleanRef(12), null);
});
ok("link classifier", () => {
  assert.equal(classifyLink("mailto:a@b.c")?.kind, "mail_click");
  assert.equal(classifyLink("/Ratul_Roy_Resume.pdf")?.kind, "resume_download");
  assert.equal(classifyLink("https://github.com/o/r?tab=x")?.kind, "code_click");
  assert.equal(classifyLink("https://github.com/o/r?tab=x")?.ref, "github.com/o/r");
  assert.equal(classifyLink("https://cal.com/me", "https://cal.com/me")?.kind, "book_click");
  assert.equal(classifyLink("https://demo.example.com/app")?.kind, "visit_click");
  assert.equal(classifyLink("/netflix?x=1"), null);
  assert.equal(classifyLink("#top"), null);
  assert.equal(classifyLink("tel:+1"), null);
});
ok("limiter allows max per window then resets", () => {
  let t = 0;
  const allow = makeLimiter(2, 1000, () => t);
  assert.deepEqual([allow("a"), allow("a"), allow("a"), allow("b")], [true, true, false, true]);
  t = 1500;
  assert.equal(allow("a"), true);
});

const NOW = Date.parse("2026-11-13T12:00:00Z");
const at = (daysAgo) => new Date(NOW - daysAgo * 86_400_000).toISOString();
const row = (kind, o = {}) => ({ at: at(1), view: "netflix", kind, ref: null, profile: null, session: null, device: null, referrer_host: null, ...o });

ok("empty log: zeros and null rates, nothing invented", () => {
  const s = summarize([], 30, NOW);
  assert.equal(s.total, 0);
  assert.equal(s.completion.rate, null);
  assert.deepEqual(s.funnel.map((f) => f.sessions), [0, 0, 0]);
  assert.equal(s.days.length, 30);
  assert.ok(s.days.every((d) => d.n === 0));
});
ok("window filter", () => {
  const rows = [row("view_open", { at: at(2) }), row("view_open", { at: at(40) })];
  assert.equal(withinDays(rows, 7, NOW).length, 1);
  assert.equal(withinDays(rows, 90, NOW).length, 2);
});
ok("completion rate", () => {
  const rows = [row("play_start"), row("play_start"), row("play_start"), row("play_start"), row("play_complete")];
  assert.deepEqual(completionRate(rows), { starts: 4, completes: 1, rate: 0.25 });
});
ok("funnel counts distinct sessions in order", () => {
  const rows = [
    row("title_open", { session: "a" }), row("title_open", { session: "a" }), row("title_open", { session: "b" }), row("title_open", { session: "c" }),
    row("play_start", { session: "a" }), row("play_start", { session: "b" }), row("play_start", { session: "z" }),
    row("mail_click", { session: "a" }), row("resume_download", { session: "c" }), row("hire_open", { session: "z" }),
    row("title_open"), // no session: left out
  ];
  assert.deepEqual(funnel(rows).map((f) => f.sessions), [3, 2, 1]);
});
ok("perDay buckets and zero days", () => {
  const rows = [row("view_open", { at: at(0.1) }), row("view_open", { at: at(0.2) }), row("view_open", { at: at(2) })];
  const d = perDay(rows, 7, NOW);
  assert.equal(d.length, 7);
  assert.equal(d.reduce((a, b) => a + b.n, 0), 3);
  assert.equal(d[6].n, 2);
});
ok("summarize groups visits, titles, devices and referrers", () => {
  const rows = [
    row("view_open", { view: "terminal", device: "desktop", referrer_host: "linkedin.com" }),
    row("view_open", { view: "netflix", device: "phone", referrer_host: "linkedin.com" }),
    row("view_open", { view: "netflix", device: "phone" }),
    row("title_open", { ref: "p-a" }), row("title_open", { ref: "p-a" }), row("title_open", { ref: "p-b" }),
    row("profile_pick", { ref: "recruiter" }), row("terminal_cmd", { view: "terminal", ref: "hire" }),
  ];
  const s = summarize(rows, 30, NOW);
  assert.deepEqual(s.visits, [{ key: "netflix", n: 2 }, { key: "terminal", n: 1 }]);
  assert.deepEqual(s.topTitles[0], { key: "p-a", n: 2 });
  assert.deepEqual(s.devices, [{ key: "phone", n: 2 }, { key: "desktop", n: 1 }]);
  assert.deepEqual(s.referrers, [{ key: "linkedin.com", n: 2 }]);
  assert.deepEqual(s.profilePicks, [{ key: "recruiter", n: 1 }]);
  assert.deepEqual(s.commands, [{ key: "hire", n: 1 }]);
});
ok("csv escapes quotes and defuses formulas", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvCell(null), "");
  assert.ok(toCsv([row("view_open")]).startsWith("at,view,kind,ref,profile,device,referrer_host\n"));
});

const rule = { windowDays: 30, minEvents: 4, weights: { title_open: 1, play_complete: 3 }, max: 2 };
const known = new Set(["a", "b", "c"]);
ok("popular: hidden below the threshold, ranked by weight above it", () => {
  assert.equal(rankPopular([row("title_open", { ref: "a" })], rule, known, NOW), null);
  const rows = [row("title_open", { ref: "a" }), row("title_open", { ref: "a" }), row("title_open", { ref: "b" }), row("play_complete", { ref: "b" }), row("title_open", { ref: "zz" }), row("title_open", { ref: "c", at: at(40) })];
  assert.deepEqual(rankPopular(rows, rule, known, NOW), ["b", "a"]);
});

ok("hire line is one sentence from the data, leaving out what is empty", () => {
  const h = { roles: ["Software Engineer"], level: "mid-level", location: { base: "Bengaluru", modes: ["hybrid", "remote"], relocate: true }, availability: "employed, notice period applies" };
  assert.equal(hireLine(h), "Software Engineer, mid-level; based in Bengaluru, hybrid / remote; employed, notice period applies.");
  assert.equal(hireLine({ roles: [], level: "", location: { base: "", modes: [], relocate: false }, availability: "" }), "");
});
ok("skim: own ids that exist, else the featured trio, at most three", () => {
  const known = new Set(["a", "b", "c", "d"]);
  const feat = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  assert.deepEqual(skimIds(["d", "zz", "b"], feat, known), ["d", "b"]);
  assert.deepEqual(skimIds(undefined, feat, known), ["a", "b", "c"]);
  assert.deepEqual(skimIds(["zz"], feat, known), ["a", "b", "c"]);
});

console.log(`${n} checks passed`);
