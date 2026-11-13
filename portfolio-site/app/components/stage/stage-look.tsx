"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: lights and shared look values are mutated every frame. */

/**
 * The Stage's lights, and the look they share with the desk's props (lamp, window, screen glow).
 * The preset for the visitor's band (`lib/site/stage-data.ts`) is tweened in over 1.2 s whenever it
 * changes; reduced motion applies it at once. Lights stand relative to the camera so the key is
 * always where the preset says, however the stage drifts.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { lightingFor, type StageLight, type StageLighting } from "@/lib/site/stage-data";

/** What the desk reads each frame: the tweened lamp (0…1), window colour and brightness, screen glow. */
export type StageLook = { lamp: number; windowColor: THREE.Color; windowI: number; glow: number };
export const createLook = (): StageLook => ({ lamp: 0, windowColor: new THREE.Color("#000"), windowI: 0, glow: 1 });

const TWEEN_S = 1.2;
/** Floats: 3 lights x (rgb, intensity, xyz) + ambient (rgb, intensity) + glow + lamp + window (rgb, intensity). */
const N = 3 * 7 + 4 + 1 + 1 + 4;

const pack = (p: StageLighting): number[] => {
  const c = new THREE.Color();
  const out: number[] = [];
  const light = (l: StageLight) => out.push(...c.set(l.color).toArray(), l.intensity, ...l.position);
  light(p.key);
  light(p.fill);
  light(p.rim);
  out.push(...c.set(p.ambient.color).toArray(), p.ambient.intensity, p.screenGlow, p.lampOn ? 1 : 0, ...c.set(p.windowLight.color).toArray(), p.windowLight.intensity);
  return out;
};

export function StageLights({ band, look, instant }: { band: string; look: MutableRefObject<StageLook>; instant: boolean }) {
  const lights = useMemo(() => {
    const mk = () => new THREE.DirectionalLight("#fff", 0);
    return { key: mk(), fill: mk(), rim: mk(), ambient: new THREE.AmbientLight("#fff", 0) };
  }, []);
  const tw = useRef({ cur: pack(lightingFor("day")), from: pack(lightingFor("day")), to: pack(lightingFor("day")), t0: -1, band: "" });
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), f: new THREE.Vector3() }), []);

  useFrame(({ camera, clock }) => {
    const s = tw.current;
    const now = clock.elapsedTime;
    if (s.band !== band) {
      s.band = band;
      s.from = s.cur.slice();
      s.to = pack(lightingFor(band));
      s.t0 = now;
    }
    const k = instant ? 1 : Math.min(1, (now - s.t0) / TWEEN_S);
    const e = k * k * (3 - 2 * k);
    for (let i = 0; i < N; i++) s.cur[i] = s.from[i] + (s.to[i] - s.from[i]) * e;
    const c = s.cur;
    tmp.f.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const set = (l: THREE.DirectionalLight, o: number) => {
      l.color.setRGB(c[o], c[o + 1], c[o + 2]);
      l.intensity = c[o + 3];
      l.position.set(c[o + 4], c[o + 5], c[o + 6]).applyQuaternion(camera.quaternion).add(camera.position);
      l.target.position.copy(camera.position).addScaledVector(tmp.f, 6);
      l.target.updateMatrixWorld();
    };
    set(lights.key, 0);
    set(lights.fill, 7);
    set(lights.rim, 14);
    lights.ambient.color.setRGB(c[21], c[22], c[23]);
    lights.ambient.intensity = c[24];
    const L = look.current;
    L.glow = c[25];
    L.lamp = c[26];
    L.windowColor.setRGB(c[27], c[28], c[29]);
    L.windowI = c[30];
  });

  return (
    <>
      <primitive object={lights.ambient} />
      <primitive object={lights.key} />
      <primitive object={lights.key.target} />
      <primitive object={lights.fill} />
      <primitive object={lights.fill.target} />
      <primitive object={lights.rim} />
      <primitive object={lights.rim.target} />
    </>
  );
}
