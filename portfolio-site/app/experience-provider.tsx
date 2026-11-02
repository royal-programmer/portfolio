"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  applyExperience,
  readPrefCookie,
  writePrefCookie,
  type AutoReason,
  type Experience,
  type ExperiencePref,
} from "@/lib/site/experience";
import { rootDomains } from "@/lib/site/hosts";

type ExperienceState = {
  pref: ExperiencePref;
  experience: Experience;
  /** Why Auto chose what it chose, or "chosen" when the visitor picked. */
  reason: AutoReason | "chosen";
  /** False during SSR/first paint — render pref-dependent UI only when true. */
  ready: boolean;
  setPref: (pref: ExperiencePref) => void;
};

const ExperienceContext = createContext<ExperienceState | null>(null);

export function ExperienceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<ExperienceState, "setPref">>({
    pref: "auto",
    // SSR default; the boot script already stamped the real value on <html>.
    experience: "lite",
    reason: "capable",
    ready: false,
  });

  useEffect(() => {
    const pref = readPrefCookie();
    const resolved = applyExperience(pref);
    queueMicrotask(() => setState({ pref, ...resolved, ready: true }));

    // Auto follows live OS changes to the reduced-motion setting.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      const current = readPrefCookie();
      if (current === "auto") setState({ pref: current, ...applyExperience(current), ready: true });
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setPref = useCallback((pref: ExperiencePref) => {
    writePrefCookie(pref, rootDomains());
    setState({ pref, ...applyExperience(pref), ready: true });
  }, []);

  return (
    <ExperienceContext.Provider value={{ ...state, setPref }}>{children}</ExperienceContext.Provider>
  );
}

export function useExperience() {
  const ctx = useContext(ExperienceContext);
  if (!ctx) throw new Error("useExperience must be used within ExperienceProvider");
  return ctx;
}
