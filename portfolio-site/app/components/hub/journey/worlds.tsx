"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: GPU objects (materials, uniforms, the
   camera, the shared clock ref) are mutated every frame inside useFrame, never during render. */

/**
 * Each live persona's stream ends in a WORLD on the horizon — a pillar of its
 * colour plus a motif that says what's inside. Round 1 teasers; each grows
 * into the full world-entry scene later.
 *   engineer      a lattice of nodes and links slowly assembling
 *   trader        a skyline of candles breathing up and down
 *   photographer  an aperture opening, frames orbiting it
 *   (others)      a halo ring
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { spectrumHue } from "@/lib/site/spectrum";
import { useJourney } from "./clock";
import { seeded, worldPosition } from "./geometry";
import type { Band } from "./state";

const pillarVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const pillarFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uGlow;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  float core = pow(abs(dot(normalize(vN), V)), 4.0);
  float rise = pow(1.0 - vUv.y, 1.6);
  float flow = 0.75 + 0.25 * sin(vUv.y * 40.0 - uTime * 3.0);
  float a = core * rise * flow * uGlow;
  // Colour only (no white-out): a tinted column, brightest at the ground.
  gl_FragColor = vec4(uColor * a * 0.8, a);
}
`;

function useWorldMaterials(color: THREE.Color) {
  return useMemo(() => {
    const line = new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(0.85), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const solid = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.75), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const pillar = new THREE.ShaderMaterial({
      vertexShader: pillarVertex,
      fragmentShader: pillarFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: color.clone() }, uGlow: { value: 0.4 }, uTime: { value: 0 } },
    });
    return { line, solid, pillar };
  }, [color]);
}

function Lattice({ mats }: { mats: ReturnType<typeof useWorldMaterials> }) {
  const ref = useRef<THREE.Group>(null);
  const { clock } = useJourney();
  const { lines, nodes } = useMemo(() => {
    const N = 4;
    const S = 1.5;
    const rnd = seeded(3);
    const pts: THREE.Vector3[] = [];
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) for (let z = 0; z < N; z++) {
      pts.push(new THREE.Vector3((x - 1.5) * S, (y - 1.5) * S, (z - 1.5) * S));
    }
    const seg: number[] = [];
    pts.forEach((a, i) =>
      pts.forEach((b, j) => {
        if (j > i && a.distanceTo(b) <= S + 0.01 && rnd() < 0.55) seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }),
    );
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    const ng = new THREE.BufferGeometry().setFromPoints(pts);
    return { lines: lg, nodes: ng };
  }, []);
  useFrame(() => {
    if (!ref.current) return;
    const t = clock.current.t;
    ref.current.rotation.y = t * 0.12;
    ref.current.rotation.x = Math.sin(t * 0.2) * 0.25;
  });
  return (
    <group ref={ref} position={[0, 4.2, 0]}>
      <lineSegments geometry={lines} material={mats.line} />
      <points geometry={nodes}>
        <pointsMaterial color={mats.line.color} size={0.22} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </points>
    </group>
  );
}

function Candles({ mats }: { mats: ReturnType<typeof useWorldMaterials> }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const { clock } = useJourney();
  const N = 22;
  const box = useMemo(() => new THREE.BoxGeometry(0.2, 1, 0.2), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const phase = useMemo(() => {
    const rnd = seeded(5);
    return Array.from({ length: N }, () => rnd() * 6.28);
  }, []);
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = clock.current.t;
    for (let i = 0; i < N; i++) {
      const x = (i - (N - 1) / 2) * 0.42;
      // A gently trending market: drift + noise.
      const trend = 2.6 + Math.sin(i * 0.35 + t * 0.15) * 1.1;
      const h = 0.25 + Math.abs(Math.sin(t * 0.6 + phase[i])) * 1.1;
      dummy.position.set(x, trend + h / 2, Math.cos(i * 0.4) * 0.6);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[box, mats.solid, N]} frustumCulled={false} />;
}

function Aperture({ mats }: { mats: ReturnType<typeof useWorldMaterials> }) {
  const blades = useRef<THREE.Group>(null);
  const frames = useRef<THREE.Group>(null);
  const { clock } = useJourney();
  const BLADES = 8;
  const blade = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(2.4, 0.2);
    s.quadraticCurveTo(2.6, 1.4, 1.2, 1.9);
    s.closePath();
    return new THREE.EdgesGeometry(new THREE.ShapeGeometry(s));
  }, []);
  const frame = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.5, 1.0)), []);
  useFrame(() => {
    const t = clock.current.t;
    const open = 0.5 + 0.5 * Math.sin(t * 0.4);
    blades.current?.children.forEach((b, i) => {
      b.rotation.z = (i / BLADES) * Math.PI * 2 + t * 0.08;
      b.children[0].position.x = 0.4 + open * 1.1;
      b.children[0].rotation.z = 0.6 - open * 0.5;
    });
    if (frames.current) frames.current.rotation.y = t * 0.15;
  });
  return (
    <group position={[0, 4.2, 0]} scale={0.72}>
      <group ref={blades}>
        {Array.from({ length: BLADES }, (_, i) => (
          <group key={i}>
            <lineSegments geometry={blade} material={mats.line} />
          </group>
        ))}
      </group>
      <group ref={frames}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2;
          return <lineSegments key={i} geometry={frame} material={mats.line} position={[Math.cos(a) * 4.2, Math.sin(i * 1.3) * 0.8, Math.sin(a) * 4.2]} rotation={[0, -a + Math.PI / 2, 0]} />;
        })}
      </group>
    </group>
  );
}

function Halo({ mats }: { mats: ReturnType<typeof useWorldMaterials> }) {
  const ref = useRef<THREE.Mesh>(null);
  const { clock } = useJourney();
  useFrame(() => {
    if (ref.current) ref.current.rotation.z = clock.current.t * 0.2;
  });
  return (
    <mesh ref={ref} position={[0, 4.2, 0]} material={mats.solid}>
      <torusGeometry args={[2.2, 0.03, 8, 96]} />
    </mesh>
  );
}

function World({ band, index }: { band: Band; index: number }) {
  const { clock } = useJourney();
  const group = useRef<THREE.Group>(null);
  // THREE.Color can't parse CSS `hsl(h s% l%)` (it falls back to white) — build it directly.
  const color = useMemo(() => new THREE.Color().setHSL(spectrumHue(band.t) / 360, 0.9, 0.62), [band.t]);
  const mats = useWorldMaterials(color);
  const position = useMemo(() => worldPosition(band.t), [band.t]);
  const pillar = useMemo(() => new THREE.CylinderGeometry(0.5, 0.5, 34, 20, 1, true).translate(0, 17, 0), []);

  useFrame(() => {
    const k = clock.current;
    const act = k.act[index] ?? 0;
    // Worlds wait on the horizon until you are out over the river.
    const visible = k.reveal * (1 - k.fold) * THREE.MathUtils.smoothstep(k.c, 0.9, 1.8);
    mats.pillar.uniforms.uTime.value = k.t;
    // Only the world you're travelling toward is bright; the rest wait, dim.
    const focus = 0.12 + 0.88 * act;
    mats.pillar.uniforms.uGlow.value = (0.06 + act * 0.3) * visible;
    mats.line.opacity = 0.75 * focus * visible;
    mats.solid.opacity = 0.7 * focus * visible;
    if (group.current) {
      group.current.visible = visible > 0.01;
      const s = 0.85 + act * 0.25;
      group.current.scale.setScalar(s);
    }
  });

  const motif =
    band.slug === "engineer" ? <Lattice mats={mats} /> : band.slug === "trader" ? <Candles mats={mats} /> : band.slug === "photographer" ? <Aperture mats={mats} /> : <Halo mats={mats} />;

  return (
    <group ref={group} position={position} rotation={[0, Math.atan2(position.x, position.z), 0]}>
      <mesh geometry={pillar} material={mats.pillar} />
      {motif}
    </group>
  );
}

/** `bands` in spectrum order; `act` indexes follow that order. */
export function Worlds({ bands }: { bands: Band[] }) {
  return (
    <>
      {bands.map((b, i) => (b.lit ? <World key={b.slug} band={b} index={i} /> : null))}
    </>
  );
}
