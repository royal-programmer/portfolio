"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: transforms are mutated every frame
   inside the assembly's frame callback. */

/**
 * The artist's easel (D38 round C): three legs, a tray and a canvas fly
 * together; powered, the strokes paint themselves in, stroke by stroke.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Halo, Tube, makeScreenMaterial, useAssembly } from "../assembly";
import { makeArtworkTexture } from "../screens-worlds";
import type { World } from "../state";

const CAN_W = 1.32;
const CAN_H = 1.0;

export function ArtistAssembly({ world }: { world: World }) {
  const root = useRef<THREE.Group>(null);
  const refs = useMemo(() => [0, 1, 2, 3, 4].map(() => ({ current: null as THREE.Group | null })), []);
  const face = useRef<THREE.Mesh>(null);
  const screens = useMemo(() => [face], []);
  // Every part is drawn in the easel's own frame, so each home is the origin.
  const homes = useMemo(() => [0, 1, 2, 3, 4].map(() => new THREE.Vector3(0, 0, 0)), []);
  const geo = useMemo(
    () => ({
      tray: new RoundedBoxGeometry(1.4, 0.05, 0.14, 2, 0.01),
      canvas: new RoundedBoxGeometry(CAN_W, CAN_H, 0.04, 2, 0.005),
      face: new THREE.PlaneGeometry(CAN_W - 0.06, CAN_H - 0.06),
      light: new THREE.PlaneGeometry(CAN_W, CAN_H),
    }),
    [],
  );
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color("#14110d"), roughness: 0.7, metalness: 0.05 }), []);
  const tex = useMemo(() => makeArtworkTexture(world.t), [world.t]);
  const mat = useMemo(() => makeScreenMaterial(tex, world.t, 2), [tex, world.t]);
  const screenMats = useMemo(() => [mat], [mat]);
  useEffect(() => () => tex.dispose(), [tex]);

  const { mats } = useAssembly({
    world,
    root,
    screens,
    homes,
    screenMats,
    yaw: -0.12,
    offset: { fwd: 5.2, right: 1.4, up: -0.2 },
    onFrame: (_L, place) => {
      refs.forEach((r, i) => r.current && place(r.current, i));
    },
  });

  return (
    <group ref={root}>
      <group ref={(el) => void (refs[0].current = el)}>
        <Tube from={[-0.6, -1.25, 0.3]} to={[-0.13, 1.15, -0.02]} r={0.028} material={wood} />
      </group>
      <group ref={(el) => void (refs[1].current = el)}>
        <Tube from={[0.6, -1.25, 0.3]} to={[0.13, 1.15, -0.02]} r={0.028} material={wood} />
      </group>
      <group ref={(el) => void (refs[2].current = el)}>
        <Tube from={[0, -1.25, -0.62]} to={[0, 1.0, -0.08]} r={0.028} material={wood} />
      </group>
      <group ref={(el) => void (refs[3].current = el)}>
        <mesh geometry={geo.tray} material={wood} position={[0, -0.12, 0.2]} rotation-x={-0.12} />
      </group>
      <group ref={(el) => void (refs[4].current = el)}>
        <group position={[0, 0.42, 0.16]} rotation-x={-0.12}>
          <mesh geometry={geo.canvas} material={mats.matte} />
          <mesh ref={face} geometry={geo.face} material={mat} position={[0, 0, 0.021]} />
          <mesh geometry={geo.light} material={mats.bezel} position={[0, 0, 0.02]} />
          <Halo width={CAN_W} height={CAN_H} material={mats.halo} position={[0, 0, -0.03]} />
        </group>
      </group>
    </group>
  );
}
