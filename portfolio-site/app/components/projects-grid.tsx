"use client";

import { PersonaLink } from "@/lib/site/persona-link";
import type { PersonaSlug } from "@/lib/content/types";
import { motion } from "framer-motion";
import type { Entry } from "@/lib/content";
import { SITE_SECTION } from "./site-shell";

type ProjectsGridProps = {
  entries: Entry[];
  /** Persona segment used for detail links, e.g. `engineer`. */
  personaSlug?: string;
};

function ProjectCard({
  entry,
  personaSlug,
  idx,
  featured = false,
}: {
  entry: Entry;
  personaSlug: string;
  idx: number;
  featured?: boolean;
}) {
  const stack = entry.type === "project" ? entry.data.techStack : [];

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: idx * 0.1 }}
      viewport={{ once: true }}
      className={`rounded-3xl border p-5 backdrop-blur-xl sm:p-6 ${featured ? "md:p-8" : ""}`}
      style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
    >
      <h3 className={`mb-3 font-semibold ${featured ? "text-2xl md:text-3xl" : "text-xl"}`}>
        {entry.title}
      </h3>
      <p
        className={`text-[var(--muted)] ${featured ? "max-w-3xl text-base md:text-lg" : "text-sm sm:text-base"}`}
      >
        {entry.summary ?? entry.body ?? ""}
      </p>
      {stack.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {stack.map((tech) => (
            <li
              key={tech}
              className="rounded-full border px-2.5 py-0.5 text-xs text-[var(--muted)]"
              style={{ borderColor: "var(--chip-border)", backgroundColor: "var(--chip-bg)" }}
            >
              {tech}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <PersonaLink
          persona={personaSlug as PersonaSlug}
          path={`/${entry.slug}`}
          className="min-h-11 inline-flex items-center font-medium text-[var(--accent)] underline-offset-4 hover:underline sm:min-h-0"
        >
          View project
        </PersonaLink>
        {entry.type === "project" && entry.data.deployedUrl ? (
          <a
            href={entry.data.deployedUrl}
            target="_blank"
            rel="noreferrer"
            className="min-h-11 inline-flex items-center font-medium text-[var(--muted)] underline-offset-4 hover:underline sm:min-h-0"
          >
            Live
          </a>
        ) : null}
        {entry.type === "project" && entry.data.repoUrl ? (
          <a
            href={entry.data.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="min-h-11 inline-flex items-center font-medium text-[var(--muted)] underline-offset-4 hover:underline sm:min-h-0"
          >
            Code
          </a>
        ) : null}
      </div>
    </motion.article>
  );
}

export function ProjectsGrid({ entries, personaSlug = "engineer" }: ProjectsGridProps) {
  const projects = entries.filter((entry) => entry.type === "project");

  if (projects.length === 0) {
    return (
      <section className={SITE_SECTION}>
        <div
          className="rounded-3xl border border-dashed px-5 py-10 text-center backdrop-blur-xl sm:px-6 sm:py-12"
          style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
        >
          <h3 className="mb-2 text-xl font-semibold">Projects coming soon</h3>
          <p className="mx-auto max-w-md text-[var(--muted)]">
            Selected work will land here once published. Check back after the next ship — or peek at
            GitHub in the meantime.
          </p>
        </div>
      </section>
    );
  }

  // Sparse grids: avoid a lonely half-row on wide screens.
  const layoutClass =
    projects.length === 1
      ? "grid grid-cols-1"
      : projects.length === 2
        ? "grid grid-cols-1 gap-6 md:grid-cols-2"
        : "grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3";

  return (
    <section className={`${SITE_SECTION} ${layoutClass}`}>
      {projects.map((entry, idx) => (
        <ProjectCard
          key={entry.id}
          entry={entry}
          personaSlug={personaSlug}
          idx={idx}
          featured={projects.length === 1}
        />
      ))}
    </section>
  );
}
