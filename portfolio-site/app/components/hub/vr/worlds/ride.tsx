"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: transforms and materials are mutated
   every frame inside the assembly's frame callback. */

/**
 * The rider's bike (D38 round C): frame, wheels, bars, seat and headlight fly
 * together; powered, the headlight comes on and a route panel beside it draws
 * its glowing line with light pins. The route panel is the doorway.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Halo, Tube, makeScreenMaterial, useAssembly } from "../assembly";
import { makeRouteScreen } from "../screens-worlds";
import type { World } from "../state";

const PANEL_W = 1.3;
const PANEL_H = 0.81;
// Frame points (side view, xy plane): bottom bracket, rear axle, front axle, head, seat.
const B: [number, number, number] = [-0.06, -0.1, 0];
const R: [number, number, number] = [-0.95, 0, 0];
const F: [number, number, number] = [0.95, 0, 0];
const H: [number, number, number] = [0.6, 0.72, 0];
const HB: [number, number, number] = [0.7, 0.5, 0];
const S: [number, number, number] = [-0.38, 0.74, 0];

function Wheel({ mats }: { mats: ReturnType<typeof useAssembly>["mats"] }) {
  const geo = useMemo(() => ({ tyre: new THREE.TorusGeometry(0.52, 0.045, 12, 48), rim: new THREE.TorusGeometry(0.46, 0.012, 8, 48), disc: new THREE.RingGeometry(0.06, 0.45, 48), hub: new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16).rotateX(Math.PI / 2) }), []);
  const disc = useMemo(() => new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#0b0b10"), roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.55, clearcoat: 1, side: THREE.DoubleSide }), []);
  return (
    <group>
      <mesh geometry={geo.tyre} material={mats.matte} />
      <mesh geometry={geo.rim} material={mats.metal} />
      <mesh geometry={geo.disc} material={disc} />
      <mesh geometry={geo.hub} material={mats.metal} />
    </group>
  );
}

export function RideAssembly({ world }: { world: World }) {
  const root = useRef<THREE.Group>(null);
  const refs = useMemo(() => [0, 1, 2, 3, 4, 5, 6].map(() => ({ current: null as THREE.Group | null })), []);
  const panel = useRef<THREE.Mesh>(null);
  const screens = useMemo(() => [panel], []);
  // Homes: 0 frame · 1 front wheel · 2 rear wheel · 3 bars · 4 seat · 5 headlight · 6 route panel.
  const homes = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(...F), new THREE.Vector3(...R), new THREE.Vector3(0.62, 0.8, 0), new THREE.Vector3(-0.4, 0.8, 0), new THREE.Vector3(0.78, 0.6, 0), new THREE.Vector3(0.55, 1.75, -0.15)],
    [],
  );
  const geo = useMemo(
    () => ({
      bars: new THREE.CylinderGeometry(0.022, 0.022, 0.6, 12),
      stem: new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10),
      seat: new RoundedBoxGeometry(0.3, 0.06, 0.14, 2, 0.025),
      post: new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10),
      lamp: new THREE.CylinderGeometry(0.075, 0.09, 0.12, 20).rotateZ(-Math.PI / 2),
      lens: new THREE.CircleGeometry(0.07, 20),
      beam: new THREE.ConeGeometry(0.9, 2.6, 24, 1, true).rotateZ(Math.PI / 2),
      panel: new THREE.PlaneGeometry(PANEL_W, PANEL_H),
      light: new THREE.PlaneGeometry(PANEL_W + 0.03, PANEL_H + 0.03),
    }),
    [],
  );
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#fff3d6"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), []);
  const lensMat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#000"), toneMapped: false }), []);
  const tex = useMemo(() => makeRouteScreen(world.t), [world.t]);
  const mat = useMemo(() => makeScreenMaterial(tex, world.t, 1), [tex, world.t]);
  const screenMats = useMemo(() => [mat], [mat]);
  useEffect(() => () => tex.dispose(), [tex]);

  const { mats } = useAssembly({
    world,
    root,
    screens,
    homes,
    screenMats,
    yaw: -0.35,
    offset: { fwd: 5.6, right: 1.4, up: -0.75 },
    onFrame: (L, place) => {
      refs.forEach((r, i) => r.current && place(r.current, i, i === 6 ? 0.1 : 0));
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

  return (
    <group ref={root}>
      <group ref={(el) => void (refs[0].current = el)}>
        <Tube from={S} to={H} r={0.03} material={mats.shell} />
        <Tube from={H} to={B} r={0.032} material={mats.shell} />
        <Tube from={S} to={B} r={0.03} material={mats.shell} />
        <Tube from={B} to={R} r={0.022} material={mats.shell} />
        <Tube from={S} to={R} r={0.022} material={mats.shell} />
        <Tube from={H} to={HB} r={0.034} material={mats.shell} />
        <Tube from={HB} to={F} r={0.024} material={mats.metal} />
      </group>
      <group ref={(el) => void (refs[1].current = el)}>
        <Wheel mats={mats} />
      </group>
      <group ref={(el) => void (refs[2].current = el)}>
        <Wheel mats={mats} />
      </group>
      <group ref={(el) => void (refs[3].current = el)}>
        <mesh geometry={geo.stem} material={mats.metal} position={[0, -0.06, 0]} />
        <mesh geometry={geo.bars} material={mats.metal} rotation-x={Math.PI / 2} />
      </group>
      <group ref={(el) => void (refs[4].current = el)}>
        <mesh geometry={geo.post} material={mats.metal} position={[0, -0.08, 0]} />
        <mesh geometry={geo.seat} material={mats.matte} />
      </group>
      <group ref={(el) => void (refs[5].current = el)}>
        <mesh geometry={geo.lamp} material={mats.metal} />
        <mesh geometry={geo.lens} material={lensMat} position={[0.062, 0, 0]} rotation-y={Math.PI / 2} />
        <mesh geometry={geo.beam} material={beamMat} position={[1.4, 0, 0]} />
      </group>
      <group ref={(el) => void (refs[6].current = el)}>
        <mesh ref={panel} geometry={geo.panel} material={mat} />
        <mesh geometry={geo.light} material={mats.bezel} position={[0, 0, -0.001]} />
        <Halo width={PANEL_W} height={PANEL_H} material={mats.halo} position={[0, 0, -0.04]} />
      </group>
    </group>
  );
}
