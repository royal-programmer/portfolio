"use client";

/**
 * The parts of a project that are data now: its story (description, audience, problem, status, beats with a clip
 * picker) and its media (poster, screens, clips). Rendered inside the project form; it writes two hidden JSON
 * fields (`story`, `assets`) that the server action validates with the same Zod schemas as the importer.
 */
import { useMemo, useState } from "react";
import { cleanData, type RField } from "../_lib/record-forms";
import { setAdminDirty } from "../dirty";
import { FieldList } from "./record-fields";

type Obj = Record<string, unknown>;
export type PhotoChoice = { src: string; w: number; h: number; alt: string; label: string };

const STATUS = [
  { value: "", label: "Not set" },
  { value: "in-development", label: "In development" },
  { value: "live", label: "Live" },
  { value: "live-building", label: "Live, still building" },
];

const media = (extra: RField[]): RField[] => extra;

export function ProjectExtras({ story: s0, assets: a0, photos }: { story: Obj; assets: Obj; photos: PhotoChoice[] }) {
  const [story, setStory] = useState<Obj>(s0);
  const [assets, setAssets] = useState<Obj>(a0);

  const clips = (Array.isArray(assets.clips) ? assets.clips : []) as Obj[];
  const storyFields = useMemo<RField[]>(
    () => [
      { kind: "long", key: "description", label: "What it is (one or two lines)" },
      { kind: "long", key: "audience", label: "Who it is for" },
      { kind: "long", key: "problem", label: "The problem it solves" },
      { kind: "select", key: "status", label: "Status", options: STATUS },
      {
        kind: "rows",
        key: "beats",
        label: "Beats (what it does, in order)",
        empty: { text: "", clip: "" },
        fields: [
          { kind: "long", key: "text", label: "Text", required: true },
          { kind: "select", key: "clip", label: "Clip to show", options: [{ value: "", label: "No clip" }, ...clips.filter((c) => c.id).map((c) => ({ value: String(c.id), label: String(c.label || c.id) }))] },
          { kind: "number", key: "clipMs", label: "Clip length (ms, 500 to 60000)", hint: "optional" },
        ],
      },
    ],
    // The clip list changes the picker's options.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(clips.map((c) => [c.id, c.label]))],
  );
  const assetFields = media([
    {
      kind: "optobj",
      key: "poster",
      label: "Has a poster image",
      empty: { src: "", w: 1200, h: 675, alt: "" },
      fields: [
        { kind: "text", key: "src", label: "Image path", required: true, hint: "/projects/name/poster.jpg" },
        { kind: "number", key: "w", label: "Width", required: true },
        { kind: "number", key: "h", label: "Height", required: true },
        { kind: "text", key: "alt", label: "Describe it (alt text)", required: true },
      ],
    },
    { kind: "rows", key: "screens", label: "Screenshots", required: true, empty: { id: "", label: "", src: "", w: 1200, h: 675 }, fields: [
      { kind: "text", key: "id", label: "Short id", required: true },
      { kind: "text", key: "label", label: "Caption", required: true },
      { kind: "text", key: "src", label: "Image path", required: true },
      { kind: "number", key: "w", label: "Width", required: true },
      { kind: "number", key: "h", label: "Height", required: true },
    ] },
    { kind: "rows", key: "clips", label: "Clips", required: true, empty: { id: "", label: "", poster: "", src: "" }, fields: [
      { kind: "text", key: "id", label: "Short id", required: true },
      { kind: "text", key: "label", label: "Caption", required: true },
      { kind: "text", key: "poster", label: "Still image path", required: true },
      { kind: "text", key: "src", label: "Video path", required: true },
    ] },
  ]);

  const cleanStory = cleanData(storyFields, story);
  if (!cleanStory.status) delete cleanStory.status;
  if (Array.isArray(cleanStory.beats)) cleanStory.beats = (cleanStory.beats as Obj[]).map((b) => (b.clip ? b : Object.fromEntries(Object.entries(b).filter(([k]) => k !== "clip"))));
  if (!cleanStory.beats || !(cleanStory.beats as unknown[]).length) delete cleanStory.beats;
  const cleanAssets = cleanData(assetFields, assets);
  const hasAssets = Boolean(cleanAssets.poster) || (cleanAssets.screens as unknown[]).length > 0 || (cleanAssets.clips as unknown[]).length > 0;

  const poster = (assets.poster ?? null) as Obj | null;
  return (
    <div className="adm-extras" onChange={() => setAdminDirty(true)}>
      <input type="hidden" name="story" value={JSON.stringify(cleanStory)} />
      <input type="hidden" name="assets" value={hasAssets ? JSON.stringify(cleanAssets) : ""} />
      <details className="adm-set" open>
        <summary className="adm-h2">The story (shown in the Netflix trailer)</summary>
        <div className="adm-form">
          <FieldList fields={storyFields} value={story} onChange={(v) => (setAdminDirty(true), setStory(v))} />
        </div>
      </details>
      <details className="adm-set">
        <summary className="adm-h2">Media: poster, screenshots, clips</summary>
        <div className="adm-form">
          {photos.length ? (
            <label className="adm-field is-block">
              <span className="adm-label">Use an uploaded photo as the poster</span>
              <select
                className="adm-input is-narrow"
                value=""
                onChange={(e) => {
                  const p = photos[Number(e.target.value)];
                  if (p) {
                    setAdminDirty(true);
                    setAssets({ ...assets, poster: { src: p.src, w: p.w, h: p.h, alt: p.alt } });
                  }
                }}
              >
                <option value="">Choose a photo…</option>
                {photos.map((p, i) => (
                  <option key={p.src} value={i}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {poster?.src ? <p className="adm-hint">Poster: {String(poster.src)}</p> : null}
          <FieldList fields={assetFields} value={assets} onChange={(v) => (setAdminDirty(true), setAssets(v))} />
        </div>
      </details>
    </div>
  );
}
