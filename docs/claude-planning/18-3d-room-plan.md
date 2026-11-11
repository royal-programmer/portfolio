# 18 — The 3D room and the dream room (plan, revised after the Keel critic, 2026-11-11)

Status: **plan only.** Build starts after the Netflix, terminal and hub polish (Ratul, 2026-11-11).
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
