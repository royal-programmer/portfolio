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
import { Fragment, memo, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { BOOT_BAR_STEPS, bootBar, terminalScript, type Line } from "@/app/components/hub/exit-sequence";
import type { LaunchedPersona, PersonaView } from "@/lib/content/types";
import { ambient } from "@/lib/site/ambient-sound";
import { hubHref, personaHref, useOrigin } from "@/lib/site/persona-link";
import { qrLines, qrModules } from "@/lib/site/qr";
import { heatGrid, STATS_KEY, STATS_TTL, statsValid, type HeatCell, type HeatMonth, type StatsCache, type StatsData } from "@/lib/site/terminal-stats";
import { TerminalSaver } from "@/app/components/views/terminal-saver";
import { ArchView } from "@/app/components/views/terminal-arch";
import type { ArchRun } from "@/lib/site/terminal-arch";
import { Heatmap, LangBar } from "@/app/components/views/terminal-heatmap";
import { cachedPortrait, generatePortrait, PORTRAIT_COLS, PORTRAIT_MODES, type PortraitArt, type PortraitConfig, type PortraitMode } from "@/lib/site/portrait-gen";
import type { TerminalData } from "@/lib/site/terminal-data";
import { HOME, resolvePath, shortPath, USER } from "@/lib/site/terminal-fs";
import { createShell, HISTORY_CAP, initialShellState, THEMES, type Effect, type FileItem, type LinkItem, type MenuId, type MenuRow, type Out, type ShellState, type ThemeId, type TimelineRow, type Tone } from "@/lib/site/terminal-shell";
import { isPrerendering, whenActive } from "@/lib/site/prerender";
import { isLang, LANG_HINTS, STRINGS, type Lang, type TerminalStrings } from "@/lib/site/terminal-strings";
import { usePresence } from "@/lib/site/terminal-presence";
import { ghostFor } from "@/lib/site/terminal-suggest";
import { forgetView, readView } from "@/lib/site/view-memory";
import { themeCss } from "@/lib/site/terminal-themes";
import type { InstallPrompt } from "@/app/service-worker";

/** The theme colour blocks, generated from the shared palettes (terminal-themes.ts). */
const THEME_CSS = themeCss();

export type TerminalRootProps = {
  persona: LaunchedPersona;
  /** Spectrum position and accent, as the hub placed this persona. */
  t: number;
  color: string;
  /** "hub": the camera flew into this window. "normal": the hub's display already played the script. null: direct visit. */
  via: "hub" | "normal" | null;
  /** Opened from the home screen (`?via=pwa`): a direct arrival, with one extra boot line. */
  pwa?: boolean;
  /** Public project slugs for `ls /engineer`. */
  items: string[];
  /** Enabled views, in picker order. */
  views: PersonaView[];
  /** What the shell and its file system know. */
  data: TerminalData;
};

type Entry =
  /** `ps`: the path the command was typed at (the OS prompt); absent on the boot script's plain `$ `. */
  | { n: number; k: "out"; text: string; prompt?: boolean; dim?: boolean; accent?: boolean; ps?: string; label?: string; tag?: "ok" | "wait" | "bar"; cands?: string[]; hl?: number }
  | { n: number; k: "links"; items: LinkItem[]; prefix?: string; suffix?: string; dim?: boolean; lead?: string }
  | { n: number; k: "ghcommit"; label: string; url: string; rest: string }
  | { n: number; k: "portrait"; mode: PortraitMode }
  | { n: number; k: "parts"; parts: Array<{ text: string; tone?: Tone; color?: string }> }
  | { n: number; k: "qr"; lines: string[] }
  | { n: number; k: "arch"; id: string; title: string; lines: ArchRun[][]; edges: Array<[string, string]>; notes: string[] }
  | { n: number; k: "fit"; matched: string[]; adjacent: Array<{ want: string; have: string }>; notYet: string[]; verdict: string; pct: number | null; labels: { matched: string; adjacent: string; notYet: string } }
  | { n: number; k: "timeline"; wide: boolean; rows: TimelineRow[] }
  | { n: number; k: "art"; text: string }
  | { n: number; k: "ghrepo"; name: string; url: string; pad: number; rest: string }
  | { n: number; k: "files"; inline: boolean; items: FileItem[] }
  | { n: number; k: "cal"; title: string; weeks: Array<Array<number | null>>; today: number }
  | { n: number; k: "more" }
  | { n: number; k: "heatmap"; weeks: HeatCell[][]; months: HeatMonth[]; narrow: boolean }
  | { n: number; k: "langbar"; langs: StatsData["languages"]; width: number }
  | { n: number; k: "neofetch"; rows: string[] }
  | { n: number; k: "banner"; art: string[]; welcome: string; overview: string[]; title: string; tips: Array<{ cmd: string; desc: string }> }
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
const SAVER_KEY = "xp-term-saver";
const LANG_KEY = "xp-term-lang";
const GH_USER = "royal-programmer";
const GH_KEY = "xp-gh-cache";
/** Running as an installed app (Chrome/Edge display-mode, or iOS standalone). */
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
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

const ago = (S: TerminalStrings, ms: number) => {
  if (!Number.isFinite(ms)) return S["ago.unknown"];
  const m = Math.floor(ms / 60_000);
  if (m < 1) return S["ago.now"];
  if (m < 60) return S["ago.m"](m);
  const h = Math.floor(m / 60);
  if (h < 48) return S["ago.h"](h);
  return S["ago.d"](Math.floor(h / 24));
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
type MailStep = "name" | "email" | "message";
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

const NL = String.fromCharCode(10);
const isNarrow =() => typeof window !== "undefined" && window.innerWidth < 600;

/** The generated art, once ready: spans only where a run has its own colour. */
function ArtLines({ art, className }: { art: PortraitArt; className: string }) {
  return (
    <pre className={`terminal-os-portrait ${className}`} aria-hidden="true" style={{ "--p-cols": art.cols, "--p-rows": art.rows, "--p-adv": art.adv } as CSSProperties}>
      {art.lines.map((runs, y) => (
        <Fragment key={y}>
          {runs.map((r, i) =>
            r.c || r.b || r.bold ? (
              <span key={i} style={{ color: r.c, background: r.b, fontWeight: r.bold ? 700 : undefined }}>
                {r.t}
              </span>
            ) : (
              r.t
            ),
          )}
          {NL}
        </Fragment>
      ))}
    </pre>
  );
}

/** Develops the portrait from the photo: `[..] developing…` while it loads, the art when it is ready, one line if it fails. */
const PortraitView = memo(function PortraitView({ mode, cfg, cols, className, fetchCard, run, s }: { mode: PortraitMode; cfg: PortraitConfig; cols: number; className: string; fetchCard?: boolean; run?: (cmd: string) => void; s: TerminalStrings }) {
  const [made, setArt] = useState<PortraitArt | undefined>();
  const art = cachedPortrait(cfg, mode, cols) ?? made;
  const [failed, setFailed] = useState(false);
  const end = useRef<HTMLSpanElement>(null);
  // The art arrives after the line was printed: keep the end of it in view.
  useEffect(() => {
    if (art && !fetchCard) end.current?.scrollIntoView({ block: "nearest" });
  }, [art, fetchCard]);
  useEffect(() => {
    let live = true;
    const hit = cachedPortrait(cfg, mode, cols);
    if (hit) return;
    generatePortrait(cfg, mode, cols).then(
      (a) => live && setArt(a),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [cfg, mode, cols]);
  return (
    <>
      <span className="sr-only">{s["pt.alt"]}</span>
      {art ? <ArtLines art={art} className={className} /> : failed ? <span className="is-out is-dim">{s["pt.fail"]}</span> : <span className="is-out">{s["pt.dev"]}</span>}
      {run && !fetchCard ? (
        <span className="is-out is-dim terminal-os-modes">
          {s["pt.modes"]}
          {PORTRAIT_MODES.map((m) => (
            <Fragment key={m}>
              <button type="button" className="terminal-root-link" onMouseDown={(e) => e.preventDefault()} onClick={() => run(`portrait ${m}`)}>
                {m}
              </button>
              {" · "}
            </Fragment>
          ))}
          {s["pt.hint"]}
        </span>
      ) : null}
      <span ref={end} />
    </>
  );
});

/** The tips box: CSS borders with the title in the top one, so the frame always lines up with the text. */
function Tips({ tips, title }: { tips: Array<{ cmd: string; desc: string }>; title: string }) {
  return (
    <fieldset className="terminal-os-tips">
      <legend>{title}</legend>
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

export function TerminalRoot({ persona, color, via, pwa = false, items, views, data }: TerminalRootProps) {
  const router = useRouter();
  const origin = useOrigin();
  const shell = useMemo(() => createShell(data), [data]);
  /** The language of the words the terminal speaks (`lang bn`); the ref is for the long-lived async code. */
  const [lang, setLang] = useState<Lang>("en");
  const langRef = useRef<Lang>("en");
  const T = () => STRINGS[langRef.current];
  const S = STRINGS[lang];
  const docs = useMemo(() => shell.docs(lang), [shell, lang]);
  const applyLang = (l: Lang, persist: boolean) => {
    langRef.current = l;
    setLang(l);
    if (!persist) return;
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {}
  };
  const root = useRef<HTMLDivElement>(null);
  const win = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const bootBody = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [booting, setBooting] = useState(true);
  /** The boot window's script, and (after the swap) the full-screen terminal's transcript. */
  const [bootEntries, setBootEntries] = useState<Entry[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  // Through the Normal doorway the terminal is the first frame: os mode from the server render on, with the banner as static markup until the boot effect takes over.
  const [os, setOs] = useState(via === "normal");
  const osRef = useRef(via === "normal");
  const [hydrated, setHydrated] = useState(false);
  /** A prerendered page waits, invisible, and fades in when the visitor arrives. */
  const [arriving, setArriving] = useState(false);
  const [cwd, setCwd] = useState(HOME);
  const [partial, setPartial] = useState<string | null>("");
  const [cmd, setCmd] = useState("");
  /** `share`: the copy token that just copied (`<entry n>`), shown as "copied ✓" for two seconds. */
  const [copied, setCopied] = useState<number | null>(null);
  /** Where the real input's cursor is, so the drawn caret follows Home, arrows and clicks. */
  const [caret, setCaret] = useState(0);
  const [bell, setBell] = useState(false);
  const bellTimer = useRef<number | undefined>(undefined);
  const ringBell = () => {
    window.clearTimeout(bellTimer.current);
    setBell(true);
    bellTimer.current = window.setTimeout(() => setBell(false), 120);
  };
  useEffect(() => () => window.clearTimeout(bellTimer.current), []);
  const [sel, setSel] = useState(0);
  const [palSel, setPalSel] = useState(0);
  /** The menu the arrow keys drive: the latest one shown, until Esc or another command. */
  const [menuN, setMenuN] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);
  const [checks, setChecks] = useState<Checks>({});
  const checksRef = useRef<Checks>({});
  const [paneOn, setPaneOn] = useState(true);
  /** Tabs on this page right now (Realtime presence); shown only from 2 up. */
  const visitors = usePresence(ready && os);
  /** The pane's "live" lines: the GitHub cache (undefined: not looked at yet; null: unavailable, section left out). */
  const [gh, setGh] = useState<GhCache | null | undefined>(undefined);
  /** No connection: the browser says so, or the last network call failed. Cleared when it comes back or a call succeeds. */
  const [down, setDown] = useState(false);
  /** A new service worker took over while this page was open. */
  const [swUpdate, setSwUpdate] = useState(false);
  /** The `stats` data, read from this device's cache only (never fetched for the pane). */
  const [stats, setStats] = useState<StatsData | null>(null);
  /** Long output waits behind `-- more --`; `rest` is what has not been printed yet. */
  const [paging, setPaging] = useState(false);
  const pager = useRef<{ rest: Out[] } | null>(null);
  /** The `mail` form: which field the prompt is asking for, and what has been typed so far. */
  const [mailStep, setMailStep] = useState<MailStep | null>(null);
  const mailRef = useRef<{ step: MailStep; name: string; email: string; lines: string[] } | null>(null);
  const [theme, setTheme] = useState<ThemeId>("accent");
  const themeRef = useRef<ThemeId>("accent");
  /** While the `theme` menu is open: the theme to restore on Esc (the menu previews live as the selection moves). */
  const themeBase = useRef<ThemeId | null>(null);
  const [crt, setCrt] = useState(false);
  /** The screensaver: on while it shows, leaving for the 200 ms it fades out. */
  const [saver, setSaver] = useState<"off" | "on" | "leaving">("off");
  const saverRef = useRef<"off" | "on" | "leaving">("off");
  const saverOff = useRef(false);
  const lastActive = useRef(0);
  /** The `fit` paste box under the prompt. */
  const [fitOpen, setFitOpen] = useState(false);
  const fitRef = useRef(false);
  const [fitText, setFitText] = useState("");
  const fitArea = useRef<HTMLTextAreaElement>(null);
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
  /** The portrait mode drawn last, for `portrait next`. */
  const portraitMode = useRef<PortraitMode>("pixels");
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
  /** Capture-phase "any key stops it" listeners (sl): tracked here so unmount can always remove them. */
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

  // A programmatic change of `cmd` (history, Tab, chips) puts the input's cursor at the end; read it back.
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
    const all = docs;
    return [...all.filter((c) => c.name.startsWith(f)), ...(f ? all.filter((c) => !c.name.startsWith(f) && c.name.includes(f)) : [])];
  }, [cmd, docs]);
  const palIdx = Math.min(palSel, Math.max(0, palMatches.length - 1));
  /** The rest of the best completion, shown dim after the caret (right arrow or End takes it). */
  const ghost = !ready || mailStep || paging || partial !== null || palette || caret < cmd.length ? "" : ghostFor(cmd, live.current.shell.history, (v) => shell.complete(v, live.current.shell));
  const menu = entries.find((e) => e.k === "menu" && e.n === menuN) as Extract<Entry, { k: "menu" }> | undefined;
  // The theme menu previews the highlighted row; leaving it any other way than Enter puts the old theme back.
  useEffect(() => {
    if (menu?.id === "themes" && menuN === menu.n) {
      if (themeBase.current === null) themeBase.current = themeRef.current;
      const k = menu.rows[Math.min(sel, menu.rows.length - 1)]?.key;
      if (k && THEMES.some((t) => t.id === k)) setTheme(k as ThemeId);
    } else if (themeBase.current !== null) {
      setTheme(themeBase.current);
      themeBase.current = null;
    }
  }, [menu, menuN, sel]);

  const portraitCfg = useMemo<PortraitConfig>(() => ({ src: data.portrait.src, crop: data.portrait.crop }), [data.portrait]);
  const viewKey = views.map((v) => v.id).join();
  const itemKey = items.join();

  const toEntries = (lines: Out[], numbered = true): Entry[] =>
    lines.map((o): Entry => {
      const n = ++seq.current;
      if (o.kind === "text") return { n, k: "out", text: o.text, dim: o.dim, accent: o.accent };
      if (o.kind === "links") return { n, k: "links", items: o.items, prefix: o.prefix, suffix: o.suffix, dim: o.dim, lead: o.lead };
      if (o.kind === "portrait") {
        const mode = o.mode === "next" ? PORTRAIT_MODES[(PORTRAIT_MODES.indexOf(portraitMode.current) + 1) % PORTRAIT_MODES.length] : o.mode;
        portraitMode.current = mode;
        return { n, k: "portrait", mode };
      }
      if (o.kind === "parts") return { n, k: "parts", parts: o.parts };
      if (o.kind === "arch") return { n, k: "arch", id: o.id, title: o.title, lines: o.lines, edges: o.edges, notes: o.notes };
      if (o.kind === "fit") return { n, k: "fit", matched: o.matched, adjacent: o.adjacent, notYet: o.notYet, verdict: o.verdict, pct: o.pct, labels: o.labels };
      if (o.kind === "qr") return { n, k: "qr", lines: o.lines };
      if (o.kind === "timeline") return { n, k: "timeline", wide: o.wide, rows: o.rows };
      if (o.kind === "files") return { n, k: "files", inline: o.inline, items: o.items };
      if (o.kind === "cal") return { n, k: "cal", title: o.title, weeks: o.weeks, today: o.today };
      if (o.kind === "neofetch") return { n, k: "neofetch", rows: o.rows };
      if (o.kind === "banner") return { n, k: "banner", art: o.art, welcome: o.welcome, overview: o.overview, title: o.title, tips: o.tips };
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
      if (typeof navigator === "undefined" || !navigator.sendBeacon || isPrerendering()) return;
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
      append([{ n: ++seq.current, k: "out", text: T()["ach.unlocked"], accent: true }]);
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
    line(T()["mail.start"], false, true, here());
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
    append([{ n, k: "out", text: T()["mail.sending"], dim: true }]);
    const patch = (p: Partial<Extract<Entry, { k: "out" }>>) => setEntries((es) => es.map((e) => (e.n === n && e.k === "out" ? { ...e, ...p } : e)));
    const fail = (why: string) => {
      patch({ text: why, dim: true });
      append([{ n: ++seq.current, k: "out", text: T()["mail.yours"], dim: true }, ...message.split("\n").map((t): Entry => ({ n: ++seq.current, k: "out", text: t }))]);
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
        patch({ text: T()["mail.sent"](email), dim: false, accent: true });
        tick("mail");
      } else fail(j.error ?? T()["mail.fail"](res.status));
    } catch {
      if (cancelled.current) return;
      // Nothing is queued: the text is printed back so it can be copied and sent later.
      if (!navigator.onLine) {
        setDown(true);
        fail(`${T()["net.offline"]} · ${T()["net.queue"]}`);
      } else fail(T()["mail.unreach"]);
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
      echoAnswer(T()["mail.name"], raw);
      if (!val) return void line(T()["mail.needname"], false, false, here());
      m.name = val;
      m.step = "email";
      setMailStep("email");
    } else if (m.step === "email") {
      echoAnswer(T()["mail.email"], raw);
      if (!EMAIL_RE.test(val)) return void line(T()["mail.bademail"], false, false, here());
      m.email = val;
      m.step = "message";
      setMailStep("message");
      line(T()["mail.empty"], false, true, here());
    } else {
      if (val) {
        echoAnswer(T()["mail.message"], raw);
        m.lines.push(raw);
        if (!send) return;
      } else if (!send) echoAnswer(T()["mail.message"], "");
      const body = m.lines.join("\n").trim();
      if (body.length < 5) {
        m.lines = [];
        return void line(T()["mail.more"], false, false, here());
      }
      const { name, email } = m;
      endMail();
      void sendMail(name, email, body);
    }
  };

  const patchEntry = (n: number, p: Partial<Extract<Entry, { k: "out" }>>) => setEntries((es) => es.map((e) => (e.n === n && e.k === "out" ? { ...e, ...p } : e)));

  /** The public GitHub data for `curl github` and `git log`: cached for an hour, validated before use. */
  const loadGithub = async (ac: AbortController): Promise<{ d: GhCache; cached: boolean }> => {
    try {
      const c = JSON.parse(window.localStorage.getItem(GH_KEY) ?? "null") as GhCache | null;
      if (c && ghValid(c) && Date.now() - c.t < GH_TTL) {
        setGh(c);
        return { d: c, cached: true };
      }
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
    setGh(d);
    setDown(false);
    return { d, cached: false };
  };

  /** One run of a GitHub command: a `fetching …` line that the result or the error replaces. */
  const withGithub = async (who: string, show: (d: GhCache, cached: boolean, ac: AbortController) => Promise<Entry[]>, fail: (kind: "rate" | "net") => string) => {
    if (curlAbort.current) return void line(T()["gh.already"](who), false, true, here());
    const n = ++seq.current;
    append([{ n, k: "out", text: T()["gh.fetching"], dim: true }]);
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
      const lost = !navigator.onLine || err instanceof TypeError;
      if (lost && !ac.signal.aborted) setDown(true);
      patchEntry(n, { text: ac.signal.aborted ? "^C" : lost ? T()["net.offline"] : fail(err instanceof Error && err.message === "rate" ? "rate" : "net"), dim: true });
    } finally {
      if (curlAbort.current === ac) curlAbort.current = null;
    }
  };

  /** `stats`: the GitHub year. Cached on this device for six hours; the route does the GitHub calls. */
  const statsRun = async (mode: "all" | "year" | "langs") => {
    if (curlAbort.current) return void line(T()["gh.already"]("stats"), false, true, here());
    const n = ++seq.current;
    append([{ n, k: "out", text: T()["gh.fetching"], dim: true }]);
    const ac = new AbortController();
    curlAbort.current = ac;
    try {
      let d: StatsData | null = null;
      try {
        const c = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? "null") as StatsCache | null;
        if (c && typeof c.t === "number" && statsValid(c.d) && Date.now() - c.t < STATS_TTL) d = c.d;
      } catch {}
      if (!d) {
        const r = await fetch("/api/github/contributions", { signal: ac.signal });
        if (!r.ok) throw new Error(`http ${r.status}`);
        const j: unknown = await r.json();
        if (!statsValid(j)) throw new Error("shape");
        d = j;
        setDown(false);
        try {
          window.localStorage.setItem(STATS_KEY, JSON.stringify({ t: Date.now(), d } satisfies StatsCache));
        } catch {}
      }
      if (cancelled.current) return;
      setStats(d);
      const cols = Math.floor(((body.current?.clientWidth ?? window.innerWidth) - 64) / 7.8);
      const wide = cols >= 80;
      const parts = (ps: Array<{ text: string; tone?: Tone }>): Entry => ({ n: ++seq.current, k: "parts", parts: ps });
      const out: Entry[] = [];
      if (mode !== "langs") {
        const g = heatGrid(d, wide ? 53 : 26);
        out.push({ n: ++seq.current, k: "heatmap", weeks: g.weeks, months: g.months, narrow: !wide });
      }
      if (mode === "all") out.push(parts([{ text: T()["stats.line"](d.total, d.streak.current, d.streak.longest) }]));
      if (mode !== "year") {
        if (d.languages.length) out.push({ n: ++seq.current, k: "langbar", langs: d.languages, width: Math.max(24, Math.min(wide ? 60 : 36, cols - 2)) });
        else out.push({ n: ++seq.current, k: "out", text: T()["stats.nolang"], dim: true });
      }
      setEntries((l) => l.filter((e) => e.n !== n));
      append(out);
    } catch (err) {
      if (cancelled.current) return;
      const lost = !navigator.onLine || err instanceof TypeError;
      if (lost && !ac.signal.aborted) setDown(true);
      patchEntry(n, { text: ac.signal.aborted ? "^C" : lost ? T()["net.offline"] : T()["stats.fail"], dim: true });
    } finally {
      if (curlAbort.current === ac) curlAbort.current = null;
    }
  };

  /** `install`: Chrome/Edge's prompt if the browser offered one, the share-sheet steps on iOS, else an honest no. */
  const installApp = async () => {
    if (isStandalone()) return void line(T()["inst.already"], false, true, here());
    const offer = window.__xpInstall as InstallPrompt | undefined;
    if (offer) {
      window.__xpInstall = undefined; // a prompt can be used once
      try {
        await offer.prompt();
        const { outcome } = await offer.userChoice;
        if (!cancelled.current) line(outcome === "accepted" ? T()["inst.ok"] : T()["inst.later"], false, outcome !== "accepted", here());
      } catch {
        if (!cancelled.current) line(T()["inst.later"], false, true, here());
      }
      return;
    }
    const ua = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (ios) {
      line(T()["inst.ios1"], false, false, here());
      line(T()["inst.ios2"], false, false, here());
      return;
    }
    line(T()["inst.none"], false, true, here());
  };

  /** `curl github`: user, recent repos and the 12-week strip. */
  const curlGithub = () =>
    withGithub(
      "curl",
      async (d, cached) => {
        const pad = Math.max(...d.repos.map((r) => r.name.length), 4);
        const rel = (iso: string) => ago(T(), Date.now() - Date.parse(iso));
        const safeUrl = (u: string) => (/^https:\/\/github\.com\//.test(u) ? u : "");
        const plain = (text: string, dim = false): Entry => ({ n: ++seq.current, k: "out", text, dim });
        const parts = (text: string): Entry => ({ n: ++seq.current, k: "parts", parts: [{ text }] });
        return [
          plain("HTTP/2 200", true),
          ...(cached ? [plain(T()["gh.cached"](ago(T(), Date.now() - d.t)), true)] : []),
          plain(" "),
          parts(T()["gh.summary"](GH_USER, Number(d.user.public_repos) || 0, Number(d.user.followers) || 0)),
          ...(d.repos[0] ? [parts(`${T()["gh.lastpush"]}${d.repos[0].name} · ${rel(d.repos[0].pushed_at)}`)] : []),
          ...d.repos.slice(0, 5).map(
            (r): Entry => ({ n: ++seq.current, k: "ghrepo", name: String(r.name), url: safeUrl(r.html_url), pad, rest: `  ${(r.language ?? "-").padEnd(11)}  ★${Number(r.stargazers_count) || 0}  ${rel(r.pushed_at)}` }),
          ),
          { n: ++seq.current, k: "parts", parts: [{ text: T()["gh.contrib"] }, { text: strip(d.events), tone: "accent" }] },
        ];
      },
      (kind) => (kind === "rate" ? T()["gh.rate"] : T()["gh.dns"]),
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
          if (Number.isNaN(t.getTime())) return T()["ago.unknown"];
          const off = -t.getTimezoneOffset();
          const hh = (n: number) => String(n).padStart(2, "0");
          return `${t.toLocaleDateString("en-US", { weekday: "short" })} ${t.toLocaleDateString("en-US", { month: "short" })} ${t.getDate()} ${hh(t.getHours())}:${hh(t.getMinutes())} ${t.getFullYear()} ${off < 0 ? "-" : "+"}${hh(Math.floor(Math.abs(off) / 60))}${hh(Math.abs(off) % 60)}`;
        };
        const plain = (text: string, dim = false): Entry => ({ n: ++seq.current, k: "out", text, dim });
        const parts = (text: string): Entry => ({ n: ++seq.current, k: "parts", parts: [{ text }] });
        const out: Entry[] = [plain(T()["git.head"](GH_USER), true)];
        if (!shown.length) out.push(plain(T()["git.nopush"], true));
        for (const x of shown) {
          const msg = x.msg ?? known[x.sha] ?? T()["git.nomsg"];
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
      (kind) => (kind === "rate" ? T()["git.rate"] : T()["git.down"]),
    );

  /** `sl`: a locomotive crosses the width in about two seconds; any key or tap stops it. */
  const startSl = async () => {
    if (slStop.current) return;
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
    const r = shell.run("views", { ...live.current.shell, history: [] }, { lang: langRef.current });
    // The boot picker is not numbered and does not take digits: 1-8 belong to the tips box.
    live.current.shell = { ...live.current.shell, lastMenu: boot ? undefined : r.state.lastMenu };
    print(r.lines, !boot);
  };

  /** The boot window grows and dissolves; the full-screen terminal opens with the welcome. */
  const swap = (banner = true) => {
    markSeen();
    osRef.current = true;
    setOs(true);
    if (banner) append(toEntries(shell.banner(langRef.current)));
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
      row(T()["bv.mount"](id), "ok");
      row(bootBar(BOOT_BAR_STEPS), undefined);
      row(T()["bv.handover"], "ok");
      return true;
    }
    const a = row(T()["bv.mount"](id), "wait");
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
    row(T()["bv.handover"], "ok");
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
    const off = () => line(T()["fx.nofull"], false, true, here());
    try {
      const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
      p.catch(off);
    } catch {
      off();
    }
  };

  const togglePane = () => {
    if (window.innerWidth < 1024) return void line(T()["fx.nopane"], false, true, here());
    const next = !paneOn;
    setPaneOn(next);
    try {
      window.localStorage.setItem(PANE_KEY, next ? "1" : "0");
    } catch {}
  };

  const startSaver = (force = false) => {
    if (saverRef.current !== "off" || (!force && saverOff.current)) return;
    if (force && saverOff.current) return void line(T()["fx.saver.is-off"], false, true, here());
    saverRef.current = "on";
    lastActive.current = performance.now();
    setSaver("on");
  };
  const stopSaver = () => {
    if (saverRef.current !== "on") return;
    saverRef.current = "leaving";
    setSaver("leaving");
    lastActive.current = performance.now();
    window.setTimeout(() => {
      saverRef.current = "off";
      setSaver("off");
    }, 200);
  };

  const openFit = () => {
    fitRef.current = true;
    setFitText("");
    setFitOpen(true);
    window.setTimeout(() => fitArea.current?.focus({ preventScroll: false }), 30);
  };
  const closeFit = () => {
    fitRef.current = false;
    setFitOpen(false);
    window.setTimeout(() => {
      if (!window.matchMedia("(pointer: coarse)").matches) input.current?.focus({ preventScroll: true });
    }, 0);
  };
  /** Runs the paste box: echoes `fit`, prints the card. Nothing is sent anywhere. */
  const runFit = () => {
    const t = fitText.trim();
    if (!t) return void closeFit();
    closeFit();
    line(T()["fit.pasted"](t.length.toLocaleString("en-US")), false, true);
    print(shell.fit(t, langRef.current));
    beacon("fit");
  };

  const effect = (fx: Effect) => {
    if (fx.kind === "open-view") act.current.open(`/${fx.id}`, null);
    else if (fx.kind === "open-slug") act.current.open(fx.blog ? `/blog/${fx.slug}` : `/${fx.slug}`, null);
    else if (fx.kind === "open-url") {
      line(T()["fx.opening"](fx.url), false, true);
      append([{ n: ++seq.current, k: "link", label: fx.url, href: fx.url, external: true }]);
      window.open(fx.url, "_blank", "noopener,noreferrer");
    } else if (fx.kind === "exit") {
      if (sendingRef.current) line(T()["fx.wait"], false, true, here());
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
      line(T()["fx.theme"](fx.id), false, true, here());
    } else if (fx.kind === "lang") {
      applyLang(fx.lang, true);
    } else if (fx.kind === "crt") {
      const next = !crtRef.current;
      crtRef.current = next;
      setCrt(next);
      try {
        window.localStorage.setItem(CRT_KEY, next ? "1" : "0");
      } catch {}
      line(T()["fx.crt"](next), false, true, here());
    } else if (fx.kind === "qr") {
      const url = `${window.location.origin}${window.location.pathname}`;
      const m = qrModules(url);
      if (!m) line(T()["qr.long"], false, false, here());
      else {
        append([{ n: ++seq.current, k: "qr", lines: qrLines(m) }]);
        line(url, false, true, here());
      }
    } else if (fx.kind === "install") void installApp();
    else if (fx.kind === "curl-github") void curlGithub();
    else if (fx.kind === "git-log") void gitLogLive(fx.oneline, fx.limit);
    else if (fx.kind === "stats") void statsRun(fx.mode);
    else if (fx.kind === "run") {
      // A tip's number: the real command runs next (`/` opens the palette).
      if (fx.cmd === "/") {
        setCmd("/");
        setPalSel(0);
        input.current?.focus({ preventScroll: true });
      } else submit(fx.cmd);
    }
    else if (fx.kind === "sl") void startSl();
    else if (fx.kind === "fit-box") openFit();
    else if (fx.kind === "saver") {
      if (fx.mode === "now") startSaver(true);
      else {
        saverOff.current = fx.mode === "off";
        try {
          window.localStorage.setItem(SAVER_KEY, fx.mode === "off" ? "0" : "1");
        } catch {}
        line(fx.mode === "off" ? T()["fx.saver.off"] : T()["fx.saver.on"], false, true, here());
      }
    }
    else if (fx.kind === "mail") startMail();
    else if (fx.kind === "pane") togglePane();
    else toggleFull();
  };

  /** Runs one command line: echo, shell, output, effect. */
  const submit = (raw: string, echo = true) => {
    const c = raw.trim();
    if (!live.current.ready || !c || mailRef.current) return;
    if (fitRef.current) closeFit();
    setCmd("");
    histIdx.current = -1;
    if (echo) line(c, true, false, here());
    const cwd0 = live.current.shell.cwd;
    // Characters per line, for output that has a wide and a narrow form (`timeline`).
    const cols = Math.floor(((body.current?.clientWidth ?? window.innerWidth) - 64) / 7.8);
    const r = shell.run(c, live.current.shell, { cols, lang: langRef.current });
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
    {
      const name = c.split(/\s+/)[0].replace(/^\//, "").toLowerCase();
      const known = shell.commands.some((x) => x.name === name) || EGGS.includes(name);
      const first = r.lines[0];
      beacon(known ? name : "unknown", known && !(first?.kind === "text" && /command not found$/.test(first.text)));
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
    } else if (id === "themes") {
      themeBase.current = null;
      submit(`theme ${row.key}`);
    } else if (id === "langs") submit(`lang ${row.key}`);
    else submit(`cat ~/${id}/${row.key}.md`);
  };

  /** Esc, in order: palette, typed text, menu selection; with none of those, exit. (An auto-open call-off is handled while busy.) */
  act.current.esc = () => {
    if (sendingRef.current) return void line(T()["fx.wait"], false, true, here());
    if (fitRef.current) return void closeFit();
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

  /** Tab-cycle state: Tab again steps through the candidates (Shift+Tab back), like a shell's menu-complete. */
  const cyc = useRef<{ orig: string; base: string; cands: string[]; idx: number; lineId: number; value: string } | null>(null);
  const markCands = (n: number, hl: number | undefined) => (osRef.current ? setEntries : setBootEntries)((es) => es.map((e) => (e.n === n && e.k === "out" ? { ...e, hl } : e)));
  const endCycle = () => {
    const c = cyc.current;
    if (!c) return;
    cyc.current = null;
    markCands(c.lineId, undefined);
  };

  const tab = (dir: 1 | -1 = 1) => {
    if (mailStep) return;
    if (palette) {
      if (palMatches.length > 1) return setPalSel((palIdx + dir + palMatches.length) % palMatches.length);
      const c = palMatches[palIdx];
      if (c) setCmd(`/${c.name} `);
      return;
    }
    const c = cyc.current;
    if (c && c.value === cmd) {
      c.idx = c.idx === -1 ? (dir === 1 ? 0 : c.cands.length - 1) : (c.idx + dir + c.cands.length) % c.cands.length;
      c.value = c.base + c.cands[c.idx];
      setCmd(c.value);
      markCands(c.lineId, c.idx);
      return;
    }
    cyc.current = null;
    const cands = shell.complete(cmd, live.current.shell);
    if (!cands.length) return ringBell();
    const head = /^(.*?)\S*$/.exec(cmd)?.[1] ?? "";
    if (cands.length === 1) return setCmd(head + cands[0] + (cands[0].endsWith("/") ? "" : " "));
    let prefix = cands[0];
    for (const x of cands) while (!x.startsWith(prefix)) prefix = prefix.slice(0, -1);
    if (prefix) setCmd(head + prefix);
    const n = ++seq.current;
    append([{ n, k: "out", text: cands.join("   "), prompt: false, dim: true, ps: here(), cands }]);
    cyc.current = { orig: cmd, base: head, cands, idx: -1, lineId: n, value: head + prefix };
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
    if (cyc.current && !["Tab", "Shift", "Control", "Alt", "Meta"].includes(e.key)) {
      if (e.key === "Escape") {
        // Esc while cycling puts the typed word back and stays at the prompt.
        e.preventDefault();
        const c = cyc.current;
        endCycle();
        setCmd(c.orig);
        return;
      }
      endCycle();
    }
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
    if ((e.key === "ArrowRight" || e.key === "End") && ghost && !e.shiftKey && e.currentTarget.selectionStart === cmd.length && e.currentTarget.selectionEnd === cmd.length) {
      e.preventDefault();
      setCmd(cmd + ghost);
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
      // Tab never leaves the prompt: it completes, lists the candidates, or rings the bell.
      e.preventDefault();
      const any = (!palette && cyc.current?.value === cmd) || (!!cmd && (palette ? palMatches.length > 0 : shell.complete(cmd, live.current.shell).length > 0));
      if (any) tab(e.shiftKey ? -1 : 1);
      else ringBell();
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
    // The language: `?lang=` on the address wins and is remembered; else the saved choice; else English.
    let savedLang: Lang | null = null;
    let urlLang: Lang | null = null;
    try {
      const v = window.localStorage.getItem(LANG_KEY);
      if (isLang(v)) savedLang = v;
    } catch {}
    try {
      const u = new URL(window.location.href);
      const l = u.searchParams.get("lang");
      if (l !== null) {
        u.searchParams.delete("lang");
        window.history.replaceState(window.history.state, "", u);
        if (isLang(l.trim().toLowerCase())) urlLang = l.trim().toLowerCase() as Lang;
      }
    } catch {}
    const startLang: Lang = urlLang ?? savedLang ?? "en";
    applyLang(startLang, urlLang !== null);
    const direct = via === "normal";
    osRef.current = direct;
    setOs(direct);
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
      // The banner replaces the static one in the same commit: no gap, no second banner.
      setEntries(direct ? toEntries(shell.banner(startLang)) : []);
      setBootEntries([]);
      setMenuN(null);
      setPartial("");
      setHydrated(true);
      if (!direct) await wait(via === "hub" ? 150 : 100);
      if (stopped()) return;
      setBooting(false);
      const script = terminalScript({ projects: items.length, posts: data.posts.length, views: views.length }, !firstVisit, STRINGS[startLang]);
      // Opened from the home screen: one more row, before the progress bar.
      const extra: Line[] = [];
      if (pwa) extra.push({ text: STRINGS[startLang]["boot.pwa"], typed: false, tag: "ok" });
      if (isStandalone()) extra.push({ text: STRINGS[startLang]["boot.app"], typed: false, tag: "ok" });
      script.splice(script.length - 1, 0, ...extra);
      for (const l of direct ? [] : script) {
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
      // Any arrival from the hub (immersive or Normal) lands on the terminal root; only a direct visit resumes the last view.
      let remembered = via ? null : readView(persona);
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
      swap(!direct);
      tick("boot");
      if (!instant) await wait(520);
      if (stopped()) return;
      line(firstVisit ? STRINGS[startLang]["hint.new"] : STRINGS[startLang]["hint.back"], false, true);
      // A browser that lists Bengali or Hindi, and no choice saved yet: one extra dim line, in that language.
      const offered = savedLang === null && urlLang === null ? (navigator.languages ?? []).map((l) => l.toLowerCase().split("-")[0]).find((l) => l === "bn" || l === "hi") : undefined;
      if (offered === "bn" || offered === "hi") line(LANG_HINTS[offered], false, true);
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
    // A prerendered page holds the whole boot until the visitor arrives (it plays on activation, not before).
    const wasPrerendered = isPrerendering();
    if (wasPrerendered && direct) setArriving(true);
    const off = whenActive(() => {
      if (wasPrerendered && direct) window.requestAnimationFrame(() => setArriving(false));
      void run();
    });
    return () => {
      off();
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
        mailRef.current = null;
      pager.current = null;
      setMailStep(null);
      setPaging(false);
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
    // Only read the cache here; the network is not touched on boot.
    try {
      const sc = JSON.parse(window.localStorage.getItem(STATS_KEY) ?? "null") as StatsCache | null;
      if (sc && typeof sc.t === "number" && statsValid(sc.d)) setStats(sc.d);
    } catch {}
    try {
      const c = JSON.parse(window.localStorage.getItem(GH_KEY) ?? "null") as GhCache | null;
      if (c && ghValid(c)) setGh(c);
    } catch {}
  }, [persona]);

  // Connectivity for the status bar and the pane, and the service worker's "update ready".
  useEffect(() => {
    setDown(!navigator.onLine);
    setSwUpdate(!!window.__xpSwUpdated);
    const off = () => setDown(true);
    const on = () => setDown(false);
    const upd = () => setSwUpdate(true);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    window.addEventListener("xp-sw-update", upd);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
      window.removeEventListener("xp-sw-update", upd);
    };
  }, []);

  // Once the terminal has been ready and idle for 3 s, look GitHub up once for the pane (unless the connection asks for less data).
  useEffect(() => {
    if (!ready || gh !== undefined) return;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return void setGh(null);
    const ac = new AbortController();
    const id = window.setTimeout(() => {
      loadGithub(ac).catch(() => {
        if (!ac.signal.aborted) setGh(null);
      });
    }, 3000);
    return () => {
      window.clearTimeout(id);
      ac.abort();
    };
  }, [ready, gh, cmd, entries.length]);

  useEffect(() => {
    if (via || pwa) {
      try {
        const u = new URL(window.location.href);
        if (u.searchParams.has("via")) {
          u.searchParams.delete("via");
          window.history.replaceState(window.history.state, "", u);
        }
      } catch {}
    }
  }, [via, pwa]);

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

  // The screensaver: idle for 90 s (120 on a phone), tab visible, nothing open that wants the keys.
  useEffect(() => {
    try {
      saverOff.current = window.localStorage.getItem(SAVER_KEY) === "0";
    } catch {}
    lastActive.current = performance.now();
    const touch = () => {
      if (saverRef.current === "off") lastActive.current = performance.now();
    };
    const wake = (e: Event) => {
      if (saverRef.current === "off") return;
      // A key held down from the command that started it does not count.
      if (e instanceof KeyboardEvent && e.repeat) return e.preventDefault();
      e.preventDefault();
      e.stopPropagation();
      stopSaver();
    };
    const ev = ["pointermove", "scroll", "wheel", "touchmove"] as const;
    for (const n of ev) window.addEventListener(n, touch, { passive: true, capture: true });
    for (const n of ["keydown", "pointerdown", "click"] as const) window.addEventListener(n, wake as EventListener, true);
    const onVis = () => {
      if (document.visibilityState === "visible") lastActive.current = performance.now();
    };
    document.addEventListener("visibilitychange", onVis);
    const id = window.setInterval(() => {
      const s = live.current;
      const limit = (window.innerWidth < 600 ? 120 : 90) * 1000;
      if (saverRef.current !== "off" || saverOff.current || document.visibilityState !== "visible") return;
      if (!osRef.current || !s.ready || s.busy || mailRef.current || fitRef.current || sendingRef.current) return;
      if (performance.now() - lastActive.current >= limit) startSaver();
    }, 2000);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      for (const n of ev) window.removeEventListener(n, touch, true);
      for (const n of ["keydown", "pointerdown", "click"] as const) window.removeEventListener(n, wake as EventListener, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** A `share` token: copy the link, or open the phone's share sheet. */
  const shareAct = (n: number, l: LinkItem) => {
    if (!l.url) return;
    if (l.act === "share") {
      void navigator.share?.({ title: l.title, url: l.url }).catch(() => {});
      return;
    }
    navigator.clipboard.writeText(l.url).then(
      () => {
        setCopied(n);
        window.setTimeout(() => setCopied((c) => (c === n ? null : c)), 2000);
      },
      () => line(T()["fx.copyfail"], false, true, here()),
    );
  };
  /** While the mail form owns the prompt, chips and bar buttons say so instead of doing nothing. */
  const mailBlocks = () => {
    if (!mailRef.current) return false;
    line(T()["fx.mailfirst"], false, true, here());
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

  const firstYear = Math.min(...data.periods.map((p) => Number(p.from.slice(0, 4))).filter(Boolean), ...data.timeline.map((c) => Number(c.date.slice(0, 4))).filter(Boolean));
  const allContents: Array<{ id: CheckId; cmd: string; label: string; note: string }> = [
    { id: "resume", cmd: "resume", label: "resume", note: S["ct.resume"] },
    { id: "projects", cmd: "projects", label: "projects", note: S["unit.project"](data.projects.length) },
    { id: "writing", cmd: "writing", label: "writing", note: S["unit.post"](data.posts.length) },
    { id: "views", cmd: "views", label: "views", note: S["unit.view"](data.views.length) },
    { id: "timeline", cmd: "timeline", label: "timeline", note: S["ct.timeline"](String(Number.isFinite(firstYear) ? firstYear : "…")) },
    { id: "gitlog", cmd: "git log", label: "git log", note: S["ct.gitlog"] },
    { id: "portrait", cmd: "portrait", label: "portrait", note: S["ct.portrait"] },
    { id: "contact", cmd: "contact", label: "contact", note: S["ct.contact"] },
    { id: "mail", cmd: "mail", label: "mail", note: S["ct.mail"] },
  ];
  const contents = allContents.filter((row) => !emptyIds.includes(row.id));
  const seen = contents.filter((r) => checks[r.id]).length;

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
        {e.cands
          ? e.cands.flatMap((c, i) => [i ? "   " : "", i === e.hl ? <b key={c} className="tab-hl">{c}</b> : c])
          : e.text || " "}
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
        <Tips tips={e.tips} title={e.title} />
      </div>
    ) : e.k === "portrait" ? (
      <PortraitView key={e.n} mode={e.mode} cfg={portraitCfg} cols={PORTRAIT_COLS[e.mode][isNarrow() ? "narrow" : "wide"]} className={`is-${e.mode}`} run={(c) => submit(c)} s={S} />
    ) : e.k === "neofetch" ? (
      <div key={e.n} className="terminal-os-fetch">
        <span className="sr-only">{S["pt.alt"]}</span>
        <PortraitView mode="braille" cfg={portraitCfg} cols={26} className="is-fetch" fetchCard s={S} />
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
    ) : e.k === "timeline" ? (
      <div key={e.n} className={`terminal-os-tl${e.wide ? " is-wide" : ""}`}>
        {e.rows.map((r, i) =>
          "head" in r ? (
            <span key={i} className="terminal-os-tl-head">
              {r.head}
            </span>
          ) : (
            <Fragment key={i}>
              <span className={`tl-year${r.dim ? " is-dim" : ""}`}>{r.year}</span>
              <span className={`tl-mon${r.dim ? " is-dim" : ""}`}>{r.mon}</span>
              <span className={`tl-subj${r.dim ? " is-dim" : ""}`}>
                <span className="tl-text">
                  {r.life ? "● " : ""}
                  {r.subject}
                </span>
                {r.tag ? <b className="tl-tag tone-accent">{e.wide ? r.tag : `  ${r.tag}`}</b> : null}
                {r.grade ? <b className="tl-grade">{e.wide ? r.grade : `  ${r.grade}`}</b> : null}
              </span>
              {e.wide ? (
                <>
                  <span className="tl-glyph" aria-hidden="true">
                    {r.glyph ?? ""}
                  </span>
                  <span className="tl-label">
                    {r.label ? <b className="tone-accent">{r.label}</b> : null}
                    {r.periodGrade ? <b className="tl-grade">{r.periodGrade}</b> : null}
                  </span>
                </>
              ) : null}
            </Fragment>
          ),
        )}
      </div>
    ) : e.k === "arch" ? (
      <ArchView key={e.n} title={e.title} lines={e.lines} edges={e.edges} notes={e.notes} />
    ) : e.k === "fit" ? (
      <div key={e.n} className="terminal-fit-card">
        <div className="terminal-fit-verdict">
          <b className={e.pct === null ? "is-dim" : "tone-accent"}>{e.verdict}</b>
        </div>
        {e.pct !== null ? <div className="terminal-fit-meter" aria-hidden="true"><i style={{ width: `${e.pct}%` }} /></div> : null}
        {e.matched.length ? (
          <div className="terminal-fit-row">
            <span className="terminal-fit-label">{e.labels.matched}</span>
            {e.matched.map((m) => (
              <span key={m} className="terminal-fit-chip is-ok">{m}</span>
            ))}
          </div>
        ) : null}
        {e.adjacent.length ? (
          <div className="terminal-fit-row">
            <span className="terminal-fit-label">{e.labels.adjacent}</span>
            {e.adjacent.map((m) => (
              <span key={m.want} className="terminal-fit-chip is-adj">{m.have ? `${m.want} → ${m.have}` : m.want}</span>
            ))}
          </div>
        ) : null}
        {e.notYet.length ? (
          <div className="terminal-fit-row">
            <span className="terminal-fit-label">{e.labels.notYet}</span>
            {e.notYet.map((m) => (
              <span key={m} className="terminal-fit-chip is-not">{m}</span>
            ))}
          </div>
        ) : null}
      </div>
    ) : e.k === "qr" ? (
      // Glyphs are 0.6em wide and 1em tall, two modules per row: stretch rows 1.2x so modules are square.
      <div key={e.n}>
        <span className="sr-only">{S["qr.alt"]}</span>
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
    ) : e.k === "heatmap" ? (
      <Heatmap key={e.n} weeks={e.weeks} months={e.months} narrow={e.narrow} />
    ) : e.k === "langbar" ? (
      <LangBar key={e.n} langs={e.langs} width={e.width} />
    ) : e.k === "more" ? (
      <button key={e.n} type="button" className="terminal-root-more" onMouseDown={keepFocus} onClick={nextPage}>
        {S.more}
      </button>
    ) : e.k === "links" ? (
      <span key={e.n} className={`is-out${e.dim ? " is-dim" : ""}${e.lead ? " terminal-os-rowgo" : ""}`}>
        {e.lead ? <span className="rg-l">{e.lead}</span> : null}
        <span className={e.lead ? "rg-r" : undefined}>
          {e.prefix}
          {/* The share sheet exists on phones; elsewhere only the copy token is shown. */}
          {e.items.filter((l) => l.act !== "share" || "share" in navigator).map((l, i) => (
            <Fragment key={l.label}>
              {i ? " · " : ""}
              {l.act ? (
                <span aria-live="polite" style={{ display: "inline" }}>
                  <button type="button" className="terminal-root-link" onMouseDown={keepFocus} onClick={() => shareAct(e.n, l)}>
                    {l.act === "copy" && copied === e.n ? S["share.copied"] : l.label}
                  </button>
                </span>
              ) : l.cmd ? (
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
          {e.suffix}
        </span>
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
      className={`terminal-root ${via === "hub" ? "is-via-hub" : "is-direct"} ${via === "normal" ? "is-via-normal" : ""} ${arriving ? "is-arriving" : ""} ${opening ? "is-opening" : ""} ${os ? "is-os" : ""} ${crt ? "has-crt" : ""} ${saver !== "off" ? "is-saver" : ""}`}
      style={{ "--persona-c": color } as CSSProperties}
      data-theme={theme}
      role="region"
      aria-label={S["root.aria"]}
      lang={lang}
      data-lang={lang}
    >
      <style>{THEME_CSS}</style>
      {saver !== "off" ? (
        <TerminalSaver
          cfg={portraitCfg}
          narrow={isNarrow()}
          leaving={saver === "leaving"}
          reduce={typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches}
          line={S["saver.line"](stats ? stats.total : null)}
        />
      ) : null}
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
          <span className="sr-only">{S["root.sr"]}</span>
          <div role="log" aria-live="polite" aria-relevant="additions">
            {via === "normal" && !hydrated ? renderEntry(toEntries(shell.banner(lang))[0]) : null}
            {entries.map(renderEntry)}
          </div>
          {palette ? (
            <ul ref={palList} role="listbox" aria-label={S["pal.aria"]} className="terminal-root-palette">
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
                <li className="terminal-root-palette-none is-out">{S["pal.none"]}</li>
              )}
            </ul>
          ) : null}
          {os && fitOpen ? (
            <div className="terminal-fit-box">
              <label htmlFor="fit-paste" className="terminal-fit-hint">
                {S["fitbox.hint"]}
              </label>
              <textarea
                id="fit-paste"
                ref={fitArea}
                className="terminal-fit-area"
                value={fitText}
                maxLength={8192}
                rows={8}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder={S["fitbox.ph"]}
                onChange={(e) => setFitText(e.target.value.slice(0, 8192))}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    closeFit();
                  } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    runFit();
                  }
                }}
              />
              <div className="terminal-fit-actions">
                <button type="button" className="terminal-fit-go" onClick={runFit}>
                  {S["fitbox.go"]}
                </button>
                <button type="button" className="terminal-fit-cancel" onClick={closeFit}>
                  {S["fitbox.cancel"]}
                </button>
                <span className="terminal-fit-count">{`${fitText.length.toLocaleString("en-US")} / 8,192`}</span>
              </div>
            </div>
          ) : null}
          {os && !fitOpen && (partial !== null || ready) ? (
            <span className="terminal-root-prompt is-cmd">
              {paging ? null : (
                <code className="terminal-root-typed" aria-hidden="true">
                  {mailStep ? <code className="ps-user">{S[`mail.${mailStep}` as const]}</code> : ps1(shortPath(cwd))}
                  {partial !== null ? (
                    <>
                      {partial}
                      <i className="hub-enter-caret" />
                    </>
                  ) : (
                    <>
                      {cmd.slice(0, Math.min(caret, cmd.length))}
                      <i className={`hub-enter-caret${bell ? " terminal-os-bell" : ""}`} />
                      {cmd.slice(Math.min(caret, cmd.length))}
                      {ghost ? <span className="terminal-ghost">{ghost}</span> : null}
                    </>
                  )}
                </code>
              )}
              <input
                ref={input}
                className="terminal-root-input"
                value={cmd}
                disabled={!ready}
                aria-label={S["input.aria"]}
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
                  endCycle();
                }}
                onKeyDown={onInputKey}
                onKeyUp={syncCaret}
                onSelect={syncCaret}
                onClick={(e) => {
                  endCycle();
                  syncCaret(e);
                }}
              />
            </span>
          ) : null}
        </div>
        <aside className="terminal-os-pane" aria-label={S["pane.aria"]}>
          <h3>{S["pane.where"]}</h3>
          <p className="terminal-os-pane-where">{shortPath(cwd)}</p>
          <h3>{S["pane.who"]}</h3>
          <p className="terminal-os-pane-name">{data.resume.name.toLowerCase()}</p>
          <p>{S["pane.role"](data.i18n?.[lang as "bn" | "hi"]?.role ?? (data.resume.title.split(" · ")[0] ?? "").toLowerCase(), data.i18n?.[lang as "bn" | "hi"]?.city ?? data.resume.location.split(",")[0].toLowerCase())}</p>
          <p className="terminal-os-pane-status">
            <i aria-hidden="true" />
            {data.i18n?.[lang as "bn" | "hi"]?.status ?? data.status}
          </p>
          {data.now?.lines[0] ? <p className="terminal-os-pane-now">{S["pane.now"](data.i18n?.[lang as "bn" | "hi"]?.now[0] ?? data.now.lines[0])}</p> : null}
          <div className="terminal-os-pane-actions">
            {["hire", "resume --pdf", "mail"].map((c) => (
              <button key={c} type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={() => !mailBlocks() && submit(c)}>
                {c}
              </button>
            ))}
          </div>
          <h3>{S["pane.contents"]}</h3>
          <p className="terminal-os-pane-seen">{seen === contents.length ? S["pane.allseen"] : S["pane.seen"](seen, contents.length)}</p>
          <div className="terminal-os-pane-meter" role="progressbar" aria-label={S["pane.meter"]} aria-valuemin={0} aria-valuemax={contents.length} aria-valuenow={seen}>
            <i style={{ width: `${contents.length ? (seen / contents.length) * 100 : 0}%` }} />
          </div>
          <ul role="list" className="terminal-os-contents">
            {contents.map((r) => (
              <li key={r.id}>
                <button type="button" tabIndex={-1} className={`terminal-os-content-row ${checks[r.id] ? "is-done" : ""}`} onMouseDown={keepFocus} onClick={() => !mailBlocks() && submit(r.cmd)}>
                  <b>{checks[r.id] ? "✓" : " "}</b>
                  <span>{r.label}</span>
                  <i>{r.note}</i>
                </button>
              </li>
            ))}
          </ul>
          <h3>{S["pane.next"]}</h3>
          <button type="button" tabIndex={-1} className="terminal-os-pane-next" onMouseDown={keepFocus} onClick={() => submit(hintCmd)}>
            {nextTry ? S["pane.try"](hintCmd) : S["pane.alldone"]}
          </button>
          {gh !== null || visitors >= 2 || down ? (
            <>
              <h3>{S["pane.live"]}</h3>
              {down ? <p className="terminal-os-pane-live is-dim">{S["pane.offline"]}</p> : null}
              {gh !== null && !(down && gh === undefined) ? <p className="terminal-os-pane-live">{gh === undefined ? S["pane.gh.wait"] : S["pane.gh.push"](gh.repos[0] ? ago(S, Date.now() - Date.parse(gh.repos[0].pushed_at)) : S["ago.unknown"])}</p> : null}
              {gh ? <p className="terminal-os-pane-live">{S["pane.repos"](Number(gh.user.public_repos) || 0)}</p> : null}
              {stats ? <p className="terminal-os-pane-live">{S["pane.contrib"](stats.total, stats.streak.current)}</p> : null}
              {visitors >= 2 ? <p className="terminal-os-pane-live">{S["pane.visitors"](visitors)}</p> : null}
            </>
          ) : null}
          <h3>{S["pane.keys"]}</h3>
          <p className="terminal-os-keys">{S["pane.keysline"]}</p>
        </aside>
        </div>
        <div className="terminal-os-status">
          <span className="terminal-os-status-lw">
            <code className="terminal-os-status-l">{`${USER}@code  ${shortPath(cwd)}`}</code>
            <button type="button" tabIndex={-1} className="terminal-os-status-work" onMouseDown={keepFocus} onClick={() => !mailBlocks() && submit("hire")}>
              <i aria-hidden="true" />
              {S["st.work"]}
            </button>
            {swUpdate ? (
              <button type="button" tabIndex={-1} className="terminal-os-status-net is-update" onMouseDown={keepFocus} onClick={() => window.location.reload()}>
                {S["st.update"]}
              </button>
            ) : down ? (
              <span className="terminal-os-status-net is-off" role="status">
                {S["st.offline"]}
              </span>
            ) : null}
          </span>
          <code className="terminal-os-status-m is-counts">
            {[data.projects.length ? S["unit.project"](data.projects.length) : "", data.posts.length ? S["unit.post"](data.posts.length) : "", data.views.length ? S["unit.view"](data.views.length) : ""].filter(Boolean).join(" · ")}
          </code>
          {visitors >= 2 ? (
            <code className="terminal-os-status-here" aria-live="polite">{S["st.here"](visitors)}</code>
          ) : null}
          {nextTry ? (
            <button type="button" tabIndex={-1} className="terminal-os-status-hint" onMouseDown={keepFocus} onClick={() => submit(hintCmd)}>
              {S["pane.try"](hintCmd)}
            </button>
          ) : null}
          <span className="terminal-os-status-r">
            <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={() => !mailBlocks() && submit("help")}>
              help
            </button>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={keepFocus}
              onClick={() => {
                setCmd("/");
                setPalSel(0);
                input.current?.focus({ preventScroll: true });
              }}
            >
              /
            </button>
            <button type="button" tabIndex={-1} className="is-pane-btn" onMouseDown={keepFocus} onClick={togglePane}>
              pane
            </button>
            <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={() => act.current.esc()}>
              Esc
            </button>
          </span>
        </div>
        <div className="terminal-root-chips" aria-label={S["chips.aria"]}>
          <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={typeChip(() => submit("help"))}>
            help
          </button>
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={keepFocus}
            onClick={typeChip(() => {
              setCmd("/");
              setPalSel(0);
              input.current?.focus({ preventScroll: true });
            })}
          >
            /
          </button>
          <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={typeChip(() => submit("portfolio"))}>
            portfolio
          </button>
          <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={typeChip(() => submit("views"))}>
            views
          </button>
          <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={typeChip(() => chipKey("tab"))}>
            Tab
          </button>
          <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={() => chipKey("up")} aria-label={S["chip.up"]}>
            ↑
          </button>
          <button type="button" tabIndex={-1} onMouseDown={keepFocus} onClick={() => chipKey("esc")}>
            Esc
          </button>
        </div>
      </div>
    </div>
  );
}
