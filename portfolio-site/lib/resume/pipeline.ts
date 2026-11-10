/**
 * The résumé build as named stages, each timed. `/api/resume/build` streams one event per stage.
 * Server only (Node runtime).
 */
import { access } from "node:fs/promises";
import { renderToBuffer } from "@react-pdf/renderer";
import { loadHomeContent } from "@/app/load-home-content";
import { buildResume, type ResumeDoc } from "./build";
import { FONT_FILES, registerFonts, resumeElement } from "./render";
import { keepBuild } from "./store";

export const STAGES = ["collect", "layout", "fonts", "render", "verify"] as const;
export type Stage = (typeof STAGES)[number];

export class BuildError extends Error {
  constructor(
    public stage: Stage,
    message: string,
  ) {
    super(message);
  }
}

/** A phone-number-shaped run: ten or more digits once separators are ignored. */
export function hasPhoneNumber(text: string): boolean {
  return (text.match(/\+?\d[\d ().-]{8,}\d/g) ?? []).some((m) => m.replace(/\D/g, "").length >= 10);
}

/** Every string of the document, so they can be joined one per line (numbers in different fields never join). */
function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out));
  return out;
}

/** Page objects in the PDF (`/Type /Page`, not `/Type /Pages`). */
export const countPages = (pdf: Uint8Array) => (Buffer.from(pdf).toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;

export type StageEvent = { stage: Stage; ms: number; detail?: string };
export type DoneEvent = { token: string; bytes: number; pages: number; ms: number };

export async function runBuild(onStage: (e: StageEvent) => void, signal?: AbortSignal): Promise<DoneEvent> {
  const t0 = performance.now();
  let t = t0;
  const step = async <T>(stage: Stage, fn: () => T | Promise<T>, detail?: (r: T) => string | undefined): Promise<T> => {
    if (signal?.aborted) throw new BuildError(stage, "cancelled");
    let r: T;
    try {
      r = await fn();
    } catch (err) {
      if (err instanceof BuildError) throw err;
      throw new BuildError(stage, err instanceof Error ? err.message : "failed");
    }
    const now = performance.now();
    onStage({ stage, ms: Math.round(now - t), detail: detail?.(r) });
    t = now;
    return r;
  };

  const doc: ResumeDoc = await step("collect", async () => {
    const { personas, engineerEntries } = await loadHomeContent();
    return buildResume(personas.find((p) => p.slug === "engineer"), engineerEntries);
  });
  const element = await step("layout", () => resumeElement(doc));
  await step("fonts", async () => {
    await Promise.all(FONT_FILES.map((f) => access(f)));
    registerFonts();
  });
  const pdf = await step("render", async () => new Uint8Array(await renderToBuffer(element)), (b) => `${b.length}`);
  const pages = await step(
    "verify",
    () => {
      if (hasPhoneNumber(strings(doc).join("\n"))) throw new BuildError("verify", "a phone number was found in the data");
      const n = countPages(pdf);
      if (n < 1) throw new BuildError("verify", "no pages in the output");
      return n;
    },
    (n) => `${n}`,
  );
  return { token: keepBuild(pdf), bytes: pdf.length, pages, ms: Math.round(performance.now() - t0) };
}
