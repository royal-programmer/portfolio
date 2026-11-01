# 09 — Prioritized Roadmap

A sequenced plan, ordered by **impact ÷ effort**. The theme throughout: **you've over-invested in mechanism and under-invested in message.** This roadmap rebalances that.

Effort is rough: **S** = hours · **M** = a day or two · **L** = a week+.

---

## Phase 0 — Truth & trust (do this first, mostly non-code)

The point of Phase 0 is that the site currently makes **promises it doesn't keep** (a contact that vanishes, an "AI" that isn't, projects that don't exist). Fix the dishonest surfaces before polishing anything.

| # | Action | Impact | Effort | Ref |
|---|--------|:------:|:------:|-----|
| 0.1 | Recompress the 1 MB avatar → < 30 KB | High | S | [03](./03-performance.md) |
| 0.2 | Wire `/api/lead` to a real destination (email via Resend, or Supabase, or a Slack/Discord webhook to yourself) | High | M | [06](./06-security-and-privacy.md) |
| 0.3 | Make the persona CTAs actually navigate, or remove them | High | S | [08](./08-concrete-flaws-and-bugs.md) #4 |
| 0.4 | Decide the chat's honesty story: real Claude API route **or** rename to "Contact helper" + drop the fake 880ms delay | High | S–L | [06](./06-security-and-privacy.md) |
| 0.5 | Fix stale "dual-mode" metadata description | Med | S | [08](./08-concrete-flaws-and-bugs.md) #17 |

---

## Phase 1 — Make it findable, reachable, shareable

One architectural change (persona in the URL, server-rendered) unlocks SEO **and** deep links **and** accessibility **and** the server-component performance win simultaneously. This is the highest-leverage engineering work in the whole project.

| # | Action | Impact | Effort | Ref |
|---|--------|:------:|:------:|-----|
| 1.1 | Add a **visible, keyboard-accessible persona switcher** (segmented control / tabs). Keep logo-hold + Konami as bonus. | High | M | [04](./04-accessibility-and-ux.md) |
| 1.2 | Persona as real SSR routes (`/persona/[name]`) + `?persona=` deep links | High | M | [05](./05-seo-and-discoverability.md) |
| 1.3 | Per-persona `generateMetadata` + dynamic OG images (`ImageResponse`) | High | M | [05](./05-seo-and-discoverability.md) |
| 1.4 | `sitemap.ts`, `robots.ts`, `Person` JSON-LD | Med | S | [05](./05-seo-and-discoverability.md) |
| 1.5 | Move static persona content to **server components** (falls out of 1.2) | Med | M | [02](./02-architecture-and-code.md) |

---

## Phase 2 — Fill the empty room (the actual product)

No amount of transition polish substitutes for this. **This is what gets you hired/booked.**

| # | Action | Impact | Effort | Ref |
|---|--------|:------:|:------:|-----|
| 2.1 | 2–3 **real** engineering projects: description, stack, live + repo links, one screenshot each | High | M | [01](./01-vision-and-ideology.md) |
| 2.2 | Resume/CV PDF linked from Engineer | High | S | [01](./01-vision-and-ideology.md) |
| 2.3 | Real photographer gallery: manifest + `next/image` + lightbox + lazy-load (build as first **data-driven block**) | High | M–L | [07](./07-scalability-and-content.md) |
| 2.4 | Honest trader narrative + visible "educational, not financial advice" disclaimer | Med | S | [06](./06-security-and-privacy.md) |
| 2.5 | Replace "sample" fabricated data with real content or explicit "coming soon" | Med | S | [08](./08-concrete-flaws-and-bugs.md) #15 |
| 2.6 | A one-line connective thread across personas (why the switch means something) | Med | S | [01](./01-vision-and-ideology.md) |

---

## Phase 3 — Harden & de-risk

Now that there's real logic and real users, protect it.

| # | Action | Impact | Effort | Ref |
|---|--------|:------:|:------:|-----|
| 3.1 | Rate limiting + honeypot + body-size caps on both API routes | High | M | [06](./06-security-and-privacy.md) |
| 3.2 | Security headers + `poweredByHeader:false` in `next.config.ts` | Med | S | [06](./06-security-and-privacy.md) |
| 3.3 | `error.tsx` / `not-found.tsx` / `loading.tsx` | Med | S | [08](./08-concrete-flaws-and-bugs.md) #6 |
| 3.4 | Blocking inline theme script to kill explicit-theme FOUC | Med | S | [08](./08-concrete-flaws-and-bugs.md) #11 |
| 3.5 | GitHub Actions CI: `lint` + `typecheck` + `build` on every PR | High | S | [08](./08-concrete-flaws-and-bugs.md) |
| 3.6 | A handful of unit tests (email regex, Konami, chain-streak) + one lead-flow interaction test | Med | M | [08](./08-concrete-flaws-and-bugs.md) |
| 3.7 | Contrast audit across persona×theme; add a text scrim | Med | M | [04](./04-accessibility-and-ux.md) |

---

## Phase 4 — Refactor for the long game

Do these when the content model or a 4th persona actually demands it — **not before** (avoid speculative refactoring).

| # | Action | Impact | Effort | Ref |
|---|--------|:------:|:------:|-----|
| 4.1 | Extract `page.tsx` into hooks (`useAgentChat` reducer, `usePersonaStinger`, `useLogoGesture`, `useKonami`) | Med | M | [02](./02-architecture-and-code.md) |
| 4.2 | Data-drive persona layout (block list → renderer) so a new persona is data | Med | M | [07](./07-scalability-and-content.md) |
| 4.3 | Move content to Rung 1 (local MDX/typed content in `content/`) | Med | M | [07](./07-scalability-and-content.md) |
| 4.4 | Deduplicate `globals.css` theme blocks; define per-persona token contract | Low | S | [08](./08-concrete-flaws-and-bugs.md) #8/#9 |
| 4.5 | Performance instrumentation: bundle analyzer once + Web Vitals reporting | Low | S | [03](./03-performance.md) |

---

## What NOT to do next

To counterbalance the temptation to keep polishing:

- ❌ **Don't** add a 4th persona, more stingers, or a fancier transition until Phases 0–2 are done. The mechanism is already ahead of the message.
- ❌ **Don't** reach for a CMS/admin panel yet. Rung 0→1 is enough until editing-without-deploy is a real pain. ([07](./07-scalability-and-content.md))
- ❌ **Don't** add analytics/heatmaps before there's content worth measuring.
- ❌ **Don't** chase pixel-perfection across browsers pre-launch (your own non-goals list agrees).

---

## The one-sentence strategy

> **Stop building the theater and start writing the play:** spend the next block of effort on real content, a visible door to it, and making sure crawlers and recruiters can actually see it — then, and only then, return to polishing the (already excellent) machinery.

---

## Suggested milestones (maps to your SemVer in `docs/06`)

- **v0.3.0** — Phase 0 + 1.1 (honest promises + visible persona switch). The site stops misleading and becomes fully navigable.
- **v0.4.0** — Phase 1 complete (SSR routes, SEO, OG). The site becomes findable and shareable.
- **v0.5.0** — Phase 2 (real content in all three personas). The site becomes *credible*.
- **v0.6.0** — Phase 3 (hardening, CI, a11y). The site becomes *trustworthy*.
- **v1.0.0** — Phase 4 as needed + your own "public stable launch" bar. Ship it.
