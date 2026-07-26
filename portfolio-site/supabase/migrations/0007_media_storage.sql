-- ============================================================================
-- 0007_media_storage.sql
-- Storage buckets + policies for the media pipeline.
-- See docs/claude-planning/03-content-and-capture-model.md and D19.
--
-- Two buckets:
--   * originals — PRIVATE source-of-truth uploads. Admin-only, never public.
--   * media     — PUBLIC optimized derivatives (thumb/optimized/full) that the
--                 site serves. World-readable by URL.
--
-- Writes to both are gated by is_admin() (defined in 0002), so only Ratul can
-- upload — even though the browser uploads the ORIGINAL directly to Supabase
-- (bypassing the Next/Vercel body-size limit), the admin's session + these
-- policies authorize it.
--
-- Safe to re-run: bucket upsert is idempotent; policies are dropped first.
-- ============================================================================

-- ---- Buckets ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('originals', 'originals', false),
  ('media', 'media', true)
on conflict (id) do update set public = excluded.public;

-- ---- Policies: originals (private, admin-only) -----------------------------
-- No anon access at all. Admins (authenticated + in `admins`) get full control.
drop policy if exists originals_admin_read on storage.objects;
create policy originals_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'originals' and public.is_admin());

drop policy if exists originals_admin_insert on storage.objects;
create policy originals_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'originals' and public.is_admin());

drop policy if exists originals_admin_update on storage.objects;
create policy originals_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'originals' and public.is_admin())
  with check (bucket_id = 'originals' and public.is_admin());

drop policy if exists originals_admin_delete on storage.objects;
create policy originals_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'originals' and public.is_admin());

-- ---- Policies: media (public read, admin write) ----------------------------
-- A `public` bucket already serves objects via the public URL without RLS, but
-- we add an explicit anon read policy for API-level listing/consistency, and
-- gate all writes to admins.
drop policy if exists media_public_read on storage.objects;
create policy media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'media');

drop policy if exists media_admin_insert on storage.objects;
create policy media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists media_admin_update on storage.objects;
create policy media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

drop policy if exists media_admin_delete on storage.objects;
create policy media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
