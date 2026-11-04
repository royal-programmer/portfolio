"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: transforms and instance matrices are
   mutated every frame inside the assembly's frame callback. */

/**
 * The engineer's laptop (D38 round B): base, lid, 70 keys and a trackpad fly
 * together, the lid unfolds toward you and the screen boots into the editor.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Halo, makeScreenMaterial, useAssembly } from "../assembly";
import { LAPTOP_SCREEN_SRC, makeLaptopScreen } from "../screens";
import type { World } from "../state";
import { easeInOut } from "../util";

const KEY_COLS = 14;
const KEY_ROWS = 5;
/** Laptop body size (world units) — a 14" at arm's length. */
const LAP_W = 1.9;
const LAP_D = 1.25;
const LAP_T = 0.055;
const LID_T = 0.03;
const OPEN_ANGLE = THREE.MathUtils.degToRad(104);
const SCREEN_W = LAP_W * 0.93;
const SCREEN_H = LAP_D * 0.98 * 0.88;

export function EngineerAssembly({ world }: { world: World }) {
  const root = useRef<THREE.Group>(null);
  const baseRef = useRef<THREE.Group>(null);
  const lidPivot = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  const padRef = useRef<THREE.Mesh>(null);
  const keysRef = useRef<THREE.InstancedMesh>(null);
  const screenRef = useRef<THREE.Mesh>(null);

  const kw = (LAP_W * 0.84) / KEY_COLS;
  const kd = (LAP_D * 0.48) / KEY_ROWS;
  // Homes: 0 base · 1 lid pivot (hinge at the back edge) · 2 trackpad · 3… keys.
  const homes = useMemo(() => {
    const h = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -LAP_D / 2), new THREE.Vector3(0, LAP_T / 2 + 0.002, LAP_D * 0.27)];
    for (let r = 0; r < KEY_ROWS; r++) for (let c = 0; c < KEY_COLS; c++) h.push(new THREE.Vector3((c - (KEY_COLS - 1) / 2) * kw, LAP_T / 2 + 0.012, -LAP_D * 0.46 + 0.08 + r * kd));
    return h;
  }, [kw, kd]);

  const geo = useMemo(
    () => ({
      base: new RoundedBoxGeometry(LAP_W, LAP_T, LAP_D, 3, 0.02),
      lid: new RoundedBoxGeometry(LAP_W, LID_T, LAP_D * 0.98, 3, 0.015),
      key: new RoundedBoxGeometry(kw * 0.78, 0.018, kd * 0.72, 2, 0.006),
      pad: new RoundedBoxGeometry(LAP_W * 0.34, 0.004, LAP_D * 0.26, 2, 0.004),
      screen: new THREE.PlaneGeometry(SCREEN_W, SCREEN_H),
      bezel: new THREE.PlaneGeometry(SCREEN_W + 0.03, SCREEN_H + 0.03),
    }),
    [kw, kd],
  );
  const screenTex = useMemo(() => makeLaptopScreen(world.t), [world.t]);
  const screenMat = useMemo(() => makeScreenMaterial(screenTex, world.t, 0), [screenTex, world.t]);
  const screenMats = useMemo(() => [screenMat], [screenMat]);
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

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), s: new THREE.Vector3(1, 1, 1), o: new THREE.Object3D() }), []);
  const screens = useMemo(() => [screenRef], []);

  const { mats } = useAssembly({
    world,
    root,
    screens,
    homes,
    screenMats,
    onFrame: (L, place) => {
      if (baseRef.current) place(baseRef.current, 0);
      if (padRef.current) place(padRef.current, 2);
      if (lidPivot.current) {
        place(lidPivot.current, 1);
        if (lidRef.current) lidRef.current.rotation.x = -OPEN_ANGLE * easeInOut(L.open) * L.g3 + (1 - L.g3) * 0.4;
      }
      const keys = keysRef.current;
      if (keys) {
        for (let i = 0; i < KEY_COLS * KEY_ROWS; i++) {
          place(tmp.o, 3 + i, 0.1); // keys arrive a touch after the body, each in its own time
          tmp.q.setFromEuler(tmp.o.rotation);
          tmp.m.compose(tmp.o.position, tmp.q, tmp.s);
          keys.setMatrixAt(i, tmp.m);
        }
        keys.instanceMatrix.needsUpdate = true;
      }
    },
  });

  return (
    <group ref={root}>
      <group ref={baseRef}>
        <mesh geometry={geo.base} material={mats.shell} />
      </group>
      <mesh ref={padRef} geometry={geo.pad} material={mats.glass} />
      <instancedMesh ref={keysRef} args={[geo.key, mats.glow, KEY_COLS * KEY_ROWS]} frustumCulled={false} />
      {/* The lid pivots on the back edge of the base. */}
      <group ref={lidPivot}>
        <group ref={lidRef}>
          <mesh geometry={geo.lid} material={mats.shell} position={[0, LAP_T / 2 + LID_T / 2, LAP_D * 0.49]} />
          {/* Screen on the lid's inner face: it looks down at the keys when closed, at you when open. */}
          <mesh ref={screenRef} geometry={geo.screen} material={screenMat} position={[0, LAP_T / 2 - 0.003, LAP_D * 0.49 + 0.02]} rotation-x={Math.PI / 2} />
          <mesh geometry={geo.bezel} material={mats.bezel} position={[0, LAP_T / 2 - 0.004, LAP_D * 0.49 + 0.02]} rotation-x={Math.PI / 2} />
          <Halo width={SCREEN_W} height={SCREEN_H} material={mats.halo} position={[0, LAP_T / 2 + LID_T + 0.01, LAP_D * 0.49 + 0.02]} rotation={[Math.PI / 2, 0, 0]} />
        </group>
      </group>
    </group>
  );
}
