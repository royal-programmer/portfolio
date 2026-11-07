"use client";

/**
 * The world page's hero in Immersive mode: the very setup you flew into on the hub, standing in
 * its own small stage — the laptop, the desk, the camera, the easel, the bike, the rig — lit by
 * the same materials and screens, gathering itself from loose parts as the page opens, turning a
 * little with the pointer, glowing under it. The hub's assemblies are reused as they are: this
 * canvas only provides the clock, the state and a camera standing where the climb's would.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { PersonaSlug } from "@/lib/content/types";
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

function StudioEnvironment() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    pmrem.dispose();
    return () => {
      scene.environment = null;
      tex.dispose();
    };
  }, [get]);
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
};

/** How much of the frame the setup may fill (NDC half-extent); the rest is air. */
const FIT_MARGIN = 0.82;

/** Measure the setup: every mesh in the scene except the screens' halo sheets. */
function measureSetup(scene: THREE.Scene, box: THREE.Box3, tmp: THREE.Vector3) {
  box.makeEmpty();
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const mat = m.material as THREE.Material | THREE.Material[];
    if (!Array.isArray(mat) && mat?.name === "halo") return;
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
function driveStage(k: VrClock, s: VrState, tmp: Scratch, pose: Pose, place: { fwd: number; right: number; up: number }, size: { width: number; height: number }, camera: THREE.Camera, scene: THREE.Scene, rawDt: number) {
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
}

/** Drives the clock and stands the camera in front of the setup; the pointer turns it a little. */
function Rig({ slug }: { slug: PersonaSlug }) {
  const { clock, state } = useVr();
  const size = useThree((s) => s.size);
  // Per-frame scratch (a ref: it is written every frame).
  const scratch = useRef<Scratch>({ centre: new THREE.Vector3(), dir: new THREE.Vector3(), pos: new THREE.Vector3(), look: new THREE.Vector3(), px: 0, py: 0, handle: false, box: new THREE.Box3(), boxAt: -1, corner: new THREE.Vector3(), fit: 1 });
  const pose = useMemo(() => climbPose(C), []);
  useFrame(({ camera, scene }, rawDt) => {
    const tmp = scratch.current;
    if (!tmp.handle) {
      tmp.handle = true;
      // Dev-only handle for tests.
      if (process.env.NODE_ENV !== "production") (window as unknown as { __stage?: unknown }).__stage = { scene, camera, clock, state };
    }
    driveStage(clock.current, state.current, tmp, pose, PLACE[slug], size, camera, scene, rawDt);
  });
  return null;
}

function Setup({ slug, world, media }: { slug: PersonaSlug; world: World; media: HubMedia }) {
  switch (slug) {
    case "engineer":
      return <EngineerAssembly world={world} screenSrc={media.engineer?.[0] ? `/hub/engineer/${media.engineer[0]}` : undefined} />;
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

export default function WorldStage3D({ slug, t }: { slug: PersonaSlug; t: number }) {
  const clock = useRef<VrClock>(createClock());
  const state = useRef<VrState>(createVrState());
  const ctx = useMemo(() => ({ clock, state }), []);
  const world = useMemo<World>(() => ({ slug, t, c: C }), [slug, t]);
  const [media, setMedia] = useState<HubMedia>({});
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
  return (
    <Canvas
      dpr={[1, 1.75]}
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
        <StudioEnvironment />
        <Rig slug={slug} />
        <Setup slug={slug} world={world} media={media} />
      </VrContext.Provider>
    </Canvas>
  );
}
