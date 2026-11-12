"use client";

/**
 * Real product imagery in the Netflix view (17-persona-views.md §24, E2 and E4): the poster that replaces generated art,
 * the Screens and Clips rows of a project's modal, and Play for a project (a short reel of facts and clip posters that
 * is now the trailer, `netflix-trailer.tsx`; this file keeps its end card). Light on purpose: images are lazy with their size set, a clip is only
 * loaded after a hover or tap and only its metadata, and reduced motion shows posters only.
 */
import { useEffect, useRef, useState } from "react";
import type { ProjectMedia } from "@/lib/site/netflix-data";
import type { TermLink } from "@/lib/site/terminal-data";
import { t } from "@/lib/site/terminal-strings";

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

/* ---------- Hover clip on a project card (F4) ---------- */

let activeHover: (() => void) | null = null;
const HOVER_MS = 600;

/**
 * A project card with clips plays its first clip, muted, after 600 ms of mouse hover; it stops and resets on leave. One at a
 * time. Never on touch, under reduced motion or when the browser asks to save data. The poster stays as the fallback.
 */
export function useHoverClip(clip: ProjectMedia["clips"][number] | undefined) {
  const [on, setOn] = useState(false);
  const timer = useRef(0);
  const stop = useRef(() => {});
  useEffect(() => {
    stop.current = () => {
      window.clearTimeout(timer.current);
      setOn(false);
    };
    const s = stop.current;
    return () => {
      s();
      if (activeHover === s) activeHover = null;
    };
  }, []);
  const allowed = () => {
    if (!clip || reduced()) return false;
    const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return !c?.saveData;
  };
  return {
    on,
    onPointerEnter: (e: React.PointerEvent) => {
      if (e.pointerType !== "mouse" || !allowed()) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        activeHover?.();
        activeHover = stop.current;
        setOn(true);
      }, HOVER_MS);
    },
    onPointerLeave: () => {
      stop.current();
      if (activeHover === stop.current) activeHover = null;
    },
    video: on && clip ? <video className="nf-hclip" src={clip.src} muted loop playsInline autoPlay preload="metadata" aria-hidden onError={() => stop.current()} /> : null,
  };
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

/** What follows a project's Play: the live address and the code, or `In development` with the code and a hello. Never navigates by itself. */
export function ProjectEnd({ live, repo, contact, dev, onReplay }: { live?: string; repo?: string; contact: TermLink[]; /** Says `In development` even when there is an address. */ dev?: boolean; onReplay: () => void }) {
  const mail = contact.find((c) => c.label === "mail")?.href;
  return (
    <div className="nf-pend" role="group" aria-label={live ? t("nf.end.visit", "en") : t("nf.end.dev", "en")}>
      {!live || dev ? <p className="nf-pend-dev">{t("nf.end.dev", "en")}</p> : null}
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
        {mail ? (
          <a className="nf-btn nf-btn-glass" href={mail}>
            {t("nf.end.hello", "en")}
          </a>
        ) : null}
        <button type="button" className="nf-btn nf-btn-glass" onClick={onReplay}>
          <span aria-hidden>↺</span> {t("nf.tr.replay", "en")}
        </button>
      </div>
    </div>
  );
}
