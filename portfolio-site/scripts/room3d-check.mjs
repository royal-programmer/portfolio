/**
 * Pure-function checks for the 3D room (lib/room3d): the default parses, bad rooms are rejected, tier
 * selection and the object budget behave. Run from portfolio-site/:  node scripts/room3d-check.mjs
 * Loads TypeScript through jiti with the `@/` alias, like settings-roundtrip.mjs. Exits 1 on any failure.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": root }, interopDefault: true });

const { room3dSchema, KIND_IDS, MAX_OBJECTS } = await jiti.import(path.join(root, "lib/room3d/schema.ts"));
const { ROOM3D_DEFAULT } = await jiti.import(path.join(root, "lib/room3d/defaults.ts"));
const { pickTier, stepDown, parseQuality, resolveTier, trimToBudget, activeRoom } = await jiti.import(path.join(root, "lib/room3d/tiers.ts"));

let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : " " + extra}`);
};
const clone = (v) => JSON.parse(JSON.stringify(v));

// schema
check("default parses", room3dSchema.safeParse(ROOM3D_DEFAULT).success, JSON.stringify(room3dSchema.safeParse(ROOM3D_DEFAULT).error?.issues.slice(0, 3)));
const room = ROOM3D_DEFAULT.rooms[0];
check("every kind is in the discriminated union", KIND_IDS.length >= 30 && new Set(KIND_IDS).size === KIND_IDS.length);
{
  const bad = clone(ROOM3D_DEFAULT);
  bad.rooms[0].objects[1].id = bad.rooms[0].objects[0].id;
  check("duplicate ids rejected", !room3dSchema.safeParse(bad).success);
}
{
  const bad = clone(ROOM3D_DEFAULT);
  bad.rooms[0].objects[0].transform.pos = [40, 0, 0];
  check("position outside the shell rejected", !room3dSchema.safeParse(bad).success);
}
{
  const bad = clone(ROOM3D_DEFAULT);
  bad.rooms[0].objects[0].transform.scale = 50;
  check("scale out of range rejected", !room3dSchema.safeParse(bad).success);
}
{
  const bad = clone(ROOM3D_DEFAULT);
  bad.rooms[0].objects = Array.from({ length: MAX_OBJECTS + 1 }, (_, i) => ({ ...clone(room.objects[0]), id: `o${i}` }));
  check("more than 200 objects rejected", !room3dSchema.safeParse(bad).success);
}
{
  const bad = clone(ROOM3D_DEFAULT);
  bad.rooms[0].objects[0].params.nope = 1;
  check("unknown param rejected (strict)", !room3dSchema.safeParse(bad).success);
}
{
  const bad = clone(ROOM3D_DEFAULT);
  bad.activeRoom = "ghost";
  check("activeRoom must exist", !room3dSchema.safeParse(bad).success);
  check("activeRoom falls back to the first room", activeRoom(bad).id === "work");
}
{
  const bad = clone(ROOM3D_DEFAULT);
  bad.rooms[0].objects.push({ ...clone(room.objects[0]), id: "pic", kind: "frame", params: { variant: "poster", w: 1, h: 1, title: "x", image: { src: "javascript:alert(1)", alt: "" } } });
  check("image src must be https, a /path or an upload", !room3dSchema.safeParse(bad).success);
}

// tiers
check("saveData is low", pickTier({ saveData: true, cores: 16, memory: 16 }) === "low");
check("big desktop is high", pickTier({ cores: 12, memory: 16 }) === "high");
check("laptop is medium", pickTier({ cores: 4, memory: 8 }) === "medium");
check("phone never starts above medium", pickTier({ phone: true, cores: 8, memory: 12 }) !== "high");
check("modest phone is low", pickTier({ phone: true, cores: 8, memory: 4 }) === "low");
check("slow first frames step down one", stepDown("high", 40) === "medium");
check("very slow first frames step down two", stepDown("high", 80) === "low");
check("never below low", stepDown("low", 200) === "low");
check("frame time lowers the pick", pickTier({ cores: 12, memory: 16, frameMs: 40 }) === "medium");
check("?q words map", parseQuality("Performance") === "low" && parseQuality("best") === "high" && parseQuality("x") === null && parseQuality("auto") === "auto");
check("?q beats saved and setting", resolveTier({ query: "low", saved: "high", setting: "auto", probe: { cores: 16, memory: 16 } }) === "low");
check("auto uses the probe", resolveTier({ query: null, saved: null, setting: "auto", probe: { cores: 2, memory: 2 } }) === "low");

// budget
{
  const objs = room.objects;
  const all = trimToBudget(objs, 200, { phone: false, includeDraft: false });
  check("budget above the count keeps everything", all.length === objs.length);
  const cut = trimToBudget(objs, 10, { phone: false, includeDraft: false });
  check("budget cuts to the number", cut.length === 10);
  check("the desk, door and monitors survive a tight budget", ["desk", "door", "monitor-low", "window"].every((id) => cut.some((o) => o.id === id)));
  check("trim keeps the original order", cut.every((o, i, a) => i === 0 || objs.indexOf(a[i - 1]) < objs.indexOf(o)));
  const hidden = clone(objs);
  hidden[5].hideOnPhone = true;
  hidden[6].visibility = "draft";
  check("phone drops hideOnPhone, public drops drafts", trimToBudget(hidden, 200, { phone: true, includeDraft: false }).length === objs.length - 2);
  check("preview keeps drafts", trimToBudget(hidden, 200, { phone: false, includeDraft: true }).length === objs.length);
}

console.log(failed ? `\n${failed} failing` : "\nall room3d checks pass");
process.exit(failed ? 1 : 0);
