"use client";

/**
 * The Netflix view (17-persona-views.md §7): "Who's watching?", then the chosen profile's cut of the same
 * dataset as a billboard and rows, with the top bar, instant search, My List, Continue watching and the detail
 * modal that any card opens. The pick is remembered on the device; `?profile=` and `?title=` deep-link.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./netflix.css";
import "./netflix-rows.css";
import "./netflix-modal.css";
import { NetflixHero } from "./netflix-hero";
import { NetflixGrid, NetflixRows, type CardEnv, type DisplayRow } from "./netflix-rows";
import { NetflixModal } from "./netflix-modal";
import { NetflixTopbar } from "./netflix-topbar";
import { AUTOPILOT_TYPE_MS, AutopilotRail, autopilotSeen, useAutopilot } from "./netflix-autopilot";
import { clearHistory, useLikes, useMyList, useProgress, useSound } from "./netflix-store";
import { generatePortrait } from "@/lib/site/portrait-gen";
import { NETFLIX_PROFILES, becauseRows, castKeyOf, factsOf, indexItems, isNetflixProfile, mentionsCast, rowItems, seasonRecap, topEpisodeId, type NetflixProfileId, type NetflixShow, type NfItem } from "@/lib/site/netflix-data";
import type { TermLink, TerminalData } from "@/lib/site/terminal-data";

export type NetflixViewProps = {
  accent: string;
  /** The three cuts, built on the server from the one dataset. */
  series: Record<NetflixProfileId, NetflixShow>;
  contact: TermLink[];
  status: string;
  portrait: TerminalData["portrait"];
  /** `via=normal`: no staged motion. */
  fast: boolean;
};

type ToastAction = { label: string; run: () => void };
type Notify = (msg: string, action?: ToastAction) => void;

const PROFILE_KEY = "xp-nf-profile";
const OLD_PROFILE_KEY = "xp-series-profile";
const TONES: Record<NetflixProfileId, string> = { recruiter: "var(--nf-accent)", developer: "#2ab7b0", story: "#e8a33d" };
const NOTHING_TO_EDIT = "profiles are the three cuts of one story — nothing to edit";

/** The saved profile; with `?title=` and none saved, the full story (it holds every title) without saving it. */
function readProfile(): { id: NetflixProfileId; save: boolean } | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("profile");
    if (isNetflixProfile(q)) return { id: q, save: true };
    const v = window.localStorage.getItem(PROFILE_KEY) ?? window.localStorage.getItem(OLD_PROFILE_KEY);
    if (isNetflixProfile(v)) return { id: v, save: true };
    if (params.get("title")) return { id: "story", save: false };
    return null;
  } catch {
    return null;
  }
}

function stripParam(name: string) {
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.has(name)) {
      u.searchParams.delete(name);
      window.history.replaceState(window.history.state, "", u);
    }
  } catch {}
}

function setTitleParam(id: string) {
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("title", id);
    window.history.replaceState(window.history.state, "", u);
  } catch {}
}

export function NetflixView(props: NetflixViewProps) {
  const { accent, series } = props;
  // undefined: not read yet (the page stays dark, nothing flashes); null: ask.
  const [profile, setProfile] = useState<NetflixProfileId | null | undefined>(undefined);
  const [toast, setToast] = useState<{ id: number; msg: string; action?: ToastAction } | null>(null);
  const toastTimer = useRef(0);
  // N3: bumped to start the guided play (a fresh pick of Recruiter, or "Replay the recruiter cut").
  const [autoToken, setAutoToken] = useState(0);

  const notify = useCallback<Notify>((msg, action) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg, action });
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 6500 : 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  useEffect(() => {
    const p = readProfile();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the pick lives in localStorage and the URL, only readable after mount
    setProfile(p?.id ?? null);
    if (p?.save) {
      try {
        window.localStorage.setItem(PROFILE_KEY, p.id);
      } catch {}
      stripParam("profile");
    }
  }, []);

  const pick = useCallback((id: NetflixProfileId) => {
    try {
      window.localStorage.setItem(PROFILE_KEY, id);
    } catch {}
    window.scrollTo({ top: 0 });
    setProfile(id);
    // The guided play runs once per device, only on a fresh Recruiter pick (never a deep link or a silent restore).
    if (id === "recruiter" && !autopilotSeen() && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAutoToken((n) => n + 1);
  }, []);

  const replayCut = useCallback(() => {
    window.scrollTo({ top: 0 });
    setProfile("recruiter");
    setAutoToken((n) => n + 1);
  }, []);

  const switchProfile = useCallback(() => {
    stripParam("title");
    window.scrollTo({ top: 0 });
    setProfile(null);
  }, []);

  return (
    <div className="nf-root" style={{ "--nf-accent": accent } as React.CSSProperties} data-profile={profile ?? ""}>
      {profile === undefined ? null : profile === null ? (
        <ProfileGate onPick={pick} notify={notify} />
      ) : (
        <NetflixBody {...props} show={series[profile]} profile={profile} onSwitch={switchProfile} onReplay={replayCut} autoToken={autoToken} notify={notify} />
      )}
      {toast ? (
        <div className="nf-toast" role="status" key={toast.id}>
          {toast.msg}
          {toast.action ? (
            <button
              type="button"
              className="nf-toast-act"
              onClick={() => {
                toast.action?.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ProfileGate({ onPick, notify }: { onPick: (id: NetflixProfileId) => void; notify: Notify }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    refs.current[0]?.focus({ preventScroll: true });
  }, []);

  const move = (i: number, e: React.KeyboardEvent) => {
    const n = NETFLIX_PROFILES.length;
    let to = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") to = (i + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = (i - 1 + n) % n;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = n - 1;
    if (to < 0) return;
    e.preventDefault();
    refs.current[to]?.focus();
  };

  return (
    <main className="nf-gate">
      <h1 className="nf-gate-title">{edit ? "Manage Profiles:" : "Who’s watching?"}</h1>
      <div className="nf-profiles" role="group" aria-label="Profiles">
        {NETFLIX_PROFILES.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            className="nf-profile"
            data-edit={edit || undefined}
            style={{ "--tone": TONES[p.id], animationDelay: `${i * 80}ms` } as React.CSSProperties}
            onClick={() => (edit ? notify(NOTHING_TO_EDIT) : onPick(p.id))}
            onKeyDown={(e) => move(i, e)}
          >
            <span className="nf-tile" aria-hidden>
              <span className="nf-glyph">{p.glyph}</span>
              {edit ? (
                <span className="nf-pencil">
                  <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 20h4L19 9l-4-4L4 16z" />
                  </svg>
                </span>
              ) : null}
            </span>
            <span className="nf-pname">{p.name}</span>
            <span className="nf-pline">{p.line}</span>
          </button>
        ))}
      </div>
      <button type="button" className="nf-manage" aria-pressed={edit} onClick={() => setEdit((v) => !v)}>
        {edit ? "Done" : "Manage Profiles"}
      </button>
    </main>
  );
}

type ModalState = { id: string; origin: DOMRect | null; play: boolean; playMs?: number };

function NetflixBody({ show, series, profile, status, portrait, fast, contact, onSwitch, onReplay, autoToken, notify }: NetflixViewProps & { show: NetflixShow; profile: NetflixProfileId; onSwitch: () => void; onReplay: () => void; autoToken: number; notify: Notify }) {
  const shows = useMemo(() => Object.values(series), [series]);
  const index = useMemo(() => indexItems(shows), [shows]);
  const topId = useMemo(() => topEpisodeId(shows), [shows]);
  const list = useMyList();
  const likes = useLikes();
  const progress = useProgress();
  const sound = useSound();

  /* ----- the portrait, drawn once (the title stays the LCP); skeleton rows until then ----- */
  const [text, setText] = useState("");
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const run = () =>
      generatePortrait(portrait, "blocks", 160).then(
        (a) => !cancelled && setText(a.lines.map((l) => l.map((r) => r.t).join("")).join("\n")),
        () => {},
      );
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const idle = w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 1500 }) : window.setTimeout(run, 300);
    const t = window.setTimeout(() => setWaited(true), 700);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      if (w.requestIdleCallback) w.cancelIdleCallback?.(idle);
      else window.clearTimeout(idle);
    };
  }, [portrait]);
  const ready = text !== "" || waited;

  /* ----- the modal: ?title= opens it, closing strips it ----- */
  const trigger = useRef<{ el: HTMLElement | null; id: string } | null>(null);
  const [modal, setModal] = useState<ModalState | null>(() => {
    try {
      const id = new URLSearchParams(window.location.search).get("title");
      return id && index.has(id) ? { id, origin: null, play: false } : null;
    } catch {
      return null;
    }
  });

  const restore = useRef(false);
  const modalOpen = modal !== null;
  useEffect(() => {
    if (modalOpen || !restore.current) return;
    restore.current = false;
    const t = trigger.current;
    trigger.current = null;
    const el = t?.el?.isConnected ? t.el : t ? document.querySelector<HTMLElement>(`[data-nf-card="${CSS.escape(t.id)}"]`) : null;
    el?.focus({ preventScroll: true });
  }, [modalOpen]);

  const open = useCallback<CardEnv["open"]>((item, el, play = false) => {
    trigger.current = { el, id: item.id };
    setModal({ id: item.id, origin: el?.getBoundingClientRect() ?? null, play });
    setTitleParam(item.id);
  }, []);
  const swap = useCallback((item: NfItem) => {
    setModal((m) => (m ? { ...m, id: item.id, play: false } : m));
    setTitleParam(item.id);
  }, []);
  const close = useCallback(() => {
    setModal(null);
    stripParam("title");
    // Focus goes back to the card in the effect below, once the page is no longer inert.
    restore.current = true;
  }, []);
  // N5: the page-wide technology filter, mirrored in `?cast=`.
  const [castKey, setCastKey] = useState<string | null>(() => {
    try {
      return castKeyOf(new URLSearchParams(window.location.search).get("cast"));
    } catch {
      return null;
    }
  });
  const castList = useMemo(() => show.rows.flatMap((r) => (r.kind === "cast" ? r.items : [])), [show.rows]);
  const castLabel = castKey ? (castList.find((c) => c.key === castKey)?.name ?? castKey) : null;
  const pickCast = useCallback((key: string | null) => {
    setCastKey(key);
    try {
      const u = new URL(window.location.href);
      if (key) u.searchParams.set("cast", key);
      else u.searchParams.delete("cast");
      window.history.replaceState(window.history.state, "", u);
    } catch {}
    if (key) requestAnimationFrame(() => document.getElementById("nf-rows-top")?.scrollIntoView({ behavior: "auto", block: "start" }));
  }, []);
  const castFromModal = useCallback(
    (key: string) => {
      setModal(null);
      stripParam("title");
      pickCast(key);
    },
    [pickCast],
  );

  const onShow = useCallback(
    (item: NfItem, through: boolean) => {
      progress.set(item.id, through ? 1 : 0.35);
    },
    // `set` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress.set],
  );

  // Reduced motion gets no guided play: a static "Start here" badge on the three stops instead.
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const startHere = useMemo(() => (profile === "recruiter" && reducedMotion ? new Set(show.recruiterCut) : undefined), [profile, reducedMotion, show.recruiterCut]);

  const env: CardEnv = {
    open,
    inList: list.has,
    liked: likes.has,
    toggleList: list.toggle,
    toggleLike: likes.toggle,
    progress: progress.map,
    topId,
    soundOn: sound.on,
    startHere,
    cast: { active: castKey, label: castLabel, pick: pickCast },
  };

  /* ----- rows: Continue watching and My List first when there is something in them ----- */
  const rows = useMemo<DisplayRow[]>(() => {
    const pick = (ids: string[]) => ids.map((id) => index.get(id)).filter((i): i is NfItem => !!i);
    const cont = pick(progress.recent).slice(0, 14);
    const mine = pick(list.ids);
    // N2: up to two "Because you opened" rows from the same history, never repeating a Continue watching card.
    const seen = new Set<string>();
    const poolItems = show.rows.flatMap(rowItems).filter((it) => !seen.has(it.id) && !!seen.add(it.id));
    const because = becauseRows(progress.recent, poolItems, index, new Set(cont.map((c) => c.id))).map((b): DisplayRow => ({ id: b.id, title: b.title, items: b.items }));
    return [
      ...(cont.length ? [{ id: "continue", title: "Continue watching", items: cont } as DisplayRow] : []),
      ...because,
      ...(mine.length ? [{ id: "mylist", title: "My List", items: mine } as DisplayRow] : []),
      ...show.rows.map((r): DisplayRow => (r.kind === "contact" ? { id: r.id, title: r.title, contact: true } : r.kind === "cast" ? { id: r.id, title: r.title, cast: r.items } : { id: r.id, title: r.title, items: rowItems(r) })),
    ];
  }, [index, progress.recent, list.ids, show.rows]);

  // N5: with a technology picked, every row keeps only the cards that mention it (rows left empty go).
  const shownRows = useMemo<DisplayRow[]>(() => {
    if (!castKey) return rows;
    return rows.flatMap((r): DisplayRow[] => {
      if ("contact" in r || "cast" in r) return [r];
      const items = r.items.filter((it) => mentionsCast(it, castKey));
      return items.length ? [{ ...r, items }] : [];
    });
  }, [rows, castKey]);

  /* ----- search ----- */
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    const seen = new Set<string>();
    const out: NfItem[] = [];
    for (const r of show.rows)
      for (const it of rowItems(r)) {
        if (seen.has(it.id)) continue;
        const f = factsOf(it);
        const hay = [f.title, f.branchLabel, f.year, ...f.tags, ...f.stack].filter(Boolean).join(" ").toLowerCase();
        if (hay.includes(q)) {
          seen.add(it.id);
          out.push(it);
        }
      }
    return out;
  }, [q, show.rows]);

  /* ----- top bar actions ----- */
  const behavior = (): ScrollBehavior => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
  const toTop = () => {
    setQuery("");
    window.scrollTo({ top: 0, behavior: behavior() });
  };
  const toRows = () => {
    setQuery("");
    requestAnimationFrame(() => document.getElementById(`nf-row-${shownRows[0]?.id}`)?.scrollIntoView({ behavior: behavior(), block: "start" }));
  };
  const toList = () => {
    if (!list.ids.length) return notify("Add something with ＋");
    setQuery("");
    requestAnimationFrame(() => document.getElementById("nf-row-mylist")?.scrollIntoView({ behavior: behavior(), block: "start" }));
  };

  const askClear = () =>
    notify("Clear watch history, My List and thumbs-up on this device?", {
      label: "Clear",
      run: () => {
        clearHistory();
        notify("Watch history cleared");
      },
    });

  /* ----- N4: a season's recap types in the hero's trailer panel ----- */
  const [recap, setRecap] = useState<{ key: number; lines: string[] } | null>(null);
  const endRecap = useCallback(() => setRecap(null), []);
  const playRecap = (year: number) => {
    const lines = seasonRecap(show, year);
    if (!lines.length) return;
    window.scrollTo({ top: 0, behavior: behavior() });
    setRecap({ key: Date.now(), lines });
  };

  /* ----- N3: the Recruiter cut ----- */
  const openStop = (id: string): boolean => {
    const item = index.get(id);
    const el = document.querySelector<HTMLElement>(`[data-nf-card="${CSS.escape(id)}"]`);
    if (!item || !el) return false;
    el.scrollIntoView({ behavior: "auto", block: "center" });
    trigger.current = { el, id };
    setModal({ id, origin: el.getBoundingClientRect(), play: true, playMs: AUTOPILOT_TYPE_MS });
    setTitleParam(id);
    return true;
  };
  const closeModalSoft = () => {
    if (document.querySelector('[aria-modal="true"].nf-m')) window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  };
  const finishCut = () => {
    document.getElementById("nf-row-tbc")?.scrollIntoView({ behavior: behavior(), block: "center" });
    const hello = document.querySelector<HTMLElement>("#nf-row-tbc .nf-btn-play");
    hello?.classList.add("nf-pulse");
    window.setTimeout(() => hello?.classList.remove("nf-pulse"), 6000);
  };
  const autopilot = useAutopilot({ cut: show.recruiterCut, openStop, closeModal: closeModalSoft, finish: finishCut });
  const startCut = autopilot.start;
  const stopCut = autopilot.stop;
  const lastToken = useRef(0);
  useEffect(() => {
    if (!autoToken || autoToken === lastToken.current || !ready || profile !== "recruiter") return;
    lastToken.current = autoToken;
    if (reducedMotion) {
      notify("Look for the Start here badges on three cards");
      return;
    }
    // Let the rows paint and the visitor see the page first.
    const t = window.setTimeout(startCut, 1400);
    return () => window.clearTimeout(t);
  }, [autoToken, ready, profile, reducedMotion, startCut, notify]);
  // Leaving the page's recruiter cut (another profile, a search) ends the play.
  useEffect(() => {
    if (profile !== "recruiter" || q) stopCut();
  }, [profile, q, stopCut]);

  const profileMeta = NETFLIX_PROFILES.find((p) => p.id === profile);
  const modalItem = modal ? index.get(modal.id) : undefined;
  const more = topId ? index.get(topId) : undefined;
  const firstRow = show.rows[0]?.id;

  return (
    <>
      <NetflixTopbar glyph={profileMeta?.glyph ?? "R"} tone={TONES[profile]} query={query} onQuery={setQuery} onHome={toTop} onSeries={toRows} onMyList={toList} onProfiles={onSwitch} onClearHistory={askClear} onReplay={onReplay} />
      {autopilot.state ? <AutopilotRail state={autopilot.state} onSkip={autopilot.skip} onStop={autopilot.stop} /> : null}
      <div className="nf-page" aria-hidden={modal ? true : undefined} inert={modal ? true : undefined}>
        {q ? (
          <div className="nf-results">
            <NetflixGrid items={results} env={env} query={query.trim()} />
          </div>
        ) : (
          <>
            <NetflixHero series={show} profile={profile} status={status} text={text} fast={fast} firstRowId={firstRow} onMore={more ? () => open(more, null) : undefined} sound={sound} recap={recap} onRecapEnd={endRecap} />
            {ready ? <NetflixRows show={show} rows={shownRows} contact={contact} env={env} onRecap={profile === "story" ? playRecap : undefined} /> : <SkeletonRows />}
          </>
        )}
      </div>
      {modal && modalItem ? <NetflixModal item={modalItem} index={index} origin={modal.origin} portraitText={text} autoPlay={modal.play} playMs={modal.playMs} cast={castList} onCast={castFromModal} onClose={close} onSwap={swap} onShow={onShow} /> : null}
    </>
  );
}

/** Shimmering placeholder rows while the portrait draws. */
function SkeletonRows() {
  return (
    <div className="nf-rows nf-skeleton" aria-hidden>
      {[0, 1].map((r) => (
        <div className="nf-row" key={r}>
          <span className="nf-sk-title nf-shimmer" />
          <div className="nf-sk-row">
            {Array.from({ length: 6 }, (_, i) => (
              <span className="nf-sk-card nf-shimmer" key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
