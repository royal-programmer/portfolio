# 08 — Progress Log

Running record of what has actually landed, so either agent (or a future
session) can resume without re-deriving state. Newest first.

---

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
