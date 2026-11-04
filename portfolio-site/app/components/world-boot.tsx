"use client";

/**
 * A world page's first paint is dark (D38): the hub's doorway sequence ends
 * on the void, and this cover is what the new page shows until it has drawn —
 * a small light in the persona's colour, then it lifts. Server-rendered, so
 * there is no white flash between the two pages.
 */
import { useEffect, useState, type CSSProperties } from "react";

export function WorldBoot({ color }: { color: string }) {
  const [state, setState] = useState<"on" | "lifting" | "gone">("on");
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lift = window.setTimeout(() => setState("lifting"), reduce ? 0 : 160);
    const gone = window.setTimeout(() => setState("gone"), reduce ? 50 : 900);
    return () => {
      window.clearTimeout(lift);
      window.clearTimeout(gone);
    };
  }, []);
  if (state === "gone") return null;
  return (
    <div aria-hidden className={`world-boot ${state === "lifting" ? "is-lifting" : ""}`} style={{ "--c": color } as CSSProperties}>
      <span className="hub-enter-light" />
    </div>
  );
}
