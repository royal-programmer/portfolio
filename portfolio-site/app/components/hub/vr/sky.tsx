"use client";
/* eslint-disable react-hooks/immutability -- R3F idiom: uniforms are mutated every frame
   inside useFrame, never during render. */

/**
 * The night sky: a dome with a faint band of haze (tinted by the spectrum
 * while you climb) and a field of twinkling stars. Always alive, never fast.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { SPECTRUM_GLSL } from "@/lib/site/spectrum";
import { useVr } from "./clock";
import { SOFT_POINT_FRAGMENT, seeded } from "./util";

const R = 380;

const domeVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const domeFragment = /* glsl */ `
${SPECTRUM_GLSL}
uniform float uSky;
uniform float uTint;
uniform float uTintAmount;
uniform float uTime;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  // Void with a breath of light near the horizon, and a soft band of haze.
  float horizon = exp(-pow(d.y * 4.0, 2.0)) * 0.035;
  float band = exp(-pow((d.y * 0.8 + d.x * 0.35 + 0.1) * 5.0, 2.0)) * 0.03 * (0.8 + 0.2 * sin(uTime * 0.05 + d.z * 3.0));
  vec3 col = vec3(0.012, 0.012, 0.018) + vec3(horizon) + vec3(0.9, 0.92, 1.0) * band;
  // The spectrum washes the sky while you climb through the cone.
  vec3 tint = spectrum(uTint) * uTintAmount * (0.05 + 0.11 * max(d.y, 0.0));
  col += tint;
  gl_FragColor = vec4(col * uSky, 1.0);
}
`;

export function Dome() {
  const { clock } = useVr();
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uSky: { value: 0 }, uTint: { value: 0.5 }, uTintAmount: { value: 0 }, uTime: { value: 0 } },
      }),
    [],
  );
  useFrame(() => {
    const k = clock.current;
    material.uniforms.uSky.value = k.sky;
    material.uniforms.uTint.value = k.tint;
    material.uniforms.uTintAmount.value = k.tintAmount;
    material.uniforms.uTime.value = k.t;
  });
  return <mesh material={material} renderOrder={-10} frustumCulled={false} geometry={useMemo(() => new THREE.SphereGeometry(R + 10, 48, 32), [])} />;
}

const starVertex = /* glsl */ `
attribute float aSize;
attribute float aSeed;
uniform float uTime;
uniform float uPx;
uniform float uSky;
uniform float uDim;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float tw = 0.65 + 0.35 * sin(uTime * (0.6 + aSeed * 1.8) + aSeed * 40.0);
  // Warm and cool stars, a few brighter.
  vColor = mix(vec3(1.0, 0.93, 0.85), vec3(0.82, 0.9, 1.0), aSeed);
  vAlpha = tw * uSky * uDim * (0.35 + 0.65 * aSize);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uPx * (0.9 + aSize * 1.9);
  gl_Position = projectionMatrix * mv;
}
`;

export function Stars({ count, px }: { count: number; px: number }) {
  const { clock } = useVr();
  const { geometry, material } = useMemo(() => {
    const rnd = seeded(11);
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Uniform on the sphere; a touch denser toward the band.
      const z = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      pos.set([Math.cos(a) * r * R, z * R, Math.sin(a) * r * R], i * 3);
      size[i] = Math.pow(rnd(), 3);
      seed[i] = rnd();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: SOFT_POINT_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPx: { value: px * 0.045 }, uSky: { value: 0 }, uDim: { value: 1 } },
    });
    return { geometry: g, material: m };
  }, [count, px]);

  useFrame(() => {
    const k = clock.current;
    material.uniforms.uTime.value = k.t;
    material.uniforms.uSky.value = k.sky;
    // The stars give way as the light grows, and come back as the climb settles.
    material.uniforms.uDim.value = 1 - Math.pow(k.approach, 3) * 0.85 * (1 - k.climb * 0.5);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={-9} />;
}
