"use client";

/**
 * Room kit, part 1 (workstation kinds): desk, monitor, tablet, phone, keyboard, mouse, headset, lamp, PC tower,
 * chair, speaker, TV, console, wall clock. Each reads its object's `params` and `material`, builds in metres with
 * the origin at the centre of its base facing +z, and takes shared materials and geometry from the kit.
 */
import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { KindId, ObjectOf } from "@/lib/room3d/schema";
import { fitLive, flipTexX, Halo, Inst, useEnv, useImageTexture, useMat, type Env } from "./kit-core";
import { clockFaceTexture, homeScreenTexture, screenTexture } from "./textures";

type P<K extends KindId> = { o: ObjectOf<K> };
const IN = 0.0254;
const STEEL = { preset: "metal", color: "#14151a", roughness: 0.35 } as const;

/** A screen texture for a source, cached per look in the kit. */
function useScreen(env: Env, source: "terminal" | "code" | "console" | "image" | "projects", accent: string, portrait: boolean, flipX: boolean): THREE.Texture {
  const key = `screen:${source}:${accent}:${portrait}:${flipX}:${source === "console" ? env.consoleOn : ""}`;
  return env.kit.tex(key, () => {
    const t = source === "console" ? homeScreenTexture(env.worlds, portrait ? 288 : 512, portrait ? 512 : 288) : screenTexture(portrait ? 256 : 512, portrait ? 384 : 256, accent);
    if (flipX) {
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.x = -1;
      t.offset.x = 1;
    }
    return t;
  });
}

const accentFor = (env: Env, id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 3 === 0 ? env.accent : ["#c792ea", "#89ddff", "#c3e88d", "#ffcb6b", "#f78c6c"][h % 5];
};

export function Desk({ o }: P<"desk">) {
  const { w, h, d, shape } = o.params;
  const top = useMat(o.material);
  const leg = useMat({ preset: "metal", color: "#1a1c23", roughness: 0.45 });
  const wing = shape === "l";
  return (
    <group>
      <RoundedBox args={[w, 0.04, d]} radius={0.012} smoothness={3} position={[0, h, 0]} castShadow receiveShadow material={top} />
      {[-1, 1].map((s) => (
        <RoundedBox key={s} args={[0.04, h - 0.02, d - 0.06]} radius={0.01} smoothness={2} position={[s * (w / 2 - 0.03), (h - 0.02) / 2, 0]} castShadow receiveShadow material={leg} />
      ))}
      <mesh position={[0, h * 0.75, -d / 2 + 0.03]} castShadow material={leg}>
        <boxGeometry args={[w - 0.1, h * 0.27, 0.012]} />
      </mesh>
      {wing ? (
        <group position={[w / 2 - 0.3, 0, d / 2 + 0.45]}>
          <RoundedBox args={[0.6, 0.04, 0.9]} radius={0.012} smoothness={3} position={[0, h, 0]} castShadow receiveShadow material={top} />
          <RoundedBox args={[0.04, h - 0.02, 0.84]} radius={0.01} smoothness={2} position={[0.28, (h - 0.02) / 2, 0]} castShadow material={leg} />
        </group>
      ) : null}
    </group>
  );
}

export function Monitor({ o }: P<"monitor">) {
  const env = useEnv();
  const { form, inches, aspect, curveRadius: R, tilt, lift, screen, stand } = o.params;
  const diag = inches * IN;
  const h = diag / Math.sqrt(1 + aspect * aspect);
  const w = aspect * h;
  const portrait = aspect < 1;
  const accent = accentFor(env, o.id);
  const tex = useScreen(env, screen === "image" || screen === "projects" ? "code" : screen, accent, portrait, form === "curved");
  const img = useImageTexture(screen === "image" ? o.params.image : undefined, o.params.image?.alt ?? "", aspect);
  // The projects carousel is drawn by the page from the content layer; without it the screen shows the code look.
  const board = screen === "projects" ? env.boards?.[o.id] ?? null : null;
  useEffect(() => {
    if (board && form === "curved") flipTexX(board);
  }, [board, form]);
  const body = useMat(o.material);
  const steel = useMat(STEEL);
  const live = screen === "terminal" ? env.liveScreen ?? null : null;
  useEffect(() => {
    if (live) fitLive(live, aspect, form === "curved");
  }, [live, aspect, form]);
  const map = live ?? board ?? (screen === "image" && img.state !== "none" ? img.tex : tex);
  const glow = env.light.emissiveBoost;
  const th = w / R;
  const screenMat = useMemo(() => new THREE.MeshBasicMaterial({ map, toneMapped: false, color: new THREE.Color("#ffffff").multiplyScalar(1.1 * glow), side: form === "curved" ? THREE.BackSide : THREE.FrontSide }), [map, glow, form]);
  useEffect(() => () => screenMat.dispose(), [screenMat]);
  return (
    <group>
      {stand ? (
        <>
          <RoundedBox args={[0.3, 0.012, 0.2]} radius={0.005} smoothness={2} position={[0, 0.006, 0.02]} castShadow material={steel} />
          <mesh position={[0, lift / 2, -0.035]} castShadow material={steel}>
            <boxGeometry args={[0.05, lift, 0.025]} />
          </mesh>
        </>
      ) : null}
      <group position={[0, lift, -0.05]} rotation={[tilt, 0, 0]}>
        {form === "curved" ? (
          <group position={[0, 0, R]}>
            <mesh userData={{ noShadow: true }} material={screenMat}>
              <cylinderGeometry args={[R, R, h, 48, 1, true, Math.PI - th / 2, th]} />
            </mesh>
            <mesh castShadow material={body}>
              <cylinderGeometry args={[R + 0.004, R + 0.004, h + 0.03, 48, 1, true, Math.PI - th / 2 - 0.012, th + 0.024]} />
            </mesh>
            <mesh castShadow material={body}>
              <cylinderGeometry args={[R + 0.035, R + 0.035, h + 0.03, 48, 1, true, Math.PI - th / 2 - 0.012, th + 0.024]} />
            </mesh>
          </group>
        ) : (
          <group>
            <RoundedBox args={[w + 0.02, h + 0.02, 0.025]} radius={0.008} smoothness={3} castShadow material={body} />
            <mesh position={[0, 0, 0.0135]} userData={{ noShadow: true }} material={screenMat}>
              <planeGeometry args={[w, h]} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

function Slab({ w, h, t, source, accent, material }: { w: number; h: number; t: number; source: "terminal" | "code" | "console" | "image" | "projects"; accent: string; material: THREE.Material }) {
  const env = useEnv();
  const tex = useScreen(env, source === "image" || source === "projects" ? "code" : source, accent, h > w, false);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color("#ffffff").multiplyScalar(1.05 * env.light.emissiveBoost) }), [tex, env.light.emissiveBoost]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group>
      <RoundedBox args={[w, h, t]} radius={Math.min(0.012, t * 0.8)} smoothness={3} castShadow material={material} />
      <mesh position={[0, 0, t / 2 + 0.0008]} userData={{ noShadow: true }} material={mat}>
        <planeGeometry args={[w - 0.02, h - 0.02]} />
      </mesh>
    </group>
  );
}

export function Tablet({ o }: P<"tablet">) {
  const env = useEnv();
  const { inches, tilt, dock, screen } = o.params;
  const diag = inches * IN;
  const h = diag / Math.sqrt(1 + 1.45 * 1.45);
  const w = 1.45 * h;
  const body = useMat(o.material);
  const steel = useMat(STEEL);
  return (
    <group>
      {dock ? <RoundedBox args={[w * 0.45, 0.05, 0.08]} radius={0.01} smoothness={2} position={[0, 0.025, 0]} castShadow material={steel} /> : null}
      <group position={[0, 0.05 + h / 2 * Math.cos(tilt), 0.01]} rotation={[-tilt, 0, 0]}>
        <Slab w={w} h={h} t={0.008} source={screen} accent={accentFor(env, o.id)} material={body} />
      </group>
    </group>
  );
}

export function Phone({ o }: P<"phone">) {
  const env = useEnv();
  const { inches, tilt, stand, screen } = o.params;
  const diag = inches * IN;
  const h = diag / Math.sqrt(1 + 0.46 * 0.46);
  const w = 0.46 * h;
  const body = useMat(o.material);
  const steel = useMat(STEEL);
  return (
    <group>
      {stand ? <RoundedBox args={[w * 0.9, 0.05, 0.05]} radius={0.01} smoothness={2} position={[0, 0.025, 0]} castShadow material={steel} /> : null}
      <group position={[0, 0.05 + h / 2 * Math.cos(tilt), 0.01]} rotation={[-tilt, 0, 0]}>
        <Slab w={w} h={h} t={0.008} source={screen} accent={accentFor(env, o.id)} material={body} />
      </group>
    </group>
  );
}

export function Keyboard({ o }: P<"keyboard">) {
  const env = useEnv();
  const { keys, rgb } = o.params;
  const cols = keys === "full" ? 17 : keys === "tkl" ? 14 : 12;
  const rows = 5;
  const w = cols * 0.0295 + 0.04;
  const base = useMat(o.material);
  const capMat = env.kit.mat("plastic", "#ffffff", 0.55);
  const capGeo = env.kit.geo("keycap", () => new THREE.BoxGeometry(0.026, 0.012, 0.026));
  const accent = env.accent;
  const fill = useCallback(
    (i: number, p: THREE.Object3D, c: THREE.Color) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      p.position.set(-w / 2 + 0.03 + col * 0.0295, 0.011, -0.06 + row * 0.0295);
      c.set(col === cols - 1 || row === 0 ? accent : "#1b1d26");
    },
    [cols, w, accent],
  );
  return (
    <group>
      <RoundedBox args={[w, 0.018, 0.17]} radius={0.007} smoothness={3} position={[0, 0.009, 0]} castShadow receiveShadow material={base} />
      <group position={[0, 0.009, 0]}>
        <Inst count={cols * rows} geometry={capGeo} material={capMat} fill={fill} />
      </group>
      {rgb ? (
        <mesh position={[0, 0.0015, 0]} userData={{ noShadow: true }} material={env.kit.glow(accent, 3 * env.light.emissiveBoost)}>
          <boxGeometry args={[w + 0.01, 0.004, 0.18]} />
        </mesh>
      ) : null}
    </group>
  );
}

export function Mouse({ o }: P<"mouse"> ) {
  const env = useEnv();
  const body = useMat(o.material);
  const matMat = useMat({ preset: "fabric", color: "#1b1e2a", roughness: 1 });
  return (
    <group>
      {o.params.mat ? <RoundedBox args={[0.34, 0.004, 0.22]} radius={0.002} smoothness={2} position={[-0.02, 0.002, 0.01]} receiveShadow material={matMat} /> : null}
      <RoundedBox args={[0.06, 0.03, 0.1]} radius={0.02} smoothness={4} position={[0, 0.019, 0]} castShadow material={body} />
      {o.params.rgb ? <mesh position={[0, 0.006, 0]} userData={{ noShadow: true }} material={env.kit.glow(env.accent, 3)}><boxGeometry args={[0.05, 0.004, 0.09]} /></mesh> : null}
    </group>
  );
}

export function Headset({ o }: P<"headset">) {
  const body = useMat(o.material);
  const steel = useMat(STEEL);
  return (
    <group>
      {o.params.stand ? (
        <>
          <mesh position={[0, 0.01, 0]} castShadow material={steel}>
            <cylinderGeometry args={[0.06, 0.07, 0.02, 20]} />
          </mesh>
          <mesh position={[0, 0.13, 0]} castShadow material={steel}>
            <cylinderGeometry args={[0.008, 0.008, 0.22, 8]} />
          </mesh>
        </>
      ) : null}
      <group position={[0, o.params.stand ? 0.28 : 0.1, 0]}>
        <mesh rotation={[0, 0, 0]} castShadow material={body}>
          <torusGeometry args={[0.085, 0.01, 8, 24, Math.PI]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.085, -0.01, 0]} rotation={[0, 0, Math.PI / 2]} castShadow material={body}>
            <cylinderGeometry args={[0.04, 0.04, 0.035, 16]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function Lamp({ o }: P<"lamp">) {
  const env = useEnv();
  const { form, height, on } = o.params;
  const lit = on && env.light.lampOn;
  const metal = env.kit.mat("metal", "#222530", 0.35);
  const shade = useMat(o.material);
  const s = height / 0.5;
  return (
    <group scale={form === "floor" ? [1, 1, 1] : [s, s, s]}>
      <mesh position={[0, 0.01, 0]} castShadow material={metal}>
        <cylinderGeometry args={[0.07, 0.08, 0.02, 24]} />
      </mesh>
      {form === "floor" ? (
        <mesh position={[0, height / 2, 0]} castShadow material={metal}>
          <cylinderGeometry args={[0.012, 0.012, height, 8]} />
        </mesh>
      ) : (
        <>
          <mesh position={[0, 0.17, 0]} rotation={[0, 0, 0.18]} castShadow material={metal}>
            <cylinderGeometry args={[0.008, 0.008, 0.34, 8]} />
          </mesh>
          <mesh position={[-0.04, 0.33, 0]} rotation={[0, 0, -1.0]} castShadow material={metal}>
            <cylinderGeometry args={[0.008, 0.008, 0.26, 8]} />
          </mesh>
        </>
      )}
      <group position={form === "floor" ? [0, height, 0] : [-0.17, 0.4, 0]} rotation={[0, 0, form === "floor" ? 0 : 0.5]}>
        <mesh castShadow material={shade}>
          <cylinderGeometry args={[0.03, 0.09, 0.12, 24, 1, true]} />
        </mesh>
        <mesh position={[0, -0.03, 0]} userData={{ noShadow: true }} material={lit ? env.kit.glow("#ffd9a0", 4) : env.kit.mat("plastic", "#5a5448", 0.5)}>
          <sphereGeometry args={[0.028, 16, 12]} />
        </mesh>
        {lit ? <pointLight position={[0, -0.12, 0]} color="#ffbf70" intensity={2.2} distance={3.5} decay={2} /> : null}
      </group>
      {lit ? <Halo position={[form === "floor" ? 0 : -0.17, form === "floor" ? height : 0.36, 0.02]} size={[0.55, 0.55]} color="#ffb060" opacity={0.35} /> : null}
    </group>
  );
}

export function PcTower({ o }: P<"pcTower">) {
  const env = useEnv();
  const { h, glass, rgb, fans } = o.params;
  const w = h * 0.45;
  const d = h * 0.85;
  const body = useMat(o.material);
  const pane = env.kit.mat("glass", "#9fb4ff", 0.05);
  const boost = env.light.emissiveBoost;
  return (
    <group>
      <RoundedBox args={[w, h, d]} radius={0.012} smoothness={3} position={[0, h / 2, 0]} castShadow receiveShadow material={body} />
      {glass ? (
        <mesh position={[w / 2 + 0.002, h / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={pane}>
          <planeGeometry args={[d - 0.03, h - 0.03]} />
        </mesh>
      ) : null}
      {Array.from({ length: fans }, (_, i) => {
        const hue = (i / Math.max(1, fans)) * 0.8;
        const col = new THREE.Color().setHSL(hue, 0.9, 0.6).getStyle();
        return (
          <mesh key={i} position={[w / 2 - 0.02, h * (0.2 + (0.6 * (i + 0.5)) / fans), d / 2 - 0.05]} rotation={[0, Math.PI / 2, 0]} userData={{ noShadow: true }} material={rgb ? env.kit.glow(col, 2.2 * boost) : env.kit.mat("plastic", "#222530", 0.5)}>
            <ringGeometry args={[h * 0.07, h * 0.1, 24]} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Chair({ o }: P<"chair">) {
  const { style } = o.params;
  const fabric = useMat(o.material);
  const steel = useMat(STEEL);
  const wheel = useMat({ preset: "rubber", color: "#0b0b0e", roughness: 0.6 });
  const seatY = style === "stool" ? 0.62 : 0.5;
  const env = useEnv();
  const accent = env.accent;
  return (
    <group>
      <RoundedBox args={[0.5, 0.09, 0.48]} radius={0.04} smoothness={4} position={[0, seatY, 0]} castShadow receiveShadow material={fabric} />
      {style !== "stool" ? (
        <RoundedBox args={[0.46, style === "gaming" ? 0.75 : 0.55, 0.08]} radius={0.04} smoothness={4} position={[0, seatY + (style === "gaming" ? 0.42 : 0.35), -0.24]} rotation={[0.12, 0, 0]} castShadow receiveShadow material={fabric} />
      ) : null}
      {style === "gaming" ? <mesh position={[0, seatY + 0.5, -0.285]} rotation={[0.12, 0, 0]} material={env.kit.glow(accent, 1.4)}><boxGeometry args={[0.05, 0.5, 0.004]} /></mesh> : null}
      <mesh position={[0, seatY / 2 + 0.03, 0]} castShadow material={steel}>
        <cylinderGeometry args={[0.025, 0.03, seatY - 0.1, 12]} />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} rotation={[0, (i * Math.PI * 2) / 5, 0]}>
          <mesh position={[0.15, 0.07, 0]} castShadow material={steel}>
            <boxGeometry args={[0.3, 0.025, 0.04]} />
          </mesh>
          <mesh position={[0.29, 0.035, 0]} castShadow material={wheel}>
            <sphereGeometry args={[0.035, 12, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Speaker({ o }: P<"speaker">) {
  const { h } = o.params;
  const body = useMat(o.material);
  const cone = useMat({ preset: "rubber", color: "#0b0b0e", roughness: 0.7 });
  return (
    <group>
      <RoundedBox args={[h * 0.6, h, h * 0.6]} radius={0.01} smoothness={3} position={[0, h / 2, 0]} castShadow receiveShadow material={body} />
      {[0.3, 0.72].map((y, i) => (
        <mesh key={i} position={[0, h * y, h * 0.3 + 0.001]} rotation={[Math.PI / 2, 0, 0]} material={cone}>
          <circleGeometry args={[h * (i ? 0.1 : 0.16), 20]} />
        </mesh>
      ))}
    </group>
  );
}

/** The console's home tiles are the worlds; the TV shows them once any console has been clicked on. */
export function Tv({ o }: P<"tv">) {
  const env = useEnv();
  const { inches, lift, mode, image } = o.params;
  const diag = inches * IN;
  const h = diag / Math.sqrt(1 + (16 / 9) ** 2);
  const w = (16 / 9) * h;
  const body = useMat(o.material);
  const steel = useMat(STEEL);
  const reel = mode === "reel" ? env.boards?.[o.id] ?? null : null;
  const home = !reel && (mode === "home" || mode === "reel" || env.consoleOn);
  const img = useImageTexture(!home && !reel ? image : undefined, image?.alt ?? "", 16 / 9);
  const homeTex = useScreen(env, "console", env.accent, false, false);
  const idle = useScreen(env, "code", env.accent, false, false);
  const map = reel ?? (home ? homeTex : image && img.state !== "none" ? img.tex : idle);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map, toneMapped: false, color: new THREE.Color("#ffffff").multiplyScalar(home || reel ? 1.15 : 0.55) }), [map, home, reel]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <group>
      <RoundedBox args={[w + 0.03, h + 0.03, 0.04]} radius={0.01} smoothness={3} position={[0, lift + h / 2, 0]} castShadow material={body} />
      <mesh position={[0, lift + h / 2, 0.0215]} userData={{ noShadow: true }} material={mat}>
        <planeGeometry args={[w, h]} />
      </mesh>
      {lift > 0.3 ? null : (
        <RoundedBox args={[w * 0.35, 0.02, 0.2]} radius={0.005} smoothness={2} position={[0, lift - 0.02, -0.02]} castShadow material={steel} />
      )}
    </group>
  );
}

export function Console({ o }: P<"console">) {
  const env = useEnv();
  const body = useMat(o.material);
  const pad = useMat({ preset: "plastic", color: "#e8e8ee", roughness: 0.4 });
  return (
    <group>
      <RoundedBox args={[0.1, 0.38, 0.26]} radius={0.02} smoothness={3} position={[0, 0.19, 0]} castShadow receiveShadow material={body} />
      <mesh position={[0.052, 0.19, 0]} userData={{ noShadow: true }} material={env.kit.glow(env.consoleOn ? "#4f8cff" : "#222530", env.consoleOn ? 2.5 : 1)}>
        <boxGeometry args={[0.004, 0.34, 0.012]} />
      </mesh>
      {Array.from({ length: o.params.controllers }, (_, i) => (
        <RoundedBox key={i} args={[0.15, 0.04, 0.1]} radius={0.02} smoothness={3} position={[0.25 + i * 0.18, 0.02, 0.15]} rotation={[0, 0.2 - i * 0.2, 0]} castShadow material={pad} />
      ))}
    </group>
  );
}

/** Time as the clock shows it: the device clock corrected by the server offset. */
/** Flags a texture for re-upload (a function, so the hook rules see no mutation of a hook value). */
function touch(t: THREE.Texture) {
  t.needsUpdate = true;
}
const pad2 = (n: number) => String(n).padStart(2, "0");
function zoneTime(ms: number, zone: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ms));
  } catch {
    const d = new Date(ms);
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
}

export function Clock({ o }: P<"clock">) {
  const env = useEnv();
  const { diameter, lift, ownerZone, digital } = o.params;
  const r = diameter / 2;
  const face = env.kit.tex("clockface", () => clockFaceTexture(256));
  const rim = useMat(o.material);
  const hand = env.kit.mat("plastic", "#1c1e26", 0.5);
  const sec = env.kit.glow("#ff3b3b", 1.6);
  const hHand = useRef<THREE.Group>(null);
  const mHand = useRef<THREE.Group>(null);
  const sHand = useRef<THREE.Group>(null);
  const textRef = useRef<THREE.MeshBasicMaterial>(null);
  const lastText = useRef("");
  const textTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => textTex.dispose(), [textTex]);
  useFrame(() => {
    const now = Date.now() + env.clockOffsetMs;
    const d = new Date(now);
    const s = d.getSeconds() + d.getMilliseconds() / 1000;
    const m = d.getMinutes() + s / 60;
    const hr = (d.getHours() % 12) + m / 60;
    if (sHand.current) sHand.current.rotation.z = -(env.reduced ? Math.floor(s) : s) * (Math.PI / 30);
    if (mHand.current) mHand.current.rotation.z = -m * (Math.PI / 30);
    if (hHand.current) hHand.current.rotation.z = -hr * (Math.PI / 6);
    if (digital) {
      const line = `${zoneTime(now, ownerZone)} IST  you ${zoneTime(now, Intl.DateTimeFormat().resolvedOptions().timeZone)}`;
      if (line !== lastText.current) {
        lastText.current = line;
        const g = (textTex.image as HTMLCanvasElement).getContext("2d")!;
        g.fillStyle = "#101116";
        g.fillRect(0, 0, 256, 64);
        g.fillStyle = "#ffcb6b";
        g.font = "600 22px monospace";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(line, 128, 32);
        touch(textTex);
        if (textRef.current) textRef.current.needsUpdate = true;
      }
    }
  });
  return (
    <group position={[0, lift, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.015]} castShadow material={rim}>
        <cylinderGeometry args={[r + 0.012, r + 0.012, 0.03, 32]} />
      </mesh>
      <mesh position={[0, 0, 0.0305]} userData={{ noShadow: true }}>
        <circleGeometry args={[r, 40]} />
        <meshBasicMaterial map={face} toneMapped={false} />
      </mesh>
      <group ref={hHand} position={[0, 0, 0.034]} userData={{ dynamic: true }}>
        <mesh position={[0, r * 0.25, 0]} material={hand}>
          <boxGeometry args={[0.012, r * 0.5, 0.002]} />
        </mesh>
      </group>
      <group ref={mHand} position={[0, 0, 0.036]} userData={{ dynamic: true }}>
        <mesh position={[0, r * 0.38, 0]} material={hand}>
          <boxGeometry args={[0.008, r * 0.76, 0.002]} />
        </mesh>
      </group>
      <group ref={sHand} position={[0, 0, 0.038]} userData={{ dynamic: true }}>
        <mesh position={[0, r * 0.4, 0]} material={sec}>
          <boxGeometry args={[0.004, r * 0.85, 0.002]} />
        </mesh>
      </group>
      {digital ? (
        <mesh position={[0, -r - 0.05, 0.02]} userData={{ noShadow: true }}>
          <planeGeometry args={[Math.max(0.3, diameter * 1.1), Math.max(0.3, diameter * 1.1) / 4]} />
          <meshBasicMaterial ref={textRef} map={textTex} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}
