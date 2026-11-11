"use client";

/**
 * The Stage's door (S10): a plain frame and panel at the room's edge, a faint strip of the hub's colour spectrum
 * under it. Hover or focus opens it 20 degrees and brightens the strip; a click hands over to the page, which opens
 * it fully, carries the camera through and navigates to the hub (see `go` in world-stage-3d.tsx).
 */
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { STAGE_DOOR } from "@/lib/site/stage-data";
import { spectrumColor } from "@/lib/site/spectrum";
import { DESK_TOP } from "./desk";
import { useVr } from "../hub/vr/clock";

/** The page's handle on the door: `on` once it was clicked, `t0` the clock time then, `e` the eased travel 0…1. */
export type DoorGo = { on: boolean; t0: number; e: number; fired: boolean };

function spectrumCanvas(w: number, h: number, vertical: boolean) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i <= 6; i++) grad.addColorStop(i / 6, spectrumColor(i / 6, 62));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  if (vertical) {
    // The spectrum lies low behind the panel and falls away into the void above.
    const fade = g.createLinearGradient(0, h, 0, 0);
    fade.addColorStop(0, "rgba(7,7,10,0.1)");
    fade.addColorStop(0.55, "rgba(7,7,10,0.85)");
    fade.addColorStop(1, "rgba(7,7,10,1)");
    g.fillStyle = fade;
    g.fillRect(0, 0, w, h);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

export function StageDoor({ accent, focus, go, onGo }: { accent: THREE.Color; focus: boolean; go: MutableRefObject<DoorGo>; onGo: () => void }) {
  const { clock } = useVr();
  const [w, h] = STAGE_DOOR.size;
  const [hover, setHover] = useState(false);
  const panel = useRef<THREE.Group>(null);
  const glow = useRef(0);
  const angle = useRef(0);
  const a0 = useRef(-1);
  const interiorMat = useRef<THREE.MeshBasicMaterial>(null);
  const stripMat = useRef<THREE.MeshBasicMaterial>(null);
  const geo = useMemo(
    () => ({
      post: new THREE.BoxGeometry(0.08, h + 0.08, 0.16),
      head: new THREE.BoxGeometry(w + 0.16, 0.08, 0.16),
      panel: new THREE.BoxGeometry(w - 0.02, h - 0.02, 0.05),
      plane: new THREE.PlaneGeometry(w, h),
      strip: new THREE.PlaneGeometry(w + 0.5, 0.55),
      knob: new THREE.SphereGeometry(0.04, 12, 8),
      hit: new THREE.BoxGeometry(w + 0.3, h + 0.2, 0.7),
    }),
    [w, h],
  );
  const tex = useMemo(() => ({ interior: spectrumCanvas(128, 256, true), strip: spectrumCanvas(256, 8, false) }), []);
  const mats = useMemo(
    () => ({
      frame: new THREE.MeshStandardMaterial({ color: "#2b2b33", roughness: 0.4, metalness: 0.8 }),
      panel: new THREE.MeshStandardMaterial({ color: "#0f1830", roughness: 0.6, metalness: 0.1, emissive: new THREE.Color("#000") }),
      knob: new THREE.MeshStandardMaterial({ color: "#b9b6ae", roughness: 0.3, metalness: 0.9 }),
      hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    }),
    [],
  );
  useEffect(
    () => () => {
      for (const g of Object.values(geo)) g.dispose();
      for (const t of Object.values(tex)) t.dispose();
      for (const m of Object.values(mats)) m.dispose();
    },
    [geo, tex, mats],
  );

  useFrame((_, dt) => {
    const g = go.current;
    const on = hover || focus ? 1 : 0;
    glow.current += (on - glow.current) * Math.min(1, dt * 8);
    const hoverRad = THREE.MathUtils.degToRad(STAGE_DOOR.hoverDeg);
    const openRad = THREE.MathUtils.degToRad(STAGE_DOOR.openDeg);
    let open = 0;
    if (g.on) {
      // Fully open over openMs from the click, starting from wherever the hover left it.
      if (a0.current < 0) a0.current = angle.current;
      const p = Math.min(1, (clock.current.t - g.t0) / (STAGE_DOOR.openMs / 1000));
      angle.current = a0.current + (openRad - a0.current) * smooth(p);
      open = angle.current / openRad;
    } else {
      angle.current += (hoverRad * on - angle.current) * Math.min(1, dt * 8);
      a0.current = -1;
      open = angle.current / openRad;
    }
    if (panel.current) panel.current.rotation.y = angle.current;
    mats.panel.emissive.copy(accent).multiplyScalar(glow.current * 0.12);
    const lit = Math.max(glow.current, open);
    if (interiorMat.current) interiorMat.current.opacity = 0.25 + 0.75 * lit;
    if (stripMat.current) stripMat.current.opacity = 0.22 + 0.78 * lit;
  });

  const bottom = DESK_TOP - 0.1;
  const c = `#${accent.getHexString()}`;
  return (
    <group name="stage-door" position={[STAGE_DOOR.pos[0], bottom + h / 2, STAGE_DOOR.pos[2]]} rotation-y={STAGE_DOOR.rotY}>
      <mesh geometry={geo.post} material={mats.frame} position={[-(w / 2 + 0.04), 0, 0]} />
      <mesh geometry={geo.post} material={mats.frame} position={[w / 2 + 0.04, 0, 0]} />
      <mesh geometry={geo.head} material={mats.frame} position={[0, h / 2 + 0.04, 0]} />
      <mesh geometry={geo.plane} position={[0, 0, -0.03]}>
        <meshBasicMaterial ref={interiorMat} map={tex.interior} transparent opacity={0.25} toneMapped={false} />
      </mesh>
      <group ref={panel} position={[-w / 2, 0, 0.02]}>
        <mesh geometry={geo.panel} material={mats.panel} position={[w / 2, 0, 0]} />
        <mesh geometry={geo.knob} material={mats.knob} position={[w - 0.14, -0.05, 0.05]} />
      </group>
      <mesh geometry={geo.strip} position={[0, -h / 2 + 0.01, 0.34]} rotation-x={-Math.PI / 2} userData={{ noFit: true }}>
        <meshBasicMaterial ref={stripMat} map={tex.strip} transparent opacity={0.22} toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh
        geometry={geo.hit}
        material={mats.hit}
        userData={{ noFit: true }}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (e.nativeEvent.pointerType === "touch") return;
          setHover(true);
          (e.nativeEvent.target as HTMLElement).style.cursor = "pointer";
        }}
        onPointerOut={(e) => {
          setHover(false);
          (e.nativeEvent.target as HTMLElement).style.cursor = "";
        }}
        onClick={(e) => {
          e.stopPropagation();
          onGo();
        }}
      />
      {hover || focus ? (
        <Html position={[0, h / 2 + 0.38, 0.2]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="stage-prop-label" style={{ ["--stage-c" as string]: c }}>
            {STAGE_DOOR.label}
          </div>
        </Html>
      ) : null}
    </group>
  );
}
