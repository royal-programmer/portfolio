"use client";

/**
 * The Stage's camera and clock when the room is drawn through the kit (`?kit=1`). Same behaviour as `Rig` in
 * world-stage-3d.tsx, re-aimed at a room instead of the hub's assembly: it advances the shared clock, stands the
 * camera at the desk (the pointer turns it a little), glides it between the scroll story's stops, orbits it for photo
 * mode, carries it through the door, and zooms it into the terminal monitor. The page's refs are the same ones the
 * old rig reads, so the overlay, the HUD events and the navigation stay in one place.
 */
import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import type { Room } from "@/lib/room3d/schema";
import type { KitStop } from "@/lib/room3d/stage-kit";
import { STAGE_DOOR, STAGE_STOPS } from "@/lib/site/stage-data";
import { useVr } from "../hub/vr/clock";
import type { DoorGo } from "./door";
import type { PhotoState } from "./photo";

export type KitZoom = { on: boolean; t0: number; dur: number; e: number; fired: boolean };
export type KitStoryState = { p: number; on: boolean };

const smooth = (x: number) => x * x * (3 - 2 * x);

type Props = {
  room: Room;
  stops: KitStop[];
  zoomRef: MutableRefObject<KitZoom | null>;
  /** The id of the monitor that shows the live terminal (the zoom's target); null when the room has none. */
  monitorId: string | null;
  doorId: string | null;
  story?: MutableRefObject<KitStoryState>;
  photo?: MutableRefObject<PhotoState>;
  door?: MutableRefObject<DoorGo>;
  onDoorDone?: () => void;
  onFrame?: (t: number) => void;
  onZoomDone?: () => void;
  onFirstFrame?: () => void;
  mark?: (name: string) => void;
};

export function KitRig({ room, stops, zoomRef, monitorId, doorId, story, photo, door, onDoorDone, onFrame, onZoomDone, onFirstFrame, mark }: Props) {
  const { clock, state } = useVr();
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const desk = useMemo(() => room.objects.find((o) => o.kind === "desk"), [room]);
  const monitor = useMemo(() => room.objects.find((o) => o.id === monitorId), [room, monitorId]);
  const sc = useRef({
    px: 0,
    py: 0,
    ps: 0,
    zoom: { on: false, t0: 0, dur: 0.7, e: 0, fired: false } as KitZoom,
    handle: false,
    framed: false,
    rest: { eye: new THREE.Vector3(), look: new THREE.Vector3() },
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    la: new THREE.Vector3(),
    lb: new THREE.Vector3(),
    eye: new THREE.Vector3(),
    look: new THREE.Vector3(),
    sp: new THREE.Vector3(),
    sn: new THREE.Vector3(),
    sq: new THREE.Quaternion(),
    doorObj: null as THREE.Object3D | null,
    screenObj: null as THREE.Object3D | null,
  });
  // The same render-on-demand as the old stage: nothing is drawn while the stage is off screen.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? "always" : "never"));
    io.observe(gl.domElement);
    return () => io.disconnect();
  }, [gl, setFrameloop]);

  useFrame(({ camera, scene }, rawDt) => {
    const tmp = sc.current;
    const k = clock.current;
    const s = state.current;
    if (!tmp.framed) {
      tmp.framed = true;
      window.requestAnimationFrame(() => {
        mark?.("stage:first-frame");
        onFirstFrame?.();
      });
    }
    zoomRef.current = tmp.zoom;
    if (!tmp.handle) {
      tmp.handle = true;
      if (process.env.NODE_ENV !== "production") (window as unknown as { __stage?: unknown }).__stage = { scene, camera, clock, state, kit: true };
    }
    const dt = Math.min(rawDt, 0.1);
    k.dt = dt;
    k.t += dt;
    k.scale = 1;
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    const wide = Math.max(1, Math.pow(1.6 / aspect, 0.62));
    tmp.px += (s.px - tmp.px) * Math.min(1, dt * 5);
    tmp.py += (s.py - tmp.py) * Math.min(1, dt * 5);
    // Rest: the desk, from the right and a little above, the pointer swinging it a touch.
    const dx = desk?.transform.pos[0] ?? 0.3;
    const dz = desk?.transform.pos[2] ?? -2.1;
    tmp.rest.look.set(dx, 1.0, dz + 0.02);
    tmp.rest.eye.set(dx + 2.5 * wide + tmp.px * 0.25 + Math.sin(k.t * 0.2) * 0.06, 1.8 + 0.4 * (wide - 1) + tmp.py * 0.1, dz + 0.12 + 4.1 * wide);
    cam.position.copy(tmp.rest.eye);
    tmp.look.copy(tmp.rest.look);
    cam.lookAt(tmp.look);
    // The scroll story: between stops the camera glides from one pose to the next (eased twice, as the old rig does).
    const st = story?.current;
    if (st?.on) {
      tmp.ps += (st.p - tmp.ps) * Math.min(1, dt * 5);
      if (tmp.ps > 0.002) {
        const back = THREE.MathUtils.clamp(1.6 / aspect, 1, 2.2);
        const pose = (j: number, eye: THREE.Vector3, look: THREE.Vector3) => {
          // Stop j of STAGE_STOPS is the kit stop with the same id; a room without it keeps the one before.
          for (let q = j; q > 0; q--) {
            const ks = stops.find((x) => x.id === STAGE_STOPS[q].id);
            if (ks) {
              look.set(...ks.look);
              eye.set(...ks.eye).sub(look).multiplyScalar(back).add(look);
              return;
            }
          }
          eye.copy(tmp.rest.eye);
          look.copy(tmp.rest.look);
        };
        const i = Math.min(2, Math.floor(tmp.ps));
        const f = smooth(Math.min(1, tmp.ps - i));
        if (i === 0) {
          tmp.a.copy(tmp.rest.eye);
          tmp.la.copy(tmp.rest.look);
        } else pose(i, tmp.a, tmp.la);
        pose(i + 1, tmp.b, tmp.lb);
        cam.position.lerpVectors(tmp.a, tmp.b, f);
        tmp.look.lerpVectors(tmp.la, tmp.lb, f);
        cam.lookAt(tmp.look);
      }
    }
    // Photo mode: the visitor's orbit about the point the camera is looking at.
    const ph = photo?.current;
    if (ph) {
      const e = Math.min(1, dt * 6);
      ph.y += (ph.ty - ph.y) * e;
      ph.p += (ph.tp - ph.p) * e;
      if (Math.abs(ph.y) > 1e-4 || Math.abs(ph.p) > 1e-4) {
        tmp.a.copy(cam.position).sub(tmp.look);
        tmp.b.set(1, 0, 0).applyQuaternion(cam.quaternion);
        tmp.a.applyAxisAngle(tmp.b, ph.p).applyAxisAngle(tmp.la.set(0, 1, 0), ph.y);
        cam.position.copy(tmp.look).add(tmp.a);
        cam.lookAt(tmp.look);
      }
    }
    // Through the door: once it has swung open the camera moves to the doorway and on through it.
    const dr = door?.current;
    if (dr?.on && dr.t0 > -1e8 && doorId) {
      const d = (tmp.doorObj ??= scene.getObjectByName(doorId) ?? null);
      if (d) {
        const p = Math.min(1, Math.max(0, (k.t - dr.t0 - STAGE_DOOR.openMs / 1000) / (STAGE_DOOR.travelMs / 1000)));
        dr.e = smooth(p);
        d.updateWorldMatrix(true, false);
        d.getWorldPosition(tmp.sp);
        d.getWorldQuaternion(tmp.sq);
        tmp.sp.y = 1.0;
        tmp.sn.set(0, 0, 1).applyQuaternion(tmp.sq);
        tmp.eye.copy(tmp.sp).addScaledVector(tmp.sn, -0.5);
        cam.position.lerp(tmp.eye, dr.e);
        tmp.look.lerp(tmp.a.copy(tmp.sp).addScaledVector(tmp.sn, -3), dr.e);
        cam.lookAt(tmp.look);
        if (p >= 1 && !dr.fired) {
          dr.fired = true;
          onDoorDone?.();
        }
      }
    }
    // Zoom into the terminal monitor: the screen covers the frame; the page's overlay takes over for the last stretch.
    const z = tmp.zoom;
    if (z.on && monitor && monitorId) {
      const m = (tmp.screenObj ??= scene.getObjectByName(monitorId) ?? null);
      const prm = monitor.params as { inches: number; aspect: number; lift: number };
      if (m) {
        const p = Math.min(1, (k.t - z.t0) / z.dur);
        z.e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        m.updateWorldMatrix(true, false);
        m.localToWorld(tmp.sp.set(0, prm.lift, -0.05));
        m.getWorldQuaternion(tmp.sq);
        tmp.sn.set(0, 0, 1).applyQuaternion(tmp.sq);
        const sizeIn = (prm.inches * 0.0254) / Math.sqrt(1 + prm.aspect * prm.aspect);
        const sh = sizeIn * monitor.transform.scale;
        const sw = sh * prm.aspect;
        const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
        const dist = Math.min(sh / (2 * tanH), sw / (2 * tanH * aspect)) * 1.02 + 0.06;
        tmp.eye.copy(tmp.sp).addScaledVector(tmp.sn, dist);
        cam.position.lerp(tmp.eye, z.e);
        tmp.look.lerp(tmp.sp, z.e);
        cam.lookAt(tmp.look);
        if (p >= 1 && !z.fired) {
          z.fired = true;
          onZoomDone?.();
        }
      }
    }
    onFrame?.(k.t);
  });
  return null;
}

/** The hover / focus label over an object, in the Stage's own label style. */
export function KitLabel({ room, id, text, accent }: { room: Room; id: string | null; text: string | null; accent: string }) {
  const o = id ? room.objects.find((x) => x.id === id) : undefined;
  if (!o || !text) return null;
  const [x, y, z] = o.transform.pos;
  const up = o.kind === "projectShelf" ? 1.7 : o.kind === "door" ? 2.3 : o.kind === "monitor" ? 1.5 : 0.3;
  return (
    <Html position={[x, y + up, z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className="stage-prop-label" style={{ ["--stage-c" as string]: accent }}>
        {text}
      </div>
    </Html>
  );
}
