# 05 — Architecture

How the pieces fit. Headline decision: **one application, two surfaces** — a public read surface and an authenticated capture surface — over one content engine.

---

## One app, not many

Ratul floated `trading-portfolio/journal`, `photography-portfolio/upload`, `rider-portfolio/ride` as sub-applications. The right realization of that idea is **route-groups inside the single Next.js app**, not separately deployed apps:

```
/                       → home / persona chooser (easter-egg unified view)
/[persona]              → public persona landing page (engineer, trader, ...)
/[persona]/[entry]      → single entry (project, photo, trade, ride, ...)
/[persona]/blog         → persona blog index
/[persona]/blog/[slug]  → blog post

/capture                → authenticated hub (Ratul only)
/capture/trade          → trade journal (PWA)
/capture/photo          → photo uploader (PWA)
/capture/ride           → ride tracker (PWA)
/capture/admin          → generic entry/blog/group editor for all personas
```

**Why one app:**
- One auth, one data model, one deploy, one design system — no cross-app sync problem.
- The capture routes are just PWA-installable pages; on the phone they *feel* like separate apps (own icon, offline) while sharing everything.
- Matches "free" — a single deploy on one free host.

If a capture surface ever needs to be a true native app (e.g. real background GPS for rides), wrap *that route* with **Capacitor** later — still the same web code.

---

## Read vs write separation

```
                     ┌─────────────────────────────────────────┐
                     │            Supabase (free)               │
                     │  Postgres + RLS  ·  Auth  ·  Storage      │
                     └─────────────────────────────────────────┘
                        ▲ (authed writes)        ▲ (public reads: visibility=public)
                        │                         │
        ┌───────────────┴──────────┐   ┌──────────┴───────────────────┐
        │  /capture/*  (PWA)       │   │  /[persona]/*  (public)       │
        │  - Ratul only            │   │  - anyone                     │
        │  - create/edit entries   │   │  - SSR / ISR, indexable       │
        │  - offline queue + sync  │   │  - reads only published rows  │
        └──────────────────────────┘   └───────────────────────────────┘

   Heavy media (originals private, derivatives public):  Cloudflare R2 / Cloudinary
```

- **Public pages** are **server-rendered / incrementally-static** reads of `visibility=public` content → fast, indexable, cache-friendly. This is the fix for the assessment's "everything is one giant client page, SSR/RSC unused" (architecture 3/5).
- **Capture pages** are authenticated, client-interactive, offline-capable.
- **RLS** enforces the public/private boundary at the database, so even a bug in the UI can't leak private trades.

---

## Component/module shape (target)

Refactor away from the current god-component (`page.tsx`) toward:

```
/lib
  /db          → Supabase client, typed queries per entity
  /content     → entry/media/blog/group models + visibility helpers
  /media       → upload pipeline, EXIF (exifr), derivative generation
/personas
  /engineer    → project card, gallery, page composition
  /trader      → chart (Lightweight Charts), strategy views, P&L
  /photography → quality viewer, before/after slider, EXIF panel
  /shared      → gallery, blog renderer, group filter, visibility badge
/capture
  /trade  /photo  /ride  /admin
/app           → routes wiring the above (thin)
```

The public persona pages compose **shared** building blocks; only genuinely bespoke bits (trade chart, before/after slider, ride map) live in persona folders. This keeps Tier-3 personas nearly free.

---

## Data-model reminder

See `03` for the schema. Key points that shape architecture:
- `Entry.data` JSON holds persona-specific fields → schema stays stable as personas evolve.
- `Media` carries EXIF + geo → powers the photo metadata panel and ride map from one table.
- `visibility` on every content row → the single lever for public vs private everywhere.

---

## Non-negotiables carried from the assessment

- **Real, working contact path** (not a stub) — wire to Resend/email.
- **Per-persona SEO**: metadata, OG image, sitemap, robots — each persona page is indexable for its own audience.
- **Media discipline**: no shipping originals; optimized derivatives only.
- **Some tests + CI** eventually (assessment: testing 0/5). Not phase 1, but on the radar once the spine exists.
