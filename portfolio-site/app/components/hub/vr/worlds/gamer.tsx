"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: transforms and materials are mutated
   every frame inside the assembly's frame callback. */

/**
 * The gamer's desk (D38 round C): tower, two monitors, keyboard and mouse
 * land on a desk; powered, the RGB comes on and the monitor boots to the handle.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Halo, makeScreenMaterial, useAssembly } from "../assembly";
import { makeGamerScreen } from "../screens-worlds";
import type { World } from "../state";

const MAIN_W = 1.7;
const MAIN_H = 0.74;
const SIDE_W = 0.95;
const SIDE_H = 0.62;

export function GamerAssembly({ world, handle }: { world: World; handle: string }) {
  const root = useRef<THREE.Group>(null);
  const refs = useMemo(() => [0, 1, 2, 3, 4, 5].map(() => ({ current: null as THREE.Group | null })), []);
  const mainRef = useRef<THREE.Mesh>(null);
  const sideRef = useRef<THREE.Mesh>(null);
  const screens = useMemo(() => [mainRef, sideRef], []);
  // Homes: 0 desk · 1 tower · 2 main monitor · 3 side monitor · 4 keyboard · 5 mouse.
  const homes = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-1.35, 0.55, -0.1), new THREE.Vector3(0.1, 0.025, -0.3), new THREE.Vector3(1.2, 0.025, -0.22), new THREE.Vector3(0.05, 0.04, 0.28), new THREE.Vector3(0.72, 0.04, 0.3)],
    [],
  );
  const geo = useMemo(
    () => ({
      desk: new RoundedBoxGeometry(3.3, 0.05, 1.1, 3, 0.02),
      tower: new RoundedBoxGeometry(0.46, 1.06, 0.98, 3, 0.02),
      strip: new THREE.PlaneGeometry(0.02, 0.9),
      window: new THREE.PlaneGeometry(0.8, 0.9),
      base: new THREE.CylinderGeometry(0.2, 0.22, 0.02, 32),
      pole: new THREE.CylinderGeometry(0.025, 0.025, 0.4, 12),
      mainBezel: new RoundedBoxGeometry(MAIN_W, MAIN_H, 0.045, 2, 0.012),
      mainScreen: new THREE.PlaneGeometry(MAIN_W * 0.95, MAIN_H * 0.9),
      mainLight: new THREE.PlaneGeometry(MAIN_W * 0.95 + 0.03, MAIN_H * 0.9 + 0.03),
      sideBezel: new RoundedBoxGeometry(SIDE_W, SIDE_H, 0.045, 2, 0.012),
      sideScreen: new THREE.PlaneGeometry(SIDE_W * 0.94, SIDE_H * 0.9),
      keyboard: new RoundedBoxGeometry(1.0, 0.03, 0.32, 2, 0.008),
      underglow: new THREE.PlaneGeometry(1.14, 0.46),
      mouse: new RoundedBoxGeometry(0.1, 0.04, 0.17, 3, 0.02),
    }),
    [],
  );
  const rgb = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#000"), toneMapped: false }), []);
  const under = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color("#000"), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), []);
  const tex = useMemo(() => makeGamerScreen(world.t, handle), [world.t, handle]);
  const mat = useMemo(() => makeScreenMaterial(tex, world.t, 0), [tex, world.t]);
  const screenMats = useMemo(() => [mat], [mat]);
  useEffect(() => () => tex.dispose(), [tex]);
  const hsl = useMemo(() => new THREE.Color(), []);

  const { mats } = useAssembly({
    world,
    root,
    screens,
    homes,
    screenMats,
    offset: { fwd: 5.8, right: 1.5, up: -0.55 },
    view: { back: 1.25, up: 0.05 },
    onFrame: (L, place) => {
      refs.forEach((r, i) => r.current && place(r.current, i, i >= 4 ? 0.15 : 0));
      // RGB: the strip and the keyboard underglow cycle slowly through the spectrum once lit.
      hsl.setHSL((L.t * 0.05) % 1, 0.9, 0.6);
      rgb.color.copy(hsl).multiplyScalar(2.2 * L.power + 0.01);
      under.color.copy(hsl);
      under.opacity = L.power * 0.35;
    },
  });

  return (
    <group ref={root}>
      <group ref={(el) => void (refs[0].current = el)}>
        <mesh geometry={geo.desk} material={mats.shell} />
      </group>
      <group ref={(el) => void (refs[1].current = el)}>
        <mesh geometry={geo.tower} material={mats.shell} />
        <mesh geometry={geo.window} material={mats.glass} position={[0.231, 0.02, 0]} rotation-y={Math.PI / 2} />
        <mesh geometry={geo.strip} material={rgb} position={[0.232, 0.02, -0.42]} rotation-y={Math.PI / 2} />
        <mesh geometry={geo.strip} material={rgb} position={[0.232, 0.02, 0.42]} rotation-y={Math.PI / 2} />
      </group>
      <group ref={(el) => void (refs[2].current = el)}>
        <mesh geometry={geo.base} material={mats.metal} position={[0, 0.01, 0]} />
        <mesh geometry={geo.pole} material={mats.metal} position={[0, 0.21, -0.03]} />
        <group position={[0, 0.7, 0]}>
          <mesh geometry={geo.mainBezel} material={mats.shell} />
          <mesh ref={mainRef} geometry={geo.mainScreen} material={mat} position={[0, 0, 0.024]} />
          <mesh geometry={geo.mainLight} material={mats.bezel} position={[0, 0, 0.023]} />
          <Halo width={MAIN_W * 0.95} height={MAIN_H * 0.9} material={mats.halo} position={[0, 0, -0.03]} />
        </group>
      </group>
      <group ref={(el) => void (refs[3].current = el)} rotation-y={-0.3}>
        <mesh geometry={geo.base} material={mats.metal} position={[0, 0.01, 0]} />
        <mesh geometry={geo.pole} material={mats.metal} position={[0, 0.21, -0.03]} />
        <group position={[0, 0.64, 0]}>
          <mesh geometry={geo.sideBezel} material={mats.shell} />
          <mesh ref={sideRef} geometry={geo.sideScreen} material={mat} position={[0, 0, 0.024]} />
        </group>
      </group>
      <group ref={(el) => void (refs[4].current = el)}>
        <mesh geometry={geo.keyboard} material={mats.glow} />
        <mesh geometry={geo.underglow} material={under} position={[0, -0.012, 0]} rotation-x={-Math.PI / 2} />
      </group>
      <group ref={(el) => void (refs[5].current = el)}>
        <mesh geometry={geo.mouse} material={mats.glass} />
      </group>
    </group>
  );
}
