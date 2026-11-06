"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: GPU objects (materials, the group
   transform) are mutated every frame inside useFrame, never during render. */

/**
 * The headset (D38) — our own stylised design, built in code: a dark-glass
 * visor with one strip of light across the front, two glowing lens rings on
 * the face side, and two strap arcs. It floats in the dark and turns toward
 * the pointer; click it to put it on (`wear`: it turns round and comes up to
 * the face until the lens rings fill the view).
 */
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useVr } from "./clock";
import { PHASE_LENGTH, atLeast } from "./state";
import { easeInOut, easeIn } from "./util";

/** Where the headset floats while the visitor decides. */
export const HEADSET_FLOAT = new THREE.Vector3(0, -0.15, -7.2);
/** Where it ends when worn: lens rings filling the width of the view. */
const HEADSET_WORN = new THREE.Vector3(0, 0, -0.92);
const FLOAT_YAW = -0.55;

/** Soft studio reflections for the visor — generated, nothing downloaded. */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    pmrem.dispose();
    return () => {
      scene.environment = null;
      tex.dispose();
    };
  }, [gl, scene]);
  return null;
}

export function Headset({ onWear }: { onWear: () => void }) {
  const { clock, state } = useVr();
  const group = useRef<THREE.Group>(null);
  const live = useRef({ yaw: FLOAT_YAW, pitch: 0, hover: 0 });

  const geo = useMemo(
    () => ({
      visor: new RoundedBoxGeometry(2.3, 1.02, 0.92, 6, 0.33),
      plate: new RoundedBoxGeometry(2.02, 0.74, 0.06, 4, 0.2),
      strip: new RoundedBoxGeometry(1.92, 0.022, 0.03, 2, 0.01),
      ring: new THREE.TorusGeometry(0.3, 0.018, 12, 48),
      lens: new THREE.CircleGeometry(0.29, 40),
      // One band around the head: a half ring, open at the visor, rising toward the back.
      strap: new THREE.TorusGeometry(1.26, 0.05, 10, 64, Math.PI).rotateX(-Math.PI / 2),
      cushion: new RoundedBoxGeometry(2.08, 0.84, 0.12, 4, 0.3),
      lensGlow: new THREE.CircleGeometry(0.2, 32),
    }),
    [],
  );
  const mat = useMemo(() => {
    const glass = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#0a0a10"),
      roughness: 0.2,
      metalness: 0.15,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.3,
    });
    const plate = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#07070b"),
      roughness: 0.06,
      metalness: 0.3,
      clearcoat: 1,
      envMapIntensity: 2,
    });
    const matte = new THREE.MeshStandardMaterial({ color: new THREE.Color("#0b0b10"), roughness: 0.8, metalness: 0.05 });
    const cushion = new THREE.MeshStandardMaterial({ color: new THREE.Color("#07070a"), roughness: 0.95, metalness: 0 });
    const light = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.5, 2.7), toneMapped: false });
    const ring = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.2), toneMapped: false });
    const lens = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.01, 0.012, 0.02) });
    const lensGlow = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.18, 0.22, 0.34),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { glass, plate, matte, cushion, light, ring, lens, lensGlow };
  }, []);

  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const s = state.current;
    const k = clock.current;
    const L = live.current;
    const dt = k.dt;

    if (atLeast(s.phase, "blink")) {
      g.visible = false;
      return;
    }
    g.visible = true;

    L.hover = THREE.MathUtils.damp(L.hover, s.hover ? 1 : 0, 8, dt);
    mat.light.color.setScalar(2.3 + L.hover * 1.6);
    mat.ring.color.setRGB(1.5 + L.hover, 1.7 + L.hover, 2.1 + L.hover);

    // Narrow screens see a narrower slice of the world: float it further away.
    const aspect = (camera as THREE.PerspectiveCamera).aspect || 1;
    const far = THREE.MathUtils.clamp(1 / aspect, 1, 1.9);

    if (s.phase === "gate") {
      // Alive: a slow bob, a slower sway, and it turns a little toward the pointer.
      const targetYaw = FLOAT_YAW + s.px * 0.32 + Math.sin(k.t * 0.23) * 0.06;
      const targetPitch = -s.py * 0.16 + Math.sin(k.t * 0.31) * 0.03;
      L.yaw = THREE.MathUtils.damp(L.yaw, targetYaw, 4, dt);
      L.pitch = THREE.MathUtils.damp(L.pitch, targetPitch, 4, dt);
      g.position.copy(HEADSET_FLOAT);
      g.position.z *= far;
      g.position.y += (far - 1) * 0.5;
      g.position.y += Math.sin(k.t * 0.6) * 0.06;
      g.position.x += Math.sin(k.t * 0.37) * 0.03;
      g.rotation.set(L.pitch, L.yaw, Math.sin(k.t * 0.29) * 0.02);
      g.scale.setScalar(1 + L.hover * 0.025);
      return;
    }

    // wear: turn round to face you, rise to the face, lenses fill the view.
    const u = Math.min(1, k.phaseT / PHASE_LENGTH.wear);
    const turn = easeInOut(u / 0.62);
    const come = easeIn(Math.max(0, (u - 0.1) / 0.9));
    const yaw = THREE.MathUtils.lerp(L.yaw, Math.PI, turn);
    const pitch = THREE.MathUtils.lerp(L.pitch, 0, turn);
    g.position.lerpVectors(HEADSET_FLOAT, HEADSET_WORN, come);
    g.position.z -= (1 - come) * HEADSET_FLOAT.z * (far - 1) * -1;
    g.position.y += Math.sin(u * Math.PI) * 0.25; // it lifts, then settles onto the face
    g.position.applyQuaternion(camera.quaternion);
    g.quaternion.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0)));
    g.scale.setScalar(1);
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (state.current.phase === "gate") state.current.hover = true;
  };
  const out = () => {
    state.current.hover = false;
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (state.current.phase === "gate") onWear();
  };

  return (
    <>
      <StudioEnvironment />
      <directionalLight position={[-3, 4, 3]} intensity={1.6} color="#f3f1ec" />
      <directionalLight position={[4, -1, -3]} intensity={0.5} color="#9fb7ff" />
      <group ref={group} position={HEADSET_FLOAT} rotation-y={FLOAT_YAW} onPointerOver={over} onPointerOut={out} onClick={click}>
        <mesh geometry={geo.visor} material={mat.glass} />
        <mesh geometry={geo.plate} material={mat.plate} position={[0, 0.02, 0.45]} />
        <mesh geometry={geo.strip} material={mat.light} position={[0, 0.02, 0.485]} />
        {/* Face side (−z): cushion, lenses, glowing rings. */}
        <mesh geometry={geo.cushion} material={mat.cushion} position={[0, -0.02, -0.44]} />
        {[-0.5, 0.5].map((x) => (
          <group key={x} position={[x, 0, -0.51]}>
            <mesh geometry={geo.lens} material={mat.lens} />
            <mesh geometry={geo.lensGlow} material={mat.lensGlow} position={[0, 0, -0.002]} />
            <mesh geometry={geo.ring} material={mat.ring} />
          </group>
        ))}
        {/* The band sweeps back from both sides around the head, above the eyes. */}
        <mesh geometry={geo.strap} material={mat.matte} position={[0, 0.4, -0.2]} rotation={[0.14, 0, 0]} />
      </group>
    </>
  );
}
