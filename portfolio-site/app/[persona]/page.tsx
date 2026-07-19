import type { Metadata } from "next";
import {
  isLaunchedPersona,
  LAUNCHED_PERSONAS,
  type LaunchedPersona,
} from "@/lib/content/types";
import { HomePage } from "../components/home-page";
import { InvalidPersonaView } from "./invalid-persona-view";

type PersonaPageProps = {
  params: Promise<{ persona: string }>;
};

const PERSONA_META: Record<LaunchedPersona, { title: string; description: string }> = {
  engineer: {
    title: "Engineer Mode | Ratul Roy",
    description: "Fast, scalable web products with premium UX.",
  },
  trader: {
    title: "Trader Mode | Ratul Roy",
    description: "Setups, probabilities, and system-first execution.",
  },
  photographer: {
    title: "Photographer Mode | Ratul Roy",
    description: "Light, composition, and visual storytelling.",
  },
};

export function generateStaticParams() {
  return LAUNCHED_PERSONAS.map((persona) => ({ persona }));
}

export async function generateMetadata({ params }: PersonaPageProps): Promise<Metadata> {
  const { persona } = await params;
  if (isLaunchedPersona(persona)) {
    return PERSONA_META[persona];
  }
  return {
    title: "Persona not found | Ratul Roy",
    description: "That persona mode isn’t available on this site.",
    robots: { index: false, follow: false },
  };
}

export default async function PersonaPage({ params }: PersonaPageProps) {
  const { persona } = await params;

  if (isLaunchedPersona(persona)) {
    return <HomePage routePersona={persona} />;
  }

  // Keep the bad segment in the URL (no replace) so the mistake stays shareable/debuggable.
  return <InvalidPersonaView attempted={persona} />;
}
