/**
 * The Engineer terminal's shell (17-persona-views.md §6.3): parses a command line and answers with
 * output lines plus, at most, one effect for the UI to carry out (open a page, exit, clear,
 * toggle full screen). Pure: no React, no DOM, no navigation; the UI resolves hrefs.
 */
import { DISPLAY_ROOT, personaIdentity } from "@/lib/site/brand";
import { BANNER_ROYAL_PROGRAMMER } from "@/lib/site/terminal-art";
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
import type { TermCommit, TerminalData } from "@/lib/site/terminal-data";

export type MenuId = "views" | "projects" | "writing";
export type MenuRow = { key: string; label: string; line: string };

/** One name in a listing: a button that runs `cat` (files), `cd` (dirs) or `open` (views). */
export type FileItem = { name: string; type: EntryKind; path: string; meta?: string };

export type Tone = "accent" | "green" | "violet" | "dim";

/** The terminal's themes (`theme <name>`). `color` is the swatch; the UI maps each id to CSS variables. */
export const THEMES = [
  { id: "accent", color: "var(--persona-c)", note: "the persona colour, on near-black" },
  { id: "amber", color: "#ffb000", note: "amber on brown-black" },
  { id: "green", color: "#33ff66", note: "green phosphor" },
  { id: "paper", color: "#cfc8b4", note: "a light terminal" },
] as const;
export type ThemeId = (typeof THEMES)[number]["id"];

const FORTUNES = [
  "Ship it small. The second release is where the real bug report arrives.",
  "An API is a promise with a version number. Mind the number.",
  "If you do a thing three times, a script should have done it twice.",
  "Roster season: everyone wants the schedule, nobody wants it to change.",
  "Bengaluru traffic is a queue with no consumer. Leave early, or deploy remotely.",
  "Idempotency keys are cheaper than apologies.",
  "The retry that works on Thursday was written on Monday by someone worried.",
  "Reconcile before you celebrate. The two totals rarely agree the first time.",
  "Automation is documentation that runs.",
  "Production is the only environment where the data is honest.",
  "A migration with no rollback plan is a one-way door and a long night.",
  "Query slow? Read the join first, blame the network last.",
];

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
const HIDDEN_DOCS: CommandDoc[] = [
  { name: "sl", group: "terminal", usage: "sl", desc: "a steam locomotive crosses the screen" },
  { name: "cowsay", group: "terminal", usage: "cowsay <text>", desc: "a cow says it" },
  { name: "fortune", group: "terminal", usage: "fortune", desc: "a line from the desk" },
  { name: "sudo", group: "terminal", usage: "sudo <command>", desc: "nice try", long: "sudo make me a sandwich is the one that works." },
];

export type Out =
  | { kind: "text"; text: string; dim?: boolean; accent?: boolean }
  /** One line of differently coloured runs (`git log`, `theme`); `color` is a CSS colour for a swatch. */
  | { kind: "parts"; parts: Array<{ text: string; tone?: Tone; color?: string }> }
  /** A QR code as text rows (`qr`). */
  | { kind: "qr"; lines: string[] }
  /** Several links on one line, joined by " · ". */
  | { kind: "links"; items: Array<{ label: string; href: string; external?: boolean }> }
  /** A listing: `inline` joins the names on one line (`ls`); otherwise it is one row, `meta` before the name. */
  | { kind: "files"; inline: boolean; items: FileItem[] }
  /** `cal`: weeks of day numbers (null = blank), today highlighted. */
  | { kind: "cal"; title: string; weeks: Array<Array<number | null>>; today: number }
  /** The pixel portrait (`portrait`). */
  | { kind: "portrait" }
  /** The `neofetch` card: the small portrait on the left, these rows on the right. */
  | { kind: "neofetch"; rows: string[] }
  | { kind: "link"; label: string; href: string; external?: boolean }
  /** A line that runs a command when clicked (`open <slug>` at the foot of a project). */
  | { kind: "run"; text: string; cmd: string }
  | { kind: "menu"; id: MenuId; rows: MenuRow[] }
  /** The welcome: block-letter art (88 columns), the welcome line, and the tips box rows. */
  | { kind: "banner"; art: string[]; welcome: string; overview: string[]; tips: Array<{ cmd: string; desc: string }> };

export type Effect =
  | { kind: "open-view"; id: string }
  | { kind: "open-slug"; slug: string; blog?: boolean }
  | { kind: "open-url"; url: string }
  | { kind: "exit" }
  | { kind: "clear" }
  | { kind: "fullscreen" }
  | { kind: "pane" }
  /** The guided tour, and the inline contact form: both run in the UI, which owns the prompt. */
  | { kind: "demo" }
  | { kind: "window"; url: string }
  | { kind: "theme"; id: ThemeId }
  | { kind: "crt" }
  | { kind: "qr" }
  | { kind: "curl-github" }
  | { kind: "sl" }
  | { kind: "mail" };

export type ShellState = { cwd: string; history: string[]; lastMenu?: MenuId };
export type RunResult = { lines: Out[]; effect?: Effect; state: ShellState };

export type CommandGroup = "navigate" | "read" | "open" | "terminal";
export type CommandDoc = { name: string; group: CommandGroup; usage: string; desc: string; long?: string };

export type Shell = {
  /** The welcome block (banner, welcome line, tips), as `banner` prints it. */
  banner: () => Out[];
  run: (input: string, state: ShellState) => RunResult;
  /** Candidates for the last token of `input` (whole-token strings; the UI swaps the token in). */
  complete: (input: string, state: ShellState) => string[];
  commands: CommandDoc[];
};

export const HISTORY_CAP = 200;
export const initialShellState = (history: string[] = []): ShellState => ({ cwd: HOME, history });

const COMMANDS: CommandDoc[] = [
  { name: "help", group: "terminal", usage: "help", desc: "list the commands", long: "/help does the same." },
  { name: "man", group: "terminal", usage: "man <command>", desc: "the manual for one command" },
  { name: "ls", group: "navigate", usage: "ls [-l] [path]", desc: "list files; ls views is the picker" },
  { name: "cd", group: "navigate", usage: "cd [path]", desc: "change directory" },
  { name: "pwd", group: "navigate", usage: "pwd", desc: "where you are" },
  { name: "tree", group: "navigate", usage: "tree [path]", desc: "the whole tree" },
  { name: "cat", group: "read", usage: "cat <file>", desc: "print a file" },
  { name: "about", group: "read", usage: "about", desc: "who I am, longer" },
  { name: "stack", group: "read", usage: "stack", desc: "the tools I work in" },
  { name: "uptime", group: "read", usage: "uptime", desc: "time in production" },
  { name: "contact", group: "read", usage: "contact", desc: "mail and github, as links" },
  { name: "curl", group: "read", usage: "curl github", desc: "live: repos, last push, contributions" },
  { name: "qr", group: "open", usage: "qr", desc: "this page as a QR code" },
  { name: "theme", group: "terminal", usage: "theme [name]", desc: "accent · amber · green · paper" },
  { name: "crt", group: "terminal", usage: "crt", desc: "toggle scanlines" },
  { name: "resume", group: "read", usage: "resume [--pdf]", desc: "the overview, like the résumé's first page" },
  { name: "portrait", group: "read", usage: "portrait", desc: "me, in characters" },
  { name: "whoami", group: "read", usage: "whoami", desc: "one line about me" },
  { name: "neofetch", group: "read", usage: "neofetch", desc: "a stat card for this host" },
  { name: "open", group: "open", usage: "open <view|slug|url>", desc: "open a view, a project or post, or a link" },
  { name: "views", group: "open", usage: "views", desc: "pick a view" },
  { name: "projects", group: "open", usage: "projects", desc: "pick a project to read" },
  { name: "writing", group: "open", usage: "writing", desc: "pick a post to read" },
  { name: "banner", group: "terminal", usage: "banner", desc: "print the welcome again" },
  { name: "history", group: "terminal", usage: "history", desc: "commands typed this session" },
  { name: "clear", group: "terminal", usage: "clear", desc: "empty the screen" },
  { name: "demo", group: "terminal", usage: "demo", desc: "a guided tour; any key stops it" },
  { name: "git", group: "read", usage: "git log [--oneline|--graph|-n k]", desc: "the career as a git history" },
  { name: "mail", group: "open", usage: "mail", desc: "send me a message, right here" },
  { name: "pane", group: "terminal", usage: "pane", desc: "show or hide the side pane" },
  { name: "date", group: "terminal", usage: "date", desc: "the local date and time" },
  { name: "cal", group: "terminal", usage: "cal", desc: "this month, today highlighted" },
  { name: "fullscreen", group: "terminal", usage: "fullscreen", desc: "toggle browser full screen" },
  { name: "echo", group: "terminal", usage: "echo <text>", desc: "print text" },
  { name: "exit", group: "terminal", usage: "exit", desc: "back to the hub", long: "Esc at an empty prompt does the same." },
];
const NAMES = COMMANDS.map((c) => c.name);

const text = (t: string, dim = false): Out => ({ kind: "text", text: t, dim: dim || undefined });
const texts = (ls: string[]): Out[] => ls.map((l) => text(l));

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function nearest(word: string, pool: string[]): string | null {
  if (word.length < 3) return null;
  const limit = Math.max(1, Math.floor(word.length / 3));
  let best: string | null = null;
  let bd = limit + 1;
  for (const n of pool) {
    const dd = distance(word, n);
    if (dd < bd) {
      bd = dd;
      best = n;
    }
  }
  return best;
}

export function createShell(data: TerminalData): Shell {
  const fs: Fs = buildFs(data);
  const host = `${personaIdentity("engineer").subdomain}.${DISPLAY_ROOT}`;
  const viewIds = data.views.map((v) => v.id);
  const projectSlugs = new Set(data.projects.map((p) => p.slug));
  const postSlugs = new Set(data.posts.map((p) => p.slug));

  const menu = (id: MenuId): { lines: Out[]; menu?: MenuId } => {
    const rows: MenuRow[] =
      id === "views"
        ? data.views.map((v) => ({ key: v.id, label: v.id, line: v.line }))
        : id === "projects"
          ? data.projects.map((p) => ({ key: p.slug, label: p.slug, line: [p.title, p.year].filter(Boolean).join(" · ") }))
          : data.posts.map((p) => ({ key: p.slug, label: p.slug, line: [p.title, p.date].filter(Boolean).join(" · ") }));
    if (!rows.length) return { lines: [text(`no ${id} yet`, true)] };
    return { lines: [{ kind: "menu", id, rows }], menu: id };
  };

  /** A file's lines as output: links and the `open` line become clickable. */
  const render = (path: string, lines: string[]): Out[] => {
    if (path === `${HOME}/contact`) {
      const w = Math.max(...data.contact.map((x) => x.label.length));
      return data.contact.map((c): Out => {
        const label = `${c.label.padEnd(w)}  ${c.href.replace(/^mailto:/i, "")}`;
        if (/^https?:\/\//i.test(c.href)) return { kind: "link", label, href: c.href, external: true };
        if (/^mailto:/i.test(c.href)) return { kind: "link", label, href: c.href };
        return text(label);
      });
    }
    return lines.map((l): Out => {
      const link = /^(?:repo|live) ↗ (\S+)$/.exec(l);
      if (link) return /^https?:\/\//i.test(link[1]) ? { kind: "link", label: l, href: link[1], external: true } : text(l);
      const open = /^open (\S+)  → /.exec(l);
      if (open) return { kind: "run", text: l, cmd: `open ${open[1]}` };
      return text(l);
    });
  };

  const banner = (): Out[] => [
    {
      kind: "banner",
      art: [...BANNER_ROYAL_PROGRAMMER],
      welcome: `royal-programmer ${data.commit ?? "v1"} · ${host}`,
      overview: [data.who, data.stack.join(" · "), data.uptime],
      tips: [
        { cmd: "help", desc: "every command" },
        { cmd: "/", desc: "the command menu" },
        ...(data.views[0] ? [{ cmd: `open ${data.views[0].id}`, desc: "enter a view" }] : []),
        { cmd: "projects", desc: "read what I built" },
        { cmd: "resume", desc: "the overview" },
        { cmd: "demo", desc: "a guided tour" },
      ],
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
        out.push(text(`ls: cannot access '${raw}': No such file or directory`));
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
    if (!kind) return [text(`tree: ${raw}: No such file or directory`)];
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
  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${MONTHS[Number(m) - 1] ?? m} ${d} ${y}`;
  };
  /** A stable 7-hex id from date + subject (FNV-1a). */
  const hashOf = (c: TermCommit) => {
    let h = 0x811c9dc5;
    for (const ch of `${c.date}${c.subject}`) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    return h.toString(16).padStart(8, "0").slice(0, 7);
  };
  const LANE: Record<TermCommit["branch"], number> = { main: 0, side: 1, learn: 2 };
  const LANE_TONE: Tone[] = ["accent", "green", "violet"];

  /** `git log [--oneline] [--graph] [-n k | -k]`: newest first; `--graph` draws main, side and learn as lanes. */
  const gitLog = (args: string[]): Out[] => {
    let limit = Infinity;
    let oneline = false;
    let graph = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--oneline") oneline = true;
      else if (a === "--graph") graph = true;
      else if (a === "-n") {
        if (!/^\d+$/.test(args[i + 1] ?? "")) return [text(`fatal: '${args[i + 1] ?? ""}' is not a number`)];
        limit = Number(args[++i]);
      }
      else if (/^-\d+$/.test(a)) limit = Number(a.slice(1));
      else return [text(`fatal: unrecognized argument: ${a}`)];
    }
    const list = data.timeline.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
    // A side lane is open from its newest commit to its oldest in this list.
    const first: number[] = [-1, -1, -1];
    const last: number[] = [-1, -1, -1];
    list.forEach((c, i) => {
      const l = LANE[c.branch];
      if (first[l] < 0) first[l] = i;
      last[l] = i;
    });
    const active = (i: number, skip = -1) => [0, 1, 2].map((l) => l !== skip && (l === 0 || (first[l] >= 0 && first[l] <= i && i <= last[l])));
    const lanes = (on: boolean[], star = -1): Array<{ text: string; tone?: Tone }> =>
      [0, 1, 2].map((l) => ({ text: `${star === l ? "*" : on[l] ? "|" : " "} `, tone: LANE_TONE[l] }));
    const connector = (on: boolean[], lane: number, ch: string): Array<{ text: string; tone?: Tone }> => {
      const cells = [0, 1, 2].map((l) => (on[l] ? "| " : "  ").split(""));
      cells[lane - 1][1] = ch;
      return cells.map((c, l) => ({ text: c.join(""), tone: l === lane - 1 ? LANE_TONE[lane] : LANE_TONE[l] }));
    };
    const out: Out[] = [];
    list.forEach((c, i) => {
      const l = LANE[c.branch];
      const hash = hashOf(c);
      const tag = c.tag ? [{ text: ` (tag: ${c.tag})`, tone: "green" as Tone }] : [];
      if (graph && l > 0 && first[l] === i) out.push({ kind: "parts", parts: connector(active(i, l), l, "\\") });
      const g = (star: boolean) => (graph ? lanes(active(i), star ? l : -1) : []);
      if (oneline) {
        out.push({ kind: "parts", parts: [...g(true), { text: hash, tone: "accent" }, ...tag, { text: ` ${c.subject}` }] });
      } else {
        out.push({ kind: "parts", parts: [...g(true), { text: `commit ${hash}`, tone: "accent" }, ...tag] });
        const rest = [`Date:   ${fmtDate(c.date)}`, "", `    ${c.subject}`, ...(c.body ?? []).map((b) => `    ${b}`), ""];
        for (const r of rest) out.push({ kind: "parts", parts: [...g(false), { text: r }] });
      }
      if (graph && l > 0 && last[l] === i && i < list.length - 1) out.push({ kind: "parts", parts: connector(active(i + 1, l), l, "/") });
    });
    return out;
  };

  const git = (args: string[]): Out[] => {
    const sub = args[0];
    if (sub === "log") return gitLog(args.slice(1));
    if (sub === "status") return [text("On branch main · nothing to commit, working tree clean")];
    if (sub) return [text(`git: '${sub}' is not a git command. See 'git'.`)];
    return texts(["usage: git <command>", "  log [--oneline] [--graph] [-n k]   the career as a git history", "  status                             where things stand"]);
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
    if (!args.length) return [text("usage: cat <file>")];
    const out: Out[] = [];
    for (const raw of args) {
      const path = resolvePath(st.cwd, raw);
      const kind = stat(fs, path);
      if (!kind) out.push(text(`cat: ${raw}: No such file or directory`));
      else if (kind === "dir") out.push(text(`cat: ${raw}: Is a directory`));
      else out.push(...render(path, readFile(fs, path) ?? []));
    }
    return out;
  };

  const help = (): Out[] => {
    const groups: CommandGroup[] = ["navigate", "read", "open", "terminal"];
    const w = Math.max(...COMMANDS.map((c) => c.usage.length)) + 2;
    const out: Out[] = [];
    for (const g of groups) {
      out.push(text(g, true));
      for (const c of COMMANDS.filter((x) => x.group === g)) out.push(text(`  ${c.usage.padEnd(w)}${c.desc}`));
    }
    out.push(text("Tab completes, ↑ recalls, / opens the menu, banner shows the welcome, Esc leaves.", true));
    return out;
  };

  const man = (name: string | undefined): Out[] => {
    if (!name) return [text("what manual page do you want? try: man ls")];
    const c = [...COMMANDS, ...HIDDEN_DOCS].find((x) => x.name === name.replace(/^\//, ""));
    if (!c) return [text(`No manual entry for ${name}`)];
    return texts(["NAME", `  ${c.name} - ${c.desc}`, "USAGE", `  ${c.usage}`, ...(c.long ? ["NOTES", `  ${c.long}`] : [])]);
  };

  const neofetch = (): Out[] => {
    const rows: Array<[string, string]> = [
      ["host", host],
      ["uptime", data.uptime],
      ["stack", `${data.stack.length} tools`],
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
    const links = data.contact.map((c) => ({
      label: c.label,
      href: c.href,
      external: /^https?:\/\//i.test(c.href),
    })).filter((l) => l.external || /^mailto:/i.test(l.href));
    const out: Out[] = [{ kind: "text", text: r.name, accent: true }, text(r.title), text(r.location, true)];
    if (links.length) out.push({ kind: "links", items: links });
    out.push(text(""), text(r.summary), text(""), text("experience", true));
    for (const x of r.experience) out.push(text(`${x.role} · ${x.company} · ${x.period}`), text(x.headline, true));
    out.push(text(""), text("skills", true));
    for (const g of r.skills) out.push(text(g.group, true), text(g.items.join(" · ")));
    out.push(text(""), text("education", true));
    for (const e of r.education) out.push(text(`${e.degree} · ${e.school} · ${e.year}`));
    const named = r.certifications.find((c) => c.items?.length);
    const more = r.certifications.map((c) => /(\d+\+)/.exec(c.line)?.[1]).find(Boolean);
    if (named) {
      out.push(text(""), text("certifications", true));
      out.push(text(`${named.items?.length} ${named.issuer.split(" / ")[0]} credentials${more ? ` · ${more} more` : ""}`));
    }
    out.push(text(""), text("cat ~/resume/experience for the full story · ls ~/resume", true));
    return out;
  };

  const open = (arg: string | undefined, st: ShellState): { lines: Out[]; effect?: Effect } => {
    if (!arg) return { lines: [text("usage: open <view|slug|url>")] };
    const low = arg.toLowerCase();
    const view = data.views.find((v) => v.id.toLowerCase() === low);
    if (view) return { lines: [], effect: { kind: "open-view", id: view.id } };
    if (projectSlugs.has(arg)) return { lines: [], effect: { kind: "open-slug", slug: arg } };
    if (postSlugs.has(arg)) return { lines: [], effect: { kind: "open-slug", slug: arg, blog: true } };
    if (/^https?:\/\//i.test(arg)) return { lines: [], effect: { kind: "open-url", url: arg } };
    const path = resolvePath(st.cwd, arg);
    const m = new RegExp(`^${HOME}/(projects|writing)/(.+)\\.md$`).exec(path);
    if (m && stat(fs, path)) return { lines: [], effect: { kind: "open-slug", slug: m[2], blog: m[1] === "writing" } };
    return { lines: [text(`open: no such view, page or link: ${arg}`)] };
  };

  type Exec = { lines: Out[]; effect?: Effect; menu?: MenuId; cwd?: string };

  const exec = (line: string, st: ShellState): Exec => {
    const tokens = line.trim().split(/\s+/);
    let name = tokens[0];
    if (name.startsWith("/") && name.length > 1) name = name.slice(1);
    else if (name === "/") name = "help";
    const args = tokens.slice(1);
    const low = name.toLowerCase();

    switch (low) {
      case "help":
        return { lines: help() };
      case "man":
        return { lines: man(args[0]) };
      case "ls":
        return ls(args, st);
      case "cd": {
        if (!args.length || args[0] === "~") return { lines: [], cwd: HOME };
        const path = resolvePath(st.cwd, args[0]);
        const kind = stat(fs, path);
        if (!kind) return { lines: [text(`cd: no such file or directory: ${args[0]}`)] };
        if (kind !== "dir") return { lines: [text(`cd: not a directory: ${args[0]}`)] };
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
        return { lines: git(args) };
      case "demo":
        return { lines: [], effect: { kind: "demo" } };
      case "mail":
        return { lines: [], effect: { kind: "mail" } };
      case "pane":
        return { lines: [], effect: { kind: "pane" } };
      case "date":
        return { lines: date() };
      case "cal":
        return { lines: cal() };
      case "sudo":
        if (args.join(" ").toLowerCase() === "make me a sandwich") return { lines: [text("okay."), ...texts(cow("one sandwich: ham, cheese, zero downtime"))] };
        return { lines: [text("nice try")] };
      case "whoami":
        return { lines: [text(USER), text(data.who, true)] };
      case "neofetch":
        return { lines: neofetch() };
      case "resume":
        if (args.includes("--pdf"))
          return {
            lines: [
              text("opening the résumé (pdf) · no phone number in the public copy"),
              { kind: "link", label: "/Ratul_Roy_Resume.pdf", href: "/Ratul_Roy_Resume.pdf", external: true },
            ],
            effect: { kind: "window", url: "/Ratul_Roy_Resume.pdf" },
          };
        return { lines: resume() };
      case "curl": {
        const t = (args[0] ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "").toLowerCase();
        if (!args.length) return { lines: [text("usage: curl github")] };
        if (t === "github" || t === "github.com/royal-programmer") return { lines: [], effect: { kind: "curl-github" } };
        return { lines: [text(`curl: (6) could not resolve host: ${args[0]}`)] };
      }
      case "theme": {
        if (!args[0])
          return {
            lines: [
              ...THEMES.map((th): Out => ({ kind: "parts", parts: [{ text: "███ ", color: th.color }, { text: th.id.padEnd(8) }, { text: th.note, tone: "dim" }] })),
              text("theme <name> to switch", true),
            ],
          };
        const th = THEMES.find((x) => x.id === args[0].toLowerCase());
        if (!th) return { lines: [text(`theme: unknown theme '${args[0]}' (${THEMES.map((x) => x.id).join(", ")})`)] };
        return { lines: [], effect: { kind: "theme", id: th.id } };
      }
      case "crt":
        return { lines: [], effect: { kind: "crt" } };
      case "qr":
        return { lines: [], effect: { kind: "qr" } };
      case "sl":
        return { lines: [], effect: { kind: "sl" } };
      case "cowsay":
        return { lines: texts(cow(args.join(" "))) };
      case "fortune":
        return { lines: [text(FORTUNES[Math.floor(Math.random() * FORTUNES.length)])] };
      case "rm":
        return { lines: [text(args.some((a) => a === "/" || /^-\w*r\w*$/.test(a)) ? "nice try. this is my home." : "rm: read-only file system")] };
      case "vim":
      case "vi":
      case "nano":
      case "emacs":
        return { lines: [text("no. try cat.")] };
      case "portrait":
        return { lines: [{ kind: "portrait" }] };
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
        return v ? { lines: [], effect: { kind: "open-view", id: v.id } } : { lines: [text(`no row ${low}`)] };
      }
      const item = (st.lastMenu === "projects" ? data.projects : data.posts)[n];
      return item ? { lines: cat([`~/${st.lastMenu}/${item.slug}.md`], st) } : { lines: [text(`no row ${low}`)] };
    }

    const near = nearest(low, NAMES);
    return { lines: [text(`command not found: ${name}`), ...(near ? [text(`did you mean: ${near}`, true)] : [])] };
  };

  return {
    commands: COMMANDS,
    banner,
    run(input, state) {
      const line = input.trim();
      if (!line) return { lines: [], state };
      const history = state.history[state.history.length - 1] === line ? state.history : [...state.history, line].slice(-HISTORY_CAP);
      const r = exec(line, { ...state, history });
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
      if (cmd === "man" || cmd === "help") return NAMES.filter((n) => n.startsWith(word.toLowerCase()));
      if (cmd === "open") {
        const pool = [...viewIds, ...data.projects.map((p) => p.slug), ...data.posts.map((p) => p.slug)];
        return [...pool.filter((n) => n.startsWith(word)), ...completePath(fs, state.cwd, word)].filter((v, i, a) => a.indexOf(v) === i);
      }
      if (cmd === "theme") return THEMES.map((t) => t.id as string).filter((n) => n.startsWith(word));
      if (cmd === "resume") return ["--pdf"].filter((n) => n.startsWith(word));
      if (cmd === "curl") return ["github"].filter((n) => n.startsWith(word));
      if (cmd === "git") {
        if (head.trim() === "git") return ["log", "status"].filter((n) => n.startsWith(word));
        if (/^git\s+log\b/.test(head)) return ["--oneline", "--graph", "-n"].filter((n) => n.startsWith(word));
        return [];
      }
      if (cmd === "cd") return completePath(fs, state.cwd, word).filter((c) => c.endsWith("/"));
      if (cmd === "ls" || cmd === "cat" || cmd === "tree") return completePath(fs, state.cwd, word);
      return [];
    },
  };
}
