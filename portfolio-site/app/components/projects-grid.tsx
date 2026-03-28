"use client";

import { motion } from "framer-motion";

const CARDS = [
  {
    title: "Projects",
    body: "Selected work with product thinking, architecture depth, and polished UI.",
  },
  {
    title: "Experience",
    body: "Engineering discipline blended with market strategy and execution mindset.",
  },
  {
    title: "Contact",
    body: "Open to freelance, collaboration, and full-time opportunities.",
  },
] as const;

export function ProjectsGrid() {
  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-6 pb-24 md:grid-cols-3 md:px-10">
      {CARDS.map((item, idx) => (
        <motion.article
          key={item.title}
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: idx * 0.1 }}
          viewport={{ once: true }}
          className="rounded-3xl border p-6 backdrop-blur-xl"
          style={{ backgroundColor: "var(--surface-bg)", borderColor: "var(--surface-border)" }}
        >
          <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
          <p className="text-[var(--muted)]">{item.body}</p>
        </motion.article>
      ))}
    </section>
  );
}
