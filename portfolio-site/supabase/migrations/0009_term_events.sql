-- ============================================================================
-- 0009_term_events.sql
-- Anonymous usage events from the Engineer terminal (17-persona-views.md §6.9):
-- which commands visitors run, so the admin console can show what gets explored.
--
-- No visitor identity: no ids, no IP, no user agent, no arguments — the command's
-- first token only. Written through app/api/term-event → adminClient(). RLS is on
-- with no policies; service_role bypasses it and holds grants via 0004's defaults.
-- ============================================================================

create table if not exists term_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  persona     text not null,
  command     text not null check (char_length(command) between 1 and 40),
  ok          boolean not null default true,
  theme       text,
  viewport    text check (viewport in ('phone', 'desktop'))
);

create index if not exists term_events_created_at_idx on term_events (created_at desc);
create index if not exists term_events_command_idx on term_events (persona, command);

alter table term_events enable row level security;
