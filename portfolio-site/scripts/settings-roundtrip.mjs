/**
 * Settings round-trip: parses every key's code default through its Zod schema and fails on drift
 * (a default the schema rejects, or one the schema would change on parse). Run from portfolio-site/:
 *
 *   node scripts/settings-roundtrip.mjs
 *
 * Loads the TypeScript sources through jiti (a transitive dependency of the toolchain), with the `@/`
 * alias. Prints PASS/FAIL per key; exits 1 on any failure. No network, no secrets.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": root }, interopDefault: true });

const { SCHEMAS, SETTING_KEYS } = await jiti.import(path.join(root, "lib/settings/schema.ts"));
const { DEFAULTS } = await jiti.import(path.join(root, "lib/settings/defaults.ts"));

// JSON normal form: key order is irrelevant, undefined keys vanish.
const norm = (v) => JSON.stringify(sortKeys(JSON.parse(JSON.stringify(v ?? null))));
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

let failed = 0;
for (const key of SETTING_KEYS) {
  const def = DEFAULTS[key];
  const result = SCHEMAS[key].safeParse(def);
  if (!result.success) {
    failed++;
    console.log(`FAIL ${key}: ${result.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join(" | ")}`);
  } else if (norm(result.data) !== norm(def)) {
    failed++;
    console.log(`FAIL ${key}: parsing changes the default (the schema strips or rewrites a field)`);
  } else {
    console.log(`PASS ${key}`);
  }
}
// Every schema key has a default and vice versa.
for (const key of Object.keys(DEFAULTS)) if (!SETTING_KEYS.includes(key)) { failed++; console.log(`FAIL ${key}: default without a schema`); }
console.log(failed ? `\n${failed} failing` : `\nall ${SETTING_KEYS.length} defaults round-trip`);
process.exit(failed ? 1 : 0);
