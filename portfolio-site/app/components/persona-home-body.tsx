"use client";

import { Sparkles } from "lucide-react";
import { forwardRef } from "react";
import type { BlogPost, Entry } from "@/lib/content";
import { PersonaLink } from "@/lib/site/persona-link";
import { HIRE_PERSONAS } from "@/lib/site/brand";
import { HirePill } from "./hire-pill";
import type { Persona } from "../persona-provider";
import type { PersonaContent } from "./site-content";
import { SITE_SHELL } from "./site-shell";
import { BlogPostsStrip } from "./blog-posts-strip";
import { HomeHero } from "./home-hero";
import { IdentityPanel } from "./identity-panel";
import {
  PersonaMotionOrchestrator,
  PersonaMotionSlot,
  type PersonaMotionOrchestratorHandle,
} from "./persona-motion-slots";
import { ProjectsGrid } from "./projects-grid";
import { WorldStage } from "./world-stage";

export type { PersonaMotionOrchestratorHandle };

/** Until a world's own page lands: what it will hold, and a way to something real. */
function ComingUpCard({ content }: { content: PersonaContent }) {
  return (
    <div
      className="rounded-3xl border p-6 backdrop-blur-2xl"
      style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)", boxShadow: "var(--panel-shadow)" }}
    >
      <div className="mb-4 flex items-center gap-2 text-sm font-medium text-[var(--fg)]">
        <Sparkles className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        What&apos;s coming here
      </div>
      <p className="text-sm text-[var(--muted)]">
        This world is being built: {content.points.slice(0, 3).join(", ").toLowerCase()}. The pieces land here as they are
        ready.
      </p>
      <p className="mt-5 text-sm text-[var(--fg)]">
        Until then,{" "}
        <PersonaLink persona="engineer" className="font-medium text-[var(--accent)] underline-offset-4 hover:underline">
          the Engineer side is live.
        </PersonaLink>
      </p>
    </div>
  );
}

type PersonaHomeBodyProps = {
  persona: Persona;
  /** The persona's place on the hub's spectrum (0…1): the stage takes its colour from it. */
  spectrumT: number;
  content: PersonaContent;
  engineerEntries: Entry[];
  engineerBlogPosts: BlogPost[];
};

export const PersonaHomeBody = forwardRef<PersonaMotionOrchestratorHandle, PersonaHomeBodyProps>(
  function PersonaHomeBody({ persona, spectrumT, content, engineerEntries, engineerBlogPosts }, ref) {
    return (
      <PersonaMotionOrchestrator ref={ref}>
        {/* The world's hero: the hub's setup (Immersive) or its line drawing (Normal), the same page under it. */}
        <section className={`${SITE_SHELL} pb-6 pt-2 md:pb-8`}>
          <PersonaMotionSlot id={`${persona}-stage`} dir="down" exitOrder={0} enterOrder={0}>
            <WorldStage slug={persona} t={spectrumT} />
          </PersonaMotionSlot>
        </section>
        {persona === "engineer" && (
          <>
            <section className={`${SITE_SHELL} grid gap-6 pb-8 pt-2 sm:gap-8 md:grid-cols-2 md:gap-10 md:pt-3`}>
              <PersonaMotionSlot id="eng-hero" dir="left" exitOrder={0} enterOrder={0}>
                <HomeHero persona={persona} content={content} />
              </PersonaMotionSlot>
              <PersonaMotionSlot id="eng-identity" dir="right" exitOrder={1} enterOrder={1}>
                <IdentityPanel persona={persona} content={content} />
              </PersonaMotionSlot>
            </section>
            <PersonaMotionSlot id="eng-projects" dir="down" exitOrder={2} enterOrder={2}>
              <ProjectsGrid entries={engineerEntries} personaSlug="engineer" />
            </PersonaMotionSlot>
            <PersonaMotionSlot id="eng-blog" dir="down" exitOrder={3} enterOrder={3}>
              <BlogPostsStrip posts={engineerBlogPosts} personaSlug="engineer" />
            </PersonaMotionSlot>
          </>
        )}

        {persona === "trader" && (
          <>
            <section className={`${SITE_SHELL} grid gap-6 pb-8 pt-2 sm:gap-8 md:grid-cols-2 md:gap-10 md:pt-3`}>
              <PersonaMotionSlot id="tr-hero" dir="left" exitOrder={0} enterOrder={0}>
                <HomeHero persona={persona} content={content} />
              </PersonaMotionSlot>
              <PersonaMotionSlot id="tr-right-col" dir="right" exitOrder={1} enterOrder={1}>
                <div className="flex flex-col gap-6">
                  <ComingUpCard content={content} />
                  <IdentityPanel persona={persona} content={content} />
                </div>
              </PersonaMotionSlot>
            </section>
          </>
        )}

        {persona === "photographer" && (
          <>
            <section className={`${SITE_SHELL} grid gap-6 pb-8 pt-2 sm:gap-8 md:grid-cols-2 md:gap-10 md:pt-3`}>
              <PersonaMotionSlot id="ph-hero" dir="left" exitOrder={0} enterOrder={0}>
                <HomeHero persona={persona} content={content} />
              </PersonaMotionSlot>
              <PersonaMotionSlot id="ph-identity" dir="right" exitOrder={1} enterOrder={1}>
                <div className="flex flex-col gap-6">
                  <ComingUpCard content={content} />
                  <IdentityPanel persona={persona} content={content} />
                </div>
              </PersonaMotionSlot>
            </section>
          </>
        )}
        {(persona === "artist" || persona === "ride" || persona === "gamer") && (
          <section className={`${SITE_SHELL} grid gap-6 pb-16 pt-2 sm:gap-8 md:grid-cols-2 md:gap-10 md:pb-24 md:pt-3`}>
            <PersonaMotionSlot id={`${persona}-hero`} dir="left" exitOrder={1} enterOrder={1}>
              <HomeHero persona={persona} content={content} />
            </PersonaMotionSlot>
            <PersonaMotionSlot id={`${persona}-identity`} dir="right" exitOrder={2} enterOrder={2}>
              <IdentityPanel persona={persona} content={content} />
            </PersonaMotionSlot>
          </section>
        )}
        {/* A way to reach me, on the worlds listed in HIRE_PERSONAS (the Engineer's terminal has `hire`). */}
        {HIRE_PERSONAS.includes(persona) ? <HirePill /> : null}
      </PersonaMotionOrchestrator>
    );
  },
);

PersonaHomeBody.displayName = "PersonaHomeBody";
