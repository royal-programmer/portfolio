# 03 — Performance

The good news: you use `next/font` (self-hosted, no layout shift) and `next/image` for the avatar. The bad news: several concrete, measurable problems, one of which is embarrassingly easy to fix.

---

## Flaw 1 — The 1 MB avatar (fix this today)

`public/profile-cartoon-avatar.png` is **1,093,464 bytes (~1.04 MB)**. It renders at **~84×84 px**.

That is roughly **50× larger than it needs to be.** At 84px (≈168px for 2× retina), a well-compressed WebP/AVIF avatar is **15–30 KB**. You are shipping about a megabyte of PNG to paint a thumbnail, and because it's in the header with the `R.jpg` crossfade, it's requested on every single visit.

**Fix (no code, just assets):**
- Resize source to ~200×200, export as AVIF or WebP.
- Or let `next/image` do it: add a larger intrinsic source but the real win is not shipping a 1 MB original. `next/image` will generate responsive sizes, but it can't fix a 1 MB *source* being needlessly huge on disk and in git history.
- Target: **< 30 KB.** Expect a visible LCP/bandwidth improvement on mobile.

This single change is the highest performance-return action in the repo.

---

## Flaw 2 — Everything renders on the client

Because `page.tsx` and all leaves are `"use client"` (see [02](./02-architecture-and-code.md)), the browser must download, parse, and hydrate JS before the page is meaningfully interactive — including `framer-motion` (a large dependency) and `react-type-animation`. On a mid-range phone on 4G this is where portfolios lose their Lighthouse "Performance" and "TBT" scores.

**Impact:** higher Total Blocking Time, later Time-to-Interactive, larger First Load JS.
**Fix:** move static content to server components (detailed in [02](./02-architecture-and-code.md)). The static hero/identity/cards don't need to be JS at all.

---

## Flaw 3 — Background images aren't optimized or preloaded

`persona-backdrop.tsx` sets remote Unsplash URLs via **CSS `background-image`**, not `next/image`. Consequences:

- **No optimization / no responsive sizing** — Next can't touch a CSS background. You're serving a `w=1600`/`w=1920` JPEG to a phone.
- **No preload** — the backdrop is very likely your **LCP element** (full-bleed hero image). It's discovered late (after CSS parses), so LCP suffers.
- **Third-party dependency on the critical path** — if Unsplash is slow/blocked, your hero is slow. Your own docs flag this ("swap to local if offline CDN blocked").
- **`next.config.ts` has no `images.remotePatterns`** — so you couldn't use `next/image` with those Unsplash URLs even if you wanted to, without config.

**Fix options (in order of preference):**
1. Self-host optimized persona backgrounds in `public/` (also fixes licensing) and use `next/image` with `priority` on the active one, or a `<link rel="preload" as="image">` for the LCP background.
2. If keeping Unsplash, add `remotePatterns` and render via `next/image` fill instead of CSS background.
3. At minimum, request smaller Unsplash sizes per breakpoint.

---

## Flaw 4 — Always-on animation cost

- The header runs a `setInterval` crossfade **every 2 seconds, forever** (`home-header.tsx`), swapping two `next/image` layers. It respects reduced-motion (good) but for everyone else it's a perpetual repaint in the top-left for the life of the page. Consider pausing when the tab is hidden (`document.visibilityState`) or when off-screen.
- `framer-motion` `whileInView` animations on hero/identity/cards are fine, but they **don't respect `prefers-reduced-motion`** (only the persona-*switch* transitions do, via the prefs hook). A reduced-motion user still gets the entry slides/fades on `HomeHero`, `IdentityPanel`, `ProjectsGrid`. That's a consistency + comfort gap.
- Multiple `backdrop-blur-2xl` glass surfaces stacked over a background image are **GPU-expensive**, especially on mobile Safari. It looks great; just know it's a real cost and test on a mid-range Android.

---

## Flaw 5 — No performance budget or measurement

There's no Lighthouse CI, no bundle analysis, no Web Vitals reporting. `docs/03` lists "Performance pass" as a to-do but nothing measures regressions. You can't defend a number you never look at.

**Fix:** add `@next/bundle-analyzer` for a one-time look, and either Vercel Speed Insights (one line, free tier) or the `useReportWebVitals` hook to capture real LCP/CLS/INP from actual visitors.

---

## Quick wins checklist

- [ ] Recompress `profile-cartoon-avatar.png` → < 30 KB (biggest single win).
- [ ] Self-host + `next/image` the persona backgrounds; `priority`/preload the active one.
- [ ] Move static content to server components.
- [ ] Gate the header crossfade on tab visibility.
- [ ] Extend reduced-motion handling to the `whileInView` entrance animations.
- [ ] Add `next.config.ts`: `images.remotePatterns` (if remote), `compress`, `poweredByHeader: false`.
- [ ] Add bundle analyzer + Web Vitals once, establish a baseline.

---

## What's already good

- `next/font` with Geist — self-hosted, subsetted, zero CLS from fonts.
- `next/image` on the avatar with `sizes` and `priority` — right primitives (just a wrong-sized source).
- Reduced-motion is a first-class concern in the transition system.
- `overflow-x-clip` guards against horizontal scroll during transitions.
