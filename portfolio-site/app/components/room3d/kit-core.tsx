"use client";

/**
 * The room kit's shared pieces (18-3d-room-plan.md P1): the cache of materials, geometries and textures
 * (one of each per look, disposed with the room), the environment every kind reads, instancing, the glow
 * sprite, and the image-field texture loader with its error state.
 */
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import type { Room, Tier } from "@/lib/room3d/schema";
import type { Constellation } from "@/lib/site/stage-constellation";
import type { ShelfCase } from "@/lib/site/stage-data";
import { fabricTexture, labelTexture, noiseNormal, woodTexture } from "./textures";

export type Lighting = Room["lighting"]["day"];
type Preset = Room["objects"][number]["material"]["preset"];

const PRESET: Record<Preset, { metalness: number; map?: "wood" | "fabric"; normal?: boolean; transparent?: number; env?: number }> = {
  wood: { metalness: 0.02, map: "wood", normal: true },
  metal: { metalness: 0.75 },
  plastic: { metalness: 0.15 },
  fabric: { metalness: 0, map: "fabric" },
  ceramic: { metalness: 0.05 },
  paper: { metalness: 0 },
  glass: { metalness: 0.1, transparent: 0.28, env: 1.4 },
  rubber: { metalness: 0 },
  plaster: { metalness: 0, normal: true },
  leaf: { metalness: 0 },
  emissive: { metalness: 0 },
};

/** Materials, geometries and textures shared by every object in a room; `dispose` frees them all. */
export class Kit {
  private mats = new Map<string, THREE.Material>();
  private geos = new Map<string, THREE.BufferGeometry>();
  private texs = new Map<string, THREE.Texture>();
  private wallNormal = new THREE.Vector2(0.12, 0.12);
  constructor(readonly texSize: number) {}

  tex(key: string, make: () => THREE.Texture): THREE.Texture {
    let t = this.texs.get(key);
    if (!t) {
      t = make();
      this.texs.set(key, t);
    }
    return t;
  }

  geo<G extends THREE.BufferGeometry>(key: string, make: () => G): G {
    let g = this.geos.get(key);
    if (!g) {
      g = make();
      this.geos.set(key, g);
    }
    return g as G;
  }

  /** A standard material for a preset, tinted by `color`; the same arguments return the same object. */
  mat(preset: Preset, color: string, roughness: number): THREE.Material {
    const key = `m:${preset}:${color}:${roughness}`;
    let m = this.mats.get(key);
    if (!m) {
      const p = PRESET[preset];
      if (preset === "emissive") m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      else {
        const std = new THREE.MeshStandardMaterial({ color, roughness, metalness: p.metalness });
        if (p.map === "wood") std.map = this.tex("wood", () => woodTexture(this.texSize, "#d8c3a0", [1, 1]));
        if (p.map === "fabric") std.map = this.tex("fabric", () => fabricTexture(this.texSize, "#d4d4d4", [2, 2]));
        if (p.normal) {
          std.normalMap = this.tex("plaster", () => noiseNormal(Math.min(this.texSize, 256), 0.9, [1.5, 1]));
          std.normalScale = this.wallNormal;
        }
        if (p.transparent) {
          std.transparent = true;
          std.opacity = p.transparent;
          std.depthWrite = false;
          std.envMapIntensity = p.env ?? 1;
        }
        m = std;
      }
      this.mats.set(key, m);
    }
    return m;
  }

  /** An unlit material that glows past 1 (bloom picks it up; `toneMapped` off keeps the colour). */
  glow(color: string, k: number): THREE.MeshBasicMaterial {
    const key = `g:${color}:${k.toFixed(2)}`;
    let m = this.mats.get(key) as THREE.MeshBasicMaterial | undefined;
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), toneMapped: false });
      this.mats.set(key, m);
    }
    return m;
  }

  dispose() {
    this.mats.forEach((m) => m.dispose());
    this.geos.forEach((g) => g.dispose());
    this.texs.forEach((t) => t.dispose());
    this.mats.clear();
    this.geos.clear();
    this.texs.clear();
  }
}

/** What every object kind can read: the kit, the part of the day, the quality tier, the visitor's state. */
export type Env = {
  kit: Kit;
  light: Lighting;
  accent: string;
  phone: boolean;
  tier: Tier;
  hoverId: string | null;
  /** Ids whose click has run (a door that has swung open). */
  openIds: ReadonlySet<string>;
  /** A console has been switched on: the TV shows its home screen. */
  consoleOn: boolean;
  reduced: boolean;
  /** The worlds, as tiles for the console's home screen. */
  worlds: Array<{ label: string; color: string }>;
  /** Milliseconds to add to the device clock so it matches the server's (from the Date header). */
  clockOffsetMs: number;
  /** The Stage's data for the project shelf and the constellation (absent in the lab viewer). */
  stage?: StageExtras;
  /** The live terminal texture (the Stage's, redrawn by the page): a monitor whose `screen` is `terminal` shows it. */
  liveScreen?: THREE.Texture | null;
};

/** What the Stage hands the room beyond the room's own objects: the project cases and the stars, and how they answer. */
export type StageExtras = {
  accent: THREE.Color;
  reduced: boolean;
  cases: ShelfCase[];
  caseFocus: string | null;
  openId: string | null;
  onOpenCase: (item: ShelfCase, rect: { x: number; y: number; w: number; h: number } | null) => void;
  onPickCase: (id: string) => void;
  constellation: Constellation | null;
  /** Read each frame: the stars answer the pointer only while the camera is looking at them. */
  starsActive: MutableRefObject<boolean>;
  story?: MutableRefObject<{ p: number; on: boolean }>;
  onRunCommand: (cmd: string) => void;
};
export const EnvCtx = createContext<Env | null>(null);
export function useEnv(): Env {
  const e = useContext(EnvCtx);
  if (!e) throw new Error("room3d kinds render inside <Room>");
  return e;
}

/** The live terminal's canvas is 1024 x 640; a screen of another shape shows all of it, the spare edge filled with the canvas's own edge colour. */
export function fitLive(t: THREE.Texture, screenAspect: number, flipX: boolean) {
  const rx = Math.max(1, screenAspect / 1.6);
  const ry = Math.max(1, 1.6 / screenAspect);
  t.repeat.set((flipX ? -1 : 1) * rx, ry);
  t.offset.set(flipX ? 0.5 + rx / 2 : (1 - rx) / 2, (1 - ry) / 2);
}

/** A material for the kind's own `material` block, from the shared cache. */
export const useMat = (m: { preset: Preset; color: string; roughness: number }) => useEnv().kit.mat(m.preset, m.color, m.roughness);

type Fill = (i: number, o: THREE.Object3D, c: THREE.Color) => void;
/** One draw call for `count` copies: `fill` writes each copy's transform and colour. */
export function Inst({ count, geometry, material, fill, cast = true }: { count: number; geometry: THREE.BufferGeometry; material: THREE.Material; fill: Fill; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      c.set("#ffffff");
      fill(i, o, c);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      m.setColorAt(i, c);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [count, fill]);
  return <instancedMesh key={count} ref={ref} args={[geometry, material, count]} castShadow={cast} receiveShadow />;
}

/** A soft additive halo: bloom's stand-in on the phone tier and a little extra on desktop. */
export function Halo({ position, size, color, opacity = 0.5 }: { position: [number, number, number]; size: [number, number]; color: string; opacity?: number }) {
  const { kit } = useEnv();
  const tex = kit.tex("halo", () => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.35, "rgba(255,255,255,0.35)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  });
  return (
    <mesh position={position} userData={{ noShadow: true }} renderOrder={5}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={tex} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

export type ImageState = "none" | "loading" | "ready" | "error";
export const IMAGE_ERROR_EVENT = "room3d:image-error";

/**
 * An image field as a texture. An https URL is loaded with `crossOrigin = "anonymous"`, so its host must send
 * CORS headers; when it cannot load, `state` is "error" and an event names the URL (the editor says so and
 * offers the upload). `upload:` ids resolve once uploads exist (P2); until then they report an error.
 */
export function useImageTexture(image: { src: string; alt: string } | undefined, fallbackTitle: string, aspect = 1): { tex: THREE.Texture; state: ImageState } {
  const { kit } = useEnv();
  const [loaded, setLoaded] = useState<{ src: string; tex: THREE.Texture | null; failed: boolean } | null>(null);
  const src = image?.src;
  useEffect(() => {
    if (!src) return;
    let live = true;
    if (src.startsWith("upload:")) {
      queueMicrotask(() => live && setLoaded({ src, tex: null, failed: true }));
      window.dispatchEvent(new CustomEvent(IMAGE_ERROR_EVENT, { detail: { src, reason: "uploads are not available yet" } }));
      return () => {
        live = false;
      };
    }
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      src,
      (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        if (live) setLoaded({ src, tex: t, failed: false });
        else t.dispose();
      },
      undefined,
      () => {
        if (live) setLoaded({ src, tex: null, failed: true });
        window.dispatchEvent(new CustomEvent(IMAGE_ERROR_EVENT, { detail: { src, reason: "the picture could not load as a texture (the host may not allow cross-origin use)" } }));
      },
    );
    return () => {
      live = false;
    };
  }, [src]);
  useEffect(() => () => void loaded?.tex?.dispose(), [loaded]);
  const current = loaded && loaded.src === src ? loaded : null;
  const state: ImageState = !src ? "none" : !current ? "loading" : current.failed ? "error" : "ready";
  const blank = useMemo(
    () => kit.tex(`blank:${fallbackTitle}:${state}:${aspect.toFixed(2)}`, () => labelTexture(fallbackTitle || " ", 256, Math.round(256 / Math.max(0.2, aspect)), "#1c1f2b", "#9aa5ce", state === "error" ? "picture could not load" : undefined)),
    [kit, fallbackTitle, state, aspect],
  );
  return { tex: current?.tex ?? blank, state };
}

/** Screen textures shared per look: code, terminal and console-home come from here, not per monitor. */
export const ACCENTS = ["#7aa2ff", "#c792ea", "#89ddff", "#c3e88d", "#ffcb6b", "#f78c6c"];
