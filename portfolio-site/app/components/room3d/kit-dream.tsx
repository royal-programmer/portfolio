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
import type { KindId, ObjectOf } from "@/lib/room3d/schema";
import { Inst, useEnv, useMat } from "./kit-core";

type P<K extends KindId> = { o: ObjectOf<K> };
type V3 = [number, number, number];

/** A rounded box that never asks for a radius bigger than half its smallest side. */
function Rb({ a, p, r = 0.01, m, rot, cast = true }: { a: V3; p: V3; r?: number; m: THREE.Material; rot?: V3; cast?: boolean }) {
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
  const { size, pillows, blanket, headboard } = o.params;
  const w = size === "single" ? 0.9 : 1.4;
  const wood = env.kit.mat("wood", "#6b4a30", 0.6);
  const sheet = useMat(o.material);
  const mattress = env.kit.mat("fabric", "#e9e6df", 0.95);
  const pillow = env.kit.mat("fabric", "#f1efe9", 0.92);
  const fold = env.kit.mat("fabric", "#cdbb9c", 0.95);
  const legGeo = env.kit.geo("bed-leg", () => new THREE.BoxGeometry(0.05, 0.1, 0.05));
  return (
    <group>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx, sz] as const)).map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} geometry={legGeo} position={[sx * (w / 2 - 0.0), 0.05, sz * 0.94]} castShadow material={wood} />
      ))}
      <Rb a={[w + 0.08, 0.16, 2.0]} p={[0, 0.18, 0]} r={0.03} m={wood} />
      <Rb a={[w, 0.18, 1.9]} p={[0, 0.35, 0.0]} r={0.05} m={mattress} />
      {headboard ? (
        <>
          <Rb a={[w + 0.1, 0.92, 0.05]} p={[0, 0.46, -1.025]} r={0.02} m={wood} />
          <Rb a={[w - 0.1, 0.5, 0.025]} p={[0, 0.7, -0.99]} r={0.015} m={env.kit.mat("wood", "#7a553a", 0.55)} />
          <Rb a={[w + 0.08, 0.4, 0.05]} p={[0, 0.2, 1.025]} r={0.02} m={wood} />
        </>
      ) : null}
      <Rb a={[w - 0.02, 0.07, 1.3]} p={[0, 0.475, 0.25]} r={0.035} m={sheet} />
      {blanket ? (
        <>
          <Rb a={[w - 0.04, 0.1, 0.46]} p={[0, 0.54, 0.62]} r={0.04} m={fold} />
          <Rb a={[w - 0.1, 0.02, 0.4]} p={[0, 0.605, 0.62]} r={0.01} m={env.kit.mat("fabric", "#b9a583", 0.95)} />
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

export function Wardrobe({ o }: P<"wardrobe">) {
  const env = useEnv();
  const { w, h, d, open, clothes } = o.params;
  const body = useMat(o.material);
  const inner = env.kit.mat("wood", "#2a2018", 0.8);
  const rod = env.kit.mat("metal", "#b8bcc6", 0.3);
  const handle = env.kit.mat("metal", "#a9adb8", 0.3);
  const unit = env.kit.geo("unit-box", () => new THREE.BoxGeometry(1, 1, 1));
  const hanger = env.kit.geo("hanger", hangerGeometry);
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
  const fillSleeve = useCallback(
    (j: number, p: THREE.Object3D, c: THREE.Color) => {
      const i = j >> 1;
      const side = j & 1 ? 1 : -1;
      const g = garment(i);
      const len = g.len * 0.78;
      const yaw = 0.1 * ((i % 3) - 1);
      // The sleeve hangs from the shoulder, a little outside the body, in the garment's own (turned) frame.
      const zo = side * (g.width * 0.43 + 0.02);
      p.position.set(xAt(i) + Math.sin(yaw) * zo, rodY - 0.09 - len / 2, Math.cos(yaw) * zo);
      p.rotation.set(side * 0.07, yaw, 0);
      p.scale.set(g.thick * 0.9, len, 0.08);
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
    angle.current = env.reduced ? target : angle.current + (target - angle.current) * Math.min(1, dt * 5);
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
          <Inst count={clothes} geometry={unit} material={cloth} fill={fillBody} />
          <Inst count={clothes * 2} geometry={unit} material={cloth} fill={fillSleeve} cast={false} />
        </>
      ) : null}
      {[-1, 1].map((s, k) => (
        <group key={s} ref={(g) => void (leaves.current[k] = g)} position={[s * (w / 2 - 0.01), 0, d / 2 - 0.01]} userData={{ dynamic: true }}>
          <mesh position={[-s * (w / 4 - 0.005), h / 2, 0]} castShadow material={body}>
            <boxGeometry args={[w / 2 - 0.01, h - 0.02, 0.022]} />
          </mesh>
          <mesh position={[-s * (w / 4 - 0.005), h / 2, 0.0135]} castShadow receiveShadow material={body}>
            <boxGeometry args={[w / 2 - 0.16, h - 0.2, 0.006]} />
          </mesh>
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

export function Guitar({ o }: P<"guitar">) {
  const env = useEnv();
  const { stand } = o.params;
  const body = useMat(o.material);
  const neckMat = env.kit.mat("wood", "#5a3d27", 0.5);
  const board = env.kit.mat("wood", "#1d1510", 0.45);
  const steel = env.kit.mat("metal", "#14151a", 0.4);
  const bright = env.kit.mat("metal", "#cfd3dc", 0.25);
  const dark = env.kit.mat("plastic", "#0b0b0e", 0.6);
  const top = env.kit.mat("wood", "#d9a566", 0.4);
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
  const { count, spacing, lift } = o.params;
  const dome = env.kit.geo("cap-dome", () => new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const brim = env.kit.geo("cap-brim", () => new THREE.CylinderGeometry(0.09, 0.09, 0.008, 14, 1, false, 0, Math.PI));
  const mat = env.kit.mat("fabric", "#ffffff", 0.9);
  const wood = env.kit.mat("wood", "#4a3422", 0.5);
  const peg = env.kit.mat("metal", "#b8bcc6", 0.3);
  const hue = (i: number) => new THREE.Color().setHSL(((i * 2 * 0.137) % 1 + 1) % 1, 0.55, 0.4);
  const fillD = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      p.position.set(i * spacing, lift, 0.1);
      p.rotation.x = Math.PI / 2 - 0.2;
      c.copy(hue(i));
    },
    [spacing, lift],
  );
  const fillB = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      p.position.set(i * spacing, lift - 0.015, 0.2);
      p.rotation.set(0.15, Math.PI / 2, 0);
      p.scale.set(1, 1, 1.4);
      c.copy(hue(i).multiplyScalar(0.85));
    },
    [spacing, lift],
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
        <Inst count={count} geometry={dome} material={mat} fill={fillD} />
        <Inst count={count} geometry={brim} material={mat} fill={fillB} />
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

export function KeyRack({ o }: P<"keyRack">) {
  const env = useEnv();
  const { keys, w, lift, labels } = o.params;
  const board = useMat(o.material);
  const peg = env.kit.mat("metal", "#b8bcc6", 0.3);
  const unit = env.kit.geo("unit-box", () => new THREE.BoxGeometry(1, 1, 1));
  const ring = env.kit.geo("key-ring", () => new THREE.TorusGeometry(0.011, 0.0018, 6, 14));
  const metal = env.kit.mat("metal", "#ffffff", 0.3);
  const plastic = env.kit.mat("plastic", "#ffffff", 0.45);
  const xAt = (i: number) => (keys === 1 ? 0 : -w / 2 + 0.05 + (i * (w - 0.1)) / (keys - 1));
  const tex = env.kit.tex(`tags:${w}:${keys}:${labels.join("|")}`, () => tagTexture(labels, keys, w));
  const tagMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.22 }), [tex]);
  useEffect(() => () => tagMat.dispose(), [tagMat]);
  const fillHead = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const fob = i % 2 === 1;
      p.position.set(xAt(i), lift - 0.075, 0.045);
      p.rotation.z = ((i % 5) - 2) * 0.04;
      p.scale.set(fob ? 0.03 : 0.024, fob ? 0.052 : 0.036, 0.011);
      c.set(fob ? "#15161b" : "#d9801f");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, w, lift],
  );
  const fillBlade = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const fob = i % 2 === 1;
      p.position.set(xAt(i), lift - (fob ? 0.13 : 0.115), 0.045);
      p.rotation.z = ((i % 5) - 2) * 0.04;
      p.scale.set(0.009, fob ? 0.036 : 0.05, 0.003);
      c.set(fob ? "#9aa0ad" : "#cfd3dc");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys, w, lift],
  );
  const fillRing = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      p.position.set(xAt(i), lift - 0.033, 0.045);
      c.set("#c8ccd6");
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
      <Inst count={keys} geometry={unit} material={plastic} fill={fillHead} cast={false} />
      <Inst count={keys} geometry={unit} material={metal} fill={fillBlade} cast={false} />
      <Inst count={keys} geometry={ring} material={metal} fill={fillRing} cast={false} />
      {labels.length > 0 ? (
        <mesh position={[0, lift - 0.205, 0.0305]} userData={{ noShadow: true }} material={tagMat}>
          <planeGeometry args={[w - 0.02, (w - 0.02) / 8]} />
        </mesh>
      ) : null}
    </group>
  );
}

export function RidingSet({ o }: P<"ridingSet">) {
  const env = useEnv();
  const { helmet, jacket, pants, gloves, boots } = o.params;
  const body = useMat(o.material);
  const shell = env.kit.mat("plastic", o.material.color, 0.22);
  const dark = env.kit.mat("rubber", "#111216", 0.6);
  const legs = env.kit.mat("fabric", "#20232a", 0.85);
  const visor = env.kit.mat("plastic", "#14161d", 0.12);
  const backing = env.kit.mat("wood", "#2b2b30", 0.6);
  const steel = env.kit.mat("metal", "#b8bcc6", 0.3);
  const accent = env.kit.mat("plastic", "#e8e6ee", 0.4);
  return (
    <group>
      <Rb a={[0.86, 1.9, 0.02]} p={[0, 1.2, 0.01]} r={0.01} m={backing} cast={false} />
      {helmet ? (
        <group position={[0, 1.93, 0.17]}>
          <Rb a={[0.2, 0.025, 0.2]} p={[0, -0.16, -0.05]} r={0.008} m={steel} />
          <mesh scale={[0.95, 1.0, 1.15]} castShadow material={shell}>
            <sphereGeometry args={[0.14, 24, 16]} />
          </mesh>
          <Rb a={[0.17, 0.085, 0.14]} p={[0, -0.095, 0.075]} r={0.035} m={shell} />
          <mesh position={[0, 0.0, 0.1]} scale={[1, 0.5, 0.55]} material={visor}>
            <sphereGeometry args={[0.125, 18, 10]} />
          </mesh>
          <mesh position={[0, 0.115, 0.0]} scale={[0.06, 0.012, 0.9]} material={accent}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        </group>
      ) : null}
      {gloves
        ? [-1, 1].map((s) => (
            <group key={s} position={[s * 0.33, 1.9, 0.05]} rotation={[0, 0, s * 0.08]}>
              <Rb a={[0.085, 0.13, 0.04]} p={[0, 0, 0]} r={0.02} m={dark} />
              <Rb a={[0.075, 0.07, 0.036]} p={[0, -0.095, 0]} r={0.02} m={dark} />
            </group>
          ))
        : null}
      {jacket ? (
        <group position={[0, 1.38, 0.08]}>
          <Rb a={[0.5, 0.58, 0.11]} p={[0, 0, 0]} r={0.04} m={body} />
          <Rb a={[0.5, 0.05, 0.116]} p={[0, -0.1, 0]} r={0.015} m={dark} />
          <Rb a={[0.012, 0.58, 0.118]} p={[0, 0, 0.0]} r={0.004} m={dark} />
          <Rb a={[0.22, 0.05, 0.1]} p={[0, 0.3, 0]} r={0.02} m={dark} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Rb a={[0.12, 0.54, 0.1]} p={[s * 0.34, -0.03, 0]} rot={[0, 0, s * 0.1]} r={0.04} m={body} />
              <mesh position={[s * 0.285, 0.27, 0]} scale={[1.2, 0.8, 1.1]} castShadow material={dark}>
                <sphereGeometry args={[0.06, 12, 8]} />
              </mesh>
              <Rb a={[0.1, 0.1, 0.107]} p={[s * 0.36, -0.06, 0]} rot={[0, 0, s * 0.1]} r={0.03} m={dark} />
            </group>
          ))}
        </group>
      ) : null}
      {pants ? (
        <group position={[0, 0.68, 0.07]}>
          <Rb a={[0.38, 0.06, 0.11]} p={[0, 0.35, 0]} r={0.02} m={dark} />
          {[-1, 1].map((s) => (
            <group key={s}>
              <Rb a={[0.18, 0.74, 0.1]} p={[s * 0.1, 0, 0]} r={0.04} m={legs} />
              <Rb a={[0.1, 0.12, 0.02]} p={[s * 0.1, -0.05, 0.055]} r={0.012} m={dark} />
            </group>
          ))}
        </group>
      ) : null}
      {boots
        ? [-1, 1].map((s) => (
            <group key={s} position={[s * 0.115, 0, 0.17]}>
              <Rb a={[0.11, 0.26, 0.12]} p={[0, 0.17, -0.01]} r={0.035} m={dark} />
              <Rb a={[0.11, 0.07, 0.26]} p={[0, 0.045, 0.06]} r={0.03} m={dark} />
              <Rb a={[0.112, 0.014, 0.265]} p={[0, 0.008, 0.06]} r={0.005} m={steel} cast={false} />
            </group>
          ))
        : null}
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

export function Football({ o }: P<"football">) {
  const env = useEnv();
  const tex = env.kit.tex("football", footballTexture);
  const m = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, color: o.material.color, roughness: o.material.roughness, metalness: 0 }), [tex, o.material.color, o.material.roughness]);
  useEffect(() => () => m.dispose(), [m]);
  return (
    <mesh position={[0, o.params.r, 0]} castShadow receiveShadow material={m}>
      <sphereGeometry args={[o.params.r, 24, 16]} />
    </mesh>
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
