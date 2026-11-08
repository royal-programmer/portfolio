"use client";

import { motion } from "framer-motion";
import { Bike, Briefcase, Camera, CandlestickChart, Gamepad2, Palette } from "lucide-react";
import { HubLink } from "@/lib/site/persona-link";
import { DISPLAY_ROOT } from "@/lib/site/brand";
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
        ) : persona === "photographer" ? (
          <Camera className="h-4 w-4" />
        ) : persona === "artist" ? (
          <Palette className="h-4 w-4" />
        ) : persona === "ride" ? (
          <Bike className="h-4 w-4" />
        ) : (
          <Gamepad2 className="h-4 w-4" />
        )}
        {content.label.replace(/\s*mode$/i, "")}
      </div>
      <div className="space-y-4">
        {content.points.map((point) => (
          <div
            key={point}
            className="rounded-2xl border px-4 py-3 text-[var(--fg)]"
            // Opaque enough to read over a bright photo: the translucent chip tint sits on the page colour.
            style={{
              backgroundColor: "color-mix(in srgb, var(--background) 90%, var(--accent) 10%)",
              backgroundImage: "linear-gradient(var(--chip-bg), var(--chip-bg))",
              borderColor: "var(--chip-border)",
            }}
          >
            {point}
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-[var(--muted)]">
        <HubLink className="underline-offset-4 hover:underline">From the hub: {DISPLAY_ROOT}</HubLink>
      </p>
    </motion.div>
  );
}
