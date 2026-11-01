# 03 — Content & Capture Model

The heart of the platform. Two halves: the **shared content spine** (what data looks like) and the **capture apps** (how Ratul feeds it, phone-first).

---

## Part A — The shared content spine

Every persona is a variation on the same shape. Model it once, generically, and let personas extend it.

### Core entities

```
Persona
  id, slug (engineer|trader|photography|artist|ride|gamer),
  name, tagline, theme/tokens, is_published

Entry                          ← the universal unit (project | trade | photo | artwork | ride | game)
  id, persona_id, type,
  title, summary, body (markdown),
  visibility (public | private | unlisted),
  created_at, occurred_at, featured, order,
  data (JSON)                  ← persona-specific fields live here (see below)

Media
  id, entry_id,
  kind (image | video),
  original_url (private), optimized_url, thumb_url,
  width, height, exif (JSON), caption,
  lat, lng, captured_at        ← for geotagging
  order

Group                          ← genres / categories / platforms / tags
  id, persona_id, name, kind

Entry_Group                    ← many-to-many

BlogPost
  id, persona_id, title, slug, body (markdown),
  cover_media_id, tags, visibility, published_at

Strategy                       ← trader master data
  id, name, thesis, description, rules (JSON)
  (Trade entries reference a strategy via Entry.data.strategy_id)
```

### Why the `data` JSON column

Rather than a wide table per persona, persona-specific fields live in a flexible `data` JSON blob on `Entry`:

- **Engineer:** `{ repo_url, demo_url, deployed_url, tech_stack[], role }`
- **Trader:** `{ instrument, direction, entry_price, exit_price, size, pnl, strategy_id }`
- **Photography/Artist:** `{ edited, before_media_id, after_media_id, medium }` (EXIF lives on `Media`)
- **Ride:** `{ start, end, distance_km, route_points[] }` (or a separate `RidePoint` table if paths get large)
- **Gamer:** `{ platform, progress_pct, status, rating, external_id }`

This keeps the schema stable while personas evolve. (If a persona's queries get heavy — e.g. slicing trades by strategy — promote its hot fields to real columns later.)

### Visibility model — public vs private

Every `Entry`, `Media`, and `BlogPost` has a `visibility`. The **public site only ever reads `public`**. The **capture/admin surfaces (authenticated) see everything.** For the trader's dual view, this is the whole mechanism:

- **Public portfolio view** → `visibility = public` rows, possibly with sensitive fields (exact size, absolute P&L) masked.
- **Personal tracking view** → authenticated, sees all rows and all fields.

With Supabase this maps cleanly onto **Row-Level Security**: a public/anon policy exposing only `public` rows, and an authenticated policy (just Ratul) seeing all. Security enforced at the database, not just the UI. (Directly addresses the assessment's security 2/5.)

---

## Part B — The capture apps (phone-first)

The insight from the discussion: **frequent content dies if creating it requires "loading up the website."** So the platform exposes lightweight, installable capture surfaces — same codebase, authenticated routes, designed for a phone.

They are **not separate apps** — they're authenticated route-groups in the one Next.js app, installable as **PWAs** (add-to-home-screen, offline-capable). One deploy, one auth, one data model.

### `/capture/trade` — Trade Journal  *(Trader · daily)*
- Fast form: instrument, direction, entry/exit, size → auto-computes P&L.
- Tag a **strategy** from the master-list (one tap).
- Attach a screenshot (optional).
- Set visibility (public/private) at entry time.
- **Offline queue:** log now, sync when online.
- *This is the highest-value capture app* — daily cadence makes friction most expensive here.

### `/capture/photo` — Photo Uploader  *(Photography/Artist · few times a month)*
- Pick/take a hi-res photo.
- **`exifr` auto-parses** ISO, shutter, aperture, focal length, camera, GPS, timestamp into fields — no manual typing.
- Add caption, genre/group, edited-flag (+ optional before/after pair).
- Upload → pipeline stores original privately + generates optimized derivatives.

### `/capture/ride` — Ride Tracker  *(Travel/Ride · per trip)*
- **"Start ride"** → captures GPS path (foreground; see limit below).
- Capture/upload photos → auto-tagged with time + location.
- **Manual override** to add/fix photos or points missed during the ride.
- On "end ride" → creates a Ride entry with route + geotagged gallery, ready to annotate.
- ⚠️ **Background-GPS limit:** browsers (esp. iOS Safari) restrict background geolocation. Foreground tracking (screen on) is reliable; full background needs a Capacitor native wrapper later. Ship foreground-first.

### Shared capture concerns
- **Auth:** single admin (Ratul). Supabase Auth. Capture routes are gated; public routes are open-read.
- **Offline-first:** capture apps should queue locally and sync — phones lose signal.
- **Speed:** every capture flow optimized for taps-to-done, not visual flourish.

---

## How content flows

```
 Phone (PWA capture app)  ──auth──▶  write Entry/Media (any visibility)
                                          │
                                          ▼
                                   Supabase (DB + Storage, RLS)
                                          │
             ┌────────────────────────────┴───────────────┐
             ▼                                             ▼
   Public site reads visibility=public          Personal views read all (authed)
   (persona landing pages, galleries,           (full trade tracking, drafts)
    blogs — SSR/ISR, indexable)
```

The public site becomes mostly **server-rendered / statically-cached reads** of published content (fixing the assessment's "everything is one giant client page" — architecture 3/5), while writes happen through the authenticated capture surfaces.
