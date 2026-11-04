"use client";

/**
 * The hub's music (D38 round D, Ratul's pick): paste a YouTube or SoundCloud link, or search
 * Jamendo (free, Creative Commons, no ads). One source at a time; the ambient drone ducks under
 * it. The last source is remembered, never auto-played: playing needs a tap.
 */
import { useSyncExternalStore } from "react";

export type JamendoTrack = { id: string; name: string; artist: string; audio: string; image?: string; shareurl: string; duration: number; license?: string };

export type MusicSource =
  | { kind: "youtube"; id: string }
  | { kind: "soundcloud"; url: string }
  | ({ kind: "jamendo" } & JamendoTrack);

export type MusicState = { source: MusicSource | null; playing: boolean; open: boolean; volume: number };

const KEY = "xp-music";
const subs = new Set<() => void>();
let state: MusicState = { source: null, playing: false, open: false, volume: 0.7 };
const initial = state;

function emit() {
  for (const f of subs) f();
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ source: state.source, volume: state.volume }));
  } catch {}
}

export const music = {
  get: () => state,
  getServer: () => initial,
  subscribe(f: () => void) {
    subs.add(f);
    return () => void subs.delete(f);
  },
  set(patch: Partial<MusicState>) {
    state = { ...state, ...patch };
    emit();
    persist();
  },
  play(source: MusicSource) {
    music.set({ source, playing: true, open: true });
  },
  toggle() {
    if (state.source) music.set({ playing: !state.playing });
  },
  stop() {
    music.set({ source: null, playing: false });
  },
  /** Remember the last source (paused) across visits. */
  restore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { source?: MusicSource | null; volume?: number };
      state = { ...state, source: saved.source ?? null, volume: typeof saved.volume === "number" ? saved.volume : state.volume };
      emit();
    } catch {}
  },
};

export function useMusic() {
  return useSyncExternalStore(music.subscribe, music.get, music.getServer);
}

/** A YouTube or SoundCloud link → a source; anything else → null (it becomes a search). */
export function parseLink(input: string): MusicSource | null {
  const text = input.trim();
  if (!/^(https?:\/\/|www\.|youtu\.be|soundcloud\.com)/i.test(text)) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return /^[\w-]{11}$/.test(id) ? { kind: "youtube", id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
    const id = v && /^[\w-]{11}$/.test(v) ? v : m?.[1];
    return id ? { kind: "youtube", id } : null;
  }
  if (host === "soundcloud.com" || host === "on.soundcloud.com") {
    return url.pathname.length > 1 ? { kind: "soundcloud", url: `${url.origin}${url.pathname}` } : null;
  }
  return null;
}

export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
