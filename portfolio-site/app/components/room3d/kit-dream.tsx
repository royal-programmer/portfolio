"use client";

/**
 * Room kit, the dream-room pieces (round 37a): single bed, wardrobe whose doors open (jackets and shirts on hangers),
 * guitar (a click strums a chord, see lib/room3d/chord.ts), caps on hooks, key rack with its tags, the riding set
 * (helmet, jacket, pants, gloves, boots), a football and a Rubik's cube. Same conventions as kit-decor.tsx: metres,
 * origin at the middle of the base, facing +z; all of it built from primitives with the kit's cached materials, so the
 * static merge folds it into a few draw calls, and the repeated parts (hangers, garments, keys, stickers) are instanced.
 * Each object's `model` / `map` (an optional URL, unused until round 37d) will later replace the drawn shape.
 */
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { kick, kickFromRay, newBall, stepBall, type Ball } from "@/lib/room3d/ball";
import type { KindId, ObjectOf } from "@/lib/room3d/schema";
import { Inst, useEnv, useMat } from "./kit-core";

type P<K extends KindId> = { o: ObjectOf<K> };
type V3 = [number, number, number];

/** A rounded box that never asks for a radius bigger than half its smallest side. */
export function Rb({ a, p, r = 0.01, m, rot, cast = true }: { a: V3; p: V3; r?: number; m: THREE.Material; rot?: V3; cast?: boolean }) {
  return <RoundedBox args={a} radius={Math.max(0.0005, Math.min(r, Math.min(...a) / 2 - 0.0005))} smoothness={3} position={p} rotation={rot} castShadow={cast} receiveShadow material={m} />;
}

const JACKETS = ["#2b2f3a", "#5a3a2a", "#1f3a4d", "#3b3b3b", "#4a4a2a"];
const SHIRTS = ["#e8e6ee", "#9fb7d6", "#c9c2b0", "#7aa0a0", "#d9a3a3", "#b8c4a0"];

/** The garment on hanger `i`: every third is a jacket (longer, darker), the rest are shirts. */
const garment = (i: number) => {
  const jacket = i % 3 === 0;
  return { jacket, len: jacket ? 0.82 : 0.66, width: jacket ? 0.5 : 0.44, thick: jacket ? 0.045 : 0.03, color: (jacket ? JACKETS : SHIRTS)[(i * 7 + (jacket ? 1 : 3)) % (jacket ? JACKETS.length : SHIRTS.length)] };
};

export function Bed({ o }: P<"bed">) {
  const env = useEnv();
  const { size, pillows, blanket, headboard, baseColor, pillowColor, throwColor, headboardColor, led, ledColor } = o.params;
  const w = size === "single" ? 0.9 : 1.4;
  const leg = env.kit.mat("plastic", "#2a2c33", 0.6);
  // The duvet and the throw have a soft fold normal and no weave pattern; the base and the headboard are fabric.
  const duvet = env.kit.soft(o.material.color, Math.max(0.9, o.material.roughness), "wrinkle", 1, 0.55, [1, 2]);
  const mattress = env.kit.mat("fabric", o.material.color, 0.95);
  const base = env.kit.mat("fabric", baseColor, 0.97);
  const fold = env.kit.soft(throwColor, 0.95, "wrinkle", 1, 0.45, [1, 1]);
  const pillow = env.kit.soft(pillowColor, 0.9, "wrinkle", 0.8, 0.35, [1, 1]);
  const head = env.kit.mat("fabric", headboardColor, 0.95);
  const legGeo = env.kit.geo("bed-leg", () => new THREE.BoxGeometry(0.05, 0.1, 0.05));
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const)).map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} geometry={legGeo} position={[sx * (w / 2 - 0.0), 0.05, sz * 0.94]} castShadow material={leg} />
      ))}
      <Rb a={[w + 0.08, 0.16, 2.0]} p={[0, 0.18, 0]} r={0.03} m={base} />
      {led && env.tier.aoOn ? (
        <mesh position={[0, 0.098, 0]} userData={{ noShadow: true }} material={env.kit.glow(ledColor, 2.4 * env.light.emissiveBoost)}>
          <boxGeometry args={[w + 0.1, 0.012, 2.02]} />
        </mesh>
      ) : null}
      <Rb a={[w, 0.18, 1.9]} p={[0, 0.35, 0.0]} r={0.05} m={mattress} />
      {headboard ? (
        <>
          <Rb a={[w + 0.1, 0.92, 0.05]} p={[0, 0.46, -1.025]} r={0.02} m={head} />
          <Rb a={[w - 0.1, 0.5, 0.025]} p={[0, 0.7, -0.99]} r={0.015} m={head} />
        </>
      ) : null}
      <Rb a={[w - 0.02, 0.07, 1.3]} p={[0, 0.475, 0.25]} r={0.035} m={duvet} />
      {blanket ? (
        <>
          <Rb a={[w - 0.04, 0.1, 0.46]} p={[0, 0.54, 0.62]} r={0.04} m={fold} />
          <Rb a={[w - 0.1, 0.02, 0.4]} p={[0, 0.605, 0.62]} r={0.01} m={fold} />
        </>
      ) : null}
      {Array.from({ length: pillows }, (_, i) => {
        const two = pillows > 1;
        const pw = two ? w / 2 - 0.06 : Math.min(0.6, w - 0.2);
        return <Rb key={i} a={[pw, 0.12, 0.34]} p={[two ? (i % 2 ? 1 : -1) * (w / 4) : 0, 0.54 + Math.floor(i / 2) * 0.1, -0.78]} rot={[-0.1, 0, 0]} r={0.05} m={pillow} />;
      })}
    </group>
  );
}

/** Two hangers' worth of geometry in one: the bar, two sloping arms, the hook. About 0.4 m wide along z. */
function hangerGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.BoxGeometry(0.008, 0.008, 0.4).translate(0, -0.05, 0));
  for (const s of [-1, 1]) parts.push(new THREE.BoxGeometry(0.008, 0.008, 0.215).rotateX(s * 0.25).translate(0, -0.025, s * 0.1));
  parts.push(new THREE.BoxGeometry(0.008, 0.045, 0.008).translate(0, 0.0, 0));
  const g = mergeGeometries(parts.map((x) => x.toNonIndexed()))!;
  parts.forEach((x) => x.dispose());
  return g;
}

/**
 * One garment in unit coordinates (x thickness, y length, z shoulder width, the body centred): the body and its two sleeves in one
 * geometry, so a whole wardrobe of them is a single instanced draw. The instance scale turns the units into metres per garment.
 */
function garmentGeometry() {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(1, 1, 1)];
  for (const side of [-1, 1]) parts.push(new THREE.BoxGeometry(0.9, 0.78, 0.2).rotateX(side * 0.07).translate(0, 0.085, side * 0.55));
  const g = mergeGeometries(parts.map((x) => x.toNonIndexed()))!;
  parts.forEach((x) => x.dispose());
  return g;
}

/** A door leaf with its raised panel in one geometry (centred): one mesh, one shadow draw per leaf. */
function leafGeometry(w: number, h: number) {
  const parts = [new THREE.BoxGeometry(w / 2 - 0.01, h - 0.02, 0.022), new THREE.BoxGeometry(w / 2 - 0.16, h - 0.2, 0.006).translate(0, 0, 0.0135)];
  const g = mergeGeometries(parts.map((x) => x.toNonIndexed()))!;
  parts.forEach((x) => x.dispose());
  return g;
}

export function Wardrobe({ o }: P<"wardrobe">) {
  const env = useEnv();
  const { w, h, d, open, clothes } = o.params;
  const body = useMat(o.material);
  const inner = env.kit.mat("wood", "#2a2018", 0.8);
  const rod = env.kit.mat("metal", "#b8bcc6", 0.3);
  const handle = rod;
  const hanger = env.kit.geo("hanger", hangerGeometry);
  const garments = env.kit.geo("garment", garmentGeometry);
  const leafGeo = env.kit.geo(`wardrobe-leaf:${w}:${h}`, () => leafGeometry(w, h));
  const cloth = env.kit.mat("fabric", "#ffffff", 0.9);
  const hangerMat = env.kit.mat("plastic", "#2a2a30", 0.5);
  const rodY = h * 0.8;
  const span = w - 0.12;
  const xAt = (i: number) => -span / 2 + (i + 0.5) * (span / Math.max(1, clothes));
  const fillHanger = useCallback(
    (i: number, p: THREE.Object3D) => {
      p.position.set(xAt(i), rodY, 0);
      p.rotation.y = 0.1 * ((i % 3) - 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clothes, w, h],
  );
  const fillBody = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const g = garment(i);
      p.position.set(xAt(i), rodY - 0.07 - g.len / 2, 0);
      p.rotation.y = 0.1 * ((i % 3) - 1);
      p.scale.set(g.thick, g.len, g.width * 0.86);
      c.set(g.color);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clothes, w, h],
  );
  const leaves = useRef<(THREE.Group | null)[]>([null, null]);
  const angle = useRef(0);
  const toggled = env.openIds.has(o.id);
  const isOpen = open ? !toggled : toggled;
  useFrame((_, dt) => {
    const target = isOpen ? 1.75 : 0;
    // Frame-rate independent easing (a long frame cannot snap the doors shut or open); reduced motion cuts.
    angle.current = env.reduced ? target : angle.current + (target - angle.current) * (1 - Math.exp(-5 * Math.min(dt, 0.05)));
    [-1, 1].forEach((s, k) => {
      const g = leaves.current[k];
      if (g) g.rotation.y = s * angle.current;
    });
  });
  return (
    <group>
      <mesh position={[0, h / 2, -d / 2 + 0.01]} castShadow receiveShadow material={body}>
        <boxGeometry args={[w, h, 0.02]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - 0.01), h / 2, 0]} castShadow receiveShadow material={body}>
          <boxGeometry args={[0.02, h, d]} />
        </mesh>
      ))}
      <mesh position={[0, h - 0.01, 0]} castShadow material={body}>
        <boxGeometry args={[w, 0.02, d]} />
      </mesh>
      <mesh position={[0, 0.04, 0]} material={inner} receiveShadow>
        <boxGeometry args={[w - 0.04, 0.08, d - 0.02]} />
      </mesh>
      <mesh position={[0, 0.5, 0.0]} material={inner}>
        <boxGeometry args={[w - 0.04, 0.02, d - 0.06]} />
      </mesh>
      <mesh position={[0, rodY, 0]} rotation={[0, 0, Math.PI / 2]} material={rod}>
        <cylinderGeometry args={[0.012, 0.012, w - 0.05, 8]} />
      </mesh>
      {clothes > 0 ? (
        <>
          <Inst count={clothes} geometry={hanger} material={hangerMat} fill={fillHanger} cast={false} />
          <Inst count={clothes} geometry={garments} material={cloth} fill={fillBody} />
        </>
      ) : null}
      {[-1, 1].map((s, k) => (
        <group key={s} ref={(g) => void (leaves.current[k] = g)} position={[s * (w / 2 - 0.01), 0, d / 2 - 0.01]} userData={{ dynamic: true }}>
          <mesh geometry={leafGeo} position={[-s * (w / 4 - 0.005), h / 2, 0]} castShadow receiveShadow material={body} />
          <mesh position={[-s * 0.05, h * 0.5, 0.035]} rotation={[0, 0, 0]} material={handle}>
            <cylinderGeometry args={[0.009, 0.009, 0.16, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** The tuning pegs, frets, strings, as merged geometries (built once per kit). */
function stringsGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    parts.push(new THREE.BoxGeometry(0.0026, 0.8, 0.0026).translate((i - 2.5) * 0.0068, 0.215, 0));
  }
  const g = mergeGeometries(parts.map((x) => x.toNonIndexed()))!;
  parts.forEach((x) => x.dispose());
  return g;
}

/** The guitar's floor stand (a pole, a three-legged foot, a cradle and a neck rest) or, hung on the wall, its hook. Shared by the drawn guitar and the glTF one. */
export function GuitarStand({ stand }: { stand: boolean }) {
  const env = useEnv();
  const dark = env.kit.mat("plastic", "#0b0b0e", 0.6);
  const steel = dark;
  const base = stand ? 0.5 : 1.3;
  return (
    <>
      {stand ? (
        <>
          <mesh position={[0, 0.32, -0.06]} rotation={[-0.14, 0, 0]} castShadow material={steel}>
            <cylinderGeometry args={[0.011, 0.011, 0.64, 8]} />
          </mesh>
          {[0, 1, 2].map((i) => {
            const a = (i * Math.PI * 2) / 3;
            return (
              <mesh key={i} position={[Math.sin(a) * 0.11, 0.012, Math.cos(a) * 0.11 - 0.05]} rotation={[0, a, 0]} material={steel}>
                <boxGeometry args={[0.018, 0.018, 0.24]} />
              </mesh>
            );
          })}
          <mesh position={[0, 0.24, 0.0]} material={dark}>
            <boxGeometry args={[0.11, 0.02, 0.07]} />
          </mesh>
          <mesh position={[0, 0.72, -0.1]} material={dark}>
            <boxGeometry args={[0.06, 0.02, 0.05]} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, base + 0.78, 0.025]} castShadow material={steel}>
          <boxGeometry args={[0.012, 0.05, 0.05]} />
        </mesh>
      )}
    </>
  );
}

export function Guitar({ o }: P<"guitar">) {
  const env = useEnv();
  const { stand } = o.params;
  const body = useMat(o.material);
  const neckMat = env.kit.mat("wood", "#5a3d27", 0.5);
  const dark = env.kit.mat("plastic", "#0b0b0e", 0.6);
  const steel = dark;
  const board = dark;
  const bright = env.kit.mat("metal", "#cfd3dc", 0.25);
  const top = env.kit.mat("wood", "#26262b", 0.4);
  const strings = env.kit.geo("guitar-strings", stringsGeometry);
  const stringRef = useRef<THREE.Mesh>(null);
  const strum = useRef({ t0: -10 });
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<{ id?: string }>).detail?.id === o.id) strum.current.t0 = performance.now();
    };
    window.addEventListener("room3d:strum", on);
    return () => window.removeEventListener("room3d:strum", on);
  }, [o.id]);
  useFrame(() => {
    const m = stringRef.current;
    if (!m) return;
    const age = (performance.now() - strum.current.t0) / 1000;
    m.position.z = 0.058 + (env.reduced || age > 1.6 ? 0 : 0.0035 * Math.exp(-age * 3.2) * Math.sin(age * 140));
  });
  // The body's middle at y 0.5 on the stand; hung on a hook the whole guitar rides higher and flat to the wall.
  const base = stand ? 0.5 : 1.3;
  const lean = stand ? -0.14 : 0;
  return (
    <group>
      <GuitarStand stand={stand} />
      <group position={[0, base - 0.2, stand ? 0.04 : 0.065]} rotation={[lean, 0, 0]}>
        {/* body: two bouts and a waist, a soundboard, a hole, a bridge */}
        <mesh scale={[1, 1, 0.3]} position={[0, -0.11, 0]} castShadow receiveShadow material={body}>
          <sphereGeometry args={[0.19, 24, 16]} />
        </mesh>
        <mesh scale={[1, 1, 0.3]} position={[0, 0.1, 0]} castShadow receiveShadow material={body}>
          <sphereGeometry args={[0.145, 24, 16]} />
        </mesh>
        <mesh scale={[1, 1, 0.3]} position={[0, -0.0, 0]} castShadow material={body}>
          <sphereGeometry args={[0.15, 20, 12]} />
        </mesh>
        <mesh position={[0, -0.09, 0.033]} scale={[1, 1.03, 0.14]} receiveShadow material={top}>
          <sphereGeometry args={[0.178, 24, 12]} />
        </mesh>
        <mesh position={[0, 0.0, 0.06]} rotation={[Math.PI / 2, 0, 0]} material={dark}>
          <cylinderGeometry args={[0.04, 0.04, 0.004, 20]} />
        </mesh>
        <mesh position={[0, -0.17, 0.062]} material={board} castShadow>
          <boxGeometry args={[0.12, 0.014, 0.012]} />
        </mesh>
        {/* neck and headstock */}
        <mesh position={[0, 0.42, 0.012]} castShadow material={neckMat}>
          <boxGeometry args={[0.044, 0.4, 0.024]} />
        </mesh>
        <mesh position={[0, 0.4, 0.026]} material={board}>
          <boxGeometry args={[0.042, 0.4, 0.006]} />
        </mesh>
        {[0.26, 0.31, 0.355, 0.4, 0.44, 0.48, 0.515, 0.55].map((y) => (
          <mesh key={y} position={[0, y, 0.03]} material={bright}>
            <boxGeometry args={[0.042, 0.003, 0.003]} />
          </mesh>
        ))}
        <mesh position={[0, 0.68, 0.0]} rotation={[-0.2, 0, 0]} castShadow material={neckMat}>
          <boxGeometry args={[0.07, 0.15, 0.02]} />
        </mesh>
        {[-1, 1].flatMap((s) => [0, 1, 2].map((k) => [s, k] as const)).map(([s, k]) => (
          <mesh key={`${s}${k}`} position={[s * 0.043, 0.645 + k * 0.045, 0.0]} rotation={[0, 0, Math.PI / 2]} material={bright}>
            <cylinderGeometry args={[0.006, 0.006, 0.02, 8]} />
          </mesh>
        ))}
        {/* strings: one mesh that shivers after a strum */}
        <group userData={{ dynamic: true }}>
          <mesh ref={stringRef} geometry={strings} position={[0, 0, 0.058]} rotation={[-0.0425, 0, 0]} material={bright} userData={{ noShadow: true }} />
        </group>
      </group>
    </group>
  );
}

export function CapRow({ o }: P<"capRow">) {
  const env = useEnv();
  const { count, spacing, lift, capColor, brimColor } = o.params;
  // Geometry of a cap's visor: a half disc hanging below the rim, drooping toward the viewer (`r` its radius, `t` its thickness, `dy` a drop below the visor's plane).
  const brimGeo = (r: number, t: number, dy: number) => new THREE.CylinderGeometry(r, r, t, 16, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(-Math.PI / 2).rotateX(-0.45).translate(0, -0.078 - dy * 0.9, 0.112 - dy * 0.45);
  // The crown (a squashed half sphere, its open side to the wall) with the visor, and the visor's red edge (a slightly larger, thin disc under it): two instanced draws.
  const cap = env.kit.geo("cap", () => {
    const dome = new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.9, 1).rotateX(Math.PI / 2 - 0.2).translate(0, 0, 0.1);
    const brim = brimGeo(0.095, 0.01, 0);
    const g = mergeGeometries([dome.toNonIndexed(), brim.toNonIndexed()])!;
    dome.dispose();
    brim.dispose();
    return g;
  });
  const edge = env.kit.geo("cap-edge", () => brimGeo(0.101, 0.007, 0.0065));
  const mat = env.kit.mat("fabric", "#ffffff", 0.9);
  const edgeMat = env.kit.mat("plastic", "#ffffff", 0.5);
  const wood = env.kit.mat("wood", "#4a3422", 0.5);
  const peg = env.kit.mat("metal", "#b8bcc6", 0.3);
  const fill = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      p.position.set(i * spacing, lift, 0);
      c.set(capColor);
    },
    [spacing, lift, capColor],
  );
  const fillEdge = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      p.position.set(i * spacing, lift, 0);
      c.set(brimColor);
    },
    [spacing, lift, brimColor],
  );
  const x0 = (-(count - 1) * spacing) / 2;
  return (
    <group>
      <Rb a={[(count - 1) * spacing + 0.3, 0.06, 0.02]} p={[0, lift + 0.01, 0.01]} r={0.008} m={wood} />
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[x0 + i * spacing, lift, 0.06]} rotation={[Math.PI / 2, 0, 0]} material={peg}>
          <cylinderGeometry args={[0.008, 0.008, 0.1, 8]} />
        </mesh>
      ))}
      <group position={[x0, 0, 0]}>
        <Inst count={count} geometry={cap} material={mat} fill={fill} />
        <Inst count={count} geometry={edge} material={edgeMat} fill={fillEdge} cast={false} />
      </group>
    </group>
  );
}

/** The tags: one canvas with each label centred under its key, drawn once per set of labels. */
function tagTexture(labels: string[], keys: number, w: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2b2118";
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = "#efe6d4";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = "600 30px system-ui, sans-serif";
  const inset = 0.05 / w;
  labels.slice(0, keys).forEach((t, i) => {
    const u = keys === 1 ? 0.5 : inset + (i * (1 - 2 * inset)) / (keys - 1);
    g.fillText(t, u * 512, 33, (512 / Math.max(2, keys)) * 0.92);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A bike key's head: black, angular (a chamfered polygon, 11 mm thick), centred. */
function bikeHeadGeometry() {
  const s = new THREE.Shape();
  [[-0.011, -0.03], [0.011, -0.03], [0.017, -0.004], [0.013, 0.027], [-0.013, 0.03], [-0.017, -0.004]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.011, bevelEnabled: false });
  g.translate(0, 0, -0.0055);
  return g;
}

/** A car-key fob: a round black disc with a plain quartered face (two opposite quarters one colour, two the other), vertex-coloured. */
function fobGeometry(dark: string, a: string, b: string) {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, hex: string) => {
    const col = new THREE.Color(hex);
    const n = g.getAttribute("position").count;
    g.setAttribute("color", new THREE.BufferAttribute(Float32Array.from({ length: n * 3 }, (_, i) => [col.r, col.g, col.b][i % 3]), 3));
    return g.toNonIndexed();
  };
  parts.push(paint(new THREE.CylinderGeometry(0.03, 0.03, 0.009, 24).rotateX(Math.PI / 2), dark));
  for (let k = 0; k < 4; k++) parts.push(paint(new THREE.CircleGeometry(0.025, 8, (k * Math.PI) / 2, Math.PI / 2).translate(0, 0, 0.0047), k % 2 ? b : a));
  const g = mergeGeometries(parts)!;
  parts.forEach((x) => x.dispose());
  return g;
}

export function KeyRack({ o }: P<"keyRack">) {
  const env = useEnv();
  const { keys, w, lift, labels, headColor, fobColors } = o.params;
  const board = useMat(o.material);
  const peg = env.kit.mat("metal", "#b8bcc6", 0.3);
  // The blade and the ring of a key, relative to its head's middle, in one geometry.
  const bladeRing = env.kit.geo("key-blade-ring", () => {
    const blade = new THREE.BoxGeometry(0.009, 0.05, 0.003).translate(0, -0.045, 0);
    const ring = new THREE.TorusGeometry(0.011, 0.0018, 6, 14).translate(0, 0.042, 0);
    const g = mergeGeometries([blade.toNonIndexed(), ring.toNonIndexed()])!;
    blade.dispose();
    ring.dispose();
    return g;
  });
  const bikeGeo = env.kit.geo("bike-head", bikeHeadGeometry);
  const fobGeo = env.kit.geo(`fob:${headColor}:${fobColors.join()}`, () => fobGeometry(headColor, fobColors[0], fobColors[1]));
  const metal = env.kit.mat("metal", "#ffffff", 0.3);
  const plastic = env.kit.mat("plastic", "#ffffff", 0.45);
  const vcol = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1 }), []);
  useEffect(() => () => vcol.dispose(), [vcol]);
  const bikes = Math.ceil(keys / 2);
  const fobs = Math.floor(keys / 2);
  const xAt = (i: number) => (keys === 1 ? 0 : -w / 2 + 0.05 + (i * (w - 0.1)) / (keys - 1));
  const tex = env.kit.tex(`tags:${w}:${keys}:${labels.join("|")}`, () => tagTexture(labels, keys, w));
  const tagMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.22 }), [tex]);
  useEffect(() => () => tagMat.dispose(), [tagMat]);
  // Even keys are bike keys (a black angular head), odd ones car fobs.
  const fillBike = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const k = i * 2;
      p.position.set(xAt(k), lift - 0.075, 0.045);
      p.rotation.z = ((k % 5) - 2) * 0.04;
      c.set(headColor);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, w, lift, headColor],
  );
  const fillFob = useCallback(
    (i: number, p: THREE.Object3D) => {
      const k = i * 2 + 1;
      p.position.set(xAt(k), lift - 0.08, 0.045);
      p.rotation.z = ((k % 5) - 2) * 0.04;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, w, lift],
  );
  const fillBlade = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      p.position.set(xAt(i), lift - 0.075, 0.045);
      p.rotation.z = ((i % 5) - 2) * 0.04;
      c.set(i % 2 === 1 ? "#9aa0ad" : "#cfd3dc");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, w, lift],
  );
  return (
    <group>
      <Rb a={[w, 0.28, 0.03]} p={[0, lift - 0.09, 0.015]} r={0.008} m={board} />
      {Array.from({ length: keys }, (_, i) => (
        <mesh key={i} position={[xAt(i), lift - 0.015, 0.045]} rotation={[Math.PI / 2, 0, 0]} material={peg}>
          <cylinderGeometry args={[0.005, 0.005, 0.03, 8]} />
        </mesh>
      ))}
      <Inst count={bikes} geometry={bikeGeo} material={plastic} fill={fillBike} cast={false} />
      {fobs > 0 ? <Inst count={fobs} geometry={fobGeo} material={vcol} fill={fillFob} cast={false} /> : null}
      <Inst count={keys} geometry={bladeRing} material={metal} fill={fillBlade} cast={false} />
      {labels.length > 0 ? (
        <mesh position={[0, lift - 0.205, 0.0305]} userData={{ noShadow: true }} material={tagMat}>
          <planeGeometry args={[w - 0.02, (w - 0.02) / 8]} />
        </mesh>
      ) : null}
    </group>
  );
}

/**
 * The riding kit on the wall: a one-piece race suit hung from a hanger (torso, arms and legs are one silhouette), black with neon panels
 * on the chest, shoulders and knees and a grey chest stripe; black boots with three buckle bands; a full-face helmet (red shell, white chin
 * bar, dark visor, two vent slots). Colours are the object's data (`base`, `panel`, `stripe`; the material is the shell).
 */
export function RidingSet({ o }: P<"ridingSet">) {
  const env = useEnv();
  const { helmet, jacket, pants, gloves, boots, base, panel, stripe } = o.params;
  const k = env.kit;
  const black = k.mat("rubber", base, 0.55);
  const neon = k.mat("plastic", panel, 0.45);
  const grey = k.mat("plastic", stripe, 0.4);
  const shell = k.mat("plastic", o.material.color, 0.22);
  const chin = k.mat("plastic", "#f4f4f6", 0.22);
  const visor = k.mat("plastic", "#0c0d11", 0.12);
  const steel = k.mat("metal", "#b8bcc6", 0.3);
  const visorGeo = k.geo("helmet-visor", () => new THREE.SphereGeometry(0.1425, 20, 10, Math.PI / 2 - 0.85, 1.7, 1.12, 0.6));
  return (
    <group>
      <mesh position={[0, 1.9, 0.02]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
        <cylinderGeometry args={[0.008, 0.008, 0.06, 8]} />
      </mesh>
      {jacket || pants ? <Rb a={[0.46, 0.018, 0.018]} p={[0, 1.845, 0.075]} r={0.005} m={steel} cast={false} /> : null}
      {jacket ? (
        <group>
          <Rb a={[0.42, 0.56, 0.13]} p={[0, 1.54, 0.085]} r={0.04} m={black} />
          <Rb a={[0.52, 0.1, 0.14]} p={[0, 1.78, 0.085]} r={0.04} m={black} />
          <Rb a={[0.3, 0.2, 0.138]} p={[0, 1.63, 0.085]} r={0.03} m={neon} />
          <Rb a={[0.3, 0.032, 0.141]} p={[0, 1.5, 0.085]} r={0.012} m={grey} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Rb a={[0.11, 0.62, 0.11]} p={[s * 0.285, 1.46, 0.09]} rot={[0, 0, s * 0.07]} r={0.04} m={black} />
              <Rb a={[0.13, 0.09, 0.145]} p={[s * 0.235, 1.8, 0.085]} r={0.03} m={neon} />
              <Rb a={[0.115, 0.04, 0.115]} p={[s * 0.3, 1.2, 0.09]} rot={[0, 0, s * 0.07]} r={0.015} m={grey} />
            </group>
          ))}
        </group>
      ) : null}
      {pants ? (
        <group>
          <Rb a={[0.42, 0.1, 0.13]} p={[0, 1.2, 0.085]} r={0.03} m={black} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Rb a={[0.19, 0.84, 0.12]} p={[s * 0.1, 0.76, 0.085]} r={0.04} m={black} />
              <Rb a={[0.15, 0.17, 0.128]} p={[s * 0.1, 0.78, 0.089]} r={0.03} m={neon} />
            </group>
          ))}
        </group>
      ) : null}
      {gloves
        ? [-1, 1].map((s) => (
            <group key={s} position={[s * 0.34, 1.12, 0.09]}>
              <Rb a={[0.085, 0.13, 0.04]} p={[0, 0, 0]} r={0.02} m={black} />
              <Rb a={[0.075, 0.07, 0.036]} p={[0, -0.095, 0]} r={0.02} m={black} />
            </group>
          ))
        : null}
      {boots
        ? [-1, 1].map((s) => (
            <group key={s} position={[s * 0.115, 0, 0.17]}>
              <Rb a={[0.11, 0.28, 0.12]} p={[0, 0.17, -0.01]} r={0.035} m={black} />
              <Rb a={[0.11, 0.07, 0.26]} p={[0, 0.045, 0.06]} r={0.03} m={black} />
              {[0.1, 0.18, 0.26].map((y) => (
                <Rb key={y} a={[0.118, 0.016, 0.128]} p={[0, y, -0.01]} r={0.004} m={steel} cast={false} />
              ))}
              <Rb a={[0.112, 0.014, 0.265]} p={[0, 0.008, 0.06]} r={0.005} m={steel} cast={false} />
            </group>
          ))
        : null}
      {helmet ? (
        <group position={[0, 2.0, 0.17]}>
          <mesh scale={[0.95, 1.0, 1.15]} castShadow material={shell}>
            <sphereGeometry args={[0.14, 24, 16]} />
          </mesh>
          <mesh geometry={visorGeo} scale={[0.95, 1.0, 1.15]} material={visor} />
          <Rb a={[0.17, 0.085, 0.14]} p={[0, -0.095, 0.075]} r={0.035} m={chin} />
          {[-1, 1].map((s) => (
            <Rb key={s} a={[0.018, 0.006, 0.1]} p={[s * 0.034, 0.128, 0.015]} rot={[-0.1, 0, 0]} r={0.003} m={visor} cast={false} />
          ))}
        </group>
      ) : null}
    </group>
  );
}

/** Black pentagons on white, the way a football reads at a distance: the twelve corners of an icosahedron, laid out on the sphere's texture. */
function footballTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4f4f4";
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = "#17181c";
  const spots: Array<[number, number, number]> = [
    [0.5, 0.06, 1.6],
    [0.5, 0.94, 1.6],
  ];
  for (let k = 0; k < 5; k++) {
    spots.push([(k * 0.2 + 0.0) % 1, 0.3, 1], [(k * 0.2 + 0.1) % 1, 0.7, 1]);
  }
  const pent = (cx: number, cy: number, r: number, sx: number) => {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
      g.lineTo(cx + Math.cos(a) * r * sx, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
  };
  for (const [u, v, sx] of spots) {
    for (const du of [-1, 0, 1]) pent((u + du) * 256, v * 128, 15, sx);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * The football: a ball that answers a click (`room3d:kick`, with the camera ray's direction) with hand-rolled physics from
 * lib/room3d/ball.ts. It lives in the object's own frame (the world position minus the object's position; the object is not
 * rotated or scaled), is `dynamic` so the static merge leaves it, and casts a shadow only where the tier has shadow maps.
 */
export function Football({ o }: P<"football">) {
  const env = useEnv();
  const r = o.params.r;
  const tex = env.kit.tex("football", footballTexture);
  const m = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, color: o.material.color, roughness: o.material.roughness, metalness: 0 }), [tex, o.material.color, o.material.roughness]);
  useEffect(() => () => m.dispose(), [m]);
  const [px, , pz] = o.transform.pos;
  const group = useRef<THREE.Group>(null);
  const ball = useRef<Ball>(newBall([px, r, pz]));
  const spin = useRef(new THREE.Quaternion());
  const world = env.ballWorld;
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id?: string; dir?: V3 }>).detail;
      if (d?.id !== o.id || !d.dir) return;
      kick(ball.current, kickFromRay(d.dir, 4.2, 2.4, Math.random() * 2 - 1));
    };
    window.addEventListener("room3d:kick", on);
    return () => window.removeEventListener("room3d:kick", on);
  }, [o.id]);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g || !world) return;
    const b = ball.current;
    const before = [b.p[0], b.p[2]];
    stepBall(b, dt, r, world, [px, r, pz]);
    g.position.set(b.p[0] - px, b.p[1], b.p[2] - pz);
    // Roll: turn about the axis across the direction of travel by the distance rolled.
    const mx = b.p[0] - before[0];
    const mz = b.p[2] - before[1];
    const dist = Math.hypot(mx, mz);
    if (dist > 1e-5) {
      spin.current.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(mz, 0, -mx).normalize(), dist / r));
      g.quaternion.copy(spin.current);
    }
    if (process.env.NODE_ENV !== "production") (window as unknown as { __ball?: unknown }).__ball = { p: b.p, v: b.v, asleep: b.asleep, world, home: [px, r, pz] };
  });
  return (
    <group ref={group} position={[0, r, 0]} userData={{ dynamic: true }}>
      <mesh castShadow={env.tier.shadowRes > 0} receiveShadow material={m}>
        <sphereGeometry args={[r, 24, 16]} />
      </mesh>
    </group>
  );
}

/** The six face colours of the cube; a seeded shuffle of the 54 stickers makes it look mid-solve. */
const CUBE_COLORS = ["#f4f4f4", "#f2d200", "#d62828", "#f77f00", "#1d4ed8", "#2e9e44"];
function cubeStickers(): number[] {
  const all = CUBE_COLORS.flatMap((_, c) => Array<number>(9).fill(c));
  let s = 7;
  for (let i = all.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}
const FACE_ROT: V3[] = [
  [0, Math.PI / 2, 0],
  [0, -Math.PI / 2, 0],
  [-Math.PI / 2, 0, 0],
  [Math.PI / 2, 0, 0],
  [0, 0, 0],
  [0, Math.PI, 0],
];

export function PuzzleCube({ o }: P<"puzzleCube">) {
  const env = useEnv();
  const s = o.params.size;
  const core = useMat(o.material);
  const plane = env.kit.geo("unit-plane", () => new THREE.PlaneGeometry(1, 1));
  const mat = env.kit.mat("plastic", "#ffffff", 0.35);
  const colors = useMemo(() => cubeStickers(), []);
  const fill = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const face = Math.floor(i / 9);
      const cell = i % 9;
      const u = ((cell % 3) - 1) * (s / 3);
      const v = (Math.floor(cell / 3) - 1) * (s / 3);
      const e = new THREE.Euler(...FACE_ROT[face]);
      const q = new THREE.Quaternion().setFromEuler(e);
      const pos = new THREE.Vector3(u, v, s / 2 + 0.0006).applyQuaternion(q);
      p.position.copy(pos);
      p.quaternion.copy(q);
      p.scale.set(s * 0.29, s * 0.29, 1);
      c.set(CUBE_COLORS[colors[i]]);
    },
    [s, colors],
  );
  return (
    <group>
      <group position={[0, s * 0.62, 0]} rotation={[0.35, 0, 0.1]}>
        <Rb a={[s, s, s]} p={[0, 0, 0]} r={s * 0.06} m={core} />
        <Inst count={54} geometry={plane} material={mat} fill={fill} cast={false} />
      </group>
    </group>
  );
}

/**
 * White cube shelving (the TV unit): `cols` x `rows` open cells. The first `books` cells (spread through the unit by a fixed step)
 * hold a row of book spines, the next `boxes` hold a box; the rest stay empty. Spines and boxes are one instanced draw each.
 */
export function CubeShelf({ o }: P<"cubeShelf">) {
  const env = useEnv();
  const { cols, rows, cell, d, books, boxes } = o.params;
  const white = useMat(o.material);
  const unit = env.kit.geo("unit-box", () => new THREE.BoxGeometry(1, 1, 1));
  const paper = env.kit.mat("paper", "#ffffff", 0.7);
  const t = 0.018;
  const W = cols * cell;
  const H = rows * cell;
  const items = useMemo(() => {
    const total = cols * rows;
    const order: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; order.length < total; i++) {
      const c = (i * 5 + 2) % total;
      if (!seen.has(c)) {
        seen.add(c);
        order.push(c);
      }
      if (i > total * 8) break;
    }
    const spines: Array<{ x: number; y: number; w: number; h: number; lean: number; hue: number }> = [];
    const crates: Array<{ x: number; y: number; w: number; h: number; hue: number }> = [];
    order.slice(0, Math.min(books, total)).forEach((c, bi) => {
      const col = c % cols;
      const row = Math.floor(c / cols);
      const cx = -W / 2 + (col + 0.5) * cell;
      const floorY = row * cell + t / 2;
      const n = 4 + (bi % 3);
      let x = cx - cell / 2 + t + 0.012;
      for (let s = 0; s < n; s++) {
        const sw = 0.022 + ((s + bi) % 3) * 0.006;
        const sh = Math.min(cell - 0.05, 0.16 + ((s * 7 + bi) % 5) * 0.022);
        spines.push({ x: x + sw / 2, y: floorY + sh / 2, w: sw, h: sh, lean: s === n - 1 && bi % 2 ? -0.18 : 0, hue: ((bi * 3 + s) * 0.137) % 1 });
        x += sw + 0.003;
      }
    });
    order.slice(Math.min(books, total), Math.min(books + boxes, total)).forEach((c, bi) => {
      const col = c % cols;
      const row = Math.floor(c / cols);
      crates.push({ x: -W / 2 + (col + 0.5) * cell, y: row * cell + t / 2 + cell * 0.2, w: cell * 0.72, h: cell * 0.4, hue: 0.08 + bi * 0.19 });
    });
    return { spines, crates };
  }, [cols, rows, cell, books, boxes, W]);
  const fillSpine = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const s = items.spines[i];
      p.position.set(s.x, s.y, 0.0);
      p.rotation.z = s.lean;
      p.scale.set(s.w, s.h, d * 0.72);
      c.setHSL(s.hue, 0.42, 0.38);
    },
    [items, d],
  );
  const fillCrate = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const s = items.crates[i];
      p.position.set(s.x, s.y, 0.0);
      p.scale.set(s.w, s.h, d * 0.78);
      c.setHSL(s.hue, 0.2, 0.74);
    },
    [items, d],
  );
  return (
    <group>
      <mesh position={[0, H - t / 2, 0]} castShadow receiveShadow material={white}>
        <boxGeometry args={[W, t, d]} />
      </mesh>
      <mesh position={[0, t / 2, 0]} castShadow receiveShadow material={white}>
        <boxGeometry args={[W, t, d]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - t / 2), H / 2, 0]} castShadow receiveShadow material={white}>
          <boxGeometry args={[t, H, d]} />
        </mesh>
      ))}
      <mesh position={[0, H / 2, -d / 2 + t / 2]} receiveShadow material={white}>
        <boxGeometry args={[W, H, t]} />
      </mesh>
      {Array.from({ length: cols - 1 }, (_, i) => (
        <mesh key={`v${i}`} position={[-W / 2 + (i + 1) * cell, H / 2, 0]} castShadow receiveShadow material={white}>
          <boxGeometry args={[t, H, d]} />
        </mesh>
      ))}
      {Array.from({ length: rows - 1 }, (_, i) => (
        <mesh key={`h${i}`} position={[0, (i + 1) * cell, 0]} castShadow receiveShadow material={white}>
          <boxGeometry args={[W, t, d]} />
        </mesh>
      ))}
      {items.spines.length > 0 ? <Inst count={items.spines.length} geometry={unit} material={paper} fill={fillSpine} cast={false} /> : null}
      {items.crates.length > 0 ? <Inst count={items.crates.length} geometry={unit} material={paper} fill={fillCrate} cast={false} /> : null}
    </group>
  );
}
