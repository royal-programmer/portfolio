-- ============================================================================
-- 0002_rls_policies.sql
-- Row Level Security + Data API exposure for the content engine.
--
-- Security model (docs/claude-planning/07 D5, D13, D14):
--   * The project has "auto-expose new tables" OFF and "auto RLS" ON, so we
--     enable RLS explicitly (belt-and-suspenders) and GRANT access on purpose.
--   * anon (public site) may READ only rows that are not private:
--       - personas: is_published = true
--       - everything else: visibility in ('public','unlisted')
--     The list-vs-unlisted distinction is enforced in app queries (list
--     endpoints filter visibility = 'public'; single-item fetches allow
--     'unlisted' so direct links work).
--   * WRITES and reads of private rows require an ADMIN (Ratul). Admin identity
--     lives in the `admins` table, NOT "whoever is logged in" — so even if
--     signups were ever enabled, a random authenticated user gets nothing.
-- ============================================================================

-- ---- Admin identity --------------------------------------------------------
create table if not exists admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;
-- No policies on `admins` → only the service_role (which bypasses RLS) can
-- read/write it. Add your user here once, via the SQL editor, after first login:
--   insert into admins (user_id) values ('<your-auth-user-uuid>');

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---- Enable RLS ------------------------------------------------------------
alter table personas    enable row level security;
alter table entries     enable row level security;
alter table media       enable row level security;
alter table groups      enable row level security;
alter table entry_groups enable row level security;
alter table blog_posts  enable row level security;
alter table strategies  enable row level security;

-- ---- Grants (Data API exposure; RLS still gates the rows) ------------------
grant usage on schema public to anon, authenticated;

grant select on personas, entries, media, groups, entry_groups, blog_posts
  to anon, authenticated;
-- Admins operate through the authenticated role; RLS restricts to is_admin().
grant select, insert, update, delete
  on personas, entries, media, groups, entry_groups, blog_posts, strategies
  to authenticated;

-- ---- Policies: personas ----------------------------------------------------
drop policy if exists personas_read on personas;
create policy personas_read on personas
  for select to anon, authenticated
  using (is_published or public.is_admin());

drop policy if exists personas_write on personas;
create policy personas_write on personas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- Policies: entries -----------------------------------------------------
drop policy if exists entries_read on entries;
create policy entries_read on entries
  for select to anon, authenticated
  using (visibility <> 'private' or public.is_admin());

drop policy if exists entries_write on entries;
create policy entries_write on entries
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- Policies: media -------------------------------------------------------
drop policy if exists media_read on media;
create policy media_read on media
  for select to anon, authenticated
  using (visibility <> 'private' or public.is_admin());

drop policy if exists media_write on media;
create policy media_write on media
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- Policies: groups + entry_groups (public taxonomy) ---------------------
drop policy if exists groups_read on groups;
create policy groups_read on groups
  for select to anon, authenticated using (true);

drop policy if exists groups_write on groups;
create policy groups_write on groups
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists entry_groups_read on entry_groups;
create policy entry_groups_read on entry_groups
  for select to anon, authenticated using (true);

drop policy if exists entry_groups_write on entry_groups;
create policy entry_groups_write on entry_groups
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- Policies: blog_posts --------------------------------------------------
drop policy if exists blog_posts_read on blog_posts;
create policy blog_posts_read on blog_posts
  for select to anon, authenticated
  using (visibility <> 'private' or public.is_admin());

drop policy if exists blog_posts_write on blog_posts;
create policy blog_posts_write on blog_posts
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---- Policies: strategies (admin-only; not public) -------------------------
-- Strategy master data is not exposed to anon at all (no select grant above).
drop policy if exists strategies_all on strategies;
create policy strategies_all on strategies
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
