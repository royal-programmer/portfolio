"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "persona-transitions-enabled";

export function usePersonaTransitionPrefs() {
  const [transitionsEnabled, setTransitionsEnabledState] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "false") queueMicrotask(() => setTransitionsEnabledState(false));
    else if (saved === "true") queueMicrotask(() => setTransitionsEnabledState(true));

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setPrefersReducedMotion(mq.matches);
    syncMotion();
    mq.addEventListener("change", syncMotion);
    queueMicrotask(() => setHydrated(true));
    return () => mq.removeEventListener("change", syncMotion);
  }, []);

  const setTransitionsEnabled = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setTransitionsEnabledState((prev) => {
      const next = typeof value === "function" ? value(prev) : value;
      window.localStorage.setItem(STORAGE_KEY, next ? "true" : "false");
      return next;
    });
  }, []);

  const effectiveTransitions = useMemo(
    () => transitionsEnabled && !prefersReducedMotion,
    [transitionsEnabled, prefersReducedMotion],
  );

  return {
    transitionsEnabled,
    setTransitionsEnabled,
    prefersReducedMotion,
    effectiveTransitions,
    hydrated,
  };
}
