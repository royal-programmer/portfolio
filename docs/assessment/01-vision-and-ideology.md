# 01 — Vision & Ideology

## What the project is trying to be

One URL, three identities — **Engineer**, **Trader**, **Photographer** — presented as "modes" of one person rather than three separate sites, with hidden triggers (logo hold, Konami code) that reward curiosity. The stated goals (`docs/01-objectives.md`) are: premium modern UI, discoverable easter eggs, free-tier hosting, and honest/maintainable scope.

## My honest opinion of the idea

**The core concept is genuinely good and differentiated.** Most developer portfolios are a linear scroll of "About / Projects / Contact." A person who is credibly three things — and expresses that with a single cohesive design language that re-themes itself per identity — is memorable. The design-token system (`globals.css`) that recolors the *entire* site per persona × theme is the right technical expression of that idea. This is a concept with a real hook.

**But the ideology has three tensions it hasn't resolved yet.**

### Tension 1 — "Clever" is fighting "clear"

The multi-persona switch is currently **hidden behind easter eggs only**. There is no visible, obvious way to discover that Trader and Photographer exist. Re-read your own objective:

> "Recruiters / hiring managers — Quick scan of engineering depth, projects, and contact."

A recruiter with 20 seconds will **never** press-and-hold your logo for 1.3 seconds or type `↑↑↓↓←→←→BA`. They will see Engineer, not find projects (placeholders), and leave. The easter eggs are a delightful *secondary* layer, but they are currently carrying the *primary* job of navigation. That is the central ideological flaw: **the site is designed to reward the curious, but built for an audience that is impatient.**

The fix is not to remove the easter eggs — keep them, they're charming. It's to add an **honest, visible way in** (a persona toggle/segmented control somewhere obvious) and let the hidden triggers be the delight-on-top. See [04-accessibility-and-ux.md](./04-accessibility-and-ux.md).

### Tension 2 — Do the three personas help or dilute?

Be honest with yourself about the *goal* of the site:

- **If the goal is a software job** → Trader and Photographer can *dilute* the signal. A hiring manager may read "jack of three trades" instead of "strong engineer." In that case, Engineer should be the loud default and the others a tasteful "I also…" — which the current architecture supports well.
- **If the goal is personal brand / freelance / range** → the three-in-one is the whole point and should be *front and center*, not hidden.

Right now the site hedges: Engineer is the forced default (good for the job case), but the others are hidden (bad for the brand case), so it half-serves both. **Pick the primary audience and let the architecture lean into it.** The tech is flexible enough to do either; the product decision hasn't been made.

### Tension 3 — "Honest, maintainable scope" vs. what got built

Your objective explicitly says: *"Start with a solid shell and placeholder content; evolve sections as real copy, projects, and media arrive."* That's a wise plan. But the effort ledger tells a different story:

| Built (high effort) | Still placeholder / stub (the actual product) |
|---|---|
| Sequential motion orchestrator (`persona-motion-slots.tsx`) | Real projects |
| Web Audio persona stingers | Real photos / gallery / lightbox |
| Faked "AI assistant" chat with typing simulation | Real trader narrative + disclaimer |
| Persona × theme token matrix | Resume / CV / case studies |
| Konami code + hold-chain gestures | A contact path that actually reaches you |

This is the **"mechanism over message"** trap. It is more fun to build a shader-like wash transition than to write three honest paragraphs about your work — but only one of those gets you hired. The shell is done and then some; the scope discipline slipped on the part that was supposed to come *first*.

## What's missing at the vision level

- **A stated primary goal.** Nowhere does the repo say "this exists to get me a senior frontend role" or "…to book photography clients." Without that, every design trade-off is a coin flip. Add a one-line "north star" to `docs/01-objectives.md`.
- **A proof for each persona.** A persona without evidence is a costume. Engineer needs shipped work; Photographer needs photos; Trader needs an honest, compliant story. Identity claims with no artifacts read as aspiration, not accomplishment.
- **A reason to switch.** Even if a visitor discovers the personas, why would they switch? There's no cross-persona narrative ("the same systems thinking shows up in my code, my trading, and my composition"). The switch is currently a *visual* payoff with no *story* payoff.

## What's genuinely right — keep it

- The single-cohesive-language, re-theming-per-identity concept. Don't dilute this.
- Engineer-as-default. Correct call for the most likely audience.
- The "evolve as real content arrives" philosophy in the docs. It's right — just under-followed.
- Reduced-motion respect baked into the concept from the start. Shows maturity.

## Recommendation

> **Reframe the project from "a clever multi-persona toy" to "the fastest way for a specific audience to believe I'm good at a specific thing — with a delightful multi-persona layer on top."**

Concretely:
1. Write the north-star sentence. Decide the primary audience.
2. Make one persona (the primary) *complete* end-to-end with real content before polishing the transition for the 4th time.
3. Keep the easter eggs, but add a visible door.
4. Give the personas a one-line connective thread so switching means something.
