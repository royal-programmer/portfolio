"use client";

/**
 * The headset gate (D38) — the first thing anyone sees. The headset itself
 * floats in the 3D scene behind this overlay; this is the quiet UI around it:
 * device read-out, quality slider, sound, and the Normal way in.
 *
 * Nothing is decided silently: the device is analysed and a quality is
 * SUGGESTED, the scene compiles while the visitor looks at the headset, and
 * clicking the headset (or Enter) puts it on. Normal is always instant. If 3D
 * is slow or can't run, the gate says so plainly.
 */
import { useEffect, useState } from "react";
import type { Quality } from "@/lib/site/experience";
import { describeDevice, type DeviceReport } from "@/lib/site/device";
import { QualitySlider, SoundToggle } from "../experience-controls";

export type LoadStatus = "loading" | "ready" | "failed" | "unsupported";

type Props = {
  device: DeviceReport | null;
  quality: Quality;
  onQuality: (q: Quality) => void;
  status: LoadStatus;
  startedAt: number;
  leaving: boolean;
  onWear: () => void;
  onNormal: () => void;
};

const SLOW_AFTER_MS = 9000;

/**
 * What the server sends before any script runs: the gate's still parts in the
 * same places, so the page opens ON the loader and the live gate takes over
 * without a jump. Hidden by CSS when the visitor's saved mode is Normal.
 */
export function GateSkeleton() {
  return (
    <div aria-hidden className="gate-skeleton flex h-full flex-col text-[var(--ink)]">
      <div className="flex items-center justify-between px-4 pt-5 sm:px-8 lg:px-12">
        <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase">ratulroy.me</span>
      </div>
      <div className="flex flex-1 flex-col items-center px-4 pt-[6svh] sm:px-8">
        <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--ink-faint)] uppercase">Ratul Roy</p>
        <h1 className="mt-3 text-center font-display text-[length:clamp(1.9rem,1.2rem+2.4vw,3.4rem)] leading-[0.95] tracking-[-0.02em]">
          One mind. <span className="italic text-[var(--ink-dim)]">Many perspectives.</span>
        </h1>
        <div className="flex-1" />
        <p className="mb-[9svh] flex items-center gap-3 font-mono text-[11px] tracking-[0.2em] text-[var(--ink-dim)] uppercase" aria-label="Loading">
          <span aria-hidden className="gate-ring is-spinning" />
        </p>
        <p className="mb-6 min-h-4" />
      </div>
      <div className="h-[7.5rem] sm:h-[6.5rem]" />
    </div>
  );
}

export function HeadsetGate({ device, quality, onQuality, status, startedAt, leaving, onWear, onNormal }: Props) {
  const [pct, setPct] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let raf = 0;
    let shown = 0;
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const target = status === "ready" ? 1 : status === "loading" ? 0.92 * (1 - Math.exp(-elapsed / 2600)) : 0;
      shown = Math.abs(target - shown) < 0.002 ? target : shown + (target - shown) * 0.08;
      setPct(Math.round(shown * 100));
      setSlow(status === "loading" && elapsed > SLOW_AFTER_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, startedAt]);

  const ready = status === "ready";
  const blocked = status === "failed" || status === "unsupported";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Put on the headset, or proceed without it"
      className={`gate pointer-events-none fixed inset-0 z-50 flex flex-col text-[var(--ink)] ${leaving ? "is-leaving" : ""} ${blocked ? "bg-[var(--void)]" : ""}`}
    >
      <div className="flex items-center justify-between px-4 pt-5 sm:px-8 lg:px-12">
        <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase">ratulroy.me</span>
        <span className="pointer-events-auto flex items-center gap-3 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-faint)] uppercase">
          <span className="max-sm:hidden">Best with sound ·</span>
          <SoundToggle />
        </span>
      </div>

      <div className="gate-panel flex flex-1 flex-col items-center px-4 pt-[6svh] sm:px-8">
        <p className="font-mono text-[10px] tracking-[0.24em] text-[var(--ink-faint)] uppercase">Ratul Roy</p>
        <h1 className="mt-3 text-center font-display text-[length:clamp(1.9rem,1.2rem+2.4vw,3.4rem)] leading-[0.95] tracking-[-0.02em]">
          One mind. <span className="italic text-[var(--ink-dim)]">Many perspectives.</span>
        </h1>

        {/* The headset floats here, in the scene behind. */}
        <div className="flex-1" />

        {blocked ? (
          <div className="pointer-events-auto mb-[12svh] max-w-sm text-center">
            <p className="text-sm leading-relaxed text-[var(--ink-dim)]">
              {status === "unsupported" ? "This browser can’t run 3D." : "3D couldn’t start on this device."} Normal view tells the same story.
            </p>
            <button type="button" onClick={onNormal} className="mt-6 inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--ink)] px-7 text-sm font-medium text-[var(--void)]">
              Normal view <span aria-hidden>→</span>
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={!ready}
              onClick={onWear}
              className="gate-wear pointer-events-auto mb-[9svh] max-sm:mb-[3svh] font-mono text-[11px] tracking-[0.2em] text-[var(--ink-dim)] uppercase transition-colors hover:text-[var(--ink)] disabled:cursor-progress"
            >
              {ready ? (
                "Put on the headset"
              ) : (
                <span className="flex items-center gap-3">
                  <span aria-hidden className="gate-ring" style={{ "--p": pct / 100 } as React.CSSProperties} />
                  <span className="tabular-nums">{pct}%</span>
                </span>
              )}
              {ready ? <span aria-hidden className="gate-wear-line" /> : null}
            </button>
            <p className="mb-3 min-h-4 text-center text-xs text-[var(--ink-faint)] sm:mb-6" aria-live="polite">
              {slow ? "Taking longer than usual — Normal view is ready right now." : device?.preferNormal ? "This device may struggle with 3D — Normal is recommended." : ""}
            </p>
            {/* Phones: a real, visible way past the headset, right under it (the small text link below is for sm and up). */}
            <button
              type="button"
              onClick={onNormal}
              className="pointer-events-auto mb-6 inline-flex min-h-11 w-full max-w-sm items-center justify-center rounded-full border border-[var(--ink-dim)] px-5 font-mono text-xs text-[var(--ink)] sm:hidden"
            >
              Skip the headset · Normal view <span aria-hidden className="ml-2">→</span>
            </button>
          </>
        )}
      </div>

      {!blocked ? (
        <div className="gate-panel grid gap-6 px-4 pb-8 sm:grid-cols-[minmax(0,20rem)_1fr_auto] sm:items-end sm:px-8 sm:pb-10 lg:px-12">
          <div className="pointer-events-auto">
            {device ? (
              <p className="text-xs leading-relaxed text-[var(--ink-dim)]">
                <span className="text-[var(--ink-faint)]">Detected </span>
                {describeDevice(device)}
              </p>
            ) : null}
            <QualitySlider className="mt-3" value={quality} onChange={onQuality} suggested={device?.suggested} />
          </div>
          <div />
          <button
            type="button"
            onClick={onNormal}
            className="hit pointer-events-auto justify-self-start font-mono text-[10px] tracking-[0.2em] text-[var(--ink-faint)] uppercase underline-offset-4 transition-colors hover:text-[var(--ink)] hover:underline max-sm:hidden sm:justify-self-end"
          >
            Or proceed without the headset →
          </button>
        </div>
      ) : null}
    </div>
  );
}
