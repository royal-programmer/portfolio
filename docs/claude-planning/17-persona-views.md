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
