"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Persona = "engineer" | "trader" | "photographer";

export const PERSONA_ORDER: Persona[] = ["engineer", "trader", "photographer"];

const STORAGE_KEY = "portfolio-persona";

type PersonaContextValue = {
  persona: Persona;
  setPersona: (p: Persona) => void;
};

const PersonaContext = createContext<PersonaContextValue | null>(null);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>("engineer");

  const setPersona = useCallback((p: Persona) => {
    setPersonaState(p);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-persona", persona);
    try {
      sessionStorage.setItem(STORAGE_KEY, persona);
    } catch {
      /* ignore */
    }
  }, [persona]);

  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!nav) return;

    if (nav.type === "reload" || nav.type === "navigate") {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      queueMicrotask(() => setPersonaState("engineer"));
      return;
    }

    if (nav.type === "back_forward") {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved === "trader" || saved === "photographer" || saved === "engineer") {
          queueMicrotask(() => setPersonaState(saved));
        }
      } catch {
        /* ignore */
      }
    }
  }, []);

  return <PersonaContext.Provider value={{ persona, setPersona }}>{children}</PersonaContext.Provider>;
}

export function usePersona() {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used within PersonaProvider");
  return ctx;
}
