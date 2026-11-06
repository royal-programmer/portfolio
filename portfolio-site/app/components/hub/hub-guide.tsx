"use client";

/**
 * The guide (Round H, Ratul's call): a small HUD in the bottom-right corner, the way a spacecraft's
 * readout sits at the edge of the canopy. Every way around the hub is listed there, key on the
 * left and what it does on the right, in one or two columns depending on how much there is. It
 * stays on; nothing to open, nothing to dismiss. It only leaves with the rest of the chrome
 * (the gate, the intro, a doorway in motion).
 */
import { useSyncExternalStore } from "react";
import { useExperience } from "../../experience-provider";

type Props = {
  /** The guide is allowed on screen (the gate is gone, no intro, no doorway in motion). */
  on: boolean;
  touch: boolean;
  immersive: boolean;
  chapters: Array<{ slug: string; role: string; color: string }>;
};

type Row = [key: string, action: string];

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

export function HubGuide({ on, touch, immersive, chapters }: Props) {
  const fs = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);
  const canFs = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenEnabled, () => false);
  // Phones (Ratul's call): the sound switch lives in the HUD and nowhere else.
  const { sound, setSoundChoice } = useExperience();

  // Two groups: moving through the place, and jumping across it. Touch gets the gestures only.
  const move: Row[] = touch
    ? [
        ["Scroll", immersive ? "Climb" : "Follow the light"],
        ...(immersive ? ([["Hold", "Slow time"]] as Row[]) : []),
        ["Tap display", "Step in"],
      ]
    : [
        ["Scroll", immersive ? "Climb" : "Follow the light"],
        ...(immersive ? ([["Hold", "Slow time"], ["Drag", "Look around"], ["− + 0", "Lens"]] as Row[]) : []),
      ];
  const jump: Row[] = touch
    ? []
    : [
        ["Space", "Next world"],
        ["⇧ Space", "Previous"],
        [`1 – ${Math.max(1, chapters.length)}`, "Straight to"],
        ["Enter", "Step in"],
        ...(canFs ? ([["F", fs ? "Exit fullscreen" : "Fullscreen"]] as Row[]) : []),
      ];

  return (
    <aside className={`hub-hud ${on ? "is-on" : ""} ${touch ? "is-touch" : ""}`} aria-label="How to move around" aria-hidden={!on}>
      <div className="hub-hud-cols">
        <dl>
          {move.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {jump.length ? (
          <dl>
            {jump.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {touch ? (
        <button type="button" className="hub-hud-sound" aria-pressed={sound} onClick={() => setSoundChoice(sound ? "off" : "ambient")}>
          <span>Sound</span>
          <span>{sound ? "On" : "Off"}</span>
        </button>
      ) : null}
      {!touch && chapters.length ? (
        <p className="hub-hud-worlds">
          {chapters.map((c, i) => (
            <span key={c.slug}>
              <b style={{ color: c.color }}>{i + 1}</b>
              {c.role}
            </span>
          ))}
        </p>
      ) : null}
    </aside>
  );
}
