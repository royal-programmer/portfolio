"use client";

/**
 * The detail modal (17-persona-views.md §7): what any card opens. A route-less overlay (dialog, focus trap,
 * Esc / backdrop / x, scroll locked) whose panel grows out of the card's rectangle (FLIP). Inside: the
 * billboard (the portrait at low opacity, Play as a six-second teleprompter, My List, thumbs-up, sound), the
 * meta row, description, the season's episodes, "More like this" and About. Everything is swapped in place.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { NF_ADJECTIVES, castOf, factsOf, moreLike, type CastMember, type NetflixProfileId, type NfFacts, type NfItem } from "@/lib/site/netflix-data";
import { DISPLAY_ROOT } from "@/lib/site/brand";
import { netflixShareLink } from "@/lib/site/netflix-og";
import { epSub } from "@/lib/site/netflix-subs";
import { CcButton } from "./netflix-cc";
import { chime } from "./netflix-sound";
import { useCc, useLikes, useMyList, useSound } from "./netflix-store";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;
const EASE = "cubic-bezier(.2,.8,.2,1)";
const FOCUSABLE = 'button:not([disabled]), a[href], select, input, [tabindex]:not([tabindex="-1"])';

type Props = {
  item: NfItem;
  index: Map<string, NfItem>;
  /** The card's rectangle, for the grow-from-card opening. Null: opened from a link. */
  origin: DOMRect | null;
  portraitText: string;
  /** Start playing as soon as it opens (the card's play button). */
  autoPlay?: boolean;
  /** How long Play's teleprompter types for (the guided play passes a long one); default six seconds. */
  playMs?: number;
  /** The show's cast, and what a Cast chip does (filter the page by that technology). */
  cast?: CastMember[];
  /** The profile the share link opens in (N6). */
  profile?: NetflixProfileId;
  onCast?: (key: string) => void;
  onClose: () => void;
  onSwap: (item: NfItem) => void;
  /** Called when an item is shown (progress bookkeeping); `playedThrough` once its Play finished. */
  onShow: (item: NfItem, playedThrough: boolean) => void;
};

export function NetflixModal({ item, index, origin, portraitText, autoPlay, playMs, cast, profile = "story", onCast, onClose, onSwap, onShow }: Props) {
  const facts = useMemo(() => factsOf(item), [item]);
  const itemCast = useMemo(() => (cast ? castOf(item, cast) : []), [item, cast]);
  const overlay = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const sound = useSound();
  const cc = useCc();
  const list = useMyList();
  const likes = useLikes();
  const [play, setPlay] = useState<{ id: string; on: boolean }>({ id: item.id, on: !!autoPlay });
  const playing = play.id === item.id && play.on;
  const [seasonPick, setSeasonPick] = useState<{ id: string; season: number } | null>(null);
  const [now] = useState(() => Date.now());

  /* ----- open: FLIP from the card, backdrop to .7, sound ----- */
  const soundOn = useRef(sound.on);
  useLayoutEffect(() => {
    const p = panel.current;
    const b = backdrop.current;
    if (!p || !b) return;
    const calm = reduced();
    b.animate([{ opacity: 0 }, { opacity: 1 }], { duration: calm ? 120 : 380, easing: EASE, fill: "backwards" });
    if (calm) {
      p.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120, fill: "backwards" });
    } else if (isPhone()) {
      p.animate([{ transform: "translateY(100%)" }, { transform: "none" }], { duration: 340, easing: EASE, fill: "backwards" });
    } else if (origin) {
      const r = p.getBoundingClientRect();
      const dx = origin.left - r.left;
      const dy = origin.top - r.top;
      const sx = origin.width / r.width;
      const sy = origin.height / r.height;
      p.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.5 },
          { transformOrigin: "0 0", transform: "none", opacity: 1 },
        ],
        { duration: 380, easing: EASE, fill: "backwards" },
      );
    } else {
      p.animate([{ transform: "scale(.94)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 300, easing: EASE, fill: "backwards" });
    }
    // The opening animation runs once, for the first item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (soundOn.current) chime();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>(".nf-m-x")?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    onShow(item, false);
    overlay.current?.scrollTo({ top: 0 });
    // Only when the item changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const ms = reduced() ? 80 : 160;
    backdrop.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: "forwards" });
    const a = panel.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, fill: "forwards" });
    if (a) a.onfinish = () => onClose();
    else onClose();
  }, [onClose]);

  /* ----- N6: Share: copies the watch-party link (the system sheet on phones) ----- */
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  const share = async () => {
    const host = window.location.hostname;
    const origin = host === "localhost" || host.endsWith(".localhost") ? window.location.origin : `https://code.${DISPLAY_ROOT}`;
    const url = netflixShareLink(origin, profile, item.id);
    if (isPhone() && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: facts.title, text: facts.blurb, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch {}
      ta.remove();
      panel.current?.querySelector<HTMLElement>(".nf-m-share")?.focus({ preventScroll: true });
    }
    if (!ok) return;
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  /* ----- Play ----- */
  const togglePlay = () => {
    if (!playing && item.kind === "project" && facts.live) {
      window.open(facts.live, "_blank", "noopener,noreferrer");
      return;
    }
    setPlay({ id: item.id, on: !playing });
  };
  const finished = () => {
    setPlay({ id: item.id, on: false });
    onShow(item, true);
  };

  /* ----- keyboard: Esc, Tab trap, Space toggles Play ----- */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      requestClose();
      return;
    }
    if (e.key === "Backspace" && !(e.target as HTMLElement).closest("input, textarea, select")) {
      e.preventDefault();
      requestClose();
      return;
    }
    if (e.key === " ") {
      const t = e.target as HTMLElement;
      if (t.closest("button, a, select, input, textarea")) return;
      e.preventDefault();
      togglePlay();
      return;
    }
    if (e.key !== "Tab") return;
    const f = Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter((n) => n.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !panel.current?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !panel.current?.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  };

  // Esc even when focus has slipped to the body.
  useEffect(() => {
    const onWin = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      requestClose();
    };
    window.addEventListener("keydown", onWin);
    return () => window.removeEventListener("keydown", onWin);
  }, [requestClose]);

  /* ----- swipe down (phones) from the handle / billboard ----- */
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (!isPhone() || (overlay.current?.scrollTop ?? 0) > 0) return;
    drag.current = { y: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current;
    if (!d || !panel.current) return;
    d.dy = Math.max(0, e.touches[0].clientY - d.y);
    panel.current.style.transform = `translateY(${d.dy}px)`;
  };
  const onTouchEnd = () => {
    const d = drag.current;
    drag.current = null;
    const p = panel.current;
    if (!d || !p) return;
    if (d.dy > 120) {
      p.style.transform = "";
      requestClose();
      return;
    }
    p.style.transition = "transform 200ms";
    p.style.transform = "";
    window.setTimeout(() => {
      p.style.transition = "";
    }, 220);
  };

  /* ----- episodes in the shown season ----- */
  const seasons = useMemo(() => [...new Set([...index.values()].flatMap((o) => (o.kind === "episode" ? [o.e.season] : [])))].sort((a, b) => b - a), [index]);
  const season = seasonPick && seasonPick.id === item.id ? seasonPick.season : facts.season;
  const episodes = useMemo(
    () =>
      item.kind === "episode" && season != null
        ? [...index.values()].flatMap((o) => (o.kind === "episode" && o.e.season === season ? [o] : [])).sort((a, b) => (a.kind === "episode" && b.kind === "episode" ? a.e.n - b.e.n : 0))
        : [],
    [index, item.kind, season],
  );
  const more = useMemo(() => moreLike(item, index, 6), [item, index]);

  const onEpisodeKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const to = episodes[i + (e.key === "ArrowRight" ? 1 : -1)];
    if (!to) return;
    e.preventDefault();
    e.stopPropagation();
    onSwap(to);
  };

  const isNew = facts.date ? now - new Date(`${facts.date}-01`.slice(0, 10)).getTime() < 90 * 86_400_000 : false;
  const adjectives = NF_ADJECTIVES[facts.tone] ?? NF_ADJECTIVES.main;
  const inList = list.has(item.id);
  const liked = likes.has(item.id);

  return (
    <div className="nf-modal" ref={overlay} onKeyDown={onKeyDown} data-tone={facts.tone}>
      <div className="nf-backdrop" ref={backdrop} onClick={requestClose} aria-hidden />
      <div className="nf-m" ref={panel} role="dialog" aria-modal="true" aria-label={facts.title}>
        <div className="nf-m-top" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <div className="nf-m-handle" aria-hidden />
          <Billboard key={item.id} facts={facts} portraitText={portraitText} playing={playing} playMs={playMs} sub={cc.on && cc.lang ? epSub(facts.tone, facts.season, facts.n, cc.lang) : undefined} lang={cc.lang} onFinish={finished}>
            <button type="button" className="nf-m-x" aria-label="Close" onClick={requestClose}>
              <span aria-hidden>×</span>
            </button>
            <button type="button" className="nf-m-share" aria-label="Share this episode" title="Share" onClick={share}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="6" cy="12" r="2.6" />
                <circle cx="17.5" cy="6" r="2.6" />
                <circle cx="17.5" cy="18" r="2.6" />
                <path d="m8.3 10.8 7-3.6M8.3 13.2l7 3.6" />
              </svg>
            </button>
            {copied ? (
              <span className="nf-m-copied" role="status">
                link copied
              </span>
            ) : null}
            <div className="nf-m-bar">
              <div className="nf-m-btns">
                <button type="button" className="nf-btn nf-btn-play" onClick={togglePlay} aria-pressed={playing}>
                  <span aria-hidden>{playing ? "■" : "▶"}</span> {playing ? "Stop" : "Play"}
                </button>
                <button type="button" className="nf-round" aria-label={inList ? "Remove from My List" : "Add to My List"} aria-pressed={inList} title={inList ? "Remove from My List" : "Add to My List"} onClick={() => list.toggle(item.id)}>
                  <span aria-hidden>{inList ? "✓" : "＋"}</span>
                </button>
                <button type="button" className="nf-round" aria-label={liked ? "Remove your thumbs-up" : "I like this"} aria-pressed={liked} title="I like this" onClick={() => likes.toggle(item.id)}>
                  <span aria-hidden>👍</span>
                </button>
              </div>
              <CcButton cc={cc} />
              <button
                type="button"
                className="nf-round nf-m-vol"
                aria-label={sound.on ? "Mute" : "Unmute"}
                aria-pressed={sound.on}
                onClick={() => {
                  if (!sound.on) chime();
                  sound.toggle();
                }}
              >
                <span aria-hidden>{sound.on ? "🔊" : "🔇"}</span>
              </button>
            </div>
          </Billboard>
        </div>

        <div className="nf-m-body">
          <div className="nf-m-info">
            <div className="nf-m-meta">
              {isNew ? <span className="nf-new">New</span> : null}
              {facts.season != null ? <span>S{facts.season}</span> : facts.year ? <span>{facts.year}</span> : null}
              {facts.n != null ? <span>E{facts.n}</span> : null}
              {facts.runtime ? <span>{facts.runtime}</span> : null}
              {facts.grade ? <span className="nf-grade">{facts.grade}</span> : null}
              <span className="nf-hd">{facts.branchLabel}</span>
            </div>
            {facts.blurb ? <p className="nf-m-desc">{facts.blurb}</p> : null}
            {facts.stack.length ? (
              <ul className="nf-m-chips" role="list" aria-label="Stack">
                {facts.stack.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
            {facts.href || facts.live || facts.repo ? (
              <div className="nf-m-links">
                {facts.href ? <a href={facts.href}>Open page</a> : null}
                {facts.live ? (
                  <a href={facts.live} target="_blank" rel="noreferrer">
                    Live
                  </a>
                ) : null}
                {facts.repo ? (
                  <a href={facts.repo} target="_blank" rel="noreferrer">
                    Code
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>
          <dl className="nf-m-side">
            <div>
              <dt>Branch:</dt>
              <dd>{item.kind === "episode" ? item.e.branch : facts.branchLabel}</dd>
            </div>
            {facts.tags.length || facts.stack.length ? (
              <div>
                <dt>Tags:</dt>
                <dd>{[...facts.tags, ...facts.stack.slice(0, 3)].join(", ")}</dd>
              </div>
            ) : null}
            {itemCast.length && onCast ? (
              <div>
                <dt>Cast:</dt>
                <dd>
                  <ul className="nf-m-cast" role="list" aria-label="Cast">
                    {itemCast.map((c) => (
                      <li key={c.id}>
                        <button type="button" onClick={() => onCast(c.key)} title={`Show only ${c.name}`}>
                          {c.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            <div>
              <dt>This series is:</dt>
              <dd>{adjectives.join(", ")}</dd>
            </div>
          </dl>
        </div>

        {episodes.length ? (
          <section className="nf-m-sec" aria-labelledby="nf-m-eps">
            <div className="nf-m-sechead">
              <h3 id="nf-m-eps">Episodes</h3>
              <label className="nf-season">
                <span className="nf-visually-hidden">Season</span>
                <select value={season} onChange={(e) => setSeasonPick({ id: item.id, season: Number(e.target.value) })}>
                  {seasons.map((s) => (
                    <option key={s} value={s}>
                      Season {s}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <ol className="nf-eps" role="list">
              {episodes.map((o, i) => {
                if (o.kind !== "episode") return null;
                const cur = o.id === item.id;
                return (
                  <li key={o.id}>
                    <button type="button" className="nf-eprow" aria-current={cur ? "true" : undefined} onClick={() => onSwap(o)} onKeyDown={(e) => onEpisodeKey(e, i)}>
                      <span className="nf-epn">{o.e.n}</span>
                      <span className="nf-ept">
                        <span className="nf-ept-head">
                          <span className="nf-ept-title">{o.e.title}</span>
                          <span className="nf-ept-run">{o.e.runtime}</span>
                        </span>
                        <span className="nf-ept-syn">{o.e.synopsis ?? o.e.date}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {more.length ? (
          <section className="nf-m-sec" aria-labelledby="nf-m-more">
            <h3 id="nf-m-more">More like this</h3>
            <ul className="nf-more" role="list">
              {more.map((o) => {
                const f = factsOf(o);
                return (
                  <li key={o.id}>
                    <button type="button" className="nf-mcard" data-tone={f.tone} onClick={() => onSwap(o)}>
                      <span className="nf-mcard-art" aria-hidden>
                        <span>{f.letter}</span>
                      </span>
                      <span className="nf-mcard-meta">
                        <span className="nf-mcard-title">{f.title}</span>
                        <span className="nf-mcard-sub">{[f.season != null ? `S${f.season}` : f.year, f.runtime].filter(Boolean).join(" · ")}</span>
                        {f.blurb ? <span className="nf-mcard-sum">{f.blurb}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <section className="nf-m-sec nf-m-about" aria-labelledby="nf-m-about">
          <h3 id="nf-m-about">About</h3>
          <p>
            <span>Created by</span> Ratul Roy · <span>Data:</span> terminal-data.ts · <span>Maturity:</span> open to work
          </p>
        </section>
      </div>
    </div>
  );
}

/* ---------- Billboard ---------- */

function Billboard({ facts, portraitText, playing, playMs, sub, lang, onFinish, children }: { facts: NfFacts; portraitText: string; playing: boolean; playMs?: number; sub?: string; lang?: string | null; onFinish: () => void; children: React.ReactNode }) {
  const epTone = facts.tone === "main" || facts.tone === "learn" || facts.tone === "side" || facts.tone === "life";
  return (
    <div className="nf-bb" data-playing={playing || undefined}>
      <div className="nf-bb-art" aria-hidden>
        {portraitText ? <pre>{portraitText}</pre> : <span className="nf-shimmer" />}
      </div>
      {epTone ? null : (
        <span className="nf-bb-letter" aria-hidden>
          {facts.letter}
        </span>
      )}
      <div className="nf-bb-shade" aria-hidden />
      {playing ? <Teleprompter text={`${facts.title}. ${facts.blurb ?? ""}`.trim()} sub={sub} lang={lang} ms={playMs ?? 6000} onDone={onFinish} /> : null}
      <h2 className="nf-bb-title" data-hidden={playing || undefined}>
        {facts.title}
      </h2>
      {children}
    </div>
  );
}

/** Types the text over six seconds (all at once, then a short hold, under reduced motion). */
function Teleprompter({ text, sub, lang, ms, onDone }: { text: string; sub?: string; lang?: string | null; ms: number; onDone: () => void }) {
  const calm = useMemo(() => reduced(), []);
  const [chars, setChars] = useState(calm ? text.length : 0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (calm) {
      const t = window.setTimeout(() => done.current(), 2000);
      return () => window.clearTimeout(t);
    }
    const t0 = performance.now();
    let raf = 0;
    let hold = 0;
    const tick = (now: number) => {
      const c = Math.min(text.length, Math.floor(((now - t0) / ms) * text.length));
      setChars(c);
      if (c >= text.length) {
        hold = window.setTimeout(() => done.current(), 800);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(hold);
    };
  }, [calm, text, ms]);
  return (
    <p className="nf-tele2" aria-live="off">
      {text.slice(0, chars)}
      {chars < text.length ? <span className="nf-caret">▌</span> : null}
      {sub ? (
        <span className="nf-sub" lang={lang ?? undefined}>
          {sub}
        </span>
      ) : null}
    </p>
  );
}
