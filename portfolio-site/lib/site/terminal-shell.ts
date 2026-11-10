/**
 * The Engineer terminal's shell (17-persona-views.md §6.3): parses a command line and answers with
 * output lines plus, at most, one effect for the UI to carry out (open a page, exit, clear,
 * toggle full screen). Pure: no React, no DOM, no navigation; the UI resolves hrefs.
 */
import { DISPLAY_ROOT, personaIdentity } from "@/lib/site/brand";
import { BANNER_ROYAL_PROGRAMMER } from "@/lib/site/terminal-art";
import { isPortraitMode, PORTRAIT_MODES, type PortraitMode } from "@/lib/site/portrait-gen";
import {
  buildFs,
  complete as completePath,
  HOME,
  join,
  USER,
  listDir,
  readFile,
  resolvePath,
  shortPath,
  stat,
  type Fs,
  type EntryKind,
  type FsEntry,
} from "@/lib/site/terminal-fs";
import { fitMatch, FIT_MAX } from "@/lib/site/terminal-fit";
import { layoutArch, type ArchRun } from "@/lib/site/terminal-arch";
import { didYouMean } from "@/lib/site/terminal-suggest";
import type { TermCommit, TerminalData } from "@/lib/site/terminal-data";
import { LANG_NAMES, LANGS, STRINGS, type Lang, type StringKey, type TerminalStrings } from "@/lib/site/terminal-strings";

export type MenuId = "views" | "projects" | "writing" | "themes" | "langs";
export type MenuRow = { key: string; label: string; line: string };

/** One name in a listing: a button that runs `cat` (files), `cd` (dirs) or `open` (views). */
export type FileItem = { name: string; type: EntryKind; path: string; meta?: string };

export type Tone = "accent" | "green" | "violet" | "dim";

/** The terminal's themes (`theme <name>`). `color` is the swatch; the UI maps each id to CSS variables. */
export const THEMES = [
  { id: "accent", color: "var(--persona-c)" },
  { id: "amber", color: "#ffb000" },
  { id: "green", color: "#33ff66" },
  { id: "paper", color: "#cfc8b4" },
  { id: "dracula", color: "#bd93f9" },
  { id: "nord", color: "#88c0d0" },
  { id: "gruvbox", color: "#fabd2f" },
  { id: "solarized", color: "#268bd2" },
  { id: "monokai", color: "#a6e22e" },
  { id: "matrix", color: "#00ff41" },
  { id: "cyberpunk", color: "#ff2a6d" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

/** The classic cow, with `msg` wrapped at 40 columns in the bubble. */
function cow(msg: string): string[] {
  const words = (msg || "moo").split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && cur.length + 1 + w.length > 40) {
      rows.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  rows.push(cur);
  const width = Math.max(...rows.map((r) => r.length));
  const bubble =
    rows.length === 1
      ? [` ${"_".repeat(width + 2)}`, `< ${rows[0]} >`, ` ${"-".repeat(width + 2)}`]
      : [
          ` ${"_".repeat(width + 2)}`,
          ...rows.map((r, i) => {
            const [l, rr] = i === 0 ? ["/", "\\"] : i === rows.length - 1 ? ["\\", "/"] : ["|", "|"];
            return `${l} ${r.padEnd(width)} ${rr}`;
          }),
          ` ${"-".repeat(width + 2)}`,
        ];
  return [...bubble, "        \\   ^__^", "         \\  (oo)\\_______", "            (__)\\       )\\/\\", "                ||----w |", "                ||     ||"];
}

/** Docs for the hidden commands: `man` knows them, `help` and the palette do not. */
const HIDDEN_DOCS: CommandDef[] = [
  { name: "sl", group: "terminal", usage: "sl" },
  { name: "cowsay", group: "terminal", usage: "cowsay <text>" },
  { name: "fortune", group: "terminal", usage: "fortune" },
  { name: "sudo", group: "terminal", usage: "sudo <command>", long: true },
];

/** A `timeline` row: a section head (narrow layout) or an entry; glyph/label/grade belong to the wide bracket column. */
export type TimelineRow =
  | { head: string }
  | { year: string; mon: string; subject: string; tag?: string; grade?: string; dim?: boolean; life?: boolean; glyph?: string; label?: string; periodGrade?: string };

/** One token in a `links` line: a link (`href`), a command (`cmd`) or a UI action (`act`: copy `url`, or open the phone's share sheet). */
export type LinkItem = { label: string; href?: string; external?: boolean; cmd?: string; act?: "copy" | "share"; url?: string; title?: string };

export type Out =
  | { kind: "text"; text: string; dim?: boolean; accent?: boolean }
  /** One line of differently coloured runs (`git log`, `theme`); `color` is a CSS colour for a swatch. */
  | { kind: "parts"; parts: Array<{ text: string; tone?: Tone; color?: string }> }
  /** A QR code as text rows (`qr`). */
  | { kind: "qr"; lines: string[] }
  /** Several links on one line, joined by " · ". */
  | { kind: "links"; items: LinkItem[]; prefix?: string; suffix?: string; dim?: boolean; /** Wide `portfolio`: text on the left (clipped), the links at the right end of the same line. */ lead?: string }
  /** A listing: `inline` joins the names on one line (`ls`); otherwise it is one row, `meta` before the name. */
  | { kind: "files"; inline: boolean; items: FileItem[] }
  /** `cal`: weeks of day numbers (null = blank), today highlighted. */
  | { kind: "cal"; title: string; weeks: Array<Array<number | null>>; today: number }
  /** The generated portrait (`portrait [mode]`); "next" cycles from the last one drawn. */
  | { kind: "portrait"; mode: PortraitMode | "next" }
  /** The `neofetch` card: the small portrait on the left, these rows on the right. */
  | { kind: "neofetch"; rows: string[] }
  | { kind: "link"; label: string; href: string; external?: boolean }
  /** A line that runs a command when clicked (`open <slug>` at the foot of a project). */
  | { kind: "run"; text: string; cmd: string }
  | { kind: "menu"; id: MenuId; rows: MenuRow[] }
  /** `timeline`: one grid, so the bracket column stays straight. */
  | { kind: "timeline"; wide: boolean; rows: TimelineRow[] }
  /** `fit`: a job description matched against my stack. */
  | { kind: "fit"; matched: string[]; adjacent: Array<{ want: string; have: string }>; notYet: string[]; verdict: string; pct: number | null; labels: { matched: string; adjacent: string; notYet: string } }
  /** `arch`: a diagram as rows of tagged runs; `edges` are the [from, to] pairs the runs refer to by index. */
  | { kind: "arch"; id: string; title: string; wide: boolean; lines: ArchRun[][]; edges: Array<[string, string]>; notes: string[] }
  /** The welcome: block-letter art (88 columns), the welcome line, and the tips box rows. */
  | { kind: "banner"; art: string[]; welcome: string; overview: string[]; title: string; tips: Array<{ cmd: string; desc: string }> };

export type Effect =
  | { kind: "open-view"; id: string }
  | { kind: "open-slug"; slug: string; blog?: boolean }
  | { kind: "open-url"; url: string }
  | { kind: "exit" }
  | { kind: "clear" }
  | { kind: "fullscreen" }
  | { kind: "pane" }
  /** The inline contact form runs in the UI, which owns the prompt. */
  /** Run another command line as if typed (a tip's number). */
  | { kind: "run"; cmd: string }
  /** `git log`: the UI fetches the public activity. */
  | { kind: "git-log"; oneline: boolean; limit: number }
  | { kind: "window"; url: string }
  | { kind: "theme"; id: ThemeId }
  /** `lang <code>`: the UI switches the terminal's language and remembers it. */
  | { kind: "lang"; lang: Lang }
  | { kind: "crt" }
  | { kind: "qr" }
  | { kind: "curl-github" }
  /** `install`: the UI owns the browser's install prompt. */
  | { kind: "install" }
  /** `stats [year|langs]`: the UI fetches the GitHub year and draws it. */
  | { kind: "stats"; mode: "all" | "year" | "langs" }
  | { kind: "sl" }
  /** `fit` with no text: the UI opens its paste box. */
  | { kind: "fit-box" }
  /** `screensaver [on|off]`: start it now, or switch it off / on for this device. */
  | { kind: "saver"; mode: "now" | "off" | "on" }
  | { kind: "mail" };

export type ShellState = { cwd: string; history: string[]; lastMenu?: MenuId };
export type RunResult = { lines: Out[]; effect?: Effect; state: ShellState };

export type CommandGroup = "navigate" | "read" | "open" | "terminal";
export type CommandDoc = { name: string; group: CommandGroup; usage: string; desc: string; long?: string };
/** A command as defined here; its words (`desc`, `long`) are the strings module's. */
type CommandDef = { name: string; group: CommandGroup; usage: string; long?: boolean };

export type Shell = {
  /** The welcome block (banner, welcome line, tips), as `banner` prints it. */
  banner: (lang?: Lang) => Out[];
  /** `env.cols`: how many characters fit on a line right now (for `timeline`); `env.lang`: the language the output is in (default English). */
  run: (input: string, state: ShellState, env?: { cols?: number; lang?: Lang }) => RunResult;
  /** Candidates for the last token of `input` (whole-token strings; the UI swaps the token in). */
  complete: (input: string, state: ShellState) => string[];
  /** The commands, in English (names, usage); the palette and `man` take their words from `docs(lang)`. */
  commands: CommandDoc[];
  docs: (lang: Lang) => CommandDoc[];
  /** `fit` on pasted text (kept out of the history): the card, the next steps and the privacy line. */
  fit: (text: string, lang?: Lang) => Out[];
};

export const HISTORY_CAP = 200;
export const initialShellState = (history: string[] = []): ShellState => ({ cwd: HOME, history });

const COMMANDS: CommandDef[] = [
  { name: "help", group: "terminal", usage: "help", long: true },
  { name: "man", group: "terminal", usage: "man <command>" },
  { name: "ls", group: "navigate", usage: "ls [-l] [path]" },
  { name: "cd", group: "navigate", usage: "cd [path]" },
  { name: "pwd", group: "navigate", usage: "pwd" },
  { name: "tree", group: "navigate", usage: "tree [path]" },
  { name: "cat", group: "read", usage: "cat <file>" },
  { name: "about", group: "read", usage: "about" },
  { name: "stack", group: "read", usage: "stack" },
  { name: "uptime", group: "read", usage: "uptime" },
  { name: "contact", group: "read", usage: "contact" },
  { name: "install", group: "read", usage: "install", long: true },
  { name: "curl", group: "read", usage: "curl github" },
  { name: "qr", group: "open", usage: "qr" },
  { name: "theme", group: "terminal", usage: "theme [name|random]" },
  { name: "crt", group: "terminal", usage: "crt" },
  { name: "resume", group: "read", usage: "resume [--pdf]" },
  { name: "portrait", group: "read", usage: "portrait [mode|list|next]" },
  { name: "whoami", group: "read", usage: "whoami" },
  { name: "neofetch", group: "read", usage: "neofetch" },
  { name: "open", group: "open", usage: "open <view|slug|url>" },
  { name: "views", group: "open", usage: "views" },
  { name: "projects", group: "open", usage: "projects" },
  { name: "writing", group: "open", usage: "writing" },
  { name: "banner", group: "terminal", usage: "banner" },
  { name: "history", group: "terminal", usage: "history" },
  { name: "clear", group: "terminal", usage: "clear", long: true },
  { name: "cls", group: "terminal", usage: "cls" },
  { name: "portfolio", group: "read", usage: "portfolio", long: true },
  { name: "now", group: "read", usage: "now" },
  { name: "hire", group: "read", usage: "hire [--brief]" },
  { name: "timeline", group: "read", usage: "timeline [--all]" },
  { name: "view", group: "open", usage: "view [id]" },
  { name: "git", group: "read", usage: "git log [--oneline] [-n k]" },
  { name: "stats", group: "read", usage: "stats [year|langs]", long: true },
  { name: "share", group: "read", usage: "share [command]", long: true },
  { name: "fit", group: "read", usage: "fit [paste]", long: true },
  { name: "arch", group: "read", usage: "arch [shift-roster|automations|process-apis|this-site]", long: true },
  { name: "screensaver", group: "terminal", usage: "screensaver [off|on]", long: true },
  { name: "mail", group: "open", usage: "mail [--fit]" },
  { name: "pane", group: "terminal", usage: "pane" },
  { name: "lang", group: "read", usage: "lang [en|bn|hi]", long: true },
  { name: "date", group: "terminal", usage: "date" },
  { name: "cal", group: "terminal", usage: "cal" },
  { name: "fullscreen", group: "terminal", usage: "fullscreen" },
  { name: "echo", group: "terminal", usage: "echo <text>" },
  { name: "exit", group: "terminal", usage: "exit", long: true },
];
const NAMES = COMMANDS.map((c) => c.name);
const docOf = (S: TerminalStrings, c: CommandDef): CommandDoc => ({
  name: c.name,
  group: c.group,
  usage: c.usage,
  desc: S[`cmd.${c.name}.desc` as StringKey] as string,
  ...(c.long ? { long: S[`cmd.${c.name}.long` as StringKey] as string } : {}),
});

/** The tips box, numbered 1-9: typing a number runs that row's command. */
const TIPS = [
  { cmd: "help", key: "help" },
  { cmd: "hire", key: "hire" },
  { cmd: "/", key: "slash" },
  { cmd: "view", key: "view" },
  { cmd: "projects", key: "projects" },
  { cmd: "resume", key: "resume" },
  { cmd: "portfolio", key: "portfolio" },
  { cmd: "share", key: "share" },
  { cmd: "install", key: "install" },
] as const;

/** What `help` shows first: `start here`, then three short groups. `help --all` lists every command under the older four. */
const HELP_START = ["portfolio", "hire", "help"];
const HELP_GROUPS: Array<{ key: StringKey; names: string[] }> = [
  { key: "group.read", names: ["about", "resume", "projects", "writing", "timeline", "now", "contact"] },
  { key: "group.live", names: ["stats", "git", "curl", "fit"] },
  { key: "group.terminal", names: ["theme", "lang", "pane", "clear", "exit"] },
];

const text = (t: string, dim = false): Out => ({ kind: "text", text: t, dim: dim || undefined });
const texts = (ls: string[]): Out[] => ls.map((l) => text(l));

export function createShell(data: TerminalData): Shell {
  const fs: Fs = buildFs(data);
  const host = `${personaIdentity("engineer").subdomain}.${DISPLAY_ROOT}`;
  const viewIds = data.views.map((v) => v.id);
  const projectSlugs = new Set(data.projects.map((p) => p.slug));
  const postSlugs = new Set(data.posts.map((p) => p.slug));
  /** The language this call speaks; set at the top of every public entry point (the shell is synchronous, so one slot is enough). */
  let L: Lang = "en";
  let S: TerminalStrings = STRINGS.en;
  const setLang = (lang?: Lang) => {
    L = lang ?? "en";
    S = STRINGS[L];
  };
  /** The translated data (summary, status, ...) for this language; undefined in English. */
  const loc = () => (L === "en" ? undefined : data.i18n?.[L]);
  const describe = (id: string) => S[`theme.${id}` as StringKey] as string;

  const menu = (id: MenuId): { lines: Out[]; menu?: MenuId } => {
    const rows: MenuRow[] =
      id === "views"
        ? data.views.map((v) => ({ key: v.id, label: v.id, line: v.line }))
        : id === "langs"
          ? LANGS.map((l) => ({ key: l, label: l, line: `${LANG_NAMES[l]}${l === L ? `  · ${S["lang.current"]}` : ""}` }))
        : id === "themes"
          ? THEMES.map((t) => ({ key: t.id, label: t.id, line: describe(t.id) }))
          : id === "projects"
          ? data.projects.map((p) => ({ key: p.slug, label: p.slug, line: [p.title, p.year].filter(Boolean).join(" · ") }))
          : data.posts.map((p) => ({ key: p.slug, label: p.slug, line: [p.title, p.date].filter(Boolean).join(" · ") }));
    if (!rows.length) return { lines: [text(S[`menu.none.${id}` as StringKey] as string, true)] };
    return { lines: [{ kind: "menu", id, rows }], menu: id };
  };

  /** A file's lines as output: links and the `open` line become clickable. */
  const render = (path: string, lines: string[]): Out[] => {
    if (path === `${HOME}/contact`) {
      const w = Math.max(...data.contact.map((x) => x.label.length));
      const row = (c: (typeof data.contact)[number]): Out => {
        const label = `${c.label.padEnd(w)}  ${c.href.replace(/^mailto:/i, "")}`;
        if (/^https?:\/\//i.test(c.href)) return { kind: "link", label, href: c.href, external: true };
        if (/^mailto:/i.test(c.href)) return { kind: "link", label, href: c.href };
        return text(label);
      };
      const main = data.contact.filter((c) => !c.group);
      const more = data.contact.filter((c) => c.group === "elsewhere");
      return [...main.map(row), ...(more.length ? [text(""), text(S.elsewhere, true), ...more.map(row)] : [])];
    }
    return lines.map((l): Out => {
      const link = /^(?:repo|live) ↗ (\S+)$/.exec(l);
      if (link) return /^https?:\/\//i.test(link[1]) ? { kind: "link", label: l, href: link[1], external: true } : text(l);
      const open = /^open (\S+)  → /.exec(l);
      if (open) return { kind: "run", text: l, cmd: `open ${open[1]}` };
      const arch = /^arch (\S+)  → /.exec(l);
      if (arch) return { kind: "run", text: l, cmd: `arch ${arch[1]}` };
      return text(l);
    });
  };

  const banner = (): Out[] => [
    {
      kind: "banner",
      art: [...BANNER_ROYAL_PROGRAMMER],
      welcome: `royal-programmer ${data.commit ?? "v1"} · ${host}`,
      overview: [loc()?.who ?? data.who, data.stack.join(" · "), loc()?.uptime ?? data.uptime],
      title: S["tips.title"],
      tips: TIPS.map((t) => ({ cmd: t.cmd, desc: S[`tip.${t.key}` as StringKey] as string })),
    },
  ];

  const longMeta = (e: FsEntry) => {
    const perms = e.kind === "dir" ? "drwxr-xr-x" : e.kind === "exec" ? "-rwxr-xr-x" : "-rw-r--r--";
    return `${perms}  ${String(e.size).padStart(5)}  `;
  };
  const item = (dir: string, e: FsEntry, meta?: string): FileItem => ({ name: e.name, type: e.kind, path: join(dir, e.name), meta });

  const ls = (args: string[], st: ShellState): { lines: Out[]; menu?: MenuId } => {
    const long = args.some((a) => /^-[a-zA-Z]*l/.test(a));
    const paths = args.filter((a) => !a.startsWith("-"));
    const targets = paths.length ? paths : ["."];
    const out: Out[] = [];
    let picked: MenuId | undefined;
    for (const raw of targets) {
      const path = resolvePath(st.cwd, raw);
      const kind = stat(fs, path);
      if (targets.length > 1) out.push(text(`${raw}:`, true));
      if (!kind) {
        out.push(text(S["err.ls"](raw)));
      } else if (kind !== "dir") {
        const size = readFile(fs, path)?.join("\n").length ?? 0;
        const dir = path.slice(0, path.lastIndexOf("/")) || "/";
        const e: FsEntry = { name: path.slice(path.lastIndexOf("/") + 1), kind, size };
        out.push({ kind: "files", inline: !long, items: [item(dir, e, long ? longMeta(e) : undefined)] });
      } else if (path === `${HOME}/views` && !long) {
        const m = menu("views");
        out.push(...m.lines);
        picked = m.menu;
      } else {
        const entries = listDir(fs, path) ?? [];
        if (!entries.length) continue;
        if (long) for (const e of entries) out.push({ kind: "files", inline: false, items: [item(path, e, longMeta(e))] });
        else out.push({ kind: "files", inline: true, items: entries.map((e) => item(path, e)) });
      }
    }
    return { lines: out, menu: picked };
  };

  const tree = (raw: string | undefined, st: ShellState): Out[] => {
    const path = resolvePath(st.cwd, raw ?? ".");
    const kind = stat(fs, path);
    if (!kind) return [text(S["err.tree"](raw))];
    if (kind !== "dir") return [text(raw ?? ".")];
    const out: Out[] = [text(shortPath(path))];
    const walk = (dir: string, prefix: string) => {
      const es = listDir(fs, dir) ?? [];
      es.forEach((e, i) => {
        const last = i === es.length - 1;
        out.push({ kind: "files", inline: false, items: [item(dir, e, `${prefix}${last ? "└── " : "├── "}`)] });
        if (e.kind === "dir") walk(join(dir, e.name), `${prefix}${last ? "    " : "│   "}`);
      });
    };
    walk(path, "");
    return out;
  };

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /** `timeline`: school, college, work. Wide: a grid (year, month, subject, tag, bracket, period label). Narrow: stacked. */
  const timeline = (cols: number, all: boolean): Out[] => {
    const ym = (iso: string) => {
      const [y, m] = iso.split("-").map(Number);
      return { y, m: m || 1, i: y * 12 + ((m || 1) - 1) };
    };
    const periods = data.periods.filter((p) => /^\d{4}-\d{2}$/.test(p.from));
    const now = new Date();
    const nowI = now.getFullYear() * 12 + now.getMonth();
    const dur = (p: (typeof periods)[number]) => {
      const mo = (p.to ? ym(p.to).i : nowI) - ym(p.from).i;
      if (mo >= 12) {
        const y = Math.round(mo / 12);
        return S["unit.yr"](y);
      }
      return mo < 1 ? S["unit.new"] : S["unit.mo"](mo);
    };
    const inside = (p: (typeof periods)[number], i: number) => i >= ym(p.from).i && (p.to ? i <= ym(p.to).i : true);

    type Row = { i: number; y: number; mon: string; subject: string; tag?: string; grade?: string; branch: TermCommit["branch"] };
    const rows: Row[] = data.timeline.map((c) => {
      const t = ym(c.date.slice(0, 7));
      return { i: t.i, y: t.y, mon: MONTHS[t.m - 1], subject: c.subject, tag: c.tag, grade: c.grade, branch: c.branch };
    });
    // A period that no entry marks still starts somewhere: add its first month.
    for (const p of periods) {
      const t = ym(p.from);
      if (!rows.some((r) => r.i === t.i && r.branch !== "life")) rows.push({ i: t.i, y: t.y, mon: MONTHS[t.m - 1], subject: S["tl.start"](p.label), branch: "learn" });
    }
    rows.sort((a, b) => a.i - b.i);
    // Default view: side and learn entries older than the work period stay out, except the ones that open or close a period.
    const workFrom = ym(periods.find((p) => p.id === "work")?.from ?? periods[periods.length - 1]?.from ?? "2000-01").i;
    const edge = new Set(periods.flatMap((p) => [ym(p.from).i, p.to ? ym(p.to).i : -1]));
    const shown = all ? rows : rows.filter((r) => r.branch === "main" || r.branch === "life" || r.i >= workFrom || edge.has(r.i) || !!r.grade);

    const wide = cols >= 80;
    const out: TimelineRow[] = [];
    const spans = periods.map((p) => {
      const idx = shown.map((r, k) => (r.branch !== "life" && inside(p, r.i) ? k : -1)).filter((k) => k >= 0);
      return { p, lo: idx[0] ?? -1, hi: idx[idx.length - 1] ?? -1 };
    });
    let prevY = 0;
    const opened = new Set<string>();
    shown.forEach((r, k) => {
      if (!wide) {
        for (const p of periods) {
          if (!opened.has(p.id) && r.branch !== "life" && inside(p, r.i)) {
            opened.add(p.id);
            out.push({ head: `── ${p.id} · ${p.from.slice(0, 4)} → ${p.to ? p.to.slice(0, 4) : S["tl.now"]} ──` });
          }
        }
      }
      const row: TimelineRow = { year: r.y !== prevY ? String(r.y) : "", mon: r.mon, subject: r.subject, tag: r.tag, grade: r.grade, dim: r.branch !== "main", life: r.branch === "life" };
      prevY = r.y;
      const sp = spans.find((s) => s.lo >= 0 && k >= s.lo && k <= s.hi);
      if (wide && sp) {
        row.glyph = sp.lo === sp.hi ? "─" : k === sp.lo ? "┐" : k === sp.hi ? "┘" : "│";
        if (k === Math.floor((sp.lo + sp.hi) / 2)) {
          row.label = `${sp.p.id} · ${dur(sp.p)}`;
          row.periodGrade = sp.p.grade;
        }
      }
      out.push(row);
    });
    return [{ kind: "timeline", wide, rows: out }, text(S["tl.foot"], true)];
  };

  /** `git log [--oneline] [-n k] | -k`: the UI loads the public activity; here only the flags are checked. */
  const gitLog = (args: string[]): { lines: Out[]; effect?: Effect } => {
    let limit = 10;
    let oneline = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--oneline") oneline = true;
      else if (a === "--graph") return { lines: [text(S["git.graph"])] };
      else if (a === "-n") {
        if (!/^\d+$/.test(args[i + 1] ?? "")) return { lines: [text(S["git.notnum"](args[i + 1] ?? ""))] };
        limit = Number(args[++i]);
      } else if (/^-\d+$/.test(a)) limit = Number(a.slice(1));
      else return { lines: [text(S["git.unrec"](a))] };
    }
    return { lines: [], effect: { kind: "git-log", oneline, limit: Math.max(1, limit) } };
  };

  const git = (args: string[]): { lines: Out[]; effect?: Effect } => {
    const sub = args[0];
    if (sub === "log") return gitLog(args.slice(1));
    if (sub === "status") return { lines: [text(S["git.status"])] };
    if (sub) return { lines: [text(S["git.notcmd"](sub))] };
    return { lines: texts([S["git.usage.head"], `  ${"log [--oneline] [-n k]".padEnd(25)}${S["git.usage.log"]}`, `  ${"status".padEnd(25)}${S["git.usage.status"]}`]) };
  };

  /** The 20-second version for recruiters, from the résumé only. */
  /** `now`: what I am doing this month, from `data.now`. */
  const now = (): Out[] => {
    if (!data.now?.lines.length) return [text(S["now.none"], true)];
    const [y, m] = data.now.month.split("-").map(Number);
    return [text(S["now.head"](MONTHS[(m || 1) - 1], y), true), ...(loc()?.now ?? data.now.lines).map((l) => text(`  • ${l}`))];
  };

  /** `fit`: the overlap card for a pasted job description. */
  const fit = (raw: string): Out[] => {
    const r = fitMatch(raw, data);
    const verdict = r.level === "none" ? S["fit.none"] : S["fit.verdict"](S[`fit.${r.level}` as StringKey] as string, r.pct ?? 0, r.total);
    const labels = { matched: S["fit.matched"](r.matched.length), adjacent: S["fit.adjacent"](r.adjacent.length), notYet: S["fit.notyet"](r.notYet.length) };
    return [
      { kind: "fit", matched: r.matched, adjacent: r.adjacent, notYet: r.notYet, verdict, pct: r.pct, labels },
      ...(r.truncated ? [text(S["fit.truncated"](FIT_MAX / 1024), true)] : []),
      { kind: "links", prefix: "→ ", items: [{ label: "hire --brief", cmd: "hire --brief" }, { label: "mail --fit", cmd: "mail --fit" }, { label: "resume --pdf", cmd: "resume --pdf" }] },
      text(S["fit.private"], true),
    ];
  };

  /** `arch [name]`: the list, or one diagram. */
  const arch = (name: string | undefined, cols: number): Out[] => {
    if (!name)
      return [
        text(S["arch.head"], true),
        ...data.arch.map((d): Out => ({ kind: "run", text: `arch ${d.id.padEnd(13)} ${d.line ?? d.title}`, cmd: `arch ${d.id}` })),
      ];
    const d = data.arch.find((x) => x.id === name.toLowerCase());
    if (!d) return [text(S["err.arch"](name, data.arch.map((x) => x.id).join(" · ")))];
    // `cols` is an estimate at 7.8 px a character; the real advance is a little wider, so leave a little spare.
    const l = layoutArch(d, Math.floor(cols * 0.93));
    return [
      text(d.title, true),
      { kind: "arch", id: d.id, title: d.title, wide: l.wide, lines: l.lines, edges: d.edges.map(([a, b]) => [a, b]), notes: d.notes },
      ...(l.skipped.length ? [text(l.skipped.map((i) => `${d.edges[i][0]} ⇢ ${d.edges[i][1]}${d.edges[i][2] ? ` (${d.edges[i][2]})` : ""}`).join(" · "), true)] : []),
    ];
  };

  const hire = (): Out[] => {
    const r = data.resume;
    const role = r.title.split(" · ");
    const wants = role.slice(1).join(" · ");
    const b = r.experience[0]?.bullets ?? [];
    const proof = [b[1], b[5], b[7]].filter((x): x is string => !!x);
    const linkedin = data.contact.find((c) => c.label === "linkedin" && /^https:\/\//i.test(c.href));
    return [
      { kind: "parts", parts: [{ text: r.name, tone: "accent" }, { text: ` — ${r.title}` }] },
      text(r.location, true),
      text(S["hire.looking"](wants)),
      text(S["hire.proof"]),
      ...(loc()?.proof ?? proof).map((p) => text(`  • ${p}`)),
      text(S["hire.stack"](data.stack.join(" · "))),
      {
        kind: "links",
        items: [{ label: "resume --pdf", cmd: "resume --pdf" }, { label: "mail", cmd: "mail" }, ...(linkedin ? [{ label: "linkedin", href: linkedin.href, external: true }] : [])],
      },
    ];
  };

  /** `portfolio`: everything on one screen. Sections with a left rule, each ending in the command that goes deeper. */
  const portfolio = (cols: number): Out[] => {
    const r = data.resume;
    const w = Math.max(30, Math.min(cols, 96));
    const hw = Math.min(w, 56);
    const wide = cols >= 80;
    // Wide: one line per row, cut on a word with `…`. Narrow: lines wrap, so nothing is cut and the rule is left out.
    const clip = (t: string) => (wide && t.length > w - 2 ? `${t.slice(0, w - 3).replace(/\s+\S*$/, "")}…` : t);
    const bar = wide ? "│ " : "  ";
    const out: Out[] = [];
    const head = (label: string) => out.push({ kind: "parts", parts: [{ text: `── ${label} ${"─".repeat(Math.max(2, hw - label.length - 4))}`, tone: "dim" }] });
    const row = (t: string) => out.push(text(`${bar}${t}`));
    const go = (...cmds: string[]) => {
      const items = cmds.map((c) => ({ label: c, cmd: c }));
      const last = out[out.length - 1];
      // Wide: the → commands share the section's last line (a 1fr | auto grid); narrow keeps them on their own line.
      if (wide && last?.kind === "text" && last.text.startsWith(bar)) {
        out.pop();
        out.push({ kind: "links", prefix: "→ ", items, lead: last.text });
      } else out.push({ kind: "links", prefix: `${bar}→ `, items });
    };
    const role = loc()?.role ?? (r.title.split(" · ")[0] ?? "").toLowerCase();
    const city = loc()?.city ?? r.location.split(",")[0];
    head(S["pf.who"]);
    row(clip([r.name, role, city, /relocat/i.test(r.location) ? S["pf.reloc"] : ""].filter(Boolean).join(" · ")));
    row(clip(loc()?.uptime ?? data.uptime));
    go("hire", "fit", "resume", "stats");
    head(S["pf.stack"]);
    row(clip(data.stack.join(" · ")));
    go("stack");
    head(S["pf.timeline"]);
    const line = [...data.periods.map((p) => `${p.from.slice(0, 4)} ${p.id}`), S["pf.now"]].join(" ─ ");
    row(clip(line));
    go("timeline");
    if (data.projects.length) {
      head(S["pf.projects"](data.projects.length));
      for (const p of data.projects.slice(0, 3)) row(clip(p.summary ? `${p.title} — ${p.summary}` : p.title));
      go("projects");
    }
    if (data.posts.length) {
      head(S["pf.writing"](data.posts.length));
      for (const p of data.posts.slice(0, 3)) row(clip(p.title));
      go("writing");
    }
    if (data.views.length) {
      head(S["pf.views"]);
      for (const v of data.views) row(clip(`${v.id} — ${v.line}`));
      go(...data.views.map((v) => `view ${v.id}`));
    }
    head(S["pf.contact"]);
    row(clip([...data.contact.filter((c) => !c.group).map((c) => c.label), "resume --pdf"].join(" · ")));
    go("contact", "mail", "share");
    return out;
  };

  /** `share [command]`: the link that opens the terminal on a command, and the preview image a chat shows for it. */
  const share = (args: string[], st: ShellState): Out[] => {
    const cmdName = (line: string) => line.trim().split(/\s+/)[0].replace(/^\//, "").toLowerCase();
    let cmd = args.join(" ").trim().replace(/\s+/g, " ").replace(/^\//, "");
    if (!cmd) {
      // Default: the command before this one (not share itself), else the whole portfolio.
      const prev = [...st.history].reverse().find((h) => cmdName(h) !== "share" && NAMES.includes(cmdName(h)));
      cmd = prev ? prev.trim().replace(/\s+/g, " ").replace(/^\//, "") : "portfolio";
    }
    // Same shape the `?run=` handler accepts: a known command, plain characters, short.
    if (!/^[a-z][a-z0-9 ._~/-]{0,40}$/i.test(cmd) || !NAMES.includes(cmdName(cmd)))
      return [text(S["err.share"](args.join(" ").trim()))];
    const origin = `https://${host}`;
    const link = `${origin}/?run=${encodeURIComponent(cmd)}`;
    const image = `${origin}/og?cmd=${encodeURIComponent(cmd)}`;
    return [
      text(S["share.head"](cmd), true),
      { kind: "links", prefix: "link   ", items: [{ label: link, href: link }] },
      { kind: "links", prefix: "image  ", items: [{ label: image, href: image }] },
      { kind: "links", prefix: "       ", items: [{ label: S["share.copy"], act: "copy", url: link }, { label: S["share.share"], act: "share", url: link, title: `$ ${cmd} · Ratul Roy` }] },
    ];
  };

  /** `Sun Nov  8 15:04:05 IST 2026`, in the visitor's zone. */
  const date = (): Out[] => {
    const d = new Date();
    const wd = d.toLocaleDateString("en-US", { weekday: "short" });
    const mo = d.toLocaleDateString("en-US", { month: "short" });
    const hms = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
    const zone = new Intl.DateTimeFormat("en-IN", { timeZoneName: "short" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "";
    return [text(`${wd} ${mo} ${String(d.getDate()).padStart(2, " ")} ${hms} ${zone} ${d.getFullYear()}`)];
  };

  const cal = (): Out[] => {
    const d = new Date();
    const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const cells: Array<number | null> = [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
    const weeks: Array<Array<number | null>> = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return [{ kind: "cal", title: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), weeks, today: d.getDate() }];
  };

  const cat = (args: string[], st: ShellState): Out[] => {
    if (!args.length) return [text(S["err.cat.usage"])];
    const out: Out[] = [];
    for (const raw of args) {
      const path = resolvePath(st.cwd, raw);
      const kind = stat(fs, path);
      if (!kind) out.push(text(S["err.cat.none"](raw)));
      else if (kind === "dir") out.push(text(S["err.cat.dir"](raw)));
      else out.push(...render(path, readFile(fs, path) ?? []));
    }
    return out;
  };

  const help = (all: boolean): Out[] => {
    const docs = COMMANDS.map((c) => docOf(S, c));
    const out: Out[] = [];
    if (all) {
      const groups: CommandGroup[] = ["navigate", "read", "open", "terminal"];
      const w = Math.max(...docs.map((c) => c.usage.length)) + 2;
      for (const g of groups) {
        out.push(text(S[`group.${g}` as StringKey] as string, true));
        for (const c of docs.filter((x) => x.group === g)) out.push(text(`  ${c.usage.padEnd(w)}${c.desc}`));
      }
      out.push(text(S["help.footer"], true));
      return out;
    }
    const by = (n: string) => docs.find((c) => c.name === n);
    const w = Math.max(...[...HELP_START, ...HELP_GROUPS.flatMap((g) => g.names)].map((n) => by(n)?.usage.length ?? 0), 1) + 2;
    const row = (usage: string, desc: string) => text(`  ${usage.padEnd(w)}${desc}`);
    out.push(text(S["group.start"], true));
    for (const n of HELP_START) out.push(row(by(n)?.usage ?? n, by(n)?.desc ?? ""));
    out.push(row("/", S["help.slash"]));
    for (const g of HELP_GROUPS) {
      out.push(text(S[g.key] as string, true));
      for (const n of g.names) out.push(row(by(n)?.usage ?? n, by(n)?.desc ?? ""));
    }
    out.push(text(S["help.all"], true));
    return out;
  };

  const man = (name: string | undefined): Out[] => {
    if (!name) return [text(S["man.ask"])];
    const c = [...COMMANDS, ...HIDDEN_DOCS].find((x) => x.name === name.replace(/^\//, ""));
    if (!c) return [text(S["man.none"](name))];
    const d = docOf(S, c);
    return texts([S["man.name"], `  ${d.name} - ${d.desc}`, S["man.usage"], `  ${d.usage}`, ...(d.long ? [S["man.notes"], `  ${d.long}`] : [])]);
  };

  const neofetch = (): Out[] => {
    const rows: Array<[string, string]> = [
      ["host", host],
      ["uptime", data.uptime],
      ["stack", S["unit.tool"](data.stack.length)],
      ["projects", String(data.projects.length)],
      ["posts", String(data.posts.length)],
      ["views", String(data.views.length)],
    ];
    if (data.commit) rows.push(["commit", data.commit]);
    return [{ kind: "neofetch", rows: [`${USER}@code`, "-".repeat(`${USER}@code`.length), ...rows.map(([k, v]) => `${k.padEnd(9)}${v}`)] }];
  };

  /** The résumé's first page: name, title, links, summary, then a line or two per section. */
  const resume = (): Out[] => {
    const r = data.resume;
    const links = data.contact.filter((c) => !c.group).map((c) => ({
      label: c.label,
      href: c.href,
      external: /^https?:\/\//i.test(c.href),
    })).filter((l) => l.external || /^mailto:/i.test(l.href));
    const out: Out[] = [{ kind: "text", text: r.name, accent: true }, text(r.title), text(r.location, true)];
    if (links.length) out.push({ kind: "links", items: links });
    out.push(text(""), text(loc()?.summary ?? r.summary), text(""), text(S["resume.experience"], true));
    for (const x of r.experience) out.push(text(`${x.role} · ${x.company} · ${x.period}`), text(x.headline, true));
    out.push(text(""), text(S["resume.skills"], true));
    for (const g of r.skills) out.push(text(g.group, true), text(g.items.join(" · ")));
    out.push(text(""), text(S["resume.education"], true));
    for (const e of r.education) out.push(text(`${e.degree} · ${e.school} · ${e.year}`));
    const named = r.certifications.find((c) => c.items?.length);
    const more = r.certifications.map((c) => /(\d+\+)/.exec(c.line)?.[1]).find(Boolean);
    if (named) {
      out.push(text(""), text(S["resume.certs"], true));
      out.push(text(S["resume.creds"](named.items?.length ?? 0, named.issuer.split(" / ")[0], more)));
    }
    out.push(text(""), text(S["resume.foot1"], true));
    out.push(text(S["resume.foot2"], true));
    return out;
  };

  const open = (arg: string | undefined, st: ShellState): { lines: Out[]; effect?: Effect } => {
    if (!arg) return { lines: [text(S["err.open.usage"])] };
    const low = arg.toLowerCase();
    const view = data.views.find((v) => v.id.toLowerCase() === low);
    if (view) return { lines: [], effect: { kind: "open-view", id: view.id } };
    if (projectSlugs.has(arg)) return { lines: [], effect: { kind: "open-slug", slug: arg } };
    if (postSlugs.has(arg)) return { lines: [], effect: { kind: "open-slug", slug: arg, blog: true } };
    if (/^https?:\/\//i.test(arg)) return { lines: [], effect: { kind: "open-url", url: arg } };
    const path = resolvePath(st.cwd, arg);
    const m = new RegExp(`^${HOME}/(projects|writing)/(.+)\\.md$`).exec(path);
    if (m && stat(fs, path)) return { lines: [], effect: { kind: "open-slug", slug: m[2], blog: m[1] === "writing" } };
    return { lines: [text(S["err.open.none"](arg))] };
  };

  type Exec = { lines: Out[]; effect?: Effect; menu?: MenuId; cwd?: string };

  const exec = (line: string, st: ShellState, env?: { cols?: number; lang?: Lang }): Exec => {
    const tokens = line.trim().split(/\s+/);
    let name = tokens[0];
    if (name.startsWith("/") && name.length > 1) name = name.slice(1);
    else if (name === "/") name = "help";
    const args = tokens.slice(1);
    const low = name.toLowerCase();

    switch (low) {
      case "help":
        return { lines: help(args.some((a) => a === "--all" || a === "-a")) };
      case "lang": {
        if (!args.length) return menu("langs");
        const a = args[0].toLowerCase() as Lang;
        if (args.length > 1 || !LANGS.includes(a)) return { lines: [text(S["err.lang"])] };
        // The confirmation is in the language just chosen.
        return { lines: [text(STRINGS[a]["lang.set"], true)], effect: { kind: "lang", lang: a } };
      }
      case "man":
        return { lines: man(args[0]) };
      case "ls":
        return ls(args, st);
      case "cd": {
        if (!args.length || args[0] === "~") return { lines: [], cwd: HOME };
        const path = resolvePath(st.cwd, args[0]);
        const kind = stat(fs, path);
        if (!kind) return { lines: [text(S["err.cd.none"](args[0]))] };
        if (kind !== "dir") return { lines: [text(S["err.cd.notdir"](args[0]))] };
        return { lines: [], cwd: path };
      }
      case "pwd":
        return { lines: [text(st.cwd)] };
      case "tree":
        return { lines: tree(args[0], st) };
      case "cat":
        return { lines: cat(args, st) };
      case "about":
        return { lines: cat(["~/about"], st) };
      case "stack":
        return { lines: cat(["~/stack"], st) };
      case "uptime":
        return { lines: cat(["~/uptime"], st) };
      case "contact":
        return { lines: cat(["~/contact"], st) };
      case "git":
        return git(args);
      case "portfolio":
        return { lines: portfolio(env?.cols ?? 100) };
      case "hire":
        return { lines: hire() };
      case "now":
        return { lines: now() };
      case "timeline":
        return { lines: timeline(env?.cols ?? 100, args.includes("--all")) };
      case "view":
        return args[0] ? open(args[0], st) : menu("views");
      case "share":
        return { lines: share(args, st) };
      case "fit": {
        const body = line.trim().replace(/^\/?fit\s*/i, "");
        return body ? { lines: fit(body) } : { lines: [], effect: { kind: "fit-box" } };
      }
      case "screensaver": {
        const a = (args[0] ?? "").toLowerCase();
        if (args.length > 1 || (a && a !== "off" && a !== "on")) return { lines: [text(S["err.saver.usage"])] };
        return { lines: [], effect: { kind: "saver", mode: a === "off" ? "off" : a === "on" ? "on" : "now" } };
      }
      case "arch":
        return { lines: arch(args[0], env?.cols ?? 100) };
      case "mail":
        return { lines: [], effect: { kind: "mail" } };
      case "pane":
        return { lines: [], effect: { kind: "pane" } };
      case "date":
        return { lines: date() };
      case "cal":
        return { lines: cal() };
      case "sudo":
        if (args.join(" ").toLowerCase() === "make me a sandwich") return { lines: [text(S["sudo.ok"]), ...texts(cow(S["sudo.sandwich"]))] };
        return { lines: [text(S["sudo.nice"])] };
      case "whoami":
        return { lines: [text(USER), text(loc()?.who ?? data.who, true)] };
      case "neofetch":
        return { lines: neofetch() };
      case "resume":
        if (args.includes("--pdf"))
          return {
            lines: [
              text(S["resume.pdf"]),
              { kind: "link", label: "/resume.pdf", href: "/resume.pdf", external: true },
            ],
            effect: { kind: "window", url: "/resume.pdf" },
          };
        return { lines: resume() };
      case "stats": {
        const a = (args[0] ?? "").toLowerCase();
        if (args.length > 1 || (a && a !== "year" && a !== "langs")) return { lines: [text(S["err.stats.usage"])] };
        return { lines: [], effect: { kind: "stats", mode: a === "year" ? "year" : a === "langs" ? "langs" : "all" } };
      }
      case "curl": {
        const t = (args[0] ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "").toLowerCase();
        if (!args.length) return { lines: [text(S["err.curl.usage"])] };
        if (t === "github" || t === "github.com/royal-programmer") return { lines: [], effect: { kind: "curl-github" } };
        return { lines: [text(S["err.curl.host"](args[0]))] };
      }
      case "theme": {
        if (!args[0]) return menu("themes");
        if (args[0].toLowerCase() === "random") {
          const th = THEMES[Math.floor(Math.random() * THEMES.length)];
          return { lines: [], effect: { kind: "theme", id: th.id } };
        }
        const th = THEMES.find((x) => x.id === args[0].toLowerCase());
        if (!th) return { lines: [text(S["err.theme"](args[0], THEMES.map((x) => x.id).join(", ")))] };
        return { lines: [], effect: { kind: "theme", id: th.id } };
      }
      case "install":
        return { lines: [], effect: { kind: "install" } };
      case "crt":
        return { lines: [], effect: { kind: "crt" } };
      case "qr":
        return { lines: [], effect: { kind: "qr" } };
      case "sl":
        return { lines: [], effect: { kind: "sl" } };
      case "cowsay":
        return { lines: texts(cow(args.join(" "))) };
      case "fortune":
        return { lines: [text(S.fortunes[Math.floor(Math.random() * S.fortunes.length)])] };
      case "rm":
        return { lines: [text(args.some((a) => a === "/" || /^-\w*r\w*$/.test(a)) ? S["rm.root"] : S["rm.ro"])] };
      case "vim":
      case "vi":
      case "nano":
      case "emacs":
        return { lines: [text(S["vim.no"])] };
      case "portrait": {
        const a = (args[0] ?? "").toLowerCase();
        if (!a) return { lines: [{ kind: "portrait", mode: "pixels" }] };
        if (a === "next") return { lines: [{ kind: "portrait", mode: "next" }] };
        if (a === "list") return { lines: [text(S["portrait.modes"], true), { kind: "links", prefix: "  ", items: PORTRAIT_MODES.map((m) => ({ label: m, cmd: `portrait ${m}` })) }] };
        if (isPortraitMode(a)) return { lines: [{ kind: "portrait", mode: a }] };
        return { lines: [text(S["err.portrait"](args[0]))] };
      }
      case "open":
        return open(args.join(" ").trim() || undefined, st);
      case "views":
      case "projects":
      case "writing":
        return menu(low);
      case "banner":
        return { lines: banner() };
      case "history":
        return { lines: texts(st.history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`)) };
      case "clear":
      case "cls":
        return { lines: [], effect: { kind: "clear" } };
      case "fullscreen":
        return { lines: [], effect: { kind: "fullscreen" } };
      case "echo":
        return { lines: [text(args.join(" ").replace(/^(["'])(.*)\1$/, "$2"))] };
      case "exit":
        return { lines: [], effect: { kind: "exit" } };
    }

    // Bare view id; bare number against the menu last shown.
    const view = data.views.find((v) => v.id.toLowerCase() === low);
    if (view && !args.length) return { lines: [], effect: { kind: "open-view", id: view.id } };
    if (/^\d+$/.test(low) && !args.length && st.lastMenu) {
      const n = Number(low) - 1;
      if (st.lastMenu === "views") {
        const v = data.views[n];
        return v ? { lines: [], effect: { kind: "open-view", id: v.id } } : { lines: [text(S["err.norow"](low))] };
      }
      if (st.lastMenu === "themes") {
        const t = THEMES[n];
        return t ? { lines: [], effect: { kind: "theme", id: t.id } } : { lines: [text(S["err.norow"](low))] };
      }
      if (st.lastMenu === "langs") {
        const l = LANGS[n];
        return l ? exec(`lang ${l}`, st, env) : { lines: [text(S["err.norow"](low))] };
      }
      const item = (st.lastMenu === "projects" ? data.projects : data.posts)[n];
      return item ? { lines: cat([`~/${st.lastMenu}/${item.slug}.md`], st) } : { lines: [text(S["err.norow"](low))] };
    }

    // A bare 1-9 with no menu showing is the tips box's number.
    if (/^[1-9]$/.test(low) && !args.length) return { lines: [], effect: { kind: "run", cmd: TIPS[Number(low) - 1].cmd } };

    const near = didYouMean(low, [...NAMES, ...viewIds]);
    return {
      lines: [
        text(S["err.notfound"](name)),
        ...(near.length ? [{ kind: "links" as const, dim: true, prefix: S["err.didyoumean"], items: near.map((n) => ({ label: n, cmd: n })), suffix: "?" }] : []),
      ],
    };
  };

  return {
    commands: COMMANDS.map((c) => docOf(STRINGS.en, c)),
    docs: (lang) => COMMANDS.map((c) => docOf(STRINGS[lang], c)),
    banner: (lang) => {
      setLang(lang);
      return banner();
    },
    fit: (text, lang) => {
      setLang(lang);
      return fit(text);
    },
    run(input, state, env) {
      setLang(env?.lang);
      const line = input.trim();
      if (!line) return { lines: [], state };
      const withLine = state.history[state.history.length - 1] === line ? state.history : [...state.history, line].slice(-HISTORY_CAP);
      const r = exec(line, { ...state, history: withLine }, env);
      // A tip's number runs the real command next, and that is what history should keep.
      const history = r.effect?.kind === "run" ? state.history : withLine;
      return { lines: r.lines, effect: r.effect, state: { cwd: r.cwd ?? state.cwd, history, lastMenu: r.menu } };
    },
    complete(input, state) {
      const m = /^(.*?)(\S*)$/.exec(input) ?? [];
      const head = (m[1] ?? "").trim();
      const word = m[2] ?? "";
      if (!head) {
        if (word.startsWith("/")) return [];
        return [...NAMES, ...viewIds].filter((n) => n.startsWith(word.toLowerCase()));
      }
      const cmd = head.split(/\s+/)[0].replace(/^\//, "").toLowerCase();
      if (cmd === "help") return ["--all", ...NAMES].filter((n) => n.startsWith(word.toLowerCase()));
      if (cmd === "man") return NAMES.filter((n) => n.startsWith(word.toLowerCase()));
      if (cmd === "open") {
        const pool = [...viewIds, ...data.projects.map((p) => p.slug), ...data.posts.map((p) => p.slug)];
        return [...pool.filter((n) => n.startsWith(word)), ...completePath(fs, state.cwd, word)].filter((v, i, a) => a.indexOf(v) === i);
      }
      if (cmd === "view") return viewIds.filter((n) => n.startsWith(word));
      if (cmd === "theme") return [...THEMES.map((t) => t.id as string), "random"].filter((n) => n.startsWith(word));
      if (cmd === "portrait") return [...PORTRAIT_MODES, "list", "next"].filter((n) => n.startsWith(word));
      if (cmd === "fit") return [];
      if (cmd === "screensaver") return ["off", "on"].filter((n) => n.startsWith(word));
      if (cmd === "lang") return [...LANGS].filter((n) => n.startsWith(word.toLowerCase()));
      if (cmd === "arch") return data.arch.map((d) => d.id).filter((n) => n.startsWith(word.toLowerCase()));
      if (cmd === "hire") return ["--brief"].filter((n) => n.startsWith(word));
      if (cmd === "mail") return ["--fit"].filter((n) => n.startsWith(word));
      if (cmd === "share") return NAMES.filter((n) => n.startsWith(word.toLowerCase()));
      if (cmd === "timeline") return ["--all"].filter((n) => n.startsWith(word));
      if (cmd === "resume") return ["--pdf"].filter((n) => n.startsWith(word));
      if (cmd === "stats") return ["year", "langs"].filter((n) => n.startsWith(word));
      if (cmd === "curl") return ["github"].filter((n) => n.startsWith(word));
      if (cmd === "git") {
        if (head.trim() === "git") return ["log", "status"].filter((n) => n.startsWith(word));
        if (/^git\s+log\b/.test(head)) return ["--oneline", "--graph", "-n"].filter((n) => n.startsWith(word));
        return [];
      }
      if (cmd === "cd") return completePath(fs, state.cwd, word).filter((c) => c.endsWith("/"));
      if (cmd === "ls" && word.startsWith("-")) return ["-l"].filter((n) => n.startsWith(word));
      if (cmd === "ls" || cmd === "cat" || cmd === "tree") return completePath(fs, state.cwd, word);
      return [];
    },
  };
}
