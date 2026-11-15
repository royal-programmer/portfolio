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
import { fabricTexture, labelTexture, surfaceNormal, surfaceRoughness, woodTexture, type SurfaceKind } from "./textures";

export type Lighting = Room["lighting"]["day"];
type Preset = Room["objects"][number]["material"]["preset"];

type PresetLook = {
  metalness: number;
  map?: "wood" | "fabric";
  /** The surface the normal map shows, and how hard (every preset has one: nothing is perfectly flat). */
  bump?: { kind: SurfaceKind; strength: number; scale: number };
  /** The surface the roughness map shows, and how far down it multiplies the material's roughness (lo..1). */
  rough?: { kind: SurfaceKind; lo: number };
  transparent?: number;
  env?: number;
};

const PRESET: Record<Preset, PresetLook> = {
  wood: { metalness: 0.02, map: "wood", bump: { kind: "streak", strength: 0.4, scale: 0.06 }, rough: { kind: "streak", lo: 0.8 } },
  metal: { metalness: 0.75, bump: { kind: "brushed", strength: 0.3, scale: 0.04 }, rough: { kind: "brushed", lo: 0.55 } },
  plastic: { metalness: 0.15, bump: { kind: "grain", strength: 0.3, scale: 0.04 }, rough: { kind: "blotch", lo: 0.7 } },
  fabric: { metalness: 0, map: "fabric", bump: { kind: "weave", strength: 0.4, scale: 0.12 }, rough: { kind: "blotch", lo: 0.85 } },
  ceramic: { metalness: 0.05, bump: { kind: "grain", strength: 0.2, scale: 0.03 }, rough: { kind: "blotch", lo: 0.7 } },
  paper: { metalness: 0, bump: { kind: "grain", strength: 0.5, scale: 0.05 }, rough: { kind: "blotch", lo: 0.9 } },
  glass: { metalness: 0.1, transparent: 0.28, env: 1.4, bump: { kind: "blotch", strength: 0.1, scale: 0.02 }, rough: { kind: "blotch", lo: 0.45 } },
  rubber: { metalness: 0, bump: { kind: "grain", strength: 0.6, scale: 0.08 }, rough: { kind: "blotch", lo: 0.85 } },
  plaster: { metalness: 0, bump: { kind: "plaster", strength: 0.5, scale: 0.07 }, rough: { kind: "blotch", lo: 0.85 } },
  leaf: { metalness: 0, bump: { kind: "grain", strength: 0.4, scale: 0.06 }, rough: { kind: "blotch", lo: 0.75 } },
  emissive: { metalness: 0 },
};

/** One metre of wall or floor holds a tile of plaster this wide (metres): the pattern repeats per metre, whatever the size of the surface. */
export const PLASTER_TILE = 1.5;

/** Materials, geometries and textures shared by every object in a room; `dispose` frees them all. */
export class Kit {
  private mats = new Map<string, THREE.Material>();
  private geos = new Map<string, THREE.BufferGeometry>();
  private texs = new Map<string, THREE.Texture>();
  constructor(readonly texSize: number) {}

  /** The size of the surface maps (a normal or roughness map is never bigger than 256, and no bigger than the tier's textures). */
  private get surf() {
    return Math.min(this.texSize, 256);
  }

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

  /** The normal and roughness maps of a surface kind, shared by every material that asks for one. */
  surfaceMaps(kind: SurfaceKind, strength: number, lo: number) {
    return {
      normal: this.tex(`n:${kind}:${strength}`, () => surfaceNormal(kind, this.surf, strength)),
      rough: this.tex(`r:${kind}:${lo}`, () => surfaceRoughness(kind, this.surf, lo, 1)),
    };
  }

  /** A copy of a map with its own repeat that shares the image (one upload): for a surface whose size sets the tiling. */
  tiled(key: string, from: THREE.Texture, repeat: [number, number]): THREE.Texture {
    return this.tex(`${key}:${repeat[0].toFixed(2)}:${repeat[1].toFixed(2)}`, () => {
      const t = from.clone();
      t.repeat.set(repeat[0], repeat[1]);
      t.needsUpdate = true;
      return t;
    });
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
        if (p.bump) {
          std.normalMap = this.surfaceMaps(p.bump.kind, p.bump.strength, 1).normal;
          std.normalScale = new THREE.Vector2(p.bump.scale, p.bump.scale);
        }
        if (p.rough) std.roughnessMap = this.surfaceMaps(p.rough.kind, 1, p.rough.lo).rough;
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

  /** The normal and roughness maps of a preset repeating once per `tile` metres of a `w` x `h` metre surface (shared images, own repeat). */
  tiledMaps(preset: Preset, w: number, h: number, tile = PLASTER_TILE) {
    const p = PRESET[preset];
    const rep: [number, number] = [w / tile, h / tile];
    return {
      normalMap: p.bump ? this.tiled(`tn:${p.bump.kind}`, this.surfaceMaps(p.bump.kind, p.bump.strength, 1).normal, rep) : null,
      normalScale: new THREE.Vector2(p.bump?.scale ?? 0, p.bump?.scale ?? 0),
      roughnessMap: p.rough ? this.tiled(`tr:${p.rough.kind}`, this.surfaceMaps(p.rough.kind, 1, p.rough.lo).rough, rep) : null,
    };
  }

  /**
   * A wall material whose maps repeat per metre of the surface (`w` x `h` metres), not once across it: the plaster tile is
   * `PLASTER_TILE` metres wide whatever the room's size. Same images as `mat`, so no extra upload.
   */
  wall(color: string, roughness: number, w: number, h: number): THREE.MeshStandardMaterial {
    const key = `w:${color}:${roughness}:${w}:${h}`;
    let m = this.mats.get(key) as THREE.MeshStandardMaterial | undefined;
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...this.tiledMaps("plaster", w, h) });
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
  /** Content boards drawn from the content layer, by object id: a `board` object's face, the projects monitor, the TV's reel. */
  boards?: Record<string, THREE.Texture>;
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
  /**
   * Show the stars and their lines. False hides them cleanly (no fade): up close they read as stray lines and dots under
   * the ceiling, so the room shows them only while the camera is at the zone that is about them. Absent = shown (the old scene).
   */
  skyOn?: boolean;
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

/** Mirror a texture left to right (a curved monitor's glass is seen from inside, so its picture is flipped to read the right way round). */
export function flipTexX(t: THREE.Texture) {
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.x = -1;
  t.offset.x = 1;
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
