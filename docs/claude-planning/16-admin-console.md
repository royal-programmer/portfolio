# 16 — The admin console: everything configurable, A to Z

**Ratul's rule (2026-11-06):** "I want everything, literally everything A to Z to be configurable
via admin page, whatever we can put to edit — hub screenshots, photos, pages data, information
management, everything. Keep in mind and build accordingly."

This doc is the standing contract for that. Every new feature from here on ships with its knobs in
the data layer, not in code constants, so the admin can reach them. What already exists is the
admin login and entries (`/admin/login`, `/admin/engineer/projects`: Supabase Auth, the `admins` table, entry +
media upload for engineer projects). The console grows out of it.

## 1. Principles

1. **Code holds behaviour, the database holds every value.** Copy, numbers, colours, media,
   switches, orderings, timings a human might want to tune: all rows, all editable.
2. **One settings store, typed.** A `site_settings` table (key → JSON, versioned) read through
   `lib/content` with a Zod schema per key, so a bad edit cannot break the build; the UI reads the
   same types (`lib/content/types.ts` stays the contract).
3. **Media is a library, not a folder.** `public/hub/media.json` and the `public/hub/*` folders
   are replaced by the existing `media` table + Supabase Storage (bucket per kind: `hub`,
   `photos`, `audio`, `models`), served through the image optimizer. Upload from the admin, pick
   from the library anywhere a picture / sound / model is used.
4. **Preview before publish.** Every setting has a draft and a live value; the admin sees the
   draft on `?preview=draft`; "Publish" copies draft → live and revalidates the tags.
5. **Safe by default.** Admin only on `admins` rows (RLS), server actions only, service key never
   in the browser, every write logged (`settings_history`: who, when, before, after, one-click
   revert).
6. **Nothing in code that Ratul would want to change** becomes the review question for every PR.

## 2. What Ratul should be able to configure (the recommendation)

Grouped the way the admin's sidebar will be. ✅ = exists in data today · 🔜 = constants in code
today, to move.

### Identity
- Name, handle(s), title line, email, socials (per persona too) 🔜
- The global tagline pair ("Different perspectives. One person.") and the hub's intro words 🔜
- Legal footer, copyright year rule 🔜

### Personas (one row each ✅, these fields 🔜 where marked)
- Published / hidden ✅ · order on the climb and in the rail 🔜 · host (`code.` …) 🔜
- Colour: position on the spectrum (`t`) and the accent override 🔜
- Label, kicker ("I build systems."), description, the three points 🔜
- CTA label ("Step into the code") 🔜
- Hero type-sequence lines (the typed phrases) 🔜
- Identity panel: icon pick, badges, location 🔜

### Hub (the immersive journey)
- Headset gate copy, the detected-device line on/off, quality default (eco / balanced / ultra) 🔜
- Per world: which display plays (terminal / chart / viewfinder / canvas / dash / monitor), its
  content lines (terminal commands and answers, chart labels and levels, viewfinder readouts,
  dash trip name / time / fuel, HUD handle) 🔜
- Per world: the 3D setup's media — engineer screenshot, photographer photo, the artwork, the
  bike model file, the gamer handle 🔜 (today `media.json` + folders)
- Per world: the constellation — pick 8 of the drawn objects, their stations, or hide one 🔜
- Portal timings (fly-in, pull-out), climb length per chapter, ending copy, rewind on/off 🔜
- Keys on/off (Space, 1–6, Enter), the drag-to-look, the hold-to-slow 🔜
- The doorway's wait for a setup to form (`WAIT_FOR_SETUP_MS`), the phone setup lift and the chapter's phone paddings 🔜
- The rail/HUD fold-on-scroll (on/off, 40 px threshold), the HUD sound cycle order, the Top/End marks, the page stage's fit margin (0.82) 🔜
- The HUD guide: on/off, its rows' labels per mode (desktop / touch), `F` fullscreen on/off; the phone drawing band's composition (places, band ratio) 🔜

### Normal mode
- Display size, ring radius, grain on/off, the light fan's intensity 🔜
- Which objects draw on phones 🔜

### Sound
- **Soundscapes:** the synthesised set stays as presets; add **uploaded tracks** per world
  (ambient loop, approach swell, chime, target, the dash's start-up, the camera's shutter) with
  per-sound gain, loop points, fade in/out 🔜. Format: mp3/ogg/wav up to ~5 MB each, stored in the
  `audio` bucket. Royalty-free sources Ratul can download from: freesound.org (CC0 filter),
  pixabay.com/sound-effects, mixkit.co, zapsplat.com (attribution), uppbeat.io (attribution);
  the console-only credits line is built from the row's `credit` field.
- Default sound state (off / ambient / per world), master gain, mute on hidden tab 🔜

### Pages (per world)
- Section order and visibility (hero, identity, projects, blog, gallery, routes, library …) 🔜
- Entries ✅ (engineer projects today; trader setups, photos, artworks, rides, games next: the
  `entries` table already types them) · blog posts ✅ · groups ✅
- The page stage: show / hide, height, camera framing per world 🔜
- Per-page SEO: title, description, OG image (pick from library), noindex 🔜

### Media library
- Upload (drag-drop, phone camera), auto-optimised sizes, alt text, EXIF kept or stripped,
  visibility (public / unlisted / private) ✅ partly (entries' media)
- Collections (a ride's photos, a project's screenshots) ✅ via `groups`
- Which image is the hub screenshot / the OG image / the persona avatar 🔜

### Site switches
- `preview` default, `xp` default (immersive / normal / auto), reduced-motion override 🔜
- Agent chat panel on/off and its system prompt, lead form on/off and its destination 🔜
- Analytics provider + id (Cloudflare Web Analytics), maintenance mode with a message 🔜
- Redirect rules (`www` → apex etc. are DNS today; path redirects here) 🔜

### Stage: what is data (round 20)
All in `lib/site/stage-data.ts`, plain data with no three.js, ready for forms 🔜:
- Lighting presets per clock band (`STAGE_LIGHTING`: key / fill / rim / ambient, screen glow, lamp on, window colour and brightness).
- Desk props (`STAGE_PROPS`: id, label, command, kind) and the project shelf (`STAGE_DEV_PROJECTS`, `SHELF_MAX`; public projects come from the content layer).
- Constellation: star cap per tier (`STAGE_TIERS.stars`); the links are computed from the stack, resume skills, `arch` diagrams and projects (`lib/site/stage-constellation.ts`).
- Scroll stops (`STAGE_STOPS`: eye, look, side, label), their scroll length (`STAGE_TRAVEL`) and the words beside them (`STAGE_STORY_COPY`).
- Performance tiers (`STAGE_TIERS`: dpr cap, reflection size, stars, screen fps) and the step-down rule (`STAGE_PERF`).
- Photo mode (`STAGE_PHOTO`: size, orbit limits, file name, the name strip's text).
- The door (`STAGE_DOOR`: label, position, size, open angles and timings, where it leads).

### Theme
- The spectrum's hue range and saturation, ink / void colours, surface border, the display's
  window chrome colours, the font pair (from a vetted list) 🔜

## 3. How it is built (free stack)

- **Tables:** `site_settings(key text pk, draft jsonb, live jsonb, schema_version int, updated_by,
  updated_at)`, `settings_history(id, key, before, after, by, at)`, `sounds(id, world, slot,
  media_id, gain, loop, credit)`, `persona_fields` folded into `personas` (new columns), `media`
  gains `bucket`, `role` (hub-screenshot / og / avatar / artwork / model / audio).
- **Storage:** Supabase Storage buckets `hub`, `photos`, `audio`, `models` (public read, admin
  write); the Next image loader serves images, `<audio>`/`fetch` serve the rest.
- **Reads:** `lib/content` gets `getSettings<K>(key)` with Zod parse + defaults (the defaults are
  today's constants, so nothing changes on day one), cached with `unstable_cache` tags
  (`settings:<key>`, `persona:<slug>`, `media`).
- **Writes:** server actions under `app/admin/**`, `requireAdmin()` as now; every write stores
  history and calls `revalidateTag`.
- **Admin UI:** `/admin` on the apex (and `admin.ratulroy.me` later) built with the site's own
  design system: a left rail of the groups above, forms generated from the Zod schemas (text,
  number, colour, toggle, order list, media picker, sound picker with preview), a draft/live pill,
  "Publish" and "Revert". Capture app pages fold into it.
- **Where constants move from:** `site-content.ts`, `brand.ts`, `spectrum.ts`, the hub's
  `state.ts` timings, `constellations.ts` placements, `media.json`, the display texts in
  `exit-sequence*.tsx` and `screens*.ts`, the sound presets in `sound.ts`.

## 4. Phasing

- **A (first):** `site_settings` + history + the typed reader with today's defaults; admin shell
  at `/admin` with Identity, Personas (publish / order / copy / colour), Site switches. Capture's
  project form moves in.
- **B:** Media library (buckets, upload, roles) replacing `media.json`; the hub's per-world media
  and displays' texts; per-page SEO.
- **C:** Sound (uploads + per-slot assignment + credits), constellation picker, hub timings and
  keys, Normal-mode knobs.
- **D:** Pages: section order, the remaining entry types' forms (trader / photo / artwork / ride /
  game), blog editor with media.
- **E:** Theme, redirects, analytics, maintenance mode.

Each phase ships behind the draft/live gate, so the live site never shows a half-edited value.

## 5. Phase A as built (round 13)

**Store.** `supabase/migrations/0011_site_settings.sql`: `site_settings(key, draft, live, schema_version,
updated_by, updated_at)`, `settings_history(id, key, action, before, after, by, at)` and the view
`site_settings_live(key, value)`. RLS on both tables with no policy for visitors; anon/authenticated read
only the view (live column); `settings_history` is admin-readable via `is_admin()`; writes go through the
service role in server actions (`app/admin/actions.ts`) after `isAdmin()`.

**Keys** (`lib/settings/schema.ts`, one strict Zod schema each; defaults in `defaults.ts` are imported from
the code constants, never retyped): `identity`, `personas.copy`, `hub.copy`, `engineer.terminal` (who, stack,
uptime, status, contact, portrait, now, clock, hiring, resumeFiles), `engineer.resume`, `engineer.i18n`,
`engineer.timeline` (entries + periods), `engineer.arch` (diagrams + projectArch), `engineer.views`,
`engineer.themes`, `site.switches`, `netflix`. A profiles key waits for round 15 landing.

**Reading.** `getSetting(key)` (`lib/settings/read.ts`): live via the view, cached 60 s with tag
`settings:<key>`; the draft through the service client when a valid signed `xp-preview` cookie is present;
else the code default. A missing table, a blip or a value failing its schema falls back for that key only
(schema failures log once). `loadTerminalConfig()` / `loadViews()` (`lib/settings/load.ts`) feed
`terminalData(..., cfg)`. **Wired:** `identity` (hub email, terminal `mail` row, hub title), `hub.copy`,
`engineer.terminal|resume|i18n|timeline|arch|views|themes` on the terminal, its views route and the preview
image data. **Stored and editable but not yet consumed:** `personas.copy` (the `personaIdentity()` callers are
client components), `site.switches`, `netflix` (the view imports its constants), `engineer.views.defaultView`.

**Preview.** "Preview site" in the admin hits `/admin/preview?to=hub|engineer|off` (admin-checked), which sets
the HMAC-signed `xp-preview` cookie (30 min, shared root domain) and redirects with `?preview=draft`.

**Admin.** `/admin/<group>` (Identity, Personas, Hub, Engineer terminal, Timeline, Diagrams, Views, Themes,
Netflix, Switches) and `/admin/history`. Forms are generated from the schemas (`lib/settings/form.tsx`); the
Timeline, Diagrams, Themes (contrast check) and Views editors add a live preview. Save writes the draft;
Publish copies draft to live, logs, and `updateTag`s the key; Discard; History Revert puts `before` into the
draft. Unauthenticated `/admin` redirects to `/admin/login?next=/admin`.

**Add a key.** Schema in `schema.ts` + `SCHEMAS` + `GROUPS`, default in `defaults.ts`, read with
`getSetting`, run `node scripts/settings-roundtrip.mjs`. **Apply 0011:** paste the file into the Supabase SQL
editor (`supabase/README.md`, "Applying 0011"); until then everything runs on the code defaults and `/admin`
shows a banner and cannot save.

## 6. Flow (round 22)

Everything lives under `/admin`; there is no `/capture` path any more (the old capture app was folded in).

**Route map.** `/admin` home (signed in as, Preview site, records per world, what is editable now / coming) ·
`/admin/login` sign-in (the only page outside the guard) · `/admin/auth/callback` magic-link landing ·
`/admin/site/<section>` (identity, hub, persona copy, switches, history, previews) · `/admin/<persona>` persona home
(data overview, New buttons) · `/admin/<persona>/<collection>` master-detail content (Engineer: `projects`, `media`; coming:
`experience`, `certifications`, `education`, `writing`, which still come from the RESUME constant in `lib/site/terminal-data.ts`) ·
`/admin/<persona>/views` and `/admin/<persona>/copy` (typed Zod forms, with draft, preview, publish, history and revert unchanged).
The map is two constants: `app/admin/nav.ts` (groups, sections) and `app/admin/collections.ts` (collections: id, label, kind, fields,
uploads). One check guards the console: `app/admin/(console)/layout.tsx`; a signed-in non-admin sees a banner saying so with a link to
`/admin/login`. Every server action still re-checks `isAdmin()`. Old flat `/admin/<settings group>` paths redirect to the new ones.
The admin host is one constant, `lib/site/admin-host.ts` (`ADMIN_HOST_LABEL`, null = apex); persona hosts redirect `/admin` to it.

**Master-detail.** Each collection page has the record list on the left (search, visibility filter), the editor on the right (New,
edit, duplicate, delete with confirm, attach photos through the existing media pipeline; PDFs are not accepted by it yet). On phones the
list is the page, the editor is a full-screen sheet and a floating Quick add opens a new record. Drag-order is not built (the entries
table has an order column, no UI yet).

**Sign-in.** `/admin/login`: **Email me a sign-in link** (remembered in `localStorage` `xp-admin-email`) calls
`signInWithOtp({ shouldCreateUser: false, emailRedirectTo: <apex>/admin/auth/callback?next=… })`, so a stranger can never create an account.
The reply is always "If that address is an admin, a link is on its way", with an in-memory limit of 3 sends per IP per 10 minutes. The
callback exchanges the `code` (or `token_hash` + `type`) for the session cookie and goes to `next` (default `/admin`); a failure returns to
`/admin/login?error=…`. The password form stays as the backup.

**Two Supabase settings Ratul must set** (Dashboard):

1. Authentication, URL Configuration: Site URL `https://ratulroy.me`; Redirect URLs `https://ratulroy.me/**` and
   `http://ratulroy.localhost:3000/**`.
2. Authentication, Sign In / Providers: turn **off** "Allow new users to sign up".

Google (later): a button beside the link form calling `signInWithOAuth({ provider: "google", options: { redirectTo } })` with the same
callback. The spot is marked in `app/admin/login/login-form.tsx` and `app/admin/entry-actions.ts`. Not built.

## 7. Content importer (round 24)

`scripts/import-content.mjs` seeds the engineer records from the frozen copy. Run from `portfolio-site/` after applying `supabase/migrations/0012_content_records.sql` (new `entry_type` values) in the Supabase SQL editor.

```
node scripts/import-content.mjs                          # dry run: validates, prints counts per type
node scripts/import-content.mjs --apply                  # writes what is missing, visibility public
node scripts/import-content.mjs --apply --overwrite      # also replaces rows that already exist
```

- Idempotent: each record has a stable slug (`experience-altimetrik`, `timeline-2026-09-01-...`, `diagram-shift-roster`, `link-github`) and is upserted by `(persona_slug, slug)`. Without `--overwrite` an existing row (your admin edits) is left alone.
- Project story and media are merged into the existing project row (`api-test-center`); a missing project is reported and skipped, never created.
- Settings: `engineer.resume` (header), `engineer.hiring`, `engineer.clock` are written only when the key has no row; `netflix` only gains `bookCall`. Each write adds a `settings_history` row.
- Needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; nothing is printed. Keep it in the repo for future re-seeds. Then set `CONTENT_SOURCE=db` (Vercel and `.env.local`) once the site looks right.
