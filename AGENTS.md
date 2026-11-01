# AGENTS.md — Multi-agent collaboration rules

Two AI agents work in this repo alongside Ratul (the owner):

- **Claude** (Claude Code) — **builder: owns the whole codebase** (frontend,
  data, platform, CI, docs/planning).
- **Cursor** — **reviewer / third perspective**. Read-only by default; writes
  only on a task Ratul explicitly assigns.

> Changed 2026-11-01 (Ratul's decision): the old UI-lane / data-lane split was
> retired for the immersive redesign so one agent drives the vision end-to-end.
> History of the split: `docs/claude-planning/09-collaboration-protocol.md`.

The Next.js app lives in `portfolio-site/`. Planning docs live in
`docs/claude-planning/`. The running work ledger is
`docs/claude-planning/08-progress-log.md`.

## Ownership

| Path | Owner | Notes |
|------|-------|-------|
| `portfolio-site/**` | **Claude** | App, UI, components, styles, data layer, schema, API, scripts |
| `.github/**` | **Claude** | CI (Supabase keep-alive + backups) |
| `docs/claude-planning/**` | **Claude** | Planning, decisions, progress log |
| `.claude/**` | **Claude** | Hooks, settings |
| `docs/assessment/**` | read-only | Historical review — neither agent edits |
| other `docs/**` | Ratul / Claude | With a clear commit-message callout |
| `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, `.claude/settings.json` | Ratul | Edited only when Ratul explicitly asks |

## Cursor's role: reviewer

- **Default: read-only.** Review what Claude shipped and report: visual
  quality, UX, motion feel, accessibility, performance, code smells, bugs.
- Write review notes to `docs/reviews/YYYY-MM-DD-<topic>.md` (the only path
  Cursor writes without a specific assignment) or reply to Ratul in chat.
- **Assigned tasks:** if Ratul explicitly hands Cursor a scoped task, Cursor
  may edit the files that task names — on a separate branch
  (`cursor/<topic>`), never directly on Claude's working branch. Claude reviews
  and merges.

## Hard rules (both agents)

1. **Commit small and often.** Uncommitted work is invisible to the other agent.
2. **No destructive git** (`reset --hard`, `checkout -- <file>`, force-push,
   deleting branches).
3. **`portfolio-site/lib/content/types.ts` is the content contract** — UI
   consumes it via `@/lib/content`; no parallel local types.
4. **Shared config** (`package.json`, `next.config.ts`, `tsconfig.json`,
   `eslint.config.mjs`, `postcss.config.mjs`, `.env.example`) changes get a
   `chore(config): …` commit message.
5. **Never commit secrets.** The repo is public. `.env*` stays gitignored.
6. **Handoffs and decisions** are recorded in
   `docs/claude-planning/08-progress-log.md`.

## Enforcement

- **Claude side:** `.claude/hooks/lane-guard.mjs` (PreToolUse) now only blocks
  writes to read-only paths (`docs/assessment/**`).
- **Cursor side:** this file plus `.cursorrules`.
- **Git is the referee:** small commits + Cursor on its own branch make any
  overlap a visible diff instead of silent loss.
