-- ============================================================================
-- 0013_site_events.sql
-- Privacy-first visitor events (17-persona-views.md section 29): what gets opened
-- and played, so the admin Insights page can show it and the Netflix "Popular with
-- visitors" row can be built from real counts.
--
-- Nothing personal: no cookie, no IP, no user agent, no arguments. `session` is a
-- random id kept in the tab's memory only; `referrer_host` is a host name only.
-- Written by app/api/e through adminClient() (service role bypasses RLS). Anon has
-- no policy and no grant; admins read through is_admin().
--
-- Safe to re-run. Not applied automatically.
-- ============================================================================

create table if not exists public.site_events (
  id            bigint generated always as identity primary key,
  at            timestamptz not null default now(),
  persona       text not null check (char_length(persona) between 1 and 24),
  view          text not null check (view in ('terminal', 'netflix', 'stage', 'hub')),
  kind          text not null check (char_length(kind) between 1 and 24),
  ref           text check (ref is null or char_length(ref) <= 80),
  profile       text check (profile is null or char_length(profile) <= 24),
  session       text check (session is null or char_length(session) <= 24),
  lang          text check (lang is null or char_length(lang) <= 8),
  device        text check (device in ('phone', 'desktop')),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 80)
);

create index if not exists site_events_at_idx on public.site_events (at desc);
create index if not exists site_events_kind_at_idx on public.site_events (kind, at desc);

alter table public.site_events enable row level security;

revoke all on public.site_events from anon, authenticated;
grant select on public.site_events to authenticated;

drop policy if exists site_events_admin_read on public.site_events;
create policy site_events_admin_read on public.site_events
  for select to authenticated
  using (public.is_admin());

-- Retention: rows older than 180 days go. No arguments, so a caller cannot widen it;
-- the keep-alive workflow calls it with the anon key (no new secret).
create or replace function public.purge_site_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  delete from public.site_events where at < now() - interval '180 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.purge_site_events() from public;
grant execute on function public.purge_site_events() to anon, authenticated, service_role;
