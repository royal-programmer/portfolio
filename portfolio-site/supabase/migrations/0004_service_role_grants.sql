-- ============================================================================
-- 0004_service_role_grants.sql
-- Grant table privileges to service_role.
--
-- WHY: with "auto-expose new tables" OFF, Supabase does not auto-grant new
-- tables to the API roles — and that includes service_role. service_role
-- BYPASSES RLS but still needs ordinary table GRANTs, so without this it hits
-- "permission denied for table ...". This is the server-side admin path
-- (adminClient() in lib/db/client.ts).
--
-- Safe to run once, after 0001–0003.
-- ============================================================================

grant usage on schema public to service_role;

grant select, insert, update, delete on
  personas, entries, media, groups, entry_groups, blog_posts, strategies, admins
to service_role;

-- Keep future tables working for service_role without another migration.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
