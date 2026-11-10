"use client";

/**
 * Experience controls (D36): Immersive / Normal switch, game-style quality
 * slider (Performance · Balanced · Best) and sound — no "Auto", no captions.
 */
import { useEffect, useId, useRef, useState } from "react";
import { QUALITIES, type Experience, type Quality, type SoundChoice } from "@/lib/site/experience";
import { useExperience } from "../experience-provider";

export const QUALITY_LABEL: Record<Quality, string> = {
  performance: "Performance",
  balanced: "Balanced",
  best: "Quality",
};

export function QualitySlider({
  value,
  onChange,
  suggested,
  className = "",
}: {
  value: Quality;
  onChange: (q: Quality) => void;
  suggested?: Quality;
  className?: string;
}) {
  const id = useId();
  const i = QUALITIES.indexOf(value);
  return (
    <div className={className}>
      <label htmlFor={id} className="sr-only">
        Graphics setting
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={2}
        step={1}
        value={i}
        aria-valuetext={QUALITY_LABEL[value]}
        onChange={(e) => onChange(QUALITIES[Number(e.target.value)])}
        className="xp-range w-full"
        style={{ "--p": `${i * 50}%` } as React.CSSProperties}
      />
      <div className="mt-2 grid grid-cols-3 font-mono text-[10px] tracking-[0.14em] uppercase">
        {QUALITIES.map((q, k) => (
          <button
            key={q}
            type="button"
            tabIndex={-1}
            onClick={() => onChange(q)}
            className={`hit ${k === 0 ? "text-left" : k === 1 ? "text-center" : "text-right"} transition-colors ${
              q === value ? "text-[var(--ink)]" : "text-[var(--ink-faint)] hover:text-[var(--ink-dim)]"
            }`}
          >
            {QUALITY_LABEL[q]}
            {suggested === q ? <span className="block normal-case tracking-normal text-[var(--ink-faint)]">suggested</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModeSwitch({ className = "" }: { className?: string }) {
  const { experience, ready, setExperience } = useExperience();
  const opts: Array<{ v: Experience; label: string }> = [
    { v: "immersive", label: "Immersive" },
    { v: "normal", label: "Normal" },
  ];
  return (
    <div role="radiogroup" aria-label="Experience" className={`inline-flex rounded-full border border-[var(--line)] bg-[var(--glass)] p-1 backdrop-blur-md ${className}`}>
      {opts.map((o) => {
        const on = ready && experience === o.v;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            onClick={() => setExperience(o.v)}
            className={`hit min-h-8 rounded-full px-3.5 max-sm:min-w-8 max-sm:px-2.5 font-mono text-[10px] tracking-[0.16em] uppercase transition-colors duration-[var(--dur-1)] ${
              on ? "bg-[var(--ink)] text-[var(--void)]" : "text-[var(--ink-dim)] hover:text-[var(--ink)]"
            }`}
          >
            {/* Phones: one letter (the full name is the aria-label). */}
            <span aria-hidden className="sm:hidden">
              {o.label[0]}
            </span>
            <span aria-hidden className="max-sm:hidden">
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const SCENES: ReadonlyArray<{ id: SoundChoice; label: string }> = [
  { id: "off", label: "Off" },
  { id: "ambient", label: "Ambient" },
  { id: "wind", label: "Night wind" },
  { id: "rain", label: "Rain" },
  { id: "hum", label: "Deep hum" },
];

/**
 * Sound: one control, a small menu. Off, or one of four synthesised soundscapes (no files, no
 * third parties). The bars show the state; the label names the scene.
 */
export function SoundToggle({ className = "", compact = false }: { className?: string; /** Bars only (phones): the label stays for screen readers. */ compact?: boolean }) {
  const { sound, soundChoice, setSoundChoice } = useExperience();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  const current = SCENES.find((x) => x.id === soundChoice) ?? SCENES[0];
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="hit group inline-flex min-h-8 items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-dim)] uppercase transition-colors hover:text-[var(--ink)]"
      >
        <span aria-hidden className={`sound-bars ${sound ? "is-on" : ""}`}>
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className={compact ? "sr-only" : ""}>Sound · {sound ? current.label : "off"}</span>
      </button>
      {open ? (
        <div role="menu" aria-label="Sound" className="sound-menu absolute top-full right-0 mt-3 w-44 rounded-2xl border border-[var(--line)] bg-[rgba(10,10,14,0.88)] p-2 backdrop-blur-xl">
          {SCENES.map((sc) => {
            const on = soundChoice === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                role="menuitemradio"
                aria-checked={on}
                onClick={() => {
                  setSoundChoice(sc.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${on ? "bg-[rgba(255,255,255,0.08)] text-[var(--ink)]" : "text-[var(--ink-dim)] hover:text-[var(--ink)]"}`}
              >
                {sc.label}
                <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${on ? "bg-current" : "border border-current opacity-40"}`} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Compact quality control for the top bar: a label that opens the slider. */
export function QualityMenu({ value, className = "" }: { value: Quality; className?: string }) {
  const { setQuality } = useExperience();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="hit inline-flex min-h-8 items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-[var(--ink-dim)] uppercase transition-colors hover:text-[var(--ink)]"
      >
        Graphics · {QUALITY_LABEL[value]}
      </button>
      {open ? (
        <div className="absolute top-full right-0 mt-3 w-64 rounded-2xl border border-[var(--line)] bg-[rgba(10,10,14,0.88)] p-5 backdrop-blur-xl">
          <QualitySlider value={value} onChange={setQuality} />
        </div>
      ) : null}
    </div>
  );
}
