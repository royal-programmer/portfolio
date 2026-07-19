-- ============================================================================
-- 0005_add_entry_slug.sql
-- Adds a URL-safe slug to entries, unique per persona, for clean detail URLs
-- (/[persona]/[slug]). The entries table is currently empty, so adding a NOT
-- NULL column is safe; the admin write path always supplies a slug.
-- ============================================================================

alter table entries add column if not exists slug text not null default '';

-- Drop the throwaway default now that the column exists (writes must set slug).
alter table entries alter column slug drop default;

create unique index if not exists entries_persona_slug_uidx
  on entries (persona_slug, slug);
