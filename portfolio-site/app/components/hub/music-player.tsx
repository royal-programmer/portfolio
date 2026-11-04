"use client";

/**
 * Music for the climb (D38 round D). A quiet "Music" word in the top bar opens a small dock:
 * paste a YouTube or SoundCloud link (plays in that service's own player, visible — their
 * terms), or search Jamendo (free, Creative Commons; each track links back to Jamendo). One
 * source at a time; the ambient drone ducks under it. Nothing auto-plays: a remembered track
 * waits for a tap.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ambient } from "@/lib/site/ambient-sound";
import { formatDuration, music, parseLink, useMusic, type JamendoTrack } from "@/lib/site/music";

export function MusicButton({ className = "" }: { className?: string }) {
  const m = useMusic();
  return (
    <button
      type="button"
      aria-pressed={m.open}
      aria-controls="music-dock"
      onClick={() => music.set({ open: !m.open })}
      className={`group inline-flex min-h-8 items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-dim)] uppercase transition-colors hover:text-[var(--ink)] ${className}`}
    >
      <span aria-hidden className={`music-note ${m.playing ? "is-on" : ""}`} />
      <span className="sr-only sm:not-sr-only">Music</span>
    </button>
  );
}

const sourceKey = (s: ReturnType<typeof useMusic>["source"]) => (s ? (s.kind === "youtube" ? `yt:${s.id}` : s.kind === "soundcloud" ? `sc:${s.url}` : `jm:${s.id}`) : "");

const NOT_SET_UP = "Search isn’t set up on this site yet — paste a link instead.";
const NO_ANSWER = "Jamendo didn’t answer. Try again in a moment.";

export function MusicDock() {
  const m = useMusic();
  const audio = useRef<HTMLAudioElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [results, setResults] = useState<JamendoTrack[] | null>(null);
  // An embedded player mounts only once playing was asked for (its autoplay needs the gesture),
  // and stays mounted while paused.
  const [armed, setArmed] = useState("");
  const key = sourceKey(m.source);

  useEffect(() => music.restore(), []);
  useEffect(() => {
    if (m.playing && key) setArmed(key);
  }, [m.playing, key]);
  useEffect(() => ambient.duck(m.playing && !!m.source), [m.playing, m.source]);
  // Jamendo: our own <audio>.
  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.volume = m.volume;
    if (m.source?.kind === "jamendo" && m.playing) a.play().catch(() => music.set({ playing: false }));
    else a.pause();
  }, [m.playing, m.source, m.volume]);
  // YouTube / SoundCloud: their players, driven by postMessage.
  useEffect(() => {
    const w = frame.current?.contentWindow;
    if (!w || !m.source || armed !== key) return;
    if (m.source.kind === "youtube") w.postMessage(JSON.stringify({ event: "command", func: m.playing ? "playVideo" : "pauseVideo", args: [] }), "*");
    if (m.source.kind === "soundcloud") w.postMessage(JSON.stringify({ method: m.playing ? "play" : "pause" }), "https://w.soundcloud.com");
  }, [m.playing, m.source, armed, key]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    const link = parseLink(text);
    if (link) {
      music.play(link);
      setQ("");
      setResults(null);
      setErr(null);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/music/search?q=${encodeURIComponent(text)}`);
      const d = (await r.json()) as { tracks?: JamendoTrack[]; error?: string };
      if (!r.ok) setErr(d.error === "not-configured" ? NOT_SET_UP : NO_ANSWER);
      setResults(d.tracks ?? []);
    } catch {
      setErr(NO_ANSWER);
      setResults([]);
    } finally {
      setBusy(false);
    }
  };

  const show = m.open || !!m.source;
  if (!show) return null;
  const s = m.source;
  return (
    <div id="music-dock" role="dialog" aria-label="Music" className={`music-dock ${m.open ? "is-open" : ""}`}>
      {m.open ? (
        <div className="music-panel">
          <form onSubmit={submit} className="music-form">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Paste a YouTube / SoundCloud link, or search Jamendo" aria-label="A link, or a search" autoComplete="off" spellCheck={false} />
            <button type="submit" disabled={busy || !q.trim()} aria-label="Go">
              {busy ? "…" : "→"}
            </button>
          </form>
          {err ? <p className="music-fine is-err">{err}</p> : null}
          {results ? (
            <ul className="music-results">
              {results.length === 0 && !err ? <li className="music-fine">Nothing on Jamendo for that.</li> : null}
              {results.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => music.play({ kind: "jamendo", ...t })}>
                    <span>{t.name}</span>
                    <em>
                      {t.artist} · {formatDuration(t.duration)}
                    </em>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="music-fine">Links play in their own player. Jamendo is free, Creative Commons music from independent artists.</p>
          )}
          <button type="button" className="music-close" onClick={() => music.set({ open: false })} aria-label="Close">
            ×
          </button>
        </div>
      ) : null}

      {s ? (
        <div className="music-now">
          {s.kind === "youtube" ? (
            armed === key ? (
              <iframe ref={frame} className="music-frame" src={`https://www.youtube-nocookie.com/embed/${s.id}?autoplay=1&enablejsapi=1&playsinline=1&loop=1&playlist=${s.id}&rel=0`} allow="autoplay; encrypted-media" title="YouTube player" />
            ) : (
              <button type="button" className="music-frame music-resume" onClick={() => music.set({ playing: true })}>
                ▶ <span>Play the YouTube link you left</span>
              </button>
            )
          ) : null}
          {s.kind === "soundcloud" ? (
            armed === key ? (
              <iframe ref={frame} className="music-frame music-frame-sc" src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(s.url)}&auto_play=true&visual=false&show_comments=false&hide_related=true&show_user=true&color=%23e8e2d6`} allow="autoplay" title="SoundCloud player" />
            ) : (
              <button type="button" className="music-frame music-frame-sc music-resume" onClick={() => music.set({ playing: true })}>
                ▶ <span>Play the SoundCloud link you left</span>
              </button>
            )
          ) : null}
          {s.kind === "jamendo" ? (
            <div className="music-track">
              <audio ref={audio} src={s.audio} loop preload="none" />
              {/* eslint-disable-next-line @next/next/no-img-element -- Jamendo's own cover art, their CDN */}
              {s.image ? <img src={s.image} alt="" width={40} height={40} /> : <span className="music-art" />}
              <div className="music-meta">
                <b>{s.name}</b>
                <a href={s.shareurl} target="_blank" rel="noreferrer">
                  {s.artist} · via Jamendo
                </a>
              </div>
              <button type="button" onClick={() => music.toggle()} aria-label={m.playing ? "Pause" : "Play"} className="music-play">
                {m.playing ? "❚❚" : "▶"}
              </button>
            </div>
          ) : null}
          <div className="music-row">
            {s.kind !== "jamendo" ? (
              <button type="button" onClick={() => music.toggle()} className="music-mini">
                {m.playing ? "Pause" : "Play"}
              </button>
            ) : (
              <input type="range" min={0} max={1} step={0.02} value={m.volume} onChange={(e) => music.set({ volume: Number(e.target.value) })} aria-label="Volume" className="music-vol" />
            )}
            <button type="button" onClick={() => music.stop()} className="music-mini">
              Stop
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
