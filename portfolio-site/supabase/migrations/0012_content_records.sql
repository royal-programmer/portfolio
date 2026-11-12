-- ============================================================================
-- 0012_content_records.sql
-- Round 24: records that used to live in code become `entries` rows
-- (docs/claude-planning/10-engineer-persona-blueprint.md, "Records"). New entry types:
--
--   experience, education, certification, skill_group, timeline_event,
--   milestone, diagram, profile_link
--
-- The `data` jsonb of each type is validated by the Zod schemas in
-- lib/content/record-schemas.ts (the writer enforces shape; the column stays jsonb).
-- Project story and media ride on the existing `project` rows' `data`.
-- Singletons (engineer.hiring, engineer.clock, engineer.resume header) are
-- site_settings keys and need no SQL: 0011 already stores any key.
--
-- Safe to re-run. NOT applied by the build: run it in the Supabase SQL editor,
-- then `node scripts/import-content.mjs` (dry run) and `--apply`.
-- ============================================================================

alter type entry_type add value if not exists 'experience';
alter type entry_type add value if not exists 'education';
alter type entry_type add value if not exists 'certification';
alter type entry_type add value if not exists 'skill_group';
alter type entry_type add value if not exists 'timeline_event';
alter type entry_type add value if not exists 'milestone';
alter type entry_type add value if not exists 'diagram';
alter type entry_type add value if not exists 'profile_link';

-- Record lists are read by (persona, type) in display order.
create index if not exists entries_persona_type_order_idx
  on entries (persona_slug, type, "order");
