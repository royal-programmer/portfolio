-- ============================================================================
-- 0006_admins_self_read.sql
-- Lets a logged-in user confirm their OWN admin status (needed by isAdmin() in
-- lib/db/server.ts, which runs as the user via the cookie-bound client).
--
-- A user can read ONLY their own row (user_id = auth.uid()) — they still cannot
-- enumerate other admins. service_role (0004) retains full access.
-- ============================================================================

grant select on admins to authenticated;

drop policy if exists admins_self_read on admins;
create policy admins_self_read on admins
  for select to authenticated
  using (user_id = auth.uid());
