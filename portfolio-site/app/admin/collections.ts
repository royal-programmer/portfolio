/**
 * The content collections per persona, as one constant: the admin's master-detail screen, the nav and
 * the persona home all read it, so another persona or a later collection needs no new UI code.
 * Pure (client-safe). `fields` drive the editor form; their keys are the form's field names.
 */
export type CollectionField = {
  key: string;
  label: string;
  type: "text" | "long" | "url" | "chips" | "visibility" | "check";
  required?: boolean;
  placeholder?: string;
  hint?: string;
};

export type Collection = {
  id: string;
  label: string;
  singular: string;
  /** `entries`: rows in the `entries` table. `media`: the media pipeline. `constants`: still a code constant. */
  kind: "entries" | "media" | "constants";
  status: "live" | "coming";
  fields: CollectionField[];
  /** Photos (and, once the pipeline takes them, PDFs) can be attached. */
  uploads: boolean;
  note?: string;
};

const COMING_NOTE = "Coming: needs the content-layer move (today this comes from the RESUME constant in lib/site/terminal-data.ts).";

export const COLLECTIONS: Record<string, Collection[]> = {
  engineer: [
    {
      id: "projects",
      label: "Projects",
      singular: "project",
      kind: "entries",
      status: "live",
      uploads: true,
      fields: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "summary", label: "Summary", type: "text" },
        { key: "body", label: "Body (markdown)", type: "long" },
        { key: "role", label: "Role", type: "text", placeholder: "Full-stack" },
        { key: "techStack", label: "Tech stack", type: "chips", hint: "comma-separated", placeholder: "Next.js, TypeScript, Supabase" },
        { key: "deployedUrl", label: "Deployed URL", type: "url" },
        { key: "repoUrl", label: "Repo URL", type: "url" },
        { key: "demoVideoUrl", label: "Demo video URL", type: "url" },
        { key: "visibility", label: "Visibility", type: "visibility" },
        { key: "featured", label: "Featured", type: "check" },
      ],
    },
    {
      id: "media",
      label: "Media",
      singular: "image",
      kind: "media",
      status: "live",
      uploads: true,
      fields: [],
      note: "Photos go through the media pipeline (derivatives and EXIF). PDFs are not accepted by the pipeline yet.",
    },
    {
      id: "skills",
      label: "Skills",
      singular: "skill group",
      kind: "entries",
      status: "live",
      uploads: false,
      fields: [],
      note: "Each skill can link the projects, roles and certificates that used it (what the skill panel shows). A skill with no links is matched by name instead.",
    },
    { id: "experience", label: "Experience", singular: "role", kind: "constants", status: "coming", uploads: false, fields: [], note: COMING_NOTE },
    { id: "certifications", label: "Certifications", singular: "certification", kind: "constants", status: "coming", uploads: true, fields: [], note: COMING_NOTE },
    { id: "education", label: "Education", singular: "school", kind: "constants", status: "coming", uploads: false, fields: [], note: COMING_NOTE },
    { id: "writing", label: "Writing", singular: "post", kind: "constants", status: "coming", uploads: false, fields: [], note: COMING_NOTE },
  ],
};

export const collectionsFor = (persona: string): Collection[] => COLLECTIONS[persona] ?? [];
export const findCollection = (persona: string, id: string): Collection | undefined => collectionsFor(persona).find((c) => c.id === id);
