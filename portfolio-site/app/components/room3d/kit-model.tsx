"use client";

/**
 * glTF models for objects (round 37d): an object with `model` draws that file (drei `useGLTF`, no Draco decoder, nothing
 * from a CDN) instead of its parametric shape, fitted to the height `lib/room3d/models.ts` gives, standing on its
 * origin. While the file loads, or if it fails, the parametric shape is drawn, so nothing pops empty.
 */
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { modelHeight, MODEL_KINDS, MODEL_PARTS, MODEL_TINT } from "@/lib/room3d/models";
import type { RoomObject } from "@/lib/room3d/schema";
import { GuitarStand } from "./kit-dream";

/** The summed area of a geometry's triangles (in its own units): the biggest surface is the one that takes a tint. */
function surfaceArea(g: THREE.BufferGeometry): number {
  const p = g.getAttribute("position");
  const idx = g.index;
  const n = idx ? idx.count : p.count;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let sum = 0;
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, idx ? idx.getX(i) : i);
    b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1);
    c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2);
    sum += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return sum;
}

/** Fits a loaded scene: long axis up (a model lying along z is stood up), height to `h`, base on y = 0, centred on x and z. */
export function fitModel(scene: THREE.Object3D, h: number, tint?: string): THREE.Group {
  const clone = scene.clone(true);
  if (tint) {
    // The material with the biggest surface takes the colour; the cached file keeps its own (the material is cloned first).
    let big: THREE.Mesh | null = null;
    let bigArea = -1;
    clone.traverse((m) => {
      const mesh = m as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const area = surfaceArea(mesh.geometry);
      if (area > bigArea) {
        bigArea = area;
        big = mesh;
      }
    });
    const b = big as THREE.Mesh | null;
    if (b && !Array.isArray(b.material) && (b.material as THREE.MeshStandardMaterial).color) {
      const mat = (b.material as THREE.MeshStandardMaterial).clone();
      mat.color.set(tint);
      b.material = mat;
    }
  }
  clone.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  const wrap = new THREE.Group();
  wrap.add(clone);
  const size = new THREE.Box3().setFromObject(wrap).getSize(new THREE.Vector3());
  if (size.z > size.y * 1.6 && size.z >= size.x) clone.rotation.x = -Math.PI / 2;
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  const s = h / Math.max(1e-6, box.max.y - box.min.y);
  const c = box.getCenter(new THREE.Vector3());
  clone.position.set(-c.x, -box.min.y, -c.z);
  const outer = new THREE.Group();
  outer.add(wrap);
  wrap.position.set(0, 0, 0);
  outer.scale.setScalar(s);
  outer.userData.fitted = true;
  return outer;
}

function Loaded({ url, h, tint, onReady }: { url: string; h: number; tint?: string; onReady: () => void }) {
  const { scene } = useGLTF(url, false);
  const obj = useMemo(() => fitModel(scene, h, tint), [scene, h, tint]);
  useEffect(() => {
    onReady();
  }, [onReady, obj]);
  return <primitive object={obj} />;
}

export class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** The glTF of an object, or its parametric shape (`fallback`) while loading, on failure, and for kinds with no model slot. */
export function ModelOr({ o, fallback, onReady }: { o: RoomObject; fallback: ReactNode; onReady: () => void }) {
  const h = modelHeight(o);
  if (!o.model || h === null || !MODEL_KINDS.includes(o.kind)) return <>{fallback}</>;
  const loaded = <Loaded url={o.model} h={h} tint={MODEL_TINT.includes(o.kind) ? o.material.color : undefined} onReady={onReady} />;
  // A guitar model keeps the drawn stand (or hook): it leans back into the neck rest on a stand, hangs flat on a hook.
  const body =
    o.kind === "guitar" ? (
      <>
        <GuitarStand stand={o.params.stand} />
        <group position={o.params.stand ? [0, 0.02, 0.04] : [0, 1.0, 0.07]} rotation={[o.params.stand ? -0.14 : 0, 0, 0]}>
          {loaded}
        </group>
      </>
    ) : (
      loaded
    );
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{body}</Suspense>
    </ModelBoundary>
  );
}

/** Starts loading every model of a room (the Suspense fallbacks show the primitives until they arrive). */
export function preloadModels(objects: readonly RoomObject[]) {
  for (const o of objects) if (o.model && (MODEL_KINDS.includes(o.kind) || MODEL_PARTS.includes(o.kind))) useGLTF.preload(o.model, false);
}
