# 09 — Multi-Agent Collaboration Protocol (Claude × Cursor)

How two AI agents share this repo without stepping on each other. Decided
2026-07-20 after evaluating (and rejecting) a file-locking scheme.

---

## Why not file locks

Ratul proposed a lock system: an agent locks a file while working; the other
waits, then reads the changes. Rejected because:

1. **Unenforceable.** Claude and Cursor are independent programs with no
   shared runtime; any lockfile is advisory — it only works if an LLM
   remembers to honor it every time. That is not a lock.
2. **Agents don't wait.** Neither tool idle-polls; Ratul is the scheduler. A
   held lock just means a refused request and a retry later — friction, not
   coordination.
3. **Stale locks.** Sessions end mid-task; locks leak; a human ends up
   deleting lock files weekly.
4. **It solves the wrong problem.** Locks optimize surviving conflicts;
   partitioning makes them structurally impossible.

## The scheme instead: partition + layered enforcement

**Single source of truth: `AGENTS.md` (repo root)** — lane map + hard rules,
read automatically by both tools. Mirrored for Cursor in `.cursorrules`.

Layers, strongest first:

| Layer | What it does | Strength |
|-------|--------------|----------|
| **Lane partition** | Claude: `lib/**`, `supabase/**`, `app/api/**`, `app/capture/**`, `scripts/**`, `docs/claude-planning/**`, `.claude/**`. Cursor: the rest of `app/**` (components, hooks, pages, styles). | Structural — conflicts can't arise if respected |
| **Claude-side hook** | `.claude/hooks/lane-guard.mjs` (`PreToolUse` on Edit/Write, registered in `.claude/settings.json`) **mechanically blocks** Claude from writing Cursor-lane paths. Exceptions only via its `OVERRIDES` list, Ratul-approved. | Hard enforcement |
| **Claude-side freshness guard** | Built into Claude Code: an Edit fails if the file changed after Claude last read it — Cursor's fresh work can't be silently clobbered from stale memory. | Hard enforcement (built-in) |
| **Cursor-side rules** | `.cursorrules` + `AGENTS.md` state the lanes as hard constraints. | Advisory (well-respected in practice) |
| **Git as referee** | Small, frequent commits → any overlap surfaces as a visible diff/conflict, recoverable, never silent loss. | Safety net |

## Working agreements

- **The contract file** (`lib/content/types.ts`): Claude authors, Cursor
  consumes read-only. Contract change requests flow: Cursor → Ratul → Claude
  extends → Cursor builds on real types. No parallel local types.
- **Handoffs** are recorded in `08-progress-log.md` (what landed, what's
  pending, what's requested of the other lane). Ratul relays between agents —
  the agents cannot see each other's chats, only each other's commits.
- **Shared config** (`package.json`, `next.config.ts`, `tsconfig.json`, …):
  either agent, only with a `chore(config): …` commit callout.
- **No destructive git** by either agent, ever — uncommitted work may belong
  to the other.
- **Cross-lane needs:** stop, tell Ratul what you need from the other lane.
  Never reach across.

## Known limitations (accepted, eyes open)

- Cursor-side compliance is advisory — there is no hook mechanism guaranteed
  on its side. Mitigated by the freshness guard, small commits, and Ratul
  reviewing diffs. (If Ratul's Cursor version supports hooks, the same guard
  can be mirrored there later.)
- Claude's hook guards Edit/Write tool calls, not shell-based writes (`sed`,
  `>` redirects). Claude's own rules already forbid editing files via shell.
- Both agents editing *the same shared-config file* in the same window is
  still possible — mitigated by the commit-callout rule and small batches.

## Escalation path (if collisions ever actually happen)

**Git worktrees**: each agent gets its own physical checkout on its own
branch, merged via PRs. Perfect isolation, more ceremony. Adopt only if the
lane system demonstrably fails — at current scale it has produced zero
collisions across Phases 0–1.

---

## Update 2026-11-01 — Claude owns the codebase; Cursor reviews

Ratul's decision for the immersive redesign: the UI/data lane split is retired.
**Claude builds everything** (frontend + data + platform) so the vision is
driven end-to-end; **Cursor is the reviewer / third perspective** — read-only
by default, writes review notes to `docs/reviews/`, and only edits code on an
explicitly assigned task on its own `cursor/<topic>` branch.

Why: the 3D/immersive work couples data, performance, and visuals tightly; the
contract → brief → handoff loop through Ratul was the bottleneck. Review is
more valuable from a fresh pair of eyes than parallel building.

Enforcement updated: `AGENTS.md`, `.cursorrules`, and `lane-guard.mjs` (now
blocks only `docs/assessment/**`).
