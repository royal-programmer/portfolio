# 08 — Progress Log

Running record of what has actually landed, so either agent (or a future
session) can resume without re-deriving state. Newest first.

---

## Round B feedback, first pass (2026-11-04)

Ratul's notes on f402f2b, addressed:
1. **Field per persona.** Panes carry their place on the climb (`aC`) and fade by it as well as by
   distance, so the engineer's code is gone before the trader's chapter. The trader's stretch has
   its own panes: eight drawn charts (candles / glowing line, random walk, "+0.8%" the way a journal
   notes it — never currency) and eight numbers ("58% win", "1 : 3 R", "DD 4%"). `makeTraderAtlas`.
2. **Tool and language logos** on the engineer's panes: square icon atlas from
   `public/hub/icons/*.svg`, copied by `scripts/hub-icons.mjs` from simple-icons (CC0) and devicon
   (MIT): TypeScript, Next.js, React, Node, Python, C#, .NET, Java, VS Code, Cursor, Claude, Git,
   Docker, PostgreSQL, Supabase, Three.js. Licences in `15-credits.md`; console credits in round D.
3. **The lit laptop invites the click:** a soft halo behind the lid and a breathing bezel light in
   the engineer's blue, both stronger under the pointer; the screen brightens too.
4. **Hold and move = look while time is slow.** Dragging no longer cancels the hold: the 260 ms
   hold starts slow time, moving after that turns the view (`dragging` and `holding` together).
   Moving before the hold lands is still a plain drag.
5. **Back from a world** came back to a blue page (the browser restores the page from its cache
   mid-flight). `pageshow` with `persisted` resets portal / entering state and resumes the audio
   context. After a reload the context starts suspended: `ambient.resume()` on the first
   pointer-down or key.
6. **The drone buzzed:** the 82 Hz triangle is a sine now, levels trimmed.
7. **Exit is dark, not blue:** the camera still dives into the screen; the cover is the void with
   one small breathing light in the world's colour (from 0.8 s before the leave). The engineer
   world's own dark opening comes with its redesign.
8. **Lens keys on the climb:** `-` pulls the view wide (watch the assembly whole), `+` tightens,
   `0` resets. Ctrl +/− stays the browser's zoom on purpose.
- Open: a music player (needs Ratul's pick of source: YouTube IFrame + Data API key, or paste-a-link);
  returning from a world should land on that world's section; the parts fly in at the frame's edge
  on the approach (the laptop enters the view at c ≈ 1.85) — zoom out to watch them meet.

---

## Round B: the climb, the object field, the engineer's laptop (2026-11-04)

D38 round B shipped on `phase-0-content-engine`. The doorway pattern is proven end to end.
- **One helix for everything** (`vr/util.ts` `climbPose(c)`): the camera's position, heading and
  pitch at scroll progress `c` (page sections). The Director and the field read the same curve, so
  what the camera meets is always in front of it. Turn per section eased from 162° to 90° — at 162°
  "ahead" swung out of view before the parts could arrive.
- **Object field** (`vr/field.tsx` `Slabs`): one instanced draw of glass panes with real content from a
  2048 × 1024 canvas atlas (`vr/screens.ts`): eight editor tiles showing this site's own source
  (fluid shader, `climbPose`, the sound engine, the Director) and eight code glyphs. Rounded-rect SDF,
  colour fringe, rim in the persona's colour, fog by camera distance (4 → 15 units). Each pane sits
  ahead of the camera's own pose at its point on the climb, so panes drift in and out of the dark.
- **Engineer assembly** (`EngineerAssembly`): a laptop built in code (base, lid, 70 instanced keys,
  trackpad, screen) whose parts hang loose half a section before the peak, fly together as the camera
  reaches the section (`gather` = 1 − smoothstep(|c − c₀|, 0.22, 0.95)), unfold (lid 104°), power on
  (boot line opens into the editor, key backlight), hold while |c − c₀| < 0.22, then drift apart ahead
  again. The laptop's screen is a drawn editor of `fluid.ts` with tabs and a status bar;
  `LAPTOP_SCREEN_SRC` swaps in Ratul's own screenshot once `public/hub/engineer/` has one.
- **The doorway:** the lit screen is raycast against the pointer each frame (`state.portalHover`);
  the Director toggles `html.is-portal-hover` + `--portal-c` so the cursor ring opens in the world's
  colour. A tap (page `up` handler) → `enterWorld`: `state.portal = {slug, at}`; the Director flies the
  camera into the screen over `PORTAL_LENGTH` 1.6 s (position lerps to 0.18 in front of the glass,
  heading turns to face it, FOV −14°, parallax/drag fade out), the HTML fades (`is-entering`), the
  world's colour rises over the last 0.6 s, then `personaHref` → full navigation to
  `code.<root>` (or `router.push` on unrouted hosts). Scroll is locked while leaving.
- Pointer-down now records the point too, so a finger tap (no move) can hit the doorway.
- Narrow screens: the laptop moves toward the centre and further away (`anchor` depends on aspect).
- Numeral "01" hidden in immersive mode (the objects carry the chapter now).
- Screens use the site's mono face: `--font-geist-mono` read off the root; textures redraw on
  `document.fonts.ready`.
- Measured (Intel UHD, dev, Performance, 1440×860): 59–60 fps on the climb with the field, the laptop
  and the fluid composer on. Verified by script: hover → `is-portal-hover`; click → flight → lands on
  `http://code.ratulroy.localhost:3000/`.
- Lessons: the camera's yaw is a left-handed turn (`dir = (sin yaw, ·, −cos yaw)`), so an object that
  must face back along the path takes `rotation.y = −yaw` — the first build had every pane and the
  laptop edge-on. Canvas rows count from the top; texture `v` from the bottom (atlas tile rows flipped).
  Playwright screenshots take ~1.2 s on this machine: to inspect a 1.6 s flight, freeze it by giving
  `state.portal.at` a getter.
- Open for round C/D: the other five assemblies; returning from a world should land on that world's
  section (today: hero); the drifting field is engineer-only, the gaps between personas are still rays.

---

## Round A feedback, second pass (2026-11-04)

Ratul's notes on 4451890, all addressed:
1. **Page opens on the loader.** The gate's still parts (wordmark, headline, "Gathering light") are
   server-rendered inside the boot cover (`GateSkeleton`), so the first paint IS the loader; the live gate
   fades in over it in the same places (gate-rise no longer blurs/translates). Hidden when the saved mode is Normal.
2. **Slow time readout:** the ring tightens to a small circle, the dot stays, and `time ×0.27` sits beside
   it — no arc, no percentage, no caption. Director writes `--tscale`.
3. **Fluid cursor** (`vr/fluid.ts`): a 160 px GPU sim (velocity + dye + hue, vorticity confinement, no
   pressure solve) stirred by the pointer, applied as a `postprocessing` Effect that bends the frame along
   the flow and adds the dye as light. Runs in light-time (holding freezes the swirls). The composer now
   runs at every quality level so Performance has it too (bloom/CA/noise still off there; MSAA 2).
4. **Descenders** no longer clipped: SplitText masks get `linesClass: "split-line"` → GSAP names the mask
   `split-mask-line-mask`, padded 0.12em/0.2em with negative margins; words enter from 125 %.
5. **Sound:** `timeScale` now follows the scene's real time scale (glides): pitch −700 cents, filter
   closes, a 36 Hz sub swells, a thin beating shimmer surfaces. `rush(speed)` raises the wind during the
   approach; `impact()` = sub drop 90→36 Hz under the chime.
6. **Copy:** "Put on the headset" · "Or proceed without the headset →" · "Every perspective begins with
   the same sight." Eyebrow "You are the prism" and the explaining body line removed (no spoon-feeding).
7. **Graphics setting is sticky:** a level the visitor set by hand (cookie present) is never changed by
   the governor — it toasts once ("Running below 40 fps — Balanced would be smoother") instead. The
   governor's own step-down is session-only (`setQuality(q, false)`), so it never masquerades as a choice.
8. **The split is continuous:** impact raises a *white pillar* (beams bundled on the axis, `spread 0`,
   `chroma 0`), the approach glare thins out over 2.2 s, then over the 5.2 s split the beams fan out
   (`spread`) and the colour separates inside them (`chroma`, later for beams near the axis) while the
   camera rides the J. Flash shortened to a 1.1 s bloom at 0.95 so the pillar is seen through it.
- Measured (Intel UHD, dev, Performance, 1440×860): 60 fps gate/sky/approach, 56–60 fps climb, with the
  composer + fluid on. Fluid sim 160×96 texels.
- Lessons: fresh render targets are not cleared — clear them once or the sim starts from driver garbage
  (fog everywhere). Vorticity strength 38 blows up a sim with no pressure projection; 7 with a velocity
  clamp of 0.3 holds. `blendMode.opacity = 0` on a postprocessing Effect is not a clean A/B (frame went black).
- Known: the dev server stalls for minutes when Supabase DNS fails (content fetch has no timeout/fallback) —
  still on the pre-launch list.

---

## Round A feedback fixes (2026-11-03)

Ratul: "looks awesome now" + five notes. Done:
1. **No glimpse of the old view before the gate** — a void cover (`.hub-boot`) is in the server HTML and
   only fades once the page has decided how to open; the Normal poster stays hidden until then.
2. **Graphics setting labels:** Performance · Balanced · **Quality** (was "Best"); top bar says "Graphics · …".
3. **Type:** display face is now **Fraunces** (variable: opsz 144, SOFT 60, WONK 1, weight 330) via
   `next/font/google`; hero headline no longer `nowrap`, max size 7 rem, so nothing clips.
4. **Slow-time ring:** while holding, the cursor grows an arc that fills with the real time scale and shows
   the percentage (Director writes `--slow` 0–100 on `<html>`; the cursor reads it each frame).
5. **Company in the sky** (`vr/space.tsx`, all in code): shooting stars, two planets (one ringed, lit from
   the light's side), a satellite with a blinking lamp on a slow arc, a tiny rocket crossing far away with
   an exhaust glow. Scaled by sky visibility so they never compete with the light.
- Lesson: `active` is a reserved word in GLSL (shader failed → gate said 3D couldn't start). Caught by
  `ContextWatch`, which is exactly what it is for.

---

## VR journey round A: headset → sky → the light → the split (2026-11-03) — D38

- **Scene rewritten** as `app/components/hub/vr/*` (replaces `hub/journey/*` and `entry-gate.tsx`):
  `state.ts` (phases: gate · wear · blink · sky · approach · impact · split · climb), `clock.ts`,
  `headset.tsx` (own design in code: rounded dark-glass visor, one light strip, two lens rings, head band;
  RoomEnvironment reflections, nothing downloaded), `sky.tsx` (dome + twinkling stars, spectrum tint while
  climbing), `light.tsx` (approaching light with rays and a colour-splitting rim; cone of colour; **Rays** —
  instanced beams fanning up from the apex so the inside of the cone is made of light; photons),
  `scene.tsx` (Director: time, phase timeline, J-path camera, spiral climb; Effects; Governor; Warmup).
- **Gate** is now `headset-gate.tsx`: the headset floats in the scene behind a quiet overlay (device line,
  quality slider, "Best with sound", Normal link). Click the headset / Enter / Space → `wear` (turns to face
  you, rises, lenses fill the view, lids close) → `blink` (eyes open onto the sky) → `sky` ("Press Space" /
  "Tap") → `approach` (≈7.3 s, slow then rushing; hint "Click and hold to slow it down" at 28–90 %; hold
  → time scale 0.1) → `impact` (white flash, chime) → `split` (3.4 s J: forward then up to 78°, cone and
  rays open) → `climb` (scroll unlocked, hero text rises). "Skip intro" visible from the first second of
  wear. Returning visitors in the same session land on the climb (`returning` loader, Skip → Normal).
- **Climb (placeholder until round B):** helix inside the cone, camera tilting back to level over the first
  section, sky tinted by the nearest persona's spectrum position. Page sections are unchanged HTML.
- **Measured (Intel UHD laptop, dev build, 1440×860, Performance):** 60 fps at the gate, during the approach
  and on the climb; 53 fps while the test harness polled every 50 ms. Gate ready ≈1.5 s. No horizontal
  overflow at 500 px (the tool's narrowest window).
- **Lessons:** `ConeGeometry` uv.y is 1 at the apex — my glow was 140 units away until flipped. Looking up
  inside a cone shows only a ring at the edge; the split needs volume (rays), not just a wall. The
  screenshot tool lags ≈3 s, so sub-2 s phases were captured by freezing `phaseAt` from inside the page
  (`window.__vr`, dev only). A Supabase DNS blip (`ENOTFOUND`) 500s the whole hub — content fallback to
  stubs when the provider is unreachable is worth doing before launch.
- **Next:** round B — the drifting object field + the engineer laptop assembly with click-into-screen; the
  climb camera and cone-wall brightness will be retuned around the objects.

---

## Hub concept reset: the VR journey (2026-11-03) — D38

- Ratul reviewed round 1: good, "not out of the world". Over several messages we agreed a new hub concept;
  the complete spec is `14-vr-journey-concept.md` (flow, persona order and assemblies, rights, perf, Normal
  mode, rounds A–D). Round-1's prism/river scene will be replaced; the gate, quality slider, governor, light
  cursor, sound and Lenis/GSAP stack carry over.
- Decisions inside D38: no on-screen HUD text; Ratul's own screenshots of VS Code / TradingView / Valorant /
  CS2 etc. allowed; hub trading numbers illustrative (percentages only); ride routes as light lines (no map
  tiles); CC0-only 3D models restyled in our material; all credits in the browser console.
- Ratul is collecting screenshots in `Desktop/portfolio-shots` for round B.
- **Next:** round A (headset gate + wear, night sky, Space/Tap, accelerating light + hold-to-slow, head-on
  impact, J-split into the cone). Ratul may switch the builder model to Fable for it; everything needed is
  in D38 + doc 14.

---

## Hub round 1: the light journey (2026-11-03) — D36, D37

- Deps (`chore(config)`): gsap 3.13 (ScrollTrigger + SplitText), lenis 1.3.
- **Entry gate** (`app/components/hub/entry-gate.tsx`): device analysis (`lib/site/device.ts`: WebGL
  renderer → tier → suggested quality), quality slider, Enter (progress while the scene compiles behind
  the gate) / Normal (instant); "taking longer than usual" after 9 s; WebGL missing/failed said plainly.
  Returning visitors in the same session get the compact loader (auto-enters, Skip always visible).
- **Modes:** `lib/site/experience.ts` rewritten — `immersive | normal` + quality + sound cookies on the root
  domain; no Auto. `experience-toggle.tsx` → `experience-controls.tsx` (ModeSwitch, QualityMenu, SoundToggle).
- **Scene** (`app/components/hub/journey/*`, replaces `refraction-scene.tsx`): beam with haze + pulses,
  impact flash + sparks, custom glass shader (analytic per-channel refraction, AA edges, internal light
  path; no transmission buffer → no grain), camera path through the prism onto a river of colour,
  photons along each stream, cursor-reactive dust, a world teaser per persona (lattice / candles /
  aperture), closing fold to white. Drag = look around (springs home), hold = slow time.
  Shader compile errors / context loss → graceful "3D couldn't start" + Normal.
- **Page:** Lenis smooth scroll, GSAP word-mask reveals, light cursor, synthesised ambient sound.
- **Measured (Intel UHD 620-class laptop, dev build):** ready behind the gate in ~1.6 s; Performance 60 fps
  at 1440×860; Balanced ~40 fps (bloom), so the device analysis correctly suggests Performance here.
  Mobile (390 px emulated): no horizontal overflow, gate fits one screen.
- **Lessons:** `THREE.Color` can't parse CSS `hsl(h s% l%)` (silently white) — use `setHSL`.
  `modelMatrix` isn't available in fragment shaders. Background tabs throttle rAF (check focus before
  trusting fps).
- **Next:** round 2 = Normal mode with full motion (replace the static poster) + ending polish;
  round 3 = portal into each world (D37), richer world scenes, phone tuning, sound design.

---

## Design pass 2: 3D "Refraction" hub (2026-11-02) — D32–D35

- Deps (`chore(config)`): three, @react-three/fiber 9, drei 10, @react-three/postprocessing 3.
- `app/components/hub/refraction-scene.tsx` (lazy, Immersive only): falling beam → glass prism
  (MeshTransmissionMaterial, procedural Lightformer env, no network assets) → shader-drawn
  continuous spectrum fan with persona bands (any count, MAX_BANDS 16); dust; cursor parallax;
  camera follows the chapter in view; closing chapter folds the spectrum back to white.
- `refraction-poster.tsx`: static SVG of the same composition = Lite backdrop + first paint.
- `hub-experience.tsx`: scroll chapters, spectrum rail, cycling phrase (screen readers get one
  sentence), per-world CTAs; `lib/site/spectrum.ts` (t → colour, auto-spread + pins, GLSL mirror).
- **Perf (Intel UHD laptop, 1080p):** bloom was the cost (32 → 60 fps without). Now half-res
  bloom + `QualityGovernor`: 4s warm-up, drop bloom if < 45 fps sustained, Lite if < 28 fps
  without bloom; windows with frame gaps > 250 ms (hidden/throttled tab) are ignored — drei's
  PerformanceMonitor degraded on warm-up jank and on background tabs. Measured 56–58 fps.
- Dev on a TLS-intercepting network: run `NODE_OPTIONS=--use-system-ca npx next dev --webpack`
  (Node trusts the Windows store; never NODE_TLS_REJECT_UNAUTHORIZED=0).
- Tooling note: background Chrome windows are rAF-throttled to exactly ~1016 ms/frame — check
  frame gaps before trusting any fps number.
- Next: portal transition on CTA (fly along the band + colour flood), persona content fields
  in the DB (phrase/CTA/pin/links), per-world 3D motifs, Engineer world redesign.

## Design pass 1: hub + experience modes (2026-11-02)

- **Design system v2** tokens in `globals.css`: void/ink base, one wavelength per persona
  (`--wl-*`), fluid type scale `--step-*`, motion `--ease-*`/`--dur-*`; display face
  Instrument Serif (`font-display`). Legacy tokens stay until each world is rebuilt.
- **Experience modes (D26):** `lib/site/experience.ts` + `app/experience-provider.tsx` +
  `ExperienceToggle`. Pre-paint boot script; Auto → Lite on reduced motion / data saver /
  2g-3g / <4GB / <4 cores; cookie on the root domain (verified shared hub ↔ `code.`).
  CSS hooks: `.xp-motion`, `.xp-immersive-only`, `.xp-lite-only`.
- **Hub** (`app/components/hub/prism-hub.tsx`, served at the root / `/whoami`): beam → prism →
  rays in spectral order onto doors; unlaunched personas = unlit rays; stacked layout < lg.
- Perf: glow moved from SVG `feGaussianBlur` to a CSS-blurred composited layer; 59 fps in
  Immersive (DevTools Chrome). Note: the Playwright window gets rAF-throttled to ~1 fps when
  in the background — don't trust its fps numbers.

## Persona subdomains (2026-11-02) — D31

- `proxy.ts` (Next 16 "proxy" = middleware) + `lib/site/hosts.ts` (subdomain ↔ persona map,
  `NEXT_PUBLIC_ROOT_DOMAIN`, dev root `ratulroy.localhost`) + `lib/site/persona-link.tsx`
  (`PersonaLink`/`HubLink`: same-host → client nav with clean paths, other host → full nav).
  All persona links in `app/**` migrated.
- Verified in dev (curl + Playwright): hub `/` → whoami; `/engineer/x` on hub → `code.` host;
  `code.` `/roster` client-nav works; cross-persona → other subdomain; `www.`/`who.` → root;
  `trader.` → `trade.`; unknown label → "persona not found"; `/capture` → root host;
  plain `localhost:3000/engineer` unchanged. 0 console errors.
- Gotcha: Next relativises redirect `Location` when the target equals its own origin
  (`localhost`) → hub on plain localhost would loop; hence the `ratulroy.localhost` dev root.
- Not yet: domain purchase + Vercel domain/DNS; persona switcher in `home-page.tsx` still
  swaps in place (no host change) — replaced in the redesign; shared experience-mode pref
  needs a parent-domain cookie.

## Ownership change (2026-11-01)

- Ratul: **Claude takes over the frontend** — owns all of `portfolio-site/`; Cursor
  becomes reviewer (read-only, notes in `docs/reviews/`). See 09 (update) + AGENTS.md.
- Found: `phase-0-content-engine` (28 commits since July) was **never pushed** —
  GitHub has only `main`. Secret scan of those commits: clean. Push pending Ratul OK.

## Dev tooling (2026-11-01)

- Project `.mcp.json`: Playwright MCP + Chrome DevTools MCP (+ Supabase MCP). They use
  **globally installed** binaries (`npm i -g @playwright/mcp chrome-devtools-mcp`) —
  `npx …@latest` took ~35s per launch here and blew the 30s MCP startup limit.
  `MCP_TIMEOUT=120000` set in `.claude/settings.local.json` (Node startup is slow on this machine).
- Branch pushed; **PR #1** open → `main`. Merge held until Vercel has the Supabase env vars
  (`main` auto-deploys to production).

## Restart + replan (2026-11-01)

- Supabase free project had **auto-paused** (inactivity) → DNS NXDOMAIN → every
  public page 500'd. Ratul resumed it; `verify-db.mjs` → **ALL CHECKS PASSED**
  (script fixed: probe insert now sets `slug`, required since `0005`).
- Dev server hung compiling `/`: a stray `~/package-lock.json` made Next infer the
  home dir as root → pinned `turbopack.root` (`d946095`). Dev currently run with
  `next dev --webpack` (faster/more reliable on this machine).
- **New plan:** [11-replan-2026-11.md](./11-replan-2026-11.md) — stabilize →
  design system v2 → Engineer contract → 3D/immersive Engineer PoC → persona
  "world transitions" → other worlds → launch quality.
- **Requested from Ratul:** approve keep-alive + backup GitHub workflows (`.github/`
  is outside both lanes).

---

## Phase 1 — Engineer in depth (in progress)

### Landed — Claude: media upload pipeline (2026-07-20)

Ships the reusable image pipeline (D19). Fully verified against the live DB.

- **Deps** (`chore(config)`): `sharp` (derivatives) + `exifr` (EXIF); `next.config.ts`
  `serverExternalPackages: ["sharp"]`.
- **`supabase/migrations/0007_media_storage.sql`**: `originals` (private) + `media`
  (public) buckets; storage RLS — admin-only writes via `is_admin()`, public read on `media`.
- **`lib/media/config.ts`** (buckets, derivative specs, accepted types, size cap) +
  **`lib/media/pipeline.ts`** — `ingestImage(client, params)`: downloads original →
  sharp thumb(400)/optimized(1280)/full(2400) WebP, auto-oriented → uploads derivatives →
  `exifr` EXIF+GPS → inserts media row. Transport-agnostic; caller supplies the client
  (server action = RLS session client; script = service role).
- **`lib/db/browser.ts`** — session-bound browser client for direct-to-storage upload
  (bypasses the Vercel ~4.5MB body limit; no service key in the browser).
- **`app/capture/actions.ts`** — `createProject` now returns `entryId`; new
  `registerUploadedMedia({entryId, originalPath, …})` verifies admin, runs the pipeline,
  revalidates the persona/detail/admin paths.
- **`app/capture/admin/media-uploader.tsx`** + wired into `project-form.tsx` — after a
  project is created, upload images (direct to `originals`, then finalize) with per-file
  status + thumbnails.

**Verified:** `scripts/verify-media.mjs` (live) — buckets present, original uploaded
private, thumb+optimized+full generated, optimized publicly fetchable (200/webp), original
NOT publicly fetchable (400), EXIF path graceful, anon sees public media via the entries
join, temp data cleaned up → **ALL CHECKS PASSED**. Full `npm run build` green; `tsc`
clean; lint clean on changed files.

**Provider note for Cursor:** no contract change needed — `supabase-provider` already
selects `media(*)` and maps it (sorted by `order`), so `entry.media` is populated the
moment images are ingested. Build carousels straight off `entry.media[].thumbUrl /
optimizedUrl / fullUrl` (+ `width`/`height` for aspect ratio, `alt`).

### Pending — Ratul (to enable the uploader)
1. **Apply `0007`** in the SQL editor. The smoke test already created the buckets, but only
   `0007` installs the RLS **policies** that authorize the admin *session* to upload from the
   browser. Until then `/capture/admin` image upload fails RLS (service-role scripts still work).
2. Then in `/capture/admin`: create a project → add an image → confirm the thumbnail renders,
   and that `entry.media` shows on `/engineer/<slug>` once Cursor's gallery lands.

### Landed — Claude (data/capture lane)
- `48d643d` entry **slug** (contract + providers + `0005` migration) → clean `/[persona]/[slug]` URLs.
- `d29d87f` **admin write path**: `@supabase/ssr` cookie-bound client (`lib/db/server.ts`),
  `requireAdmin()` guard, `/capture/login` (email+password, single admin), `/capture/admin`
  (create Engineer projects + list existing), server actions (auth re-verified, RLS-scoped
  writes), `0006` admins self-read policy.
- Decisions `D17` (root=engineer, `/whoami`=card hub), `D18` (RLS-scoped admin writes).

### Landed — Cursor (UI lane)
- `21f0556` **project detail pages** `/[persona]/[slug]` + **`/whoami` persona hub**; "View project" now links through.

### Landed — Claude: multi-agent collaboration protocol (2026-07-20)
- Root **`AGENTS.md`** (lane map + hard rules, auto-read by both agents) + root `CLAUDE.md`
  loader; **`.cursorrules`** mirror for Cursor; rationale in
  `docs/claude-planning/09-collaboration-protocol.md` (locks rejected → partition + enforcement).
- **Mechanical enforcement (Claude side):** `.claude/hooks/lane-guard.mjs` PreToolUse hook
  blocks Claude Edit/Write into Cursor lanes (`app/**` minus `api/` + `capture/` carve-outs);
  registered in `.claude/settings.json` (project-shared). Negotiated exceptions via the
  script's `OVERRIDES` list, Ratul-approved only.

### Agreed — UI roadmap coordination (2026-07-20)

Cursor proposed engineer-page phases: **A** responsive density (wider shell ~1400–1600px,
featured layout for sparse grids, mobile pass) → **B** project-card media carousel +
detail gallery/video → **C** quick links / resume CTA / certifications + **C2** career
timeline + **C3** recent-blog strip → **D** GitHub stats panel → **E** polish.

Verified against the contract — Cursor's dependencies on Claude's lane:

| Needs | Status | Claude action (priority order) |
|-------|--------|-------------------------------|
| `entry.media` populated | Contract ✅, pipeline ❌ | **1. Media upload pipeline** (buckets: private originals + public derivatives, admin upload, thumb/optimized). Same pipeline Photography needs later. |
| Profile links / resume URL | ❌ not in contract | **2. Contract additions:** `Persona.links[]`, `resumeUrl`; new entry types `certification` + `milestone` (+ migration + admin). |
| Cert/experience types | ❌ not in contract | (same as above — `milestone` powers the career timeline) |
| `getGitHubStats()` | ❌ doesn't exist | **3. Cached server accessor**, GitHub API + optional token env. |
| Blog strip (`listBlogPosts`) | ✅ live already | None — buildable now, empty-state until posts exist. |

Sequencing agreed-in-principle: **Cursor does Phase A now (zero Claude deps) while Claude
lands items 1–2 in parallel; Cursor does NOT scaffold Phase C against guessed shapes** —
contract types land first, then C builds on real types (avoids rework).

Recommendations relayed to Ratul on Cursor's open questions: width "comfortably wide"
(~1400–1600px) not full-bleed; hover-only auto-cycle + tappable dots on mobile;
**omit exact DOB from the public timeline** (privacy; start at school / "first line of
code"); timeline teaser below projects, subpage if it grows; blog = 3-card row, no carousel.

### Verified
- Full build green (routes: `/`, `/[persona]`, `/[persona]/[slug]`, `/whoami`, `/capture/login`, `/capture/admin`).
- Auth guard smoke test: unauthenticated `/capture/admin` → 307 → `/capture/login`; login renders 200.

### Pending — Ratul (to close the loop)
1. ✅ ~~Apply migrations `0005` (entry slug) and `0006` (admins self-read)~~ — applied 2026-07-20.
2. `npm run dev` → visit `/capture/login`, sign in (your admin email + password), create an
   Engineer project (set visibility **public**), then check it renders on `/engineer` and its
   detail page at `/engineer/<slug>`.
3. `.mcp.json` (from `claude mcp add`) is untracked — decide whether to commit it (project-scoped MCP config; contains the project ref, no secrets).

---

## Phase 0 — content engine (COMPLETE, verified)

**Branch:** `phase-0-content-engine` (shared working repo; not yet pushed).

### Landed — Claude (data lane: `lib/**`, `supabase/`)

| Commit | What |
|--------|------|
| `a2aa4a4` | `.env.example` (var names, no secrets) + `.gitignore` exception; **shared contract** `lib/content/types.ts` |
| `bdf4d55` | Callable **stub `ContentApi`** over fixtures (`fixtures.ts`, `stub-provider.ts`, `index.ts`) |
| `291c6cd` | **Supabase schema** SQL: `0001` tables, `0002` RLS + policies, `0003` persona seed, `supabase/README.md` |
| _(this batch)_ | **Supabase provider** + `lib/db/client.ts` (public/admin clients); `index.ts` auto-selects provider by env |

**Data layer is code-complete for Phase 0.** Import everything from `@/lib/content`.
Providers swap automatically: no Supabase env → stub fixtures; env present → DB.

### Landed — Cursor (UI lane: `app/**`)

| Commit | What |
|--------|------|
| `6e87436` | `/[persona]` deep links, session restore, invalid-persona page; `home-page.tsx` extracted from `page.tsx`; `page.tsx` now a thin wrapper |

Decisions confirmed: slug stays **`photographer`**; invalid/unlaunched slugs keep the
bad URL and show the funny page; Home still uses hardcoded `PERSONA_CONTENT` (not yet
wired to `ContentApi`).

### ✅ LIVE DB VERIFIED (2026-07-19)

`node scripts/verify-db.mjs` → **all checks passed** against the real Supabase
project (`wgvwwiqromxlrocpnsoc`):
- anon sees only the 3 published personas (RLS read filter) ✅
- service_role sees all 6 (grants + RLS bypass) ✅
- a private entry is invisible to anon (visibility gate holds) ✅

Required an extra migration `0004_service_role_grants.sql` (auto-expose-off had
stripped service_role's table grants).

### Done — Ratul (external setup)

1. ✅ Applied migrations `0001 → 0004` (SQL editor).
2. ✅ Email auth on, public sign-ups off.
3. ✅ Admin user created + registered in `admins`.
4. ✅ `portfolio-site/.env.local` set. ⏳ Vercel env deferred to deployment time.

### Pending — Cursor (UI lane)

- Wire `home-page.tsx` to `ContentApi` (`getPersona` / `listPersonas` from
  `@/lib/content`), replacing hardcoded `PERSONA_CONTENT`. Accessors are live now.
- Engineer projects grid → `listEntries("engineer")`.
- Experience / Skills / Certs multi-page nav (later).

### Pending — Claude (data lane, next)

- Server actions for writes (capture/admin) using `adminClient`.
- Harden `app/api/lead` + `app/api/chat` stubs (validation, rate limiting) — **Claude
  owns `app/api/**` per lanes**; coordinate so this doesn't collide with Cursor.
- Media upload pipeline (originals private + optimized derivatives) — later phase.

### Follow-ups / risks noted

- ⚠️ Build logs show `NODE_TLS_REJECT_UNAUTHORIZED=0` set in the environment
  (disables TLS cert verification). Track down its source and remove — real security
  risk. Not blocking Phase 0.
