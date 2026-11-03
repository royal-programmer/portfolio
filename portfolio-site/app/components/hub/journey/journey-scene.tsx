"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: GPU objects (materials, uniforms, the
   camera, the shared clock ref) are mutated every frame inside useFrame, never during render. */

/**
 * The light journey (D36) — the hub's Immersive scene. You travel AS the
 * light: in front of the prism, through the glass, out over the river of
 * colour toward each persona's world, then up and back as everything folds
 * into one white light.
 *
 * Alive at rest: photons always flow, dust drifts and parts around the
 * cursor, the crystal breathes, the camera breathes. Drag to look around,
 * hold to slow time.
 *
 * Lazy-loaded behind the entry gate, mounted paused (frameloop "demand") so
 * shaders compile while the visitor decides; `active` starts the clock.
 */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, ChromaticAberration, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";
import { BlendFunction, type ChromaticAberrationEffect } from "postprocessing";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { Quality } from "@/lib/site/experience";
import { JourneyContext, createClock, useJourney, type JourneyClock } from "./clock";
import { RIVER, angleFromS, ease, riverPoint, sFromT, worldPosition } from "./geometry";
import { Beam, Impact, INTRO, Prism } from "./light";
import { Dust, Photons, River } from "./river";
import type { Band, JourneyState, SectionKind } from "./state";
import { Worlds } from "./worlds";

export type QualityPreset = {
  dpr: number;
  composer: boolean;
  bloomScale: number;
  msaa: number;
  photons: number;
  dust: number;
};

export function qualityPreset(q: Quality): QualityPreset {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  if (q === "best") return { dpr: Math.min(dpr, 2), composer: true, bloomScale: 1, msaa: 4, photons: 7000, dust: 3000 };
  if (q === "balanced") return { dpr: Math.min(dpr, 1.5), composer: true, bloomScale: 0.5, msaa: 0, photons: 3500, dust: 1600 };
  return { dpr: 1, composer: false, bloomScale: 0, msaa: 0, photons: 1600, dust: 700 };
}

const FOV = 38;

// ---------------------------------------------------------------------------
// Camera path: one key pose per page section
// ---------------------------------------------------------------------------
type Pose = { pos: THREE.Vector3; look: THREE.Vector3; shift: number };

function keyPoses(sections: SectionKind[], portrait: boolean): Pose[] {
  let persona = 0;
  const personaCount = sections.filter((s) => s.kind === "persona").length;
  return sections.map((s) => {
    switch (s.kind) {
      case "hero":
        return portrait
          ? { pos: new THREE.Vector3(0, 2.8, 15), look: new THREE.Vector3(0, -1.7, 0), shift: 0 }
          : { pos: new THREE.Vector3(0, 2.4, 9.6), look: new THREE.Vector3(0, 0.45, 0), shift: 0.3 };
      case "through":
        return { pos: new THREE.Vector3(0, 0.22, -0.1), look: new THREE.Vector3(0, -0.4, -9), shift: 0 };
      case "persona": {
        const k = persona++;
        const sv = sFromT(s.t);
        const a = angleFromS(sv);
        const right = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
        const base = riverPoint(sv, 9 + k * 7);
        const look = worldPosition(s.t).add(new THREE.Vector3(0, portrait ? 2.5 : 4, 0));
        const pos = portrait
          ? base.clone().add(new THREE.Vector3(0, 2.6, 0)).addScaledVector(right, -0.4)
          : base.clone().add(new THREE.Vector3(0, 1.7, 0)).addScaledVector(right, -1.6);
        return { pos, look, shift: portrait ? 0 : 0.2 };
      }
      case "more": {
        const base = riverPoint(0.5, 9 + personaCount * 7 + 3);
        return { pos: base.add(new THREE.Vector3(0, 3.4, 0)), look: new THREE.Vector3(0, -1, -RIVER.length), shift: 0 };
      }
      case "end":
        return portrait
          ? { pos: new THREE.Vector3(0, 34, 20), look: new THREE.Vector3(0, -2.4, -24), shift: 0 }
          : { pos: new THREE.Vector3(0, 24, 14), look: new THREE.Vector3(0, -2.4, -22), shift: 0.62 };
    }
  });
}

function Director({
  sections,
  bands,
}: {
  sections: SectionKind[];
  bands: Band[];
}) {
  const { clock, state } = useJourney();
  const size = useThree((s) => s.size);
  const portrait = size.width < size.height * 0.9;
  const path = useMemo(() => {
    const poses = keyPoses(sections, portrait);
    const pts = (k: "pos" | "look") =>
      poses.length > 1 ? new THREE.CatmullRomCurve3(poses.map((p) => p[k]), false, "centripetal") : null;
    return { poses, pos: pts("pos"), look: pts("look") };
  }, [sections, portrait]);

  // Section index of each band's chapter (−1 for upcoming bands).
  const bandSection = useMemo(
    () => bands.map((b) => sections.findIndex((s) => s.kind === "persona" && s.slug === b.slug)),
    [bands, sections],
  );
  const moreIdx = sections.findIndex((s) => s.kind === "more");
  const endIdx = sections.findIndex((s) => s.kind === "end");

  const live = useRef({ c: 0, px: 0, py: 0, yaw: 0, pitch: 0, fov: FOV });
  const tmp = useMemo(
    () => ({ pos: new THREE.Vector3(), look: new THREE.Vector3(), dir: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }),
    [],
  );

  useFrame(({ camera }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const k: JourneyClock = clock.current;
    const s = state.current;
    const L = live.current;

    // ---- Clock ----
    k.dt = dt;
    k.scale = THREE.MathUtils.damp(k.scale, s.holding ? 0.12 : 1, s.holding ? 3 : 2, dt);
    k.t += dt * k.scale;
    k.intro = s.enteredAt ? (performance.now() - s.enteredAt) / 1000 : -1;

    // ---- Progress (smoothed a touch more than the page scroll) ----
    L.c = THREE.MathUtils.damp(L.c, s.c, 3.4, dt);
    const c = L.c;
    k.c = c;
    const last = Math.max(1, path.poses.length - 1);
    const u = Math.min(1, Math.max(0, c / last));

    // ---- Derived scene state ----
    for (let i = 0; i < k.act.length; i++) {
      const sec = bandSection[i] ?? -1;
      k.act[i] = sec < 0 ? 0 : Math.exp(-((c - sec) ** 2) / 0.35);
    }
    k.more = moreIdx < 0 ? 0 : Math.exp(-((c - moreIdx) ** 2) / 0.4);
    k.fold = endIdx < 0 ? 0 : THREE.MathUtils.smoothstep(c, endIdx - 0.8, endIdx);
    k.reveal = k.intro < 0 ? 0 : ease((k.intro - INTRO.spread[0]) / (INTRO.spread[1] - INTRO.spread[0]));

    // ---- Pose on the path ----
    if (path.pos && path.look) {
      path.pos.getPoint(u, tmp.pos);
      path.look.getPoint(u, tmp.look);
    } else {
      tmp.pos.copy(path.poses[0].pos);
      tmp.look.copy(path.poses[0].look);
    }
    const i0 = Math.min(last, Math.floor(c));
    const i1 = Math.min(last, i0 + 1);
    const shift = THREE.MathUtils.lerp(path.poses[i0].shift, path.poses[i1].shift, THREE.MathUtils.smoothstep(c - i0, 0, 1));

    // Intro: arrive from above as the light falls.
    const arrive = k.intro < 0 ? 0 : ease(k.intro / 3.8);
    tmp.pos.y += (1 - arrive) * 3.2;
    tmp.pos.z += (1 - arrive) * 3.5 * (c < 0.5 ? 1 : 0);

    // Alive at rest: a slow breath.
    tmp.pos.x += Math.sin(k.t * 0.21) * 0.1;
    tmp.pos.y += Math.sin(k.t * 0.17) * 0.07;

    // Pointer parallax (smoothed — responsive, never floaty).
    const pk = Math.min(1, dt * 6);
    L.px += (s.px - L.px) * pk;
    L.py += (s.py - L.py) * pk;
    tmp.dir.subVectors(tmp.look, tmp.pos).normalize();
    tmp.right.crossVectors(tmp.dir, tmp.up).normalize();
    tmp.pos.addScaledVector(tmp.right, L.px * 0.35).addScaledVector(tmp.up, L.py * 0.22);

    // Drag to look around (springs home a moment after release).
    const home = !s.dragging && performance.now() - s.lastDragEnd > 1400;
    if (home) {
      s.yaw = THREE.MathUtils.damp(s.yaw, 0, 1.1, dt);
      s.pitch = THREE.MathUtils.damp(s.pitch, 0, 1.1, dt);
    }
    L.yaw = THREE.MathUtils.damp(L.yaw, s.yaw, 6, dt);
    L.pitch = THREE.MathUtils.damp(L.pitch, s.pitch, 6, dt);
    tmp.dir.subVectors(tmp.look, tmp.pos);
    tmp.dir.applyAxisAngle(tmp.up, L.yaw);
    tmp.right.crossVectors(tmp.dir, tmp.up).normalize();
    tmp.dir.applyAxisAngle(tmp.right, L.pitch);

    camera.position.copy(tmp.pos);
    camera.lookAt(tmp.look.copy(tmp.pos).add(tmp.dir));

    // Inside the glass?
    k.inside = 1 - THREE.MathUtils.smoothstep(camera.position.length(), 0.7, 1.6);

    // Lens: holding narrows the view; subject framed beside the text column.
    const cam = camera as THREE.PerspectiveCamera;
    L.fov = THREE.MathUtils.damp(L.fov, s.holding ? FOV - 5 : FOV + k.inside * 8, 3, dt);
    cam.fov = L.fov;
    cam.filmOffset = -shift * cam.getFilmWidth() * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect;
    cam.updateProjectionMatrix();
  });

  return null;
}

// ---------------------------------------------------------------------------
// Post effects
// ---------------------------------------------------------------------------
function Effects({ preset }: { preset: QualityPreset }) {
  const { clock } = useJourney();
  const ca = useRef<ChromaticAberrationEffect>(null);
  const offset = useMemo(() => new THREE.Vector2(0.0006, 0.0004), []);
  useFrame(() => {
    const k = clock.current;
    const amount = 0.0005 + k.inside * 0.009 + (1 - k.scale) * 0.0025;
    ca.current?.offset.set(amount, amount * 0.6);
  });
  return (
    <EffectComposer multisampling={preset.msaa} enableNormalPass={false}>
      <Bloom mipmapBlur resolutionScale={preset.bloomScale} levels={preset.msaa ? 7 : 5} intensity={1.05} luminanceThreshold={0.22} luminanceSmoothing={0.4} />
      <ChromaticAberration ref={ca} offset={offset} radialModulation modulationOffset={0.25} />
      <Vignette offset={0.25} darkness={0.75} />
      <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.045} />
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
 * (hidden or throttled tab) are discarded, not judged.
 */
function Governor({ quality, onStepDown, onStruggle }: { quality: Quality; onStepDown: () => void; onStruggle: () => void }) {
  const s = useRef({ windowStart: -1, frames: 0, slow: 0, last: 0, done: false });
  useEffect(() => {
    // New quality → fresh measurement.
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

/** Compile every shader up front (while the gate is open), then report ready. */
function Warmup({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    // Dev-only handle for profiling (toggle meshes from DevTools).
    if (process.env.NODE_ENV !== "production") (window as unknown as { __journey?: unknown }).__journey = { gl, scene };
    let cancelled = false;
    const run = async () => {
      try {
        await gl.compileAsync(scene, camera);
      } catch {
        gl.compile(scene, camera);
      }
      if (cancelled) return;
      invalidate();
      requestAnimationFrame(() => requestAnimationFrame(() => !cancelled && onReady()));
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, invalidate, onReady]);
  return null;
}

function ContextWatch({ onFail }: { onFail: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    // A shader that fails to compile on this GPU = 3D can't run properly here.
    gl.debug.onShaderError = (glCtx, _program, vs, fs) => {
      console.error("[journey] shader error", glCtx.getShaderInfoLog(vs) || glCtx.getShaderInfoLog(fs));
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
export default function JourneyScene({
  sections,
  bands,
  state,
  active,
  quality,
  onReady,
  onStepDown,
  onStruggle,
  onFail,
}: {
  sections: SectionKind[];
  /** Spectrum order. */
  bands: Band[];
  state: MutableRefObject<JourneyState>;
  /** False while the gate is open: paused, but compiled and ready. */
  active: boolean;
  quality: Quality;
  onReady: () => void;
  onStepDown: () => void;
  onStruggle: () => void;
  onFail: () => void;
}) {
  const clock = useRef<JourneyClock>(createClock());
  const preset = useMemo(() => qualityPreset(quality), [quality]);
  // Point sizes are in CSS-pixel-ish units scaled by the render DPR.
  const px = 70 * preset.dpr;
  const ctx = useMemo(() => ({ clock, state }), [state]);

  return (
    <Canvas
      dpr={preset.dpr}
      frameloop={active ? "always" : "demand"}
      camera={{ position: [0, 2.4, 9.6], fov: FOV, near: 0.05, far: 200 }}
      gl={{ antialias: !preset.composer, powerPreference: "high-performance", alpha: false }}
      onCreated={({ gl }) => gl.setClearColor("#050507")}
    >
      <JourneyContext.Provider value={ctx}>
        <Director sections={sections} bands={bands} />
        {active ? <Governor quality={quality} onStepDown={onStepDown} onStruggle={onStruggle} /> : null}
        <Warmup onReady={onReady} />
        <ContextWatch onFail={onFail} />

        <River bands={bands} />
        <Photons bands={bands} count={preset.photons} px={px} />
        <Worlds bands={bands} />
        <Beam />
        <Prism />
        <Impact px={px} />
        <Dust count={preset.dust} px={px} />

        {preset.composer ? <Effects preset={preset} /> : null}
      </JourneyContext.Provider>
    </Canvas>
  );
}
