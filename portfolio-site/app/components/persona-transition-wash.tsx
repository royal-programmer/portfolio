"use client";

import { motion } from "framer-motion";

export function PersonaTransitionWash({ open }: { open: boolean }) {
  return (
    <motion.div
      aria-hidden
      initial={false}
      animate={{ opacity: open ? 0.9 : 0 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-[48] max-h-[100dvh] overflow-hidden overscroll-none"
      style={{
        pointerEvents: open ? "auto" : "none",
        background:
          "radial-gradient(ellipse 120% 80% at 50% 0%, color-mix(in srgb, var(--accent) 42%, transparent), rgba(0,0,0,0.72))",
      }}
    />
  );
}
