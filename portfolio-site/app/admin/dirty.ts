"use client";

/** A tiny client-side flag so the rail can ask before navigating away from unsaved edits. */
let dirty = false;
export const setAdminDirty = (v: boolean) => {
  dirty = v;
};
export const adminIsDirty = () => dirty;
