# 08 — Progress Log

Running record of what has actually landed, so either agent (or a future
session) can resume without re-deriving state. Newest first.

---

## 2026-11-09 — Engineer terminal round 1i: contents pane, `timeline`, real `git log`, `hire`

Builder (Sonnet, ≈190k tokens incl. verification). Caret follows the input's cursor; the portrait
is command-only (132x102 pixel art, fits width and height); `timeline` (wide and stacked) replaces
the career `git log`, which now shows the latest public pushes of royal-programmer (head commit per
push, message looked up once per sha, `xp-gh-msgs`); ghost suggestions removed; `view` command and
new tips wording; `demo` → `tour` (hidden alias) with narrated steps and a status-bar counter; pane =
clickable portfolio contents with done marks (achievement on the eight non-mail rows); `hire`,
`?run=`, numbered tips, faster repeat boot. Verified at 1280x720 and 393x852 touch: hire, timeline,
git log (+ `--oneline -n 3`), tour to the end, portrait fit, quick pick `2`, `?run=hire`, Home-key caret,
pane row clicks; console clean. Not verified: a `school` period (unknown), rate-limited GitHub.

**Lead verification (Fable) and nits:** `hire` no longer says "willing to relocate" twice; `git log`
messages cut at a word boundary with `…` instead of mid-word; sections with nothing in them
(`writing · 0 posts` today) are left out of the contents pane, the status counts, the next-hint and
the achievement. Site-wide audit by a Sonnet reviewer (≈115k): hub and non-Engineer persona pages
still show pre-redesign placeholders (debug "Identity Shift Panel" copy, "Performance (sample)",
empty "Recent frames", "I am a Storytelling Frames"), no contact path off the Engineer host, phone
hero under the guide HUD, soft 404 — queued as round 1j.

---

## 2026-11-08 — Engineer terminal: cold review of rounds 1c–1h and the fix pass

**Reviewer (Sonnet, ≈100k)** found 10: (1) demo/`sl`/`curl` outlived the component — cleanup
cleared timers so `await wait()` never resolved and capture-phase key listeners stayed on
`window`, eating keys on the next page; (2) beacons sent any typed first token, not only commands;
(3) paper theme dim text ≈2.7:1; (4) two `curl`s in flight broke Esc; (5) GitHub `html_url` and the
cache unvalidated; (6) Ctrl+C swallowed copy; (7) mail fetch without `keepalive`; (8) in-memory
rate limit useless on serverless, PII in logs, no body caps; (9) small (`-n abc` blame, chips
during mail, `pageshow` double menu, stale `crt`, duplicate phone controls); (10) banner/art in the
live region, demo steps announced.

**Fixed** — builder (Sonnet, ≈60k): tracked listeners removed in cleanup, cancellable `wait`,
abort/stop/reset on unmount; beacons allowlisted to known commands + eggs, else `unknown`,
`view_open` only for real ids, no double `demo`; per-theme `--term-faint` (paper 5.6:1); curl
in-flight guard and owner-checked abort; GitHub URL protocol check, cache shape validation, NaN
dates → `unknown`; Ctrl+C yields to copy; `keepalive`, Esc/exit held while sending; `-n abc`
message; chips answer during mail; `pageshow` reuses the last menu; `crt` via ref; status-bar
buttons hidden on coarse pointers; art `aria-hidden` with sr-only text; live region off during
the demo. Lead: body caps on both routes, theme allowlist, hashed email in logs, **migration
0010** — DB triggers capping `leads` at 60/h and `term_events` at 5000/h (replaces the in-memory
limiter). Lead verified: a demo interrupted by Back leaves no capture listener behind; phone
status bar shows no duplicate buttons; tsc + eslint clean.

**Pending on Ratul** — migrations 0008, 0009, 0010 in the SQL editor; then `mail` and the
beacons go live. Then checkpoint #4.

## 2026-11-08 — Engineer round 1h: live GitHub, themes, the PDF, QR, eggs, ghost text, analytics

**What shipped** — `curl github` (public API, no token; repos, followers, last push, five repos with
links, a 12-week contribution strip; cached an hour in `xp-gh-cache`); `theme accent|amber|green|
paper` through CSS variables (remembered), `crt` scanlines (off under reduced motion); `resume
--pdf` opens `/Ratul_Roy_Resume.pdf` (generated with reportlab from the résumé text, no phone
number); `qr` — an in-house QR encoder (`lib/site/qr.ts`, byte mode, level M, versions 1–6,
Reed–Solomon, 8 masks scored), drawn dark-on-white with a quiet zone, decoded by jsQR from a
screenshot; eggs `sl`, `cowsay`, `fortune` (12 lines), `sudo` (`nice try`; the sandwich gets the
cow), `rm -rf /`, `vim`/`nano`/`emacs`; fish-style ghost suggestions (→ or End accepts); anonymous
analytics — one `sendBeacon` per visitor command to `/api/term-event` (first token only, plus
`view_open:<id>`, `demo_*`, `achievement`; no ids, no IP, no arguments) into `term_events`
(migration 0009, **not applied yet** — same as 0008).

**How** — lead ≈20k (PDF, migration + route, verification); Sonnet builder ≈150k. A cold review
of rounds 1c–1h follows as one pass before the checkpoint.

## 2026-11-08 — Engineer round 1g: demo tour, git log, mail; the leads table

**What shipped** — `demo`: a typed tour (help → resume → ls → cat → git log --graph → portrait →
contact), human speed, any key or tap stops it with `^C demo`; first visit's hint offers it;
`demo` in the tips box and the phone chips. `git log` from `TIMELINE` (13 commits: Cisco/IBM 2022,
B.Tech 2024, SLK Oct 2024, SLK Digital Mar 2025, automations, APIs, VMS, CI/CD, API Test Center,
Altimetrik, OpenAI credentials, Shift Roster v2.0, this terminal) with stable FNV hashes, tags in
green, `-n`, `--oneline`, `--graph` with three lanes (main accent, side green, learn violet),
`git status`. `mail`: an inline wizard (name, email, multi-line message), validation, Esc/Ctrl+C
abort, POST `/api/lead` with `source: terminal`, answers kept out of history. The lead API now
stores rows in a new `leads` table (migration 0008: RLS on, server-only writes, per-IP guard) —
**the migration is not applied yet** (apply blocked by the permission classifier; Ratul applies it
in the SQL editor), so `mail` currently answers 503 (`PGRST205`, table not in schema cache) and
prints the message back; the happy path and the `mail` tick are untested until then.

**How** — lead ≈20k (timeline data, leads migration + API, verification); Sonnet builder ≈130k.

## 2026-11-08 — Engineer round 1f: the pane, checkpoints, braille and pixel portraits, shell feel

**Ratul:** took the whole feature list (§6.9); asked whether the portrait could be more detailed and
whether a 3/4 + 1/4 layout with hints would be better — lead recommended the pane, he agreed.

**What shipped** — at ≥1024px a tmux-style split: terminal 3fr, pane `clamp(280px, 25%, 380px)`
with the braille portrait, *where* (cwd), *checkpoints* (boot · help · resume · projects · views ·
portrait · contact · mail-soon; ticked in the accent, stored in `xp-term-checks:engineer`; all
seven → `achievement unlocked · explorer` printed once, `sudo` answers `nice try`), *next* (the
first unticked, tappable) and *keys*. `pane` toggles it (remembered); phones show the next hint in
the status bar. Portraits: braille (2×4 dots per cell, backdrop masked by hue, face crop) in the
pane / phone header / neofetch; `portrait` is a true-colour half-block photo (84×65 cells,
64-colour palette, 3,797 merged spans) — unmistakably him. Header hides its portrait when the
pane shows it. Shell feel: coloured `ls` (dirs accent, views green), clickable names (`cat`/`cd`/
`open`), `less`-style paging over 40 lines, Ctrl+L, Ctrl+C, `date`, `cal`.

**Verified (lead)** — pane at 1280 with one portrait, phone header at 393 with no horizontal
scroll, console clean, tsc + eslint clean. Builder verified checkpoints persist, achievement once,
paging, Ctrl keys, clicked path.

**How** — lead ≈30k (spec, three braille generations, verification); Sonnet builder ≈135k.
Braille glyphs fall back to a system font (advance 0.76em vs 0.6em), so braille width varies a
little by machine; the pixel portrait does not.

## 2026-11-08 — Engineer round 1e: boot as the profile tool, the Linux box, the header with the portrait

**Ratul's answers:** prompt stays Ubuntu-shaped, user `ratulroy@code`; overview in the `whoami`
voice; boot should look like *running the profile tool*, with progress. Spec: `17-persona-views.md` §6.8.

**What shipped** — the boot window types `royal-programmer --boot`, prints the tool line and six
`[..]`→`[ok]` rows (profile, mount ~/projects, ~/resume, ~/views, link github, sound), then a
10-step progress bar to `100%  ready`, then the swap. The hub's exit window shares the script.
Header after the swap: portrait left; banner `ROYAL / PROGRAMMER` (no hyphen), `royal-programmer
v1 · code.ratulroy.me`, and the three overview lines (who · stack · uptime) right; phones stack
the portrait above. The machine is a Linux box: home `/home/ratulroy`, `pwd` real, `/engineer`
gone, `cd /` shows `home/`, `exit` the only way to the hub, `whoami` → `ratulroy`. Selection on
desktop output only. Tips box drawn with CSS (fieldset + legend) so borders align; dim text raised
to 4.9:1; portrait skin/shirt brightened. Builder found and fixed a `//home` join bug at `/`.

**Verified (lead)** — boot rows and bar observed mid-flight at 1280; header at 1280 and 393;
remembered view still auto-opens to `/stage`; tsc + eslint clean. The hub's Normal display was
not driven to the engineer window this round (shared code, type-checked).

**How** — lead ≈15k (spec, banner regen, verification); Sonnet builder ≈110k.

## 2026-11-08 — Engineer round 1d: royal-programmer banner, the résumé in the terminal, the ASCII portrait

**Ratul's asks:** the banner spells `royal-programmer`; an overview like the résumé; a detailed
ASCII portrait from his headshot. Spec: `17-persona-views.md` §6.7.

**What shipped** — banner is figlet ANSI Shadow `ROYAL-` over `PROGRAMMER` (88 columns, sized to
fit any width; 6.8px on a 393 phone, no horizontal scroll). `~/resume/` with `summary experience
skills projects certifications education` and the `resume` card (name, title, location, links,
summary, experience line, skills groups, education, certifications, footer) from
`Ratul_Roy_Resume.pdf` typed into `terminal-data.ts` (no phone number). `portrait` prints the
84-column headshot in a 70-step ramp, coloured per tone run (backdrop blue, skin, hair/jacket,
shirt) as 467 memoized spans; `neofetch` shows the 38-column portrait beside the stats with a
colour strip, stacked under 640px. `contact` gains LinkedIn. Tips box has a `resume` row and is
88 columns from 780px up, 44 on phones.

**How** — lead (Fable): résumé extraction (pypdf), art generation (pyfiglet + Pillow), data module,
spec, fix of the banner wrap (pyfiglet had split the handle at 80 columns), verification ≈25k.
Sonnet builder ≈90k. Generation script lives in this session's scratchpad `portrait/`.

**Known** — the portrait's face reads dark on dark; a contrast pass on the generator would help.

## 2026-11-08 — Engineer round 1c: the terminal as a full-screen OS

**Ratul's references:** Claude Code's welcome, katoolin, vulnx on a phone. His asks: full-screen
terminal look, typing sounds, the path in the prompt (`projects$`), the ssh window only as a boot
screen. Spec: `17-persona-views.md` §6.6.

**What shipped** — the ssh window types the script, then grows and dissolves into `.terminal-os`,
the whole viewport: a block-letter `RATUL` banner in the accent, `Welcome to code.ratulroy.me ·
v1`, a boxed *Tips for getting started*, the views as a numbered list, then the prompt
`ratul@code:~$` (`~$` on phones) whose path follows `cd` on each transcript line. A tmux-like
status bar (`ratul@code ~/projects │ 1 project · 0 posts · 1 view │ help / Esc`) sits at the
bottom, above the phone chips. Every keystroke plays the hub's key click through `ambient.key()`
(respects the site sound setting). `banner` reprints the welcome; `fullscreen` asks the browser's
Fullscreen API; the title dots and `xp-term-full` are gone. Remembered view still opens from the
boot window before the swap. Verified at 1280 and 393×852 touch: no horizontal scroll, banner
8px on phones, status bar 767–795, chips 44px below it, console clean, tsc + eslint clean.

**How** — lead (Fable) spec + brief + verification ≈15k; Sonnet builder ≈70k. No separate review
this round (1b's reviewer findings all still hold; a 1c review goes with the Swarm round).

## 2026-11-08 — Engineer round 1b: the terminal in full — a real shell, not an entry animation

**Ratul's correction** after round 1 (screenshot: his own `ls /engineer` answered `command not found`):
the root should be a full terminal, like Claude Code or a Linux TUI — every command, `/help`,
menus chosen with the arrows, full screen. Spec: `17-persona-views.md` §6.

**What shipped (on `development`)**
- `lib/site/terminal-data.ts` — what the terminal knows, built on the server from the content
  layer (who, about, stack, uptime, contact, projects, posts, views, commit).
- `lib/site/terminal-fs.ts` — a virtual file system: `~` = `/engineer`, `about stack uptime
  contact`, `projects/<slug>.md`, `writing/<slug>.md`, `views/<id>*`; `..`/`~`/trailing slashes
  resolve; shell-voice errors.
- `lib/site/terminal-shell.ts` — the interpreter: `help` (grouped) `man` `ls [-l]` `cd` `pwd` `cat`
  `tree` `open <view|slug|url>` `views` `projects` `writing` (select lists) `whoami` `stack` `uptime`
  `about` `contact` `neofetch` `history` `clear` `fullscreen` `echo` `exit`; Tab completion;
  did-you-mean for 3+ letter typos; `javascript:` and non-http links refused.
- `terminal-root.tsx` — hidden real input (phones raise the keyboard; 16px so iOS does not zoom),
  `/` command palette filtered as you type, menus with ▸ / arrows / digits / taps, stale menus
  dimmed, ↑/↓ history (session storage), full screen via the green dot or `fullscreen`
  (remembered), yellow clears, red exits, phone chip strip (`help / ls views Tab ↑ Esc`),
  `visualViewport` fitting, `role=log` transcript, Esc order palette → text → menu → auto-open →
  hub. Every round-1 behaviour kept (boot script, remembered view, Back, bfcache, reduced motion).

**How it was built** — lead (Fable): spec, data module, route plumbing, two browser passes
(1280 and 393×852 touch), ≈25k tokens. Sonnet builder: fs + shell + UI + CSS, ≈142k; fix pass
≈158k cumulative. Sonnet reviewer: 13 findings (menu pick from a subdirectory broke, Tab keyboard
trap, Esc order, unchecked hrefs from content, did-you-mean on one letter, `/cd` ran bare,
stale menus looked live, aria-live noise, 24px dots on phones, impure setState, boot deps, no
navigation recovery), ≈97k. All 13 fixed and the first six re-verified by the lead.

**Known** — the palette rows wrap on phones (usable); the caret sits at the end of the text;
sample project links are placeholders from the data, not the code.

## 2026-11-08 — Engineer round 1: the terminal is the page's root, views are branches — built through the split

Ratul's model (`17-persona-views.md`): one dataset, many selectable views; the terminal is the
Engineer page's root and every view is a branch with its own route; a pick is remembered until
Exit, which returns to the terminal. First two views to come: Swarm, then Series (Netflix-shaped,
no Netflix marks).

**Shipped.** `PersonaView` in the content contract; the registry `lib/content/views.ts` (`stage`
enabled; `swarm`, `series` registered, disabled); `lib/site/view-memory.ts`; `/engineer` renders
`TerminalRoot` (the other personas keep their pages); `/engineer/<view>` renders the view inside
`ViewShell` (remembers the pick; Esc and an `exit` pill return to the root and forget it); `stage`
= the page as it was, opening on its finished window. The terminal types the existing script, then
`ls views/` and the picker: arrows/Enter/digits, tap on phones, a live prompt that takes `open`,
`ls`, `help`, `exit`/`cd ..` (to the hub). `via=normal` prints instantly; `via=hub` ignores the
memory. A view id shadows an entry slug and `generateStaticParams` logs it. Verified on 393 × 852
touch and 1280: typing, picker, tap → `/stage`, remembered auto-open, Esc → root with the picker,
Back from a view → the picker (no re-open), exit pill clear of the page's corner control, no
console warnings beyond the slow Supabase reads.

**How it was built.** Haiku scout surveyed the routes and content layer (71k tokens); the lead
wrote the design doc, the contract type, the registry, the memory helper, `ViewShell` and the
route wiring; a Sonnet builder wrote `terminal-root.tsx` + CSS from a brief (100k), a Sonnet
reviewer read it cold and found ten real issues (69k) — Esc mid-script interleaving two typers,
a Back-button re-open loop, the memory written before the view exists, Esc stealing from open
panels, bfcache restore, reduced motion, listbox misuse, AltGr/IME, touch target, re-subscribing
listeners — all fixed by the builder in a second pass (127k). Lead spend ≈ 30k across briefs,
review and verification. Lesson: the reviewer leg paid for itself; keep it for interaction-heavy
pieces.

---

## 2026-11-08 — Checkpoint #3 to production; Round H (part 2c): the phone display's type scales with its frame — the first task run through the model split

**Checkpoint.** PR #3 (`development` → `main`, merge commit `6480e51`) carried Round H parts 1a–2b
plus the docs index link. Vercel redeploys production from `main`.

**The display's type (phones, Normal mode).** The chapter's display window (`.hub-exit` inside
`.normal-display`) was sized for an 1100 px window, so on a 361 px frame (a 393 px phone) only
about seven lines fit and the bar shrank. `.normal-display-frame` is now a size container and,
under 1024 px, every fixed size inside the window (bar, body type and padding, the trader's list
column, the viewfinder corners, the dash numbers and gauge, the game HUD, the canvas padding) is a
`clamp(min, Ncqw, desktop)` so the window reads like a smaller desktop window, type never below
9 px. Desktop and the full-size world loader are untouched (the rules are scoped to
`.normal-display` and the phone media query). Verified: 393 × 852 body 9.75 px, bar 22 px, nine
lines fit, no horizontal scroll; 360 × 780 floors at 9 px; 1280 unchanged; the Rider dash checked
by the lead.

**How it was built (the split, first run).** The lead (Fable) wrote a brief (goal, the two files,
the approach, the verification steps, what to report) and handed it to a Sonnet builder, which
did the CSS, screenshots and computed-style checks in one pass. Cost: the builder used
~86k tokens over 52 tool calls in ~18 minutes; the lead spent roughly 6k tokens on the brief,
the diff review and one screenshot sweep. Two lead-side catches: the builder saved
`globals.css` with CRLF line endings (converted back to LF before the commit), and it skipped the
loader and the non-Engineer displays, so the lead checked the dash. Lesson for the brief
template: state the line-ending rule and name every variant to screenshot.

**Keel smoke test (Ratul's session).** `/plugin marketplace add praxikit/keel` failed with
`EBUSY` while renaming the marketplace cache folder; the folder was gone afterwards, so the fix is
to retry. Decision: real apps (the trading journal) live in Ratul's personal GitHub, the
`praxikit` org holds skills and kits only.

---

## 2026-11-07 — Round H (part 2b): every drawn object redrawn in detail, one stroke per object

Ratul's call: "make all graffiti detailed to look like real but in 2D, no matter the strokes."
All 47 hand-drawn objects in `hub/constellations.ts` (the bike stays traced from its model) were
redrawn at roughly three to five times the detail, each still a set of polylines in a unit box so
the draw-on, the pen light and the placements are untouched:

- **Code:** the laptop in three-quarter view with a lit screen of code, a cursor, a status bar,
  hinge caps, a perspective keyboard, trackpad, speaker grilles, ports; the terminal with a title,
  a progress bar and a scrollbar; two monitors showing an editor (file tree, tabs, minimap) and a
  dashboard (chart, bars, gauge); earbuds with mesh and stems; a rack of five servers with rails,
  handles, drive bays, vents and LEDs; a mug with latte swirl and beans; a git graph with two
  branches, a tag and HEAD; a keyboard with a function row, W A S D legends, arrows and a wrist rest.
- **Trade:** the chart is a chart (Ratul: "not a desk"): fourteen candles with wicks and bearish
  fills, a moving average, volume bars, price and time ticks, a crosshair with its price tag, a
  legend; a coin with reeded edge and lettering; a stack of notes with a portrait, seals and a coin
  stack; a brain with gyri and a circuit overlay; a clock with sixty ticks, a sub-dial, a date
  window and a crown; an hourglass with turned posts, grains and a stream; a spiral journal with a
  checklist and a tiny P&L sketch, and a pen; a calculator with digits, a solar strip and glyphs.
- **Lens:** a camera with grip, pentaprism, hot shoe, mode dial, seven aperture blades and strap
  lugs; thirds with a scene (sun, hills, a tree on a crossing, an AF box); the golden spiral with
  diagonals and a ratio bar; a phone back with a three-lens island, LiDAR, flash and speaker holes;
  a tripod with a ball head, pan handle, centre column, hook, three two-section legs and a
  spreader; a lens front with thread, blades and reflections; a softbox with its grid, speedring,
  stand and rays; an SD card with pins, label and lock.
- **Art:** an easel whose legs hide behind the canvas, a half-painted landscape, a clip and a rag;
  a kidney palette with eight dabs and two brushes; a watercolour tin with wells and worn pans; a
  jar of four brush shapes with a palette knife; a pencil cup with hex pencils, a brush and a
  ruler; a pen tablet with a profile sketch, layers and a stylus; paint tubes, one squeezed; a
  twelve-segment colour wheel with both triangles and a pointer.
- **Ride:** a helmet with visor, pivots, vents, spoiler, chin grille and D-ring; gloves with
  knuckle guards and stitching; boots with buckles, shin plate, ankle disc and tread; a road to a
  vanishing point with posts, a sign, mountains and a rider; mountains with two ridges, couloirs,
  pines and a winding road; a diamond road sign with a plate; a jerry can with three handles,
  spout chain and level marks.
- **Play:** a curved ultrawide with a first-person view and HUD (crosshair, health, ammo, minimap,
  kill feed); a mouse with a ridged wheel, side buttons and RGB ring; a headset with sliders,
  cushions, a boom mic; a gamepad with gated sticks, D-pad arrows, glyph buttons, a touchpad and
  triggers; a keyboard with lit W A S D, an underglow strip and a knob; a trophy with laurels and
  a plaque; a glass-side tower with three fans, cooler, RAM, GPU and PSU shroud; an energy can
  with a bolt, bands, drops and a straw.

**Performance.** Point counts went from ~1 000 to ~2 500–3 500 per world. The first measure on a
393 × 852 touch viewport dropped a band's draw from 61 to 17–20 fps: `strokeObject` stroked every
polyline on its own under the shadow blur. It now builds one path and strokes once per object;
the same bands measure 51 / 59 / 57 fps (engineer / trader / gamer) against 61 at the hero.

**Dev note:** a preview sheet in the scratchpad (plain-script build of the file, one canvas per
object with its stroke and point counts) made each world a two-second visual check.

**Admin knobs (16-admin-console):** the drawings themselves are code (SVG-like polylines); an
admin upload of a world's drawing set as JSON is the later Phase C item already listed.

## 2026-11-07 — Round H (part 2a): the hub drives the early tap, Top/End marks, the HUD in three columns, both fold on scroll, the sound cycles, `/` is the hub, the stage fits its model, Art and Play whole on phones

Ratul's list, discussed and agreed:

- **Art and Play smaller on phones: root cause.** The chapter's text box (`relative max-w-2xl`) is a
  flex item with no width, so it shrank to its content: measured at 393 px the six boxes were
  `361, 361, 361, 284, 361, 260` (Artist and Gamer carry the shortest words). The drawing band and
  the in-flow display slot inherit that width. Fix: `w-full` on the box. Now `361 × 6`.
- **An early tap scrolls itself.** `enterWorld` before `portalAnchor.formed` sets `waiting` *and*
  calls `jump(slug)`; the waiting poll waits for the auto-scroll to arrive (|c − chapter| < 0.15)
  before "scrolled away" can cancel it. Measured on a touch viewport: tap at the hero → scroll
  lands at Art 1.4 s later → anchor forms → dive at 5.5 s.
- **Navigation.** The rail carries `▲ Top` and `▼ End` on every size (words from `lg`, arrows
  below). The HUD is three columns on desktop — Move, Jump, Worlds — with column heads. Both open
  with the page and **fold to a strip on the first scroll** (and again after any reopen, Ratul's
  call): the rail folds to its dots + Top/End (tap the dots to open), the HUD to its action strip
  `Top · End · ♪ scene · Guide` (tap Guide to open). The action strip never leaves.
- **Sound on phones cycles.** The HUD's `♪` row steps Off → Ambient → Night wind → Rain → Deep hum
  and shows the scene's name. Desktop keeps the header menu.
- **`/` is the hub.** `app/page.tsx` redirects to `/whoami` (path-style hosts: previews, localhost);
  the real domain already rewrote `/` to the hub.
- **The page stage fits its model.** `world-stage-3d` measures the setup's world-space bounds every
  250 ms (every mesh but the screens' `halo` sheet, now named), projects the eight corners and eases
  the camera distance so the furthest corner sits at 0.82 of the frame; the camera looks at the
  measured centre. Measured on the Engineer stage at 393 × 852 (aspect 0.92): before, the laptop's
  NDC y ran `−1.34 … −0.23` (the base below the frame); after, `−0.57 … 0.43`, whole and centred.

**Dev note:** the Chrome DevTools MCP did every check here (phone + desktop) in seconds; no Playwright.

**Admin knobs (16-admin-console):** fold-on-scroll on/off and threshold (40 px), the sound cycle
order, the stage fit margin (0.82), the Top/End marks.

**Next in this round:** every drawn object redrawn in detail (48 objects, world by world).

## 2026-11-07 — Round H (part 1d): phone HUD carries the sound, no drag row, no text selection, the rail on phones, the doorway waits for the fully formed setup

Ratul's phone notes (Vivo X200 Pro, Chrome):

- **Sound on phones lives in the HUD only.** The header's compact toggle and the footer toggle are
  gone below `sm`; the touch HUD has a `Sound · On/Off` row (`.hub-hud-sound`, off ↔ ambient).
  Desktop keeps the header menu.
- **No "Drag · Look around" on touch.** A finger moving was already a scroll (the pointer code
  drops the drag on touch); the HUD no longer promises it.
- **Holding to slow time no longer selects the words.** `@media (pointer: coarse) .hub-v3 { user-select: none }`.
- **The spectrum rail shows on every size.** Marks only below `lg` (the role label is `max-lg:hidden`),
  `right-3` on phones, `right-5` from `lg`.
- **The doorway waits for the perfect moment.** `portalAnchor.formed` (gather ≥ 0.985 and the
  screen's power > 0.95) is now the condition: a tap before that puts the button in `is-waiting`
  and the dive starts the moment the setup is whole. Measured on a touch viewport: tap 150 ms after
  jumping to Art → waiting 3.1 s → dive with `formed=true`. The wait is forgotten if you scroll away
  (|c − chapter| > 0.45); the plain-fade fallback only fires after 15 s (a model that never came).

**Dev domain (Ratul):** no custom `dev.` host. Previews stay on Vercel's own branch URL with Vercel
Authentication; the noindex header and robots rule from part 1c still apply there. The Preview
`NEXT_PUBLIC_ROOT_DOMAIN` advice from part 1c is withdrawn (path URLs on the preview host).

**Dev note:** Playwright's `run_code` hung twice for its full 30-minute idle window around a page
that navigated mid-script; the Chrome DevTools MCP (`emulate 412x915x2,mobile,touch`) did the same
checks in seconds. Prefer it for touch runs that cross a navigation.

**Admin knobs (16-admin-console):** the HUD's sound row on/off, the formed thresholds, the
scroll-away tolerance.

## 2026-11-07 — Round H (part 1c): the phone's return and loader fixed, the early tap, bands for every world, the setup below the words, previews closed

From Ratul's screen recording (Vivo X200 Pro, Chrome) and a Playwright reproduction on a 412×915 touch viewport:

- **The strip under the world's loader.** Chrome on Android sizes a fixed `inset: 0` box to the
  viewport with the address bar showing; you arrive with the bar hidden after scrolling the hub,
  so a bar-high strip of the page showed under the loader. Every full-screen cover (`.world-boot`,
  `.hub-boot`, `.hub-enter`, `.hub-return`, the returning gate `.hub-wait`, `.vr-flash`,
  `.vr-blink`, `.gate`) is now `min-height: 100lvh`.
- **The broken return.** The landing, not the transition: the browser restored its own scroll
  while the hub scrolled to the chapter's middle before the chapter had its final height, so the
  camera stood past the setup's station and the setup appeared up and over the words. The hub now
  sets `history.scrollRestoration = "manual"` while it is up, and `land` re-aligns the scroll to
  the chapter's centre at 0 / 120 / 300 / 600 / 1000 / 1600 ms, snapping `c` to the chapter each
  time. Reproduced before (h2 at 102 → 497 px after the return) and after (102 → 102).
- **Tapping before the setup has formed.** `portalAnchor` now carries its world's slug.
  `enterWorld` starts the dive only when the anchor is this world's; otherwise the button goes
  into `is-waiting` (arrow breathing, `aria-busy`) and polls every 80 ms; when the anchor arrives
  the dive runs, and after `WAIT_FOR_SETUP_MS` (2.2 s) with nothing it clears the anchor and goes
  as the plain fade into the world's window instead of diving at a stale or missing screen.
- **Drawings popping / Art and Play looking small.** The journey drew only the nearest-by-scroll
  world; on phones the band sits at the top of a chapter almost two screens tall, so it stayed
  blank until the scroll crossed the chapter midpoint and then appeared half-formed. Now every
  world whose band is on screen draws, each from its own band; the ring (desktop, sideways phone)
  is unchanged. Artist and Gamer verified whole.
- **Immersive on phones: words first, setup below.** Ratul's call, mirroring Normal mode. The
  chapter is `align-items: flex-start; padding-top: calc(12.5svh + 4.5rem)`; `vr/assembly` lifts
  the setup down (`-0.58` of the half view height) so it stands in the lower band under the CTA.
- **Previews closed to crawlers.** `proxy.ts` sets `X-Robots-Tag: noindex, nofollow` and
  `app/robots.ts` disallows everything when `VERCEL_ENV === "preview"`; production allows all but
  `/capture/` and `/api/`.

**Dev domain decision (Ratul, DNS at Cloudflare):** `dev.ratulroy.me` + the six persona labels
under it, assigned to the `development` branch on Vercel, with Vercel Authentication on previews.
No code change needed beyond the above: set `NEXT_PUBLIC_ROOT_DOMAIN=dev.ratulroy.me` in the
Preview environment only (env vars are scoped per environment), so the host parser treats it as
the root there.

**Dev notes:** the second-return check stalled once on this machine because Supabase connect
timed out and the dev server's HMR socket dropped; not a code path. Deleting `.next` can leave a
transient `UNKNOWN open … routes.d.ts` on the first start; start again.

**Admin knobs this exposes (16-admin-console):** the doorway wait length, the phone setup lift,
the chapter's phone paddings.

**Open:** display inner type cramped below ~400 px (gamer "30 / 90" overlaps); art book and lens
gallery intros after admin Phase A; the offline arcade (several games) later.

## 2026-11-07 — Round H (part 1b): the HUD guide, phones read drawings → words → display

Ratul's corrections on part 1, same day:

- **The guide is a HUD, not a line + `?` card.** `hub-guide.tsx` now renders a fixed readout in the
  bottom-right corner with corner ticks: two columns of key → action (move: Scroll / Hold / Drag /
  Lens; jump: Space, ⇧Space, 1–6, Enter, F) and the six worlds numbered in their colours beneath.
  It never fades; it only leaves with the rest of the chrome (gate, intro, doorway). The `?` key,
  the card, the scrim and the auto-hide / idle timers are gone. Touch devices get the gestures only
  (Scroll, Hold, Drag, Tap display), tucked small.
- **Phones, Normal mode: drawings on top, words, display below.** Each chapter has a drawing band
  (`#<slug>-art`, `.normal-art-slot`, 1 : 0.92, max 44svh, centred) above the kicker, and the
  display slot moved below the CTA. `normal-journey` composes the eight drawn things in the band
  with a phone layout of their own (`PHONE_PLACES`: hero in the middle, the rest balanced left and
  right) instead of the desktop ring, which was left-heavy because its hero sits left of the display.
  The drawing follows the band: it draws as the band rises into view, undraws as it leaves at the
  top, no chapter-midpoint timing and no scroll parallax in the band. A phone on its side keeps the
  two-column layout; its band is hidden and the ring goes around the display as before.
- Verified with Playwright at 390×844 (touch context), 844×390, 1440×900 in both modes; no overflow.

**Admin knobs this exposes (16-admin-console):** the HUD rows' labels per mode, HUD on/off, the
phone composition's places and band ratio.

**Dev note:** Turbopack's persistent cache served the old `globals.css` across a restart this time;
stop the server, delete `.next`, start again.

**Open:** display inner type cramped below ~400 px (part 2); Vercel preview deploy for
`development` (Ratul asked; answer in chat: Hobby previews are free, path URLs on `*.vercel.app`).

## 2026-11-06 — Round H (part 1): footer pinned, the guide in the corner, ? card, F fullscreen, phone layouts, responsive sweep

Ratul's review of Round G (all good design-wise): the copyright should sit at the bottom (desktop and phone); the site must be responsive to any screen; the navigation guide should live in a corner, not under the title; F for fullscreen; on phones the Normal-mode display should not cover the drawings — put it in the flow — and the Immersive setup should be framed against the content. Agreed list for later parts: PWA + offline game + error pages, admin Phase A, sound, live data, gyro, the art screen.

**What landed:**
- hub-experience.tsx: the closing section is `min-h-[100svh]` with the content on `my-auto` and the footer (`.hub-footer`) last, so the copyright line sits on the bottom edge plus the safe-area inset at every size (verified 0 px gap at 9 viewports). The hero's hint line is gone.
- hub-guide.tsx (new): one line bottom-right ("Scroll to climb · drag to look · hold to slow time" / "Scroll to follow the light") with a `?` button. It fades after the first scroll, drag or key, or after 9 s, and returns after 14 s idle. `?` toggles the shortcuts card (scroll, hold, drag, lens, Space / Shift+Space, 1–6, Enter, F, ?) with the six worlds numbered in their colours; Escape or a click outside closes it. `F` toggles the fullscreen API where it exists (desktop, Android — iPhones have none, so the row and button hide). Touch devices get the gesture list instead.
- Phones and tablets (< 1024 px), Normal mode: `PersonaChapter` renders a `normal-display-slot` above its kicker; `NormalDisplays` portals the active display into it (`is-inflow`), so the window scrolls with the words and never covers the drawing or the text. The journey measures the slot's rect each frame for the constellation's home instead of re-deriving the CSS; on portrait, objects under the display (y > 0.45) or far above it (y < −0.5, the header) are skipped and x is spread ×0.8. The old `padding-top: 30vh` hack is gone. A phone on its side (height ≤ 540) lays the chapter out as two columns, display beside the words.
- Portrait, Immersive: the chapter's words sit low (`align-items: flex-end; padding-bottom: 14svh`) and `useAssembly` places the setup where the lens puts it ~27 % from the top (`lift = fwd · tan(fov/2) · 0.46`), so every world stands in the clear band above its words on any phone (verified: engineer centre at y = 228 of 844, title at 479).
- globals.css: `html:has(.hub-v3), body:has(.hub-v3) { background: var(--void) }` — no light flash behind the hub while it loads (the body's default is the light theme token).
- Responsive sweep (Playwright, 360×740, 430×932, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080, 2560×1440, 3440×1440 — hero, chapter, Normal chapter, ending): no horizontal overflow anywhere, footer on the edge everywhere. Open item from the sweep: the display's inner type is cramped below ~400 px (the gamer window's title truncates) — the exit sequences need container-relative type; part 2.

**Admin knobs this adds** (16-admin-console.md → Hub): guide text per mode, auto-hide / idle-return timings, the card on/off, F on/off.

**Dev notes:** this Turbopack dev server does not pick up `globals.css` edits until restart (TSX hot-reloads fine); `rm -rf .next/dev` while a server runs corrupts the cache (every route 404s) — stop the server, delete `.next`, start again. Supabase reads from this network time out now and then ("content read past 9000 ms"); the hub then renders without chapters — reload.

---

## 2026-11-06 — Round G: seated fly-in, READY · TO · RACE, keys in Normal mode, no scrollbar, admin plan

Ratul's review of Round F from production (PR #2 merged, ratulroy.me live): the rider fly-in went to a top view, not the rider's seat; the other worlds' flights ended behind the laptop or above the desk; the boot logo was a mess (reference video of his TFT supplied); number/Space keys dead in Normal mode; no scrollbar wanted; the real bike should stand alone (no boxes, no ball); everything must become admin-configurable.

**What landed (commits `da67081` and this one):**
- assembly.tsx: each world declares `view: { back, up }` — where its owner sits, in the first screen's frame; the eye goes into `portalAnchor` (`ex ey ez`). Distances scale with each screen: laptop 2.8, monitors 1.9 / 2.7, camera LCD 1.4, canvas 2.1, dash 1.6 with the eye 0.3 below the dash's normal (the rider's head over the tank).
- scene.tsx: the fly-in is three beats — swing round the setup's centre to the eye (0–52 %), hold seated with the screen in view, dive into the glass (66–100 %); the head turns onto the setup ahead of the body so nothing slides out of frame; the lens tightens only on the dive. `PORTAL_LENGTH` 2.1 s, `PORTAL_OUT_LENGTH` 1.5 s (reverse). Verified seated frames for all six worlds (laptop front at the desk, monitor front, LCD in hand, easel, rider's seat with bars and dash, gaming desk).
- exit-sequence-worlds.tsx `DashExit`: the boot is Ratul's TFT — READY · TO · RACE a word at a time in the world colour, then the gauge arc sweeps as the digits run 253 → 0, cut to the dash, self-test (888, every tell-tale, rev sweep), the drive. Verified on a screen recording of the hub → ride page flow.
- hub-experience.tsx: Space / Shift+Space / 1–6 / Enter work in Normal mode too (the handler was gated on the climb phase; Normal mode never leaves "gate"). Enter takes Normal mode's own doorway. Verified: 3 → chapter 3, Space → next, Shift+Space → back.
- globals.css: no scrollbar anywhere (`scrollbar-width: none` + the WebKit rule); the page still scrolls. Verified: client width = inner width.
- ride.tsx: with the real model, nothing but the bike, its light and its dash (helmet, tank bag, pannier, gloves, intercom were the box, side box and ball Ratul saw).
- normal-journey.tsx: on phones nothing draws above the display (the header) — objects with y < −0.4 skipped in portrait.
- docs/claude-planning/16-admin-console.md: the standing contract that every value is admin-editable, the recommended configuration surface (identity, personas, hub, Normal mode, sound uploads, pages, media library, switches, theme), the build (settings store + history + Storage buckets + Zod-typed reads + `/admin` growing out of `/capture/admin`) and phases A–E.

**Supabase:** all six personas `is_published = true` (Ratul ran the UPDATE).

**Dev note:** a hung `next dev` on :3000 (two days old) blocked testing until the session restart freed the port; the dev server needs `NODE_OPTIONS=--use-system-ca` in this shell or every Supabase read fails TLS and the hub has no chapters.

## 2026-11-06 — Round F: orbiting fly-in, key-on dash, 48 drawings, the world pages' stage, all six by default

Ratul's review of the constellation pass: the camera reached the dash but the bike did not turn; the dash should boot the way a real TFT does when the key turns; the drawings should be detailed, drawn in place (no sliding), more of them but not cluttered, with his object lists per world; "pages go"; deploy; `preview=all` as default; rename the branch; is `via` needed.

**What landed (commits `27fa69e` and the pages commit after it):**
- scene.tsx: the fly-in is an orbit — the camera's direction from the setup's centre slerps round to the side the screen faces while the distance closes (over the tank and down onto the dash; round to the front of a monitor), the look held on the setup throughout; `PORTAL_LENGTH` 1.35 s, `PORTAL_OUT_LENGTH` 1.25 s so the swing reads. `portalAnchor` carries the setup's centre (`cx cy cz`).
- exit-sequence-worlds.tsx `DashExit`: key on → logo screen (ring draws, "R", "system check") → cut to the dash → self-test (tell-tales ABS · TC · N · ! · OIL · HI light in turn, "888" flash, rev sweep to the red line and back) → lamps out except N and ABS → the drive; N goes out on first gear, ABS once rolling. Tell-tales live in the window's bar.
- constellations.ts: 48 objects redrawn with detail (helpers `arc`, `rrect`, `bar`, `grid`, `keys`, `ticks`), eight per world at the same eight stations, from Ratul's lists: code laptop · terminal · monitors · earbuds · server · coffee · git branch · keyboard; trade candles · hourglass · clock · bitcoin · calculator · brain · dollars · journal; lens camera · thirds grid · golden ratio · lens · SD card · phone back (round camera island) · softbox · tripod; art easel · colour wheel · watercolours · tubes · pencil cup · palette · brush jar · tablet + stylus; ride bike (traced) · road sign · mountains · helmet · jerry can · gloves · boots · road; play monitor · trophy · PC tower · headset · mouse · gamepad · keyboard (WASD marked) · energy can. `strokeObject` lives here now (shared with the page stage). normal-journey.tsx draws each in place from its first point — the drift is gone.
- Hydration: poster and dash-tick geometry rounded to two decimals (Node and the browser disagree on a sine's last digit).
- whoami/page.tsx: every persona climbs by default (`?preview=published` restores the old gate); load-home-content.ts likewise lists all six for the pages; both fall back to the public list when the admin read is unavailable.
- world-boot.tsx strips `via` from the address bar once it has done its job. `via` stays a URL parameter because the worlds live on their own hosts (sessionStorage does not cross origins).
- **World pages' stage** (world-stage.tsx, world-stage-3d.tsx): a 46 svh band above every page's hero. Immersive: the hub's very assembly on its own R3F canvas — a local `VrContext` (clock at the chapter, state for the pointer), a camera standing in front of the setup where the climb's would (`PLACE` mirrors each world's hub offset), RoomEnvironment lighting, the pointer turns it, hover rims it. Normal: the world's hero drawing strokes itself in with a pen light, then breathes. persona-home-body.tsx mounts it for all six and gives artist / ride / gamer a page (hero + identity); home-hero.tsx types each persona's own points; identity-panel.tsx has an icon per persona.
- home-page.tsx: on a persona's own host the path is `/`, so the provider could not read the persona from the route and the page waited forever — the page now hands `routePersona` over.

**Verified (Playwright, dev):** fly-in frame at 200 ms is a top view over the tank, then the dash; the dash boots logo → self-test → first gear at 55 km/h; constellations on engineer and ride, ring clear of the header and rail; engineer page stage in both modes; ride page stage with the bike model and the traced drawing; ride page server HTML carries the real persona copy.

**Not done:** publishing artist / ride / gamer in Supabase (the tool's permission classifier refused the UPDATE; one SQL for Ratul in the reply).

## 2026-11-05 — Normal mode constellations; dash seated; content reads resilient

Ratul's brief for Normal mode: keep the display as the centrepiece, draw the world's things *around* it (not under it), in one stroke language for every world; drawing in as you scroll into the chapter, complete at its midpoint, undrawing in reverse on the way out. Built: `constellations.ts` (32 hand-drawn objects + the traced bike, each placed in display-widths around the display with a depth), drawn by `normal-journey.tsx` with per-object stagger, a drift in along the light's direction, depth parallax, the pen light at each stroke head; the display's place is derived from the same CSS the DOM uses. Portrait keeps the objects above the display. The old single-icon table is gone. Also: the TFT dash seated on the top yoke from model measurements (facing up/back 40°), the dash loader as a small drivetrain, the boot script via next/script, public content listings resilient (deadline + last-good), the returning screen's ring. Commits `36eb170`, `d64765d`, and this one.

## 2026-11-05 — Round E feedback pass: dash on the bike, Space centring, return robustness, Normal mode as light

Ratul's second review of Round E. Changes: (1) no separate panel for the rider — the TFT dash is on the bike at the headstock, tilted to the rider; the fly-in comes down onto it (top view) and fills the screen. (2) Space / Shift+Space pick the next or previous chapter from the current scroll position and glide so the chapter is centred (it was aligning section tops and reading a lagging `active`, which skipped chapters). (3) Back to the hub was inconsistent: a page restored from the browser cache reset the portal without the pull-out, and left the world's session key behind so a reload replayed the return. The cache path now plays the pull-out and spends the key; the return flare is cleared outright on cleanup (a stalled clock had left the screen washed in the world's colour). (4) Every finished window glows in its world's colour, not only the trader's. (5) "Gathering light" → a thin ring that fills, with the number. (6) Normal mode: the fan is drawn as light — additive wedges fading along their length with soft edges, an apex glow where white becomes colour, a wide soft field along the lit band that the display stands on, 70 motes streaming outward (brighter near the lit band), fine additive persona bands; the hero sits closer (zoom 1.18 at rest); film grain over the backdrop; the display is larger (44 vw), slides in along the light, carries a floor reflection and a deep shadow. Commits `10f9c21` and (this).

## 2026-11-05 — Round E (Ratul: "lets do it all"): doorways, keys, sound menu, six displays, Normal mode rebuilt

Ratul's calls, all accepted: the hub's exit ends at the filled screen and the page carries the loader on; the whole object is the doorway and pops; the chapter button takes the same doorway; Space / Shift+Space / 1–6 / Enter on the climb; the cursor family (grab / grabbing / pointer + the ring's enter mark); the music dock goes, Sound becomes a menu of synthesised soundscapes; `?xp=` as a shareable mode override; the rider's doorway is a TFT dash; the bike is traced from its real model; Normal mode is rebuilt around the six displays; the re-entry from a world is a pull-out with a flare. Domain: `ratulroy.me` live on Vercel (apex production, `www` and `who` 308 to it, six persona subdomains), Cloudflare DNS-only. CI: type-check + lint on every push (`.github/workflows/ci.yml`); first run caught one real lint error and two warnings, fixed.

**Commits:** `4b880fc` ci · `cdb8c4e` lint fixes · `ba6f35c` cut at the filled screen, whole-object doorway, keys, cursor, `?xp=` · `b980fde` chore(config) env · `76eae04` Sound menu + pull-out re-entry · `2d75075` dash / monitor / canvas sequences, traced bike · (this) Normal mode six displays.

**What landed:**
- `BootFrame` (exit-sequence.tsx): the very first frame of a world's sequence, still — the hub cuts to it the moment the camera has flown into the screen (`PORTAL_LENGTH + 90 ms`), and the page server-renders the same frame and plays on (`via=hub`). The old push-in and the hub-side sequence are gone.
- assembly.tsx: hover raycasts the whole setup (`intersectObject(g, true)`); `withRim` adds a fresnel emissive term to every lit material (`rim`, `rimColor` uniforms, no post pass); the setup scales 3.5 % under the pointer. CSS: `canvas { cursor: grab | grabbing | pointer }`, the ring squeezes while dragging and grows an enter chevron over a doorway.
- Keyboard on the climb: Space next world, Shift+Space previous (past the last → the ending), 1–9 → that world, Enter → the setup under the pointer or the chapter you stand at.
- `?xp=normal|immersive` (experience-provider.tsx): writes the cookie on the root domain, strips itself from the URL; the hub skips the gate for it.
- Sound (ambient-sound.ts `scene()`, experience.ts `SoundChoice`, experience-controls.tsx `SoundToggle` → a menu): Off / Ambient / Night wind (gusting band LFO) / Rain (thin high noise with a flutter, past the drone's filter) / Deep hum (drone up, filter down, a sub bed). Music files deleted: music-player.tsx, lib/site/music.ts, api/music/search; `JAMENDO_CLIENT_ID` dropped from the template (chore(config)).
- Pull-out re-entry: `outKick` widens the lens over the pull-out (scene.tsx); a flare in the world's colour and the lids opening (two frames after landing, so neither skips its start — the first attempt did, the GSAP clock was stale after the landing's long frame and the lids were not mounted yet).
- Three new sequences (exit-sequence-worlds.tsx, shared bits in exit-shared.tsx), each rendering `still="boot" | "final"` or playing: `DashExit` (rev sweep, speed 0→84, gear N→4, route trace with the rider's dot and pins), `MonitorExit` (power-on line, HUD from the corners, crosshair settles, ammo counts, radar sweeps, PRESS START blinks), `CanvasExit` (nine strokes in a palette around the hue — sky, hills, sun, water, a tree, the signature — with a brush light). The rider's 3D panel is `makeDashScreen` (speedo + route).
- `bike-lines.ts` (generated): 111 strokes traced from bike.glb — silhouette + crease edges in a side view, sign-agnostic facing (the model's windings are inconsistent), chained through junctions along the straightest path, closed loops simplified as two halves (the wheels vanished until that fix). Normal mode draws it.
- Normal mode (normal-displays.tsx): the chapter's display sits where the setup would stand (fixed, right, 40 vw; phones: top), comes on 700 ms after the chapter arrives, plays once, holds (`ExitFrame`); the canvas drawing recedes under it (`recedeRef`); hover pops it; click or the chapter button zooms (`is-zoom`) and opens the world with `via=normal`, where `WorldBoot` opens on the finished window and lifts (`is-finished`).

**Verified (Playwright, dev):** hover region over the whole laptop, cursor `pointer`, click → boot cover at 0.7–0.95 s → `code.…/?via=hub` → typing → gone; button → same; keys land on the right chapters; `?xp=normal` → no gate, canvas on, URL clean, cookie set; Sound menu → `xps=rain`; return from a world: flare 0.55→0 over ~1 s, lids 0→260 over ~0.9 s; ride / play / art direct visits play their sequences; Normal mode: terminal types in the display, trader and dash shown, click → zoom → `trade.…/?via=normal` → finished window → lifts.

**Open from Round E:** world pages' signature object hero (Immersive: the same 3D model; Normal: the line drawing) over identical content — next. Sound pass per world (ambience variants) still pending. Pre-launch list unchanged (publish flags, production build + Lighthouse, real phones).

## 2026-11-05 — Round D, third pass: loaders alive from the first paint, Normal mode drawings

**Ratul's check:** the world loaders "from the first frame" were not working for him. Measured on a fresh direct visit in dev: the server-rendered window arrived, then sat *empty* for ~4–5 s until the page's script hydrated and GSAP began (the chart body was deliberately `opacity: 0` in markup so the finished chart would not flash). The earlier timing report had been measured from hydration, not from navigation — my mistake. A reload also replayed nothing (once-per-session flag), which is how he tested.

**Fix (`exit-sequence.tsx`, `world-boot.tsx`, `globals.css`):**
- `ExitSequence` gets `boot`: a direct visit's window is alive in CSS alone until the script arrives — the bar's light wakes, the trader's grid lines draw themselves and a soft scan sweeps the body (`BootScreen`), the camera's focus box hunts and the live view breathes, the terminal's cursor waits lit. Each timeline ends the boot the moment it starts (the trader fades the boot layer over the chart).
- A **reload** replays the loader (`PerformanceNavigationTiming.type === "reload"`); moving around inside a world still does not.
- Verified: trade — boot grid mid-draw at 0.4 s, boot until hydration (~4 s in dev), candles, target, page gone at ~7.6 s. code — cursor at 0.5 s, typing from 4 s, 13 lines, gone at 8.5 s. lens — hunting focus until 4 s, then the metering sequence.
- Dev hydration is ~4 s on these pages (uncompressed dev bundles); production will be well under that, but the boot screen makes the wait a non-issue either way.

**Normal mode (`normal-journey.tsx`):** per Ratul — the bicycle is now a super bike (low fairing over the front wheel, tank, kicked-up tail, screen, forks, exhaust), the gamer's screen shows a crosshair with a first-person rifle, health and ammo marks, the easel carries a landscape (hills, horizon, sun, a cloud) with a brush. `strokeIcon` now returns the pen position so a bright point with a halo rides the head of the stroke while a setup draws; once lit, a soft glow sits under it and motes of its colour rise. Short dashes of light stream outward along the fan while the view follows the light, so the climb has motion as well as a turn.

**Jamendo:** Ratul registered a client id (`JAMENDO_CLIENT_ID` in `.env.local`); the search route returns real tracks. His ask: a premade playlist, and he is unsure whether music belongs at all → recommendation sent (see the reply): one **Sound** control with a few soundscapes + one curated CC playlist, retire the paste-a-link dock.

## Round D, second pass: Normal mode as a motion piece, the phone pass (2026-11-05)

- **Normal mode** (`hub/normal-journey.tsx`): "the headset stays off" is now the same
  story as a flat, scroll-driven 2D canvas, no WebGL — drawn in the still poster's own
  1600×900 space so it takes over from the SSR poster without a seam. Hero → through:
  the white ray falls onto the prism and the spectrum fans open. The climb: the view
  follows the light (zooms about the prism exit and **turns through the spectrum**, so
  each persona's colour comes round to point right in turn and washes the sky), panes
  drift past, and that persona's setup draws itself as line-work in its own light —
  one icon per world (laptop, desk, camera, easel, bike, tower), stroked in by
  nearness, glowing on its chapter, letting go after. The ending drains the colour to
  stars. Progress is the page's own `state.c`; reduced motion keeps the scroll-follow
  and drops the breathing; redraws pause when the tab is hidden; DPR capped at 1.5.
- **Phone pass.** Portrait screens: the setup now sits at the centre of the upper half
  (`frame.right × (1 − portrait)`, `up + 0.5·portrait`) instead of off the right edge,
  and the Director opens the lens (`FOV × (1 + 0.45·portrait)`) so the climb is not a
  keyhole. Header fits at 390 px: Music is icon-only and Sound is bars-only under `sm`
  (labels stay for screen readers), tighter gaps. Checked at 390×844: gate, engineer,
  photographer, Normal mode.
- Still open in round D: a sound-design pass (per-world ambience, lighter wind on the
  climb) and the Jamendo id (Ratul).

## Round D, first pass: the ending and the rewind, the music dock (2026-11-05)

Ratul: "go round D". Scope from `14-vr-journey-concept.md`: ending (fade, empty sky,
"Take off your headset", reverse rewind), Normal mode, phone tuning, sound design,
console credits (done in the fifth pass). This pass: the ending and the music.

- **Ending.** Past the last world (`lastWorld.c + 0.45` → the end section) `k.ending`
  rises: the beams close (`k.cone = 1 − ending`), the sky tint and the slab field fade
  with it, and the head tilts back up into the empty night sky (pitch → 1.22 rad).
  Under the closing copy, one quiet mono line with a breathing ring: **Take off your
  headset** (immersive only).
- **Rewind.** Click it: `state.rewind = {at, from}`; the Director dives `L.c` from
  `from` to 0 over `REWIND_LENGTH` 1.5 s (`1 − u²`), rushing (`k.speed`), looking back
  down the climb; the lids close over the last 640 ms (the eye mounts open — `rx` is
  render-time 260 while closing — then runs shut in 400 ms, blur returning), the phase
  returns to `gate` with the headset screen while shut, then the eyes open onto it
  over 900 ms: the start again. Sound: `ambient.rewind()` — the drone pitches down
  like a tape stop, a whoosh falls through the rising wind, then silence. One lids
  runner (`runLids(dir, len, delay, onEnd)`) now drives the intro's opening too.
  Measured: lids mount 1.14 s, shut 1.57 s, gate 1.65 s, open again 2.03–2.84 s.
- **Music dock.** Top bar: *Music* (next to Sound). A small glass dock bottom-right:
  paste a YouTube or SoundCloud link (plays in that service's own visible player —
  their terms — driven by postMessage for pause/play) or search Jamendo (CC, free,
  no ads; each track links back to Jamendo as its API terms 4.1 require; our
  `/api/music/search` route holds `JAMENDO_CLIENT_ID` server-side, caches 5 min).
  One source at a time; the ambient drone **ducks** to 22 % under music
  (`ambient.duck`). The last source is remembered in `localStorage` but never
  auto-plays: a "Play the link you left" tile waits for a tap. Links verified
  (iframe mounts, state persists). **Jamendo search is unverified:** Jamendo's public
  test id is suspended on their side, so the route reports "not set up" until Ratul
  registers a free client id (devportal.jamendo.com) and sets `JAMENDO_CLIENT_ID`.
- Pending in round D: Normal mode as a real scroll-driven motion piece, the phone
  pass, sound polish.

## Round C feedback, fifth pass: real bike, loaders from frame one, console credits (2026-11-05)

Ratul's answers to the fourth pass: pass-through "more or less resolved"; bring a
real bike and credit it in the console (personal, non-commercial site — his call);
the world loader must be the *sequence* from its first frame, not the finished frame.

- **Real bike.** The Kawasaki he liked is Sketchfab "Free Standard" (not CC), 335 k
  faces and login-gated — unusable. Poly Pizza downloads without login; its bikes
  are CC-BY 3.0. Chose "Motorcycle" by Poly by Google (a proper sport bike, 6.4 k
  triangles, 110 KB, `static.poly.pizza/<uuid>.glb`) → `public/hub/models/bike.glb`.
  It is a single mesh with one palette texture and no material names or normals, so
  `BikeModel` now **splits the geometry by the colour under each triangle** (paint →
  shell, grey → metal, dark → matte; white paint → shell so the body reads as one),
  unwelds and computes flat normals (without them our lit materials shaded it flat
  grey), fits it to 2.7 units and turns it to face its headlight beam (−π/2: the
  model's front is −z). Name heuristics remain for models with named materials.
- **Credits in the console.** `lib/site/credits.ts` prints a collapsed `credits`
  group once on the hub's first mount (bike · logos · fonts). Record of record:
  `15-credits.md`; `public/hub/models/README.md` now says CC0 or CC-BY.
- **Loaders from frame one.** `WorldBoot` on a direct visit renders `ExitSequence`
  itself (server-rendered start state: empty terminal, bare chart) and lifts when it
  ends or is skipped; through the hub and on repeat visits it is still the finished
  `ExitFrame`. The trade chart's body starts `opacity: 0` in the markup (`data-body`,
  released by the timeline) so the finished chart cannot flash before hydration.
  Verified: trade direct visit shows the bare window at 0.3 s, candles by 3 s,
  target hit at 4.5 s, page by 6.5 s.
- Dev-only note: the hub returned one transient 500 during testing with a
  Supabase-shaped error body — the pre-launch "fetch timeout / fallback" item stands.

## Round C feedback, fourth pass: no two setups at once, panes out of the lane, world loaders (2026-11-05)

- **Pass-through, root cause:** two setups shared the same volume — the one leaving (|d| up to 1.0)
  and the next arriving both rode in front of the camera between chapters, and large flat parts
  (desk, lid, base) crossed. Now a setup exists only over **|d| < 0.52** (presence 0.36 → 0.52,
  gather 0.5 → 0.16, lock 0.22 → 0.08), so with chapters one section apart the leaving one is gone
  before the next appears. Arriving setups come in low-right, leaving ones drift up-left. Loose
  spread is wider (2.8 / 3.0, box ±3.2 × 2.0 × 1.8) and tumble is under half a turn (0.5), so big
  parts keep clear while converging on radial paths. Not a collision solver: rare touches remain.
- **Panes out of the lane:** while a setup gathers (c₀ − 0.6 … c₀ + 0.25) its panes keep to the left
  (75 %) or far right (≥ 4.6 out); plus a 4.2-unit exclusion around the setup's spot.
- **World loader on direct visits:** `WorldBoot` now opens every world page on its own window
  (terminal / trade screen / viewfinder) — rising into place, holding 0.9 s, lifting with a zoom —
  once per world per session; via the hub it is the continued zoom as before.
- **Bike:** the Kawasaki ZX-6R on Sketchfab is "Free Standard" (not CC), 335 k faces, and needs a
  Sketchfab/Epic login to download — not usable. Sketchfab downloads always need that login. Poly
  Pizza downloads without login but its bikes are CC-BY 3.0, which needs attribution — a `/credits`
  page linked from the footer would satisfy it (reasonable to the medium) if Ratul relaxes the
  console-only rule. Decision pending.
- Verified (window in front): key cloud → closed laptop → lit at c = 1.6 / 1.75 / 1.9; laptop base
  leaving at 2.4 while the trader's first monitor arrives small and far at 2.6; desk lit at 2.85;
  `code.` direct visit opens on the terminal frame (`world-boot is-direct`).

---

## Round C feedback, third pass: no pops, one-piece blink, radial paths, less spin, zoom in, bike model path (2026-11-04)

Ratul's six notes:
1. **Nothing pops.** A setup is present over |d| < 1.0 with `presence = 1 − smoothstep(|d|, 0.72, 1.0)`:
   it scales from 5 % and hangs up to 6 units further ahead while far, coming up to arm's length as
   it gathers, and shrinks away the same way past the chapter. Loose parts are 55 % size.
2. **The blink is one motion.** The eyelid ellipse grows in a single ease (width leads, height follows:
   `rx = 260·u^0.75`, `ry = 260·u^1.6`) with the blur released from the same `u`, driven by a plain
   animation frame that outlives the phase change (the old version was two tweens + a timed
   removal + a CSS blur transition = three visible steps, and its overlay could miss its mount when
   the 1 s timer lost the race to the phase change under load — it mounts with the phase now).
   Found while measuring: the Playwright window runs at 1 fps when occluded; bring it to front
   before timing anything.
3. **Bike:** no CC0 superbike found (Poly Pizza and Sketchfab sport bikes are CC-BY; the Sketchfab
   search API's licence filter returned nothing). The scene now takes a model: drop a CC0 `bike.glb`
   in `public/hub/models/` (README there), `scripts/hub-media.mjs` lists it under `models`, and
   `RideAssembly` loads it with `useGLTF`, re-skins by material name (tyre → matte, glass/light →
   glow, chrome/exhaust → metal, else shell), fits it to 2.7 long with wheels on y = −0.46, keeps
   the kit and the route panel around it. The stylised bike stays as the fallback.
4. **Parts no longer cross:** loose positions lie out along the ray from the setup's centre through
   each part's home (plus jitter, clamped to the view), so every part converges radially.
5. **Spin:** tumble under one turn (spin 0.9, drift 0.06/0.05 per second); camera revolve 0.18.
6. **Zoom in:** the finished window pushes in to 1.3× over 0.32 s before the page leaves; the world
   page's frame starts at 1.3× and keeps zooming to 1.9× while it dissolves.
- Verified (window in front): eye opens continuously 0 → 260 across blink into sky; cloud → laptop
  → lit at c = 1.3 / 1.55 / 1.8 in frame; trader converging at 2.6, lit at 2.8.

---

## Round C feedback, second pass: entropy in frame, doorway timing both ways, blink, bike (2026-11-04)

Ratul's notes (seven points + drag + résumé for the terminal), all in:
- **Entropy in frame** (`assembly.tsx`): while loose, the whole setup rides in front of the camera
  wherever it is on the climb (`cEff` follows `k.climb`), the parts a cloud around it (±2.6 across,
  ±1.6 up) inside the view; it locks onto its world spot only when the chapter is close
  (`lock = 1 − smoothstep(|d|, 0.08, 0.2)`) and loosens again, still in view, past it. Locking by the
  gather curve put the spot (sections further along the helix) out of frame — seen at c = 1.65.
- **Doorway out:** the flight is 0.8 s (`PORTAL_LENGTH`), the cover rises in its last 0.3 s, and every
  sequence waits `delay` = the flight before it starts, so nothing types before the screen fills.
  The page leaves when the sequence ends. The world page opens on the **same finished window**
  (`ExitFrame` inside `WorldBoot`, via `?via=hub`), which zooms in and dissolves — one motion
  across two hosts. Without `via=hub` the cover is the small light.
- **Doorway in** (back to the hub): `state.portalOut` — the camera starts inside the screen you left
  and pulls out over 1.1 s (`PORTAL_OUT_LENGTH`); that setup is lit at once; the finished window
  shrinks away over the scene (`.hub-return`). Landing already scrolled to that chapter.
- **Blink:** feathered lids (radial-gradient ellipse in the mask, 45 % soft) and the scene starts
  blurred and pulls into focus (`html.is-focusing` → canvas `filter: blur(14px)` → 0 over 1.4 s).
- **Camera:** revolves slowly with the lens toward you while loose, turns to present the display
  (three-quarter) as it opens.
- **Photo exit:** a real live view when `public/hub/photographer/` has a photo — soft and blown out,
  pulling sharp and settling (blur 18 → 0, brightness 1.9 → 1) while the bracket hunts and locks and
  the settings tick to 400 · 1/250 · f/2.8; then the shutter. Without photos: the abstract light.
- **Terminal:** `whoami`, `cat stack`, `uptime` from the résumé (2 years in production, 200+ users on
  the last rebuild, 11 automations), `git log --oneline -1` = the real build commit
  (`NEXT_PUBLIC_COMMIT` from `next.config.ts`: Vercel's env on deploys, git locally), `ls /engineer`
  of published entries, `open royal-programmer`. Faster keys (13–31 ms). Dry, true, no fake output.
- **Drag** is first-person now: drag right → look right.
- **Bike:** no CC0 superbike exists (Poly Pizza's are CC-BY 3.0, Sketchfab's sport bikes CC-BY), so
  it is a stylised sport bike in code — fairing, nose, tank, seat hump, belly pan, twin exhausts,
  clip-ons, five-spoke wheels — with the kit: helmet with visor, tank bag, pannier, gloves, intercom.
- **Artist:** a sheet lands on the canvas (late part) before the strokes paint in.
- Verified: cloud → laptop → lit at c = 1.5 / 1.7 / 1.85, all in frame; exit cover rises after the
  flight, terminal types, code page opens on the finished terminal; return lands on the chapter.
- Media: no limit; 16 per persona per visit, random pick; keep files ≲ 2 MB.

---

## Doorway sequences, dark world covers, media manifest (2026-11-04)

Ratul's notes on the switch (slow, thin, wants typing / a chart playing out / a shutter):
- **The slow part is dev.** First visit to a route compiles it (26–78 s seen in the dev log, 1–3 s
  after; production < 1 s). Two fixes regardless: hovering a lit screen **warms** that world
  (`fetch` no-cors via `onPortalHover` from the Director), and the page now leaves **the moment the
  sequence ends** — no timer (`leaveForWorld` is the sequence's `onDone`).
- **`hub/exit-sequence.tsx`** — one window per world, ≈70 % of the view, skippable by click/key,
  skipped under reduced motion:
  · engineer: a terminal (title bar, `ssh ratul@code.<root>`, resolve, authenticate, `cd && ls`
    of the published engineer entry slugs from the content store, `open royal-programmer`), typed
    character by character with synthesized key clicks (`ambient.key()`), ~2.5 s;
  · trader: a trading screen assembles (header, plan list, grid), 34 candles draw, entry / stop −1 R /
    target +3 R lines appear, six candles run into the target, tick + glow (`ambient.target()`), ~2.7 s;
  · photographer: the display — thirds grid, focus bracket hunts and locks (`ambient.lock()`), ISO /
    shutter / aperture tick to 400 · 1/250 · f/2.8, shutter (`ambient.shutter()`: three clicks and a
    thump) with a black blink and a white frame, ~1.8 s;
  · other worlds: the small light (their sequences come with their worlds).
- **World pages open dark** (`components/world-boot.tsx`, server-rendered in `[persona]/page.tsx`):
  a void cover with a light in the persona's accent, lifting at 160 ms — no white flash after the
  sequence. The world redesign will own what comes after.
- **Media manifest** (`scripts/hub-media.mjs`, runs on `predev` / `prebuild` and `npm run hub:media`):
  lists `public/hub/<persona>/*.{jpg,png,webp,avif}` into `public/hub/media.json`. The scene reads
  it; engineer screenshots become panes (16:10) and the first sits on the laptop; photographer
  photos become panes (3:2) and the drawn frames step back. Up to 16 per persona per atlas, served
  via `/_next/image` at 640 px (laptop 1080 px) — any file size is fine for the scene.
- Lesson: `gsap.from` + React dev double-mount leaves targets parked at the from-value (`tl.kill()`
  does not revert). Always `gsap.context(() => …, el)` and `ctx.revert()` in cleanup.
- **All six personas are launched in code** (`LaunchedPersona` = every slug; fixtures publish artist,
  ride, gamer): each has a world page on the shared template and a stretch on the climb. On the hub
  they still follow `is_published` in Supabase, which stays false for the three until this branch
  is on `main` (production runs old code where their pages 404). Dev-only `?preview=all` shows
  them now; `proxy.ts` keeps the query across the hub rewrite. Verified at c = 5 / 6 / 7: easel
  with strokes, bike with beam and route panel, gamer desk booting to the handle.
- Verified: all three doorways → `code.` / `trade.` / `lens.ratulroy.localhost:3000`, arrival shows
  the dark cover; no page errors. Pre-existing and not from this work: the lint error in
  `persona-motion-slots.tsx` (setState in effect) and a hydration warning inside `RefractionPoster`
  (the Normal-mode poster) with six bands.

---

## Round C: every persona's assembly, on one pattern (2026-11-04)

- **`vr/assembly.tsx` — the shared machinery.** `useAssembly({ world, root, screens, homes, offset,
  screenMats, onFrame })` owns the anchor (ahead of the camera's pose at the section, aspect-aware),
  the loose parts' scatter positions (half a section before / after), the gather curve, the power
  ramp, the hover raycast against the screen meshes, the portal anchor for the Director's fly-in,
  and the halo / bezel light. Each world builds its own meshes and places them in `onFrame` through
  `place(obj, i, late)`. Parts shrink to 30 % while loose and the whole setup is hidden beyond
  |c − c₀| ≥ 0.92, so nothing lingers into the next chapter. `makeScreenMaterial(tex, t, mode)`:
  mode 0 boot line · 1 drawn left→right · 2 painted in stroke order (order in alpha).
- **Worlds (`vr/worlds/`):** engineer (laptop, moved), trader (desk, two monitors on stands,
  keyboard, mouse; charts draw themselves in), photographer (body, grip, prism housing, shutter
  button; the lens arrives in front of the mount and screws on; the back display wakes with the
  viewfinder readout; the page blinks the shutter on entry), artist (three legs, tray, canvas;
  strokes paint in one by one), ride (frame of tubes, two wheels that turn, bars, seat, headlight
  that comes on with a beam; a route panel beside it draws a glowing line with light pins — the
  doorway), gamer (desk, tower with RGB strips, ultrawide + side monitor, keyboard with underglow,
  mouse; the monitor boots to the handle, RGB cycles the spectrum).
- **Panes per persona** (`screens-worlds.ts`): trader charts; photographer viewfinder frames and
  readouts; artist stroke clusters and dabs; ride route snippets, speedo dials and compass / unit
  glyphs; gamer HUD pieces (crosshair, minimap, bars, ammo) and the words of the game (GG, ACE,
  1v3…). No invented records: percentages, settings, lines, terms.
- **Registry:** `field.tsx` maps slug → world; a persona's stretch appears the moment it is
  published (artist, ride, gamer are built and unexercised in the browser until then — they share
  the hook and type-check, but have not been seen).
- **Also:** the code world's exit is a three-line terminal boot with a block cursor (other worlds
  keep the small light); coming back from a world lands on that world's section (`xp-world` in
  sessionStorage); `public/hub/engineer/README.md` says what to drop there.
- Verified (Intel UHD, Performance): engineer, trader and photographer stretches at c = 2 / 3 / 4,
  hover on the camera's display → `portalHover: photographer`; no page errors. The dev console's
  "Router action dispatched before initialization" is Next's Fast Refresh, not ours.
- Open: Ratul's screenshots/photos for the screens; music player source decision; round D.

---

## Round B feedback, first pass (2026-11-04)

Ratul's notes on f402f2b, addressed:
1. **Field per persona.** Panes carry their place on the climb (`aC`) and fade by it as well as by
   distance, so the engineer's code is gone before the trader's chapter. The trader's stretch has
   its own panes: eight drawn charts (candles / glowing line, random walk, "+0.8%" the way a journal
   notes it — never currency) and eight numbers ("58% win", "1 : 3 R", "DD 4%"). `makeTraderAtlas`.
2. **Tool and language logos** on the engineer's panes: square icon atlas from
   `public/hub/icons/*.svg`, copied by `scripts/hub-icons.mjs` from simple-icons (CC0) and devicon
   (MIT): TypeScript, Next.js, React, Node, Python, C#, .NET, Java, VS Code, Cursor, Claude, Git,
   Docker, PostgreSQL, Supabase, Three.js. Licences in `15-credits.md`; console credits in round D.
3. **The lit laptop invites the click:** a soft halo behind the lid and a breathing bezel light in
   the engineer's blue, both stronger under the pointer; the screen brightens too.
4. **Hold and move = look while time is slow.** Dragging no longer cancels the hold: the 260 ms
   hold starts slow time, moving after that turns the view (`dragging` and `holding` together).
   Moving before the hold lands is still a plain drag.
5. **Back from a world** came back to a blue page (the browser restores the page from its cache
   mid-flight). `pageshow` with `persisted` resets portal / entering state and resumes the audio
   context. After a reload the context starts suspended: `ambient.resume()` on the first
   pointer-down or key.
6. **The drone buzzed:** the 82 Hz triangle is a sine now, levels trimmed.
7. **Exit is dark, not blue:** the camera still dives into the screen; the cover is the void with
   one small breathing light in the world's colour (from 0.8 s before the leave). The engineer
   world's own dark opening comes with its redesign.
8. **Lens keys on the climb:** `-` pulls the view wide (watch the assembly whole), `+` tightens,
   `0` resets. Ctrl +/− stays the browser's zoom on purpose.
- Open: a music player (needs Ratul's pick of source: YouTube IFrame + Data API key, or paste-a-link);
  returning from a world should land on that world's section; the parts fly in at the frame's edge
  on the approach (the laptop enters the view at c ≈ 1.85) — zoom out to watch them meet.

---

## Round B: the climb, the object field, the engineer's laptop (2026-11-04)

D38 round B shipped on `phase-0-content-engine`. The doorway pattern is proven end to end.
- **One helix for everything** (`vr/util.ts` `climbPose(c)`): the camera's position, heading and
  pitch at scroll progress `c` (page sections). The Director and the field read the same curve, so
  what the camera meets is always in front of it. Turn per section eased from 162° to 90° — at 162°
  "ahead" swung out of view before the parts could arrive.
- **Object field** (`vr/field.tsx` `Slabs`): one instanced draw of glass panes with real content from a
  2048 × 1024 canvas atlas (`vr/screens.ts`): eight editor tiles showing this site's own source
  (fluid shader, `climbPose`, the sound engine, the Director) and eight code glyphs. Rounded-rect SDF,
  colour fringe, rim in the persona's colour, fog by camera distance (4 → 15 units). Each pane sits
  ahead of the camera's own pose at its point on the climb, so panes drift in and out of the dark.
- **Engineer assembly** (`EngineerAssembly`): a laptop built in code (base, lid, 70 instanced keys,
  trackpad, screen) whose parts hang loose half a section before the peak, fly together as the camera
  reaches the section (`gather` = 1 − smoothstep(|c − c₀|, 0.22, 0.95)), unfold (lid 104°), power on
  (boot line opens into the editor, key backlight), hold while |c − c₀| < 0.22, then drift apart ahead
  again. The laptop's screen is a drawn editor of `fluid.ts` with tabs and a status bar;
  `LAPTOP_SCREEN_SRC` swaps in Ratul's own screenshot once `public/hub/engineer/` has one.
- **The doorway:** the lit screen is raycast against the pointer each frame (`state.portalHover`);
  the Director toggles `html.is-portal-hover` + `--portal-c` so the cursor ring opens in the world's
  colour. A tap (page `up` handler) → `enterWorld`: `state.portal = {slug, at}`; the Director flies the
  camera into the screen over `PORTAL_LENGTH` 1.6 s (position lerps to 0.18 in front of the glass,
  heading turns to face it, FOV −14°, parallax/drag fade out), the HTML fades (`is-entering`), the
  world's colour rises over the last 0.6 s, then `personaHref` → full navigation to
  `code.<root>` (or `router.push` on unrouted hosts). Scroll is locked while leaving.
- Pointer-down now records the point too, so a finger tap (no move) can hit the doorway.
- Narrow screens: the laptop moves toward the centre and further away (`anchor` depends on aspect).
- Numeral "01" hidden in immersive mode (the objects carry the chapter now).
- Screens use the site's mono face: `--font-geist-mono` read off the root; textures redraw on
  `document.fonts.ready`.
- Measured (Intel UHD, dev, Performance, 1440×860): 59–60 fps on the climb with the field, the laptop
  and the fluid composer on. Verified by script: hover → `is-portal-hover`; click → flight → lands on
  `http://code.ratulroy.localhost:3000/`.
- Lessons: the camera's yaw is a left-handed turn (`dir = (sin yaw, ·, −cos yaw)`), so an object that
  must face back along the path takes `rotation.y = −yaw` — the first build had every pane and the
  laptop edge-on. Canvas rows count from the top; texture `v` from the bottom (atlas tile rows flipped).
  Playwright screenshots take ~1.2 s on this machine: to inspect a 1.6 s flight, freeze it by giving
  `state.portal.at` a getter.
- Open for round C/D: the other five assemblies; returning from a world should land on that world's
  section (today: hero); the drifting field is engineer-only, the gaps between personas are still rays.

---

## Round A feedback, second pass (2026-11-04)

Ratul's notes on 4451890, all addressed:
1. **Page opens on the loader.** The gate's still parts (wordmark, headline, "Gathering light") are
   server-rendered inside the boot cover (`GateSkeleton`), so the first paint IS the loader; the live gate
   fades in over it in the same places (gate-rise no longer blurs/translates). Hidden when the saved mode is Normal.
2. **Slow time readout:** the ring tightens to a small circle, the dot stays, and `time ×0.27` sits beside
   it — no arc, no percentage, no caption. Director writes `--tscale`.
3. **Fluid cursor** (`vr/fluid.ts`): a 160 px GPU sim (velocity + dye + hue, vorticity confinement, no
   pressure solve) stirred by the pointer, applied as a `postprocessing` Effect that bends the frame along
   the flow and adds the dye as light. Runs in light-time (holding freezes the swirls). The composer now
   runs at every quality level so Performance has it too (bloom/CA/noise still off there; MSAA 2).
4. **Descenders** no longer clipped: SplitText masks get `linesClass: "split-line"` → GSAP names the mask
   `split-mask-line-mask`, padded 0.12em/0.2em with negative margins; words enter from 125 %.
5. **Sound:** `timeScale` now follows the scene's real time scale (glides): pitch −700 cents, filter
   closes, a 36 Hz sub swells, a thin beating shimmer surfaces. `rush(speed)` raises the wind during the
   approach; `impact()` = sub drop 90→36 Hz under the chime.
6. **Copy:** "Put on the headset" · "Or proceed without the headset →" · "Every perspective begins with
   the same sight." Eyebrow "You are the prism" and the explaining body line removed (no spoon-feeding).
7. **Graphics setting is sticky:** a level the visitor set by hand (cookie present) is never changed by
   the governor — it toasts once ("Running below 40 fps — Balanced would be smoother") instead. The
   governor's own step-down is session-only (`setQuality(q, false)`), so it never masquerades as a choice.
8. **The split is continuous:** impact raises a *white pillar* (beams bundled on the axis, `spread 0`,
   `chroma 0`), the approach glare thins out over 2.2 s, then over the 5.2 s split the beams fan out
   (`spread`) and the colour separates inside them (`chroma`, later for beams near the axis) while the
   camera rides the J. Flash shortened to a 1.1 s bloom at 0.95 so the pillar is seen through it.
- Measured (Intel UHD, dev, Performance, 1440×860): 60 fps gate/sky/approach, 56–60 fps climb, with the
  composer + fluid on. Fluid sim 160×96 texels.
- Lessons: fresh render targets are not cleared — clear them once or the sim starts from driver garbage
  (fog everywhere). Vorticity strength 38 blows up a sim with no pressure projection; 7 with a velocity
  clamp of 0.3 holds. `blendMode.opacity = 0` on a postprocessing Effect is not a clean A/B (frame went black).
- Known: the dev server stalls for minutes when Supabase DNS fails (content fetch has no timeout/fallback) —
  still on the pre-launch list.

---

## Round A feedback fixes (2026-11-03)

Ratul: "looks awesome now" + five notes. Done:
1. **No glimpse of the old view before the gate** — a void cover (`.hub-boot`) is in the server HTML and
   only fades once the page has decided how to open; the Normal poster stays hidden until then.
2. **Graphics setting labels:** Performance · Balanced · **Quality** (was "Best"); top bar says "Graphics · …".
3. **Type:** display face is now **Fraunces** (variable: opsz 144, SOFT 60, WONK 1, weight 330) via
   `next/font/google`; hero headline no longer `nowrap`, max size 7 rem, so nothing clips.
4. **Slow-time ring:** while holding, the cursor grows an arc that fills with the real time scale and shows
   the percentage (Director writes `--slow` 0–100 on `<html>`; the cursor reads it each frame).
5. **Company in the sky** (`vr/space.tsx`, all in code): shooting stars, two planets (one ringed, lit from
   the light's side), a satellite with a blinking lamp on a slow arc, a tiny rocket crossing far away with
   an exhaust glow. Scaled by sky visibility so they never compete with the light.
- Lesson: `active` is a reserved word in GLSL (shader failed → gate said 3D couldn't start). Caught by
  `ContextWatch`, which is exactly what it is for.

---

## VR journey round A: headset → sky → the light → the split (2026-11-03) — D38

- **Scene rewritten** as `app/components/hub/vr/*` (replaces `hub/journey/*` and `entry-gate.tsx`):
  `state.ts` (phases: gate · wear · blink · sky · approach · impact · split · climb), `clock.ts`,
  `headset.tsx` (own design in code: rounded dark-glass visor, one light strip, two lens rings, head band;
  RoomEnvironment reflections, nothing downloaded), `sky.tsx` (dome + twinkling stars, spectrum tint while
  climbing), `light.tsx` (approaching light with rays and a colour-splitting rim; cone of colour; **Rays** —
  instanced beams fanning up from the apex so the inside of the cone is made of light; photons),
  `scene.tsx` (Director: time, phase timeline, J-path camera, spiral climb; Effects; Governor; Warmup).
- **Gate** is now `headset-gate.tsx`: the headset floats in the scene behind a quiet overlay (device line,
  quality slider, "Best with sound", Normal link). Click the headset / Enter / Space → `wear` (turns to face
  you, rises, lenses fill the view, lids close) → `blink` (eyes open onto the sky) → `sky` ("Press Space" /
  "Tap") → `approach` (≈7.3 s, slow then rushing; hint "Click and hold to slow it down" at 28–90 %; hold
  → time scale 0.1) → `impact` (white flash, chime) → `split` (3.4 s J: forward then up to 78°, cone and
  rays open) → `climb` (scroll unlocked, hero text rises). "Skip intro" visible from the first second of
  wear. Returning visitors in the same session land on the climb (`returning` loader, Skip → Normal).
- **Climb (placeholder until round B):** helix inside the cone, camera tilting back to level over the first
  section, sky tinted by the nearest persona's spectrum position. Page sections are unchanged HTML.
- **Measured (Intel UHD laptop, dev build, 1440×860, Performance):** 60 fps at the gate, during the approach
  and on the climb; 53 fps while the test harness polled every 50 ms. Gate ready ≈1.5 s. No horizontal
  overflow at 500 px (the tool's narrowest window).
- **Lessons:** `ConeGeometry` uv.y is 1 at the apex — my glow was 140 units away until flipped. Looking up
  inside a cone shows only a ring at the edge; the split needs volume (rays), not just a wall. The
  screenshot tool lags ≈3 s, so sub-2 s phases were captured by freezing `phaseAt` from inside the page
  (`window.__vr`, dev only). A Supabase DNS blip (`ENOTFOUND`) 500s the whole hub — content fallback to
  stubs when the provider is unreachable is worth doing before launch.
- **Next:** round B — the drifting object field + the engineer laptop assembly with click-into-screen; the
  climb camera and cone-wall brightness will be retuned around the objects.

---

## Hub concept reset: the VR journey (2026-11-03) — D38

- Ratul reviewed round 1: good, "not out of the world". Over several messages we agreed a new hub concept;
  the complete spec is `14-vr-journey-concept.md` (flow, persona order and assemblies, rights, perf, Normal
  mode, rounds A–D). Round-1's prism/river scene will be replaced; the gate, quality slider, governor, light
  cursor, sound and Lenis/GSAP stack carry over.
- Decisions inside D38: no on-screen HUD text; Ratul's own screenshots of VS Code / TradingView / Valorant /
  CS2 etc. allowed; hub trading numbers illustrative (percentages only); ride routes as light lines (no map
  tiles); CC0-only 3D models restyled in our material; all credits in the browser console.
- Ratul is collecting screenshots in `Desktop/portfolio-shots` for round B.
- **Next:** round A (headset gate + wear, night sky, Space/Tap, accelerating light + hold-to-slow, head-on
  impact, J-split into the cone). Ratul may switch the builder model to Fable for it; everything needed is
  in D38 + doc 14.

---

## Hub round 1: the light journey (2026-11-03) — D36, D37

- Deps (`chore(config)`): gsap 3.13 (ScrollTrigger + SplitText), lenis 1.3.
- **Entry gate** (`app/components/hub/entry-gate.tsx`): device analysis (`lib/site/device.ts`: WebGL
  renderer → tier → suggested quality), quality slider, Enter (progress while the scene compiles behind
  the gate) / Normal (instant); "taking longer than usual" after 9 s; WebGL missing/failed said plainly.
  Returning visitors in the same session get the compact loader (auto-enters, Skip always visible).
- **Modes:** `lib/site/experience.ts` rewritten — `immersive | normal` + quality + sound cookies on the root
  domain; no Auto. `experience-toggle.tsx` → `experience-controls.tsx` (ModeSwitch, QualityMenu, SoundToggle).
- **Scene** (`app/components/hub/journey/*`, replaces `refraction-scene.tsx`): beam with haze + pulses,
  impact flash + sparks, custom glass shader (analytic per-channel refraction, AA edges, internal light
  path; no transmission buffer → no grain), camera path through the prism onto a river of colour,
  photons along each stream, cursor-reactive dust, a world teaser per persona (lattice / candles /
  aperture), closing fold to white. Drag = look around (springs home), hold = slow time.
  Shader compile errors / context loss → graceful "3D couldn't start" + Normal.
- **Page:** Lenis smooth scroll, GSAP word-mask reveals, light cursor, synthesised ambient sound.
- **Measured (Intel UHD 620-class laptop, dev build):** ready behind the gate in ~1.6 s; Performance 60 fps
  at 1440×860; Balanced ~40 fps (bloom), so the device analysis correctly suggests Performance here.
  Mobile (390 px emulated): no horizontal overflow, gate fits one screen.
- **Lessons:** `THREE.Color` can't parse CSS `hsl(h s% l%)` (silently white) — use `setHSL`.
  `modelMatrix` isn't available in fragment shaders. Background tabs throttle rAF (check focus before
  trusting fps).
- **Next:** round 2 = Normal mode with full motion (replace the static poster) + ending polish;
  round 3 = portal into each world (D37), richer world scenes, phone tuning, sound design.

---

## Design pass 2: 3D "Refraction" hub (2026-11-02) — D32–D35

- Deps (`chore(config)`): three, @react-three/fiber 9, drei 10, @react-three/postprocessing 3.
- `app/components/hub/refraction-scene.tsx` (lazy, Immersive only): falling beam → glass prism
  (MeshTransmissionMaterial, procedural Lightformer env, no network assets) → shader-drawn
  continuous spectrum fan with persona bands (any count, MAX_BANDS 16); dust; cursor parallax;
  camera follows the chapter in view; closing chapter folds the spectrum back to white.
- `refraction-poster.tsx`: static SVG of the same composition = Lite backdrop + first paint.
- `hub-experience.tsx`: scroll chapters, spectrum rail, cycling phrase (screen readers get one
  sentence), per-world CTAs; `lib/site/spectrum.ts` (t → colour, auto-spread + pins, GLSL mirror).
- **Perf (Intel UHD laptop, 1080p):** bloom was the cost (32 → 60 fps without). Now half-res
  bloom + `QualityGovernor`: 4s warm-up, drop bloom if < 45 fps sustained, Lite if < 28 fps
  without bloom; windows with frame gaps > 250 ms (hidden/throttled tab) are ignored — drei's
  PerformanceMonitor degraded on warm-up jank and on background tabs. Measured 56–58 fps.
- Dev on a TLS-intercepting network: run `NODE_OPTIONS=--use-system-ca npx next dev --webpack`
  (Node trusts the Windows store; never NODE_TLS_REJECT_UNAUTHORIZED=0).
- Tooling note: background Chrome windows are rAF-throttled to exactly ~1016 ms/frame — check
  frame gaps before trusting any fps number.
- Next: portal transition on CTA (fly along the band + colour flood), persona content fields
  in the DB (phrase/CTA/pin/links), per-world 3D motifs, Engineer world redesign.

## Design pass 1: hub + experience modes (2026-11-02)

- **Design system v2** tokens in `globals.css`: void/ink base, one wavelength per persona
  (`--wl-*`), fluid type scale `--step-*`, motion `--ease-*`/`--dur-*`; display face
  Instrument Serif (`font-display`). Legacy tokens stay until each world is rebuilt.
- **Experience modes (D26):** `lib/site/experience.ts` + `app/experience-provider.tsx` +
  `ExperienceToggle`. Pre-paint boot script; Auto → Lite on reduced motion / data saver /
  2g-3g / <4GB / <4 cores; cookie on the root domain (verified shared hub ↔ `code.`).
  CSS hooks: `.xp-motion`, `.xp-immersive-only`, `.xp-lite-only`.
- **Hub** (`app/components/hub/prism-hub.tsx`, served at the root / `/whoami`): beam → prism →
  rays in spectral order onto doors; unlaunched personas = unlit rays; stacked layout < lg.
- Perf: glow moved from SVG `feGaussianBlur` to a CSS-blurred composited layer; 59 fps in
  Immersive (DevTools Chrome). Note: the Playwright window gets rAF-throttled to ~1 fps when
  in the background — don't trust its fps numbers.

## Persona subdomains (2026-11-02) — D31

- `proxy.ts` (Next 16 "proxy" = middleware) + `lib/site/hosts.ts` (subdomain ↔ persona map,
  `NEXT_PUBLIC_ROOT_DOMAIN`, dev root `ratulroy.localhost`) + `lib/site/persona-link.tsx`
  (`PersonaLink`/`HubLink`: same-host → client nav with clean paths, other host → full nav).
  All persona links in `app/**` migrated.
- Verified in dev (curl + Playwright): hub `/` → whoami; `/engineer/x` on hub → `code.` host;
  `code.` `/roster` client-nav works; cross-persona → other subdomain; `www.`/`who.` → root;
  `trader.` → `trade.`; unknown label → "persona not found"; `/capture` → root host;
  plain `localhost:3000/engineer` unchanged. 0 console errors.
- Gotcha: Next relativises redirect `Location` when the target equals its own origin
  (`localhost`) → hub on plain localhost would loop; hence the `ratulroy.localhost` dev root.
- Not yet: domain purchase + Vercel domain/DNS; persona switcher in `home-page.tsx` still
  swaps in place (no host change) — replaced in the redesign; shared experience-mode pref
  needs a parent-domain cookie.

## Ownership change (2026-11-01)

- Ratul: **Claude takes over the frontend** — owns all of `portfolio-site/`; Cursor
  becomes reviewer (read-only, notes in `docs/reviews/`). See 09 (update) + AGENTS.md.
- Found: `phase-0-content-engine` (28 commits since July) was **never pushed** —
  GitHub has only `main`. Secret scan of those commits: clean. Push pending Ratul OK.

## Dev tooling (2026-11-01)

- Project `.mcp.json`: Playwright MCP + Chrome DevTools MCP (+ Supabase MCP). They use
  **globally installed** binaries (`npm i -g @playwright/mcp chrome-devtools-mcp`) —
  `npx …@latest` took ~35s per launch here and blew the 30s MCP startup limit.
  `MCP_TIMEOUT=120000` set in `.claude/settings.local.json` (Node startup is slow on this machine).
- Branch pushed; **PR #1** open → `main`. Merge held until Vercel has the Supabase env vars
  (`main` auto-deploys to production).

## Restart + replan (2026-11-01)

- Supabase free project had **auto-paused** (inactivity) → DNS NXDOMAIN → every
  public page 500'd. Ratul resumed it; `verify-db.mjs` → **ALL CHECKS PASSED**
  (script fixed: probe insert now sets `slug`, required since `0005`).
- Dev server hung compiling `/`: a stray `~/package-lock.json` made Next infer the
  home dir as root → pinned `turbopack.root` (`d946095`). Dev currently run with
  `next dev --webpack` (faster/more reliable on this machine).
- **New plan:** [11-replan-2026-11.md](./11-replan-2026-11.md) — stabilize →
  design system v2 → Engineer contract → 3D/immersive Engineer PoC → persona
  "world transitions" → other worlds → launch quality.
- **Requested from Ratul:** approve keep-alive + backup GitHub workflows (`.github/`
  is outside both lanes).

---

## Phase 1 — Engineer in depth (in progress)

### Landed — Claude: media upload pipeline (2026-07-20)

Ships the reusable image pipeline (D19). Fully verified against the live DB.

- **Deps** (`chore(config)`): `sharp` (derivatives) + `exifr` (EXIF); `next.config.ts`
  `serverExternalPackages: ["sharp"]`.
- **`supabase/migrations/0007_media_storage.sql`**: `originals` (private) + `media`
  (public) buckets; storage RLS — admin-only writes via `is_admin()`, public read on `media`.
- **`lib/media/config.ts`** (buckets, derivative specs, accepted types, size cap) +
  **`lib/media/pipeline.ts`** — `ingestImage(client, params)`: downloads original →
  sharp thumb(400)/optimized(1280)/full(2400) WebP, auto-oriented → uploads derivatives →
  `exifr` EXIF+GPS → inserts media row. Transport-agnostic; caller supplies the client
  (server action = RLS session client; script = service role).
- **`lib/db/browser.ts`** — session-bound browser client for direct-to-storage upload
  (bypasses the Vercel ~4.5MB body limit; no service key in the browser).
- **`app/capture/actions.ts`** — `createProject` now returns `entryId`; new
  `registerUploadedMedia({entryId, originalPath, …})` verifies admin, runs the pipeline,
  revalidates the persona/detail/admin paths.
- **`app/capture/admin/media-uploader.tsx`** + wired into `project-form.tsx` — after a
  project is created, upload images (direct to `originals`, then finalize) with per-file
  status + thumbnails.

**Verified:** `scripts/verify-media.mjs` (live) — buckets present, original uploaded
private, thumb+optimized+full generated, optimized publicly fetchable (200/webp), original
NOT publicly fetchable (400), EXIF path graceful, anon sees public media via the entries
join, temp data cleaned up → **ALL CHECKS PASSED**. Full `npm run build` green; `tsc`
clean; lint clean on changed files.

**Provider note for Cursor:** no contract change needed — `supabase-provider` already
selects `media(*)` and maps it (sorted by `order`), so `entry.media` is populated the
moment images are ingested. Build carousels straight off `entry.media[].thumbUrl /
optimizedUrl / fullUrl` (+ `width`/`height` for aspect ratio, `alt`).

### Pending — Ratul (to enable the uploader)
1. **Apply `0007`** in the SQL editor. The smoke test already created the buckets, but only
   `0007` installs the RLS **policies** that authorize the admin *session* to upload from the
   browser. Until then `/capture/admin` image upload fails RLS (service-role scripts still work).
2. Then in `/capture/admin`: create a project → add an image → confirm the thumbnail renders,
   and that `entry.media` shows on `/engineer/<slug>` once Cursor's gallery lands.

### Landed — Claude (data/capture lane)
- `48d643d` entry **slug** (contract + providers + `0005` migration) → clean `/[persona]/[slug]` URLs.
- `d29d87f` **admin write path**: `@supabase/ssr` cookie-bound client (`lib/db/server.ts`),
  `requireAdmin()` guard, `/capture/login` (email+password, single admin), `/capture/admin`
  (create Engineer projects + list existing), server actions (auth re-verified, RLS-scoped
  writes), `0006` admins self-read policy.
- Decisions `D17` (root=engineer, `/whoami`=card hub), `D18` (RLS-scoped admin writes).

### Landed — Cursor (UI lane)
- `21f0556` **project detail pages** `/[persona]/[slug]` + **`/whoami` persona hub**; "View project" now links through.

### Landed — Claude: multi-agent collaboration protocol (2026-07-20)
- Root **`AGENTS.md`** (lane map + hard rules, auto-read by both agents) + root `CLAUDE.md`
  loader; **`.cursorrules`** mirror for Cursor; rationale in
  `docs/claude-planning/09-collaboration-protocol.md` (locks rejected → partition + enforcement).
- **Mechanical enforcement (Claude side):** `.claude/hooks/lane-guard.mjs` PreToolUse hook
  blocks Claude Edit/Write into Cursor lanes (`app/**` minus `api/` + `capture/` carve-outs);
  registered in `.claude/settings.json` (project-shared). Negotiated exceptions via the
  script's `OVERRIDES` list, Ratul-approved only.

### Agreed — UI roadmap coordination (2026-07-20)

Cursor proposed engineer-page phases: **A** responsive density (wider shell ~1400–1600px,
featured layout for sparse grids, mobile pass) → **B** project-card media carousel +
detail gallery/video → **C** quick links / resume CTA / certifications + **C2** career
timeline + **C3** recent-blog strip → **D** GitHub stats panel → **E** polish.

Verified against the contract — Cursor's dependencies on Claude's lane:

| Needs | Status | Claude action (priority order) |
|-------|--------|-------------------------------|
| `entry.media` populated | Contract ✅, pipeline ❌ | **1. Media upload pipeline** (buckets: private originals + public derivatives, admin upload, thumb/optimized). Same pipeline Photography needs later. |
| Profile links / resume URL | ❌ not in contract | **2. Contract additions:** `Persona.links[]`, `resumeUrl`; new entry types `certification` + `milestone` (+ migration + admin). |
| Cert/experience types | ❌ not in contract | (same as above — `milestone` powers the career timeline) |
| `getGitHubStats()` | ❌ doesn't exist | **3. Cached server accessor**, GitHub API + optional token env. |
| Blog strip (`listBlogPosts`) | ✅ live already | None — buildable now, empty-state until posts exist. |

Sequencing agreed-in-principle: **Cursor does Phase A now (zero Claude deps) while Claude
lands items 1–2 in parallel; Cursor does NOT scaffold Phase C against guessed shapes** —
contract types land first, then C builds on real types (avoids rework).

Recommendations relayed to Ratul on Cursor's open questions: width "comfortably wide"
(~1400–1600px) not full-bleed; hover-only auto-cycle + tappable dots on mobile;
**omit exact DOB from the public timeline** (privacy; start at school / "first line of
code"); timeline teaser below projects, subpage if it grows; blog = 3-card row, no carousel.

### Verified
- Full build green (routes: `/`, `/[persona]`, `/[persona]/[slug]`, `/whoami`, `/capture/login`, `/capture/admin`).
- Auth guard smoke test: unauthenticated `/capture/admin` → 307 → `/capture/login`; login renders 200.

### Pending — Ratul (to close the loop)
1. ✅ ~~Apply migrations `0005` (entry slug) and `0006` (admins self-read)~~ — applied 2026-07-20.
2. `npm run dev` → visit `/capture/login`, sign in (your admin email + password), create an
   Engineer project (set visibility **public**), then check it renders on `/engineer` and its
   detail page at `/engineer/<slug>`.
3. `.mcp.json` (from `claude mcp add`) is untracked — decide whether to commit it (project-scoped MCP config; contains the project ref, no secrets).

---

## Phase 0 — content engine (COMPLETE, verified)

**Branch:** `phase-0-content-engine` (shared working repo; not yet pushed).

### Landed — Claude (data lane: `lib/**`, `supabase/`)

| Commit | What |
|--------|------|
| `a2aa4a4` | `.env.example` (var names, no secrets) + `.gitignore` exception; **shared contract** `lib/content/types.ts` |
| `bdf4d55` | Callable **stub `ContentApi`** over fixtures (`fixtures.ts`, `stub-provider.ts`, `index.ts`) |
| `291c6cd` | **Supabase schema** SQL: `0001` tables, `0002` RLS + policies, `0003` persona seed, `supabase/README.md` |
| _(this batch)_ | **Supabase provider** + `lib/db/client.ts` (public/admin clients); `index.ts` auto-selects provider by env |

**Data layer is code-complete for Phase 0.** Import everything from `@/lib/content`.
Providers swap automatically: no Supabase env → stub fixtures; env present → DB.

### Landed — Cursor (UI lane: `app/**`)

| Commit | What |
|--------|------|
| `6e87436` | `/[persona]` deep links, session restore, invalid-persona page; `home-page.tsx` extracted from `page.tsx`; `page.tsx` now a thin wrapper |

Decisions confirmed: slug stays **`photographer`**; invalid/unlaunched slugs keep the
bad URL and show the funny page; Home still uses hardcoded `PERSONA_CONTENT` (not yet
wired to `ContentApi`).

### ✅ LIVE DB VERIFIED (2026-07-19)

`node scripts/verify-db.mjs` → **all checks passed** against the real Supabase
project (`wgvwwiqromxlrocpnsoc`):
- anon sees only the 3 published personas (RLS read filter) ✅
- service_role sees all 6 (grants + RLS bypass) ✅
- a private entry is invisible to anon (visibility gate holds) ✅

Required an extra migration `0004_service_role_grants.sql` (auto-expose-off had
stripped service_role's table grants).

### Done — Ratul (external setup)

1. ✅ Applied migrations `0001 → 0004` (SQL editor).
2. ✅ Email auth on, public sign-ups off.
3. ✅ Admin user created + registered in `admins`.
4. ✅ `portfolio-site/.env.local` set. ⏳ Vercel env deferred to deployment time.

### Pending — Cursor (UI lane)

- Wire `home-page.tsx` to `ContentApi` (`getPersona` / `listPersonas` from
  `@/lib/content`), replacing hardcoded `PERSONA_CONTENT`. Accessors are live now.
- Engineer projects grid → `listEntries("engineer")`.
- Experience / Skills / Certs multi-page nav (later).

### Pending — Claude (data lane, next)

- Server actions for writes (capture/admin) using `adminClient`.
- Harden `app/api/lead` + `app/api/chat` stubs (validation, rate limiting) — **Claude
  owns `app/api/**` per lanes**; coordinate so this doesn't collide with Cursor.
- Media upload pipeline (originals private + optimized derivatives) — later phase.

### Follow-ups / risks noted

- ⚠️ Build logs show `NODE_TLS_REJECT_UNAUTHORIZED=0` set in the environment
  (disables TLS cert verification). Track down its source and remove — real security
  risk. Not blocking Phase 0.
