"use client";

/**
 * The guide (Round H, Ratul's calls): a small HUD in the bottom-right corner, the way a spacecraft's
 * readout sits at the edge of the canopy. Every way around the hub is listed there, key on the
 * left and what it does on the right, in up to three columns (Move, Jump, Worlds). It opens with
 * the page and folds to its action strip the moment you scroll; the strip (Top, End, the sound on
 * phones, the guide's own toggle) never leaves. Tap the toggle and it opens until the next scroll.
 */
import { useSyncExternalStore } from "react";
import type { SoundChoice } from "@/lib/site/experience";
import { useExperience } from "../../experience-provider";

type Props = {
  /** The guide is allowed on screen (the gate is gone, no intro, no doorway in motion). */
  on: boolean;
  touch: boolean;
  immersive: boolean;
  chapters: Array<{ slug: string; role: string; color: string }>;
  /** Folded to its action strip (after a scroll); open shows the columns. */
  folded: boolean;
  onToggle: () => void;
  onTop: () => void;
  onEnd: () => void;
};

type Row = [key: string, action: string];

/** The sound scenes in the order a tap cycles them (phones have no menu, only this row). */
const SOUND_CYCLE: ReadonlyArray<{ id: SoundChoice; label: string }> = [
  { id: "off", label: "Off" },
  { id: "ambient", label: "Ambient" },
  { id: "wind", label: "Night wind" },
  { id: "rain", label: "Rain" },
  { id: "hum", label: "Deep hum" },
];

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

export function HubGuide({ on, touch, immersive, chapters, folded, onToggle, onTop, onEnd }: Props) {
  const fs = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenElement, () => false);
  const canFs = useSyncExternalStore(subscribeFullscreen, () => !!document.fullscreenEnabled, () => false);
  // Phones (Ratul's call): the sound switch lives in the HUD and nowhere else; a tap cycles the scenes.
  const { soundChoice, setSoundChoice } = useExperience();
  const soundIdx = Math.max(0, SOUND_CYCLE.findIndex((s) => s.id === soundChoice));
  const cycleSound = () => setSoundChoice(SOUND_CYCLE[(soundIdx + 1) % SOUND_CYCLE.length].id);

  // Three groups: moving through the place, jumping across it, the worlds by number. Touch gets the gestures only.
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
    <aside
      className={`hub-hud ${on ? "is-on" : ""} ${touch ? "is-touch" : ""} ${folded ? "is-folded" : ""}`}
      aria-label="How to move around"
      aria-hidden={!on}
    >
      <div className="hub-hud-cols" aria-hidden={folded}>
        <dl>
          <dt className="hub-hud-head">Move</dt>
          {move.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {jump.length ? (
          <dl>
            <dt className="hub-hud-head">Jump</dt>
            {jump.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {!touch && chapters.length ? (
          <dl className="hub-hud-worlds">
            <dt className="hub-hud-head">Worlds</dt>
            {chapters.map((c, i) => (
              <div key={c.slug}>
                <dt style={{ color: c.color }}>{i + 1}</dt>
                <dd>{c.role}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
      {/* The action strip: always on screen, folded or not. */}
      <div className="hub-hud-actions">
        <button type="button" onClick={onTop} aria-label="Back to the top">
          <span aria-hidden>▲</span>
          <span>Top</span>
        </button>
        <button type="button" onClick={onEnd} aria-label="Down to the end">
          <span aria-hidden>▼</span>
          <span>End</span>
        </button>
        {touch ? (
          <button type="button" className="hub-hud-sound" aria-pressed={soundChoice !== "off"} onClick={cycleSound} aria-label={`Sound: ${SOUND_CYCLE[soundIdx].label}. Tap for the next scene`}>
            <span aria-hidden>♪</span>
            <span>{SOUND_CYCLE[soundIdx].label}</span>
          </button>
        ) : null}
        <button type="button" className="hub-hud-toggle" onClick={onToggle} aria-expanded={!folded} aria-label={folded ? "Open the guide" : "Fold the guide"}>
          <span aria-hidden>{folded ? "◂" : "▸"}</span>
          <span>Guide</span>
        </button>
      </div>
    </aside>
  );
}
