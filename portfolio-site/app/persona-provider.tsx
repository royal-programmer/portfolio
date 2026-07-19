"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  isLaunchedPersona,
  type LaunchedPersona,
} from "@/lib/content/types";

/** Runtime persona union — kept in sync with `LaunchedPersona` from the content contract. */
export type Persona = LaunchedPersona;

export const PERSONA_ORDER: Persona[] = ["engineer", "trader", "photographer"];

const STORAGE_KEY = "portfolio-persona";

type PersonaContextValue = {
  persona: Persona;
  setPersona: (p: Persona) => void;
  /** True after the first client sync from route or sessionStorage. */
  personaHydrated: boolean;
};

const PersonaContext = createContext<PersonaContextValue | null>(null);

function readStoredPersona(): Persona | null {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved && isLaunchedPersona(saved)) return saved;
  } catch {
    /* ignore */
  }
  return null;
}

function personaFromPathname(pathname: string): Persona | null {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (segment && isLaunchedPersona(segment)) return segment;
  return null;
}

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [persona, setPersonaState] = useState<Persona>("engineer");
  const [personaHydrated, setPersonaHydrated] = useState(false);

  const setPersona = useCallback((p: Persona) => {
    setPersonaState(p);
  }, []);

  // Route wins; on `/` restore session (or engineer if never set).
  useEffect(() => {
    const fromRoute = personaFromPathname(pathname);
    if (fromRoute) {
      queueMicrotask(() => {
        setPersonaState(fromRoute);
        setPersonaHydrated(true);
      });
      return;
    }

    if (pathname === "/" || pathname === "") {
      const stored = readStoredPersona();
      queueMicrotask(() => {
        setPersonaState(stored ?? "engineer");
        setPersonaHydrated(true);
      });
      return;
    }

    queueMicrotask(() => setPersonaHydrated(true));
  }, [pathname]);

  useEffect(() => {
    if (!personaHydrated) return;
    document.documentElement.setAttribute("data-persona", persona);
    try {
      sessionStorage.setItem(STORAGE_KEY, persona);
    } catch {
      /* ignore */
    }
  }, [persona, personaHydrated]);

  return (
    <PersonaContext.Provider value={{ persona, setPersona, personaHydrated }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const ctx = useContext(PersonaContext);
  if (!ctx) throw new Error("usePersona must be used within PersonaProvider");
  return ctx;
}
