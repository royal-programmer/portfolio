# 18 — The 3D room and the dream room (plan, revised after the Keel critic, 2026-11-11)

Status (2026-11-14): **P0 done (verdict go, section 11); P1 built; round 34: the Stage can be drawn through the kit behind `?kit=1` (default still the old scene), desktop medium and high at or under 120 draw calls.** Details in `17-persona-views.md` sections 31 and 33.
Owner decisions: rename Stage to **3D**; plan the whole room first; objects are generic (a curved
or 48-inch monitor, not a brand); **every object configurable in the admin console** (position,
size, rotation, add, remove); a **phone option and a quality setting**; the dream room is entered
through **a door**; its contents come later, with a **dream PC setup** fixed; Blender cannot be
installed on Ratul's machine.

References: joanramosrefusta.com (isometric Blender room: arcade machine, whiteboard, shelf, bean
bag) and 3dcyberroom.vercel.app (cyberpunk desk, neon, bloom, curved monitor, shelves).

## 1. Goal and the honest ceiling

Look: good textures, soft shadows, no jagged edges. Performance: 55+ fps at 1280 on an integrated
GPU, a smooth frame on the Vivo X200 Pro, first load under 5 MB.

Both references are almost certainly authored Blender models with baked lighting (the critic's
judgement, to be confirmed with devtools). A parametric kit plus real-time light and ambient
occlusion gives a **clean stylised room, better than today's Stage but not that exact look**.
Detail (cables, clutter, plants) comes from free glTF assets, not from the lighting.

Decisions taken from the critic:
- **No Blender, no cloud baking.** The Actions bake (UV unwrap of parametric geometry, minutes
  per room on a 2-core runner, a dispatch token to store, a script Ratul cannot debug) is dropped.
  Revisit only if the look-dev spike looks flat.
- **Cheap bake substitute in the browser:** drei `AccumulativeShadows` and `ContactShadows`
  accumulate once and then cost nothing per frame.
- **Lighting without a download:** drei `Environment` with `Lightformer`s (0 bytes), not an HDRI
  file (1.5 MB or more of the 5 MB budget).
- **Neon bloom:** emissive above 1.0 with `toneMapped = false` and a luminance threshold; no
  selective-bloom pass.
- **Edges:** SMAA on desktop; MSAA only when no post-processing runs (multisampled targets are
  expensive on phones).

## 2. Data model (one settings key, `room3d`)

Zod-validated, draft / live / history like the rest of the admin console. Today's `stage-data.ts`
constants become the defaults, so nothing changes on day one.

```
room3d = {
  rooms: [{
    id, label,
    shell: { width, depth, height, wallMaterial, floorMaterial, windows: [...], door: {...} },
    lighting: { [clockBand]: { key, fill, rim, ambient, windowLight, lampOn, emissiveBoost } },
    objects: [{
      id, kind, params,                  // params is a discriminated union per kind
      transform: { pos, rotY, scale },   // metres
      material: { preset, color, roughness },
      interaction: { label, cmd | href | card },
      visibility: "public" | "draft",
      hideOnPhone: boolean,
    }],
  }],
  tiers: { dprCap, aoOn, shadowRes, bloomOn, textureSize, objectBudget },
}
```

Rules from the critic:
- **One Zod schema per object kind.** The admin form is generated from those schemas, so a new
  generator needs no hand-built UI.
- **Hard caps:** 200 objects per room, scale range, position inside the shell, units in metres.
- **Never a white screen:** on a validation failure the 3D view falls back to the last good room,
  then to the default room.
- **Unknown assets:** a draft that names an asset not in the catalog drops it and flags it.
- **Phone:** `hideOnPhone` plus an object-budget meter in the admin.

## 3. Objects: two sources

- **Parametric generators (code, no model files).** Desk (straight or L), monitor (inches, aspect,
  curve radius), bed, wall shelf, chair, rug, bean bag, picture frame, lamp, PC tower with a glass
  side and RGB, keyboard, speakers, pot, mug, books. Merged into few draw calls.
- **Curated glTF catalog, committed to `portfolio-site/public/models/`** (CC0 from Poly Haven,
  Kenney, Quaternius; CC-BY only with a credits line in `15-credits.md`). Pre-optimised with
  `gltf-transform` (meshopt, KTX2, triangle and texture caps) before commit, referenced by id with
  licence metadata. **No admin uploads in v1**: that removes the Storage policy surface. If added
  later: public-read, admin-only write by RLS on `storage.objects`, size and MIME limits,
  self-contained `.glb` only, `gltf-validator` in the pipeline, our own decoders, never from a URL.

## 4. Admin editor

**Form editor first, and probably only:** object list, add from a palette, duplicate, remove,
numeric position / rotation / size / params / material / interaction, arrow-key nudge buttons, and
a live preview beside the form where clicking an object selects its row. A phone preview toggle.
A drag-handle gizmo (drei `TransformControls`, snapping, undo) is deferred: about three times the
work, and an editor on a phone is unusable anyway.

## 5. Phone budget (fixed in P1, tested on the real phone)

| Item | Budget |
|------|--------|
| Desktop | 55+ fps at 1280, integrated GPU |
| Phone | about 150k triangles, under 60 to 150 draw calls, dpr cap 1.5, no AO, 1k KTX2 textures |
| First load | under 5 MB; shell and hero desk first, the rest streams in |
| Draw calls | under 120 desktop |

Fill rate, not triangle count, is the phone limit (about 3.5 MP at dpr 3). Handle
`webglcontextlost` and restore. Dispose everything on a room change. Keep the runtime fps
step-down from round 20. Test through `chrome://inspect` on the Vivo X200 Pro. Tiers reuse the
hub gate's Performance / Balanced / Quality choice.

## 6. Dream room

Same engine and schema. **One room mounted at a time**; the door transition disposes the old room
and reuses shared materials and the environment. The dream PC (glass panel, RGB, fans) is a
parametric hero object and the **first thing to look-dev**, because it proves or kills the
quality bet.

## 7. Phases (revised)

| Phase | Deliverable |
|-------|-------------|
| P0 | **Look-dev spike**: one hero corner (desk, curved monitor, neon, lightformer environment, accumulated shadows, the dream PC) on the real phone. Ratul approves the look before any data work. Sets the ceiling and the budget. |
| P1 | Zod schema per kind, room shell and parametric kit rendered from `room3d`, phone budget and tiers wired to the hub gate, last-good fallback |
| P2 | Form editor with live preview, draft / preview / publish, history |
| P3 | Dream room behind the door, with dispose on transition |
| P4 | Curated glTF catalog in `public/models`, interaction cards, credits |
| P5 | Rename to `/engineer/3d`, last, with a permanent redirect that keeps the query string. Until then both names work (`?via=stage&from=engineer` and photo-mode share links already exist). |
| Later, only if wanted | Storage uploads, gizmo editor, cloud baking |

About 3 to 5 builder rounds for P0 to P5. The full plan with gizmo, uploads and baking is 8 or more.

## 8. Risks

- Art quality, not code, sets the ceiling; some signature pieces may need a better asset.
- The two reference sites were not inspected; confirm how they are built with devtools.
- Supabase Storage free limits not checked; not needed while models ship from `public/`.

## 9. Owner decisions, 2026-11-11 (after the critic)

- **Best experience wins.** Where the plan says "clean stylised room first", Ratul chose the best
  experience: P0 look-dev tests both the real-time route and cloud baking, and the better look
  ships. Cloud baking (GitHub Actions, headless Blender) moves from "later" to "decide after P0".
- **Drag handles are in.** The form editor (P2) is followed by the gizmo editor (drei
  `TransformControls`, snap to grid and walls, undo) as P2b. Touch editing stays desktop-first.
- **Swarm is a third view mode**, alongside **3D** and **Netflix**. It is its own view, not a
  replacement for the Stage; the Engineer view picker lists Terminal, 3D, Netflix and Swarm.

## 10. The dream room: Ratul's brief (2026-11-13)

One room, entered through the door from the work room. The same room serves every world; only the light and colour change
(Code: bright daytime; Trader: dim, strong RGB; others later). Everything below is an object in `room3d` (position, size,
rotation, add, remove, hide on phone), so Ratul can rearrange it in the admin.

Desk wall: a **curved monitor in the middle that tilts up and down** (an arm), **two vertical monitors, one each side**, a
full high-end gaming PC (glass tower, RGB fans), keyboard, mouse, mouse mat, headset, a gaming chair.
Wall art: many **anime posters** (Jujutsu Kaisen, Solo Leveling and more), uploaded by Ratul (neutral frames by default).
TV wall: a **very big TV**, a **PS5** with controllers on a low unit, a rug.
Riding wall: a **full riding set** hung up (helmet, jacket, gloves, boots), a key rack with **many bike and car keys**,
**a row of caps** hanging.
Floor and shelf props: a **football**, a **Rubik's cube**, a **guitar** on a stand, a **MIDI keyboard**.
Bedroom side: a **single bed**, a **wardrobe full of clothes** (doors open), **bags with company branding** (a text or
uploaded image per bag, so it shows where he works).

Interactions (ideas, each is data): the curved monitor runs the live terminal and tilts on drag; the guitar and MIDI keyboard
play synthesised notes (Web Audio, no audio files); the Rubik's cube turns on drag; the football bounces on click; the keys
show their labels on hover; each cap and bag shows a label; the riding set opens the rides page; the TV plays a reel of the
project clips; the PS5 links to the gamer world; posters show their titles.

Copyright note: posters are the owner's own uploads; the default is blank frames with a title. Brand marks on the bags are
text labels or images the owner uploads, never bundled logos.

### 10.1 Additions (2026-11-13, later the same day)
- **Two curved monitors stacked** in the middle (one above the other), a vertical monitor on each side; a **tablet** (Xiaomi Pad 5 class, generic) standing on a **dock** in front, and a **phone** (X200 Pro class, generic) on a stand. Object kinds `tablet`, `phone` (no brand marks).
- A **canvas** (a painting on an easel or the wall): an image object whose picture is the owner's, linked to the Artist world.
- A **wall clock** synced with real time: analog face with a sweeping second hand and a digital line; shows the owner's time (Asia/Kolkata) and the visitor's. The room's light follows the visitor's local time; the clock offset is corrected from the server's `Date` header so a wrong device clock still reads right.
- **Entry from a wall door:** click the door, it swings open, the camera moves in; the same door goes back. The room loads lazily on the click; reduced motion cuts the swing.
- **Images:** every image field (posters, canvas, bag logos, TV idle picture) takes an **image URL or an upload**. A URL host must allow cross-origin image use for a texture; the editor says so when a picture cannot load and offers the upload.
- **PS5 turns the TV into a console home screen** whose tiles are the worlds (Engineer, Trader, Photographer, Artist, Rider, Gamer). The TV's idle reel is decided later.
- **Size:** about 6.0 m wide, 5.0 m deep, 2.8 m high, with zones (work, play, rest, ride corner) and a clear walking lane of at least 1.2 m.

## 11. P0 result (look-dev spike, 2026-11-13)

Spike: `/stage-lab` (development only, a production build 404s), code in `app/components/room3d/lab-scene.tsx` and `textures.ts`.
One desk corner: 2.0 m desk, **two stacked curved monitors** (the upper one on a tilt), **two vertical monitors**, a tablet on a dock,
a phone on a stand, keyboard with RGB, mouse and mat, lamp, shelf with instanced books, mug, plant, frame, an office chair, a rug, a
window with sun and a time-of-day tint, a pink and a cyan neon strip, a plant of 26 instanced leaves. Query: `?tier=low|medium|high`,
`?hour=0..23` or `?band=`, `?still=1`, `?shaft=1` (the light shaft; off by default).

Built only from what the plan allows: drei `Environment` + `Lightformer`s (0 bytes), `AccumulativeShadows` (desktop) or one
`ContactShadows` (phone), a 1k or 2k directional shadow map on medium and high, emissive above 1 with `toneMapped = false`, bloom
(`luminanceThreshold = 1`) and SMAA on high, SMAA only on medium, no post-processing on low (MSAA on), procedural canvas textures at
512 px (256 on low): wood grain, woven fabric, a plaster normal map. Rounded boxes for soft edges. `@react-three/postprocessing`
and `postprocessing` were already dependencies, so nothing was installed.

**Verdict: GO.** It clearly beats today's Stage (compare `tmp/r32/stage-today-1280.png`, the Stage's own photo capture: flat grey
shapes, no shadows, no texture, no colour in the light, against `tmp/r32/lab-high-1280.png`: soft contact and floor shadows, window
sun patch, wood grain, glowing neon with bloom, lit screens, a lamp pool). The stacked and portrait monitors, tablet dock and phone
read well at 1280 and at 393. It does **not** need curated glTF props for P1 or for the work room; parametric kinds plus
instancing carry it. glTF is still the right route for the organic or branded pieces of the dream room (guitar, PS5, riding set,
bike), as the plan says (P4).

What reads weak and what to do about it: the plant's leaves are faceted discs (a leaf-card texture or a glTF plant would fix it);
the chair is blocky; wall frames are plain colour until the image field lands; the plaster normal map must stay subtle (at the
first strength it looked like stucco). The light shaft as additive geometry produced a hard diagonal edge and is off by default;
the window's sun patch from the directional light does the job. The monitors' back shell must be an open cylinder (a closed one
fans a cap from the curve's axis, a metre long).

Numbers (renderer.info in the last frame once shadows had accumulated; Chromium headless with SwiftShader, so **frame times are
software-GL and meaningless as device speed, 200 to 800 ms here**; they are listed only to show the relative cost: high is about
4x low at the same page):

| tier | viewport | draw calls | triangles | textures (GPU) | texture memory (est.) | programs |
|------|----------|-----------:|----------:|---------------:|----------------------:|---------:|
| low | 393x852 @3x (canvas 589x1278, dpr cap 1.5) | 83 | 28.9k | 24 | 5.6 MB | 23 |
| medium | 1280x800 | 157 | 59.5k | 49 | 10.3 MB | 36 |
| high | 1280x800 | 174 (shadow-accumulation frames 700+) | 59.6k | 66 | 10.3 MB | 39 |

Bytes: the room ships **0 image or model bytes** (everything is procedural); the 9 MB the script counted is the Next dev server's
unminified bundles, not the production size. Under 4x CPU throttle the low tier's software frame time did not move (the software
renderer, not the page's JS, is the bottleneck), so the throttle numbers say nothing here: the real test is the Vivo X200 Pro
through `chrome://inspect` (not done; no device in this session).

Phone tier settings the spike needs: dpr cap 1.5, no composer (MSAA on), one contact shadow instead of accumulation, no shadow map,
256 px textures, glow sprites instead of bloom, **83 draw calls and 29k triangles is inside the plan's 150k / 150 budget with room
for about 2x more objects**. Medium (SMAA, no bloom, 1k shadow map) is the sensible default for an integrated-GPU laptop; high adds
bloom and the 2k shadow map and should be a visitor choice. Draw calls on medium and high are about double low because of the
shadow-map pass, so the 120-call desktop cap needs instancing for repeated props (books, keys, clothes, caps) as the plan says.
