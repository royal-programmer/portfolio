/**
 * Media pipeline configuration — bucket names and derivative specs.
 *
 * Kept dependency-free so it can be imported from anywhere (server actions,
 * pipeline, scripts).
 */

/** Private bucket: source-of-truth originals. Never served publicly. */
export const ORIGINALS_BUCKET = "originals";

/** Public bucket: optimized derivatives the site serves. */
export const MEDIA_BUCKET = "media";

/** A single derivative rendition. Width is a max — we never upscale. */
export interface DerivativeSpec {
  name: "thumb" | "optimized" | "full";
  width: number;
  quality: number;
}

/**
 * Renditions generated per image, smallest first. `full` is only stored when
 * the source is genuinely larger than `optimized` (see pipeline) — otherwise
 * `optimized` already is full resolution and `fullUrl` stays null.
 */
export const DERIVATIVES: readonly DerivativeSpec[] = [
  { name: "thumb", width: 400, quality: 72 },
  { name: "optimized", width: 1280, quality: 80 },
  { name: "full", width: 2400, quality: 82 },
] as const;

/** Accepted upload MIME types (images only, for now). */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/tiff",
  "image/heic",
  "image/heif",
] as const;

/**
 * Max original size accepted from the browser. The browser uploads the original
 * DIRECTLY to Supabase Storage (not through Vercel), so this is not bound by the
 * ~4.5MB serverless body limit — it's a sanity cap we can raise for the
 * photography persona's hi-res needs.
 */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024; // 25 MB
