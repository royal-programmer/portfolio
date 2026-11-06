"use client";

/**
 * The guide (Round H, Ratul's call): the hero is the words alone, so the way around lives in one
 * small line in the bottom-right corner. It fades once the visitor has moved (scrolled, dragged,
 * pressed a key) or after a while on its own, and comes back if they sit still. The `?` key, or
 * the line's own button, opens the shortcuts card; Escape or a click outside closes it.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Props = {
  text: string;
  /** The guide is allowed on screen (the gate is gone, no intro, no doorway in motion). */
  on: boolean;
  touch: boolean;
  immersive: boolean;
  help: boolean;
  onHelp: (open: boolean) => void;
  chapters: Array<{ slug: string; role: string; color: string }>;
};

const AUTO_HIDE_MS = 9000;
const IDLE_SHOW_MS = 14000;

/** F: the page fills the screen (desktop, Android); iPhones have no fullscreen API and nothing happens. */
export function toggleFullscreen() {
  try {
    if (!document.fullscreenEnabled) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen({ navigationUI: "hide" });
  } catch {}
}

function subscribeFullscreen(cb: () => void) {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
}

export function HubGuide({ text, on, touch, immersive, help, onHelp, chapters }: Props) {
  const [shown, setShown] = useState(true);
  const fs = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);
  const canFs = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenEnabled, () => false);
  const lastInput = useRef(0);
  const dismissed = useRef(false);

  useEffect(() => {
    if (!on) return;
    lastInput.current = performance.now();
    const y0 = window.scrollY;
    const move = () => {
      lastInput.current = performance.now();
      if (!dismissed.current && Math.abs(window.scrollY - y0) > 80) {
        dismissed.current = true;
        setShown(false);
      }
    };
    const act = () => {
      lastInput.current = performance.now();
      dismissed.current = true;
      setShown(false);
    };
    const auto = window.setTimeout(() => {
      dismissed.current = true;
      setShown(false);
    }, AUTO_HIDE_MS);
    // Sitting still for a while: the line comes back.
    const idle = window.setInterval(() => {
      if (performance.now() - lastInput.current > IDLE_SHOW_MS) setShown(true);
    }, 1000);
    window.addEventListener("scroll", move, { passive: true });
    window.addEventListener("wheel", move, { passive: true });
    window.addEventListener("touchstart", move, { passive: true });
    window.addEventListener("pointerdown", act);
    window.addEventListener("keydown", act);
    return () => {
      window.clearTimeout(auto);
      window.clearInterval(idle);
      window.removeEventListener("scroll", move);
      window.removeEventListener("wheel", move);
      window.removeEventListener("touchstart", move);
      window.removeEventListener("pointerdown", act);
      window.removeEventListener("keydown", act);
    };
  }, [on]);

  const visible = on && (shown || help);
  const rows: Array<[string, string]> = touch
    ? [
        ["Scroll", immersive ? "Climb" : "Follow the light"],
        ...(immersive ? ([["Touch & hold", "Slow time"], ["Drag", "Look around"]] as Array<[string, string]>) : []),
        ["Tap the display", "Step into that world"],
      ]
    : [
        ["Scroll", immersive ? "Climb" : "Follow the light"],
        ...(immersive ? ([["Hold", "Slow time"], ["Drag", "Look around"], ["− / + / 0", "Lens"]] as Array<[string, string]>) : []),
        ["Space / Shift+Space", "Next / previous world"],
        [`1 – ${Math.max(1, chapters.length)}`, "Straight to a world"],
        ["Enter", "Step into the world you are at"],
        ...(canFs ? ([["F", fs ? "Leave fullscreen" : "Fullscreen"]] as Array<[string, string]>) : []),
        ["?", "This card"],
      ];

  return (
    <>
      {help ? <button type="button" aria-label="Close the shortcuts" className="hub-help-scrim" onClick={() => onHelp(false)} /> : null}
      <div className={`hub-guide ${visible ? "is-on" : ""}`} aria-hidden={!visible}>
        {help ? (
          <div role="dialog" aria-label="Shortcuts" className="hub-help">
            <p className="hub-help-title">{immersive ? "Finding your way" : "Normal mode"}</p>
            <dl>
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <p className="hub-help-worlds">
              {chapters.map((c, i) => (
                <span key={c.slug}>
                  <b style={{ color: c.color }}>{i + 1}</b> {c.role}
                </span>
              ))}
            </p>
            {canFs ? (
              <button type="button" className="hub-help-fs" onClick={toggleFullscreen}>
                {fs ? "Leave fullscreen" : "Go fullscreen"} <span aria-hidden>⛶</span>
              </button>
            ) : null}
          </div>
        ) : null}
        <p className="hub-guide-line">
          <span>{text}</span>
          <button type="button" aria-label="Shortcuts" aria-expanded={help} onClick={() => onHelp(!help)}>
            ?
          </button>
        </p>
      </div>
    </>
  );
}
