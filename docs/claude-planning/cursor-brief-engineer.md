# Cursor brief — Engineer persona layout (copy-paste)

> Paste the block below to Cursor. Full rationale: `10-engineer-persona-blueprint.md`.

---

**Engineer persona — layout upgrade. Read `AGENTS.md` first; stay in your lane.**

`git pull` — a visual blueprint and plan landed. Reference mockup:
`docs/claude-planning/mockups/engineer-layout.html` (open it in a browser) and
the spec in `docs/claude-planning/10-engineer-persona-blueprint.md`.

**Prime directive: EVOLVE, don't rebuild.** Reuse the existing design system —
the `globals.css` tokens (glass panels, blue engineer accent, light/dark), the
persona motion/transition system, and current component primitives. Do **not**
start from scratch, swap the visual language, or restyle tokens. We're changing
the *layout/IA* from "splash page" to "content platform," not the look.

**Scope: engineer persona only** (it's the reference; other personas copy the
pattern later — same design system, their own layout).

**Build these sections on `/engineer` (see mockup for composition):**
1. **Slim sticky top nav** (glass): `Ratul · Engineer` + Work / Experience /
   Résumé / About + a Contact CTA. Collapses cleanly on mobile.
2. **Proportional hero** (not full-screen) so content is near the top; keep the
   existing hero motion. Include a compact quick-links cluster (GitHub, LinkedIn,
   Email, Résumé).
3. **Featured project** — one large editorial split (media + copy + tags +
   links). First flagship is "Industry Pulse" (Telegram + n8n automation).
4. **Projects grid** with a **media carousel** per card: dots for manual paging,
   hover-only auto-cycle on desktop, tappable dots on mobile, `prefers-
   reduced-motion` = static first image. Bind to `entry.media[]`
   (`thumbUrl`/`optimizedUrl`/`fullUrl`, `width`/`height` for aspect-ratio, `alt`).
5. **Résumé carousel** — switch between tailored résumé variants (AI/Automation,
   Full-stack, Backend), each with a download.
6. **Certificates** grid (with images) → detail view.
7. **Career timeline** — horizontal bar with milestone nodes; the current era
   marked with a "Present" pulse (static under reduced-motion).
8. **Experience** list → detail view.
9. **Real footer** — contact + persona links + connect links.

**Routes you own (namespacing content by type):**
`/engineer` (front door), `/engineer/projects` + `/engineer/projects/[slug]`,
`/engineer/experience` + `/[slug]`, `/engineer/certificates` + `/[slug]`,
`/engineer/resume` (+ `/[variant]`), `/engineer/skills`. Move the current bare
`/[persona]/[slug]` detail route to `/[persona]/projects/[slug]`. Keep
`/engineer/blog` code but **hidden** until posts exist.

**Every project / certificate / experience gets a detail page** rendering its
markdown `body` (the "experience write-up") + media.

**Wait on Claude for data shapes — do NOT invent them.** These land in
`@/lib/content` (`lib/content/types.ts`) from Claude first, then you bind to
them: `Persona.links[]`, and new entry types `resume`, `certification`,
`milestone`, `experience` (+ skills). Build layout/empty-states now; wire real
data as each type lands. `entry.media` and `listEntries`/`listBlogPosts` are
already live — use them today.

**Do NOT touch (Claude's lane):** `lib/**`, `supabase/**`, `app/api/**`,
`app/**/admin/**`. Admin/capture surfaces are Claude's.

**Constraints:** responsive (mobile-first tap targets), `prefers-reduced-motion`
respected, visible keyboard focus, editorial max-width (~65ch) for reading
while the shell goes comfortably wide (~1240–1400px). Commit small and often.

**Suggested extras (optional, your call):** a one-line "Now / currently building"
strip in the hero; a featured-project "problem → approach → outcome" structure on
the detail page; a calm skills grid (no emoji clouds). Nothing that needs new
Claude data beyond the types above.
