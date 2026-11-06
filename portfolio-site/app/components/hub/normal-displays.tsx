"use client";

/**
 * Normal mode's doorways (Round E — "six displays"): the chapter's display, the very same one that
 * is the world's loader, sits where the 3D setup would be and plays once as the chapter arrives
 * — the terminal types, the chart builds, the viewfinder focuses, the canvas paints, the dash
 * boots, the monitor powers on — then holds. The line drawing on the canvas behind recedes as it
 * comes on: the sketch becomes the real thing. Hover pops it; a click (or the chapter's button)
 * zooms into it and the world opens on that finished window.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties, type MutableRefObject } from "react";
import type { PersonaSlug } from "@/lib/content/types";
import { personaIdentity } from "@/lib/site/brand";
import { personaHref } from "@/lib/site/persona-link";
import { spectrumColor } from "@/lib/site/spectrum";
import { ExitFrame, ExitSequence } from "./exit-sequence";
import type { World } from "./vr/state";

type Props = {
  worlds: World[];
  /** The chapter in view (the hub's section tracking). */
  activeSlug: string | null;
  items: string[];
  photo?: string;
  /** 0 → 1: how far the drawing behind should recede (the canvas reads it each frame). */
  recedeRef: MutableRefObject<number>;
  /** The chapter button calls this to go through the same doorway. */
  enterRef: MutableRefObject<((slug: string) => void) | null>;
};

export function NormalDisplays({ worlds, activeSlug, items, photo, recedeRef, enterRef }: Props) {
  const router = useRouter();
  const [shown, setShown] = useState<string | null>(null);
  const [played, setPlayed] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState<string | null>(null);

  // The display comes on a beat after the chapter arrives — the drawing is still finishing.
  useEffect(() => {
    const id = window.setTimeout(() => setShown(activeSlug), activeSlug ? 700 : 0);
    return () => window.clearTimeout(id);
  }, [activeSlug]);
  useEffect(() => {
    recedeRef.current = shown ? 1 : 0;
  }, [shown, recedeRef]);

  const enter = useCallback(
    (slug: string) => {
      const target = personaHref(window.location.origin, slug as PersonaSlug);
      // The world opens on the finished window and lifts it (the sequence already played here).
      const href = target.href + (target.href.includes("?") ? "&" : "?") + "via=normal";
      const go = () => {
        if (target.crossOrigin) window.location.assign(href);
        else router.push(href);
      };
      if (shown === slug) {
        setZoom(slug);
        window.setTimeout(go, 540);
      } else go();
    },
    [router, shown],
  );
  useEffect(() => {
    enterRef.current = enter;
    return () => {
      enterRef.current = null;
    };
  }, [enter, enterRef]);

  const world = worlds.find((w) => w.slug === shown);
  if (!world) return null;
  const slug = world.slug as PersonaSlug;
  const color = spectrumColor(world.t);
  const done = !!played[slug];
  return (
    <div key={slug} className={`normal-display ${zoom === slug ? "is-zoom" : ""}`} style={{ "--c": color } as CSSProperties}>
      <div className="normal-display-frame">
        {done ? <ExitFrame slug={slug} t={world.t} items={items} photo={photo} /> : <ExitSequence world={world} items={items} photo={photo} delay={250} onDone={() => setPlayed((p) => ({ ...p, [slug]: true }))} />}
      </div>
      <button type="button" className="normal-display-hit" aria-label={`${personaIdentity(slug).cta} — ${personaIdentity(slug).role}`} data-cursor-color={color} onClick={() => enter(slug)} />
    </div>
  );
}
