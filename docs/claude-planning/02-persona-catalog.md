# 02 — Persona Catalog

One row's worth of detail per persona: its audience, the "entry" it collects, its bespoke features, its companion capture app (if any), its tier, and current status. This is the master list we build against.

Legend — **Status:** ✅ exists (as UI shell) · 🟡 planned · 🔵 idea/backlog

---

## 1. Engineer — *Tier 1 (Primary)* · Status: ✅ shell exists

**Audience:** recruiters, engineering managers, collaborators.

**Entry = a Project.** Fields:
- Title, summary, role, tech stack, dates
- **Deployed link**, source link, **demo video**, image gallery (dynamically populated — N images/videos scale the layout automatically)
- Long-form write-up (markdown)
- Tags/groups (e.g. "web", "AI", "tooling"), visibility flag

**Bespoke features:** dynamic media galleries that scale to the number of assets; auto-embedding of demo videos; "featured" ordering.

**Companion capture app:** none needed — projects are infrequent (every few months). Entry via the standard admin form is fine.

**Notes:** build this persona first. It proves the content engine end-to-end and it's the professional core.

---

## 2. Trader — *Tier 2 (Signature)* · Status: ✅ shell exists

**Audience:** trading peers, finance-curious visitors, and Ratul himself (private tracking).

**Entry = a Trade / Position (real portfolio).** Fields:
- Instrument, direction, entry/exit price + time, size, P&L
- **Linked strategy** (from a strategy master-list)
- Notes/rationale, screenshots
- **Visibility: public vs private** — two views of the same data (curated public portfolio vs full personal tracking)

**Master data = Strategies.** Each strategy: name, thesis/logic, description, rules. Trades map to a strategy so performance can be sliced per strategy.

**Bespoke features:**
- Trade markers rendered on a **price chart** (entry/exit)
- **Cumulative P&L / equity curve**
- Per-strategy performance breakdown
- Public/private data partitioning

**Companion capture app:** ✅ **`/capture/trade` (trade journal).** Daily-frequency, phone-first. Log a trade in a few taps, tag a strategy, attach a screenshot. This is the highest-value capture app because of the cadence.

**Open decisions:** exact public-vs-private field split; whether P&L is shown as absolute or percentage publicly; "not financial advice" disclaimer copy. See `07`.

---

## 3. Photography — *Tier 2 (Signature)* · Status: ✅ shell exists

**Audience:** photo clients, fellow photographers.

**Entry = a Photo (or photo set).** Fields:
- Hi-res image, caption/title
- **EXIF metadata**: ISO, shutter speed, aperture, focal length, camera/lens, date, GPS (auto-extracted on upload)
- **Edited flag + before/after pair** → enables a before/after slider
- Genre/group (e.g. "street", "landscape", "portrait"), visibility flag

**Bespoke features:**
- **Quality-first viewer** — the photo is the hero; large, sharp, minimal chrome
- **Before/after slider** for edited shots
- Metadata panel (ISO/shutter/aperture/…)
- Genre-grouped galleries

**Companion capture app:** ✅ **`/capture/photo` (uploader).** Upload hi-res from phone; EXIF auto-parsed into fields; add a caption; publish. A few times a month.

**Blog:** yes — technique write-ups (ISO/aperture/exposure explainers), lessons learned "living the persona." High SEO + credibility value.

---

## 4. Artist — *Tier 3 (Personal)* · Status: 🟡 planned

**Audience:** art appreciators, commission enquirers.

**Entry = an Artwork.** Nearly identical to Photography: image, title, medium, **type-group** (e.g. "sketch", "watercolor", "digital"), edited/WIP states, visibility.

**Bespoke features:** essentially reuses Photography's gallery + grouping + blog. Cheap precisely because it's a twin.

**Companion capture app:** reuses `/capture/photo` (or a near-clone). No new machinery.

**Blog:** yes — process, materials, learnings. Shares the blog engine.

---

## 5. Travel / Ride — *Tier 3 (Personal)* · Status: 🟡 planned

**Audience:** fellow riders, travel-curious, personal.

**Entry = a Ride/Trip.** Fields:
- Route (A→B), **map view** with the tracked path
- Geotagged photo gallery — each photo pinned to where/when it was captured, with per-location comments/experience
- Experience write-up (blog-style)
- Date, distance, visibility

**Bespoke features:**
- **Map with route polyline** (from tracked GPS points)
- **Location-pinned photos** with notes
- Experience blog per trip

**Companion capture app:** ✅ **`/capture/ride` (ride tracker).** Tap "start ride" → captures GPS path; capture/upload photos that auto-tag with time + location; manual override for missed uploads.
> ⚠️ Honest limit: reliable *background* GPS isn't available to web/PWA (esp. iOS). Foreground tracking (screen on / app in foreground) works. True background tracking needs a thin native wrapper (Capacitor) later. Ship foreground-first. See `07`.

**Blog:** yes — trip stories.

---

## 6. Gamer — *Tier 3 (Personal)* · Status: 🔵 idea

**Audience:** fellow gamers, personal.

**Entry = a Game in the collection.** Fields:
- Title, platform (Steam/Epic/…), cover art
- **Progress / completion** indicator
- Status (playing / completed / backlog / dropped), rating, short note

**Bespoke features:** keep it light. Ideally **auto-populated from platform APIs** (e.g. Steam Web API is free) so it's near-zero maintenance. Progress bars per game.

**Honest note (from discussion):** this is the least brand-building persona — it's a personal dashboard more than a professional asset. Decision: make it the *lightest* persona, automate the data pull, and if it can't be near-automatic, cut it or keep it as a pure easter-egg. Don't invest bespoke engineering here.

**Blog:** optional/low-priority.

---

## 7+. Future personas — *backlog*

The model is designed to add personas cheaply. Any new persona that fits "collection of entries + media + optional blog + groups + visibility" costs almost nothing on top of the spine. Add them when there's real content to justify a new door — never as empty scaffolding.

---

## Cross-persona features (built once, used everywhere)

- **Blog engine** — per-persona posts. Highest single ROI feature (content + SEO + credibility). See `03`.
- **Groups/categories** — photo genres, painting types, game platforms, project tags. One concept.
- **Visibility flag** — public/private on every entry.
- **Media pipeline** — upload → store original (private) → serve optimized derivatives. Fixes the assessment's 1 MB avatar problem structurally.
- **Dynamic galleries** — layouts that scale to the number of assets.
