"use client";

/**
 * "Refraction" — the hub's 3D scene (Immersive mode only; lazy-loaded).
 *
 * A thread of white light falls onto a glass prism and disperses into ONE
 * continuous spectrum (a shader-drawn fan, so any number of personas fits).
 * Each persona is a brighter band at its spectrum position `t`; upcoming
 * personas flicker faintly. The page's scroll position (shared `focus` ref)
 * moves the camera to the active band; the closing chapter folds the
 * spectrum back into white light.
 *
 * Perf: DPR capped, glow via mipmap bloom, glass via drei transmission at a
 * reduced buffer resolution, no network assets (procedural environment).
 * `QualityGovernor` drops bloom if the device struggles, then calls
 * `onDegrade` if it still can't keep up → the page swaps to the Lite poster.
 */
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  Sparkles,
} from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { SPECTRUM_GLSL } from "@/lib/site/spectrum";

export type SceneBand = { t: number; lit: boolean };
/** "hero" | persona chapter index (into lit bands) | "more" | "end". */
export type SceneFocus = { chapter: "hero" | "more" | "end" | number };

const MAX_BANDS = 16;

// ---- Geometry (world units) ------------------------------------------------
const HIT = new THREE.Vector3(-0.52, 0.32, 0); // beam meets the left face
const EXIT = new THREE.Vector3(0.5, 0.18, 0); // spectrum leaves the right face
const BEAM_FROM = new THREE.Vector3(-8.5, 5.2, 0);
const FAN_A0 = THREE.MathUtils.degToRad(16); // t = 0 (rose) — bends least
const FAN_A1 = THREE.MathUtils.degToRad(-40); // t = 1 (violet) — bends most
const FAN_R = 11;

const bandAngle = (t: number) => FAN_A0 + (FAN_A1 - FAN_A0) * t;
const bandPoint = (t: number, r: number) =>
  new THREE.Vector3(EXIT.x + Math.cos(bandAngle(t)) * r, EXIT.y + Math.sin(bandAngle(t)) * r, 0);

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

// ---- Prism -------------------------------------------------------------------
function Prism() {
  const ref = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 1.25);
    s.lineTo(1.08, -0.62);
    s.lineTo(-1.08, -0.62);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 1.3,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
      bevelSegments: 4,
    });
    g.center();
    return g;
  }, []);
  // Crisp glass edges — keeps the silhouette readable against the void.
  const edges = useMemo(() => new THREE.EdgesGeometry(geometry, 25), [geometry]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime;
    ref.current.rotation.y = Math.sin(t * 0.35) * 0.22;
    ref.current.rotation.x = Math.sin(t * 0.27) * 0.06;
    ref.current.position.y = Math.sin(t * 0.6) * 0.04;
  });

  return (
    <mesh ref={ref} geometry={geometry}>
      <MeshTransmissionMaterial
        transmission={1}
        thickness={1.1}
        roughness={0.03}
        ior={1.45}
        chromaticAberration={0.6}
        anisotropicBlur={0.08}
        distortion={0}
        backside
        backsideThickness={0.5}
        samples={4}
        resolution={512}
        color="#f4f6ff"
      />
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={[1.6, 1.6, 1.7]} transparent opacity={0.45} toneMapped={false} />
      </lineSegments>
    </mesh>
  );
}

// ---- Falling beam ------------------------------------------------------------
function Beam() {
  const group = useRef<THREE.Group>(null);
  const start = useRef<number | null>(null);
  const { length, quat } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(HIT, BEAM_FROM);
    return {
      length: dir.length(),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()),
    };
  }, []);
  const core = useMemo(() => new THREE.CylinderGeometry(0.018, 0.018, length, 8, 1, true).translate(0, length / 2, 0), [length]);
  const halo = useMemo(() => new THREE.CylinderGeometry(0.09, 0.09, length, 12, 1, true).translate(0, length / 2, 0), [length]);
  const inner = useMemo(() => {
    const d = new THREE.Vector3().subVectors(EXIT, HIT);
    const g = new THREE.CylinderGeometry(0.014, 0.014, d.length(), 8, 1, true).translate(0, d.length() / 2, 0);
    return { g, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()) };
  }, []);

  // Intro: the beam falls in 0.3–1.5s after the scene starts.
  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime;
    const reveal = ease((clock.elapsedTime - start.current - 0.3) / 1.2);
    if (group.current) group.current.scale.set(1, Math.max(0.0001, reveal), 1);
  });

  return (
    <>
      <group ref={group} position={BEAM_FROM} quaternion={quat}>
        <mesh geometry={core}>
          <meshBasicMaterial color={[6, 6, 6]} toneMapped={false} />
        </mesh>
        <mesh geometry={halo}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.08} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <mesh geometry={inner.g} position={HIT} quaternion={inner.q}>
        <meshBasicMaterial color={[3, 3, 3]} toneMapped={false} transparent opacity={0.9} />
      </mesh>
    </>
  );
}

// ---- Spectrum fan (continuous) -------------------------------------------------
const fanVertex = /* glsl */ `
attribute float aT;
attribute float aR;
varying float vT;
varying float vR;
void main() {
  vT = aT;
  vR = aR;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fanFragment = /* glsl */ `
${SPECTRUM_GLSL}
uniform float uTime;
uniform float uReveal;
uniform float uActive;   // -1 none, -2 upcoming, >=0 lit band index
uniform int uCount;
uniform float uBandT[${MAX_BANDS}];
uniform float uBandLit[${MAX_BANDS}];
uniform float uLitIndex[${MAX_BANDS}];
varying float vT;
varying float vR;
void main() {
  vec3 col = spectrum(vT);
  float bands = 0.0;
  for (int i = 0; i < ${MAX_BANDS}; i++) {
    if (i >= uCount) break;
    float lit = uBandLit[i];
    float d = vT - uBandT[i];
    float w = mix(0.007, 0.016, lit);
    float k = exp(-(d * d) / (w * w));
    float flicker = 0.25 + 0.2 * sin(uTime * 2.3 + float(i) * 1.7);
    float strength = mix(flicker, 1.0, lit);
    float act = 1.0;
    if (uActive >= 0.0) act = (lit > 0.5 && abs(uLitIndex[i] - uActive) < 0.5) ? 1.9 : 0.3;
    if (uActive < -1.5) act = lit > 0.5 ? 0.35 : 2.6;
    bands += k * strength * act;
  }
  float falloff = pow(1.0 - vR, 1.4);
  float reveal = smoothstep(uReveal, uReveal - 0.12, vR);
  float edges = smoothstep(0.0, 0.05, vT) * smoothstep(1.0, 0.95, vT);
  float a = (0.3 * falloff + bands * mix(1.15, 0.45, vR)) * reveal * edges;
  gl_FragColor = vec4(col * a * 1.8, a);
}
`;

function Fan({ bands, focus }: { bands: SceneBand[]; focus: MutableRefObject<SceneFocus> }) {
  const start = useRef<number | null>(null);
  const reveal = useRef(0);
  const geometry = useMemo(() => {
    const SEG = 160;
    const R0 = 0.04;
    const pos: number[] = [];
    const aT: number[] = [];
    const aR: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      const a = bandAngle(t);
      pos.push(Math.cos(a) * R0, Math.sin(a) * R0, 0, Math.cos(a) * FAN_R, Math.sin(a) * FAN_R, 0);
      aT.push(t, t);
      aR.push(0, 1);
      if (i < SEG) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(aT, 1));
    g.setAttribute("aR", new THREE.Float32BufferAttribute(aR, 1));
    g.setIndex(idx);
    return g;
  }, []);

  const material = useMemo(() => {
    const bandT = new Array(MAX_BANDS).fill(0);
    const bandLit = new Array(MAX_BANDS).fill(0);
    const litIndex = new Array(MAX_BANDS).fill(-1);
    return new THREE.ShaderMaterial({
      vertexShader: fanVertex,
      fragmentShader: fanFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uActive: { value: -1 },
        uCount: { value: 0 },
        uBandT: { value: bandT },
        uBandLit: { value: bandLit },
        uLitIndex: { value: litIndex },
      },
    });
  }, []);

  useEffect(() => {
    const u = material.uniforms;
    let litCounter = 0;
    bands.slice(0, MAX_BANDS).forEach((b, i) => {
      u.uBandT.value[i] = b.t;
      u.uBandLit.value[i] = b.lit ? 1 : 0;
      u.uLitIndex.value[i] = b.lit ? litCounter++ : -1;
    });
    u.uCount.value = Math.min(bands.length, MAX_BANDS);
  }, [bands, material]);

  useFrame(({ clock }, dt) => {
    const u = material.uniforms;
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    const c = focus.current.chapter;
    // Intro: the spectrum spreads 1.4–3.2s; the closing chapter folds it back.
    const fanTarget = c === "end" ? 0 : 1.12;
    reveal.current =
      t < 3.2 && c !== "end"
        ? ease((t - 1.4) / 1.8) * 1.12
        : THREE.MathUtils.damp(reveal.current, fanTarget, c === "end" ? 1.4 : 2.2, dt);
    u.uTime.value = clock.elapsedTime;
    u.uReveal.value = reveal.current;
    const target = typeof c === "number" ? c : c === "more" ? -2 : -1;
    // Categorical (band index) — set directly; easing would sweep through
    // the other bands on the way.
    u.uActive.value = target;
  });

  return <mesh geometry={geometry} material={material} position={EXIT} />;
}

// ---- Director: intro timeline, camera, pointer ---------------------------------
function Director({ litBands, focus }: { litBands: SceneBand[]; focus: MutableRefObject<SceneFocus> }) {
  const pointer = useRef({ x: 0, y: 0 });
  const look = useRef(new THREE.Vector3(-1.4, -0.3, 0));

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // The camera comes from the frame state (R3F's sanctioned mutable handle).
  useFrame(({ camera, size }, dt) => {
    const portrait = size.width < size.height;
    const c = focus.current.chapter;

    // Camera framing per chapter.
    const pos = new THREE.Vector3();
    const tgt = new THREE.Vector3();
    if (typeof c === "number" && litBands[c]) {
      // Far enough along the band that the prism leaves the text column.
      const p = bandPoint(litBands[c].t, portrait ? 4.2 : 6.6);
      tgt.copy(p).add(new THREE.Vector3(portrait ? 0 : -1.6, portrait ? -1.2 : 0, 0));
      pos.copy(p).add(new THREE.Vector3(portrait ? -0.4 : -1.9, portrait ? 0.4 : 0.5, portrait ? 8.5 : 6.4));
    } else if (c === "more") {
      const p = bandPoint(0.5, 3.4);
      tgt.copy(p).add(new THREE.Vector3(portrait ? 0 : -2, 0, 0));
      pos.copy(tgt).add(new THREE.Vector3(0, 0.6, portrait ? 14 : 10));
    } else {
      // hero / end
      // Portrait: aim low so the prism sits in the top third, above the headline.
      tgt.set(portrait ? 0.6 : -1.6, portrait ? -2.4 : -0.4, 0);
      pos.set(portrait ? 0.4 : 0.2, portrait ? 0.6 : 0.4, portrait ? 15 : c === "end" ? 11.5 : 10);
    }
    pos.x += pointer.current.x * 0.45;
    pos.y += -pointer.current.y * 0.3;

    camera.position.x = THREE.MathUtils.damp(camera.position.x, pos.x, 2.2, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, pos.y, 2.2, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, pos.z, 2.2, dt);
    look.current.x = THREE.MathUtils.damp(look.current.x, tgt.x, 2.2, dt);
    look.current.y = THREE.MathUtils.damp(look.current.y, tgt.y, 2.2, dt);
    look.current.z = THREE.MathUtils.damp(look.current.z, tgt.z, 2.2, dt);
    camera.lookAt(look.current);
  });

  return null;
}

// ---- Quality governor --------------------------------------------------------------
/**
 * Measures real frame rate in 1s windows AFTER a warm-up (shader compile and
 * first uploads are always janky). Sustained < 45 fps → drop bloom. Still
 * < 28 fps without bloom → hand over to the Lite poster.
 */
function QualityGovernor({
  bloom,
  onDropBloom,
  onDegrade,
}: {
  bloom: boolean;
  onDropBloom: () => void;
  onDegrade: () => void;
}) {
  const s = useRef({ start: -1, windowStart: 0, frames: 0, slow: 0, last: 0, done: false });
  useFrame(({ clock }) => {
    const st = s.current;
    const now = clock.elapsedTime;
    if (st.done) return;
    if (st.start < 0) {
      st.start = now;
      st.windowStart = now + 4; // warm-up
      st.last = now;
      return;
    }
    const gap = now - st.last;
    st.last = now;
    // A long gap means the tab was hidden or throttled by the browser, not
    // that the device is slow — discard the window instead of judging it.
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
    const floor = bloom ? 45 : 28;
    st.slow = fps < floor ? st.slow + 1 : 0;
    if (st.slow >= (bloom ? 2 : 3)) {
      st.slow = 0;
      if (bloom) onDropBloom();
      else {
        st.done = true;
        onDegrade();
      }
    }
  });
  return null;
}

// ---- Canvas --------------------------------------------------------------------
export default function RefractionScene({
  bands,
  focus,
  onReady,
  onDegrade,
}: {
  bands: SceneBand[];
  focus: MutableRefObject<SceneFocus>;
  onReady: () => void;
  onDegrade: () => void;
}) {
  const litBands = useMemo(() => bands.filter((b) => b.lit), [bands]);
  // Adaptive quality: bloom is the costliest pass (measured: 32 → 60 fps on an
  // Intel UHD laptop at 1080p when removed). Drop it first if the device
  // struggles; only if it still can't keep up does the page fall back to Lite.
  const [bloom, setBloom] = useState(true);
  // Exposed for diagnostics (DevTools / perf checks).
  useEffect(() => {
    document.documentElement.dataset.sceneBloom = String(bloom);
  }, [bloom]);

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0.2, 0.4, 10], fov: 35, near: 0.1, far: 100 }}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      onCreated={() => requestAnimationFrame(onReady)}
    >
      <color attach="background" args={["#07070a"]} />
      <QualityGovernor bloom={bloom} onDropBloom={() => setBloom(false)} onDegrade={onDegrade} />

      <Environment resolution={128} frames={1}>
        <Lightformer form="rect" intensity={5} position={[0, 4, -6]} scale={[12, 2, 1]} />
        <Lightformer form="rect" intensity={3} position={[-6, 0, 2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={2.5} position={[6, -1, 3]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="ring" intensity={3} position={[3, 4, 4]} scale={2} />
      </Environment>

      <Sparkles count={140} scale={[22, 12, 8]} size={1.6} speed={0.25} opacity={0.35} color="#f3f1ec" />

      <Beam />
      <Fan bands={bands} focus={focus} />
      <Prism />

      <Director litBands={litBands} focus={focus} />

      {bloom ? (
        <EffectComposer multisampling={0}>
          <Bloom mipmapBlur resolutionScale={0.5} levels={6} intensity={0.85} luminanceThreshold={0.18} luminanceSmoothing={0.35} />
        </EffectComposer>
      ) : null}
    </Canvas>
  );
}
