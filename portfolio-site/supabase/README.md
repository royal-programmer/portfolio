# Supabase — schema & setup

Versioned SQL for the content engine. Everything the database needs lives here,
so the schema is reproducible and reviewable (never clicked together in the UI).

## Migrations (apply in order)

| File | What it does |
|------|--------------|
| `migrations/0001_content_schema.sql` | Enums + tables: `personas`, `entries`, `media`, `groups`, `entry_groups`, `blog_posts`, `strategies`, `updated_at` triggers. |
| `migrations/0002_rls_policies.sql` | `admins` table + `is_admin()`, enables RLS, grants Data API access, and all read/write policies. |
| `migrations/0003_seed_personas.sql` | Seeds the six persona rows (idempotent). |
| `migrations/0004_service_role_grants.sql` | Grants table privileges to `service_role` (needed because "auto-expose new tables" is OFF). |
| `migrations/0005_add_entry_slug.sql` | Adds `entries.slug` (unique per persona) for clean `/[persona]/[slug]` detail URLs. |

All three are safe to re-run (guarded enums, `if not exists`, `on conflict` upsert,
`drop policy if exists` before create).

## How to apply

**Option A — SQL editor (simplest):** open Supabase → SQL Editor, paste each file's
contents in order (0001 → 0002 → 0003), run each.

**Option B — Supabase CLI:**
```bash
supabase link --project-ref <your-ref>
supabase db push        # applies migrations/*.sql
```

## One-time auth setup

1. **Enable Email auth** (Authentication → Providers → Email). Magic-link is fine.
2. **Turn OFF public sign-ups** (Authentication → Providers → Email → "Allow new
   users to sign up" = off), or Authentication → Settings, depending on dashboard
   version. This is a *defence in depth* measure — the `admins` table already means
   a random authenticated user gets zero access, but closing signups removes the
   ability to create accounts at all.
3. **Create your own user** (Authentication → Users → Add user, or sign in once via
   the app's login when it exists), then find your user UUID.
4. **Register yourself as admin** — in the SQL editor:
   ```sql
   insert into admins (user_id) values ('<your-auth-user-uuid>');
   ```
   Until you do this, even you can only read public data — writes are blocked. That
   is intentional.

## Security model (recap)

- **Private by default.** Every `entries` / `media` / `blog_posts` row starts
  `visibility = 'private'`. The public site sees a row only when it is set `public`
  (and, for personas, `is_published = true`).
- **anon** (public visitors) can `select` non-private rows only. No write access.
- **authenticated + in `admins`** = full access (this is you). A logged-in user who
  is *not* in `admins` gets the same access as anon.
- **`service_role`** (used only server-side by Next.js) bypasses RLS — never ship
  that key to the browser.
- **`strategies`** is not exposed to anon at all (admin-only).

## Notes

- `entries.data` is `jsonb` holding persona-specific fields (see `EntryDataMap` in
  `lib/content/types.ts`). A GIN index is set for querying it.
- Media originals are referenced by `original_path` (private storage key) and are
  never returned to the public client — only `thumb_url` / `optimized_url` /
  `full_url` are.
