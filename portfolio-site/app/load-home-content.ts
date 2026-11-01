import {
  listBlogPosts,
  listEntries,
  listPersonas,
  type BlogPost,
  type Entry,
  type Persona,
} from "@/lib/content";

export type HomeContentPayload = {
  personas: Persona[];
  engineerEntries: Entry[];
  engineerBlogPosts: BlogPost[];
};

/** Server-only loader for home / persona pages. */
export async function loadHomeContent(): Promise<HomeContentPayload> {
  const [personas, engineerEntries, engineerBlogPosts] = await Promise.all([
    listPersonas(),
    listEntries("engineer"),
    listBlogPosts("engineer"),
  ]);
  return { personas, engineerEntries, engineerBlogPosts };
}
