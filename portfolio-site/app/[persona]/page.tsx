import type { Metadata } from "next";
import {
  getPersona,
  isLaunchedPersona,
  LAUNCHED_PERSONAS,
  type LaunchedPersona,
} from "@/lib/content";
import { HomePage } from "../components/home-page";
import { loadHomeContent } from "../load-home-content";
import { InvalidPersonaView } from "./invalid-persona-view";

type PersonaPageProps = {
  params: Promise<{ persona: string }>;
};

export function generateStaticParams() {
  return LAUNCHED_PERSONAS.map((persona) => ({ persona }));
}

export async function generateMetadata({ params }: PersonaPageProps): Promise<Metadata> {
  const { persona } = await params;
  if (!isLaunchedPersona(persona)) {
    return {
      title: "Persona not found | Ratul Roy",
      description: "That persona mode isn’t available on this site.",
      robots: { index: false, follow: false },
    };
  }

  const record = await getPersona(persona);
  if (!record) {
    return {
      title: `${persona} | Ratul Roy`,
      description: "Multi-persona portfolio.",
    };
  }

  return {
    title: `${record.label} | Ratul Roy`,
    description: record.body,
  };
}

export default async function PersonaPage({ params }: PersonaPageProps) {
  const { persona } = await params;

  if (!isLaunchedPersona(persona)) {
    return <InvalidPersonaView attempted={persona} />;
  }

  const { personas, engineerEntries, engineerBlogPosts } = await loadHomeContent();
  const launched = persona as LaunchedPersona;
  return (
    <HomePage
      routePersona={launched}
      personas={personas}
      engineerEntries={engineerEntries}
      engineerBlogPosts={engineerBlogPosts}
    />
  );
}
