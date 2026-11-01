# 07 — Open Questions, Decisions & Risks

Live list. As we settle each, move it from "Open" to "Decided" with the rationale.

---

## Decided (from the discussion so far)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Personas are audience-targeted **entry points**; no forced traversal; unified view is the easter-egg. | Ratul provides the right door per audience. Resolves fragmentation worry. |
| D2 | Build a **generic content spine**; personas are extensions. | ~90% shared shape; keeps Tier-3 personas nearly free. |
| D3 | **Phone-first capture apps** as authenticated PWA routes in the one app. | Frictionless capture is what keeps content flowing. |
| D4 | **Blog-per-persona.** | Highest ROI: content + SEO + credibility in one. |
| D5 | **Public/private visibility** on every entry; trader gets dual view via RLS. | Real portfolio, curated public vs full private. |
| D6 | **Entirely free** stack: Supabase + R2/Cloudinary + Leaflet/OSM + Lightweight Charts + PWA. | Hard budget constraint = $0 now. |
| D7 | **One app, route-groups** — not separate deployed apps. | One auth/model/deploy; still feels app-like on phone. |
| D8 | **Fill rooms before building new ones**; strict phasing. | A full 2-persona site beats an empty 6-persona one. |
| D9 | **Gamer is the lightest persona**, auto-populated or cut. | Least brand value; not worth bespoke engineering. |
| D10 | **Self-host curated photos** (R2/Cloudinary); **Instagram = secondary social/reach channel only**; **Google Drive = private backup + docs**, not live CDN. | IG compresses quality + strips EXIF, killing the photography persona's core features; Drive isn't a CDN. Flickr kept as EXIF-preserving fallback. |
| D11 | **Don't harden/polish the current shell**; scalability comes from Phase 0 (DB-backed, SSR), not a polish pass on placeholder content. | Shell is about to be rearchitected; polishing it is wasted work. Fold responsiveness in per-piece; mobile-correctness prioritized early (capture apps are phone-first). |
| D12 | **Stay on Vercel for now** (portfolio is already deployed there). Keep Cloudflare as the migration path *if* the site goes commercial. | Don't move a working deployment; Vercel's commercial-use limit only matters once paying clients arrive, and migration is cheap later. Supersedes the earlier Cloudflare lean in Q3. |
| D13 | **Supabase security defaults:** Data API **ON**, "auto-expose new tables" **OFF**, "automatic RLS" **ON**. | Defense in depth — every new table is private by default (hidden from public API + RLS-locked) until we explicitly expose it and write a policy. Directly fixes the assessment's security 2/5. RLS policies + exposure become versioned SQL in the repo during Phase 0. |
| D14 | **Next.js is the backend layer** — no separate backend service, no raw client-side Supabase for sensitive ops. Public reads via Server Components (anon key + RLS); writes via Server Actions / Route Handlers holding `service_role` server-only. | Keeps "one app", free, same deploy. Server layer hosts validation, P&L calc, EXIF, visibility masking, rate limiting (fixes assessment's unguarded API stubs). RLS is the second line of defense. Secrets never reach the browser; `service_role` never in a `NEXT_PUBLIC_*` var. |
| D20 | **URL/IA restructure:** content namespaced by type — public `/engineer/projects[/slug]`, `/experience`, `/certificates`, `/resume[/variant]`, `/skills`; admin moves `/capture/*` → **single shared `/admin/login`** + persona dashboards `/[persona]/admin/*`. | "Content platform" IA that scales as content types + personas grow. One login (one account/session); persona-parameterized admin = one implementation. See `10-engineer-persona-blueprint.md`. |
| D21 | **Shared design system, unique per-persona layout.** Tokens + motion + component primitives are the common spine; each persona composes its own layout. Engineer = reference implementation, built first. | Ratul's framing — explains why the personas started as identical animated shells. Keeps visual coherence while letting each persona's content dictate its layout. |
| D22 | **Blog merged into project detail** for engineer — "project experience" lives in the entry's markdown `body`, not a separate blog. Blog engine kept but **dormant/hidden** until standalone essays exist (revisit per-persona). | A generic blog is dead weight; project retrospectives belong with the project. Empty blog sections hurt. Engine still serves Photography later. |
| D23 | **"Latest industry tech" page dropped** → rebuilt as an actual **project**: Telegram bot + n8n workflow (fetch → LLM summary → push). Featured as engineer flagship with a live "try the bot" link. | Serves Ratul personally AND demonstrates real automation/LLM/self-hosting skill. Filler page → portfolio content. |
| D24 | **Tailored résumés:** multiple résumé variants by skill/industry (AI/Automation, Full-stack, Backend), shown as a carousel, each downloadable. Backed by a `resume` content type. | Lets Ratul hand the right-fit résumé to the right audience — stronger signal than one generic PDF. |
| D25 | **Ownership:** Claude builds the whole codebase; Cursor reviews (read-only, `docs/reviews/`). (2026-11-01) | One agent drives the immersive vision end-to-end; review is more valuable from fresh eyes. |
| D26 | **Experience modes:** every persona ships two renderings of the *same content* — **Immersive** (WebGL/3D, scroll-driven) and **Lite** (same design language, CSS motion only, no WebGL). Default **Auto** picks per visitor (Save-Data, `effectiveType`, device memory/cores, `prefers-reduced-motion`, a short FPS probe); a visible toggle lets anyone switch, remembered per browser. Content always in the DOM (SEO/a11y). | Ratul: award sites feel laggy on slow connections — smoothness beats spectacle. Lite is a first-class design, not a fallback. |
| D27 | **Distinct design per persona, but meaningful:** each persona world tells a story *about Ratul* (why he does it, what he learned, real artifacts), not just eye candy — "a medium to know me, along with exploration". Shared tokens/motion primitives (D20). | Exploration without substance is forgettable; every world needs a narrative. |
| D28 | **Hosting = Vercel Hobby** (already connected, auto-deploys `main`) — **supersedes the Cloudflare lean**. Domain bought at Cloudflare Registrar (at-cost), DNS → Vercel. | Media pipeline uses `sharp` (native) in server actions — not supported on Cloudflare Workers; Vercel runs Next.js 16 natively. Personal portfolio = Hobby's non-commercial use. |
| D29 | **Repo stays public.** Secrets only in env/GitHub secrets; backups encrypted. | A public, well-built repo is itself engineer-persona proof; nothing sensitive lives in git. |
| D30 | **Stack locked for the long run (all $0):** keep **Supabase** (Postgres + Auth + RLS — data only) and **Vercel Hobby** (app). **Move all media (originals + derivatives, 3D assets, GPX) to Cloudflare R2** (10 GB free, zero egress) *before* Photography. Domain + DNS + Web Analytics on Cloudflare. Rides stored as encoded polylines/GPX files, not per-point rows. | Supabase free = 1 GB storage / ~5 GB egress — hi-res originals would hit it fast; DB text stays tiny vs 500 MB. Postgres + standard Next.js keep exit costs low (weekly dumps exist). Avoids a forced migration after building. |
| D19 | **Media pipeline:** originals → **private** `originals` bucket; derivatives (thumb/optimized/full WebP via `sharp`) → **public** `media` bucket. Browser uploads the original **directly to Supabase** (session + storage RLS), NOT through the Next/Vercel body limit; a server action then downloads server-to-server, builds derivatives, extracts EXIF (`exifr`), inserts the media row. Transport-agnostic core (`lib/media/pipeline.ts`) reused for photography hi-res later. | The Server Action body limit is 1MB and Vercel caps serverless bodies at ~4.5MB — routing hi-res through the function is the wrong design. Direct-to-storage sidesteps both, free. **Known limit:** public-bucket derivative URLs are reachable by anyone with the (UUID-obscured) URL, so the DB `visibility` gate hides the *row*, not the *pixels* — truly-private media (trader personal view) will need a private-bucket + signed-URL variant, a Trader-phase follow-up. |
| D15 | **Path-based persona URLs** (`/engineer`, `/trader`, `/photographer`) — NOT query params. Add **`/whoami`** as the unified about/easter-egg page. | Each persona is an independently indexable, shareable front door (core to the per-audience SEO model). Query params are weaker for SEO/sharing and semantically wrong. `whoami` is the "know me more" layer. Explicit routes take precedence over the `[persona]` dynamic segment; never name a persona after a real route. |
| D16 | **App runtime uses the Supabase client library** (done). DB management via **SQL editor** or the **Supabase MCP** (optional, scoped/read-only). **No ORM.** | Client library already powers the provider; MCP lets the agent apply/verify migrations in interactive sessions (can't be used in non-interactive sessions). ORM would duplicate the schema for no gain. |
| D17 | **Root `/` = engineer default face** (redirect stays). **`/whoami` = persona card hub** ("know me more": cards for each persona, published clickable → `/[persona]`, unpublished shown as static "coming soon"). The morphing switcher becomes an easter-egg, not the primary hub. | Refines D15. Direct persona links still serve targeted audiences; `/whoami` is the explore-all-facets page. Card hub is more legible than the morphing switcher for a first-time visitor. |
| D18 | **Admin writes use the cookie-bound user session client (RLS-enforced), not `service_role`.** `service_role`/`adminClient` reserved for system ops that must bypass RLS. | Defense in depth — even the content-entry path is gated by `is_admin()` at the DB, so a bug can't escalate. Magic-link auth; single admin (Ratul). |

---

## Open — need Ratul's call

| # | Question | Why it matters | Leaning |
|---|----------|----------------|---------|
| Q1 | **Background GPS acceptable as foreground-only for now?** | PWAs can't do reliable background geo (esp iOS). | Ship foreground-first; Capacitor wrapper later if needed. |
| Q2 | **Trader public view: what exactly is shown?** Absolute P&L? % returns? Position sizes hidden? | Privacy + credibility + "not advice." | Show % returns + equity curve publicly; hide absolute sizes. Confirm. |
| Q3 | ~~Hosting: Cloudflare vs Vercel Hobby?~~ **→ DECIDED (D12): stay on Vercel.** | Already deployed there; Cloudflare only if it goes commercial. | Closed. |
| Q4 | **Which capture app first after Engineer — Photo or Trade?** | Trade is highest-value (daily) but most complex; Photo is simplest to prove the loop. | Photo first (prove loop cheaply), then Trade. Per current phasing. |
| Q5 | **Custom domain now or later?** | The one thing genuinely worth ~$10/yr for brand; otherwise a free subdomain. | Get a domain early; it's the cheapest brand upgrade. Ratul's call given $0 rule. |
| Q6 | **Keep the existing persona-switching UI as the easter-egg, as-is?** | It's well-built; now it's the "know me more" layer, not primary nav. | Keep it; repurpose as the unified/easter-egg view. |
| Q7 | **Storage: R2 vs Cloudinary vs Supabase-only to start?** | Photos strain free storage first. | Start Supabase storage; add R2 when photos grow. Confirm appetite for CF setup. |
| Q8 | **Auth provider details** (email magic-link vs GitHub OAuth for the single admin). | Minor; just Ratul logs in. | Supabase magic-link. |

---

## Risks to keep watching

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Scope explosion** (platform, not portfolio) | High | Strict phasing (`06`); prove the loop before fanning out. |
| **Maintenance treadmill** (6 personas + blogs) | Med-High | Capture apps lower friction; honest per-persona cadence; Tier-3 stays light. |
| **Free storage caps** (hi-res photos) | Medium | Originals private + optimized derivatives; R2 when needed; cheap paid upgrade later. |
| **Supabase free-tier pausing** on inactivity | ~~Low~~ **Happened (2026-11)** | `supabase-keepalive` workflow (ping + auto-restore) + weekly encrypted backup. |
| **Vercel commercial-use terms** | Low | Personal portfolio is non-commercial; revisit if selling prints/commissions (D28). |
| **Background GPS unreliability** | Medium | Foreground-first; manual override; Capacitor later. |
| **Free-tier terms change over time** | Med | Re-verify limits before each phase; keep PocketBase as self-host fallback. |
| **Cleverness over clarity** (carried from assessment) | Medium | Each persona page must be legible to its audience in 5s. |
| **Legal/financial framing (trader)** | Medium | Clear "not financial advice" disclaimer; never expose others' data. |

---

## Explicitly out of scope (for now)

- Native mobile apps (PWA first).
- Multi-user / other people's accounts (single admin = Ratul).
- Selling/e-commerce (print sales, commissions checkout) — revisit if photography/art demand it.
- Any paid service until the $0 constraint is lifted.
- Broker/exchange API auto-import for trades (manual journal first).
