"use client";

/**
 * Real product imagery in the Netflix view (17-persona-views.md §24, E2 and E4): the poster that replaces generated art,
 * the Screens and Clips rows of a project's modal, and Play for a project (a short reel of facts and clip posters that
 * ends on a card with Visit project and View code). Light on purpose: images are lazy with their size set, a clip is only
 * loaded after a hover or tap and only its metadata, and reduced motion shows posters only.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ProjectMedia } from "@/lib/site/netflix-data";
import type { TermLink } from "@/lib/site/terminal-data";
import { t } from "@/lib/site/terminal-strings";
import { useAdSpeech } from "./netflix-ad";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The project's poster, as the card or billboard art. A missing file hides itself and the generated art behind it shows. */
export function NfPoster({ media, eager }: { media: ProjectMedia; eager?: boolean }) {
  const [bad, setBad] = useState(false);
  if (bad) return null;
  const p = media.poster;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed local file with its size set; next/image would add a resizer hop for nothing
    <img className="nf-photo" src={p.src} alt="" width={p.w} height={p.h} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setBad(true)} />
  );
}

/* ---------- Screens ---------- */

export function ScreensRow({ media, title }: { media: ProjectMedia; title: string }) {
  const [open, setOpen] = useState<{ i: number; el: HTMLElement | null } | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const shots = media.screens.filter((s) => !gone.has(s.id));
  if (!shots.length) return null;
  return (
    <section className="nf-m-sec" aria-labelledby="nf-m-shots">
      <h3 id="nf-m-shots">{title}</h3>
      <ul className="nf-shots" role="list">
        {shots.map((s, i) => (
          <li key={s.id}>
            <button type="button" className="nf-shot" onClick={(e) => setOpen({ i, el: e.currentTarget })} aria-label={`${s.label}: ${t("nf.full", "en")}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local file, size set */}
              <img src={s.src} alt="" width={s.w} height={s.h} loading="lazy" decoding="async" onError={() => setGone((g) => new Set(g).add(s.id))} />
              <span>{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {open ? <Lightbox shots={shots} start={open.i} onClose={() => { open.el?.focus({ preventScroll: true }); setOpen(null); }} /> : null}
    </section>
  );
}

function Lightbox({ shots, start, onClose }: { shots: ProjectMedia["screens"]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    // Esc closes only the picture (the capture phase keeps it from reaching the modal underneath).
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      } else if (e.key === "ArrowRight") {
        e.stopPropagation();
        setI((n) => Math.min(shots.length - 1, n + 1));
      } else if (e.key === "ArrowLeft") {
        e.stopPropagation();
        setI((n) => Math.max(0, n - 1));
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [shots.length]);
  const s = shots[i];
  return (
    <div className="nf-lightbox" ref={box} role="dialog" aria-modal="true" aria-label={s.label}>
      <div className="nf-lightbox-bg" onClick={onClose} aria-hidden />
      <button type="button" className="nf-m-x" aria-label={t("nf.close", "en")} onClick={onClose}>
        <span aria-hidden>×</span>
      </button>
      <figure>
        {/* eslint-disable-next-line @next/next/no-img-element -- local file, size set */}
        <img src={s.src} alt={s.label} width={s.w} height={s.h} decoding="async" />
        <figcaption>
          {s.label} · {i + 1} / {shots.length}
        </figcaption>
      </figure>
    </div>
  );
}

/* ---------- Clips ---------- */

/**
 * A poster with a play badge. The clip is only created after a mouse hover (desktop) or a tap (phones), holds `preload="metadata"`,
 * plays muted and pauses when it leaves the screen. Reduced motion: the poster only.
 */
function ClipTile({ clip, playLabel }: { clip: ProjectMedia["clips"][number]; playLabel: string }) {
  const [on, setOn] = useState(false);
  const [bad, setBad] = useState(false);
  const [calm] = useState(() => reduced());
  const box = useRef<HTMLButtonElement>(null);
  const vid = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = vid.current;
    const el = box.current;
    if (!on || !v || !el) return;
    void v.play().catch(() => {});
    const io = new IntersectionObserver((en) => {
      if (!en.some((e) => e.isIntersecting)) {
        v.pause();
        setOn(false);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [on]);

  if (bad) return null;
  return (
    <button
      type="button"
      ref={box}
      className="nf-clip"
      data-on={on || undefined}
      aria-label={`${playLabel}: ${clip.label}`}
      aria-pressed={on}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse" && !calm) setOn(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setOn(false);
      }}
      onClick={() => {
        if (!calm) setOn((v) => !v);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local file, 16:10 */}
      <img src={clip.poster} alt="" width={1280} height={800} loading="lazy" decoding="async" onError={() => setBad(true)} />
      {on && !calm ? <video ref={vid} src={clip.src} muted loop playsInline preload="metadata" aria-hidden onError={() => setOn(false)} /> : null}
      <span className="nf-clip-badge" aria-hidden>
        {on ? "❚❚" : "▶"}
      </span>
      <span className="nf-clip-label">{clip.label}</span>
    </button>
  );
}

export function ClipsRow({ media, title, playLabel }: { media: ProjectMedia; title: string; playLabel: string }) {
  if (!media.clips.length) return null;
  return (
    <section className="nf-m-sec" aria-labelledby="nf-m-clips">
      <h3 id="nf-m-clips">{title}</h3>
      <ul className="nf-clips" role="list">
        {media.clips.map((c) => (
          <li key={c.id}>
            <ClipTile clip={c} playLabel={playLabel} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- Play for a project: facts and clip posters, then the end card ---------- */

export type ReelStep = { kind: "text"; text: string } | { kind: "poster"; src: string; label: string };

/**
 * The reel's steps (E4): the facts and the clip posters, alternating (text, poster, text, poster). Pure: the same
 * data in, the same steps out. With no clips it is the facts only.
 */
export function reelSteps(facts: { title: string; blurb?: string; stack: string[]; metricLabel?: string }, media?: ProjectMedia): ReelStep[] {
  const first = `${facts.title}. ${facts.blurb ?? ""}`.trim();
  const second = [facts.stack.length ? facts.stack.slice(0, 5).join(" · ") : "", facts.metricLabel ?? ""].filter(Boolean).join("  |  ");
  const texts = [first, second].filter(Boolean);
  const clips = (media?.clips ?? []).slice(0, texts.length);
  const out: ReelStep[] = [];
  texts.forEach((text, k) => {
    out.push({ kind: "text", text });
    const c = clips[k];
    if (c) out.push({ kind: "poster", src: c.poster, label: c.label });
  });
  return out;
}

/** Text steps hold twice as long as poster steps; the whole reel lasts `ms` (six seconds by default). */
export function ProjectReel({ steps, ms, adOn, onDone }: { steps: ReelStep[]; ms: number; adOn: boolean; onDone: () => void }) {
  const weights = useMemo(() => steps.map((s) => (s.kind === "text" ? 2 : 1)), [steps]);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const calm = useMemo(() => reduced(), []);
  const [at, setAt] = useState(0);
  const [typed, setTyped] = useState({ at: 0, n: 0 });
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  const natural = useRef(false);
  useAdSpeech({ on: adOn, tag: "en-IN" }, steps.flatMap((s) => (s.kind === "text" ? [s.text] : [])).join(" "), () => natural.current);

  useEffect(() => {
    const step = steps[at];
    if (!step) {
      natural.current = true;
      done.current();
      return;
    }
    const dur = (weights[at] / total) * ms;
    let raf = 0;
    if (step.kind === "text" && !calm) {
      const t0 = performance.now();
      const type = (now: number) => {
        const c = Math.min(step.text.length, Math.floor(((now - t0) / (dur * 0.7)) * step.text.length));
        setTyped({ at, n: c });
        if (c < step.text.length) raf = requestAnimationFrame(type);
      };
      raf = requestAnimationFrame(type);
    }
    const next = window.setTimeout(() => setAt((n) => n + 1), calm ? Math.max(dur, 1400) : dur);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(next);
    };
  }, [at, steps, weights, total, ms, calm]);

  const step = steps[at];
  if (!step) return null;
  const chars = step.kind === "text" ? (calm ? step.text.length : typed.at === at ? typed.n : 0) : 0;
  return step.kind === "poster" ? (
    <div className="nf-reel nf-reel-poster" aria-live="off">
      {/* eslint-disable-next-line @next/next/no-img-element -- local file */}
      <img src={step.src} alt="" width={1280} height={800} decoding="async" />
      <span>{step.label}</span>
    </div>
  ) : (
    <p className="nf-tele2 nf-reel" aria-live="off">
      {step.text.slice(0, chars)}
      {chars < step.text.length ? <span className="nf-caret">▌</span> : null}
    </p>
  );
}

/** What follows a project's Play: the live address and the code, or `In development` with the code and a hello. Never navigates by itself. */
export function ProjectEnd({ live, repo, contact, onReplay }: { live?: string; repo?: string; contact: TermLink[]; onReplay: () => void }) {
  const mail = contact.find((c) => c.label === "mail")?.href;
  return (
    <div className="nf-pend" role="group" aria-label={live ? t("nf.end.visit", "en") : t("nf.end.dev", "en")}>
      {!live ? <p className="nf-pend-dev">{t("nf.end.dev", "en")}</p> : null}
      <div className="nf-pend-actions">
        {live ? (
          <a className="nf-btn nf-btn-play" href={live} target="_blank" rel="noreferrer">
            {t("nf.end.visit", "en")}
          </a>
        ) : null}
        {repo ? (
          <a className={live ? "nf-btn nf-btn-glass" : "nf-btn nf-btn-play"} href={repo} target="_blank" rel="noreferrer">
            {t("nf.end.code", "en")}
          </a>
        ) : null}
        {!live && mail ? (
          <a className="nf-btn nf-btn-glass" href={mail}>
            {t("nf.end.hello", "en")}
          </a>
        ) : null}
        <button type="button" className="nf-btn nf-btn-glass" onClick={onReplay}>
          <span aria-hidden>↺</span> Replay
        </button>
      </div>
    </div>
  );
}
