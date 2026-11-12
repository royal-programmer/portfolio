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
  - **Netflix, part A (round 16).** Five additions, all copy and rules in `lib/site/netflix-data.ts`:
    - *N1 previews*: after 800 ms of mouse hover an episode card's art types its synopsis (max 140 chars, 24 chars/s, mono, dark
      gradient; soft tick every 4th char when unmuted). One card at a time, none on touch, instant under reduced motion.
    - *N2 Because you opened*: `becauseRows` derives up to two rows after Continue watching from `xp-nf-progress` (seed = most
      recently opened; up to 8 cards sharing the branch or two tags/stack entries, date desc, never a Continue card). The topbar
      Profiles menu (profile tile and "Profiles") now holds Switch profile, Replay the recruiter cut and Clear watch history (confirm
      toast, clears progress, list and likes).
    - *N3 recruiter autopilot*: `netflix-autopilot.tsx`; `RECRUITER_CUT` (data) resolves to three card ids (Shift Roster v2.0, 11 Python
      automations, the API Test Center project). 30 s each: scroll, open with a 27 s teleprompter, close; then scroll to To be
      continued and pulse Say hello. Rail under the top bar (three dots, 90 s fill), Skip to contact, X. Any trusted pointer/wheel/touch/key
      stops it (synthetic Escape is ignored); nothing prevents default, so touch scroll is never blocked. Starts only on a fresh Recruiter pick
      (not deep links or restored profiles), once per device (`xp-nf-autopilot-seen`). Reduced motion: no play, a "Start here" badge on the
      three cards. With a modal open the pill drops to the bottom corner.
    - *N4 season recaps*: a small play button beside each season chip (full story only) types `seasonRecap(show, year)` in the hero trailer
      panel (20 s, Skip, mute); Play still plays the profile trailer.
    - *N5 cast and crew*: `buildCast` = `data.stack` ∪ résumé skills with alias folding (`CAST_ALIASES`) and counts over episodes and
      projects (technologies with 0 mentions are left off). Row "Cast · the stack" after Skills / Stack / last season. A tile filters every
      row (`?cast=<key>`, "Showing: X · clear" pill under the season bar); the modal's meta column has `Cast:` chips doing the same.
  - **Netflix, part B (round 17).** Five more, the engine and strings shared with the terminal:
    - *N6 watch-party link*: the modal's Share icon (beside the close button) copies `<origin>/netflix?profile=<p>&title=<id>` (the dev origin while on localhost, `https://code.<root>` otherwise; `navigator.share` on phones) and says "link copied" for 2 s. `/og?cmd=netflix:<id>` (`lib/site/netflix-og.ts` + `NetflixBody` in `app/og/route.tsx`) draws a 1200x630 card: the branch-tone gradient, S<year> E<n> numeral, title, one synopsis line, the R mark and `code.<root>/netflix`. `generateMetadata` for the view reads `title` and `profile` from `searchParams`, sets `og:image` to that card and the description to the synopsis.
    - *N7 fit ratings*: the fit matcher already lived in `terminal-fit.ts`; it now takes a `FitPool` and exports `jdWanted` / `textFit` (terminal output unchanged). A paste of 200+ characters into the search box (or a long typed line) is a job description, held in memory only. Every card shows `<n>% fit` (weighted skills it mentions, have = 1, adjacent = half, over at most four wanted skills); each row sorts by it; a `Fit: <k> skills matched · clear` pill sits under the bar. Without a description the card slot is empty (the card never carried a `New` badge; that stays in the modal).
    - *N8 subtitles*: a `CC` toggle (`xp-nf-cc`) on the hero, the trailer foot and the modal bar. With `xp-term-lang` = bn or hi the typed trailer, recap and teleprompter lines get a subtitle line from `netflix-subs.ts`: the fact lines from the translated uptime line, the status from `TerminalData.i18n`, the labels from new `nf.*` keys in all three strings files. With English the toggle shows "CC off · pick lang bn or hi in the terminal".
    - *N9 keys*: `netflix-keys.tsx`, one window listener over the page's lines (top bar, hero buttons, rows): arrows move, Enter opens, `/` search, `m` mute, `p` Profiles, `?` the overlay (also Profiles > Keyboard shortcuts). The first arrow press with nothing focused lands on the first card. Focus frame = hover (3px accent outline, scale 1.04). `aria-live` announces "Row · i of n · title". Modal: Backspace closes, Right / Left step episodes. Touch and wheel scrolling are untouched.
    - *N10 end card*: on a season's last episode, Next (Right key or the Next button) or the teleprompter ending swaps the modal to "Season <year> complete", then "Next season starts in <n days>" when `now.month`'s year is later than the season's (the gap between this season's last episode and the next one's first, as the data has it), else "This is the current season", the `now` lines, Say hello / LinkedIn / GitHub / Back to the terminal and, when a later season exists, Watch next season. The guided recruiter play skips it.

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

## 17. profiles, phone gate, menus by touch (round 15)

- **`profiles [group]`** (`code learn work social`): every place I am, from `lib/site/profiles.ts` (data, admin-configurable later). Rows print at once; live numbers fill in place from `/api/profiles` (GitHub repos and contributions, Stack Overflow rep and answers, Holopin badges, HackerRank level, LeetCode solved; 4 s timeouts, 6 h cache, any failure is just a missing number). LinkedIn has no public API: a dated static note. No Naukri row (recruiter-only profiles); `hire --brief` prints a dim `also on Naukri` note from `hiring.alsoOn`. LeetCode is probed (`royal-programmer`, `royalprogrammer`, `royal_programmer`) and shown only when found. Hub closing section and the Netflix "To be continued" card read the same list.
- **Phone gate**: a full-width `Skip the headset · Normal view →` pill under "Put on the headset" (max-sm); the header Immersive/Normal switch shows `I` / `N` on phones (full aria-labels).
- **Menus by touch**: a coarse-pointer footer `tap a row · or type its number · Esc closes`, `↑ ↓` chips while a menu is live, transcript `touch-action: pan-y`. Root cause found for "views do not scroll": the hub set `html.scroll-locked` (`overflow: hidden`) and never removed it on unmount, so a view opened in the same document stayed frozen; the hub now cleans up and `ViewShell` clears it on mount.

> **Admin console (round 13):** the view registry, the terminal's data, timeline, `arch` diagrams, themes
> and translations are now `site_settings` keys (`engineer.views`, `engineer.terminal`, `engineer.timeline`,
> `engineer.arch`, `engineer.themes`, `engineer.i18n`) with the code constants as defaults; see
> `16-admin-console.md` section 5.

## 18. Stage, part A (round 18)

The Engineer's Stage (`/engineer/stage`, Immersive) now has a desk that works. Four ideas shipped, one commit each.

- **S1 Boot into the screen.** The laptop shows the live terminal: `app/components/stage/terminal-screen.ts` draws a 1024x640 `CanvasTexture` (at most 6 fps, only when a typed character, row or theme changed): the banner, then `portfolio` typed, then its first 8 output lines, taken from the same pure shell the preview image uses (`ogLines`). The drawn editor stays on the glass until the first draw. Click or tap the screen (pointer cursor and a glow on hover) and the camera glides into the screen (700 ms, 450 ms on a phone), a theme-coloured overlay takes over for the last stretch, then the terminal opens at `?via=stage`, which `/[persona]` maps to `via=normal` (instant boot, fade in, no remembered view). Reduced motion navigates at once. Esc/Back return to the stage as before.
- **S2 A desk that tells time.** `lib/site/stage-data.ts` holds `STAGE_LIGHTING` (a preset per round 9 band id: key, fill, rim, ambient, screen glow, lamp on/off, window colour and brightness). `stage-look.tsx` tweens it over 1.2 s on load and whenever the band changes (checked each minute; reduced motion applies it at once); lights stand relative to the camera. `desk.tsx`: desk slab, lamp (emissive bulb plus a point light) and a window plane (excluded from the camera fit with `userData.noFit`). The screen's theme is the visitor's saved terminal theme, else the band's.
- **S3 Objects that are commands.** `STAGE_PROPS` (`id, label, cmd, kind`) in `stage-data.ts`: mug `now`, notebook `timeline`, phone `contact`, headphones `sound`, sticky note `hire`. Primitives only (`props.tsx`), each with a generous invisible hit box and a drei `Html` label (11px mono, accent). Click runs the command: `now`, `timeline`, `contact`, `hire` open the terminal at `?run=<cmd>&via=stage` (a full page load: the terminal reads `run` when it mounts, which a client-side push would be too late for); `sound` toggles the site's `sound-enabled` setting through the `stage:sound-toggle` event and the headphones glow while it is on. The HUD strip under the stage lists the same props as text buttons (`now . timeline . contact . sound . hire`); focus or hover on a button lights the prop. Phones: the first tap shows the label for 1.5 s, the second runs it.
- **S8 Progressive scene.** The stage's box holds a server-rendered SVG silhouette of the desk (accent at 15%) that fades out when the first WebGL frame is drawn. Until the studio environment exists the laptop and desk are flat accent `MeshBasicMaterial` at 25%; they swap to the studio materials when `StudioEnvironment` reports ready. Performance marks: `stage:first-frame`, `stage:materials`, `stage:screen-live` (`performance.getEntriesByType("mark")`).
- **Not done / notes.** Props do not yet have admin-console forms (the data shape is ready). Only the engineer stage has the desk; other personas keep their assemblies. The three marks sit within a few milliseconds of each other, because the environment texture is built synchronously at mount.

## 19. Stage, part B (round 19)

Three more Stage ideas, one commit each. New data lives in `lib/site/stage-data.ts` (shelf, stops, copy) and `lib/site/stage-constellation.ts` (the pure star layout).

- **S4 Project shelf.** Two planks (one merged mesh) behind the desk and a slim case per public project, drawn as ONE `InstancedMesh`: a single canvas atlas holds a row per case (the spine label in mono, persona accent; a dim row for in-development ones), and a tiny `onBeforeCompile` patch offsets each instance's UVs by its row. Two draw calls for the whole shelf. Cases: public projects first, then `STAGE_DEV_PROJECTS` (API Test Center, unless it is already a project), at most 8; more become a last "+n more" case that opens `projects` in the terminal. Hover (or HUD focus) pulls a case out 0.34 units (about 6 cm of the laptop's scale) with a label; a click, a tap, or the HUD button flies it forward, turns its cover to the camera over 600 ms, then navigates to `/engineer/<slug>`. With `document.startViewTransition` a box named `case-<slug>` sits over the case and the project page's header carries the same `view-transition-name`; without it, or with reduced motion, a 200 ms fade. A slow page only costs the morph. Dev cases open `projects` in the terminal. The HUD strip lists the cases as buttons after the props. Note: the content layer currently holds one public project, so most of the shelf was checked with temporary extra dev entries.
- **S5 Skill constellation.** Stars for the terminal `stack` then the resume's skills (deduplicated, at most 28; 14 on a phone), placed on a sphere cap above the desk by an FNV hash of the name plus a short repulsion pass. Lines join technologies that share an `arch` diagram node label (every word of the technology in the label) or one project's stack. One `Points` (soft sprite, per-star colour and size via a patched `PointsMaterial`) and one `LineSegments`: two draw calls. Hover lights the star, its neighbours and the lines between them with a mono label showing the command; click runs `stats langs` (languages), `arch <id>` (exactly one diagram) or `stack`. Picking is in screen space on the canvas, so it never competes with the desk's hit targets, and only while the camera looks at the stars. Phones: first tap names, second runs. Reduced motion: no slow rotation. The stars fade in as the camera leaves the desk, so the hero frame is unchanged.
- **S9 Scroll-driven story.** The stage sits in a tall container (100svh plus 80svh per stop; 55 on a phone) with the stage and the HUD `position: sticky`. Scroll progress (native scroll, one rAF-coalesced listener) becomes `p` in 0..3; the rig eases it and glides the camera between four poses in `STAGE_STOPS` (desk = the stage's own camera; shelf; constellation; window), defined in the assembly's frame and carried to the world through the `stage-extras` group, with a narrower frame standing further back. Panels (Projects, Stack, Contact with mail, hire, `resume --pdf`, LinkedIn) fade at their stops, in plain DOM; the projects grid, blog strip and identity panel stay below, untouched. A dot rail (portaled to the body, buttons, keyboard reachable) jumps to a stop. Reduced motion or data saver (`saveData`, `prefers-reduced-data`): no sticky and no camera travel, the three panels stack under the desk. The canvas also stops rendering while off screen (an IntersectionObserver sets the frame loop to `never`).
- **Not done / notes.** No admin forms for stops, copy or shelf cases yet (data shapes are ready). Stars have no keyboard path (the terminal's `stack` and `arch` cover the same ground). The terminal's own Esc exits to the hub, as before; Back returns to the stage. The scroll story lengthens the page by about 240svh before the hero text.

## 20. Stage, part C (round 20)

Three more Stage ideas, one commit each, plus two leftovers from part B. Data is in `lib/site/stage-data.ts` (`STAGE_PHOTO`, `STAGE_TIERS`, `STAGE_PERF`, `STAGE_DOOR`).

- **S6 Photo mode.** A `photo` button in the HUD strip opens a dialog layer: the page dims (a box-shadow cut-out on the stage, `html[data-stage-photo]` fades the story panels and the strip), a 1200 x 630 guide sits centred on the stage, and the visitor orbits within yaw +-25 and pitch +-12 degrees by drag or arrow keys (eased in the rig, about the point the camera looks at, so it works at any stop). `Capture` does not use a render target: the canvas is resized for one synchronous render (pixel ratio 1, 1200 x 630, `camera.setViewOffset` to the guide's rectangle), drawn into a 2D canvas and put back before the browser paints. That keeps the picture identical to the screen (tone mapping applies only when drawing to the canvas, not to a render target) and needs no `preserveDrawingBuffer`. The 2D canvas adds the stage's backdrop, then a bottom strip: `Ratul Roy` in the display face (Fraunces), `software engineer` in the mono face, `code.ratulroy.me` in the accent, over the accent rule. Preview, then `Download` (`ratulroy-stage.png`), `Share` (`navigator.share` with the file, else it copies `<origin>/?run=view stage`), `Retake`. Esc steps back (preview, then frame, then out). Phones: `touch-action: none` (no pinch), orbit by drag, buttons full width.
- **S7 Honest performance tiers.** The saved graphics choice (Performance / Balanced / Quality, `useExperience().quality`, Balanced when unset) drives: pixel-ratio cap 1 / 1.5 / 1.75, reflection cube size 128 / 256 / 512, star cap 14 / 22 / 28 (half on a phone), the laptop screen's redraw rate 3 / 6 / 10 fps. The stage has no shadow maps and no post-processing pass, so there is nothing to switch for those two. Measurement: frames are counted for 2 s after a 1.5 s warm-up (shader compile, uploads and hydration are not the machine's speed; a pause over 2 s restarts the window), then the HUD strip shows `<tier> · <fps> fps` for 4 s (always with `?debug=fps`). Under 30 fps on Quality or Balanced the stage steps down one tier for this visit and the strip says `stepped down to <tier> for a smooth frame · change in the hub's gate`. Nothing is written back to the saved setting. Test hint: a background tab throttles requestAnimationFrame to about 1 fps; bring the page to the front before measuring.
- **S10 A door to the other worlds.** A frame, a panel on a hinge, a knob and a strip of the hub's colour spectrum under it, at the desk's left edge (it counts in the camera fit, so phones back off enough to show it). Hover or HUD `door` focus opens it 20 degrees, brightens the strip and the spectrum behind the panel and shows `the other worlds`. Click, tap or the HUD button: the door opens fully (600 ms), the camera moves through (400 ms), the overlay washes to the void colour and the page navigates to the hub root with `?via=stage&from=engineer`. Reduced motion: no travel, a 200 ms fade. On the hub side, `via=stage&from=<world>` makes the provider open in Normal mode without writing the cookie (a visit, not a choice), skips the gate, and scrolls to that world's chapter. `app/page.tsx` now keeps the query when a path-style host redirects `/` to `/whoami`.
- **Leftovers.** (1) The boot overlay could stay up at 100% after a second Back. The cause was not reproduced; the boot ends only through its timeline's callback, which a page restored from the back-forward cache (or a tab hidden mid-boot) never receives. `WorldBoot` now lifts on `pageshow` with `persisted`, on `popstate`, 2.5 s after the tab is visible again, and after a 14 s watchdog. (2) The window stop's camera stands further back and to the left (eye `[0.1, 1.55, 4.7]`, look `[2.3, 1.35, -1.85]`) so the whole window sits in the half the text leaves; the daytime preset is brighter (key 2.1, ambient 0.55, window 1.0) and the window pane is a sky gradient with a sun glow instead of a flat grey slab.
- **Not done / notes.** The Stage's performance tiers do not feed the hub's own governor. No admin forms yet (see 16-admin-console.md section 2, "Stage: what is data"). The mid-travel moment of the door is shown by the open-door and void-wash frames only (the travel is 400 ms).

## 21. Netflix, part C (round 21)

Real art, a Top 10, a billboard that sells, a phone app feel, "Previously on…". One commit per item. All copy and rules are data in `lib/site/netflix-data.ts`; the art generator is `lib/site/netflix-art.ts` (pure, seeded).

- **C1 Key art, generated.** Every card (episode, project, post, skill, More like this, the modal billboard) draws one memoised inline SVG (`netflix-art.tsx`, `aria-hidden`): seed = the item id, layers picked by branch from `ART_LAYERS` (grid, rays, rings, dots, circuit traces), colour from the card's `--b`. Sheets are 320x180 (wide) or 200x300 (tall), cropped to fit; no image files, no defs. `metric?: { value, label }` rides on `Episode` and `ProjectCard` and is drawn as the art's focal text (sized in container units). `metricOf` tries `METRIC_OVERRIDES` first (a title regex, optionally a tag, mapped to a figure or to `null`), then `METRIC_RULES` over "title. synopsis", first rule wins wherever it sits in the text: a before/after time (`5–10 minutes to 2–3` gives `5–10 → 2–3` min), `<n>+ users`, `<n> automations` (number words up to twelve), `<n> credentials|certs`, `<n> records`. Nothing found means pure art; no figure is ever invented (every override value appears in the item's own text). The rays drift slowly only on the hero and the modal billboard, and not under reduced motion or at 768px and under.
- **C2 Top 10 by impact.** `impactRank` (formula documented in the file, weights in `IMPACT`): score = 100 if the item has a figure + 0..30 recency (linear from 2020-08 to the newest ranked date) + branch weight (main 20, side 10, learn 6, life 0; project 14, post 2); ties by date newest first, then id. Skills and life episodes are not ranked; items without a figure rank lower, never hidden. The row `Top 10 by impact` (outlined numerals 1 to 10 hugging a 2:3 poster) sits after Continue / Because / My List on Recruiter and after Projects on Developer; it is not on the full story. A "Top 10" nav chip is added. The `TOP 10` badge stays on Shift Roster only while it is in the top ten of the same rank over every item (it is rank 1).
- **C3 A billboard that sells.** `FEATURED` per profile id (Recruiter: Shift Roster v2.0, 11 automations, API Test Center; Developer: the same three reordered; full story: Shift Roster, VMS query, this terminal) resolved into `show.featured`. The hero art is the current feature's generated art (`--b` follows its branch); copy shows `Featured · 1 of 3`, the title, the figure as a line (`metricLine`: `5–10 min to 2–3 min`, `200+ users`), `Play` (the item's modal and teleprompter) and `More info`; `Trailer` (the typed `<name> --trailer`, still auto-playing once after 3 idle seconds) types over the art and its end hands over to the carousel. Three tabs under it carry a progress fill (a CSS animation, 7 s, `onAnimationEnd` advances); hover, focus, touch (released 4 s after), the trailer, a recap and an open modal pause it (animation-play-state), reduced motion has no advance. Tabs are a `tablist` with roving focus and Left / Right; swipe changes the title (nothing is prevented). The ASCII portrait is no longer drawn.
- **C4 Phone app feel (768px and under).** `netflix-tabbar.tsx`: a fixed bottom bar in the safe area (Home, Search, My List, Hire; 44px targets, a dot on My List when it has items). Search opens the top bar's box; the top bar is the mark, the title and the profile tile. Hire opens a bottom sheet (focus trap, Esc, swipe-down handle) with Email, the `hire --brief` text with Copy, and the résumé PDF, all from `hireSheetOf(data)` (the existing `hiring` and contact data, passed from the page). The hero is a portrait poster: the art with the figure, the title, Play and More info, dots for the carousel. Labels come from `nf.tab.*` / `nf.hire.*` in the three strings files (shown in the CC language when subtitles are on).
- **C5 Previously on…** `previouslyLine`: when an episode has an earlier one in its season, a strip above the synopsis types that episode's title and figure (28 ms a character; instant under reduced motion; the full height is reserved, so nothing shifts and the controls are never behind it). First episodes show nothing. Label: `nf.previously`.
- **Not done / notes.** No admin forms for `FEATURED`, `METRIC_OVERRIDES` or `IMPACT` yet (data shapes are ready). The art is the same generator everywhere, so two items with the same branch and similar ids can look alike; the seed makes each stable. The Hero's "View résumé", volume and CC sit after Play and More info on wide screens and are hidden on phones (the Hire sheet and the trailer foot carry them).

## 22. Netflix, part D (round 23)

Conversion and a living page. One commit per item; rules are data in `lib/site/netflix-data.ts` (`HIRE_BAR`) and `lib/site/netflix-case.ts` (`CASE_MIN_SYNOPSIS`); strings in en, bn, hi.

- **X1 Art varies.** `ART_LAYERS` now lists three geometry families per tone (grid, rays, rings, traces, dots plus waves, bars, diamonds, stripes, arcs); the seed picks one family and one tint from `ART_TINTS` (a small palette per tone, mixed 60 % into the card colour via `--at`). Impact figure unchanged. Forced colours: the line art is hidden and only the figure stays.
- **X2 Re-checks of part C.** Modal billboard figure at 393 clears the share and close buttons (figure top about 72 px, buttons end at 56 px). Hero copy at 1280 is 736 px wide, clear of the art. Top 10 numerals at 393 were clipped by the card (negative letter-spacing pushes the last glyph out of its box): fixed with more right padding.
- **D1 `?for=<name>`.** `lib/site/netflix-for.ts` (`cleanFor`: max 40 chars, letters/digits in any script, spaces and `.-&'`; rendered only as text; never sent to a server). Hero kicker `Picked for <name>`; the Hire sheet and the end card say `Hi <name> team`. `share netflix --for "Acme"` prints the link and the image URL with Copy and Share actions (the terminal shell is pure, so the copy is the Copy action, not automatic). `/og?cmd=netflix:home&for=Acme` draws `Picked for Acme`. Profiles menu has "Make a link for someone" (builds and copies the same link).
- **D2 Trending now.** `app/api/github/recent` reads the engineer handle's public events (no token, ipv4first, cached 30 min); GitHub no longer lists commits in a push event, so each push's head commit message is read from the public repo. Messages that look like a secret are skipped; any failure returns an empty list and the row does not render. Developer: second row; Recruiter: after Top 10. Live dot and "updated N min ago".
- **D3 Download a case study.** `app/api/netflix/case/[id]/route.tsx` (react-pdf, same fonts as the resume): title, the figure large, synopsis, stack, links, footer with the profile link. Offered on projects and episodes with a figure or a synopsis over 80 characters. Cached for a day. A failure shows a message in the modal.
- **D4 Audio description.** `AD` beside `CC` (hero, trailer foot, modal bar). `speechSynthesis`, rate 1.0, tag from the terminal language (`en-IN`, `bn-IN`, `hi-IN`); an installed voice is picked (exact tag, else same base language) and a note says when none matches. The trailer speaks the translated lines when the terminal is bn or hi, else English; the modal teleprompter speaks the English synopsis (only the branch label has a translation). Never speaks without a user gesture; cancelled on skip, Esc, close and toggle off; a natural end lets the line finish. Remembered as `xp-nf-ad`.
- **D5 Hire bar.** After two opened titles or 45 s: `Open to work`, Email, hire brief (copy), Résumé; once per session (`sessionStorage`), a dismissal is remembered 7 days (`xp-nf-hire-bar`); hidden while a modal, the guided play or the Hire sheet is open. On phones it sits above the tab bar and lifts the back-to-terminal pill.
- **D6 Findability and sweep.** Server-rendered `<noscript>` list of every title (title, season, figure, synopsis) and JSON-LD (`Person`, `ItemList` of the Top 10) in `netflix-seo.tsx`. Lighthouse (dev server; accessibility, best practices and SEO only, performance is not returned by the tool): mobile 100 / 100 / 91, desktop 100 / 100 / 100. Fixed: card accessible names (visible text must be part of the name), one `main` landmark, the AD button name. Remaining mobile SEO miss is the dev server's missing meta description on this route. axe-core could not be loaded into the page (the harness refused a CDN script), so Lighthouse's axe-based audits stood in. Forced-colours, reduced-motion checked at 393.
- **Not done / notes.** No admin forms for `HIRE_BAR` yet. Dev console shows Next/Turbopack module-instantiation errors and slow content reads on this machine, not from this code.

## 24. Netflix, part E (round 25)

Direction (Ratul, 2026-11-12): present, not brag. The work is real and modest; the copy says "yes, I have done this", never "only I can do this".

- **E1 tone.** The big focal figure on cards is gone. A figure is a small muted mono label under the title (`metricLabel` in `netflix-data.ts`): `200+ active users · internal tool`, `query time 5–10 min to 2–3 min`, `11 automations · finance and sync`, `7 credentials · OpenAI PartnerU`. `Metric.context` is explicit text in `METRIC_OVERRIDES`, never inferred. The hero feature line, the modal billboard, `Previously on…`, the noscript list and the case-study PDF use the same wording. `Top 10 by impact` is now `Top 10`, ranked by **scope** (`SCOPE`, `scopeRank`; same formula and weights as the old `IMPACT`).
- **Phrase audit (what changed).** `Owns 11 Python automations` to `Maintains 11 Python automations`; timeline `Take ownership of 11 Python automations…` to `Take over 11 Python automations…`; hire sheet level `owns features end to end` to `works on features end to end`; the "This series is" adjectives (`NF_ADJECTIVES`): main `Production` to `In production`, learn `Rigorous` to `Steady`, side `Self-driven` to `Hands-on`, skill `Daily, Reliable` to `Familiar, Ongoing`; row and JSON-LD name `Top 10 by impact` to `Top 10`; the regex metric label `certs` to `credentials`. Checked and left (already factual): the trailer lines, recaps, `Next episode: your team?`, the end card, the OG card numerals, the hero blurb.
- **E2 real imagery.** `PROJECT_MEDIA` (slug to poster, screens, clips) in `netflix-data.ts`; `ProjectCard.media` and `NfFacts.media`. `scripts/netflix-media.mjs` copies the API Test Center assets to `public/projects/api-test-center/` (poster and screens to 1280-wide WebP q80, clips and clip posters as they are; `demo.webm` and `report-light.png` are not copied). `NfPoster` replaces generated art on the project card, the Top 10 card, the hero feature and the modal billboard (a missing file hides itself and the art shows). The modal has a `Screens` row (click to enlarge, Esc closes only the picture, arrows step) and a `Clips` row (poster and play badge; the `<video>` is created only on mouse hover or a tap, `preload="metadata"`, muted, pauses off screen; reduced motion: poster only). Images are lazy, sized and `content-visibility: auto` in the rows. Other projects keep generated art. Files in `netflix-media.tsx` and `netflix-media.css`.
- **E3 certifications.** `buildCertSeries(certs)` groups by issuer into seasons (`CERT_SEASONS`: OpenAI PartnerU, Cisco Networking Academy, IBM, Other) and credentials into episodes; dates only from the text (`· Jul 2022`, `valid through Jul–Aug 2027`), `verify` only when `certifications[].verify` is set (none today). Row kind `series`, component `netflix-certs.tsx`: season pills, generated hexagon badges in the issuer colour with one slow shine on first view (still under reduced motion), a dialog with issuer, credential, dates and a verify link or "No public verify link is listed".
- **E4 Play, then Visit.** Play never navigates. A project plays a reel (`ProjectReel`: facts and clip posters alternating, six seconds, AD reads the facts) and then an end card: `Visit project` (live address) and `View code` (repository); with no live address `In development`, `View code` and `Say hello`; a Replay button. The guided play does not show it (it closes the card itself).
- **E5.** Link maker: the copy no longer awaits the clipboard (synchronous copy inside the press, `Copied` state; if refused, a read-only selected field with the link and a note; the async clipboard is tried in the background; no `window.prompt`). Could not reproduce a hang in the desktop test browser; the likely cause on a phone is the async clipboard promise never settling (or `navigator.clipboard` missing on a non-secure host) followed by the blocking prompt. The top bar's `Profiles` text link is gone (the avatar menu holds `Switch profile`; the `p` key opens it). `man share` and the one-line help say that `share netflix --for "Acme"` prints and copies a ready link for one company or person (page greets `Picked for Acme`). `lib/site/view-icons.ts`: `VIEW_ICONS` (netflix: red R on black, theme colour black), applied on mount and restored on unmount; the observer on the head also covers icon links the framework adds later.
- **Not verified.** Clip playback and the real poster, screenshots (the files were not copied: the copy from the product folder was blocked by the permission classifier; see the handback); page-weight delta with real files; the in-app unmount restore of the tab icon (a full navigation restores it).
