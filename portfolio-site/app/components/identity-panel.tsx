"use client";

import { motion } from "framer-motion";
import { Briefcase, Camera, CandlestickChart } from "lucide-react";
import type { Persona } from "../persona-provider";
import type { PersonaContent } from "./site-content";

export function IdentityPanel({ persona, content }: { persona: Persona; content: PersonaContent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.7, ease: "easeOut" }}
      viewport={{ once: true, margin: "-50px" }}
      className="rounded-3xl border p-6 backdrop-blur-2xl transition-all duration-700"
      style={{
        backgroundColor: "var(--panel-bg)",
        borderColor: "var(--panel-border)",
        boxShadow: "var(--panel-shadow)",
      }}
    >
      <div className="mb-4 flex items-center gap-2 text-sm text-[var(--muted)]">
        {persona === "engineer" ? (
          <Briefcase className="h-4 w-4" />
        ) : persona === "trader" ? (
          <CandlestickChart className="h-4 w-4" />
        ) : (
          <Camera className="h-4 w-4" />
        )}
        Identity Shift Panel
      </div>
      <div className="space-y-4">
        {content.points.map((point) => (
          <div
            key={point}
            className="rounded-2xl border px-4 py-3"
            style={{ backgroundColor: "var(--chip-bg)", borderColor: "var(--chip-border)" }}
          >
            {point}
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-[var(--muted)]">
        Easter egg hint: 1× click + hold → Engineer, 2× → Trader, 3× → Photographer (4×+ still Photographer).
        Refresh or reopen the site starts as Engineer; moving between pages keeps your persona. Konami code still
        cycles personas.
      </p>
    </motion.div>
  );
}
