"use client";

/**
 * `<Room>`: maps a room's `objects[]` to the kit's kind components, builds the shell (floor, walls), the light
 * for the part of the day, the environment and the shadows for the quality tier. One room is mounted at a time;
 * its kit (materials, geometries, textures) is disposed when it unmounts. Clicking an object that has an
 * `interaction` calls `onRun`; hovering one calls `onHover` with its label.
 */
import { AccumulativeShadows, ContactShadows, Environment, Lightformer, RandomizedLight } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, type ComponentType } from "react";
import * as THREE from "three";
import type { KindId, ObjectOf, Room as RoomData, RoomObject, Tier } from "@/lib/room3d/schema";
import { trimToBudget } from "@/lib/room3d/tiers";
import { EnvCtx, Halo, Kit, useEnv, type Env, type StageExtras } from "./kit-core";
import * as Decor from "./kit-decor";
import * as Stage from "./kit-stage";
import * as Work from "./kit-work";
import { mergeStatic, type MergeStats } from "./static-merge";
import { woodTexture } from "./textures";

type Interaction = NonNullable<RoomObject["interaction"]>;
type KindMap = { [K in KindId]: ComponentType<{ o: ObjectOf<K> }> };

/** One component per kind. A new kind needs a schema entry and a line here. */
export const KINDS: KindMap = {
  desk: Work.Desk,
  monitor: Work.Monitor,
  tablet: Work.Tablet,
  phone: Work.Phone,
  keyboard: Work.Keyboard,
  mouse: Work.Mouse,
  headset: Work.Headset,
  lamp: Work.Lamp,
  pcTower: Work.PcTower,
  chair: Work.Chair,
  speaker: Work.Speaker,
  tv: Work.Tv,
  console: Work.Console,
  clock: Work.Clock,
  shelf: Decor.Shelf,
  bookStack: Decor.BookStack,
  plant: Decor.Plant,
  bed: Decor.Bed,
  wardrobe: Decor.Wardrobe,
  frame: Decor.Frame,
  window: Decor.Window,
  door: Decor.Door,
  rug: Decor.Rug,
  neonStrip: Decor.NeonStrip,
  guitar: Decor.Guitar,
  midiKeyboard: Decor.MidiKeyboard,
  capRow: Decor.CapRow,
  keyRack: Decor.KeyRack,
  bag: Decor.Bag,
  ridingSet: Decor.RidingSet,
  box: Decor.Box,
  cylinder: Decor.Cylinder,
  sphere: Decor.Sphere,
  projectShelf: Stage.ProjectShelf,
  constellation: Stage.Constellation,
  board: Decor.Board,
};

export type RoomProps = {
  room: RoomData;
  tier: Tier;
  bandId: keyof RoomData["lighting"];
  accent: string;
  phone: boolean;
  /** Preview mode: draft objects are drawn too. */
  includeDraft?: boolean;
  reduced: boolean;
  hoverId: string | null;
  openIds: ReadonlySet<string>;
  consoleOn: boolean;
  worlds: Array<{ label: string; color: string }>;
  clockOffsetMs: number;
  /** The Stage's project cases and stars (see `StageExtras`). */
  stage?: StageExtras;
  /** The Stage's live terminal texture, for a monitor whose screen is `terminal`. */
  liveScreen?: THREE.Texture | null;
  /** Content boards by object id (see `Env.boards`). */
  boards?: Record<string, THREE.Texture>;
  /** Merge the parts that never move into a few meshes (default on); the Stage's draw-call cap depends on it. */
  merge?: boolean;
  onMerged?: (s: MergeStats) => void;
  onHover: (id: string | null, label: string | null) => void;
  onRun: (i: Interaction, o: RoomObject, e?: ThreeEvent<MouseEvent>) => void;
};

function Placed({ o, onHover, onRun }: { o: RoomObject; onHover: RoomProps["onHover"]; onRun: RoomProps["onRun"] }) {
  const Kind = KINDS[o.kind] as ComponentType<{ o: RoomObject }>;
  const env = useEnv();
  const it = o.interaction;
  const handlers = it
    ? {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
          onHover(o.id, it.label);
        },
        onPointerOut: () => {
          document.body.style.cursor = "";
          onHover(null, null);
        },
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onRun(it, o, e);
        },
      }
    : {};
  const { pos, rotY, scale } = o.transform;
  return (
    <group name={o.id} position={pos} rotation={[0, rotY, 0]} scale={scale} {...handlers}>
      <Kind o={o} />
      {env.hoverId === o.id && o.interaction && o.kind !== "door" ? <Halo position={[0, 0.12, 0.08]} size={[0.45, 0.45]} color={env.accent} opacity={0.4} /> : null}
    </group>
  );
}

/** The sun comes through the first window: outside it, along the wall's inward normal, a little above and aside. */
function sunPosition(room: RoomData): [number, number, number] {
  const w = room.objects.find((o) => o.kind === "window");
  if (!w) return [3, 5, -4];
  const [x, , z] = w.transform.pos;
  const nx = Math.sin(w.transform.rotY);
  const nz = Math.cos(w.transform.rotY);
  return [x - nx * 5 + nz * 1.5, 3.4, z - nz * 5 - nx * 1.5];
}

type Light = RoomData["lighting"]["day"];

/**
 * The lightformer environment. Memoised on plain values: drei re-bakes the cube map whenever its children change
 * identity, and a parent that re-renders often (the Stage does) must not cost a bake each time.
 */
const Sky = memo(function Sky({ light, bandId, textureSize, W, D }: { light: Light; bandId: string; textureSize: number; W: number; D: number }) {
  return (
    <Environment frames={1} resolution={textureSize >= 512 ? 256 : 128} environmentIntensity={0.8 + light.ambient.intensity * 0.6} key={light.key.color + bandId + textureSize}>
      <Lightformer form="rect" intensity={Math.max(0.2, light.windowLight.intensity * 4)} color={light.windowLight.color} position={[2, 2, -D]} scale={[3, 2.2, 1]} />
      <Lightformer form="ring" intensity={0.8 + light.key.intensity * 1.4} color={light.key.color} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={3} />
      <Lightformer form="rect" intensity={2.4 * light.emissiveBoost} color="#ff3da0" position={[-W, 1.5, 0]} rotation-y={Math.PI / 2} scale={[3, 1.2, 1]} />
      <Lightformer form="rect" intensity={1.6 * light.emissiveBoost} color="#2fd0ff" position={[W, 1, 2]} rotation-y={-Math.PI / 2} scale={[3, 1.2, 1]} />
    </Environment>
  );
});

/** Accumulated floor shadows (or one contact shadow on a phone) and the desk's own; memoised so a re-render never restarts a bake. */
const Shadows = memo(function Shadows({ aoOn, big, W, D, deskX, deskZ, deskH, deskW, deskD }: { aoOn: boolean; big: boolean; W: number; D: number; deskX?: number; deskZ?: number; deskH?: number; deskW?: number; deskD?: number }) {
  const scale = Math.max(W, D) * 1.6;
  const [dx, dh, dz, dw, dd] = [deskX ?? 0, deskH ?? 0, deskZ ?? 0, deskW ?? 0, deskD ?? 0];
  const has = deskX !== undefined;
  const deskPos = useMemo<[number, number, number]>(() => [dx, dh + 0.025, dz], [dx, dh, dz]);
  const deskScale = useMemo<[number, number]>(() => [dw, dd], [dw, dd]);
  return (
    <>
      {aoOn ? (
        <AccumulativeShadows temporal frames={big ? 70 : 40} alphaTest={0.9} scale={scale} position={FLOOR_AT} color="#06060c" opacity={0.85} resolution={big ? 1024 : 512}>
          <RandomizedLight amount={8} radius={3.5} ambient={0.55} intensity={1} position={LIGHT_AT} bias={0.001} />
        </AccumulativeShadows>
      ) : (
        <ContactShadows frames={1} position={FLOOR_AT} scale={scale} blur={2.4} opacity={0.6} far={2.2} resolution={256} />
      )}
      {has ? <ContactShadows frames={1} position={deskPos} scale={deskScale} blur={1.6} opacity={0.5} far={0.6} resolution={256} /> : null}
    </>
  );
});
const FLOOR_AT: [number, number, number] = [0, 0.02, 0];
const LIGHT_AT: [number, number, number] = [2.2, 5, 1.5];

export function Room(props: RoomProps) {
  const { room, tier, bandId, accent, phone, includeDraft = false } = props;
  const light = room.lighting[bandId] ?? room.lighting.day;
  const kit = useMemo(() => new Kit(tier.textureSize), [tier.textureSize]);
  useEffect(() => () => kit.dispose(), [kit]);
  const objects = useMemo(() => trimToBudget(room.objects, tier.objectBudget, { phone, includeDraft }), [room.objects, tier.objectBudget, phone, includeDraft]);
  const env = useMemo<Env>(
    () => ({ kit, light, accent, phone, tier, hoverId: props.hoverId, openIds: props.openIds, consoleOn: props.consoleOn, reduced: props.reduced, worlds: props.worlds, clockOffsetMs: props.clockOffsetMs, stage: props.stage, liveScreen: props.liveScreen, boards: props.boards }),
    [kit, light, accent, phone, tier, props.hoverId, props.openIds, props.consoleOn, props.reduced, props.worlds, props.clockOffsetMs, props.stage, props.liveScreen, props.boards],
  );
  const { width: W, depth: D, height: H } = room.shell;
  const floorTex = useMemo(() => {
    const t = woodTexture(tier.textureSize, "#d8c3a0", [W / 1.8, D / 1.8]);
    return t;
  }, [tier.textureSize, W, D]);
  useEffect(() => () => floorTex.dispose(), [floorTex]);
  const sun = useMemo(() => sunPosition(room), [room]);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const l = sunRef.current;
    if (!l) return;
    l.target.position.set(0, 0, 0);
    l.target.updateMatrixWorld();
  }, [sun]);
  // Merge what never moves into a few meshes, once the objects are mounted (and again when their materials change).
  const root = useRef<THREE.Group>(null);
  const { merge = true } = props;
  const onMerged = useRef(props.onMerged);
  useEffect(() => {
    onMerged.current = props.onMerged;
  });
  useEffect(() => {
    const g = root.current;
    if (!g || !merge) return;
    const m = mergeStatic(g);
    onMerged.current?.(m.stats);
    return m.restore;
  }, [merge, objects, kit, bandId, accent, props.consoleOn, props.boards, room.shell, floorTex]);
  const desk = room.objects.find((o) => o.kind === "desk") as ObjectOf<"desk"> | undefined;
  const sunOn = light.windowLight.intensity > 0.1;
  return (
    <EnvCtx.Provider value={env}>
      <color attach="background" args={["#0a0c14"]} />
      <Sky light={light} bandId={bandId} textureSize={tier.textureSize} W={W} D={D} />
      <hemisphereLight args={[light.ambient.color, "#1a1410", 0.6 + light.ambient.intensity * 0.9]} />
      <directionalLight
        ref={sunRef}
        position={sun}
        color={light.key.color}
        intensity={sunOn ? 0.8 + light.windowLight.intensity * 2.2 : 0.35}
        castShadow={tier.shadowRes > 0}
        shadow-mapSize={[tier.shadowRes || 1, tier.shadowRes || 1]}
        shadow-camera-left={-W / 2}
        shadow-camera-right={W / 2}
        shadow-camera-top={W / 2}
        shadow-camera-bottom={-W / 2}
        shadow-camera-near={1}
        shadow-camera-far={18}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <group ref={root}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={room.shell.floorMaterial === "wood" ? floorTex : null} color={room.shell.floorColor} roughness={0.5} metalness={0.02} envMapIntensity={0.7} />
      </mesh>
      {[
        { p: [0, H / 2, -D / 2] as const, r: 0, w: W },
        { p: [-W / 2, H / 2, 0] as const, r: Math.PI / 2, w: D },
        { p: [W / 2, H / 2, 0] as const, r: -Math.PI / 2, w: D },
        { p: [0, H / 2, D / 2] as const, r: Math.PI, w: W },
      ].map((s, i) => (
        <mesh key={i} position={s.p} rotation={[0, s.r, 0]} receiveShadow material={kit.mat("plaster", room.shell.wallColor, 0.92)}>
          <planeGeometry args={[s.w, H]} />
        </mesh>
      ))}
      {objects.map((o) => (
        <Placed key={o.id} o={o} onHover={props.onHover} onRun={props.onRun} />
      ))}
      </group>
      <Shadows aoOn={tier.aoOn} big={tier.shadowRes >= 2048} W={W} D={D} deskX={desk?.transform.pos[0]} deskZ={desk?.transform.pos[2]} deskH={desk?.params.h} deskW={desk?.params.w} deskD={desk?.params.d} />
    </EnvCtx.Provider>
  );
}
