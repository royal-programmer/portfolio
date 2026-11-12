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
import "./netflix-art.css";
import { NetflixHero } from "./netflix-hero";
import { NetflixGrid, NetflixRows, type CardEnv, type DisplayRow } from "./netflix-rows";
import { NetflixModal } from "./netflix-modal";
import { NetflixTopbar } from "./netflix-topbar";
import { NetflixHireSheet, NetflixTabBar } from "./netflix-tabbar";
import { NetflixHireBar } from "./netflix-hirebar";
import { NetflixSeo } from "./netflix-seo";
import { AUTOPILOT_TYPE_MS, AutopilotRail, autopilotSeen, useAutopilot } from "./netflix-autopilot";
import { JD_MIN, netflixFit, sortByFit } from "@/lib/site/netflix-fit";
import type { FitPool } from "@/lib/site/terminal-fit";
import { seasonSub, type NfLine, type SubData } from "@/lib/site/netflix-subs";
import { KeysOverlay, useNetflixKeys } from "./netflix-keys";
import { chime } from "./netflix-sound";
import { clearHistory, useCc, useLikes, useMyList, useProgress, useSound } from "./netflix-store";
import { NETFLIX_PROFILES, becauseRows, castKeyOf, factsOf, indexItems, isNetflixProfile, mentionsCast, rowItems, seasonRecap, top10Of, type HireSheet, TOP10_ROW_TITLE, topEpisodeId, type NetflixProfileId, type NetflixShow, type NfItem } from "@/lib/site/netflix-data";
import type { TermLink, TerminalData } from "@/lib/site/terminal-data";

export type NetflixViewProps = {
  accent: string;
  /** The phone Hire sheet's contents (C4). */
  hire: HireSheet;
  /** The three cuts, built on the server from the one dataset. */
  series: Record<NetflixProfileId, NetflixShow>;
  contact: TermLink[];
  status: string;
  portrait: TerminalData["portrait"];
  /** What a pasted job description is weighed against (N7). */
  fitPool: FitPool;
  /** What I am doing now (the end-of-season card shows it). */
  now?: { month: string; lines: string[] };
  /** The translated facts the subtitles (CC) come from (N8). */
  subData: SubData;
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
    <main className="nf-root" style={{ "--nf-accent": accent } as React.CSSProperties} data-profile={profile ?? ""}>
      <NetflixSeo series={series} contact={props.contact} />
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
    </main>
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
    <div className="nf-gate">
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
    </div>
  );
}

type ModalState = { id: string; origin: DOMRect | null; play: boolean; playMs?: number };

function NetflixBody({ show, series, profile, status, hire, fitPool, subData, now, fast, contact, onSwitch, onReplay, autoToken, notify }: NetflixViewProps & { show: NetflixShow; profile: NetflixProfileId; onSwitch: () => void; onReplay: () => void; autoToken: number; notify: Notify }) {
  const shows = useMemo(() => Object.values(series), [series]);
  const index = useMemo(() => indexItems(shows), [shows]);
  const topId = useMemo(() => topEpisodeId(shows), [shows]);
  const list = useMyList();
  const likes = useLikes();
  const progress = useProgress();
  const sound = useSound();
  const cc = useCc();

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
  // C4: the phone Hire sheet and the tab bar's Search signal.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchToken, setSearchToken] = useState(0);
  const [tab, setTab] = useState<"home" | "search" | "list" | "hire">("home");
  const lang = cc.on && cc.lang ? cc.lang : "en";
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  // N9: remote-control keys, and the `?` overlay that lists them.
  const [keysOpen, setKeysOpen] = useState(false);
  const said = useNetflixKeys({
    modalOpen: modalOpen || sheetOpen,
    keysOpen,
    toggleKeys: () => setKeysOpen((v) => !v),
    toggleMute: () => {
      if (!sound.on) chime();
      sound.toggle();
    },
  });
  useEffect(() => {
    if (modalOpen || !restore.current) return;
    restore.current = false;
    const t = trigger.current;
    trigger.current = null;
    const el = t?.el?.isConnected ? t.el : t ? document.querySelector<HTMLElement>(`[data-nf-card="${CSS.escape(t.id)}"]`) : null;
    el?.focus({ preventScroll: true });
  }, [modalOpen]);

  const [opens, setOpens] = useState(0);
  const open = useCallback<CardEnv["open"]>((item, el, play = false) => {
    trigger.current = { el, id: item.id };
    setOpens((n) => n + 1);
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

  // N7: a pasted job description (held in memory only) rates every card with the terminal's fit engine.
  const [jd, setJd] = useState<string | null>(null);
  const fit = useMemo(() => (jd ? netflixFit(jd, fitPool, [...index.values()]) : null), [jd, fitPool, index]);

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
    fit: fit ? { byId: fit.byId, matched: fit.matched, total: fit.total, clear: () => setJd(null) } : undefined,
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
    const topRow: DisplayRow[] = profile === "story" ? [] : [{ id: "top10", title: TOP10_ROW_TITLE, items: top10Of(show), top10: true }];
    const base = show.rows.map((r): DisplayRow => (r.kind === "contact" ? { id: r.id, title: r.title, contact: true } : r.kind === "cast" ? { id: r.id, title: r.title, cast: r.items } : r.kind === "series" ? { id: r.id, title: r.title, certs: r.items } : { id: r.id, title: r.title, items: rowItems(r) }));
    // Developer: right after Projects (the first row); Recruiter: before the work rows, after Continue / Because / My List.
    // D2: "Trending now" from live public commits: Developer's second row, Recruiter's right after Top 10 (never in Story).
    const trend: DisplayRow[] = profile === "story" ? [] : [{ id: "trending", title: "Trending now", trending: true }];
    const withTop = profile === "developer" ? [base[0], ...trend, ...topRow, ...base.slice(1)] : [...topRow, ...trend, ...base];
    return [
      ...(cont.length ? [{ id: "continue", title: "Continue watching", items: cont } as DisplayRow] : []),
      ...because,
      ...(mine.length ? [{ id: "mylist", title: "My List", items: mine } as DisplayRow] : []),
      ...withTop,
    ];
  }, [index, progress.recent, list.ids, show, profile]);

  // N5: with a technology picked, every row keeps only the cards that mention it (rows left empty go).
  const shownRows = useMemo<DisplayRow[]>(() => {
    if (!castKey) return rows;
    return rows.flatMap((r): DisplayRow[] => {
      if ("contact" in r || "cast" in r || "trending" in r || "certs" in r) return [r];
      const items = r.items.filter((it) => mentionsCast(it, castKey));
      return items.length ? [{ ...r, items }] : [];
    });
  }, [rows, castKey]);

  // N7: with a description active, each row's cards sort by fit, highest first.
  const ratedRows = useMemo<DisplayRow[]>(() => {
    if (!fit) return shownRows;
    return shownRows.map((r) => ("items" in r ? { ...r, items: sortByFit(r.items, fit.byId) } : r));
  }, [shownRows, fit]);

  /* ----- search ----- */
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const rawResults = useMemo(() => {
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

  const results = useMemo(() => (fit ? sortByFit(rawResults, fit.byId) : rawResults), [rawResults, fit]);

  // A long paste (or a long typed line) is a job description, not a search.
  const onQuery = useCallback((v: string) => {
    if (v.trim().length >= JD_MIN) {
      setJd(v);
      setQuery("");
    } else setQuery(v);
  }, []);
  const onPasteText = useCallback((v: string) => {
    if (v.trim().length < JD_MIN) return false;
    setJd(v);
    setQuery("");
    return true;
  }, []);

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
  const [recap, setRecap] = useState<{ key: number; lines: NfLine[] } | null>(null);
  const endRecap = useCallback(() => setRecap(null), []);
  const playRecap = (year: number) => {
    const lines = seasonRecap(show, year);
    if (!lines.length) return;
    window.scrollTo({ top: 0, behavior: behavior() });
    // The first line is "Season <year> · <n> episodes": the one line of a recap with a translation.
    const row = show.rows.find((r) => r.id === `s${year}`);
    const count = row?.kind === "episodes" ? row.items.length : 0;
    setRecap({ key: Date.now(), lines: lines.map((text, i) => ({ text, sub: i === 0 && cc.on && cc.lang ? seasonSub(year, count, cc.lang) : undefined })) });
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
    if (!autoToken || autoToken === lastToken.current || profile !== "recruiter") return;
    lastToken.current = autoToken;
    if (reducedMotion) {
      notify("Look for the Start here badges on three cards");
      return;
    }
    // Let the rows paint and the visitor see the page first.
    const t = window.setTimeout(startCut, 1400);
    return () => window.clearTimeout(t);
  }, [autoToken, profile, reducedMotion, startCut, notify]);
  // Leaving the page's recruiter cut (another profile, a search) ends the play.
  useEffect(() => {
    if (profile !== "recruiter" || q) stopCut();
  }, [profile, q, stopCut]);

  const profileMeta = NETFLIX_PROFILES.find((p) => p.id === profile);
  const modalItem = modal ? index.get(modal.id) : undefined;
  const features = useMemo(() => show.featured.flatMap((f) => { const item = index.get(f.id); return item ? [{ item, label: f.label }] : []; }), [show.featured, index]);
  const firstRow = show.rows[0]?.id;

  return (
    <>
      <NetflixTopbar title={show.title} searchToken={searchToken} glyph={profileMeta?.glyph ?? "R"} tone={TONES[profile]} query={query} onQuery={onQuery} onPasteText={onPasteText} onHome={toTop} onSeries={toRows} onMyList={toList} onProfiles={onSwitch} onClearHistory={askClear} onReplay={onReplay} onKeys={() => setKeysOpen(true)} profile={profile} />
      <div className="nf-visually-hidden" role="status" aria-live="polite">
        {said}
      </div>
      {keysOpen ? <KeysOverlay onClose={() => setKeysOpen(false)} /> : null}
      {autopilot.state ? <AutopilotRail state={autopilot.state} onSkip={autopilot.skip} onStop={autopilot.stop} /> : null}
      <div className="nf-page" aria-hidden={modal || sheetOpen ? true : undefined} inert={modal || sheetOpen ? true : undefined}>
        {q ? (
          <div className="nf-results">
            <NetflixGrid items={results} env={env} query={query.trim()} />
          </div>
        ) : (
          <>
            <NetflixHero series={show} profile={profile} status={status} fast={fast} firstRowId={firstRow} features={features} onOpen={(item, play) => open(item, null, play)} held={modal !== null} sound={sound} recap={recap} onRecapEnd={endRecap} cc={cc} subData={subData} />
            <NetflixRows show={show} rows={ratedRows} contact={contact} env={env} onRecap={profile === "story" ? playRecap : undefined} />
          </>
        )}
      </div>
      <NetflixTabBar
        lang={lang}
        active={q ? "search" : tab}
        listDot={list.ids.length > 0}
        onHome={() => {
          setTab("home");
          toTop();
        }}
        onSearch={() => {
          setTab("search");
          setSearchToken((n) => n + 1);
        }}
        onList={() => {
          setTab("list");
          toList();
        }}
        onHire={() => {
          setTab("hire");
          setSheetOpen(true);
        }}
      />
      <NetflixHireBar hire={hire} opens={opens} hold={modal !== null || sheetOpen || !!autopilot.state} />
      {sheetOpen ? <NetflixHireSheet lang={lang} hire={hire} onClose={closeSheet} /> : null}
      {modal && modalItem ? <NetflixModal item={modalItem} index={index} origin={modal.origin} autoPlay={modal.play} playMs={modal.playMs} cast={castList} profile={profile} now={now} contact={contact} onCast={castFromModal} onClose={close} onSwap={swap} onShow={onShow} /> : null}
    </>
  );
}
