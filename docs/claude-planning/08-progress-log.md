# 08 — Progress Log

Running record of what has actually landed, so either agent (or a future
session) can resume without re-deriving state. Newest first.

---

## Phase 1 — Engineer in depth (in progress)

### Landed — Claude (data/capture lane)
- `48d643d` entry **slug** (contract + providers + `0005` migration) → clean `/[persona]/[slug]` URLs.
- `d29d87f` **admin write path**: `@supabase/ssr` cookie-bound client (`lib/db/server.ts`),
  `requireAdmin()` guard, `/capture/login` (email+password, single admin), `/capture/admin`
  (create Engineer projects + list existing), server actions (auth re-verified, RLS-scoped
  writes), `0006` admins self-read policy.
- Decisions `D17` (root=engineer, `/whoami`=card hub), `D18` (RLS-scoped admin writes).

### Landed — Cursor (UI lane)
- `21f0556` **project detail pages** `/[persona]/[slug]` + **`/whoami` persona hub**; "View project" now links through.

### Verified
- Full build green (routes: `/`, `/[persona]`, `/[persona]/[slug]`, `/whoami`, `/capture/login`, `/capture/admin`).
- Auth guard smoke test: unauthenticated `/capture/admin` → 307 → `/capture/login`; login renders 200.

### Pending — Ratul (to close the loop)
1. Apply migrations **`0005`** (entry slug) and **`0006`** (admins self-read) in SQL editor.
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
