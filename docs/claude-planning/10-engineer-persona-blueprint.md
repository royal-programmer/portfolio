# 10 — Engineer Persona Blueprint

The engineer persona is the **reference implementation** for the platform.
Decided 2026-07-20. Guiding principle (Ratul):

> **Shared design system, unique per-persona layout.** Tokens, motion, and
> component primitives are the common spine; each persona composes them into its
> *own* layout. Build engineer well, then use it as the reference for the others.

Visual reference: [mockups/engineer-layout.html](./mockups/engineer-layout.html)
(published artifact — "evolve, don't rebuild").

---

## Information architecture (target routes)

### Public — Cursor's lane (`app/[persona]/**`)
| Route | Purpose |
|-------|---------|
| `/engineer` | Front door: hero → featured project → projects preview → credibility/quick-links → résumé teaser → certificates preview → career timeline → experience preview → footer. |
| `/engineer/projects` | All projects grid. |
| `/engineer/projects/[slug]` | Project detail — media carousel + demo video + "build notes" (markdown `body`). |
| `/engineer/experience` | Experience list. |
| `/engineer/experience/[slug]` | Role detail (markdown `body`). |
| `/engineer/certificates` | Certificates grid (with images). |
| `/engineer/certificates/[slug]` | Certificate detail (image + notes). |
| `/engineer/resume` (+ `/engineer/resume/[variant]`) | Résumé hub — carousel of skill/industry-tailored résumés (AI/Automation, Full-stack, Backend). |
| `/engineer/skills` | Skills grid. |
| `/engineer/blog` | **Dormant** — hidden until standalone posts exist (D22). |

> **Migration:** the current bare `/[persona]/[slug]` detail route moves to
> `/[persona]/projects/[slug]` (content namespaced by type as types multiply).

### Admin — Claude's lane (auth-gated, noindex)
| Route | Purpose |
|-------|---------|
| `/admin/login` | **Single shared login** (one account, one session — not per persona). |
| `/[persona]/admin` | Persona dashboard (e.g. `/engineer/admin`). |
| `/[persona]/admin/projects/new`, `/projects/[id]` | Create / edit projects (+ media uploader). |
| `/[persona]/admin/experience`, `/certificates`, `/resume`, `/timeline`, `/skills` | Manage each content type. |

> **Migration:** `/capture/login` → `/admin/login`; `/capture/admin` →
> `/[persona]/admin`. Persona-parameterized (`app/[persona]/admin/*`), so one
> admin implementation serves every persona. Static `admin` segment wins over
> the dynamic `[slug]` sibling — no route collision.

---

## Sections & data dependencies

| Section (Cursor UI) | Data (Claude) | Status |
|---------------------|---------------|--------|
| Hero (proportional, keeps persona motion) | `Persona` fields | ✅ live |
| Quick-links strip | **`Persona.links[]`** `{label,url,icon}` | ⏳ contract add |
| Featured project (editorial split) | `Entry` where `featured` | ✅ live (+ `entry.media` ✅) |
| Project grid + media carousel | `listEntries("engineer")`, `entry.media[]` | ✅ live |
| Résumé carousel (variants) | **`resume` entry type** `{variant,fileUrl}` | ⏳ contract add |
| Certificates grid + detail | **`certification` entry type** `{issuer,issuedAt,credentialUrl}` + media | ⏳ contract add |
| Career timeline (horizontal bar, "Present" pulse) | **`milestone` entry type** `{category,date?,current?}` | ⏳ contract add |
| Experience list + detail | **`experience` entry type** `{role,company,start,end?,current?}` | ⏳ contract add |
| Skills grid | `Persona.skills[]` or `skill` grouping (lightweight) | ⏳ contract add |
| Footer (contact + links) | `Persona.links[]` + working `/api/lead` | ⏳ |

Each **project / certificate / experience** has a detail view carrying its own
markdown "experience" body (per Ratul: "viewed in details … experience md data
for each type"). The `Entry.body` field already supports this — no new field.

### New content types (Claude adds to the contract + a DB enum migration)
`experience`, `certification`, `milestone`, `resume` join the `EntryType` union;
persona-specific fields live in `Entry.data` (jsonb — no column churn). Plus
`Persona.links[]` and a skills representation.

> **DOB note:** Ratul wants the timeline to start at birth year. Supported via an
> optional `milestone.date`. Privacy reminder (his call): a public birth *year*
> or a "first line of code" start is lower-risk than an exact DOB — the timeline
> is configurable, so granularity is a per-milestone choice.

---

## The "Industry Pulse" project (replaces the tech-feed page idea)

The "latest industry tech" idea becomes an **actual engineering project**, not a
site page: Telegram bot + n8n workflow that fetches industry updates → LLM
summary → pushes to topic channels. It serves Ratul personally AND showcases
automation/LLM/self-hosting skill. Present it as the **featured project** with an
architecture diagram + a live "try the bot" link. (Filler idea → flagship.)

---

## Lane split for the build

- **Cursor (UI):** the public layout per the mockup — nav shell, hero, featured,
  grids, carousels, résumé carousel, certificates, timeline UI, experience,
  footer; the per-type public + detail pages; the `/[persona]/projects/[slug]`
  route move. Reuse tokens + motion. **Does not** touch `lib/`, `supabase/`,
  `app/api/`, or `app/**/admin/` (Claude's lane).
- **Claude (data/admin):** contract types + enum migration for the new types;
  `Persona.links[]` / skills; the `/capture` → `/[persona]/admin` migration and
  new admin forms; provider accessors (by type; résumé/milestone/cert lists);
  `/api/lead` hardening; per-page SEO/OG groundwork.
- **Sequencing:** Cursor builds layout against the mockup while Claude lands the
  contract types. Cursor must **not** invent data shapes for the new types —
  they land from Claude first, then Cursor binds to them.
