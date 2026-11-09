"use client";

/**
 * The series hero (17-persona-views.md §7): key art made from the generated portrait, the title, the
 * tagline, the facts, Play (the trailer: a typed pitch) and View résumé.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { generatePortrait, type PortraitArt } from "@/lib/site/portrait-gen";
import type { Episode, Series, SeriesProfileId } from "@/lib/site/series-data";
import type { TerminalData } from "@/lib/site/terminal-data";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Props = {
  series: Series;
  profile: SeriesProfileId;
  status: string;
  portrait: TerminalData["portrait"];
  fast: boolean;
  /** Where Play / skip lands: the first row's id. */
  firstRowId?: string;
};

/** The pitch, built from the hero facts, the two newest main-branch episodes and the status line. */
function trailerLines(series: Series, status: string): string[] {
  const main: Episode[] = series.rows.flatMap((r) => (r.kind === "episodes" ? r.items : [])).filter((e) => e.branch === "main").sort((a, b) => (a.date < b.date ? 1 : -1));
  const lines = [`$ ${series.title.toLowerCase().replace(/\s+/g, "-")} --trailer`, `${series.title}. ${series.tagline}.`];
  for (const f of series.hero.facts.filter((f) => !f.toLowerCase().startsWith("open"))) lines.push(f);
  if (main[0]) lines.push(`Latest episode: ${main[0].title}.`);
  if (main[1]) lines.push(`Before that: ${main[1].title}.`);
  lines.push(`Status: ${status}.`);
  lines.push("Next episode: your team?");
  return lines.slice(0, 8);
}

export function SeriesHero({ series, profile, status, portrait, fast, firstRowId }: Props) {
  const [art, setArt] = useState<PortraitArt | null>(null);
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<HTMLButtonElement>(null);

  // The title is the LCP: the portrait is drawn after the page is idle.
  useEffect(() => {
    let cancelled = false;
    const run = () =>
      generatePortrait(portrait, "blocks", 160).then(
        (a) => !cancelled && setArt(a),
        () => {},
      );
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 2500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    const id = window.setTimeout(run, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [portrait]);

  const text = useMemo(() => (art ? art.lines.map((l) => l.map((r) => r.t).join("")).join("\n") : ""), [art]);
  const open = status.toLowerCase().startsWith("open");

  const end = useCallback(
    (scroll: boolean) => {
      setPlaying(false);
      if (!scroll) return playRef.current?.focus();
      const el = firstRowId ? document.getElementById(`sr-row-${firstRowId}`) : null;
      el?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    },
    [firstRowId],
  );

  return (
    <header className="sr-hero" data-playing={playing || undefined}>
      <div className="sr-art" aria-hidden>
        {text ? <pre className="sr-art-pre">{text}</pre> : null}
      </div>
      <div className="sr-hero-shade" aria-hidden />

      <div className="sr-mark" aria-hidden>
        R
      </div>

      <div className="sr-hero-copy">
        <p className="sr-kicker">{series.hero.kicker}</p>
        <h1 className="sr-title">{series.hero.title}</h1>
        <p className="sr-tagline">{series.tagline}</p>
        <p className="sr-blurb">{series.hero.blurb}</p>
        <ul className="sr-facts">
          {series.hero.facts.map((f) => (
            <li key={f} className="sr-fact">
              {f}
            </li>
          ))}
        </ul>
        {open ? (
          <p className="sr-open">
            <span className="sr-dot" aria-hidden /> open to work
          </p>
        ) : null}
        <div className="sr-actions">
          <button ref={playRef} type="button" className="sr-btn sr-btn-play" onClick={() => setPlaying(true)}>
            <span aria-hidden>▶</span> Play
          </button>
          <a className="sr-btn sr-btn-glass" href="/Ratul_Roy_Resume.pdf" target="_blank" rel="noreferrer">
            View résumé
          </a>
        </div>
      </div>

      {playing ? <Trailer lines={trailerLines(series, status)} fast={fast || reducedMotion()} onEnd={end} key={profile} /> : null}
    </header>
  );
}

function Trailer({ lines, fast, onEnd }: { lines: string[]; fast: boolean; onEnd: (scroll: boolean) => void }) {
  const total = useMemo(() => lines.reduce((n, l) => n + l.length + 1, 0), [lines]);
  const [chars, setChars] = useState(fast ? total : 0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    root.current?.focus({ preventScroll: true });
    if (fast) {
      const t = window.setTimeout(() => onEnd(true), 2000);
      return () => window.clearTimeout(t);
    }
    // ~14 s for the whole pitch, with a short hold at the end.
    const per = 14000 / total;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const c = Math.min(total, Math.floor((now - t0) / per));
      setChars(c);
      if (c >= total) {
        window.setTimeout(() => onEnd(true), 900);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fast, total, onEnd]);

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
    <div ref={root} className="sr-trailer" role="dialog" aria-modal="false" aria-label="Trailer" tabIndex={-1} onClick={() => onEnd(true)}>
      <div className="sr-tele" aria-live="off">
        {shown.map((s, i) => (
          <p key={i} className="sr-tele-line" hidden={!s.text && i > 0 && !shown[i - 1].done}>
            {s.text}
            {!s.done && s.text ? <span className="sr-caret">▌</span> : null}
          </p>
        ))}
      </div>
      <div className="sr-trailer-foot">
        <div className="sr-progress" aria-hidden>
          <span style={{ width: `${Math.round((chars / total) * 100)}%` }} />
        </div>
        <button
          type="button"
          className="sr-skip"
          onClick={(e) => {
            e.stopPropagation();
            onEnd(true);
          }}
        >
          skip
        </button>
      </div>
    </div>
  );
}
