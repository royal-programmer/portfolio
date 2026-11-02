"use client";

import { useExperience } from "../experience-provider";
import type { AutoReason, ExperiencePref } from "@/lib/site/experience";

const OPTIONS: Array<{ value: ExperiencePref; label: string; hint: string }> = [
  { value: "auto", label: "Auto", hint: "Pick for my device" },
  { value: "immersive", label: "Immersive", hint: "Full motion and 3D" },
  { value: "lite", label: "Lite", hint: "Fast, calm, static" },
];

const REASONS: Record<AutoReason, string> = {
  "reduced-motion": "your system asks for reduced motion",
  "data-saver": "data saver is on",
  "slow-network": "the connection looks slow",
  "low-memory": "this device has limited memory",
  "few-cores": "this device has a modest CPU",
  capable: "this device can handle it",
};

/** Segmented Auto / Immersive / Lite control (D26). */
export function ExperienceToggle({
  className = "",
  align = "start",
}: {
  className?: string;
  align?: "start" | "end";
}) {
  const { pref, experience, reason, ready, setPref } = useExperience();

  return (
    <div className={`flex-col gap-2 ${align === "end" ? "items-end text-right" : "items-start"} ${className || "flex"}`}>
      <div
        role="radiogroup"
        aria-label="Experience"
        className="inline-flex rounded-full border border-[var(--line)] bg-[var(--glass)] p-1 backdrop-blur-md"
      >
        {OPTIONS.map((o) => {
          const active = ready && pref === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              title={o.hint}
              onClick={() => setPref(o.value)}
              className={`min-h-9 rounded-full px-3.5 text-xs font-medium tracking-wide transition-colors duration-[var(--dur-1)] ${
                active
                  ? "bg-[var(--ink)] text-[var(--void)]"
                  : "text-[var(--ink-dim)] hover:text-[var(--ink)]"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="min-h-4 font-mono text-[11px] text-[var(--ink-faint)]" aria-live="polite">
        {ready
          ? pref === "auto"
            ? `Auto → ${experience} · ${REASONS[reason as AutoReason] ?? ""}`
            : `${experience === "lite" ? "Lite" : "Immersive"} · your choice, remembered`
          : " "}
      </p>
    </div>
  );
}
