"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  EXPERIENCE_COOKIE,
  QUALITY_COOKIE,
  SOUND_COOKIE,
  defaultExperience,
  readExperienceCookie,
  readQualityCookie,
  readSoundCookie,
  stampExperience,
  writeCookie,
  type Experience,
  type Quality,
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
  /** False during SSR/first paint — render choice-dependent UI only when true. */
  ready: boolean;
  setExperience: (x: Experience) => void;
  /** `persist: false` is for the governor — a session-only change that is not the visitor's choice. */
  setQuality: (q: Quality, persist?: boolean) => void;
  setSound: (on: boolean) => void;
};

const ExperienceContext = createContext<ExperienceState | null>(null);

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    experience: "immersive" as Experience,
    chosen: false,
    quality: null as Quality | null,
    qualityChosen: false,
    sound: false,
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
    const saved = forced ?? readExperienceCookie();
    const experience = saved ?? defaultExperience();
    stampExperience(experience);
    const quality = readQualityCookie();
    queueMicrotask(() =>
      setState({ experience, chosen: saved !== null, quality, qualityChosen: quality !== null, sound: readSoundCookie(), ready: true }),
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
  const setSound = useCallback((sound: boolean) => {
    writeCookie(SOUND_COOKIE, sound ? "on" : "off", rootDomains());
    setState((s) => ({ ...s, sound }));
  }, []);

  return (
    <ExperienceContext.Provider value={{ ...state, setExperience, setQuality, setSound }}>
      {children}
    </ExperienceContext.Provider>
  );
}

export function useExperience() {
  const ctx = useContext(ExperienceContext);
  if (!ctx) throw new Error("useExperience must be used within ExperienceProvider");
  return ctx;
}
