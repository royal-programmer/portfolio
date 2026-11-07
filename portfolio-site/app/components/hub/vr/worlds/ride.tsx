"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: transforms and materials are mutated
   every frame inside the assembly's frame callback. */

/**
 * The rider's bike (D38 round C feedback): a stylised sport bike built in code
 * — fairing, tank, seat hump, twin exhausts, bars, two wheels — with the kit
 * around it: helmet, tank bag, panniers, gloves, intercom — or, when
 * public/hub/models/bike.glb exists, a real low-poly sport bike re-skinned in
 * the same finishes (CC-BY, credited in the console). Powered, the
 * headlight comes on with a beam and the TFT dash lights up: speedo, gear, the
 * trip's route with light pins. The dash is the doorway.
 */
import { useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Halo, Tube, makeScreenMaterial, useAssembly } from "../assembly";
import { makeDashScreen } from "../screens-worlds";
import type { World } from "../state";

// The TFT dash on the bike (the doorway): where a real one sits — on the top yoke, just behind the
// screen, between the bars, its face tilted up and back to the rider (about 40° off vertical). From
// the side you see its edge; the fly-in comes over the tank and down onto it, the rider's view.
// Measured off the model: the bars sit at x ≈ 0.55–0.65, the dip behind the screen tops out at y ≈ 0.65.
const PANEL_W = 0.42;
const PANEL_H = 0.21;
const DASH_TILT = (40 * Math.PI) / 180;
// Side view, xy plane, bike pointing +x. Wheel radius 0.46.
const R_AXLE: [number, number, number] = [-0.86, 0, 0];
const F_AXLE: [number, number, number] = [0.9, 0, 0];

function Wheel({ mats }: { mats: ReturnType<typeof useAssembly>["mats"] }) {
  const geo = useMemo(
    () => ({
      tyre: new THREE.TorusGeometry(0.46, 0.085, 14, 48),
      rim: new THREE.TorusGeometry(0.36, 0.014, 8, 48),
      disc: new THREE.CylinderGeometry(0.2, 0.2, 0.02, 32).rotateX(Math.PI / 2),
      hub: new THREE.CylinderGeometry(0.07, 0.07, 0.16, 16).rotateX(Math.PI / 2),
    }),
    [],
  );
  const spokes = useMemo(() => Array.from({ length: 5 }, (_, i) => (i / 5) * Math.PI * 2), []);
  return (
    <group>
      <mesh geometry={geo.tyre} material={mats.matte} />
      <mesh geometry={geo.rim} material={mats.metal} />
      <mesh geometry={geo.disc} material={mats.metal} position={[0, 0, 0.06]} />
      <mesh geometry={geo.hub} material={mats.metal} />
      {spokes.map((a) => (
        <Tube key={a} from={[0, 0, 0]} to={[Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0]} r={0.018} material={mats.metal} />
      ))}
    </group>
  );
}

type Mats = ReturnType<typeof useAssembly>["mats"];
type Finish = "shell" | "matte" | "metal" | "glass";

/** Which of the setup's finishes a baked colour becomes. */
function finishOf(r: number, g: number, b: number): Finish {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  if (sat > 0.35 && lum > 0.12) return "shell"; // paint
  if (lum > 0.75) return "shell"; // white paint, screen — same finish, so the body reads as one
  if (lum > 0.3) return "metal"; // rims, forks, engine
  return "matte"; // tyres, seat, rubber
}

/**
 * Low-poly models bake their colours into a tiny palette texture with no material names.
 * Read the colour under each triangle and split the geometry into the setup's finishes.
 */
function splitByPalette(mesh: THREE.Mesh, map: THREE.Texture, mats: Mats): boolean {
  const img = map.image as CanvasImageSource & { width: number; height: number };
  if (!img || !img.width) return false;
  const cv = document.createElement("canvas");
  cv.width = img.width;
  cv.height = img.height;
  const cx = cv.getContext("2d");
  if (!cx) return false;
  cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, cv.width, cv.height).data;
  const geo = mesh.geometry.index ? mesh.geometry : mesh.geometry.toNonIndexed();
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined;
  if (!uv) return false;
  const index = geo.index ? Array.from(geo.index.array) : Array.from({ length: uv.count }, (_, i) => i);
  const order: Finish[] = ["shell", "matte", "metal", "glass"];
  const buckets: Record<string, number[]> = { shell: [], matte: [], metal: [], glass: [] };
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
    const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
    const x = Math.min(cv.width - 1, Math.max(0, Math.floor((u - Math.floor(u)) * cv.width)));
    // glTF UVs run top-down (GLTFLoader leaves flipY off); canvas rows do too.
    const vv = map.flipY ? 1 - (v - Math.floor(v)) : v - Math.floor(v);
    const y = Math.min(cv.height - 1, Math.max(0, Math.floor(vv * cv.height)));
    const o = (y * cv.width + x) * 4;
    buckets[finishOf(px[o] / 255, px[o + 1] / 255, px[o + 2] / 255)].push(a, b, c);
  }
  const merged: number[] = [];
  const out = geo.clone();
  out.clearGroups();
  order.forEach((k, m) => {
    const list = buckets[k];
    if (!list.length) return;
    out.addGroup(merged.length, list.length, m);
    merged.push(...list);
  });
  out.setIndex(merged);
  // Palette models ship without normals: unweld and compute flat ones so the finishes catch the light.
  const flat = out.toNonIndexed();
  flat.computeVertexNormals();
  mesh.geometry = flat;
  mesh.material = order.map((k) => mats[k]);
  return true;
}

/**
 * A bike from public/hub/models/bike.glb (CC-BY — credited in the console and in
 * docs/claude-planning/15-credits.md), re-skinned in the setup's finishes and fitted to the
 * stylised bike's footprint (≈ 2.7 long, wheels on y = −0.46). Palette-baked models are split by
 * colour; models with named materials go by name: tyre / rubber → matte, glass / light / lamp →
 * glow, chrome / metal / exhaust → metal, else shell.
 */
function BikeModel({ url, mats }: { url: string; mats: Mats }) {
  const { scene } = useGLTF(url);
  const fitted = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial | undefined;
      const map = src?.map;
      if (!(map && splitByPalette(m, map, mats))) {
        const name = `${m.name} ${src?.name ?? ""}`.toLowerCase();
        m.material = /tyre|tire|rubber|seat/.test(name) ? mats.matte : /glass|light|lamp|led/.test(name) ? mats.glow : /chrome|metal|exhaust|rim|spoke|fork|engine/.test(name) ? mats.metal : mats.shell;
        if (!m.geometry.getAttribute("normal")) {
          m.geometry = m.geometry.toNonIndexed();
          m.geometry.computeVertexNormals();
        }
      }
      m.castShadow = m.receiveShadow = false;
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    // Longest horizontal axis → x (side view), front towards +x (the headlight beam), length 2.7.
    const k = 2.7 / Math.max(size.x, size.z, 0.001);
    const holder = new THREE.Group();
    if (size.z > size.x) root.rotation.y = -Math.PI / 2;
    holder.add(root);
    holder.scale.setScalar(k);
    root.position.set(-centre.x, -box.min.y, -centre.z);
    holder.position.y = -0.46;
    return holder;
  }, [scene, mats]);
  return <primitive object={fitted} />;
}

export function RideAssembly({ world, modelUrl }: { world: World; /** A CC0 .glb in public/hub/models, when there is one. */ modelUrl?: string }) {
  const root = useRef<THREE.Group>(null);
  const N = 11;
  const refs = useMemo(() => Array.from({ length: N }, () => ({ current: null as THREE.Group | null })), []);
  const panel = useRef<THREE.Mesh>(null);
  const screens = useMemo(() => [panel], []);
  // Homes: 0 body (fairing, tank, seat, frame, exhausts) · 1 front wheel · 2 rear wheel · 3 bars ·
  // 4 headlight · 5 dash · 6 helmet · 7 tank bag · 8 pannier · 9 gloves · 10 intercom.
  const homes = useMemo(
    () => [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(...F_AXLE),
      new THREE.Vector3(...R_AXLE),
      new THREE.Vector3(0.62, 0.78, 0),
      new THREE.Vector3(1.02, 0.62, 0),
      new THREE.Vector3(0.56, 0.76, 0),
      new THREE.Vector3(-1.7, 0.25, 0.35),
      new THREE.Vector3(0.1, 0.86, 0),
      new THREE.Vector3(-0.72, 0.42, 0.34),
      new THREE.Vector3(-1.55, -0.15, 0.55),
      new THREE.Vector3(-1.62, 0.6, 0.55),
    ],
    [],
  );
  const geo = useMemo(
    () => ({
      fairing: new RoundedBoxGeometry(0.95, 0.5, 0.44, 4, 0.16),
      nose: new RoundedBoxGeometry(0.42, 0.34, 0.36, 4, 0.14),
      tank: new RoundedBoxGeometry(0.62, 0.32, 0.4, 4, 0.14),
      seat: new RoundedBoxGeometry(0.5, 0.1, 0.3, 3, 0.04),
      hump: new RoundedBoxGeometry(0.42, 0.26, 0.32, 4, 0.12),
      belly: new RoundedBoxGeometry(0.9, 0.3, 0.38, 4, 0.1),
      exhaust: new THREE.CylinderGeometry(0.06, 0.075, 0.5, 14).rotateZ(Math.PI / 2),
      bars: new THREE.CylinderGeometry(0.02, 0.02, 0.56, 12),
      grip: new THREE.CylinderGeometry(0.028, 0.028, 0.12, 12),
      lamp: new RoundedBoxGeometry(0.1, 0.16, 0.3, 3, 0.04),
      lens: new THREE.PlaneGeometry(0.1, 0.24),
      beam: new THREE.ConeGeometry(0.9, 2.8, 24, 1, true).rotateZ(Math.PI / 2),
      panel: new THREE.PlaneGeometry(PANEL_W, PANEL_H),
      dashBody: new RoundedBoxGeometry(PANEL_W + 0.04, PANEL_H + 0.04, 0.05, 3, 0.012),
      light: new THREE.PlaneGeometry(PANEL_W + 0.03, PANEL_H + 0.03),
      helmet: new THREE.SphereGeometry(0.24, 32, 24),
      visor: new THREE.SphereGeometry(0.235, 32, 16, -0.2, 1.9, 0.9, 1.0),
      tankBag: new RoundedBoxGeometry(0.34, 0.2, 0.28, 3, 0.06),
      pannier: new RoundedBoxGeometry(0.42, 0.36, 0.22, 3, 0.06),
      glove: new RoundedBoxGeometry(0.11, 0.05, 0.2, 3, 0.03),
      intercom: new RoundedBoxGeometry(0.1, 0.07, 0.03, 2, 0.015),
    }),
    [],
  );
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff3d6"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), []);
  const lensMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#000"), toneMapped: false }), []);
  const visorMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#05060a"), roughness: 0.05, metalness: 0.2, clearcoat: 1, envMapIntensity: 2.2 }), []);
  const fabric = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color("#101014"), roughness: 0.95, metalness: 0 }), []);
  const tex = useMemo(() => makeDashScreen(world.t), [world.t]);
  const mat = useMemo(() => makeScreenMaterial(tex, world.t, 1), [tex, world.t]);
  const screenMats = useMemo(() => [mat], [mat]);
  useEffect(() => () => tex.dispose(), [tex]);

  const { mats, tint } = useAssembly({
    world,
    root,
    screens,
    homes,
    screenMats,
    yaw: -0.35,
    offset: { fwd: 5.8, right: 1.3, up: -0.7 },
    // The rider's seat: behind and above the dash, looking down onto it over the top yoke.
    view: { back: 1.6, up: -0.3 },
    onFrame: (L, place) => {
      refs.forEach((r, i) => r.current && place(r.current, i, i >= 6 ? 0.12 : 0));
      // Wheels keep turning slowly, faster once lit.
      const spin = L.t * (0.4 + L.power * 1.6);
      if (refs[1].current) refs[1].current.rotation.z -= spin;
      if (refs[2].current) refs[2].current.rotation.z -= spin;
      // Headlight on.
      const on = L.power;
      lensMat.color.setRGB(2.6 * on + 0.02, 2.3 * on + 0.02, 1.7 * on + 0.02);
      beamMat.opacity = on * 0.12;
    },
  });
  const accent = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color("#0d0d13"), roughness: 0.3, metalness: 0.4, emissive: new THREE.Color("#000"), emissiveIntensity: 1 }), []);
  useEffect(() => {
    accent.emissive.copy(tint).multiplyScalar(0.08);
  }, [accent, tint]);

  if (modelUrl) {
    // The real bike as one piece (plus its light) and its dash — nothing else around it.
    return (
      <group ref={root}>
        <group ref={(el) => void (refs[0].current = el)}>
          <Suspense fallback={null}>
            <BikeModel url={modelUrl} mats={mats} />
          </Suspense>
          <mesh geometry={geo.beam} material={beamMat} position={[2.7, 0.3, 0]} />
        </group>
        <group ref={(el) => void (refs[5].current = el)}>
          {/* The dash: lies on the bike, faces up and back — the fly-in comes down onto it (top view). */}
          {/* Faces back (−x) first, then tilts up: the plane's normal ends up pointing up and back at the rider. */}
          <group rotation={[0, 0, -(Math.PI / 2 - DASH_TILT)]}>
            <group rotation={[0, -Math.PI / 2, 0]}>
              <mesh ref={panel} geometry={geo.panel} material={mat} />
              <mesh geometry={geo.light} material={mats.bezel} position={[0, 0, -0.001]} />
              <mesh geometry={geo.dashBody} material={mats.matte} position={[0, 0, -0.03]} />
              <Halo width={PANEL_W * 1.2} height={PANEL_H * 1.2} material={mats.halo} position={[0, 0, -0.02]} />
            </group>
          </group>
        </group>
      </group>
    );
  }

  return (
    <group ref={root}>
      {/* Body: fairing with nose, tank, seat and hump, belly pan, frame line, twin exhausts. */}
      <group ref={(el) => void (refs[0].current = el)}>
        <mesh geometry={geo.fairing} material={mats.shell} position={[0.42, 0.45, 0]} rotation-z={-0.18} />
        <mesh geometry={geo.nose} material={mats.shell} position={[0.9, 0.5, 0]} rotation-z={-0.35} />
        <mesh geometry={geo.tank} material={mats.shell} position={[0.05, 0.62, 0]} rotation-z={0.08} />
        <mesh geometry={geo.seat} material={mats.matte} position={[-0.42, 0.6, 0]} rotation-z={0.06} />
        <mesh geometry={geo.hump} material={mats.shell} position={[-0.8, 0.62, 0]} rotation-z={0.3} />
        <mesh geometry={geo.belly} material={mats.shell} position={[0.05, 0.12, 0]} rotation-z={0.05} />
        <mesh geometry={geo.exhaust} material={mats.metal} position={[-0.9, 0.3, 0.14]} rotation-z={0.25} />
        <mesh geometry={geo.exhaust} material={mats.metal} position={[-0.9, 0.3, -0.14]} rotation-z={0.25} />
        {/* Swingarm, fork legs and the accent line along the fairing. */}
        <Tube from={[-0.2, 0.2, 0.1]} to={R_AXLE} r={0.035} material={mats.metal} />
        <Tube from={[0.74, 0.74, 0.07]} to={[0.92, 0.0, 0.07]} r={0.028} material={mats.metal} />
        <Tube from={[0.74, 0.74, -0.07]} to={[0.92, 0.0, -0.07]} r={0.028} material={mats.metal} />
        <Tube from={[0.95, 0.34, 0.23]} to={[-0.1, 0.5, 0.23]} r={0.012} material={accent} />
        <Tube from={[0.95, 0.34, -0.23]} to={[-0.1, 0.5, -0.23]} r={0.012} material={accent} />
      </group>
      <group ref={(el) => void (refs[1].current = el)}>
        <Wheel mats={mats} />
      </group>
      <group ref={(el) => void (refs[2].current = el)}>
        <Wheel mats={mats} />
      </group>
      {/* Clip-ons. */}
      <group ref={(el) => void (refs[3].current = el)}>
        <mesh geometry={geo.bars} material={mats.metal} rotation-x={Math.PI / 2} />
        <mesh geometry={geo.grip} material={mats.matte} position={[0, 0, 0.26]} rotation-x={Math.PI / 2} />
        <mesh geometry={geo.grip} material={mats.matte} position={[0, 0, -0.26]} rotation-x={Math.PI / 2} />
      </group>
      {/* Headlight in the nose, beam forward. */}
      <group ref={(el) => void (refs[4].current = el)}>
        <mesh geometry={geo.lamp} material={mats.shell} />
        <mesh geometry={geo.lens} material={lensMat} position={[0.051, 0, 0]} rotation-y={Math.PI / 2} />
        <mesh geometry={geo.beam} material={beamMat} position={[1.5, 0, 0]} />
      </group>
      {/* The dash: the doorway. */}
      <group ref={(el) => void (refs[5].current = el)}>
        <group rotation={[0, 0, -(Math.PI / 2 - DASH_TILT)]}>
          <group rotation={[0, -Math.PI / 2, 0]}>
            <mesh ref={panel} geometry={geo.panel} material={mat} />
            <mesh geometry={geo.light} material={mats.bezel} position={[0, 0, -0.001]} />
            <mesh geometry={geo.dashBody} material={mats.matte} position={[0, 0, -0.03]} />
            <Halo width={PANEL_W * 1.2} height={PANEL_H * 1.2} material={mats.halo} position={[0, 0, -0.02]} />
          </group>
        </group>
      </group>
      {/* The kit. */}
      <group ref={(el) => void (refs[6].current = el)}>
        <mesh geometry={geo.helmet} material={mats.shell} />
        <mesh geometry={geo.visor} material={visorMat} rotation-y={0.4} />
      </group>
      <group ref={(el) => void (refs[7].current = el)}>
        <mesh geometry={geo.tankBag} material={fabric} />
      </group>
      <group ref={(el) => void (refs[8].current = el)}>
        <mesh geometry={geo.pannier} material={fabric} />
      </group>
      <group ref={(el) => void (refs[9].current = el)}>
        <mesh geometry={geo.glove} material={fabric} position={[-0.07, 0, 0]} rotation-z={0.2} />
        <mesh geometry={geo.glove} material={fabric} position={[0.07, 0, 0.04]} rotation-z={-0.15} />
      </group>
      <group ref={(el) => void (refs[10].current = el)}>
        <mesh geometry={geo.intercom} material={mats.glow} />
      </group>
    </group>
  );
}
