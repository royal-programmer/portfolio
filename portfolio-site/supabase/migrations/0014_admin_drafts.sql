-- ============================================================================
-- 0014_admin_drafts.sql
-- Server-side drafts for the admin forms (17-persona-views.md section 32): a half-edited record follows
-- Ratul from his laptop to his phone. One row per form (`key` = "<record type>:<id or new>"), `data` is
-- the form's value, `by` is a short device label ("phone", "laptop"), `uid` the admin who saved it.
-- A draft is never published and the site never reads this table.
--
-- RLS: admins only (is_admin()), for every operation; anon has no grant and no policy.
-- Safe to re-run. Not applied automatically.
-- ============================================================================

create table if not exists public.admin_drafts (
  key        text primary key check (char_length(key) between 3 and 120),
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  by         text check (by is null or char_length(by) <= 24),
  uid        uuid default auth.uid()
);

alter table public.admin_drafts enable row level security;

revoke all on public.admin_drafts from anon, authenticated;
grant select, insert, update, delete on public.admin_drafts to authenticated;
grant all on public.admin_drafts to service_role;

drop policy if exists admin_drafts_admin_all on public.admin_drafts;
create policy admin_drafts_admin_all on public.admin_drafts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Old drafts are noise: the keep-alive or a manual run can call this; nothing calls it automatically.
create or replace function public.purge_admin_drafts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.is_admin() then return 0; end if;
  delete from public.admin_drafts where updated_at < now() - interval '60 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.purge_admin_drafts() from public;
grant execute on function public.purge_admin_drafts() to authenticated, service_role;
