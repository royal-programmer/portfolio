/**
 * Draw-call cut for the room kit (18-3d-room-plan.md section 5, under 120 on desktop): once the room is mounted,
 * every mesh that never moves is baked into world space and merged with the others that share its material (and its
 * shadow flags) into one mesh, so a room of 300 small parts is a few dozen draws, and the shadow pass draws the same
 * few dozen again instead of 300. The originals stay in the scene, hidden: events and the tree still work, and
 * `restore` brings them back.
 *
 * Left alone: instanced meshes (already one draw), skinned meshes, anything with several materials or a
 * transparent one (draw order matters), meshes with pointer handlers, a mesh marked `userData.keep`, anything
 * inside a group marked `userData.dynamic` (a door's leaf, a clock's hands), mirrored transforms, and materials
 * used by only one mesh (nothing to merge). A caster smaller than `TINY_CASTER` metres across stops casting, so the
 * shadow pass does not draw crumbs.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** A caster whose bounding sphere is smaller than this (world radius, metres) does not cast a shadow. */
export const TINY_CASTER = 0.03;

export type MergeStats = { meshesBefore: number; meshesAfter: number; merged: number };
export type Merged = { stats: MergeStats; restore: () => void };

type Cand = { mesh: THREE.Mesh; cast: boolean; key: string };

function movable(o: THREE.Object3D, root: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p && p !== root.parent; p = p.parent) {
    if (!p.visible || p.userData.dynamic || p.userData.keep) return true;
  }
  return false;
}

const handlers = (m: THREE.Mesh): number => ((m as unknown as { __r3f?: { eventCount?: number } }).__r3f?.eventCount ?? 0);

export function mergeStatic(root: THREE.Object3D): Merged {
  root.updateWorldMatrix(true, true);
  const cands: Cand[] = [];
  let meshes = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (m.visible) meshes++;
    if ((m as THREE.InstancedMesh).isInstancedMesh || (m as THREE.SkinnedMesh).isSkinnedMesh) return;
    const mat = m.material as THREE.Material | THREE.Material[];
    if (Array.isArray(mat) || !mat || mat.transparent || m.renderOrder !== 0 || handlers(m) > 0) return;
    if (!m.geometry?.getAttribute("position") || movable(m, root)) return;
    if (m.matrixWorld.determinant() <= 0) return;
    const g = m.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const s = m.matrixWorld.getMaxScaleOnAxis();
    const cast = m.castShadow && (g.boundingSphere?.radius ?? 0) * s >= TINY_CASTER;
    cands.push({ mesh: m, cast, key: `${mat.uuid}|${cast ? 1 : 0}|${m.receiveShadow ? 1 : 0}` });
  });
  const groups = new Map<string, Cand[]>();
  for (const c of cands) (groups.get(c.key) ?? groups.set(c.key, []).get(c.key)!).push(c);

  const holder = new THREE.Group();
  holder.name = "static-merge";
  holder.userData.keep = true;
  const made: THREE.Mesh[] = [];
  const hidden: THREE.Mesh[] = [];
  const tinyOff: THREE.Mesh[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) {
      // Not merged, but a crumb still stops casting.
      for (const c of list) if (c.mesh.castShadow && !c.cast) tinyOff.push(c.mesh);
      continue;
    }
    const parts: THREE.BufferGeometry[] = [];
    let indexed = true;
    for (const c of list) {
      const g = c.mesh.geometry.clone();
      g.applyMatrix4(c.mesh.matrixWorld);
      for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal" && name !== "uv") g.deleteAttribute(name);
      if (!g.getAttribute("normal")) g.computeVertexNormals();
      if (!g.getAttribute("uv")) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
      g.clearGroups();
      if (!g.index) indexed = false;
      parts.push(g);
    }
    const geos = indexed ? parts : parts.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(geos, false);
    for (const g of parts) g.dispose();
    if (geos !== parts) for (const g of geos) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const first = list[0].mesh;
    const mesh = new THREE.Mesh(merged, first.material as THREE.Material);
    mesh.castShadow = list[0].cast;
    mesh.receiveShadow = first.receiveShadow;
    mesh.matrixAutoUpdate = false;
    mesh.raycast = () => {};
    made.push(mesh);
    holder.add(mesh);
    for (const c of list) {
      c.mesh.visible = false;
      hidden.push(c.mesh);
    }
  }
  for (const m of tinyOff) m.castShadow = false;
  root.add(holder);
  return {
    stats: { meshesBefore: meshes, meshesAfter: meshes - hidden.length + made.length, merged: hidden.length },
    restore: () => {
      for (const m of hidden) m.visible = true;
      root.remove(holder);
      for (const m of made) m.geometry.dispose();
    },
  };
}
