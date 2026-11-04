"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: GPU objects (materials, uniforms,
   transforms, the shared state ref) are mutated every frame inside useFrame. */

/**
 * The assembly pattern (D38 round B/C), shared by every persona's setup:
 *
 *   loose parts hang ahead of the camera half a section before the peak →
 *   they fly together as the camera reaches the section (gather) →
 *   the setup "opens" (lid, lens, strokes…) and powers on →
 *   lit, it is a doorway: pointer over its screen = portal hover, tap = fly in →
 *   scrolling on, it powers off and the parts drift apart ahead again.
 *
 * `useAssembly` owns the timing, the anchor, the scatter/gather placement,
 * the power ramp, the hover raycast and the halo/bezel light. Each world
 * builds its own meshes and places them in `onFrame`.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { SPECTRUM_GLSL } from "@/lib/site/spectrum";
import { useVr } from "./clock";
import type { World } from "./state";
import { climbPose, clamp01, easeInOut, makePose, seeded } from "./util";

export type Part = { scatterIn: THREE.Vector3; scatterOut: THREE.Vector3; home: THREE.Vector3; spin: THREE.Vector3; seed: number };

export type AssemblyLive = {
  /** 0 scattered … 1 assembled. */
  gather: number;
  /** Eased gather. */
  g3: number;
  /** 0 … 1 once the parts have met: the setup opens (lid, lens, strokes). */
  open: number;
  /** 0 off … 1 on (damped). */
  power: number;
  /** 0 … 1 pointer over the lit screen (damped). */
  hover: number;
  /** Light-time. */
  t: number;
  /** Signed distance from the peak in sections (negative = approaching). */
  d: number;
};

type Options = {
  world: World;
  root: RefObject<THREE.Group | null>;
  /** Meshes that count as "the screen": raycast targets, and where the camera flies into. */
  screens: RefObject<THREE.Mesh | null>[];
  /** Home positions of the loose parts, in the assembly's frame. */
  homes: THREE.Vector3[];
  /** Where the setup stands, relative to the camera's pose at the section. */
  offset?: { fwd?: number; right?: number; up?: number };
  /** Extra yaw for the whole setup (radians). */
  yaw?: number;
  /** Screen material(s) whose uPower / uTime / uHover the hook drives. */
  screenMats?: THREE.ShaderMaterial[];
  onFrame: (L: AssemblyLive, place: (obj: THREE.Object3D, i: number, late?: number) => void, parts: Part[]) => void;
};

export function useAssembly({ world, root, screens, homes, offset, yaw: yawOffset = 0, screenMats, onFrame }: Options) {
  const { clock, state } = useVr();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const live = useRef({ power: 0, hover: 0, lastHover: null as string | null });

  // Where the assembly stands: ahead of the camera's pose at the section, a little to the right
  // (the chapter's words sit on the left). Narrow screens see a narrower slice of the world:
  // it moves toward the centre, further away and up above the words.
  const anchor = useMemo(() => {
    const pose = climbPose(world.c);
    const aspect = size.width / Math.max(1, size.height);
    const narrow = THREE.MathUtils.clamp(1.67 / aspect, 1, 2.2);
    const fwd = (offset?.fwd ?? 5) + (narrow - 1) * 2.2;
    const right = (offset?.right ?? 1.4) / narrow;
    const up = (offset?.up ?? -0.3) + (narrow - 1) * 1.1;
    const pos = pose.pos.clone().addScaledVector(pose.fwd, fwd).addScaledVector(pose.right, right).add(new THREE.Vector3(0, up, 0));
    // Same heading as the camera (its yaw is a left-handed turn, so Ry takes the negative).
    return { pos, yaw: -pose.yaw + yawOffset };
  }, [world.c, size.width, size.height, offset?.fwd, offset?.right, offset?.up, yawOffset]);

  const parts = useMemo<Part[]>(() => {
    const rnd = seeded(7 + Math.round(world.c * 13));
    // Loose positions, in the setup's own frame: a cloud around it that fits the view at the
    // setup's distance (±2.6 across, ±1.6 up, a little depth), one for arriving, one for leaving.
    const scatter = (spread: number) =>
      new THREE.Vector3((rnd() * 2 - 1) * spread, (rnd() * 2 - 1) * spread * 0.6 + 0.3, (rnd() * 2 - 1) * spread * 0.5);
    return homes.map((home) => ({
      scatterIn: scatter(2.6),
      scatterOut: scatter(2.9),
      home,
      spin: new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).multiplyScalar(2.5),
      seed: rnd(),
    }));
  }, [world.c, homes]);

  const tint = useMemo(() => new THREE.Color().setHSL(((world.t * 285 - 15) / 360 + 1) % 1, 0.9, 0.62), [world.t]);
  const mats = useLitMats();
  const tmp = useMemo(
    () => ({ p: new THREE.Vector3(), q: new THREE.Quaternion(), ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), n: new THREE.Vector3(), w: new THREE.Vector3(), pose: makePose(), at: new THREE.Vector3() }),
    [],
  );
  // The frame offsets, resolved once (aspect-aware), reused to follow the camera while loose.
  const frame = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const narrow = THREE.MathUtils.clamp(1.67 / aspect, 1, 2.2);
    return { fwd: (offset?.fwd ?? 5) + (narrow - 1) * 2.2, right: (offset?.right ?? 1.4) / narrow, up: (offset?.up ?? -0.3) + (narrow - 1) * 1.1 };
  }, [size.width, size.height, offset?.fwd, offset?.right, offset?.up]);
  const L = useMemo<AssemblyLive>(() => ({ gather: 0, g3: 0, open: 0, power: 0, hover: 0, t: 0, d: -9 }), []);

  useFrame(() => {
    const k = clock.current;
    const s = state.current;
    const g = root.current;
    if (!g) return;
    const d = k.climb - world.c;
    // Shown only around its own chapter: once the parts have scattered they are gone.
    const shown = s.phase === "climb" && Math.abs(d) < 0.92;
    g.visible = shown;
    if (!shown) return;

    // gather: 0 scattered → 1 assembled; the parts meet over the section before, hold, then leave.
    const gather = 1 - THREE.MathUtils.smoothstep(Math.abs(d), 0.22, 0.95);
    const g3 = easeInOut(gather);
    const open = THREE.MathUtils.smoothstep(gather, 0.55, 1);
    const powerTarget = gather > 0.985 ? 1 : 0;
    const lv = live.current;
    lv.power = THREE.MathUtils.damp(lv.power, powerTarget, powerTarget ? 1.6 : 5, k.dt);
    // Coming back out of this screen: it is on already, no boot.
    if (s.portalOut?.slug === world.slug && powerTarget) lv.power = 1;
    const t = k.t;

    // Entropy in frame (Ratul's call): while the parts are loose the whole setup rides in front
    // of the camera — wherever it is on the climb — and as the chapter arrives it settles onto its
    // fixed spot in the world. Past the chapter it loosens again, still in view, then fades.
    // It follows the camera until the chapter is close (|d| < 0.2 sections), then glides onto its
    // spot: locking earlier would put the fixed spot (further along the helix) out of the frame.
    const lock = 1 - THREE.MathUtils.smoothstep(Math.abs(d), 0.08, 0.2);
    const cEff = world.c + (k.climb - world.c) * (1 - lock);
    climbPose(cEff, tmp.pose);
    tmp.at.copy(tmp.pose.pos).addScaledVector(tmp.pose.fwd, frame.fwd).addScaledVector(tmp.pose.right, frame.right);
    tmp.at.y += frame.up;
    g.position.copy(tmp.at);
    g.position.y += Math.sin(t * 0.5) * 0.04;
    const yawEff = -tmp.pose.yaw + (yawOffset ?? 0);
    g.rotation.set(Math.sin(t * 0.33) * 0.02, yawEff + Math.sin(t * 0.21) * 0.03, Math.sin(t * 0.27) * 0.015);

    const place = (obj: THREE.Object3D, i: number, late = 0) => {
      const part = parts[i];
      if (!part) return;
      // Loose positions are in the setup's own frame — a cloud around it, inside the view.
      const from = d < 0 ? part.scatterIn : part.scatterOut;
      tmp.w.copy(from);
      tmp.w.addScaledVector(tmp.p.set(Math.sin(t * 0.3 + part.seed * 20), Math.sin(t * 0.27 + part.seed * 9), Math.cos(t * 0.23 + part.seed * 14)), 0.3);
      // Some parts arrive a touch later than the body, each in its own time.
      const gk = late > 0 ? easeInOut(clamp01((gather - late * part.seed) / (1 - late * part.seed))) : g3;
      obj.position.lerpVectors(tmp.w, part.home, gk);
      const spin = (1 - gk) * (0.6 + part.seed) * 2;
      obj.rotation.set(part.spin.x * spin + t * 0.1 * (1 - gk), part.spin.y * spin, part.spin.z * spin);
      // Loose parts are small and far; they grow into place and shrink away again.
      obj.scale.setScalar(0.3 + 0.7 * gk);
    };

    L.gather = gather;
    L.g3 = g3;
    L.open = open;
    L.power = lv.power;
    L.t = t;
    L.d = d;

    // Portal: the pointer over a lit screen.
    let hover: string | null = null;
    const first = screens[0]?.current;
    if (lv.power > 0.9 && !s.portal) {
      tmp.ndc.set(s.px, s.py);
      tmp.ray.setFromCamera(tmp.ndc, camera);
      for (const r of screens) {
        const m = r.current;
        if (m && tmp.ray.intersectObject(m, false).length) {
          hover = world.slug;
          break;
        }
      }
    }
    lv.hover = THREE.MathUtils.damp(lv.hover, hover ? 1 : 0, 8, k.dt);
    L.hover = lv.hover;
    if (hover !== lv.lastHover) {
      lv.lastHover = hover;
      s.portalHover = hover;
    }
    // Tell the Director where the screen is, for the fly-in.
    if (first && lv.power > 0.5 && (!s.portal || s.portal.slug === world.slug) && (!s.portalOut || s.portalOut.slug === world.slug)) {
      first.getWorldPosition(tmp.w);
      tmp.n.set(0, 0, 1).applyQuaternion(first.getWorldQuaternion(tmp.q));
      s.portalAnchor = { x: tmp.w.x, y: tmp.w.y, z: tmp.w.z, nx: tmp.n.x, ny: tmp.n.y, nz: tmp.n.z };
    }

    // Screens, bezel light and the halo: lit = enterable, so it breathes and brightens under the pointer.
    const breath = 0.5 + 0.5 * Math.sin(t * 1.7);
    for (const m of screenMats ?? []) {
      m.uniforms.uPower.value = lv.power;
      m.uniforms.uTime.value = t;
      m.uniforms.uHover.value = lv.hover;
    }
    mats.bezel.opacity = lv.power * (0.16 + breath * 0.12 + lv.hover * 0.3);
    mats.bezel.color.copy(tint);
    mats.halo.opacity = lv.power * (0.22 + breath * 0.1 + lv.hover * 0.35);
    mats.halo.color.copy(tint);
    mats.glow.emissive.copy(tint).multiplyScalar(0.1 * lv.power);

    onFrame(L, place, parts);
  });

  return { anchor, parts, tint, mats };
}

/** Dark glass, matte shell, additive lights — the look every setup shares (the headset's). */
export function useLitMats() {
  const mats = useMemo(() => {
    const shell = new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#0a0a10"), roughness: 0.28, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 1.2 });
    const matte = new THREE.MeshStandardMaterial({ color: new THREE.Color("#0d0d13"), roughness: 0.75, metalness: 0.05 });
    const glass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#0c0c12"), roughness: 0.12, metalness: 0.1, clearcoat: 1, envMapIntensity: 1.6 });
    const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color("#2a2a33"), roughness: 0.35, metalness: 0.85 });
    /** Parts that take the persona's light when powered (keys, strips, rings). */
    const glow = new THREE.MeshStandardMaterial({ color: new THREE.Color("#0d0d13"), roughness: 0.6, metalness: 0.05, emissive: new THREE.Color("#000000"), emissiveIntensity: 1 });
    const bezel = new THREE.MeshBasicMaterial({ color: new THREE.Color("#000"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    // A soft light behind the screen: a lit setup is a doorway, and it should look like one.
    const haloCanvas = document.createElement("canvas");
    haloCanvas.width = haloCanvas.height = 128;
    const hc = haloCanvas.getContext("2d")!;
    const grad = hc.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.18)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    hc.fillStyle = grad;
    hc.fillRect(0, 0, 128, 128);
    const halo = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(haloCanvas), color: new THREE.Color("#000"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    return { shell, matte, glass, metal, glow, bezel, halo };
  }, []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  return mats;
}

// ---------------------------------------------------------------------------
// Screen material: black glass that powers on into its picture
// ---------------------------------------------------------------------------
const screenFragment = /* glsl */ `
${SPECTRUM_GLSL}
uniform sampler2D tScreen;
uniform float uPower;   // 0 off … 1 on
uniform float uTime;
uniform float uTint;
uniform float uHover;
uniform float uMode;    // 0 boot line opens · 1 drawn left to right · 2 painted in stroke order (alpha)
varying vec2 vUv;
void main() {
  vec4 px = texture2D(tScreen, vUv);
  vec3 content = px.rgb;
  vec3 col = spectrum(uTint);
  float lit = smoothstep(0.6, 1.0, uPower);
  vec3 c = vec3(0.0);
  if (uMode < 0.5) {
    // Boot: a thin line of light opens into the picture.
    float open = smoothstep(0.0, 0.7, uPower);
    float band = smoothstep(open, open - 0.02, abs(vUv.y - 0.5) * 2.0);
    float line = exp(-pow((abs(vUv.y - 0.5) * 2.0 - open) * 40.0, 2.0)) * step(uPower, 0.98) * 1.4;
    c = content * band * lit + col * line * step(0.001, uPower);
  } else if (uMode < 1.5) {
    // Drawn: the picture comes alive left to right, a bright head on the front.
    float front = smoothstep(0.05, 1.0, uPower) * 1.08;
    float shown = smoothstep(front, front - 0.03, vUv.x);
    float head = exp(-pow((vUv.x - front) * 30.0, 2.0)) * step(uPower, 0.98);
    c = content * shown * smoothstep(0.0, 0.3, uPower) + col * head * 0.6;
  } else {
    // Painted: each stroke carries its turn in alpha; strokes appear in order.
    float order = px.a;
    float shown = smoothstep(uPower + 0.02, uPower - 0.02, order) * step(0.02, order);
    c = content * shown;
  }
  c *= 1.0 + uHover * 0.25;
  // A breath across the glass, so it is never a flat picture.
  float sheen = smoothstep(0.0, 1.0, 1.0 - abs(vUv.x + vUv.y * 0.3 - 0.65 - sin(uTime * 0.2) * 0.1) * 4.0) * 0.03;
  c += sheen * lit;
  gl_FragColor = vec4(c + vec3(0.004), 1.0);
}
`;

export function makeScreenMaterial(texture: THREE.Texture, t: number, mode: 0 | 1 | 2 = 0) {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: screenFragment,
    uniforms: { tScreen: { value: texture }, uPower: { value: 0 }, uTime: { value: 0 }, uTint: { value: t }, uHover: { value: 0 }, uMode: { value: mode } },
  });
}

/** Halo plane behind a screen of the given size (additive, soft). */
export function Halo({ width, height, material, position, rotation }: { width: number; height: number; material: THREE.Material; position: [number, number, number]; rotation?: [number, number, number] }) {
  const geo = useMemo(() => new THREE.PlaneGeometry(width * 2.2, height * 2.4), [width, height]);
  return <mesh geometry={geo} material={material} position={position} rotation={rotation} renderOrder={1} />;
}

/** A cylinder from a to b (frame tubes, legs, stands). */
export function Tube({ from, to, r, material }: { from: [number, number, number]; to: [number, number, number]; r: number; material: THREE.Material }) {
  const { geo, pos, quat } = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const dir = b.clone().sub(a);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(r, r, len, 12);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    return { geo, pos: a.lerp(b, 0.5), quat };
  }, [from, to, r]);
  return <mesh geometry={geo} material={material} position={pos} quaternion={quat} />;
}
