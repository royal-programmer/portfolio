"use client";

/**
 * The billboard hero (17-persona-views.md §7): key art made from the generated portrait, the title, the
 * tagline, the facts, Play (the trailer: a typed pitch), More info and View résumé. After three idle seconds
 * the trailer plays by itself, silent, with a Skip pill.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { factsOf, metricLine, type Episode, type NetflixShow, type NetflixProfileId, type NfItem } from "@/lib/site/netflix-data";
import { factSub, latestSub, nextSub, statusSub, type NfLine, type SubData, type SubLang } from "@/lib/site/netflix-subs";
import { AdButton, CcButton } from "./netflix-cc";
import { useAd, useAdSpeech } from "./netflix-ad";
import { tick as tickSound } from "./netflix-sound";
import { NfArt } from "./netflix-art";
import { useForName } from "./use-for-name";
import { t } from "@/lib/site/terminal-strings";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Props = {
  series: NetflixShow;
  profile: NetflixProfileId;
  status: string;
  fast: boolean;
  /** The carousel's titles (C3), resolved by the view from `show.featured`. */
  features: Array<{ item: NfItem; label: string }>;
  /** Open a featured title: its modal, with the teleprompter when `play`. */
  onOpen: (item: NfItem, play: boolean) => void;
  /** A modal is open: the carousel holds still. */
  held?: boolean;
  sound: { on: boolean; toggle: () => void };
  /** Where Play / skip lands: the first row's id. */
  firstRowId?: string;
  /** A season recap to type in the trailer panel instead of the profile trailer (N4). */
  recap?: { key: number; lines: NfLine[] } | null;
  onRecapEnd?: () => void;
  /** Subtitles (N8): the toggle and the translated facts they come from. */
  cc: { on: boolean; lang: SubLang | null; toggle: () => void };
  subData: SubData;
};

/** The pitch, built from the hero facts, the two newest main-branch episodes and the status line. */
function trailerLines(series: NetflixShow, status: string, subs: { lang: SubLang; data: SubData } | null): NfLine[] {
  const main: Episode[] = series.rows.flatMap((r) => (r.kind === "episodes" ? r.items : [])).filter((e) => e.branch === "main").sort((a, b) => (a.date < b.date ? 1 : -1));
  const lines: NfLine[] = [{ text: `$ ${series.title.toLowerCase().replace(/s+/g, "-")} --trailer` }, { text: `${series.title}. ${series.tagline}.` }];
  for (const f of series.hero.facts.filter((f) => !f.toLowerCase().startsWith("open"))) lines.push({ text: f, sub: subs ? factSub(f, subs.data, subs.lang) : undefined });
  if (main[0]) lines.push({ text: `Latest episode: ${main[0].title}.`, sub: subs ? latestSub(main[0].title, subs.lang) : undefined });
  if (main[1]) lines.push({ text: `Before that: ${main[1].title}.`, sub: subs ? latestSub(main[1].title, subs.lang, true) : undefined });
  lines.push({ text: `Status: ${status}.`, sub: subs ? statusSub(subs.data, subs.lang) : undefined });
  lines.push({ text: "Next episode: your team?", sub: subs ? nextSub(subs.lang) : undefined });
  return lines.slice(0, 8);
}

const FEATURE_MS = 7000;
const TONE_COLOR: Record<string, string> = { main: "var(--nf-accent)", learn: "#2ab7b0", side: "#8b6cf0", life: "#8a8a96", project: "var(--nf-accent)", post: "var(--nf-accent)" };

export function NetflixHero({ series, profile, status, fast, firstRowId, features, onOpen, held, sound, recap, onRecapEnd, cc, subData }: Props) {
  const forName = useForName();
  const ad = useAd(cc.lang);
  const [playing, setPlaying] = useState(false);
  const [auto, setAuto] = useState(false);
  const autoDone = useRef(false);
  const trailerBtn = useRef<HTMLButtonElement>(null);
  // C3: the carousel. Hover, focus and touch hold it; so do the trailer, a recap and an open modal.
  const [idx, setIdx] = useState(0);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [touch, setTouch] = useState(false);
  const touchTimer = useRef(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const calm = useMemo(() => reducedMotion(), []);
  const n = features.length;
  const at = Math.min(idx, Math.max(0, n - 1));
  const cur = features[at];
  const paused = hover || focus || touch || playing || !!recap || !!held;
  const go = useCallback((to: number) => setIdx(((to % n) + n) % n), [n]);
  useEffect(() => () => window.clearTimeout(touchTimer.current), []);

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
      if (!scroll) return focus ? trailerBtn.current?.focus() : undefined;
      const el = firstRowId ? document.getElementById(`nf-row-${firstRowId}`) : null;
      el?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    },
    [firstRowId, recap, onRecapEnd],
  );

  const f = cur ? factsOf(cur.item) : null;
  const tone = f?.tone ?? "main";
  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    go(i + d);
    requestAnimationFrame(() => document.querySelectorAll<HTMLElement>(".nf-feat-tab")[(((i + d) % n) + n) % n]?.focus());
  };

  return (
    <header
      className="nf-hero"
      data-playing={playing || !!recap || undefined}
      style={{ "--b": TONE_COLOR[tone] ?? "var(--nf-accent)" } as React.CSSProperties}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFocus(false)}
      onTouchStart={(e) => {
        window.clearTimeout(touchTimer.current);
        setTouch(true);
        swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchEnd={(e) => {
        const s0 = swipe.current;
        swipe.current = null;
        if (s0 && n > 1) {
          const dx = e.changedTouches[0].clientX - s0.x;
          const dy = e.changedTouches[0].clientY - s0.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(at + (dx < 0 ? 1 : -1));
        }
        touchTimer.current = window.setTimeout(() => setTouch(false), 4000);
      }}
    >
      <div className="nf-art" aria-hidden>
        {cur && f ? <NfArt key={cur.item.id} seed={cur.item.id} tone={tone} metric={f.metric} big live /> : null}
      </div>
      <div className="nf-hero-shade" aria-hidden />

      <div className="nf-hero-copy">
        <p className="nf-kicker">{forName ? t("nf.for.kicker", "en").replace("{name}", forName) : series.hero.kicker}</p>
        <h1 className="nf-title">{series.hero.title}</h1>
        <p className="nf-tagline">{series.tagline}</p>
        <p className="nf-blurb">{series.hero.blurb}</p>
        <ul className="nf-facts">
          {series.hero.facts.map((fact) => (
            <li key={fact} className="nf-fact">
              {fact}
            </li>
          ))}
        </ul>
        {open ? (
          <p className="nf-open">
            <span className="nf-dot" aria-hidden /> open to work
          </p>
        ) : null}
        {cur && f ? (
          <div className="nf-feat">
            <p className="nf-feat-kicker">
              Featured · {at + 1} of {n}
            </p>
            <h2 className="nf-feat-title">{f.title}</h2>
            {f.metric ? <p className="nf-feat-metric">{metricLine(f.metric)}</p> : null}
          </div>
        ) : null}
        <div className="nf-actions">
          {cur ? (
            <>
              <button type="button" className="nf-btn nf-btn-play" onClick={() => onOpen(cur.item, true)}>
                <span aria-hidden>▶</span> Play
              </button>
              <button type="button" className="nf-btn nf-btn-glass" onClick={() => onOpen(cur.item, false)}>
                <span aria-hidden>ⓘ</span> More info
              </button>
            </>
          ) : null}
          <span className="nf-actions-extra">
            <button
              ref={trailerBtn}
              type="button"
              className="nf-btn nf-btn-glass"
              onClick={() => {
                onRecapEnd?.();
                setAuto(false);
                autoDone.current = true;
                setPlaying(true);
              }}
            >
              Trailer
            </button>
            <a className="nf-btn nf-btn-glass" href="/Ratul_Roy_Resume.pdf" target="_blank" rel="noreferrer">
              View résumé
            </a>
            <button type="button" className="nf-round nf-vol" aria-label={sound.on ? "Mute" : "Unmute"} aria-pressed={sound.on} onClick={sound.toggle}>
              <span aria-hidden>{sound.on ? "🔊" : "🔇"}</span>
            </button>
            <CcButton cc={cc} />
            <AdButton ad={ad} />
          </span>
        </div>
        {n > 1 ? (
          <div className="nf-feat-tabs" role="tablist" aria-label="Featured titles">
            {features.map((ft, i) => (
              <button key={ft.item.id} type="button" role="tab" className="nf-feat-tab" aria-selected={i === at} tabIndex={i === at ? 0 : -1} onClick={() => go(i)} onKeyDown={(e) => onTabKey(e, i)}>
                <span className="nf-feat-label">{ft.label}</span>
                <span className="nf-feat-bar" aria-hidden>
                  {i === at ? (
                    <i
                      key={`${at}-${calm}`}
                      className="nf-feat-fill"
                      data-calm={calm || undefined}
                      style={{ animationDuration: `${FEATURE_MS}ms`, animationPlayState: paused ? "paused" : "running" }}
                      onAnimationEnd={() => !calm && go(at + 1)}
                    />
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {playing || recap ? (
        <Trailer
          lines={recap ? recap.lines : trailerLines(series, status, (cc.on || ad.on) && cc.lang ? { lang: cc.lang, data: subData } : null)}
          showSubs={cc.on && !!cc.lang}
          cc={cc}
          ad={ad}
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

function Trailer({ lines: entries, showSubs, cc, ad, ms, fast, auto, onEnd, sound }: { lines: NfLine[]; showSubs: boolean; cc: Props["cc"]; ad: ReturnType<typeof useAd>; ms: number; fast: boolean; auto: boolean; onEnd: (scroll: boolean, focus?: boolean) => void; sound: { on: boolean; toggle: () => void } }) {
  const soundOn = useRef(sound.on);
  useEffect(() => {
    soundOn.current = sound.on;
  });
  const lines = useMemo(() => entries.map((l) => l.text), [entries]);
  // D4: the whole pitch is spoken (the translation when the terminal speaks bn or hi and one exists). A natural end lets it finish; skip, Esc and toggle-off cancel it.
  const natural = useRef(false);
  const spoken = useMemo(() => entries.filter((l) => !l.text.startsWith("$ ")).map((l) => (ad.tag !== "en-IN" && l.sub ? l.sub : l.text)).join(" "), [entries, ad.tag]);
  useAdSpeech(ad, spoken, () => natural.current);
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
        natural.current = true;
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
            {showSubs && s.done && entries[i]?.sub ? (
              <span className="nf-sub" lang={cc.lang ?? undefined}>
                {entries[i].sub}
              </span>
            ) : null}
          </p>
        ))}
      </div>
      <div className="nf-trailer-foot">
        <div className="nf-progress" aria-hidden>
          <span style={{ width: `${Math.round((chars / total) * 100)}%` }} />
        </div>
        <CcButton cc={cc} small hint />
        <AdButton ad={ad} small />
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
