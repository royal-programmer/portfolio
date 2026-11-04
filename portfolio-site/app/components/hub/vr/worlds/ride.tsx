"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: transforms and materials are mutated
   every frame inside the assembly's frame callback. */

/**
 * The rider's bike (D38 round C feedback): a stylised sport bike built in code
 * — fairing, tank, seat hump, twin exhausts, bars, two wheels — with the kit
 * around it: helmet, tank bag, panniers, gloves, intercom. No make, no model:
 * no CC0 superbike exists and CC-BY needs on-screen credit. Powered, the
 * headlight comes on with a beam and the route panel draws its glowing line
 * with light pins. The route panel is the doorway.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Halo, Tube, makeScreenMaterial, useAssembly } from "../assembly";
import { makeRouteScreen } from "../screens-worlds";
import type { World } from "../state";

const PANEL_W = 1.3;
const PANEL_H = 0.81;
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

export function RideAssembly({ world }: { world: World }) {
  const root = useRef<THREE.Group>(null);
  const N = 11;
  const refs = useMemo(() => Array.from({ length: N }, () => ({ current: null as THREE.Group | null })), []);
  const panel = useRef<THREE.Mesh>(null);
  const screens = useMemo(() => [panel], []);
  // Homes: 0 body (fairing, tank, seat, frame, exhausts) · 1 front wheel · 2 rear wheel · 3 bars ·
  // 4 headlight · 5 route panel · 6 helmet · 7 tank bag · 8 pannier · 9 gloves · 10 intercom.
  const homes = useMemo(
    () => [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(...F_AXLE),
      new THREE.Vector3(...R_AXLE),
      new THREE.Vector3(0.62, 0.78, 0),
      new THREE.Vector3(1.02, 0.62, 0),
      new THREE.Vector3(0.9, 1.9, -0.2),
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
  const tex = useMemo(() => makeRouteScreen(world.t), [world.t]);
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
      {/* The route panel: the doorway. */}
      <group ref={(el) => void (refs[5].current = el)}>
        <mesh ref={panel} geometry={geo.panel} material={mat} />
        <mesh geometry={geo.light} material={mats.bezel} position={[0, 0, -0.001]} />
        <Halo width={PANEL_W} height={PANEL_H} material={mats.halo} position={[0, 0, -0.04]} />
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
