"use client";

/**
 * The Engineer page's root: a real terminal (17-persona-views.md §6). The ssh window types the
 * boot script, then grows and dissolves into a full-screen terminal (banner, status bar). Commands
 * go through a hidden input (so phones raise their keyboard); `/` opens a command palette; views,
 * projects and writing print arrow-key menus. A remembered view opens from the boot window;
 * `exit` returns to the hub.
 */
import gsap from "gsap";
import { useRouter } from "next/navigation";
import { Fragment, memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { BOOT_BAR_STEPS, bootBar, terminalScript } from "@/app/components/hub/exit-sequence";
import type { LaunchedPersona, PersonaView } from "@/lib/content/types";
import { ambient } from "@/lib/site/ambient-sound";
import { hubHref, personaHref, useOrigin } from "@/lib/site/persona-link";
import { PIXEL_INDEX, PORTRAIT_BRAILLE, PORTRAIT_BRAILLE_SMALL, PORTRAIT_PIXELS, type BraillePortrait, type PixelPortrait } from "@/lib/site/terminal-art";
import type { TerminalData } from "@/lib/site/terminal-data";
import { HOME, resolvePath, shortPath, USER } from "@/lib/site/terminal-fs";
import { createShell, HISTORY_CAP, initialShellState, type Effect, type FileItem, type MenuId, type MenuRow, type Out, type ShellState } from "@/lib/site/terminal-shell";
import { forgetView, readView } from "@/lib/site/view-memory";

export type TerminalRootProps = {
  persona: LaunchedPersona;
  /** Spectrum position and accent, as the hub placed this persona. */
  t: number;
  color: string;
  /** "hub": the camera flew into this window. "normal": the hub's display already played the script. null: direct visit. */
  via: "hub" | "normal" | null;
  /** Public project slugs for `ls /engineer`. */
  items: string[];
  /** Enabled views, in picker order. */
  views: PersonaView[];
  /** What the shell and its file system know. */
  data: TerminalData;
};

type Entry =
  /** `ps`: the path the command was typed at (the OS prompt); absent on the boot script's plain `$ `. */
  | { n: number; k: "out"; text: string; prompt?: boolean; dim?: boolean; accent?: boolean; ps?: string; tag?: "ok" | "wait" | "bar" }
  | { n: number; k: "links"; items: Array<{ label: string; href: string; external?: boolean }> }
  | { n: number; k: "portrait" }
  | { n: number; k: "files"; inline: boolean; items: FileItem[] }
  | { n: number; k: "cal"; title: string; weeks: Array<Array<number | null>>; today: number }
  | { n: number; k: "more" }
  | { n: number; k: "neofetch"; rows: string[] }
  | { n: number; k: "banner"; art: string[]; welcome: string; overview: string[]; tips: Array<{ cmd: string; desc: string }> }
  | { n: number; k: "link"; label: string; href: string; external?: boolean }
  | { n: number; k: "run"; text: string; cmd: string }
  | { n: number; k: "menu"; id: MenuId; rows: MenuRow[] };
type Dest = { href: string; crossOrigin: boolean };

const TITLE = `${USER}@code — royal-programmer`;
const TRANSCRIPT_CAP = 500;
// Client-side Back/Forward (popstate) is not a new navigation entry, so note when one just happened.
let lastPop = -1e9;
if (typeof window !== "undefined") window.addEventListener("popstate", () => (lastPop = performance.now()));

const histKey = (persona: string) => `xp-term-history:${persona}`;

function loadHistory(persona: string): string[] {
  try {
    const v = JSON.parse(window.sessionStorage.getItem(histKey(persona)) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(-HISTORY_CAP) : [];
  } catch {
    return [];
  }
}

const PAGE = 40;
const PANE_KEY = "xp-term-pane";
const checksKey = (persona: string) => `xp-term-checks:${persona}`;

/** The checkpoints, in the pane's order. `mail` arrives with its command (round 1g). */
const CHECKS = ["boot", "help", "resume", "projects", "views", "portrait", "contact", "mail"] as const;
type CheckId = (typeof CHECKS)[number];
const REQUIRED: CheckId[] = ["boot", "help", "resume", "projects", "views", "portrait", "contact"];
/** What to suggest for each unticked checkpoint. */
const TRY: Partial<Record<CheckId, string>> = { help: "help", resume: "resume", projects: "projects", views: "views", portrait: "portrait", contact: "contact" };
type Checks = Partial<Record<CheckId | "achieved", boolean>>;

function loadChecks(persona: string): Checks {
  try {
    const v = JSON.parse(window.localStorage.getItem(checksKey(persona)) ?? "{}");
    return v && typeof v === "object" ? (v as Checks) : {};
  } catch {
    return {};
  }
}
function saveChecks(persona: string, v: Checks) {
  try {
    window.localStorage.setItem(checksKey(persona), JSON.stringify(v));
  } catch {}
}

/** Braille portrait: one `<pre>`, in the accent. */
const BrailleView = memo(function BrailleView({ art, className }: { art: BraillePortrait; className: string }) {
  return (
    <pre className={`terminal-os-braille ${className}`} role="img" aria-label="Ratul, drawn in braille dots">
      {art.lines.join("\n")}
    </pre>
  );
});

/** True-colour half-blocks: each `▀` takes the top pixel as text colour, the bottom as background. Built once. */
const PixelsView = memo(function PixelsView({ art }: { art: PixelPortrait }) {
  const rows = useMemo(() => {
    const out: ReactNode[] = [];
    art.top.forEach((top, y) => {
      const bot = art.bottom[y] ?? "";
      let from = 0;
      for (let x = 1; x <= top.length; x++) {
        if (x < top.length && top[x] === top[from] && bot[x] === bot[from]) continue;
        out.push(
          <span key={`${y}-${from}`} style={{ color: art.palette[PIXEL_INDEX.indexOf(top[from])], background: art.palette[PIXEL_INDEX.indexOf(bot[from] ?? top[from])] }}>
            {"▀".repeat(x - from)}
          </span>,
        );
        from = x;
      }
      out.push("\n");
    });
    return out;
  }, [art]);
  return (
    <pre className="terminal-os-pixels" role="img" aria-label="Ratul, in pixels">
      {rows}
    </pre>
  );
});

/** The tips box: CSS borders with the title in the top one, so the frame always lines up with the text. */
function Tips({ tips }: { tips: Array<{ cmd: string; desc: string }> }) {
  return (
    <fieldset className="terminal-os-tips">
      <legend>Tips for getting started</legend>
      {tips.map((t) => (
        <div key={t.cmd} className="terminal-os-tip">
          <b>{t.cmd}</b>
          <i>{t.desc}</i>
        </div>
      ))}
    </fieldset>
  );
}

const PALETTE = ["#3b4150", "#e5655d", "#5fbf6a", "#d9b44a", "var(--c)", "#b38ad9", "#5fc6c9", "#ece7dc"];

export function TerminalRoot({ persona, color, via, items, views, data }: TerminalRootProps) {
  const router = useRouter();
  const origin = useOrigin();
  const shell = useMemo(() => createShell(data), [data]);
  const root = useRef<HTMLDivElement>(null);
  const win = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const bootBody = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [booting, setBooting] = useState(true);
  /** The boot window's script, and (after the swap) the full-screen terminal's transcript. */
  const [bootEntries, setBootEntries] = useState<Entry[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [os, setOs] = useState(false);
  const osRef = useRef(false);
  const [cwd, setCwd] = useState(HOME);
  const [partial, setPartial] = useState<string | null>("");
  const [cmd, setCmd] = useState("");
  const [sel, setSel] = useState(0);
  const [palSel, setPalSel] = useState(0);
  /** The menu the arrow keys drive: the latest one shown, until Esc or another command. */
  const [menuN, setMenuN] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const [checks, setChecks] = useState<Checks>({});
  const checksRef = useRef<Checks>({});
  const [paneOn, setPaneOn] = useState(true);
  /** Long output waits behind `-- more --`; `rest` is what has not been printed yet. */
  const [paging, setPaging] = useState(false);
  const pager = useRef<{ rest: Out[] } | null>(null);

  // Latest values for the long-lived async run and the window listener.
  const live = useRef({ cmd, sel, ready, busy: false, aborted: false, auto: false, cancelAuto: false, shell: initialShellState() as ShellState });
  const act = useRef<{
    open: (path: string, label: string | null, auto?: boolean) => void;
    exit: (typeIt: boolean) => void;
    esc: () => void;
  }>({ open: () => {}, exit: () => {}, esc: () => {} });
  const cancelled = useRef(false);
  const timers = useRef<number[]>([]);
  const seq = useRef(0);
  const histIdx = useRef(-1);
  const draft = useRef("");
  const wait = (ms: number) => new Promise<void>((r) => timers.current.push(window.setTimeout(r, ms)));

  useEffect(() => {
    live.current.cmd = cmd;
    live.current.sel = sel;
    live.current.ready = ready;
  });

  const palette = ready && cmd.startsWith("/") && !/\s/.test(cmd);
  const palMatches = useMemo(() => {
    if (!cmd.startsWith("/")) return [];
    const f = cmd.slice(1).toLowerCase();
    const all = shell.commands;
    return [...all.filter((c) => c.name.startsWith(f)), ...(f ? all.filter((c) => !c.name.startsWith(f) && c.name.includes(f)) : [])];
  }, [cmd, shell]);
  const palIdx = Math.min(palSel, Math.max(0, palMatches.length - 1));
  const menu = entries.find((e) => e.k === "menu" && e.n === menuN) as Extract<Entry, { k: "menu" }> | undefined;

  const viewKey = views.map((v) => v.id).join();
  const itemKey = items.join();

  const toEntries = (lines: Out[]): Entry[] =>
    lines.map((o): Entry => {
      const n = ++seq.current;
      if (o.kind === "text") return { n, k: "out", text: o.text, dim: o.dim, accent: o.accent };
      if (o.kind === "links") return { n, k: "links", items: o.items };
      if (o.kind === "portrait") return { n, k: "portrait" };
      if (o.kind === "files") return { n, k: "files", inline: o.inline, items: o.items };
      if (o.kind === "cal") return { n, k: "cal", title: o.title, weeks: o.weeks, today: o.today };
      if (o.kind === "neofetch") return { n, k: "neofetch", rows: o.rows };
      if (o.kind === "banner") return { n, k: "banner", art: o.art, welcome: o.welcome, overview: o.overview, tips: o.tips };
      if (o.kind === "link") return { n, k: "link", label: o.label, href: o.href, external: o.external };
      if (o.kind === "run") return { n, k: "run", text: o.text, cmd: o.cmd };
      return { n, k: "menu", id: o.id, rows: o.rows };
    });

  /** Appends entries (older menus stay, inert). Returns the new menu's key. */
  const append = (es: Entry[]): number | null => {
    (osRef.current ? setEntries : setBootEntries)((l) => [...l, ...es].slice(-TRANSCRIPT_CAP));
    const m = es.find((e) => e.k === "menu");
    return m ? m.n : null;
  };
  const line = (text: string, prompt = false, dim = false, ps?: string) => append([{ n: ++seq.current, k: "out", text, prompt, dim, ps }]);
  /** The path shown in the prompt right now; undefined while the boot window is up. */
  const here = () => (osRef.current ? shortPath(live.current.shell.cwd) : undefined);
  const print = (lines: Out[]) => {
    const m = append(toEntries(lines));
    setMenuN(m);
    if (m !== null) setSel(0);
  };

  /** Types into the transcript. `own`: an open/exit's typing (keeps going after an abort). Returns false if it stopped early. */
  const type = async (text: string, ms: number, instant: boolean, own = false): Promise<boolean> => {
    const stopped = () => cancelled.current || (own ? live.current.cancelAuto : live.current.aborted);
    if (!instant) {
      for (let i = 1; i <= text.length; i++) {
        if (stopped()) return false;
        setPartial(text.slice(0, i));
        ambient.key();
        await wait(ms + Math.random() * (ms > 14 ? 18 : 4));
      }
      await wait(ms > 14 ? 90 : 40);
    }
    if (stopped()) return false;
    setPartial("");
    line(text, true, false, here());
    return true;
  };

  /** Ticks a checkpoint; when the seven available are done, the achievement prints once, ever. */
  const tick = (id: CheckId) => {
    const cur = checksRef.current;
    if (cur[id]) return;
    let next: Checks = { ...cur, [id]: true };
    if (!next.achieved && osRef.current && REQUIRED.every((r) => next[r])) {
      next = { ...next, achieved: true };
      append([{ n: ++seq.current, k: "out", text: "achievement unlocked · explorer — try: sudo make me a sandwich", accent: true }]);
    }
    checksRef.current = next;
    setChecks(next);
    saveChecks(persona, next);
  };

  /** Which checkpoint a command line earns. */
  const tickFor = (c: string, cwd0: string) => {
    const parts = c.split(/\s+/);
    const name = parts[0].replace(/^\//, "").toLowerCase();
    if (name === "help" || name === "resume" || name === "projects" || name === "portrait" || name === "contact") tick(name);
    else if (name === "cat") {
      for (const a of parts.slice(1)) {
        const path = resolvePath(cwd0, a);
        if (path.startsWith(`${HOME}/resume/`)) tick("resume");
        else if (path.startsWith(`${HOME}/projects/`)) tick("projects");
        else if (path === `${HOME}/contact`) tick("contact");
      }
    }
  };

  const nextTry = REQUIRED.find((r) => !checks[r] && TRY[r]);
  const hintCmd = nextTry ? TRY[nextTry]! : "sudo make me a sandwich";

  const endPaging = () => {
    pager.current = null;
    setPaging(false);
    setEntries((l) => l.filter((e) => e.k !== "more"));
  };
  const nextPage = () => {
    const rest = pager.current?.rest ?? [];
    setEntries((l) => l.filter((e) => e.k !== "more"));
    print(rest.slice(0, PAGE));
    if (rest.length > PAGE) {
      pager.current = { rest: rest.slice(PAGE) };
      append([{ n: ++seq.current, k: "more" }]);
    } else endPaging();
  };

  /** The views menu, as `ls views/` prints it (the picker). */
  const showViews = () => {
    const r = shell.run("views", { ...live.current.shell, history: [] });
    live.current.shell = { ...live.current.shell, lastMenu: r.state.lastMenu };
    print(r.lines);
  };

  /** The boot window grows and dissolves; the full-screen terminal opens with the welcome. */
  const swap = () => {
    osRef.current = true;
    setOs(true);
    append(toEntries(shell.banner()));
  };

  /** Back to the waiting prompt (Back from a bfcache page, or a cancelled auto-open). */
  const restore = () => {
    const s = live.current;
    s.busy = false;
    s.aborted = false;
    s.auto = false;
    s.cancelAuto = false;
    s.ready = true;
    setOpening(false);
    setCmd("");
    setPartial(null);
    if (!osRef.current) swap();
    showViews();
    setReady(true);
  };

  const go = async (dest: Dest): Promise<boolean> => {
    setOpening(true);
    await wait(420);
    if (cancelled.current) return false;
    if (live.current.cancelAuto) {
      restore();
      return false;
    }
    try {
      if (dest.crossOrigin) window.location.assign(dest.href);
      else router.push(dest.href);
    } catch {
      restore();
      return false;
    }
    return true;
  };

  act.current.open = async (path, label, auto = false) => {
    if (live.current.busy) return;
    if (views.some((v) => `/${v.id}` === path)) tick("views");
    live.current.busy = true;
    live.current.aborted = true;
    live.current.auto = auto;
    live.current.ready = false;
    setReady(false);
    if (label && !(await type(label, 12, false, true))) {
      if (live.current.cancelAuto && !cancelled.current) restore();
      return;
    }
    await go(personaHref(origin, persona, path));
  };
  act.current.exit = async (typeIt) => {
    if (live.current.busy) return;
    live.current.busy = true;
    live.current.aborted = true;
    live.current.ready = false;
    setReady(false);
    setCmd("");
    if (typeIt && !(await type("exit", 12, false, true))) return;
    await go(hubHref(origin));
  };

  /** Browser full screen. Needs a user gesture, so call it straight from a key or tap. */
  const toggleFull = () => {
    const off = () => line("full screen is not available here", false, true, here());
    try {
      const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      p.catch(off);
    } catch {
      off();
    }
  };

  const togglePane = () => {
    if (window.innerWidth < 1024) return void line("the pane needs a screen at least 1024px wide", false, true, here());
    const next = !paneOn;
    setPaneOn(next);
    try {
      window.localStorage.setItem(PANE_KEY, next ? "1" : "0");
    } catch {}
  };

  const effect = (fx: Effect) => {
    if (fx.kind === "open-view") act.current.open(`/${fx.id}`, null);
    else if (fx.kind === "open-slug") act.current.open(fx.blog ? `/blog/${fx.slug}` : `/${fx.slug}`, null);
    else if (fx.kind === "open-url") {
      line(`opening ${fx.url}`, false, true);
      append([{ n: ++seq.current, k: "link", label: fx.url, href: fx.url, external: true }]);
      window.open(fx.url, "_blank", "noopener,noreferrer");
    } else if (fx.kind === "exit") act.current.exit(false);
    else if (fx.kind === "clear") {
      setEntries([]);
      setMenuN(null);
    } else if (fx.kind === "pane") togglePane();
    else toggleFull();
  };

  /** Runs one command line: echo, shell, output, effect. */
  const submit = (raw: string) => {
    const c = raw.trim();
    if (!live.current.ready || !c) return;
    setCmd("");
    histIdx.current = -1;
    line(c, true, false, here());
    const cwd0 = live.current.shell.cwd;
    const r = shell.run(c, live.current.shell);
    live.current.shell = r.state;
    setCwd(r.state.cwd);
    try {
      window.sessionStorage.setItem(histKey(persona), JSON.stringify(r.state.history));
    } catch {}
    if (r.lines.length > PAGE) {
      print(r.lines.slice(0, PAGE));
      pager.current = { rest: r.lines.slice(PAGE) };
      setPaging(true);
      append([{ n: ++seq.current, k: "more" }]);
    } else print(r.lines);
    tickFor(c, cwd0);
    if (r.effect) effect(r.effect);
    if (!window.matchMedia("(pointer: coarse)").matches) input.current?.focus({ preventScroll: true });
  };

  /** A menu row acted on: views open; projects and writing print their file. */
  const pick = (id: MenuId, row: MenuRow) => {
    if (!live.current.ready) return;
    if (id === "views") {
      setCmd("");
      act.current.open(`/${row.key}`, `open ${row.key}`);
    } else submit(`cat ~/${id}/${row.key}.md`);
  };

  /** Esc, in order: palette, typed text, menu selection; with none of those, exit. (An auto-open call-off is handled while busy.) */
  act.current.esc = () => {
    if (paging) endPaging();
    else if (palette || cmd) setCmd("");
    else if (menuN !== null) {
      setMenuN(null);
      live.current.shell = { ...live.current.shell, lastMenu: undefined };
    } else act.current.exit(true);
  };

  /** ↑/↓ through the history; the unsent text is kept as the draft. */
  const walkHistory = (dir: -1 | 1) => {
    const h = live.current.shell.history;
    if (!h.length) return;
    if (histIdx.current === -1) {
      if (dir === 1) return;
      draft.current = cmd;
      histIdx.current = h.length - 1;
    } else {
      const n = histIdx.current + (dir === -1 ? -1 : 1);
      if (n >= h.length) {
        histIdx.current = -1;
        return setCmd(draft.current);
      }
      histIdx.current = Math.max(0, n);
    }
    setCmd(h[histIdx.current]);
  };

  const tab = () => {
    if (palette) {
      const c = palMatches[palIdx];
      if (c) setCmd(`/${c.name} `);
      return;
    }
    const cands = shell.complete(cmd, live.current.shell);
    if (!cands.length) return;
    const head = /^(.*?)\S*$/.exec(cmd)?.[1] ?? "";
    if (cands.length === 1) return setCmd(head + cands[0] + (cands[0].endsWith("/") ? "" : " "));
    let prefix = cands[0];
    for (const c of cands) while (!c.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (prefix) setCmd(head + prefix);
    line(cands.join("   "), false, true, here());
  };

  const runPalette = (name: string | undefined) => {
    const c = shell.commands.find((x) => x.name === name);
    if (!c) return submit(cmd);
    if (c.usage.includes("<") || c.name === "cd") {
      setCmd(`${c.name} `);
      input.current?.focus({ preventScroll: true });
    } else submit(c.name);
  };

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if ((e.key.length === 1 && !e.ctrlKey && !e.metaKey) || e.key === "Backspace" || e.key === "Enter" || e.key === "Tab") ambient.key();
    const menuLive = menu && !cmd;
    if (e.ctrlKey && !e.altKey && !e.metaKey && (e.key === "c" || e.key === "C" || e.key === "l" || e.key === "L")) {
      e.preventDefault();
      if (e.key.toLowerCase() === "l") {
        if (paging) endPaging();
        setEntries([]);
        setMenuN(null);
      } else {
        if (paging) endPaging();
        line(`${cmd}^C`, true, false, here());
        setCmd("");
        histIdx.current = -1;
      }
      return;
    }
    if (paging) {
      e.preventDefault();
      if (e.key === " " || e.key === "ArrowDown" || e.key === "Enter") nextPage();
      else if (e.key === "q" || e.key === "Q" || e.key === "Escape") endPaging();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      if (palette) setPalSel(palMatches.length ? (palIdx + d + palMatches.length) % palMatches.length : 0);
      else if (menuLive) setSel((i) => (i + d + menu.rows.length) % menu.rows.length);
      else walkHistory(d === 1 ? 1 : -1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (palette) runPalette(palMatches[palIdx]?.name);
      else if (menuLive) pick(menu.id, menu.rows[Math.min(sel, menu.rows.length - 1)]);
      else submit(cmd);
    } else if (e.key === "Tab") {
      // Only take Tab when it completes something; otherwise focus moves on (chips, dots, links).
      if (e.shiftKey || !cmd) return;
      const any = palette ? palMatches.length > 0 : shell.complete(cmd, live.current.shell).length > 0;
      if (!any) return;
      e.preventDefault();
      tab();
    } else if (e.key === "Escape") {
      e.preventDefault();
      act.current.esc();
    } else if (/^[1-9]$/.test(e.key) && menuLive && menu.rows[Number(e.key) - 1]) {
      e.preventDefault();
      setSel(Number(e.key) - 1);
      pick(menu.id, menu.rows[Number(e.key) - 1]);
    }
  };

  // The script, then the hint and the views menu (or the remembered pick).
  useEffect(() => {
    cancelled.current = false;
    live.current.busy = false;
    live.current.aborted = false;
    live.current.auto = false;
    live.current.cancelAuto = false;
    live.current.shell = initialShellState(loadHistory(persona));
    osRef.current = false;
    setOs(false);
    setCwd(HOME);
    const ts = timers.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = via === "normal" || reduce;
    const fromBack = performance.now() - lastPop < 3000;
    const stopped = () => cancelled.current || live.current.aborted;
    const run = async () => {
      setEntries([]);
      setBootEntries([]);
      setMenuN(null);
      setPartial("");
      await wait(via === "hub" ? 150 : 100);
      if (stopped()) return;
      setBooting(false);
      const script = terminalScript({ projects: items.length, posts: data.posts.length, views: views.length });
      for (const l of script) {
        if (stopped()) return;
        if (l.typed && !instant) await type(l.text, 13, false);
        else if (l.tag === "ok" && !instant) {
          // `[..]` for a beat, then it resolves to `[ok]`.
          await wait(140);
          if (stopped()) return;
          const n = ++seq.current;
          append([{ n, k: "out", text: l.text, tag: "wait" }]);
          await wait(120);
          if (stopped()) return;
          setBootEntries((es) => es.map((e) => (e.n === n && e.k === "out" ? { ...e, tag: "ok" } : e)));
        } else if (l.tag === "bar" && !instant) {
          const n = ++seq.current;
          append([{ n, k: "out", text: bootBar(0), tag: "bar" }]);
          for (let f = 1; f <= BOOT_BAR_STEPS; f++) {
            await wait(60);
            if (stopped()) return;
            setBootEntries((es) => es.map((e) => (e.n === n && e.k === "out" ? { ...e, text: bootBar(f) } : e)));
            ambient.key();
          }
        } else {
          if (!instant) await wait(90);
          if (stopped()) return;
          append([{ n: ++seq.current, k: "out", text: l.text, prompt: !!l.prompt, tag: l.tag }]);
        }
      }
      if (stopped()) return;
      let remembered = via === "hub" ? null : readView(persona);
      if (remembered && !views.some((v) => v.id === remembered)) {
        forgetView(persona);
        remembered = null;
      }
      try {
        // Back from a view lands here with the pick still set: show the menu instead of re-opening it.
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (nav?.type === "back_forward" || fromBack) remembered = null;
      } catch {}
      if (remembered) {
        tick("boot");
        act.current.open(`/${remembered}`, `open ${remembered}`, true);
        return;
      }
      // Connected: the window takes the world's light, then dissolves into the terminal.
      if (win.current && !instant) gsap.to(win.current, { boxShadow: `0 0 80px -10px ${color}`, duration: 0.4 });
      swap();
      tick("boot");
      if (!instant) await wait(520);
      if (stopped()) return;
      line("type help, or / for the menu", false, true);
      await type("ls views/", 13, instant);
      if (stopped()) return;
      showViews();
      setReady(true);
      setPartial(null);
    };
    void run();
    return () => {
      cancelled.current = true;
      ts.forEach((x) => window.clearTimeout(x));
      ts.length = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, via, itemKey, viewKey, color]);

  // Checkpoints and the pane's on/off, remembered on the device.
  useEffect(() => {
    checksRef.current = loadChecks(persona);
    setChecks(checksRef.current);
    try {
      if (window.localStorage.getItem(PANE_KEY) === "0") setPaneOn(false);
    } catch {}
  }, [persona]);

  useEffect(() => {
    if (via) {
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.has("via")) {
          u.searchParams.delete("via");
          window.history.replaceState(window.history.state, "", u);
        }
      } catch {}
    }
  }, [via]);

  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) restore();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  // Keys outside the input: Esc, the auto-open call-off, and typing after focus was lost.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target === input.current) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.isComposing || e.metaKey) return;
      if ((e.ctrlKey || e.altKey) && !e.getModifierState("AltGraph")) return;
      const s = live.current;
      if (s.busy) {
        // The remembered pick is about to open: Esc or Backspace calls it off.
        if (s.auto && !s.cancelAuto && (e.key === "Escape" || e.key === "Backspace")) {
          e.preventDefault();
          s.cancelAuto = true;
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        act.current.esc();
      } else if (s.ready && e.key.length === 1 && !el?.closest("a,button,[role=button]")) {
        // Focus lands before the key's character is inserted.
        input.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Desktop: the prompt is live as soon as it is ready. Phones wait for a tap (the keyboard covers the menu).
  useEffect(() => {
    if (ready && !window.matchMedia("(pointer: coarse)").matches) input.current?.focus({ preventScroll: true });
  }, [ready]);

  // The on-screen keyboard shrinks the visual viewport only; fit the window to it and keep the prompt in view.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const fit = () => {
      root.current?.style.setProperty("--vvh", `${vv.height}px`);
      root.current?.style.setProperty("--vvt", `${vv.offsetTop}px`);
      const b = body.current;
      if (b) b.scrollTop = b.scrollHeight;
    };
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, []);

  useEffect(() => {
    const b = body.current;
    if (b) b.scrollTop = b.scrollHeight;
  }, [entries, partial, cmd, palette, os]);
  useEffect(() => {
    const b = bootBody.current;
    if (b) b.scrollTop = b.scrollHeight;
  }, [bootEntries, partial]);

  const palList = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (palette) palList.current?.children[palIdx]?.scrollIntoView({ block: "nearest" });
  }, [palette, palIdx]);

  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
  const chipKey = (k: "tab" | "up" | "esc") => {
    input.current?.focus({ preventScroll: true });
    if (k === "tab") tab();
    else if (k === "esc") act.current.esc();
    else if (menu && !cmd) setSel((i) => (i + menu.rows.length - 1) % menu.rows.length);
    else walkHistory(-1);
  };

  /** `ratulroy@code:~/projects$ ` like a PS1; phones drop the `ratulroy@code:` lead. No path: the boot script's plain `$ `. */
  const ps1 = (path?: string) =>
    path === undefined ? (
      "$ "
    ) : (
      <>
        <code className="ps-lead">
          <code className="ps-user">ratulroy@code</code>:
        </code>
        <code className="ps-path">{path}</code>
        <code className="ps-dollar">$</code>{" "}
      </>
    );

  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /** A name in a listing: runs `cat` (file), `cd` (dir) or `open` (view). Dirs take the accent, views green. */
  const pathButton = (it: FileItem) => (
    <button
      type="button"
      className="terminal-root-path"
      data-kind={it.type}
      onMouseDown={keepFocus}
      onClick={() => submit(it.type === "dir" ? `cd ${shortPath(it.path)}` : it.type === "exec" ? `open ${it.name}` : `cat ${shortPath(it.path)}`)}
    >
      {it.name}
      {it.type === "dir" ? "/" : it.type === "exec" ? "*" : ""}
    </button>
  );

  const renderEntry = (e: Entry) =>
    e.k === "out" ? (
      <span key={e.n} className={`${e.prompt ? "is-cmd" : "is-out"} ${e.dim ? "is-dim" : ""} ${e.accent ? "is-accent" : ""}`}>
        {e.prompt ? ps1(e.ps) : ""}
        {e.tag === "ok" ? <b className="is-ok">[ok] </b> : e.tag === "wait" ? "[..] " : ""}
        {e.text || " "}
      </span>
    ) : e.k === "banner" ? (
      <div key={e.n} className="terminal-os-welcome">
        <div className="terminal-os-header">
          <div className="terminal-os-header-art">
            <BrailleView art={PORTRAIT_BRAILLE} className="is-wide" />
            <BrailleView art={PORTRAIT_BRAILLE_SMALL} className="is-small" />
          </div>
          <div className="terminal-os-header-text">
            <pre className="terminal-os-banner">{e.art.join("\n")}</pre>
            <span className="is-out">{e.welcome}</span>
            {e.overview.map((l) => (
              <span key={l} className="is-cmd">
                {l}
              </span>
            ))}
          </div>
        </div>
        <Tips tips={e.tips} />
      </div>
    ) : e.k === "portrait" ? (
      <PixelsView key={e.n} art={PORTRAIT_PIXELS} />
    ) : e.k === "neofetch" ? (
      <div key={e.n} className="terminal-os-fetch">
        <BrailleView art={PORTRAIT_BRAILLE_SMALL} className="is-fetch" />
        <pre className="terminal-os-fetch-rows">
          <code className="ps-user">{e.rows[0]}</code>
          {`\n${e.rows.slice(1).join("\n")}\n\n`}
          {PALETTE.map((c, i) => (
            <b key={i} style={{ color: c }}>
              {"███"}
            </b>
          ))}
        </pre>
      </div>
    ) : e.k === "files" ? (
      <span key={e.n} className="is-out">
        {e.items.map((it, i) => (
          <Fragment key={it.path}>
            {e.inline ? (i ? "   " : "") : (it.meta ?? "")}
            {pathButton(it)}
          </Fragment>
        ))}
      </span>
    ) : e.k === "cal" ? (
      <pre key={e.n} className="terminal-os-cal">
        {`${e.title.padStart(Math.floor((20 + e.title.length) / 2))}\nSu Mo Tu We Th Fr Sa\n`}
        {e.weeks.map((w, wi) => (
          <Fragment key={wi}>
            {w.map((d, di) => (
              <Fragment key={di}>
                {di ? " " : ""}
                {d === null ? "  " : d === e.today ? <b className="is-accent">{String(d).padStart(2)}</b> : String(d).padStart(2)}
              </Fragment>
            ))}
            {wi < e.weeks.length - 1 ? "\n" : ""}
          </Fragment>
        ))}
      </pre>
    ) : e.k === "more" ? (
      <button key={e.n} type="button" className="terminal-root-more" onMouseDown={keepFocus} onClick={nextPage}>
        -- more (space / ↓ next, q quit) --
      </button>
    ) : e.k === "links" ? (
      <span key={e.n} className="is-out">
        {e.items.map((l, i) => (
          <Fragment key={l.href}>
            {i ? " · " : ""}
            <a className="terminal-root-link" href={l.href} {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}>
              {l.label}
            </a>
          </Fragment>
        ))}
      </span>
    ) : e.k === "link" ? (
      <span key={e.n} className="is-out">
        <a className="terminal-root-link" href={e.href} {...(e.external ? { target: "_blank", rel: "noreferrer" } : {})}>
          {e.label}
        </a>
      </span>
    ) : e.k === "run" ? (
      <span key={e.n} className="is-out">
        <button type="button" className="terminal-root-path" data-kind="file" onMouseDown={keepFocus} onClick={() => submit(e.cmd)}>
          {e.text}
        </button>
      </span>
    ) : (
      <ul key={e.n} role="list" className={`terminal-root-picker ${e.n === menuN ? "" : "is-inert"}`}>
        {e.rows.map((r, n) => {
          const on = e.n === menuN && n === sel;
          return (
            <li key={r.key}>
              <button
                type="button"
                tabIndex={-1}
                className={`terminal-root-row ${on ? "is-sel" : ""}`}
                onMouseDown={keepFocus}
                onMouseEnter={() => e.n === menuN && setSel(n)}
                onClick={() => pick(e.id, r)}
              >
                <em>{on ? "▸" : " "}</em>
                <b className="is-cmd">
                  {n + 1}) {r.label}
                </b>
                <i className="is-out">{r.line}</i>
              </button>
            </li>
          );
        })}
      </ul>
    );

  const typeChip = (run: () => void) => () => {
    ambient.key();
    run();
  };

  return (
    <div
      ref={root}
      className={`terminal-root ${via === "hub" ? "is-via-hub" : "is-direct"} ${opening ? "is-opening" : ""} ${os ? "is-os" : ""}`}
      style={{ "--c": color } as CSSProperties}
      role="region"
      aria-label="Engineer terminal"
    >
      {/* The boot screen: the ssh window types the script, then dissolves (is-os). */}
      <div className="terminal-root-frame" aria-hidden={os}>
        <div ref={win} className={`hub-exit hub-exit-term terminal-root-win ${booting ? "is-boot" : ""}`}>
          <div className="hub-exit-bar">
            <span /> <span /> <span />
            <b>{TITLE}</b>
          </div>
          <div ref={bootBody} className="hub-exit-body terminal-root-body">
            {bootEntries.map(renderEntry)}
            {!os && partial !== null ? (
              <span className="is-cmd">
                $ {partial}
                <i className="hub-enter-caret" />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* The terminal: the whole viewport. */}
      <div className={`terminal-os ${paneOn ? "has-pane" : ""}`} aria-hidden={!os}>
        <div className="terminal-os-split">
        <div
          ref={body}
          className="hub-exit-body terminal-root-body terminal-os-body"
          onClick={(e) => {
            if (!live.current.ready || (e.target as HTMLElement).closest("a,button,[role=button]")) return;
            if (window.getSelection()?.toString()) return;
            input.current?.focus({ preventScroll: true });
          }}
        >
          <span className="sr-only">Type commands. help lists them, / opens the menu, banner prints the welcome again, Esc or exit returns to the hub.</span>
          <div role="log" aria-live="polite" aria-relevant="additions">
            {entries.map(renderEntry)}
          </div>
          {palette ? (
            <ul ref={palList} role="listbox" aria-label="Commands" className="terminal-root-palette">
              {palMatches.length ? (
                palMatches.map((c, n) => (
                  <li key={c.name} role="option" aria-selected={n === palIdx}>
                    <button
                      type="button"
                      tabIndex={-1}
                      className={`terminal-root-row ${n === palIdx ? "is-sel" : ""}`}
                      onMouseDown={keepFocus}
                      onMouseEnter={() => setPalSel(n)}
                      onClick={() => runPalette(c.name)}
                    >
                      <em>{n === palIdx ? "▸" : " "}</em>
                      <b className="is-cmd">/{c.name}</b>
                      <i className="is-out">{c.desc}</i>
                    </button>
                  </li>
                ))
              ) : (
                <li className="terminal-root-palette-none is-out">no command matches</li>
              )}
            </ul>
          ) : null}
          {os && (partial !== null || ready) ? (
            <span className="terminal-root-prompt is-cmd">
              {paging ? null : (
                <code className="terminal-root-typed" aria-hidden="true">
                  {ps1(shortPath(cwd))}
                  {partial !== null ? partial : cmd}
                  <i className="hub-enter-caret" />
                </code>
              )}
              <input
                ref={input}
                className="terminal-root-input"
                value={cmd}
                disabled={!ready}
                aria-label="terminal command"
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
                onChange={(e) => {
                  setCmd(e.target.value.slice(0, 200));
                  histIdx.current = -1;
                  setPalSel(0);
                }}
                onKeyDown={onInputKey}
              />
            </span>
          ) : null}
        </div>
        <aside className="terminal-os-pane" aria-label="Side pane">
          <div className="terminal-os-pane-art">
            <BrailleView art={PORTRAIT_BRAILLE} className="is-pane" />
          </div>
          <h3>where</h3>
          <p className="terminal-os-pane-where">{shortPath(cwd)}</p>
          <h3>checkpoints</h3>
          <ul role="list" className="terminal-os-checks">
            {CHECKS.map((id) => (
              <li key={id} className={id === "mail" ? "is-soon" : checks[id] ? "is-done" : ""}>
                <b>{checks[id] ? "[x]" : "[ ]"}</b> {id}
                {id === "mail" ? <i> soon</i> : null}
              </li>
            ))}
          </ul>
          <h3>next</h3>
          <button type="button" className="terminal-os-pane-next" onMouseDown={keepFocus} onClick={() => submit(hintCmd)}>
            {nextTry ? `try: ${hintCmd}` : "all done · try: sudo make me a sandwich"}
          </button>
          <h3>keys</h3>
          <p className="terminal-os-keys">Tab complete · ↑ history · / menu · Ctrl+L clear · Ctrl+C cancel · Esc exit</p>
        </aside>
        </div>
        <div className="terminal-os-status">
          <code className="terminal-os-status-l">{`${USER}@code  ${shortPath(cwd)}`}</code>
          <code className="terminal-os-status-m is-counts">
            {plural(data.projects.length, "project")} · {plural(data.posts.length, "post")} · {plural(data.views.length, "view")}
          </code>
          {nextTry ? (
            <button type="button" className="terminal-os-status-hint" onMouseDown={keepFocus} onClick={() => submit(hintCmd)}>
              {`try: ${hintCmd}`}
            </button>
          ) : null}
          <span className="terminal-os-status-r">
            <button type="button" onMouseDown={keepFocus} onClick={() => submit("help")}>
              help
            </button>
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={() => {
                setCmd("/");
                setPalSel(0);
                input.current?.focus({ preventScroll: true });
              }}
            >
              /
            </button>
            <button type="button" className="is-pane-btn" onMouseDown={keepFocus} onClick={togglePane}>
              pane
            </button>
            <button type="button" onMouseDown={keepFocus} onClick={() => act.current.esc()}>
              Esc
            </button>
          </span>
        </div>
        <div className="terminal-root-chips" aria-label="Terminal keys">
          <button type="button" onMouseDown={keepFocus} onClick={typeChip(() => submit("help"))}>
            help
          </button>
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={typeChip(() => {
              setCmd("/");
              setPalSel(0);
              input.current?.focus({ preventScroll: true });
            })}
          >
            /
          </button>
          <button type="button" onMouseDown={keepFocus} onClick={typeChip(() => submit("ls"))}>
            ls
          </button>
          <button type="button" onMouseDown={keepFocus} onClick={typeChip(() => submit("views"))}>
            views
          </button>
          <button type="button" onMouseDown={keepFocus} onClick={typeChip(() => chipKey("tab"))}>
            Tab
          </button>
          <button type="button" onMouseDown={keepFocus} onClick={() => chipKey("up")} aria-label="Up">
            ↑
          </button>
          <button type="button" onMouseDown={keepFocus} onClick={() => chipKey("esc")}>
            Esc
          </button>
        </div>
      </div>
    </div>
  );
}
