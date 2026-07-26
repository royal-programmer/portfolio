#!/usr/bin/env node
/**
 * Lane guard — PreToolUse hook for Edit/Write.
 *
 * Mechanically blocks Claude from modifying files in Cursor's lane, per the
 * lane map in AGENTS.md (repo root). Keep the patterns below in sync with
 * that file — AGENTS.md is the human-readable source of truth.
 *
 * Contract with Claude Code hooks:
 *   stdin  = JSON { cwd, tool_input: { file_path, ... }, ... }
 *   exit 0 = allow the tool call
 *   exit 2 = BLOCK the tool call (stderr is shown to Claude)
 */
import { readFileSync } from "node:fs";

// Negotiated exceptions — exact repo-relative paths (forward slashes,
// lowercase). Add entries ONLY with Ratul's explicit approval.
const OVERRIDES = [];

// Cursor-owned lanes (Claude must not write here).
const CURSOR_LANES = [/^portfolio-site\/app\//];

// Claude-owned carve-outs inside app/.
const CLAUDE_CARVEOUTS = [
  /^portfolio-site\/app\/api\//,
  /^portfolio-site\/app\/capture\//,
];

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0); // unreadable input → fail open, never brick tool calls
}

const rawPath = input?.tool_input?.file_path;
if (!rawPath || typeof rawPath !== "string") process.exit(0);

const norm = (s) => s.replace(/\\/g, "/").toLowerCase();

let p = norm(rawPath);
const cwd = norm(input?.cwd || process.cwd()).replace(/\/+$/, "");
if (p.startsWith(cwd + "/")) {
  p = p.slice(cwd.length + 1);
} else if (/^[a-z]:\//.test(p)) {
  // Absolute path outside cwd — anchor on the app folder if present.
  const i = p.indexOf("/portfolio-site/");
  if (i !== -1) p = p.slice(i + 1);
}

if (OVERRIDES.includes(p)) process.exit(0);

const blocked =
  CURSOR_LANES.some((r) => r.test(p)) &&
  !CLAUDE_CARVEOUTS.some((r) => r.test(p));

if (blocked) {
  console.error(
    `LANE GUARD — blocked: "${p}" is in Cursor's lane (app UI), per AGENTS.md.\n` +
      "Options:\n" +
      "  1) Hand this change to Cursor via Ratul (preferred), or\n" +
      "  2) if Ratul explicitly approved this cross-lane edit, add the exact\n" +
      "     repo-relative path to OVERRIDES in .claude/hooks/lane-guard.mjs, retry,\n" +
      "     and remove it again when done.",
  );
  process.exit(2);
}

process.exit(0);
