"use client";

import { PersonaLink, HubLink } from "@/lib/site/persona-link";
import { useMemo } from "react";
import { isPersonaSlug } from "@/lib/content/types";

type InvalidPersonaViewProps = {
  attempted: string;
};

type FaceKind = "confused" | "sideeye" | "shocked" | "smirk" | "sleepy";

const FACES: FaceKind[] = ["confused", "sideeye", "shocked", "smirk", "sleepy"];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function SeededAvatar({ seed, face }: { seed: string; face: FaceKind }) {
  const n = hashSeed(seed);
  const hue = n % 360;
  const hue2 = (hue + 40) % 360;
  const eyeY = face === "sleepy" ? 44 : 40;
  const mouth =
    face === "shocked"
      ? "M44 68 a8 10 0 1 0 16 0"
      : face === "smirk"
        ? "M42 66 Q52 74 66 62"
        : face === "sleepy"
          ? "M44 68 Q52 72 60 68"
          : "M42 70 Q52 78 62 70";

  return (
    <svg
      viewBox="0 0 104 104"
      className="h-36 w-36 drop-shadow-sm"
      role="img"
      aria-label={`Random avatar looking ${face}`}
    >
      <defs>
        <linearGradient id="face-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${hue} 55% 72%)`} />
          <stop offset="100%" stopColor={`hsl(${hue2} 50% 58%)`} />
        </linearGradient>
      </defs>
      <circle cx="52" cy="52" r="48" fill="url(#face-bg)" />
      {face === "sideeye" ? (
        <>
          <circle cx="38" cy={eyeY} r="5" fill="#1a1a1a" />
          <circle cx="68" cy={eyeY} r="5" fill="#1a1a1a" />
          <circle cx="40" cy={eyeY - 1} r="1.5" fill="#fff" />
          <circle cx="70" cy={eyeY - 1} r="1.5" fill="#fff" />
        </>
      ) : face === "confused" ? (
        <>
          <ellipse cx="38" cy={eyeY} rx="6" ry="7" fill="#1a1a1a" />
          <ellipse cx="66" cy={eyeY + 2} rx="5" ry="6" fill="#1a1a1a" />
          <path d="M28 28 Q38 20 48 28" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M58 26 Q68 18 78 30" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : face === "shocked" ? (
        <>
          <circle cx="38" cy={eyeY} r="7" fill="#1a1a1a" />
          <circle cx="66" cy={eyeY} r="7" fill="#1a1a1a" />
          <circle cx="36" cy={eyeY - 2} r="2" fill="#fff" />
          <circle cx="64" cy={eyeY - 2} r="2" fill="#fff" />
        </>
      ) : face === "sleepy" ? (
        <>
          <path d="M30 42 Q38 36 46 42" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M58 42 Q66 36 74 42" stroke="#1a1a1a" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="38" cy={eyeY} r="5" fill="#1a1a1a" />
          <circle cx="66" cy={eyeY} r="5" fill="#1a1a1a" />
          <path d="M30 30 Q38 24 46 30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M58 30 Q66 24 74 30" stroke="#1a1a1a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      )}
      <path d={mouth} stroke="#1a1a1a" strokeWidth="3" fill={face === "shocked" ? "#1a1a1a" : "none"} strokeLinecap="round" />
    </svg>
  );
}

function copyForAttempt(attempted: string) {
  const planned = isPersonaSlug(attempted);
  if (planned) {
    return {
      title: `“${attempted}” is still in the dressing room`,
      body: `That persona is on the roadmap, but it hasn’t walked on stage yet. You caught a future timeline — flattering, but early.`,
      hint: "Try engineer, trader, or photographer for now.",
    };
  }
  return {
    title: `I don’t remember being “${attempted}”`,
    body: `When did that happen? If you saw me in that persona, it wasn’t on this site — or it was a typo with ambition.`,
    hint: "Valid modes: engineer · trader · photographer",
  };
}

export function InvalidPersonaView({ attempted }: InvalidPersonaViewProps) {
  const face = useMemo(() => {
    const idx = hashSeed(attempted.toLowerCase()) % FACES.length;
    return FACES[idx];
  }, [attempted]);
  const copy = copyForAttempt(attempted);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 20%, hsl(28 70% 92%), transparent 60%), linear-gradient(165deg, #f7f1e8 0%, #e8eef5 48%, #f3ebe3 100%)",
        }}
      />
      <div className="relative z-10 flex max-w-lg flex-col items-center gap-5">
        <SeededAvatar seed={attempted} face={face} />
        <p className="font-mono text-xs tracking-[0.2em] text-stone-500 uppercase">
          Persona not found · /{attempted}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 md:text-4xl">{copy.title}</h1>
        <p className="text-base leading-relaxed text-stone-600">{copy.body}</p>
        <p className="text-sm text-stone-500">{copy.hint}</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <HubLink
            className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700"
          >
            Back home
          </HubLink>
          <PersonaLink
            persona="engineer"
            className="rounded-full border border-stone-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-stone-800 backdrop-blur transition hover:border-stone-400"
          >
            Engineer mode
          </PersonaLink>
          <PersonaLink
            persona="photographer"
            className="rounded-full border border-stone-300 bg-white/70 px-5 py-2.5 text-sm font-medium text-stone-800 backdrop-blur transition hover:border-stone-400"
          >
            Photographer
          </PersonaLink>
        </div>
      </div>
    </main>
  );
}
