/**
 * Page-level loaders: the settings a page needs, resolved once (live, or the admin's draft under a valid
 * preview cookie, or the code defaults). Server-only.
 */
import { getViews } from "@/lib/content/views";
import type { LaunchedPersona, PersonaView } from "@/lib/content/types";
import type { TerminalConfig } from "@/lib/site/terminal-data";
import { getSettingValues } from "./read";

const TERMINAL_KEYS = ["identity", "engineer.terminal", "engineer.resume", "engineer.i18n", "engineer.timeline", "engineer.arch", "engineer.themes", "engineer.views"] as const;

/** What `terminalData()` takes (each key independently falls back to the code), plus the enabled views. */
export async function loadTerminalConfig(): Promise<{ cfg: TerminalConfig; views: PersonaView[] }> {
  const s = await getSettingValues(TERMINAL_KEYS);
  const cfg: TerminalConfig = {
    identity: s.identity,
    terminal: s["engineer.terminal"],
    resume: s["engineer.resume"],
    i18n: s["engineer.i18n"],
    timeline: s["engineer.timeline"],
    arch: s["engineer.arch"],
    themes: s["engineer.themes"],
  };
  return { cfg, views: s["engineer.views"].views.filter((v) => v.enabled) };
}

/** A persona's enabled views: the Engineer's come from settings, the others from code. */
export async function loadViews(persona: LaunchedPersona): Promise<PersonaView[]> {
  if (persona !== "engineer") return getViews(persona);
  const { views } = await getSettingValues(["engineer.views"]).then((s) => s["engineer.views"]);
  return views.filter((v) => v.enabled);
}
