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

/**
 * Server-only loader for home / persona pages. Every persona has a page (the hub climbs through all
 * six), so the list includes unpublished ones; that read needs the server-only key, and without it
 * (or on a blip) the public list stands in.
 */
export async function loadHomeContent(): Promise<HomeContentPayload> {
  const [adminPersonas, engineerEntries, engineerBlogPosts] = await Promise.all([
    listPersonas({ includeNonPublic: true }),
    listEntries("engineer"),
    listBlogPosts("engineer"),
  ]);
  const personas = adminPersonas.length ? adminPersonas : await listPersonas();
  return { personas, engineerEntries, engineerBlogPosts };
}
