"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: uniforms and transforms are mutated
   every frame inside useFrame, never during render. */

/**
 * Company in the sky (Ratul's ask): far, quiet, never competing with the light.
 *  - ShootingStars: brief streaks across the dome, now and then.
 *  - Planets: two distant worlds, one ringed, lit from the light's side.
 *  - Satellite: a small craft drifting on a slow arc, with a blinking lamp.
 *  - Rocket: a tiny silhouette crossing far away with a glowing exhaust.
 * Everything is built in code (no models, no downloads) and scaled by the
 * sky's visibility, so it is only ever a backdrop.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useVr } from "./clock";
import { WORLD, seeded } from "./util";

const SKY_R = 340;

// ---------------------------------------------------------------------------
// Shooting stars
// ---------------------------------------------------------------------------
const streakVertex = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aDir;
attribute float aSeed;
uniform float uTime;
uniform float uSky;
varying float vAlong;
varying float vAcross;
varying float vLife;
void main() {
  float period = 9.0 + aSeed * 14.0;
  float life = fract(uTime / period + aSeed * 7.0);
  float alive = step(life, 0.14);             // alive for the first 14 % of its period
  float t = life / 0.14;
  float len = 14.0 + aSeed * 10.0;
  vec3 head = aStart + aDir * t * 90.0;
  vec3 p = head - aDir * position.y * len;      // position.y 0…1 = head → tail
  vec3 toCam = normalize(cameraPosition - p);
  vec3 side = normalize(cross(aDir, toCam));
  p += side * position.x * 0.5;
  vAlong = position.y;
  vAcross = position.x * 2.0;
  vLife = alive * sin(t * 3.1416) * uSky;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const streakFragment = /* glsl */ `
varying float vAlong;
varying float vAcross;
varying float vLife;
void main() {
  float a = pow(1.0 - abs(vAcross), 2.0) * (1.0 - vAlong) * (1.0 - vAlong) * vLife;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * a * 1.6, a);
}
`;

export function ShootingStars({ count = 7 }: { count?: number }) {
  const { clock } = useVr();
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(77);
    const base = new THREE.PlaneGeometry(1, 1, 1, 8).translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.getAttribute("position"));
    const start = new Float32Array(count * 3);
    const dir = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Upper sky only, heading down and sideways.
      const a = rnd() * Math.PI * 2;
      const el = 0.25 + rnd() * 0.6;
      const s = new THREE.Vector3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)).multiplyScalar(SKY_R * 0.92);
      const d = new THREE.Vector3(Math.cos(a + 1.3 + rnd()), -0.5 - rnd() * 0.4, Math.sin(a + 1.3 + rnd())).normalize();
      start.set([s.x, s.y, s.z], i * 3);
      dir.set([d.x, d.y, d.z], i * 3);
      seed[i] = rnd();
    }
    g.setAttribute("aStart", new THREE.InstancedBufferAttribute(start, 3));
    g.setAttribute("aDir", new THREE.InstancedBufferAttribute(dir, 3));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    g.instanceCount = count;
    const m = new THREE.ShaderMaterial({
      vertexShader: streakVertex,
      fragmentShader: streakFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uSky: { value: 0 } },
    });
    return { geometry: g, material: m };
  }, [count]);
  useFrame(() => {
    material.uniforms.uTime.value = clock.current.t;
    material.uniforms.uSky.value = clock.current.sky;
  });
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-8} />;
}

// ---------------------------------------------------------------------------
// Planets
// ---------------------------------------------------------------------------
const planetVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const planetFragment = /* glsl */ `
uniform vec3 uLightDir;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uBands;
uniform float uSky;
uniform float uTime;
varying vec3 vN;
varying vec3 vP;
void main() {
  vec3 n = normalize(vN);
  float lit = max(dot(n, uLightDir), 0.0);
  float terminator = smoothstep(0.0, 0.25, lit);
  float lat = normalize(vP).y;
  float band = 0.5 + 0.5 * sin(lat * uBands * 6.2832 + sin(lat * 7.0 + uTime * 0.02) * 0.6);
  vec3 col = mix(uColorA, uColorB, band);
  float limb = pow(max(dot(n, normalize(cameraPosition)), 0.0), 0.6);
  vec3 c = col * (0.03 + terminator * 0.9) * limb;
  // Faint night side so the disc still reads against the void.
  c += uColorA * 0.012;
  gl_FragColor = vec4(c * uSky, 1.0);
}
`;

function Planet({
  position,
  radius,
  a,
  b,
  bands,
  ring,
  spin,
}: {
  position: [number, number, number];
  radius: number;
  a: string;
  b: string;
  bands: number;
  ring?: boolean;
  spin: number;
}) {
  const { clock } = useVr();
  const group = useRef<THREE.Group>(null);
  const material = useMemo(() => {
    const lightDir = WORLD.lightFrom.clone().sub(new THREE.Vector3(...position)).normalize();
    return new THREE.ShaderMaterial({
      vertexShader: planetVertex,
      fragmentShader: planetFragment,
      uniforms: {
        uLightDir: { value: lightDir },
        uColorA: { value: new THREE.Color(a) },
        uColorB: { value: new THREE.Color(b) },
        uBands: { value: bands },
        uSky: { value: 0 },
        uTime: { value: 0 },
      },
    });
  }, [position, a, b, bands]);
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(a).multiplyScalar(0.22),
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [a],
  );
  const geo = useMemo(
    () => ({ sphere: new THREE.SphereGeometry(radius, 48, 32), ring: new THREE.RingGeometry(radius * 1.45, radius * 2.3, 96, 1) }),
    [radius],
  );
  useFrame(() => {
    const k = clock.current;
    material.uniforms.uSky.value = k.sky;
    material.uniforms.uTime.value = k.t;
    ringMat.opacity = 0.55 * k.sky;
    if (group.current) group.current.rotation.y = k.t * spin;
  });
  return (
    <group position={position} rotation={[0.35, 0, -0.3]}>
      <group ref={group}>
        <mesh geometry={geo.sphere} material={material} renderOrder={-7} />
      </group>
      {ring ? <mesh geometry={geo.ring} material={ringMat} rotation-x={Math.PI / 2 + 0.2} renderOrder={-6} /> : null}
    </group>
  );
}

export function Planets() {
  return (
    <>
      <Planet position={[-110, 62, -270]} radius={15} a="#6b4a3a" b="#b08a64" bands={5} ring spin={0.015} />
      <Planet position={[135, 28, -250]} radius={6.5} a="#2b3550" b="#5b6a8a" bands={3} spin={0.03} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Satellite: a small craft on a slow arc, lamp blinking
// ---------------------------------------------------------------------------
export function Satellite() {
  const { clock } = useVr();
  const group = useRef<THREE.Group>(null);
  const lamp = useRef<THREE.Mesh>(null);
  const mats = useMemo(
    () => ({
      body: new THREE.MeshStandardMaterial({ color: "#2a2a33", roughness: 0.5, metalness: 0.7 }),
      panel: new THREE.MeshStandardMaterial({ color: "#1a2a4a", roughness: 0.3, metalness: 0.6, emissive: new THREE.Color("#0b1a3a"), emissiveIntensity: 0.4 }),
      lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.6, 0.5), toneMapped: false }),
    }),
    [],
  );
  useFrame(() => {
    const k = clock.current;
    const g = group.current;
    if (!g) return;
    const t = k.t * 0.012;
    const r = 150;
    g.position.set(Math.cos(t) * r, 40 + Math.sin(t * 0.7) * 25, Math.sin(t) * r - 60);
    g.rotation.set(t * 0.3, t * 0.8, 0.4);
    g.visible = k.sky > 0.05;
    const blink = Math.sin(k.t * 2.4) > 0.85 ? 1 : 0.05;
    if (lamp.current) lamp.current.scale.setScalar(0.6 + blink * 0.6);
    mats.lamp.color.setRGB(3 * blink, 0.6 * blink, 0.5 * blink);
  });
  return (
    <group ref={group}>
      <mesh material={mats.body}>
        <boxGeometry args={[1.6, 1.6, 2.4]} />
      </mesh>
      <mesh material={mats.body} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 1.6, 8]} />
      </mesh>
      <mesh material={mats.body} position={[0, 2.5, 0]} rotation-x={Math.PI}>
        <coneGeometry args={[0.9, 0.5, 16, 1, true]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mats.panel} position={[s * 4.2, 0, 0]}>
          <boxGeometry args={[6, 0.06, 1.8]} />
        </mesh>
      ))}
      <mesh ref={lamp} material={mats.lamp} position={[0, -1, 1.2]}>
        <sphereGeometry args={[0.18, 8, 8]} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rocket: a tiny silhouette crossing far away, exhaust glowing
// ---------------------------------------------------------------------------
export function Rocket() {
  const { clock } = useVr();
  const group = useRef<THREE.Group>(null);
  const flame = useRef<THREE.Mesh>(null);
  const mats = useMemo(
    () => ({
      hull: new THREE.MeshStandardMaterial({ color: "#d9d4cc", roughness: 0.4, metalness: 0.2 }),
      fin: new THREE.MeshStandardMaterial({ color: "#8a2f2a", roughness: 0.6 }),
      flame: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.6, 0.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    }),
    [],
  );
  const path = useMemo(
    () => new THREE.CatmullRomCurve3([new THREE.Vector3(-260, -40, -200), new THREE.Vector3(-80, 60, -260), new THREE.Vector3(120, 140, -230), new THREE.Vector3(260, 210, -160)]),
    [],
  );
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), d: new THREE.Vector3() }), []);
  useFrame(() => {
    const k = clock.current;
    const g = group.current;
    if (!g) return;
    const period = 46;
    const u = (k.t % period) / period;
    const flying = u < 0.5; // crosses for 23 s, rests for 23 s
    g.visible = flying && k.sky > 0.05;
    if (!flying) return;
    path.getPoint(u * 2, tmp.p);
    path.getTangent(u * 2, tmp.d);
    g.position.copy(tmp.p);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp.d);
    if (flame.current) flame.current.scale.set(1, 1.4 + Math.sin(k.t * 31) * 0.3 + Math.sin(k.t * 17) * 0.2, 1);
  });
  return (
    <group ref={group}>
      <mesh material={mats.hull}>
        <cylinderGeometry args={[0.7, 0.9, 5, 16]} />
      </mesh>
      <mesh material={mats.hull} position={[0, 3.4, 0]}>
        <coneGeometry args={[0.7, 1.8, 16]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={mats.fin} position={[Math.cos((i / 3) * Math.PI * 2) * 0.9, -2, Math.sin((i / 3) * Math.PI * 2) * 0.9]} rotation-y={-(i / 3) * Math.PI * 2}>
          <boxGeometry args={[1.2, 1.6, 0.08]} />
        </mesh>
      ))}
      <mesh ref={flame} material={mats.flame} position={[0, -4.2, 0]} rotation-x={Math.PI}>
        <coneGeometry args={[0.6, 3.4, 12, 1, true]} />
      </mesh>
    </group>
  );
}

export function Space() {
  return (
    <>
      <ShootingStars />
      <Planets />
      <Satellite />
      <Rocket />
    </>
  );
}
