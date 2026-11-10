/**
 * Built résumés, kept in memory for ten minutes (at most twenty) so `/resume.pdf?build=<token>` can serve
 * what `/api/resume/build` just rendered. On `globalThis`, so the two routes share it even when the
 * bundler gives each route its own copy of this module. Server only.
 */
import { randomBytes } from "node:crypto";

type Built = { bytes: Uint8Array; at: number; date: string };

const TTL = 10 * 60 * 1000;
const MAX = 20;
const KEY = "__resumeBuilds";
const g = globalThis as unknown as Record<string, Map<string, Built> | undefined>;
const store = (g[KEY] ??= new Map<string, Built>());

export const TOKEN_RE = /^[a-f0-9]{32}$/;

function sweep(now: number) {
  for (const [k, v] of store) if (now - v.at > TTL) store.delete(k);
  // A Map keeps insertion order, so the first keys are the least recently used.
  while (store.size > MAX) store.delete(store.keys().next().value as string);
}

export function keepBuild(bytes: Uint8Array): string {
  const now = Date.now();
  sweep(now);
  const token = randomBytes(16).toString("hex");
  store.set(token, { bytes, at: now, date: new Date(now).toISOString().slice(0, 10) });
  sweep(now);
  return token;
}

export function takeBuild(token: string): Built | null {
  sweep(Date.now());
  const b = store.get(token);
  if (!b) return null;
  // Re-insert so a build in use is the last to be evicted (its age still counts toward the ten minutes).
  store.delete(token);
  store.set(token, b);
  return b;
}
