"use client";

/**
 * Through the doorway (D38 round C feedback): each world has its own short
 * sequence between the click and the page. It runs over the darkened scene,
 * sized like a window (≈70 % of the view), and the page leaves the moment it
 * ends — no timer, no waiting. A click or a key skips it; reduced motion skips
 * it too.
 *
 *   engineer      a terminal: lines typed character by character, with key clicks
 *   trader        a trading screen assembles, candles draw, price runs into the target
 *   photographer  the camera's display: grid, focus hunts and locks, settings settle, shutter
 *   others        a small breathing light
 */
import gsap from "gsap";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ambient } from "@/lib/site/ambient-sound";
import { DISPLAY_ROOT, personaIdentity } from "@/lib/site/brand";
import { spectrumColor } from "@/lib/site/spectrum";
import type { PersonaSlug } from "@/lib/content/types";
import type { World } from "./vr/state";

type Props = {
  world: World;
  /** Published project slugs for the terminal's `ls`. */
  items: string[];
  /** Called once, when the sequence has ended or was skipped: the page leaves. */
  onDone: () => void;
};

function useOnce(onDone: () => void) {
  const fired = useRef(false);
  return useMemo(
    () => () => {
      if (fired.current) return;
      fired.current = true;
      onDone();
    },
    [onDone],
  );
}

/** Skip on any click / key; honour reduced motion. */
function useSkip(done: () => void) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(done, 250);
      return () => window.clearTimeout(id);
    }
    const skip = () => done();
    // A beat later, so the click that opened the doorway does not also skip it.
    const id = window.setTimeout(() => {
      window.addEventListener("pointerdown", skip);
      window.addEventListener("keydown", skip);
    }, 400);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [done]);
}

export function ExitSequence(props: Props) {
  const slug = props.world.slug as PersonaSlug;
  if (slug === "engineer") return <TerminalExit {...props} />;
  if (slug === "trader") return <TraderExit {...props} />;
  if (slug === "photographer") return <PhotoExit {...props} />;
  return <LightExit {...props} />;
}

// ---------------------------------------------------------------------------
// Light: a small breathing point (artist, ride, gamer — their sequences come with their worlds)
// ---------------------------------------------------------------------------
function LightExit({ world, onDone }: Props) {
  const done = useOnce(onDone);
  useSkip(done);
  useEffect(() => {
    const id = window.setTimeout(done, 900);
    return () => window.clearTimeout(id);
  }, [done]);
  return (
    <span
      className="hub-enter-light"
      style={{ "--c": spectrumColor(world.t) } as CSSProperties}
    />
  );
}

// ---------------------------------------------------------------------------
// Terminal
// ---------------------------------------------------------------------------
type Line = { text: string; typed: boolean; prompt?: boolean };

function TerminalExit({ world, items, onDone }: Props) {
  const done = useOnce(onDone);
  useSkip(done);
  const [lines, setLines] = useState<Line[]>([]);
  const [partial, setPartial] = useState<string | null>(null);
  const host = `${personaIdentity("engineer").subdomain}.${DISPLAY_ROOT}`;
  const script = useMemo<Line[]>(() => {
    const out: Line[] = [
      { text: `ssh ratul@${host}`, typed: true, prompt: true },
      { text: "resolving host … ok", typed: false },
      { text: "authenticating … ok", typed: false },
    ];
    if (items.length) {
      out.push({ text: "cd /engineer && ls", typed: true, prompt: true });
      out.push({ text: items.join("   "), typed: false });
    }
    out.push({
      text: `open ${personaIdentity("engineer").handle ?? "engineer"}`,
      typed: true,
      prompt: true,
    });
    return out;
  }, [host, items]);

  useEffect(() => {
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((r) => timers.push(window.setTimeout(r, ms)));
    const run = async () => {
      await wait(120);
      for (const line of script) {
        if (cancelled) return;
        if (line.typed) {
          for (let i = 1; i <= line.text.length; i++) {
            if (cancelled) return;
            setPartial(line.text.slice(0, i));
            ambient.key();
            await wait(16 + Math.random() * 22);
          }
          await wait(110);
        } else {
          await wait(120);
        }
        setPartial(null);
        setLines((l) => [...l, line]);
      }
      await wait(180);
      if (!cancelled) done();
    };
    void run();
    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [script, done]);

  const c = spectrumColor(world.t);
  return (
    <div
      className="hub-exit hub-exit-term"
      style={{ "--c": c } as CSSProperties}
      role="presentation"
    >
      <div className="hub-exit-bar">
        <span /> <span /> <span />
        <b>ratul@{host} — zsh</b>
      </div>
      <pre className="hub-exit-body">
        {lines.map((l, i) => (
          <span key={i} className={l.prompt ? "is-cmd" : "is-out"}>
            {l.prompt ? "$ " : ""}
            {l.text}
          </span>
        ))}
        <span className="is-cmd">
          $ {partial ?? ""}
          <i className="hub-enter-caret" />
        </span>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trader: the screen assembles, candles draw, price runs into the target
// ---------------------------------------------------------------------------
const CANDLES = 34;

function TraderExit({ world, onDone }: Props) {
  const done = useOnce(onDone);
  useSkip(done);
  const root = useRef<HTMLDivElement>(null);
  const c = spectrumColor(world.t);
  // A random walk with a drift up, then the run into the target.
  const data = useMemo(() => {
    let a = 7;
    const rnd = () => (a = (a * 9301 + 49297) % 233280) / 233280;
    let v = 46;
    const rows: Array<{ o: number; c: number; h: number; l: number }> = [];
    for (let i = 0; i < CANDLES; i++) {
      const o = v;
      v = Math.min(78, Math.max(22, v + (rnd() - 0.46) * 7));
      rows.push({
        o,
        c: v,
        h: Math.max(o, v) + rnd() * 2.5,
        l: Math.min(o, v) - rnd() * 2.5,
      });
    }
    const entry = rows[CANDLES - 1].c;
    const stop = entry - 9;
    const target = entry + 27;
    return { rows, entry, stop, target };
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    // gsap.context + revert: the dev double-mount must not leave `from` tweens parked at 0.
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => done() });
      tl.fromTo(
        el,
        { opacity: 0, scale: 0.97 },
        { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" },
      );
      tl.from(
        el.querySelectorAll("[data-hd]"),
        { opacity: 0, y: -6, duration: 0.25, stagger: 0.05 },
        "<0.05",
      );
      tl.from(
        el.querySelectorAll("[data-row]"),
        { opacity: 0, x: -8, duration: 0.25, stagger: 0.04 },
        "<0.1",
      );
      tl.from(
        el.querySelectorAll("[data-grid]"),
        { scaleX: 0, transformOrigin: "left", duration: 0.3, stagger: 0.02 },
        "<0.05",
      );
      tl.from(
        el.querySelectorAll("[data-candle]"),
        {
          scaleY: 0,
          transformOrigin: "center",
          opacity: 0,
          duration: 0.18,
          stagger: 0.026,
        },
        "<0.1",
      );
      tl.from(
        el.querySelectorAll("[data-level]"),
        {
          opacity: 0,
          scaleX: 0,
          transformOrigin: "left",
          duration: 0.3,
          stagger: 0.08,
        },
        ">-0.1",
      );
      tl.from(
        el.querySelectorAll("[data-run]"),
        {
          scaleY: 0,
          transformOrigin: "bottom",
          opacity: 0,
          duration: 0.14,
          stagger: 0.07,
          ease: "power1.in",
        },
        ">0.05",
      );
      tl.add(() => ambient.target());
      tl.to(el.querySelector("[data-target]"), { opacity: 1, duration: 0.08 });
      tl.fromTo(
        el,
        { boxShadow: `0 0 0 0 ${c}` },
        { boxShadow: `0 0 80px -10px ${c}`, duration: 0.35 },
        "<",
      );
      tl.to({}, { duration: 0.2 });
    }, el);
    return () => ctx.revert();
  }, [done, c]);

  // Chart geometry (viewBox 1000 × 520): price 20…80 → y 480…40.
  const y = (p: number) => 480 - ((p - 20) / 60) * 440;
  const x0 = 60;
  const cw = (760 - x0) / (CANDLES + 10);
  const run = [4, 9, 15, 20, 24, 27].map((d, i) => ({
    i,
    from: data.entry + (i ? [4, 9, 15, 20, 24][i - 1] : 0),
    to: data.entry + d,
  }));

  return (
    <div
      ref={root}
      className="hub-exit hub-exit-trade"
      style={{ "--c": c } as CSSProperties}
      role="presentation"
    >
      <div className="hub-exit-bar">
        <span /> <span /> <span />
        <b data-hd>setup · 4H</b>
        <em data-hd>R : R 1 : 3</em>
        <em data-hd>risk 0.5 %</em>
      </div>
      <div className="hub-exit-trade-grid">
        <ul className="hub-exit-list">
          {["plan", "entry", "stop", "target", "size", "review"].map((r) => (
            <li key={r} data-row>
              <i /> {r}
            </li>
          ))}
        </ul>
        <svg viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden>
          {[0, 1, 2, 3, 4].map((g) => (
            <line
              key={g}
              data-grid
              x1={x0}
              x2={990}
              y1={40 + g * 110}
              y2={40 + g * 110}
              stroke="rgba(243,241,236,0.08)"
            />
          ))}
          {data.rows.map((r, i) => {
            const up = r.c >= r.o;
            const cx = x0 + cw * (i + 0.5);
            return (
              <g key={i} data-candle>
                <line
                  x1={cx}
                  x2={cx}
                  y1={y(r.h)}
                  y2={y(r.l)}
                  stroke={up ? c : "rgba(243,241,236,0.5)"}
                  strokeWidth={1.5}
                />
                <rect
                  x={cx - cw * 0.3}
                  width={cw * 0.6}
                  y={y(Math.max(r.o, r.c))}
                  height={Math.max(
                    2,
                    y(Math.min(r.o, r.c)) - y(Math.max(r.o, r.c)),
                  )}
                  fill={up ? c : "#0b0b11"}
                  stroke={up ? "none" : "rgba(243,241,236,0.5)"}
                />
              </g>
            );
          })}
          <g data-level>
            <line
              x1={x0}
              x2={990}
              y1={y(data.entry)}
              y2={y(data.entry)}
              stroke="rgba(243,241,236,0.7)"
              strokeDasharray="6 6"
            />
            <text
              x={800}
              y={y(data.entry) - 8}
              fill="rgba(243,241,236,0.7)"
              fontSize="20"
              fontFamily="var(--font-geist-mono), monospace"
            >
              entry
            </text>
          </g>
          <g data-level>
            <line
              x1={x0}
              x2={990}
              y1={y(data.stop)}
              y2={y(data.stop)}
              stroke="rgba(243,241,236,0.35)"
              strokeDasharray="6 6"
            />
            <text
              x={800}
              y={y(data.stop) + 24}
              fill="rgba(243,241,236,0.45)"
              fontSize="20"
              fontFamily="var(--font-geist-mono), monospace"
            >
              stop −1 R
            </text>
          </g>
          <g data-level>
            <line
              x1={x0}
              x2={990}
              y1={y(data.target)}
              y2={y(data.target)}
              stroke={c}
              strokeDasharray="6 6"
            />
            <text
              x={800}
              y={y(data.target) - 8}
              fill={c}
              fontSize="20"
              fontFamily="var(--font-geist-mono), monospace"
            >
              target +3 R
            </text>
          </g>
          {run.map((r) => {
            const cx = x0 + cw * (CANDLES + r.i + 0.5);
            return (
              <rect
                key={r.i}
                data-run
                x={cx - cw * 0.3}
                width={cw * 0.6}
                y={y(r.to)}
                height={Math.max(2, y(r.from) - y(r.to))}
                fill={c}
              />
            );
          })}
          <text
            data-target
            x={x0 + cw * (CANDLES - 6)}
            y={y(data.target) - 16}
            fill="#f3f1ec"
            fontSize="26"
            fontFamily="var(--font-geist-mono), monospace"
            opacity={0}
          >
            ✓ target
          </text>
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Photographer: the display — grid, focus hunts and locks, settings settle, shutter
// ---------------------------------------------------------------------------
function PhotoExit({ world, onDone }: Props) {
  const done = useOnce(onDone);
  useSkip(done);
  const root = useRef<HTMLDivElement>(null);
  const c = spectrumColor(world.t);
  const [set, setSet] = useState({ iso: 100, f: 1.8, s: 60 });
  const [locked, setLocked] = useState(false);
  const [black, setBlack] = useState(false);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const box = el.querySelector("[data-focus]");
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ onComplete: () => done() });
      tl.fromTo(
        el,
        { opacity: 0, scale: 0.97 },
        { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" },
      );
      tl.from(
        el.querySelectorAll("[data-grid]"),
        { opacity: 0, duration: 0.3, stagger: 0.03 },
        "<0.05",
      );
      // Focus hunts: wide, narrower, overshoots, locks.
      tl.fromTo(
        box,
        { scale: 1.9, opacity: 0.5 },
        { scale: 1.25, opacity: 0.9, duration: 0.28, ease: "power2.out" },
        "<0.1",
      );
      tl.to(box, { scale: 0.92, duration: 0.2, ease: "power1.inOut" });
      tl.to(box, { scale: 1, duration: 0.14, ease: "power2.out" });
      // Settings settle while it hunts.
      const s = { iso: 100, f: 1.8, sh: 60 };
      tl.to(
        s,
        {
          iso: 400,
          f: 2.8,
          sh: 250,
          duration: 0.7,
          ease: "power1.inOut",
          onUpdate: () =>
            setSet({
              iso: Math.round(s.iso / 50) * 50,
              f: Math.round(s.f * 10) / 10,
              s: Math.round(s.sh / 10) * 10,
            }),
        },
        "<-0.5",
      );
      tl.add(() => {
        setLocked(true);
        ambient.lock();
      });
      tl.to({}, { duration: 0.32 });
      tl.add(() => {
        ambient.shutter();
        setBlack(true);
      });
      tl.to({}, { duration: 0.13 });
      tl.add(() => setBlack(false));
      tl.fromTo(
        el.querySelector("[data-frame]"),
        { opacity: 0.9 },
        { opacity: 0, duration: 0.35 },
      );
    }, el);
    return () => ctx.revert();
  }, [done]);

  return (
    <div
      ref={root}
      className="hub-exit hub-exit-photo"
      style={{ "--c": c } as CSSProperties}
      role="presentation"
    >
      <div className="hub-exit-vf">
        {[1, 2].map((i) => (
          <i
            key={`v${i}`}
            data-grid
            className="vf-v"
            style={{ left: `${(100 * i) / 3}%` }}
          />
        ))}
        {[1, 2].map((i) => (
          <i
            key={`h${i}`}
            data-grid
            className="vf-h"
            style={{ top: `${(100 * i) / 3}%` }}
          />
        ))}
        <span className="vf-corner tl" />
        <span className="vf-corner tr" />
        <span className="vf-corner bl" />
        <span className="vf-corner br" />
        <span data-focus className={`vf-focus ${locked ? "is-locked" : ""}`} />
        <p className="vf-top">RAW · 35mm</p>
        <p className="vf-read">
          <span>ISO {set.iso}</span>
          <span>1/{set.s}</span>
          <span>f/{set.f.toFixed(1)}</span>
          <span>−⅓</span>
        </p>
        <span className={`vf-black ${black ? "is-on" : ""}`} />
        <span data-frame className="vf-frame" />
      </div>
    </div>
  );
}
