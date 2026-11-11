"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  EXPERIENCE_COOKIE,
  QUALITY_COOKIE,
  SOUND_COOKIE,
  defaultExperience,
  readExperienceCookie,
  readQualityCookie,
  readSoundChoice,
  stampExperience,
  writeCookie,
  type Experience,
  type Quality,
  type SoundChoice,
} from "@/lib/site/experience";
import { rootDomains } from "@/lib/site/hosts";

type ExperienceState = {
  experience: Experience;
  /** True once the visitor has made a choice (now or on an earlier visit). */
  chosen: boolean;
  /** Immersive quality; null until chosen or suggested by the gate. */
  quality: Quality | null;
  /** True when the visitor set the quality by hand (now or earlier): the governor leaves it alone. */
  qualityChosen: boolean;
  sound: boolean;
  /** The soundscape ("off" when sound is off); the last one picked stays remembered for the toggle. */
  soundChoice: SoundChoice;
  /** False during SSR/first paint — render choice-dependent UI only when true. */
  ready: boolean;
  setExperience: (x: Experience) => void;
  /** `persist: false` is for the governor — a session-only change that is not the visitor's choice. */
  setQuality: (q: Quality, persist?: boolean) => void;
  setSound: (on: boolean) => void;
  setSoundChoice: (c: SoundChoice) => void;
};

const ExperienceContext = createContext<ExperienceState | null>(null);

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    experience: "immersive" as Experience,
    chosen: false,
    quality: null as Quality | null,
    qualityChosen: false,
    sound: false,
    soundChoice: "off" as SoundChoice,
    ready: false,
  });

  useEffect(() => {
    // `?xp=normal` / `?xp=immersive`: a shareable, testable override. It becomes the choice (cookie on
    // the root domain, so every world follows), and the URL is left tidy.
    let forced: Experience | null = null;
    try {
      const url = new URL(window.location.href);
      const q = url.searchParams.get("xp");
      if (q === "normal" || q === "immersive") {
        forced = q;
        writeCookie(EXPERIENCE_COOKIE, q, rootDomains());
        url.searchParams.delete("xp");
        window.history.replaceState(window.history.state, "", url.toString());
      }
    } catch {}
    // Through the Stage's door (`?via=stage&from=<world>`): the hub opens in Normal mode on that world's chapter. A visit, not a choice: nothing is written.
    let viaStage = false;
    try {
      const q = new URLSearchParams(window.location.search);
      viaStage = q.get("via") === "stage" && Boolean(q.get("from")) && (window.location.pathname === "/" || window.location.pathname === "/whoami");
    } catch {}
    const saved = viaStage ? "normal" : (forced ?? readExperienceCookie());
    const experience = saved ?? defaultExperience();
    stampExperience(experience);
    const quality = readQualityCookie();
    queueMicrotask(() =>
      setState({ experience, chosen: saved !== null, quality, qualityChosen: quality !== null, sound: readSoundChoice() !== "off", soundChoice: readSoundChoice(), ready: true }),
    );
  }, []);

  const setExperience = useCallback((experience: Experience) => {
    writeCookie(EXPERIENCE_COOKIE, experience, rootDomains());
    stampExperience(experience);
    setState((s) => ({ ...s, experience, chosen: true }));
  }, []);
  const setQuality = useCallback((quality: Quality, persist = true) => {
    if (persist) writeCookie(QUALITY_COOKIE, quality, rootDomains());
    setState((s) => ({ ...s, quality, qualityChosen: s.qualityChosen || persist }));
  }, []);
  const setSoundChoice = useCallback((c: SoundChoice) => {
    writeCookie(SOUND_COOKIE, c, rootDomains());
    setState((s) => ({ ...s, sound: c !== "off", soundChoice: c }));
  }, []);
  const setSound = useCallback((sound: boolean) => {
    setState((s) => {
      const c: SoundChoice = sound ? (s.soundChoice !== "off" ? s.soundChoice : "ambient") : "off";
      writeCookie(SOUND_COOKIE, c, rootDomains());
      return { ...s, sound, soundChoice: c };
    });
  }, []);

  return (
    <ExperienceContext.Provider value={{ ...state, setExperience, setQuality, setSound, setSoundChoice }}>
      {children}
    </ExperienceContext.Provider>
  );
}

export function useExperience() {
  const ctx = useContext(ExperienceContext);
  if (!ctx) throw new Error("useExperience must be used within ExperienceProvider");
  return ctx;
}
