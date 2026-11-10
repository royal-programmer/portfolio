"use client";

/**
 * The Recruiter cut (17-persona-views.md §7, N3): a 90-second guided play over the page. The stops come from
 * the data (`show.recruiterCut`, card ids); each gets 30 s: scroll to the card, open it with its teleprompter,
 * close. Then it scrolls to "To be continued" and pulses "Say hello". Any trusted click, key, wheel or touch
 * stops it at once (no fighting the visitor; nothing here ever prevents a scroll gesture).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export const AUTOPILOT_SEEN_KEY = "xp-nf-autopilot-seen";
const STEP_MS = 30_000;
/** How long the modal's teleprompter types for (it then holds until the step closes it). */
export const AUTOPILOT_TYPE_MS = 27_000;

export const autopilotSeen = (): boolean => {
  try {
    return window.localStorage.getItem(AUTOPILOT_SEEN_KEY) === "1";
  } catch {
    return false;
  }
};
const markSeen = () => {
  try {
    window.localStorage.setItem(AUTOPILOT_SEEN_KEY, "1");
  } catch {}
};

export type AutopilotApi = {
  /** The stops: card ids, in play order. */
  cut: string[];
  /** Scroll the card into view and open its modal with Play running. Returns false when the card is not on the page. */
  openStop: (id: string) => boolean;
  /** Close the modal if one is open (with its fade). */
  closeModal: () => void;
  /** Scroll to "To be continued" and pulse its main button. */
  finish: () => void;
};

export type AutopilotState = { run: number; step: number; total: number; done: boolean };

export function useAutopilot(api: AutopilotApi) {
  const [state, setState] = useState<AutopilotState | null>(null);
  const timers = useRef<number[]>([]);
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  });
  const runId = useRef(0);

  const clear = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);

  const stop = useCallback(() => {
    clear();
    setState(null);
  }, [clear]);

  const after = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const start = useCallback(() => {
    clear();
    const cut = apiRef.current.cut;
    if (!cut.length) return;
    markSeen();
    const run = ++runId.current;
    const total = cut.length;
    setState({ run, step: 0, total, done: false });
    cut.forEach((id, i) => {
      after(i * STEP_MS, () => setState({ run, step: i, total, done: false }));
      // Scroll first, open once the page has settled, close just before the next stop begins.
      after(i * STEP_MS + 200, () => {
        apiRef.current.openStop(id);
      });
      after((i + 1) * STEP_MS - 600, () => apiRef.current.closeModal());
    });
    after(total * STEP_MS, () => {
      apiRef.current.finish();
      setState({ run, step: total, total, done: true });
    });
    after(total * STEP_MS + 7000, () => setState(null));
  }, [after, clear]);

  /** Jump to the end: close whatever is open, land on the contact card. */
  const skip = useCallback(() => {
    clear();
    apiRef.current.closeModal();
    const run = runId.current;
    const total = apiRef.current.cut.length;
    after(350, () => {
      apiRef.current.finish();
      setState({ run, step: total, total, done: true });
    });
    after(7000, () => setState(null));
  }, [after, clear]);

  // Any visitor input stops it. Synthetic events (our own Escape to close the modal) are not trusted and are ignored.
  const active = state !== null && !state.done;
  useEffect(() => {
    if (!active) return;
    const onInput = (e: Event) => {
      if (!e.isTrusted) return;
      if ((e.target as HTMLElement | null)?.closest?.(".nf-rail")) return;
      stop();
    };
    const evs = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    evs.forEach((n) => window.addEventListener(n, onInput, { passive: true, capture: true }));
    return () => evs.forEach((n) => window.removeEventListener(n, onInput, { capture: true }));
  }, [active, stop]);

  useEffect(() => clear, [clear]);

  return { state, start, stop, skip };
}

/** The thin rail under the top bar: three dots, a 90 s fill, "Skip to contact" and "✕". */
export function AutopilotRail({ state, onSkip, onStop }: { state: AutopilotState; onSkip: () => void; onStop: () => void }) {
  const dots = Array.from({ length: state.total }, (_, i) => i);
  return (
    <div className="nf-rail" role="group" aria-label="Recruiter cut, guided play" data-done={state.done || undefined}>
      <div className="nf-rail-track" aria-hidden>
        <span key={state.run} className="nf-rail-fill" style={{ animationDuration: `${state.total * STEP_MS}ms` }} data-done={state.done || undefined} />
        <span className="nf-rail-dots">
          {dots.map((i) => (
            <i key={i} data-on={state.step >= i || state.done ? "" : undefined} data-now={!state.done && state.step === i ? "" : undefined} />
          ))}
        </span>
      </div>
      <div className="nf-rail-pill">
        <span className="nf-rail-label">{state.done ? "That was the cut" : `Recruiter cut · ${Math.min(state.step + 1, state.total)} of ${state.total}`}</span>
        {state.done ? null : (
          <button type="button" onClick={onSkip}>
            Skip to contact
          </button>
        )}
        <button type="button" className="nf-rail-x" aria-label="Stop the guided play" onClick={onStop}>
          ✕
        </button>
      </div>
    </div>
  );
}
