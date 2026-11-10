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
| `migrations/0006_admins_self_read.sql` | Lets an admin read their OWN `admins` row (so `is_admin()` works from the session client) without exposing the admin list. |
| `migrations/0007_media_storage.sql` | Storage buckets (`originals` private, `media` public) + RLS policies: admin-only writes (via `is_admin()`), public read on `media`. Powers the media pipeline. |
| `migrations/0011_site_settings.sql` | Admin console store: `site_settings` (draft + live per key), `site_settings_live` view (what visitors read), `settings_history`. See "Applying 0011". |

All are safe to re-run (guarded enums, `if not exists`, `on conflict` upsert,
`drop policy if exists` before create, bucket upsert).

> **Media note:** the smoke test (`scripts/verify-media.mjs`) will create the two
> buckets if missing, but only `0007` installs the RLS **policies** that let the
> admin *session* (the browser direct-upload) write to storage. Apply `0007`
> before using the uploader in `/capture/admin`, or uploads will fail RLS.

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

## Keep-alive & backups (free-tier protection)

Free projects **pause after 7 days of inactivity**, and a project left paused
~90 days may become unrestorable. Two GitHub Actions guard against that
(they only run from the **default branch, `main`**):

| Workflow | Schedule | What it does |
|----------|----------|--------------|
| `.github/workflows/supabase-keepalive.yml` | every 2 days | Checks project status via the Management API; **if paused, restores it** and waits until healthy; then makes one anon REST read so the project counts as active. |
| `.github/workflows/supabase-backup.yml` | Sundays | Wakes the project if needed, dumps roles + schema + data (`supabase db dump`), **encrypts with AES-256**, uploads as a 90-day workflow artifact. |

A failed run makes GitHub email the repo owner. Both can be run on demand from
the Actions tab (**Run workflow**).

> Public repos: GitHub disables scheduled workflows after 60 days with no repo
> activity. Normal commits reset this; if it happens, re-enable from the Actions tab.

### One-time setup (GitHub → repo → Settings → Secrets and variables → Actions)

| Kind | Name | Value |
|------|------|-------|
| Variable | `SUPABASE_PROJECT_REF` | `wgvwwiqromxlrocpnsoc` |
| Secret | `SUPABASE_ANON_KEY` | same as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Secret | `SUPABASE_ACCESS_TOKEN` | Personal access token — supabase.com → Account → Access Tokens (enables auto-restore) |
| Secret | `SUPABASE_DB_URL` | Dashboard → Connect → **Session pooler** URI (IPv4; GitHub runners can't reach the IPv6 direct host), with your DB password filled in |
| Secret | `BACKUP_PASSPHRASE` | a long random passphrase — **store it in your password manager**; without it the backups are unreadable |

### Restoring a backup

```bash
# download the artifact zip from the workflow run, unzip, then:
gpg -d supabase-YYYY-MM-DD.tar.gz.gpg | tar -xz      # prompts for BACKUP_PASSPHRASE
psql "$TARGET_DB_URL" -f dump/roles.sql
psql "$TARGET_DB_URL" -f dump/schema.sql
psql "$TARGET_DB_URL" -c "SET session_replication_role = replica" -f dump/data.sql
```

Storage **files** (media buckets) are not in the DB dump. Originals stay on your
devices; derivatives can be regenerated by re-running the media pipeline.

## Applying 0011 (admin console settings)

`migrations/0011_site_settings.sql` adds the settings store the admin console (`/admin`) writes to.
**The site works without it** (every reader falls back to the code defaults), but `/admin` cannot save
until it is applied.

1. Supabase → **SQL Editor** → New query.
2. Paste the whole of `supabase/migrations/0011_site_settings.sql` and **Run**. It is idempotent.
3. Check: Table editor shows `site_settings` and `settings_history`; the view `site_settings_live`
   exists. (`select * from site_settings_live;` returns zero rows until the first Publish.)
4. Sign in at `/capture/login`, open `/admin`: the "migration not applied" banner is gone.

Security recap: `site_settings` has RLS on and no policy; anon/authenticated have **no** grant on it.
Visitors read only the `site_settings_live` view (live column). Drafts and history are reachable by
the service role (server actions after `requireAdmin()`) and admins read `settings_history` via `is_admin()`.
