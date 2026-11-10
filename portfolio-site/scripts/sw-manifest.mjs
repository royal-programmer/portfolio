/**
 * Runs after `next build` (see the "build" script): lists the Next static files the service worker
 * should precache, so the terminal opens offline on a first visit that was online.
 *
 *   node scripts/sw-manifest.mjs   ->   public/sw-manifest.json  { build, files: ["/_next/static/..."] }
 *
 * Generated and gitignored. Which files: the shared runtime files from build-manifest.json, the
 * chunks the app's pages reference (read from the page_client_reference manifests), and every
 * stylesheet and font. If the page manifests cannot be read it falls back to the whole static folder.
 * public/sw-manifest.json is read by the worker at install; in dev it does not exist (empty list).
 * Note: public/ is read at server start, so a file written here is served by the next `next start`.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const next = join(root, ".next");
const statics = join(next, "static");
if (!existsSync(statics)) {
  console.error("sw-manifest: .next/static not found, run next build first");
  process.exit(1);
}

const walk = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
const url = (abs) => "/_next/static/" + relative(statics, abs).split(sep).map(encodeURIComponent).join("/");

const all = walk(statics).filter((f) => !f.endsWith(".map"));
const chosen = new Set();

// Stylesheets and fonts are small and every page needs them.
for (const f of all) if (/\.(css|woff2?|ttf)$/.test(f)) chosen.add(f);

// Runtime files named by the build manifest.
try {
  const bm = JSON.parse(readFileSync(join(next, "build-manifest.json"), "utf8"));
  for (const p of [...(bm.rootMainFiles ?? []), ...(bm.polyfillFiles ?? [])]) {
    const f = join(next, p);
    if (existsSync(f)) chosen.add(f);
  }
} catch {}

// The chunks the pages and layouts reference: every "static/…js" string in the client reference manifests.
let referenced = 0;
const serverApp = join(next, "server", "app");
if (existsSync(serverApp)) {
  for (const f of walk(serverApp).filter((x) => /client-reference-manifest\.js$/.test(x))) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/static\/[^"'\s\\]+?\.(?:js|css)/g)) {
      const abs = join(next, decodeURIComponent(m[0]));
      if (existsSync(abs)) {
        chosen.add(abs);
        referenced++;
      }
    }
  }
}
if (!referenced) for (const f of all) chosen.add(f); // fallback: everything

const files = [...chosen].map(url).sort();
let build = "";
try {
  build = readFileSync(join(next, "BUILD_ID"), "utf8").trim();
} catch {}
writeFileSync(join(root, "public", "sw-manifest.json"), JSON.stringify({ build: build || String(Date.now()), files }, null, 1) + "\n");
console.log(`sw-manifest: ${files.length} files (${referenced ? "from page manifests" : "whole static folder"}), build ${build}`);
