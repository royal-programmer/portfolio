"use client";

/**
 * A world page opens on its own window (D38). It is the page's loader from its
 * first frame: the terminal types, the chart builds to its target, the
 * viewfinder focuses and fires — then it lifts. Through the hub's doorway the
 * camera flew into this very window and the hub cut here the moment it filled
 * the view, so the sequence reads as one motion across two hosts. Once per world per session (moving around inside a world does not
 * replay it; a reload does). Server-rendered, so the first paint is never
 * white — and the window is alive in CSS alone (`boot`) until the page's
 * script arrives, however long that takes.
 */
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { PersonaSlug } from "@/lib/content/types";
import { ExitFrame, ExitSequence } from "./hub/exit-sequence";

type Props = { slug: PersonaSlug; color: string; t: number; /** "hub": the camera flew into this window, play on from its first frame. "normal": the display already played on the hub — open on the finished window and lift. */ via: "hub" | "normal" | null; items: string[]; photo?: string };

const SEEN_KEY = "xp-world-boot";

export function WorldBoot({ slug, color, t, via, items, photo }: Props) {
  const [state, setState] = useState<"on" | "lifting" | "gone">("on");
  const viaHub = via === "hub";
  const finished = via === "normal";
  // The sequence's first frame is server-rendered (an empty terminal, a bare chart, a soft live view),
  // so nothing finished flashes before it starts. Through the hub that frame is the one the hub cut
  // from: the sequence simply carries on here.
  const play = !finished;

  const lift = useCallback(() => {
    setState((s) => (s === "on" ? "lifting" : s));
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      // Once per world per session — but a reload of the page replays it (that is someone asking to see it again).
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      // Through the hub's doorway it always plays: the hub handed over mid-motion.
      seen = !viaHub && nav?.type !== "reload" && sessionStorage.getItem(SEEN_KEY) === slug;
      sessionStorage.setItem(SEEN_KEY, slug);
    } catch {}
    if (finished || reduce || seen) {
      // Finished already (Normal mode's display played it), seen, or no motion wanted: lift straight
      // away — after a short hold when arriving on the finished window, so the cut reads.
      const id = window.setTimeout(lift, finished && !reduce ? 160 : 0);
      return () => window.clearTimeout(id);
    }
  }, [viaHub, finished, slug, lift]);

  useEffect(() => {
    if (state !== "lifting") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => setState("gone"), reduce ? 50 : 850);
    return () => window.clearTimeout(id);
  }, [state]);

  if (state === "gone") return null;
  return (
    <div aria-hidden className={`world-boot ${viaHub ? "is-via-hub" : finished ? "is-finished" : "is-direct"} ${state === "lifting" ? "is-lifting" : ""}`} style={{ "--c": color } as CSSProperties}>
      <div className="world-boot-frame">
        {play ? <ExitSequence world={{ slug, t, c: 0 }} items={items} photo={photo} delay={viaHub ? 150 : 350} onDone={lift} boot /> : <ExitFrame slug={slug} t={t} items={items} photo={photo} />}
      </div>
    </div>
  );
}
