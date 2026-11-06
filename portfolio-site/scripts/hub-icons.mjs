/**
 * Copies the tool / language logos the hub's object field shows into
 * public/hub/icons/ (checked in, so the build needs nothing at runtime).
 *
 *   node scripts/hub-icons.mjs
 *
 * Sources (dev dependencies):
 *   simple-icons  — CC0 1.0. Monochrome paths; we set each logo's brand colour
 *                   (light ink where the brand is black, for the dark glass).
 *   devicon       — MIT. Full-colour "original" marks where simple-icons has none.
 * Logos and product names belong to their owners; shown as "tools I use", unaltered.
 * The list is mirrored in docs/claude-planning/15-credits.md.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "hub", "icons");
mkdirSync(out, { recursive: true });

const INK = "#f3f1ec";
/** Brand colours that vanish on the void take the ink instead. */
const dark = (hex) => {
  const n = parseInt(hex, 16);
  const l = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return l < 70;
};

// simple-icons slugs (persona → list)
const SIMPLE = {
  engineer: ["typescript", "nextdotjs", "react", "nodedotjs", "python", "dotnet", "tailwindcss", "threedotjs", "docker", "git", "github", "postgresql", "supabase", "vercel", "postman", "claude", "cursor", "sap"],
};
// devicon icon names (full colour) where simple-icons has no mark
const DEVICON = {
  engineer: ["vscode", "csharp", "java", "oracle", "powershell", "azure"],
};

const si = require("simple-icons");
const bySlug = new Map(Object.values(si).filter((i) => i && i.slug).map((i) => [i.slug, i]));
const written = [];
for (const [persona, slugs] of Object.entries(SIMPLE)) {
  for (const slug of slugs) {
    const icon = bySlug.get(slug);
    if (!icon) {
      console.warn(`simple-icons: no ${slug}`);
      continue;
    }
    const fill = dark(icon.hex) ? INK : `#${icon.hex}`;
    const svg = icon.svg.replace("<svg ", `<svg fill="${fill}" `);
    writeFileSync(join(out, `${slug}.svg`), svg);
    written.push({ persona, file: `${slug}.svg`, title: icon.title, source: "simple-icons", licence: "CC0-1.0" });
  }
}
const devRoot = dirname(require.resolve("devicon/devicon.json"));
for (const [persona, names] of Object.entries(DEVICON)) {
  for (const name of names) {
    const file = join(devRoot, "icons", name, `${name}-original.svg`);
    let svg;
    try {
      svg = readFileSync(file, "utf8");
    } catch {
      console.warn(`devicon: no ${name}`);
      continue;
    }
    writeFileSync(join(out, `${name}.svg`), svg);
    written.push({ persona, file: `${name}.svg`, title: name, source: "devicon", licence: "MIT" });
  }
}
writeFileSync(join(out, "index.json"), JSON.stringify(written, null, 2) + "\n");
console.log(`${written.length} icons → public/hub/icons`);
