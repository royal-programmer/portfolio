"use client";

/**
 * One key's editor: the schema-generated form, the draft/live bar (Save draft, Publish, Discard, Reset to
 * defaults, Preview site) and the previews. Saving writes the DRAFT only. Unsaved edits warn on leaving.
 */
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SchemaForm } from "@/lib/settings/form";
import { SCHEMAS, type SettingKey, type Settings } from "@/lib/settings/schema";
import { discardDraft, publishSetting, saveDraft, type SettingActionResult } from "./actions";
import { setAdminDirty } from "./dirty";
import { ArchPreview, ThemesPreview, TimelinePreview, ViewsPreview } from "./previews";

type Props = {
  settingKey: SettingKey;
  title: string;
  draft: unknown;
  live: unknown;
  fallback: unknown;
  stored: boolean;
  tableReady: boolean;
  updatedAt: string | null;
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function SettingEditor({ settingKey, title, draft, live, fallback, stored, tableReady, updatedAt }: Props) {
  const router = useRouter();
  const [value, setValue] = useState<unknown>(draft);
  const [saved, setSaved] = useState<unknown>(draft);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const dirty = !same(value, saved);
  const differs = !same(saved, live);
  const isDefault = same(value, fallback);

  useEffect(() => {
    setAdminDirty(dirty);
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => () => setAdminDirty(false), []);

  const run = (fn: () => Promise<SettingActionResult>, after?: (r: SettingActionResult) => void) =>
    start(async () => {
      const r = await fn();
      setNotice({ ok: r.ok, text: r.message });
      if (r.ok) after?.(r);
      router.refresh();
    });

  const save = () =>
    run(() => saveDraft(settingKey, value), (r) => {
      if (r.ok) setSaved(r.draft ?? value);
    });
  const publish = () => run(() => publishSetting(settingKey), () => setSaved(value));
  const discard = () =>
    run(() => discardDraft(settingKey), (r) => {
      if (r.ok && r.draft !== undefined) {
        setValue(r.draft);
        setSaved(r.draft);
      }
    });

  const schema = SCHEMAS[settingKey];
  const extras =
    settingKey === "engineer.timeline" ? <TimelinePreview value={value as Settings["engineer.timeline"]} /> :
    settingKey === "engineer.arch" ? <ArchPreview value={value as Settings["engineer.arch"]} /> :
    settingKey === "engineer.themes" ? <ThemesPreview value={value as Settings["engineer.themes"]} /> :
    settingKey === "engineer.views" ? <ViewsPreview value={value as Settings["engineer.views"]} /> :
    null;

  const views = settingKey === "engineer.views" ? (value as Settings["engineer.views"]) : null;

  return (
    <section className="adm-editor">
      <header className="adm-bar">
        <div className="adm-bar-title">
          <h1>{title}</h1>
          <code>{settingKey}</code>
          <span className={`adm-pill ${dirty ? "is-warn" : differs ? "is-warn" : "is-ok"}`}>
            {dirty ? "unsaved edits" : differs ? "draft differs from live" : stored ? "draft = live" : "code defaults"}
          </span>
          {updatedAt ? <span className="adm-hint">changed {new Date(updatedAt).toLocaleString()}</span> : null}
        </div>
        <div className="adm-actions">
          <button type="button" className="adm-btn" onClick={save} disabled={pending || !dirty || !tableReady}>
            Save draft
          </button>
          <button type="button" className="adm-btn is-primary" onClick={publish} disabled={pending || dirty || !differs || !tableReady} title={dirty ? "Save the draft first" : undefined}>
            Publish
          </button>
          <button type="button" className="adm-btn" onClick={discard} disabled={pending || !stored || (!differs && !dirty)}>
            Discard draft
          </button>
          <button type="button" className="adm-btn is-ghost" onClick={() => setValue(fallback)} disabled={isDefault}>
            Reset all to default
          </button>
          <a className="adm-btn is-ghost" href="/admin/preview?to=hub" target="_blank" rel="noreferrer">
            Preview site
          </a>
        </div>
        {notice ? (
          <p role="status" className={notice.ok ? "adm-note is-ok" : "adm-note is-bad"}>
            {notice.text}
          </p>
        ) : null}
        {dirty && differs ? null : null}
      </header>

      {views ? (
        <div className="adm-field">
          <label className="adm-label" htmlFor="default-view">
            default view
          </label>
          <select
            id="default-view"
            className="adm-input is-narrow"
            value={views.defaultView}
            onChange={(e) => setValue({ ...views, defaultView: e.target.value })}
          >
            {views.views.filter((v) => v.enabled).map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="adm-form">
        <SchemaForm schema={schema} value={value} fallback={fallback} onChange={setValue} />
      </div>
      {extras}
    </section>
  );
}
