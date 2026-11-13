"use client";

/**
 * Room kit, part 2 (the rest of the kinds): shelf, books, plant, bed, wardrobe, frame, window, door, rug, neon
 * strip, guitar, MIDI keyboard, caps, key rack, bag, riding set, and the generic box, cylinder and sphere.
 * Same conventions as kit-work.tsx: metres, origin at the centre of the base, facing +z.
 */
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { KindId, ObjectOf } from "@/lib/room3d/schema";
import { Halo, Inst, useEnv, useImageTexture, useMat } from "./kit-core";
import { labelTexture } from "./textures";

type P<K extends KindId> = { o: ObjectOf<K> };
const hue = (i: number, s = 0.45, l = 0.32) => new THREE.Color().setHSL(((i * 0.137) % 1 + 1) % 1, s, l);

export function Shelf({ o }: P<"shelf">) {
  const { w, d, tiers, lift } = o.params;
  const wood = useMat(o.material);
  const iron = useMat({ preset: "metal", color: "#14151a", roughness: 0.4 });
  return (
    <group>
      {Array.from({ length: tiers }, (_, t) => (
        <group key={t} position={[0, lift + t * 0.38, 0]}>
          <RoundedBox args={[w, 0.035, d]} radius={0.01} smoothness={3} castShadow receiveShadow material={wood} />
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (w / 2 - 0.1), -0.06, -d * 0.1]} castShadow material={iron}>
              <boxGeometry args={[0.015, 0.09, d * 0.8]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export function BookStack({ o }: P<"bookStack">) {
  const env = useEnv();
  const { count, layout } = o.params;
  const geo = env.kit.geo("unit-box", () => new THREE.BoxGeometry(1, 1, 1));
  const mat = env.kit.mat("paper", "#ffffff", 0.7);
  const fill = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      c.copy(hue(i));
      if (layout === "row") {
        const w = 0.025 + (i % 3) * 0.008;
        const h = 0.17 + ((i * 7) % 5) * 0.018;
        let x = 0;
        for (let k = 0; k < i; k++) x += 0.025 + (k % 3) * 0.008 + 0.003;
        p.position.set(x + w / 2, h / 2, 0);
        p.rotation.z = i === count - 1 && count > 4 ? -0.12 : 0;
        p.scale.set(w, h, 0.15);
      } else {
        p.position.set(((i * 7) % 5) * 0.004 - 0.01, 0.015 + i * 0.03, 0);
        p.rotation.y = ((i * 13) % 7) * 0.05 - 0.15;
        p.scale.set(0.2 - (i % 3) * 0.015, 0.028, 0.15);
      }
    },
    [count, layout],
  );
  return <Inst count={count} geometry={geo} material={mat} fill={fill} />;
}

export function Plant({ o }: P<"plant">) {
  const env = useEnv();
  const { height, leaves, pot } = o.params;
  const s = height / 0.9;
  const potMat = useMat(o.material.preset === "leaf" ? { preset: "ceramic", color: "#d9cfc4", roughness: 0.7 } : o.material);
  const soil = env.kit.mat("paper", "#2a1d14", 1);
  const stem = env.kit.mat("leaf", "#2c4a2a", 0.8);
  const leafMat = env.kit.mat("leaf", "#ffffff", 0.6);
  const leafGeo = env.kit.geo("leaf", () => new THREE.SphereGeometry(1, 12, 8));
  const base = o.material.preset === "leaf" ? o.material.color : "#35623a";
  const fill = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const a = i * 2.399;
      const lift = 0.15 + (i % 7) * 0.075;
      const rad = 0.04 + lift * 0.45;
      p.position.set(Math.cos(a) * rad, 0.3 + lift, Math.sin(a) * rad);
      p.rotation.set(0.5 + (i % 3) * 0.15, -a, 0.2);
      p.scale.set(0.06 + (i % 4) * 0.01, 0.008, 0.15 + (i % 5) * 0.02);
      c.set(base).offsetHSL(((i % 5) - 2) * 0.01, 0, ((i % 4) - 1.5) * 0.03);
    },
    [base],
  );
  return (
    <group scale={s}>
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow material={potMat}>
        {pot === "round" ? <cylinderGeometry args={[0.17, 0.12, 0.34, 24]} /> : <boxGeometry args={[0.3, 0.34, 0.3]} />}
      </mesh>
      <mesh position={[0, 0.335, 0]} material={soil}>
        <cylinderGeometry args={[0.155, 0.155, 0.02, 24]} />
      </mesh>
      {[0.0, 0.5, -0.4, 1.0, -0.9].map((r, i) => (
        <mesh key={i} position={[Math.sin(r) * 0.03, 0.55, Math.cos(r) * 0.03]} rotation={[Math.cos(r) * 0.2, 0, -Math.sin(r) * 0.2]} castShadow material={stem}>
          <cylinderGeometry args={[0.004, 0.006, 0.45, 5]} />
        </mesh>
      ))}
      <Inst count={leaves} geometry={leafGeo} material={leafMat} fill={fill} />
    </group>
  );
}

export function Bed({ o }: P<"bed"> ) {
  const env = useEnv();
  const { size, pillows } = o.params;
  const w = size === "single" ? 0.95 : 1.45;
  const frame = env.kit.mat("wood", "#6b4a30", 0.6);
  const sheet = useMat(o.material);
  const pillow = env.kit.mat("fabric", "#e8e6ee", 0.9);
  return (
    <group>
      <RoundedBox args={[w + 0.08, 0.28, 2.05]} radius={0.03} smoothness={3} position={[0, 0.14, 0]} castShadow receiveShadow material={frame} />
      <RoundedBox args={[w, 0.2, 1.95]} radius={0.06} smoothness={4} position={[0, 0.36, 0.0]} castShadow receiveShadow material={sheet} />
      <RoundedBox args={[w + 0.08, 0.7, 0.06]} radius={0.02} smoothness={3} position={[0, 0.55, -1.03]} castShadow material={frame} />
      {Array.from({ length: pillows }, (_, i) => (
        <RoundedBox key={i} args={[w / Math.max(1, Math.min(2, pillows)) - 0.08, 0.1, 0.38]} radius={0.04} smoothness={4} position={[(i % 2 ? 1 : -1) * (pillows > 1 ? w / 4 : 0), 0.52, -0.78 + Math.floor(i / 2) * 0.1]} rotation={[-0.12, 0, 0]} castShadow material={pillow} />
      ))}
    </group>
  );
}

export function Wardrobe({ o }: P<"wardrobe">) {
  const env = useEnv();
  const { w, h, d, open, clothes } = o.params;
  const body = useMat(o.material);
  const inner = env.kit.mat("wood", "#2a2018", 0.8);
  const rod = env.kit.mat("metal", "#b8bcc6", 0.3);
  const cloth = env.kit.mat("fabric", "#ffffff", 0.9);
  const geo = env.kit.geo("unit-box", () => new THREE.BoxGeometry(1, 1, 1));
  const fill = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const span = w - 0.12;
      p.position.set(-span / 2 + 0.03 + (i * (span - 0.06)) / Math.max(1, clothes - 1), h * 0.62, 0);
      p.rotation.y = 0.12 * ((i % 3) - 1);
      p.scale.set(0.03 + (i % 3) * 0.008, h * (0.3 + (i % 4) * 0.04), d * 0.7);
      c.copy(hue(i * 3 + 1, 0.5, 0.35));
    },
    [clothes, w, h, d],
  );
  const open1 = open ? 1.7 : 0;
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
      <mesh position={[0, 0.01, 0]} material={inner}>
        <boxGeometry args={[w - 0.04, 0.02, d - 0.02]} />
      </mesh>
      <mesh position={[0, h * 0.8, 0]} rotation={[0, 0, Math.PI / 2]} material={rod}>
        <cylinderGeometry args={[0.012, 0.012, w - 0.05, 8]} />
      </mesh>
      {clothes > 0 ? <Inst count={clothes} geometry={geo} material={cloth} fill={fill} /> : null}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (w / 2), 0, d / 2]} rotation={[0, -s * open1, 0]}>
          <mesh position={[-s * (w / 4), h / 2, 0]} castShadow material={body}>
            <boxGeometry args={[w / 2 - 0.005, h - 0.02, 0.02]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Frame({ o }: P<"frame">) {
  const env = useEnv();
  const { variant, w, h, image, title } = o.params;
  const body = useMat(o.material);
  const { tex } = useImageTexture(image, title, w / h);
  const t = variant === "canvas" ? 0.04 : 0.025;
  const m = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), [tex]);
  useEffect(() => () => m.dispose(), [m]);
  void env;
  return (
    <group>
      <RoundedBox args={[w, h, t]} radius={0.005} smoothness={2} castShadow material={variant === "poster" ? env.kit.mat("paper", "#e8e6ee", 0.8) : body} />
      <mesh position={[0, 0, t / 2 + 0.0008]} userData={{ noShadow: true }} material={m}>
        <planeGeometry args={[variant === "poster" ? w - 0.01 : w - 0.06, variant === "poster" ? h - 0.01 : h - 0.06]} />
      </mesh>
    </group>
  );
}

export function Window({ o }: P<"window">) {
  const env = useEnv();
  const { w, h, lift, panes } = o.params;
  const frame = useMat(o.material);
  const wl = env.light.windowLight;
  const lit = wl.intensity > 0;
  const sky = env.kit.tex(`sky:${wl.color}:${lit}`, () => {
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 128;
    const g = c.getContext("2d")!;
    const gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, lit ? wl.color : "#0a1020");
    gr.addColorStop(1, lit ? "#ffffff" : "#16203a");
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const pane = useMemo(() => new THREE.MeshBasicMaterial({ map: sky, toneMapped: false, color: new THREE.Color("#ffffff").multiplyScalar(lit ? 0.6 + wl.intensity * 0.65 : 0.5) }), [sky, lit, wl.intensity]);
  useEffect(() => () => pane.dispose(), [pane]);
  return (
    <group position={[0, lift + h / 2, 0.0]}>
      <mesh userData={{ noShadow: true }} material={pane}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {[
        [0, h / 2 + 0.025, w + 0.1, 0.05],
        [0, -h / 2 - 0.025, w + 0.1, 0.05],
        [-w / 2 - 0.025, 0, 0.05, h + 0.1],
        [w / 2 + 0.025, 0, 0.05, h + 0.1],
        ...Array.from({ length: panes - 1 }, (_, i): [number, number, number, number] => [-w / 2 + (w * (i + 1)) / panes, 0, 0.03, h]),
        [0, h * 0.1, w, 0.03],
      ].map(([x, y, bw, bh], i) => (
        <RoundedBox key={i} args={[bw, bh, 0.07]} radius={0.01} smoothness={2} position={[x, y, 0.035]} castShadow material={frame} />
      ))}
    </group>
  );
}

/** A door in the wall: hovers ajar, swings open when its click has run, snaps when motion is reduced. */
export function Door({ o }: P<"door">) {
  const env = useEnv();
  const { w, h, swing } = o.params;
  const leaf = useMat(o.material);
  const frame = env.kit.mat("wood", "#d9d4cc", 0.6);
  const knob = env.kit.mat("metal", "#c8a24a", 0.3);
  const pivot = useRef<THREE.Group>(null);
  const angle = useRef(0);
  const hovered = env.hoverId === o.id;
  const opened = env.openIds.has(o.id);
  useFrame((_, dt) => {
    const target = opened ? swing : hovered ? Math.min(swing, 0.35) : 0;
    angle.current = env.reduced ? target : angle.current + (target - angle.current) * Math.min(1, dt * 6);
    if (pivot.current) pivot.current.rotation.y = angle.current;
  });
  return (
    <group>
      <mesh position={[0, h / 2, -0.04]} material={env.kit.mat("plastic", "#05060a", 1)} userData={{ noShadow: true }}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {[
        [0, h + 0.03, w + 0.12, 0.06],
        [-w / 2 - 0.03, h / 2, 0.06, h],
        [w / 2 + 0.03, h / 2, 0.06, h],
      ].map(([x, y, bw, bh], i) => (
        <mesh key={i} position={[x, y, 0.0]} castShadow material={frame}>
          <boxGeometry args={[bw, bh, 0.08]} />
        </mesh>
      ))}
      <group ref={pivot} position={[-w / 2, 0, 0.0]} userData={{ dynamic: true }}>
        <RoundedBox args={[w - 0.01, h - 0.01, 0.04]} radius={0.005} smoothness={2} position={[w / 2, h / 2, 0.02]} castShadow receiveShadow material={leaf} />
        <mesh position={[w - 0.08, h * 0.48, 0.055]} material={knob}>
          <sphereGeometry args={[0.025, 12, 8]} />
        </mesh>
      </group>
    </group>
  );
}

export function Rug({ o }: P<"rug">) {
  const { w, d, shape } = o.params;
  const mat = useMat(o.material);
  return shape === "round" ? (
    <mesh position={[0, 0.006, 0]} receiveShadow material={mat}>
      <cylinderGeometry args={[w / 2, w / 2, 0.012, 40]} />
    </mesh>
  ) : (
    <RoundedBox args={[w, 0.012, d]} radius={0.005} smoothness={2} position={[0, 0.006, 0]} receiveShadow material={mat} />
  );
}

export function NeonStrip({ o }: P<"neonStrip">) {
  const env = useEnv();
  const { length, vertical, lift, intensity } = o.params;
  const k = intensity * env.light.emissiveBoost;
  const col = o.material.color;
  const mid = lift + (vertical ? length / 2 : 0);
  return (
    <group>
      <mesh position={[0, mid, 0.02]} userData={{ noShadow: true }} material={env.kit.glow(col, k)}>
        <boxGeometry args={vertical ? [0.022, length, 0.022] : [length, 0.022, 0.022]} />
      </mesh>
      {env.tier.shadowRes > 0 ? <pointLight position={[0, mid, 0.35]} color={col} intensity={0.9 * env.light.emissiveBoost} distance={3} decay={2} /> : null}
      <Halo position={[0, mid, 0.04]} size={vertical ? [0.4, length + 0.4] : [length + 0.6, 0.5]} color={col} opacity={Math.min(0.6, 0.12 * k)} />
    </group>
  );
}

export function Guitar({ o }: P<"guitar">) {
  const body = useMat(o.material);
  const neck = useMat({ preset: "wood", color: "#4a3422", roughness: 0.5 });
  const steel = useMat({ preset: "metal", color: "#14151a", roughness: 0.4 });
  return (
    <group>
      {o.params.stand ? (
        <>
          <mesh position={[0, 0.3, -0.05]} rotation={[0.15, 0, 0]} castShadow material={steel}>
            <cylinderGeometry args={[0.012, 0.012, 0.6, 8]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[Math.sin((i * Math.PI * 2) / 3) * 0.12, 0.015, Math.cos((i * Math.PI * 2) / 3) * 0.12 - 0.05]} rotation={[0, (i * Math.PI * 2) / 3, 0]} material={steel}>
              <boxGeometry args={[0.02, 0.02, 0.25]} />
            </mesh>
          ))}
        </>
      ) : null}
      <group position={[0, 0.55, 0.02]} rotation={[0.15, 0, 0]}>
        <mesh scale={[1, 1.15, 0.28]} position={[0, -0.12, 0]} castShadow material={body}>
          <sphereGeometry args={[0.16, 20, 14]} />
        </mesh>
        <mesh scale={[1, 0.9, 0.28]} position={[0, 0.05, 0]} castShadow material={body}>
          <sphereGeometry args={[0.12, 20, 14]} />
        </mesh>
        <mesh position={[0, 0.4, 0]} castShadow material={neck}>
          <boxGeometry args={[0.045, 0.62, 0.025]} />
        </mesh>
        <mesh position={[0, 0.75, 0]} castShadow material={neck}>
          <boxGeometry args={[0.07, 0.13, 0.02]} />
        </mesh>
      </group>
    </group>
  );
}

export function MidiKeyboard({ o }: P<"midiKeyboard">) {
  const env = useEnv();
  const { keys } = o.params;
  const body = useMat(o.material);
  const white = Math.ceil((keys * 7) / 12);
  const whiteMat = env.kit.mat("plastic", "#ececf2", 0.4);
  const blackMat = env.kit.mat("plastic", "#101116", 0.4);
  const geo = env.kit.geo("unit-box", () => new THREE.BoxGeometry(1, 1, 1));
  const width = white * 0.0235;
  const blackIdx = useMemo(() => Array.from({ length: white - 1 }, (_, i) => i).filter((i) => [0, 1, 3, 4, 5].includes(i % 7)), [white]);
  const fillW = useCallback((i: number, p: THREE.Object3D) => {
    p.position.set(-width / 2 + 0.0118 + i * 0.0235, 0.012, 0.03);
    p.scale.set(0.0225, 0.014, 0.13);
  }, [width]);
  const fillB = useCallback((i: number, p: THREE.Object3D) => {
    p.position.set(-width / 2 + 0.0235 * (blackIdx[i] + 1), 0.022, 0.0);
    p.scale.set(0.013, 0.014, 0.08);
  }, [width, blackIdx]);
  return (
    <group>
      <RoundedBox args={[width + 0.06, 0.03, 0.22]} radius={0.01} smoothness={3} position={[0, 0.015, 0]} castShadow material={body} />
      <Inst count={white} geometry={geo} material={whiteMat} fill={fillW} />
      <Inst count={blackIdx.length} geometry={geo} material={blackMat} fill={fillB} />
    </group>
  );
}

export function CapRow({ o }: P<"capRow">) {
  const env = useEnv();
  const { count, spacing, lift } = o.params;
  const dome = env.kit.geo("cap-dome", () => new THREE.SphereGeometry(0.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const brim = env.kit.geo("cap-brim", () => new THREE.CylinderGeometry(0.09, 0.09, 0.008, 14, 1, false, 0, Math.PI));
  const mat = env.kit.mat("fabric", "#ffffff", 0.9);
  const fillD = useCallback((i: number, p: THREE.Object3D, c: THREE.Color) => {
    p.position.set(i * spacing, lift, 0.1);
    p.rotation.x = Math.PI / 2 - 0.2;
    c.copy(hue(i * 2, 0.55, 0.4));
  }, [spacing, lift]);
  const fillB = useCallback((i: number, p: THREE.Object3D, c: THREE.Color) => {
    p.position.set(i * spacing, lift - 0.015, 0.2);
    p.rotation.set(0.15, Math.PI / 2, 0);
    p.scale.set(1, 1, 1.4);
    c.copy(hue(i * 2, 0.55, 0.34));
  }, [spacing, lift]);
  return (
    <group position={[(-(count - 1) * spacing) / 2, 0, 0]}>
      <Inst count={count} geometry={dome} material={mat} fill={fillD} />
      <Inst count={count} geometry={brim} material={mat} fill={fillB} />
    </group>
  );
}

export function KeyRack({ o }: P<"keyRack">) {
  const env = useEnv();
  const { keys, w, lift } = o.params;
  const board = useMat(o.material);
  const geo = env.kit.geo("unit-box", () => new THREE.BoxGeometry(1, 1, 1));
  const mat = env.kit.mat("metal", "#ffffff", 0.35);
  const fill = useCallback((i: number, p: THREE.Object3D, c: THREE.Color) => {
    const x = -w / 2 + 0.05 + (i * (w - 0.1)) / Math.max(1, keys - 1);
    p.position.set(x, lift - 0.07 - (i % 3) * 0.015, 0.04);
    p.rotation.z = ((i % 5) - 2) * 0.05;
    p.scale.set(0.022, 0.07, 0.004);
    c.set(i % 4 === 0 ? "#d9a441" : i % 4 === 1 ? "#b8bcc6" : i % 4 === 2 ? "#9a7a3a" : "#7d8aa6");
  }, [keys, w, lift]);
  return (
    <group>
      <RoundedBox args={[w, 0.12, 0.03]} radius={0.008} smoothness={2} position={[0, lift, 0.015]} castShadow material={board} />
      <Inst count={keys} geometry={geo} material={mat} fill={fill} />
    </group>
  );
}

export function Bag({ o }: P<"bag">) {
  const body = useMat(o.material);
  const { label, image } = o.params;
  const { tex } = useImageTexture(image, label, 1.5);
  const labelMat = useMemo(() => new THREE.MeshBasicMaterial({ map: image ? tex : null, toneMapped: false }), [tex, image]);
  const textTex = useMemo(() => labelTexture(label || " ", 256, 170, "#00000000", "#ffffff"), [label]);
  useEffect(() => () => labelMat.dispose(), [labelMat]);
  useEffect(() => () => textTex.dispose(), [textTex]);
  return (
    <group>
      <RoundedBox args={[0.42, 0.3, 0.2]} radius={0.05} smoothness={4} position={[0, 0.15, 0]} castShadow receiveShadow material={body} />
      <mesh position={[0, 0.17, 0.103]} userData={{ noShadow: true }} material={image ? labelMat : undefined}>
        <planeGeometry args={[0.24, 0.16]} />
        {image ? null : <meshBasicMaterial map={textTex} transparent toneMapped={false} />}
      </mesh>
      <mesh position={[0, 0.31, 0]} rotation={[0, 0, 0]} castShadow material={body}>
        <torusGeometry args={[0.08, 0.008, 8, 16, Math.PI]} />
      </mesh>
    </group>
  );
}

export function RidingSet({ o }: P<"ridingSet">) {
  const body = useMat(o.material);
  const dark = useMat({ preset: "rubber", color: "#111216", roughness: 0.6 });
  const visor = useMat({ preset: "glass", color: "#222733", roughness: 0.1 });
  const { helmet, jacket, gloves, boots } = o.params;
  return (
    <group>
      {helmet ? (
        <group position={[-0.35, 1.45, 0.1]}>
          <mesh castShadow material={body}>
            <sphereGeometry args={[0.15, 18, 12]} />
          </mesh>
          <mesh position={[0, -0.01, 0.08]} scale={[1, 0.55, 0.6]} material={visor}>
            <sphereGeometry args={[0.12, 14, 8]} />
          </mesh>
        </group>
      ) : null}
      {jacket ? (
        <group position={[0.1, 1.3, 0.06]}>
          <RoundedBox args={[0.5, 0.6, 0.12]} radius={0.04} smoothness={3} castShadow material={body} />
          {[-1, 1].map((s) => (
            <RoundedBox key={s} args={[0.14, 0.55, 0.11]} radius={0.04} smoothness={3} position={[s * 0.34, -0.03, 0]} rotation={[0, 0, s * 0.12]} castShadow material={body} />
          ))}
        </group>
      ) : null}
      {gloves
        ? [-1, 1].map((s) => (
            <RoundedBox key={s} args={[0.1, 0.2, 0.05]} radius={0.02} smoothness={3} position={[0.62 + s * 0.07, 1.2, 0.06]} castShadow material={dark} />
          ))
        : null}
      {boots
        ? [-1, 1].map((s) => (
            <group key={s} position={[0.3 + s * 0.12, 0.0, 0.2]}>
              <RoundedBox args={[0.11, 0.3, 0.12]} radius={0.03} smoothness={3} position={[0, 0.15, 0]} castShadow material={dark} />
              <RoundedBox args={[0.11, 0.07, 0.24]} radius={0.03} smoothness={3} position={[0, 0.035, 0.07]} castShadow material={dark} />
            </group>
          ))
        : null}
    </group>
  );
}

export function Box({ o }: P<"box">) {
  const { w, h, d, round } = o.params;
  const mat = useMat(o.material);
  return round > 0.001 ? (
    <RoundedBox args={[w, h, d]} radius={Math.min(round, Math.min(w, h, d) / 2 - 0.0005)} smoothness={3} position={[0, h / 2, 0]} castShadow receiveShadow material={mat} />
  ) : (
    <mesh position={[0, h / 2, 0]} castShadow receiveShadow material={mat}>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
}

export function Cylinder({ o }: P<"cylinder">) {
  const mat = useMat(o.material);
  return (
    <mesh position={[0, o.params.h / 2, 0]} castShadow receiveShadow material={mat}>
      <cylinderGeometry args={[o.params.r, o.params.r, o.params.h, 24]} />
    </mesh>
  );
}

export function Sphere({ o }: P<"sphere">) {
  const mat = useMat(o.material);
  return (
    <mesh position={[0, o.params.r, 0]} castShadow receiveShadow material={mat}>
      <sphereGeometry args={[o.params.r, 24, 16]} />
    </mesh>
  );
}
