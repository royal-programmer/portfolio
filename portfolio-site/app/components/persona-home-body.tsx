"use client";

import { BarChart3, CalendarDays, ImageIcon } from "lucide-react";
import { forwardRef } from "react";
import type { Persona } from "../persona-provider";
import type { PersonaContent } from "./site-content";
import { HomeHero } from "./home-hero";
import { IdentityPanel } from "./identity-panel";
import {
  PersonaMotionOrchestrator,
  PersonaMotionSlot,
  type PersonaMotionOrchestratorHandle,
} from "./persona-motion-slots";
import { ProjectsGrid } from "./projects-grid";

export type { PersonaMotionOrchestratorHandle };

function TraderCalendarCard() {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div
      className="rounded-3xl border p-5 backdrop-blur-2xl"
      style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)", boxShadow: "var(--panel-shadow)" }}
    >
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
        <CalendarDays className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        Week view
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {days.map((d, i) => (
          <span key={`d-${i}`}>{d}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => (
          <span
            key={i}
            className="flex aspect-square items-center justify-center rounded-lg text-xs"
            style={{
              backgroundColor: i === 2 ? "color-mix(in srgb, var(--accent) 22%, transparent)" : "var(--chip-bg)",
              color: i === 2 ? "var(--accent)" : "var(--muted)",
            }}
          >
            {12 + i}
          </span>
        ))}
      </div>
    </div>
  );
}

function TraderGraphCard() {
  const bars = [40, 72, 55, 88, 62, 95, 48, 78];
  return (
    <div
      className="rounded-3xl border p-6 backdrop-blur-2xl"
      style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)", boxShadow: "var(--panel-shadow)" }}
    >
      <div className="mb-5 flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
        <BarChart3 className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        Performance (sample)
      </div>
      <div className="flex h-36 items-end justify-between gap-1.5 px-1">
        {bars.map((h, i) => (
          <div
            key={i}
            className="min-w-0 flex-1 rounded-t-md bg-[var(--accent)] opacity-90"
            style={{ height: `${h}%`, opacity: 0.35 + (i % 3) * 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

function PhotographerGalleryStrip() {
  return (
    <div
      className="rounded-3xl border p-6 backdrop-blur-2xl"
      style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)", boxShadow: "var(--panel-shadow)" }}
    >
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
        <ImageIcon className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        Recent frames
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="aspect-[4/3] rounded-xl border"
            style={{
              borderColor: "var(--surface-border)",
              background:
                "linear-gradient(145deg, color-mix(in srgb, var(--fg) 8%, transparent), color-mix(in srgb, var(--accent) 18%, transparent))",
            }}
          />
        ))}
      </div>
    </div>
  );
}

type PersonaHomeBodyProps = {
  persona: Persona;
  content: PersonaContent;
};

export const PersonaHomeBody = forwardRef<PersonaMotionOrchestratorHandle, PersonaHomeBodyProps>(
  function PersonaHomeBody({ persona, content }, ref) {
    return (
      <PersonaMotionOrchestrator ref={ref}>
        {persona === "engineer" && (
          <>
            <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-8 pt-2 md:grid-cols-2 md:gap-10 md:px-10 md:pt-3">
              <PersonaMotionSlot id="eng-hero" dir="left" exitOrder={0} enterOrder={0}>
                <HomeHero persona={persona} content={content} />
              </PersonaMotionSlot>
              <PersonaMotionSlot id="eng-identity" dir="right" exitOrder={1} enterOrder={1}>
                <IdentityPanel persona={persona} content={content} />
              </PersonaMotionSlot>
            </section>
            <PersonaMotionSlot id="eng-projects" dir="down" exitOrder={2} enterOrder={2}>
              <ProjectsGrid />
            </PersonaMotionSlot>
          </>
        )}

        {persona === "trader" && (
          <>
            <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-8 pt-2 md:grid-cols-2 md:gap-10 md:px-10 md:pt-3">
              <PersonaMotionSlot id="tr-hero" dir="left" exitOrder={0} enterOrder={0}>
                <HomeHero persona={persona} content={content} />
              </PersonaMotionSlot>
              <PersonaMotionSlot id="tr-right-col" dir="right" exitOrder={1} enterOrder={1}>
                <div className="flex flex-col gap-6">
                  <TraderCalendarCard />
                  <IdentityPanel persona={persona} content={content} />
                </div>
              </PersonaMotionSlot>
            </section>
            <section className="mx-auto w-full max-w-6xl px-6 pb-10 md:px-10">
              <PersonaMotionSlot id="tr-graph" dir="down" exitOrder={2} enterOrder={2}>
                <TraderGraphCard />
              </PersonaMotionSlot>
            </section>
          </>
        )}

        {persona === "photographer" && (
          <>
            <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-8 pt-2 md:grid-cols-2 md:gap-10 md:px-10 md:pt-3">
              <PersonaMotionSlot id="ph-hero" dir="left" exitOrder={0} enterOrder={0}>
                <HomeHero persona={persona} content={content} />
              </PersonaMotionSlot>
              <PersonaMotionSlot id="ph-identity" dir="right" exitOrder={1} enterOrder={1}>
                <IdentityPanel persona={persona} content={content} />
              </PersonaMotionSlot>
            </section>
            <section className="mx-auto w-full max-w-6xl px-6 pb-24 md:px-10">
              <PersonaMotionSlot id="ph-gallery" dir="down" exitOrder={2} enterOrder={2}>
                <PhotographerGalleryStrip />
              </PersonaMotionSlot>
            </section>
          </>
        )}
      </PersonaMotionOrchestrator>
    );
  },
);

PersonaHomeBody.displayName = "PersonaHomeBody";
