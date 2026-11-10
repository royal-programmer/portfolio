"use client";

/**
 * The fixed top bar (17-persona-views.md §7): our R mark, Home / Series / My List / Profiles, an expanding
 * search and the active profile's tile. Transparent over the billboard, black after 80px of scroll. On phones
 * it keeps the mark, the search and the profile tile.
 */
import { useEffect, useRef, useState } from "react";

type Props = {
  glyph: string;
  tone: string;
  query: string;
  onQuery: (q: string) => void;
  onHome: () => void;
  onSeries: () => void;
  onMyList: () => void;
  onProfiles: () => void;
};

export function NetflixTopbar({ glyph, tone, query, onQuery, onHome, onSeries, onMyList, onProfiles }: Props) {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const expanded = open || query !== "";

  useEffect(() => {
    const on = () => setSolid(window.scrollY > 80);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const openSearch = () => {
    setOpen(true);
    requestAnimationFrame(() => input.current?.focus());
  };
  const clear = () => {
    onQuery("");
    setOpen(false);
  };

  return (
    <header className="nf-bar" data-solid={solid || undefined}>
      <button type="button" className="nf-bar-mark" onClick={onHome} aria-label="Home">
        R
      </button>
      <nav className="nf-bar-nav" aria-label="Sections">
        <button type="button" onClick={onHome}>
          Home
        </button>
        <button type="button" onClick={onSeries}>
          Series
        </button>
        <button type="button" onClick={onMyList}>
          My List
        </button>
        <button type="button" onClick={onProfiles}>
          Profiles
        </button>
      </nav>
      <div className="nf-bar-right">
        <div className="nf-search-box" data-open={expanded || undefined} role="search">
          <button type="button" className="nf-search-btn" aria-label={expanded ? "Search" : "Open search"} aria-expanded={expanded} onClick={expanded ? () => input.current?.focus() : openSearch}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="M15.5 15.5 21 21" />
            </svg>
          </button>
          <input
            ref={input}
            type="search"
            className="nf-search-input"
            placeholder="Titles, tags, tools"
            aria-label="Search titles, tags and tools"
            value={query}
            tabIndex={expanded ? 0 : -1}
            onChange={(e) => onQuery(e.target.value)}
            onBlur={() => !query && setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                clear();
                input.current?.blur();
              }
            }}
          />
          {query ? (
            <button type="button" className="nf-search-clear" aria-label="Clear search" onClick={clear}>
              ×
            </button>
          ) : null}
        </div>
        <button type="button" className="nf-bar-profile" style={{ "--tone": tone } as React.CSSProperties} onClick={onProfiles} aria-label="Profiles: switch who is watching" title="Who's watching?">
          <span aria-hidden>{glyph}</span>
        </button>
      </div>
    </header>
  );
}
