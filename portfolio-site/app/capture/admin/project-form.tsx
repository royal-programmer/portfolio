"use client";

import { useActionState } from "react";
import { createProject, type ActionState } from "../actions";
import { MediaUploader } from "./media-uploader";

const inputCls = "rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2";
const labelCls = "flex flex-col gap-1 text-sm";

export function ProjectForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createProject, {});

  // Once the project exists we have its id — reveal the image uploader for it.
  if (state.ok && state.entryId) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-green-400">
          Project created. Add images below, then reload to start another.
        </p>
        <MediaUploader entryId={state.entryId} />
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="self-start rounded-md border border-neutral-700 px-3 py-2 text-sm"
        >
          Create another project
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className={labelCls}>
        Title *
        <input name="title" required className={inputCls} />
      </label>
      <label className={labelCls}>
        Slug <span className="text-neutral-500">(optional — derived from title)</span>
        <input name="slug" placeholder="my-project" className={inputCls} />
      </label>
      <label className={labelCls}>
        Summary
        <input name="summary" className={inputCls} />
      </label>
      <label className={labelCls}>
        Body (markdown)
        <textarea name="body" rows={4} className={inputCls} />
      </label>
      <label className={labelCls}>
        Role
        <input name="role" placeholder="Full-stack" className={inputCls} />
      </label>
      <label className={labelCls}>
        Tech stack <span className="text-neutral-500">(comma-separated)</span>
        <input name="techStack" placeholder="Next.js, TypeScript, Supabase" className={inputCls} />
      </label>
      <label className={labelCls}>
        Deployed URL
        <input name="deployedUrl" type="url" className={inputCls} />
      </label>
      <label className={labelCls}>
        Repo URL
        <input name="repoUrl" type="url" className={inputCls} />
      </label>
      <label className={labelCls}>
        Demo video URL
        <input name="demoVideoUrl" type="url" className={inputCls} />
      </label>
      <label className={labelCls}>
        Visibility
        <select name="visibility" defaultValue="private" className={inputCls}>
          <option value="private">Private</option>
          <option value="unlisted">Unlisted</option>
          <option value="public">Public</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="featured" type="checkbox" /> Featured
      </label>

      {state.error ? <p className="text-sm text-red-400">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-green-400">Project created.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Create project"}
      </button>
    </form>
  );
}
