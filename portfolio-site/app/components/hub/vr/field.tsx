"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: uniforms are mutated every frame
   inside useFrame, never during render. */

/**
 * The object field on the climb (D38 rounds B–C).
 *
 * Everything already exists in space along the camera's helix; only the camera
 * moves. Objects fade in and out of the dark with distance (fog in the shader)
 * and with their place on the climb, so each persona's stretch is its own.
 *
 *  - Slabs: glass panes with content from a drawn atlas (code, charts, camera
 *    readouts, strokes, routes, HUDs, tool logos). One instanced draw per set.
 *  - Each persona's assembly (./worlds): loose parts that fly together, power
 *    on, and become a doorway. The shared machinery lives in ./assembly.
 *
 * Built in code, no models, no downloads; the look is the headset's dark glass.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { personaIdentity } from "@/lib/site/brand";
import type { PersonaSlug } from "@/lib/content/types";
import { SPECTRUM_GLSL } from "@/lib/site/spectrum";
import { useVr } from "./clock";
import { ATLAS_N, ENGINEER_ICONS, makeIconAtlas, makeImageAtlas, makeSlabAtlas, makeTraderAtlas } from "./screens";
import { makeArtistAtlas, makeGamerAtlas, makePhotographerAtlas, makeRideAtlas } from "./screens-worlds";
import type { World } from "./state";
import { climbPose, makePose, seeded } from "./util";
import { ArtistAssembly } from "./worlds/artist";
import { EngineerAssembly } from "./worlds/engineer";
import { GamerAssembly } from "./worlds/gamer";
import { PhotographerAssembly } from "./worlds/photographer";
import { RideAssembly } from "./worlds/ride";
import { TraderAssembly } from "./worlds/trader";

/** How far objects are seen: fully there inside NEAR, gone beyond FAR (world units). */
const FOG_NEAR = 4;
const FOG_FAR = 15;

// ---------------------------------------------------------------------------
// Slabs: instanced glass panes with content from the atlas
// ---------------------------------------------------------------------------
const slabVertex = /* glsl */ `
attribute vec3 aPos;
attribute vec3 aRot;     // yaw, pitch, roll
attribute vec2 aSize;
attribute vec2 aTile;
attribute float aSeed;
attribute float aC;      // where on the climb this pane belongs
uniform float uTime;
uniform float uCam;      // where the camera is on the climb
varying vec2 vUv;
varying vec2 vTile;
varying float vFog;
varying float vSeed;

mat3 rot(vec3 e) {
  float cy = cos(e.x), sy = sin(e.x), cp = cos(e.y), sp = sin(e.y), cr = cos(e.z), sr = sin(e.z);
  mat3 Y = mat3(cy, 0.0, -sy, 0.0, 1.0, 0.0, sy, 0.0, cy);
  mat3 X = mat3(1.0, 0.0, 0.0, 0.0, cp, sp, 0.0, -sp, cp);
  mat3 Z = mat3(cr, sr, 0.0, -sr, cr, 0.0, 0.0, 0.0, 1.0);
  return Y * X * Z;
}
void main() {
  vUv = uv;
  vTile = aTile;
  vSeed = aSeed;
  // Alive at rest: a slow drift and a slower turn, each its own.
  vec3 drift = vec3(sin(uTime * 0.11 + aSeed * 20.0), sin(uTime * 0.09 + aSeed * 31.0), cos(uTime * 0.13 + aSeed * 12.0)) * 0.18;
  vec3 e = aRot + vec3(sin(uTime * 0.07 + aSeed * 9.0) * 0.08, sin(uTime * 0.05 + aSeed * 17.0) * 0.05, 0.0);
  vec3 local = rot(e) * vec3(position.x * aSize.x, position.y * aSize.y, 0.0);
  vec3 world = aPos + drift + local;
  vec4 mv = viewMatrix * vec4(world, 1.0);
  float dist = length(mv.xyz);
  // Fog by distance, and by place on the climb: a pane is for its own stretch of the path —
  // it has faded before the next persona's chapter, even where it would still be in range.
  float along = uCam - aC;
  float stretch = smoothstep(0.45, 0.1, along) * smoothstep(1.1, 0.7, -along);
  vFog = smoothstep(${FOG_FAR.toFixed(1)}, ${FOG_NEAR.toFixed(1)}, dist) * stretch;
  gl_Position = projectionMatrix * mv;
}
`;
const slabFragment = /* glsl */ `
${SPECTRUM_GLSL}
uniform sampler2D tAtlas;
uniform float uTint;
uniform float uShow;
uniform float uAtlasN;
varying vec2 vUv;
varying vec2 vTile;
varying float vFog;
varying float vSeed;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 p = vUv - 0.5;
  float d = roundedBox(p, vec2(0.5), 0.05);
  float body = smoothstep(0.0, -0.01, d);
  if (body <= 0.001) discard;
  // Content from the atlas, with a hair of colour fringe at the edges of the pane.
  vec2 fringe = p * 0.004;
  vec2 base = (vTile + 0.03 + vUv * 0.94) / uAtlasN;
  float r = texture2D(tAtlas, base + fringe).r;
  float g = texture2D(tAtlas, base).g;
  float b = texture2D(tAtlas, base - fringe).b;
  vec3 content = vec3(r, g, b);
  vec3 col = spectrum(uTint);
  // Dark glass with the content glowing inside it; a sheen across the pane, the rim catching the light.
  float rim = smoothstep(-0.03, 0.0, d) * 0.9;
  float sheen = smoothstep(0.0, 1.0, 1.0 - abs(p.x - p.y * 0.6 + 0.15) * 2.2) * 0.05;
  vec3 c = vec3(0.03, 0.03, 0.04) + content * 2.2 + col * rim * 0.9 + vec3(sheen);
  float a = (0.78 + rim * 0.22) * body * vFog * uShow;
  gl_FragColor = vec4(c * a, a);
}
`;

type SlabSpec = { pos: THREE.Vector3; rot: THREE.Vector3; size: THREE.Vector2; tile: THREE.Vector2; seed: number; c: number };

type SlabsProps = {
  world: World;
  count: number;
  atlas: THREE.Texture;
  /** Tile indices to draw from, [from, to). */
  tiles: [number, number];
  /** Pane width range (world units) and height as a fraction of width. */
  width: [number, number];
  aspect: number;
  /** Stretch of the climb these panes occupy, relative to the world's peak: [before, after]. */
  span?: [number, number];
  seed: number;
};

/** Drifting panes along a persona's stretch of the climb. One instanced draw. */
export function Slabs({ world, count, atlas, tiles, width, aspect, span = SPAN, seed }: SlabsProps) {
  const { clock, state } = useVr();
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(seed + Math.round(world.c * 7));
    const specs: SlabSpec[] = [];
    const pose = makePose();
    const tmp = new THREE.Vector3();
    // Where the setup stands and the room it needs while it gathers: panes keep out of it.
    const peak = climbPose(world.c);
    const anchor = peak.pos.clone().addScaledVector(peak.fwd, 5).addScaledVector(peak.right, 1.4);
    for (let i = 0; i < count; i++) {
      // Each pane hangs ahead of the camera's pose at its own point of the climb
      // (the helix turns: "ahead" is where you look), more of them before the peak than after.
      let c = world.c;
      for (let tries = 0; tries < 8; tries++) {
        const u = rnd();
        c = world.c + (u < 0.65 ? -rnd() * span[0] : rnd() * span[1]);
        climbPose(c, pose);
        // While the setup is gathering (it rides centre-right of the view, 5–10 units ahead) the
        // panes keep to the left, or far out on the right: nothing crosses through it.
        const gathering = c > world.c - 0.6 && c < world.c + 0.25;
        const side = rnd() < (gathering ? 0.75 : 0.5) ? -1 : 1;
        const off = (gathering && side > 0 ? 4.6 : 1.6) + rnd() * 4;
        const up = (rnd() - 0.45) * 5;
        tmp.copy(pose.pos).addScaledVector(pose.right, side * off).addScaledVector(pose.fwd, 3 + rnd() * 7).add(new THREE.Vector3(0, up, 0));
        if (tmp.distanceTo(anchor) > 4.2) break;
      }
      climbPose(c, pose);
      const side = tmp.clone().sub(pose.pos).dot(pose.right) < 0 ? -1 : 1;
      // Face back along the path (the camera's yaw is a left-handed turn; Ry needs its negative).
      const yaw = -pose.yaw + side * (0.35 + rnd() * 0.3);
      const w = width[0] + rnd() * (width[1] - width[0]);
      const tile = tiles[0] + Math.floor(rnd() * (tiles[1] - tiles[0]));
      specs.push({
        pos: tmp.clone(),
        rot: new THREE.Vector3(yaw, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.25),
        size: new THREE.Vector2(w, w * aspect),
        // Canvas rows count from the top; texture v from the bottom.
        tile: new THREE.Vector2(tile % ATLAS_N, ATLAS_N - 1 - Math.floor(tile / ATLAS_N)),
        seed: rnd(),
        c,
      });
    }
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.getAttribute("position"));
    g.setAttribute("uv", base.getAttribute("uv"));
    const pos = new Float32Array(count * 3);
    const rot = new Float32Array(count * 3);
    const size = new Float32Array(count * 2);
    const tile = new Float32Array(count * 2);
    const seedA = new Float32Array(count);
    const cA = new Float32Array(count);
    specs.forEach((s, i) => {
      pos.set([s.pos.x, s.pos.y, s.pos.z], i * 3);
      rot.set([s.rot.x, s.rot.y, s.rot.z], i * 3);
      size.set([s.size.x, s.size.y], i * 2);
      tile.set([s.tile.x, s.tile.y], i * 2);
      seedA[i] = s.seed;
      cA[i] = s.c;
    });
    g.setAttribute("aPos", new THREE.InstancedBufferAttribute(pos, 3));
    g.setAttribute("aRot", new THREE.InstancedBufferAttribute(rot, 3));
    g.setAttribute("aSize", new THREE.InstancedBufferAttribute(size, 2));
    g.setAttribute("aTile", new THREE.InstancedBufferAttribute(tile, 2));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seedA, 1));
    g.setAttribute("aC", new THREE.InstancedBufferAttribute(cA, 1));
    g.instanceCount = count;
    const m = new THREE.ShaderMaterial({
      vertexShader: slabVertex,
      fragmentShader: slabFragment,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { tAtlas: { value: atlas }, uTime: { value: 0 }, uCam: { value: 0 }, uTint: { value: world.t }, uShow: { value: 0 }, uAtlasN: { value: ATLAS_N } },
    });
    return { geometry: g, material: m };
  }, [world, count, atlas, tiles, width, aspect, span, seed]);

  useFrame(() => {
    const k = clock.current;
    material.uniforms.uTime.value = k.t;
    material.uniforms.uCam.value = k.climb;
    material.uniforms.uShow.value = state.current.phase === "climb" ? 1 - k.ending : 0;
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={6} />;
}

// ---------------------------------------------------------------------------
// Worlds: each persona's stretch of the climb — its panes and its assembly
// ---------------------------------------------------------------------------
const SCREENS: [number, number] = [0, 8];
const GLYPHS: [number, number] = [8, 16];
const W_SCREEN: [number, number] = [1.6, 3];
const W_GLYPH: [number, number] = [0.7, 1.2];
const W_ICON: [number, number] = [0.5, 0.85];
/** Panes begin after the previous persona's setup has powered off, and end before the next. */
const SPAN: [number, number] = [0.6, 0.5];

type WorldProps = { world: World; slabs: number; /** Ratul's own pictures for this persona (public/hub/<persona>/…). */ media: string[]; /** CC0 models in public/hub/models/. */ models: string[] };

type HubMedia = Partial<Record<PersonaSlug, string[]>> & { models?: string[] };
const NO_MEDIA: string[] = [];

/** public/hub/media.json, written by scripts/hub-media.mjs: which of Ratul's pictures exist per persona. */
function useHubMedia(): HubMedia {
  const [media, setMedia] = useState<HubMedia>({});
  useEffect(() => {
    let live = true;
    fetch("/hub/media.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: HubMedia) => live && setMedia(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return media;
}

/** Panes of Ratul's own pictures: up to 16 per persona, spread through its stretch. */
function Pictures({ world, slabs, urls, tileW, tileH, seed }: { world: World; slabs: number; urls: string[]; tileW: number; tileH: number; seed: number }) {
  const atlas = useMemo(() => makeImageAtlas(urls, tileW, tileH), [urls, tileW, tileH]);
  useEffect(() => () => atlas.dispose(), [atlas]);
  const n = Math.min(urls.length, 16);
  const tiles = useMemo<[number, number]>(() => [0, n], [n]);
  return <Slabs world={world} count={Math.min(Math.round(slabs * 0.6), n * 2)} atlas={atlas} tiles={tiles} width={W_PICTURE} aspect={tileH / tileW} seed={seed} />;
}
const W_PICTURE: [number, number] = [1.6, 2.8];

/** Two pane sets from one 2:1 atlas: "screens" and "glyphs". */
function Panes({ world, slabs, make, seed }: { world: World; slabs: number; make: (t: number) => THREE.Texture; seed: number }) {
  const atlas = useMemo(() => make(world.t), [make, world.t]);
  useEffect(() => () => atlas.dispose(), [atlas]);
  return (
    <>
      <Slabs world={world} count={Math.round(slabs * 0.5)} atlas={atlas} tiles={SCREENS} width={W_SCREEN} aspect={0.5} seed={seed} />
      <Slabs world={world} count={Math.round(slabs * 0.3)} atlas={atlas} tiles={GLYPHS} width={W_GLYPH} aspect={0.5} seed={seed + 30} />
    </>
  );
}

const ICON_TILES: [number, number] = [0, ENGINEER_ICONS.length];
function EngineerWorld({ world, slabs, media }: WorldProps) {
  const icons = useMemo(() => makeIconAtlas(ENGINEER_ICONS), []);
  useEffect(() => () => icons.dispose(), [icons]);
  const shots = useMemo(() => media.map((f) => `/hub/engineer/${f}`), [media]);
  return (
    <>
      <Panes world={world} slabs={shots.length ? Math.round(slabs * 0.6) : slabs} make={makeSlabAtlas} seed={101} />
      <Slabs world={world} count={Math.round(slabs * 0.7)} atlas={icons} tiles={ICON_TILES} width={W_ICON} aspect={1} seed={151} />
      {shots.length ? <Pictures world={world} slabs={slabs} urls={shots} tileW={512} tileH={320} seed={171} /> : null}
      <EngineerAssembly world={world} screenSrc={shots[0]} />
    </>
  );
}
const TraderWorld = ({ world, slabs }: WorldProps) => (
  <>
    <Panes world={world} slabs={slabs} make={makeTraderAtlas} seed={201} />
    <TraderAssembly world={world} />
  </>
);
function PhotographerWorld({ world, slabs, media }: WorldProps) {
  const photos = useMemo(() => media.map((f) => `/hub/photographer/${f}`), [media]);
  return (
    <>
      {/* With real photos the drawn frames step back; the pictures carry the stretch. */}
      <Panes world={world} slabs={photos.length ? Math.round(slabs * 0.4) : slabs} make={makePhotographerAtlas} seed={301} />
      {photos.length ? <Pictures world={world} slabs={slabs} urls={photos} tileW={512} tileH={341} seed={371} /> : null}
      <PhotographerAssembly world={world} />
    </>
  );
}
const ArtistWorld = ({ world, slabs }: WorldProps) => (
  <>
    <Panes world={world} slabs={slabs} make={makeArtistAtlas} seed={401} />
    <ArtistAssembly world={world} />
  </>
);
const RideWorld = ({ world, slabs, models }: WorldProps) => (
  <>
    <Panes world={world} slabs={slabs} make={makeRideAtlas} seed={501} />
    <RideAssembly world={world} modelUrl={models.includes("bike.glb") ? "/hub/models/bike.glb" : undefined} />
  </>
);
const GamerWorld = ({ world, slabs }: WorldProps) => (
  <>
    <Panes world={world} slabs={slabs} make={makeGamerAtlas} seed={601} />
    <GamerAssembly world={world} handle={personaIdentity("gamer").handle ?? "gamer"} />
  </>
);

const WORLDS: Record<PersonaSlug, (p: WorldProps) => React.JSX.Element> = {
  engineer: EngineerWorld,
  trader: TraderWorld,
  photographer: PhotographerWorld,
  artist: ArtistWorld,
  ride: RideWorld,
  gamer: GamerWorld,
};

/** Every published persona's stretch; a persona appears here the moment it is published. */
export function Worlds({ worlds, slabs }: { worlds: World[]; slabs: number }) {
  const media = useHubMedia();
  return (
    <>
      {worlds.map((w) => {
        const C = WORLDS[w.slug as PersonaSlug];
        return C ? <C key={w.slug} world={w} slabs={slabs} media={media[w.slug as PersonaSlug] ?? NO_MEDIA} models={media.models ?? NO_MEDIA} /> : null;
      })}
    </>
  );
}
