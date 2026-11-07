# 16 — The admin console: everything configurable, A to Z

**Ratul's rule (2026-11-06):** "I want everything, literally everything A to Z to be configurable
via admin page, whatever we can put to edit — hub screenshots, photos, pages data, information
management, everything. Keep in mind and build accordingly."

This doc is the standing contract for that. Every new feature from here on ships with its knobs in
the data layer, not in code constants, so the admin can reach them. What already exists is the
capture app (`/capture/login`, `/capture/admin`: Supabase Auth, the `admins` table, entry +
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
