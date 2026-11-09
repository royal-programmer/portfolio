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
import { qrLines, qrModules } from "@/lib/site/qr";
import { PIXEL_INDEX, PORTRAIT_BRAILLE_SMALL, PORTRAIT_PIXELS, type BraillePortrait, type PixelPortrait } from "@/lib/site/terminal-art";
import type { TerminalData } from "@/lib/site/terminal-data";
import { HOME, resolvePath, shortPath, USER } from "@/lib/site/terminal-fs";
import { createShell, HISTORY_CAP, initialShellState, THEMES, type Effect, type FileItem, type MenuId, type MenuRow, type Out, type ShellState, type ThemeId, type Tone } from "@/lib/site/terminal-shell";
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
  | { n: number; k: "out"; text: string; prompt?: boolean; dim?: boolean; accent?: boolean; ps?: string; label?: string; tag?: "ok" | "wait" | "bar" }
  | { n: number; k: "links"; items: Array<{ label: string; href?: string; external?: boolean; cmd?: string }> }
  | { n: number; k: "ghcommit"; label: string; url: string; rest: string }
  | { n: number; k: "portrait" }
  | { n: number; k: "parts"; parts: Array<{ text: string; tone?: Tone; color?: string }> }
  | { n: number; k: "qr"; lines: string[] }
  | { n: number; k: "art"; text: string }
  | { n: number; k: "ghrepo"; name: string; url: string; pad: number; rest: string }
  | { n: number; k: "files"; inline: boolean; items: FileItem[] }
  | { n: number; k: "cal"; title: string; weeks: Array<Array<number | null>>; today: number }
  | { n: number; k: "more" }
  | { n: number; k: "neofetch"; rows: string[] }
  | { n: number; k: "banner"; art: string[]; welcome: string; overview: string[]; tips: Array<{ cmd: string; desc: string }> }
  | { n: number; k: "link"; label: string; href: string; external?: boolean }
  | { n: number; k: "run"; text: string; cmd: string }
  | { n: number; k: "menu"; id: MenuId; rows: MenuRow[]; numbered?: boolean };
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
const SEEN_KEY = "xp-term-seen";
const THEME_KEY = "xp-term-theme";
const CRT_KEY = "xp-term-crt";
const GH_USER = "royal-programmer";
const GH_KEY = "xp-gh-cache";
const GH_TTL = 3_600_000;
const WEEK = 7 * 86_400_000;

type GhCache = {
  t: number;
  user: { public_repos: number; followers: number };
  repos: Array<{ name: string; html_url: string; language: string | null; stargazers_count: number; pushed_at: string }>;
  events: Array<{
    type: string;
    created_at: string;
    repo?: { name?: string };
    payload?: { size?: number; head?: string; ref?: string; commits?: Array<{ sha?: string; message?: string; author?: { name?: string } }> };
  }>;
};

const ago = (ms: number) => {
  if (!Number.isFinite(ms)) return "unknown";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/** A cache or a fresh response is only used if it has the shape the output code reads. */
const ghValid = (d: GhCache) =>
  typeof d.t === "number" && !!d.user && typeof d.user === "object" && Array.isArray(d.repos) && Array.isArray(d.events) && d.repos.every((r) => r && typeof r.name === "string");

/** Twelve weeks of push commits as `▁▂▃▄▅▆▇█`, oldest first. */
function strip(events: GhCache["events"]): string {
  const monday = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  };
  const now = monday(Date.now());
  const counts = Array<number>(12).fill(0);
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const b = Math.round((now - monday(Date.parse(e.created_at))) / WEEK);
    if (b >= 0 && b < 12) counts[11 - b] += e.payload?.commits?.length ?? e.payload?.size ?? 1;
  }
  const max = Math.max(...counts);
  return counts.map((c) => (!c || !max ? "▁" : "▁▂▃▄▅▆▇█"[Math.min(7, Math.max(1, Math.ceil((c / max) * 7)))])).join("");
}

/** The locomotive, frame `i`: the smoke and the wheels change. */
const slFrame = (i: number) => {
  const smoke = ["  o O o  ", "  O o O  ", " o  O  o ", " O o  O  ", "  o  O o ", " O  o O  "][i % 6];
  const w = i % 2 ? "o" : "O";
  return [`      ${smoke}`, "       _||_____    ", "   ___/ |     |___ ", "  |  [] [] []  ==| ", `  '-${w}-${w}-----${w}-${w}-' `];
};
const MAIL_LABEL = { name: "name: ", email: "email: ", message: "message: " } as const;
type MailStep = keyof typeof MAIL_LABEL;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const seenBefore = () => {
  try {
    return window.localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return true;
  }
};
const markSeen = () => {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {}
};
const PANE_KEY = "xp-term-pane";
const checksKey = (persona: string) => `xp-term-checks:${persona}`;

/** The pane's contents rows, in order. `boot` is internal: it only counts toward the achievement. `mail` is optional. */
const CHECKS = ["boot", "resume", "projects", "writing", "views", "timeline", "gitlog", "portrait", "contact", "mail"] as const;
type CheckId = (typeof CHECKS)[number];
const REQUIRED: CheckId[] = ["boot", "resume", "projects", "writing", "views", "timeline", "gitlog", "portrait", "contact"];
/** The command each contents row runs. */
const ROW_CMD: Partial<Record<CheckId, string>> = {
  resume: "resume",
  projects: "projects",
  writing: "writing",
  views: "views",
  timeline: "timeline",
  gitlog: "git log",
  portrait: "portrait",
  contact: "contact",
  mail: "mail",
};
const ROW_ORDER = CHECKS.filter((c) => c !== "boot");
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
    <pre className={`terminal-os-braille ${className}`} aria-hidden="true">
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
    <>
      <span className="sr-only">a portrait of Ratul</span>
      <pre className="terminal-os-pixels" aria-hidden="true">
        {rows}
      </pre>
    </>
  );
});

/** The tips box: CSS borders with the title in the top one, so the frame always lines up with the text. */
function Tips({ tips }: { tips: Array<{ cmd: string; desc: string }> }) {
  return (
    <fieldset className="terminal-os-tips">
      <legend>Tips · type a number or a command</legend>
      {tips.map((t, k) => (
        <div key={t.cmd} className="terminal-os-tip">
          <em>{k + 1}</em>
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
  /** Where the real input's cursor is, so the drawn caret follows Home, arrows and clicks. */
  const [caret, setCaret] = useState(0);
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
  /** The `mail` form: which field the prompt is asking for, and what has been typed so far. */
  const [mailStep, setMailStep] = useState<MailStep | null>(null);
  const mailRef = useRef<{ step: MailStep; name: string; email: string; lines: string[] } | null>(null);
  /** The `demo` tour, while it runs. */
  const demoRef = useRef<boolean>(false);
  const [theme, setTheme] = useState<ThemeId>("accent");
  const themeRef = useRef<ThemeId>("accent");
  const [crt, setCrt] = useState(false);
  /** A `curl github` in flight, and a `sl` crossing the screen: Ctrl+C or Esc ends them. */
  const curlAbort = useRef<AbortController | null>(null);
  const slStop = useRef<(() => void) | null>(null);

  // Latest values for the long-lived async run and the window listener.
  const live = useRef({ cmd, sel, ready, busy: false, aborted: false, auto: false, cancelAuto: false, shell: initialShellState() as ShellState });
  const act = useRef<{
    open: (path: string, label: string | null, auto?: boolean) => void;
    exit: (typeIt: boolean) => void;
    esc: () => void;
  }>({ open: () => {}, exit: () => {}, esc: () => {} });
  const cancelled = useRef(false);
  /** One token per boot run: a run that was replaced (effect re-run, StrictMode) stops appending. */
  const runSeq = useRef(0);
  const timers = useRef<Array<{ id: number; resolve: () => void }>>([]);
  const seq = useRef(0);
  const histIdx = useRef(-1);
  const draft = useRef("");
  /** Resolves after `ms`; resolves at once when the component is gone, so loops can run their `finally` and exit. */
  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      if (cancelled.current) return resolve();
      const id = window.setTimeout(() => {
        timers.current = timers.current.filter((t) => t.id !== id);
        resolve();
      }, ms);
      timers.current.push({ id, resolve });
    });
  /** Capture-phase "any key stops it" listeners (demo, sl): tracked here so unmount can always remove them. */
  const guards = useRef<Array<() => void>>([]);
  const guardKeys = (stop: (e: Event) => void) => {
    window.addEventListener("keydown", stop, true);
    window.addEventListener("pointerdown", stop, true);
    const off = () => {
      window.removeEventListener("keydown", stop, true);
      window.removeEventListener("pointerdown", stop, true);
      guards.current = guards.current.filter((g) => g !== off);
    };
    guards.current.push(off);
    return off;
  };
  const sendingRef = useRef(false);
  const crtRef = useRef(false);
  const entriesRef = useRef<Entry[]>([]);
  const [demoOn, setDemoOn] = useState(false);
  /** The tour's step, for the status bar. */
  const [tourStep, setTourStep] = useState<{ i: number; n: number } | null>(null);

  // A programmatic change of `cmd` (history, Tab, chips, the tour) puts the input's cursor at the end; read it back.
  useEffect(() => {
    setCaret(input.current?.selectionStart ?? cmd.length);
  }, [cmd]);

  useEffect(() => {
    live.current.cmd = cmd;
    live.current.sel = sel;
    live.current.ready = ready;
  });

  themeRef.current = theme;
  const palette = ready && !mailStep && cmd.startsWith("/") && !/\s/.test(cmd);
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

  const toEntries = (lines: Out[], numbered = true): Entry[] =>
    lines.map((o): Entry => {
      const n = ++seq.current;
      if (o.kind === "text") return { n, k: "out", text: o.text, dim: o.dim, accent: o.accent };
      if (o.kind === "links") return { n, k: "links", items: o.items };
      if (o.kind === "portrait") return { n, k: "portrait" };
      if (o.kind === "parts") return { n, k: "parts", parts: o.parts };
      if (o.kind === "qr") return { n, k: "qr", lines: o.lines };
      if (o.kind === "files") return { n, k: "files", inline: o.inline, items: o.items };
      if (o.kind === "cal") return { n, k: "cal", title: o.title, weeks: o.weeks, today: o.today };
      if (o.kind === "neofetch") return { n, k: "neofetch", rows: o.rows };
      if (o.kind === "banner") return { n, k: "banner", art: o.art, welcome: o.welcome, overview: o.overview, tips: o.tips };
      if (o.kind === "link") return { n, k: "link", label: o.label, href: o.href, external: o.external };
      if (o.kind === "run") return { n, k: "run", text: o.text, cmd: o.cmd };
      return { n, k: "menu", id: o.id, rows: o.rows, numbered };
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
  const print = (lines: Out[], numbered = true) => {
    const m = append(toEntries(lines, numbered));
    setMenuN(m);
    if (m !== null) setSel(0);
  };

  /** Types into the transcript. `own`: an open/exit's typing (keeps going after an abort). Returns false if it stopped early. */
  const type = async (text: string, ms: number, instant: boolean, own = false, tok?: number): Promise<boolean> => {
    const stopped = () => cancelled.current || (tok !== undefined && tok !== runSeq.current) || (own ? live.current.cancelAuto : live.current.aborted);
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

  /** The hidden commands: counted by name like the listed ones. Anything else is sent as "unknown". */
  const EGGS = ["sl", "cowsay", "fortune", "sudo", "rm", "vim", "vi", "nano", "emacs"];

  /** Anonymous usage: the command name only, never arguments. Fire and forget; nothing identifies the visitor. */
  const beacon = (command: string, ok = true) => {
    try {
      if (typeof navigator === "undefined" || !navigator.sendBeacon) return;
      navigator.sendBeacon("/api/term-event", JSON.stringify({ command, ok, persona, theme: themeRef.current, viewport: window.innerWidth < 768 ? "phone" : "desktop" }));
    } catch {}
  };

  /** Sections with nothing in them are not listed, not required and never suggested. */
  const emptyIds: CheckId[] = [...(data.projects.length ? [] : ["projects" as const]), ...(data.posts.length ? [] : ["writing" as const]), ...(data.views.length ? [] : ["views" as const])];
  const required = REQUIRED.filter((r) => !emptyIds.includes(r));
  const rowOrder = ROW_ORDER.filter((r) => !emptyIds.includes(r));

  /** Marks a contents row done; when the listed rows (all but mail) are done, the achievement prints once, ever. */
  const tick = (id: CheckId) => {
    const cur = checksRef.current;
    if (cur[id]) return;
    let next: Checks = { ...cur, [id]: true };
    if (!next.achieved && osRef.current && required.every((r) => next[r])) {
      next = { ...next, achieved: true };
      append([{ n: ++seq.current, k: "out", text: "achievement unlocked · explorer — try: sudo make me a sandwich", accent: true }]);
      beacon("achievement");
    }
    checksRef.current = next;
    setChecks(next);
    saveChecks(persona, next);
  };

  /** Which checkpoint a command line earns. */
  const tickFor = (c: string, cwd0: string) => {
    const parts = c.split(/\s+/);
    const name = parts[0].replace(/^\//, "").toLowerCase();
    if (name === "resume" || name === "projects" || name === "writing" || name === "timeline" || name === "portrait" || name === "contact") tick(name);
    else if (name === "git" && parts[1] === "log") tick("gitlog");
    else if (name === "cat") {
      for (const a of parts.slice(1)) {
        const path = resolvePath(cwd0, a);
        if (path.startsWith(`${HOME}/resume/`)) tick("resume");
        else if (path.startsWith(`${HOME}/projects/`)) tick("projects");
        else if (path.startsWith(`${HOME}/writing/`)) tick("writing");
        else if (path === `${HOME}/contact`) tick("contact");
      }
    }
  };

  const nextTry = rowOrder.find((r) => !checks[r]);
  const hintCmd = nextTry ? ROW_CMD[nextTry]! : "sudo make me a sandwich";

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

  const echoAnswer = (label: string, text: string) => append([{ n: ++seq.current, k: "out", text, prompt: true, label }]);

  const endMail = () => {
    mailRef.current = null;
    setMailStep(null);
  };
  const startMail = () => {
    mailRef.current = { step: "name", name: "", email: "", lines: [] };
    setMailStep("name");
    line("send me a message, right here · Esc cancels", false, true, here());
  };
  const abortMail = () => {
    line("^C mail", false, true, here());
    endMail();
    setCmd("");
  };

  /** Posts the message; the result replaces the `sending …` line. A failed message is printed back so it is not lost. */
  const sendMail = async (name: string, email: string, message: string) => {
    sendingRef.current = true;
    const n = ++seq.current;
    append([{ n, k: "out", text: "sending …", dim: true }]);
    const patch = (p: Partial<Extract<Entry, { k: "out" }>>) => setEntries((es) => es.map((e) => (e.n === n && e.k === "out" ? { ...e, ...p } : e)));
    const fail = (why: string) => {
      patch({ text: why, dim: true });
      append([{ n: ++seq.current, k: "out", text: "your message was:", dim: true }, ...message.split("\n").map((t): Entry => ({ n: ++seq.current, k: "out", text: t }))]);
    };
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        keepalive: true,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, message, source: "terminal", persona }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (cancelled.current) return;
      if (res.ok && j.ok) {
        patch({ text: `sent · I read these myself · reply lands at ${email}`, dim: false, accent: true });
        tick("mail");
      } else fail(j.error ?? `could not send (${res.status})`);
    } catch {
      if (!cancelled.current) fail("could not reach the server");
    } finally {
      sendingRef.current = false;
    }
  };

  /** One Enter in the form: validate the field, move on, or (message) send on an empty line / Ctrl+D. */
  const mailEnter = (raw: string, send = false) => {
    const m = mailRef.current;
    if (!m) return;
    const val = raw.trim();
    setCmd("");
    if (m.step === "name") {
      echoAnswer(MAIL_LABEL.name, raw);
      if (!val) return void line("name is required", false, false, here());
      m.name = val;
      m.step = "email";
      setMailStep("email");
    } else if (m.step === "email") {
      echoAnswer(MAIL_LABEL.email, raw);
      if (!EMAIL_RE.test(val)) return void line("that does not look like an email", false, false, here());
      m.email = val;
      m.step = "message";
      setMailStep("message");
      line("(empty line to send)", false, true, here());
    } else {
      if (val) {
        echoAnswer(MAIL_LABEL.message, raw);
        m.lines.push(raw);
        if (!send) return;
      } else if (!send) echoAnswer(MAIL_LABEL.message, "");
      const body = m.lines.join("\n").trim();
      if (body.length < 5) {
        m.lines = [];
        return void line("say a little more", false, false, here());
      }
      const { name, email } = m;
      endMail();
      void sendMail(name, email, body);
    }
  };

  /** The tour: a dim comment, then the step typed into the real prompt and run. Any key or tap stops it. */
  const startDemo = async () => {
    if (demoRef.current) return;
    demoRef.current = true;
    beacon("tour_start");
    const fast = via === "normal" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const steps: Array<[string, string]> = [
      ["help", "every command, in groups"],
      ["resume", "the résumé, six files"],
      ["projects", "what I built"],
      ["timeline", "school → college → work"],
      ["portrait", "the face behind it"],
      ["contact", "say hi"],
    ];
    let stopped = false;
    const stop = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        e.preventDefault();
        e.stopPropagation();
      }
      stopped = true;
    };
    const unguard = guardKeys(stop);
    setDemoOn(true);
    const halted = () => stopped || cancelled.current;
    try {
      for (let k = 0; k < steps.length; k++) {
        const [step, note] = steps[k];
        if (halted()) break;
        setTourStep({ i: k + 1, n: steps.length });
        line(`# ${k + 1}/${steps.length} · ${note}`, false, true, here());
        await wait(fast ? 100 : 450);
        if (halted()) break;
        for (let c = 1; c <= step.length && !halted(); c++) {
          setCmd(step.slice(0, c));
          ambient.key();
          await wait(fast ? 12 : 28 + Math.random() * 12);
        }
        if (halted()) break;
        await wait(fast ? 60 : 180);
        if (halted()) break;
        submit(step);
        await wait(fast ? 350 : 700);
      }
    } finally {
      unguard();
      demoRef.current = false;
      setDemoOn(false);
      setTourStep(null);
      setCmd("");
      if (!cancelled.current) {
        if (stopped) {
          line("^C tour", false, true, here());
          beacon("tour_stop");
        } else line("tour over · type a command, or view", false, true, here());
      }
    }
  };

  const patchEntry = (n: number, p: Partial<Extract<Entry, { k: "out" }>>) => setEntries((es) => es.map((e) => (e.n === n && e.k === "out" ? { ...e, ...p } : e)));

  /** The public GitHub data for `curl github` and `git log`: cached for an hour, validated before use. */
  const loadGithub = async (ac: AbortController): Promise<{ d: GhCache; cached: boolean }> => {
    try {
      const c = JSON.parse(window.localStorage.getItem(GH_KEY) ?? "null") as GhCache | null;
      if (c && ghValid(c) && Date.now() - c.t < GH_TTL) return { d: c, cached: true };
    } catch {}
    const api = `https://api.github.com/users/${GH_USER}`;
    const rs = await Promise.all([`${api}`, `${api}/repos?sort=pushed&per_page=5`, `${api}/events/public?per_page=100`].map((u) => fetch(u, { signal: ac.signal })));
    if (rs.some((r) => r.status === 403 || r.status === 429)) throw new Error("rate");
    if (rs.some((r) => !r.ok)) throw new Error(`http ${rs.find((r) => !r.ok)?.status}`);
    const [user, repos, events] = await Promise.all(rs.map((r) => r.json()));
    const d: GhCache = { t: Date.now(), user, repos, events };
    if (!ghValid(d)) throw new Error("shape");
    try {
      window.localStorage.setItem(GH_KEY, JSON.stringify(d));
    } catch {}
    return { d, cached: false };
  };

  /** One run of a GitHub command: a `fetching …` line that the result or the error replaces. */
  const withGithub = async (who: string, show: (d: GhCache, cached: boolean, ac: AbortController) => Promise<Entry[]>, fail: (kind: "rate" | "net") => string) => {
    if (curlAbort.current) return void line(`${who}: already fetching`, false, true, here());
    const n = ++seq.current;
    append([{ n, k: "out", text: "fetching …", dim: true }]);
    const ac = new AbortController();
    curlAbort.current = ac;
    try {
      const { d, cached } = await loadGithub(ac);
      const es = await show(d, cached, ac);
      if (cancelled.current) return;
      setEntries((l) => l.filter((e) => e.n !== n));
      append(es);
    } catch (err) {
      if (cancelled.current) return;
      patchEntry(n, { text: ac.signal.aborted ? "^C" : fail(err instanceof Error && err.message === "rate" ? "rate" : "net"), dim: true });
    } finally {
      if (curlAbort.current === ac) curlAbort.current = null;
    }
  };

  /** `curl github`: user, recent repos and the 12-week strip. */
  const curlGithub = () =>
    withGithub(
      "curl",
      async (d, cached) => {
        const pad = Math.max(...d.repos.map((r) => r.name.length), 4);
        const rel = (iso: string) => ago(Date.now() - Date.parse(iso));
        const safeUrl = (u: string) => (/^https:\/\/github\.com\//.test(u) ? u : "");
        const plain = (text: string, dim = false): Entry => ({ n: ++seq.current, k: "out", text, dim });
        const parts = (text: string): Entry => ({ n: ++seq.current, k: "parts", parts: [{ text }] });
        return [
          plain("HTTP/2 200", true),
          ...(cached ? [plain(`(cached · ${ago(Date.now() - d.t)})`, true)] : []),
          plain(" "),
          parts(`${GH_USER} · ${Number(d.user.public_repos) || 0} repos · ${Number(d.user.followers) || 0} followers`),
          ...(d.repos[0] ? [parts(`last push  ${d.repos[0].name} · ${rel(d.repos[0].pushed_at)}`)] : []),
          ...d.repos.slice(0, 5).map(
            (r): Entry => ({ n: ++seq.current, k: "ghrepo", name: String(r.name), url: safeUrl(r.html_url), pad, rest: `  ${(r.language ?? "-").padEnd(11)}  ★${Number(r.stargazers_count) || 0}  ${rel(r.pushed_at)}` }),
          ),
          { n: ++seq.current, k: "parts", parts: [{ text: "contributions (12w)  " }, { text: strip(d.events), tone: "accent" }] },
        ];
      },
      (kind) => (kind === "rate" ? "github: rate limited, try again in a while" : "curl: (6) could not resolve api.github.com"),
    );

  /**
   * `git log`: the latest public pushes, newest first. The public events feed no longer carries commit
   * messages, so each push shows its head commit, with the message looked up once and kept on the device.
   */
  const gitLogLive = (oneline: boolean, limit: number) =>
    withGithub(
      "git",
      async (d, _cached, ac) => {
        type Item = { sha: string; repo: string; msg?: string; date: string };
        const items: Item[] = [];
        for (const e of d.events) {
          if (e.type !== "PushEvent" || !/^[\w.-]+\/[\w.-]+$/.test(e.repo?.name ?? "")) continue;
          const repo = e.repo!.name!;
          const cs = Array.isArray(e.payload?.commits) ? e.payload!.commits!.filter((c) => /^[0-9a-f]{7,40}$/i.test(c.sha ?? "")) : [];
          if (cs.length) for (const c of cs.slice().reverse()) items.push({ sha: c.sha!, repo, msg: (c.message ?? "").split("\n")[0], date: e.created_at });
          else if (/^[0-9a-f]{40}$/i.test(e.payload?.head ?? "")) items.push({ sha: e.payload!.head!, repo, date: e.created_at });
        }
        // The feed is nearly, not strictly, newest first.
        items.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
        const shown = items.slice(0, limit);
        let known: Record<string, string> = {};
        try {
          known = JSON.parse(window.localStorage.getItem("xp-gh-msgs") ?? "{}") ?? {};
        } catch {}
        await Promise.all(
          shown
            .filter((x) => x.msg === undefined && !(x.sha in known))
            .map(async (x) => {
              try {
                const r = await fetch(`https://api.github.com/repos/${x.repo}/commits/${x.sha}`, { signal: ac.signal });
                const m = r.ok ? String(((await r.json()) as { commit?: { message?: string } }).commit?.message ?? "").split("\n")[0] : "";
                if (m) known[x.sha] = m.length > 100 ? `${m.slice(0, 100).replace(/\s+\S*$/, "")}…` : m;
              } catch {}
            }),
        );
        try {
          window.localStorage.setItem("xp-gh-msgs", JSON.stringify(Object.fromEntries(Object.entries(known).slice(-150))));
        } catch {}
        const local = (iso: string) => {
          const t = new Date(iso);
          if (Number.isNaN(t.getTime())) return "unknown";
          const off = -t.getTimezoneOffset();
          const hh = (n: number) => String(n).padStart(2, "0");
          return `${t.toLocaleDateString("en-US", { weekday: "short" })} ${t.toLocaleDateString("en-US", { month: "short" })} ${t.getDate()} ${hh(t.getHours())}:${hh(t.getMinutes())} ${t.getFullYear()} ${off < 0 ? "-" : "+"}${hh(Math.floor(Math.abs(off) / 60))}${hh(Math.abs(off) % 60)}`;
        };
        const plain = (text: string, dim = false): Entry => ({ n: ++seq.current, k: "out", text, dim });
        const parts = (text: string): Entry => ({ n: ++seq.current, k: "parts", parts: [{ text }] });
        const out: Entry[] = [plain(`# public activity, last 90 days · github.com/${GH_USER}`, true)];
        if (!shown.length) out.push(plain("no public pushes in the last 90 days", true));
        for (const x of shown) {
          const msg = x.msg ?? known[x.sha] ?? "(message unavailable)";
          const url = `https://github.com/${x.repo}/commit/${x.sha}`;
          if (oneline) out.push({ n: ++seq.current, k: "ghcommit", label: x.sha.slice(0, 7), url, rest: ` ${x.repo}: ${msg}` });
          else
            out.push(
              { n: ++seq.current, k: "ghcommit", label: `commit ${x.sha.slice(0, 7)}`, url, rest: `  (${x.repo})` },
              parts(`Author: ${GH_USER}`),
              parts(`Date:   ${local(x.date)}`),
              plain(" "),
              parts(`    ${msg}`),
              plain(" "),
            );
        }
        return out;
      },
      (kind) => (kind === "rate" ? "fatal: github rate limited · try `timeline`" : "fatal: github unreachable · try `timeline`"),
    );

  /** `sl`: a locomotive crosses the width in about two seconds; any key or tap stops it. */
  const startSl = async () => {
    if (slStop.current || demoRef.current) return;
    let stopped = false;
    const stop = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        e.preventDefault();
        e.stopPropagation();
      }
      stopped = true;
    };
    slStop.current = () => (stopped = true);
    const unguard = guardKeys(stop);
    const n = ++seq.current;
    append([{ n, k: "art", text: "" }]);
    const cols = Math.max(30, Math.floor((body.current?.clientWidth ?? 600) / 7.8) - 4);
    const steps = 26;
    try {
      for (let i = 0; i <= steps && !stopped && !cancelled.current; i++) {
        const off = Math.round(cols - ((cols + 22) * i) / steps);
        const text = slFrame(i)
          .map((l) => (off >= 0 ? " ".repeat(off) + l : l.slice(-off)).slice(0, cols))
          .join("\n");
        setEntries((es) => es.map((e) => (e.n === n && e.k === "art" ? { ...e, text } : e)));
        ambient.key();
        await wait(80);
      }
    } catch {
    } finally {
      unguard();
      slStop.current = null;
      setEntries((es) => es.filter((e) => e.n !== n));
    }
  };

  /** The views menu, as `ls views/` prints it (the picker). */
  const showViews = (boot = false) => {
    const r = shell.run("views", { ...live.current.shell, history: [] });
    // The boot picker is not numbered and does not take digits: 1-7 belong to the tips box.
    live.current.shell = { ...live.current.shell, lastMenu: boot ? undefined : r.state.lastMenu };
    print(r.lines, !boot);
  };

  /** The boot window grows and dissolves; the full-screen terminal opens with the welcome. */
  const swap = () => {
    markSeen();
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
    mailRef.current = null;
    setMailStep(null);
    demoRef.current = false;
    pager.current = null;
    setPaging(false);
    if (!osRef.current) swap();
    const last = entriesRef.current[entriesRef.current.length - 1];
    if (last?.k === "menu") setMenuN(last.n);
    else showViews(true);
    setReady(true);
  };

  /** A view's boot, printed here in the transcript (about 700 ms; instant when motion is off), so the view itself opens without a second entry animation. */
  const bootView = async (id: string): Promise<boolean> => {
    const fast = via === "normal" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const aborted = () => cancelled.current || live.current.cancelAuto;
    const row = (text: string, tag?: "wait" | "ok") => {
      const n = ++seq.current;
      append([{ n, k: "out", text, tag }]);
      return n;
    };
    const patch = (n: number, p: Partial<Extract<Entry, { k: "out" }>>) => (osRef.current ? setEntries : setBootEntries)((es) => es.map((e) => (e.n === n && e.k === "out" ? { ...e, ...p } : e)));
    if (fast) {
      row(`mounting ${id}`, "ok");
      row(bootBar(BOOT_BAR_STEPS), undefined);
      row("handing over · Esc comes back", "ok");
      return true;
    }
    const a = row(`mounting ${id}`, "wait");
    await wait(160);
    if (aborted()) return false;
    patch(a, { tag: "ok" });
    const b = row(bootBar(0));
    for (let f = 1; f <= BOOT_BAR_STEPS; f++) {
      await wait(30);
      if (aborted()) return false;
      patch(b, { text: bootBar(f) });
      ambient.key();
    }
    await wait(60);
    if (aborted()) return false;
    row("handing over · Esc comes back", "ok");
    await wait(140);
    return !aborted();
  };

  const go = async (dest: Dest, hold = 420): Promise<boolean> => {
    setOpening(true);
    await wait(hold);
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
    if (views.some((v) => `/${v.id}` === path)) {
      tick("views");
      beacon(`view_open:${path.slice(1)}`);
    }
    live.current.busy = true;
    live.current.aborted = true;
    live.current.auto = auto;
    live.current.ready = false;
    setReady(false);
    if (label && !(await type(label, 12, false, true))) {
      if (live.current.cancelAuto && !cancelled.current) restore();
      return;
    }
    const isView = views.some((v) => `/${v.id}` === path);
    if (isView) {
      if (!(await bootView(path.slice(1)))) {
        if (live.current.cancelAuto && !cancelled.current) restore();
        return;
      }
      const d = personaHref(origin, persona, path);
      await go({ ...d, href: `${d.href}?via=terminal` }, 60);
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
    } else if (fx.kind === "exit") {
      if (sendingRef.current) line("sending · wait a moment", false, true, here());
      else act.current.exit(false);
    }
    else if (fx.kind === "clear") {
      setEntries([]);
      setMenuN(null);
    } else if (fx.kind === "window") window.open(fx.url, "_blank", "noopener");
    else if (fx.kind === "theme") {
      setTheme(fx.id);
      try {
        window.localStorage.setItem(THEME_KEY, fx.id);
      } catch {}
      line(`theme: ${fx.id}`, false, true, here());
    } else if (fx.kind === "crt") {
      const next = !crtRef.current;
      crtRef.current = next;
      setCrt(next);
      try {
        window.localStorage.setItem(CRT_KEY, next ? "1" : "0");
      } catch {}
      line(`crt ${next ? "on" : "off"}`, false, true, here());
    } else if (fx.kind === "qr") {
      const url = `${window.location.origin}${window.location.pathname}`;
      const m = qrModules(url);
      if (!m) line("qr: this address is too long to encode", false, false, here());
      else {
        append([{ n: ++seq.current, k: "qr", lines: qrLines(m) }]);
        line(url, false, true, here());
      }
    } else if (fx.kind === "curl-github") void curlGithub();
    else if (fx.kind === "git-log") void gitLogLive(fx.oneline, fx.limit);
    else if (fx.kind === "run") {
      // A tip's number: the real command runs next (`/` opens the palette).
      if (fx.cmd === "/") {
        setCmd("/");
        setPalSel(0);
        input.current?.focus({ preventScroll: true });
      } else submit(fx.cmd);
    }
    else if (fx.kind === "sl") void startSl();
    else if (fx.kind === "tour") void startDemo();
    else if (fx.kind === "mail") startMail();
    else if (fx.kind === "pane") togglePane();
    else toggleFull();
  };

  /** Runs one command line: echo, shell, output, effect. */
  const submit = (raw: string, echo = true) => {
    const c = raw.trim();
    if (!live.current.ready || !c || mailRef.current) return;
    setCmd("");
    histIdx.current = -1;
    if (echo) line(c, true, false, here());
    const cwd0 = live.current.shell.cwd;
    // Characters per line, for output that has a wide and a narrow form (`timeline`).
    const cols = Math.floor(((body.current?.clientWidth ?? window.innerWidth) - 64) / 7.8);
    const r = shell.run(c, live.current.shell, { cols });
    live.current.shell = r.state;
    setCwd(r.state.cwd);
    try {
      window.sessionStorage.setItem(histKey(persona), JSON.stringify(r.state.history));
    } catch {}
    if (r.lines.length > PAGE && !demoRef.current) {
      print(r.lines.slice(0, PAGE));
      pager.current = { rest: r.lines.slice(PAGE) };
      setPaging(true);
      append([{ n: ++seq.current, k: "more" }]);
    } else print(r.lines);
    tickFor(c, cwd0);
    if (!demoRef.current) {
      const name = c.split(/\s+/)[0].replace(/^\//, "").toLowerCase();
      const known = shell.commands.some((x) => x.name === name) || EGGS.includes(name);
      const first = r.lines[0];
      // The tour reports itself as tour_start / tour_stop.
      if (name !== "tour" && name !== "demo") beacon(known ? name : "unknown", known && !(first?.kind === "text" && first.text.startsWith("command not found")));
    }
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
    if (sendingRef.current) return void line("sending · wait a moment", false, true, here());
    if (curlAbort.current) curlAbort.current.abort();
    else if (slStop.current) slStop.current();
    else if (mailRef.current) abortMail();
    else if (paging) endPaging();
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
    if (mailStep) return;
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

  const syncCaret = (e: { currentTarget: HTMLInputElement }) => setCaret(e.currentTarget.selectionStart ?? cmd.length);

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if ((e.key.length === 1 && !e.ctrlKey && !e.metaKey) || e.key === "Backspace" || e.key === "Enter" || e.key === "Tab") ambient.key();
    const menuLive = menu && !cmd;
    // Ctrl+C with a selection (or Shift) is the browser's copy, not a cancel.
    if (e.ctrlKey && (e.key === "c" || e.key === "C") && (e.shiftKey || !!window.getSelection()?.toString() || e.currentTarget.selectionStart !== e.currentTarget.selectionEnd)) return;
    if (mailStep) {
      // The form owns the prompt: only its keys are special; typing goes to the input as usual.
      if ((e.ctrlKey && (e.key === "c" || e.key === "C")) || e.key === "Escape") {
        e.preventDefault();
        abortMail();
      } else if (e.ctrlKey && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        if (mailStep === "message") mailEnter(cmd, true);
      } else if (e.key === "Enter") {
        e.preventDefault();
        mailEnter(cmd);
      }
      return;
    }
    if (e.ctrlKey && !e.altKey && !e.metaKey && (e.key === "c" || e.key === "C")) {
      e.preventDefault();
      if (curlAbort.current || slStop.current) {
        curlAbort.current?.abort();
        slStop.current?.();
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
    } else if (/^[1-9]$/.test(e.key) && menuLive && menu.numbered !== false && menu.rows[Number(e.key) - 1]) {
      e.preventDefault();
      setSel(Number(e.key) - 1);
      pick(menu.id, menu.rows[Number(e.key) - 1]);
    }
  };

  // The script, then the hint and the views menu (or the remembered pick).
  useEffect(() => {
    cancelled.current = false;
    const runs = runSeq;
    const token = ++runs.current;
    live.current.busy = false;
    live.current.aborted = false;
    live.current.auto = false;
    live.current.cancelAuto = false;
    live.current.shell = initialShellState(loadHistory(persona));
    osRef.current = false;
    setOs(false);
    setCwd(HOME);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = via === "normal" || reduce;
    const fromBack = performance.now() - lastPop < 3000;
    const stopped = () => token !== runs.current || cancelled.current || live.current.aborted;
    const firstVisit = !seenBefore();
    // `?run=<command>` (from a link) runs once after boot; the parameter is stripped so a reload does not repeat it.
    let runCmd: string | null = null;
    try {
      const u = new URL(window.location.href);
      const r = u.searchParams.get("run");
      if (r !== null) {
        u.searchParams.delete("run");
        window.history.replaceState(window.history.state, "", u);
        const t = r.trim();
        if (/^[a-z][a-z0-9 ._~/-]{0,40}$/i.test(t) && shell.commands.some((c) => c.name === t.split(/\s+/)[0].toLowerCase())) runCmd = t;
      }
    } catch {}
    const run = async () => {
      setEntries([]);
      setBootEntries([]);
      setMenuN(null);
      setPartial("");
      await wait(via === "hub" ? 150 : 100);
      if (stopped()) return;
      setBooting(false);
      const script = terminalScript({ projects: items.length, posts: data.posts.length, views: views.length }, !firstVisit);
      for (const l of script) {
        if (stopped()) return;
        if (l.typed && !instant) await type(l.text, 13, false, false, token);
        else if (l.tag === "ok" && !instant) {
          // `[..]` for a beat, then it resolves to `[ok]`.
          await wait(firstVisit ? 140 : 40);
          if (stopped()) return;
          const n = ++seq.current;
          append([{ n, k: "out", text: l.text, tag: "wait" }]);
          await wait(firstVisit ? 120 : 30);
          if (stopped()) return;
          setBootEntries((es) => es.map((e) => (e.n === n && e.k === "out" ? { ...e, tag: "ok" } : e)));
        } else if (l.tag === "bar" && !instant) {
          const n = ++seq.current;
          append([{ n, k: "out", text: bootBar(0), tag: "bar" }]);
          for (let f = 1; f <= BOOT_BAR_STEPS; f++) {
            await wait(firstVisit ? 60 : 20);
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
      if (runCmd) remembered = null;
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
      line(firstVisit ? "new here? type tour · hiring? type hire · help lists everything" : "type help, / for the menu · hire for the short version", false, true);
      await type("ls views/", 13, instant, false, token);
      if (stopped()) return;
      showViews(true);
      setReady(true);
      live.current.ready = true;
      if (runCmd) {
        await type(runCmd, 13, instant, false, token);
        if (stopped()) return;
        setPartial(null);
        submit(runCmd, false);
        return;
      }
      setPartial(null);
    };
    void run();
    return () => {
      cancelled.current = true;
      runs.current++;
      for (const t of timers.current) {
        window.clearTimeout(t.id);
        t.resolve();
      }
      timers.current = [];
      curlAbort.current?.abort();
      slStop.current?.();
      for (const off of [...guards.current]) off();
      demoRef.current = false;
      mailRef.current = null;
      pager.current = null;
      setMailStep(null);
      setPaging(false);
      setDemoOn(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, via, itemKey, viewKey, color]);

  // Checkpoints and the pane's on/off, remembered on the device.
  useEffect(() => {
    checksRef.current = loadChecks(persona);
    setChecks(checksRef.current);
    try {
      if (window.localStorage.getItem(PANE_KEY) === "0") setPaneOn(false);
      const th = window.localStorage.getItem(THEME_KEY);
      if (THEMES.some((t) => t.id === th)) setTheme(th as ThemeId);
      if (window.localStorage.getItem(CRT_KEY) === "1") {
        crtRef.current = true;
        setCrt(true);
      }
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

  entriesRef.current = entries;
  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();
  /** While the mail form owns the prompt, chips and bar buttons say so instead of doing nothing. */
  const mailBlocks = () => {
    if (!mailRef.current) return false;
    line("finish or Esc the message first", false, true, here());
    return true;
  };
  const chipKey = (k: "tab" | "up" | "esc") => {
    input.current?.focus({ preventScroll: true });
    if (k !== "esc" && mailBlocks()) return;
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

  const firstYear = Math.min(...data.periods.map((p) => Number(p.from.slice(0, 4))).filter(Boolean), ...data.timeline.map((c) => Number(c.date.slice(0, 4))).filter(Boolean));
  const allContents: Array<{ id: CheckId; cmd: string; label: string; note: string }> = [
    { id: "resume", cmd: "resume", label: "resume", note: "the overview · 6 files" },
    { id: "projects", cmd: "projects", label: "projects", note: plural(data.projects.length, "project") },
    { id: "writing", cmd: "writing", label: "writing", note: plural(data.posts.length, "post") },
    { id: "views", cmd: "views", label: "views", note: plural(data.views.length, "view") },
    { id: "timeline", cmd: "timeline", label: "timeline", note: `${Number.isFinite(firstYear) ? firstYear : "…"} → now` },
    { id: "gitlog", cmd: "git log", label: "git log", note: "live from github" },
    { id: "portrait", cmd: "portrait", label: "portrait", note: "the face behind it" },
    { id: "contact", cmd: "contact", label: "contact", note: "mail · github · linkedin" },
    { id: "mail", cmd: "mail", label: "mail", note: "write to me" },
  ];
  const contents = allContents.filter((row) => !emptyIds.includes(row.id));

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
        {e.prompt ? (e.label ? <code className="ps-user">{e.label}</code> : ps1(e.ps)) : ""}
        {e.tag === "ok" ? <b className="is-ok">[ok] </b> : e.tag === "wait" ? "[..] " : ""}
        {e.text || " "}
      </span>
    ) : e.k === "banner" ? (
      <div key={e.n} className="terminal-os-welcome">
        <div className="terminal-os-header">
          <div className="terminal-os-header-text">
            <pre className="terminal-os-banner" aria-hidden="true">
              {e.art.join("\n")}
            </pre>
            <span className="sr-only">ROYAL PROGRAMMER</span>
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
        <span className="sr-only">a portrait of Ratul</span>
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
    ) : e.k === "parts" ? (
      <span key={e.n} className="is-cmd">
        {e.parts.map((p, i) =>
          p.tone || p.color ? (
            <b key={i} className={p.tone ? `tone-${p.tone}` : undefined} style={p.color ? { color: p.color } : undefined}>
              {p.text}
            </b>
          ) : (
            p.text
          ),
        )}
      </span>
    ) : e.k === "qr" ? (
      // Glyphs are 0.6em wide and 1em tall, two modules per row: stretch rows 1.2x so modules are square.
      <div key={e.n}>
        <span className="sr-only">a QR code of this page&apos;s address</span>
        <pre
          className="terminal-os-qr"
          aria-hidden="true"
          style={{ transform: "scaleY(1.2)", transformOrigin: "top left", marginBottom: `${Math.round(e.lines.length * 13 * 0.2) + 8}px` }}
        >
          {e.lines.join("\n")}
        </pre>
      </div>
    ) : e.k === "art" ? (
      <pre key={e.n} className="terminal-os-sl" aria-hidden="true">
        {e.text}
      </pre>
    ) : e.k === "ghrepo" ? (
      <span key={e.n} className="is-cmd">
        {e.url ? (
          <a className="terminal-root-link" href={e.url} target="_blank" rel="noreferrer">
            {e.name}
          </a>
        ) : (
          e.name
        )}
        {" ".repeat(e.pad - e.name.length)}
        {e.rest}
      </span>
    ) : e.k === "ghcommit" ? (
      <span key={e.n} className="is-cmd">
        {/^https:\/\/github\.com\//.test(e.url) ? (
          <a className="terminal-root-link terminal-gh-sha" href={e.url} target="_blank" rel="noreferrer">
            {e.label}
          </a>
        ) : (
          e.label
        )}
        {e.rest}
      </span>
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
          <Fragment key={l.label}>
            {i ? " · " : ""}
            {l.cmd ? (
              <button type="button" className="terminal-root-link" onMouseDown={keepFocus} onClick={() => submit(l.cmd!)}>
                {l.label}
              </button>
            ) : (
              <a className="terminal-root-link" href={l.href} {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}>
                {l.label}
              </a>
            )}
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
                  {e.numbered === false ? "" : `${n + 1}) `}
                  {r.label}
                </b>
                <i className="is-out">{r.line}</i>
              </button>
            </li>
          );
        })}
      </ul>
    );

  const typeChip = (run: () => void) => () => {
    if (mailBlocks()) return;
    ambient.key();
    run();
  };

  return (
    <div
      ref={root}
      className={`terminal-root ${via === "hub" ? "is-via-hub" : "is-direct"} ${opening ? "is-opening" : ""} ${os ? "is-os" : ""} ${crt ? "has-crt" : ""}`}
      style={{ "--persona-c": color } as CSSProperties}
      data-theme={theme}
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
          <span className="sr-only">Type commands. help lists them, hire is the short version, / opens the menu, banner prints the welcome again, cls clears the screen, Ctrl+C cancels, Esc or exit returns to the hub.</span>
          {demoOn ? <span className="sr-only" role="status">tour running, press any key to stop</span> : null}
          <div role="log" aria-live={demoOn ? "off" : "polite"} aria-relevant="additions">
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
                  {mailStep ? <code className="ps-user">{MAIL_LABEL[mailStep]}</code> : ps1(shortPath(cwd))}
                  {partial !== null ? (
                    <>
                      {partial}
                      <i className="hub-enter-caret" />
                    </>
                  ) : (
                    <>
                      {cmd.slice(0, Math.min(caret, cmd.length))}
                      <i className="hub-enter-caret" />
                      {cmd.slice(Math.min(caret, cmd.length))}
                    </>
                  )}
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
                  setCaret(e.target.selectionStart ?? e.target.value.length);
                  setCmd(e.target.value.slice(0, 200));
                  histIdx.current = -1;
                  setPalSel(0);
                }}
                onKeyDown={onInputKey}
                onKeyUp={syncCaret}
                onSelect={syncCaret}
                onClick={syncCaret}
              />
            </span>
          ) : null}
        </div>
        <aside className="terminal-os-pane" aria-label="Side pane">
          <h3>where</h3>
          <p className="terminal-os-pane-where">{shortPath(cwd)}</p>
          <h3>contents</h3>
          <ul role="list" className="terminal-os-contents">
            {contents.map((r) => (
              <li key={r.id}>
                <button type="button" className={`terminal-os-content-row ${checks[r.id] ? "is-done" : ""}`} onMouseDown={keepFocus} onClick={() => !mailBlocks() && submit(r.cmd)}>
                  <b>{checks[r.id] ? "✓" : " "}</b>
                  <span>{r.label}</span>
                  <i>{r.note}</i>
                </button>
              </li>
            ))}
          </ul>
          <h3>next</h3>
          <button type="button" className="terminal-os-pane-next" onMouseDown={keepFocus} onClick={() => submit(hintCmd)}>
            {nextTry ? `try: ${hintCmd}` : "all done · try: sudo make me a sandwich"}
          </button>
          <h3>keys</h3>
          <p className="terminal-os-keys">Tab complete · ↑ history · / menu · cls clear · Ctrl+C cancel · Esc exit</p>
        </aside>
        </div>
        <div className="terminal-os-status">
          <code className="terminal-os-status-l">{`${USER}@code  ${shortPath(cwd)}`}</code>
          {tourStep ? <code className="terminal-os-status-tour">{`tour ${tourStep.i}/${tourStep.n} · any key stops`}</code> : null}
          <code className="terminal-os-status-m is-counts" hidden={!!tourStep}>
            {[plural(data.projects.length, "project"), plural(data.posts.length, "post"), plural(data.views.length, "view")].filter((t) => !t.startsWith("0 ")).join(" · ")}
          </code>
          {nextTry && !tourStep ? (
            <button type="button" className="terminal-os-status-hint" onMouseDown={keepFocus} onClick={() => submit(hintCmd)}>
              {`try: ${hintCmd}`}
            </button>
          ) : null}
          <span className="terminal-os-status-r">
            <button type="button" onMouseDown={keepFocus} onClick={() => !mailBlocks() && submit("help")}>
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
          <button type="button" onMouseDown={keepFocus} onClick={typeChip(() => submit("tour"))}>
            tour
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
