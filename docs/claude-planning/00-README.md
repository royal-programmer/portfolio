# Claude Planning — Portfolio Platform Direction

> **Status:** Living planning docs. Opinion + agreed direction, no code changes yet.
> **Started:** 2026-07-19
> **Owner:** Ratul Roy
> **Relationship to `docs/assessment/`:** The assessment is the *diagnosis* of the current repo. This folder is the *forward plan* we're building together. Assessment stays untouched.

---

## What this folder is

A record of our discussion about evolving the portfolio from a **multi-persona showcase** into a **personal platform** — "a system that represents me" — that Ratul can feed content into daily from his phone, entirely on free tooling.

Everything here is decisions + reasoning, so future-us (or a future subagent) can pick up without re-deriving the thinking.

---

## The vision, in one paragraph

The portfolio is not one website — it's **several audience-targeted front doors sharing one engine.** Each persona (Engineer, Trader, Photographer, Artist, Rider, Gamer) is a standalone landing page that Ratul links directly to the right audience. Visitors don't need to hop between personas; the unified "who is this person" experience is an easter-egg bonus for the curious. Behind all of them sits **one content engine** with a public/private visibility model, fed by **phone-first "capture apps"** (a trade journal, a photo uploader, a ride tracker) so that keeping the site alive is low-friction. The entire stack is free.

---

## Guiding principles (the rules we're holding ourselves to)

1. **Fill rooms before building new ones.** A rich 2-persona site beats an empty 6-persona one. Personas ship one-at-a-time, fully, not all-scaffolded-at-once.
2. **Build the spine once.** Personas are ~90% the same shape (entries + media + blog + groups + visibility). Build a generic content engine; personas are extensions on top.
3. **Capture must be frictionless.** If logging a trade or uploading a photo takes more than a few taps on a phone, it won't happen. Ergonomics is a feature, not polish.
4. **Public by choice, private by default where it matters.** Every entry carries a visibility flag. Ratul decides what the world sees.
5. **Entirely free — for now.** No paid tools. When budget exists, upgrade paths are noted but never assumed.
6. **Content is the product; mechanism is the means.** (Carried over from the assessment. Every hour on machinery must eventually pay off in real content shipped.)

---

## Index

| Doc | What it covers |
|-----|----------------|
| [01-vision-and-brand-strategy.md](./01-vision-and-brand-strategy.md) | Persona-as-entry-point model, audience per persona, tiering, what "brand" means here. |
| [02-persona-catalog.md](./02-persona-catalog.md) | Every persona: audience, entry type, features, companion capture app, tier, status. |
| [03-content-and-capture-model.md](./03-content-and-capture-model.md) | The shared content spine, public/private visibility, and the phone-first capture apps. |
| [04-free-tech-stack.md](./04-free-tech-stack.md) | The entirely-free stack: DB, auth, storage, maps, charts, EXIF, PWA — with tradeoffs. |
| [05-architecture.md](./05-architecture.md) | How it fits together: one app, public-read vs authenticated-capture, route structure. |
| [06-roadmap-and-phasing.md](./06-roadmap-and-phasing.md) | Sequenced build plan. What ships first, what proves the loop, what waits. |
| [07-open-questions-and-decisions.md](./07-open-questions-and-decisions.md) | Live decisions still needed, honest risks, and free-tier limits to watch. |

---

## The agreed north star (from the discussion)

- **#1 job of the site:** an instant snapshot of *who Ratul is*, delivered per-audience. Engineer persona sells engineering; photography persona sells photography; etc. Ratul provides the targeted entry point per audience.
- **Content cadence:** varies by persona — trades daily, photos a few times a month, engineering projects every few months, blogs opportunistically.
- **Capture strategy:** the same platform exposes lightweight, phone-friendly capture endpoints (journal / upload / ride) so daily/frequent content doesn't require "loading up the website to make an entry."
- **Trader data:** tracks Ratul's real portfolio, with two views — a curated **public** view and a private **personal** tracking view.
- **Budget:** $0. Fully free tooling now; paid upgrades deferred.
