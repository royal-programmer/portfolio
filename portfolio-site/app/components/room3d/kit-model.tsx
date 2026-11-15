"use client";

/**
 * glTF models for objects (round 37d): an object with `model` draws that file (drei `useGLTF`, no Draco decoder, nothing
 * from a CDN) instead of its parametric shape, fitted to the height `lib/room3d/models.ts` gives, standing on its
 * origin. While the file loads, or if it fails, the parametric shape is drawn, so nothing pops empty.
 */
import { useGLTF } from "@react-three/drei";
import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { modelHeight, MODEL_KINDS } from "@/lib/room3d/models";
import type { RoomObject } from "@/lib/room3d/schema";

/** Fits a loaded scene: long axis up (a model lying along z is stood up), height to `h`, base on y = 0, centred on x and z. */
export function fitModel(scene: THREE.Object3D, h: number): THREE.Group {
  const clone = scene.clone(true);
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

function Loaded({ url, h, onReady }: { url: string; h: number; onReady: () => void }) {
  const { scene } = useGLTF(url, false);
  const obj = useMemo(() => fitModel(scene, h), [scene, h]);
  useEffect(() => {
    onReady();
  }, [onReady, obj]);
  return <primitive object={obj} />;
}

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
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
  return (
    <ModelBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <Loaded url={o.model} h={h} onReady={onReady} />
      </Suspense>
    </ModelBoundary>
  );
}

/** Starts loading every model of a room (the Suspense fallbacks show the primitives until they arrive). */
export function preloadModels(objects: readonly RoomObject[]) {
  for (const o of objects) if (o.model && MODEL_KINDS.includes(o.kind)) useGLTF.preload(o.model, false);
}
