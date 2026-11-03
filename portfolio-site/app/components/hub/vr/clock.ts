import { createContext, useContext, type MutableRefObject } from "react";
import type { VrState } from "./state";

/**
 * Scene time, settled by the Director once per frame and read by every part.
 *   t        light-time: slows while the visitor holds the pointer down
 *   scale    current time scale (1 normal, →0.1 while holding)
 *   phaseT   real seconds since the current phase began
 *   approach 0…1 the light's progress toward you (eased copy of state)
 *   cone     0…1 how far up the beams reach
 *   spread   0…1 how far the beams have fanned out (0 = one white pillar)
 *   chroma   0…1 how far the white has separated into colour
 *   climb    damped scroll progress (sections)
 *   sky      0…1 how visible the sky/stars are (0 in the gate)
 *   speed    0…1 sense of rushing (stars, lens) during the approach
 */
export type VrClock = {
  t: number;
  dt: number;
  scale: number;
  phaseT: number;
  approach: number;
  cone: number;
  spread: number;
  chroma: number;
  climb: number;
  sky: number;
  speed: number;
  /** Position of the spectrum the sky is tinted with (0…1), and how much. */
  tint: number;
  tintAmount: number;
};

export function createClock(): VrClock {
  return { t: 0, dt: 0, scale: 1, phaseT: 0, approach: 0, cone: 0, spread: 0, chroma: 0, climb: 0, sky: 0, speed: 0, tint: 0.5, tintAmount: 0 };
}

export type VrContextValue = {
  clock: MutableRefObject<VrClock>;
  state: MutableRefObject<VrState>;
};

export const VrContext = createContext<VrContextValue | null>(null);

export function useVr() {
  const v = useContext(VrContext);
  if (!v) throw new Error("useVr must be used inside the VR scene");
  return v;
}
