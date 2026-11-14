"use client";

/**
 * The world page's hero in Immersive mode: the very setup you flew into on the hub, standing in
 * its own small stage — the laptop, the desk, the camera, the easel, the bike, the rig — lit by
 * the same materials and screens, gathering itself from loose parts as the page opens, turning a
 * little with the pointer, glowing under it. The hub's assemblies are reused as they are: this
 * canvas only provides the clock, the state and a camera standing where the climb's would.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useRouter } from "next/navigation";
import type { BlogPost, Entry } from "@/lib/content";
import type { PersonaSlug } from "@/lib/content/types";
import { ogLines } from "@/lib/site/og-lines";
import { personaHref } from "@/lib/site/persona-link";
import { shelfFromEntries, STAGE_DOOR, STAGE_PERF, STAGE_PROPS, STAGE_STOPS, STAGE_TIERS, TIER_BELOW, type ShelfCase, type StageProp, type StageTierId } from "@/lib/site/stage-data";
import { useExperience } from "../experience-provider";
import { bandFor } from "@/lib/site/terminal-clock";
import { CLOCK, type TerminalData } from "@/lib/site/terminal-data";
import { paletteFor } from "@/lib/site/terminal-themes";
import { ROOM3D_DEFAULT } from "@/lib/room3d/defaults";
import { resolveRoom3d } from "@/lib/room3d/resolve";
import type { Room3d, RoomObject } from "@/lib/room3d/schema";
import { STAGE_PROP_OBJECT, stageAction, stageKitOn, stageKitTier, stageStops } from "@/lib/room3d/stage-kit";
import { activeRoom } from "@/lib/room3d/tiers";
import type { StageExtras } from "./room3d/kit-core";
import { Room } from "./room3d/room";
import { readProbe, Stats, useClockOffset, WORLDS } from "./room3d/room-canvas";
import { KitLabel, KitRig } from "./stage/kit-rig";
import { StageProps } from "./stage/props";
import { StageDoor, type DoorGo } from "./stage/door";
import { hubHref } from "@/lib/site/persona-link";
import { PhotoCapture, type CaptureFn, type PhotoState } from "./stage/photo";
import { StageConstellation } from "./stage/constellation";
import { StageShelf } from "./stage/shelf";
import { buildConstellation } from "@/lib/site/stage-constellation";
import { createLook, StageLights, type StageLook } from "./stage/stage-look";
import { createTerminalScreen, type TerminalScreen } from "./stage/terminal-screen";
import { personaIdentity } from "@/lib/site/brand";
import { VrContext, createClock, useVr, type VrClock } from "./hub/vr/clock";
import { createVrState, type VrState, type World } from "./hub/vr/state";
import { climbPose } from "./hub/vr/util";
import { ArtistAssembly } from "./hub/vr/worlds/artist";
import { EngineerAssembly } from "./hub/vr/worlds/engineer";
import { GamerAssembly } from "./hub/vr/worlds/gamer";
import { PhotographerAssembly } from "./hub/vr/worlds/photographer";
import { RideAssembly } from "./hub/vr/worlds/ride";
import { TraderAssembly } from "./hub/vr/worlds/trader";

/** Any climb progress: the pose is only the frame the assembly places itself in. */
const C = 1;
/** Where each setup stands relative to the pose (the same offsets the worlds use on the hub). */
const PLACE: Record<PersonaSlug, { fwd: number; right: number; up: number }> = {
  engineer: { fwd: 5, right: 1.4, up: -0.3 },
  trader: { fwd: 5.4, right: 1.5, up: -0.55 },
  photographer: { fwd: 4.6, right: 1.3, up: -0.1 },
  artist: { fwd: 5.2, right: 1.4, up: -0.2 },
  ride: { fwd: 5.8, right: 1.3, up: -0.7 },
  gamer: { fwd: 5.8, right: 1.5, up: -0.55 },
};

type HubMedia = Partial<Record<string, string[]>>;

/** The scroll story's state, written by the page (world-stage.tsx) and read by the rig: `p` is the stop reached (0 = desk … 3 = window). */
export type StoryState = { p: number; on: boolean };

function StudioEnvironment({ onReady, size }: { onReady: () => void; size: number }) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size }).texture;
    scene.environment = tex;
    pmrem.dispose();
    onReady();
    return () => {
      scene.environment = null;
      tex.dispose();
    };
  }, [get, onReady, size]);
  return null;
}

type Scratch = {
  centre: THREE.Vector3;
  dir: THREE.Vector3;
  pos: THREE.Vector3;
  look: THREE.Vector3;
  px: number;
  py: number;
  handle: boolean;
  /** The setup's measured bounds (world space, the halo left out) and the frame they were taken on. */
  box: THREE.Box3;
  boxAt: number;
  corner: THREE.Vector3;
  /** The camera's distance multiplier that fits the bounds in view; eased, so the frame never jumps. */
  fit: number;
  /** The zoom into the laptop screen (S1): `t0` is the clock time it began, `dur` seconds, `e` the eased progress 0…1. */
  zoom: { on: boolean; t0: number; dur: number; e: number; fired: boolean };
  screen: THREE.Object3D | null;
  sp: THREE.Vector3;
  sn: THREE.Vector3;
  sq: THREE.Quaternion;
  ss: THREE.Vector3;
  eye: THREE.Vector3;
  /** The camera's resting pitch above the setup (radians): the desk wants a higher eye than a lone object. */
  pitch0: number;
  /** The scroll story (S9): the page's state, the eased stop reached, the assembly's frame, scratch vectors. */
  story: MutableRefObject<StoryState> | null;
  ps: number;
  extras: THREE.Object3D | null;
  a: THREE.Vector3;
  b: THREE.Vector3;
  la: THREE.Vector3;
  lb: THREE.Vector3;
  /** Photo mode's orbit (S6), written by the overlay. */
  photo: MutableRefObject<PhotoState> | null;
  /** The door (S10): the click's state, and the object that marks its centre. */
  door: MutableRefObject<DoorGo> | null;
  doorObj: THREE.Object3D | null;
};

const smooth = (x: number) => x * x * (3 - 2 * x);

/** A stop's eye and look points in world space (the assembly's frame carried to the world); a narrow frame stands further back. */
function stopPose(stop: (typeof STAGE_STOPS)[number], frame: THREE.Matrix4, back: number, eye: THREE.Vector3, look: THREE.Vector3) {
  const [lx, ly, lz] = stop.look ?? [0, 0, 0];
  const [ex, ey, ez] = stop.eye ?? [0, 0, 0];
  look.set(lx, ly, lz);
  eye.set(lx + (ex - lx) * back, ly + (ey - ly) * back, lz + (ez - lz) * back);
  eye.applyMatrix4(frame);
  look.applyMatrix4(frame);
}

/** How much of the frame the setup may fill (NDC half-extent); the rest is air. */
const FIT_MARGIN = 0.82;

/** Measure the setup: every mesh in the scene except the screens' halo sheets. */
function measureSetup(scene: THREE.Scene, box: THREE.Box3, tmp: THREE.Vector3) {
  box.makeEmpty();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const mat = m.material as THREE.Material | THREE.Material[];
    if (m.userData.noFit || (!Array.isArray(mat) && mat?.name === "halo")) return;
    const g = m.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const b = g.boundingBox;
    if (!b || !Number.isFinite(b.min.x)) return;
    for (let i = 0; i < 8; i++) {
      tmp.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(m.matrixWorld);
      box.expandByPoint(tmp);
    }
  });
}
type Pose = ReturnType<typeof climbPose>;

/** One frame of the stage: advance the clock, keep the state at the chapter, stand the camera. */
function driveStage(k: VrClock, s: VrState, tmp: Scratch, pose: Pose, place: { fwd: number; right: number; up: number }, size: { width: number; height: number }, camera: THREE.PerspectiveCamera, scene: THREE.Scene, rawDt: number, onZoomDone?: () => void, onDoorDone?: () => void) {
  const dt = Math.min(rawDt, 0.1);
  k.dt = dt;
  k.t += dt;
  k.scale = 1;
  // The setup stands assembled on its spot; its screens come on over the first two seconds
  // (the assembly's own power ramp), which is the opening.
  k.climb = C;
  s.c = C;
  s.phase = "climb";
  // The setup's centre, as the assembly computes it (aspect-aware).
  const aspect = size.width / Math.max(1, size.height);
  const narrow = THREE.MathUtils.clamp(1.67 / aspect, 1, 2.2);
  const portrait = THREE.MathUtils.clamp((1.2 - aspect) / 0.6, 0, 1);
  const fwd = place.fwd + (narrow - 1) * 2.2;
  const right = (place.right / narrow) * (1 - portrait);
  const up = place.up + (narrow - 1) * 1.1 + portrait * 0.5;
  tmp.centre.copy(pose.pos).addScaledVector(pose.fwd, fwd).addScaledVector(pose.right, right).add(tmp.look.set(0, up, 0));
  // The camera stands the same distance off, swung a little by the pointer and a slow drift.
  tmp.px += (s.px - tmp.px) * Math.min(1, dt * 5);
  tmp.py += (s.py - tmp.py) * Math.min(1, dt * 5);
  const yaw = Math.sin(k.t * 0.22) * 0.12 + tmp.px * 0.28;
  const pitch = 0.1 + tmp.py * 0.12;
  tmp.dir.copy(pose.fwd).applyAxisAngle(tmp.look.set(0, 1, 0), yaw);
  // Closer than the climb's camera (this is a stage, not a passing view), the setup's body a
  // little above the centre line.
  const dist = fwd * (0.58 - 0.015 * Math.sin(k.t * 0.3)) * (1 + portrait * 0.35) * tmp.fit;
  tmp.pos.copy(tmp.centre).addScaledVector(tmp.dir, -dist);
  tmp.pos.y += dist * Math.sin(pitch);
  camera.position.copy(tmp.pos);
  // Look at the measured middle of the setup (the hand-placed centre until the first measure).
  if (tmp.box.isEmpty()) {
    tmp.look.copy(tmp.centre);
    tmp.look.y += 0.3;
  } else {
    tmp.box.getCenter(tmp.look);
  }
  camera.lookAt(tmp.look);
  // Fit (Ratul's call: the model always fits its stage). Every few frames, measure the setup
  // and project its corners; if any falls outside the margin the distance grows towards the
  // multiple that brings it in, if all sit well inside it shrinks. Eased, so the frame breathes
  // rather than jumps; the stage's own slow drift sits on top.
  if (!tmp.box.isEmpty() || k.t - tmp.boxAt > 0.25) {
    if (k.t - tmp.boxAt > 0.25) {
      tmp.boxAt = k.t;
      measureSetup(scene, tmp.box, tmp.corner);
    }
    if (!tmp.box.isEmpty()) {
      camera.updateMatrixWorld();
      let ext = 0;
      const b = tmp.box;
      for (let i = 0; i < 8; i++) {
        tmp.corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(camera);
        ext = Math.max(ext, Math.abs(tmp.corner.x), Math.abs(tmp.corner.y));
      }
      const want = THREE.MathUtils.clamp(tmp.fit * (ext / FIT_MARGIN), 0.6, 3);
      tmp.fit += (want - tmp.fit) * Math.min(1, dt * 6);
    }
  }
  // The scroll story: between stops the camera glides from one pose to the next (eased twice: the page's progress is
  // smoothed, then each leg is a smoothstep). The first leg starts from the stage's own resting camera.
  const st = tmp.story?.current;
  if (st?.on) {
    tmp.ps += (st.p - tmp.ps) * Math.min(1, dt * 5);
    const ex = (tmp.extras ??= scene.getObjectByName("stage-extras") ?? null);
    if (ex && tmp.ps > 0.002) {
      ex.updateWorldMatrix(true, false);
      const i = Math.min(2, Math.floor(tmp.ps));
      const f = smooth(Math.min(1, tmp.ps - i));
      const back = THREE.MathUtils.clamp(1.6 / aspect, 1, 2.2);
      if (i === 0) {
        tmp.a.copy(camera.position);
        tmp.la.copy(tmp.look);
      } else stopPose(STAGE_STOPS[i], ex.matrixWorld, back, tmp.a, tmp.la);
      stopPose(STAGE_STOPS[i + 1], ex.matrixWorld, back, tmp.b, tmp.lb);
      camera.position.lerpVectors(tmp.a, tmp.b, f);
      tmp.look.lerpVectors(tmp.la, tmp.lb, f);
      camera.lookAt(tmp.look);
    }
  }
  // Photo mode: the visitor's orbit (limited by the overlay), eased, about the point the camera is looking at.
  const ph = tmp.photo?.current;
  if (ph) {
    const k = Math.min(1, dt * 6);
    ph.y += (ph.ty - ph.y) * k;
    ph.p += (ph.tp - ph.p) * k;
    if (Math.abs(ph.y) > 1e-4 || Math.abs(ph.p) > 1e-4) {
      tmp.a.copy(camera.position).sub(tmp.look);
      tmp.b.set(1, 0, 0).applyQuaternion(camera.quaternion);
      tmp.a.applyAxisAngle(tmp.b, ph.p).applyAxisAngle(tmp.la.set(0, 1, 0), ph.y);
      camera.position.copy(tmp.look).add(tmp.a);
      camera.lookAt(tmp.look);
    }
  }
  // Through the door: once it has opened (openMs) the camera moves to the doorway and on through it (travelMs).
  const dr = tmp.door?.current;
  if (dr?.on && dr.t0 > -1e8) {
    const door = (tmp.doorObj ??= scene.getObjectByName("stage-door") ?? null);
    if (door) {
      const p = Math.min(1, Math.max(0, (k.t - dr.t0 - STAGE_DOOR.openMs / 1000) / (STAGE_DOOR.travelMs / 1000)));
      dr.e = smooth(p);
      door.updateWorldMatrix(true, false);
      door.matrixWorld.decompose(tmp.sp, tmp.sq, tmp.ss);
      tmp.sn.set(0, 0, 1).applyQuaternion(tmp.sq);
      tmp.eye.copy(tmp.sp).addScaledVector(tmp.sn, -0.5);
      camera.position.lerp(tmp.eye, dr.e);
      tmp.look.lerp(tmp.a.copy(tmp.sp).addScaledVector(tmp.sn, -3), dr.e);
      camera.lookAt(tmp.look);
      if (p >= 1 && !dr.fired) {
        dr.fired = true;
        onDoorDone?.();
      }
    }
  }
  // Zoom into the screen: the camera glides from where the stage put it to an eye point in front of
  // the screen that makes the screen cover the frame; the page's overlay takes over for the last stretch.
  const z = tmp.zoom;
  if (z.on) {
    const screen = (tmp.screen ??= scene.getObjectByName("stage-screen") ?? null);
    if (screen) {
      const p = Math.min(1, (k.t - z.t0) / z.dur);
      z.e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      screen.updateWorldMatrix(true, false);
      screen.matrixWorld.decompose(tmp.sp, tmp.sq, tmp.ss);
      tmp.sn.set(0, 0, 1).applyQuaternion(tmp.sq);
      const wide = size.width / Math.max(1, size.height);
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      // The screen plane is 1.77 x 1.08 units (see engineer.tsx), scaled by the setup.
      const dist = Math.min((1.08 * tmp.ss.x) / (2 * tanH), (1.77 * tmp.ss.x) / (2 * tanH * wide)) * 1.02;
      tmp.eye.copy(tmp.sp).addScaledVector(tmp.sn, dist);
      camera.position.lerp(tmp.eye, z.e);
      tmp.look.lerp(tmp.sp, z.e);
      camera.lookAt(tmp.look);
      if (p >= 1 && !z.fired) {
        z.fired = true;
        onZoomDone?.();
      }
    }
  }
}

/** Drives the clock and stands the camera in front of the setup; the pointer turns it a little. */
function Rig({ slug, zoomRef, story, photo, door, onDoorDone, onFrame, onZoomDone, onFirstFrame }: { slug: PersonaSlug; zoomRef: MutableRefObject<Scratch["zoom"] | null>; story?: MutableRefObject<StoryState>; photo?: MutableRefObject<PhotoState>; door?: MutableRefObject<DoorGo>; onDoorDone?: () => void; onFrame?: (t: number) => void; onZoomDone?: () => void; onFirstFrame?: () => void }) {
  const { clock, state } = useVr();
  const size = useThree((s) => s.size);
  // Per-frame scratch (a ref: it is written every frame).
  const scratch = useRef<Scratch>({ centre: new THREE.Vector3(), dir: new THREE.Vector3(), pos: new THREE.Vector3(), look: new THREE.Vector3(), px: 0, py: 0, handle: false, box: new THREE.Box3(), boxAt: -1, corner: new THREE.Vector3(), fit: 1, zoom: { on: false, t0: 0, dur: 0.7, e: 0, fired: false }, screen: null, sp: new THREE.Vector3(), sn: new THREE.Vector3(), sq: new THREE.Quaternion(), ss: new THREE.Vector3(), eye: new THREE.Vector3(), pitch0: slug === "engineer" ? 0.4 : 0.1, story: null, ps: 0, extras: null, a: new THREE.Vector3(), b: new THREE.Vector3(), la: new THREE.Vector3(), lb: new THREE.Vector3(), photo: null, door: null, doorObj: null });
  const pose = useMemo(() => climbPose(C), []);
  const framed = useRef(false);
  // Render on demand: nothing is drawn while the stage is off screen (the rest of the page is long).
  const gl = useThree((s) => s.gl);
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? "always" : "never"));
    io.observe(gl.domElement);
    return () => io.disconnect();
  }, [gl, setFrameloop]);
  useFrame(({ camera, scene }, rawDt) => {
    const tmp = scratch.current;
    if (!framed.current) {
      framed.current = true;
      // The first frame is drawn right after this callback returns: mark it on the next animation frame.
      window.requestAnimationFrame(() => {
        mark("stage:first-frame");
        onFirstFrame?.();
      });
    }
    zoomRef.current = tmp.zoom;
    tmp.story = story ?? null;
    tmp.photo = photo ?? null;
    tmp.door = door ?? null;
    if (!tmp.handle) {
      tmp.handle = true;
      // Dev-only handle for tests.
      if (process.env.NODE_ENV !== "production") (window as unknown as { __stage?: unknown }).__stage = { scene, camera, clock, state };
    }
    driveStage(clock.current, state.current, tmp, pose, PLACE[slug], size, camera as THREE.PerspectiveCamera, scene, rawDt, onZoomDone, onDoorDone);
    onFrame?.(clock.current.t);
  });
  return null;
}

type StageHooks = { liveScreen: THREE.Texture | null; onScreenGo: () => void; look: MutableRefObject<StageLook>; extra?: ReactNode; flat: boolean };

function Setup({ slug, world, media, stage }: { slug: PersonaSlug; world: World; media: HubMedia; stage: StageHooks }) {
  switch (slug) {
    case "engineer":
      return <EngineerAssembly world={world} screenSrc={media.engineer?.[0] ? `/hub/engineer/${media.engineer[0]}` : undefined} liveScreen={stage.liveScreen} onScreenGo={stage.onScreenGo} look={stage.look} extra={stage.extra} flat={stage.flat} />;
    case "trader":
      return <TraderAssembly world={world} />;
    case "photographer":
      return <PhotographerAssembly world={world} />;
    case "artist":
      return <ArtistAssembly world={world} />;
    case "ride":
      return <RideAssembly world={world} modelUrl={media.models?.includes("bike.glb") ? "/hub/models/bike.glb" : undefined} />;
    case "gamer":
      return <GamerAssembly world={world} handle={personaIdentity("gamer").handle ?? "gamer"} />;
  }
}

/** The last `room3d` value that passed validation (the kit Stage falls back to it, then to the default room). */
let lastGoodKit: Room3d | null = null;

const THEME_KEY = "xp-term-theme";
const TIER_ORDER: StageTierId[] = ["performance", "balanced", "best"];

/** A performance mark, once (the first call wins), for measuring the stage's opening. */
function mark(name: string) {
  try {
    if (performance.getEntriesByName(name).length === 0) performance.mark(name);
  } catch {}
}
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The terminal theme the screen shows: the visitor's saved pick wins (same rule as the terminal), else the band's. */
function screenTheme(bandTheme: string): string {
  try {
    return window.localStorage.getItem(THEME_KEY) || bandTheme;
  } catch {
    return bandTheme;
  }
}

export default function WorldStage3D({ slug, t, entries, terminal, story, photo, capture, onFirstFrame }: { slug: PersonaSlug; t: number; entries?: Entry[]; posts?: BlogPost[]; /** The engineer data as the server built it (settings and records included); the laptop screen and the skill stars read it. */ terminal?: TerminalData; story?: MutableRefObject<StoryState>; photo?: MutableRefObject<PhotoState>; capture?: MutableRefObject<CaptureFn | null>; onFirstFrame?: () => void }) {
  const router = useRouter();
  const clock = useRef<VrClock>(createClock());
  const state = useRef<VrState>(createVrState());
  const ctx = useMemo(() => ({ clock, state }), []);
  const world = useMemo<World>(() => ({ slug, t, c: C }), [slug, t]);
  // The Stage on the room kit (`?kit=1`, or NEXT_PUBLIC_STAGE_KIT): the engineer's room drawn through <Room> from the `room3d` setting.
  const kitOn = useMemo(() => slug === "engineer" && stageKitOn(window.location.search, process.env.NEXT_PUBLIC_STAGE_KIT), [slug]);
  // Keyed by content: a parent that hands over a fresh but equal `terminal` must not rebuild (and re-merge) the room.
  const kitKey = terminal?.room3d ? JSON.stringify(terminal.room3d) : "";
  const kitResolved = useMemo(() => resolveRoom3d(kitKey ? JSON.parse(kitKey) : ROOM3D_DEFAULT, lastGoodKit), [kitKey]);
  useEffect(() => {
    if (kitResolved.source === "given") lastGoodKit = kitResolved.value;
  }, [kitResolved]);
  const kitData = kitResolved.value;
  const kitRoom = useMemo(() => activeRoom(kitData), [kitData]);
  // The gate's graphics choice drives the stage (S7); a slow first two seconds steps it down once, for this visit only.
  const { quality } = useExperience();
  const saved: StageTierId = quality ?? "balanced";
  const [stepped, setStepped] = useState<StageTierId | null>(null);
  const tier: StageTierId = stepped && TIER_ORDER.indexOf(stepped) < TIER_ORDER.indexOf(saved) ? stepped : saved;
  const cfg = STAGE_TIERS[tier];
  // The kit's tier: `?q=`, else the gate's pick (a step-down only lowers it), else the setting (auto probes the device).
  const kitTierId = useMemo(() => stageKitTier({ query: new URLSearchParams(window.location.search).get("q"), gate: quality ?? null, stepped, setting: kitData.quality, probe: readProbe() }), [quality, stepped, kitData.quality]);
  const kitTier = kitData.tiers[kitTierId];
  const tierRef = useRef(tier);
  useEffect(() => {
    tierRef.current = tier;
  }, [tier]);
  const perf = useRef({ born: 0, last: 0, t0: 0, n: 0, done: false });
  const measureFps = useCallback(() => {
    const p = perf.current;
    if (p.done) return;
    const now = performance.now();
    // A pause (off screen, hidden tab) restarts the window: only frames that were really asked for count.
    // The first 1.5 s (shader compile, texture uploads, the page still hydrating) are a warm-up, not the machine's speed.
    if (!p.born) p.born = now;
    if (now - p.born < 1500) {
      p.last = now;
      return;
    }
    if (!p.t0 || now - p.last > 2000) {
      p.t0 = now;
      p.n = 0;
      p.last = now;
      return;
    }
    p.last = now;
    p.n++;
    const el = (now - p.t0) / 1000;
    if (el < STAGE_PERF.windowS) return;
    p.done = true;
    const fps = Math.round(p.n / el);
    const cur = tierRef.current;
    const down = fps < STAGE_PERF.floor && cur !== "performance";
    const next = down ? TIER_BELOW[cur] : cur;
    if (down) setStepped(next);
    window.dispatchEvent(new CustomEvent("stage:perf", { detail: { tier: next, label: STAGE_TIERS[next].label, fps, stepped: down } }));
  }, []);
  const [media, setMedia] = useState<HubMedia>({});
  const [liveScreen, setLiveScreen] = useState<THREE.Texture | null>(null);
  // Flat accent parts until the studio's reflections exist; then the real materials (S8).
  const [envReady, setEnvReady] = useState(false);
  const onEnvReady = useCallback(() => setEnvReady(true), []);
  useEffect(() => {
    if (!envReady) return;
    const id = window.requestAnimationFrame(() => window.requestAnimationFrame(() => mark("stage:materials")));
    return () => window.cancelAnimationFrame(id);
  }, [envReady]);
  const screenMarked = useRef(false);
  const liveScreenBound = useRef(false);
  useEffect(() => {
    // Effects of the assembly (which bind the texture) run before this one on the same commit.
    liveScreenBound.current = liveScreen !== null;
  }, [liveScreen]);
  // The visitor's part of the day (round 9's bands); checked again every minute.
  const [band, setBand] = useState(() => bandFor(CLOCK, new Date().getHours()));
  const bandRef = useRef(band);
  useEffect(() => {
    bandRef.current = band;
  }, [band]);
  const look = useRef<StageLook>(createLook());
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = bandFor(CLOCK, new Date().getHours());
      setBand((b) => (b.id === next.id ? b : next));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  const zoomRef = useRef<Scratch["zoom"] | null>(null);
  const [doorOpen, setDoorOpen] = useState(false);
  const screenRef = useRef<TerminalScreen | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const doorRef = useRef<DoorGo>({ on: false, t0: 0, e: 0, fired: false });
  const [doorFocus, setDoorFocus] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/hub/media.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: HubMedia) => live && setMedia(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // The laptop's live terminal (engineer only): drawn at once, then kept current by the rig's frame.
  useEffect(() => {
    if (slug !== "engineer" || !terminal) return;
    let screen: TerminalScreen | null = null;
    try {
      const data = terminal;
      screen = createTerminalScreen({
        banner: ogLines(data, "banner"),
        output: ogLines(data, "portfolio"),
        palette: paletteFor(screenTheme(bandRef.current.theme)),
        host: "ratulroy ~ portfolio",
      });
      screenRef.current = screen;
      screen.tick(reducedMotion() ? 99 : 0, performance.now());
      const tex = screen.texture;
      queueMicrotask(() => setLiveScreen(tex));
    } catch {
      // No texture: the screenshot / drawn editor stays on the screen.
    }
    return () => {
      screenRef.current = null;
      setLiveScreen(null);
      screen?.dispose();
    };
  }, [slug, terminal]);

  useEffect(() => {
    screenRef.current?.setFps(cfg.screenFps);
  }, [cfg.screenFps, liveScreen]);

  // A new band re-themes the screen (a saved theme still wins).
  useEffect(() => {
    screenRef.current?.setPalette(paletteFor(screenTheme(band.theme)));
  }, [band, liveScreen]);

  // The overlay that takes over for the zoom's last stretch (a plain element on the body: the stage's own box clips and transforms).
  useEffect(() => {
    const el = document.createElement("div");
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;inset:0;z-index:80;pointer-events:none;opacity:0;";
    document.body.appendChild(el);
    overlayRef.current = el;
    const reset = () => {
      el.style.opacity = "0";
      const z = zoomRef.current;
      if (z) {
        z.on = false;
        z.fired = false;
        z.e = 0;
      }
      const d = doorRef.current;
      d.on = false;
      d.fired = false;
      d.e = 0;
      setDoorOpen(false);
    };
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      el.remove();
      overlayRef.current = null;
    };
  }, []);

  const navigate = useCallback(
    (cmd?: string) => {
    const dest = personaHref(window.location.origin, slug, "/");
    const q = (cmd ? `run=${encodeURIComponent(cmd)}&` : "") + "via=stage";
    const href = `${dest.href}${dest.href.includes("?") ? "&" : "?"}${q}`;
    // A command rides in the URL, which the terminal reads on mount: a client-side push updates the address after the terminal has mounted, so a command takes a full load.
    if (dest.crossOrigin || cmd) window.location.assign(href);
    else router.push(href);
    },
    [router, slug],
  );
  const go = useCallback(() => {
    const z = zoomRef.current;
    if (!z || z.on) return;
    if (reducedMotion()) return navigate();
    z.on = true;
    z.t0 = clock.current.t;
    z.dur = window.matchMedia("(max-width: 767px)").matches ? 0.45 : 0.7;
    z.fired = false;
    const el = overlayRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.background = paletteFor(screenTheme(bandRef.current.theme)).bg;
    }
  }, [navigate]);

  // The door to the other worlds (S10): it opens, the camera goes through, the screen washes to the hub's void, the hub opens on this chapter.
  const toHub = useCallback(() => {
    const hub = hubHref(window.location.origin);
    window.location.assign(`${hub.href}?${STAGE_DOOR.query}`);
  }, []);
  const goDoor = useCallback(() => {
    const d = doorRef.current;
    if (d.on) return;
    d.on = true;
    d.fired = false;
    d.t0 = clock.current.t;
    setDoorOpen(true);
    const el = overlayRef.current;
    if (el) {
      el.style.transition = "none";
      el.style.background = STAGE_DOOR.void;
    }
    if (reducedMotion()) {
      // No travel: the door is only a fade, 200 ms.
      d.t0 = -1e9;
      if (el) {
        el.style.transition = `opacity ${STAGE_DOOR.reducedFadeMs}ms linear`;
        el.style.opacity = "1";
      }
      window.setTimeout(toHub, STAGE_DOOR.reducedFadeMs + 10);
    }
  }, [toHub]);
  // The desk's props: hover / HUD focus light one, a click (or the HUD button) runs its command.
  const [focusId, setFocusId] = useState<string | null>(null);
  const [tapId, setTapId] = useState<string | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const tapTimer = useRef(0);
  const accent = useMemo(() => new THREE.Color().setHSL((((t * 285 - 15) / 360) % 1 + 1) % 1, 0.9, 0.62), [t]);
  const runProp = useCallback(
    (prop: StageProp) => {
      if (prop.cmd === "sound") {
        window.dispatchEvent(new Event("stage:sound-toggle"));
        return;
      }
      const el = overlayRef.current;
      if (reducedMotion() || !el) return navigate(prop.cmd);
      el.style.background = paletteFor(screenTheme(bandRef.current.theme)).bg;
      el.style.transition = "opacity 180ms ease-out";
      el.style.opacity = "1";
      window.setTimeout(() => navigate(prop.cmd), 190);
    },
    [navigate],
  );
  // Run a terminal command from a star: the same hand-off as a prop's.
  const runCommand = useCallback(
    (cmd: string) => {
      const el = overlayRef.current;
      if (reducedMotion() || !el) return navigate(cmd);
      el.style.background = paletteFor(screenTheme(bandRef.current.theme)).bg;
      el.style.transition = "opacity 180ms ease-out";
      el.style.opacity = "1";
      window.setTimeout(() => navigate(cmd), 190);
    },
    [navigate],
  );
  // The skill constellation (S5): stack and résumé skills, joined by what shares a diagram or a project.
  const constellation = useMemo(() => {
    if (slug !== "engineer" || !terminal) return null;
    const d = terminal;
    const own = kitOn ? (kitRoom.objects.find((o) => o.kind === "constellation")?.params as { stars?: number } | undefined)?.stars : undefined;
    const max = Math.round(Math.min(cfg.stars, own ?? cfg.stars) / (window.matchMedia("(max-width: 767px)").matches ? 2 : 1));
    return buildConstellation({ stack: d.stack, skills: d.resume.skills.flatMap((g) => g.items), arch: d.arch, projects: d.projects }, max);
  }, [slug, terminal, cfg.stars, kitOn, kitRoom]);
  const starsActive = useRef(true);
  const onTap = useCallback((id: string) => {
    setTapId(id);
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => setTapId(null), 1500);
  }, []);
  useEffect(() => {
    const byId = (id: string) => STAGE_PROPS.find((x) => x.id === id);
    const onFocus = (e: Event) => setFocusId((e as CustomEvent<string | null>).detail ?? null);
    const onRun = (e: Event) => {
      const prop = byId((e as CustomEvent<string>).detail);
      if (prop) runProp(prop);
    };
    const onSound = (e: Event) => setSoundOn(Boolean((e as CustomEvent<boolean>).detail));
    const onDoor = () => goDoor();
    const onDoorFocus = (e: Event) => setDoorFocus(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener("stage:door", onDoor);
    window.addEventListener("stage:doorfocus", onDoorFocus);
    window.addEventListener("stage:focus", onFocus);
    window.addEventListener("stage:run", onRun);
    window.addEventListener("site:sound", onSound);
    try {
      const saved = window.localStorage.getItem("sound-enabled") === "true";
      queueMicrotask(() => setSoundOn(saved));
    } catch {}
    return () => {
      window.removeEventListener("stage:door", onDoor);
      window.removeEventListener("stage:doorfocus", onDoorFocus);
      window.removeEventListener("stage:focus", onFocus);
      window.removeEventListener("stage:run", onRun);
      window.removeEventListener("site:sound", onSound);
      window.clearTimeout(tapTimer.current);
    };
  }, [runProp, goDoor]);
  // The project shelf (S4): hover / HUD focus pull a case out, a click opens its project.
  const cases = useMemo(() => shelfFromEntries(entries), [entries]);
  const [caseFocus, setCaseFocus] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const openCase = useCallback(
    (item: ShelfCase, rect: { x: number; y: number; w: number; h: number } | null) => {
      const fade = (go: () => void) => {
        const el = overlayRef.current;
        if (reducedMotion() || !el) return go();
        el.style.background = paletteFor(screenTheme(bandRef.current.theme)).bg;
        el.style.transition = "opacity 200ms ease-out";
        el.style.opacity = "1";
        window.setTimeout(go, 210);
      };
      if (item.kind !== "project" || !item.slug) return fade(() => navigate("projects"));
      const dest = personaHref(window.location.origin, slug, `/${item.slug}`);
      if (dest.crossOrigin) return fade(() => window.location.assign(dest.href));
      const start = (document as Document & { startViewTransition?: (cb: () => Promise<void>) => unknown }).startViewTransition?.bind(document);
      if (!start || !rect || reducedMotion()) return fade(() => router.push(dest.href));
      // The shared element: a plain box over the case, named like the project page's header; the browser morphs one into the other.
      const el = document.createElement("div");
      el.setAttribute("aria-hidden", "true");
      el.style.cssText = `position:fixed;left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px;border-radius:6px;pointer-events:none;z-index:70;background:#${accent.getHexString()};opacity:.85;view-transition-name:case-${item.slug};`;
      document.body.appendChild(el);
      const before = window.location.pathname;
      const vt = start(async () => {
        try {
          router.push(dest.href);
          const t0 = performance.now();
          while (window.location.pathname === before && performance.now() - t0 < 1500) await new Promise((r) => setTimeout(r, 30));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        } finally {
          el.remove();
        }
      }) as { ready?: Promise<unknown>; finished?: Promise<unknown>; updateCallbackDone?: Promise<unknown> } | undefined;
      // A slow page (first compile, a bad network) only costs the morph, never the navigation.
      for (const p of [vt?.ready, vt?.finished, vt?.updateCallbackDone]) p?.catch(() => {});
    },
    [navigate, router, slug, accent],
  );
  useEffect(() => {
    const onCase = (e: Event) => setOpenId((e as CustomEvent<string>).detail);
    const onCaseFocus = (e: Event) => setCaseFocus((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener("stage:case", onCase);
    window.addEventListener("stage:casefocus", onCaseFocus);
    const reset = () => setOpenId(null);
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("stage:case", onCase);
      window.removeEventListener("stage:casefocus", onCaseFocus);
      window.removeEventListener("pageshow", reset);
    };
  }, []);
  // --- The kit Stage: what a click means, which object a HUD focus lights, the data the shelf and the stars take. ---
  const kitPhone = useMemo(() => window.matchMedia("(max-width: 767px)").matches, []);
  const kitWorlds = WORLDS;
  const clockOffsetMs = useClockOffset();
  const [kitHover, setKitHover] = useState<string | null>(null);
  const doorObj = useMemo(() => kitRoom.objects.find((o) => o.kind === "door"), [kitRoom]);
  const monitorObj = useMemo(() => kitRoom.objects.find((o) => o.kind === "monitor" && o.params.screen === "terminal"), [kitRoom]);
  const openIds = useMemo<ReadonlySet<string>>(() => (doorOpen && doorObj ? new Set([doorObj.id]) : new Set<string>()), [doorOpen, doorObj]);
  const kitStops = useMemo(() => stageStops(kitRoom), [kitRoom]);
  // The object the label and the glow are on: the pointer's, else the HUD's focus, else a phone's first tap.
  const litId = kitHover ?? (focusId ? STAGE_PROP_OBJECT[focusId] : null) ?? (doorFocus && doorObj ? doorObj.id : null) ?? (tapId ? STAGE_PROP_OBJECT[tapId] : null) ?? null;
  const litText = litId ? kitRoom.objects.find((o) => o.id === litId)?.interaction?.label ?? null : null;
  const onKitRun = useCallback(
    (_i: unknown, o: RoomObject) => {
      const a = stageAction(o);
      switch (a.do) {
        case "zoom":
          return go();
        case "door":
          return goDoor();
        case "prop": {
          // Phones: the first tap names the prop, the second runs it.
          if (window.matchMedia("(pointer: coarse)").matches && tapId !== a.prop) return onTap(a.prop);
          const p = STAGE_PROPS.find((x) => x.id === a.prop);
          return p ? runProp(p) : undefined;
        }
        case "cmd":
          return runCommand(a.cmd);
        case "href":
          return window.location.assign(a.href);
        default:
          return;
      }
    },
    [go, goDoor, tapId, onTap, runProp, runCommand],
  );
  const kitExtras = useMemo<StageExtras>(
    () => ({ accent, reduced: reducedMotion(), cases, caseFocus, openId, onOpenCase: openCase, onPickCase: setOpenId, constellation, starsActive, story, onRunCommand: runCommand }),
    [accent, cases, caseFocus, openId, openCase, constellation, story, runCommand],
  );
  // One frame's housekeeping, whichever scene is drawn: the fps window, the stars' gate, the live screen, the overlay's fades.
  const onFrame = () => {
    measureFps();
    // Stars answer the pointer only while the camera is looking at them.
    starsActive.current = Boolean(story?.current.on) && Math.abs((story?.current.p ?? 0) - 2) < 0.7;
    screenRef.current?.tick(reducedMotion() ? 99 : clock.current.t, performance.now());
    // The live texture is on the glass once it has been drawn and a frame has gone by with it bound.
    if (!screenMarked.current && screenRef.current?.drawn() && liveScreenBound.current) {
      screenMarked.current = true;
      window.requestAnimationFrame(() => mark("stage:screen-live"));
    }
    const z = zoomRef.current;
    const el = overlayRef.current;
    const dd = doorRef.current;
    if (dd.on && el && dd.t0 > -1e8) el.style.opacity = String(Math.max(0, Math.min(1, dd.e)));
    if (z && el && z.on) el.style.opacity = String(Math.max(0, Math.min(1, (z.e - 0.55) / 0.45)));
  };
  const stage = useMemo<StageHooks>(() => ({ liveScreen, flat: !envReady, onScreenGo: go, look, extra:
        slug === "engineer" ? (
          <>
            <StageProps items={STAGE_PROPS} accent={accent} focusId={focusId} soundOn={soundOn} onRun={runProp} tapId={tapId} onTap={onTap} />
            {constellation ? <StageConstellation data={constellation} accent={accent} active={starsActive} reduced={reducedMotion()} story={story} onRun={runCommand} /> : null}
            <StageDoor accent={accent} focus={doorFocus} go={doorRef} onGo={goDoor} />
            <StageShelf items={cases} accent={accent} focusId={caseFocus} openId={openId} onOpen={openCase} onPick={setOpenId} reduced={reducedMotion()} />
          </>
        ) : undefined,
    }), [liveScreen, envReady, go, look, slug, accent, focusId, soundOn, runProp, tapId, onTap, cases, caseFocus, openId, openCase, constellation, runCommand, story, goDoor, doorFocus]);

  if (kitOn) {
    const accentHex = `#${accent.getHexString()}`;
    const phoneRun = kitPhone;
    return (
      <Canvas
        key={kitTierId}
        shadows={kitTier.shadowRes > 0 ? "percentage" : false}
        dpr={[1, kitTier.dprCap]}
        camera={{ position: [4, 1.9, 3], fov: 34, near: 0.1, far: 60 }}
        gl={{ antialias: !kitTier.bloomOn, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
        }}
        onPointerMove={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          state.current.px = ((e.clientX - r.left) / r.width) * 2 - 1;
          state.current.py = -(((e.clientY - r.top) / r.height) * 2 - 1);
        }}
        onPointerLeave={() => {
          state.current.px = 0;
          state.current.py = 0;
        }}
        style={{ background: "#05060a" }}
      >
        <VrContext.Provider value={ctx}>
          <Room
            room={kitRoom}
            tier={kitTier}
            bandId={band.id as keyof typeof kitRoom.lighting}
            accent={accentHex}
            phone={phoneRun}
            reduced={reducedMotion()}
            hoverId={litId}
            openIds={openIds}
            consoleOn={false}
            worlds={kitWorlds}
            clockOffsetMs={clockOffsetMs}
            stage={kitExtras}
            liveScreen={liveScreen}
            onMerged={(m) => {
              // Test handle: how the room's parts merged, and how many times it has (it should be once).
              const w = window as unknown as { __roomMerge?: { n?: number } };
              w.__roomMerge = { ...m, n: (w.__roomMerge?.n ?? 0) + 1 };
            }}
            onHover={(id) => setKitHover(id)}
            onRun={onKitRun}
          />
          <KitRig
            room={kitRoom}
            stops={kitStops}
            zoomRef={zoomRef}
            monitorId={monitorObj?.id ?? null}
            doorId={doorObj?.id ?? null}
            story={story}
            photo={photo}
            door={doorRef}
            onDoorDone={toHub}
            onFrame={onFrame}
            onZoomDone={navigate}
            onFirstFrame={onFirstFrame}
            mark={mark}
          />
          <KitLabel room={kitRoom} id={litId} text={litText} accent={accentHex} />
          {capture ? <PhotoCapture capture={capture} /> : null}
          {process.env.NODE_ENV !== "production" ? <Stats probe={false} onMedian={() => {}} /> : null}
          {kitTier.bloomOn ? (
            <EffectComposer multisampling={0} enableNormalPass={false}>
              <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} radius={0.7} />
              <SMAA />
              <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
            </EffectComposer>
          ) : null}
        </VrContext.Provider>
      </Canvas>
    );
  }

  return (
    <Canvas
      dpr={[1, cfg.dpr]}
      camera={{ position: [0, 0, 0], fov: 36, near: 0.05, far: 200 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      onPointerMove={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        state.current.px = ((e.clientX - r.left) / r.width) * 2 - 1;
        state.current.py = -(((e.clientY - r.top) / r.height) * 2 - 1);
      }}
      onPointerLeave={() => {
        state.current.px = 0;
        state.current.py = 0;
      }}
      style={{ background: "transparent" }}
    >
      <VrContext.Provider value={ctx}>
        <StudioEnvironment onReady={onEnvReady} size={cfg.env} />
        <StageLights band={band.id} look={look} instant={reducedMotion()} />
        <Rig
          slug={slug}
          zoomRef={zoomRef}
          story={story}
          photo={photo}
          door={doorRef}
          onDoorDone={toHub}
          onFrame={onFrame}
          onZoomDone={navigate}
          onFirstFrame={onFirstFrame}
        />
        {capture ? <PhotoCapture capture={capture} /> : null}
        <Setup slug={slug} world={world} media={media} stage={stage} />
      </VrContext.Provider>
    </Canvas>
  );
}
