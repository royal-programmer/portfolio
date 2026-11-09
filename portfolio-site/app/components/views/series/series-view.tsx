"use client";

/**
 * The Series view (17-persona-views.md §7): "Who's watching?", then the chosen profile's cut of the same
 * dataset as a hero and rows. The pick is remembered on the device; `?profile=` deep-links.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import "./series.css";
import { SERIES_PROFILES, isSeriesProfile, type Series, type SeriesProfileId } from "@/lib/site/series-data";
import type { TermLink, TerminalData } from "@/lib/site/terminal-data";

export type SeriesViewProps = {
  accent: string;
  /** The three cuts, built on the server from the one dataset. */
  series: Record<SeriesProfileId, Series>;
  contact: TermLink[];
  status: string;
  portrait: TerminalData["portrait"];
  /** `via=normal`: no staged motion. */
  fast: boolean;
};

const PROFILE_KEY = "xp-series-profile";
const TONES: Record<SeriesProfileId, string> = { recruiter: "var(--sr-accent)", developer: "#2ab7b0", story: "#e8a33d" };

function readProfile(): SeriesProfileId | null {
  try {
    const q = new URLSearchParams(window.location.search).get("profile");
    if (isSeriesProfile(q)) return q;
    const v = window.localStorage.getItem(PROFILE_KEY);
    return isSeriesProfile(v) ? v : null;
  } catch {
    return null;
  }
}

function stripProfileParam() {
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.has("profile")) {
      u.searchParams.delete("profile");
      window.history.replaceState(window.history.state, "", u);
    }
  } catch {}
}

export function SeriesView(props: SeriesViewProps) {
  const { accent, series } = props;
  // undefined: not read yet (the page stays dark, nothing flashes); null: ask.
  const [profile, setProfile] = useState<SeriesProfileId | null | undefined>(undefined);

  useEffect(() => {
    const p = readProfile();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the pick lives in localStorage and the URL, only readable after mount
    setProfile(p);
    if (p) {
      try {
        window.localStorage.setItem(PROFILE_KEY, p);
      } catch {}
      stripProfileParam();
    }
  }, []);

  const pick = useCallback((id: SeriesProfileId) => {
    try {
      window.localStorage.setItem(PROFILE_KEY, id);
    } catch {}
    window.scrollTo({ top: 0 });
    setProfile(id);
  }, []);

  const switchProfile = useCallback(() => {
    window.scrollTo({ top: 0 });
    setProfile(null);
  }, []);

  return (
    <div className="sr-root" style={{ "--sr-accent": accent } as React.CSSProperties} data-profile={profile ?? ""}>
      {profile === undefined ? null : profile === null ? (
        <ProfileGate onPick={pick} />
      ) : (
        <SeriesBody {...props} series={series[profile]} profile={profile} onSwitch={switchProfile} />
      )}
    </div>
  );
}

function ProfileGate({ onPick }: { onPick: (id: SeriesProfileId) => void }) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => {
    refs.current[0]?.focus({ preventScroll: true });
  }, []);

  const move = (i: number, e: React.KeyboardEvent) => {
    const n = SERIES_PROFILES.length;
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
    <main className="sr-gate">
      <h1 className="sr-gate-title">Who&rsquo;s watching?</h1>
      <div className="sr-profiles" role="group" aria-label="Profiles">
        {SERIES_PROFILES.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            className="sr-profile"
            style={{ "--tone": TONES[p.id] } as React.CSSProperties}
            onClick={() => onPick(p.id)}
            onKeyDown={(e) => move(i, e)}
          >
            <span className="sr-tile" aria-hidden>
              <span className="sr-glyph">{p.glyph}</span>
            </span>
            <span className="sr-pname">{p.name}</span>
            <span className="sr-pline">{p.line}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

function SeriesBody({ series, profile, onSwitch }: Omit<SeriesViewProps, "series"> & { series: Series; profile: SeriesProfileId; onSwitch: () => void }) {
  const name = SERIES_PROFILES.find((p) => p.id === profile)?.name;
  return (
    <main className="sr-page">
      <button type="button" className="sr-switch" onClick={onSwitch}>
        Switch profile
      </button>
      <h1>{series.title}</h1>
      <p>{name}</p>
    </main>
  );
}
