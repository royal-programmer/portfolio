"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: uniforms and transforms are mutated
   every frame inside useFrame, never during render. */

/**
 * The light (D38):
 *  - ApproachLight: one point far ahead that comes at you, growing until it
 *    fills the view. A hint of colour creeps into its rim just before impact.
 *  - Cone: after impact the white splits into a cone of colour that opens
 *    upward from just below you. Streaks flow up its walls.
 *  - Photons: specks of colour rising along the cone.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SPECTRUM_GLSL } from "@/lib/site/spectrum";
import { useVr } from "./clock";
import { SOFT_POINT_FRAGMENT, WORLD, coneRadius, easeIn, seeded } from "./util";

// ---------------------------------------------------------------------------
// Approaching light
// ---------------------------------------------------------------------------
const lightVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const lightFragment = /* glsl */ `
${SPECTRUM_GLSL}
uniform float uTime;
uniform float uIntensity;
uniform float uChroma;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float r = length(p);
  float a = atan(p.y, p.x);
  float core = exp(-pow(r / 0.16, 2.0));
  float halo = exp(-r * 4.5) * 0.32;
  float rays = pow(0.5 + 0.5 * sin(a * 7.0 + uTime * 0.25), 6.0) * pow(0.5 + 0.5 * sin(a * 13.0 - uTime * 0.17), 4.0) * exp(-r * 2.4) * 0.55;
  vec3 col = vec3(1.0, 0.985, 0.95) * (core + halo + rays);
  // Just before it reaches you, the rim begins to split.
  float rim = exp(-pow((r - 0.26) * 9.0, 2.0));
  col += spectrum(fract(a / 6.2832 + uTime * 0.03)) * rim * 0.22 * uChroma;
  float alpha = (core + halo + rays) * uIntensity;
  gl_FragColor = vec4(col * uIntensity, alpha);
}
`;

export function ApproachLight() {
  const { clock, state } = useVr();
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: lightVertex,
        fragmentShader: lightFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uChroma: { value: 0 } },
      }),
    [],
  );
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m) return;
    const k = clock.current;
    const s = state.current;
    const shown = s.phase === "sky" || s.phase === "approach" || s.phase === "impact";
    m.visible = shown && k.sky > 0.01;
    if (!m.visible) return;
    const p = k.approach;
    // A far point that grows until it fills the view (distance 60 → scale ≈ 260 covers it).
    const scale = 1.3 + 265 * Math.pow(p, 3.2);
    m.scale.setScalar(scale);
    m.position.copy(WORLD.lightFrom);
    m.quaternion.copy(camera.quaternion);
    const pulse = 0.85 + 0.15 * Math.sin(k.t * 1.3);
    material.uniforms.uTime.value = k.t;
    material.uniforms.uIntensity.value = (0.9 + 1.6 * p) * pulse * k.sky;
    material.uniforms.uChroma.value = easeIn((p - 0.6) / 0.4);
  });

  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

// ---------------------------------------------------------------------------
// Cone of colour
// ---------------------------------------------------------------------------
const coneVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const coneFragment = /* glsl */ `
${SPECTRUM_GLSL}
uniform float uTime;
uniform float uOpen;    // 0…1 how far up the split has reached
uniform float uAlpha;
uniform float uShift;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  float u = vUv.x;
  float h = 1.0 - vUv.y;      // 0 at the apex (below you), 1 at the top (cone uv.y is 1 at the apex)
  float reach = uOpen * 1.05;
  float mask = smoothstep(reach, reach - 0.12, h);
  if (mask <= 0.001) discard;
  vec3 col = spectrum(fract(u + uShift));
  // Brilliant where the light has just split (near the apex), thinning as it rises.
  float glow = exp(-h * 12.0) * 2.4 + exp(-h * 2.5) * 0.12 + 0.025;
  // Soft bands drifting up the wall — no grids, no hard lines.
  float s1 = pow(0.5 + 0.5 * sin(u * 6.2832 * 7.0 + h * 30.0 - uTime * 0.6), 3.0) * 0.5;
  float s2 = pow(0.5 + 0.5 * sin(u * 6.2832 * 3.0 - h * 18.0 - uTime * 0.35), 2.0) * 0.35;
  float head = exp(-pow((reach - h) * 18.0, 2.0)) * 2.5 * step(uOpen, 0.999);
  vec3 V = normalize(cameraPosition - vW);
  float facing = abs(dot(normalize(vN), V));
  float dens = mix(1.3, 0.6, facing);
  float a = (glow + (s1 + s2) * (0.5 + glow * 0.4) + head) * dens * mask * uAlpha;
  col = mix(col, spectrum(fract(u + uShift + 0.08)), s1);
  col = mix(col, vec3(1.0), head * 0.3 + exp(-h * 40.0) * 0.5);
  gl_FragColor = vec4(col * a, a);
}
`;

export function Cone() {
  const { clock } = useVr();
  const H = WORLD.coneHeight;
  const geometry = useMemo(() => {
    const g = new THREE.ConeGeometry(coneRadius(H), H, 128, 1, true);
    // Apex down at the origin of the group; uv.y → 0 at apex.
    g.rotateX(Math.PI);
    g.translate(0, H / 2, 0);
    return g;
  }, [H]);
  const mats = useMemo(() => {
    const make = (side: THREE.Side, alpha: number) =>
      new THREE.ShaderMaterial({
        vertexShader: coneVertex,
        fragmentShader: coneFragment,
        side,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uAlpha: { value: alpha }, uShift: { value: 0 } },
      });
    return [make(THREE.BackSide, 0.7), make(THREE.FrontSide, 0.14)];
  }, []);

  useFrame(() => {
    const k = clock.current;
    for (const m of mats) {
      m.uniforms.uTime.value = k.t;
      m.uniforms.uOpen.value = k.cone;
      m.uniforms.uShift.value = k.t * 0.004;
    }
  });

  // Two passes: the inside walls bright, the outside faint.
  return (
    <group position={WORLD.coneApex}>
      <mesh geometry={geometry} material={mats[0]} renderOrder={2} frustumCulled={false} />
      <mesh geometry={geometry} material={mats[1]} renderOrder={3} frustumCulled={false} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rays: the split itself — many beams of colour fanning up from the apex,
// filling the inside of the cone so the sky above you is made of light.
// ---------------------------------------------------------------------------
const rayVertex = /* glsl */ `
${SPECTRUM_GLSL}
attribute vec3 aDir;      // unit direction of this ray from the apex
attribute float aSeed;
attribute float aWidth;
uniform float uTime;
uniform float uOpen;
uniform float uLength;
uniform float uShift;
varying vec3 vColor;
varying float vAcross;
varying float vAlong;
varying float vFade;
void main() {
  // position.x = across (−0.5…0.5), position.y = along (0…1)
  float along = position.y;
  vec3 p = aDir * along * uLength;
  vec3 toCam = cameraPosition - (modelMatrix * vec4(p, 1.0)).xyz;
  vec3 side = normalize(cross(aDir, normalize(toCam)));
  float w = aWidth * (0.35 + along * 2.2);
  p += side * position.x * w;
  float az = atan(aDir.z, aDir.x) / 6.2832;
  vColor = spectrum(fract(az + uShift + aSeed * 0.04));
  vAcross = position.x * 2.0;
  vAlong = along;
  float reach = uOpen * 1.05;
  vFade = smoothstep(reach, reach - 0.1, along) * (0.6 + 0.4 * sin(uTime * (0.4 + aSeed) + aSeed * 50.0));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;
const rayFragment = /* glsl */ `
uniform float uTime;
varying vec3 vColor;
varying float vAcross;
varying float vAlong;
varying float vFade;
void main() {
  float across = pow(max(0.0, 1.0 - abs(vAcross)), 2.2);
  float along = exp(-vAlong * 2.6) * 1.6 + 0.08;
  float pulse = 0.75 + 0.25 * sin(vAlong * 40.0 - uTime * 2.2);
  float a = across * along * pulse * vFade;
  if (a < 0.002) discard;
  gl_FragColor = vec4(vColor * a, a);
}
`;

export function Rays({ count }: { count: number }) {
  const { clock } = useVr();
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(41);
    const base = new THREE.PlaneGeometry(1, 1, 1, 24).translate(0, 0.5, 0);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.getAttribute("position"));
    const dir = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const width = new Float32Array(count);
    const tanA = Math.tan(WORLD.coneHalfAngle);
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      // Fill the volume: more rays toward the wall, a few straight up.
      const r = Math.pow(rnd(), 0.6) * tanA;
      const v = new THREE.Vector3(Math.cos(a) * r, 1, Math.sin(a) * r).normalize();
      dir.set([v.x, v.y, v.z], i * 3);
      seed[i] = rnd();
      width[i] = 0.05 + Math.pow(rnd(), 2) * 0.5;
    }
    g.setAttribute("aDir", new THREE.InstancedBufferAttribute(dir, 3));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 1));
    g.setAttribute("aWidth", new THREE.InstancedBufferAttribute(width, 1));
    g.instanceCount = count;
    const m = new THREE.ShaderMaterial({
      vertexShader: rayVertex,
      fragmentShader: rayFragment,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uLength: { value: WORLD.coneHeight * 0.9 }, uShift: { value: 0 } },
    });
    return { geometry: g, material: m };
  }, [count]);

  useFrame(() => {
    const k = clock.current;
    material.uniforms.uTime.value = k.t;
    material.uniforms.uOpen.value = k.cone;
    material.uniforms.uShift.value = k.t * 0.004;
  });

  return <mesh geometry={geometry} material={material} position={WORLD.coneApex} frustumCulled={false} renderOrder={3} />;
}

// ---------------------------------------------------------------------------
// Photons rising along the cone
// ---------------------------------------------------------------------------
const photonVertex = /* glsl */ `
${SPECTRUM_GLSL}
attribute float aAngle;
attribute float aSeed;
uniform float uTime;
uniform float uPx;
uniform float uOpen;
uniform float uHeight;
uniform float uTan;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float speed = mix(0.012, 0.05, aSeed);
  float hf = fract(aSeed * 3.7 + uTime * speed);
  float reach = uOpen * 1.05;
  float h = hf * uHeight;
  float r = h * uTan * mix(0.86, 1.0, fract(aSeed * 9.1));
  vec3 p = vec3(cos(aAngle) * r, h, sin(aAngle) * r);
  float shown = smoothstep(reach, reach - 0.1, hf);
  vColor = mix(spectrum(fract(aAngle / 6.2832 + 0.75)), vec3(1.0), 0.15);
  vAlpha = shown * (0.35 + 0.65 * aSeed) * smoothstep(0.0, 0.05, hf) * smoothstep(1.0, 0.7, hf);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPx * mix(1.0, 2.6, aSeed) / max(-mv.z, 0.2);
  gl_Position = projectionMatrix * mv;
}
`;

export function Photons({ count, px }: { count: number; px: number }) {
  const { clock } = useVr();
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(23);
    const ang = new Float32Array(count);
    const seed = new Float32Array(count);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      ang[i] = rnd() * Math.PI * 2;
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aAngle", new THREE.BufferAttribute(ang, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: photonVertex,
      fragmentShader: SOFT_POINT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPx: { value: px },
        uOpen: { value: 0 },
        uHeight: { value: WORLD.coneHeight },
        uTan: { value: Math.tan(WORLD.coneHalfAngle) },
      },
    });
    return { geometry: g, material: m };
  }, [count, px]);

  useFrame(() => {
    const k = clock.current;
    material.uniforms.uTime.value = k.t;
    material.uniforms.uOpen.value = k.cone;
  });

  return <points geometry={geometry} material={material} position={WORLD.coneApex} frustumCulled={false} renderOrder={4} />;
}
