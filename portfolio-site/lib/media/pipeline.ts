/**
 * Media ingest pipeline — the transport-agnostic core.
 *
 * Given an ORIGINAL already sitting in the private `originals` bucket, this:
 *   1. downloads it (server-to-server, no request-body limit),
 *   2. generates WebP derivatives with sharp (auto-oriented from EXIF),
 *   3. extracts photographic metadata + GPS with exifr,
 *   4. uploads derivatives to the public `media` bucket,
 *   5. inserts the `media` row and returns it.
 *
 * SERVER-ONLY (imports sharp/exifr). The caller supplies the Supabase client so
 * the trust level is explicit:
 *   - server action → RLS-bound admin session client (D18-consistent), or
 *   - headless script → service-role client.
 *
 * The same function serves engineer screenshots today and photography hi-res
 * later — only the byte transport (browser direct-upload) differs, not this.
 */
import "server-only";
import sharp from "sharp";
import exifr from "exifr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExifData, Media, PersonaSlug, Visibility } from "@/lib/content";
import { DERIVATIVES, MEDIA_BUCKET, ORIGINALS_BUCKET } from "./config";

export interface IngestParams {
  entryId: string;
  personaSlug: PersonaSlug;
  /** Storage key of the original in the `originals` bucket. */
  originalPath: string;
  /** Visibility for the media row (usually mirrors the entry). */
  visibility: Visibility;
  order?: number;
  alt?: string;
  caption?: string;
}

/** Convert a shutter ExposureTime (seconds) into a human string. */
function formatShutter(exposure: unknown): string | undefined {
  if (typeof exposure !== "number" || !isFinite(exposure) || exposure <= 0) return undefined;
  if (exposure >= 1) return `${Number.isInteger(exposure) ? exposure : exposure.toFixed(1)}"`;
  return `1/${Math.round(1 / exposure)}`;
}

function toIso(value: unknown): string | undefined {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  return undefined;
}

function cleanCamera(make: unknown, model: unknown): string | undefined {
  const mk = typeof make === "string" ? make.trim() : "";
  const md = typeof model === "string" ? model.trim() : "";
  if (md && mk && md.toLowerCase().startsWith(mk.toLowerCase())) return md;
  return [mk, md].filter(Boolean).join(" ") || undefined;
}

/** Best-effort EXIF extraction. Returns undefined when there's nothing useful. */
async function extractExif(
  buffer: Buffer,
): Promise<{ exif?: ExifData; lat?: number; lng?: number; capturedAt?: string }> {
  try {
    const tags = (await exifr.parse(buffer, {
      pick: [
        "ISO",
        "ExposureTime",
        "FNumber",
        "FocalLength",
        "Make",
        "Model",
        "LensModel",
        "DateTimeOriginal",
        "GPSLatitude",
        "GPSLongitude",
      ],
    })) as Record<string, unknown> | undefined;
    if (!tags) return {};

    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const gps = await exifr.gps(buffer);
      if (gps && typeof gps.latitude === "number" && typeof gps.longitude === "number") {
        lat = gps.latitude;
        lng = gps.longitude;
      }
    } catch {
      /* no GPS — fine */
    }

    const exif: ExifData = {};
    if (typeof tags.ISO === "number") exif.iso = tags.ISO;
    const shutter = formatShutter(tags.ExposureTime);
    if (shutter) exif.shutterSpeed = shutter;
    if (typeof tags.FNumber === "number") exif.aperture = tags.FNumber;
    if (typeof tags.FocalLength === "number") exif.focalLength = tags.FocalLength;
    const camera = cleanCamera(tags.Make, tags.Model);
    if (camera) exif.camera = camera;
    if (typeof tags.LensModel === "string" && tags.LensModel.trim()) exif.lens = tags.LensModel.trim();
    const takenAt = toIso(tags.DateTimeOriginal);
    if (takenAt) exif.takenAt = takenAt;

    return {
      exif: Object.keys(exif).length ? exif : undefined,
      lat,
      lng,
      capturedAt: takenAt,
    };
  } catch {
    return {};
  }
}

async function downloadOriginal(supabase: SupabaseClient, path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from(ORIGINALS_BUCKET).download(path);
  if (error || !data) {
    throw new Error(`Could not download original "${path}": ${error?.message ?? "no data"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Ingest an already-uploaded original into derivatives + a media row.
 * Throws on failure; the caller decides how to surface it.
 */
export async function ingestImage(supabase: SupabaseClient, params: IngestParams): Promise<Media> {
  const { entryId, personaSlug, originalPath, visibility } = params;

  const buffer = await downloadOriginal(supabase, originalPath);

  // Oriented intrinsic dimensions (swap when EXIF orientation rotates 90/270).
  const meta = await sharp(buffer).metadata();
  let width = meta.width ?? undefined;
  let height = meta.height ?? undefined;
  if (meta.orientation && meta.orientation >= 5 && width && height) {
    [width, height] = [height, width];
  }

  const mediaId = crypto.randomUUID();
  const baseKey = `${personaSlug}/${entryId}/${mediaId}`;

  // Generate derivatives. `optimized` is required; `full` is uploaded only when
  // the source is bigger than optimized (else optimized already is full-res).
  const urls: Record<string, string> = {};
  let optimizedWidth = 0;
  for (const spec of DERIVATIVES) {
    const { data, info } = await sharp(buffer)
      .rotate()
      .resize({ width: spec.width, withoutEnlargement: true })
      .webp({ quality: spec.quality })
      .toBuffer({ resolveWithObject: true });

    if (spec.name === "optimized") optimizedWidth = info.width;
    if (spec.name === "full" && info.width <= optimizedWidth) {
      continue; // redundant — optimized already covers full resolution
    }

    const key = `${baseKey}/${spec.name}.webp`;
    const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(key, data, {
      contentType: "image/webp",
      upsert: true,
    });
    if (upErr) throw new Error(`Upload of ${spec.name} failed: ${upErr.message}`);

    urls[spec.name] = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(key).data.publicUrl;
  }

  const { exif, lat, lng, capturedAt } = await extractExif(buffer);

  const row = {
    id: mediaId,
    entry_id: entryId,
    kind: "image" as const,
    original_path: originalPath,
    thumb_url: urls.thumb ?? urls.optimized ?? "",
    optimized_url: urls.optimized ?? "",
    full_url: urls.full ?? null,
    width: width ?? null,
    height: height ?? null,
    alt: params.alt?.trim() || null,
    caption: params.caption?.trim() || null,
    exif: exif ?? null,
    lat: lat ?? null,
    lng: lng ?? null,
    captured_at: capturedAt ?? null,
    order: params.order ?? 0,
    visibility,
  };

  const { data: inserted, error } = await supabase.from("media").insert(row).select("*").single();
  if (error) throw new Error(`Inserting media row failed: ${error.message}`);

  return {
    id: inserted.id,
    entryId: inserted.entry_id,
    kind: inserted.kind,
    thumbUrl: inserted.thumb_url ?? "",
    optimizedUrl: inserted.optimized_url ?? "",
    fullUrl: inserted.full_url ?? undefined,
    width: inserted.width ?? undefined,
    height: inserted.height ?? undefined,
    alt: inserted.alt ?? undefined,
    caption: inserted.caption ?? undefined,
    exif: inserted.exif ?? undefined,
    lat: inserted.lat ?? undefined,
    lng: inserted.lng ?? undefined,
    capturedAt: inserted.captured_at ?? undefined,
    order: inserted.order ?? 0,
  };
}
