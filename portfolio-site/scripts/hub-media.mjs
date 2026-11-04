/**
 * Lists Ratul's own pictures for the hub's object field.
 *
 *   node scripts/hub-media.mjs        (also runs before `next build` / `next dev` via package.json)
 *
 * Scans public/hub/<persona>/ for images (and public/hub/models/ for .glb files)
 * and writes public/hub/media.json:
 *   { "models": ["bike.glb"], "engineer": ["vscode-1.webp", …], "photographer": ["…"], … }
 * The scene reads that file; nothing else needs to change when files are added.
 * Images are served through Next's image optimizer, so size on disk is not a
 * concern for the scene — keep them under ~1 MB each anyway for git's sake.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "public", "hub");
const PERSONAS = ["engineer", "trader", "photographer", "artist", "ride", "gamer"];
const IMAGE = /\.(jpe?g|png|webp|avif)$/i;

const out = {};
// 3D models (CC0 only — see docs/claude-planning/15-credits.md): public/hub/models/*.glb
try {
  out.models = readdirSync(join(root, "models")).filter((f) => /\.glb$/i.test(f)).sort();
} catch {
  out.models = [];
}
for (const persona of PERSONAS) {
  const dir = join(root, persona);
  let files = [];
  try {
    files = readdirSync(dir)
      .filter((f) => IMAGE.test(f) && statSync(join(dir, f)).isFile())
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    files = [];
  }
  out[persona] = files;
}
writeFileSync(join(root, "media.json"), JSON.stringify(out, null, 2) + "\n");
const n = Object.values(out).reduce((s, l) => s + l.length, 0);
console.log(`hub media: ${n} file(s) → public/hub/media.json`);
