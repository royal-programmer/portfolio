"use client";

/**
 * A project's Play (17-persona-views.md §25, F1): a trailer in chapters. The chapters and their timings come from
 * `lib/site/netflix-trailer.ts`; this is the player. Text types at about 22 characters a second and holds for a beat before the
 * next chapter; a chapter with a clip plays the real clip, muted, with its sentence as a subtitle, and ends when the clip has
 * ended and the line has been read, whichever is later. A voice (AD) is waited for. Pause (Space or a tap), previous and next
 * (arrows). It pauses when the tab is hidden or the player scrolls out of view. Reduced motion: no typing, clips show their
 * poster, the same holds. A clip that fails shows its poster and the chapter still advances.
 */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { MAX_WAIT_MS, chapterTimes, type Chapter } from "@/lib/site/netflix-trailer";
import { TYPE_CPS } from "@/lib/site/netflix-trailer";
import type { BookCall } from "@/lib/site/netflix-data";
import type { TermLink } from "@/lib/site/terminal-data";
import { t } from "@/lib/site/terminal-strings";
import { adCancel, adSpeak } from "./netflix-ad";
import { ProjectEnd } from "./netflix-media";

type State = { at: number; t: number; clip: boolean; ad: boolean; done: boolean };
type Action = { type: "tick"; dt: number } | { type: "clip" } | { type: "ad" } | { type: "go"; to: number } | { type: "step"; d: 1 | -1 };

const calmNow = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Trailer({
  chapters,
  holdScale,
  adOn,
  adTag,
  live,
  repo,
  contact,
  dev,
  book,
  guided,
  onDone,
}: {
  chapters: Chapter[];
  holdScale: number;
  adOn: boolean;
  adTag: string;
  live?: string;
  repo?: string;
  contact: TermLink[];
  dev?: boolean;
  book?: BookCall;
  /** The Recruiter cut: the first three chapters, then `onDone`, no end card. */
  guided: boolean;
  /** The story has been played through (the end card reached, or the guided chapters finished). */
  onDone: () => void;
}) {
  const calm = useMemo(() => calmNow(), []);
  const last = chapters.length - 1;

  const reducer = useCallback(
    (s: State, a: Action): State => {
      const fresh = (to: number): State => ({ at: to, t: 0, clip: false, ad: !adOn, done: false });
      if (a.type === "go") return fresh(Math.max(0, Math.min(last, a.to)));
      if (a.type === "step") return fresh(Math.max(0, Math.min(last, s.at + a.d)));
      if (a.type === "clip") return s.clip ? s : { ...s, clip: true };
      if (a.type === "ad") return s.ad ? s : { ...s, ad: true };
      const c = chapters[s.at];
      if (!c || c.kind === "end") return s;
      const time = s.t + a.dt;
      const need = chapterTimes(c, holdScale).needMs;
      const waited = time >= need + MAX_WAIT_MS;
      const clipOver = !c.clip || calm || s.clip || (c.clipMs != null && time >= c.clipMs);
      const ready = time >= need && clipOver && s.ad;
      if (ready || waited) return s.at < last ? fresh(s.at + 1) : { ...s, t: time, done: true };
      return { ...s, t: time };
    },
    [chapters, holdScale, last, calm, adOn],
  );
  const [st, dispatch] = useReducer(reducer, { at: 0, t: 0, clip: false, ad: !adOn, done: false });
  const [userPaused, setUserPaused] = useState(false);
  const [away, setAway] = useState(false);
  const paused = userPaused || away;
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  });

  const chapter = chapters[Math.min(st.at, last)];
  const atEnd = chapter?.kind === "end";
  const complete = guided ? st.done : atEnd;
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  const told = useRef(false);
  useEffect(() => {
    if (complete && !told.current) {
      told.current = true;
      doneRef.current();
    }
    if (!complete) told.current = false;
  }, [complete]);

  // The clock: real elapsed time, only while playing.
  useEffect(() => {
    let prev = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1000, now - prev);
      prev = now;
      if (!pausedRef.current) dispatch({ type: "tick", dt });
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  // Pause when the tab is hidden or the trailer scrolls out of view.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vis = () => setAway(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", vis);
    const el = root.current;
    const io = el ? new IntersectionObserver((en) => setAway(en.some((e) => !e.isIntersecting)), { threshold: 0.25 }) : null;
    if (el && io) io.observe(el);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      io?.disconnect();
    };
  }, []);

  // AD: each chapter's text is spoken, and the chapter waits for the voice to finish.
  const speech = chapter && chapter.kind !== "end" ? [chapter.text.replace(/\n/g, ". "), chapter.chips?.length ? chapter.chips.join(", ") : ""].filter(Boolean).join(" ") : "";
  const at = st.at;
  useEffect(() => {
    if (!adOn || !speech) return;
    let alive = true;
    const spoke = adSpeak(speech, adTag, () => {
      if (alive) dispatch({ type: "ad" });
    });
    if (!spoke) dispatch({ type: "ad" });
    return () => {
      alive = false;
      adCancel();
    };
  }, [adOn, adTag, speech, at]);
  useEffect(() => {
    if (!adOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (paused) window.speechSynthesis.pause();
    else window.speechSynthesis.resume();
  }, [paused, adOn]);

  // The clip of this chapter: starts on entering, follows pause.
  const vid = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    if (paused) v.pause();
    else
      void v.play().catch((err: unknown) => {
        // An interrupted play (a pause or a new load) is not a failure; a refused or unsupported one is.
        if (!(err instanceof DOMException && err.name === "AbortError")) dispatch({ type: "clip" });
      });
  }, [paused, at]);

  // Keys: Space pauses, arrows move between chapters. Capture phase, so the modal's own handlers do not also act.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select")) return;
      if (e.key === " " && !el?.closest("button, a")) {
        e.preventDefault();
        e.stopPropagation();
        setUserPaused((p) => !p);
      } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        dispatch({ type: "step", d: e.key === "ArrowRight" ? 1 : -1 });
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);

  if (!chapter) return null;
  const times = chapterTimes(chapter, holdScale);
  const typed = calm || chapter.kind === "beat" ? chapter.text.length : Math.min(chapter.text.length, Math.floor((st.t / 1000) * TYPE_CPS));
  const typing = typed < chapter.text.length;
  const lines = chapter.text.slice(0, typed).split("\n");
  const progress = times.needMs ? Math.min(1, st.t / times.needMs) : 1;
  const clip = chapter.clip;

  return (
    <div
      className="nf-tr"
      ref={root}
      data-kind={chapter.kind}
      data-paused={userPaused || undefined}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a, button")) setUserPaused((p) => !p);
      }}
    >
      {clip ? (
        <div className="nf-tr-stage" aria-hidden>
          {calm ? (
            // eslint-disable-next-line @next/next/no-img-element -- local clip poster
            <img src={clip.poster} alt="" />
          ) : (
            <video
              key={chapter.id}
              ref={vid}
              src={clip.src}
              poster={clip.poster}
              muted
              playsInline
              preload="auto"
              autoPlay
              onEnded={() => dispatch({ type: "clip" })}
              onError={() => dispatch({ type: "clip" })}
            />
          )}
        </div>
      ) : null}

      {chapter.kind === "end" ? (
        <ProjectEnd live={live} repo={repo} contact={contact} dev={dev} book={book} onReplay={() => dispatch({ type: "go", to: 0 })} />
      ) : chapter.kind === "beat" && clip ? (
        <p className="nf-tr-sub" aria-live="off">
          {chapter.text}
        </p>
      ) : (
        <div className="nf-tr-text" aria-live="off">
          {lines.map((l, i) => (
            <p key={i} className={chapter.kind === "title" && i === 0 ? "nf-tr-name" : undefined}>
              {l}
              {typing && i === lines.length - 1 ? <span className="nf-caret">▌</span> : null}
            </p>
          ))}
          {chapter.chips && !typing ? (
            <ul className="nf-tr-chips" role="list">
              {chapter.chips.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <div className="nf-tr-ctl" role="group" aria-label={t("nf.tr.chapter", "en")}>
        <button type="button" aria-label={t("nf.tr.prev", "en")} disabled={at === 0} onClick={() => dispatch({ type: "go", to: at - 1 })}>
          ◀
        </button>
        <button type="button" aria-label={userPaused ? t("nf.tr.play", "en") : t("nf.tr.pause", "en")} aria-pressed={userPaused} onClick={() => setUserPaused((p) => !p)}>
          {userPaused ? "▶" : "❚❚"}
        </button>
        <button type="button" aria-label={t("nf.tr.next", "en")} disabled={at >= last} onClick={() => dispatch({ type: "go", to: at + 1 })}>
          ▶
        </button>
        <ol className="nf-tr-dots">
          {chapters.map((c, i) => (
            <li key={c.id} data-state={i < at ? "done" : i === at ? "now" : "next"} style={i === at ? ({ "--p": progress } as React.CSSProperties) : undefined}>
              <button type="button" aria-label={`${t("nf.tr.chapter", "en")} ${i + 1}`} aria-current={i === at || undefined} onClick={() => dispatch({ type: "go", to: i })} />
            </li>
          ))}
        </ol>
      </div>
      {userPaused ? (
        <span className="nf-tr-paused" role="status">
          {t("nf.tr.paused", "en")}
        </span>
      ) : null}
    </div>
  );
}
