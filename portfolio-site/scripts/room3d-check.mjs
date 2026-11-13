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

const { stageKitOn, stageKitTier, stageAction, stageStops, propForObject, STAGE_PROP_OBJECT, GATE_TIER } = await jiti.import(path.join(root, "lib/room3d/stage-kit.ts"));
const { resolveRoom3d } = await jiti.import(path.join(root, "lib/room3d/resolve.ts"));
const { STAGE_PROPS, SHELF_MAX, STAGE_TIERS } = await jiti.import(path.join(root, "lib/site/stage-data.ts"));

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

// the Stage on the kit (round 34): flag, tier from the hub gate, stops, clicks, the Stage's own kinds
check("the flag is off with no query and no env", stageKitOn("", undefined) === false && stageKitOn("?x=1", "") === false);
check("?kit=1 turns it on, ?kit=0 off", stageKitOn("?kit=1", undefined) && stageKitOn("?kit=true", "") && !stageKitOn("?kit=0", "1") && !stageKitOn("?kit=off", "true"));
check("the env default turns it on, the query still wins", stageKitOn("", "1") && stageKitOn("", "true") && !stageKitOn("?kit=0", "1") && stageKitOn("?kit=1", "0"));
check("the gate's three words map to the kit's tiers", GATE_TIER.performance === "low" && GATE_TIER.balanced === "medium" && GATE_TIER.best === "high");
{
  const probe = { cores: 16, memory: 16 };
  const t = (a) => stageKitTier({ query: null, gate: null, stepped: null, setting: "auto", probe, ...a });
  check("the gate's pick sets the tier", t({ gate: "performance" }) === "low" && t({ gate: "balanced" }) === "medium" && t({ gate: "best" }) === "high");
  check("?q= beats the gate", t({ query: "low", gate: "best" }) === "low" && t({ query: "Quality", gate: "performance" }) === "high");
  check("?q=auto is ignored", t({ query: "auto", gate: "balanced" }) === "medium");
  check("no gate: the setting, auto probes the device", t({ setting: "medium" }) === "medium" && t({}) === "high" && t({ probe: { cores: 2, memory: 2 } }) === "low");
  check("a step-down only lowers", t({ gate: "best", stepped: "balanced" }) === "medium" && t({ gate: "performance", stepped: "balanced" }) === "low" && t({ stepped: "performance" }) === "low");
  check("a step-down does not override ?q=", t({ query: "high", gate: "best", stepped: "performance" }) === "high");
}
check("the desk props map to room objects (headphones are the headset)", STAGE_PROPS.every((p) => room.objects.some((o) => o.id === STAGE_PROP_OBJECT[p.id])) && propForObject("headset") === "headphones" && propForObject("desk") === null);
{
  const act = (id) => stageAction(room.objects.find((o) => o.id === id));
  check("the terminal monitor zooms", act("monitor-low").do === "zoom");
  check("the door goes to the hub", act("door").do === "door");
  check("a desk prop runs as a prop", act("mug").do === "prop" && act("mug").prop === "mug" && act("headset").prop === "headphones");
  check("an object with no interaction does nothing", act("plant").do === "none");
  check("a card interaction is a card", act("clock").do === "card");
}
{
  const stops = stageStops(room);
  check("the room gives the shelf, constellation and window stops", stops.map((x) => x.id).join() === "shelf,constellation,window");
  check("every stop's eye stands inside the room and looks at something near it", stops.every((x) => Math.abs(x.eye[0]) <= room.shell.width / 2 && Math.abs(x.eye[2]) <= room.shell.depth / 2 && Math.hypot(x.eye[0] - x.look[0], x.eye[2] - x.look[2]) > 1));
  const bare = clone(room);
  bare.objects = bare.objects.filter((o) => o.kind !== "projectShelf");
  check("a room without a shelf has no shelf stop", !stageStops(bare).some((x) => x.id === "shelf"));
}
{
  const kinds = new Set(room.objects.map((o) => o.kind));
  check("the default room holds the Stage's own kinds", kinds.has("projectShelf") && kinds.has("constellation"));
  const shelf = room.objects.find((o) => o.kind === "projectShelf");
  check("the shelf holds the Stage's case cap", shelf.params.max === SHELF_MAX);
  check("the constellation's stars follow the Quality tier", room.objects.find((o) => o.kind === "constellation").params.stars === STAGE_TIERS.best.stars);
  const low = trimToBudget(room.objects, ROOM3D_DEFAULT.tiers.low.objectBudget, { phone: true, includeDraft: false });
  check("the low tier's budget keeps the shelf and the door", low.some((o) => o.kind === "projectShelf") && low.some((o) => o.kind === "door"));
  check("every tier's budget holds the default room", ["low", "medium", "high"].every((t) => ROOM3D_DEFAULT.tiers[t].objectBudget >= 10) && room.objects.length <= ROOM3D_DEFAULT.tiers.medium.objectBudget);
  const bad = clone(ROOM3D_DEFAULT);
  bad.rooms[0].objects.find((o) => o.kind === "projectShelf").params.max = 99;
  check("a shelf over its cap is rejected, the page falls back", !room3dSchema.safeParse(bad).success && resolveRoom3d(bad, null).source === "default" && resolveRoom3d(bad, ROOM3D_DEFAULT).source === "last-good");
}

console.log(failed ? `\n${failed} failing` : "\nall room3d checks pass");
process.exit(failed ? 1 : 0);
