/**
 * Server-side loaders for the admin screens (cookie-bound client: RLS applies, drafts and hidden rows are visible
 * to the signed-in admin). Each one never throws: no database gives an empty list.
 */
import { getServerClient } from "@/lib/db/server";
import type { RecordType } from "@/lib/content/types";
import type { RecordRowView } from "../_collections/records-screen";

export async function loadRecordRows(type: RecordType, withPhotos: boolean): Promise<RecordRowView[]> {
  try {
    const sb = await getServerClient();
    const { data } = await sb.from("entries").select("id, slug, title, visibility, order, updated_at, data").eq("persona_slug", "engineer").eq("type", type).order("order", { ascending: true });
    const rows = data ?? [];
    const photos = new Map<string, { id: string; thumbUrl: string; alt: string }[]>();
    if (withPhotos && rows.length) {
      const { data: m } = await sb.from("media").select("id, entry_id, thumb_url, alt").in("entry_id", rows.map((r) => r.id));
      for (const x of m ?? []) {
        const list = photos.get(String(x.entry_id)) ?? [];
        list.push({ id: String(x.id), thumbUrl: String(x.thumb_url ?? ""), alt: String(x.alt ?? "") });
        photos.set(String(x.entry_id), list);
      }
    }
    return rows.map((r) => ({
      id: String(r.id),
      slug: String(r.slug),
      title: String(r.title ?? ""),
      visibility: String(r.visibility),
      order: Number(r.order ?? 0),
      updatedAt: String(r.updated_at ?? ""),
      data: (r.data ?? {}) as Record<string, unknown>,
      photos: photos.get(String(r.id)) ?? [],
    }));
  } catch {
    return [];
  }
}
