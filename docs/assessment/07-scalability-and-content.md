# 07 — Scalability & Content Model

"Scalability" for a portfolio isn't about traffic (Vercel's CDN handles a personal site trivially). It's about **how painful it is to add the 10th project, the 50th photo, or a 4th persona.** Right now the answer is "you edit code," which is fine at zero content and a problem the moment content grows.

---

## The content is hardcoded in TypeScript

All persona copy lives in `site-content.ts` as a `const` object; layouts live as **per-persona JSX branches** in `persona-home-body.tsx`; project "cards" are a hardcoded `CARDS` array in `projects-grid.tsx` with placeholder text.

This is the correct choice *for now* — no CMS overhead, type-safe, fast. But it has clear ceilings:

### Ceiling 1 — Adding a project means a code deploy
Every project, photo, or case study is a code edit + commit + deploy. That's tolerable for you as the developer, but it means the site can't be updated from a phone, can't be updated by a non-developer, and every content tweak risks the build.

### Ceiling 2 — Adding a persona touches many files
The `Persona` type is a clean union, but a 4th persona ("Writer," say) requires edits in at least: `persona-provider.tsx` (`PERSONA_ORDER`), `site-content.ts` (content + backgrounds + type sequences), `globals.css` (a full token block × theme variants), `persona-home-body.tsx` (a new JSX branch), plus icon choices in `identity-panel.tsx`. That's a shotgun edit across 5+ files for one conceptual addition. The data model is *almost* there — the content is data, but the **layout is code**, so personas aren't truly data-driven.

### Ceiling 3 — Layout is coupled to persona identity
`persona-home-body.tsx` hardcodes "trader gets a calendar + graph, photographer gets a gallery strip." That's fine while there are three, but it means layout variety scales linearly with hand-written branches rather than being composed from reusable, data-described blocks.

---

## The maturity ladder (don't skip rungs)

You do **not** need a CMS today. Here's the honest progression — adopt each rung only when content pain justifies it:

| Rung | When to adopt | What it buys you |
|------|---------------|------------------|
| **0. Typed constants** (today) | 0–10 items, solo dev | Simplicity, type safety. **You are here — stay until it hurts.** |
| **1. Local content files** (JSON/MDX in-repo) | Real projects + case studies arrive | Content separated from components; case studies as MDX with prose + code; still Git-versioned, still free. **This is your next rung.** |
| **2. Headless CMS or DB** (Sanity/Contentlayer/Supabase) | You want to edit without deploying, or non-dev edits | Update from anywhere, drafts, scheduling. Adds a dependency + free-tier account. |
| **3. Admin UI / magic-link** | Frequent updates, multiple editors | Full self-serve. Overkill for one person; your own docs correctly file this under "nice-to-have." |

**Recommendation:** move to **Rung 1** as soon as you have real content. Define a typed schema and load from `content/` (MDX for case studies + photo metadata, typed via a small loader or Contentlayer-style approach). It keeps everything free and Git-based while decoupling content from layout — and it makes case studies (the thing that actually gets you hired) first-class.

Example target shape:
```
content/
  projects/*.mdx          # title, stack, links, cover — frontmatter + prose
  photos/manifest.ts      # {src, alt, category, w, h} — drives the gallery
  personas/*.ts           # copy + tokens, so a new persona is mostly data
```

---

## Data-drive the persona layout

To make personas *truly* data-driven, describe each persona's page as a **list of blocks** rather than a bespoke JSX branch:

```ts
const PERSONA_LAYOUT: Record<Persona, Block[]> = {
  engineer:     [{ type: "hero" }, { type: "identity" }, { type: "projects" }],
  trader:       [{ type: "hero" }, { type: "calendar" }, { type: "identity" }, { type: "graph" }],
  photographer: [{ type: "hero" }, { type: "identity" }, { type: "gallery" }],
};
```
Then a single renderer maps blocks → components. Adding a persona becomes *one data entry* plus a token block, instead of a new hand-written branch. This is the refactor that makes the 4th persona cheap.

---

## The photographer persona will force the issue first

A gallery is *inherently* content-heavy and the current implementation is four empty gradient squares. The moment you add real photos you'll want: a manifest, `next/image` with correct `width`/`height` (for CLS-free layout), lazy loading below the fold, a lightbox, and categories. That's exactly the workload Rung 1 is designed for. Don't build the gallery as more hardcoded JSX — build it as the first data-driven block.

---

## Scalability things that are genuinely fine

- **Traffic/hosting** — Vercel free tier + mostly static content scales to any realistic personal-site load. No concern.
- **The token system** scales well *stylistically* — adding a themed persona is a CSS data problem, not a rewrite.
- **Type safety** means refactors toward a data-driven model will be caught by the compiler, which lowers the risk of the migration.

---

## Summary

- You are correctly at Rung 0. **Stay there until you have real content — then jump to Rung 1 (local MDX/typed content), not straight to a CMS.**
- The real scalability debt is **layout coupled to identity**. Data-drive the persona layout so a new persona is data, not a code branch.
- Build the photographer gallery as the *first* data-driven block; it's the piece that will demand the model anyway.
- Don't add a CMS or admin panel until editing-without-deploying is a genuine, felt pain. Your docs already have the discipline to defer this — keep it.
