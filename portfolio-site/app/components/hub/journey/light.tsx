"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: GPU objects (materials, uniforms, the
   camera, the shared clock ref) are mutated every frame inside useFrame, never during render. */

/**
 * The light source and the crystal:
 *  - Beam: a shaft of white light falling from the sky onto the prism, with a
 *    soft volumetric haze and energy pulses travelling down it.
 *  - Prism: custom glass shader — analytic refraction with per-channel IOR
 *    (real dispersion, no noisy transmission buffer), fresnel reflections and
 *    anti-aliased bright edges. Rendered back faces first, then front faces,
 *    so the camera can fly THROUGH it.
 *  - Impact: flash + spark burst when the light first strikes the glass.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { SPECTRUM_GLSL } from "@/lib/site/spectrum";
import { useJourney } from "./clock";
import { BEAM_TOP, EXIT, EXIT_LOCAL, HIT, HIT_LOCAL, PRISM, PRISM_YAW, ease, easeIn, seeded } from "./geometry";

/** Intro timeline (seconds after entering). */
export const INTRO = { beamFall: [0.15, 1.05] as const, impact: 1.05, spread: [1.1, 3.6] as const };

// ---------------------------------------------------------------------------
// Beam
// ---------------------------------------------------------------------------
const beamVertex = /* glsl */ `
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
const beamFragment = /* glsl */ `
uniform float uTime;
uniform float uReveal;   // 0…1 from the top down
uniform float uIntensity;
uniform float uSharp;
uniform float uPulse;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vW;
void main() {
  // uv.y = 1 at the top of the beam.
  float shown = smoothstep(1.0 - uReveal - 0.02, 1.0 - uReveal + 0.02, vUv.y);
  if (shown <= 0.001) discard;
  vec3 V = normalize(cameraPosition - vW);
  float facing = abs(dot(normalize(vN), V));
  float core = pow(facing, uSharp);
  float pulses = 1.0 + uPulse * pow(0.5 + 0.5 * sin(vUv.y * 140.0 + uTime * 9.0), 10.0);
  float fadeTop = smoothstep(1.0, 0.55, vUv.y);
  float a = core * uIntensity * pulses * shown * (0.25 + 0.75 * fadeTop);
  // The leading edge of the falling light burns brighter.
  float head = exp(-pow((vUv.y - (1.0 - uReveal)) * 30.0, 2.0)) * step(uReveal, 0.999);
  a += head * core * 3.0;
  gl_FragColor = vec4(vec3(1.0, 0.98, 0.95) * a, a);
}
`;

function beamMaterial(intensity: number, sharp: number, pulse: number) {
  return new THREE.ShaderMaterial({
    vertexShader: beamVertex,
    fragmentShader: beamFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uIntensity: { value: intensity },
      uSharp: { value: sharp },
      uPulse: { value: pulse },
    },
  });
}

export function Beam() {
  const { clock } = useJourney();
  const { length, quat, innerLen, innerQuat } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(BEAM_TOP, HIT);
    const inner = new THREE.Vector3().subVectors(EXIT, HIT);
    return {
      length: dir.length(),
      quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      innerLen: inner.length(),
      innerQuat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), inner.clone().normalize()),
    };
  }, []);
  const geo = useMemo(
    () => ({
      core: new THREE.CylinderGeometry(0.05, 0.05, length, 20, 1, true).translate(0, length / 2, 0),
      glow: new THREE.CylinderGeometry(0.4, 0.4, length, 24, 1, true).translate(0, length / 2, 0),
      haze: new THREE.CylinderGeometry(2.2, 1.1, length, 32, 1, true).translate(0, length / 2, 0),
      inner: new THREE.CylinderGeometry(0.035, 0.035, innerLen, 12, 1, true).translate(0, innerLen / 2, 0),
    }),
    [length, innerLen],
  );
  const mats = useMemo(
    () => ({
      core: beamMaterial(4.5, 1.5, 0.6),
      glow: beamMaterial(0.55, 4.0, 0.4),
      haze: beamMaterial(0.07, 2.0, 0.0),
      inner: beamMaterial(3.2, 1.2, 0.0),
    }),
    [],
  );

  useFrame(() => {
    const k = clock.current;
    const fall = k.intro < 0 ? 0 : easeIn((k.intro - INTRO.beamFall[0]) / (INTRO.beamFall[1] - INTRO.beamFall[0]));
    const inside = k.intro < 0 ? 0 : ease((k.intro - INTRO.impact) / 0.35);
    for (const m of [mats.core, mats.glow, mats.haze]) {
      m.uniforms.uTime.value = k.t;
      m.uniforms.uReveal.value = fall;
    }
    mats.inner.uniforms.uTime.value = k.t;
    mats.inner.uniforms.uReveal.value = inside;
  });

  return (
    <>
      <group position={HIT} quaternion={quat}>
        <mesh geometry={geo.haze} material={mats.haze} renderOrder={1} />
        <mesh geometry={geo.glow} material={mats.glow} renderOrder={1} />
        <mesh geometry={geo.core} material={mats.core} renderOrder={1} />
      </group>
      <group position={HIT} quaternion={innerQuat}>
        <mesh geometry={geo.inner} material={mats.inner} renderOrder={3} />
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// Prism
// ---------------------------------------------------------------------------
function buildPrismGeometry() {
  const L = PRISM.halfLength;
  // (x, z, y) helpers → THREE (x, y, z)
  const P = (x: number, v: THREE.Vector2) => new THREE.Vector3(x, v.y, v.x);
  const A = PRISM.apex;
  const F = PRISM.front;
  const B = PRISM.back;
  const pos: number[] = [];
  const nrm: number[] = [];
  const edge: number[] = [];
  const centre = new THREE.Vector3(0, (A.y + F.y + B.y) / 3, (A.x + F.x + B.x) / 3);

  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ea: number[], eb: number[], ec: number[]) => {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    const mid = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3);
    let verts = [a, b, c];
    let edges = [ea, eb, ec];
    if (n.dot(new THREE.Vector3().subVectors(mid, centre)) < 0) {
      n.negate();
      verts = [a, c, b];
      edges = [ea, ec, eb];
    }
    verts.forEach((v, i) => {
      pos.push(v.x, v.y, v.z);
      nrm.push(n.x, n.y, n.z);
      edge.push(...edges[i]);
    });
  };
  // A quad's edge coordinate is (u, 1−u, v, 1−v): its diagonal never glows.
  const quad = (p00: THREE.Vector3, p10: THREE.Vector3, p11: THREE.Vector3, p01: THREE.Vector3) => {
    const e00 = [0, 1, 0, 1];
    const e10 = [1, 0, 0, 1];
    const e11 = [1, 0, 1, 0];
    const e01 = [0, 1, 1, 0];
    pushTri(p00, p10, p11, e00, e10, e11);
    pushTri(p00, p11, p01, e00, e11, e01);
  };
  quad(P(-L, A), P(L, A), P(L, F), P(-L, F));
  quad(P(-L, A), P(L, A), P(L, B), P(-L, B));
  quad(P(-L, F), P(L, F), P(L, B), P(-L, B));
  for (const x of [-L, L]) pushTri(P(x, A), P(x, F), P(x, B), [1, 0, 0, 1], [0, 1, 0, 1], [0, 0, 1, 1]);

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("aEdge", new THREE.Float32BufferAttribute(edge, 4));
  return g;
}

const glassVertex = /* glsl */ `
attribute vec4 aEdge;
uniform vec3 uHit;
uniform vec3 uExit;
varying vec3 vN;
varying vec3 vW;
varying vec4 vEdge;
varying vec3 vHitW;
varying vec3 vExitW;
varying vec3 vCenterW;
void main() {
  vEdge = aEdge;
  vCenterW = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vHitW = (modelMatrix * vec4(uHit, 1.0)).xyz;
  vExitW = (modelMatrix * vec4(uExit, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const glassFragment = /* glsl */ `
${SPECTRUM_GLSL}
uniform float uTime;
uniform float uFlash;
uniform float uLit;      // 0 before the light arrives, 1 after impact
uniform float uBackPass;
varying vec3 vN;
varying vec3 vW;
varying vec4 vEdge;
varying vec3 vHitW;
varying vec3 vExitW;
varying vec3 vCenterW;

// What the glass "sees": the beam's light from above, the river of colour
// ahead and below, and a faint horizon. Analytic → crisp, noise-free.
vec3 env(vec3 d) {
  float sky = pow(max(d.y, 0.0), 10.0) * 2.2 * uLit;
  float az = atan(d.x, -d.z);
  float below = smoothstep(0.25, -0.35, d.y);
  float t = clamp(az / 1.9 + 0.5, 0.0, 1.0);
  vec3 river = spectrum(t) * below * smoothstep(1.35, 0.2, abs(az)) * 0.45 * uLit;
  float horizon = exp(-pow(d.y * 9.0, 2.0)) * 0.12;
  return vec3(sky) + river + vec3(horizon) + vec3(0.012, 0.013, 0.02);
}

void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vW);
  vec3 I = -V;
  float nv = clamp(dot(N, V), 0.0, 1.0);
  float fres = 0.04 + 0.96 * pow(1.0 - nv, 4.0);

  vec3 refr;
  refr.r = env(refract(I, N, 1.0 / 1.40)).r;
  refr.g = env(refract(I, N, 1.0 / 1.46)).g;
  refr.b = env(refract(I, N, 1.0 / 1.53)).b;
  vec3 refl = env(reflect(I, N));

  // Anti-aliased edges from the per-face edge coordinate.
  float e = min(min(vEdge.x, vEdge.y), min(vEdge.z, vEdge.w));
  float w = fwidth(e);
  float edge = 1.0 - smoothstep(w * 0.5, w * 1.8 + 0.006, e);
  float edgeSoft = exp(-e * 22.0);

  // Mostly clear: the glass shows itself through reflections, edges and the
  // light inside it — not a tinted fill.
  vec3 col = refr * 0.14 + refl * fres * 0.9;
  col += vec3(0.95, 0.97, 1.0) * (edge * (1.1 + uFlash * 3.0) + edgeSoft * 0.12);

  // The light's path inside the glass (back pass only, so it isn't doubled).
  if (uBackPass > 0.5) {
    vec3 O = cameraPosition;
    vec3 D = normalize(vW - cameraPosition);
    vec3 S = vExitW - vHitW;
    vec3 w0 = O - vHitW;
    float b = dot(D, S);
    float c = dot(S, S);
    float d = dot(D, w0);
    float ee = dot(S, w0);
    float den = max(c - b * b, 1e-4);
    float u = clamp((ee - b * d) / den, 0.0, 1.0);
    vec3 q = vHitW + u * S;
    float s = max(dot(q - O, D), 0.0);
    float dist = length(O + s * D - q);
    float glow = exp(-dist * dist / 0.0016) * 1.6 + exp(-dist * 9.0) * 0.35;
    // White at entry, splitting toward colour as it reaches the exit face.
    vec3 lc = mix(vec3(1.0), spectrum(fract(u * 0.9 + 0.05 + uTime * 0.02)), smoothstep(0.35, 1.0, u) * 0.7);
    col += lc * glow * uLit;
  }

  col *= 1.0 + uFlash * 1.5;
  float alpha = clamp(0.06 + fres * 0.4 + edge * 0.8, 0.0, 1.0);
  // Flying through: the walls thin out so the view stays clear, not murky.
  float insideK = 1.0 - smoothstep(0.7, 1.6, length(cameraPosition - vCenterW));
  col *= 1.0 - insideK * 0.55;
  alpha *= 1.0 - insideK * 0.7;
  // Premultiplied: what's behind is dimmed by alpha, our light is added.
  gl_FragColor = vec4(col, alpha);
}
`;

function glassMaterial(back: boolean) {
  return new THREE.ShaderMaterial({
    vertexShader: glassVertex,
    fragmentShader: glassFragment,
    transparent: true,
    depthWrite: false,
    side: back ? THREE.BackSide : THREE.FrontSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uTime: { value: 0 },
      uFlash: { value: 0 },
      uLit: { value: 0 },
      uBackPass: { value: back ? 1 : 0 },
      uHit: { value: HIT_LOCAL.clone() },
      uExit: { value: EXIT_LOCAL.clone() },
    },
  });
}

export function Prism() {
  const { clock } = useJourney();
  const group = useRef<THREE.Group>(null);
  const geometry = useMemo(() => buildPrismGeometry(), []);
  const back = useMemo(() => glassMaterial(true), []);
  const front = useMemo(() => glassMaterial(false), []);

  useFrame(() => {
    const k = clock.current;
    const since = k.intro - INTRO.impact;
    const flash = k.intro < 0 || since < 0 ? 0 : Math.exp(-since * 2.6);
    const lit = k.intro < 0 ? 0 : ease(since / 0.4);
    for (const m of [back, front]) {
      m.uniforms.uTime.value = k.t;
      m.uniforms.uFlash.value = flash;
      m.uniforms.uLit.value = lit;
    }
    if (group.current) {
      // A slow, weightless drift — the crystal is alive, not spinning.
      group.current.rotation.y = PRISM_YAW + Math.sin(k.t * 0.21) * 0.05;
      group.current.rotation.z = Math.sin(k.t * 0.17) * 0.02;
      group.current.position.y = Math.sin(k.t * 0.5) * 0.04;
    }
  });

  return (
    <group ref={group} rotation-y={PRISM_YAW}>
      <mesh geometry={geometry} material={back} renderOrder={2} />
      <mesh geometry={geometry} material={front} renderOrder={4} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Impact: flash sprite + spark burst
// ---------------------------------------------------------------------------
const sparkVertex = /* glsl */ `
${SPECTRUM_GLSL}
attribute vec3 aDir;
attribute float aSeed;
uniform float uAge;
uniform float uPx;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float age = max(uAge, 0.0);
  float speed = mix(1.5, 6.0, aSeed);
  vec3 p = position + aDir * speed * (1.0 - exp(-age * 2.2)) / 2.2;
  p.y -= age * age * 0.35;
  vColor = mix(vec3(1.0), spectrum(fract(aSeed * 7.31)), smoothstep(0.1, 0.8, age));
  vAlpha = (uAge < 0.0) ? 0.0 : exp(-age * 1.3) * (0.4 + 0.6 * aSeed);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uPx * mix(2.0, 5.0, aSeed) / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;
const softPointFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  a *= a * vAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(vColor * a * 2.0, a);
}
`;
export { softPointFragment };

export function Impact({ px }: { px: number }) {
  const { clock } = useJourney();
  const { geometry, material } = useMemo(() => {
    const N = 420;
    const rnd = seeded(7);
    const pos = new Float32Array(N * 3);
    const dir = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos.set([HIT.x, HIT.y, HIT.z], i * 3);
      // Mostly outward from the struck face (+z, up), a few into the glass.
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 1.2 - 0.2, rnd() * 1.4 - 0.2).normalize();
      dir.set([v.x, v.y, v.z], i * 3);
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aDir", new THREE.BufferAttribute(dir, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: sparkVertex,
      fragmentShader: softPointFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uAge: { value: -1 }, uPx: { value: px } },
    });
    return { geometry: g, material: m };
  }, [px]);

  useFrame(() => {
    const k = clock.current;
    material.uniforms.uAge.value = k.intro < 0 ? -1 : k.intro - INTRO.impact;
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}
