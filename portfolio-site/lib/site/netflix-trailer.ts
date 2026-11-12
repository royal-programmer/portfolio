/**
 * A project's Play is a trailer in chapters (17-persona-views.md §25, F1). Pure: the same data in, the same chapters out,
 * and the same timings. A chapter is text typed at about 22 characters a second that then holds for a beat, or a real clip
 * with its sentence as a subtitle. No fixed length: the trailer lasts as long as its chapters.
 */
import type { ProjectMedia, ProjectStory } from "@/lib/site/netflix-data";

export const TYPE_CPS = 22;
export const HOLD_MS = 1500;
export const MIN_MS = 3000;
/** The most of a clip a beat plays by default: a long clip is cut at this point (a beat's own `clipMs` overrides it), so the trailer stays a trailer. */
export const CLIP_CAP_MS = 8000;
/** The longest a chapter waits for a clip or a voice that never finishes. */
export const MAX_WAIT_MS = 45_000;

export type ChapterClip = { src: string; poster: string; label: string };
export type Chapter = {
  id: string;
  kind: "title" | "why" | "beat" | "stack" | "end";
  /** Typed text (a beat's sentence is a subtitle under its clip instead, shown whole). */
  text: string;
  clip?: ChapterClip;
  /** The clip is cut after this long when it is longer. */
  clipMs?: number;
  chips?: string[];
};

export type TrailerFacts = {
  title: string;
  summary?: string;
  stack: string[];
  live?: string;
  story?: ProjectStory;
  media?: ProjectMedia;
  /** Words from the strings files. */
  labels: { built: string; dev: string; live: string };
};

/**
 * The chapters. With no story fields: the title and summary, then the stack (never an empty trailer).
 * `guided`: the first three chapters only, no end card (the Recruiter cut).
 */
export function trailerChapters(f: TrailerFacts, guided = false): Chapter[] {
  const s = f.story ?? {};
  const status = s.status ?? (f.live ? "live" : "in-development");
  const statusLabel = status === "live" ? f.labels.live : f.labels.dev;
  const out: Chapter[] = [];
  out.push({ id: "title", kind: "title", text: [f.title, s.description ?? f.summary ?? "", statusLabel].filter(Boolean).join("\n") });
  const why = [s.audience, s.problem].filter(Boolean).join(" ");
  if (why) out.push({ id: "why", kind: "why", text: why });
  (s.beats ?? []).slice(0, 3).forEach((b, i) => {
    const c = f.media?.clips.find((k) => k.id === b.clip);
    out.push({ id: `beat-${i}`, kind: "beat", text: b.text, clip: c ? { src: c.src, poster: c.poster, label: c.label } : undefined, clipMs: b.clipMs ?? CLIP_CAP_MS });
  });
  out.push({ id: "stack", kind: "stack", text: f.stack.length ? `${f.labels.built}  ${statusLabel}` : statusLabel, chips: f.stack.slice(0, 10) });
  if (guided) return out.slice(0, 3);
  out.push({ id: "end", kind: "end", text: "" });
  return out;
}

/** How long a chapter's text takes to type (or to read, for a subtitle), and the least time the chapter stays. */
export function chapterTimes(c: Chapter, holdScale = 1): { typeMs: number; needMs: number } {
  if (c.kind === "end") return { typeMs: 0, needMs: 0 };
  const typeMs = (c.text.length / TYPE_CPS) * 1000;
  return { typeMs, needMs: Math.max(MIN_MS, typeMs + HOLD_MS * holdScale) };
}

/** The whole trailer's length without waiting on clips, for a progress readout and the tests. */
export function trailerMs(chapters: Chapter[], holdScale = 1): number {
  return chapters.reduce((a, c) => a + chapterTimes(c, holdScale).needMs, 0);
}
