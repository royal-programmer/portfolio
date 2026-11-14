/**
 * Reader mode or the room (round 36): the same content as a plain accessible page, or the full-screen 3D room.
 * The rule is pure so the page and `scripts/room3d-check.mjs` agree. Priority, highest first:
 *   no WebGL                -> reader (the room cannot run; the visitor cannot enter)
 *   `?reader=1` / `?reader=0` -> reader / room (the link says what it wants, even over a saved choice)
 *   the visitor's saved pick -> what they chose last time
 *   data saver              -> reader
 *   a very low-end device   -> reader
 *   otherwise               -> the room
 */
export type ReaderInput = {
  search: string;
  /** `localStorage` value of `READER_KEY`: "1" reader, "0" room, anything else = no choice. */
  stored: string | null;
  saveData: boolean;
  /** `false` when a WebGL context could not be made. */
  webgl: boolean;
  /** A device the room would not run well on (see `lowEnd`). */
  lowEnd: boolean;
};

export type ReaderWhy = "no-webgl" | "query" | "saved" | "save-data" | "low-end" | "default";
export type ReaderResolved = { reader: boolean; why: ReaderWhy; /** The room cannot be entered at all (no WebGL). */ canEnter: boolean };

export const READER_KEY = "room3d-reader";

const flag = (v: string | null | undefined): boolean | null => {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "1" || s === "true" || s === "on") return true;
  if (s === "0" || s === "false" || s === "off") return false;
  return null;
};

export function resolveReader(a: ReaderInput): ReaderResolved {
  if (!a.webgl) return { reader: true, why: "no-webgl", canEnter: false };
  const q = flag(new URLSearchParams(a.search).get("reader"));
  if (q !== null) return { reader: q, why: "query", canEnter: true };
  const s = flag(a.stored);
  if (s !== null) return { reader: s, why: "saved", canEnter: true };
  if (a.saveData) return { reader: true, why: "save-data", canEnter: true };
  if (a.lowEnd) return { reader: true, why: "low-end", canEnter: true };
  return { reader: false, why: "default", canEnter: true };
}

/** The lowest class of device: two cores or fewer together with 2 GB or less (both must be reported low; an unknown value never counts). */
export function lowEnd(p: { cores?: number; memory?: number }): boolean {
  return p.cores !== undefined && p.cores > 0 && p.cores <= 2 && p.memory !== undefined && p.memory > 0 && p.memory <= 2;
}
