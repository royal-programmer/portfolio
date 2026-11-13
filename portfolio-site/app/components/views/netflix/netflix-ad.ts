"use client";

/**
 * Audio description (17-persona-views.md §22, D4): the typed trailer, recaps and teleprompter lines are also spoken
 * with `speechSynthesis`, in the language the terminal is set to (`en-IN`, `bn-IN`, `hi-IN`). Off by default and
 * remembered (`xp-nf-ad`). Never speaks without a user gesture on the page; always cancelled on skip, close, Esc or
 * toggle off. Rate 1.0. If no installed voice matches the language, it says so (`note`) and uses the browser default.
 */
import { useEffect, useSyncExternalStore } from "react";
import type { SubLang } from "@/lib/site/netflix-subs";

export const AD_KEY = "xp-nf-ad";
export const AD_LANG: Record<SubLang | "en", string> = { en: "en-IN", bn: "bn-IN", hi: "hi-IN" };

let note = "";
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const adSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

const norm = (s: string) => s.replace("_", "-").toLowerCase();

/** An installed voice for the language tag: an exact match, else the same base language (`hi-IN` before `hi`). */
export function pickVoice(tag: string): SpeechSynthesisVoice | null {
  if (!adSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const want = norm(tag);
  return voices.find((v) => norm(v.lang) === want) ?? voices.find((v) => norm(v.lang).split("-")[0] === want.split("-")[0]) ?? null;
}

const gesture = () => {
  try {
    return navigator.userActivation?.hasBeenActive !== false;
  } catch {
    return true;
  }
};

export function adCancel() {
  if (adSupported()) window.speechSynthesis.cancel();
}

/** Speak `text` in `tag` (cancels what was being said). Returns false when it could not (unsupported, or no gesture yet). */
export function adSpeak(text: string, tag: string, onEnd?: () => void): boolean {
  if (!adSupported() || !text.trim() || !gesture()) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(tag);
  u.lang = voice?.lang ?? tag;
  if (voice) u.voice = voice;
  u.rate = 1;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  if (!voice && synth.getVoices().length) {
    note = `No ${tag} voice is installed here; using the browser default.`;
    emit();
  }
  synth.speak(u);
  return true;
}

const readOn = () => {
  try {
    return window.localStorage.getItem(AD_KEY) === "on";
  } catch {
    return false;
  }
};
const subscribe = (cb: () => void) => {
  subs.add(cb);
  const onStorage = (e: StorageEvent) => e.key === AD_KEY && cb();
  window.addEventListener("storage", onStorage);
  return () => {
    subs.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
};

/** The AD toggle's state: on or off, the voice tag for the terminal's language, and a note when no voice matches. */
export function useAd(lang: SubLang | null) {
  const on = useSyncExternalStore(subscribe, readOn, () => false);
  const n = useSyncExternalStore(
    subscribe,
    () => note,
    () => "",
  );
  const tag = AD_LANG[lang ?? "en"];
  const toggle = () => {
    const next = !readOn();
    try {
      window.localStorage.setItem(AD_KEY, next ? "on" : "off");
    } catch {}
    note = "";
    if (next) {
      // A click is the gesture that lets speech start; the confirmation also finds out whether a voice exists.
      const voices = adSupported() ? window.speechSynthesis.getVoices() : [];
      if (!adSupported()) note = "Audio description is not supported in this browser.";
      else if (voices.length && !pickVoice(tag)) note = `No ${tag} voice is installed here; using the browser default.`;
      adSpeak(lang === "bn" ? "অডিও বর্ণনা চালু" : lang === "hi" ? "ऑडियो विवरण चालू" : "Audio description on", tag);
    } else adCancel();
    emit();
  };
  return { on, tag, note: n, toggle, supported: typeof window !== "undefined" ? adSupported() : false };
}

/**
 * Speaks `text` while AD is on (when `text` changes or AD turns on); cancels when it turns off, `text` clears, or
 * the component goes away, unless `keep()` says the line ended naturally (it is then left to finish).
 */
export function useAdSpeech(ad: { on: boolean; tag: string }, text: string | null, keep?: () => boolean) {
  useEffect(() => {
    if (!ad.on || !text) return;
    adSpeak(text, ad.tag);
    return () => {
      if (!keep?.()) adCancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `keep` reads a ref and is stable in meaning
  }, [ad.on, ad.tag, text]);
}
