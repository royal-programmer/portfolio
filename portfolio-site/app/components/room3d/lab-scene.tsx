"use client";

/**
 * P0 look-dev spike for the 3D room (18-3d-room-plan.md): one desk corner, built only from what the plan allows —
 * drei Environment + Lightformers (no HDRI file), accumulated / contact shadows, emissive above 1, SMAA + bloom on
 * desktop and none on the phone tier, procedural canvas textures, rounded boxes, a time-of-day tint from the
 * stage's clock bands. Lives on /stage-lab (development only); nothing else imports it.
 */
import { Canvas, useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import { AccumulativeShadows, ContactShadows, Environment, Lightformer, RandomizedLight, RoundedBox } from "@react-three/drei";
import { Bloom, EffectComposer, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { lightingFor } from "@/lib/site/stage-data";
import { fabricTexture, noiseNormal, screenTexture, woodTexture } from "./textures";

type TierId = "low" | "medium" | "high";
type Tier = { dpr: number; fx: boolean; bloom: boolean; accum: number; accumRes: number; shadowMap: number; tex: number; env: number };
const TIERS: Record<TierId, Tier> = {
  low: { dpr: 1.5, fx: false, bloom: false, accum: 0, accumRes: 0, shadowMap: 0, tex: 256, env: 128 },
  medium: { dpr: 1.5, fx: true, bloom: false, accum: 40, accumRes: 512, shadowMap: 1024, tex: 512, env: 256 },
  high: { dpr: 2, fx: true, bloom: true, accum: 70, accumRes: 1024, shadowMap: 2048, tex: 512, env: 256 },
};
type Band = ReturnType<typeof lightingFor>;

const DEBUG = typeof window === "undefined" ? { shaft: false, noSunShadow: false } : { shaft: /shaft=1/.test(window.location.search), noSunShadow: /nosunshadow/.test(window.location.search) };
const neon = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);

/** Sets cast / receive shadow on every mesh below, once. */
function Shadowed({ children, cast = true, receive = true, ...rest }: { children: ReactNode; cast?: boolean; receive?: boolean } & ThreeElements["group"]) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.noShadow) {
        m.castShadow = cast;
        m.receiveShadow = receive;
      }
    });
  }, [cast, receive]);
  return (
    <group ref={ref} {...rest}>
      {children}
    </group>
  );
}

/** A soft additive halo: the phone tier's stand-in for bloom, and a little extra on desktop. */
function Glow({ position, size, color, opacity = 0.5 }: { position: [number, number, number]; size: [number, number]; color: string; opacity?: number }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.35, "rgba(255,255,255,0.35)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <mesh position={position} userData={{ noShadow: true }} renderOrder={5}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={tex} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Window({ band, tier }: { band: Band; tier: Tier }) {
  const lit = band.windowLight.intensity > 0;
  const sky = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 128;
    const g = c.getContext("2d")!;
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, lit ? band.windowLight.color : "#0a1020");
    gr.addColorStop(1, lit ? "#ffffff" : "#16203a");
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [band, lit]);
  useEffect(() => () => sky.dispose(), [sky]);
  const shaft = useMemo(() => {
    // Window corners to the floor, along the sun's direction; fades with distance (additive vertex colours).
    const x0 = 0.95;
    const x1 = 1.75;
    const y0 = 0.9;
    const y1 = 2.0;
    const z = -1.17;
    const down = new THREE.Vector3(-0.517, -1, 1.448);
    const w = [new THREE.Vector3(x0, y0, z), new THREE.Vector3(x1, y0, z), new THREE.Vector3(x1, y1, z), new THREE.Vector3(x0, y1, z)];
    const f = w.map((p) => p.clone().addScaledVector(down, p.y));
    const pos: number[] = [];
    const col: number[] = [];
    const k = Math.min(1, band.windowLight.intensity) * 0.015;
    const c0 = new THREE.Color(band.windowLight.color).multiplyScalar(k);
    const black = new THREE.Color(0, 0, 0);
    const quad = (a: number, b: number) => {
      const tri: Array<[THREE.Vector3, THREE.Color]> = [
        [w[a], c0],
        [w[b], c0],
        [f[b], black],
        [w[a], c0],
        [f[b], black],
        [f[a], black],
      ];
      for (const [p, c] of tri) {
        pos.push(p.x, p.y, p.z);
        col.push(c.r, c.g, c.b);
      }
    };
    quad(0, 1);
    quad(1, 2);
    quad(2, 3);
    quad(3, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    return g;
  }, [band]);
  useEffect(() => () => shaft.dispose(), [shaft]);
  const parts: Array<[number, number, number, number]> = [
    [0, 0.575, 0.8, 0.05],
    [0, -0.575, 0.8, 0.05],
    [-0.425, 0, 0.05, 1.2],
    [0.425, 0, 0.05, 1.2],
    [0, 0, 0.03, 1.1],
    [0, 0.1, 0.8, 0.03],
  ];
  return (
    <group position={[1.35, 1.45, -1.19]}>
      <mesh userData={{ noShadow: true }}>
        <planeGeometry args={[0.8, 1.1]} />
        <meshBasicMaterial map={sky} toneMapped={false} color={neon("#ffffff", lit ? 1.25 : 0.5)} />
      </mesh>
      {parts.map(([x, y, w, h], i) => (
        <RoundedBox key={i} args={[w, h, 0.07]} radius={0.01} smoothness={2} position={[x, y, 0.035]} castShadow={tier.shadowMap > 0}>
          <meshStandardMaterial color="#d9d4cc" roughness={0.6} />
        </RoundedBox>
      ))}
      {band.windowLight.intensity > 0.2 && DEBUG.shaft ? (
        <mesh geometry={shaft} position={[-1.35, -1.45, 1.19]} userData={{ noShadow: true }} renderOrder={4}>
          <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function CurvedMonitor({ accent, glow, y, tilt = 0, W = 0.78, H = 0.33 }: { accent: string; glow: number; y: number; tilt?: number; W?: number; H?: number }) {
  const R = 1.2;
  const th = W / R;
  const tex = useMemo(() => {
    const t = screenTexture(512, 256, accent);
    t.repeat.x = -1;
    t.offset.x = 1;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }, [accent]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={[0, y, -1.0]} rotation={[tilt, 0, 0]}>
      <group position={[0, 0, R]}>
        <mesh userData={{ noShadow: true }}>
          <cylinderGeometry args={[R, R, H, 48, 1, true, Math.PI - th / 2, th]} />
          <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} color={neon("#ffffff", 1.1 * glow)} />
        </mesh>
        <mesh castShadow>
          <cylinderGeometry args={[R + 0.004, R + 0.004, H + 0.03, 48, 1, true, Math.PI - th / 2 - 0.012, th + 0.024]} />
          <meshStandardMaterial color="#0d0e12" roughness={0.4} metalness={0.5} side={THREE.BackSide} />
        </mesh>
        <mesh castShadow>
          <cylinderGeometry args={[R + 0.035, R + 0.035, H + 0.03, 48, 1, true, Math.PI - th / 2 - 0.012, th + 0.024]} />
          <meshStandardMaterial color="#17181d" roughness={0.45} metalness={0.4} />
        </mesh>
      </group>
    </group>
  );
}

/** A flat screen on a stand: a portrait monitor, a tablet or a phone (width, height, thickness in metres), tilted back. */
function FlatScreen({ position, rotation, size, accent, glow, seed }: { position: [number, number, number]; rotation: [number, number, number]; size: [number, number, number]; accent: string; glow: number; seed: number }) {
  const tex = useMemo(() => {
    const portrait = size[1] > size[0];
    const t = screenTexture(portrait ? 256 : 384, portrait ? 384 : 256, accent);
    t.offset.x = (seed % 7) / 7;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  }, [accent, seed, size]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={size} radius={Math.min(0.012, size[2] * 0.8)} smoothness={3} castShadow>
        <meshStandardMaterial color="#0d0e12" roughness={0.4} metalness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0, size[2] / 2 + 0.0008]} userData={{ noShadow: true }}>
        <planeGeometry args={[size[0] - 0.02, size[1] - 0.02]} />
        <meshBasicMaterial map={tex} toneMapped={false} color={neon("#ffffff", 1.05 * glow)} />
      </mesh>
    </group>
  );
}

function Keyboard({ accent }: { accent: string }) {
  const keys = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = keys.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    let i = 0;
    for (let r = 0; r < 5; r++) {
      for (let col = 0; col < 14; col++) {
        o.position.set(-0.19 + col * 0.0295, 0.011, -0.05 + r * 0.0295);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        c.set(col === 13 || r === 0 ? accent : "#1b1d26");
        m.setColorAt(i++, c);
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [accent]);
  return (
    <group position={[0, 0.77, -0.62]} rotation={[0, 0.05, 0]}>
      <RoundedBox args={[0.46, 0.018, 0.17]} radius={0.007} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#11131a" roughness={0.5} metalness={0.3} />
      </RoundedBox>
      <instancedMesh ref={keys} args={[undefined, undefined, 70]} castShadow>
        <boxGeometry args={[0.026, 0.012, 0.026]} />
        <meshStandardMaterial roughness={0.55} />
      </instancedMesh>
      <mesh position={[0, -0.011, 0]} userData={{ noShadow: true }}>
        <boxGeometry args={[0.47, 0.004, 0.18]} />
        <meshBasicMaterial color={neon(accent, 3)} toneMapped={false} />
      </mesh>
    </group>
  );
}

function Lamp({ on }: { on: boolean }) {
  return (
    <group position={[0.93, 0.77, -1.0]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.07, 0.08, 0.02, 24]} />
        <meshStandardMaterial color="#222530" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[0, 0.17, 0]} rotation={[0, 0, 0.18]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.34, 8]} />
        <meshStandardMaterial color="#222530" roughness={0.35} metalness={0.7} />
      </mesh>
      <mesh position={[-0.04, 0.33, 0]} rotation={[0, 0, -1.0]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.26, 8]} />
        <meshStandardMaterial color="#222530" roughness={0.35} metalness={0.7} />
      </mesh>
      <group position={[-0.17, 0.4, 0]} rotation={[0, 0, 0.5]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.03, 0.09, 0.12, 24, 1, true]} />
          <meshStandardMaterial color="#e7a64a" roughness={0.4} metalness={0.5} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.03, 0]} userData={{ noShadow: true }}>
          <sphereGeometry args={[0.028, 16, 12]} />
          <meshBasicMaterial color={on ? neon("#ffd9a0", 4) : "#5a5448"} toneMapped={false} />
        </mesh>
        {on ? <pointLight position={[0, -0.12, 0]} color="#ffbf70" intensity={2.2} distance={3.5} decay={2} /> : null}
      </group>
      {on ? <Glow position={[-0.17, 0.36, 0.02]} size={[0.55, 0.55]} color="#ffb060" opacity={0.35} /> : null}
    </group>
  );
}

function Plant() {
  const leaves = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = leaves.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < 26; i++) {
      const a = i * 2.399;
      const lift = 0.15 + (i % 7) * 0.075;
      const rad = 0.04 + lift * 0.45;
      o.position.set(Math.cos(a) * rad, 0.3 + lift, Math.sin(a) * rad);
      o.rotation.set(0.5 + (i % 3) * 0.15, -a, 0.2);
      o.scale.set(0.06 + (i % 4) * 0.01, 0.008, 0.15 + (i % 5) * 0.02);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      c.setHSL(0.3 + (i % 5) * 0.012, 0.5, 0.2 + (i % 4) * 0.035);
      m.setColorAt(i, c);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  return (
    <group position={[1.65, 0, -0.85]}>
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.17, 0.12, 0.34, 24]} />
        <meshStandardMaterial color="#d9cfc4" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.335, 0]}>
        <cylinderGeometry args={[0.155, 0.155, 0.02, 24]} />
        <meshStandardMaterial color="#2a1d14" roughness={1} />
      </mesh>
      {[0.0, 0.5, -0.4, 1.0, -0.9].map((r, i) => (
        <mesh key={i} position={[Math.sin(r) * 0.03, 0.55, Math.cos(r) * 0.03]} rotation={[Math.cos(r) * 0.2, 0, -Math.sin(r) * 0.2]} castShadow>
          <cylinderGeometry args={[0.004, 0.006, 0.45, 5]} />
          <meshStandardMaterial color="#2c4a2a" roughness={0.8} />
        </mesh>
      ))}
      <instancedMesh ref={leaves} args={[undefined, undefined, 26]} castShadow>
        <sphereGeometry args={[1, 12, 8]} />
        <meshStandardMaterial roughness={0.6} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}

function Shelf() {
  const books = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = books.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    const hues = [0.58, 0.0, 0.12, 0.75, 0.35, 0.05, 0.62, 0.9, 0.16];
    let x = -0.38;
    for (let i = 0; i < 9; i++) {
      const w = 0.025 + (i % 3) * 0.008;
      const h = 0.17 + ((i * 7) % 5) * 0.018;
      o.position.set(x + w / 2, 0.0175 + h / 2, 0);
      o.rotation.set(0, 0, i === 8 ? -0.12 : 0);
      o.scale.set(w, h, 0.15);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      c.setHSL(hues[i], 0.45, 0.32);
      m.setColorAt(i, c);
      x += w + 0.003;
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);
  return (
    <group position={[-1.0, 1.5, -1.08]}>
      <RoundedBox args={[1.0, 0.035, 0.24]} radius={0.01} smoothness={3} castShadow receiveShadow>
        <meshStandardMaterial color="#4a3422" roughness={0.55} />
      </RoundedBox>
      <instancedMesh ref={books} args={[undefined, undefined, 9]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.7} />
      </instancedMesh>
      <mesh position={[0.25, 0.06, 0.02]} castShadow>
        <cylinderGeometry args={[0.04, 0.035, 0.085, 20]} />
        <meshStandardMaterial color="#e8e1d6" roughness={0.35} />
      </mesh>
      <mesh position={[0.38, 0.05, 0.0]} castShadow>
        <cylinderGeometry args={[0.04, 0.03, 0.065, 16]} />
        <meshStandardMaterial color="#c8663f" roughness={0.8} />
      </mesh>
      <mesh position={[0.38, 0.11, 0.0]} castShadow>
        <icosahedronGeometry args={[0.05, 1]} />
        <meshStandardMaterial color="#35623a" roughness={0.7} flatShading />
      </mesh>
      <RoundedBox args={[0.2, 0.26, 0.015]} radius={0.004} smoothness={2} position={[0.1, 0.16, -0.09]} rotation={[-0.08, 0, 0]} castShadow>
        <meshStandardMaterial color="#1c1e26" roughness={0.5} />
      </RoundedBox>
      <mesh position={[0.1, 0.16, -0.081]} rotation={[-0.08, 0, 0]}>
        <planeGeometry args={[0.17, 0.23]} />
        <meshBasicMaterial color="#6f8cff" />
      </mesh>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, -0.06, -0.04]} castShadow>
          <boxGeometry args={[0.015, 0.09, 0.15]} />
          <meshStandardMaterial color="#14151a" roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Chair({ fabric }: { fabric: THREE.Texture }) {
  return (
    <group position={[-0.15, 0, -0.1]} rotation={[0, 0.35, 0]}>
      <RoundedBox args={[0.5, 0.09, 0.48]} radius={0.04} smoothness={4} position={[0, 0.5, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={fabric} color="#cfd6f2" roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[0.46, 0.55, 0.08]} radius={0.04} smoothness={4} position={[0, 0.85, 0.24]} rotation={[-0.12, 0, 0]} castShadow receiveShadow>
        <meshStandardMaterial map={fabric} color="#cfd6f2" roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, 0.3, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.03, 0.4, 12]} />
        <meshStandardMaterial color="#15161b" roughness={0.4} metalness={0.7} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 5, 0]}>
          <mesh position={[0.15, 0.07, 0]} castShadow>
            <boxGeometry args={[0.3, 0.025, 0.04]} />
            <meshStandardMaterial color="#15161b" roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh position={[0.29, 0.035, 0]} castShadow>
            <sphereGeometry args={[0.035, 12, 8]} />
            <meshStandardMaterial color="#0b0b0e" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Frame({ position, rotation, size, color }: { position: [number, number, number]; rotation?: [number, number, number]; size: [number, number]; color: string }) {
  return (
    <group position={position} rotation={rotation}>
      <RoundedBox args={[size[0], size[1], 0.03]} radius={0.006} smoothness={2} castShadow>
        <meshStandardMaterial color="#101116" roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0, 0.017]}>
        <planeGeometry args={[size[0] - 0.05, size[1] - 0.05]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

/** The directional light's target must be in the scene graph for its position to count. */
function DirTarget() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.traverse((o) => {
      const l = o as THREE.DirectionalLight;
      if (l.isDirectionalLight) {
        l.target.position.set(0.6, 0, 0.9);
        l.target.updateMatrixWorld();
      }
    });
  }, [scene]);
  return null;
}

function LabRoom({ band, tier, tierId, accent }: { band: Band; tier: Tier; tierId: TierId; accent: string }) {
  const tex = useMemo(
    () => ({
      floor: woodTexture(tier.tex, "#7b5636", [2.4, 2.4]),
      desk: woodTexture(tier.tex, "#a77a4d", [1, 1]),
      wall: noiseNormal(tier.tex, 0.9, [1.5, 1]),
      fabric: fabricTexture(tier.tex, "#46507a", [1, 1]),
      rug: fabricTexture(tier.tex, "#5b3b52", [3, 3]),
    }),
    [tier.tex],
  );
  useEffect(() => () => Object.values(tex).forEach((t) => t.dispose()), [tex]);
  const sunOn = band.windowLight.intensity > 0.1;
  const wallNormal = useMemo(() => new THREE.Vector2(0.12, 0.12), []);
  const deskNormal = useMemo(() => new THREE.Vector2(0.2, 0.2), []);
  return (
    <>
      <color attach="background" args={["#0a0c14"]} />
      <Environment frames={1} resolution={tier.env} environmentIntensity={0.55 + band.ambient.intensity * 0.5} key={band.key.color + tierId}>
        <Lightformer form="rect" intensity={Math.max(0.2, band.windowLight.intensity * 4)} color={band.windowLight.color} position={[2, 2, -4]} scale={[3, 2.2, 1]} />
        <Lightformer form="ring" intensity={0.8 + band.key.intensity * 1.4} color={band.key.color} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={3} />
        <Lightformer form="rect" intensity={2.4} color="#ff3da0" position={[-4, 1.5, 0]} rotation-y={Math.PI / 2} scale={[3, 1.2, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#2fd0ff" position={[4, 1, 2]} rotation-y={-Math.PI / 2} scale={[3, 1.2, 1]} />
      </Environment>
      <hemisphereLight args={[band.ambient.color, "#1a1410", 0.35 + band.ambient.intensity * 0.8]} />
      <directionalLight
        position={[3.25, 5.0, -6.4]}
        color={band.key.color}
        intensity={sunOn ? 0.8 + band.windowLight.intensity * 2.2 : 0.35}
        castShadow={tier.shadowMap > 0 && !DEBUG.noSunShadow}
        shadow-mapSize={[tier.shadowMap || 1, tier.shadowMap || 1]}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
        shadow-camera-near={1}
        shadow-camera-far={16}
        shadow-bias={-0.0004}
        shadow-radius={4}
        shadow-normalBias={0.02}
      />
      <DirTarget />
      <Window band={band} tier={tier} />
      <Shadowed>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.5]}>
          <planeGeometry args={[4.4, 3.4]} />
          <meshStandardMaterial map={tex.floor} roughness={0.5} metalness={0.02} envMapIntensity={0.7} />
        </mesh>
        <mesh position={[0, 1.3, -1.2]} userData={{ noShadow: true }} receiveShadow>
          <planeGeometry args={[4.4, 2.6]} />
          <meshStandardMaterial color="#8d93a8" normalMap={tex.wall} normalScale={wallNormal} roughness={0.92} />
        </mesh>
        <mesh position={[-2.2, 1.3, 0.5]} rotation={[0, Math.PI / 2, 0]} userData={{ noShadow: true }} receiveShadow>
          <planeGeometry args={[3.4, 2.6]} />
          <meshStandardMaterial color="#7d849b" normalMap={tex.wall} normalScale={wallNormal} roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.045, -1.19]} userData={{ noShadow: true }}>
          <boxGeometry args={[4.4, 0.09, 0.02]} />
          <meshStandardMaterial color="#dcd6cc" roughness={0.6} />
        </mesh>
        <mesh position={[-2.19, 0.045, 0.5]} userData={{ noShadow: true }}>
          <boxGeometry args={[0.02, 0.09, 3.4]} />
          <meshStandardMaterial color="#dcd6cc" roughness={0.6} />
        </mesh>
        <RoundedBox args={[1.9, 0.012, 1.3]} radius={0.005} smoothness={2} position={[0, 0.006, 0.1]} receiveShadow>
          <meshStandardMaterial map={tex.rug} roughness={1} />
        </RoundedBox>
        <RoundedBox args={[2.0, 0.04, 0.72]} radius={0.012} smoothness={3} position={[0, 0.73, -0.82]} castShadow receiveShadow>
          <meshStandardMaterial map={tex.desk} roughness={0.42} normalMap={tex.wall} normalScale={deskNormal} />
        </RoundedBox>
        {[-0.97, 0.97].map((x) => (
          <RoundedBox key={x} args={[0.04, 0.71, 0.66]} radius={0.01} smoothness={2} position={[x, 0.355, -0.82]} castShadow receiveShadow>
            <meshStandardMaterial color="#1a1c23" roughness={0.45} metalness={0.5} />
          </RoundedBox>
        ))}
        <mesh position={[0, 0.55, -1.12]} castShadow>
          <boxGeometry args={[1.86, 0.2, 0.012]} />
          <meshStandardMaterial color="#1a1c23" roughness={0.5} metalness={0.4} />
        </mesh>
        <RoundedBox args={[0.3, 0.012, 0.2]} radius={0.005} smoothness={2} position={[0, 0.76, -0.95]} castShadow>
          <meshStandardMaterial color="#14151a" roughness={0.35} metalness={0.7} />
        </RoundedBox>
        <CurvedMonitor accent={accent} glow={band.screenGlow} y={1.02} />
        <CurvedMonitor accent="#c792ea" glow={band.screenGlow} y={1.4} tilt={-0.1} />
        <mesh position={[0, 1.05, -1.1]} castShadow>
          <boxGeometry args={[0.05, 0.62, 0.03]} />
          <meshStandardMaterial color="#14151a" roughness={0.35} metalness={0.7} />
        </mesh>
        {[-1, 1].map((sd) => (
          <group key={sd}>
            <FlatScreen position={[sd * 0.7, 1.08, -0.93]} rotation={[-0.06, -sd * 0.5, 0]} size={[0.3, 0.52, 0.025]} accent={sd < 0 ? "#89ddff" : "#c3e88d"} glow={band.screenGlow} seed={sd + 3} />
            <mesh position={[sd * 0.7, 0.9, -0.98]} castShadow>
              <boxGeometry args={[0.04, 0.3, 0.02]} />
              <meshStandardMaterial color="#14151a" roughness={0.35} metalness={0.7} />
            </mesh>
          </group>
        ))}
        <FlatScreen position={[0.38, 0.86, -0.5]} rotation={[-0.28, -0.15, 0]} size={[0.25, 0.17, 0.008]} accent="#ffcb6b" glow={band.screenGlow} seed={5} />
        <RoundedBox args={[0.12, 0.05, 0.08]} radius={0.01} smoothness={2} position={[0.38, 0.79, -0.5]} castShadow>
          <meshStandardMaterial color="#1c1e26" roughness={0.4} metalness={0.5} />
        </RoundedBox>
        <FlatScreen position={[-0.42, 0.86, -0.52]} rotation={[-0.3, 0.2, 0]} size={[0.07, 0.15, 0.008]} accent="#f78c6c" glow={band.screenGlow} seed={9} />
        <RoundedBox args={[0.06, 0.05, 0.05]} radius={0.01} smoothness={2} position={[-0.42, 0.79, -0.52]} castShadow>
          <meshStandardMaterial color="#1c1e26" roughness={0.4} metalness={0.5} />
        </RoundedBox>
        <Keyboard accent={accent} />
        <RoundedBox args={[0.34, 0.004, 0.22]} radius={0.002} smoothness={2} position={[0.42, 0.754, -0.63]} receiveShadow>
          <meshStandardMaterial color="#1b1e2a" roughness={1} />
        </RoundedBox>
        <RoundedBox args={[0.06, 0.03, 0.1]} radius={0.02} smoothness={4} position={[0.44, 0.772, -0.62]} castShadow>
          <meshStandardMaterial color="#101116" roughness={0.3} metalness={0.4} />
        </RoundedBox>
        <Lamp on={band.lampOn} />
        <Plant />
        <Shelf />
        <Chair fabric={tex.fabric} />
        <Frame position={[-2.18, 1.5, 0.1]} rotation={[0, Math.PI / 2, 0]} size={[0.7, 0.5]} color="#3a4a8a" />
        <Frame position={[-2.18, 1.35, 0.85]} rotation={[0, Math.PI / 2, 0]} size={[0.32, 0.42]} color="#b0553f" />
        <mesh position={[0, 1.92, -1.17]} userData={{ noShadow: true }}>
          <boxGeometry args={[1.3, 0.022, 0.022]} />
          <meshBasicMaterial color={neon("#ff2d95", 3.2)} toneMapped={false} />
        </mesh>
        <mesh position={[-2.15, 0.3, -1.15]} userData={{ noShadow: true }}>
          <boxGeometry args={[0.022, 2.2, 0.022]} />
          <meshBasicMaterial color={neon("#2fd0ff", 3.2)} toneMapped={false} />
        </mesh>
      </Shadowed>
      <pointLight position={[0, 1.8, -1.0]} color="#ff2d95" intensity={0.9 * band.screenGlow} distance={2.6} decay={2} />
      <pointLight position={[-2.0, 1.2, -1.0]} color="#2fd0ff" intensity={0.8 * band.screenGlow} distance={2.6} decay={2} />
      <Glow position={[0, 1.92, -1.16]} size={[1.9, 0.5]} color="#ff2d95" opacity={0.5} />
      <Glow position={[-2.14, 0.9, -1.14]} size={[0.4, 2.6]} color="#2fd0ff" opacity={0.4} />
      <Glow position={[0, 1.2, -0.6]} size={[1.6, 0.9]} color={accent} opacity={0.12 * band.screenGlow} />
      {tier.accum > 0 ? (
        <AccumulativeShadows temporal frames={tier.accum} alphaTest={0.9} scale={9} position={[0, 0.02, 0.5]} color="#06060c" opacity={0.85} resolution={tier.accumRes}>
          <RandomizedLight amount={8} radius={3.5} ambient={0.55} intensity={1} position={[2.2, 5, 1.5]} bias={0.001} />
        </AccumulativeShadows>
      ) : (
        <ContactShadows frames={1} position={[0, 0.02, 0.5]} scale={9} blur={2.4} opacity={0.6} far={2.2} resolution={256} />
      )}
      <ContactShadows frames={1} position={[0, 0.755, -0.82]} scale={[1.7, 0.72]} blur={1.6} opacity={0.5} far={0.6} resolution={256} />
    </>
  );
}

type LabStats = { calls: number; triangles: number; geometries: number; textures: number; programs: number; frameMs: number[] };

/** Collects frame times and renderer.info per frame; read from `window.__lab` by the test script. */
function Stats() {
  const gl = useThree((s) => s.gl);
  const get = useThree((s) => s.get);
  const scene = useThree((s) => s.scene);
  const stats = useRef<LabStats>({ calls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0, frameMs: [] });
  useEffect(() => {
    get().gl.info.autoReset = false;
    (window as unknown as { __lab: unknown }).__lab = {
      stats: stats.current,
      texMB: () => {
        // Estimate: every texture the scene's materials hold, RGBA8 with a mip chain (render targets left out).
        const seen = new Set<THREE.Texture>();
        scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
          for (const mat of Array.isArray(m) ? m : m ? [m] : []) for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) seen.add(v as THREE.Texture);
        });
        let b = 0;
        seen.forEach((t) => {
          const im = t.image as { width?: number; height?: number } | undefined;
          if (im?.width && im.height) b += im.width * im.height * 4 * (t.generateMipmaps ? 1.33 : 1);
        });
        return b / 1048576;
      },
    };
  }, [get, scene]);
  useFrame((_, dt) => {
    const s = stats.current;
    s.calls = gl.info.render.calls;
    s.triangles = gl.info.render.triangles;
    s.geometries = gl.info.memory.geometries;
    s.textures = gl.info.memory.textures;
    s.programs = gl.info.programs?.length ?? 0;
    gl.info.reset();
    s.frameMs.push(dt * 1000);
    if (s.frameMs.length > 600) s.frameMs.shift();
  }, -1000);
  return null;
}

function Sway({ still }: { still: boolean }) {
  const camera = useThree((s) => s.camera);
  const aspect = useThree((s) => s.size.width / s.size.height);
  useFrame(({ pointer, clock }) => {
    const t = still ? 0 : clock.elapsedTime;
    const wide = Math.max(1, Math.pow(1.6 / aspect, 0.62));
    const px = still ? 0 : pointer.x;
    camera.position.set(2.5 * wide + px * 0.25 + Math.sin(t * 0.2) * 0.06, 1.7 + 0.4 * (wide - 1), 3.3 * wide);
    camera.lookAt(-0.1, 1.0, -0.8);
  });
  return null;
}

export default function LabScene() {
  const q = useMemo(() => new URLSearchParams(window.location.search), []);
  const asked = q.get("tier");
  const tierId: TierId = asked === "low" || asked === "medium" || asked === "high" ? asked : window.matchMedia("(max-width: 767px)").matches ? "low" : "high";
  const tier = TIERS[tierId];
  const hour = q.get("hour") ? Number(q.get("hour")) : new Date().getHours();
  const bandId = q.get("band") ?? (hour < 5 ? "late" : hour < 8 ? "dawn" : hour < 17 ? "day" : hour < 21 ? "evening" : hour < 23 ? "night" : "late");
  const band = lightingFor(bandId);
  const accent = q.get("accent") ?? "#7aa2ff";
  const still = q.get("still") === "1";
  return (
    <div style={{ position: "fixed", inset: 0, background: "#05060a" }}>
      <Canvas
        key={tierId + bandId}
        shadows={tier.shadowMap > 0 ? "percentage" : false}
        dpr={[1, tier.dpr]}
        camera={{ fov: 34, near: 0.1, far: 40, position: [2.5, 1.7, 3.3] }}
        gl={{ antialias: !tier.fx, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      >
        <LabRoom band={band} tier={tier} tierId={tierId} accent={accent} />
        <Sway still={still} />
        <Stats />
        {tier.fx ? (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            {tier.bloom ? <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.9} radius={0.7} /> : <></>}
            <SMAA />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          </EffectComposer>
        ) : null}
      </Canvas>
      <div style={{ position: "fixed", left: 8, top: 8, font: "11px monospace", color: "#9aa", pointerEvents: "none" }}>
        stage-lab · tier {tierId} · band {bandId}
      </div>
    </div>
  );
}
