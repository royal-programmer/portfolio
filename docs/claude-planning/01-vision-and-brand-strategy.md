# 01 — Vision & Brand Strategy

## The model: personas as audience-targeted front doors

The earlier assessment worried that a multi-persona site risks feeling like *many hobbies* instead of *deep expertise*, and that switching between personas could feel fragmented — "6 sites, not one person."

Ratul's clarification resolves this:

> "It's not like they need to traverse from one persona to another. I will be the one providing them the persona-targeted entry point. If they want to know me more, they can use the easter egg."

That reframes the whole product:

- Each persona is a **standalone landing page for a specific audience.** Ratul shares the *right door* with the *right person* — a recruiter gets `/engineer`, a photo client gets `/photography`, and so on.
- Visitors are **not asked to explore** all personas. No cognitive load, no dilution of the professional signal for the audience that matters.
- The **unified "who am I"** experience (the current persona-switching easter egg) becomes a **delightful bonus** for the curious, not the primary navigation. This is exactly where that clever mechanism belongs — it stops fighting the professional use-case and becomes pure upside.

**Consequence:** deep-linkable, independently-SEO'd persona pages are now *core infrastructure*, not a nice-to-have. Each persona needs its own metadata, its own OG image, and its own indexable content (this directly answers the assessment's SEO 2/5 score — see `05-seo` in the assessment).

---

## What "brand" means for this project

The brand is not any single persona. The brand is **"a person who builds a system to represent himself."** The *platform itself* — the fact that the trade journal, photo pipeline, and ride tracker are all custom-built and wired into one home — is a demonstration of the engineering persona, no matter which door a visitor enters through. The medium is part of the message.

That's a genuinely strong, differentiated brand. Most portfolios *describe* skill; this one *is* an artifact of it.

---

## Persona tiering

Not all personas carry equal weight or deserve equal engineering. We tier them so effort maps to payoff:

| Tier | Personas | Rationale | Feature depth |
|------|----------|-----------|---------------|
| **Primary — get hired** | Engineer | The professional core; the platform itself proves it. | Full, polished, first. |
| **Signature — differentiate** | Trader, Photography | Rare, interesting, high-substance. Genuinely set Ratul apart. | Rich, bespoke features (journal, EXIF, charts). |
| **Personal — "this is me"** | Artist, Travel/Ride, Gamer | Humanize the brand. Lower professional signal. | Reuse the shared spine; minimal bespoke work. Automate where possible. |

**Rule:** a Tier-3 persona should cost almost nothing beyond the shared spine. If it demands heavy bespoke engineering, either it earns promotion to Tier-2 with a real audience justification, or it waits.

---

## Audience per persona (who each door is for)

| Persona | Primary audience | What they should feel in 5 seconds |
|---------|------------------|------------------------------------|
| Engineer | Recruiters, eng managers, collaborators | "This person ships real, well-built software." |
| Trader | Trading peers, finance-curious, himself | "Disciplined, data-driven, transparent about a real process." |
| Photography | Photo clients, fellow photographers | "Strong eye, technical command, quality-first presentation." |
| Artist | Art appreciators, commission enquirers | "Range and creativity beyond code." |
| Travel/Ride | Fellow riders, travel-curious, personal | "Lives an interesting life; tells a good story." |
| Gamer | Fellow gamers, personal | "A real human with taste, not just a résumé." |

---

## The risks we're accepting (eyes open)

- **Scope.** This is a platform, not a portfolio. Mitigated by strict phasing (`06`).
- **Maintenance treadmill.** 6 personas + 3 blogs is a content commitment. Mitigated by the capture apps (`03`) that make content creation frictionless, and by honest cadence expectations (some personas update rarely — that's fine).
- **Cleverness over clarity.** Carried from the assessment. Each persona page must be *legible* to its audience in seconds, even though the platform underneath is elaborate.
