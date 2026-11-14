"use client";

/**
 * Decides what the engineer's 3D view shows (round 36): the full-screen room, Reader mode (a plain page), or, for
 * this release, the old scene (`?kit=0`). The server renders Reader's text so crawlers, screen readers and a browser
 * with no WebGL get the content; until the client has looked at the device (WebGL, data saver, the saved pick,
 * `?reader=`) the text is there but not painted, then the room or the page shows. The rule itself is pure
 * (lib/room3d/reader.ts, lib/room3d/stage-kit.ts).
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Entry } from "@/lib/content";
import type { PersonaSlug } from "@/lib/content/types";
import { lowEnd, READER_KEY, resolveReader, type ReaderWhy } from "@/lib/room3d/reader";
import { stageKitOn } from "@/lib/room3d/stage-kit";
import type { TerminalData } from "@/lib/site/terminal-data";
import { useViewExit } from "../views/view-shell";
import "./room-experience.css";

const RoomExperience = dynamic(() => import("./room-experience"), { ssr: false });

/** Is a WebGL context available? Probed once (a context is not free) and remembered. */
let webglProbe: boolean | null = null;
function hasWebGL(): boolean {
  if (webglProbe !== null) return webglProbe;
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    webglProbe = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webglProbe = false;
  }
  return webglProbe;
}

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
const emit = () => listeners.forEach((l) => l());

/** The device facts as one string (a stable snapshot for useSyncExternalStore): the server's is "server". */
function snapshot(): string {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(READER_KEY);
  } catch {}
  return JSON.stringify({ search: window.location.search, stored, saveData: nav.connection?.saveData === true || window.matchMedia("(prefers-reduced-data: reduce)").matches, webgl: hasWebGL(), low: lowEnd({ cores: nav.hardwareConcurrency, memory: nav.deviceMemory }) });
}

const WHY: Record<ReaderWhy, string> = {
  "no-webgl": "Your browser cannot draw the 3D room, so this is the plain page.",
  query: "",
  saved: "",
  "save-data": "Data saver is on, so this is the plain page.",
  "low-end": "This device is modest, so this is the plain page.",
  default: "",
};

/** Remember the visitor's pick and take `?reader=` out of the address (the pick is theirs now, not the link's). */
function choose(reader: boolean) {
  try {
    window.localStorage.setItem(READER_KEY, reader ? "1" : "0");
  } catch {}
  try {
    const u = new URL(window.location.href);
    if (u.searchParams.has("reader")) {
      u.searchParams.delete("reader");
      window.history.replaceState(window.history.state, "", u);
    }
  } catch {}
  emit();
}

type Props = { data: TerminalData; entries?: Entry[]; persona: PersonaSlug; reader: ReactNode; legacy: ReactNode };

export function RoomGate({ data, entries, persona, reader, legacy }: Props) {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "server");
  const exit = useViewExit();
  const [failed, setFailed] = useState(false);
  const [local, setLocal] = useState<"room" | "reader" | null>(null);
  const enter = useCallback(() => {
    setLocal("room");
    setFailed(false);
    choose(false);
  }, []);
  const toReader = useCallback(() => {
    setLocal("reader");
    choose(true);
  }, []);
  const onFail = useCallback(() => setFailed(true), []);
  // The room (or Reader) carries its own Exit: the view shell's corner button steps aside.
  const kitOn = snap !== "server" && stageKitOn((JSON.parse(snap) as { search: string }).search, process.env.NEXT_PUBLIC_STAGE_KIT);
  useEffect(() => {
    if (!kitOn) return;
    document.documentElement.setAttribute("data-room-xp", "");
    return () => document.documentElement.removeAttribute("data-room-xp");
  }, [kitOn]);

  if (snap === "server") {
    // Server and hydration: the text is in the page for crawlers and no-JS readers, not painted until the client has decided.
    return (
      <div className="rx-reader reader-pending" style={{ visibility: "hidden" }}>
        <noscript>
          <style>{".reader-pending{visibility:visible!important}"}</style>
        </noscript>
        {reader}
      </div>
    );
  }
  const f = JSON.parse(snap) as { search: string; stored: string | null; saveData: boolean; webgl: boolean; low: boolean };
  if (!stageKitOn(f.search, process.env.NEXT_PUBLIC_STAGE_KIT)) return <>{legacy}</>;
  const r = resolveReader({ search: f.search, stored: f.stored, saveData: f.saveData, webgl: f.webgl, lowEnd: f.low });
  const showReader = !r.canEnter || failed || (local ? local === "reader" : r.reader);
  const why = failed ? WHY["no-webgl"] : WHY[r.why];
  if (!showReader) return <RoomExperience data={data} entries={entries} persona={persona} onReader={toReader} onFail={onFail} />;
  return (
    <div className="rx-reader" data-reader-why={failed ? "failed" : r.why}>
      <div className="rx-reader-bar" role="region" aria-label="Reader mode">
        <button type="button" className="rx-btn" onClick={() => exit?.()}>
          <span aria-hidden>←</span> Exit
        </button>
        <p>{why || "Reader mode: the same content as the room, as a plain page."}</p>
        <button type="button" className="rx-btn rx-btn-main" onClick={enter} disabled={!r.canEnter || failed} title={!r.canEnter ? "This browser cannot draw the room" : undefined}>
          Enter the room
        </button>
      </div>
      {reader}
    </div>
  );
}
