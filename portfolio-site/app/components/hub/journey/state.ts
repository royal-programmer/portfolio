/**
 * The mutable bridge between the page (scroll, pointer, gate) and the scene.
 * Written by the page every event, read by the scene every frame — a plain
 * ref object, so nothing re-renders at 60 fps.
 */
export type SectionKind =
  | { kind: "hero" }
  | { kind: "through" }
  | { kind: "persona"; t: number; slug: string }
  | { kind: "more" }
  | { kind: "end" };

export type JourneyState = {
  /** Continuous section progress: 0 = hero centred, 1 = next section centred… */
  c: number;
  /** Pointer in NDC (−1…1), raw — the scene smooths it. */
  px: number;
  py: number;
  /** Look-around offsets from dragging (radians, targets). */
  yaw: number;
  pitch: number;
  dragging: boolean;
  lastDragEnd: number;
  /** Holding the pointer down "slows time". */
  holding: boolean;
  /** performance.now() when the visitor entered; 0 = not yet. */
  enteredAt: number;
};

export function createJourneyState(): JourneyState {
  return { c: 0, px: 0, py: 0, yaw: 0, pitch: 0, dragging: false, lastDragEnd: 0, holding: false, enteredAt: 0 };
}

export type Band = { t: number; lit: boolean; slug: string };
