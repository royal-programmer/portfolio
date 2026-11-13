/**
 * Where the engineer's records come from (round 24). `CONTENT_SOURCE=db` reads them from the database
 * (empty and honest while it has none); anything else reads the frozen copy in `lib/site/legacy-content.ts`.
 * The default is `code` until the migration and the import are applied; then the flag flips and the
 * legacy file is deleted. Server-side env only: client bundles always see `code` (no NEXT_PUBLIC mirror).
 */
export type ContentSource = "db" | "code";
export const CONTENT_SOURCE: ContentSource = process.env.CONTENT_SOURCE === "db" ? "db" : "code";
export const fromDb = CONTENT_SOURCE === "db";
