"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: transforms are mutated every frame
   inside the assembly's frame callback. */

/**
 * The trader's desk (D38 round C): a desk, two monitors on stands, keyboard
 * and mouse fly together; the charts draw themselves in when it powers on.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Halo, makeScreenMaterial, useAssembly } from "../assembly";
import { makeTraderScreen } from "../screens-worlds";
import type { World } from "../state";

const MON_W = 1.25;
const MON_H = 0.78;
const SCR_W = MON_W * 0.94;
const SCR_H = MON_H * 0.9;

function Monitor({ screenRef, material, mats, yaw }: { screenRef: React.RefObject<THREE.Mesh | null>; material: THREE.Material; mats: ReturnType<typeof useAssembly>["mats"]; yaw: number }) {
  const geo = useMemo(
    () => ({
      base: new THREE.CylinderGeometry(0.2, 0.22, 0.02, 32),
      pole: new THREE.CylinderGeometry(0.025, 0.025, 0.42, 12),
      bezel: new RoundedBoxGeometry(MON_W, MON_H, 0.045, 2, 0.012),
      screen: new THREE.PlaneGeometry(SCR_W, SCR_H),
      light: new THREE.PlaneGeometry(SCR_W + 0.03, SCR_H + 0.03),
    }),
    [],
  );
  return (
    <group rotation-y={yaw}>
      <mesh geometry={geo.base} material={mats.metal} position={[0, 0.01, 0]} />
      <mesh geometry={geo.pole} material={mats.metal} position={[0, 0.22, -0.03]} />
      <group position={[0, 0.72, 0]}>
        <mesh geometry={geo.bezel} material={mats.shell} />
        <mesh ref={screenRef} geometry={geo.screen} material={material} position={[0, 0, 0.024]} />
        <mesh geometry={geo.light} material={mats.bezel} position={[0, 0, 0.023]} />
        <Halo width={SCR_W} height={SCR_H} material={mats.halo} position={[0, 0, -0.03]} />
      </group>
    </group>
  );
}

export function TraderAssembly({ world }: { world: World }) {
  const root = useRef<THREE.Group>(null);
  const refs = useMemo(() => [0, 1, 2, 3, 4].map(() => ({ current: null as THREE.Group | null })), []);
  const screenL = useRef<THREE.Mesh>(null);
  const screenR = useRef<THREE.Mesh>(null);
  const screens = useMemo(() => [screenL, screenR], []);
  // Homes: 0 desk · 1 left monitor · 2 right monitor · 3 keyboard · 4 mouse.
  const homes = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.68, 0.025, -0.25), new THREE.Vector3(0.68, 0.025, -0.25), new THREE.Vector3(0, 0.04, 0.26), new THREE.Vector3(0.66, 0.04, 0.28)],
    [],
  );
  const geo = useMemo(
    () => ({
      desk: new RoundedBoxGeometry(2.9, 0.05, 1.05, 3, 0.02),
      keyboard: new RoundedBoxGeometry(0.92, 0.028, 0.3, 2, 0.008),
      mouse: new RoundedBoxGeometry(0.1, 0.04, 0.17, 3, 0.02),
    }),
    [],
  );
  const texL = useMemo(() => makeTraderScreen(world.t, 0), [world.t]);
  const texR = useMemo(() => makeTraderScreen(world.t, 1), [world.t]);
  const matL = useMemo(() => makeScreenMaterial(texL, world.t, 1), [texL, world.t]);
  const matR = useMemo(() => makeScreenMaterial(texR, world.t, 1), [texR, world.t]);
  const screenMats = useMemo(() => [matL, matR], [matL, matR]);
  useEffect(() => () => [texL, texR].forEach((t) => t.dispose()), [texL, texR]);

  const { mats } = useAssembly({
    world,
    root,
    screens,
    homes,
    screenMats,
    offset: { fwd: 5.4, right: 1.5, up: -0.55 },
    view: { back: 1.9, up: 0.1 },
    onFrame: (_L, place) => {
      refs.forEach((r, i) => r.current && place(r.current, i, i >= 3 ? 0.15 : 0));
    },
  });

  return (
    <group ref={root}>
      <group ref={(el) => void (refs[0].current = el)}>
        <mesh geometry={geo.desk} material={mats.shell} />
      </group>
      <group ref={(el) => void (refs[1].current = el)}>
        <Monitor screenRef={screenL} material={matL} mats={mats} yaw={0.14} />
      </group>
      <group ref={(el) => void (refs[2].current = el)}>
        <Monitor screenRef={screenR} material={matR} mats={mats} yaw={-0.14} />
      </group>
      <group ref={(el) => void (refs[3].current = el)}>
        <mesh geometry={geo.keyboard} material={mats.glow} />
      </group>
      <group ref={(el) => void (refs[4].current = el)}>
        <mesh geometry={geo.mouse} material={mats.glass} />
      </group>
    </group>
  );
}
