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
import { useLikes, useMyList, useProgress, useSound } from "./netflix-store";
import { generatePortrait } from "@/lib/site/portrait-gen";
import { NETFLIX_PROFILES, factsOf, indexItems, isNetflixProfile, rowItems, topEpisodeId, type NetflixProfileId, type NetflixShow, type NfItem } from "@/lib/site/netflix-data";
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
  const [toast, setToast] = useState<{ id: number; msg: string } | null>(null);
  const toastTimer = useRef(0);

  const notify = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), msg });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
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
        <NetflixBody {...props} show={series[profile]} profile={profile} onSwitch={switchProfile} notify={notify} />
      )}
      {toast ? (
        <div className="nf-toast" role="status" key={toast.id}>
          {toast.msg}
        </div>
      ) : null}
    </div>
  );
}

function ProfileGate({ onPick, notify }: { onPick: (id: NetflixProfileId) => void; notify: (msg: string) => void }) {
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

type ModalState = { id: string; origin: DOMRect | null; play: boolean };

function NetflixBody({ show, series, profile, status, portrait, fast, contact, onSwitch, notify }: NetflixViewProps & { show: NetflixShow; profile: NetflixProfileId; onSwitch: () => void; notify: (msg: string) => void }) {
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
  const onShow = useCallback(
    (item: NfItem, through: boolean) => {
      progress.set(item.id, through ? 1 : 0.35);
    },
    // `set` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [progress.set],
  );

  const env: CardEnv = {
    open,
    inList: list.has,
    liked: likes.has,
    toggleList: list.toggle,
    toggleLike: likes.toggle,
    progress: progress.map,
    topId,
    soundOn: sound.on,
  };

  /* ----- rows: Continue watching and My List first when there is something in them ----- */
  const rows = useMemo<DisplayRow[]>(() => {
    const pick = (ids: string[]) => ids.map((id) => index.get(id)).filter((i): i is NfItem => !!i);
    const cont = pick(progress.recent).slice(0, 14);
    const mine = pick(list.ids);
    return [
      ...(cont.length ? [{ id: "continue", title: "Continue watching", items: cont } as DisplayRow] : []),
      ...(mine.length ? [{ id: "mylist", title: "My List", items: mine } as DisplayRow] : []),
      ...show.rows.map((r): DisplayRow => (r.kind === "contact" ? { id: r.id, title: r.title, contact: true } : { id: r.id, title: r.title, items: rowItems(r) })),
    ];
  }, [index, progress.recent, list.ids, show.rows]);

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
    requestAnimationFrame(() => document.getElementById(`nf-row-${rows[0]?.id}`)?.scrollIntoView({ behavior: behavior(), block: "start" }));
  };
  const toList = () => {
    if (!list.ids.length) return notify("Add something with ＋");
    setQuery("");
    requestAnimationFrame(() => document.getElementById("nf-row-mylist")?.scrollIntoView({ behavior: behavior(), block: "start" }));
  };

  const profileMeta = NETFLIX_PROFILES.find((p) => p.id === profile);
  const modalItem = modal ? index.get(modal.id) : undefined;
  const more = topId ? index.get(topId) : undefined;
  const firstRow = show.rows[0]?.id;

  return (
    <>
      <NetflixTopbar glyph={profileMeta?.glyph ?? "R"} tone={TONES[profile]} query={query} onQuery={setQuery} onHome={toTop} onSeries={toRows} onMyList={toList} onProfiles={onSwitch} />
      <div className="nf-page" aria-hidden={modal ? true : undefined} inert={modal ? true : undefined}>
        {q ? (
          <div className="nf-results">
            <NetflixGrid items={results} env={env} query={query.trim()} />
          </div>
        ) : (
          <>
            <NetflixHero series={show} profile={profile} status={status} text={text} fast={fast} firstRowId={firstRow} onMore={more ? () => open(more, null) : undefined} sound={sound} />
            {ready ? <NetflixRows show={show} rows={rows} contact={contact} env={env} /> : <SkeletonRows />}
          </>
        )}
      </div>
      {modal && modalItem ? <NetflixModal item={modalItem} index={index} origin={modal.origin} portraitText={text} autoPlay={modal.play} onClose={close} onSwap={swap} onShow={onShow} /> : null}
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
