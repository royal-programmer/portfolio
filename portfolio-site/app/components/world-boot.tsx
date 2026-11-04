"use client";

/**
 * A world page opens on its own window (D38): through the hub's doorway it is
 * the same finished window, already pushed in, which keeps zooming and
 * dissolves into the page — one motion across two hosts. On a direct visit
 * the same window is the page's loader: it holds a beat, then lifts, once per
 * world per session (moving around inside a world does not replay it).
 * Server-rendered, so the first paint is never white.
 */
import { useEffect, useState, type CSSProperties } from "react";
import type { PersonaSlug } from "@/lib/content/types";
import { ExitFrame } from "./hub/exit-sequence";

type Props = { slug: PersonaSlug; color: string; t: number; viaHub: boolean; items: string[]; photo?: string };

const SEEN_KEY = "xp-world-boot";

export function WorldBoot({ slug, color, t, viaHub, items, photo }: Props) {
  const [state, setState] = useState<"on" | "lifting" | "gone">("on");
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = !viaHub && sessionStorage.getItem(SEEN_KEY) === slug;
      sessionStorage.setItem(SEEN_KEY, slug);
    } catch {}
    const hold = reduce || seen ? 0 : viaHub ? 120 : 900;
    const lift = window.setTimeout(() => setState("lifting"), hold);
    const gone = window.setTimeout(() => setState("gone"), hold + (reduce ? 50 : 850));
    return () => {
      window.clearTimeout(lift);
      window.clearTimeout(gone);
    };
  }, [viaHub, slug]);
  if (state === "gone") return null;
  return (
    <div aria-hidden className={`world-boot ${viaHub ? "is-via-hub" : "is-direct"} ${state === "lifting" ? "is-lifting" : ""}`} style={{ "--c": color } as CSSProperties}>
      <div className="world-boot-frame">
        <ExitFrame slug={slug} t={t} items={items} photo={photo} />
      </div>
    </div>
  );
}
