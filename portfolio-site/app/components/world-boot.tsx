"use client";

/**
 * A world page's first paint is dark (D38): the hub's doorway sequence ends on
 * a window, and this cover shows that same window, finished, which zooms in
 * and dissolves into the page — so the two pages read as one motion even
 * though they live on different hosts. Without `via=hub` (a direct visit) it
 * is a plain dark cover with a small light. Server-rendered: no white flash.
 */
import { useEffect, useState, type CSSProperties } from "react";
import type { PersonaSlug } from "@/lib/content/types";
import { ExitFrame } from "./hub/exit-sequence";

type Props = { slug: PersonaSlug; color: string; t: number; viaHub: boolean; items: string[]; photo?: string };

export function WorldBoot({ slug, color, t, viaHub, items, photo }: Props) {
  const [state, setState] = useState<"on" | "lifting" | "gone">("on");
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lift = window.setTimeout(() => setState("lifting"), reduce ? 0 : viaHub ? 120 : 160);
    const gone = window.setTimeout(() => setState("gone"), reduce ? 50 : 1000);
    return () => {
      window.clearTimeout(lift);
      window.clearTimeout(gone);
    };
  }, [viaHub]);
  if (state === "gone") return null;
  return (
    <div aria-hidden className={`world-boot ${viaHub ? "is-via-hub" : ""} ${state === "lifting" ? "is-lifting" : ""}`} style={{ "--c": color } as CSSProperties}>
      {viaHub ? (
        <div className="world-boot-frame">
          <ExitFrame slug={slug} t={t} items={items} photo={photo} />
        </div>
      ) : (
        <span className="hub-enter-light" />
      )}
    </div>
  );
}
