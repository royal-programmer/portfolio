# 04 — Free Tech Stack

**Hard constraint:** everything must be free right now. Paid upgrades are noted as future options but never required. Free tiers change over time — re-verify limits before committing; treat the specific numbers here as "roughly true as of 2026-07," not guarantees.

---

## Recommended stack (the $0 path)

| Concern | Pick | Why | Free-tier reality |
|---------|------|-----|-------------------|
| **Framework** | Next.js (already in use) | Keep what exists; SSR/ISR for indexable public pages. | Free. |
| **Hosting** | Cloudflare Pages/Workers *(primary)* or Vercel Hobby | CF has no commercial-use restriction and a generous free tier. | Both free; see hosting note below. |
| **DB + Auth + Storage** | **Supabase** | Postgres + Auth + Storage + **Row-Level Security** in one. RLS *is* the public/private model. | Free tier: ~500 MB DB, ~1 GB file storage, pauses after ~1 week inactivity (a keep-alive ping avoids it). |
| **Media storage (scale-out)** | **Cloudflare R2** or **Cloudinary** | Photos outgrow Supabase's 1 GB. R2 = 10 GB free, no egress fees. Cloudinary adds transforms. | R2 ~10 GB free; Cloudinary ~25 GB "credits". |
| **Image optimization** | `next/image` + stored derivatives, or Cloudflare Images | Serve small optimized images; keep originals private. | Free (self-pipeline) / CF Images has a free-ish tier. |
| **Maps (ride)** | **Leaflet** or **MapLibre GL** + **OpenStreetMap** tiles | Zero-cost maps + route polylines. No Mapbox bill. | Free (respect OSM tile usage policy; self-host tiles later if heavy). |
| **Routing/directions (optional)** | OSRM / GraphHopper (open) or just connect tracked points | Only if you need snapped routes vs raw GPS trail. | Free/open. |
| **Charts (trader)** | **TradingView Lightweight Charts** | Purpose-built for price charts + entry/exit markers; tiny, open-source. | Free (Apache-2.0). |
| **P&L / equity curve** | Lightweight Charts or **Recharts** | Recharts fine for simple cumulative curves. | Free. |
| **EXIF extraction** | **`exifr`** (npm) | Client-side parse of ISO/shutter/aperture/GPS from uploads. | Free (MIT). |
| **Auth model** | Supabase Auth, single admin (Ratul) | You're the only writer; simple email/OAuth login gates capture routes. | Free. |
| **Capture "apps"** | **PWA** (installable, offline, camera + geolocation) | Same codebase installs to phone home screen; no app stores. | Free. |
| **Analytics** | **Cloudflare Web Analytics** or self-host **Umami** | Privacy-friendly; learn which persona resonates. | Free. |
| **Blog content** | Markdown/MDX in DB (or repo) | Reuse across personas; indexable. | Free. |
| **Email/contact** | **Resend** free tier or a form→email service | Make the contact path actually work (assessment gap). | Resend free tier ~limited/day. |

---

## Why Supabase over the alternatives

- **PocketBase** (open-source, SQLite + auth + storage + admin UI in one Go binary) is *excellent* and fully free — **but it needs somewhere to run persistently**, and free hosts for a long-lived process are scarce/flaky. Supabase is *free and hosted*. Keep PocketBase as the self-host fallback if we ever want to leave Supabase.
- **MDX-in-repo only** (no DB): great for blogs, but "log a trade from my phone" becomes "make a git commit" — kills the daily-capture vision. Rejected as the primary store; may still back the blog.
- **Firebase**: free tier works, but its data model + vendor lock-in fit this relational/RLS use-case worse than Supabase.

**Decision:** Supabase primary (hosted-free, RLS solves public/private elegantly) + R2/Cloudinary for heavy media.

---

## Hosting note (an honest free-tier gotcha)

- **Vercel Hobby** is free but its terms restrict *commercial* use. If the photography persona ever books paying clients, that's arguably commercial → risk.
- **Cloudflare Pages/Workers** has no such restriction and pairs naturally with R2. **Lean Cloudflare** for longevity, or be ready to move off Vercel Hobby if things go commercial.

---

## The one thing "free" actually strains: hi-res photo storage

Compute is cheap; **RAW-ish/hi-res images fill free storage fast.** Mitigations (all free, and they double as fixing the assessment's 1 MB-avatar problem):

1. Store the **original privately** (R2), serve **optimized derivatives** publicly.
2. Cap/resize on upload; generate thumb + web + (optional) full-view sizes.
3. Lazy-load galleries; never ship originals to the browser by default.

When storage eventually caps out, the upgrade is cheap (R2 is pay-as-you-go pennies) — but that's a *later* decision.

---

## Media sourcing: self-host vs Instagram vs Google Drive vs Flickr

Ratul suggested pointing the photography persona at **Instagram** (avoid storage) and using **Google Drive** where helpful. Both are useful — but not as the primary serving layer for photography. The verdict:

| Option | Good for | Bad for | Verdict |
|--------|----------|---------|---------|
| **Self-host (R2/Cloudinary)** | Curated best shots; powers quality-view, EXIF panel, before/after | Nothing critical; storage discipline needed | **Primary store for the photography portfolio.** Curated = small = fits free tier. |
| **Instagram** | Reach, social proof, "latest/more" strip, cross-posting | **Compresses quality (~1080px), strips EXIF, no before/after pairs, fragile Graph API (Basic Display deprecated), no ownership** | **Secondary channel only** — link out / optional feed embed. Never the source for the quality/EXIF features. |
| **Google Drive** | Private backup of originals; non-image docs (resume PDF); build-time reads | **Not a CDN** — slow, rate-limited, hotlink hacks keep breaking; mixes with personal storage | **Private archive + document home.** Not the live image server. |
| **Flickr** | A *free* host that **preserves EXIF + near-original quality**, has an API | 1000-photo free cap; less brand/design control | **Optional alternative** to self-hosting if storage becomes a real pain — the one photographer-respecting social host. |

**Decided strategy:** self-host the curated best (quality + EXIF + before/after depend on owning the original) → optimized derivatives to the web; **Instagram** as a linked social-proof/latest channel; **Google Drive** as private backup + document home. Flickr held as a fallback if self-storage strains.

> Why quality/EXIF forces this: the photography persona's whole value proposition is best-quality viewing + technical metadata (ISO/shutter/aperture). Instagram destroys exactly those two things on upload, so it cannot back the persona's core features — only amplify reach.

---

## Paid upgrade paths (deferred, for reference only)

- Supabase Pro (more DB/storage, no pausing) · Mapbox (nicer maps) · Vercel Pro (commercial) · Cloudinary paid (more transforms) · a custom domain (small yearly cost — the one thing genuinely worth buying early for brand).
