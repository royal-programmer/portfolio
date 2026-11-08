# 17 — Persona views: one dataset, many ways to see it

**Ratul's idea (2026-11-08):** portfolio designs now come in waves (agent-swarm builds, Netflix-style
series, scattered-card designer sites). Keep the data separate and build each presentation as a
selectable *view*, chosen from the terminal the way Claude Code offers options. Profile pages do
not share one design.

This doc is the standing contract for that. The content contract (`lib/content/types.ts`) stays the
single source; a view is only a renderer of it.

## 1. The model

- **The terminal is the root** of the Engineer page: the default, server-rendered, readable by
  search engines. It boots, lists the views, waits.
- **Each view is a branch** with its own route (`/engineer/<view>`), so it deep-links and shares.
- **Picking a view remembers it** on the device. While remembered, the terminal boots for a beat
  and drops straight into that view, no picker.
- **Exit is always present**: Esc on desktop, `exit` typed in the terminal overlay, and an action
  in the HUD strip beside Top and End. Exit returns to the terminal and clears the memory, so the
  terminal is default again until the next pick.
- **Launch with two views**, add more one per round. Depth over breadth: one Awwwards-level view
  beats four shallow ones.

## 2. The registry

Per persona, a list of views; each row: `id`, `name`, `line` (one sentence shown in the terminal),
`component`, `enabled`, `default`. Lives in the data layer (`site_settings` key `views.<persona>`
once the admin console lands; a typed constant until then). The admin toggles views and sets the
default (see `16-admin-console.md`).

**Routing rule.** A view id and an entry slug share the `/<persona>/<x>` depth; the view wins. An
entry whose slug equals a view id is shadowed and `generateStaticParams` logs an error for it, so
pick view ids that no project will ever use (`stage`, `swarm`, `series`).

## 3. Engineer views, in order

1. **Swarm** (round 2–3). The page builds itself: agents named after the stack — `schema`, `api`,
   `ui`, `tests`, `deploy` — fan out from the terminal cursor, draw wireframe boxes, drop the
   projects and skills from the content layer, a layers counter and an agent log in the HUD strip.
   About thirty seconds, then it holds as a readable page. Scroll or tap skips to the finished
   state. Phones: fewer agents, faster build. Reference: the red-lit "power of AI agents" clip.
2. **Series** (round 4–5). Netflix-shaped by Ratul's call: "Who's watching?" with **Recruiter**,
   **Developer**, **Full story** — three orderings of the same data. A series hero with Play (a
   short typed trailer) and View résumé, episode rows per project (season = year), a skills row,
   a "To be continued" card with contact. Layout and feel resemble Netflix; **no Netflix logo,
   wordmark or red N** — our own mark. Reference: the "This isn't Netflix" clip.
3. Later candidates: **Blueprint** (systems as architecture diagrams), **Log** (the career as a
   git history), **Badge** (the lanyard ID card and scattered cards snapping to a grid, from the
   designer clip).

## 4. Rounds and distribution

| Round | Work | Who |
|---|---|---|
| 1 | Registry, routes, remembered view, exit mechanics, terminal root UI | Lead designs + routes; Sonnet builder writes the terminal UI from a brief; Haiku scout surveys; Sonnet reviewer checks |
| 2–3 | Swarm | Lead choreography + brief; builders for agents, wireframes, log |
| 4–5 | Series | Lead profiles + brief; builders for rows, hero, trailer |

Each round ends with Ratul's phone check and a checkpoint.

## 5. References (Ratul, 2026-11-08, Teams exports in Downloads)

1. Agent swarm building a product landing page (labelled cursors, selection boxes, layers pill).
2. Dark glow personal portfolio (particle hero, "Things I've built", "My Toolkit") — closest to the
   hub as it is, least new.
3. Netflix-style "the series" portfolio (profiles, episodes, skill universe, "To be continued").
4. Designer site: light, lanyard ID badge, scattered "Selected Work" cards snapping to a grid,
   laptop-closes outro.
5. Agency site: bold uppercase type, service rows with pill images, works list with years.
