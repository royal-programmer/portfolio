"use client";

/**
 * The project shelf (S4): two planks behind the desk and one slim case per project, drawn as ONE
 * instanced mesh (the spine labels come from a single canvas atlas, one row per case) plus one plank
 * mesh: two draw calls however many projects there are. Hover (or HUD focus) pulls a case out a little
 * with a label; a click pulls it all the way out, turns its cover to the camera over 600 ms and then
 * calls `onOpen` with the case's screen rectangle (the page morphs it into the project's header).
 */
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ShelfCase } from "@/lib/site/stage-data";

const CASE_W = 0.2;
const CASE_H = 0.7;
const CASE_D = 0.5;
const SLOT = 0.3;
/** Plank tops, and where the shelf stands (the assembly's frame: behind the desk, in front of the window). */
const LOW_TOP = 1.58;
const HIGH_Y = 2.5;
const SHELF_Z = -1.55;
/** The hover pull: about 6 cm of a laptop that is 1.9 units (33 cm) wide. */
const HOVER_PULL = 0.34;
const OPEN_S = 0.6;
/** Atlas: a row per case, the spine in u 0..0.8, a solid body colour at u 0.95. */
const ROW_H = 192;
const ATLAS_W = 1024;
const SPINE_U = 0.8;
const BODY = "#161a24";

export type StageShelfProps = {
  items: ShelfCase[];
  /** The persona accent (the spine labels). */
  accent: THREE.Color;
  /** The case the keyboard focus (HUD strip) is on. */
  focusId: string | null;
  /** The case to open now (the HUD button, or a click): set from outside to run the same pull-out. */
  openId: string | null;
  /** The pull-out has finished: navigate. `rect` is the case's screen rectangle in CSS pixels. */
  onOpen: (item: ShelfCase, rect: { x: number; y: number; w: number; h: number } | null) => void;
  reduced: boolean;
  /** The pull-out was asked for by a click or tap on this case. */
  onPick: (id: string) => void;
};

function drawAtlas(items: ShelfCase[], accent: string) {
  const c = document.createElement("canvas");
  c.width = ATLAS_W;
  c.height = ROW_H * Math.max(1, items.length);
  const g = c.getContext("2d")!;
  g.fillStyle = BODY;
  g.fillRect(0, 0, c.width, c.height);
  const spineW = ATLAS_W * SPINE_U;
  items.forEach((it, i) => {
    const y = i * ROW_H;
    const dim = it.kind !== "project";
    g.fillStyle = BODY;
    g.fillRect(0, y, spineW, ROW_H);
    g.globalAlpha = dim ? 0.3 : 0.92;
    g.fillStyle = accent;
    g.fillRect(0, y, spineW, ROW_H);
    g.globalAlpha = 1;
    // A thin band at each end, like a printed spine.
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(0, y, 22, ROW_H);
    g.fillRect(spineW - 22, y, 22, ROW_H);
    let size = 112;
    const label = it.title.toLowerCase();
    g.font = `600 ${size}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
    const max = spineW - 90;
    const w = g.measureText(label).width;
    if (w > max) size = Math.max(40, Math.floor((size * max) / w));
    g.font = `600 ${size}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
    g.textBaseline = "middle";
    g.fillStyle = dim ? accent : "#07080c";
    g.fillText(label, 54, y + ROW_H / 2 + 4);
  });
  // The solid region (the case's other faces): the body colour, already there; one column to be certain.
  g.fillStyle = BODY;
  g.fillRect(ATLAS_W * 0.9, 0, ATLAS_W * 0.1, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A box whose UVs put the +z face on the atlas spine (text running up the spine) and every other face on the solid column. */
function caseGeometry() {
  const g = new THREE.BoxGeometry(CASE_W, CASE_H, CASE_D);
  const pos = g.getAttribute("position");
  const nor = g.getAttribute("normal");
  const uv = g.getAttribute("uv");
  for (let i = 0; i < pos.count; i++) {
    if (nor.getZ(i) > 0.5) uv.setXY(i, (pos.getY(i) / CASE_H + 0.5) * SPINE_U, 1 - (pos.getX(i) / CASE_W + 0.5));
    else uv.setXY(i, 0.95, 0.5);
  }
  return g;
}

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

export function StageShelf({ items, accent, focusId, openId, onOpen, reduced, onPick }: StageShelfProps) {
  const n = items.length;
  const get = useThree((s) => s.get);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const [hover, setHover] = useState<string | null>(null);
  const hov = useRef<number[]>([]);
  const open = useRef<{ i: number; t0: number; done: boolean } | null>(null);
  const dirty = useRef(true);
  const scratch = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), e: new THREE.Euler(), v: new THREE.Vector3() }), []);

  const slotX = useMemo(() => items.map((_, i) => (i - (n - 1) / 2) * SLOT), [items, n]);
  const width = Math.max(3.2, n * SLOT + 0.5);

  const geo = useMemo(() => {
    const g = caseGeometry();
    const row = new Float32Array(Math.max(1, n));
    // The atlas is flipped (canvas y grows down, v up): row i of the canvas is v-row (n - 1 - i).
    for (let i = 0; i < n; i++) row[i] = n - 1 - i;
    g.setAttribute("aRow", new THREE.InstancedBufferAttribute(row, 1));
    return g;
  }, [n]);
  const accentCss = `#${accent.getHexString()}`;
  const tex = useMemo(() => drawAtlas(items, accentCss), [items, accentCss]);
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.15 });
    const rows = Math.max(1, n).toFixed(1);
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aRow;")
        .replace("#include <uv_vertex>", `#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = vec2(vMapUv.x, (vMapUv.y + aRow) / ${rows});\n#endif`);
    };
    m.customProgramCacheKey = () => `stage-shelf-${rows}`;
    return m;
  }, [tex, n]);
  const planks = useMemo(() => {
    const plank = (y: number) => new THREE.BoxGeometry(width, 0.045, 0.62).translate(0, y, 0);
    const bracket = (x: number, y: number) => new THREE.BoxGeometry(0.05, 0.3, 0.05).translate(x, y - 0.17, -0.27);
    const parts = [plank(LOW_TOP - 0.0225), plank(HIGH_Y), bracket(-width / 2 + 0.25, LOW_TOP), bracket(width / 2 - 0.25, LOW_TOP)];
    const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()))!;
    parts.forEach((p) => p.dispose());
    return merged;
  }, [width]);
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2a1f17", roughness: 0.7, metalness: 0.08 }), []);
  useEffect(
    () => () => {
      geo.dispose();
      tex.dispose();
      mat.dispose();
      planks.dispose();
      wood.dispose();
    },
    [geo, tex, mat, planks, wood],
  );

  // A case's matrix: its slot, pulled out by `h` (hover), or flown to the front and turned by the open's progress `e`.
  const place = (i: number, h: number, e: number, out: THREE.Matrix4) => {
    const { p, q, s, e: eu } = scratch;
    p.set(slotX[i], LOW_TOP + CASE_H / 2, h * HOVER_PULL);
    eu.set(0, -(Math.PI / 2) * e, 0);
    s.setScalar(1 + 0.55 * e);
    if (e > 0) {
      p.x += (0 - slotX[i]) * e;
      p.y += (1.95 - p.y) * e;
      p.z += (1.15 - p.z) * e;
    }
    q.setFromEuler(eu);
    out.compose(p, q, s);
  };

  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.count = n;
    for (let i = 0; i < n; i++) {
      place(i, 0, 0, scratch.m);
      m.setMatrixAt(i, scratch.m);
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
    dirty.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n, slotX]);

  // Open from outside (the HUD button): the same pull-out as a click.
  useEffect(() => {
    if (!openId) return;
    const i = items.findIndex((x) => x.id === openId);
    if (i < 0 || open.current) return;
    open.current = { i, t0: performance.now() / 1000, done: false };
    if (reduced) open.current.t0 -= OPEN_S;
    dirty.current = true;
  }, [openId, items, reduced]);

  useEffect(() => {
    const reset = () => {
      open.current = null;
      dirty.current = true;
    };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m) return;
    const lit = hover ?? focusId;
    let moving = dirty.current;
    for (let i = 0; i < n; i++) {
      const want = lit === items[i].id ? 1 : 0;
      const cur = (hov.current[i] ??= 0);
      if (cur !== want) {
        const next = cur + (want - cur) * Math.min(1, dt * 12);
        hov.current[i] = Math.abs(next - want) < 0.003 ? want : next;
        moving = true;
      }
    }
    const o = open.current;
    if (o) moving = true;
    if (!moving) return;
    dirty.current = false;
    for (let i = 0; i < n; i++) {
      const e = o && o.i === i ? ease(Math.min(1, (performance.now() / 1000 - o.t0) / OPEN_S)) : 0;
      place(i, o && o.i === i ? 1 - e : hov.current[i], e, scratch.m);
      m.setMatrixAt(i, scratch.m);
    }
    m.instanceMatrix.needsUpdate = true;
    if (o && !o.done && performance.now() / 1000 - o.t0 >= OPEN_S) {
      o.done = true;
      // The case's screen rectangle: its eight corners through the camera.
      const { camera, size } = get();
      m.updateWorldMatrix(true, false);
      const box = new THREE.Box3();
      const geoBox = geo.boundingBox ?? (geo.computeBoundingBox(), geo.boundingBox)!;
      m.getMatrixAt(o.i, scratch.m);
      scratch.m.premultiply(m.matrixWorld);
      box.makeEmpty();
      for (let k = 0; k < 8; k++) {
        scratch.v.set(k & 1 ? geoBox.max.x : geoBox.min.x, k & 2 ? geoBox.max.y : geoBox.min.y, k & 4 ? geoBox.max.z : geoBox.min.z).applyMatrix4(scratch.m).project(camera);
        box.expandByPoint(scratch.v);
      }
      const canvas = get().gl.domElement.getBoundingClientRect();
      const x0 = canvas.left + ((box.min.x + 1) / 2) * size.width;
      const x1 = canvas.left + ((box.max.x + 1) / 2) * size.width;
      const y0 = canvas.top + ((1 - box.max.y) / 2) * size.height;
      const y1 = canvas.top + ((1 - box.min.y) / 2) * size.height;
      onOpen(items[o.i], { x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  });

  const idOf = (e: { instanceId?: number }) => (e.instanceId != null ? items[e.instanceId]?.id : undefined);
  const labelId = open.current ? null : hover ?? focusId;
  const labelIdx = labelId ? items.findIndex((x) => x.id === labelId) : -1;
  const label = labelIdx >= 0 ? items[labelIdx] : null;

  return (
    <group ref={group} position={[0.3, 0, SHELF_Z]} userData={{ noFit: true }}>
      <mesh geometry={planks} material={wood} userData={{ noFit: true }} />
      <instancedMesh
        ref={mesh}
        args={[geo, mat, Math.max(1, n)]}
        frustumCulled={false}
        userData={{ noFit: true }}
        onPointerMove={(e) => {
          if ((e.nativeEvent as PointerEvent).pointerType === "touch" || open.current) return;
          e.stopPropagation();
          const id = idOf(e);
          if (id) {
            setHover(id);
            (e.nativeEvent.target as HTMLElement).style.cursor = "pointer";
          }
        }}
        onPointerOut={(e) => {
          setHover(null);
          (e.nativeEvent.target as HTMLElement).style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          const id = idOf(e);
          if (id && !open.current) onPick(id);
        }}
      />
      {label ? (
        <Html position={[slotX[labelIdx], LOW_TOP + CASE_H + 0.12, HOVER_PULL]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="stage-prop-label" style={{ ["--stage-c" as string]: accentCss }}>
            {label.title.toLowerCase()}
            {label.note ? <small>{label.note}</small> : null}
          </div>
        </Html>
      ) : null}
    </group>
  );
}
