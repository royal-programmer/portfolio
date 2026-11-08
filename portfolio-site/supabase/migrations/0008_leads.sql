-- ============================================================================
-- 0008_leads.sql
-- Contact requests from the public site: the home page's "connect" flow and the
-- Engineer terminal's `mail` command (docs/claude-planning/17-persona-views.md §6.9).
--
-- Written ONLY through the server (app/api/lead → adminClient()). RLS is on with
-- no policies, so anon/authenticated cannot read or write rows; service_role
-- bypasses RLS and already holds table grants via 0004's default privileges.
-- ============================================================================

create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null check (char_length(name) between 1 and 120),
  email       text not null check (char_length(email) between 3 and 254),
  message     text not null check (char_length(message) between 5 and 4000),
  -- where it came from: 'site' (home page chat), 'terminal' (engineer `mail`), …
  source      text not null default 'site',
  persona     text,
  handled     boolean not null default false
);

create index if not exists leads_created_at_idx on leads (created_at desc);

alter table leads enable row level security;
