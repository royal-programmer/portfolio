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
import { blindsTexture, labelTexture, panelNormal } from "./textures";

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

/** A content board: a framed panel on the wall whose face the page draws from the content layer (lib/room3d/content.ts). */
export function Board({ o }: P<"board">) {
  const env = useEnv();
  const { w, h, lift, style } = o.params;
  const body = useMat(o.material);
  const tex = env.boards?.[o.id] ?? null;
  // Lit like a printed board, with a little self-light so it stays readable in the evening bands.
  const face = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, color: "#ffffff", roughness: 0.82, metalness: 0, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.34 }), [tex]);
  useEffect(() => () => face.dispose(), [face]);
  const shelf = style === "spines";
  return (
    <group position={[0, lift, 0]}>
      <RoundedBox args={[w + 0.05, h + 0.05, 0.035]} radius={0.008} smoothness={2} position={[0, 0, 0.0175]} castShadow receiveShadow material={body} />
      <mesh position={[0, 0, 0.0365]} userData={{ noShadow: true, board: true }} material={face}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {shelf ? (
        <RoundedBox args={[w + 0.08, 0.03, 0.14]} radius={0.008} smoothness={2} position={[0, -h / 2 - 0.03, 0.07]} castShadow receiveShadow material={body} />
      ) : null}
    </group>
  );
}

export function Window({ o }: P<"window">) {
  const env = useEnv();
  const { w, h, lift, panes, blinds, tubes } = o.params;
  const frame = useMat(o.material);
  // White horizontal blinds: one plane with a slat stripe repeating every 0.3 m of height (no per-slat meshes), hanging from the top of the opening.
  const bh = h * blinds;
  const slatMap = env.kit.tex("blinds", () => {
    const t = blindsTexture(10);
    t.wrapT = THREE.RepeatWrapping;
    return t;
  });
  const blindMat = useMemo(() => new THREE.MeshStandardMaterial({ map: env.kit.tiled("blinds", slatMap, [1, Math.max(0.2, bh / 0.3)]), roughness: 0.7, metalness: 0 }), [env.kit, slatMap, bh]);
  useEffect(() => () => blindMat.dispose(), [blindMat]);
  const tubeMat = env.kit.glow("#eef4ff", 3 * Math.max(0.6, env.light.emissiveBoost));
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
      {blinds > 0.01 ? (
        <mesh position={[0, h / 2 - bh / 2, 0.03]} userData={{ noShadow: true }} material={blindMat}>
          <planeGeometry args={[w, bh]} />
        </mesh>
      ) : null}
      {tubes
        ? [-1, 1].map((s) => (
            <mesh key={s} position={[s * (w / 2 + 0.2), 0, 0.05]} userData={{ noShadow: true }} material={tubeMat}>
              <cylinderGeometry args={[0.014, 0.014, h * 0.95, 8]} />
            </mesh>
          ))
        : null}
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
  // Six panels (two across, three down) as a normal map on the leaf: the grooves are in the map, not the geometry.
  const panels = env.kit.tex("door-panels", () => panelNormal(256, 2, 3, 1));
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ color: o.material.color, roughness: o.material.roughness, metalness: 0, normalMap: panels, normalScale: new THREE.Vector2(1.4, 1.4) }), [panels, o.material.color, o.material.roughness]);
  useEffect(() => () => leaf.dispose(), [leaf]);
  const frame = env.kit.mat("plastic", "#eef0f4", 0.6);
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

/** A long-pile shag rug: a thick slab, very rough, with a fine fuzzy normal map tiling every 0.5 m (no fur shells). */
export function Rug({ o }: P<"rug">) {
  const env = useEnv();
  const { w, d, shape } = o.params;
  const mat = env.kit.soft(o.material.color, Math.max(0.95, o.material.roughness), "shag", 1, 0.7, [w / 0.5, d / 0.5]);
  return shape === "round" ? (
    <mesh position={[0, 0.01, 0]} receiveShadow material={mat}>
      <cylinderGeometry args={[w / 2, w / 2, 0.02, 40]} />
    </mesh>
  ) : (
    <RoundedBox args={[w, 0.02, d]} radius={0.008} smoothness={2} position={[0, 0.01, 0]} receiveShadow material={mat} />
  );
}

/** The centre line of a neon tube: a rounded rectangle (`rect`, bottom-left at the origin) or a free-form wave, in the x-y plane. */
function neonCurve(path: "rect" | "wave", w: number, h: number): THREE.Curve<THREE.Vector3> {
  const pts: THREE.Vector3[] = [];
  if (path === "wave") {
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push(new THREE.Vector3(-w / 2 + t * w, h / 2 + (h / 2) * (0.8 * Math.sin(t * Math.PI * 3) + 0.2 * Math.sin(t * Math.PI * 6.2 + 1)), 0));
    }
    return new THREE.CatmullRomCurve3(pts, false, "centripetal");
  }
  const r = Math.min(0.07, w / 4, h / 4);
  const corner = (cx: number, cy: number, a0: number) => {
    for (let k = 0; k <= 3; k++) {
      const a = a0 + (k / 3) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
  };
  const edge = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    for (let k = 1; k < n; k++) pts.push(new THREE.Vector3(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, 0));
  };
  corner(w / 2 - r, r, -Math.PI / 2);
  edge(w / 2, r, w / 2, h - r, 3);
  corner(w / 2 - r, h - r, 0);
  edge(w / 2 - r, h, -w / 2 + r, h, 4);
  corner(-w / 2 + r, h - r, Math.PI / 2);
  edge(-w / 2, h - r, -w / 2, r, 3);
  corner(-w / 2 + r, r, Math.PI);
  edge(-w / 2 + r, 0, w / 2 - r, 0, 4);
  return new THREE.CatmullRomCurve3(pts, true, "centripetal");
}

/** A neon outline or wave: one low-poly tube along a curve, one draw, glowing (bloom picks it up on the high tier). */
function NeonTube({ o }: P<"neonStrip">) {
  const env = useEnv();
  const { lift, intensity, path, w, h } = o.params;
  const geo = env.kit.geo(`neon:${path}:${w}:${h}`,() => new THREE.TubeGeometry(neonCurve(path === "wave" ? "wave" : "rect", w, h), path === "wave" ? 90 : 120, 0.011, 6, path !== "wave"));
  return (
    <mesh geometry={geo} position={[0, lift, 0.022]} userData={{ noShadow: true }} material={env.kit.glow(o.material.color, intensity * env.light.emissiveBoost)} />
  );
}

export function NeonStrip({ o }: P<"neonStrip">) {
  const env = useEnv();
  const { length, vertical, lift, intensity } = o.params;
  if (o.params.path !== "line") return <NeonTube o={o} />;
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
