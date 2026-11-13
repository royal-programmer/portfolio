/**
 * Never a white screen (18-3d-room-plan.md section 2): a value that fails validation falls back to the last
 * good room, then to the default room. Unknown image hosts or assets are the kit's concern, not this one's.
 */
import { ROOM3D_DEFAULT } from "./defaults";
import { room3dSchema, type Room3d } from "./schema";

export type Resolved = { value: Room3d; source: "given" | "last-good" | "default"; error?: string };

export function resolveRoom3d(raw: unknown, lastGood: Room3d | null = null): Resolved {
  const r = room3dSchema.safeParse(raw);
  if (r.success) return { value: r.data, source: "given" };
  const error = r.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  return lastGood ? { value: lastGood, source: "last-good", error } : { value: ROOM3D_DEFAULT, source: "default", error };
}
