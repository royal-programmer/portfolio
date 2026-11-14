"use client";

/**
 * The 3D-first page (round 36): one room, full screen, edge to edge. The camera moves between zones; content lives
 * on the objects (the monitors, the shelf, the TV, the wall, the door, the phone on the desk) and opens as a card
 * over the room, never as a page under it. A minimal HUD: Exit, the zones as real buttons, Reader, sound, quality.
 * Reader mode (reader-page.tsx) is the same content as a plain page; the gate (room-gate.tsx) decides which shows.
 * Interaction: click or tap an object or a chip and the camera eases there; drag to look around within a limit; a
 * wheel step or a sideways flick moves to the next zone; arrows step, Enter opens, Esc backs out.
 */
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import type { Entry } from "@/lib/content";
import type { PersonaSlug } from "@/lib/content/types";
import { ROOM3D_DEFAULT } from "@/lib/room3d/defaults";
import { buildRoomContent, parsePanel } from "@/lib/room3d/content";
import { pickItem } from "@/lib/room3d/board-layout";
import { resolveRoom3d } from "@/lib/room3d/resolve";
import type { Room3d, RoomObject, Zone } from "@/lib/room3d/schema";
import { stageKitTier } from "@/lib/room3d/stage-kit";
import { activeRoom, parseQuality, stepDown } from "@/lib/room3d/tiers";
import { flick, lookFromDrag, orderedZones, stepZone, zoneForObject } from "@/lib/room3d/zones";
import { hubHref, personaHref } from "@/lib/site/persona-link";
import { ogLines } from "@/lib/site/og-lines";
import { skillEvidence } from "@/lib/site/skill-evidence";
import { shelfFromEntries, STAGE_DOOR, STAGE_TIERS } from "@/lib/site/stage-data";
import { buildConstellation } from "@/lib/site/stage-constellation";
import { ambient } from "@/lib/site/ambient-sound";
import { bandFor } from "@/lib/site/terminal-clock";
import { CLOCK, type TerminalData } from "@/lib/site/terminal-data";
import { paletteFor } from "@/lib/site/terminal-themes";
import { useExperience } from "../../experience-provider";
import { VrContext, createClock } from "../hub/vr/clock";
import { createVrState } from "../hub/vr/state";
import { KitLabel } from "../stage/kit-rig";
import { createTerminalScreen, type TerminalScreen } from "../stage/terminal-screen";
import { useViewExit } from "../views/view-shell";
import { createBoards, pickRow, type BoardSet } from "./boards";
import type { StageExtras } from "./kit-core";
import { Room } from "./room";
import { readProbe, Stats, useClockOffset, WORLDS } from "./room-canvas";
import { RoomPanel, type PanelState, type World } from "./room-panels";
import { ZoneRig, type LookOffset, type Pose } from "./zone-rig";
import "./room-experience.css";

const THEME_KEY = "xp-term-theme";
const WORLD_SLUGS: PersonaSlug[] = ["engineer", "trader", "photographer", "artist", "ride", "gamer"];
const QUALITY_ORDER = ["performance", "balanced", "best"] as const;
const QUALITY_LABEL = { performance: "Performance", balanced: "Balanced", best: "Quality" } as const;

/** The last `room3d` value that passed validation (the page falls back to it, then to the default room). */
let lastGood: Room3d | null = null;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function screenTheme(bandTheme: string): string {
  try {
    return window.localStorage.getItem(THEME_KEY) || bandTheme;
  } catch {
    return bandTheme;
  }
}

/** A render error in the canvas (a lost or missing WebGL context) hands the visitor to Reader mode. */
class Boundary extends Component<{ onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

type Props = { data: TerminalData; entries?: Entry[]; persona: PersonaSlug; onReader: () => void; onFail: () => void };

export default function RoomExperience({ data, entries, persona, onReader, onFail }: Props) {
  const router = useRouter();
  const exit = useViewExit();
  const { ready, quality, setQuality, sound, setSound } = useExperience();
  const vr = useMemo(() => ({ clock: { current: createClock() }, state: { current: createVrState() } }), []);
  const content = useMemo(() => buildRoomContent(data), [data]);

  // The room: validated, last good, then the default.
  const kitKey = data.room3d ? JSON.stringify(data.room3d) : "";
  const resolved = useMemo(() => resolveRoom3d(kitKey ? JSON.parse(kitKey) : ROOM3D_DEFAULT, lastGood), [kitKey]);
  useEffect(() => {
    if (resolved.source === "given") lastGood = resolved.value;
  }, [resolved]);
  const kitData = resolved.value;
  const room = useMemo(() => activeRoom(kitData), [kitData]);
  const zones = useMemo(() => orderedZones(room), [room]);
  const objectsById = useMemo(() => new Map((room.objects as RoomObject[]).map((o) => [o.id, o])), [room]);

  // Tier: ?q= wins, then the visitor's gate pick, then the setting; the first frames can only lower it (not under ?q=).
  const probe = useMemo(() => readProbe(), []);
  const q = useMemo(() => new URLSearchParams(window.location.search).get("q"), []);
  const pinned = (() => {
    const v = parseQuality(q);
    return v !== null && v !== "auto";
  })();
  const [measured, setMeasured] = useState<number | undefined>(undefined);
  const baseTier = stageKitTier({ query: q, gate: quality ?? null, stepped: null, setting: kitData.quality, probe });
  const tierId = !pinned && measured !== undefined ? stepDown(baseTier, measured) : baseTier;
  const tier = kitData.tiers[tierId];

  const reduced = useMemo(() => reducedMotion(), []);
  const phone = probe.phone;
  const clockOffsetMs = useClockOffset();
  const clockData = data.clock.bands.length > 0 ? data.clock : CLOCK;
  // `?band=` or `?hour=` pins the part of the day (a test and preview aid, as in the lab).
  const pinnedBand = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    const forced = sp.get("band");
    if (forced && forced in room.lighting) return forced;
    const h = Number(sp.get("hour"));
    return sp.get("hour") !== null && h >= 0 && h < 24 ? bandFor(clockData, h).id : null;
  }, [clockData, room]);
  const [liveBand, setBand] = useState(() => bandFor(clockData, new Date().getHours()));
  const band = pinnedBand ? { ...liveBand, id: pinnedBand } : liveBand;
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = bandFor(clockData, new Date().getHours());
      setBand((b) => (b.id === next.id ? b : next));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [clockData]);
  const accentHex = useMemo(() => `#${new THREE.Color().setHSL(0.6, 0.9, 0.68).getHexString()}`, []);
  const accent3 = useMemo(() => new THREE.Color(accentHex), [accentHex]);

  // Camera state.
  const [zoneId, setZoneId] = useState<string>(zones[0].id);
  const zone: Zone = zones.find((z) => z.id === zoneId) ?? zones[0];
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [override, setOverride] = useState<Pose | null>(null);
  const lookRef = useRef<LookOffset>({ yaw: 0, pitch: 0 });
  const [fade, setFade] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const noteTimer = useRef(0);
  const flash = useCallback((text: string) => {
    setNote(text);
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNote(null), 3200);
  }, []);
  useEffect(() => () => window.clearTimeout(noteTimer.current), []);
  const pose: Pose = override ?? { eye: zone.eye, look: zone.look };
  const goZone = useCallback(
    (id: string) => {
      lookRef.current = { yaw: 0, pitch: 0 };
      setOverride(null);
      setPanel(null);
      setZoneId(id);
    },
    [],
  );

  // Boards: the monitor's projects, the wall, the shelf, the TV's reel, drawn from the content layer.
  const [boards, setBoards] = useState<BoardSet | null>(null);
  useEffect(() => {
    const set = createBoards(room, content, { scale: tier.textureSize / 512, accent: accentHex, holdMs: reduced ? 0 : 4200 });
    queueMicrotask(() => setBoards(set));
    return () => {
      set.dispose();
    };
  }, [room, content, tier.textureSize, accentHex, reduced]);

  // The live terminal on the desk's low monitor.
  const [liveScreen, setLiveScreen] = useState<THREE.Texture | null>(null);
  const screenRef = useRef<TerminalScreen | null>(null);
  useEffect(() => {
    let screen: TerminalScreen | null = null;
    try {
      screen = createTerminalScreen({ banner: ogLines(data, "banner"), output: ogLines(data, "portfolio"), palette: paletteFor(screenTheme(band.theme)), host: "ratulroy ~ portfolio" });
      screenRef.current = screen;
      screen.tick(reduced ? 99 : 0, performance.now());
      const tex = screen.texture;
      queueMicrotask(() => setLiveScreen(tex));
    } catch {
      // No texture: the monitor shows its drawn code.
    }
    return () => {
      screenRef.current = null;
      setLiveScreen(null);
      screen?.dispose();
    };
    // The palette is re-applied by its own effect; a new band must not rebuild the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, reduced]);
  useEffect(() => {
    screenRef.current?.setPalette(paletteFor(screenTheme(band.theme)));
  }, [band.theme, liveScreen]);

  // The stars (from the terminal's stack) and the project cases, as the Stage's own kinds read them.
  const constellation = useMemo(() => {
    const own = (room.objects.find((o) => o.kind === "constellation")?.params as { stars?: number } | undefined)?.stars;
    const cap = tierId === "high" ? STAGE_TIERS.best.stars : tierId === "medium" ? STAGE_TIERS.balanced.stars : STAGE_TIERS.performance.stars;
    const max = Math.round(Math.min(cap, own ?? cap) / (phone ? 2 : 1));
    return buildConstellation({ stack: data.stack, skills: data.resume.skills.flatMap((g) => g.items), arch: data.arch, projects: data.projects }, max);
  }, [data, room, tierId, phone]);
  const cases = useMemo(() => shelfFromEntries(entries), [entries]);
  const [hover, setHover] = useState<string | null>(null);
  const [caseOpen, setCaseOpen] = useState<string | null>(null);
  const starsActive = useRef(true);

  const toggleSound = useCallback(() => {
    if (sound) {
      ambient.stop();
      setSound(false);
    } else {
      ambient.start();
      setSound(true);
    }
  }, [sound, setSound]);
  // Opening things.
  const openPanel = useCallback(
    (id: PanelState["id"], item: number | null = null) => {
      setOverride(null);
      setPanel({ id, item });
    },
    [],
  );
  const closePanel = useCallback(() => setPanel(null), []);
  const stageUrl = useCallback(
    (cmd?: string) => {
      const dest = personaHref(window.location.origin, persona, "/");
      const sep = dest.href.includes("?") ? "&" : "?";
      return { dest, href: `${dest.href}${sep}${cmd ? `run=${encodeURIComponent(cmd)}&` : ""}via=stage` };
    },
    [persona],
  );
  const leave = useCallback(
    (go: () => void) => {
      if (reduced) return go();
      setFade(true);
      window.setTimeout(go, 460);
    },
    [reduced],
  );
  const openTerminal = useCallback(
    (o: RoomObject) => {
      const prm = o.params as { inches: number; aspect: number; lift: number };
      const { pos, rotY, scale } = o.transform;
      const nx = Math.sin(rotY);
      const nz = Math.cos(rotY);
      const sh = ((prm.inches * 0.0254) / Math.sqrt(1 + prm.aspect * prm.aspect)) * scale;
      const asp = window.innerWidth / Math.max(1, window.innerHeight);
      const tan = Math.tan(THREE.MathUtils.degToRad(34) / 2);
      const dist = Math.min(sh / (2 * tan), (sh * prm.aspect) / (2 * tan * asp)) * 1.05 + 0.1;
      const cx = pos[0] - nx * 0.05 * scale;
      const cz = pos[2] - nz * 0.05 * scale;
      const cy = pos[1] + prm.lift * scale;
      setPanel(null);
      setOverride({ eye: [cx + nx * dist, cy, cz + nz * dist], look: [cx, cy, cz] });
      const { dest, href } = stageUrl();
      leave(() => {
        if (dest.crossOrigin) window.location.assign(href);
        else router.push(href);
      });
    },
    [leave, router, stageUrl],
  );
  const runCommand = useCallback(
    (cmd: string) => {
      // A terminal command leaves the room: the terminal reads `run` when it mounts, so it takes a full load.
      const { href } = stageUrl(cmd);
      leave(() => window.location.assign(href));
    },
    [leave, stageUrl],
  );
  const worlds = useMemo<World[]>(
    () =>
      WORLDS.map((w, i) => {
        const dest = personaHref(window.location.origin, WORLD_SLUGS[i], "/");
        return { slug: WORLD_SLUGS[i], label: w.label, color: w.color, href: dest.href, cross: dest.crossOrigin };
      }),
    [],
  );
  const doorObj = useMemo(() => (room.objects as RoomObject[]).find((o) => o.kind === "door"), [room]);
  const [swing, setSwing] = useState<ReadonlySet<string>>(new Set());
  const goWorld = useCallback(
    (d: { href: string }, hub: boolean) => {
      const href = hub ? `${d.href}${d.href.includes("?") ? "&" : "?"}${STAGE_DOOR.query}` : d.href;
      if (doorObj) setSwing(new Set([doorObj.id]));
      // A full load: the other world is another page (often another host).
      leave(() => window.location.assign(href));
    },
    [doorObj, leave],
  );
  const landing = useMemo(() => {
    const h = hubHref(window.location.origin);
    return { href: h.href, cross: h.crossOrigin };
  }, []);
  const hrefs = useMemo(
    () => ({
      fit: personaHref(window.location.origin, persona, "/netflix").href,
      project: (slug: string) => personaHref(window.location.origin, persona, `/${slug}`).href,
    }),
    [persona],
  );

  // A click on an object.
  const drag = useRef({ down: false, moved: false, x: 0, y: 0, t: 0, yaw: 0, pitch: 0 });
  const onRun = useCallback(
    (_i: unknown, o: RoomObject, e?: { object?: THREE.Object3D; uv?: THREE.Vector2 }) => {
      if (drag.current.moved) return;
      const it = o.interaction;
      const cmd = it && "cmd" in it ? it.cmd : undefined;
      if (o.kind === "monitor" && (o.params as { screen?: string }).screen === "terminal") return openTerminal(o);
      if (cmd === "sound") return toggleSound();
      const target = zoneForObject(zones, o.id);
      const pid = parsePanel(cmd) ?? (o.kind === "door" ? "worlds" : null);
      if (pid) {
        let item: number | null = null;
        const set = boards;
        const rects = set?.rects[o.id];
        if (rects && e?.uv && e.object) {
          if (o.kind === "board" && e.object.userData.board) item = pickItem(rects, e.uv.x, 1 - e.uv.y);
          else if (o.kind === "monitor") item = pickRow(rects, 1 - e.uv.y);
          if (item !== null && item < 0) item = null;
        }
        if (target && target.id !== zoneId) {
          lookRef.current = { yaw: 0, pitch: 0 };
          setZoneId(target.id);
        }
        setOverride(null);
        setPanel({ id: pid, item });
        return;
      }
      if (cmd) return runCommand(cmd);
      if (it && "href" in it) {
        const href = it.href;
        return leave(() => window.location.assign(href));
      }
      if (it && "card" in it) flash(it.card);
    },
    [boards, flash, leave, openTerminal, runCommand, toggleSound, zoneId, zones],
  );
  const extras = useMemo<StageExtras>(
    () => ({
      accent: accent3,
      reduced,
      cases,
      caseFocus: null,
      openId: caseOpen,
      onOpenCase: (item) => {
        setCaseOpen(null);
        const i = content.projects.findIndex((p) => p.slug === item.slug);
        const target = zones.find((z) => z.id === "shelf") ?? null;
        if (target) setZoneId(target.id);
        if (item.kind === "project" && i >= 0) setPanel({ id: "projects", item: i });
        else setPanel({ id: "projects", item: null });
      },
      onPickCase: (id) => setCaseOpen(id),
      constellation,
      starsActive,
      onRunCommand: () => {
        setPanel({ id: "skills", item: null });
      },
    }),
    [accent3, reduced, cases, caseOpen, constellation, content.projects, zones],
  );

  // Pointer: drag looks around, a sideways flick steps, the wheel steps.
  const stageRef = useRef<HTMLDivElement>(null);
  const zonesRef = useRef(zones);
  const zoneIdRef = useRef(zoneId);
  const panelRef = useRef(panel);
  useEffect(() => {
    zonesRef.current = zones;
    zoneIdRef.current = zoneId;
    panelRef.current = panel;
  });
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const step = (dir: 1 | -1) => {
      const z = stepZone(zonesRef.current, zoneIdRef.current, dir);
      lookRef.current = { yaw: 0, pitch: 0 };
      setOverride(null);
      setZoneId(z.id);
    };
    const down = (e: PointerEvent) => {
      if (e.button > 0) return;
      const d = drag.current;
      d.down = true;
      d.moved = false;
      d.x = e.clientX;
      d.y = e.clientY;
      d.t = e.timeStamp;
      d.yaw = lookRef.current.yaw;
      d.pitch = lookRef.current.pitch;
    };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      vr.state.current.px = ((e.clientX - r.left) / r.width) * 2 - 1;
      vr.state.current.py = -(((e.clientY - r.top) / r.height) * 2 - 1);
      const d = drag.current;
      if (!d.down) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 7) return;
      d.moved = true;
      if (panelRef.current) return;
      lookRef.current = lookFromDrag({ yaw: d.yaw, pitch: d.pitch }, dx, dy, r.height);
    };
    const up = (e: PointerEvent) => {
      const d = drag.current;
      if (!d.down) return;
      d.down = false;
      if (d.moved && !panelRef.current) {
        const dir = flick(e.clientX - d.x, e.clientY - d.y, e.timeStamp - d.t);
        if (dir !== 0) step(dir);
      }
      // The click that follows this pointerup is a drag's end, not an object's: it is ignored once.
      window.setTimeout(() => {
        drag.current.moved = false;
      }, 0);
    };
    let wheelAt = 0;
    const wheel = (e: WheelEvent) => {
      if (panelRef.current || Math.abs(e.deltaY) + Math.abs(e.deltaX) < 8) return;
      e.preventDefault();
      const now = performance.now();
      if (now - wheelAt < 650) return;
      wheelAt = now;
      step(e.deltaY + e.deltaX > 0 ? 1 : -1);
    };
    const leaveEl = () => {
      vr.state.current.px = 0;
      vr.state.current.py = 0;
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerleave", leaveEl);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerleave", leaveEl);
    };
  }, [vr, ready]);

  // Keyboard: arrows step, Enter opens the zone's card, Esc backs out (one level at a time).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (panelRef.current) return; // the card owns Esc and Tab while it is open
      const zs = zonesRef.current;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const z = stepZone(zs, zoneIdRef.current, e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1);
        lookRef.current = { yaw: 0, pitch: 0 };
        setOverride(null);
        setZoneId(z.id);
      } else if (e.key === "Enter" && t && !t.closest("button, a")) {
        const z = zs.find((x) => x.id === zoneIdRef.current);
        const pid = parsePanel(z?.panel ? `panel:${z.panel}` : undefined);
        if (pid) {
          e.preventDefault();
          setPanel({ id: pid, item: null });
        } else if (z?.panel === "terminal") {
          const m = (room.objects as RoomObject[]).find((o) => o.kind === "monitor" && (o.params as { screen?: string }).screen === "terminal");
          if (m) {
            e.preventDefault();
            openTerminal(m);
          }
        }
      } else if (e.key === "Escape") {
        if (zoneIdRef.current !== zs[0].id || lookRef.current.yaw !== 0 || lookRef.current.pitch !== 0) {
          e.preventDefault();
          lookRef.current = { yaw: 0, pitch: 0 };
          setOverride(null);
          setZoneId(zs[0].id);
        }
      }
    };
    // In the capture phase, so an Esc that backs out of a place is ours before the view shell (which would leave the page) sees it.
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [openTerminal, room]);

  // The full-screen state of the document (hides the view shell's own button, locks scroll).
  useEffect(() => {
    document.documentElement.setAttribute("data-room-full", "");
    return () => document.documentElement.removeAttribute("data-room-full");
  }, []);
  useEffect(() => {
    const reset = () => setFade(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  const evidenceOf = useCallback((name: string) => skillEvidence({ stack: data.stack, projects: data.projects, resume: data.resume }, name), [data]);
  const onFrame = useCallback(
    (t: number) => {
      screenRef.current?.tick(reduced ? 99 : t, performance.now());
      boards?.tick(performance.now());
    },
    [boards, reduced],
  );
  const summary = useMemo(
    () =>
      `${content.name}${content.title ? `, ${content.title}` : ""}. An interactive 3D room with ${zones.length} places: ${zones.map((z) => z.label).join(", ")}. ${content.projects.length} projects, ${content.skills.length} skill groups, ${content.credentials.length} certificates and degrees. Use the buttons to move between places, or switch to Reader mode for a plain page.`,
    [content, zones],
  );
  const phoneSheet = phone;
  const shift = panel ? (phoneSheet ? { x: 0, y: 0.24 } : { x: 0.17, y: 0 }) : { x: 0, y: 0 };
  const nextQuality = () => {
    const cur = quality ?? "balanced";
    setQuality(QUALITY_ORDER[(QUALITY_ORDER.indexOf(cur) + 1) % 3]);
  };
  const litId = hover;
  const litText = litId ? (objectsById.get(litId)?.interaction?.label ?? null) : null;

  if (!ready) return <div className="rx-root" aria-busy="true" />;
  return (
    <div className="rx-root" data-zone={zone.id} data-panel={panel?.id ?? ""} data-tier={tierId} style={{ ["--rx-c" as string]: accentHex }}>
      <div ref={stageRef} className="rx-stage" role="region" aria-label={`3D room. ${zones.length} places: ${zones.map((z) => z.label).join(", ")}`}>
        <p className="rx-sr">{summary}</p>
        <Boundary onFail={onFail}>
          <Canvas
            key={`${tierId}:${tier.textureSize}`}
            shadows={tier.shadowRes > 0 ? "percentage" : false}
            dpr={[1, tier.dprCap]}
            camera={{ position: [...zones[0].eye] as [number, number, number], fov: 34, near: 0.1, far: 60 }}
            gl={{ antialias: !tier.bloomOn, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
            }}
            style={{ background: "#05060a" }}
          >
            <VrContext.Provider value={vr}>
              <Room
                room={room}
                tier={tier}
                bandId={band.id as keyof typeof room.lighting}
                accent={accentHex}
                phone={phone}
                reduced={reduced}
                hoverId={litId}
                openIds={swing}
                consoleOn={false}
                worlds={WORLDS}
                clockOffsetMs={clockOffsetMs}
                stage={extras}
                liveScreen={liveScreen}
                boards={boards?.textures}
                onMerged={(m) => {
                  const w = window as unknown as { __roomMerge?: { n?: number } };
                  w.__roomMerge = { ...m, n: (w.__roomMerge?.n ?? 0) + 1 };
                }}
                onHover={(id) => setHover(id)}
                onRun={onRun as never}
              />
              <ZoneRig pose={pose} lookRef={lookRef} reduced={reduced} shift={shift} onFrame={onFrame} />
              <KitLabel room={room} id={litId} text={litText} accent={accentHex} />
              <Stats probe={!pinned} onMedian={setMeasured} />
              {tier.bloomOn ? (
                <EffectComposer multisampling={0} enableNormalPass={false}>
                  <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} radius={0.7} />
                  <SMAA />
                  <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
                </EffectComposer>
              ) : null}
            </VrContext.Provider>
          </Canvas>
        </Boundary>
      </div>

      <div className="rx-top">
        <button type="button" className="rx-hudbtn" onClick={() => exit?.()} title="Leave the room (Esc at the first place)">
          <span aria-hidden>←</span> Exit
        </button>
        <div className="rx-cluster" role="group" aria-label="Room controls">
          <button type="button" className="rx-hudbtn" onClick={onReader} title="A plain page with the same content">
            Reader
          </button>
          <button type="button" className="rx-hudbtn" aria-pressed={sound} onClick={toggleSound} aria-label={sound ? "Sound on, turn off" : "Sound off, turn on"}>
            Sound
          </button>
          <button type="button" className="rx-hudbtn" onClick={nextQuality} aria-label={`Graphics: ${QUALITY_LABEL[quality ?? "balanced"]}. Change`}>
            {QUALITY_LABEL[quality ?? "balanced"]}
          </button>
        </div>
      </div>
      {panel ? (
        <button type="button" className="rx-btn rx-back" onClick={closePanel}>
          <span aria-hidden>←</span> Back to the room
        </button>
      ) : null}
      <nav className="rx-chips-bar" data-panel={panel ? "true" : "false"} aria-label="Places in the room">
        <div>
          {zones.map((z) => (
            <button
              key={z.id}
              type="button"
              className="rx-chip"
              aria-current={z.id === zone.id ? "true" : undefined}
              onClick={() => {
                // A second press on the place you are at opens its card (the desk's is the terminal: that is the monitor, not the chip).
                const pid = z.panel && z.panel !== "terminal" ? parsePanel(`panel:${z.panel}`) : null;
                if (z.id === zone.id && !panel && !override && pid) {
                  openPanel(pid);
                } else goZone(z.id);
              }}
            >
              {z.label}
            </button>
          ))}
        </div>
      </nav>
      {panel ? <RoomPanel key={`${panel.id}`} panel={panel} content={content} worlds={worlds} landing={landing} hrefs={hrefs} evidenceOf={evidenceOf} onItem={(item) => setPanel((p) => (p ? { ...p, item } : p))} onClose={closePanel} onWorld={goWorld} /> : null}
      {note ? (
        <div className="rx-note-bar" role="status">
          {note}
        </div>
      ) : null}
      {resolved.source !== "given" ? <div className="rx-sr" role="status">{`The room data was invalid, showing the ${resolved.source} room.`}</div> : null}
      <div className="rx-fade" data-on={fade ? "true" : "false"} aria-hidden />
    </div>
  );
}
