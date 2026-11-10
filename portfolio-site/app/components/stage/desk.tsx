"use client";

/**
 * The Stage's desk (S2): the slab the laptop stands on, a lamp that comes on when the light goes, and
 * a window behind it that follows the hour. Built from primitives; local to the engineer assembly's frame.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { StageLook } from "./stage-look";

/** The desk's top surface, in the assembly's frame (the laptop base is 0.055 thick, centred on 0). */
export const DESK_TOP = -0.0275 - 0.003;

function windowTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 256, 160);
  // Panes: a soft gradient (brighter at the top) cut by the frame bars.
  const grad = g.createLinearGradient(0, 0, 0, 160);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,0.55)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#101014";
  g.fillRect(0, 0, 256, 6);
  g.fillRect(0, 154, 256, 6);
  g.fillRect(0, 0, 6, 160);
  g.fillRect(250, 0, 6, 160);
  g.fillRect(125, 0, 6, 160);
  g.fillRect(0, 77, 256, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function StageDesk({ look, deskMat }: { look: MutableRefObject<StageLook>; deskMat: THREE.Material }) {
  const lampLight = useRef<THREE.PointLight>(null);
  const bulb = useRef<THREE.MeshStandardMaterial>(null);
  const win = useRef<THREE.MeshBasicMaterial>(null);
  const geo = useMemo(
    () => ({
      desk: new THREE.BoxGeometry(5.2, 0.08, 2.9),
      base: new THREE.CylinderGeometry(0.24, 0.28, 0.05, 24),
      arm: new THREE.CylinderGeometry(0.022, 0.022, 1.0, 10),
      arm2: new THREE.CylinderGeometry(0.022, 0.022, 0.62, 10),
      joint: new THREE.SphereGeometry(0.045, 12, 8),
      shade: new THREE.ConeGeometry(0.26, 0.3, 28, 1, true),
      bulb: new THREE.SphereGeometry(0.075, 14, 10),
      win: new THREE.PlaneGeometry(4.6, 2.7),
    }),
    [],
  );
  const winTex = useMemo(() => windowTexture(), []);
  const lampMetal = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2b2b33", roughness: 0.4, metalness: 0.8 }), []);
  const shadeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1a22", roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }), []);
  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose();
      winTex.dispose();
      lampMetal.dispose();
      shadeMat.dispose();
    },
    [geo, winTex, lampMetal, shadeMat],
  );

  useFrame(() => {
    const L = look.current;
    if (lampLight.current) lampLight.current.intensity = L.lamp * 2.2;
    if (bulb.current) {
      bulb.current.emissiveIntensity = 0.05 + L.lamp * 3.2;
      bulb.current.color.setScalar(0.2 + L.lamp * 0.8);
    }
    if (win.current) {
      win.current.color.copy(L.windowColor).multiplyScalar(Math.max(0.05, L.windowI));
    }
  });

  const top = DESK_TOP;
  return (
    <group>
      <mesh geometry={geo.desk} material={deskMat} position={[0, top - 0.04, 0.15]} />
      {/* The lamp at the left-back corner: base, a two-part arm, a shade and a warm bulb. */}
      <group position={[-1.95, top, -0.55]} rotation-y={0.5}>
        <mesh geometry={geo.base} material={lampMetal} position={[0, 0.025, 0]} />
        <mesh geometry={geo.arm} material={lampMetal} position={[0, 0.55, 0]} rotation-z={0.12} />
        <mesh geometry={geo.joint} material={lampMetal} position={[0.12, 1.04, 0]} />
        <mesh geometry={geo.arm2} material={lampMetal} position={[0.38, 1.18, 0]} rotation-z={-1.15} />
        <group position={[0.62, 1.32, 0]} rotation-z={-0.35}>
          <mesh geometry={geo.shade} material={shadeMat} position={[0, -0.04, 0]} rotation-z={0} />
          <mesh geometry={geo.bulb} position={[0, -0.12, 0]}>
            <meshStandardMaterial ref={bulb} color="#ffd9a0" emissive="#ffb347" emissiveIntensity={0.05} />
          </mesh>
          <pointLight ref={lampLight} position={[0, -0.2, 0.05]} color="#ffb766" intensity={0} distance={7} decay={1.6} />
        </group>
      </group>
      {/* The window behind the desk; excluded from the stage's framing. */}
      <mesh geometry={geo.win} position={[0.3, 1.35, -1.85]} userData={{ noFit: true }}>
        <meshBasicMaterial ref={win} map={winTex} color="#000" toneMapped={false} />
      </mesh>
    </group>
  );
}
