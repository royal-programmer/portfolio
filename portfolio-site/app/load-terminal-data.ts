import { terminalData, type TerminalData } from "@/lib/site/terminal-data";
import { loadTerminalConfig } from "@/lib/settings/load";
import { loadHomeContent } from "./load-home-content";

/** The Engineer terminal's data, as the page builds it (server only): for the preview image and the share metadata. */
export async function loadEngineerTerminalData(): Promise<TerminalData> {
  const [{ personas, engineerEntries, engineerBlogPosts }, { cfg, views }] = await Promise.all([loadHomeContent(), loadTerminalConfig()]);
  return terminalData(personas.find((p) => p.slug === "engineer"), engineerEntries, engineerBlogPosts, views, cfg);
}
