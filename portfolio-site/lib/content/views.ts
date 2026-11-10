import type { LaunchedPersona, PersonaView } from "./types";

/**
 * The views each persona page offers (docs/claude-planning/17-persona-views.md). Code until the
 * admin console lands; then `site_settings` key `views.<persona>` with this shape. Only `enabled`
 * views are listed and routable. Order is the picker's order.
 */
export const PERSONA_VIEWS: Partial<Record<LaunchedPersona, readonly PersonaView[]>> = {
  engineer: [
    { id: "stage", name: "Stage", line: "The setup in 3D, the projects, the writing.", enabled: true },
    { id: "swarm", name: "Swarm", line: "Agents build the page in front of you.", enabled: false },
    { id: "netflix", name: "Netflix", line: "Pick a profile; the story plays like a series.", enabled: true },
  ],
};

export function getViews(persona: LaunchedPersona): PersonaView[] {
  return (PERSONA_VIEWS[persona] ?? []).filter((v) => v.enabled);
}

export function getView(persona: LaunchedPersona, id: string): PersonaView | null {
  return getViews(persona).find((v) => v.id === id) ?? null;
}
