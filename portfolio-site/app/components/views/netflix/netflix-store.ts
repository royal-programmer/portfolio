"use client";

/**
 * The Netflix view's small local state: My List, thumbs-up, progress and the sound preference, all in
 * `localStorage` (nothing leaves the device, no analytics). One external store so every card and the modal
 * stay in step.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { subLangOf } from "@/lib/site/netflix-subs";

export const LIST_KEY = "xp-nf-list";
export const LIKES_KEY = "xp-nf-likes";
export const PROGRESS_KEY = "xp-nf-progress";
export const SOUND_KEY = "xp-nf-sound";

const subs = new Set<() => void>();
const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {}
  subs.forEach((f) => f());
};
const subscribe = (cb: () => void) => {
  subs.add(cb);
  const onStorage = (e: StorageEvent) => e.key?.startsWith("xp-nf-") && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    subs.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
};
const useRaw = (key: string) =>
  useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );

const parseList = (raw: string | null): string[] => {
  try {
    const v = JSON.parse(raw ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

/** An ordered set of ids under one key (My List, likes). Newest first. */
function useIdSet(key: string) {
  const raw = useRaw(key);
  const ids = useMemo(() => parseList(raw), [raw]);
  const toggle = useCallback(
    (id: string) => {
      const cur = parseList(read(key));
      write(key, JSON.stringify(cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur]));
    },
    [key],
  );
  return { ids, has: (id: string) => ids.includes(id), toggle };
}

export const useMyList = () => useIdSet(LIST_KEY);
export const useLikes = () => useIdSet(LIKES_KEY);

/** id -> 0..1, insertion order = most recently opened last. */
export function useProgress() {
  const raw = useRaw(PROGRESS_KEY);
  const map = useMemo<Record<string, number>>(() => {
    try {
      const v = JSON.parse(raw ?? "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch {
      return {};
    }
  }, [raw]);
  const set = useCallback((id: string, value: number) => {
    let cur: Record<string, number> = {};
    try {
      cur = JSON.parse(read(PROGRESS_KEY) ?? "{}") ?? {};
    } catch {}
    const prev = cur[id] ?? 0;
    delete cur[id];
    cur[id] = Math.max(prev, value);
    write(PROGRESS_KEY, JSON.stringify(cur));
  }, []);
  /** Ids, most recently opened first. */
  const recent = useMemo(() => Object.keys(map).reverse(), [map]);
  return { map, recent, set };
}

/** Empties My List, thumbs-up and watch progress (the Profiles menu's "Clear watch history"). */
export function clearHistory() {
  write(PROGRESS_KEY, "{}");
  write(LIST_KEY, "[]");
  write(LIKES_KEY, "[]");
}

/** Muted by default; the pick is remembered. */
export function useSound() {
  const raw = useRaw(SOUND_KEY);
  const on = raw === "on";
  const toggle = useCallback(() => write(SOUND_KEY, read(SOUND_KEY) === "on" ? "off" : "on"), []);
  return { on, toggle };
}

export const CC_KEY = "xp-nf-cc";
const TERM_LANG_KEY = "xp-term-lang";

/** Subtitles (N8): the on/off pick is this view's; the language is the terminal's saved one (`bn` or `hi`, else none). */
export function useCc() {
  const raw = useRaw(CC_KEY);
  const lang = subLangOf(useRaw(TERM_LANG_KEY));
  const toggle = useCallback(() => write(CC_KEY, read(CC_KEY) === "on" ? "off" : "on"), []);
  return { on: raw === "on", lang, toggle };
}
