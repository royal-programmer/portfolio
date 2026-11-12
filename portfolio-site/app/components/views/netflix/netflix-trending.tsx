"use client";

/**
 * "Trending now" (17-persona-views.md §22, D2): the latest public commits as cards, fetched from /api/github/recent.
 * Fails quietly: no data, no row. Each card links to the commit on GitHub (a new tab).
 */
import { memo, useEffect, useState } from "react";
import { NfArt } from "./netflix-art";

type Commit = { id: string; message: string; repo: string; at: string; url: string };

function ago(iso: string, now: number): string {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (m < 60) return `${Math.max(1, m)} min ago`;
  if (m < 60 * 36) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

export const TrendingRow = memo(function TrendingRow({ id, title }: { id: string; title: string }) {
  const [state, setState] = useState<{ commits: Commit[]; at: number } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/github/recent")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { commits?: Commit[]; at?: string } | null) => {
        if (live && j?.commits?.length) setState({ commits: j.commits, at: j.at ? Date.parse(j.at) : Date.now() });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  if (!state) return null;
  const now = Date.now();
  return (
    <section className="nf-row" id={`nf-row-${id}`} aria-labelledby={`nf-h-${id}`}>
      <h2 className="nf-row-title" id={`nf-h-${id}`}>
        {title} <span className="nf-live"><i aria-hidden /> live</span> <span className="nf-count">&middot; updated {ago(new Date(state.at).toISOString(), now)}</span>
      </h2>
      <div className="nf-row-body">
        <ul className="nf-scroller" role="list">
          {state.commits.map((c) => (
            <li key={c.id} className="nf-tcard">
              <NfArt seed={c.id} tone={c.repo.length % 2 ? "project" : "side"} />
              <a className="nf-tcard-a" href={c.url} target="_blank" rel="noreferrer">
                <span className="nf-tcard-msg">{c.message}</span>
                <span className="nf-tcard-meta">
                  {c.repo} · {ago(c.at, now)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});
