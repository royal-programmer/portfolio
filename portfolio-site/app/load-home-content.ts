import { listEntries, listPersonas, type Entry, type Persona } from "@/lib/content";

export type HomeContentPayload = {
  personas: Persona[];
  engineerEntries: Entry[];
};

/** Server-only loader for home / whoami / persona pages. */
export async function loadHomeContent(): Promise<HomeContentPayload> {
  const [personas, engineerEntries] = await Promise.all([
    listPersonas(),
    listEntries("engineer"),
  ]);
  return { personas, engineerEntries };
}
