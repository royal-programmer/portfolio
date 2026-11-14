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
const { DEFAULT_ZONES, orderedZones, stepZone, zoneForObject, lookFromDrag, LOOK_LIMIT, flick, fovFor, approachFor, damp } = await jiti.import(path.join(root, "lib/room3d/zones.ts"));
const { resolveReader, lowEnd } = await jiti.import(path.join(root, "lib/room3d/reader.ts"));
const { layoutBoard, pickItem, BOARD_MAX } = await jiti.import(path.join(root, "lib/room3d/board-layout.ts"));
const { buildRoomContent, boardItems, parsePanel, PANEL_IDS } = await jiti.import(path.join(root, "lib/room3d/content.ts"));
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
  const dz = orderedZones(room);
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

console.log(failed ? `\n${failed} failing` : "\nall room3d checks pass");
process.exit(failed ? 1 : 0);
