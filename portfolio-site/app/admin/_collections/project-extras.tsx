"use client";

/**
 * The parts of a project that are data now: its story (description, audience, problem, status, beats with a clip
 * picker) and its media (poster, screens, clips). Controlled by the project form, which keeps both objects in its
 * value (so autosave, the diff and Revert see them) and sends them cleaned to `saveProject`.
 */
import { useMemo } from "react";
import { ASSET_FIELDS, storyFieldDefs } from "../_lib/project-forms";
import { FieldList } from "./record-fields";

type Obj = Record<string, unknown>;
export type PhotoChoice = { src: string; w: number; h: number; alt: string; label: string };

export function ProjectExtras({ story, assets, photos, onStory, onAssets }: { story: Obj; assets: Obj; photos: PhotoChoice[]; onStory: (v: Obj) => void; onAssets: (v: Obj) => void }) {
  const clips = (Array.isArray(assets.clips) ? assets.clips : []) as Obj[];
  const clipSig = JSON.stringify(clips.map((c) => [c.id, c.label]));
  // The clip list changes the picker's options.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const storyFields = useMemo(() => storyFieldDefs(clips), [clipSig]);
  const poster = (assets.poster ?? null) as Obj | null;
  return (
    <div className="adm-extras">
      <details className="adm-set" open>
        <summary className="adm-h2">The story (shown in the Netflix trailer)</summary>
        <div className="adm-form">
          <FieldList fields={storyFields} value={story} onChange={onStory} />
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
                  if (p) onAssets({ ...assets, poster: { src: p.src, w: p.w, h: p.h, alt: p.alt } });
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
          <FieldList fields={ASSET_FIELDS} value={assets} onChange={onAssets} />
        </div>
      </details>
    </div>
  );
}
