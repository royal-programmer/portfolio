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
import { createPortal } from "react-dom";
import type { PersonaSlug } from "@/lib/content/types";
import { personaIdentity } from "@/lib/site/brand";
import { personaHref } from "@/lib/site/persona-link";
import { speculate } from "@/lib/site/speculate";
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
  /** Told the moment a doorway is taken (the chapter's button shows it is busy), and null if the page comes back from the cache. */
  onWaiting?: (slug: string | null) => void;
};

export function NormalDisplays({ worlds, activeSlug, items, photo, recedeRef, enterRef, onWaiting }: Props) {
  const router = useRouter();
  const [shown, setShown] = useState<string | null>(null);
  const [played, setPlayed] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState<string | null>(null);
  /** The curtain the zoomed card dissolves into, so the hub never shows a hole while the other host answers. */
  const [curtain, setCurtain] = useState<{ color: string; host: string } | null>(null);
  // Phones and tablets (Round H): the display is not a fixed window over the words — it sits in
  // the chapter's own flow, above its title, in the slot the chapter renders (`<slug>-display`).
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setSlot(mq.matches && shown ? document.getElementById(`${shown}-display`) : null);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [shown]);

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
      // The click is heard at once: the chapter's button turns busy, and the display zooms and stays
      // zoomed (until the page is hidden) while the other host answers.
      onWaiting?.(slug);
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (shown === slug) {
        setZoom(slug);
        const w = worlds.find((x) => x.slug === slug);
        setCurtain({ color: w ? spectrumColor(w.t) : "#6aa6ff", host: target.crossOrigin ? new URL(target.href).host : window.location.host });
        window.setTimeout(go, reduce ? 80 : 540);
      } else go();
    },
    [router, shown, onWaiting, worlds],
  );
  // Coming back from the back/forward cache: the doorway is free again.
  useEffect(() => {
    const back = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setZoom(null);
      setCurtain(null);
      onWaiting?.(null);
    };
    window.addEventListener("pageshow", back);
    return () => window.removeEventListener("pageshow", back);
  }, [onWaiting]);
  useEffect(() => {
    enterRef.current = enter;
    return () => {
      enterRef.current = null;
    };
  }, [enter, enterRef]);

  const curtainNode =
    curtain && typeof document !== "undefined"
      ? createPortal(
          <div className="hub-curtain" style={{ "--c": curtain.color } as CSSProperties} role="status">
            <i className="hub-curtain-line" aria-hidden="true" />
            <span>opening {curtain.host}…</span>
          </div>,
          document.body,
        )
      : null;
  const world = worlds.find((w) => w.slug === shown);
  if (!world) return curtainNode;
  const slug = world.slug as PersonaSlug;
  const color = spectrumColor(world.t);
  const done = !!played[slug];
  const node = (
    <div key={slug} className={`normal-display ${slot ? "is-inflow" : ""} ${zoom === slug ? "is-zoom" : ""}`} style={{ "--c": color } as CSSProperties}>
      <div className="normal-display-frame">
        {done ? <ExitFrame slug={slug} t={world.t} items={items} photo={photo} /> : <ExitSequence world={world} items={items} photo={photo} delay={250} onDone={() => setPlayed((p) => ({ ...p, [slug]: true }))} />}
      </div>
      <button type="button" className="normal-display-hit" aria-label={`${personaIdentity(slug).cta} — ${personaIdentity(slug).role}`} data-cursor-color={color} onPointerEnter={() => speculate(slug)} onPointerDown={() => speculate(slug)} onFocus={() => speculate(slug)} onClick={() => enter(slug)} />
    </div>
  );
  return (
    <>
      {slot ? createPortal(node, slot) : node}
      {curtainNode}
    </>
  );
}
