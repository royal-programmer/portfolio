/**
 * The VR journey (D38) — shared state between the page and the scene.
 *
 * Phases, in order:
 *   gate      the headset floats in the dark; the visitor decides
 *   wear      the headset comes up to the face; lenses fill the view
 *   blink     black, then the eyes open onto the sky
 *   sky       night sky, one point of light far ahead · "Press Space"
 *   approach  the light comes at you, slow then faster (hold = slow time)
 *   impact    white flash — you are the prism
 *   split     the camera rides the J as the light splits into a cone above
 *   climb     scroll unlocked: spiral up through the cone past the object field; each
 *             persona's parts assemble and light up — tap a lit assembly to fly into its world
 *
 * Written by the page on events, read by the scene every frame — a plain
 * ref object, so nothing re-renders at 60 fps.
 */
export type Phase = "gate" | "wear" | "blink" | "sky" | "approach" | "impact" | "split" | "climb";

export const PHASE_ORDER: Phase[] = ["gate", "wear", "blink", "sky", "approach", "impact", "split", "climb"];

/** Fixed-length phases (seconds); `sky` waits for Space, `approach` is integrated. */
export const PHASE_LENGTH = { wear: 1.45, blink: 1.3, impact: 0.4, split: 5.2 } as const;

export type VrState = {
  phase: Phase;
  /** performance.now() when the phase began. */
  phaseAt: number;
  /** 0…1: how far the light has come toward you (integrated in light-time). */
  approach: number;
  /** Section progress from the page scroll: 0 = first section centred… */
  c: number;
  /** Pointer in NDC (−1…1), raw — the scene smooths it. */
  px: number;
  py: number;
  /** Look-around offsets from dragging (radians, targets). */
  yaw: number;
  pitch: number;
  dragging: boolean;
  lastDragEnd: number;
  /** Holding the pointer down slows light-time. */
  holding: boolean;
  /** The headset is hovered (page reads it for the cursor / hint). */
  hover: boolean;
  /** Intro was skipped or the visitor is returning: no flash, land on the climb. */
  skipped: boolean;
  /** The lit assembly under the pointer (its persona), if any — set by the scene. */
  portalHover: string | null;
  /** Where that assembly's screen is (world) and which way it faces — set by the scene. */
  portalAnchor: { x: number; y: number; z: number; nx: number; ny: number; nz: number } | null;
  /** The visitor clicked a lit assembly: the camera flies into its screen, then the page leaves. */
  portal: { slug: string; at: number } | null;
  /** Lens: 0 normal, +1 pulled wide (watch the assembly whole), −0.5 tight. Keys − / + / 0. */
  zoom: number;
};

/** Seconds from the click on a lit assembly to the page leaving for its world. */
export const PORTAL_LENGTH = 1.6;

/** A persona world on the climb: where on the scroll it peaks, and its colour. */
export type World = { slug: string; t: number; c: number };

export function createVrState(): VrState {
  return {
    phase: "gate",
    phaseAt: 0,
    approach: 0,
    c: 0,
    px: 0,
    py: 0,
    yaw: 0,
    pitch: 0,
    dragging: false,
    lastDragEnd: 0,
    holding: false,
    hover: false,
    skipped: false,
    portalHover: null,
    portalAnchor: null,
    portal: null,
    zoom: 0,
  };
}

export const phaseIndex = (p: Phase) => PHASE_ORDER.indexOf(p);
/** True when `p` is at or after `q`. */
export const atLeast = (p: Phase, q: Phase) => phaseIndex(p) >= phaseIndex(q);

export type Band = { t: number; lit: boolean; slug: string };
