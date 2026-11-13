"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/db/browser";
import { registerUploadedMedia } from "../entry-actions";
import { ACCEPTED_IMAGE_TYPES, MAX_ORIGINAL_BYTES, ORIGINALS_BUCKET } from "@/lib/media/config";

type Item = {
  key: string;
  name: string;
  status: "uploading" | "processing" | "done" | "error";
  message?: string;
  thumbUrl?: string;
};

const ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");

function extOf(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fromName || (file.type.split("/")[1] ?? "bin");
}

/**
 * Direct-to-storage uploader. The browser streams each original straight to the
 * private `originals` bucket (authorized by the admin session — never touches
 * the Vercel body limit), then asks the server to build derivatives + the media
 * row. Add-only for now; reordering/removal can come later.
 */
export function MediaUploader({ entryId }: { entryId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setBusy(true);
    const supabase = getBrowserClient();

    for (const file of files) {
      const id = crypto.randomUUID();
      const key = `${entryId}/${id}.${extOf(file)}`;
      const set = (patch: Partial<Item>) =>
        setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

      setItems((prev) => [...prev, { key, name: file.name, status: "uploading" }]);

      if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
        set({ status: "error", message: `Unsupported type (${file.type || "unknown"}).` });
        continue;
      }
      if (file.size > MAX_ORIGINAL_BYTES) {
        set({
          status: "error",
          message: `Too large (${(file.size / 1024 / 1024).toFixed(1)}MB, max ${(
            MAX_ORIGINAL_BYTES /
            1024 /
            1024
          ).toFixed(0)}MB).`,
        });
        continue;
      }

      const { error: upErr } = await supabase.storage
        .from(ORIGINALS_BUCKET)
        .upload(key, file, { contentType: file.type, upsert: false });
      if (upErr) {
        set({ status: "error", message: `Upload failed: ${upErr.message}` });
        continue;
      }

      set({ status: "processing" });
      const res = await registerUploadedMedia({
        entryId,
        originalPath: key,
        order: items.length,
      });
      if (res.error) {
        set({ status: "error", message: res.error });
      } else {
        set({ status: "done", thumbUrl: res.media?.thumbUrl });
      }
    }

    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Add images
        <input
          type="file"
          accept={ACCEPT}
          multiple
          disabled={busy}
          onChange={(e) => handleFiles(e.target.files)}
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-neutral-700 file:px-2 file:py-1 file:text-neutral-100"
        />
      </label>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {items.map((it) => (
            <li
              key={it.key}
              className="flex items-center gap-3 rounded-md border border-neutral-800 px-3 py-2 text-sm"
            >
              {it.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={it.thumbUrl} alt="" className="h-10 w-10 rounded object-cover" />
              ) : (
                <span className="h-10 w-10 rounded bg-neutral-800" />
              )}
              <span className="flex-1 truncate">{it.name}</span>
              <span
                className={
                  it.status === "error"
                    ? "text-red-400"
                    : it.status === "done"
                      ? "text-green-400"
                      : "text-neutral-400"
                }
              >
                {it.status === "uploading"
                  ? "Uploading…"
                  : it.status === "processing"
                    ? "Processing…"
                    : it.status === "done"
                      ? "Done"
                      : it.message}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
