-- ============================================================================
-- 0001_content_schema.sql
-- Core content engine for the portfolio platform.
-- See docs/claude-planning/03-content-and-capture-model.md
--
-- Safe to run in the Supabase SQL editor. Enums are guarded so a re-run does
-- not error on "type already exists".
-- ============================================================================

-- ---- Enums -----------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'visibility') then
    create type visibility as enum ('public', 'unlisted', 'private');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'entry_type') then
    create type entry_type as enum ('project', 'trade', 'photo', 'artwork', 'ride', 'game');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'media_kind') then
    create type media_kind as enum ('image', 'video');
  end if;
end $$;

-- ---- Personas --------------------------------------------------------------
create table if not exists personas (
  slug         text primary key,
  label        text not null,
  eyebrow      text not null default '',
  heading      text not null default '',
  body         text not null default '',
  accent       text not null default '#3b82f6',
  cta          text not null default '',
  points       text[] not null default '{}',
  is_published boolean not null default false,
  "order"      int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---- Strategies (trader master data) ---------------------------------------
create table if not exists strategies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  thesis      text,
  description text,
  rules       text[] not null default '{}',
  created_at  timestamptz not null default now()
);

-- ---- Entries (the universal unit) ------------------------------------------
create table if not exists entries (
  id           uuid primary key default gen_random_uuid(),
  persona_slug text not null references personas(slug) on delete cascade,
  type         entry_type not null,
  title        text not null,
  summary      text,
  body         text,
  -- Private by default (D13): nothing is public until explicitly set.
  visibility   visibility not null default 'private',
  featured     boolean not null default false,
  "order"      int not null default 0,
  occurred_at  timestamptz,
  -- Persona-specific fields (see EntryDataMap in lib/content/types.ts).
  data         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists entries_persona_idx on entries(persona_slug);
create index if not exists entries_persona_visibility_idx on entries(persona_slug, visibility);
create index if not exists entries_data_gin_idx on entries using gin (data);

-- ---- Media -----------------------------------------------------------------
create table if not exists media (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid references entries(id) on delete cascade,
  kind          media_kind not null default 'image',
  -- Storage key of the ORIGINAL (private). Never returned to the public client.
  original_path text,
  thumb_url     text not null default '',
  optimized_url text not null default '',
  full_url      text,
  width         int,
  height        int,
  alt           text,
  caption       text,
  exif          jsonb,
  lat           double precision,
  lng           double precision,
  captured_at   timestamptz,
  "order"       int not null default 0,
  -- Inherits the visibility of its entry in practice, but tracked explicitly
  -- so media can be gated directly by RLS.
  visibility    visibility not null default 'private',
  created_at    timestamptz not null default now()
);
create index if not exists media_entry_idx on media(entry_id);

-- ---- Groups (genres / mediums / platforms / tags) --------------------------
create table if not exists groups (
  id           uuid primary key default gen_random_uuid(),
  persona_slug text not null references personas(slug) on delete cascade,
  name         text not null,
  slug         text not null,
  kind         text not null default 'tag',
  unique (persona_slug, slug)
);

create table if not exists entry_groups (
  entry_id uuid not null references entries(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  primary key (entry_id, group_id)
);

-- ---- Blog posts (per persona) ----------------------------------------------
create table if not exists blog_posts (
  id             uuid primary key default gen_random_uuid(),
  persona_slug   text not null references personas(slug) on delete cascade,
  title          text not null,
  slug           text not null,
  excerpt        text,
  body           text not null default '',
  cover_media_id uuid references media(id) on delete set null,
  tags           text[] not null default '{}',
  visibility     visibility not null default 'private',
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (persona_slug, slug)
);
create index if not exists blog_posts_persona_visibility_idx
  on blog_posts(persona_slug, visibility);

-- ---- updated_at maintenance ------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['personas', 'entries', 'blog_posts'] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on %1$s;
       create trigger trg_%1$s_updated_at before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;
