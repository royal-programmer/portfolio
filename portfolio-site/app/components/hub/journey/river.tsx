"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: GPU objects (materials, uniforms, the
   camera, the shared clock ref) are mutated every frame inside useFrame, never during render. */

/**
 * The spectrum as a landscape:
 *  - River: one continuous sheet of colour spreading from the prism to the
 *    horizon. Silky filaments, energy pulses flowing outward along each
 *    persona's stream, a gentle swell. Any number of personas fits.
 *  - Photons: particles of light always flowing down the streams — the scene
 *    is alive even when the visitor stops scrolling.
 *  - Dust: motes hanging in the air, lit by the beam and tinted by the river,
 *    pushed aside and brightened by the cursor.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SPECTRUM_GLSL } from "@/lib/site/spectrum";
import { useJourney } from "./clock";
import { BEAM_TOP, GEOMETRY_GLSL, HIT, MAX_BANDS, RIVER, sFromT, seeded } from "./geometry";
import { softPointFragment } from "./light";
import type { Band } from "./state";

const BANDS_GLSL = /* glsl */ `
uniform int uCount;
uniform float uBandS[${MAX_BANDS}];
uniform float uBandLit[${MAX_BANDS}];
uniform float uBandAct[${MAX_BANDS}];
`;

function bandUniforms() {
  return {
    uCount: { value: 0 },
    uBandS: { value: new Array(MAX_BANDS).fill(0) },
    uBandLit: { value: new Array(MAX_BANDS).fill(0) },
    uBandAct: { value: new Array(MAX_BANDS).fill(0) },
  };
}

function writeBands(u: Record<string, THREE.IUniform>, bands: Band[]) {
  bands.slice(0, MAX_BANDS).forEach((b, i) => {
    u.uBandS.value[i] = sFromT(b.t);
    u.uBandLit.value[i] = b.lit ? 1 : 0;
  });
  u.uCount.value = Math.min(bands.length, MAX_BANDS);
}

// ---------------------------------------------------------------------------
// River
// ---------------------------------------------------------------------------
const riverVertex = /* glsl */ `
${GEOMETRY_GLSL}
attribute float aS;
attribute float aR;
uniform float uTime;
uniform float uFold;
varying float vS;
varying float vR;
varying vec3 vW;
void main() {
  vS = aS;
  vR = aR;
  vec3 p = riverPoint(aS, aR, uFold);
  // A slow swell rolling outward — the light is a fluid, not a decal.
  p.y += sin(aR * 0.22 - uTime * 0.55 + aS * 5.0) * 0.06 * smoothstep(3.0, 14.0, aR);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const riverFragment = /* glsl */ `
${SPECTRUM_GLSL}
${GEOMETRY_GLSL}
${BANDS_GLSL}
uniform float uTime;
uniform float uReveal;
uniform float uFold;
uniform float uMore;
varying float vS;
varying float vR;
varying vec3 vW;

float hash(float n) { return fract(sin(n) * 43758.5453); }

void main() {
  float t = tFromS(vS);
  vec3 col = spectrum(t);

  // Fine silk filaments across the river (fade out where they'd shimmer).
  float fx = vS * 420.0 + sin(vR * 0.12 + uTime * 0.25) * 2.0;
  float fil = 0.7 + 0.3 * sin(fx);
  fil = mix(fil, 0.7, clamp(fwidth(fx) * 0.35, 0.0, 1.0));

  // Light is dense at the prism and thins with distance.
  float wash = 0.16 / (1.0 + vR * 0.04) + 1.4 * exp(-vR * 0.9);

  float streams = 0.0;
  for (int i = 0; i < ${MAX_BANDS}; i++) {
    if (i >= uCount) break;
    float lit = uBandLit[i];
    float d = vS - uBandS[i];
    float width = mix(0.0045, 0.0085, lit) * (1.0 + uBandAct[i] * 0.6);
    float k = exp(-(d * d) / (width * width));
    float halo = exp(-(d * d) / (width * width * 16.0)) * 0.18;
    float pulse = pow(0.5 + 0.5 * sin(vR * 0.7 - uTime * 2.4 + float(i) * 2.1), 6.0);
    float flicker = 0.18 + 0.14 * sin(uTime * 2.1 + float(i) * 1.7) + uMore * 0.9 * (0.6 + 0.4 * sin(uTime * 7.0 + float(i)));
    float strength = mix(flicker, 0.85 + uBandAct[i] * 1.6, lit);
    streams += (k * (0.75 + pulse * 0.9) + halo) * strength;
  }

  float edges = smoothstep(0.0, 0.05, vS) * smoothstep(1.0, 0.95, vS);
  float far = smoothstep(RIVER_LEN, RIVER_LEN * 0.55, vR);
  float reveal = smoothstep(uReveal * RIVER_LEN, uReveal * RIVER_LEN - 6.0, vR);
  float a = (wash * fil + streams) * edges * far * reveal;
  vec3 c = mix(col, vec3(1.0), uFold * 0.85);
  gl_FragColor = vec4(c * a * 1.5, a);
}
`;

export function River({ bands }: { bands: Band[] }) {
  const { clock } = useJourney();
  const geometry = useMemo(() => {
    const AS = 220;
    const RS = 110;
    const pos: number[] = [];
    const aS: number[] = [];
    const aR: number[] = [];
    const idx: number[] = [];
    for (let j = 0; j <= RS; j++) {
      const r = RIVER.length * Math.pow(j / RS, 1.7) + 0.02;
      for (let i = 0; i <= AS; i++) {
        pos.push(0, 0, 0);
        aS.push(i / AS);
        aR.push(r);
        if (i < AS && j < RS) {
          const a = j * (AS + 1) + i;
          const b = a + AS + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aS", new THREE.Float32BufferAttribute(aS, 1));
    g.setAttribute("aR", new THREE.Float32BufferAttribute(aR, 1));
    g.setIndex(idx);
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -40), 90);
    return g;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: riverVertex,
        fragmentShader: riverFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uFold: { value: 0 }, uMore: { value: 0 }, ...bandUniforms() },
      }),
    [],
  );
  useEffect(() => writeBands(material.uniforms, bands), [bands, material]);

  useFrame(() => {
    const k = clock.current;
    const u = material.uniforms;
    u.uTime.value = k.t;
    u.uReveal.value = k.reveal;
    u.uFold.value = k.fold;
    u.uMore.value = k.more;
    for (let i = 0; i < MAX_BANDS; i++) u.uBandAct.value[i] = k.act[i];
  });

  return <mesh geometry={geometry} material={material} renderOrder={0} />;
}

// ---------------------------------------------------------------------------
// Photons flowing along the streams
// ---------------------------------------------------------------------------
const photonVertex = /* glsl */ `
${SPECTRUM_GLSL}
${GEOMETRY_GLSL}
attribute float aS;
attribute float aSeed;
attribute float aLift;
uniform float uTime;
uniform float uReveal;
uniform float uFold;
uniform float uPx;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float speed = mix(0.012, 0.035, fract(aSeed * 13.7));
  float u = fract(aSeed + uTime * speed);
  float r = pow(u, 1.5) * RIVER_LEN;
  vec3 p = riverPoint(aS, r, uFold);
  p.y += 0.05 + aLift * smoothstep(1.0, 12.0, r);
  vColor = mix(spectrum(tFromS(aS)), vec3(1.0), uFold * 0.85 + 0.15);
  float reveal = smoothstep(uReveal * RIVER_LEN, uReveal * RIVER_LEN - 4.0, r);
  vAlpha = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.7, u) * reveal * (0.35 + 0.65 * fract(aSeed * 91.3));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uPx * mix(1.2, 3.2, fract(aSeed * 31.1)) / max(-mv.z, 0.1), 0.0, 48.0);
  gl_Position = projectionMatrix * mv;
}
`;

export function Photons({ bands, count, px }: { bands: Band[]; count: number; px: number }) {
  const { clock } = useJourney();
  const geometry = useMemo(() => {
    const lit = bands.filter((b) => b.lit);
    const rnd = seeded(11);
    const aS = new Float32Array(count);
    const seed = new Float32Array(count);
    const lift = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Two thirds ride a persona's stream, the rest drift across the river.
      if (lit.length && rnd() < 0.66) {
        const b = lit[i % lit.length];
        aS[i] = sFromT(b.t) + (rnd() + rnd() - 1) * 0.006;
      } else {
        aS[i] = 0.04 + rnd() * 0.92;
      }
      seed[i] = rnd();
      lift[i] = Math.pow(rnd(), 3) * 1.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aS", new THREE.BufferAttribute(aS, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aLift", new THREE.BufferAttribute(lift, 1));
    return g;
  }, [bands, count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: photonVertex,
        fragmentShader: softPointFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uFold: { value: 0 }, uPx: { value: px } },
      }),
    [px],
  );

  useFrame(() => {
    const k = clock.current;
    material.uniforms.uTime.value = k.t;
    material.uniforms.uReveal.value = k.reveal;
    material.uniforms.uFold.value = k.fold;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

// ---------------------------------------------------------------------------
// Dust in the air
// ---------------------------------------------------------------------------
const dustVertex = /* glsl */ `
${SPECTRUM_GLSL}
${GEOMETRY_GLSL}
attribute float aSeed;
uniform float uTime;
uniform float uPx;
uniform vec2 uPointer;
uniform float uAspect;
uniform float uLit;
uniform vec3 uBeamA;
uniform vec3 uBeamB;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 p = position;
  float s = aSeed * 6.2831;
  p += vec3(sin(uTime * 0.11 + s) * 0.6, sin(uTime * 0.07 + s * 1.7) * 0.4, cos(uTime * 0.09 + s * 2.3) * 0.6);

  // Light from the beam: distance to its axis.
  vec3 ab = uBeamB - uBeamA;
  float h = clamp(dot(p - uBeamA, ab) / dot(ab, ab), 0.0, 1.0);
  float dBeam = length(p - (uBeamA + ab * h));
  float beamLight = exp(-dBeam * 0.55) * 1.8 * uLit;

  // Tinted by the river below (in front of the prism exit only).
  float az = atan(p.x - EXIT_P.x, -(p.z - EXIT_P.z));
  float overRiver = step(p.z, EXIT_P.z) * smoothstep(RIVER_ANGLE, RIVER_ANGLE * 0.6, abs(az));
  vec3 tint = spectrum(clamp(tFromS(az / (2.0 * RIVER_ANGLE) + 0.5), 0.0, 1.0));
  vColor = mix(vec3(0.95, 0.95, 1.0), tint, overRiver * 0.75);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 clip = projectionMatrix * mv;
  // The cursor parts the dust and lights it up.
  vec2 ndc = clip.xy / clip.w;
  vec2 to = (ndc - uPointer) * vec2(uAspect, 1.0);
  float dc = length(to);
  float near = exp(-dc * dc / 0.018);
  clip.xy += normalize(to + 1e-5) / vec2(uAspect, 1.0) * near * 0.06 * clip.w;

  float depth = -mv.z;
  vAlpha = (0.12 + beamLight + overRiver * 0.35 * uLit + near * 1.2) * smoothstep(0.3, 2.0, depth) * smoothstep(60.0, 25.0, depth) * (0.4 + 0.6 * fract(aSeed * 17.3));
  gl_PointSize = clamp(uPx * mix(1.0, 2.6, fract(aSeed * 7.7)) * (1.0 + near) / max(depth, 0.1), 0.0, 40.0);
  gl_Position = clip;
}
`;

export function Dust({ count, px }: { count: number; px: number }) {
  const { clock, state } = useJourney();
  const size = useThree((s) => s.size);
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const rnd = seeded(23);
    for (let i = 0; i < count; i++) {
      // Denser near the beam and over the first stretch of the river.
      const nearBeam = i % 3 === 0;
      const x = nearBeam ? (rnd() * 2 - 1) * 4 : (rnd() * 2 - 1) * 22;
      const y = nearBeam ? rnd() * 16 - 1 : -2 + rnd() * 14;
      const z = nearBeam ? (rnd() * 2 - 1) * 5 + 2 : 14 - rnd() * 70;
      pos.set([x, y, z], i * 3);
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    return g;
  }, [count]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: dustVertex,
        fragmentShader: softPointFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uPx: { value: px },
          uPointer: { value: new THREE.Vector2(9, 9) },
          uAspect: { value: 1 },
          uLit: { value: 0 },
          uBeamA: { value: HIT.clone() },
          uBeamB: { value: BEAM_TOP.clone() },
        },
      }),
    [px],
  );

  useFrame(() => {
    const k = clock.current;
    const u = material.uniforms;
    u.uTime.value = k.t;
    u.uLit.value = k.intro < 0 ? 0 : Math.min(1, k.intro / 1.2);
    u.uAspect.value = size.width / Math.max(1, size.height);
    const p = u.uPointer.value as THREE.Vector2;
    const s = state.current;
    p.x += (s.px - p.x) * Math.min(1, k.dt * 10);
    p.y += (s.py - p.y) * Math.min(1, k.dt * 10);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}
