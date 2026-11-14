"use client";

/**
 * The full-screen room's camera (round 36): it stands in a zone and eases to the next one (damped, so a new target
 * mid-flight just bends the path: always interruptible). The visitor can look around within a limited range
 * (`lookRef`, written by the pointer handlers in room-experience.tsx), the pointer sways it a touch, and reduced
 * motion cuts instead of flying. `override` is a one-off pose (the zoom into the terminal's monitor). The shared
 * clock the kit's moving parts read is advanced here too.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { approachFor, damp, fovFor } from "@/lib/room3d/zones";
import type { Vec3 } from "@/lib/room3d/stage-kit";
import { useVr, type VrClock } from "../hub/vr/clock";

export type Pose = { eye: Vec3; look: Vec3 };
export type LookOffset = { yaw: number; pitch: number };

type Props = {
  /** Where the camera should be: the current zone's pose, or the override while one is set. */
  pose: Pose;
  /** The visitor's look-around offset (radians), eased here. */
  lookRef: MutableRefObject<LookOffset>;
  /** Cut instead of fly. */
  reduced: boolean;
  /** Ease rate per second for the fly (higher is quicker). */
  rate?: number;
  /** Slide the picture aside by this fraction of the viewport (x: content moves left when positive; y: content moves up) so a card does not cover what the camera is looking at. */
  shift?: { x: number; y: number };
  /** Called every frame with the shared clock's time (the live screen and the boards advance from it). */
  onFrame?: (t: number) => void;
  onSettle?: () => void;
  onFirstFrame?: () => void;
};

/** One frame of the shared clock the kit's moving parts read. */
function advance(k: VrClock, dt: number) {
  k.dt = dt;
  k.t += dt;
  k.scale = 1;
}

export function ZoneRig({ pose, lookRef, reduced, rate = 3.2, shift, onFrame, onSettle, onFirstFrame }: Props) {
  const { clock, state } = useVr();
  const size = useThree((s) => s.size);
  const gl = useThree((s) => s.gl);
  const setFrameloop = useThree((s) => s.setFrameloop);
  const s = useRef({
    first: true,
    eye: new THREE.Vector3(),
    look: new THREE.Vector3(),
    want: new THREE.Vector3(),
    wantLook: new THREE.Vector3(),
    dir: new THREE.Vector3(),
    right: new THREE.Vector3(),
    px: 0,
    py: 0,
    yaw: 0,
    pitch: 0,
    settled: false,
    lastFov: 0,
    sx: 0,
    sy: 0,
  });
  // Nothing is drawn while the tab's canvas is off screen.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? "always" : "never"));
    io.observe(gl.domElement);
    return () => io.disconnect();
  }, [gl, setFrameloop]);
  // A new target un-settles the camera so the arrival is reported again.
  const poseKey = pose.eye.join() + "|" + pose.look.join();
  useEffect(() => {
    s.current.settled = false;
  }, [poseKey]);

  useFrame(({ camera }, rawDt) => {
    const t = s.current;
    const cam = camera as THREE.PerspectiveCamera;
    const dt = Math.min(rawDt, 0.1);
    advance(clock.current, dt);
    const aspect = size.width / Math.max(1, size.height);
    const fov = fovFor(aspect);
    if (Math.abs(fov - t.lastFov) > 0.01) {
      t.lastFov = fov;
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    t.want.set(...pose.eye);
    t.wantLook.set(...pose.look);
    // A narrow screen stands closer to what it looks at.
    t.want.sub(t.wantLook).multiplyScalar(approachFor(aspect)).add(t.wantLook);
    if (t.first) {
      t.first = false;
      t.eye.copy(t.want);
      t.look.copy(t.wantLook);
      window.requestAnimationFrame(() => onFirstFrame?.());
      if (process.env.NODE_ENV !== "production") (window as unknown as { __roomCam?: unknown }).__roomCam = { camera: cam, rig: t };
    }
    const k = damp(dt, reduced ? 0 : rate);
    t.eye.lerp(t.want, k);
    t.look.lerp(t.wantLook, k);
    const near = t.eye.distanceTo(t.want) < 0.015 && t.look.distanceTo(t.wantLook) < 0.015;
    if (near && !t.settled) {
      t.settled = true;
      onSettle?.();
    }
    // The pointer swings the camera a touch; the visitor's look-around is eased on top, within its limits.
    t.px += (state.current.px - t.px) * Math.min(1, dt * 4);
    t.py += (state.current.py - t.py) * Math.min(1, dt * 4);
    const e = damp(dt, reduced ? 0 : 9);
    t.yaw += (lookRef.current.yaw - t.yaw) * e;
    t.pitch += (lookRef.current.pitch - t.pitch) * e;
    t.dir.copy(t.look).sub(t.eye);
    const dist = t.dir.length();
    t.dir.normalize();
    t.dir.applyAxisAngle(THREE.Object3D.DEFAULT_UP, t.yaw - t.px * 0.035);
    t.right.crossVectors(t.dir, THREE.Object3D.DEFAULT_UP).normalize();
    t.dir.applyAxisAngle(t.right, t.pitch + t.py * 0.02);
    // A card over the room: the picture slides so the subject stays in the open part of the screen.
    const wx = shift?.x ?? 0;
    const wy = shift?.y ?? 0;
    const ke = damp(dt, reduced ? 0 : 6);
    t.sx += (wx - t.sx) * ke;
    t.sy += (wy - t.sy) * ke;
    if (Math.abs(t.sx) > 0.0005 || Math.abs(t.sy) > 0.0005) cam.setViewOffset(size.width, size.height, t.sx * size.width, t.sy * size.height, size.width, size.height);
    else if (cam.view?.enabled) cam.clearViewOffset();
    cam.position.copy(t.eye);
    cam.lookAt(t.eye.x + t.dir.x * dist, t.eye.y + t.dir.y * dist, t.eye.z + t.dir.z * dist);
    onFrame?.(clock.current.t);
  });
  return null;
}
