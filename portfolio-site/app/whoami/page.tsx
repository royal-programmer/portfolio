import type { Metadata } from "next";
import { HomePage } from "../components/home-page";
import { loadHomeContent } from "../load-home-content";

export const metadata: Metadata = {
  title: "Who am I | Ratul Roy",
  description:
    "The unified, easter-egg view — switch between Engineer, Trader, and Photographer modes to know Ratul more.",
};

/**
 * Explicit route (takes precedence over `/[persona]`).
 * This is the "know me more" layer: persona switching, Konami, logo hold.
 */
export default async function WhoAmIPage() {
  const { personas, engineerEntries } = await loadHomeContent();
  return <HomePage personas={personas} engineerEntries={engineerEntries} />;
}
