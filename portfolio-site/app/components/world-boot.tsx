"use client";

/**
 * A world page opens on its own window (D38). Through the hub's doorway it is
 * the same finished window, already pushed in, which keeps zooming and
 * dissolves into the page — one motion across two hosts. On a direct visit
 * the window is the page's loader from its first frame: the terminal types,
 * the chart builds to its target, the viewfinder focuses and fires — then it
 * lifts. Once per world per session (moving around inside a world does not
 * replay it; a reload does). Server-rendered, so the first paint is never
 * white — and the window is alive in CSS alone (`boot`) until the page's
 * script arrives, however long that takes.
 */
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { PersonaSlug } from "@/lib/content/types";
import { ExitFrame, ExitSequence } from "./hub/exit-sequence";

type Props = { slug: PersonaSlug; color: string; t: number; viaHub: boolean; items: string[]; photo?: string };

const SEEN_KEY = "xp-world-boot";

export function WorldBoot({ slug, color, t, viaHub, items, photo }: Props) {
  const [state, setState] = useState<"on" | "lifting" | "gone">("on");
  // A direct visit renders the sequence's first frame on the server (an empty terminal, a bare chart),
  // so nothing finished flashes before the typing starts. Through the hub it is the finished frame.
  const play = !viaHub;

  const lift = useCallback(() => {
    setState((s) => (s === "on" ? "lifting" : s));
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      // Once per world per session — but a reload of the page replays it (that is someone asking to see it again).
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      seen = nav?.type !== "reload" && sessionStorage.getItem(SEEN_KEY) === slug;
      sessionStorage.setItem(SEEN_KEY, slug);
    } catch {}
    if (viaHub || reduce || seen) {
      // Already seen (or no motion wanted): lift straight away. Otherwise the sequence calls `lift` when it ends or is skipped.
      const id = window.setTimeout(lift, viaHub && !reduce ? 120 : 0);
      return () => window.clearTimeout(id);
    }
  }, [viaHub, slug, lift]);

  useEffect(() => {
    if (state !== "lifting") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setState("gone"), reduce ? 50 : 850);
    return () => window.clearTimeout(id);
  }, [state]);

  if (state === "gone") return null;
  return (
    <div aria-hidden className={`world-boot ${viaHub ? "is-via-hub" : "is-direct"} ${state === "lifting" ? "is-lifting" : ""}`} style={{ "--c": color } as CSSProperties}>
      <div className="world-boot-frame">
        {play ? (
          <ExitSequence world={{ slug, t, c: 0 }} items={items} photo={photo} delay={350} onDone={lift} boot />
        ) : (
          <ExitFrame slug={slug} t={t} items={items} photo={photo} />
        )}
      </div>
    </div>
  );
}
