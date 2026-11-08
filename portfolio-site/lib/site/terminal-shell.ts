/**
 * The Engineer terminal's shell (17-persona-views.md §6.3): parses a command line and answers with
 * output lines plus, at most, one effect for the UI to carry out (open a page, exit, clear,
 * toggle full screen). Pure: no React, no DOM, no navigation; the UI resolves hrefs.
 */
import { DISPLAY_ROOT, personaIdentity } from "@/lib/site/brand";
import {
  buildFs,
  complete as completePath,
  HOME,
  listDir,
  readFile,
  resolvePath,
  shortPath,
  stat,
  type Fs,
  type FsEntry,
} from "@/lib/site/terminal-fs";
import type { TerminalData } from "@/lib/site/terminal-data";

export type MenuId = "views" | "projects" | "writing";
export type MenuRow = { key: string; label: string; line: string };

export type Out =
  | { kind: "text"; text: string; dim?: boolean }
  | { kind: "link"; label: string; href: string; external?: boolean }
  /** A line that runs a command when clicked (`open <slug>` at the foot of a project). */
  | { kind: "run"; text: string; cmd: string }
  | { kind: "menu"; id: MenuId; rows: MenuRow[] }
  /** The welcome: block-letter art (44 columns), the welcome line, and the tips box rows. */
  | { kind: "banner"; art: string[]; welcome: string; tips: Array<{ cmd: string; desc: string }> };

export type Effect =
  | { kind: "open-view"; id: string }
  | { kind: "open-slug"; slug: string; blog?: boolean }
  | { kind: "open-url"; url: string }
  | { kind: "exit" }
  | { kind: "clear" }
  | { kind: "fullscreen" };

export type ShellState = { cwd: string; history: string[]; lastMenu?: MenuId };
export type RunResult = { lines: Out[]; effect?: Effect; state: ShellState };

export type CommandGroup = "navigate" | "read" | "open" | "terminal";
export type CommandDoc = { name: string; group: CommandGroup; usage: string; desc: string; long?: string };

export const BANNER_ART = [
  "██████╗  █████╗ ████████╗██╗   ██╗██╗",
  "██╔══██╗██╔══██╗╚══██╔══╝██║   ██║██║",
  "██████╔╝███████║   ██║   ██║   ██║██║",
  "██╔══██╗██╔══██║   ██║   ██║   ██║██║",
  "██║  ██║██║  ██║   ██║   ╚██████╔╝███████╗",
  "╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚══════╝",
];

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
  { name: "cd", group: "navigate", usage: "cd [path]", desc: "change directory; cd .. at ~ exits to the hub" },
  { name: "pwd", group: "navigate", usage: "pwd", desc: "where you are" },
  { name: "tree", group: "navigate", usage: "tree [path]", desc: "the whole tree" },
  { name: "cat", group: "read", usage: "cat <file>", desc: "print a file" },
  { name: "about", group: "read", usage: "about", desc: "who I am, longer" },
  { name: "stack", group: "read", usage: "stack", desc: "the tools I work in" },
  { name: "uptime", group: "read", usage: "uptime", desc: "time in production" },
  { name: "contact", group: "read", usage: "contact", desc: "mail and github, as links" },
  { name: "whoami", group: "read", usage: "whoami", desc: "one line about me" },
  { name: "neofetch", group: "read", usage: "neofetch", desc: "a stat card for this host" },
  { name: "open", group: "open", usage: "open <view|slug|url>", desc: "open a view, a project or post, or a link" },
  { name: "views", group: "open", usage: "views", desc: "pick a view" },
  { name: "projects", group: "open", usage: "projects", desc: "pick a project to read" },
  { name: "writing", group: "open", usage: "writing", desc: "pick a post to read" },
  { name: "banner", group: "terminal", usage: "banner", desc: "print the welcome again" },
  { name: "history", group: "terminal", usage: "history", desc: "commands typed this session" },
  { name: "clear", group: "terminal", usage: "clear", desc: "empty the screen" },
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
      art: BANNER_ART,
      welcome: `Welcome to ${host} · ${data.commit ?? "v1"}`,
      tips: [
        { cmd: "help", desc: "every command" },
        { cmd: "/", desc: "the command menu" },
        ...(data.views[0] ? [{ cmd: `open ${data.views[0].id}`, desc: "enter a view" }] : []),
        { cmd: "projects", desc: "read what I built" },
      ],
    },
  ];

  const longFormat = (e: FsEntry) => {
    const perms = e.kind === "dir" ? "drwxr-xr-x" : e.kind === "exec" ? "-rwxr-xr-x" : "-rw-r--r--";
    const name = e.kind === "dir" ? `${e.name}/` : e.kind === "exec" ? `${e.name}*` : e.name;
    return `${perms}  ${String(e.size).padStart(5)}  ${name}`;
  };
  const shortFormat = (e: FsEntry) => (e.kind === "dir" ? `${e.name}/` : e.kind === "exec" ? `${e.name}*` : e.name);

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
        out.push(text(long ? longFormat({ name: raw, kind, size: readFile(fs, path)?.join("\n").length ?? 0 }) : raw));
      } else if (path === `${HOME}/views` && !long) {
        const m = menu("views");
        out.push(...m.lines);
        picked = m.menu;
      } else {
        const entries = listDir(fs, path) ?? [];
        if (!entries.length) continue;
        if (long) out.push(...entries.map((e) => text(longFormat(e))));
        else out.push(text(entries.map(shortFormat).join("   ")));
      }
    }
    return { lines: out, menu: picked };
  };

  const tree = (raw: string | undefined, st: ShellState): Out[] => {
    const path = resolvePath(st.cwd, raw ?? ".");
    const kind = stat(fs, path);
    if (!kind) return [text(`tree: ${raw}: No such file or directory`)];
    if (kind !== "dir") return [text(raw ?? ".")];
    const out: string[] = [shortPath(path)];
    const walk = (dir: string, prefix: string) => {
      const es = listDir(fs, dir) ?? [];
      es.forEach((e, i) => {
        const last = i === es.length - 1;
        out.push(`${prefix}${last ? "└── " : "├── "}${shortFormat(e)}`);
        if (e.kind === "dir") walk(`${dir}/${e.name}`, `${prefix}${last ? "    " : "│   "}`);
      });
    };
    walk(path, "");
    return texts(out);
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
    const c = COMMANDS.find((x) => x.name === name.replace(/^\//, ""));
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
    return texts([`ratul@${host}`, "-".repeat(`ratul@${host}`.length), ...rows.map(([k, v]) => `${k.padEnd(9)}${v}`)]);
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
    const m = /^\/engineer\/(projects|writing)\/(.+)\.md$/.exec(path);
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
        if (st.cwd === HOME && /^\.\.\/*$/.test(args[0])) return { lines: [], effect: { kind: "exit" } };
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
      case "whoami":
        return { lines: [text(data.who)] };
      case "neofetch":
        return { lines: neofetch() };
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
      if (cmd === "cd") return completePath(fs, state.cwd, word).filter((c) => c.endsWith("/"));
      if (cmd === "ls" || cmd === "cat" || cmd === "tree") return completePath(fs, state.cwd, word);
      return [];
    },
  };
}
