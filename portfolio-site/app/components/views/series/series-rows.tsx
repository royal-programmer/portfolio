"use client";

/**
 * The series' rows (17-persona-views.md §7): horizontal rows of episode, project and skill cards, the
 * sticky season bar, the inline episode sheet, and the "To be continued" card with the footer.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Episode, ProjectCard, Series, SeriesRow, SkillCard } from "@/lib/site/series-data";
import type { TermLink } from "@/lib/site/terminal-data";
import { useViewExit } from "../view-shell";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const behavior = (): ScrollBehavior => (reducedMotion() ? "auto" : "smooth");

/** What the inline sheet shows, whichever card it came from. */
type Sheet = { rowId: string; key: string; title: string; meta: string[]; body?: string; links: Array<{ label: string; href: string; external?: boolean }> };

const BRANCH_LABEL: Record<Episode["branch"], string> = { main: "work", learn: "learning", side: "side quest", life: "life" };

function episodeSheet(rowId: string, e: Episode): Sheet {
  return {
    rowId,
    key: e.id,
    title: e.title,
    meta: [e.date, BRANCH_LABEL[e.branch], e.runtime, ...(e.tag ? [`#${e.tag}`] : []), ...(e.grade ? [`grade ${e.grade}`] : [])],
    body: e.synopsis,
    links: e.href ? [{ label: "Open", href: e.href }] : [],
  };
}

function cardSheet(rowId: string, c: ProjectCard): Sheet {
  return {
    rowId,
    key: c.id,
    title: c.title,
    meta: [...(c.year ? [c.year] : []), c.kind, ...c.stack],
    body: c.summary,
    links: [
      ...(c.href ? [{ label: "Open", href: c.href }] : []),
      ...(c.live ? [{ label: "Live", href: c.live, external: true }] : []),
      ...(c.repo ? [{ label: "Code", href: c.repo, external: true }] : []),
    ],
  };
}

type Props = { series: Series; contact: TermLink[] };

export function SeriesRows({ series, contact }: Props) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const trigger = useRef<HTMLElement | null>(null);

  const open = useCallback((s: Sheet, el: HTMLElement) => {
    trigger.current = el;
    setSheet((cur) => (cur?.key === s.key ? null : s));
  }, []);
  const close = useCallback(() => {
    setSheet(null);
    const el = trigger.current;
    trigger.current = null;
    // After the sheet unmounts.
    requestAnimationFrame(() => el?.focus({ preventScroll: true }));
  }, []);

  return (
    <>
      <SeasonBar series={series} />
      <div className="sr-rows">
        {series.rows.map((row) =>
          row.kind === "contact" ? (
            <ContinuedRow key={row.id} row={row} contact={contact} />
          ) : (
            <Row key={row.id} row={row} sheet={sheet?.rowId === row.id ? sheet : null} onOpen={open} onClose={close} />
          ),
        )}
      </div>
      <footer className="sr-footer">Every row is data &middot; views are picked in the terminal &middot; &copy; 2026 Ratul Roy</footer>
    </>
  );
}

/* ---------- Season bar ---------- */

function SeasonBar({ series }: { series: Series }) {
  const [active, setActive] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const ids = series.nav.map((n) => n.id).join("|");

  useEffect(() => {
    const els = ids
      .split("|")
      .map((id) => document.getElementById(`sr-row-${id}`))
      .filter((e): e is HTMLElement => !!e);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) if (en.isIntersecting) setActive(en.target.id.replace("sr-row-", ""));
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
    <nav className="sr-seasons" aria-label="Seasons">
      <div className="sr-chips" ref={bar}>
        {series.nav.map((n) => (
          <button
            key={n.id}
            type="button"
            className="sr-chip"
            aria-current={active === n.id ? "true" : undefined}
            onClick={() => document.getElementById(`sr-row-${n.id}`)?.scrollIntoView({ behavior: behavior(), block: "start" })}
          >
            {n.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ---------- A row ---------- */

function Row({ row, sheet, onOpen, onClose }: { row: Exclude<SeriesRow, { kind: "contact" }>; sheet: Sheet | null; onOpen: (s: Sheet, el: HTMLElement) => void; onClose: () => void }) {
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

  return (
    <section className="sr-row" id={`sr-row-${row.id}`} aria-labelledby={`sr-h-${row.id}`} data-kind={row.kind} data-sheet={sheet ? "" : undefined}>
      <h2 className="sr-row-title" id={`sr-h-${row.id}`}>
        {row.title} <span className="sr-count">&middot; {row.items.length}</span>
      </h2>
      <div className="sr-row-body">
        {edge.l ? (
          <button type="button" className="sr-edge sr-edge-l" aria-label={`${row.title}: earlier`} onClick={() => by(-1)}>
            ◀
          </button>
        ) : null}
        <ul className="sr-scroller" role="list" ref={scroller} onScroll={measure}>
          {row.kind === "episodes" ? row.items.map((e) => <EpisodeCard key={e.id} e={e} onOpen={(el) => onOpen(episodeSheet(row.id, e), el)} />) : null}
          {row.kind === "cards" ? row.items.map((c) => <PosterCard key={c.id} c={c} onOpen={(el) => onOpen(cardSheet(row.id, c), el)} />) : null}
          {row.kind === "skills" ? row.items.map((s) => <SkillTile key={s.id} s={s} />) : null}
        </ul>
        {edge.r ? (
          <button type="button" className="sr-edge sr-edge-r" aria-label={`${row.title}: later`} onClick={() => by(1)}>
            ▶
          </button>
        ) : null}
      </div>
      {sheet ? <EpisodeSheet sheet={sheet} onClose={onClose} /> : null}
    </section>
  );
}

function EpisodeCard({ e, onOpen }: { e: Episode; onOpen: (el: HTMLElement) => void }) {
  const inner = (
    <>
      <span className="sr-num" aria-hidden>
        S{e.season} E{e.n}
      </span>
      <span className="sr-card-title">{e.title}</span>
      <span className="sr-card-strip">{[e.runtime, e.tag, e.grade].filter(Boolean).join(" · ")}</span>
    </>
  );
  return (
    <li className="sr-ep" data-branch={e.branch}>
      {e.href ? (
        <a className="sr-card" href={e.href} aria-label={`${e.title}, season ${e.season} episode ${e.n}`}>
          {inner}
        </a>
      ) : (
        <button type="button" className="sr-card" aria-label={`${e.title}, season ${e.season} episode ${e.n}`} onClick={(ev) => onOpen(ev.currentTarget)}>
          {inner}
        </button>
      )}
      <div className="sr-panel" aria-hidden>
        <p>{e.synopsis ?? e.title}</p>
        {e.href ? <span className="sr-open-cue">▶ Open</span> : null}
      </div>
    </li>
  );
}

function PosterCard({ c, onOpen }: { c: ProjectCard; onOpen: (el: HTMLElement) => void }) {
  return (
    <li className="sr-poster">
      {c.href ? (
        <a className="sr-poster-title sr-stretch" href={c.href}>
          {c.title}
        </a>
      ) : (
        <button type="button" className="sr-poster-title sr-stretch" onClick={(ev) => onOpen(ev.currentTarget)}>
          {c.title}
        </button>
      )}
      {c.summary ? <p className="sr-poster-sum">{c.summary}</p> : null}
      {c.stack.length ? (
        <ul className="sr-chips-mini" role="list">
          {c.stack.slice(0, 3).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      ) : null}
      {c.live || c.repo ? (
        <div className="sr-poster-links">
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
    </li>
  );
}

function SkillTile({ s }: { s: SkillCard }) {
  return (
    <li className="sr-skill" title={s.group}>
      <span className="sr-skill-name">{s.name}</span>
      <span className="sr-skill-group">{s.group}</span>
    </li>
  );
}

/* ---------- The inline episode sheet ---------- */

function EpisodeSheet({ sheet, onClose }: { sheet: Sheet; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    el?.querySelector<HTMLElement>("button, a")?.focus({ preventScroll: true });
    el?.scrollIntoView({ behavior: behavior(), block: "nearest" });
  }, [sheet.key]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    // Focus stays inside the sheet until it is closed.
    const f = Array.from(root.current?.querySelectorAll<HTMLElement>("button, a[href]") ?? []);
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="sr-sheet" role="dialog" aria-modal="false" aria-label={sheet.title} ref={root} onKeyDown={onKey}>
      <button type="button" className="sr-sheet-x" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h3 className="sr-sheet-title">{sheet.title}</h3>
      <p className="sr-sheet-meta">{sheet.meta.join(" · ")}</p>
      {sheet.body ? <p className="sr-sheet-body">{sheet.body}</p> : null}
      {sheet.links.length ? (
        <div className="sr-sheet-links">
          {sheet.links.map((l) => (
            <a key={l.label} href={l.href} {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}>
              {l.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- To be continued ---------- */

function ContinuedRow({ row, contact }: { row: SeriesRow; contact: TermLink[] }) {
  const exit = useViewExit();
  const link = (label: string) => contact.find((c) => c.label === label)?.href;
  const mail = link("mail");
  const linkedin = link("linkedin");
  const github = link("github");
  return (
    <section className="sr-row" id={`sr-row-${row.id}`} aria-labelledby={`sr-h-${row.id}`} data-kind="contact">
      <h2 className="sr-visually-hidden" id={`sr-h-${row.id}`}>
        {row.title}
      </h2>
      <div className="sr-tbc">
        <p className="sr-tbc-title">To be continued&hellip;</p>
        <p className="sr-tbc-sub">Next episode: your team?</p>
        <div className="sr-tbc-actions">
          {mail ? (
            <a className="sr-btn sr-btn-play" href={mail}>
              Say hello
            </a>
          ) : null}
          {linkedin ? (
            <a className="sr-btn sr-btn-glass" href={linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          ) : null}
          {github ? (
            <a className="sr-btn sr-btn-glass" href={github} target="_blank" rel="noreferrer">
              GitHub
            </a>
          ) : null}
          {exit ? (
            <button type="button" className="sr-btn sr-btn-glass" onClick={exit}>
              Back to the terminal
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
