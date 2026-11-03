import { createContext, useContext, type MutableRefObject } from "react";
import type { JourneyState } from "./state";

/**
 * Scene time. `t` is "light time" — it slows while the visitor holds the
 * pointer down; `intro` is real seconds since they entered (−1 before).
 * `c` is the damped section progress the Director settled on this frame.
 */
export type JourneyClock = {
  t: number;
  scale: number;
  intro: number;
  c: number;
  dt: number;
  /** Per band (spectrum order): how "in focus" its chapter is, 0…1. */
  act: number[];
  /** 0…1: the river spreading out after impact. */
  reveal: number;
  /** 0…1: the closing — every colour folds back into one white light. */
  fold: number;
  /** 0…1: the "more colours" chapter is in view (upcoming bands flicker up). */
  more: number;
  /** 0…1: the camera is inside the glass. */
  inside: number;
};

export function createClock(): JourneyClock {
  return { t: 0, scale: 1, intro: -1, c: 0, dt: 0, act: new Array(16).fill(0), reveal: 0, fold: 0, more: 0, inside: 0 };
}

export type JourneyContextValue = {
  clock: MutableRefObject<JourneyClock>;
  state: MutableRefObject<JourneyState>;
};

export const JourneyContext = createContext<JourneyContextValue | null>(null);

export function useJourney() {
  const v = useContext(JourneyContext);
  if (!v) throw new Error("useJourney must be used inside the journey scene");
  return v;
}
