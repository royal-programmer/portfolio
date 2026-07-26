"use client";

import { motion } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import { ArrowRight } from "lucide-react";
import type { Persona } from "../persona-provider";
import type { PersonaContent } from "./site-content";
import {
  ENGINEER_SEQUENCE,
  PHOTOGRAPHER_SEQUENCE,
  TRADER_SEQUENCE,
} from "./site-content";

export function HomeHero({
  persona,
  content,
}: {
  persona: Persona;
  content: PersonaContent;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      viewport={{ once: true, margin: "-50px" }}
      className="space-y-5 rounded-3xl border p-5 backdrop-blur-2xl sm:space-y-6 sm:p-6"
      style={{
        backgroundColor: "var(--surface-bg)",
        borderColor: "var(--surface-border)",
        boxShadow: "var(--panel-shadow)",
      }}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)] sm:text-sm">{content.eyebrow}</p>
      <p className="text-base text-[var(--muted)] sm:text-lg md:text-2xl">
        I am a{" "}
        <span className="font-semibold text-[var(--accent)]">
          <TypeAnimation
            key={persona}
            sequence={
              persona === "engineer"
                ? ENGINEER_SEQUENCE
                : persona === "trader"
                  ? TRADER_SEQUENCE
                  : PHOTOGRAPHER_SEQUENCE
            }
            speed={55}
            deletionSpeed={38}
            repeat={Infinity}
            cursor
          />
        </span>
      </p>
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl md:text-5xl xl:text-6xl">{content.heading}</h1>
      <p className="max-w-xl text-base text-[var(--muted)] sm:text-lg">{content.body}</p>
      <button className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 font-medium text-[var(--cta-fg)] transition-transform hover:scale-[1.03]">
        {content.cta}
        <ArrowRight className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
