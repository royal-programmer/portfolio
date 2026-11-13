"use client";

/**
 * The desk's five props (S3): a mug, a notebook, a phone, headphones and a sticky note, each a hit
 * target that runs a terminal command. Primitives only. Their ids, labels and commands are data
 * (`STAGE_PROPS` in lib/site/stage-data.ts). Hover or keyboard focus (the HUD strip, outside the
 * canvas) lights the prop and shows its label; on a phone the first tap shows the label for 1.5 s
 * and the second runs it.
 */
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { StageProp } from "@/lib/site/stage-data";
import { DESK_TOP } from "./desk";

type Pose = { pos: [number, number, number]; rotY: number; hit: [number, number, number]; label: [number, number, number] };

/** Where each prop stands on the desk (the assembly's frame; the laptop is 1.9 wide, 1.25 deep). */
const POSE: Record<StageProp["kind"], Pose> = {
  mug: { pos: [1.45, DESK_TOP, 0.1], rotY: 0.6, hit: [0.4, 0.34, 0.4], label: [0, 0.5, 0] },
  notebook: { pos: [-1.4, DESK_TOP, 0.55], rotY: 0.25, hit: [0.95, 0.12, 1.2], label: [0, 0.3, 0] },
  phone: { pos: [1.35, DESK_TOP, 0.9], rotY: -0.4, hit: [0.45, 0.1, 0.9], label: [0, 0.3, 0] },
  headphones: { pos: [-0.2, DESK_TOP, 1.15], rotY: 0.1, hit: [0.9, 0.3, 0.5], label: [0, 0.4, 0] },
  sticky: { pos: [0.75, DESK_TOP, 1.25], rotY: 0.15, hit: [0.4, 0.1, 0.4], label: [0, 0.3, 0] },
};

export type StagePropsProps = {
  items: StageProp[];
  accent: THREE.Color;
  /** The prop the keyboard focus (HUD strip) is on, if any. */
  focusId: string | null;
  soundOn: boolean;
  /** Run the prop's command (the second tap on a phone, any click elsewhere). */
  onRun: (p: StageProp) => void;
  /** Shown by the HUD or a tap: the label to display regardless of hover. */
  tapId: string | null;
  onTap: (id: string) => void;
};

function useMats() {
  const m = useMemo(
    () => ({
      ceramic: new THREE.MeshStandardMaterial({ color: "#e9e6df", roughness: 0.35, metalness: 0.05 }),
      cover: new THREE.MeshStandardMaterial({ color: "#1c2a4a", roughness: 0.7, metalness: 0.02 }),
      pages: new THREE.MeshStandardMaterial({ color: "#d8d2c2", roughness: 0.9 }),
      glass: new THREE.MeshStandardMaterial({ color: "#0b0b10", roughness: 0.15, metalness: 0.3 }),
      body: new THREE.MeshStandardMaterial({ color: "#2a2c33", roughness: 0.4, metalness: 0.6 }),
      matte: new THREE.MeshStandardMaterial({ color: "#16161b", roughness: 0.75, metalness: 0.05, emissive: new THREE.Color("#000") }),
      cup: new THREE.MeshStandardMaterial({ color: "#1b1b21", roughness: 0.55, metalness: 0.15, emissive: new THREE.Color("#000") }),
      sticky: new THREE.MeshStandardMaterial({ color: "#f6d54a", roughness: 0.9, emissive: new THREE.Color("#000") }),
      hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  );
  useEffect(
    () => () => {
      for (const x of Object.values(m)) x.dispose();
    },
    [m],
  );
  return m;
}

export function StageProps({ items, accent, focusId, soundOn, onRun, tapId, onTap }: StagePropsProps) {
  const mats = useMats();
  const geo = useMemo(
    () => ({
      mug: new THREE.CylinderGeometry(0.12, 0.105, 0.22, 24),
      handle: new THREE.TorusGeometry(0.07, 0.016, 8, 16, Math.PI),
      notebook: new THREE.BoxGeometry(0.8, 0.05, 1.1),
      pages: new THREE.BoxGeometry(0.76, 0.036, 1.06),
      phone: new THREE.BoxGeometry(0.38, 0.022, 0.82),
      phoneScreen: new THREE.PlaneGeometry(0.34, 0.76),
      band: new THREE.TorusGeometry(0.3, 0.028, 8, 28, Math.PI),
      cup: new THREE.CylinderGeometry(0.13, 0.13, 0.09, 20),
      sticky: new THREE.BoxGeometry(0.3, 0.006, 0.3),
      hit: new THREE.BoxGeometry(1, 1, 1),
    }),
    [],
  );
  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose();
    },
    [geo],
  );
  const [hover, setHover] = useState<string | null>(null);
  const glow = useRef<Record<string, number>>({});

  useFrame((_, dt) => {
    // Hover, focus and (for the headphones) sound-on light a prop's emissive in the accent.
    for (const p of items) {
      const on = hover === p.id || focusId === p.id || (p.kind === "headphones" && soundOn) ? 1 : 0;
      const g = (glow.current[p.id] ??= 0);
      glow.current[p.id] = g + (on - g) * Math.min(1, dt * 9);
    }
    const level = (id: string) => glow.current[id] ?? 0;
    const tint = (m: THREE.MeshStandardMaterial, id: string, k: number) => {
      m.emissive.copy(accent).multiplyScalar(level(id) * k);
    };
    for (const p of items) {
      if (p.kind === "mug") tint(mats.ceramic, p.id, 0.45);
      if (p.kind === "notebook") tint(mats.cover, p.id, 0.5);
      if (p.kind === "phone") tint(mats.body, p.id, 0.5);
      if (p.kind === "headphones") {
        tint(mats.matte, p.id, 0.9);
        tint(mats.cup, p.id, 1.1);
      }
      if (p.kind === "sticky") tint(mats.sticky, p.id, 0.35);
    }
  });

  const labelFor = hover ?? tapId ?? focusId;
  const touch = useRef(false);

  const handlers = (p: StageProp) => ({
    onPointerOver: (e: { stopPropagation: () => void; nativeEvent: PointerEvent }) => {
      e.stopPropagation();
      if (e.nativeEvent.pointerType === "touch") return;
      setHover(p.id);
      (e.nativeEvent.target as HTMLElement).style.cursor = "pointer";
    },
    onPointerOut: (e: { nativeEvent: PointerEvent }) => {
      setHover((h) => (h === p.id ? null : h));
      (e.nativeEvent.target as HTMLElement).style.cursor = "";
    },
    onPointerDown: (e: { nativeEvent: PointerEvent }) => {
      touch.current = e.nativeEvent.pointerType === "touch";
    },
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      // Phones: the first tap names the prop, the second runs it.
      if (touch.current && tapId !== p.id) {
        onTap(p.id);
        return;
      }
      onRun(p);
    },
  });

  return (
    <group>
      {items.map((p) => {
        const pose = POSE[p.kind];
        return (
          <group key={p.id} position={pose.pos} rotation-y={pose.rotY}>
            {p.kind === "mug" ? (
              <>
                <mesh geometry={geo.mug} material={mats.ceramic} position={[0, 0.11, 0]} />
                <mesh geometry={geo.handle} material={mats.ceramic} position={[0.12, 0.11, 0]} rotation-z={-Math.PI / 2} />
              </>
            ) : null}
            {p.kind === "notebook" ? (
              <>
                <mesh geometry={geo.notebook} material={mats.cover} position={[0, 0.025, 0]} />
                <mesh geometry={geo.pages} material={mats.pages} position={[0.015, 0.025, 0]} />
              </>
            ) : null}
            {p.kind === "phone" ? (
              <>
                <mesh geometry={geo.phone} material={mats.body} position={[0, 0.011, 0]} />
                <mesh geometry={geo.phoneScreen} material={mats.glass} position={[0, 0.0235, 0]} rotation-x={-Math.PI / 2} />
              </>
            ) : null}
            {p.kind === "headphones" ? (
              <>
                {/* The band lies flat on the desk, a cup at each end. */}
                <mesh geometry={geo.band} material={mats.matte} position={[0, 0.03, -0.05]} rotation-x={-Math.PI / 2} />
                <mesh geometry={geo.cup} material={mats.cup} position={[-0.3, 0.05, -0.05]} rotation-z={Math.PI / 2} />
                <mesh geometry={geo.cup} material={mats.cup} position={[0.3, 0.05, -0.05]} rotation-z={Math.PI / 2} />
              </>
            ) : null}
            {p.kind === "sticky" ? <mesh geometry={geo.sticky} material={mats.sticky} position={[0, 0.003, 0]} /> : null}
            {/* A generous invisible box over the prop: small things are hard to hit. */}
            <mesh geometry={geo.hit} material={mats.hit} position={[0, pose.hit[1] / 2, 0]} scale={pose.hit} {...handlers(p)} />
            {labelFor === p.id ? (
              <Html position={pose.label} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
                <div className="stage-prop-label" style={{ ["--stage-c" as string]: `#${accent.getHexString()}` }}>
                  {p.label}
                </div>
              </Html>
            ) : null}
          </group>
        );
      })}
    </group>
  );
}
