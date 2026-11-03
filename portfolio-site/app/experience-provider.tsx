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
  sound: boolean;
  /** False during SSR/first paint — render choice-dependent UI only when true. */
  ready: boolean;
  setExperience: (x: Experience) => void;
  setQuality: (q: Quality) => void;
  setSound: (on: boolean) => void;
};

const ExperienceContext = createContext<ExperienceState | null>(null);

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    experience: "immersive" as Experience,
    chosen: false,
    quality: null as Quality | null,
    sound: false,
    ready: false,
  });

  useEffect(() => {
    const saved = readExperienceCookie();
    const experience = saved ?? defaultExperience();
    stampExperience(experience);
    queueMicrotask(() =>
      setState({ experience, chosen: saved !== null, quality: readQualityCookie(), sound: readSoundCookie(), ready: true }),
    );
  }, []);

  const setExperience = useCallback((experience: Experience) => {
    writeCookie(EXPERIENCE_COOKIE, experience, rootDomains());
    stampExperience(experience);
    setState((s) => ({ ...s, experience, chosen: true }));
  }, []);
  const setQuality = useCallback((quality: Quality) => {
    writeCookie(QUALITY_COOKIE, quality, rootDomains());
    setState((s) => ({ ...s, quality }));
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
