/**
 * Autoplay next (17-persona-views.md §25, F3). The visitor's choice lives in `xp-nf-binge` (`on` or `off`); with no choice it is on,
 * and off under reduced motion. Cancelling a countdown turns it off for the rest of the session only (`sessionStorage`), and the
 * toggle in the modal bar clears that. Pure functions over storage, never throwing.
 */
export const BINGE_KEY = "xp-nf-binge";
const CANCEL_KEY = "xp-nf-binge-cancel";
export const BINGE_SECONDS = 5;

const get = (s: "localStorage" | "sessionStorage", k: string): string | null => {
  try {
    return window[s].getItem(k);
  } catch {
    return null;
  }
};

/** Whether the countdown card should run after an episode: the stored choice (else the motion default), unless cancelled this session. */
export function bingeActive(calm: boolean): boolean {
  if (get("sessionStorage", CANCEL_KEY) === "1") return false;
  const v = get("localStorage", BINGE_KEY);
  return v === "on" ? true : v === "off" ? false : !calm;
}

/** The toggle: stores the choice and forgets this session's cancel. */
export function setBinge(on: boolean): void {
  try {
    window.localStorage.setItem(BINGE_KEY, on ? "on" : "off");
    window.sessionStorage.removeItem(CANCEL_KEY);
  } catch {}
}

/** Cancel on the countdown card: off for this session. */
export function cancelBinge(): void {
  try {
    window.sessionStorage.setItem(CANCEL_KEY, "1");
  } catch {}
}
