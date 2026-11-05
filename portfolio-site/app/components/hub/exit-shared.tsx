"use client";

/**
 * Shared pieces of the world sequences (the loaders / doorways): the once-only `done`, the skip
 * (click, key, reduced motion), and the CSS-only boot screen a server-rendered window shows until
 * its script arrives.
 */
import { useEffect, useMemo, useRef } from "react";

export function useOnce(onDone: () => void) {
  const fired = useRef(false);
  return useMemo(
    () => () => {
      if (fired.current) return;
      fired.current = true;
      onDone();
    },
    [onDone],
  );
}

/** Skip on any click / key; honour reduced motion. */
export function useSkip(done: () => void) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const id = window.setTimeout(done, 250);
      return () => window.clearTimeout(id);
    }
    const skip = () => done();
    // A beat later, so the click that opened the doorway does not also skip it.
    const id = window.setTimeout(() => {
      window.addEventListener("pointerdown", skip);
      window.addEventListener("keydown", skip);
    }, 400);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [done]);
}

/** The CSS-only life of a booting screen: grid lines that draw themselves and a scan that sweeps. */
export function BootScreen() {
  return (
    <div data-boot className="hub-exit-boot" aria-hidden>
      <i /> <i /> <i /> <i /> <i />
      <b />
    </div>
  );
}
