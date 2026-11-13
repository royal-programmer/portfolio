"use client";

/**
 * The room kit on a canvas: validates the `room3d` value (last good room, then the default, never a white
 * screen), picks the quality tier (the `?q=` override, the visitor's saved pick, else `auto` from the device and
 * the first frames' timing), draws the room with SMAA and bloom where the tier allows, and shows the quality
 * control and the hover label. `onRun` is how a click leaves the room (the Stage navigates; the lab only reports).
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ROOM3D_DEFAULT } from "@/lib/room3d/defaults";
import { resolveRoom3d } from "@/lib/room3d/resolve";
import type { Room3d, RoomObject, TierId } from "@/lib/room3d/schema";
import { activeRoom, parseQuality, resolveTier, stepDown } from "@/lib/room3d/tiers";
import { bandFor } from "@/lib/site/terminal-clock";
import { CLOCK } from "@/lib/site/terminal-data";
import { Room } from "./room";

/** The last room value that passed validation (kept across value changes while the page is open). */
let lastGoodRoom: Room3d | null = null;

const SAVED_KEY = "room3d-q";
const WORLDS = [
  { label: "Engineer", color: "#3b82f6" },
  { label: "Trader", color: "#22c55e" },
  { label: "Photographer", color: "#f59e0b" },
  { label: "Artist", color: "#ec4899" },
  { label: "Rider", color: "#ef4444" },
  { label: "Gamer", color: "#a855f7" },
];

type Interaction = NonNullable<RoomObject["interaction"]>;
export type RunInfo = { interaction: Interaction; object: RoomObject };

/** Milliseconds to add to the device clock so it matches the server's: read once from a HEAD request's Date header. */
function useClockOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    let live = true;
    const t0 = Date.now();
    fetch(window.location.origin + "/", { method: "HEAD", cache: "no-store" })
      .then((r) => {
        const d = r.headers.get("date");
        if (!d || !live) return;
        const t1 = Date.now();
        setOffset(new Date(d).getTime() + (t1 - t0) / 2 - t1);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return offset;
}

function readProbe() {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return { cores: nav.hardwareConcurrency, memory: nav.deviceMemory, saveData: nav.connection?.saveData === true, phone: window.matchMedia("(max-width: 767px)").matches };
}

/** Counts renderer.info per frame and the frame times; read from `window.__room` by tests. */
function Stats({ onMedian, probe }: { onMedian: (ms: number) => void; probe: boolean }) {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const stats = useRef({ calls: 0, triangles: 0, geometries: 0, textures: 0, frameMs: [] as number[] });
  const done = useRef(false);
  useEffect(() => {
    get().gl.info.autoReset = false;
    // Test handle: the CSS-pixel position of an object (by id), for clicking it.
    const pick = (id: string, dy = 0.1): [number, number] | null => {
      const { scene, camera, size } = get();
      const g = scene.getObjectByName(id);
      if (!g) return null;
      const v = g.getWorldPosition(new THREE.Vector3());
      v.y += dy;
      v.project(camera);
      return [((v.x + 1) / 2) * size.width, ((1 - v.y) / 2) * size.height];
    };
    (window as unknown as { __room: unknown }).__room = Object.assign(stats.current, { pick });
  }, [get]);
  useFrame((_, dt) => {
    const s = stats.current;
    s.calls = gl.info.render.calls;
    s.triangles = gl.info.render.triangles;
    s.geometries = gl.info.memory.geometries;
    s.textures = gl.info.memory.textures;
    gl.info.reset();
    s.frameMs.push(dt * 1000);
    if (s.frameMs.length > 600) s.frameMs.shift();
    // The first second is shader compiles and uploads; the next 30 frames are the machine's speed.
    if (probe && !done.current && s.frameMs.length >= 60) {
      done.current = true;
      const w = s.frameMs.slice(30, 60).sort((a, b) => a - b);
      onMedian(w[Math.floor(w.length / 2)]);
    }
  }, -1000);
  return null;
}

function Camera({ still }: { still: boolean }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useFrame(({ pointer, clock }) => {
    const t = still ? 0 : clock.elapsedTime;
    const wide = Math.max(1, Math.pow(1.6 / aspect, 0.62));
    const px = still ? 0 : pointer.x;
    camera.position.set(0.3 + 2.5 * wide + px * 0.25 + Math.sin(t * 0.2) * 0.06, 1.8 + 0.4 * (wide - 1), -2.0 + 4.1 * wide);
    camera.lookAt(0.3, 1.0, -2.1);
  });
  return null;
}

export default function RoomCanvas({ value, onRun, still = false }: { value?: unknown; onRun?: (r: RunInfo) => void; still?: boolean }) {
  const resolved = useMemo(() => resolveRoom3d(value ?? ROOM3D_DEFAULT, lastGoodRoom), [value]);
  useEffect(() => {
    if (resolved.source === "given") lastGoodRoom = resolved.value;
  }, [resolved]);
  const data = resolved.value;
  const room = activeRoom(data);
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const probe = useMemo(() => readProbe(), []);
  const [saved, setSaved] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(SAVED_KEY);
    } catch {
      return null;
    }
  });
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const wanted = parseQuality(q.get("q")) ?? parseQuality(saved) ?? data.quality;
  const base = resolveTier({ query: q.get("q"), saved, setting: data.quality, probe });
  const tierId: TierId = wanted === "auto" && measured !== undefined ? stepDown(base, measured) : base;
  const tier = data.tiers[tierId];
  const band = useMemo(() => {
    const forced = q.get("band");
    const hour = q.get("hour") ? Number(q.get("hour")) : new Date().getHours();
    return (forced ?? bandFor(CLOCK, hour).id) as keyof typeof room.lighting;
  }, [q]);
  const accent = q.get("accent") ?? "#7aa2ff";
  const reduced = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const clockOffsetMs = useClockOffset();
  const [hover, setHover] = useState<{ id: string | null; label: string | null }>({ id: null, label: null });
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const [consoleOn, setConsoleOn] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const run = useCallback(
    (interaction: Interaction, object: RoomObject) => {
      if (object.kind === "door") setOpenIds((s) => new Set(s).add(object.id));
      if (object.kind === "console") setConsoleOn((v) => !v);
      setNote(`${interaction.label}: ${"cmd" in interaction ? `run ${interaction.cmd}` : "href" in interaction ? interaction.href : interaction.card}`);
      onRun?.({ interaction, object });
    },
    [onRun],
  );
  const choose = (id: string) => {
    try {
      window.localStorage.setItem(SAVED_KEY, id);
    } catch {}
    setSaved(id);
    setMeasured(undefined);
  };
  const lightBand = room.lighting[band] ? band : "day";
  return (
    <div style={{ position: "fixed", inset: 0, background: "#05060a" }}>
      <Canvas
        key={`${tierId}:${tier.textureSize}`}
        shadows={tier.shadowRes > 0 ? "percentage" : false}
        dpr={[1, tier.dprCap]}
        camera={{ fov: 34, near: 0.1, far: 60, position: [4, 1.9, 3] }}
        gl={{ antialias: !tier.bloomOn, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
        }}
      >
        <Room
          room={room}
          tier={tier}
          bandId={lightBand}
          accent={accent}
          phone={probe.phone}
          reduced={reduced}
          hoverId={hover.id}
          openIds={openIds}
          consoleOn={consoleOn}
          worlds={WORLDS}
          clockOffsetMs={clockOffsetMs}
          onHover={(id, label) => setHover({ id, label })}
          onRun={run}
        />
        <Camera still={still} />
        <Stats probe={wanted === "auto"} onMedian={setMeasured} />
        {tier.bloomOn ? (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} radius={0.7} />
            <SMAA />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        ) : null}
      </Canvas>
      {hover.label ? <div style={{ position: "fixed", left: "50%", bottom: 64, transform: "translateX(-50%)", font: "13px monospace", color: "#e8ecff", background: "#0b0d17cc", padding: "4px 10px", borderRadius: 6, pointerEvents: "none" }}>{hover.label}</div> : null}
      {note ? <div role="status" style={{ position: "fixed", left: "50%", top: 12, transform: "translateX(-50%)", font: "12px monospace", color: "#cfe0ff", background: "#0b0d17ee", padding: "4px 10px", borderRadius: 6 }}>{note}</div> : null}
      {resolved.source !== "given" ? <div role="status" style={{ position: "fixed", left: 8, top: 8, font: "11px monospace", color: "#ffb4b4" }}>room data invalid, showing the {resolved.source}: {resolved.error}</div> : null}
      <div role="group" aria-label="Graphics quality" style={{ position: "fixed", left: 8, bottom: 8, display: "flex", gap: 4, font: "11px monospace" }}>
        {["auto", "low", "medium", "high"].map((id) => {
          const on = (parseQuality(saved) ?? data.quality) === id;
          return (
            <button key={id} type="button" aria-pressed={on} onClick={() => choose(id)} style={{ padding: "6px 10px", minHeight: 32, borderRadius: 6, border: "1px solid #3a4160", background: on ? "#2a3560" : "#10131f", color: "#cfd6f2", cursor: "pointer" }}>
              {id === "auto" ? `auto (${tierId})` : id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
