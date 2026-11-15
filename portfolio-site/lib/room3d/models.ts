/**
 * glTF models for objects (round 37d). An object with `model: "/models/x.glb"` draws that file instead of its parametric
 * shape, scaled so its height is the number below (the model's own size never decides). Pure, no three.js: the page and
 * `scripts/room3d-check.mjs` share it. Objects with size parameters (bed, wardrobe, caps) keep their parametric shapes.
 */
import type { RoomObject } from "./schema";

/** The height (metres, before the object's own `scale`) a model of this object is fitted to, or null when the kind has no model slot. */
export function modelHeight(o: RoomObject): number | null {
  switch (o.kind) {
    case "plant":
      return o.params.height;
    case "chair":
      return o.params.style === "gaming" ? 1.25 : o.params.style === "stool" ? 0.65 : 1.0;
    case "guitar":
      return 1.05;
    case "football":
      return o.params.r * 2;
    case "puzzleCube":
      return o.params.size;
    case "lamp":
      return o.params.height;
    default:
      return null;
  }
}

/** Kinds whose `model` is honoured. */
export const MODEL_KINDS: ReadonlyArray<RoomObject["kind"]> = ["plant", "chair", "guitar", "football", "puzzleCube", "lamp"];

/** Kinds whose `model` is a part the kit uses itself (a closet's plush toy), not a replacement for the whole shape. */
export const MODEL_PARTS: ReadonlyArray<RoomObject["kind"]> = ["closet"];

/**
 * Kinds whose model is recoloured from the object's own material colour (so the owner can change it in the admin): the model's biggest
 * material (the body of a guitar, the cushions of a chair) takes the colour; its other materials keep theirs.
 */
export const MODEL_TINT: ReadonlyArray<RoomObject["kind"]> = ["guitar", "chair"];
