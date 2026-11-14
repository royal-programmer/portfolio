"use client";

/**
 * Room kit, the Stage's two own kinds: the project shelf and the skill constellation. Their data is not in the room
 * (projects come from the content layer, stars from the terminal's stack), so the page passes it through the `stage`
 * extras of `<Room>`; a room drawn without extras (the lab viewer) shows nothing for them. Both reuse the Stage's own
 * components (`stage/shelf.tsx`, `stage/constellation.tsx`), which were built in the hub's units: the wrappers move
 * each one's middle to the object's origin, and the object's `scale` turns hub units into metres.
 */
import type { KindId, ObjectOf } from "@/lib/room3d/schema";
import { StageConstellation } from "../stage/constellation";
import { StageShelf } from "../stage/shelf";
import { useEnv } from "./kit-core";

type P<K extends KindId> = { o: ObjectOf<K> };

/** The shelf's middle in the hub's frame (x 0.3, behind the desk); the planks start at y 1.58. */
const SHELF_MIDDLE: [number, number, number] = [0.3, 0, -1.55];
/** The cap's middle: the centre of the stars' bounds for a typical stack (see `CAP` in stage-constellation.ts). */
const SKY_MIDDLE: [number, number, number] = [0.45, 3.47, -1.1];

export function ProjectShelf({ o }: P<"projectShelf">) {
  const st = useEnv().stage;
  if (!st || st.cases.length === 0) return null;
  const items = st.cases.slice(0, o.params.max);
  return (
    <group position={[-SHELF_MIDDLE[0], -SHELF_MIDDLE[1], -SHELF_MIDDLE[2]]}>
      <StageShelf items={items} accent={st.accent} focusId={st.caseFocus} openId={st.openId} onOpen={st.onOpenCase} reduced={st.reduced} onPick={st.onPickCase} />
    </group>
  );
}

export function Constellation({ o }: P<"constellation">) {
  const st = useEnv().stage;
  if (!st || !st.constellation) return null;
  void o;
  return (
    <group position={[-SKY_MIDDLE[0], -SKY_MIDDLE[1], -SKY_MIDDLE[2]]}>
      <StageConstellation data={st.constellation} accent={st.accent} active={st.starsActive} reduced={st.reduced} story={st.story} onRun={st.onRunCommand} />
    </group>
  );
}
