# 08 — Concrete Flaws, Bugs & Smells

A specific, file-referenced list. Severity: 🔴 fix soon · 🟡 should fix · 🟢 polish/nit. Line numbers are approximate to the reviewed commit (`0c7cee1`).

---

## 🔴 High impact

### 1. 1 MB avatar for an 84px image
`public/profile-cartoon-avatar.png` — **1,093,464 bytes** rendered at ~84×84. Recompress to < 30 KB. (Full detail in [03](./03-performance.md).) Also lives in git history at full size.

### 2. Lead capture silently drops real user data
`app/api/lead/route.ts:26` — only `console.log`s the lead, but the UI promises "Ratul will get back to you soon." The message to the user is currently false. Wire to email/DB. (See [06](./06-security-and-privacy.md).)

### 3. Two-thirds of the site is unreachable without a hidden gesture
No visible way to reach Trader/Photographer; keyboard and screen-reader users effectively can't. (See [04](./04-accessibility-and-ux.md).) This is a UX bug, not just a preference.

### 4. Dead primary CTAs
`home-hero.tsx:56` — the persona CTA button ("View engineering projects", etc.) has no `onClick`/`href`. It focuses but does nothing. A broken primary action reads as "site is broken."

### 5. Crawlers/social scrapers see an empty Engineer shell
Client-only rendering + forced-Engineer-on-load means no meaningful SSR HTML and no per-persona metadata/OG. (See [05](./05-seo-and-discoverability.md).)

---

## 🟡 Should fix

### 6. No error / not-found / loading boundaries
No `app/error.tsx`, `app/not-found.tsx`, or `app/loading.tsx`. Any client throw yields the default error overlay (dev) or a broken state (prod). A portfolio should degrade gracefully.

### 7. `page.tsx` god-component
~540 lines mixing chat engine, audio synth, gesture machine, Konami, theme/sound state. Extract to hooks; convert the chat/lead flow to `useReducer`. (See [02](./02-architecture-and-code.md).) The interacting booleans (`assistantBuffering`, `chatLoading`, `assistantActivelyTyping`, `leadStep`) have no enforced valid-state model — a breeding ground for "input enabled at the wrong time" bugs.

### 8. Duplicated dark-theme token blocks in `globals.css`
Lines ~35–85 (`[data-ui-theme="dark"]` vs `@media prefers-color-scheme:dark`) and ~110–154 (trader) are near-verbatim copies. Editing one and forgetting the other makes explicit-dark and system-dark silently diverge. Deduplicate (share a block, or generate).

### 9. Inconsistent persona theming
`globals.css` — Photographer only overrides `--accent`/glows (~156–184) and inherits Engineer's panel/border tokens, while Trader fully re-specifies its palette. "Photographer" is really "Engineer + pink." Define a required-token contract per persona.

### 10. "About" copy duplicated across client and server
`page.tsx:391` (`handleQuickAction`) and `app/api/chat/route.ts` `aboutMap` hold the same three sentences. They will drift. Single-source it (a shared `lib`), used by both the client quick-action and the API.

### 11. FOUC for users with an explicit theme
`page.tsx:76-92` applies `data-ui-theme` in a post-mount `useEffect`. A user who chose Light while their OS is Dark (or vice-versa) sees a flash of the wrong theme before hydration. Fix with a tiny blocking inline script in `<head>` that sets `data-ui-theme` from `localStorage` before first paint. (System theme is fine — it's handled by the CSS media query.)

### 12. Fake AI with fake latency, labelled "AI"
`app/api/chat/route.ts` keyword matcher + `CHAT_MIN_THINKING_MS` artificial delay, presented as "Ratul's AI assistant." Credibility risk on an engineer's site. Make it real or right-size the claim. (See [06](./06-security-and-privacy.md).)

### 13. No request-size limit on API routes
Both routes `await req.json()` with no cap. Large POST bodies are parsed unconditionally. Add a size guard.

### 14. `whileInView` animations ignore reduced-motion
`home-hero.tsx`, `identity-panel.tsx`, `projects-grid.tsx` run entrance slides/fades unconditionally. Only the persona-*switch* system checks `prefers-reduced-motion`. Inconsistent; extend the check.

### 15. Placeholder "sample" data can read as fake data
`persona-home-body.tsx` — `TraderGraphCard` renders a hardcoded bar chart labelled "Performance (sample)"; the gallery is empty gradient squares. Better to show an explicit "coming soon" state than plausible-looking fabricated numbers.

---

## 🟢 Nits & polish

### 16. Dead code: persona flash/sweep in `PersonaBackdrop`
`persona-backdrop.tsx` — `showFlash` is always passed `false` from `page.tsx:485`, so ~half the component (the white flash + accent sweep, lines ~29–51) never renders. Either wire it into the transition or delete it.

### 17. Stale metadata description
`layout.tsx:18` says "dual-mode" but there are three personas. First thing Google shows.

### 18. Speculative navigation logic
`persona-provider.tsx:34-58` handles `navigate`/`back_forward` client navigations that can't happen (single route). Fine, but it's maintained complexity for a non-existent feature. (See [02](./02-architecture-and-code.md).)

### 19. Header crossfade runs forever
`home-header.tsx:29` — `setInterval` every 2s for the page's lifetime, even when the tab is backgrounded. Gate on `document.visibilityState`.

### 20. Konami listener is always-on and global
`page.tsx:169-198` attaches a `keydown` listener to `window` for the page's life, lowercasing and buffering every keystroke. Harmless, but it also means the sequence can fire while the user is typing in the chat input (typing "b" then "a" after arrows). Consider ignoring events when an input/textarea is focused.

### 21. `package.json` has no `engines`, no `.nvmrc`
`docs/04` references engines "if added later" — they weren't. Node version is unpinned for CI/contributors.

### 22. No `npm run typecheck` script
`tsc --noEmit` isn't wired as a script; type errors only surface at build. Add `"typecheck": "tsc --noEmit"`.

### 23. `README.md` still contains create-next-app boilerplate
`portfolio-site/README.md:36+` — leftover default text below your real content.

### 24. Heading hierarchy skips
`identity-panel.tsx` / `projects-grid.tsx` use `<h3>` with no `<h2>` between them and the hero `<h1>`. Minor SR-outline inconsistency.

---

## The elephant: zero tests, zero CI

There is **not a single test file** and **no CI pipeline**. No unit tests on the lead-validation regex, no test on the Konami matcher, no component/interaction tests on the chat state machine, nothing running `eslint`/`tsc`/`build` on push. For a shell this is survivable; the moment you add real logic (auth, payments-free but a real contact pipeline, an AI route with rate limiting) it becomes risky. Minimum viable:
- A GitHub Actions workflow running `lint` + `typecheck` + `build` on every PR.
- A few unit tests (Vitest) on the pure logic: email regex, Konami sequence, persona-chain streak math.
- One interaction test (Testing Library) on the lead flow happy path.

This isn't about coverage numbers — it's about not shipping a white screen because a refactor broke hydration and nothing caught it.
