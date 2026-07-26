# AGENTS.md — Multi-agent collaboration rules

Two AI agents work in this repo alongside Ratul (the owner):

- **Claude** (Claude Code) — data/platform lane
- **Cursor** — UI/routing lane

The Next.js app lives in `portfolio-site/`. Planning docs live in
`docs/claude-planning/` (Claude-authored). The running work ledger both agents
append to (via Ratul) is `docs/claude-planning/08-progress-log.md`.

## Lane map (ownership)

| Path | Owner | Notes |
|------|-------|-------|
| `portfolio-site/lib/**` | **Claude** | Data layer, content API, DB clients |
| `portfolio-site/supabase/**` | **Claude** | Schema, migrations, RLS policies |
| `portfolio-site/app/api/**` | **Claude** | Route handlers (lead, chat, …) |
| `portfolio-site/app/capture/**` | **Claude** | Admin/capture surfaces (login, admin, future PWAs) |
| `portfolio-site/scripts/**` | **Claude** | Verification / maintenance scripts |
| `docs/claude-planning/**` | **Claude** | Planning, decisions, progress log |
| `.claude/**` | **Claude** | Hooks, settings |
| `portfolio-site/app/**` (everything else) | **Cursor** | Public pages, layout, components (`app/components/**`), hooks (`app/hooks/**`), styles |
| `docs/assessment/**` | read-only | Historical review — neither agent edits |
| other `docs/**` | Ratul / either | Only with a clear commit-message callout |

## Boundary files (special rules)

- **`portfolio-site/lib/content/types.ts` — the shared contract.** Claude
  authors it; Cursor consumes it read-only via `@/lib/content`. If a shape
  needs to change, raise it to Ratul as a handoff note — never edit it from
  the UI lane, never work around it with local types.
- Shared config (`package.json`, `next.config.ts`, `tsconfig.json`,
  `eslint.config.mjs`, `postcss.config.mjs`, `.env.example`) — either agent,
  **only** with a commit message calling it out (`chore(config): …`).
- `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.claude/settings.json` — edited
  only when Ratul explicitly asks.

## Hard rules

1. **Never edit outside your lane.** If your task needs a change in the other
   agent's lane, STOP and tell Ratul exactly what you need instead.
2. **Commit small and often** on the shared branch. Don't sit on large
   uncommitted batches — uncommitted work is invisible to the other agent.
3. **No destructive git** (`reset --hard`, `checkout -- <file>`, force-push,
   deleting branches). Uncommitted changes may belong to the other agent.
4. **Read before you build.** If the other agent's recent commits touched
   files you depend on (especially `lib/content/*`), re-read them — don't
   assume shapes from memory.
5. **Handoffs go through Ratul** and get recorded in
   `docs/claude-planning/08-progress-log.md` (what landed, what's pending,
   what's requested from the other lane).

## Enforcement

- **Claude side (mechanical):** a `PreToolUse` hook
  (`.claude/hooks/lane-guard.mjs`) blocks Claude's Edit/Write calls into
  Cursor-lane paths. Negotiated exceptions are added to the `OVERRIDES` list
  in that script, only with Ratul's approval.
- **Cursor side (rules):** this file plus `.cursorrules`. Treat the lane map
  as a hard constraint, identical in force to a failing build.
- **Git is the referee:** small, frequent commits make any accidental overlap
  visible as a diff/conflict instead of silent loss.
