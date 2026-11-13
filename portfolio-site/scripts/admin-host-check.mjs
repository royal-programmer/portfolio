/**
 * Round 33 checks: admin host routing (pure), the Cloudflare Access JWT verifier (a locally generated RSA
 * key pair and a fake JWKS, no network), and the draft merge. Run from portfolio-site/:
 *   node scripts/admin-host-check.mjs
 */
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { webcrypto as crypto } from "node:crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { createJiti } = createRequire(import.meta.url)("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": root }, interopDefault: true });
const load = (p) => jiti.import(path.join(root, p));

const A = await load("lib/site/admin-host.ts");
const H = await load("lib/site/hosts.ts");
const X = await load("lib/admin/access.ts");
const D = await load("lib/admin/drafts.ts");

let n = 0;
const t = async (name, fn) => {
  await fn();
  n++;
  console.log("ok", name);
};

// ---- host routing -------------------------------------------------------------------------------
const base = { onAdminHost: false, pathname: "/", method: "GET", isRsc: false, production: true, strict: false };
await t("label defaults to admin, env overrides, apex turns it off", () => {
  assert.equal(A.adminHostLabel({}), "admin");
  assert.equal(A.adminHostLabel({ ADMIN_HOST_LABEL: "Console" }), "console");
  assert.equal(A.adminHostLabel({ ADMIN_HOST_LABEL: "apex" }), null);
  assert.equal(A.adminHostLabel({ ADMIN_HOST_LABEL: "bad label!" }), "admin");
});
await t("parseHost knows the admin host, prod and dev, and not a lookalike", () => {
  const roots = ["ratulroy.me", "ratulroy.localhost"];
  assert.deepEqual(H.parseHost("admin.ratulroy.me", roots, "admin"), { kind: "admin", root: "ratulroy.me", label: "admin" });
  assert.equal(H.parseHost("admin.ratulroy.localhost:3000", roots, "admin").kind, "admin");
  assert.equal(H.parseHost("admin.ratulroy.me", roots, null).kind, "unknown");
  assert.equal(H.parseHost("x.admin.ratulroy.me", roots, "admin").kind, "unrouted");
  assert.equal(H.parseHost("code.ratulroy.me", roots, "admin").kind, "persona");
});
await t("admin host: root and sub paths are rewritten under /admin", () => {
  const r = (pathname) => A.adminRoute({ ...base, onAdminHost: true, pathname });
  assert.deepEqual(r("/"), { kind: "rewrite", pathname: "/admin" });
  assert.deepEqual(r("/login"), { kind: "rewrite", pathname: "/admin/login" });
  assert.deepEqual(r("/auth/callback"), { kind: "rewrite", pathname: "/admin/auth/callback" });
  assert.deepEqual(r("/engineer/projects"), { kind: "rewrite", pathname: "/admin/engineer/projects" });
});
await t("admin host: an old /admin/x document request is cleaned to /x, an RSC fetch or POST passes", () => {
  const r = (pathname, o = {}) => A.adminRoute({ ...base, onAdminHost: true, pathname, ...o });
  assert.deepEqual(r("/admin"), { kind: "redirect", toAdminHost: false, pathname: "/", status: 308 });
  assert.deepEqual(r("/admin/login"), { kind: "redirect", toAdminHost: false, pathname: "/login", status: 308 });
  assert.deepEqual(r("/admin/login", { isRsc: true }), { kind: "pass" });
  assert.deepEqual(r("/admin/x", { method: "POST" }), { kind: "pass" });
  assert.equal(r("/login").kind, "rewrite");
});
await t("other hosts: /admin goes to the admin host in production (301), not in dev unless strict", () => {
  const r = (o) => A.adminRoute({ ...base, pathname: "/admin/engineer/projects", ...o });
  assert.deepEqual(r({}), { kind: "redirect", toAdminHost: true, pathname: "/engineer/projects", status: 301 });
  assert.deepEqual(r({ production: false }), { kind: "pass" });
  assert.deepEqual(r({ production: false, strict: true }), { kind: "redirect", toAdminHost: true, pathname: "/engineer/projects", status: 307 });
  assert.deepEqual(r({ method: "POST" }), { kind: "pass" });
  assert.deepEqual(r({ pathname: "/administrator" }), { kind: "pass" });
});
await t("the redirect target is final in one hop (no chain, no loop)", () => {
  const first = A.adminRoute({ ...base, pathname: "/admin" });
  assert.equal(first.pathname, "/");
  assert.equal(A.adminRoute({ ...base, onAdminHost: true, pathname: first.pathname }).kind, "rewrite");
});
await t("adminOrigin: admin host in routed mode, own host when unrouted", () => {
  assert.equal(A.adminOrigin({ host: "code.ratulroy.me", proto: "https", root: "ratulroy.me", label: "admin" }), "https://admin.ratulroy.me");
  assert.equal(A.adminOrigin({ host: "ratulroy.localhost:3000", proto: "http", root: "ratulroy.localhost", label: "admin" }), "http://admin.ratulroy.localhost:3000");
  assert.equal(A.adminOrigin({ host: "x.vercel.app", proto: "https", root: null, label: "admin" }), "https://x.vercel.app");
});

// ---- Cloudflare Access JWT ----------------------------------------------------------------------
const b64u = (buf) => Buffer.from(buf).toString("base64url");
const gen = () => crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pair = await gen();
const other = await gen();
const pub = await crypto.subtle.exportKey("jwk", pair.publicKey);
const jwks = { keys: [{ ...pub, kid: "k1", alg: "RS256", use: "sig" }] };
const cfg = X.accessConfig({ CF_ACCESS_TEAM_DOMAIN: "ratul", CF_ACCESS_AUD: "aud123" });
const now = 1_800_000_000_000;
const sign = async (payload, { key = pair.privateKey, header = { alg: "RS256", kid: "k1", typ: "JWT" } } = {}) => {
  const h = b64u(JSON.stringify(header));
  const p = b64u(JSON.stringify(payload));
  const s = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64u(s)}`;
};
const good = { aud: ["aud123"], iss: "https://ratul.cloudflareaccess.com", exp: now / 1000 + 600, email: "Ratul@Example.com" };
let fetches = 0;
const fetchJwks = async () => (fetches++, jwks);
const v = (tok, extra = {}) => X.verifyAccessJwt(tok, cfg, { fetchJwks, now, ...extra });

await t("config is off unless both vars are set; team accepts short and full form", () => {
  assert.equal(X.accessConfig({}), null);
  assert.equal(X.accessConfig({ CF_ACCESS_TEAM_DOMAIN: "ratul" }), null);
  assert.equal(cfg.issuer, "https://ratul.cloudflareaccess.com");
  assert.equal(cfg.certsUrl, "https://ratul.cloudflareaccess.com/cdn-cgi/access/certs");
  assert.equal(X.accessConfig({ CF_ACCESS_TEAM_DOMAIN: "https://ratul.cloudflareaccess.com/", CF_ACCESS_AUD: "a" }).issuer, cfg.issuer);
});
await t("a valid token passes and yields the lower-cased email", async () => {
  assert.deepEqual(await v(await sign(good)), { ok: true, email: "ratul@example.com" });
});
await t("JWKS is cached: a second verify does not fetch again", async () => {
  const before = fetches;
  await v(await sign(good));
  assert.equal(fetches, before);
});
await t("a string aud is accepted too", async () => {
  assert.equal((await v(await sign({ ...good, aud: "aud123" }))).ok, true);
});
await t("missing, malformed and none-alg tokens fail", async () => {
  assert.equal((await v(null)).reason, "missing");
  assert.equal((await v("a.b")).reason, "malformed");
  assert.equal((await v(await sign(good, { header: { alg: "none", kid: "k1" } }))).reason, "alg");
  assert.equal((await v(await sign(good, { header: { alg: "HS256", kid: "k1" } }))).reason, "alg");
});
await t("a token signed by another key fails the signature check", async () => {
  assert.equal((await v(await sign(good, { key: other.privateKey }))).reason, "signature");
});
await t("a tampered payload fails", async () => {
  const [h, , s] = (await sign(good)).split(".");
  const p = b64u(JSON.stringify({ ...good, email: "evil@example.com" }));
  assert.equal((await v(`${h}.${p}.${s}`)).reason, "signature");
});
await t("wrong aud, wrong iss, expired, no email all fail", async () => {
  assert.equal((await v(await sign({ ...good, aud: ["nope"] }))).reason, "aud");
  assert.equal((await v(await sign({ ...good, iss: "https://evil.cloudflareaccess.com" }))).reason, "iss");
  assert.equal((await v(await sign({ ...good, exp: now / 1000 - 3600 }))).reason, "expired");
  assert.equal((await v(await sign({ ...good, email: undefined }))).reason, "email");
});
await t("an unknown kid refetches at most once a minute", async () => {
  X.clearAccessCache();
  const tok = await sign(good, { header: { alg: "RS256", kid: "rotated" } });
  fetches = 0;
  assert.equal((await v(tok)).reason, "kid");
  assert.equal((await v(tok)).reason, "kid");
  assert.equal(fetches, 1);
  assert.equal((await v(tok, { now: now + 120_000 })).reason, "kid");
  assert.equal(fetches, 2);
});

// ---- draft merge --------------------------------------------------------------------------------
await t("draft: newest wins, a local-only copy is kept, a stale one is dropped", () => {
  const server = { data: { a: 1 }, updatedAt: "2026-11-13T10:00:00.000Z", by: "phone" };
  const local = { data: { a: 2 }, updatedAt: "2026-11-13T12:00:00.000Z" };
  assert.deepEqual(D.pickDraft(server, local, "2026-11-13T09:00:00.000Z"), { source: "local", data: { a: 2 }, updatedAt: local.updatedAt, by: null });
  assert.equal(D.pickDraft(server, { ...local, updatedAt: "2026-11-13T08:00:00.000Z" }, null).source, "server");
  assert.equal(D.pickDraft(null, local, null).source, "local");
  assert.equal(D.pickDraft(server, null, null).source, "server");
  assert.equal(D.pickDraft(null, null, null), null);
  assert.equal(D.pickDraft(server, null, "2026-11-13T11:00:00.000Z"), null);
});
await t("draft: the notice says where and how long ago", () => {
  const at = Date.parse("2026-11-13T12:00:00.000Z");
  assert.equal(D.draftNotice({ source: "server", data: {}, updatedAt: "2026-11-13T10:00:00.000Z", by: "phone" }, at), "Draft from your phone, 2 h ago");
  assert.equal(D.draftNotice({ source: "server", data: {}, updatedAt: "2026-11-13T11:58:00.000Z", by: "laptop" }, at), "Draft from your laptop, 2 min ago");
  assert.equal(D.draftNotice({ source: "local", data: {}, updatedAt: "2026-11-13T11:59:50.000Z", by: null }, at), "Draft from this browser, just now");
  assert.equal(D.draftNotice({ source: "server", data: {}, updatedAt: "2026-11-11T12:00:00.000Z", by: "phone" }, at), "Draft from your phone, 2 days ago");
});
await t("draft: key and device label are clean", () => {
  assert.equal(D.draftKey("project", "api-test-center"), "project:api-test-center");
  assert.equal(D.draftKey("skill_group", "new"), "skill_group:new");
  assert.equal(D.deviceLabel("Mozilla/5.0 (Linux; Android 15; V2405) Mobile"), "phone");
  assert.equal(D.deviceLabel("Mozilla/5.0 (Windows NT 10.0)"), "laptop");
});

console.log(`\n${n} checks passed`);
