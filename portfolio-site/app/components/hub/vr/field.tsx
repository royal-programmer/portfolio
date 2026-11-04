"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: GPU objects (materials, uniforms,
   instance matrices, the shared state ref) are mutated every frame inside useFrame. */

/**
 * The object field on the climb (D38 round B).
 *
 * Everything already exists in space along the camera's helix; only the camera
 * moves. Objects fade in and out of the dark with distance (fog in the shader).
 *
 *  - Slabs: glass panes with real content (code, glyphs) drifting around the
 *    path through a persona's stretch of the climb. One instanced draw.
 *  - EngineerAssembly: the laptop. Its parts (base, lid, keys, trackpad) drift
 *    loose, fly together as you reach the engineer's section, the lid unfolds
 *    toward you and the screen powers on. Lit, it is a doorway: the pointer
 *    over the screen is a portal hover; a tap flies the camera in.
 *
 * Built in code, no models, no downloads; the look is the headset's dark glass.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { SPECTRUM_GLSL } from "@/lib/site/spectrum";
import { useVr } from "./clock";
import { ATLAS_N, ATLAS_TILES, LAPTOP_SCREEN_SRC, makeLaptopScreen, makeSlabAtlas } from "./screens";
import type { World } from "./state";
import { climbPose, clamp01, easeInOut, makePose, seeded } from "./util";

/** How far objects are seen: fully there inside NEAR, gone beyond FAR (world units). */
const FOG_NEAR = 4;
const FOG_FAR = 15;

// ---------------------------------------------------------------------------
// Slabs: instanced glass panes with content from the atlas
// ---------------------------------------------------------------------------
const slabVertex = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aRot;     // yaw, pitch, roll
attribute vec2 aSize;
attribute vec2 aTile;
attribute float aSeed;
uniform float uTime;
varying vec2 vUv;
varying vec2 vTile;
varying float vFog;
varying float vSeed;

mat3 rot(vec3 e) {
  float cy = cos(e.x), sy = sin(e.x), cp = cos(e.y), sp = sin(e.y), cr = cos(e.z), sr = sin(e.z);
  mat3 Y = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 X = mat3(1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp);
  mat3 Z = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0);
  return Y * X * Z;
}
void main() {
  vUv = uv;
  vTile = aTile;
  vSeed = aSeed;
  // Alive at rest: a slow drift and a slower turn, each its own.
  vec3 drift = vec3(sin(uTime * 0.11 + aSeed * 20.0), sin(uTime * 0.09 + aSeed * 31.0), cos(uTime * 0.13 + aSeed * 12.0)) * 0.18;
  vec3 e = aRot + vec3(sin(uTime * 0.07 + aSeed * 9.0) * 0.08, sin(uTime * 0.05 + aSeed * 17.0) * 0.05, 0.0);
  vec3 local = rot(e) * vec3(position.x * aSize.x, position.y * aSize.y, 0.0);
  vec3 world = aPos + drift + local;
  vec4 mv = viewMatrix * vec4(world, 1.0);
  float dist = length(mv.xyz);
  vFog = smoothstep(${FOG_FAR.toFixed(1)}, ${FOG_NEAR.toFixed(1)}, dist);
  gl_Position = projectionMatrix * mv;
}
`;
const slabFragment = /* glsl */ `
${SPECTRUM_GLSL}
uniform sampler2D tAtlas;
uniform float uTint;
uniform float uShow;
varying vec2 vUv;
varying vec2 vTile;
varying float vFog;
varying float vSeed;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 p = vUv - 0.5;
  float d = roundedBox(p, vec2(0.5), 0.05);
  float body = smoothstep(0.0, -0.01, d);
  if (body <= 0.001) discard;
  // Content from the atlas, with a hair of colour fringe at the edges of the pane.
  vec2 fringe = p * 0.004;
  vec2 base = (vTile + 0.03 + vUv * 0.94) / ${ATLAS_N.toFixed(1)};
  float r = texture2D(tAtlas, base + fringe).r;
  float g = texture2D(tAtlas, base).g;
  float b = texture2D(tAtlas, base - fringe).b;
  vec3 content = vec3(r, g, b);
  vec3 col = spectrum(uTint);
  // Dark glass with the content glowing inside it; a sheen across the pane, the rim catching the light.
  float rim = smoothstep(-0.03, 0.0, d) * 0.9;
  float sheen = smoothstep(0.0, 1.0, 1.0 - abs(p.x - p.y * 0.6 + 0.15) * 2.2) * 0.05;
  vec3 c = vec3(0.03, 0.03, 0.04) + content * 2.2 + col * rim * 0.9 + vec3(sheen);
  float a = (0.78 + rim * 0.22) * body * vFog * uShow;
  gl_FragColor = vec4(c * a, a);
}
`;

type SlabSpec = { pos: THREE.Vector3; rot: THREE.Vector3; size: THREE.Vector2; tile: THREE.Vector2; seed: number };

/** Drifting panes along a persona's stretch of the climb. */
export function Slabs({ world, count, atlas }: { world: World; count: number; atlas: THREE.Texture }) {
  const { clock, state } = useVr();
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(101 + Math.round(world.c * 7));
    const specs: SlabSpec[] = [];
    const pose = makePose();
    const tmp = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // Spread over the section before and after the assembly, each pane ahead of the camera's
      // pose at its own point of the climb (the helix turns fast: "ahead" is where you look).
      const c = world.c + (rnd() * 2 - 1) * 0.95;
      climbPose(c, pose);
      const side = rnd() < 0.5 ? -1 : 1;
      const off = 1.6 + rnd() * 4;
      const up = (rnd() - 0.45) * 5;
      tmp.copy(pose.pos).addScaledVector(pose.right, side * off).addScaledVector(pose.fwd, 3 + rnd() * 7).add(new THREE.Vector3(0, up, 0));
      // Face back along the path (the camera's yaw is a left-handed turn; Ry needs its negative).
      const yaw = -pose.yaw + side * (0.35 + rnd() * 0.3);
      const code = rnd() < 0.62;
      const w = code ? 1.6 + rnd() * 1.4 : 0.7 + rnd() * 0.5;
      const tile = code ? Math.floor(rnd() * 8) : 8 + Math.floor(rnd() * (ATLAS_TILES - 8));
      specs.push({
        pos: tmp.clone(),
        rot: new THREE.Vector3(yaw, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.25),
        size: new THREE.Vector2(w, w * 0.5),
        // Canvas rows count from the top; texture v from the bottom.
        tile: new THREE.Vector2(tile % ATLAS_N, ATLAS_N - 1 - Math.floor(tile / ATLAS_N)),
        seed: rnd(),
      });
    }
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.getAttribute("position"));
    g.setAttribute("uv", base.getAttribute("uv"));
    const pos = new Float32Array(count * 3);
    const rot = new Float32Array(count * 3);
    const size = new Float32Array(count * 2);
    const tile = new Float32Array(count * 2);
    const seed = new Float32Array(count);
    specs.forEach((s, i) => {
      pos.set([s.pos.x, s.pos.y, s.pos.z], i * 3);
      rot.set([s.rot.x, s.rot.y, s.rot.z], i * 3);
      size.set([s.size.x, s.size.y], i * 2);
      tile.set([s.tile.x, s.tile.y], i * 2);
      seed[i] = s.seed;
    });
    g.setAttribute("aPos", new THREE.InstancedBufferAttribute(pos, 3));
    g.setAttribute("aRot", new THREE.InstancedBufferAttribute(rot, 3));
    g.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 2));
    g.setAttribute("aTile", new THREE.InstancedBufferAttribute(tile, 2));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    g.instanceCount = count;
    const m = new THREE.ShaderMaterial({
      vertexShader: slabVertex,
      fragmentShader: slabFragment,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { tAtlas: { value: atlas }, uTime: { value: 0 }, uTint: { value: world.t }, uShow: { value: 0 } },
    });
    return { geometry: g, material: m };
  }, [world, count, atlas]);

  useFrame(() => {
    const k = clock.current;
    material.uniforms.uTime.value = k.t;
    material.uniforms.uShow.value = state.current.phase === "climb" ? 1 : 0;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={6} />;
}

// ---------------------------------------------------------------------------
// The laptop screen: black glass that boots into the editor
// ---------------------------------------------------------------------------
const screenFragment = /* glsl */ `
${SPECTRUM_GLSL}
uniform sampler2D tScreen;
uniform float uPower;   // 0 off … 1 on
uniform float uTime;
uniform float uTint;
uniform float uHover;
varying vec2 vUv;
void main() {
  vec3 content = texture2D(tScreen, vUv).rgb;
  // Boot: a thin line of light opens into the picture.
  float open = smoothstep(0.0, 0.7, uPower);
  float band = smoothstep(open, open - 0.02, abs(vUv.y - 0.5) * 2.0);
  float line = exp(-pow((abs(vUv.y - 0.5) * 2.0 - open) * 40.0, 2.0)) * step(uPower, 0.98) * 1.4;
  float lit = smoothstep(0.6, 1.0, uPower);
  vec3 c = content * band * lit * (1.0 + uHover * 0.25);
  c += spectrum(uTint) * line * step(0.001, uPower);
  // A breath across the glass, so it is never a flat picture.
  float sheen = smoothstep(0.0, 1.0, 1.0 - abs(vUv.x + vUv.y * 0.3 - 0.65 - sin(uTime * 0.2) * 0.1) * 4.0) * 0.03;
  c += sheen * lit;
  gl_FragColor = vec4(c + vec3(0.004), 1.0);
}
`;

const KEY_COLS = 14;
const KEY_ROWS = 5;
/** Laptop body size (world units) — a 14" at arm's length. */
const LAP_W = 1.9;
const LAP_D = 1.25;
const LAP_T = 0.055;
const LID_T = 0.03;
const OPEN_ANGLE = THREE.MathUtils.degToRad(104);

type Part = { scatterIn: THREE.Vector3; scatterOut: THREE.Vector3; home: THREE.Vector3; spin: THREE.Vector3; seed: number };

/** The engineer's laptop, scattered → assembled → lit → scattered again, by scroll. */
export function EngineerAssembly({ world }: { world: World }) {
  const { clock, state } = useVr();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const root = useRef<THREE.Group>(null);
  const baseRef = useRef<THREE.Group>(null);
  const lidPivot = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  const padRef = useRef<THREE.Mesh>(null);
  const keysRef = useRef<THREE.InstancedMesh>(null);
  const screenRef = useRef<THREE.Mesh>(null);
  const live = useRef({ power: 0, hover: 0, lastHover: null as string | null });

  // Where the assembly stands: ahead of the camera's pose at the section, a little to the right
  // (the chapter's words sit on the left). Narrow screens see a narrower slice of the world:
  // it moves toward the centre and further away.
  const anchor = useMemo(() => {
    const pose = climbPose(world.c);
    const aspect = size.width / Math.max(1, size.height);
    const narrow = THREE.MathUtils.clamp(1.67 / aspect, 1, 2.2);
    const pos = pose.pos
      .clone()
      .addScaledVector(pose.fwd, 5.0 + (narrow - 1) * 2.2)
      .addScaledVector(pose.right, 1.4 / narrow)
      .add(new THREE.Vector3(0, -0.3 + (narrow - 1) * 1.1, 0)); // phones: above the words
    // Same heading as the camera (its yaw is a left-handed turn, so Ry takes the negative):
    // the hinge is at the far side and the open lid faces back at you.
    return { pos, yaw: -pose.yaw };
  }, [world.c, size.width, size.height]);

  const parts = useMemo(() => {
    const rnd = seeded(7 + Math.round(world.c * 13));
    // Loose parts hang ahead of the camera half a section before (and after) the peak,
    // so they are in view while they fly together, and as they drift apart again.
    const before = climbPose(world.c - 0.55);
    const after = climbPose(world.c + 0.55);
    const scatter = (pose: ReturnType<typeof climbPose>, spread: number) =>
      pose.pos
        .clone()
        .addScaledVector(pose.right, (rnd() * 2 - 1) * spread)
        .addScaledVector(pose.fwd, 3 + rnd() * 7)
        .add(new THREE.Vector3(0, (rnd() - 0.4) * spread, 0));
    const make = (home: THREE.Vector3): Part => ({
      scatterIn: scatter(before, 4.5),
      scatterOut: scatter(after, 5.5),
      home,
      spin: new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).multiplyScalar(2.5),
      seed: rnd(),
    });
    const keys: Part[] = [];
    const kw = (LAP_W * 0.84) / KEY_COLS;
    const kd = (LAP_D * 0.48) / KEY_ROWS;
    for (let r = 0; r < KEY_ROWS; r++) {
      for (let c = 0; c < KEY_COLS; c++) {
        keys.push(make(new THREE.Vector3((c - (KEY_COLS - 1) / 2) * kw, LAP_T / 2 + 0.012, -LAP_D * 0.46 + 0.08 + r * kd)));
      }
    }
    return { base: make(new THREE.Vector3(0, 0, 0)), lid: make(new THREE.Vector3(0, 0, -LAP_D / 2)), pad: make(new THREE.Vector3(0, LAP_T / 2 + 0.002, LAP_D * 0.27)), keys, kw, kd };
  }, [world.c]);

  const geo = useMemo(
    () => ({
      base: new RoundedBoxGeometry(LAP_W, LAP_T, LAP_D, 3, 0.02),
      lid: new RoundedBoxGeometry(LAP_W, LID_T, LAP_D * 0.98, 3, 0.015),
      key: new RoundedBoxGeometry(parts.kw * 0.78, 0.018, parts.kd * 0.72, 2, 0.006),
      pad: new RoundedBoxGeometry(LAP_W * 0.34, 0.004, LAP_D * 0.26, 2, 0.004),
      screen: new THREE.PlaneGeometry(LAP_W * 0.93, LAP_D * 0.98 * 0.88),
      bezelLight: new THREE.PlaneGeometry(LAP_W * 0.93 + 0.03, LAP_D * 0.98 * 0.88 + 0.03),
    }),
    [parts.kw, parts.kd],
  );
  const screenTex = useMemo(() => makeLaptopScreen(world.t), [world.t]);
  const screenMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: screenFragment,
        uniforms: { tScreen: { value: screenTex }, uPower: { value: 0 }, uTime: { value: 0 }, uTint: { value: world.t }, uHover: { value: 0 } },
      }),
    [screenTex, world.t],
  );
  const mat = useMemo(() => {
    const shell = new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#0a0a10"), roughness: 0.28, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 1.2 });
    const key = new THREE.MeshStandardMaterial({ color: new THREE.Color("#0d0d13"), roughness: 0.6, metalness: 0.05, emissive: new THREE.Color("#000000"), emissiveIntensity: 1 });
    const pad = new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#0c0c12"), roughness: 0.15, metalness: 0.1, clearcoat: 1, envMapIntensity: 1.5 });
    const bezel = new THREE.MeshBasicMaterial({ color: new THREE.Color("#000"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    return { shell, key, pad, bezel };
  }, []);
  const tint = useMemo(() => new THREE.Color().setHSL(((world.t * 285 - 15) / 360 + 1) % 1, 0.9, 0.62), [world.t]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1), ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), n: new THREE.Vector3(), w: new THREE.Vector3() }), []);

  useEffect(() => () => screenTex.dispose(), [screenTex]);
  useEffect(() => {
    // Ratul's own screenshot, when there is one, replaces the drawn editor.
    if (!LAPTOP_SCREEN_SRC) return;
    let live = true;
    new THREE.TextureLoader().load(LAPTOP_SCREEN_SRC, (t) => {
      if (!live) return t.dispose();
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      screenMat.uniforms.tScreen.value = t;
    });
    return () => {
      live = false;
    };
  }, [screenMat]);

  useFrame(() => {
    const k = clock.current;
    const s = state.current;
    const g = root.current;
    if (!g) return;
    const shown = k.climb > 0 || s.phase === "climb";
    g.visible = shown;
    if (!shown) return;

    const c = k.climb;
    const d = c - world.c;
    // gather: 0 scattered → 1 assembled; the parts meet over the section before, hold, then leave.
    const gather = 1 - THREE.MathUtils.smoothstep(Math.abs(d), 0.22, 0.95);
    const g3 = easeInOut(gather);
    const open = THREE.MathUtils.smoothstep(gather, 0.55, 1); // the lid unfolds once the parts have met
    const powerTarget = gather > 0.985 ? 1 : 0;
    const L = live.current;
    L.power = THREE.MathUtils.damp(L.power, powerTarget, powerTarget ? 1.6 : 5, k.dt);
    const t = k.t;

    // The whole assembly: anchored, breathing.
    g.position.copy(anchor.pos);
    g.position.y += Math.sin(t * 0.5) * 0.04;
    g.rotation.set(Math.sin(t * 0.33) * 0.02, anchor.yaw + Math.sin(t * 0.21) * 0.03, Math.sin(t * 0.27) * 0.015);

    const place = (obj: THREE.Object3D, part: Part) => {
      const from = d < 0 ? part.scatterIn : part.scatterOut;
      // Scatter positions are world space; bring them into the assembly's frame.
      tmp.w.copy(from);
      g.worldToLocal(tmp.w);
      tmp.w.addScaledVector(
        tmp.p.set(Math.sin(t * 0.3 + part.seed * 20), Math.sin(t * 0.27 + part.seed * 9), Math.cos(t * 0.23 + part.seed * 14)),
        0.4,
      );
      obj.position.lerpVectors(tmp.w, part.home, g3);
      const spin = (1 - g3) * (0.6 + part.seed) * 2;
      obj.rotation.set(part.spin.x * spin + t * 0.1 * (1 - g3), part.spin.y * spin, part.spin.z * spin);
    };
    if (baseRef.current) place(baseRef.current, parts.base);
    if (padRef.current) place(padRef.current, parts.pad);
    if (lidPivot.current) {
      place(lidPivot.current, parts.lid);
      if (lidRef.current) lidRef.current.rotation.x = -OPEN_ANGLE * easeInOut(open) * g3 + (1 - g3) * 0.4;
    }
    const keys = keysRef.current;
    if (keys) {
      parts.keys.forEach((part, i) => {
        const from = d < 0 ? part.scatterIn : part.scatterOut;
        tmp.w.copy(from);
        g.worldToLocal(tmp.w);
        tmp.w.addScaledVector(tmp.p.set(Math.sin(t * 0.4 + part.seed * 20), Math.sin(t * 0.37 + part.seed * 9), Math.cos(t * 0.33 + part.seed * 14)), 0.5);
        // Keys arrive a touch after the body, each in its own time.
        const gk = easeInOut(clamp01((gather - 0.1 * part.seed) / (1 - 0.1 * part.seed)));
        tmp.p.lerpVectors(tmp.w, part.home, gk);
        const spin = (1 - gk) * 3;
        tmp.e.set(part.spin.x * spin, part.spin.y * spin + t * 0.2 * (1 - gk), part.spin.z * spin);
        tmp.q.setFromEuler(tmp.e);
        tmp.m.compose(tmp.p, tmp.q, tmp.s);
        keys.setMatrixAt(i, tmp.m);
      });
      keys.instanceMatrix.needsUpdate = true;
      // Backlight comes with the power.
      mat.key.emissive.copy(tint).multiplyScalar(0.1 * L.power);
    }

    // Screen + bezel light.
    screenMat.uniforms.uPower.value = L.power;
    screenMat.uniforms.uTime.value = t;
    mat.bezel.opacity = L.power * 0.12;
    mat.bezel.color.copy(tint);

    // Portal: the pointer over the lit screen.
    let hover: string | null = null;
    const screen = screenRef.current;
    if (screen && L.power > 0.9 && s.phase === "climb" && !s.portal) {
      tmp.ndc.set(s.px, s.py);
      tmp.ray.setFromCamera(tmp.ndc, camera);
      if (tmp.ray.intersectObject(screen, false).length) hover = world.slug;
    }
    L.hover = THREE.MathUtils.damp(L.hover, hover ? 1 : 0, 8, k.dt);
    screenMat.uniforms.uHover.value = L.hover;
    if (hover !== L.lastHover) {
      L.lastHover = hover;
      s.portalHover = hover;
    }
    // Tell the Director where the screen is, for the fly-in.
    if (screen && L.power > 0.5) {
      screen.getWorldPosition(tmp.w);
      tmp.n.set(0, 0, 1).applyQuaternion(screen.getWorldQuaternion(tmp.q));
      s.portalAnchor = { x: tmp.w.x, y: tmp.w.y, z: tmp.w.z, nx: tmp.n.x, ny: tmp.n.y, nz: tmp.n.z };
    }
  });

  return (
    <group ref={root}>
      <group ref={baseRef}>
        <mesh geometry={geo.base} material={mat.shell} />
      </group>
      <mesh ref={padRef} geometry={geo.pad} material={mat.pad} />
      <instancedMesh ref={keysRef} args={[geo.key, mat.key, parts.keys.length]} frustumCulled={false} />
      {/* The lid pivots on the back edge of the base. */}
      <group ref={lidPivot}>
        <group ref={lidRef}>
          {/* Lid lies flat on the base when closed (hinge at the back edge, lid extends forward). */}
          <mesh geometry={geo.lid} material={mat.shell} position={[0, LAP_T / 2 + LID_T / 2, LAP_D * 0.49]} />
          {/* Screen on the lid's inner face: it looks down at the keys when closed, at you when open. */}
          <mesh ref={screenRef} geometry={geo.screen} material={screenMat} position={[0, LAP_T / 2 - 0.003, LAP_D * 0.49 + 0.02]} rotation-x={Math.PI / 2} />
          <mesh geometry={geo.bezelLight} material={mat.bezel} position={[0, LAP_T / 2 - 0.004, LAP_D * 0.49 + 0.02]} rotation-x={Math.PI / 2} />
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Worlds: the field for every persona that has one (round B: the engineer)
// ---------------------------------------------------------------------------
export function Worlds({ worlds, slabs }: { worlds: World[]; slabs: number }) {
  const engineer = worlds.find((w) => w.slug === "engineer");
  const atlas = useMemo(() => (engineer ? makeSlabAtlas(engineer.t) : null), [engineer]);
  useEffect(() => () => atlas?.dispose(), [atlas]);
  if (!engineer || !atlas) return null;
  return (
    <>
      <Slabs world={engineer} count={slabs} atlas={atlas} />
      <EngineerAssembly world={engineer} />
    </>
  );
}
