/**
 * Stub content fixtures.
 *
 * This is TEMPORARY data that backs the `ContentApi` until the Supabase-backed
 * implementation lands. It mirrors today's hardcoded `PERSONA_CONTENT` so the
 * public site can migrate to the data layer with no visible change, plus a few
 * clearly-labelled SAMPLE entries so persona pages render end-to-end.
 *
 * Everything here gets replaced by real, DB-stored content — sample entries are
 * marked "(sample)" so they are never mistaken for real portfolio pieces.
 *
 * Owned by the data layer (Claude). Do not hand-edit as real content — real
 * content will be entered through the capture/admin surfaces once wired.
 */
import type { BaseEntry, BlogPost, Persona, Strategy } from "./types";

export const STUB_PERSONAS: Persona[] = [
  {
    slug: "engineer",
    label: "Engineer Mode",
    eyebrow: "Developer + Software Engineer",
    heading: "I design fast, scalable web products with premium UX.",
    body: "Building clean systems, modern interfaces, and reliable backends from idea to launch.",
    accent: "#3b82f6",
    cta: "View engineering projects",
    points: ["Next.js + TypeScript", "System architecture", "API and backend integration"],
    isPublished: true,
    order: 0,
  },
  {
    slug: "trader",
    label: "Trader Mode",
    eyebrow: "Quant Mind + Risk Discipline",
    heading: "I track setups, probabilities, and execution with system-first thinking.",
    body: "Focused on process quality, risk control, and repeatable decisions across market cycles.",
    accent: "#22c55e",
    cta: "Explore trading journal",
    points: ["Risk-managed strategy", "Data-backed journaling", "Daily review workflow"],
    isPublished: true,
    order: 1,
  },
  {
    slug: "photographer",
    label: "Photographer Mode",
    eyebrow: "Lens Focus + Composition",
    heading: "I capture light, shape stories, and design visuals.",
    body: "From portraits to street scenes, I focus on framing, timing, and atmosphere.",
    accent: "#ec4899",
    cta: "View photography",
    points: ["Portrait lighting", "Street composition", "Editing + color grading"],
    isPublished: true,
    order: 2,
  },
  // Planned personas — present in data but NOT yet published, so the public
  // site 404s them until they have real content ("fill rooms before building").
  {
    slug: "artist",
    label: "Artist Mode",
    eyebrow: "Sketch + Paint",
    heading: "I make things by hand.",
    body: "Drawing and painting across mediums.",
    accent: "#f59e0b",
    cta: "View artwork",
    points: ["Sketching", "Watercolor", "Digital"],
    isPublished: false,
    order: 3,
  },
  {
    slug: "ride",
    label: "Rider Mode",
    eyebrow: "Travel + Ride",
    heading: "I ride, and I bring back the story.",
    body: "Routes, places, and the experiences between them.",
    accent: "#14b8a6",
    cta: "View rides",
    points: ["Routes", "Places", "Experiences"],
    isPublished: false,
    order: 4,
  },
  {
    slug: "gamer",
    label: "Gamer Mode",
    eyebrow: "Play + Collection",
    heading: "What I'm playing and where I've been.",
    body: "A living collection across platforms.",
    accent: "#8b5cf6",
    cta: "View collection",
    points: ["Steam", "Epic", "Progress"],
    isPublished: false,
    order: 5,
  },
];

/**
 * Sample entries. Currently only Engineer has any, to prove the list→detail
 * loop for Phase 1. Explicitly labelled "(sample)".
 */
export const STUB_ENTRIES: BaseEntry[] = [
  {
    id: "eng-sample-1",
    personaSlug: "engineer",
    type: "project",
    title: "Portfolio Platform (sample)",
    summary: "This very site — a multi-persona platform with phone-first content capture.",
    body: "Placeholder body. Replace with a real project write-up via the admin surface.",
    visibility: "public",
    featured: true,
    order: 0,
    occurredAt: "2026-07-01",
    createdAt: "2026-07-01T00:00:00.000Z",
    media: [],
    groups: [],
    data: {
      role: "Design + Full-stack",
      techStack: ["Next.js", "TypeScript", "Supabase", "Tailwind"],
      repoUrl: undefined,
      deployedUrl: undefined,
      demoVideoUrl: undefined,
    },
  },
  {
    id: "eng-sample-2",
    personaSlug: "engineer",
    type: "project",
    title: "Second Project (sample)",
    summary: "A second placeholder card so the grid layout has more than one item.",
    body: "Placeholder body. Replace with real content.",
    visibility: "public",
    featured: false,
    order: 1,
    occurredAt: "2026-05-01",
    createdAt: "2026-05-01T00:00:00.000Z",
    media: [],
    groups: [],
    data: {
      techStack: ["React", "Node.js"],
    },
  },
];

export const STUB_BLOG_POSTS: BlogPost[] = [];

export const STUB_STRATEGIES: Strategy[] = [];
