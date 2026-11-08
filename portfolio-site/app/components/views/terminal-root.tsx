"use client";

/**
 * The Engineer page's root: a terminal. Boots, lists the views, waits. A remembered pick opens
 * after a beat. `exit` returns to the hub (17-persona-views.md).
 */
import gsap from "gsap";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { terminalScript } from "@/app/components/hub/exit-sequence";
import type { LaunchedPersona, PersonaView } from "@/lib/content/types";
import { ambient } from "@/lib/site/ambient-sound";
import { DISPLAY_ROOT, personaIdentity } from "@/lib/site/brand";
import { hubHref, personaHref, useOrigin } from "@/lib/site/persona-link";
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
};

type Entry = { k: "line"; text: string; prompt: boolean } | { k: "picker" };
type Dest = { href: string; crossOrigin: boolean };

const HOST = `${personaIdentity("engineer").subdomain}.${DISPLAY_ROOT}`;
// Client-side Back/Forward (popstate) is not a new navigation entry, so note when one just happened.
let lastPop = -1e9;
if (typeof window !== "undefined") window.addEventListener("popstate", () => (lastPop = performance.now()));

const HELP = "commands: open <id> · <id> · <number> · ls · exit · help";

export function TerminalRoot({ persona, color, via, items, views }: TerminalRootProps) {
  const router = useRouter();
  const origin = useOrigin();
  const win = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLPreElement>(null);
  const [booting, setBooting] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [partial, setPartial] = useState<string | null>("");
  const [cmd, setCmd] = useState("");
  const [sel, setSel] = useState(0);
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);

  // Latest values for the long-lived async run and the key listener.
  const live = useRef({ cmd, sel, ready, busy: false, aborted: false, auto: false, cancelAuto: false });
  const rows = useRef<Array<HTMLButtonElement | null>>([]);
  const act = useRef<{ open: (id: string, typeIt: boolean, auto?: boolean) => void; exit: (typeIt: boolean) => void; run: (c: string) => void }>({
    open: () => {},
    exit: () => {},
    run: () => {},
  });
  const cancelled = useRef(false);
  const timers = useRef<number[]>([]);
  const wait = (ms: number) => new Promise<void>((r) => timers.current.push(window.setTimeout(r, ms)));

  useEffect(() => {
    live.current.cmd = cmd;
    live.current.sel = sel;
    live.current.ready = ready;
  });

  const push = (e: Entry) => setEntries((l) => [...(e.k === "picker" ? l.filter((x) => x.k !== "picker") : l), e]);
  const line = (text: string, prompt = false) => push({ k: "line", text, prompt });

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
    line(text, true);
    return true;
  };

  /** Back to the waiting picker (Back from a bfcache page, or a cancelled auto-open). */
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
    showPicker();
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
    if (dest.crossOrigin) window.location.assign(dest.href);
    else router.push(dest.href);
    return true;
  };

  const showPicker = () => {
    if (!views.length) return line("no views yet");
    setSel(0);
    push({ k: "picker" });
  };

  act.current.open = async (id, typeIt, auto = false) => {
    if (live.current.busy) return;
    live.current.busy = true;
    live.current.aborted = true;
    live.current.auto = auto;
    live.current.ready = false;
    setReady(false);
    if (typeIt && !(await type(`open ${id}`, 12, false, true))) {
      if (live.current.cancelAuto && !cancelled.current) restore();
      return;
    }
    await go(personaHref(origin, persona, `/${id}`));
  };
  act.current.exit = async (typeIt) => {
    if (live.current.busy) return;
    live.current.busy = true;
    live.current.aborted = true;
    live.current.ready = false;
    setReady(false);
    if (typeIt && !(await type("exit", 12, false, true))) return;
    await go(hubHref(origin));
  };
  act.current.run = (raw) => {
    const c = raw.trim();
    if (!c) return;
    const low = c.toLowerCase();
    setCmd("");
    line(c, true);
    if (low === "exit" || low === "cd ..") return void act.current.exit(false);
    if (low === "ls" || low === "ls views" || low === "ls views/") return showPicker();
    if (low === "help") return line(HELP);
    const arg = low.startsWith("open ") ? low.slice(5).trim() : low;
    const byId = views.find((v) => v.id.toLowerCase() === arg);
    const byNum = /^\d+$/.test(arg) ? views[Number(arg) - 1] : undefined;
    const v = byId ?? byNum;
    if (v) return void act.current.open(v.id, false);
    line(`command not found: ${c.split(/\s+/)[0]}`);
  };

  // The script, then the picker (or the remembered pick).
  useEffect(() => {
    cancelled.current = false;
    live.current.busy = false;
    live.current.aborted = false;
    live.current.auto = false;
    live.current.cancelAuto = false;
    const ts = timers.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instant = via === "normal" || reduce;
    const fromBack = performance.now() - lastPop < 3000;
    const stopped = () => cancelled.current || live.current.aborted;
    const run = async () => {
      setEntries([]);
      setPartial("");
      await wait(via === "hub" ? 150 : 100);
      if (stopped()) return;
      setBooting(false);
      const script = terminalScript(items).slice(0, -1);
      for (const l of script) {
        if (stopped()) return;
        if (l.typed && !instant) await type(l.text, 13, false);
        else {
          if (!instant) await wait(90);
          if (stopped()) return;
          line(l.text, !!l.prompt);
        }
      }
      if (stopped()) return;
      let remembered = via === "hub" ? null : readView(persona);
      if (remembered && !views.some((v) => v.id === remembered)) {
        forgetView(persona);
        remembered = null;
      }
      try {
        // Back from a view lands here with the pick still set: show the picker instead of re-opening it.
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (nav?.type === "back_forward" || fromBack) remembered = null;
      } catch {}
      if (remembered) {
        act.current.open(remembered, true, true);
        return;
      }
      await type("ls views/", 13, instant);
      if (stopped()) return;
      showPicker();
      setReady(true);
      setPartial(null);
      if (win.current) {
        const glow = `0 0 80px -10px ${color}`;
        if (reduce) win.current.style.boxShadow = glow;
        else gsap.to(win.current, { boxShadow: glow, duration: 0.4 });
      }
    };
    void run();
    return () => {
      cancelled.current = true;
      ts.forEach((x) => window.clearTimeout(x));
      ts.length = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona, via, items, views, color]);

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
  }, [views]);

  // Keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
        return void act.current.exit(true);
      }
      if (!s.ready) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (views.length) setSel((i) => (i + (e.key === "ArrowDown" ? 1 : views.length - 1)) % views.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (s.cmd.trim()) act.current.run(s.cmd);
        else if (views[s.sel]) act.current.open(views[s.sel].id, true);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setCmd((c) => c.slice(0, -1));
      } else if (/^[1-9]$/.test(e.key) && !s.cmd && views[Number(e.key) - 1]) {
        e.preventDefault();
        setSel(Number(e.key) - 1);
        act.current.open(views[Number(e.key) - 1].id, true);
      } else if (e.key.length === 1) {
        e.preventDefault();
        ambient.key();
        setCmd((c) => (c + e.key).slice(0, 80));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [views]);

  useEffect(() => {
    if (ready) rows.current[sel]?.focus({ preventScroll: true });
  }, [sel, ready]);

  useEffect(() => {
    const b = body.current;
    if (b) b.scrollTop = b.scrollHeight;
  }, [entries, partial, cmd]);

  return (
    <div
      className={`terminal-root ${via === "hub" ? "is-via-hub" : "is-direct"} ${opening ? "is-opening" : ""}`}
      style={{ "--c": color } as CSSProperties}
      role="region"
      aria-label="Engineer terminal"
    >
      <div className="terminal-root-frame">
        <div ref={win} className={`hub-exit hub-exit-term terminal-root-win ${booting ? "is-boot" : ""}`}>
          <div className="hub-exit-bar">
            <span /> <span /> <span />
            <b>ratul@{HOST} — zsh</b>
          </div>
          <pre ref={body} className="hub-exit-body terminal-root-body" aria-live="polite">
            <span className="sr-only">Arrow keys and Enter choose a view. Esc or `exit` returns to the hub.</span>
            {entries.map((e, i) =>
              e.k === "line" ? (
                <span key={i} className={e.prompt ? "is-cmd" : "is-out"}>
                  {e.prompt ? "$ " : ""}
                  {e.text}
                </span>
              ) : (
                <ul key={i} role="list" className="terminal-root-picker">
                  {views.map((v, n) => (
                    <li key={v.id}>
                      <button
                        ref={(el) => {
                          rows.current[n] = el;
                        }}
                        type="button"
                        tabIndex={n === sel ? 0 : -1}
                        className={`terminal-root-row ${n === sel ? "is-sel" : ""}`}
                        onMouseEnter={() => setSel(n)}
                        onClick={() => act.current.open(v.id, true)}
                      >
                        <em>{n === sel ? "▸" : " "}</em>
                        <b className="is-cmd">{v.id}</b>
                        <i className="is-out">{v.line}</i>
                      </button>
                    </li>
                  ))}
                </ul>
              ),
            )}
            {partial !== null ? (
              <span className="is-cmd">
                $ {partial}
                <i className="hub-enter-caret" />
              </span>
            ) : ready ? (
              <span className="is-cmd">
                $ {cmd}
                <i className="hub-enter-caret" />
              </span>
            ) : null}
          </pre>
        </div>
      </div>
    </div>
  );
}
