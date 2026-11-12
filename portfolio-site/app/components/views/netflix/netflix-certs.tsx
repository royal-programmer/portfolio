"use client";

/**
 * Certifications as a series (17-persona-views.md §24, E3): each issuer is a season, each credential an episode with a
 * generated badge (the issuer's colour, one slow shine the first time it scrolls into view, still under reduced motion).
 * A card opens a small dialog with the issuer, the credential, the dates the data states and a verify link when one
 * exists. Nothing is invented: no date or link appears unless the data has it.
 */
import { useEffect, useRef, useState } from "react";
import type { CertEpisode, CertSeason } from "@/lib/site/netflix-data";

const initials = (s: string) =>
  s
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

/** The generated badge: a rounded hexagon in the issuer colour with two inner rings and the issuer's initials. */
function Badge({ hue, label, n }: { hue: string; label: string; n: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (en) => {
        if (en.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} className="nf-badge" aria-hidden data-seen={seen || undefined} style={{ "--hue": hue } as React.CSSProperties}>
      <svg viewBox="0 0 120 120" focusable="false">
        <path className="nf-badge-hex" d="M60 8l44 25v54L60 112 16 87V33z" />
        <path className="nf-badge-ring" d="M60 22l32 18.5v39L60 98 28 79.5v-39z" />
        <circle className="nf-badge-ring" cx="60" cy="60" r="21" />
        <text x="60" y="66" textAnchor="middle" className="nf-badge-t">
          {initials(label)}
        </text>
        <text x="60" y="108" textAnchor="middle" className="nf-badge-n">
          {n}
        </text>
      </svg>
      <span className="nf-badge-shine" />
    </span>
  );
}

const validity = (e: CertEpisode) => [e.issued ? `issued ${e.issued}` : "", e.validThrough ? `valid through ${e.validThrough}` : ""].filter(Boolean).join(" · ");

export function CertRow({ id, title, seasons }: { id: string; title: string; seasons: CertSeason[] }) {
  const [pick, setPick] = useState(seasons[0]?.id);
  const [open, setOpen] = useState<{ ep: CertEpisode; el: HTMLElement | null } | null>(null);
  const season = seasons.find((s) => s.id === pick) ?? seasons[0];
  if (!season) return null;
  const total = seasons.reduce((n, s) => n + s.episodes.length, 0);
  return (
    <section className="nf-row nf-certs" id={`nf-row-${id}`} aria-labelledby={`nf-h-${id}`}>
      <h2 className="nf-row-title" id={`nf-h-${id}`}>
        {title} <span className="nf-count">&middot; {total}</span>
      </h2>
      <div className="nf-cert-seasons" role="group" aria-label="Seasons, one per issuer">
        {seasons.map((s) => (
          <button key={s.id} type="button" className="nf-cert-season" aria-pressed={s.id === season.id} style={{ "--hue": s.hue } as React.CSSProperties} onClick={() => setPick(s.id)}>
            <span>{s.label}</span>
            <i>{s.episodes.length}</i>
          </button>
        ))}
      </div>
      <div className="nf-row-body">
        <ul className="nf-scroller" role="list" key={season.id}>
          {season.episodes.map((e, i) => (
            <li key={e.id} className="nf-cert-li">
              <button type="button" className="nf-cert" data-nf-nav onClick={(ev) => setOpen({ ep: e, el: ev.currentTarget })} style={{ "--hue": season.hue } as React.CSSProperties}>
                <Badge hue={season.hue} label={season.label} n={i + 1} />
                <span className="nf-cert-title">{e.name}</span>
                <span className="nf-cert-sub">{validity(e) || season.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      {open ? <CertDialog ep={open.ep} hue={season.hue} onClose={() => { open.el?.focus({ preventScroll: true }); setOpen(null); }} /> : null}
    </section>
  );
}

function CertDialog({ ep, hue, onClose }: { ep: CertEpisode; hue: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    box.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      close.current();
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, []);
  return (
    <div className="nf-cert-overlay">
      <div className="nf-cert-backdrop" onClick={onClose} aria-hidden />
      <div className="nf-cert-dialog" ref={box} role="dialog" aria-modal="true" aria-label={ep.name} style={{ "--hue": hue } as React.CSSProperties}>
        <button type="button" className="nf-m-x" aria-label="Close" onClick={onClose}>
          <span aria-hidden>×</span>
        </button>
        <Badge hue={hue} label={ep.issuer} n={Number(ep.id.split("-").pop()) || 1} />
        <h3>{ep.name}</h3>
        <dl>
          <div>
            <dt>Issuer</dt>
            <dd>{ep.issuer}</dd>
          </div>
          {ep.issued ? (
            <div>
              <dt>Issued</dt>
              <dd>{ep.issued}</dd>
            </div>
          ) : null}
          {ep.validThrough ? (
            <div>
              <dt>Valid through</dt>
              <dd>{ep.validThrough}</dd>
            </div>
          ) : null}
        </dl>
        {ep.verify ? (
          <a className="nf-btn nf-btn-play" href={ep.verify} target="_blank" rel="noreferrer">
            Verify
          </a>
        ) : (
          <p className="nf-cert-note">No public verify link is listed for this credential.</p>
        )}
      </div>
    </div>
  );
}
