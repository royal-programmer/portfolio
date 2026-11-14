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
  /** `entries`: projects (rows in `entries`). `media`: the media pipeline. `records`: the generic record screen. `posts`: Writing (`blog_posts`). `constants`: not built yet. */
  kind: "entries" | "media" | "records" | "posts" | "constants";
  /** For `records`: which record type the screen edits (its form is `_lib/record-forms.ts`). */
  recordType?: string;
  status: "live" | "coming";
  fields: CollectionField[];
  /** Photos (and, once the pipeline takes them, PDFs) can be attached. */
  uploads: boolean;
  note?: string;
};

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
    { id: "experience", label: "Experience", singular: "role", kind: "records", recordType: "experience", status: "live", uploads: false, fields: [] },
    { id: "certifications", label: "Certifications", singular: "certificate", kind: "records", recordType: "certification", status: "live", uploads: true, fields: [], note: "Badge images use the same upload as project photos." },
    { id: "education", label: "Education", singular: "school", kind: "records", recordType: "education", status: "live", uploads: false, fields: [] },
    { id: "events", label: "Timeline events", singular: "event", kind: "records", recordType: "timeline_event", status: "live", uploads: false, fields: [] },
    { id: "milestones", label: "Milestones", singular: "milestone", kind: "records", recordType: "milestone", status: "live", uploads: false, fields: [] },
    { id: "architecture", label: "Architecture diagrams", singular: "diagram", kind: "records", recordType: "diagram", status: "live", uploads: false, fields: [] },
    { id: "links", label: "Profile links", singular: "link", kind: "records", recordType: "profile_link", status: "live", uploads: false, fields: [] },
    { id: "writing", label: "Writing", singular: "post", kind: "posts", status: "live", uploads: false, fields: [], note: "Blog posts live in their own table." },
  ],
};

export const collectionsFor = (persona: string): Collection[] => COLLECTIONS[persona] ?? [];
export const findCollection = (persona: string, id: string): Collection | undefined => collectionsFor(persona).find((c) => c.id === id);
