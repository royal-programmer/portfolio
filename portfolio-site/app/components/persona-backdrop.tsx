"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Persona } from "../persona-provider";
import { PERSONA_BACKGROUNDS } from "./site-content";

export function PersonaBackdrop({ persona, showFlash }: { persona: Persona; showFlash: boolean }) {
  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`bg-${persona}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center"
          style={{
            backgroundImage: `url("${PERSONA_BACKGROUNDS[persona]}")`,
            opacity: "var(--bg-image-opacity)",
          }}
        />
      </AnimatePresence>
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ backgroundColor: "var(--bg-overlay)" }}
      />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,var(--accent-glow),transparent_42%),radial-gradient(circle_at_20%_80%,var(--accent-glow-2),transparent_45%)]" />
      <motion.div
        animate={{ opacity: showFlash ? 0.3 : 0 }}
        className="pointer-events-none fixed inset-0 z-50 bg-white mix-blend-overlay"
      />
      <AnimatePresence initial={false}>
        {showFlash && (
          <motion.div
            key="persona-sweep"
            initial={{ opacity: 0, x: "-30%" }}
            animate={{ opacity: 1, x: "30%" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: "easeInOut" }}
            className="pointer-events-none fixed inset-y-0 left-0 z-40 w-[55vw]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent) 45%, transparent) 30%, transparent 100%)",
              filter: "blur(6px)",
              opacity: 0.65,
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
