"use client";

/**
 * Room kit, the reference room's pieces (round 37e, docs/claude-planning/19-room-style-references.md): the bi-fold closet, the ceiling
 * fan, the triangle light panels and the pegboard of keyboards. Same conventions as kit-dream.tsx (metres, origin at the middle of the
 * base, facing +z; the fan and the panels are placed by their own notes). Everything is built from primitives with the kit's cached
 * materials so the static merge folds it into a few draws; repeated things are instanced, and what moves (a closet's leaves, the fan's
 * blades) sits in a `dynamic` group.
 */
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { closetOpenness, closetPairs, foldPose, panelCells, panelCorners, pegGrid } from "@/lib/room3d/reference";
import type { KindId, ObjectOf } from "@/lib/room3d/schema";
import { Rb } from "./kit-dream";
import { MidiKeyboard } from "./kit-decor";
import { Inst, useEnv, useMat } from "./kit-core";
import { ModelBoundary } from "./kit-model";
import { pegTexture } from "./textures";

type P<K extends KindId> = { o: ObjectOf<K> };

const merged = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts.map((x) => (x.index ? x.toNonIndexed() : x)))!;
  parts.forEach((x) => x.dispose());
  return g;
};

/** A hanger seen from the front: a bar along x with two sloping arms and a hook. */
function frontHangerGeometry() {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(0.4, 0.008, 0.008).translate(0, -0.05, 0)];
  for (const s of [-1, 1]) parts.push(new THREE.BoxGeometry(0.215, 0.008, 0.008).rotateZ(s * 0.25).translate(s * 0.1, -0.025, 0));
  parts.push(new THREE.BoxGeometry(0.008, 0.045, 0.008));
  return merged(parts);
}

/** A garment in unit coordinates (x width, y length, z thickness, centred): the body and two sleeves in one geometry, facing the viewer. */
function frontGarmentGeometry() {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(1, 1, 1)];
  for (const s of [-1, 1]) parts.push(new THREE.BoxGeometry(0.2, 0.78, 0.9).rotateZ(s * 0.07).translate(s * 0.58, 0.085, 0));
  return merged(parts);
}

/** A plush toy: a body, a head and two ears in one geometry (about 0.15 m tall). */
function plushGeometry() {
  const body = new THREE.SphereGeometry(0.07, 12, 8).scale(1, 0.9, 0.9).translate(0, 0.063, 0);
  const head = new THREE.SphereGeometry(0.05, 12, 8).translate(0, 0.15, 0.015);
  const ears = [-1, 1].map((s) => new THREE.SphereGeometry(0.02, 8, 6).translate(s * 0.036, 0.2, 0.01));
  return merged([body, head, ...ears]);
}

/** A bi-fold leaf `a` wide and `h` tall, centred: a slab with a raised panel on its front, in one geometry. */
function leafGeometry(a: number, h: number) {
  return merged([new THREE.BoxGeometry(a - 0.004, h - 0.06, 0.02), new THREE.BoxGeometry(a * 0.72, (h - 0.06) * 0.84, 0.006).translate(0, 0, 0.012)]);
}

/** The plush toys from a glTF (the object's `model`: one vertex-coloured mesh, upright, facing +z), fitted to 0.16 m tall and drawn instanced. */
function PlushModel({ url, count, fill }: { url: string; count: number; fill: (i: number, p: THREE.Object3D, c: THREE.Color) => void }) {
  const { scene } = useGLTF(url, false);
  const geo = useMemo(() => {
    let g: THREE.BufferGeometry | null = null;
    scene.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!g && mesh.isMesh) g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    });
    const out = (g as THREE.BufferGeometry | null) ?? new THREE.SphereGeometry(0.07);
    out.computeBoundingBox();
    const b = out.boundingBox!;
    const k = 0.16 / Math.max(1e-6, b.max.y - b.min.y);
    out.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    out.scale(k, k, k);
    return out;
  }, [scene]);
  useEffect(() => () => geo.dispose(), [geo]);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  return <Inst count={count} geometry={geo} material={mat} fill={fill} cast={false} />;
}

export function Closet({ o }: P<"closet">) {
  const env = useEnv();
  const { doors, rows, topShelf, floorItem, open, w, h, d, items, stuff, wireBoxes, floorKeys, palette } = o.params;
  const white = useMat(o.material);
  const inner = env.kit.mat("plastic", "#eceef3", 0.7);
  const wire = env.kit.mat("metal", "#c9ccd4", 0.4);
  const black = env.kit.mat("plastic", "#15161a", 0.45);
  const trim = env.kit.mat("plastic", "#2a2c33", 0.5);
  const hangerMat = env.kit.mat("plastic", "#111216", 0.5);
  const cloth = env.kit.mat("fabric", "#ffffff", 0.9);
  const plushMat = env.kit.mat("fabric", "#ffffff", 0.95);
  const paper = env.kit.mat("paper", "#ffffff", 0.7);
  const unit = env.kit.geo("unit-box", () => new THREE.BoxGeometry(1, 1, 1));
  const hanger = env.kit.geo("front-hanger", frontHangerGeometry);
  const garments = env.kit.geo("front-garment", frontGarmentGeometry);
  const plush = env.kit.geo("plush", plushGeometry);
  const t = 0.02;
  const pairs = useMemo(() => closetPairs(doors, w), [doors, w]);
  const a = pairs[0].a;
  const leafGeo = env.kit.geo(`closet-leaf:${a.toFixed(3)}:${h}`, () => leafGeometry(a, h));
  const knob = env.kit.mat("metal", "#c9ccd4", 0.3);

  // The doors: each pair's outer leaf turns about its jamb, the inner one folds back twice as far.
  const outer = useRef<(THREE.Group | null)[]>([]);
  const innerG = useRef<(THREE.Group | null)[]>([]);
  const want = closetOpenness(open, env.openIds.has(o.id));
  const cur = useRef(open);
  const pose = useCallback(
    (v: number) => {
      pairs.forEach((p, i) => {
        const f = foldPose(v, p.a);
        const og = outer.current[i];
        const ig = innerG.current[i];
        if (og) og.rotation.y = -p.side * f.outer;
        if (ig) ig.rotation.y = -p.side * f.inner;
      });
    },
    [pairs],
  );
  useEffect(() => {
    pose(cur.current);
  }, [pose]);
  useFrame((_, dt) => {
    cur.current = env.reduced ? want : cur.current + (want - cur.current) * (1 - Math.exp(-5 * Math.min(dt, 0.05)));
    pose(cur.current);
  });

  // Hanging clothes: `rows` rails, `items` hangers on each; the upper rail's garments are longer.
  const span = w - 0.1;
  const pitch = span / Math.max(1, items);
  const railY = (r: number) => (r === 0 ? h * 0.88 : h * 0.42);
  const total = items * rows;
  const fillHanger = useCallback(
    (i: number, p: THREE.Object3D) => {
      const r = Math.floor(i / items);
      p.position.set(-span / 2 + ((i % items) + 0.5) * pitch, railY(r), 0.02 * ((i % 3) - 1));
      p.rotation.y = 0.08 * ((i % 3) - 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, rows, w, h],
  );
  const fillGarment = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const r = Math.floor(i / items);
      const k = i % items;
      const len = r === 0 ? (k % 3 === 1 ? 0.7 : 0.82) : 0.62;
      const width = Math.min(0.42, pitch * 1.18);
      p.position.set(-span / 2 + (k + 0.5) * pitch, railY(r) - 0.07 - len / 2, 0.02 * ((k % 3) - 1));
      p.rotation.y = 0.08 * ((k % 3) - 1);
      p.scale.set(width * 0.86, len, r === 0 ? 0.07 : 0.04);
      c.set(palette[(k * 3 + r * 2) % palette.length]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, rows, w, h, palette],
  );

  // The top shelf and the wire shelf.
  const shelfY = h - 0.42;
  const wireY = h * 0.52;
  const plushes = topShelf === "plushies" ? stuff : 0;
  const fillPlush = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const n = Math.max(1, plushes);
      p.position.set(-w / 2 + 0.14 + (i + 0.5) * ((w - 0.28) / n), shelfY + t / 2, ((i * 5) % 3) * 0.05 - 0.04);
      p.rotation.y = ((i * 7) % 5) * 0.25 - 0.5;
      const s = 0.85 + ((i * 3) % 4) * 0.1;
      p.scale.setScalar(s);
      c.set(palette[(i * 2 + 1) % palette.length]).offsetHSL(0, 0.1, 0.32);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plushes, w, h, palette],
  );
  const crates = useMemo(() => {
    const list: Array<{ x: number; y: number; z: number; w: number; h: number; hue: number }> = [];
    const topN = topShelf === "boxes" ? stuff : 0;
    for (let i = 0; i < topN; i++) list.push({ x: -w / 2 + 0.14 + (i + 0.5) * ((w - 0.28) / topN), y: shelfY + t / 2 + 0.07, z: 0, w: Math.min(0.2, (w - 0.28) / topN - 0.02), h: 0.14, hue: 0.08 + i * 0.13 });
    for (let i = 0; i < wireBoxes; i++) list.push({ x: -w / 2 + 0.14 + (i + 0.5) * ((w - 0.28) / wireBoxes), y: wireY + 0.008 + 0.08, z: 0, w: Math.min(0.24, (w - 0.28) / wireBoxes - 0.02), h: 0.16, hue: 0.55 + i * 0.09 });
    return list;
  }, [topShelf, stuff, wireBoxes, w, shelfY, wireY]);
  const fillCrate = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const b = crates[i];
      p.position.set(b.x, b.y, b.z);
      p.scale.set(b.w, b.h, d * 0.7);
      c.setHSL(b.hue % 1, 0.18, 0.78);
    },
    [crates, d],
  );
  const midi = useMemo(
    () => ({ id: `${o.id}-midi`, kind: "midiKeyboard", params: { keys: floorKeys }, transform: { pos: [0, 0, 0], rotY: 0, scale: 1 }, material: { preset: "plastic", color: "#1a1c23", roughness: 0.4 }, visibility: "public", hideOnPhone: false }) as ObjectOf<"midiKeyboard">,
    [o.id, floorKeys],
  );
  const unitH = 0.72;
  return (
    <group>
      {/* the carcass: back, two sides, top, a plinth */}
      <mesh position={[0, h / 2, -d / 2 + t / 2]} receiveShadow material={inner}>
        <boxGeometry args={[w, h, t]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (w / 2 - t / 2), h / 2, 0]} castShadow receiveShadow material={white}>
          <boxGeometry args={[t, h, d]} />
        </mesh>
      ))}
      <mesh position={[0, h - t / 2, 0]} castShadow receiveShadow material={white}>
        <boxGeometry args={[w, t, d]} />
      </mesh>
      <mesh position={[0, 0.03, 0.01]} receiveShadow material={inner}>
        <boxGeometry args={[w - 2 * t, 0.06, d - 0.02]} />
      </mesh>
      {topShelf !== "none" ? (
        <mesh position={[0, shelfY, 0]} receiveShadow material={inner}>
          <boxGeometry args={[w - 2 * t, t, d - 0.04]} />
        </mesh>
      ) : null}
      {wireBoxes > 0 ? (
        <mesh position={[0, wireY, 0]} receiveShadow material={wire}>
          <boxGeometry args={[w - 2 * t, 0.012, d - 0.1]} />
        </mesh>
      ) : null}
      {total > 0
        ? Array.from({ length: rows }, (_, r) => (
            <mesh key={r} position={[0, railY(r) + 0.012, 0]} rotation={[0, 0, Math.PI / 2]} material={wire}>
              <cylinderGeometry args={[0.012, 0.012, w - 2 * t, 8]} />
            </mesh>
          ))
        : null}
      {total > 0 ? (
        <>
          <Inst count={total} geometry={hanger} material={hangerMat} fill={fillHanger} cast={false} />
          <Inst count={total} geometry={garments} material={cloth} fill={fillGarment} cast={false} />
        </>
      ) : null}
      {plushes > 0 ? (
        o.model ? (
          <ModelBoundary fallback={<Inst count={plushes} geometry={plush} material={plushMat} fill={fillPlush} cast={false} />}>
            <Suspense fallback={<Inst count={plushes} geometry={plush} material={plushMat} fill={fillPlush} cast={false} />}>
              <PlushModel url={o.model} count={plushes} fill={fillPlush} />
            </Suspense>
          </ModelBoundary>
        ) : (
          <Inst count={plushes} geometry={plush} material={plushMat} fill={fillPlush} cast={false} />
        )
      ) : null}
      {crates.length > 0 ? <Inst count={crates.length} geometry={unit} material={paper} fill={fillCrate} cast={false} /> : null}
      {floorItem !== "none" ? (
        <group>
          <Rb a={[w * 0.86, unitH, d - 0.14]} p={[0, unitH / 2 + 0.06, 0.0]} r={0.01} m={black} />
          {[0, 1, 2].map((i) => (
            <Rb key={i} a={[w * 0.8, 0.005, 0.01]} p={[0, 0.06 + (unitH / 3) * (i + 1) - 0.02, (d - 0.14) / 2 + 0.002]} r={0.002} m={trim} cast={false} />
          ))}
          {floorItem === "midi" ? (
            <group position={[0, unitH + 0.06, 0.02]}>
              <MidiKeyboard o={midi} />
            </group>
          ) : null}
        </group>
      ) : null}
      {/* the doors: folding pairs on the front track */}
      {pairs.map((p, i) => (
        <group key={i} ref={(g) => void (outer.current[i] = g)} position={[p.side * (-w / 2 + t), 0, d / 2 - 0.012]} userData={{ dynamic: true }}>
          <mesh geometry={leafGeo} position={[(p.side * p.a) / 2, h / 2, 0]} receiveShadow material={white} />
          <group ref={(g) => void (innerG.current[i] = g)} position={[p.side * p.a, 0, 0]}>
            <mesh geometry={leafGeo} position={[(p.side * p.a) / 2, h / 2, 0]} receiveShadow material={white} />
            <mesh position={[p.side * (p.a - 0.06), h * 0.5, 0.02]} material={knob}>
              <cylinderGeometry args={[0.008, 0.008, 0.14, 8]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/**
 * A ceiling fan: the object's origin is on the ceiling, everything hangs below. A rod and a brushed-steel hub, `blades` dark blades in
 * one merged mesh that turns (a `dynamic` group; still under reduced motion, or at `spin` 0), `lamps` frosted shades around the hub that
 * light up with the part of the day's lamps.
 */
export function CeilingFan({ o }: P<"ceilingFan">) {
  const env = useEnv();
  const { blades, lamps, spin, drop } = o.params;
  const steel = env.kit.mat("metal", "#b9bec8", 0.35);
  const dark = env.kit.mat("plastic", "#24262c", 0.5);
  const shadeOff = env.kit.mat("ceramic", "#e8eaf0", 0.5);
  const lit = env.light.lampOn;
  const shade = lit ? env.kit.glow("#fff0d4", 1.6 * Math.max(0.6, env.light.emissiveBoost)) : shadeOff;
  const rotor = useRef<THREE.Group>(null);
  const bladeGeo = env.kit.geo(`fan-blades:${blades}`, () => {
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < blades; i++) {
      const arm = new THREE.BoxGeometry(0.22, 0.008, 0.03).translate(0.2, 0.0, 0);
      const blade = new THREE.BoxGeometry(0.46, 0.008, 0.115).rotateX(0.12).translate(0.5, -0.004, 0);
      const both = merged([arm, blade]).rotateY((i * Math.PI * 2) / blades);
      parts.push(both);
    }
    return merged(parts);
  });
  useFrame((_, dt) => {
    const g = rotor.current;
    if (g && !env.reduced && spin > 0) g.rotation.y += dt * spin * 8;
  });
  const hubY = -drop - 0.06;
  return (
    <group>
      <mesh position={[0, -0.02, 0]} material={steel}>
        <cylinderGeometry args={[0.08, 0.08, 0.04, 20]} />
      </mesh>
      <mesh position={[0, -drop / 2, 0]} material={steel}>
        <cylinderGeometry args={[0.01, 0.01, drop, 8]} />
      </mesh>
      <mesh position={[0, hubY, 0]} castShadow material={steel}>
        <cylinderGeometry args={[0.1, 0.09, 0.11, 24]} />
      </mesh>
      <group ref={rotor} position={[0, hubY - 0.02, 0]} userData={{ dynamic: true }}>
        <mesh geometry={bladeGeo} material={dark} userData={{ noShadow: true }} />
      </group>
      {Array.from({ length: lamps }, (_, i) => {
        const ang = (i * Math.PI * 2) / lamps + Math.PI / 4;
        return (
          <group key={i} position={[Math.cos(ang) * 0.17, hubY - 0.1, Math.sin(ang) * 0.17]}>
            <mesh position={[-Math.cos(ang) * 0.04, 0.05, -Math.sin(ang) * 0.04]} rotation={[0, 0, 0]} material={steel}>
              <cylinderGeometry args={[0.006, 0.006, 0.1, 6]} />
            </mesh>
            <mesh material={shade} userData={{ noShadow: true }}>
              <cylinderGeometry args={[0.035, 0.06, 0.11, 14, 1, true]} />
            </mesh>
            <mesh position={[0, -0.056, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ noShadow: true }} material={shade}>
              <circleGeometry args={[0.06, 14]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Triangle light panels: flat emissive triangles in one merged mesh, centred on the object (the object stands at their middle). */
export function LightPanels({ o }: P<"lightPanels">) {
  const env = useEnv();
  const { count, layout, color, intensity } = o.params;
  const s = 0.26;
  const geo = env.kit.geo(`panels:${count}:${layout}`, () => {
    const cells = panelCells(count, layout);
    const tris = cells.map((c) => panelCorners(c, s));
    const xs = tris.flat().map((p) => p[0]);
    const ys = tris.flat().map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const pos: number[] = [];
    for (const tri of tris) {
      const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
      const my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
      for (const [x, y] of tri) {
        // Shrink toward the centroid for the gap between panels; a column is stood on end (x, y -> y, -x).
        const px = mx + (x - mx) * 0.93 - cx;
        const py = my + (y - my) * 0.93 - cy;
        if (layout === "column") pos.push(py, -px, 0.012);
        else pos.push(px, py, 0.012);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    // Winding: the faces must look along +z whichever way the points were laid out.
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i += 3) {
      const ax = p.getX(i + 1) - p.getX(i);
      const ay = p.getY(i + 1) - p.getY(i);
      const bx = p.getX(i + 2) - p.getX(i);
      const by = p.getY(i + 2) - p.getY(i);
      if (ax * by - ay * bx < 0) {
        const x = p.getX(i + 1);
        const y = p.getY(i + 1);
        p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), 0.012);
        p.setXYZ(i + 2, x, y, 0.012);
      }
    }
    g.computeVertexNormals();
    return g;
  });
  return (
    <group>
      <mesh geometry={geo} userData={{ noShadow: true }} material={env.kit.glow(color, intensity * Math.max(0.5, env.light.emissiveBoost))} />
    </group>
  );
}

/** One keyboard hung on a wall: a slab and a grid of keys, vertex-coloured (a light body, grey keys), 0.3 m wide. */
function wallKeyboardGeometry() {
  const paint = (g: THREE.BufferGeometry, hex: string) => {
    const col = new THREE.Color(hex);
    const n = g.getAttribute("position").count;
    g.setAttribute("color", new THREE.BufferAttribute(Float32Array.from({ length: n * 3 }, (_, i) => [col.r, col.g, col.b][i % 3]), 3));
    return g;
  };
  const parts: THREE.BufferGeometry[] = [paint(new THREE.BoxGeometry(0.3, 0.1, 0.012), "#f2f3f7").toNonIndexed()];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 12; c++) parts.push(paint(new THREE.BoxGeometry(0.019, 0.016, 0.008).translate(-0.1375 + c * 0.025, 0.033 - r * 0.022, 0.009), "#b6bbc9").toNonIndexed());
  return merged(parts);
}

/** A white pegboard (a hole grid in the picture) with keyboards hanging in a grid: one instanced draw for all the keyboards. */
export function Pegboard({ o }: P<"pegboard">) {
  const env = useEnv();
  const { w, h, lift, items } = o.params;
  const grid = useMemo(() => pegGrid(items, w, h), [items, w, h]);
  const tex = useMemo(() => {
    const t = env.kit.tiled("peg", env.kit.tex("peg", () => pegTexture(256, 8)), [w / 0.2, h / 0.2]);
    return t;
  }, [env.kit, w, h]);
  const board = useMemo(() => new THREE.MeshStandardMaterial({ map: tex, color: o.material.color, roughness: 0.65, metalness: 0 }), [tex, o.material.color]);
  useEffect(() => () => board.dispose(), [board]);
  const kb = env.kit.geo("wall-keyboard", wallKeyboardGeometry);
  const vcol = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05 }), []);
  useEffect(() => () => vcol.dispose(), [vcol]);
  const cellW = (w - 0.08) / grid.cols;
  const cellH = (h - 0.08) / grid.rows;
  const k = Math.min(1, (cellW - 0.03) / 0.3, (cellH - 0.03) / 0.1);
  const fill = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const col = i % grid.cols;
      const row = Math.floor(i / grid.cols);
      p.position.set(-w / 2 + 0.04 + (col + 0.5) * cellW, h - 0.04 - (row + 0.5) * cellH, 0.032);
      p.rotation.z = ((i * 7) % 5 - 2) * 0.012;
      p.scale.setScalar(k);
      // A few pastel bodies among the white ones.
      if (i % 3 === 1) c.setHSL(0.72, 0.35, 0.86);
      else if (i % 3 === 2) c.setHSL(0.45, 0.25, 0.86);
      else c.set("#ffffff");
    },
    [grid, w, h, cellW, cellH, k],
  );
  return (
    <group position={[0, lift, 0]}>
      <mesh position={[0, h / 2, 0.011]} castShadow receiveShadow material={board}>
        <boxGeometry args={[w, h, 0.022]} />
      </mesh>
      <Inst count={items} geometry={kb} material={vcol} fill={fill} cast={false} />
    </group>
  );
}
