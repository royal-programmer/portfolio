/**
 * Shared content contract for the portfolio platform.
 *
 * This file is the AGREED INTERFACE between the data layer (Claude's lane:
 * `lib/**`, Supabase, server actions) and the UI/routing layer (Cursor's lane:
 * `app/[persona]/**`, navigation, pages).
 *
 * Ownership: Claude authors this file; Cursor consumes it read-only. If a shape
 * needs to change, raise it in a handoff note so both sides update together.
 *
 * Nothing here imports Supabase or any runtime dependency — it is pure types +
 * a few small pure constants/guards, so it is safe to import from anywhere
 * (Server Components, Client Components, route handlers).
 *
 * See docs/claude-planning/03-content-and-capture-model.md for the rationale.
 */

// ---------------------------------------------------------------------------
// Personas
// ---------------------------------------------------------------------------

/**
 * Personas that are live today. These MUST stay in sync with the runtime
 * `Persona` union in `app/persona-provider.tsx`. Kept as a separate type so the
 * data layer can reference personas that aren't wired into the switcher yet.
 */
export type LaunchedPersona = "engineer" | "trader" | "photographer";

/** Every planned persona (see docs/claude-planning/02-persona-catalog.md). */
export type PersonaSlug = LaunchedPersona | "artist" | "ride" | "gamer";

export const LAUNCHED_PERSONAS: readonly LaunchedPersona[] = [
  "engineer",
  "trader",
  "photographer",
] as const;

export const ALL_PERSONAS: readonly PersonaSlug[] = [
  ...LAUNCHED_PERSONAS,
  "artist",
  "ride",
  "gamer",
] as const;

/** Runtime guard — useful for validating a `[persona]` route param. */
export function isPersonaSlug(value: string): value is PersonaSlug {
  return (ALL_PERSONAS as readonly string[]).includes(value);
}

/** Runtime guard for the narrower set that is actually launched. */
export function isLaunchedPersona(value: string): value is LaunchedPersona {
  return (LAUNCHED_PERSONAS as readonly string[]).includes(value);
}

/**
 * Presentation-level persona metadata. Mirrors today's hardcoded
 * `PERSONA_CONTENT` so the UI can migrate to DB-backed data with no shape
 * change. `isPublished` lets the data layer expose a persona to the public
 * site independently of whether its slug exists in code.
 */
export interface Persona {
  slug: PersonaSlug;
  /** Short mode label, e.g. "Engineer Mode". */
  label: string;
  /** Kicker above the heading, e.g. "Developer + Software Engineer". */
  eyebrow: string;
  heading: string;
  body: string;
  /** Hex accent colour, e.g. "#3b82f6". */
  accent: string;
  /** Call-to-action label, e.g. "View engineering projects". */
  cta: string;
  /** Rotating headline words / bullet points. */
  points: string[];
  /** Publicly visible? Unpublished personas 404 on the public site. */
  isPublished: boolean;
  /** Display order in the switcher / listings. */
  order: number;
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

/**
 * Every content row carries a visibility. The PUBLIC site only ever reads
 * `public`. `unlisted` is reachable by direct link but never listed. `private`
 * is authenticated-only (e.g. the trader's personal tracking view).
 */
export type Visibility = "public" | "unlisted" | "private";

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

/** Photographic metadata, auto-extracted from uploads via `exifr`. */
export interface ExifData {
  iso?: number;
  /** Human string, e.g. "1/250" or "2\"". */
  shutterSpeed?: string;
  /** f-number, e.g. 1.8. */
  aperture?: number;
  /** Focal length in mm. */
  focalLength?: number;
  camera?: string;
  lens?: string;
  /** ISO 8601 timestamp the shot was taken. */
  takenAt?: string;
}

export interface Media {
  id: string;
  entryId: string;
  kind: "image" | "video";
  /**
   * URLs the browser is allowed to load. The ORIGINAL is stored privately and
   * is intentionally NOT part of this contract — the public UI never receives
   * it. Serve `thumbUrl` in grids, `optimizedUrl` in normal views, and
   * `fullUrl` only for an explicit "view full quality" action.
   */
  thumbUrl: string;
  optimizedUrl: string;
  fullUrl?: string;
  width?: number;
  height?: number;
  alt?: string;
  caption?: string;
  /** Present for photography/artwork entries. */
  exif?: ExifData;
  /** Geotag — powers the ride map and location-pinned galleries. */
  lat?: number;
  lng?: number;
  capturedAt?: string;
  order: number;
}

// ---------------------------------------------------------------------------
// Groups (genres / mediums / platforms / tags)
// ---------------------------------------------------------------------------

export interface Group {
  id: string;
  personaSlug: PersonaSlug;
  name: string;
  slug: string;
  /** Free-form kind, e.g. "genre" | "medium" | "platform" | "tag". */
  kind: string;
}

// ---------------------------------------------------------------------------
// Entries — one universal unit, discriminated by `type`
// ---------------------------------------------------------------------------

export type EntryType =
  | "project" // engineer
  | "trade" // trader
  | "photo" // photographer
  | "artwork" // artist
  | "ride" // ride/travel
  | "game"; // gamer

export interface GeoPoint {
  lat: number;
  lng: number;
  /** ISO 8601 timestamp for this point (ordering the route). */
  at?: string;
}

export interface EngineerData {
  role?: string;
  techStack: string[];
  repoUrl?: string;
  deployedUrl?: string;
  demoVideoUrl?: string;
}

export interface TraderData {
  instrument: string;
  direction: "long" | "short";
  entryPrice: number;
  exitPrice?: number;
  /** Position size. Considered sensitive — masked in the public view. */
  size?: number;
  /** Absolute P&L. Sensitive — masked publicly; use `pnlPct` for public views. */
  pnl?: number;
  /** Percentage return — safe to show publicly. */
  pnlPct?: number;
  strategyId?: string;
  openedAt: string;
  closedAt?: string;
}

export interface PhotoData {
  edited: boolean;
  /** For the before/after slider (only when `edited`). */
  beforeMediaId?: string;
  afterMediaId?: string;
}

export interface ArtworkData {
  medium?: string;
  edited?: boolean;
  beforeMediaId?: string;
  afterMediaId?: string;
}

export interface RideData {
  start: string;
  end: string;
  distanceKm?: number;
  /** Tracked GPS trail, rendered as a polyline on the map. */
  routePoints?: GeoPoint[];
}

export interface GameData {
  platform: string;
  progressPct?: number;
  status: "playing" | "completed" | "backlog" | "dropped";
  /** 0–10 personal rating. */
  rating?: number;
  /** Platform id (e.g. Steam appid) for auto-populated entries. */
  externalId?: string;
}

/** Maps each entry `type` to its persona-specific payload. */
export interface EntryDataMap {
  project: EngineerData;
  trade: TraderData;
  photo: PhotoData;
  artwork: ArtworkData;
  ride: RideData;
  game: GameData;
}

export interface BaseEntry<T extends EntryType = EntryType> {
  id: string;
  personaSlug: PersonaSlug;
  type: T;
  /** URL-safe slug, unique within a persona. Powers `/[persona]/[slug]`. */
  slug: string;
  title: string;
  summary?: string;
  /** Long-form markdown body. */
  body?: string;
  visibility: Visibility;
  featured: boolean;
  order: number;
  /** When the thing happened (trade date, shoot date, ride date). */
  occurredAt?: string;
  createdAt: string;
  media: Media[];
  groups: Group[];
  /** Persona-specific fields, narrowed by `type`. */
  data: EntryDataMap[T];
}

/**
 * Discriminated union of all entry kinds. Narrow on `entry.type` and TypeScript
 * narrows `entry.data` automatically:
 *
 *   if (entry.type === "trade") { entry.data.instrument // ✅ TraderData }
 */
export type Entry = { [K in EntryType]: BaseEntry<K> }[EntryType];

// ---------------------------------------------------------------------------
// Blog posts (per persona)
// ---------------------------------------------------------------------------

export interface BlogPost {
  id: string;
  personaSlug: PersonaSlug;
  title: string;
  slug: string;
  excerpt?: string;
  /** Markdown body. */
  body: string;
  coverMediaId?: string;
  tags: string[];
  visibility: Visibility;
  publishedAt?: string;
}

// ---------------------------------------------------------------------------
// Trader master data
// ---------------------------------------------------------------------------

export interface Strategy {
  id: string;
  name: string;
  thesis?: string;
  description?: string;
  rules?: string[];
}

// ---------------------------------------------------------------------------
// Data-access contract
// ---------------------------------------------------------------------------

export interface ContentQueryOptions {
  /**
   * Include `private`/`unlisted` rows. ONLY the authenticated capture/admin
   * surfaces pass this. The public site never does, so it can never receive
   * private data even if the UI has a bug — RLS is the second line of defence.
   */
  includeNonPublic?: boolean;
}

/**
 * The functions the UI calls. Implemented in `lib/content/*` — first as a stub
 * over today's hardcoded content (so routing can be built immediately), then
 * swapped for the Supabase-backed implementation behind this SAME interface.
 */
export interface ContentApi {
  listPersonas(opts?: ContentQueryOptions): Promise<Persona[]>;
  getPersona(slug: string, opts?: ContentQueryOptions): Promise<Persona | null>;
  listEntries(persona: PersonaSlug, opts?: ContentQueryOptions): Promise<Entry[]>;
  getEntry(id: string, opts?: ContentQueryOptions): Promise<Entry | null>;
  /** Fetch a single entry by its persona + slug (for detail pages). */
  getEntryBySlug(
    persona: PersonaSlug,
    slug: string,
    opts?: ContentQueryOptions,
  ): Promise<Entry | null>;
  listBlogPosts(persona: PersonaSlug, opts?: ContentQueryOptions): Promise<BlogPost[]>;
  getBlogPost(
    persona: PersonaSlug,
    slug: string,
    opts?: ContentQueryOptions,
  ): Promise<BlogPost | null>;
}
