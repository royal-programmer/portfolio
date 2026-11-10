import { getViews } from "@/lib/content/views";
import { terminalData, type TerminalData } from "@/lib/site/terminal-data";
import { loadHomeContent } from "./load-home-content";

/** The Engineer terminal's data, as the page builds it (server only): for the preview image and the share metadata. */
export async function loadEngineerTerminalData(): Promise<TerminalData> {
  const { personas, engineerEntries, engineerBlogPosts } = await loadHomeContent();
  return terminalData(personas.find((p) => p.slug === "engineer"), engineerEntries, engineerBlogPosts, getViews("engineer"));
}
