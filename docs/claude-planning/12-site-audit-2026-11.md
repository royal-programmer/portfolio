# 12 — Site audit (2026-11-01)

Headless-Chrome walk of the running site (live Supabase data), desktop 1440px
and mobile 390px. Feeds Stage 1 of [11-replan-2026-11.md](./11-replan-2026-11.md).
Screenshots can't capture motion/hover feel — those need a human pass.

> **Lesson:** raw headless screenshots gave 3 false positives. Future audits use Playwright MCP
> (true device emulation, waits for animations) + Chrome DevTools MCP (perf traces).

## Bugs
| # | Where | Finding | Severity |
|---|-------|---------|----------|
| B1 | `/engineer` mobile (390px) | ~~Hero card overflows~~ **False positive** — Ratul checked in real Chrome device mode: fine. Headless `--window-size` below Chrome's minimum width renders wider and crops. | — |
| B2 | `/engineer` mobile | ~~Project card missing~~ **False positive** — Ratul sees Roster on scroll. | — |
| B3 | `/photographer` desktop | ~~No content~~ **False positive** — renders in a real browser; screenshot fired before the entrance animation. | — |
| B4 | Persona avatar | Engineer/Trader show the photo-style logo avatar; Photographer/mobile show the illustrated avatar — inconsistent identity | Low |

## Design / polish
| # | Finding |
|---|---------|
| D1 | **Sparse pages:** Engineer = 1 hero + 1 project then ~1200px of empty background. Trader = hero only. Biggest "not finished" signal. Needs content (Stage 2) *and* layouts that look intentional with little content. |
| D2 | **Stock-photo backgrounds** (circuit board, Polaroid, candlesticks) read as template; they're also heavy. Prime candidates to replace with per-persona 3D/shader worlds. |
| D3 | **Cards everywhere, same glass style** — hero, identity panel, project all identical weight. No hierarchy, no editorial moment. |
| D4 | **Typography** is one sans at a few sizes; no display face, no scale drama. Award-tier sites lean on type. |
| D5 | **"Identity Shift Panel" copy** exposes easter-egg mechanics ("1× click + hold → Engineer, 2× → Trader…") as body text — reads like dev notes. |
| D6 | **`/whoami`** is light-themed while every persona is dark — feels like a different site. "Coming soon" cards occupy half the page. |
| D7 | **Empty states** (blog "No posts yet") are plain; blog is supposed to be dormant per D22 but is reachable. |
| D8 | No nav/footer/contact anywhere on persona pages; the only exits are the avatar and the floating chat button. |
| D9 | Next.js dev indicator ("N") bottom-left is dev-only — fine, not a prod issue. |

## Reference sites (inspiration, not templates)
- **bruno-simon.com** — portfolio as a drivable 3D world; playful, memorable.
- **henryheffernan.com** — 3D desk + in-scene computer; very "engineer".
- **igloo.inc** — cinematic scroll-driven 3D storytelling.
- **lusion.co** — WebGL studio; physics, shaders, polish bar.
- **activetheory.net** — immersive studio work; transitions between "worlds".
- **robin-noguier.com** — smooth page transitions + strong type with restrained 3D.
