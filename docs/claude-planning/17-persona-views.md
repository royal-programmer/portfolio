# 17 — Persona views: one dataset, many ways to see it

**Ratul's idea (2026-11-08):** portfolio designs now come in waves (agent-swarm builds, Netflix-style
series, scattered-card designer sites). Keep the data separate and build each presentation as a
selectable *view*, chosen from the terminal the way Claude Code offers options. Profile pages do
not share one design.

This doc is the standing contract for that. The content contract (`lib/content/types.ts`) stays the
single source; a view is only a renderer of it.

## 1. The model

- **The terminal is the root** of the Engineer page: the default, server-rendered, readable by
  search engines. It boots, lists the views, waits.
- **Each view is a branch** with its own route (`/engineer/<view>`), so it deep-links and shares.
- **Picking a view remembers it** on the device. While remembered, the terminal boots for a beat
  and drops straight into that view, no picker.
- **Exit is always present**: Esc on desktop, `exit` typed in the terminal overlay, and an action
  in the HUD strip beside Top and End. Exit returns to the terminal and clears the memory, so the
  terminal is default again until the next pick.
- **Launch with two views**, add more one per round. Depth over breadth: one Awwwards-level view
  beats four shallow ones.

## 2. The registry

Per persona, a list of views; each row: `id`, `name`, `line` (one sentence shown in the terminal),
`component`, `enabled`, `default`. Lives in the data layer (`site_settings` key `views.<persona>`
once the admin console lands; a typed constant until then). The admin toggles views and sets the
default (see `16-admin-console.md`).

**Routing rule.** A view id and an entry slug share the `/<persona>/<x>` depth; the view wins. An
entry whose slug equals a view id is shadowed and `generateStaticParams` logs an error for it, so
pick view ids that no project will ever use (`stage`, `swarm`, `series`).

## 3. Engineer views, in order

1. **Swarm** (round 2–3). The page builds itself: agents named after the stack — `schema`, `api`,
   `ui`, `tests`, `deploy` — fan out from the terminal cursor, draw wireframe boxes, drop the
   projects and skills from the content layer, a layers counter and an agent log in the HUD strip.
   About thirty seconds, then it holds as a readable page. Scroll or tap skips to the finished
   state. Phones: fewer agents, faster build. Reference: the red-lit "power of AI agents" clip.
2. **Series** (round 4–5). Netflix-shaped by Ratul's call: "Who's watching?" with **Recruiter**,
   **Developer**, **Full story** — three orderings of the same data. A series hero with Play (a
   short typed trailer) and View résumé, episode rows per project (season = year), a skills row,
   a "To be continued" card with contact. Layout and feel resemble Netflix; **no Netflix logo,
   wordmark or red N** — our own mark. Reference: the "This isn't Netflix" clip.
3. Later candidates: **Blueprint** (systems as architecture diagrams), **Log** (the career as a
   git history), **Badge** (the lanyard ID card and scattered cards snapping to a grid, from the
   designer clip).

## 4. Rounds and distribution

| Round | Work | Who |
|---|---|---|
| 1 | Registry, routes, remembered view, exit mechanics, terminal root UI | Lead designs + routes; Sonnet builder writes the terminal UI from a brief; Haiku scout surveys; Sonnet reviewer checks |
| 2–3 | Swarm | Lead choreography + brief; builders for agents, wireframes, log |
| 4–5 | Series | Lead profiles + brief; builders for rows, hero, trailer |

Each round ends with Ratul's phone check and a checkpoint.

## 5. References (Ratul, 2026-11-08, Teams exports in Downloads)

1. Agent swarm building a product landing page (labelled cursors, selection boxes, layers pill).
2. Dark glow personal portfolio (particle hero, "Things I've built", "My Toolkit") — closest to the
   hub as it is, least new.
3. Netflix-style "the series" portfolio (profiles, episodes, skill universe, "To be continued").
4. Designer site: light, lanyard ID badge, scattered "Selected Work" cards snapping to a grid,
   laptop-closes outro.
5. Agency site: bold uppercase type, service rows with pill images, works list with years.

## 6. The terminal, in full (round 1b — Ratul, 2026-11-08)

Ratul's correction after round 1: the root is not an entry animation with a picker; it is **a
real terminal**, the way Claude Code or a Linux TUI is: every command works, `/` opens a command
menu, lists are chosen from with the arrow keys, and it can go full screen. The views are still
branches; the terminal is a place in its own right.

### 6.1 Shape

- **Window on desktop, full screen on phones.** The green title-bar dot and `fullscreen` toggle
  full screen on desktop (remembered on the device, key `xp-term-full`). Yellow clears, red exits.
- **A hidden real input** carries every keystroke, so phones raise their keyboard when the body is
  tapped; IME composition is honoured. Phones also get a **chip strip** above the keyboard:
  `help` `/` `ls` `views` `Tab` `↑`, since those keys are hard to reach on a glass keyboard.
- **Boot** is the current script (ssh, whoami, cat stack, uptime, ls /engineer), then one hint line
  `type help, or / for the menu`, then `ls views/` with the picker. A remembered view still opens
  by itself after the script; Esc or Backspace calls it off.

### 6.2 The file system (pure, from the content layer)

```
~  (= /engineer)
├── about            persona body, in a terminal's voice
├── stack            one stack item per line
├── uptime
├── contact          mail · github · linkedin, as links
├── projects/<slug>.md   title, year, role, stack, summary, repo ↗, live ↗, "open <slug>" for the page
├── writing/<slug>.md    title, date, body (markdown shown as plain text)
└── views/<id>*          executable: runs open <id>
```

`cd`, `pwd`, `ls [-l] [path]`, `cat <file>`, `tree`, `..`, `~`, `/engineer` all resolve. Unknown
paths answer like a shell (`ls: cannot access 'x': No such file or directory`).

### 6.3 Commands

`help` / `/help` (grouped, one line each) · `man <cmd>` · `ls` `cd` `pwd` `cat` `tree` · `open
<view|slug|url>` · `views` `projects` `writing` (menus, see 6.4) · `whoami` `stack` `uptime`
`about` `contact` `neofetch` (a stat card: host, uptime, stack, projects, posts, views) · `history`
· `clear` · `fullscreen` · `echo` · `exit` / `cd ..` from `~` (the hub). **Tab** completes commands,
paths, view ids and slugs; a second Tab lists candidates. **↑/↓** walk the history (session
storage). Unknown: `command not found: x` plus the nearest command when the distance is small.

### 6.4 Menus, like Claude Code

- Typing `/` at an empty prompt opens the **command palette** above the prompt: every command with
  its one-line description, filtered as you type, ↑/↓ to move, Enter runs, Esc closes.
- `views`, `projects`, `writing` print a **select list** (the current picker's look): `▸` on the
  selected row, ↑/↓ and the row number choose, Enter acts (views: open; projects/writing: `cat`,
  with `open` and the repo/live links at the foot of the printout), Esc leaves the list and returns
  to the prompt. Rows are tappable, 44 px on coarse pointers.
- **Esc order:** close the palette or a list → cancel an auto-open → at an empty idle prompt,
  exit to the hub.

### 6.5 Split for this round

Lead: this spec, props and route plumbing, browser verification at 1280 and 393×852 touch. Sonnet
builder: `lib/site/terminal-fs.ts` and `lib/site/terminal-shell.ts` (pure, no React), the
terminal UI and CSS. Sonnet reviewer: cold read plus a command-by-command pass in the browser.

### 6.6 Full screen like an OS (Ratul, 2026-11-08, after round 1b)

Ratul's references: Claude Code's welcome (pixel art, a boxed "Tips for getting started", a
numbered menu), katoolin (ASCII banner, numbered list, bare prompt), vulnx on a phone.

- **The ssh window is only the boot screen.** It types the script as today, then the window grows
  and dissolves into the **full-screen terminal**: no title bar, no dots, no frame; the whole
  viewport is the terminal, dark, with a one-line **status bar** at the bottom (tmux-like):
  `ratul@code  ~/projects │ 1 project · 0 posts · 1 view │ help  /  Esc`. Phones keep the chip
  strip above the keyboard, status bar above the chips.
- **Banner** on arrival, in the accent: a figlet-style `RATUL` in block characters (ANSI Shadow,
  44 columns; the banner's type shrinks on phones so it fits), then
  `Welcome to code.ratulroy.me · <commit or v1>`, a boxed **Tips for getting started**
  (`help`, `/`, `open stage`, `projects`), then the **views as a numbered list** (`1) stage  The
  setup in 3D…`), then the prompt. `clear` clears to a bare prompt; `banner` prints it again.
- **Prompt shows the path**: `ratul@code:~$ `, `ratul@code:~/projects$ `; on phones just
  `~/projects$ `. Transcript lines keep the prompt they were typed at.
- **Typing sounds**: every keystroke the visitor types plays the hub's key click (`ambient.key()`),
  which already respects the site's sound setting.
- `fullscreen` now asks the browser for real full screen (Fullscreen API) and back; the terminal
  itself is always full screen. The three dots are gone; the commands and chips carry exit/clear.
- The remembered view still opens straight after the boot screen, before the banner.

### 6.7 Banner, résumé, portrait (Ratul, 2026-11-08, after 1c)

- The banner spells the handle, **`royal-programmer`** (figlet ANSI Shadow, two lines, 77 columns,
  type sized so it fits any width). Generated into `lib/site/terminal-art.ts`.
- **`~/resume/`** (`summary experience skills projects certifications education`) and the
  **`resume`** command, an overview card like the résumé's first page. Data from
  `Ratul_Roy_Resume.pdf` typed into `terminal-data.ts` (`RESUME`), no phone number; moves into the
  content layer with the admin console.
- **`portrait`**: Ratul's headshot as detailed ASCII (84 columns, 70-step ramp), each cell carrying a
  tone (backdrop, skin, hair/jacket, shirt, neutral) so the UI colours it. **`neofetch`** shows the
  38-column portrait beside the stats, like the real tool; stacked on phones.
- Generation: pyfiglet for the banner; Pillow for the portrait (autocontrast, ×1.35 contrast, 0.5
  cell aspect, HSV tone classes). Script kept in the session scratchpad; re-run if the photo changes.

### 6.8 Boot as the profile tool; the Linux box, not the route tree (Ratul, 2026-11-08)

- **Boot = starting a CLI tool.** The boot window no longer plays an ssh session. It types
  `royal-programmer --boot`, prints the tool line (`royal-programmer v1 · the profile tool of Ratul
  Roy`), then progress rows that each resolve to `[ok]`: profile, mount `~/projects` (n), mount
  `~/resume` (6 files), mount `~/views` (n), link github, sound; then a progress bar that fills
  (`[██████████] 100%  ready`) and the swap to the OS terminal. `via=normal` prints it instantly.
  The hub's exit window plays the same lines (one shared script).
- **Header after the swap** carries what the old script said: portrait left; right, the banner
  `ROYAL / PROGRAMMER` (no hyphen), `royal-programmer v1 · code.ratulroy.me`, then a three-line
  overview in the `whoami` voice (who · stack · uptime). Nothing is printed twice.
- **The machine is a Linux box.** User `ratulroy`, host `code`; prompt `ratulroy@code:~/projects$`
  (Ubuntu shape, confirmed). Home is `/home/ratulroy`, shown as `~`; `pwd` prints the real path;
  `/engineer` is gone from the file system. `whoami` prints `ratulroy` and the one-line identity.
- **Selection:** desktop output selectable (copy, like a terminal); phones never select on tap.
- **Polish:** one rhythm of blank lines between blocks, dim text one step lighter, tips box borders
  aligned, the status bar and dim colours shared with the hub's HUD, the portrait brightened.

### 6.9 The pane, the checkpoints, and the feature list (Ratul, 2026-11-08)

Ratul took the whole list. Layout decision (lead's recommendation, Ratul asked for it): on
**≥ 1024px** a tmux-style split — terminal three quarters, a fixed **pane** on the right quarter.
The pane holds the **portrait** (braille, in the accent), *you are here* (the path), the
**checkpoints** (boot · help · resume · projects · views · portrait · contact · mail, ticked as the
visitor does them, remembered on the device; all eight → an achievement line and an unlocked
egg), the **next hint**, and the key bindings. `pane` toggles it (remembered). Phones: no pane; the
hint lives in the status bar; the braille portrait (26 columns) tops the header.

**Portrait detail.** Header/pane: braille, 2×4 dots per cell (≈ 8× the detail of the ramp).
`portrait`: true-colour half-blocks (`▀`, top pixel as text colour, bottom as background, 64-colour
palette) — a low-res photo. Both from a tighter face crop. `neofetch` uses the braille one.

**Rounds.**
- **1f** pane + checkpoints + portrait upgrade + shell feel: coloured `ls` (dirs accent, executables
  green), `less` paging for long output (space/↓/q), Ctrl+L clear, Ctrl+C cancels the line, `date`,
  `cal`, clickable paths in output (`cat` them).
- **1g** `demo` (a typed tour; any key stops it), `git log` (career as commits; `--graph` draws SLK→
  Altimetrik and side branches), `mail` (inline form: name, email, message → the existing lead API).
- **1h** `curl github` (public API: repos, last push, contribution strip), `theme` (accent · amber ·
  green phosphor) + `crt` scanlines, `resume --pdf` (public copy without the phone number), `qr`
  (block-character QR of the page URL), eggs (`sl`, `cowsay`, `fortune` with Ratul's lines, `sudo`),
  fish-style ghost suggestions (→ accepts), anonymous command analytics into Supabase for the admin.
Then a checkpoint to production, then Swarm.

### 6.10 Round 1i: contents, timeline, hire (Ratul's feedback + a conversion pass, 2026-11-09)

- **Portrait only through the command.** The braille portrait leaves the header and the pane; `portrait`
  shows the 132x102 half-block pixel art, sized to the body width *and* the viewport height; `neofetch`
  keeps its small braille.
- **`timeline` replaces the career `git log`.** School, college, work as one line: wide, a year
  column, a rail of `├─ Mon subject` markers and a bracket per period (`college · 4 yrs`, `work · 2 yrs 1 mo`);
  narrow, stacked with period lines. Periods live in `TIMELINE_PERIODS`; the `school` period is a commented
  stub for Ratul (name and years unknown, not invented). **`git log` is now real:** the latest public
  pushes of `royal-programmer` (`--oneline`, `-n k`), loaded with the same cache as `curl github`. The public
  events feed no longer carries commit messages, so each push shows its head commit and the message is
  looked up once per sha and kept in `xp-gh-msgs`. `--graph` says it moved to `timeline`.
- **`tour`** (alias `demo`, unlisted): six steps, each introduced by a dim `# n/6 · note` line, the
  status bar shows `tour n/6 · any key stops`. Beacons `tour_start` / `tour_stop`.
- **The pane lists the portfolio's contents,** not checkpoints: resume, projects, writing, views, timeline,
  git log, portrait, contact, mail, each a button, a check once visited; `next` is the first unvisited. The
  explorer achievement fires when the eight non-mail rows are done. Old `xp-term-checks` ids are ignored.
- **Conversion:** `hire` (the 20-second version, from the résumé only), `?run=<command>` deep link (strictly
  validated, stripped from the URL, runs after boot; skips a remembered view), numbered tips 1-7 (a bare
  digit runs that row's command when no numbered menu is showing; the boot picker is not numbered so the
  digits stay free), faster boot for repeat visitors (`cached profile`). `view` enters a view.
- **Removed:** ghost suggestions (Tab and the palette stay), the pane/header braille portrait, the unused
  ramp portraits and the large braille from `terminal-art.ts`.

### 6.11 Round 1j: honest placeholders, a contact path everywhere, a real 404 (2026-11-09)

A cold audit of the live site found pre-redesign placeholders and no contact path outside the terminal.
This round is an honest-placeholder pass, not a rebuild of the other personas (each gets its own round).

- **Fake and debug copy gone.** The identity panel's heading is the persona's name; the `/whoami` and
  Konami paragraph became one `From the hub` link. Trader's "Performance (sample)" and "Week view" and the
  photographer's four empty tiles are replaced by one `What's coming here` card (three of the persona's own
  points, plus "Until then, the Engineer side is live" linking to the Engineer host). Only the engineer's
  hero says "I am a"; the other worlds' typed phrases stand alone. Persona chips sit on an opaque tint.
- **`Hire me` pill** (`hire-pill.tsx`) on the hub and every non-engineer page: a small popover with the PDF
  résumé, an email and `Terminal: hire` (the Engineer host with `?run=hire`). Always there, nothing
  remembered; on the hub it hides with the guide HUD (gate, warp, climb). Bottom-left on phones (the HUD and
  the persona pages' round control own bottom-right), top-right under the header on desktop. The hub's
  closing section gains `Résumé (PDF)` beside `Say hello`.
- **Hub on phones.** The hero now reserves the HUD's height (`padding-bottom`), so the headline and the
  line never sit under it, and a one-line pitch from the résumé sits under them (`HUB_COPY.pitch`).
- **Real 404.** `/[persona]` calls `notFound()`; `app/[persona]/not-found.tsx` renders the friendly view for a
  mistyped persona (hub or path host) and plain copy on a persona's own host or deeper in a path.
- **Touch targets.** A `.hit` pseudo-element grows the hit area to about 44px on coarse pointers (header link,
  mode pills, sound, quality, chapter dots, Top/End, the HUD buttons, the gate's "proceed" link) without
  changing how anything looks. The HUD gets a dark plate so it holds up over bright warp streaks.

### 6.12 Round 1k: fixes, portrait modes, the pane, `portfolio` (Ratul + coordinator, 2026-11-09)

- **One boot at a time.** The boot effect now carries a per-run token (`runSeq`); a replaced run (StrictMode
  double effect, a re-run after a push back) stops appending, so the banner and tips box print once.
- **`cls`** joins `clear`; Ctrl+L is the browser's again. Keys line: `Tab complete · ↑ history · / menu · cls clear · Ctrl+C cancel · Esc exit`.
- **Views boot in the terminal.** Opening a view prints `[ok] mounting <id>`, a progress bar and
  `[ok] handing over · Esc comes back` (about 700 ms; instant with reduced motion or `via=normal`), then navigates with
  `?via=terminal`. The view page reads it and renders no `WorldBoot`; the shell strips the parameter. Direct loads keep
  the old arrival. The view's button reads `← back to terminal`.
- **`portfolio` replaces `tour`/`demo`**: the whole portfolio on one screen, instant, sections with a left rule, each ending
  in clickable `→ command` tokens. Built from `TerminalData` only; `?run=portfolio` works; tips row 7 and the boot hint say so.
- **Portrait is generated** (`lib/site/portrait-gen.ts`): the image and crop live in `TerminalData.portrait`; modes `pixels`
  (true-colour half-blocks), `braille` (Floyd-Steinberg), `ascii`, `blocks`, `matrix`; `portrait list|next|<mode>`, a clickable
  modes line under every render, `neofetch` uses braille at 26 cols. Luminance is stretched and flipped for light backdrops.
  The baked arrays are gone from `terminal-art.ts`.
- **Pane**: who (name, role, `TerminalData.status`), quick actions (`hire`, `resume --pdf`, `mail`), contents with a
  `seen n of m` meter, next, live (GitHub cache; one lazy fetch after 3 s idle, never on boot, skipped on save-data), keys.
- **Hub and personas**: `HIRE_PERSONAS` in `brand.ts` decides which personas mount the hire pill (the hub has none); the hub line
  is two alternating character lines (`HUB_COPY.character`); each persona has three phrases (`phrases`), cycled lap by lap and
  reused by the persona pages ("I build systems that stay up").
- **Data**: real school/college/work periods and the four internships; five more profile links under `elsewhere` in `contact`.
- Open: the photo (`R.jpg` is the logo, so the avatar is the source until a real photo is added); hire pill also shows on the
  Engineer stage view (the list says engineer).

### 6.13 Round 1l: timeline grid, Tab, themes, Normal-mode doorway, `now` (Ratul + coordinator, 2026-11-09)

- **`timeline` is a grid.** New `Out` kind `timeline` (`TimelineRow[]`), rendered as `.terminal-os-tl`: `year | mon | subject | tag | bracket | label`
  (narrow: stacked, same grid minus the bracket columns). The bracket glyphs are cells, so they stay straight and never clip.
  `dur()` counts months and rounds to years (Aug 2020 → Jul 2024 reads `4 yrs`). Default view hides side/learn rows older than the work
  period except period edges; `timeline --all` shows everything. `TermPeriod` gained `grade` (own tone) and `note`; `branch: "life"` rows
  (born, Dec 2002) are dim with a `●`.
- **Data (Ratul):** school 2004-04 → 2020-03 (class 10 85.66%, class 12 79%), college 2020-08 → 2024-07 (cgpa 7.75/10), work 2024-10 → now.
- **Tab never leaves the prompt.** It completes, prints the candidates, or flashes the caret (`terminal-os-bell`, 120 ms). Pane buttons and
  touch chips are `tabIndex={-1}`.
- **Eleven themes** (accent, amber, green, paper, dracula, nord, gruvbox, solarized, monokai, matrix, cyberpunk). `theme` opens an
  arrow-key menu (`MenuId` `themes`) that previews live and restores on Esc; `theme <name>` and `theme random` work. Dim text is at least 4.5:1
  on both backgrounds (computed). The brief said ten but listed eleven; all eleven ship.
- **Hub → Engineer, Normal mode.** Any `via` (hub or normal) lands on the terminal root; only direct visits resume the remembered view.
  The doorway click marks the chapter button busy and zooms the display at once (`onWaiting`), reset on a bfcache `pageshow`.
- **Polish:** `portfolio` puts the `→` commands at the right end of each section's last line on wide screens (`links.lead`); the status bar has a
  green `open to work` item that runs `hire`; `now` prints `TerminalData.now`, and the pane's Who block shows its first line.
- Dev note: after CSS-only edits the dev server sometimes serves a stale stylesheet; a real content change to `globals.css` recompiles it.

### 6.14 Round 1m: school milestones, Tab cycling, a seamless hub → persona hand-off (Ratul + lead recording, 2026-11-10)

- **School milestones carry their grade.** `TermCommit.grade`; `2018-03` Secondary (class 10, 85.66%) and `2020-03` Higher secondary (class 12, 79%)
  are entries with a green grade after the tag, outside the clipping `.tl-text`. `TimelineRow` has `grade` (entry) and `periodGrade` (bracket label)
  so they never collide; college keeps `cgpa 7.75/10` on its label. Rows with a grade count like period edges in the default view.
- **Tab cycles like a shell's menu-complete.** First Tab with 2+ candidates inserts the common prefix and prints one candidate line (an OS entry
  with an id); each further Tab fills the word with the next candidate and moves a highlight in that same line, Shift+Tab goes back. The cycle dies on
  any other key, a click, or when the input no longer equals the last step; Esc while cycling restores the typed word. `portrait`, `timeline`
  and `ls -l` now complete. In `/` palette mode, Tab/Shift+Tab move the highlighted match (a lone match is still picked).
- **Curtain.** Taking a Normal doorway mounts `.hub-curtain` (`#05060a`, a 1 px hairline in the persona colour sweeping 1.2 s then pulsing, and
  `opening <host>…`). It fades in from 220 ms into the zoom, so the card dissolves into it, not into a hole; it stays until the page unloads and is
  removed on a bfcache `pageshow`. Reduced motion: instant, navigation after 80 ms.
- **Prerender on intent.** `lib/site/speculate.ts` injects one `speculationrules` script (`prerender`, `eagerness: immediate`, `?via=normal`) on hover,
  press or focus of the chapter button and the display; one persona at a time, skipped on data-saver, `link rel=prefetch` where rules are unsupported.
  Persona hosts are same-site cross-origin, so every response sends `Supports-Loading-Mode: credentialed-prerender` (`next.config.ts`, chore commit).
- **No side effects before activation.** `lib/site/prerender.ts` `whenActive` runs the terminal boot and `WorldBoot`'s entry animation on
  `prerenderingchange` (and sets `<html data-prerendered>`); the usage beacon is skipped while prerendering. Ambient sound and `track` only fire
  from user gestures, so they cannot run early.
- **No blank frame.** With `via=normal` the server renders the terminal in os mode with the banner as static markup; the boot effect swaps in the
  identical banner in the same commit (no double banner) and skips the ssh script. The root fades in over 240 ms (`.is-via-normal`; a prerendered
  page holds `.is-arriving` until activation). `html:has(.terminal-root)` paints `#05060a` so no white can show between documents (scoped, not
  global, so the light personas keep their canvas).

## 7. Netflix view (round 2, renamed round 11)

Route `/engineer/netflix` (`/engineer/series` redirects; a remembered `series` reads as `netflix`), wrapped in `ViewShell` (remembered as `xp-view:engineer`, Esc returns to the terminal). The
registry entry is `enabled: true`, so `view netflix`, the pane row and the picker list it. Code: `lib/site/netflix-data.ts`
(pure), `app/components/views/netflix/` (`netflix-view`, `-hero`, `-rows`, `-modal`, `-topbar`, `-store`, `-sound`, three stylesheets, class prefix `nf-`).

- **Who's watching.** Three tiles (Recruiter in the persona accent, Developer teal, Full story amber), each a `<button>`;
  arrows move, Enter picks. The pick is remembered in `localStorage` `xp-nf-profile` (the old `xp-series-profile` is still read); a remembered profile skips the
  screen and shows a `Switch profile` chip. `?profile=recruiter|developer|story` deep-links and is stripped from the URL.
- **Profiles are orderings of one dataset** (`buildSeries`), not different data:
  - Recruiter: Work seasons (main branch, newest first), Projects, Skills, Certifications (learn-branch episodes from
    college on), To be continued. No school seasons.
  - Developer: Projects, Stack (résumé skills, `data.stack` first), Side quests, Work seasons, Writing (only when there
    are posts), To be continued.
  - Full story: one row per year with episodes, `Season 2002 · Born` to `Season 2026`, school and college included with
    grades, then To be continued. The sticky bar lists the seasons here and the rows in the other two.
- **Hero.** Key art is the generated portrait (`blocks`, 160 columns, accent at 18%) drawn after `requestIdleCallback`,
  so the title is the LCP. Kicker, title, tagline (the engineer's first phrase), the résumé summary clamped to two lines,
  three fact pills, `open to work` in `--ok`, Play and View résumé.
- **Play is the trailer.** A teleprompter in the hero: eight lines from the hero facts, the two newest main episodes
  and the status line, typed over about 14 s with a progress bar and `skip`. Esc, skip or a click ends it and scrolls to
  the first row. Reduced motion or `via=normal`: all lines at once, a 2 s hold.
- **Rows.** Episodes (16:9, branch-tone gradient, `S2026 E3`), project posters (2:3, stretched title link, Live/Code),
  skill tiles. Wheel scrolls a row sideways only when it overflows and the gesture is sideways or shift; edge buttons on
  hover; scroll snap; cards peek on phones. Hover grows an episode card 1.08 after 180 ms and shows its synopsis. Cards
  without a link open one inline sheet under the row (focus trapped, restored on close, Esc or x).
- **Data vs. labels.** Episodes, projects, skills, posts, facts, contact and the status all come from `terminalData`
  (timeline, résumé, content layer). Only the row titles, profile names and the footer line are literals. Episode `href`
  is set when a commit's tag equals a project slug.
- **Round 11: the Netflix feel.** Brand rule: the name and the layout follow the product; no logo, wordmark or red N (our `R`).
  - *Detail modal* (`netflix-modal.tsx`): any card opens it, FLIP from the card rect (380 ms), `?title=<id>` deep link (stripped on
    close), dialog + focus trap + Esc/backdrop/x, body scroll locked, focus back to the card; phones get a full-screen sheet with a
    pull handle and swipe-down. Billboard (portrait at low opacity, big letter for projects/skills/posts), Play (six-second
    teleprompter; a project's Play opens its live URL), My List (`xp-nf-list`), thumbs-up (`xp-nf-likes`, local only), sound toggle
    (`xp-nf-sound`, default muted; WebAudio two-note chime on open). Meta row (`New` for episodes under 90 days, `S<year>`,
    `E<n>`, runtime, grade, branch), Branch / Tags / "This series is" adjectives (`NF_ADJECTIVES`), the season's episodes (click or
    arrows swap in place, season select), More like this (6, same branch / stack / group), About.
  - *Chrome*: fixed top bar (transparent, black after 80 px; Home, Series, My List, Profiles, expanding instant search that
    replaces the rows with a grid, Esc clears; profile tile). Hero: More info, trailer auto-plays after 3 idle seconds (silent,
    Skip pill, not under reduced motion). `Top 10` badge on Shift Roster v2.0. Continue watching (`xp-nf-progress`) and My List rows
    first when non-empty. Hover panel on desktop episode cards: play, add, like, more; soft tick when unmuted. Who's watching:
    staggered fade-in, Manage Profiles (pencil overlays, toast). Skeleton rows until the portrait is drawn.
  - *Not done*: hover controls only on episode cards; the "match %" is replaced by `New` / season (no fake score).
  - Dev needs `next dev --webpack` inside a git worktree (Turbopack rejects a `node_modules` junction that points outside the root).

## 8. Two résumés (round 3, round 14)

**Round 14: there are two.** *Submitted* = `public/Ratul_Roy_Resume.pdf` (the hand-made file; `TerminalData.resumeFiles.submitted`, which the admin console will own). It is the default: `resume --pdf` and every View résumé link open it. *Generated* = the data-built PDF below, reached only through `resume --build` (and `/resume.pdf`). `resume --build` calls `/api/resume/build` (SSE: `collect layout fonts render verify`, each with its ms, then `done` with `{token, bytes, pages, ms}` or `error`); the terminal shows a bar and one line per stage, then `preview · download · share`. Bytes live in a `globalThis` Map (10 min, 20 entries) served by `/resume.pdf?build=<token>` (`&download=1` = attachment `Ratul_Roy_Resume_<date>.pdf`; expired = 410). The verify stage fails the build on a phone-number-shaped run. `/resume.pdf` is now `force-dynamic` (a static route never sees the query) and keeps its Cache-Control. Fit sheet availability reads `employed · Altimetrik · notice period applies · ask`.

### Generated résumé (round 3)

`/resume.pdf` is built from the same data as the terminal and the Netflix view (`RESUME`, `TIMELINE`, `TIMELINE_PERIODS`, contact links, public projects), so editing one place updates all three. One A4 page, ATS-friendly (real text, no tables, no icons, no fills), Inter, a thin persona-accent rule. The résumé-worthy bullets are listed in `RESUME.pdfBullets`. No phone number, ever. The hand-made `public/Ratul_Roy_Resume.pdf` stays until Ratul has compared the two.

## 9. stats (round 4)

`stats [year|langs]` draws the GitHub year in the terminal: a heatmap (53 weeks wide at 80+ columns, the last 26 weeks narrower), then `<total> contributions in the last year · current streak n d · longest n d`, then a language bar with labels. `year` is only the grid, `langs` only the bar. A failure prints `stats: github did not answer · try again later`, never throws.

- **Route** `app/api/github/contributions/route.ts` (Node runtime, ISR 6 h, `Cache-Control: public, s-maxage=21600, stale-while-revalidate=86400`). Source 1 is the GraphQL API when `GITHUB_TOKEN` is set (server env only; optional, a no-scope classic PAT is enough); source 2 parses the public `github.com/users/<handle>/contributions` HTML (cell `data-date`/`data-level` plus the tooltip count) and takes languages from the REST repo list (repos per language). Under 300 days parsed answers `502 {error:"shape"}`. The handle comes from `personaIdentity("engineer")`. The route prefers IPv4 (`dns.setDefaultResultOrder`), because some networks hand out IPv6 addresses that never answer.
- **Client** `lib/site/terminal-stats.ts` (types, validation, week grid, month labels, language blocks) and `app/components/views/terminal-heatmap.tsx` (`Heatmap`, `LangBar`). Cached in `localStorage` `xp-gh-stats` for 6 h; the pane's Live block shows `<total> contributions · <n> d streak` from that cache only (no fetch on boot).
- **Colour**: five shades are `color-mix` of the theme accent over the window colour (`--hm-0 … --hm-4` on `.terminal-hm`); `paper` overrides 1-3 to read on a light page. Cells fade in column by column over 600 ms, no animation under reduced motion. Hover shows `3 contributions · 2026-04-12` in a dim line under the grid and as the cell `title`.
- **Not done**: the numbered tips box stays at seven rows (a number maps to a row; an eighth would break `1-7`); keyboard focus per cell (371 tab stops would hurt more than help).

## 10. share and previews (round 5)

`share [cmd]` prints `https://code.ratulroy.me/?run=<cmd>` and the preview image `/og?cmd=<cmd>`, with a `copy` token (clipboard, "copied ✓" for 2 s, aria-live polite) and, where `navigator.share` exists, `share…`. No argument: the previous command in history (not `share`), else `portfolio`. Unknown: `share: 'x' is not a command · try share timeline`.

- **`/og`** (`app/og/route.tsx`, Node runtime, `force-dynamic`, cacheable through `Cache-Control: public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000`, `X-Robots-Tag: noindex`): runs the real shell on the server (`lib/site/og-lines.ts` flattens entries to coloured lines), draws a 1200x630 terminal frame with JetBrains Mono (26 KB subset in `public/fonts/`). Allowlist: help whoami timeline portfolio stack projects resume contact now hire stats theme neofetch views portrait, plus `view <id>`; anything else draws `portfolio`. `stats` draws the heatmap as squares from the contributions route (called as a function); `portrait` draws a 48-column block portrait sampled with sharp. Errors draw a fallback image, never a 500 (unless the font itself is missing).
- **Palettes** live in `lib/site/terminal-themes.ts`; the ten `.terminal-root[data-theme]` CSS blocks are generated from them (`themeCss()`, rendered as a `<style>` by the terminal) and removed from `globals.css`.
- **Metadata** (`lib/site/share-meta.ts`): Engineer page `?run=<known cmd>` gives title `$ cmd · Ratul Roy`, description from the first real output line (else the command's `desc`), `og:image`, `twitter:card=summary_large_image`; no `run` uses `/og?cmd=portfolio`. View pages use `view <id>`; the hub uses `portfolio`. `proxy.ts` lets `/og` through on every host.
- **Deviations from the brief**: the frame fits 16 output lines at 20 px / 28 px (22 px x 22 lines cannot fit 630 px), shell run at 84 columns; the portrait is 48 columns beside an identity block, not 60x28; tips box now has eight rows (numbers 1-8).
- **Known trap**: `next/og` rasterises with the sharp copy inside `next` (0.34.5); the app's own sharp (0.35.3) loaded into the same process breaks it ("colourspace: parameter space not set"). The route borrows next's copy for the portrait. Pin the app's `sharp` to 0.34.5 to dedupe for good, and restart `next dev` if it was ever loaded alongside the other.

## 16. Terminal, bolder (round 12)

Six small features on the Engineer terminal; all client-side, no new tables.

- **Ghost suggestion** (`lib/site/terminal-suggest.ts`, `ghostFor`): the rest of the best completion is drawn dim after the caret (the prompt text is already a drawn mirror of the hidden input, so the ghost is one more span in it and cannot drift). Order: a bare `view ` / `theme ` / `portrait ` gets the most-used argument from the history, else the first candidate; otherwise the most recent history line that starts with the input; otherwise the first `complete()` candidate. Right arrow or End at the end of the input accepts; Tab is unchanged. Nothing shows in the palette, the mail form, paging or the boot typing.
- **Did you mean**: an unknown command prints `bash: <x>: command not found` and a dim, clickable `did you mean: a · b?` (Damerau-Levenshtein, at most 2, at most 1 for words of 3 letters or fewer, over command names and view ids). `1`-`8` shortcuts are untouched.
- **`fit`** (`lib/site/terminal-fit.ts`): paste a job description (box under the prompt, Ctrl+Enter or `match`, Esc cancels; 8 KB max), or `fit <text>`. A skill table lists what I have (must also be in the résumé lists or `stack`), what is adjacent (Kafka shows RabbitMQ, Node shows TypeScript) and what I do not have yet (Docker, Kubernetes, AWS, Go, ...). The card shows chips, a verdict from the counts (strong at 70%, good at 45%, else partial; adjacent counts half; percentages of recognised skills only) and `hire --brief · mail --fit · resume --pdf`. Nothing is sent: the pasted text never reaches the history, the beacon sends only `fit`.
- **`arch`** (`lib/site/terminal-arch.ts`, `TerminalData.arch`): four diagrams as data (nodes with a kind, edges with a short label, notes). Layered layout on a character canvas: column = longest-path depth, edges between neighbouring columns with one lane each, junctions from a direction bitmask. Wide when it fits the line, else one block per layer with `↓` lines. Hover or focus a box to light it and its arrows. Project cards carry an `arch <id>` token via `TerminalData.projectArch`. Labels of several edges into one box share its last run: only the first is drawn.
- **Screensaver** (`terminal-saver.tsx`): 90 s idle (120 s on a phone), tab visible, nothing open that wants keys. The matrix portrait re-renders at about 7 fps with its threshold drifting (`renderPortrait(..., bias)`), local time, and `press any key · N contributions this year` (cached stats, else `type portfolio`). Fades in over 600 ms, any key or tap ends it in 200 ms and is swallowed. Reduced motion: still image. `screensaver`, `screensaver off|on` (`xp-term-saver`).
- **Presence** (`lib/site/terminal-presence.ts`): Supabase Realtime presence on `terminal:engineer` with the browser anon client; each tab tracks a random id and a time. `· n here now` in the status bar and `visitors · n here now` in the pane, only from 2 up. Joins 3 s after ready, leaves on pagehide, skips on saveData, silent on any failure. Needs "allow public access" on in the project's Realtime settings.

## 11. PWA (round 6)

The terminal installs and opens offline.

- **Manifest** (`app/manifest.ts`, per host from the `Host` header): engineer host "Ratul Roy · code", accent as `theme_color`; every other host the plain hub "Ratul Roy". `start_url` `/?via=pwa`, standalone, void background. Icons from `scripts/make-icons.mjs` (sharp; the Fraunces R outline is embedded, so no font is needed): `public/icons/icon-192|512|maskable-512.png`, `public/apple-touch-icon.png`, each under 25 KB.
- **`?via=pwa`** is a direct arrival (no hub hand-off), prints `[ok] installed · running as an app`, and the parameter is stripped. In `display-mode: standalone` the boot also prints `[ok] app mode · works offline`.
- **Service worker** (`public/sw.js`, hand-written, one file for all hosts): precache of the shell, résumé, portrait, manifest, icons and the Next static files listed in `public/sw-manifest.json` (generated after `next build` by `scripts/sw-manifest.mjs`, gitignored). Pages network-first (3 s) with the cached `/` as fallback; `/_next/static` cache-first (network-first in dev, where names are not hashed); images, fonts, pdf, `/og` stale-while-revalidate; `/api` and cross-origin never touched; RSC fetches left alone. Cache `xp-v<build>`; old ones deleted on activate; `skipWaiting` + `clients.claim`, and a `sw-updated` message makes the status bar show `● update ready`.
- **Dev flag**: the worker is registered in production only, or in dev with `localStorage["xp-sw-dev"] = "1"` (remove it and reload to unregister).
- **Terminal**: status bar `○ offline` (online and `offline` events, or a failed network call), pane Live block says `offline · showing what you saw last`, `curl github`, `stats` and `mail` print `offline · this needs a connection` (mail prints the message back, nothing queued). New `install` command (Chrome prompt held in `window.__xpInstall`, iOS share-sheet hint, already-installed, honest no) and tips row 9 (numbers now 1-9).

## 12. Languages (round 7)

`lang bn` and `lang hi`: the terminal speaks Bengali and Hindi. Commands stay English (they are code); the prose changes.

- **Strings**: `lib/site/terminal-strings.ts` (`STRINGS: Record<Lang, TerminalStrings>`, `t(key, lang)` with an English fallback and a development-only warning) defines every sentence in `en`; `terminal-strings-bn.ts` and `terminal-strings-hi.ts` must provide every key (the compiler checks). Interpolated strings are functions. Technical nouns (API, Next.js, GitHub, view, project, stack) stay in Latin script; numbers stay Western digits.
- **Data**: `terminal-data.ts` gains `I18N` (`who`, `role`, `city`, `uptime`, `summary`, `status`, `now`, `proof`) for bn and hi; everything else in the data (project titles, résumé bullets, arch diagram text, dates and month names) stays English.
- **Shell**: `run(input, state, { cols, lang })`, `banner(lang)`, `fit(text, lang)`, `docs(lang)` (palette and `man`). Output printed earlier is never rewritten.
- **`lang [en|bn|hi]`**: no argument prints a menu (current one marked); an argument switches, remembers it in `localStorage` `xp-term-lang`, re-renders the pane and status bar, and confirms in the new language. `?lang=bn` on the address applies and is stripped, like `?run=`. The boot hint offers `lang bn` or `lang hi` as one dim line only when `navigator.languages` lists it and nothing is saved.
- **`help`** is now four short groups (`start here`, `read`, `live`, `terminal`); `help --all` lists everything under the older four; `man` stays complete.
- **Fonts**: Noto Sans Bengali and Noto Sans Devanagari (400, `display: swap`, not preloaded: fetched only when a page shows the script) follow Geist Mono in the font stacks, so Latin stays mono. A Bengali, a Hindi and a Latin line have the same box height (checked at 26 px). The terminal region carries `lang` and `data-lang` so screen readers switch voices.
- **Not in scope**: the Series view and the hub stay English. The `date` and `cal` output, the heatmap and diagram widgets' accessible labels, `neofetch` row labels and the saver clock stay English.

## 13. hire --brief (round 8)

`hire --brief` (also `hire brief`) prints the one-screen fit sheet a recruiter can forward: `fit sheet · Ratul Roy · YYYY-MM`, then `roles` (three roles and the level), `stack` (core, plus dim), `where` (Bengaluru, modes, relocates, visa), `when` (availability and compensation), `proof`, `reach`.

- **Data**: `TerminalData.hiring` (`HIRING` in `terminal-data.ts`). `availability` and `compensation` are deliberate `· ask` placeholders, drawn dim; Ratul fills the real values (later: admin console). linkedin and github come from `contact`, so they cannot drift.
- **Reach tokens**: `mail` (runs `mail --fit`), `linkedin`, `github`, `resume --pdf`, `copy` (the whole sheet as plain text, wrapped at 72 columns, links as full URLs; reuses the round 5 `act: "copy"` token and its `copied ✓` state) and `share…` (the `?run=hire%20--brief` link, where the browser has a share sheet).
- **`mail --fit`**: the message step starts with `Hi Ratul — saw your fit sheet (code.ratulroy.me). We are hiring a <first role>; the stack is <first five core items>. Can we talk this week?` in the input, editable; Enter keeps the line, an empty line sends. The lead is stored with `source: hire-brief` (`/api/lead` allow-list; the column is free text, no migration).
- **Layout**: 60 columns or more: left rule like `portfolio`; narrower: no rule, one item per line, tokens on two lines. Short `hire` ends with a dim `hire --brief · the one-screen fit sheet`; the pane's `hire` button tooltip adds `--brief for the fit sheet`.
- **Strings**: `hb.*` keys in en, bn and hi.

## 14. Clock (round 9)

The terminal follows the visitor's clock, never over a choice they made.

- **Data:** `TerminalData.clock` (`lib/site/terminal-data.ts`): five hour bands (night 0-5 matrix, dawn 5-9 solarized, day 9-17 accent, evening 17-21 gruvbox, late 21-24 dracula) each with a greeting and a hint, a weekend greeting/hint, and `myTz` (Asia/Kolkata). English reads the data; bn and hi read `clock.<band>.greet/hint` in `terminal-strings*.ts`.
- **Rules:** the band comes from the visitor's local hour (`lib/site/terminal-clock.ts`). Its theme applies only when `xp-term-theme` is unset and is never persisted; `theme <name>` persists and wins; `theme auto` clears the key and sets `xp-term-theme-auto=1`. The boot hint line is `<greet> <hint>`: first visit uses the band hint, a returning visitor keeps `hint.back`, and a weekend swaps in the weekend hint for both. The bn/hi language hint line is untouched.
- **Surfaces:** `theme` menu first row `auto · follows your clock (<band>)` (previews the band theme; numbered picks shift by one); `now` first line `<greet> it is <time> where you are`; one dim pane line `it is <time> for you · <time> for me in Bengaluru` (12-hour am/pm in en, 24-hour in bn/hi), refreshed every 20 s, no seconds. `theme [name|auto|random]` has a man page and completion. The screensaver clock and the pane share `hhmm` / `say` in `terminal-clock.ts`.
- **SSR:** the clock is client-only; the pane line renders a reserved two-line blank until mount, the boot lines are typed after mount.
- **Phones:** the side pane is hidden at 393 px (as before), so the clock line is in the DOM but not visible there; `now` carries it on phones.

## 15. Worlds pulse (round 10)

The engineer terminal quietly points at the other five personas with one live line each.

- **Interface** (`portfolio-site/lib/worlds/pulse.ts`): `WorldPulse = { persona, line, detail?, at (ISO), href, source: "stub" | "content" | "live" }`; `getWorldPulses()` asks one provider per persona, `providers/<persona>.ts`, each `type WorldProvider = () => Promise<WorldPulse | null>`. A throwing provider yields null; the others still answer. To wire a real source (admin console round) replace the body of one provider file and keep the signature; nothing else changes. `line` carries no relative time: the terminal appends `· <ago>` from `at` for content/live and `· soon` for stubs.
- **Providers today:** trader (newest `trade` entry: `last trade: <instrument> <direction>`), photographer (`photo`), artist (`artwork`), ride (`ride`, with km), gamer (`game`, playing/last played) read `listEntries(persona)` (public rows only) and fall back to an honest stub (`watching the open · notes resume soon`, `last frame: none yet · gallery in the making`, `the sketchbook is private for now`, `no rides logged yet`, `season in progress`). Engineer: `github · last push` from the public events endpoint (1 h fetch cache, ipv4first), null if GitHub does not answer. No numbers are invented. Fixtures only hold engineer entries, so with no Supabase env all five others are stubs.
- **Route:** `GET /api/worlds/pulse` returns `{ pulses, fetchedAt }`, `revalidate = 1800`, `Cache-Control: public, s-maxage=1800, stale-while-revalidate=86400`. Public data only.
- **Terminal:** `lib/site/terminal-worlds.ts` (cache key `xp-worlds-pulse`, 30 min; validation; names and colours from the brand and spectrum). The pane loads it once, 3 s after ready (skipped on save-data or offline), and shows two lines at the end of Live: `<persona coloured> · <line>`, links to that world's host through `personaHref`; every 20 s the pair swaps hard (reduced motion keeps the first two). The engineer is never shown. Omitted when offline or the route fails.
- **`worlds` command** (read group): a row per persona (dot, name, handle or phrase, pulse line, `→ open`), then the footer `one person · six worlds · the hub has them all → ratulroy.me`. Offline it still prints the rows without pulse lines. `portfolio` gains a `worlds` section after `views` (names on one line, `→ worlds`). Strings in `terminal-strings*.ts` (`cmd.worlds.desc`, `pf.worlds`, `worlds.*`).
- **Not done:** `worlds` is not in the OG allowlist; ride and trader share a green on the spectrum (auto placement).

> **Admin console (round 13):** the view registry, the terminal's data, timeline, `arch` diagrams, themes
> and translations are now `site_settings` keys (`engineer.views`, `engineer.terminal`, `engineer.timeline`,
> `engineer.arch`, `engineer.themes`, `engineer.i18n`) with the code constants as defaults; see
> `16-admin-console.md` section 5.
