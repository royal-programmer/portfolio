-- ============================================================================
-- 0011_site_settings.sql
-- The admin console's settings store (docs/claude-planning/16-admin-console.md):
-- one JSON document per key, with a DRAFT (what the admin edits and previews)
-- and a LIVE value (what visitors get), plus a history of every change.
--
--   site_settings       key -> draft + live. NO policies, no anon/authenticated
--                       grants: only the service role (server actions, after
--                       requireAdmin()) can touch the table.
--   site_settings_live  (key, value) view over the live column. The ONLY thing
--                       the public site can read; drafts never leave the table.
--   settings_history    every draft save / publish / discard / revert; readable
--                       by admins (is_admin(), see 0002/0006), written by the
--                       service role.
--
-- Safe to re-run. Until it is applied the site falls back to the code defaults.
-- ============================================================================

-- The store: one row per settings key (e.g. 'engineer.terminal').
create table if not exists public.site_settings (
  key            text primary key,                       -- dotted settings key
  draft          jsonb not null,                         -- being edited; shown on ?preview=draft
  live           jsonb not null,                         -- published; what visitors see
  schema_version int not null default 1,                 -- bump when a key's shape changes
  updated_by     uuid,                                   -- auth user id of the last editor
  updated_at     timestamptz not null default now()      -- last change (draft or live)
);

-- The change log: before/after of every operation, newest last.
create table if not exists public.settings_history (
  id      bigserial primary key,
  key     text not null,                                 -- which setting changed
  action  text not null default 'publish',               -- draft | publish | discard | revert
  before  jsonb,                                         -- value before the change
  after   jsonb,                                         -- value after the change
  by      uuid,                                          -- auth user id of the actor
  at      timestamptz not null default now()             -- when
);

-- History lookups are per key, newest first.
create index if not exists settings_history_key_at_idx on public.settings_history (key, at desc);

-- Lock both tables with RLS; the policy below is the only one that exists.
alter table public.site_settings enable row level security;
alter table public.settings_history enable row level security;

-- Nobody but the service role touches the store directly.
revoke all on public.site_settings from anon, authenticated;
revoke all on public.settings_history from anon, authenticated;

-- The public view: live values only. A plain (owner-privileged) view, so
-- anon needs a grant on the view, not on the table behind it.
create or replace view public.site_settings_live as
  select key, live as value from public.site_settings;

-- Visitors (anon) and signed-in users read the live view and nothing else.
grant select on public.site_settings_live to anon, authenticated;

-- Admins may read the history through their own session (is_admin() = a row in admins).
grant select on public.settings_history to authenticated;
drop policy if exists settings_history_admin_read on public.settings_history;
create policy settings_history_admin_read on public.settings_history
  for select to authenticated
  using (public.is_admin());

-- The server actions write with the service role (it bypasses RLS but needs table grants, see 0004).
grant usage on schema public to service_role;
grant select, insert, update, delete on public.site_settings, public.settings_history to service_role;
grant usage, select on sequence public.settings_history_id_seq to service_role;
grant select on public.site_settings_live to service_role;
