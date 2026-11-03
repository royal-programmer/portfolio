"use client";

/**
 * The entry gate (D36) — the first thing anyone sees on the hub, and the
 * loader for the 3D journey at the same time.
 *
 * Nothing is decided silently: the device is analysed and a quality is
 * SUGGESTED (like a game's detected settings), the 3D compiles in the
 * background, and the visitor picks Immersive or Normal. Normal is always
 * available instantly; if 3D is slow or can't run, the gate says so plainly.
 *
 * `compact`: returning in the same session (or switching to Immersive from
 * the top bar) — just the gathering light, progress and a way out.
 */
import { useEffect, useState } from "react";
import type { Quality } from "@/lib/site/experience";
import { describeDevice, type DeviceReport } from "@/lib/site/device";
import { QualitySlider, SoundToggle } from "../experience-controls";

export type LoadStatus = "loading" | "ready" | "failed" | "unsupported";

type Props = {
  compact: boolean;
  device: DeviceReport | null;
  quality: Quality;
  onQuality: (q: Quality) => void;
  status: LoadStatus;
  startedAt: number;
  leaving: "immersive" | "normal" | null;
  onEnter: () => void;
  onNormal: () => void;
};

const SLOW_AFTER_MS = 9000;

/** Specks of light drifting in toward the centre, forever. */
function GatheringLight({ progress }: { progress: number }) {
  return (
    <div aria-hidden className="gate-light" style={{ "--p": progress } as React.CSSProperties}>
      {Array.from({ length: 28 }, (_, i) => (
        <i
          key={i}
          style={
            {
              "--a": `${(i * 137.5) % 360}deg`,
              "--r": `${70 + ((i * 53) % 120)}px`,
              "--d": `${(i * 0.37) % 3.2}s`,
              "--s": `${2.6 + ((i * 7) % 10) / 4}s`,
            } as React.CSSProperties
          }
        />
      ))}
      <b />
    </div>
  );
}

export function EntryGate({ compact, device, quality, onQuality, status, startedAt, leaving, onEnter, onNormal }: Props) {
  const [shown, setShown] = useState(0);
  const [slow, setSlow] = useState(false);

  // Displayed progress: creeps honestly while loading, completes when ready.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const target = status === "ready" ? 1 : status === "loading" ? 0.92 * (1 - Math.exp(-elapsed / 2600)) : 0;
      setShown((p) => (Math.abs(target - p) < 0.002 ? target : p + (target - p) * 0.08));
      setSlow(status === "loading" && elapsed > SLOW_AFTER_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, startedAt]);

  // Enter key = go in, once ready.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && status === "ready" && document.activeElement === document.body) onEnter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, onEnter]);

  const pct = Math.round(shown * 100);
  const canEnter = status === "ready";
  const blocked = status === "failed" || status === "unsupported";

  const progressLine = (
    <div className="h-px w-full overflow-hidden bg-[var(--line)]">
      <div className="h-full bg-[var(--ink)] transition-[width] duration-150" style={{ width: `${pct}%` }} />
    </div>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose how to enter"
      className={`gate fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[var(--void)] text-[var(--ink)] ${leaving ? `is-leaving is-leaving-${leaving}` : ""}`}
    >
      <div className="flex items-center justify-between px-4 pt-5 sm:px-8 lg:px-12">
        <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase">ratulroy.me</span>
        <SoundToggle />
      </div>

      <div className="relative flex flex-1 flex-col items-center justify-center px-4 py-6 sm:px-8">
        <GatheringLight progress={shown} />

        {compact ? (
          <div className="relative mt-6 flex w-full max-w-xs flex-col items-center gap-4 text-center">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--ink-dim)] uppercase">
              {blocked ? "3D couldn’t start here" : canEnter ? "Ready" : `Gathering light · ${pct}%`}
            </p>
            {progressLine}
            <button type="button" onClick={onNormal} className="font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase underline-offset-4 hover:text-[var(--ink)] hover:underline">
              {blocked ? "Continue in Normal view" : "Skip — Normal view"}
            </button>
          </div>
        ) : (
          <div className="gate-panel relative mt-4 w-full max-w-4xl">
            <p className="text-center font-mono text-[10px] tracking-[0.24em] text-[var(--ink-faint)] uppercase">Ratul Roy · one mind, many perspectives</p>
            <h1 className="mt-5 text-center font-display text-[length:clamp(2.6rem,1.6rem+4vw,5.4rem)] leading-[0.95] tracking-[-0.02em]">
              Choose how you
              <span className="italic text-[var(--ink-dim)]"> step in.</span>
            </h1>

            <div className="mt-8 grid gap-7 sm:mt-12 sm:grid-cols-[1fr_auto_1fr] sm:gap-12">
              {/* Immersive */}
              <section aria-labelledby="gate-immersive" className="flex flex-col">
                <h2 id="gate-immersive" className="font-display text-[length:var(--step-3)] leading-none">
                  Immersive
                </h2>
                <p className="mt-2 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-faint)] uppercase">3D journey · drag · hold · sound</p>
                {device && !blocked ? (
                  <>
                    <p className="mt-5 text-xs leading-relaxed text-[var(--ink-dim)]">
                      <span className="text-[var(--ink-faint)]">Detected </span>
                      {describeDevice(device)}
                    </p>
                    <QualitySlider className="mt-5" value={quality} onChange={onQuality} suggested={device.suggested} />
                  </>
                ) : null}
                {blocked ? (
                  <p className="mt-5 text-sm leading-relaxed text-[var(--ink-dim)]">
                    {status === "unsupported" ? "This browser can’t run 3D." : "3D couldn’t start on this device."} Normal view tells the same story.
                  </p>
                ) : (
                  <div className="mt-7">
                    <button
                      type="button"
                      disabled={!canEnter}
                      onClick={onEnter}
                      className="gate-enter group relative inline-flex min-h-12 w-full items-center justify-between gap-4 overflow-hidden rounded-full border border-[var(--line-strong)] px-6 text-sm font-medium disabled:cursor-progress"
                    >
                      <span className="gate-enter-fill" style={{ transform: `scaleX(${shown})` }} aria-hidden />
                      <span className="relative">{canEnter ? "Enter the light" : `Gathering light · ${pct}%`}</span>
                      <span aria-hidden className="relative transition-transform duration-[var(--dur-2)] group-enabled:group-hover:translate-x-1">
                        →
                      </span>
                    </button>
                    <p className="mt-3 text-xs text-[var(--ink-faint)] empty:hidden sm:min-h-4 sm:empty:block" aria-live="polite">
                      {slow ? "Taking longer than usual — Normal view is ready right now." : device?.preferNormal ? "This device may struggle with 3D — Normal is recommended." : ""}
                    </p>
                  </div>
                )}
              </section>

              <div aria-hidden className="hidden w-px bg-[var(--line)] sm:block" />

              {/* Normal */}
              <section aria-labelledby="gate-normal" className="flex flex-col">
                <h2 id="gate-normal" className="font-display text-[length:var(--step-3)] leading-none text-[var(--ink-dim)]">
                  Normal
                </h2>
                <p className="mt-2 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-faint)] uppercase">Animated · lighter · instant</p>
                <p className="mt-5 max-w-xs text-xs leading-relaxed text-[var(--ink-dim)] max-sm:hidden">
                  The same story without 3D. Kinder to older devices and slow connections.
                </p>
                <button
                  type="button"
                  onClick={onNormal}
                  className="mt-auto inline-flex min-h-12 w-full items-center justify-between gap-4 rounded-full border border-[var(--line)] px-6 text-sm text-[var(--ink-dim)] transition-colors duration-[var(--dur-1)] hover:border-[var(--line-strong)] hover:text-[var(--ink)] max-sm:mt-4"
                >
                  Normal view <span aria-hidden>→</span>
                </button>
              </section>
            </div>
          </div>
        )}
      </div>

      <p className="px-4 pb-6 text-center font-mono text-[10px] tracking-[0.16em] text-[var(--ink-faint)] uppercase sm:px-8">
        Switch any time from the top bar
      </p>
    </div>
  );
}
