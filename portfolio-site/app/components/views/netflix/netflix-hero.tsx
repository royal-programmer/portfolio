"use client";

/**
 * The billboard hero (17-persona-views.md §7): key art made from the generated portrait, the title, the
 * tagline, the facts, Play (the trailer: a typed pitch), More info and View résumé. After three idle seconds
 * the trailer plays by itself, silent, with a Skip pill.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Episode, NetflixShow, NetflixProfileId } from "@/lib/site/netflix-data";
import { tick as tickSound } from "./netflix-sound";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Props = {
  series: NetflixShow;
  profile: NetflixProfileId;
  status: string;
  /** The portrait as text (drawn once by the view), or "" while it draws. */
  text: string;
  fast: boolean;
  onMore?: () => void;
  sound: { on: boolean; toggle: () => void };
  /** Where Play / skip lands: the first row's id. */
  firstRowId?: string;
  /** A season recap to type in the trailer panel instead of the profile trailer (N4). */
  recap?: { key: number; lines: string[] } | null;
  onRecapEnd?: () => void;
};

/** The pitch, built from the hero facts, the two newest main-branch episodes and the status line. */
function trailerLines(series: NetflixShow, status: string): string[] {
  const main: Episode[] = series.rows.flatMap((r) => (r.kind === "episodes" ? r.items : [])).filter((e) => e.branch === "main").sort((a, b) => (a.date < b.date ? 1 : -1));
  const lines = [`$ ${series.title.toLowerCase().replace(/\s+/g, "-")} --trailer`, `${series.title}. ${series.tagline}.`];
  for (const f of series.hero.facts.filter((f) => !f.toLowerCase().startsWith("open"))) lines.push(f);
  if (main[0]) lines.push(`Latest episode: ${main[0].title}.`);
  if (main[1]) lines.push(`Before that: ${main[1].title}.`);
  lines.push(`Status: ${status}.`);
  lines.push("Next episode: your team?");
  return lines.slice(0, 8);
}

export function NetflixHero({ series, profile, status, text, fast, firstRowId, onMore, sound, recap, onRecapEnd }: Props) {
  const [playing, setPlaying] = useState(false);
  const [auto, setAuto] = useState(false);
  const autoDone = useRef(false);
  const playRef = useRef<HTMLButtonElement>(null);

  // Three idle seconds on the top of the page: the trailer plays itself (once, silent, not under reduced motion).
  useEffect(() => {
    if (fast || reducedMotion()) return;
    let t = 0;
    const arm = () => {
      window.clearTimeout(t);
      if (autoDone.current) return;
      t = window.setTimeout(() => {
        if (autoDone.current || window.scrollY > 80 || document.querySelector('[aria-modal="true"]')) return;
        autoDone.current = true;
        setAuto(true);
        setPlaying(true);
      }, 3000);
    };
    arm();
    const evs = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    evs.forEach((e) => window.addEventListener(e, arm, { passive: true }));
    return () => {
      window.clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [fast]);

  const open = status.toLowerCase().startsWith("open");

  const end = useCallback(
    (scroll: boolean, focus = true) => {
      setPlaying(false);
      if (recap) return onRecapEnd?.();
      if (!scroll) return focus ? playRef.current?.focus() : undefined;
      const el = firstRowId ? document.getElementById(`nf-row-${firstRowId}`) : null;
      el?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    },
    [firstRowId, recap, onRecapEnd],
  );

  return (
    <header className="nf-hero" data-playing={playing || !!recap || undefined}>
      <div className="nf-art" aria-hidden>
        {text ? <pre className="nf-art-pre">{text}</pre> : <span className="nf-shimmer" />}
      </div>
      <div className="nf-hero-shade" aria-hidden />

      <div className="nf-hero-copy">
        <p className="nf-kicker">{series.hero.kicker}</p>
        <h1 className="nf-title">{series.hero.title}</h1>
        <p className="nf-tagline">{series.tagline}</p>
        <p className="nf-blurb">{series.hero.blurb}</p>
        <ul className="nf-facts">
          {series.hero.facts.map((f) => (
            <li key={f} className="nf-fact">
              {f}
            </li>
          ))}
        </ul>
        {open ? (
          <p className="nf-open">
            <span className="nf-dot" aria-hidden /> open to work
          </p>
        ) : null}
        <div className="nf-actions">
          <button
            ref={playRef}
            type="button"
            className="nf-btn nf-btn-play"
            onClick={() => {
              onRecapEnd?.();
              setAuto(false);
              autoDone.current = true;
              setPlaying(true);
            }}
          >
            <span aria-hidden>▶</span> Play
          </button>
          {onMore ? (
            <button type="button" className="nf-btn nf-btn-glass" onClick={onMore}>
              <span aria-hidden>ⓘ</span> More info
            </button>
          ) : null}
          <a className="nf-btn nf-btn-glass" href="/Ratul_Roy_Resume.pdf" target="_blank" rel="noreferrer">
            View résumé
          </a>
          <button type="button" className="nf-round nf-vol" aria-label={sound.on ? "Mute" : "Unmute"} aria-pressed={sound.on} onClick={sound.toggle}>
            <span aria-hidden>{sound.on ? "🔊" : "🔇"}</span>
          </button>
        </div>
      </div>

      {playing || recap ? (
        <Trailer
          lines={recap ? recap.lines : trailerLines(series, status)}
          ms={recap ? 20_000 : 14_000}
          fast={fast || reducedMotion()}
          auto={auto && !recap}
          onEnd={end}
          sound={sound}
          key={recap ? `recap-${recap.key}` : profile}
        />
      ) : null}
    </header>
  );
}

function Trailer({ lines, ms, fast, auto, onEnd, sound }: { lines: string[]; ms: number; fast: boolean; auto: boolean; onEnd: (scroll: boolean, focus?: boolean) => void; sound: { on: boolean; toggle: () => void } }) {
  const soundOn = useRef(sound.on);
  useEffect(() => {
    soundOn.current = sound.on;
  });
  const total = useMemo(() => lines.reduce((n, l) => n + l.length + 1, 0), [lines]);
  const [chars, setChars] = useState(fast ? total : 0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!auto) root.current?.focus({ preventScroll: true });
    if (fast) {
      const t = window.setTimeout(() => onEnd(!auto, !auto), 2000);
      return () => window.clearTimeout(t);
    }
    // `ms` for the whole pitch (14 s; 20 s for a season recap), with a short hold at the end. A soft tick per few characters when unmuted.
    const per = ms / total;
    const t0 = performance.now();
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const c = Math.min(total, Math.floor((now - t0) / per));
      if (soundOn.current && c - last >= 4) {
        last = c;
        tickSound();
      }
      setChars(c);
      if (c >= total) {
        window.setTimeout(() => onEnd(!auto, !auto), 900);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fast, total, auto, onEnd, ms]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onEnd(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEnd]);

  const shown = lines.map((l, i) => {
    const before = lines.slice(0, i).reduce((n, x) => n + x.length + 1, 0);
    const take = Math.max(0, Math.min(l.length, chars - before));
    return { text: l.slice(0, take), done: take >= l.length };
  });

  return (
    <div ref={root} className="nf-trailer" role="dialog" aria-modal="false" aria-label="Trailer" tabIndex={-1} onClick={() => onEnd(!auto, !auto)}>
      <div className="nf-tele" aria-live="off">
        {shown.map((s, i) => (
          <p key={i} className="nf-tele-line" hidden={!s.text && i > 0 && !shown[i - 1].done}>
            {s.text}
            {!s.done && s.text ? <span className="nf-caret">▌</span> : null}
          </p>
        ))}
      </div>
      <div className="nf-trailer-foot">
        <div className="nf-progress" aria-hidden>
          <span style={{ width: `${Math.round((chars / total) * 100)}%` }} />
        </div>
        <button
          type="button"
          className="nf-round nf-round-s nf-trailer-vol"
          aria-label={sound.on ? "Mute" : "Unmute"}
          aria-pressed={sound.on}
          onClick={(e) => {
            e.stopPropagation();
            sound.toggle();
          }}
        >
          <span aria-hidden>{sound.on ? "🔊" : "🔇"}</span>
        </button>
        <button
          type="button"
          className="nf-skip"
          onClick={(e) => {
            e.stopPropagation();
            onEnd(!auto, !auto);
          }}
          aria-label="Skip trailer"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
