"use client";

/**
 * The skill constellation (S5): one soft star per technology on a cap above the desk, faint lines between
 * technologies that appear together (see lib/site/stage-constellation.ts). Two draw calls in all: one `Points`
 * (a soft sprite, per-star colour and size) and one `LineSegments` (per-vertex colour). Hover (desktop) lights a
 * star, its neighbours and the lines between them, with a mono label; a click runs the star's command in the
 * terminal. On a phone a tap names the star and a second tap runs it. Picking is done in screen space on the
 * canvas element, so it never competes with the desk's own hit targets. The cap turns very slowly, unless motion
 * is reduced.
 */
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import type { Constellation } from "@/lib/site/stage-constellation";

export type StageConstellationProps = {
  data: Constellation;
  accent: THREE.Color;
  /** Read each frame: 0 = stars are not interactive (the camera is not looking at them), 1 = interactive. */
  active: MutableRefObject<boolean>;
  reduced: boolean;
  onRun: (cmd: string) => void;
};

const WHITE = new THREE.Color("#ffffff");
const BASE = 0.34;
const NEAR = 0.8;
const LINE = 0.16;

function sprite() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.75)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function StageConstellation({ data, accent, active, reduced, onRun }: StageConstellationProps) {
  const { stars, edges } = data;
  const n = stars.length;
  const get = useThree((s) => s.get);
  const group = useRef<THREE.Group>(null);
  const [lit, setLit] = useState<number | null>(null);
  const litRef = useRef<number | null>(null);
  const lastTap = useRef<{ i: number; at: number } | null>(null);
  const level = useRef<Float32Array>(new Float32Array(n).fill(BASE));
  const scratch = useMemo(() => ({ v: new THREE.Vector3() }), []);

  const neighbours = useMemo(() => {
    const m: number[][] = stars.map(() => []);
    for (const [a, b] of edges) {
      m[a].push(b);
      m[b].push(a);
    }
    return m;
  }, [stars, edges]);

  const tex = useMemo(() => sprite(), []);
  const { pointsGeo, lineGeo } = useMemo(() => {
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(stars.flatMap((s) => s.pos)), 3));
    pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    pg.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    const lp: number[] = [];
    for (const [a, b] of edges) lp.push(...stars[a].pos, ...stars[b].pos);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lp), 3));
    lg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(edges.length * 6), 3));
    return { pointsGeo: pg, lineGeo: lg };
  }, [stars, edges, n]);
  const pointsMat = useMemo(() => {
    const m = new THREE.PointsMaterial({ size: 0.34, map: tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aSize;").replace("gl_PointSize = size;", "gl_PointSize = size * aSize;");
    };
    m.customProgramCacheKey = () => "stage-stars";
    return m;
  }, [tex]);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), []);
  useEffect(
    () => () => {
      pointsGeo.dispose();
      lineGeo.dispose();
      pointsMat.dispose();
      lineMat.dispose();
      tex.dispose();
    },
    [pointsGeo, lineGeo, pointsMat, lineMat, tex],
  );

  // Pointer: the nearest star within a finger's width of the pointer, in screen space.
  useEffect(() => {
    const el = get().gl.domElement;
    const pick = (e: PointerEvent): number | null => {
      const g = group.current;
      if (!g || !active.current) return null;
      const { camera } = get();
      const r = el.getBoundingClientRect();
      const touch = e.pointerType === "touch";
      let best: number | null = null;
      let bestD = (touch ? 30 : 18) ** 2;
      g.updateWorldMatrix(true, false);
      for (let i = 0; i < n; i++) {
        scratch.v.set(...stars[i].pos).applyMatrix4(g.matrixWorld).project(camera);
        if (scratch.v.z > 1) continue;
        const dx = r.left + ((scratch.v.x + 1) / 2) * r.width - e.clientX;
        const dy = r.top + ((1 - scratch.v.y) / 2) * r.height - e.clientY;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    };
    const set = (i: number | null) => {
      if (litRef.current === i) return;
      litRef.current = i;
      setLit(i);
      el.style.cursor = i == null ? "" : "pointer";
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      set(pick(e));
    };
    const onLeave = () => set(null);
    const onClick = (e: MouseEvent) => {
      const i = pick(e as PointerEvent);
      if (i == null) return;
      const touch = (e as PointerEvent).pointerType === "touch" || window.matchMedia("(pointer: coarse)").matches;
      if (touch) {
        const last = lastTap.current;
        const now = performance.now();
        if (!last || last.i !== i || now - last.at > 2500) {
          lastTap.current = { i, at: now };
          set(i);
          return;
        }
      }
      onRun(stars[i].cmd);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("click", onClick);
      el.style.cursor = "";
    };
  }, [get, n, stars, active, onRun, scratch]);

  const tint = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    if (!reduced) g.rotation.y = Math.sin(clock.elapsedTime * 0.05) * 0.06;
    // Each star eases to its target brightness; neighbours of the lit one sit between.
    const target = (i: number) => (lit == null ? BASE : i === lit ? 1.6 : neighbours[lit].includes(i) ? NEAR : BASE * 0.55);
    const col = pointsGeo.getAttribute("color") as THREE.BufferAttribute;
    const size = pointsGeo.getAttribute("aSize") as THREE.BufferAttribute;
    let changed = false;
    for (let i = 0; i < n; i++) {
      const want = target(i);
      const cur = level.current[i];
      const next = Math.abs(want - cur) < 0.004 ? want : cur + (want - cur) * Math.min(1, dt * 9);
      if (next !== cur || !col.getX(i) && !col.getY(i) && !col.getZ(i)) {
        level.current[i] = next;
        tint.copy(accent).lerp(WHITE, Math.min(1, Math.max(0, (next - 0.6) / 1.2))).multiplyScalar(Math.min(1.4, next));
        col.setXYZ(i, tint.r, tint.g, tint.b);
        size.setX(i, 0.8 + Math.min(1.6, next) * 0.5);
        changed = true;
      }
    }
    if (changed) {
      col.needsUpdate = true;
      size.needsUpdate = true;
      const lc = lineGeo.getAttribute("color") as THREE.BufferAttribute;
      edges.forEach(([a, b], k) => {
        const touching = lit != null && (a === lit || b === lit);
        const base = lit == null ? LINE : touching ? 0.9 : LINE * 0.4;
        const v = base * (0.5 + 0.5 * Math.min(1, (level.current[a] + level.current[b]) / 1.2));
        tint.copy(accent).multiplyScalar(touching ? Math.min(1, v) : v);
        lc.setXYZ(k * 2, tint.r, tint.g, tint.b);
        lc.setXYZ(k * 2 + 1, tint.r, tint.g, tint.b);
      });
      lc.needsUpdate = true;
    }
  });

  const css = `#${accent.getHexString()}`;
  return (
    <group ref={group} userData={{ noFit: true }}>
      <points geometry={pointsGeo} material={pointsMat} frustumCulled={false} />
      <lineSegments geometry={lineGeo} material={lineMat} frustumCulled={false} />
      {lit != null ? (
        <Html position={[stars[lit].pos[0], stars[lit].pos[1] + 0.2, stars[lit].pos[2]]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="stage-prop-label" style={{ ["--stage-c" as string]: css }}>
            {stars[lit].name.toLowerCase()}
            <small>{stars[lit].cmd}</small>
          </div>
        </Html>
      ) : null}
    </group>
  );
}
