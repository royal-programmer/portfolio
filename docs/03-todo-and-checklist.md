# To-do and checklist

Use this file as the **single checklist** for roadmap items. Mark done items with `[x]` and pending with `[ ]`.

---

## Implemented (done)

- [x] **Next.js app scaffold** — TypeScript, App Router, Tailwind v4, ESLint (`portfolio-site/`)
- [x] **Three personas** — `engineer`, `trader`, `photographer` with distinct copy, accents, and typing word lists
- [x] **`PersonaProvider`** — Global persona state in `app/persona-provider.tsx`, wrapped from `app/layout.tsx`
- [x] **Persona persistence rules** — Full document **reload / new navigation** → default **Engineer**; **client-side** route changes keep persona; `sessionStorage` + Performance Navigation Timing (`reload`, `navigate`, `back_forward`); `document.documentElement` `data-persona` synced
- [x] **Logo easter-egg: click + hold** — **1×** Engineer, **2×** Trader, **3×** Photographer; **4×+** caps at Photographer (no wrap to Engineer)
- [x] **Konami-style keyboard sequence** — Cycles Engineer → Trader → Photographer → Engineer
- [x] **UI theme** — `system` | `light` | `dark`, persisted in `localStorage` (`ui-theme`), `data-ui-theme` on `<html>`
- [x] **Theme control UX** — Collapsible “Theme” control morphing into segmented System/Light/Dark
- [x] **Glass / token-based surfaces** — Shared CSS variables for panels, controls, overlays (`globals`)
- [x] **Persona background images** — Full-bleed layer + fade on change; opacity via `--bg-image-opacity`
- [x] **Readability overlay** — `--bg-overlay`, hero + card `--surface-*` for text on imagery
- [x] **Rotating typewriter** — `react-type-animation`, sequences per persona
- [x] **Basic sections** — Hero + identity panel + three placeholder cards (Projects / Experience / Contact)
- [x] **Workspace documentation** — `Portfolio/docs/` (objectives, tech, checklist, deployment, supplemental docs); app `README.md` links to docs

---

## In progress / queued (high value)

- [ ] **Persona switch polish** — Stronger cinematic transition (shared layout animation, optional shader or split-screen motif)
- [ ] **Sound on persona switch** — Short stingers per persona, mute toggle, respect `prefers-reduced-motion` (pair with optional audio off by default on mobile)
- [ ] **Real Engineer content** — Projects (live + repo), stack, case-study links, resume PDF
- [ ] **Real Trader content** — Public-safe narrative, process, disclaimers; optional journal page route
- [ ] **Real Photographer content** — Gallery grid, lightbox, categories; local images in `public/`
- [ ] **Contact** — Working form wired to email or Supabase; honeypot + rate limiting

---

## Infrastructure & quality

- [ ] **Deploy to Vercel** — Connect repo, set branch previews, production domain
- [ ] **Environment variables doc** — See [`05-other-important-documentation.md`](./05-other-important-documentation.md) when Supabase/API keys exist
- [ ] **SEO** — Per-route metadata, Open Graph image, `sitemap.xml`, `robots.txt`
- [ ] **Analytics (optional)** — Privacy-friendly option
- [ ] **Performance pass** — `next/image` for backgrounds and gallery; font subsetting if custom fonts added
- [ ] **Accessibility audit** — Focus order, contrast all personas × themes, keyboard flows for theme control
- [ ] **Replace remote Unsplash URLs** — With optimized local assets if desired

---

## Nice-to-have / ideas

- [ ] **Shareable deep links** — e.g. `?persona=trader` applying after load without breaking morph UX
- [ ] **Blog or changelog** — Engineering posts; clearly separated from trading content
- [ ] **CMS / MDX** — For non-developer edits
- [ ] **Admin or magic-link updates** — Supabase auth for you only

---

## How to update this doc

1. When a feature ships, move or duplicate its line from **queued** to **implemented** and check `[x]`.
2. Keep **one** canonical checklist here; avoid maintaining a second list in Notion unless you sync manually.
