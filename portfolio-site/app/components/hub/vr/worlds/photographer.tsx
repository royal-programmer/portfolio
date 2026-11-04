"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: transforms are mutated every frame
   inside the assembly's frame callback. */

/**
 * The photographer's camera (D38 round C): body, grip, prism housing and the
 * lens fly together; the lens screws on; the back display wakes with the
 * viewfinder readout. The display is the doorway (the page flashes the shutter).
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Halo, makeScreenMaterial, useAssembly } from "../assembly";
import { makeViewfinderScreen } from "../screens-worlds";
import type { World } from "../state";
import { easeInOut } from "../util";

const LCD_W = 0.84;
const LCD_H = 0.56;

export function PhotographerAssembly({ world }: { world: World }) {
  const root = useRef<THREE.Group>(null);
  const turn = useRef<THREE.Group>(null);
  const refs = useMemo(() => [0, 1, 2, 3, 4].map(() => ({ current: null as THREE.Group | null })), []);
  const lcd = useRef<THREE.Mesh>(null);
  const screens = useMemo(() => [lcd], []);
  // Homes: 0 body · 1 grip · 2 prism housing · 3 lens · 4 shutter button. The lens points −z (away from you).
  const homes = useMemo(
    () => [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.56, -0.02, 0.06), new THREE.Vector3(0.02, 0.5, -0.02), new THREE.Vector3(0.06, 0.02, -0.56), new THREE.Vector3(-0.56, 0.44, 0.1)],
    [],
  );
  const geo = useMemo(
    () => ({
      body: new RoundedBoxGeometry(1.34, 0.86, 0.5, 4, 0.06),
      grip: new RoundedBoxGeometry(0.34, 0.82, 0.64, 4, 0.09),
      prism: new RoundedBoxGeometry(0.46, 0.24, 0.42, 3, 0.05),
      button: new THREE.CylinderGeometry(0.055, 0.055, 0.04, 20),
      barrel: new THREE.CylinderGeometry(0.33, 0.35, 0.62, 40).rotateX(Math.PI / 2),
      glass: new THREE.CircleGeometry(0.27, 40),
      ring: new THREE.TorusGeometry(0.345, 0.022, 10, 48),
      mount: new THREE.CylinderGeometry(0.37, 0.37, 0.05, 40).rotateX(Math.PI / 2),
      lcd: new THREE.PlaneGeometry(LCD_W, LCD_H),
      light: new THREE.PlaneGeometry(LCD_W + 0.03, LCD_H + 0.03),
    }),
    [],
  );
  const lensGlass = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#05060a"), roughness: 0.02, metalness: 0.1, clearcoat: 1, envMapIntensity: 2.4, emissive: new THREE.Color("#1a0e2a"), emissiveIntensity: 0.6 }),
    [],
  );
  const tex = useMemo(() => makeViewfinderScreen(world.t), [world.t]);
  const mat = useMemo(() => makeScreenMaterial(tex, world.t, 0), [tex, world.t]);
  const screenMats = useMemo(() => [mat], [mat]);
  useEffect(() => () => tex.dispose(), [tex]);

  const { mats } = useAssembly({
    world,
    root,
    screens,
    homes,
    screenMats,
    offset: { fwd: 4.6, right: 1.3, up: -0.1 },
    onFrame: (L, place) => {
      refs.forEach((r, i) => r.current && place(r.current, i));
      // Loose: it revolves slowly with the lens toward you. Assembled: it turns to present the
      // display (three-quarter, so the lens still shows on the left).
      if (turn.current) {
        const present = easeInOut(L.open);
        turn.current.rotation.y = THREE.MathUtils.lerp(Math.PI + Math.sin(L.t * 0.35) * 0.5, 0.62, present) + (1 - L.g3) * L.t * 0.4;
        turn.current.rotation.x = (1 - present) * Math.sin(L.t * 0.27) * 0.25;
      }
      // The lens arrives in front of the mount and screws on: in along its axis, turning.
      const lens = refs[3].current;
      if (lens) {
        const screw = 1 - easeInOut(L.open);
        lens.position.z -= screw * 0.7 * L.g3;
        lens.rotation.z += screw * Math.PI * 1.5 * L.g3;
      }
    },
  });

  return (
    <group ref={root}>
      <group ref={turn}>
      <group ref={(el) => void (refs[0].current = el)}>
        <mesh geometry={geo.body} material={mats.shell} />
        {/* Back display (+z, toward you). */}
        <mesh ref={lcd} geometry={geo.lcd} material={mat} position={[0.12, -0.04, 0.252]} />
        <mesh geometry={geo.light} material={mats.bezel} position={[0.12, -0.04, 0.251]} />
        <Halo width={LCD_W} height={LCD_H} material={mats.halo} position={[0.12, -0.04, 0.2]} />
        {/* Lens mount on the front. */}
        <mesh geometry={geo.mount} material={mats.metal} position={[0.06, 0.02, -0.26]} />
      </group>
      <group ref={(el) => void (refs[1].current = el)}>
        <mesh geometry={geo.grip} material={mats.matte} />
      </group>
      <group ref={(el) => void (refs[2].current = el)}>
        <mesh geometry={geo.prism} material={mats.shell} />
      </group>
      <group ref={(el) => void (refs[3].current = el)}>
        <mesh geometry={geo.barrel} material={mats.shell} />
        <mesh geometry={geo.ring} material={mats.glow} position={[0, 0, -0.08]} />
        <mesh geometry={geo.ring} material={mats.matte} position={[0, 0, 0.14]} />
        <mesh geometry={geo.glass} material={lensGlass} position={[0, 0, -0.312]} rotation-y={Math.PI} />
      </group>
      <group ref={(el) => void (refs[4].current = el)}>
        <mesh geometry={geo.button} material={mats.glow} />
      </group>
      </group>
    </group>
  );
}
