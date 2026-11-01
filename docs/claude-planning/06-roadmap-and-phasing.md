# 06 — Roadmap & Phasing

**Governing rule:** *prove the loop before fanning out.* Build the content engine + one persona + one capture app **end-to-end** — capture on phone → stored → rendered publicly — before adding more personas. A working 2-persona system beats a scaffolded 6-persona one.

Effort/impact are rough gut-calls, not estimates. No dates — cadence is Ratul's call.

---

## Phase 0 — Foundations (prove the plumbing)
*Goal: a single real entry, captured and displayed, on free infra.*

- [ ] Stand up **Supabase** (DB + Auth + Storage) with the core schema (`Persona`, `Entry`, `Media`, `Group`, `BlogPost`).
- [ ] **RLS policies**: anon reads `visibility=public`; authenticated (Ratul) reads/writes all.
- [ ] **Media pipeline**: upload → private original + optimized derivatives (fixes the 1 MB avatar too).
- [ ] Single-admin auth gating `/capture/*`.
- [ ] Convert **one** existing persona page to read from the DB (SSR/ISR) instead of hardcoded content.

**Exit criteria:** create an entry in `/capture/admin`, see it live on a public persona page, private entries invisible to anon.

---

## Phase 1 — Engineer, for real *(Tier 1)*
*Goal: the professional front door is genuinely complete.*

- [ ] Project entry model (deployed link, demo video, dynamic media gallery).
- [ ] Dynamic galleries that scale to N images/videos.
- [ ] **Ship ≥2 real projects** with real links + media. (Content, not just mechanism.)
- [ ] Per-persona SEO: metadata, OG image, sitemap/robots.
- [ ] **Working contact path** (Resend/email).

**Exit criteria:** a recruiter landing on `/engineer` sees real, well-presented work and can reach Ratul.

---

## Phase 2 — Photography + first capture app *(Tier 2)*
*Goal: prove the capture→display loop with the simplest capture app; prove the media-heavy patterns.*

- [ ] **`/capture/photo`** PWA: upload hi-res, `exifr` auto-fills ISO/shutter/aperture/GPS, caption, group, edited-flag.
- [ ] Quality-first photo viewer + EXIF panel.
- [ ] Before/after slider for edited shots.
- [ ] Genre-grouped galleries.
- [ ] **Ship real photos.**
- [ ] **Blog engine** (built here, reused everywhere) + first photography post (e.g. an ISO/exposure explainer).

**Exit criteria:** Ratul uploads a photo from his phone; it appears in the public gallery with correct metadata; a blog post is live and indexable.

---

## Phase 3 — Trader + trade journal *(Tier 2, signature)*
*Goal: the most differentiated feature — but scope the MVP hard.*

**MVP (v1):**
- [ ] Strategy master-list (CRUD).
- [ ] **`/capture/trade`** PWA: log trade, auto-P&L, tag strategy, screenshot, visibility, offline queue.
- [ ] Trades rendered on a **Lightweight Chart** with entry/exit markers.
- [ ] **Cumulative P&L / equity curve.**
- [ ] **Public vs private** views (RLS + field masking).
- [ ] "Not financial advice" disclaimer.

**Deferred (v2):** per-strategy analytics dashboards, win-rate/expectancy stats, tags beyond strategy, broker import.

**Exit criteria:** log a trade on the phone daily; public sees the curated equity curve; private view has full detail.

---

## Phase 4 — Cheap personas: Artist + Ride *(Tier 3)*
*Goal: reuse the spine; minimal bespoke work.*

- [ ] **Artist**: reuse photo gallery + groups + blog. Ship real artwork. (Nearly free.)
- [ ] **Ride**: `/capture/ride` (foreground GPS), Leaflet/OSM route map, geotagged gallery, trip blog. Accept foreground-only tracking for now.

**Exit criteria:** each has real content and works; neither required heavy new engineering beyond the ride map.

---

## Phase 5 — Gamer + polish *(Tier 3, lightest)*
- [ ] **Gamer**: auto-pull from Steam (free API) etc.; progress bars; keep it near-zero-maintenance. Cut if it can't be mostly automatic.
- [ ] Cross-persona **"Now" feed** (latest across personas) — cheap once the engine exists.
- [ ] Analytics (Cloudflare/Umami) to see which persona resonates.
- [ ] Newsletter/RSS on blogs.
- [ ] **Tests + CI** for the content engine (assessment: testing 0/5).

---

## What we are deliberately NOT doing yet

- No 6-persona scaffolding up front.
- No native apps (PWA first; Capacitor only if background GPS demands it).
- No paid tooling.
- No per-strategy analytics, no broker sync, no CMS product — until the core loop is proven and full.

---

## The "definition of alive"

The platform is *working* when Ratul can, from his phone, in under a minute: log a trade, upload a photo, or (on a ride) capture a geotagged shot — and have it show up correctly on the right public persona page without touching a laptop. Everything in Phases 0–3 exists to reach that bar.
