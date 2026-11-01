# 04 — Accessibility & UX

There's real accessibility *intent* here — reduced-motion handling, `role="switch"` toggles with `aria-checked`, `aria-live` regions, `sr-only` labels, focus-visible outlines. That puts you ahead of most portfolios. But the **central UX decision undermines all of it**, and a few concrete issues remain.

---

## The central problem — navigation is an undiscoverable easter egg

The **only** ways to reach Trader or Photographer are:
1. Press-and-**hold** the logo for 1.3s, chained 1×/2×/3× within a ~500ms window, or
2. Type the Konami code `↑↑↓↓←→←→BA`.

Think about who *cannot* do this:

- **A keyboard-only user** can't press-and-hold a pointer gesture. The Konami code technically works, but no one knows it's there — there is no announced affordance.
- **A screen-reader user** hears the logo labelled "Portfolio profile — hold to switch persona." Even if they parse that, "hold" is a pointer gesture with no keyboard equivalent exposed. Two-thirds of your site's content is unreachable to them.
- **A touch user** has to discover a timed multi-tap-then-hold gesture with different timing windows for touch (680ms) vs mouse (520ms). This is a *hidden* interaction; discoverability is zero by design.
- **A recruiter in a hurry** (your stated primary audience) will simply never do it.

The hint text in `IdentityPanel` ("1× click + hold → Engineer…") documents the gesture, but that panel is *inside* the persona view you can only reach *after* using the gesture. It explains the door only to people already through it.

**This is the highest-impact UX fix in the project:** add a **visible, standard persona switcher** — a segmented control or three labelled tabs — somewhere obvious (header or a fixed control). Keep the logo-hold and Konami as *bonus* delight. Bonus interactions are wonderful; **primary navigation must be visible, keyboard-operable, and announced.**

Pair this with `?persona=` deep links (see [05](./05-seo-and-discoverability.md)) so a persona can be *shared*, not just *discovered*.

---

## Other accessibility issues

### Contrast risk on glass-over-image surfaces
`--muted` text (`#475569` light / `#b7bfd3` dark) sits on **translucent** panels (`--surface-bg` at 0.52–0.62 alpha) that sit over **background photos** whose opacity changes per persona/theme (0.22–0.75). The effective contrast of muted text therefore depends on the *photo behind it*, which is uncontrolled. This is very likely to fail WCAG AA (4.5:1) in some persona×theme×image combinations — particularly Trader dark, where `--bg-image-opacity` is 0.75. **Action:** test every persona×theme with a contrast checker on the muted body text and the eyebrow text; consider a solid text-protection scrim behind copy blocks rather than relying on panel translucency.

### The CTA buttons do nothing
`HomeHero`'s "View engineering projects" / "Explore trading journal" / "View photography" buttons have no `onClick` and no `href`. A keyboard user tabs to them, they receive focus, activating them does nothing. A dead primary CTA is worse than no CTA — it signals "broken." Either make them anchor links to the relevant section/route or remove them until they lead somewhere.

### Heading structure
There's a single `<h1>` (hero heading) which is good, but `IdentityPanel` and the project cards use `<h3>` with no intervening `<h2>` — a minor heading-hierarchy skip. Screen-reader users navigating by heading get an inconsistent outline.

### `aria-live` scope is too broad
`page.tsx` wraps the entire persona body in `aria-live="polite"` + `aria-busy={washOpen}`. Marking a large region live means *any* change inside it may be announced. During a persona switch the whole body swaps — a screen reader may try to read the entire new page, or nothing predictable. Prefer a small, dedicated live region that announces just "Switched to Trader mode," and leave the body out of the live region.

### Focus management on persona switch
When the persona changes, focus stays wherever it was (often the logo). There's no announcement of *what changed* and no focus move to the new content. Combined with the broad live region, the experience for AT users is unpredictable. A focused approach: after switch, move focus to the new `<h1>` (or send a polite announcement) so the change is perceivable.

### The chat is a focus/timing maze
The agent composer is locked/unlocked through a chain of booleans (`agentComposerLocked = leadStep>0 || assistantBuffering || chatLoading || assistantActivelyTyping`). During the simulated "thinking" and typing, inputs disable and re-enable on timers. For a sighted mouse user this feels "alive," but for AT users the shifting disabled states and auto-focus (`leadInlineFieldRef.current?.focus()`) can yank focus unexpectedly mid-interaction. Worth an audit with a screen reader.

---

## Pure-UX critique (beyond a11y)

- **Placeholder content erodes trust.** "Selected work with product thinking…" with no actual work behind it reads as a template. Empty gallery squares and a "Performance (sample)" bar chart with hardcoded numbers can look like *fake data* rather than *coming soon* — arguably worse than an honest "In progress" state.
- **The fake "AI Agent" over-promises.** It's introduced as "Ratul's AI assistant" but is a keyword matcher with an artificial 880ms "thinking" delay. A technical visitor will type one off-script question, get the generic fallback, and immediately clock it as fake — which undercuts the *engineering* credibility the site is trying to establish. Either make it genuinely useful (real model, see [06](./06-security-and-privacy.md)) or present it honestly as a "quick links / contact" bot, not "AI."
- **The value of switching isn't paid off.** Once a user *does* switch, the layout barely changes (hero + panel + a themed card). The reward for discovering the easter egg is mostly a recolor. Either make each persona's layout meaningfully distinct (real gallery, real journal) or dial back the promise.
- **No visible feedback that more personas exist.** Even a subtle "1 of 3" indicator or dots would tell users there's more to find, turning a hidden feature into an *inviting* one.

---

## What's genuinely good — keep it

- Reduced-motion is respected in the switch system and the header, with static fallbacks.
- Toggles use proper `role="switch"` + `aria-checked` + labels.
- Focus-visible outlines are styled, not removed.
- The logo guards against the mobile long-press "save image" sheet — thoughtful touch detail.
- `sr-only` "Thinking" status on the chat loader is a nice touch.

## Priority order

1. **Visible, keyboard-accessible persona switcher** (unblocks everyone; also SEO/deep-link enabler).
2. Make CTAs actually navigate (or remove).
3. Contrast audit across persona×theme, add a text scrim.
4. Replace fake data placeholders with honest "coming soon" states, or real content.
5. Tighten `aria-live` scope + add a switch announcement + manage focus.
