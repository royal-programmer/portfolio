"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: GPU objects (materials, uniforms, the
   camera, the shared clock ref) are mutated every frame inside useFrame, never during render. */

/**
 * The VR journey scene (D38). One Canvas for the whole hub: the headset in
 * the gate, the sky, the light that comes at you, the cone of colour and the
 * climb. The Director owns time, the phase timeline and the camera.
 *
 * Lazy-loaded; mounted while the gate shows (the headset IS the gate), so
 * every shader is compiled before the visitor puts it on.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, type ChromaticAberrationEffect } from "postprocessing";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { ambient } from "@/lib/site/ambient-sound";
import type { Quality } from "@/lib/site/experience";
import { spectrumColor } from "@/lib/site/spectrum";
import { VrContext, createClock, useVr, type VrClock } from "./clock";
import { Worlds } from "./field";
import { FluidEffect, FluidSim } from "./fluid";
import { Headset } from "./headset";
import { ApproachLight, Cone, Photons, Rays } from "./light";
import { Dome, Stars } from "./sky";
import { Space } from "./space";
import { PHASE_LENGTH, PORTAL_LENGTH, REWIND_LENGTH, PORTAL_OUT_LENGTH, type Band, type Phase, type VrState, type World } from "./state";
import { clamp01, climbPose, ease, easeIn, easeInOut, makePose, WORLD } from "./util";

export type QualityPreset = { dpr: number; bloomScale: number; msaa: number; photons: number; stars: number; rays: number; slabs: number };

/** Every level runs the composer (the fluid cursor lives there); Performance drops bloom and the extras. */
export function qualityPreset(q: Quality): QualityPreset {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  if (q === "best") return { dpr: Math.min(dpr, 2), bloomScale: 1, msaa: 4, photons: 6000, stars: 4200, rays: 420, slabs: 34 };
  if (q === "balanced") return { dpr: Math.min(dpr, 1.5), bloomScale: 0.5, msaa: 0, photons: 3200, stars: 3000, rays: 300, slabs: 26 };
  return { dpr: 1, bloomScale: 0, msaa: 2, photons: 1500, stars: 2200, rays: 180, slabs: 18 };
}

const FOV = 40;
/** Speed of the light toward you at progress p (per second): slow, then rushing. ≈7 s in all. */
const approachSpeed = (p: number) => 0.045 + 0.75 * p * p;

/** The J: forward, then up, as the light splits. */
const J_PATH = new THREE.CatmullRomCurve3(
  [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.15, -0.55), new THREE.Vector3(0.1, 1.4, -0.75), new THREE.Vector3(0, 3.2, -0.3)],
  false,
  "centripetal",
);

type Props = {
  bands: Band[];
  /** Section kinds in page order; persona sections tint the sky. */
  sectionT: Array<number | null>;
  /** Persona worlds on the climb (where each peaks, its colour). */
  worlds: World[];
  state: MutableRefObject<VrState>;
  quality: Quality;
  /** The scene finished a fixed-length phase; the page moves to the next. */
  onPhaseEnd: (ended: Phase) => void;
  /** The pointer moved onto / off a lit assembly's screen (the page warms that world). */
  onPortalHover?: (slug: string | null) => void;
  onWear: () => void;
  onReady: () => void;
  onStepDown: () => void;
  onStruggle: () => void;
  onFail: () => void;
};

function Director({ sectionT, worlds, onPhaseEnd, onPortalHover }: { sectionT: Array<number | null>; worlds: World[]; onPhaseEnd: (p: Phase) => void; onPortalHover?: (slug: string | null) => void }) {
  const { clock, state } = useVr();
  const size = useThree((s) => s.size);
  // Phones hold the view upright: the vertical field is the fixed one, so open it up or the
  // climb becomes a keyhole.
  const portrait = clamp01((1.2 - size.width / Math.max(1, size.height)) / 0.6);
  const fovBase = FOV * (1 + portrait * 0.45);
  const live = useRef({ c: 0, px: 0, py: 0, yaw: 0, pitch: 0, fov: FOV, hover: false, portalHover: null as string | null, tscale: "", sound: -1, ended: "" as Phase | "" });
  const tmp = useMemo(
    () => ({
      pos: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      look: new THREE.Vector3(),
      pose: makePose(),
      anchor: new THREE.Vector3(),
      normal: new THREE.Vector3(),
      centre: new THREE.Vector3(),
      v0: new THREE.Vector3(),
      v1: new THREE.Vector3(),
    }),
    [],
  );

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const k: VrClock = clock.current;
    const s = state.current;
    const L = live.current;
    const now = performance.now();

    // ---- Time ----
    const canSlow = s.phase !== "gate" && s.phase !== "wear" && s.phase !== "blink";
    k.dt = dt;
    k.scale = THREE.MathUtils.damp(k.scale, s.holding && canSlow ? 0.1 : 1, s.holding ? 3.5 : 2, dt);
    k.t += dt * k.scale;
    k.phaseT = s.phaseAt ? (now - s.phaseAt) / 1000 : 0;

    // ---- Phase timeline ----
    const end = (p: Phase) => {
      if (L.ended === p) return;
      L.ended = p;
      onPhaseEnd(p);
    };
    if (s.phase === "approach") {
      s.approach = Math.min(1, s.approach + dt * k.scale * approachSpeed(s.approach));
      if (s.approach >= 1) end("approach");
    } else if (s.phase in PHASE_LENGTH && k.phaseT >= PHASE_LENGTH[s.phase as keyof typeof PHASE_LENGTH]) {
      end(s.phase);
    }
    if (L.ended && L.ended !== s.phase) L.ended = ""; // the page moved on; arm again

    // ---- Derived ----
    k.approach = s.approach;
    k.speed = clamp01(approachSpeed(s.approach) / 0.8) * (s.phase === "approach" ? 1 : 0);
    const skyTarget = s.phase === "gate" || s.phase === "wear" ? 0.3 : 1;
    k.sky = THREE.MathUtils.damp(k.sky, skyTarget, 2.5, dt);
    // The split, in three overlapping movements: the white pillar reaches up
    // (impact), fans out (spread), and the colour separates inside it (chroma).
    if (s.skipped || s.phase === "climb") {
      k.cone = k.spread = k.chroma = 1;
    } else if (s.phase === "impact") {
      k.cone = ease(k.phaseT / PHASE_LENGTH.impact);
      k.spread = 0;
      k.chroma = 0;
    } else if (s.phase === "split") {
      const u = k.phaseT / PHASE_LENGTH.split;
      k.cone = 1;
      k.spread = easeInOut((u - 0.04) / 0.7);
      k.chroma = easeInOut((u - 0.2) / 0.72);
    } else {
      k.cone = k.spread = k.chroma = 0;
    }
    // Back from a world we land on its chapter: no ride up from the start of the climb.
    if (s.portalOut && Math.abs(L.c - s.c) > 0.3) L.c = s.c;
    L.c = THREE.MathUtils.damp(L.c, s.c, 3.4, dt);
    // The rewind: a fast dive back down the whole climb, rushing like the approach did.
    let rewind = 0;
    if (s.rewind) {
      rewind = clamp01((now - s.rewind.at) / 1000 / REWIND_LENGTH);
      L.c = s.rewind.from * (1 - rewind * rewind);
      k.speed = Math.max(k.speed, Math.sin(rewind * Math.PI));
    }
    k.climb = s.phase === "climb" ? L.c : 0;
    // The ending: past the last world the colours fade and the sky empties.
    const lastWorld = worlds.length ? worlds[worlds.length - 1].c : 0;
    const endC = sectionT.length - 1;
    k.ending = s.phase === "climb" ? THREE.MathUtils.smoothstep(L.c, lastWorld + 0.45, Math.max(lastWorld + 0.5, endC - 0.05)) : 0;
    if (s.phase === "climb") k.cone = 1 - k.ending;

    // Sky tint: the persona section nearest to the scroll.
    const idx = Math.round(L.c);
    const t = sectionT[idx] ?? null;
    const near = 1 - Math.min(1, Math.abs(L.c - idx) * 1.4);
    k.tint = t ?? k.tint;
    k.tintAmount = THREE.MathUtils.damp(k.tintAmount, k.cone * (t === null ? 0.12 : 0.25 + 0.45 * near) * (1 - k.ending), 3, dt);

    // Headset / lit-assembly hover → page cursor; time scale → the cursor's "time ×0.27" and the sound.
    if (L.hover !== s.hover) {
      L.hover = s.hover;
      document.documentElement.classList.toggle("is-headset-hover", s.hover);
    }
    if (L.portalHover !== s.portalHover) {
      L.portalHover = s.portalHover;
      const root = document.documentElement;
      root.classList.toggle("is-portal-hover", !!s.portalHover);
      const w = worlds.find((x) => x.slug === s.portalHover);
      if (w) root.style.setProperty("--portal-c", spectrumColor(w.t));
      onPortalHover?.(s.portalHover);
    }
    const tscale = k.scale.toFixed(2);
    if (tscale !== L.tscale) {
      L.tscale = tscale;
      document.documentElement.style.setProperty("--tscale", tscale);
    }
    const soundScale = Math.round(k.scale * 50) / 50;
    if (soundScale !== L.sound) {
      L.sound = soundScale;
      ambient.timeScale(soundScale);
    }
    ambient.rush(k.speed);

    // ---- Camera ----
    let pitch = 0; // up from level
    let yaw = 0; // around +y, 0 = looking −z
    tmp.pos.set(0, 0, 0);
    if (s.phase === "split") {
      const u = easeInOut(k.phaseT / PHASE_LENGTH.split);
      J_PATH.getPoint(u, tmp.pos);
      const uu = clamp01((u - 0.15) / 0.85);
      pitch = WORLD.splitPitch * easeInOut(uu);
      yaw = -Math.PI / 2 * easeInOut(uu); // the horizontal look swings to +x, the helix tangent
    } else if (s.phase === "climb") {
      const p = climbPose(L.c, tmp.pose);
      tmp.pos.copy(p.pos);
      pitch = p.pitch;
      yaw = p.yaw;
      // The ending tilts the head back up into the empty sky; the rewind looks back down the climb.
      pitch += (1.22 - pitch) * easeInOut(k.ending);
      pitch -= 0.9 * easeInOut(rewind) * (1 - rewind * 0.5);
    }

    // Through the doorway: the camera flies into the lit screen, straight on — and back out
    // of it when you return from that world.
    let into = 0;
    let swing = 0; // the orbit's share of the way round the setup (ahead of the dive)
    let outKick = 0; // the pull-out's lens kick: wide at the start, settling as you land on the climb
    if (s.portal) {
      const u = clamp01((now - s.portal.at) / 1000 / PORTAL_LENGTH);
      into = easeIn(u);
      swing = easeInOut(clamp01(u / 0.8));
    } else if (s.portalOut) {
      const u = clamp01((now - s.portalOut.at) / 1000 / PORTAL_OUT_LENGTH);
      into = 1 - easeInOut(u);
      swing = 1 - easeInOut(clamp01((u - 0.2) / 0.8));
      outKick = Math.sin(Math.pow(u, 0.6) * Math.PI);
      if (u >= 1) s.portalOut = null;
    }
    if (into > 0 && s.portalAnchor) {
      const a = s.portalAnchor;
      tmp.anchor.set(a.x, a.y, a.z);
      tmp.normal.set(a.nx, a.ny, a.nz);
      tmp.centre.set(a.cx, a.cy, a.cz);
      // End just in front of the glass, looking through it.
      tmp.look.copy(tmp.anchor).addScaledVector(tmp.normal, 0.18);
      // The way there is an orbit, not a straight line: the camera swings round the setup to the side
      // its screen faces (over the tank and down onto the dash, round to the front of a monitor),
      // so the object turns beneath you, then it dives in. Direction slerps round the centre while
      // the distance closes.
      tmp.v0.copy(tmp.pos).sub(tmp.centre);
      tmp.v1.copy(tmp.look).sub(tmp.centre);
      const r0 = tmp.v0.length();
      const r1 = tmp.v1.length();
      if (r0 > 1e-4 && r1 > 1e-4) {
        tmp.v0.divideScalar(r0);
        tmp.v1.divideScalar(r1);
        const cos = THREE.MathUtils.clamp(tmp.v0.dot(tmp.v1), -1, 1);
        const ang = Math.acos(cos);
        if (ang > 1e-3 && ang < Math.PI - 1e-3) {
          const sn = Math.sin(ang);
          const w0 = Math.sin((1 - swing) * ang) / sn;
          const w1 = Math.sin(swing * ang) / sn;
          tmp.dir.copy(tmp.v0).multiplyScalar(w0).addScaledVector(tmp.v1, w1);
        } else tmp.dir.copy(tmp.v0).lerp(tmp.v1, swing).normalize();
        // Keep height from the orbit a little above the chord so the swing reads as going over, not through.
        const r = r0 + (r1 - r0) * into;
        tmp.pos.copy(tmp.centre).addScaledVector(tmp.dir, r);
        tmp.pos.y += Math.sin(swing * Math.PI) * 0.35 * (1 - into);
      } else tmp.pos.lerp(tmp.look, into);
      // Look: at the setup while swinging round it, settling onto the screen as you arrive.
      const toward = tmp.dir.copy(tmp.centre).lerp(tmp.anchor, Math.max(into, swing * 0.7)).sub(tmp.pos);
      if (toward.lengthSq() > 1e-6) {
        toward.normalize();
        const wantYaw = Math.atan2(toward.x, -toward.z);
        const wantPitch = Math.asin(THREE.MathUtils.clamp(toward.y, -1, 1));
        let dy = wantYaw - yaw; // shortest turn
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        const hold = Math.max(into, swing);
        yaw += dy * hold;
        pitch += (wantPitch - pitch) * hold;
      }
    }

    // Alive at rest: a slow breath; the approach adds a tremor as it rushes.
    const tremor = k.speed * k.speed * 0.03;
    tmp.pos.x += Math.sin(k.t * 0.21) * 0.05 + Math.sin(k.t * 61.7) * Math.sin(k.t * 23.1) * tremor;
    tmp.pos.y += Math.sin(k.t * 0.17) * 0.04 + Math.sin(k.t * 47.3) * Math.cos(k.t * 31.9) * tremor;

    // Pointer parallax (responsive, never floaty).
    const pk = Math.min(1, dt * 6);
    L.px += (s.px - L.px) * pk;
    L.py += (s.py - L.py) * pk;

    // Drag to look around (springs home a moment after release).
    const home = !s.dragging && now - s.lastDragEnd > 1400;
    if (home) {
      s.yaw = THREE.MathUtils.damp(s.yaw, 0, 1.1, dt);
      s.pitch = THREE.MathUtils.damp(s.pitch, 0, 1.1, dt);
    }
    L.yaw = THREE.MathUtils.damp(L.yaw, s.yaw, 6, dt);
    L.pitch = THREE.MathUtils.damp(L.pitch, s.pitch, 6, dt);

    const free = 1 - Math.max(into, swing);
    const totalYaw = yaw + (L.yaw + L.px * 0.06) * free;
    const totalPitch = Math.min(1.5, pitch + (L.pitch + L.py * 0.05) * free);
    tmp.dir.set(Math.sin(totalYaw) * Math.cos(totalPitch), Math.sin(totalPitch), -Math.cos(totalYaw) * Math.cos(totalPitch));
    camera.position.copy(tmp.pos);
    camera.lookAt(tmp.look.copy(tmp.pos).add(tmp.dir));

    // Lens: holding narrows the view; rushing widens it.
    const cam = camera as THREE.PerspectiveCamera;
    // Lens: holding narrows the view; rushing widens it; the visitor's zoom opens it right up.
    const zoomed = fovBase * (1 + s.zoom * 0.95);
    L.fov = THREE.MathUtils.damp(L.fov, zoomed - (1 - k.scale) * 6 + k.speed * 12 - into * 14 + outKick * 18, outKick > 0 ? 8 : 3, dt);
    if (Math.abs(cam.fov - L.fov) > 0.01) {
      cam.fov = L.fov;
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

// ---------------------------------------------------------------------------
// Post effects
// ---------------------------------------------------------------------------
function Effects({ preset }: { preset: QualityPreset }) {
  const { clock, state } = useVr();
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const ca = useRef<ChromaticAberrationEffect>(null);
  const offset = useMemo(() => new THREE.Vector2(0.0006, 0.0004), []);
  const fluid = useMemo(() => new FluidSim(), []);
  const fluidFx = useMemo(() => new FluidEffect(fluid.texture), [fluid]);
  useEffect(() => {
    // Dev-only handle for tuning the fluid from the console.
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as { __vr?: Record<string, unknown> };
      w.__vr = { ...(w.__vr ?? {}), fluid, fluidFx };
    }
    return () => fluid.dispose();
  }, [fluid, fluidFx]);
  useEffect(() => fluid.setSize(size.width, size.height), [fluid, size.width, size.height]);

  useFrame(() => {
    const k = clock.current;
    const s = state.current;
    const amount = 0.0004 + k.speed * 0.006 + (1 - k.scale) * 0.0025;
    ca.current?.offset.set(amount, amount * 0.6);
    // The fluid runs in light-time: holding slows the swirls with everything else.
    fluid.step(gl, s.px, s.py, k.dt * (0.3 + 0.7 * k.scale), (k.t * 0.02) % 1);
    fluidFx.setTexture(fluid.texture);
  });
  const full = preset.bloomScale > 0;
  return (
    <EffectComposer multisampling={preset.msaa} enableNormalPass={false}>
      <primitive object={fluidFx} />
      {full ? <Bloom mipmapBlur resolutionScale={preset.bloomScale} levels={preset.msaa ? 7 : 5} intensity={1.0} luminanceThreshold={0.25} luminanceSmoothing={0.4} /> : null}
      {full ? <ChromaticAberration ref={ca} offset={offset} radialModulation modulationOffset={0.25} /> : null}
      <Vignette offset={0.25} darkness={0.7} />
      {full ? <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.04} /> : null}
    </EffectComposer>
  );
}

// ---------------------------------------------------------------------------
// Quality governor
// ---------------------------------------------------------------------------
/**
 * Real frame rate in 1 s windows after a warm-up. Sustained < 40 fps → ask the
 * page to step quality down; already at Performance and < 26 fps → `onStruggle`
 * (the page OFFERS Normal view — it never switches silently). Long frame gaps
 * (hidden or throttled tab) are discarded, not judged. The page decides what
 * to do with `onStepDown` (a level the visitor chose by hand is never changed).
 */
function Governor({ quality, onStepDown, onStruggle }: { quality: Quality; onStepDown: () => void; onStruggle: () => void }) {
  const s = useRef({ windowStart: -1, frames: 0, slow: 0, last: 0, done: false });
  useEffect(() => {
    s.current = { windowStart: -1, frames: 0, slow: 0, last: 0, done: false };
  }, [quality]);
  useFrame(({ clock }) => {
    const st = s.current;
    const now = clock.elapsedTime;
    if (st.done) return;
    if (st.windowStart < 0) {
      st.windowStart = now + 3;
      st.last = now;
      return;
    }
    const gap = now - st.last;
    st.last = now;
    if (gap > 0.25 || document.hidden) {
      st.frames = 0;
      st.windowStart = now + 1;
      return;
    }
    if (now < st.windowStart) return;
    st.frames++;
    const elapsed = now - st.windowStart;
    if (elapsed < 1) return;
    const fps = st.frames / elapsed;
    st.frames = 0;
    st.windowStart = now;
    document.documentElement.dataset.sceneFps = fps.toFixed(0);
    const floor = quality === "performance" ? 26 : 40;
    st.slow = fps < floor ? st.slow + 1 : 0;
    if (st.slow >= 3) {
      st.done = true;
      if (quality === "performance") onStruggle();
      else onStepDown();
    }
  });
  return null;
}

/** Compile every shader up front (while the gate shows), then report ready. */
function Warmup({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const { clock, state } = useVr();
  useEffect(() => {
    // Dev-only handle for profiling and tests.
    if (process.env.NODE_ENV !== "production") (window as unknown as { __vr?: unknown }).__vr = { gl, scene, clock, state };
    let cancelled = false;
    const run = async () => {
      try {
        await gl.compileAsync(scene, camera);
      } catch {
        gl.compile(scene, camera);
      }
      if (cancelled) return;
      requestAnimationFrame(() => requestAnimationFrame(() => !cancelled && onReady()));
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, clock, state, onReady]);
  return null;
}

function ContextWatch({ onFail }: { onFail: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.debug.onShaderError = (glCtx, _program, vs, fs) => {
      console.error("[vr] shader error", glCtx.getShaderInfoLog(vs) || glCtx.getShaderInfoLog(fs));
      onFail();
    };
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onFail();
    };
    el.addEventListener("webglcontextlost", lost);
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl, onFail]);
  return null;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------
export default function VrScene({ sectionT, worlds, state, quality, onPhaseEnd, onPortalHover, onWear, onReady, onStepDown, onStruggle, onFail }: Props) {
  const clock = useRef<VrClock>(createClock());
  const preset = useMemo(() => qualityPreset(quality), [quality]);
  const px = 70 * preset.dpr;
  const ctx = useMemo(() => ({ clock, state }), [state]);

  return (
    <Canvas
      dpr={preset.dpr}
      camera={{ position: [0, 0, 0], fov: FOV, near: 0.05, far: 500 }}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      onCreated={({ gl }) => gl.setClearColor("#050507")}
    >
      <VrContext.Provider value={ctx}>
        <Director sectionT={sectionT} worlds={worlds} onPhaseEnd={onPhaseEnd} onPortalHover={onPortalHover} />
        <Governor quality={quality} onStepDown={onStepDown} onStruggle={onStruggle} />
        <Warmup onReady={onReady} />
        <ContextWatch onFail={onFail} />

        <Dome />
        <Stars count={preset.stars} px={px} />
        <Space />
        <Headset onWear={onWear} />
        <ApproachLight />
        <Cone />
        <Rays count={preset.rays} />
        <Photons count={preset.photons} px={px} />
        <Worlds worlds={worlds} slabs={preset.slabs} />

        <Effects preset={preset} />
      </VrContext.Provider>
    </Canvas>
  );
}
