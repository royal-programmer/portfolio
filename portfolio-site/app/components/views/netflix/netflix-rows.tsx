"use client";

/**
 * The rows (17-persona-views.md §7): horizontal rows of episode, project and skill cards, the sticky season
 * bar, the instant-search grid and the "To be continued" card with the footer. Any card opens the detail modal
 * (netflix-modal.tsx); desktop episode cards also grow on hover with play, add, like and more under the title.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CastMember, Episode, NetflixShow, NfItem, ProjectCard, SkillCard } from "@/lib/site/netflix-data";
import type { TermLink } from "@/lib/site/terminal-data";
import { PROFILES } from "@/lib/site/profiles";
import { useViewExit } from "../view-shell";
import { tick } from "./netflix-sound";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const behavior = (): ScrollBehavior => (reducedMotion() ? "auto" : "smooth");

export type DisplayRow = { id: string; title: string; items: NfItem[] } | { id: string; title: string; contact: true } | { id: string; title: string; cast: CastMember[] };

/** What every card needs from the view: open the modal, the local lists, the rank badge, the sound. */
export type CardEnv = {
  open: (item: NfItem, el: HTMLElement | null, play?: boolean) => void;
  inList: (id: string) => boolean;
  liked: (id: string) => boolean;
  toggleList: (id: string) => void;
  toggleLike: (id: string) => void;
  progress: Record<string, number>;
  topId: string | null;
  soundOn: boolean;
  /** Cards the Recruiter cut starts with, badged "Start here" (reduced motion only). */
  startHere?: ReadonlySet<string>;
  /** The page-wide technology filter (N5): the active key and the toggle. */
  cast: { active: string | null; label: string | null; pick: (key: string | null) => void };
  /** A pasted job description is rating the cards (N7): the percent per card, the counts for the pill, and the way out. */
  fit?: { byId: ReadonlyMap<string, number>; matched: number; total: number; clear: () => void };
};

/** The top-left percent on a card while a description is active. */
const FitBadge = ({ env, id }: { env: CardEnv; id: string }) => {
  const pct = env.fit?.byId.get(id);
  return pct != null ? <span className="nf-fit">{pct}% fit</span> : null;
};

/** `Fit: <k> skills matched · clear`, under the top bar while a description is active. */
function FitPill({ env }: { env: CardEnv }) {
  const f = env.fit;
  if (!f) return null;
  return (
    <div className="nf-castpill nf-fitpill" role="status">
      <span>
        Fit: <b>{f.total ? `${f.matched} ${f.matched === 1 ? "skill" : "skills"} matched` : "no skills recognised"}</b>
      </span>
      <button type="button" onClick={f.clear}>
        clear
      </button>
    </div>
  );
}

type Props = { show: NetflixShow; rows: DisplayRow[]; contact: TermLink[]; env: CardEnv; onRecap?: (year: number) => void };

export function NetflixRows({ show, rows, contact, env, onRecap }: Props) {
  return (
    <>
      <SeasonBar show={show} onRecap={onRecap} />
      <FitPill env={env} />
      {env.cast.active ? (
        <div className="nf-castpill">
          <span>
            Showing: <b>{env.cast.label}</b>
          </span>
          <button type="button" onClick={() => env.cast.pick(null)}>
            clear
          </button>
        </div>
      ) : null}
      <div className="nf-rows" id="nf-rows-top">
        {rows.map((row) => ("contact" in row ? <ContinuedRow key={row.id} row={row} contact={contact} /> : "cast" in row ? <CastRow key={row.id} row={row} env={env} /> : <Row key={row.id} row={row} env={env} />))}
      </div>
      <footer className="nf-footer">Every row is data &middot; views are picked in the terminal &middot; &copy; 2026 Ratul Roy</footer>
    </>
  );
}

/* ---------- Season bar ---------- */

function SeasonBar({ show, onRecap }: { show: NetflixShow; onRecap?: (year: number) => void }) {
  const [active, setActive] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const ids = show.nav.map((n) => n.id).join("|");

  useEffect(() => {
    const els = ids
      .split("|")
      .map((id) => document.getElementById(`nf-row-${id}`))
      .filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) if (en.isIntersecting) setActive(en.target.id.replace("nf-row-", ""));
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [ids]);

  // Keep the active chip visible inside the bar (phones scroll it sideways).
  useEffect(() => {
    const b = bar.current;
    const chip = b?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!b || !chip) return;
    b.scrollTo({ left: chip.offsetLeft - b.clientWidth / 2 + chip.clientWidth / 2, behavior: behavior() });
  }, [active]);

  return (
    <nav className="nf-seasons" aria-label="Seasons">
      <div className="nf-chips" ref={bar}>
        {show.nav.map((n) => {
          const year = /^s(\d{4})$/.test(n.id) ? Number(n.id.slice(1)) : null;
          return (
            <span className="nf-chipwrap" key={n.id}>
              <button
                type="button"
                className="nf-chip"
                aria-current={active === n.id ? "true" : undefined}
                data-recap={year && onRecap ? "" : undefined}
                onClick={() => document.getElementById(`nf-row-${n.id}`)?.scrollIntoView({ behavior: behavior(), block: "start" })}
              >
                {n.label}
              </button>
              {year && onRecap ? (
                <button type="button" className="nf-chip-play" aria-label={`Play the Season ${year} recap`} title={`Season ${year} recap`} onClick={() => onRecap(year)}>
                  <span aria-hidden>▶</span>
                </button>
              ) : null}
            </span>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------- A row ---------- */

function Row({ row, env }: { row: Extract<DisplayRow, { items: NfItem[] }>; env: CardEnv }) {
  const scroller = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdge({ l: el.scrollLeft > 4, r: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // The wheel scrolls the row only when it can and the gesture is sideways (or shift): the page keeps its own scroll.
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth) return;
      const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      if (!sideways && !e.shiftKey) return;
      e.preventDefault();
      el.scrollLeft += e.deltaX || e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", onWheel);
    };
  }, [measure]);

  const by = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.8, behavior: behavior() });
  const hasEpisodes = row.items.some((i) => i.kind === "episode");

  return (
    <section className="nf-row" id={`nf-row-${row.id}`} aria-labelledby={`nf-h-${row.id}`} data-ep={hasEpisodes ? "" : undefined}>
      <h2 className="nf-row-title" id={`nf-h-${row.id}`}>
        {row.title} <span className="nf-count">&middot; {row.items.length}</span>
      </h2>
      <div className="nf-row-body">
        {edge.l ? (
          <button type="button" className="nf-edge nf-edge-l" aria-label={`${row.title}: earlier`} onClick={() => by(-1)}>
            ◀
          </button>
        ) : null}
        <ul className="nf-scroller" role="list" ref={scroller} onScroll={measure}>
          {row.items.map((it) => (
            <Card key={it.id} item={it} env={env} />
          ))}
        </ul>
        {edge.r ? (
          <button type="button" className="nf-edge nf-edge-r" aria-label={`${row.title}: later`} onClick={() => by(1)}>
            ▶
          </button>
        ) : null}
      </div>
    </section>
  );
}

/** The Cast row (N5): one tile per technology, how many episodes mention it; a tile filters the whole page. */
function CastRow({ row, env }: { row: { id: string; title: string; cast: CastMember[] }; env: CardEnv }) {
  return (
    <section className="nf-row" id={`nf-row-${row.id}`} aria-labelledby={`nf-h-${row.id}`}>
      <h2 className="nf-row-title" id={`nf-h-${row.id}`}>
        {row.title} <span className="nf-count">&middot; {row.cast.length}</span>
      </h2>
      <div className="nf-row-body">
        <ul className="nf-scroller" role="list">
          {row.cast.map((c) => (
            <li key={c.id} className="nf-skill-li">
              <button type="button" className="nf-cast" aria-pressed={env.cast.active === c.key} onClick={() => env.cast.pick(env.cast.active === c.key ? null : c.key)}>
                <span className="nf-cast-name">{c.name}</span>
                <span className="nf-cast-n">
                  appears in {c.count} {c.count === 1 ? "episode" : "episodes"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** The instant-search results: every match as a card in a grid, replacing the rows. */
export function NetflixGrid({ items, env, query }: { items: NfItem[]; env: CardEnv; query: string }) {
  return (
    <section className="nf-search" aria-label="Search results">
      <FitPill env={env} />
      <h2 className="nf-row-title">
        {items.length ? `Results for “${query}”` : `Nothing matches “${query}”`} <span className="nf-count">&middot; {items.length}</span>
      </h2>
      {items.length ? (
        <ul className="nf-grid" role="list">
          {items.map((it) => (
            <Card key={it.id} item={it} env={env} />
          ))}
        </ul>
      ) : (
        <p className="nf-empty">Try a year, a tool, or a word from a title.</p>
      )}
    </section>
  );
}

function Card({ item, env }: { item: NfItem; env: CardEnv }) {
  if (item.kind === "episode") return <EpisodeCard e={item.e} item={item} env={env} />;
  if (item.kind === "skill") return <SkillTile s={item.s} item={item} env={env} />;
  return <PosterCard c={item.c} item={item} env={env} />;
}

const Bar = ({ value }: { value?: number }) =>
  value ? (
    <span className="nf-prog" aria-hidden>
      <span style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  ) : null;

/* ---------- Hover teaser (one card at a time) ---------- */

let activeTeaser: { token: object; stop: () => void } | null = null;
const TEASER_MAX = 140;

/** After 800 ms of hover the card's art types a teaser (24 chars/s; at once under reduced motion). `text` is null while idle. */
function useTeaser(source: string, sound: boolean) {
  const full = source.length > TEASER_MAX ? `${source.slice(0, TEASER_MAX - 1).trimEnd()}…` : source;
  const [text, setText] = useState<string | null>(null);
  const token = useRef({});
  const wait = useRef(0);
  const type = useRef(0);
  const stop = useCallback(() => {
    window.clearTimeout(wait.current);
    window.clearInterval(type.current);
    if (activeTeaser?.token === token.current) activeTeaser = null;
    setText(null);
  }, []);
  const arm = () => {
    window.clearTimeout(wait.current);
    wait.current = window.setTimeout(() => {
      if (activeTeaser && activeTeaser.token !== token.current) activeTeaser.stop();
      activeTeaser = { token: token.current, stop };
      if (reducedMotion()) return setText(full);
      let n = 0;
      setText("");
      type.current = window.setInterval(() => {
        n += 1;
        setText(full.slice(0, n));
        if (sound && n % 4 === 0) tick();
        if (n >= full.length) window.clearInterval(type.current);
      }, 1000 / 24);
    }, 800);
  };
  useEffect(
    () => () => {
      window.clearTimeout(wait.current);
      window.clearInterval(type.current);
    },
    [],
  );
  return { text, typing: text !== null && text.length < full.length, arm, stop };
}

function EpisodeCard({ e, item, env }: { e: Episode; item: NfItem; env: CardEnv }) {
  const li = useRef<HTMLLIElement>(null);
  const timer = useRef(0);
  const main = () => li.current?.querySelector<HTMLElement>("[data-nf-card]") ?? null;
  const inList = env.inList(item.id);
  const liked = env.liked(item.id);
  const top = env.topId === item.id;

  const teaser = useTeaser(e.synopsis ?? e.title, env.soundOn);

  // A soft tick as the card expands (desktop, unmuted); after 800 ms the teaser starts typing over the art.
  const enter = (ev: React.PointerEvent) => {
    if (ev.pointerType !== "mouse") return;
    if (env.soundOn) timer.current = window.setTimeout(tick, 180);
    teaser.arm();
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    teaser.stop();
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <li className="nf-ep" ref={li} data-branch={e.branch} onPointerEnter={enter} onPointerLeave={leave}>
      <button type="button" className="nf-card" data-nf-card={item.id} aria-label={`${e.title}, season ${e.season} episode ${e.n}${top ? ", Top 10" : ""}`} onClick={(ev) => env.open(item, ev.currentTarget)}>
        {top ? (
          <span className="nf-top" aria-hidden>
            <span>TOP</span>
            <b>10</b>
          </span>
        ) : null}
        {env.startHere?.has(item.id) ? <span className="nf-start">Start here</span> : null}
        <FitBadge env={env} id={item.id} />
        <span className="nf-num" aria-hidden>
          S{e.season} E{e.n}
        </span>
        <span className="nf-card-title">{e.title}</span>
        <span className="nf-card-strip">{[e.runtime, e.tag, e.grade].filter(Boolean).join(" · ")}</span>
        {teaser.text !== null ? (
          <span className="nf-teaser" aria-hidden>
            {teaser.text}
            {teaser.typing ? <span className="nf-caret">▌</span> : null}
          </span>
        ) : null}
        <Bar value={env.progress[item.id]} />
      </button>
      <div className="nf-panel">
        <div className="nf-mini" role="group" aria-label={`${e.title}: actions`}>
          <button type="button" className="nf-round nf-round-s" aria-label="Play" title="Play" onClick={() => env.open(item, main(), true)}>
            <span aria-hidden>▶</span>
          </button>
          <button type="button" className="nf-round nf-round-s" aria-label={inList ? "Remove from My List" : "Add to My List"} aria-pressed={inList} title={inList ? "Remove from My List" : "Add to My List"} onClick={() => env.toggleList(item.id)}>
            <span aria-hidden>{inList ? "✓" : "＋"}</span>
          </button>
          <button type="button" className="nf-round nf-round-s" aria-label={liked ? "Remove your thumbs-up" : "I like this"} aria-pressed={liked} title="I like this" onClick={() => env.toggleLike(item.id)}>
            <span aria-hidden>👍</span>
          </button>
          <button type="button" className="nf-round nf-round-s nf-mini-more" aria-label="More info" title="More info" onClick={() => env.open(item, main())}>
            <span aria-hidden>⌄</span>
          </button>
        </div>
        <p>{e.synopsis ?? e.title}</p>
      </div>
    </li>
  );
}

function PosterCard({ c, item, env }: { c: ProjectCard; item: NfItem; env: CardEnv }) {
  return (
    <li className="nf-poster">
      {env.startHere?.has(item.id) ? <span className="nf-start">Start here</span> : null}
      <FitBadge env={env} id={item.id} />
      <button type="button" className="nf-poster-title nf-stretch" data-nf-card={item.id} onClick={(ev) => env.open(item, ev.currentTarget)}>
        {c.title}
      </button>
      {c.summary ? <p className="nf-poster-sum">{c.summary}</p> : null}
      {c.stack.length ? (
        <ul className="nf-chips-mini" role="list">
          {c.stack.slice(0, 3).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}
      {c.live || c.repo ? (
        <div className="nf-poster-links">
          {c.live ? (
            <a href={c.live} target="_blank" rel="noreferrer">
              Live
            </a>
          ) : null}
          {c.repo ? (
            <a href={c.repo} target="_blank" rel="noreferrer">
              Code
            </a>
          ) : null}
        </div>
      ) : null}
      <Bar value={env.progress[item.id]} />
    </li>
  );
}

function SkillTile({ s, item, env }: { s: SkillCard; item: NfItem; env: CardEnv }) {
  return (
    <li className="nf-skill-li">
      <button type="button" className="nf-skill" data-nf-card={item.id} title={s.group} onClick={(ev) => env.open(item, ev.currentTarget)}>
        <FitBadge env={env} id={item.id} />
        <span className="nf-skill-name">{s.name}</span>
        <span className="nf-skill-group">{s.group}</span>
        <Bar value={env.progress[item.id]} />
      </button>
    </li>
  );
}

/* ---------- To be continued ---------- */

function ContinuedRow({ row, contact }: { row: { id: string; title: string }; contact: TermLink[] }) {
  const exit = useViewExit();
  const link = (label: string) => contact.find((c) => c.label === label)?.href;
  const mail = link("mail");
  const linkedin = link("linkedin");
  const github = link("github");
  const so = PROFILES.find((p) => p.id === "stackoverflow")?.href;
  return (
    <section className="nf-row" id={`nf-row-${row.id}`} aria-labelledby={`nf-h-${row.id}`} data-kind="contact">
      <h2 className="nf-visually-hidden" id={`nf-h-${row.id}`}>
        {row.title}
      </h2>
      <div className="nf-tbc">
        <p className="nf-tbc-title">To be continued&hellip;</p>
        <p className="nf-tbc-sub">Next episode: your team?</p>
        <div className="nf-tbc-actions">
          {mail ? (
            <a className="nf-btn nf-btn-play" href={mail}>
              Say hello
            </a>
          ) : null}
          {linkedin ? (
            <a className="nf-btn nf-btn-glass" href={linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          ) : null}
          {github ? (
            <a className="nf-btn nf-btn-glass" href={github} target="_blank" rel="noreferrer">
              GitHub
            </a>
          ) : null}
          {so ? (
            <a className="nf-btn nf-btn-glass" href={so} target="_blank" rel="noreferrer">
              Stack Overflow
            </a>
          ) : null}
          {exit ? (
            <button type="button" className="nf-btn nf-btn-glass" onClick={exit}>
              Back to the terminal
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
