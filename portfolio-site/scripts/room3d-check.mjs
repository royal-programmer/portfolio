/**
 * Pure-function checks for the 3D room (lib/room3d): the default parses, bad rooms are rejected, tier
 * selection and the object budget behave. Run from portfolio-site/:  node scripts/room3d-check.mjs
 * Loads TypeScript through jiti with the `@/` alias, like settings-roundtrip.mjs. Exits 1 on any failure.
 */
import fs from "node:fs";
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
const { DEFAULT_ZONES, orderedZones, visibleZones, stepZone, zoneForObject, lookFromDrag, LOOK_LIMIT, flick, fovFor, approachFor, damp } = await jiti.import(path.join(root, "lib/room3d/zones.ts"));
const { resolveReader, lowEnd } = await jiti.import(path.join(root, "lib/room3d/reader.ts"));
const { layoutBoard, pickItem, BOARD_MAX } = await jiti.import(path.join(root, "lib/room3d/board-layout.ts"));
const { buildRoomContent, boardItems, parsePanel, PANEL_IDS } = await jiti.import(path.join(root, "lib/room3d/content.ts"));
const { floorItems, laneReport, eyeInFurniture, LANE } = await jiti.import(path.join(root, "lib/room3d/layout.ts"));
const { chordNotes, strumPlan, pluck, midiHz } = await jiti.import(path.join(root, "lib/room3d/chord.ts"));
const { CHORD_IDS } = await jiti.import(path.join(root, "lib/room3d/schema.ts"));
const { DRAW_CAPS } = await jiti.import(path.join(root, "lib/room3d/tiers.ts"));
const { newBall, stepBall, kick, kickFromRay, SLEEP_AFTER } = await jiti.import(path.join(root, "lib/room3d/ball.ts"));
const G = await jiti.import(path.join(root, "lib/room3d/guitar.ts"));
const { THUD } = await jiti.import(path.join(root, "lib/room3d/thud.ts"));
const { modelHeight } = await jiti.import(path.join(root, "lib/room3d/models.ts"));
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
  check("phone drops hideOnPhone, public drops drafts", trimToBudget(hidden, 200, { phone: true, includeDraft: false }).length === objs.filter((o) => !o.hideOnPhone).length - 2);
  check("preview keeps drafts", trimToBudget(hidden, 200, { phone: false, includeDraft: true }).length === objs.length);
}

// the Stage on the kit (round 34): flag, tier from the hub gate, stops, clicks, the Stage's own kinds
check("the room is the default: on with no query and no env", stageKitOn("", undefined) === true && stageKitOn("?x=1", "") === true);
check("?kit=0 (or off, false) is the old scene, ?kit=1 the room", stageKitOn("?kit=1", undefined) && stageKitOn("?kit=true", "") && !stageKitOn("?kit=0", "1") && !stageKitOn("?kit=off", "true") && !stageKitOn("?kit=false", ""));
check("the env can turn it off, the query still wins", !stageKitOn("", "0") && !stageKitOn("", "off") && !stageKitOn("", "false") && stageKitOn("", "1") && stageKitOn("?kit=1", "0") && !stageKitOn("?kit=0", "1"));
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

// round 36: zones, camera rules, reader fallback, content and board layout
{
  const zr = room.zones;
  check("the default room carries its zones as data", Array.isArray(zr) && zr.length >= 6 && zr.length <= 16);
  check("zone ids are unique", new Set(zr.map((z) => z.id)).size === zr.length);
  check("every zone's objects exist in the room", zr.every((z) => z.objects.every((id) => room.objects.some((o) => o.id === id))));
  check("every zone's eye stands inside the room, below the ceiling", zr.every((z) => Math.abs(z.eye[0]) <= room.shell.width / 2 && Math.abs(z.eye[2]) <= room.shell.depth / 2 && z.eye[1] <= room.shell.height));
  check("every zone's named panel exists", zr.every((z) => !z.panel || z.panel === "terminal" || PANEL_IDS.includes(z.panel)));
  check("the zones include the chips the brief names", ["desk", "shelf", "tv", "wall", "door"].every((id) => zr.some((z) => z.id === id)));
  check("every object that opens a panel names a real panel", room.objects.every((o) => !o.interaction || !("cmd" in o.interaction) || !o.interaction.cmd.startsWith("panel:") || parsePanel(o.interaction.cmd) !== null));
  const dupe = clone(ROOM3D_DEFAULT);
  dupe.rooms[0].zones[1].id = dupe.rooms[0].zones[0].id;
  check("duplicate zone ids rejected", !room3dSchema.safeParse(dupe).success);
  const out = clone(ROOM3D_DEFAULT);
  out.rooms[0].zones[0].eye = [9, 1.5, 0];
  check("a zone whose camera would stand outside the room is rejected", !room3dSchema.safeParse(out).success);
  const none = clone(ROOM3D_DEFAULT);
  delete none.rooms[0].zones;
  check("a room without zones still parses and gets the defaults", room3dSchema.safeParse(none).success && orderedZones(none.rooms[0]).length === DEFAULT_ZONES.length);
  const tooMany = clone(ROOM3D_DEFAULT);
  tooMany.rooms[0].zones = Array.from({ length: 17 }, (_, i) => ({ ...clone(zr[0]), id: `z${i}` }));
  check("more than 16 zones rejected", !room3dSchema.safeParse(tooMany).success);
}
{
  const mk = (id, order) => ({ id, label: id, order, eye: [0, 1.5, 0], look: [0, 1, -2], objects: [] });
  const shuffled = { zones: [mk("c", 2), mk("a", 0), mk("b", 1), mk("a2", 0)] };
  check("zones are ordered by `order`, ties keep the stored order", orderedZones(shuffled).map((z) => z.id).join() === "a,a2,b,c");
  const zs = orderedZones(shuffled);
  check("stepping goes forward and wraps at the end", stepZone(zs, "b", 1).id === "c" && stepZone(zs, "c", 1).id === "a");
  check("stepping goes back and wraps at the start", stepZone(zs, "b", -1).id === "a2" && stepZone(zs, "a", -1).id === "c");
  check("an unknown or empty zone id steps to the first", stepZone(zs, "nope", 1).id === "a" && stepZone(zs, null, -1).id === "a");
  const dz = visibleZones(orderedZones(room));
  const walk = [];
  let cur = dz[0];
  for (let i = 0; i < dz.length; i++) {
    walk.push(cur.id);
    cur = stepZone(dz, cur.id, 1);
  }
  check("the desk is first and a full walk forward visits every zone once and returns to the desk", dz[0].id === "desk" && new Set(walk).size === dz.length && cur.id === "desk");
  check("an object maps to the zone that lists it", zoneForObject(dz, "tv")?.id === "tv" && zoneForObject(dz, "board-skills")?.id === "shelf" && zoneForObject(dz, "rug") === null);
}
{
  const a = lookFromDrag({ yaw: 0, pitch: 0 }, 100000, -100000, 800);
  check("look-around is clamped to its limits", a.yaw === LOOK_LIMIT.yaw && a.pitch === -LOOK_LIMIT.pitch);
  const b = lookFromDrag({ yaw: 0.1, pitch: 0 }, 50, 0, 800);
  check("a drag right turns further the same way, proportionally", b.yaw > 0.1 && b.yaw < LOOK_LIMIT.yaw);
  check("a fast long sideways flick steps (left = next), a slow one or a vertical one does not", flick(-160, 10, 200) === 1 && flick(160, 10, 200) === -1 && flick(160, 10, 900) === 0 && flick(40, 0, 100) === 0 && flick(120, 200, 150) === 0);
  check("the field of view widens as the screen narrows", fovFor(1.6) === 34 && fovFor(0.46) > fovFor(1) && fovFor(0.46) <= 70 && fovFor(3) === 34);
  check("a narrow screen stands closer, a wide one does not", approachFor(1.6) === 1 && approachFor(0.46) < 0.8 && approachFor(0.46) >= 0.7 && approachFor(0.9) < 1 && approachFor(1.3) === 1);
  check("easing: reduced motion (rate 0) cuts, otherwise a fraction that grows with dt", damp(0.016, 0) === 1 && damp(0.016, 3) > 0 && damp(0.1, 3) > damp(0.016, 3) && damp(1, 3) < 1);
}
{
  const r = (o) => resolveReader({ search: "", stored: null, saveData: false, webgl: true, lowEnd: false, ...o });
  check("default is the room", r({}).reader === false && r({}).why === "default" && r({}).canEnter);
  check("no WebGL is Reader, and the room cannot be entered", r({ webgl: false }).reader && r({ webgl: false }).why === "no-webgl" && !r({ webgl: false }).canEnter);
  check("no WebGL beats ?reader=0 and a saved room", r({ webgl: false, search: "?reader=0", stored: "0" }).reader);
  check("?reader=1 is Reader, ?reader=0 the room, even over data saver and a saved pick", r({ search: "?reader=1" }).reader && !r({ search: "?reader=0", saveData: true, stored: "1", lowEnd: true }).reader && r({ search: "?reader=1", stored: "0" }).why === "query");
  check("the saved pick wins over data saver and device class", r({ stored: "1" }).reader && !r({ stored: "0", saveData: true }).reader && !r({ stored: "0", lowEnd: true }).reader && r({ stored: "1" }).why === "saved");
  check("data saver falls to Reader, and so does a low-end device", r({ saveData: true }).reader && r({ saveData: true }).why === "save-data" && r({ lowEnd: true }).reader && r({ lowEnd: true }).why === "low-end");
  check("a junk saved value or ?reader= value means no choice", !r({ stored: "maybe" }).reader && !r({ search: "?reader=maybe" }).reader);
  check("low end needs both a low core count and low memory, and unknowns never count", lowEnd({ cores: 2, memory: 2 }) && !lowEnd({ cores: 2 }) && !lowEnd({ memory: 1 }) && !lowEnd({ cores: 4, memory: 2 }) && !lowEnd({}) && !lowEnd({ cores: 0, memory: 0 }));
}
{
  const data = {
    who: "x",
    about: "About text",
    stack: ["TypeScript"],
    contact: [{ label: "mail", href: "mailto:a@b.c" }, { label: "linkedin", href: "https://li.example/x" }, { label: "phone", href: "tel:1" }],
    projects: [
      { slug: "p1", title: "P1", stack: ["TypeScript"], summary: "s1", deployedUrl: "https://p1.example", story: { status: "live-building" }, media: { poster: { src: "/a.png", w: 1, h: 1, alt: "" }, screens: [], clips: [{ id: "c1", label: "Clip", poster: "/p.png", src: "/c.mp4" }] } },
      { slug: "p2", title: "P2", stack: [], story: { description: "d2" } },
    ],
    resume: { name: "N", title: "T", location: "L", summary: "sum", skills: [{ group: "G1", items: ["a", "b"] }, { group: "Empty", items: [] }], experience: [], personalProjects: [], certifications: [{ id: "c-1", issuer: "I", line: "Cert", verify: "https://v.example" }, { issuer: "J", line: "Cert2", verify: "javascript:alert(1)" }], education: [{ degree: "B.Tech", school: "S", year: "2024" }] },
    hiring: { roles: ["Dev"], level: "mid", stack: { core: ["a"], plus: [] }, location: { base: "BLR", modes: ["remote"], relocate: true }, availability: "employed", compensation: "", visa: "", proof: ["p"], links: { resume: "/r.pdf", site: "" } },
    timeline: [{ date: "2020-01", subject: "old", branch: "main" }, { date: "2026-01", subject: "new", branch: "main" }, { date: "2024-01", subject: "graded", branch: "learn", grade: "85%" }],
    book: { label: "Book", href: "https://cal.example/x" },
  };
  const c = buildRoomContent(data);
  check("content: projects carry status, summary and clips", c.projects.length === 2 && c.projects[0].status === "building" && c.projects[0].clips.length === 1 && c.projects[1].summary === "d2" && c.projects[1].status === "dev");
  check("content: empty skill groups are left out", c.skills.length === 1 && c.skills[0].group === "G1");
  check("content: certificates then education, only https verify links", c.credentials.length === 3 && c.credentials[0].verify === "https://v.example" && c.credentials[1].verify === undefined && c.credentials[2].kind === "education");
  check("content: moments newest first", c.moments[0].subject === "new" && c.moments.length === 3);
  check("content: hire has the mail, the book link, the https links only, and no phone", c.hire.mail === "mailto:a@b.c" && c.hire.book?.href === "https://cal.example/x" && c.hire.links.length === 1 && c.hire.where.includes("open to relocate"));
  check("content: a book link that is not https is dropped", buildRoomContent({ ...data, book: { label: "x", href: "javascript:1" } }).hire.book === undefined);
  check("content: an empty data set builds an empty, valid model", (() => { const e = buildRoomContent({ ...data, projects: [], timeline: [], contact: [], book: undefined, resume: { ...data.resume, skills: [], certifications: [], education: [] } }); return e.projects.length === 0 && e.credentials.length === 0 && e.moments.length === 0 && e.hire.mail === undefined; })());
  check("boardItems cap and order", boardItems(c, "projects", 1).length === 1 && boardItems(c, "skills", 8)[0].title === "G1" && boardItems(c, "credentials", 8).length === 3 && boardItems(c, "moments", 2).length === 2);
  check("parsePanel: only panel: ids that exist", parsePanel("panel:hire") === "hire" && parsePanel("panel:nope") === null && parsePanel("now") === null && parsePanel(undefined) === null);
  let layoutOk = true;
  for (const style of ["spines", "frames", "cards", "rows"]) {
    for (const n of [1, 2, 3, 5, 6, 9]) {
      for (const asp of [0.6, 1.4, 2.33]) {
        const rs = layoutBoard(style, n, asp);
        const inside = rs.length === Math.min(n, BOARD_MAX[style]) && rs.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001 && r.w > 0 && r.h > 0);
        const overlap = rs.some((a, i) => rs.some((b, j) => j > i && a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6));
        if (!inside || overlap) {
          layoutOk = false;
          console.log("  layout", style, n, asp, JSON.stringify(rs));
        }
      }
    }
  }
  check("board layouts stay inside the board and never overlap, for every style, count and aspect", layoutOk);
  const rs = layoutBoard("frames", 5, 1.5);
  check("a click's point resolves to the tile drawn there, and to none outside every tile", rs.every((r, i) => pickItem(rs, r.x + r.w / 2, r.y + r.h / 2) === i) && pickItem(rs, 0.001, 0.001) === -1);
}

// round 37a: the bigger room, the dream objects, the constellation rule
{
  const { width: W, depth: D, height: H } = room.shell;
  const byId = (id) => room.objects.find((o) => o.id === id);
  check("the room is about 8.0 x 6.0 x 3.0 m", W === 8 && D === 6 && H === 3);
  const kinds = new Set(room.objects.map((o) => o.kind));
  check("the new objects are there: bed, wardrobe, guitar, riding set, key rack, caps, football, cube, MIDI keyboard", ["bed", "wardrobe", "guitar", "ridingSet", "keyRack", "capRow", "football", "puzzleCube", "midiKeyboard"].every((k) => kinds.has(k)));
  const zr = room.zones;
  check("the new zones exist and the old ids are stable", ["sleep", "wardrobe", "chill", "window", "gear"].every((id) => zr.some((z) => z.id === id)) && ["desk", "screens", "shelf", "tv", "wall", "door", "hire"].every((id) => zr.some((z) => z.id === id)));
  check("every zone has a label for its chip and at most 16 zones", zr.every((z) => z.label.length > 0 && z.label.length <= 30) && zr.length <= 16);
  check("every zone's act names an object of that zone", zr.every((z) => !z.act || (room.objects.some((o) => o.id === z.act) && z.objects.includes(z.act))));
  check("the wardrobe zone opens the wardrobe and the sleep zone strums the guitar", zr.find((z) => z.id === "wardrobe").act === "wardrobe" && zr.find((z) => z.id === "sleep").act === "guitar");
  check("every object sits inside the room (position and its floor footprint)", room.objects.every((o) => Math.abs(o.transform.pos[0]) <= W / 2 && Math.abs(o.transform.pos[2]) <= D / 2 && o.transform.pos[1] <= H) && floorItems(room).every((f) => f.rect.x0 >= -W / 2 - 0.02 && f.rect.x1 <= W / 2 + 0.02 && f.rect.z0 >= -D / 2 - 0.02 && f.rect.z1 <= D / 2 + 0.02));
  const bed = floorItems(room).find((f) => f.id === "bed");
  check("the bed is about 0.9 x 2.0 m (frame 0.98 x 2.06)", bed && Math.abs(Math.min(bed.rect.x1 - bed.rect.x0, bed.rect.z1 - bed.rect.z0) - 0.98) < 0.02 && Math.abs(Math.max(bed.rect.x1 - bed.rect.x0, bed.rect.z1 - bed.rect.z0) - 2.06) < 0.02);
  const wd = byId("wardrobe").params;
  check("the wardrobe is about 1.2 x 0.6 x 2.1 m", wd.w === 1.2 && wd.d === 0.6 && wd.h === 2.1);
  check("the riding set has a helmet, a jacket, pants and boots", ["helmet", "jacket", "pants", "boots"].every((k) => byId("riding-set").params[k] === true));
  check("the key rack's tags come from data (bike and car)", byId("key-rack").params.labels.join() === "Bike,Car" && byId("key-rack").params.keys === 2);
  check("small things hide on a phone (the football shows: the low tier has the room, round 37d)", byId("football").hideOnPhone === false && ["cube", "key-rack", "midi"].every((id) => byId(id).hideOnPhone === true));
  const lane = laneReport(room, LANE);
  check(`the walking lane (${LANE} m) is clear: one connected stretch through the middle`, lane.connected && lane.cells > 200, JSON.stringify({ cells: lane.cells, main: lane.main }));
  check("every floor object can be walked up to", lane.unreachable.length === 0, lane.unreachable.join());
  const items = floorItems(room);
  check("no camera stop stands inside furniture", zr.every((z) => eyeInFurniture(z.eye, items) === null), zr.filter((z) => eyeInFurniture(z.eye, items)).map((z) => z.id + ":" + eyeInFurniture(z.eye, items)).join());
  check("every camera stop's eye keeps 0.15 m from the walls", zr.every((z) => Math.abs(z.eye[0]) <= W / 2 - 0.15 && Math.abs(z.eye[2]) <= D / 2 - 0.15 && z.eye[1] > 0.6 && z.eye[1] < H - 0.3));
  check("every camera stop looks at something at least 1.2 m away", zr.every((z) => Math.hypot(z.eye[0] - z.look[0], z.eye[2] - z.look[2]) >= 1.2));
  // a blocked lane is noticed
  const jam = clone(room);
  jam.objects.push({ ...clone(byId("bed")), id: "jam", transform: { pos: [0, 0, 0], rotY: 0, scale: 1 } }, { ...clone(byId("bed")), id: "jam2", transform: { pos: [0, 0, -1.0], rotY: Math.PI / 2, scale: 1 } });
  check("a jammed lane is reported", !laneReport(jam, LANE).connected || laneReport(jam, LANE).unreachable.length > 0 || laneReport(jam, LANE).cells < lane.cells);
  // budgets: the default room fits every tier's object budget, the phone tier drops the small things
  const phoneLow = trimToBudget(room.objects, ROOM3D_DEFAULT.tiers.low.objectBudget, { phone: true, includeDraft: false });
  check("the room fits the medium and high object budgets and the low one on a phone", room.objects.length <= ROOM3D_DEFAULT.tiers.medium.objectBudget && room.objects.length <= ROOM3D_DEFAULT.tiers.high.objectBudget && phoneLow.length <= ROOM3D_DEFAULT.tiers.low.objectBudget);
  check("the low tier on a phone keeps the bed, the wardrobe and the door", ["bed", "wardrobe", "door"].every((id) => phoneLow.some((o) => o.id === id)));
  // the constellation shows only in the zone that lists it (the page reads this)
  const skyZones = zr.filter((z) => z.objects.includes("constellation"));
  check("the constellation belongs to exactly one zone: the one about skills", skyZones.length === 1 && skyZones[0].id === "shelf" && skyZones[0].panel === "skills");
  const sky = byId("constellation");
  check("the constellation hangs in front of its zone's camera, inside the room, away from the ceiling's light line", sky && sky.transform.pos[1] <= H - 0.5 && Math.abs(sky.transform.pos[0]) < W / 2);
  // data model: a model and a map URL are optional and unused for now
  const withAsset = clone(ROOM3D_DEFAULT);
  withAsset.rooms[0].objects[0].model = "/models/desk.glb";
  withAsset.rooms[0].objects[0].map = "/textures/wood.jpg";
  check("an object may name a glTF model and a texture map (optional, public paths)", room3dSchema.safeParse(withAsset).success);
  for (const bad of ["javascript:alert(1)", "https://example.com/desk.glb", "/models/../secret.glb", "/other/desk.glb", "desk.glb"]) {
    const w = clone(withAsset);
    w.rooms[0].objects[0].model = bad;
    check(`a model path must be /models/... (rejects ${bad})`, !room3dSchema.safeParse(w).success);
    const m = clone(withAsset);
    m.rooms[0].objects[0].map = bad;
    check(`a map path must be /textures/... (rejects ${bad})`, !room3dSchema.safeParse(m).success);
  }
  // the new kinds are strict
  const badChord = clone(ROOM3D_DEFAULT);
  badChord.rooms[0].objects.find((o) => o.kind === "guitar").params.chords = ["H#"];
  check("a guitar chord outside the list is rejected", !room3dSchema.safeParse(badChord).success);
  const noChord = clone(ROOM3D_DEFAULT);
  noChord.rooms[0].objects.find((o) => o.kind === "guitar").params.chords = [];
  check("a guitar needs at least one chord", !room3dSchema.safeParse(noChord).success);
  const longTag = clone(ROOM3D_DEFAULT);
  longTag.rooms[0].objects.find((o) => o.kind === "keyRack").params.labels = ["x".repeat(40)];
  check("a key tag is a short text", !room3dSchema.safeParse(longTag).success);
  const badAct = clone(ROOM3D_DEFAULT);
  badAct.rooms[0].zones[0].act = "x".repeat(60);
  check("a zone's act is an id (at most 40 characters)", !room3dSchema.safeParse(badAct).success);
  const noPants = clone(ROOM3D_DEFAULT);
  delete noPants.rooms[0].objects.find((o) => o.kind === "ridingSet").params.pants;
  check("a riding set without its pants flag is rejected (strict params)", !room3dSchema.safeParse(noPants).success);
  // actions
  check("a guitar click is not a terminal command", stageAction(byId("guitar")).do === "none");
  // the chords
  check("every chord has notes, low to high, inside the guitar's range", CHORD_IDS.every((c) => { const f = chordNotes(c); return f.length >= 4 && f.every((x, i) => x >= 80 && x <= 700 && (i === 0 || x > f[i - 1])); }));
  check("E minor's low string is E2 (82.41 Hz) and A4 is 440", Math.abs(chordNotes("Em")[0] - 82.41) < 0.01 && midiHz(69) === 440);
  const plan = strumPlan(6);
  check("a strum starts the low string first, a few ms apart, and gets no louder", plan.length === 6 && plan.every((p, i) => i === 0 || (p.at > plan[i - 1].at && p.at - plan[i - 1].at < 0.06 && p.gain <= plan[i - 1].gain)));
  const a = pluck(110, 8000, 0.5, 3);
  const b2 = pluck(110, 8000, 0.5, 3);
  check("a pluck is deterministic, finite, bounded and dies away", a.length === 4000 && a.every((x, i) => x === b2[i] && Number.isFinite(x) && Math.abs(x) <= 1) && Math.max(...a.slice(3500).map(Math.abs)) < Math.max(...a.slice(0, 500).map(Math.abs)));
}

// round 37d: assets, draw caps, the look pass, the football, the guitar app
{
  const pub = path.join(root, "public");
  const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
  const files = ["models", "hdri", "audio", "textures"].flatMap((d) => walk(path.join(pub, d)));
  const credits = fs.readFileSync(path.resolve(root, "../docs/claude-planning/15-credits.md"), "utf8");
  const missing = files.filter((f) => !credits.includes("public/" + path.relative(pub, f).split(path.sep).join("/")));
  check("every file in public/models|hdri|audio|textures has a credits line", files.length > 0 && missing.length === 0, missing.join());
  const bytes = files.reduce((n, f) => n + fs.statSync(f).size, 0);
  check(`committed room assets stay under 3.5 MB (${(bytes / 1048576).toFixed(2)} MB in ${files.length} files)`, bytes < 3.5 * 1048576);
  const noLicence = credits.split("\n").filter((l) => l.startsWith("| `portfolio-site/public/") && !/CC0|CC BY|CC-BY/.test(l));
  check("every credits row for an asset names a licence (CC0 or CC-BY)", noLicence.length === 0, noLicence.join());
  const withModel = room.objects.filter((o) => o.model);
  check("every object's model path exists in public/ and its kind has a model slot", withModel.every((o) => fs.existsSync(path.join(pub, o.model)) && modelHeight(o) !== null));
  check("the shell's HDRI exists in public/hdri and is under 1.6 MB", fs.existsSync(path.join(pub, room.shell.hdri)) && fs.statSync(path.join(pub, room.shell.hdri)).size < 1.6 * 1048576);
  check("the guitar samples named in guitar.ts all exist as Ogg files", G.SAMPLES.every((x) => fs.existsSync(path.join(pub, "audio/guitar", x.id + ".ogg"))));
  check("the guitar samples total under 1.2 MB", G.SAMPLES.reduce((n, x) => n + fs.statSync(path.join(pub, "audio/guitar", x.id + ".ogg")).size, 0) < 1.2 * 1048576);
  check("draw-call caps per tier: low <= medium <= high <= 150", DRAW_CAPS.low <= DRAW_CAPS.medium && DRAW_CAPS.medium <= DRAW_CAPS.high && DRAW_CAPS.high <= 150 && DRAW_CAPS.low >= 30);
  check("tiers carry the env map choice: low uses the lightformers, medium and high the HDRI", ROOM3D_DEFAULT.tiers.low.envMap === "lightformers" && ROOM3D_DEFAULT.tiers.medium.envMap === "hdri" && ROOM3D_DEFAULT.tiers.high.envMap === "hdri");
  const bad = clone(ROOM3D_DEFAULT);
  bad.rooms[0].shell.hdri = "https://example.com/x.hdr";
  check("an HDRI path must be /hdri/... (https rejected)", !room3dSchema.safeParse(bad).success);
  check("the white room: the floor is glossy tile and the walls are light", room.shell.floorMaterial === "tile" && parseInt(room.shell.wallColor.slice(1, 3), 16) > 0xd8);
}
{
  const { width: W, depth: D, height: H } = room.shell;
  const world = { W, D, H, boxes: floorItems(room).map((f) => ({ ...f.rect, h: f.h })) };
  const r = room.objects.find((o) => o.kind === "football").params.r;
  const home = [1.2, r, 2.1];
  let worst = true;
  let allSleep = true;
  for (let k = 0; k < 40; k++) {
    const b = newBall(home);
    const ang = (k / 40) * Math.PI * 2;
    kick(b, kickFromRay([Math.cos(ang), -0.2, Math.sin(ang)], 4.2, 2.4, (k % 5) / 2 - 1));
    let t = 0;
    let slept = null;
    for (let i = 0; i < 60 * 40; i++) {
      stepBall(b, 1 / 60, r, world, home);
      t += 1 / 60;
      const ok = b.p.every(Number.isFinite) && Math.abs(b.p[0]) <= W / 2 && Math.abs(b.p[2]) <= D / 2 && b.p[1] >= r - 1e-6 && b.p[1] <= H;
      if (!ok) worst = false;
      if (b.asleep && slept === null) slept = t;
    }
    if (slept === null) allSleep = false;
  }
  check("a kicked football stays inside the room (40 kicks, 40 s each, never NaN)", worst);
  check("every kicked football comes to rest and sleeps", allSleep);
  const b2 = newBall(home);
  stepBall(b2, 1, r, world, home);
  const early = b2.asleep;
  for (let i = 0; i < 60 * 3; i++) stepBall(b2, 1 / 60, r, world, home);
  check("a ball at rest on the floor sleeps after about 2 s, not before", !early && b2.asleep && SLEEP_AFTER === 2);
  const drop = newBall([0, 1.5, 0]);
  let maxUp = 0;
  let prevVy = 0;
  for (let i = 0; i < 600; i++) {
    stepBall(drop, 1 / 120, r, { W: 8, D: 6, H: 3, boxes: [] }, [0, 1.5, 0]);
    if (prevVy < -1 && drop.v[1] > 0) maxUp = Math.max(maxUp, drop.v[1] / -prevVy);
    prevVy = drop.v[1];
  }
  check("a bounce keeps about 0.6 of the speed", maxUp > 0.5 && maxUp < 0.7, String(maxUp));
  const onUnit = newBall([1.4, 0.9, 2.79]);
  for (let i = 0; i < 60 * 5; i++) stepBall(onUnit, 1 / 60, r, world, [1.4, 0.9, 2.79]);
  check("a ball dropped on the TV unit lands on top of it", Math.abs(onUnit.p[1] - (0.42 + r)) < 0.02, JSON.stringify(onUnit.p));
  const nan = newBall(home);
  nan.p[0] = NaN;
  stepBall(nan, 1 / 60, r, world, home);
  check("a NaN position resets the ball to its home", nan.p.every(Number.isFinite) && nan.p[0] === home[0]);
  const k1 = kickFromRay([0, 0.5, -1], 4, 2, 0);
  check("a kick goes away from the camera, flattened, with an upward part", Math.abs(k1[0]) < 1e-9 && k1[2] < 0 && Math.abs(Math.hypot(k1[0], k1[2]) - 4) < 1e-9 && k1[1] === 2);
  check("the kick sound is a short thud (a falling pitch under a third of a second)", THUD.from > THUD.to && THUD.length < 0.3);
  const fb = room.objects.find((o) => o.kind === "football");
  check("the football answers a click and shows on a phone", fb.interaction?.cmd === "kick:football" && fb.hideOnPhone === false);
}
{
  check("six strings in standard tuning, low to high (E A D G B E)", G.OPEN_STRINGS.join() === "40,45,50,55,59,64" && G.STRING_NAMES.join("") === "EADGBe");
  check("a fret adds a semitone to the string's note", G.noteFor(2, 5) === 55 && G.noteFor(5, 12) === 76);
  check("the finger's fret: open before the nut, 1 just after it, 12 at the end", G.fretAt(-0.1) === 0 && G.fretAt(0) === 0 && G.fretAt(0.001) === 1 && G.fretAt(1) === 12 && G.fretAt(5) === 12);
  let exact = true;
  let shrinks = true;
  for (let n = 1; n <= 12; n++) {
    if (G.fretAt(G.fretLine(n) - 1e-6) !== n) exact = false;
    if (G.fretAt(G.fretMid(n)) !== n) exact = false;
    if (n > 2 && G.fretLine(n) - G.fretLine(n - 1) >= G.fretLine(n - 1) - G.fretLine(n - 2)) shrinks = false;
  }
  check("a tap between fret line n-1 and n is fret n, and the spaces shrink toward the body", exact && shrinks);
  let near = true;
  let rates = true;
  for (let s = 0; s < 6; s++) {
    for (let f = 0; f <= 12; f++) {
      const v = G.voiceFor(s, f);
      const smp = G.SAMPLES.find((x) => x.id === v.sample);
      if (Math.abs(smp.midi - v.midi) > 4) near = false;
      if (Math.abs(12 * Math.log2(v.rate) - (v.midi - smp.midi)) > 1e-9 || v.rate < 0.7 || v.rate > 1.4) rates = false;
    }
  }
  check("every string and fret maps to a recorded sample within 4 semitones (fret-exact pitch by playbackRate)", near && rates);
  check("an open string is at most 2 semitones from its sample", [0, 1, 2, 3, 4, 5].every((s) => { const v = G.voiceFor(s, 0); return Math.abs(G.SAMPLES.find((x) => x.id === v.sample).midi - v.midi) <= 2; }));
  const em = G.chordPlan("Em");
  check("a chord strums its sounding strings low to high, 20 to 40 ms apart", em.length === 6 && em.every((n, i) => n.string === i && (i === 0 || (n.at - em[i - 1].at >= 0.02 - 1e-9 && n.at - em[i - 1].at <= 0.04 + 1e-9))));
  check("muted strings are skipped (C has five, D four)", G.chordPlan("C").length === 5 && G.chordPlan("D").length === 4);
  check("every chord the guitar object can name has a shape of six strings", CHORD_IDS.every((c) => G.CHORD_SHAPES[c] && G.CHORD_SHAPES[c].length === 6));
  const t0 = 10;
  const a = G.swipeStart(t0, -Infinity);
  const b3 = G.swipeStart(t0, a);
  const c3 = G.swipeStart(t0, b3);
  check("a swipe starts its strings at least 30 ms apart even when the finger is faster", a === t0 && b3 - a >= 0.0299 && c3 - b3 >= 0.0299);
  check("the neck's marker frets are 3, 5, 7, 9 and 12", G.MARKERS.join() === "3,5,7,9,12");
  const gz = room.zones.find((z) => z.id === "guitar-play");
  check("the guitar's close-up is a hidden stop: no chip, not stepped to, 1.2 m from its subject", gz && gz.hidden === true && visibleZones(orderedZones(room)).every((z) => z.id !== "guitar-play") && Math.hypot(gz.eye[0] - gz.look[0], gz.eye[2] - gz.look[2]) >= 1.2);
}

console.log(failed ? `\n${failed} failing` : "\nall room3d checks pass");
process.exit(failed ? 1 : 0);
