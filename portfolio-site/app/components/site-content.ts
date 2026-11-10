import { Monitor, Moon, Sun } from "lucide-react";
import type { Persona as PersonaRecord } from "@/lib/content";
import { personaIdentity } from "@/lib/site/brand";
import type { Persona } from "../persona-provider";

export type UiTheme = "system" | "light" | "dark";

/** Presentation fields used by hero / identity panels — sourced from `@/lib/content`. */
export type PersonaContent = Pick<
  PersonaRecord,
  "label" | "eyebrow" | "heading" | "body" | "accent" | "cta" | "points"
>;

export const PERSONA_BACKGROUNDS: Record<Persona, string> = {
  engineer:
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80",
  trader:
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1920&q=85",
  photographer:
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=1600&q=80",
  // The three newer worlds use the same template until their own pages land.
  artist:
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1600&q=80",
  ride:
    "https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=1600&q=80",
  gamer:
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1600&q=80",
};

export const KONAMI = [
  "arrowup",
  "arrowup",
  "arrowdown",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "arrowleft",
  "arrowright",
  "b",
  "a",
];

export const THEME_OPTIONS: Array<{ value: UiTheme; label: string; icon: typeof Monitor }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export const makeTypeSequence = (words: string[], pauseMs: number): Array<string | number> => {
  const seq: Array<string | number> = [];
  for (const word of words) seq.push(word, pauseMs);
  return seq;
};

/** The hub and the world's own page say the same phrases (lib/site/brand.ts). */
export const ENGINEER_SEQUENCE = makeTypeSequence([...personaIdentity("engineer").phrases], 1400);
export const TRADER_SEQUENCE = makeTypeSequence([...personaIdentity("trader").phrases], 1400);
export const PHOTOGRAPHER_SEQUENCE = makeTypeSequence([...personaIdentity("photographer").phrases], 1400);

export const QUICK_STACK_EXIT_MS = 140;

export const CHAT_TYPING_WAVE_S = 0.62;
export const CHAT_TYPING_STAGGER_S = 0.17;
export const CHAT_TYPING_MIN_BUFFER_MS = Math.ceil(
  (2 * CHAT_TYPING_WAVE_S + 2 * CHAT_TYPING_STAGGER_S) * 1000,
);
export const CHAT_GAP_AFTER_USER_MS = 560;
export const CHAT_MIN_THINKING_MS = 880;

export const SOCIAL_LINKS = [
  { label: "GitHub", value: "https://github.com/royal-programmer" },
  { label: "LinkedIn", value: "https://www.linkedin.com" },
  { label: "Email", value: "ratul.arya.roy@gmail.com" },
] as const;
