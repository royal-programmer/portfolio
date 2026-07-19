"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Entry } from "@/lib/content";

type ProjectsGridProps = {
  entries: Entry[];
  /** Persona segment used for detail links, e.g. `engineer`. */
  personaSlug?: string;
};

export function ProjectsGrid({ entries, personaSlug = "engineer" }: ProjectsGridProps) {
  const projects = entries.filter((entry) => entry.type === "project");

  if (projects.length === 0) {
    return (
      <section className="mx-auto w-full max-w-6xl px-6 pb-24 md:px-10">
        <div
          className="rounded-3xl border border-dashed px-6 py-12 text-center backdrop-blur-xl"
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

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3 md:px-10">
      {projects.map((entry, idx) => {
        const stack = entry.type === "project" ? entry.data.techStack : [];
        const detailHref = `/${personaSlug}/${entry.slug}`;
        return (
          <motion.article
            key={entry.id}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            viewport={{ once: true }}
            className="rounded-3xl border p-6 backdrop-blur-xl"
            style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
          >
            <h3 className="mb-3 text-xl font-semibold">{entry.title}</h3>
            <p className="text-[var(--muted)]">{entry.summary ?? entry.body ?? ""}</p>
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
              <Link
                href={detailHref}
                className="font-medium text-[var(--accent)] underline-offset-4 hover:underline"
              >
                View project
              </Link>
              {entry.type === "project" && entry.data.deployedUrl ? (
                <a
                  href={entry.data.deployedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--muted)] underline-offset-4 hover:underline"
                >
                  Live
                </a>
              ) : null}
              {entry.type === "project" && entry.data.repoUrl ? (
                <a
                  href={entry.data.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-[var(--muted)] underline-offset-4 hover:underline"
                >
                  Code
                </a>
              ) : null}
            </div>
          </motion.article>
        );
      })}
    </section>
  );
}
