# 02 — Architecture & Code Quality

## Overall impression

The component decomposition is **clean and readable**. Files are well-named, types are used properly (`strict: true`, discriminated unions for `Persona`), and the recent refactor into `app/components/` + `app/hooks/` shows good instincts. The motion orchestrator is a legitimately sophisticated piece of engineering. This is not junior code.

The problems are **structural, not stylistic**: the app fights the framework it's built on, and one component has become a god-object.

---

## Issue 1 — Almost the entire app is a client component

`app/page.tsx` is `"use client"` and ~540 lines. It pulls in `framer-motion`, the chat engine, the audio engine, theme state, and the whole dock. Every leaf component is also `"use client"`. The **only** server components in the app are `layout.tsx` and the two API routes.

**Why this matters:** you're on Next.js 16 App Router — the entire value proposition is React Server Components: ship HTML, stream, keep JS off the client. This app opts out of nearly all of it. Consequences:

- Larger JS bundle shipped and hydrated on first load (framer-motion alone is heavy).
- Content that could be static HTML (hero copy, identity points, project cards) is instead rendered by client JS.
- Worse Time-to-Interactive and worse crawlability (see [05](./05-seo-and-discoverability.md)).

**What "good" looks like:** the static content (headings, copy, cards, backgrounds) should be **server components**, and only the genuinely interactive islands (`BubbleDock`, the logo gesture button, the transition orchestrator) should be `"use client"`. A persona's content is data — it can be rendered on the server and re-themed with CSS variables (which you already do) without shipping it as JS.

```tsx
// Sketch: page.tsx becomes a server component
export default function Home() {
  return (
    <main>
      <PersonaBackdrop />          {/* server: just markup + CSS var */}
      <PersonaBody />              {/* server: static content per persona */}
      <ClientChrome />             {/* "use client": gestures, dock, transitions */}
    </main>
  );
}
```

The current design *couples* "this content changes with persona" to "this must be client JS." It doesn't have to — `data-persona` on `<html>` + CSS already does the theming server-side. Only the *switching interaction* needs the client.

> Caveat worth acknowledging: your persona reset-on-reload logic (see below) currently *requires* client JS to pick the persona, which pushes everything client-side. Decoupling these (URL-driven persona, see [05](./05-seo-and-discoverability.md)) is what unlocks the server-component win. They're the same fix.

---

## Issue 2 — `page.tsx` is a god-component

It simultaneously owns: theme state, sound state + persistence, the Web Audio synth (`playPersonaStinger`, ~40 lines), the logo hold/chain gesture machine, the Konami listener, **and** the entire agent-chat engine (message queue, typing simulation, lead flow state machine, fetch orchestration — roughly lines 239–481). That's at least five unrelated responsibilities in one function component.

**Concrete extraction targets:**

| Responsibility | Lines (approx) | Extract to |
|---|---|---|
| Agent chat + lead flow + queue | 239–481 | `useAgentChat()` hook (or a `useReducer`) |
| Web Audio stinger | 117–159 | `usePersonaStinger()` hook |
| Logo hold/chain gesture | 200–228 | `useLogoPersonaGesture()` hook |
| Konami listener | 169–198 | `useKonami(onTrigger)` hook |
| Theme + sound persistence | 76–96 | `useUiTheme()` / `useSoundPref()` |

The chat logic especially is a **state machine** (`leadStep: 0|1|2|3`, buffering, typing, loading) implemented with ~8 `useState`/`useRef` and imperative timers. This is the textbook case for `useReducer` — the current version has several interacting booleans (`assistantBuffering`, `chatLoading`, `assistantActivelyTyping`, `agentComposerLocked`) whose valid combinations aren't enforced anywhere, which is how subtle "input enabled at the wrong moment" bugs appear.

**Benefit:** `page.tsx` drops to ~80 lines of composition, each concern becomes independently testable (see [08](./08-concrete-flaws-and-bugs.md) on the total absence of tests), and the server/client split from Issue 1 becomes trivial.

---

## Issue 3 — Persona persistence is over-engineered for a one-page app

`persona-provider.tsx` uses `PerformanceNavigationTiming` + `sessionStorage` to implement: "reload/navigate → Engineer; back_forward → restore." But **there is only one route.** There is no `/projects`, no `/photography`. The `navigate` and `back_forward` branches handle client navigations that cannot currently happen. `docs/05` even documents "Client-side navigation keeps persona" — a behavior with no surface to occur on.

This isn't wrong, but it's **speculative complexity**: code maintained for a feature that doesn't exist. Either:
- add the routes that justify it (multi-page persona sections), or
- simplify to "default Engineer on load, switch in-session" until routes exist.

Also note the **deeper consequence**: because persona lives only in React state + sessionStorage and resets on reload, it can never be part of the URL, which is what blocks deep links, SEO, and SSR simultaneously. See [05](./05-seo-and-discoverability.md).

---

## Issue 4 — Duplicated sources of truth

- **"About" copy exists twice**: client `handleQuickAction` (`page.tsx` ~391) and server `/api/chat` `aboutMap`. Same three sentences, two places, will drift.
- **`PersonaBackdrop` is defined twice** — the component appears both in `persona-backdrop.tsx` and inlined identically inside... (verify: the file `persona-backdrop.tsx` content was returned twice in review, which suggests only one file — but the `showFlash` prop is always passed `false` from `page.tsx`, so the entire flash/sweep branch, ~half the component, is dead code).
- **The dark-theme token block is copy-pasted** between `[data-ui-theme="dark"]` and `@media (prefers-color-scheme: dark)` in `globals.css` (lines 35–85), and again for trader (110–154). ~90 lines of duplicated custom properties. One edit now needs to be made in two places or the explicit-dark and system-dark themes silently diverge.

---

## Issue 5 — CSS token system is powerful but inconsistent

The persona × theme matrix is a great pattern, but:
- **Trader** fully specifies its palette (bg, fg, muted, accent, panels…).
- **Photographer** only overrides `--accent` and a few glows — it inherits Engineer's blue-tinted panel borders and structure. So "Photographer light" is really "Engineer light with pink accents," which is visually inconsistent with how thoroughly Trader is themed.
- There's no single place that documents *which* tokens every persona is expected to define. A `--persona-*` contract (a checklist of required tokens) would prevent the drift.

---

## Smaller notes

- **`next.config.ts` is empty.** No image `remotePatterns`, no security headers, no `poweredByHeader: false`. (See [03](./03-performance.md), [06](./06-security-and-privacy.md).)
- **No `error.tsx`, `loading.tsx`, or `not-found.tsx`.** An unhandled throw in any client component shows the default Next error overlay in dev and a blank/ugly state in prod. A portfolio should never show a raw error.
- **`TypewriterText`** calls `onDone()`/`onProgress()` inside `useEffect` on every tick; `onProgress` firing each character is fine, but `onDone` is called during render-effect and depends on stable callback identity from the parent — works, but fragile. A `requestAnimationFrame`-driven or CSS approach would be steadier.
- **`package.json` has no `engines` field** though `docs/04` references one; no `.nvmrc`. Node version is unpinned for contributors and CI.
- **"Monorepo" is aspirational.** There are no workspaces — it's one npm package plus a docs folder. That's fine, but the docs oversell it; don't add Turborepo/workspaces complexity unless a second package actually appears.

---

## What's genuinely good — keep it

- The `forwardRef` + imperative-handle orchestrator pattern for sequencing exit/enter animations is elegant and correct.
- Hooks are already being extracted (`use-persona-transition-*`) — the instinct is right, just apply it to the chat/audio/gesture code too.
- Types are honest; no `any` sprinkled around; `strict` is on.
- The registry/context pattern in `persona-motion-slots.tsx` is a clean way to coordinate N independent animated regions.

## Recommended target architecture

```
app/
  layout.tsx                 (server)
  page.tsx                   (server) — composes body + client chrome
  persona/[name]/page.tsx    (server) — real routes → SSR + deep links + SEO
  components/
    server/  hero, identity, projects, gallery   (no "use client")
    client/  bubble-dock, logo-gesture, transition-orchestrator
  hooks/
    use-agent-chat.ts        (reducer-based state machine)
    use-persona-stinger.ts
    use-logo-gesture.ts
    use-konami.ts
  lib/
    content.ts               (typed persona content — single source)
    chat-engine.ts           (shared reply logic, used by client + /api)
```

This keeps everything you've built, but moves static content to the server, isolates interactivity into small testable hooks, and makes personas real URLs.
