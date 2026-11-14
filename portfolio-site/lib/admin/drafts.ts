/**
 * Pure draft helpers for the admin forms: which copy wins when the browser and the server both hold
 * a draft, the "Draft from your phone, 2 h ago" line, the key and the device label. No imports, so the
 * checks can run them (scripts/admin-host-check.mjs).
 */

export type DraftCopy = { data: unknown; updatedAt: string; by?: string | null };
export type PickedDraft = { source: "server" | "local"; data: unknown; updatedAt: string; by: string | null };

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) || 0 : 0);

/**
 * The draft to offer: the newer of the server copy and the browser copy. A draft not newer than the
 * saved record (`savedAt`) is stale (the record moved on) and is dropped.
 */
export function pickDraft(server: DraftCopy | null, local: DraftCopy | null, savedAt: string | null): PickedDraft | null {
  const s = server ? { source: "server" as const, data: server.data, updatedAt: server.updatedAt, by: server.by ?? null } : null;
  const l = local ? { source: "local" as const, data: local.data, updatedAt: local.updatedAt, by: null } : null;
  const best = s && l ? (ms(l.updatedAt) > ms(s.updatedAt) ? l : s) : (s ?? l);
  if (!best) return null;
  if (savedAt && ms(best.updatedAt) <= ms(savedAt)) return null;
  return best;
}

/** "Draft from your phone, 2 h ago". */
export function draftNotice(d: PickedDraft, now: number = Date.now()): string {
  const sec = Math.max(0, Math.round((now - ms(d.updatedAt)) / 1000));
  const ago = sec < 15 ? "just now" : sec < 60 ? `${sec} s ago` : sec < 3600 ? `${Math.round(sec / 60)} min ago` : sec < 86400 ? `${Math.round(sec / 3600)} h ago` : `${Math.round(sec / 86400)} days ago`;
  const where = d.source === "local" && !d.by ? "this browser" : d.by ? `your ${d.by}` : "another device";
  return `Draft from ${where}, ${ago}`;
}

export const draftKey = (type: string, id: string) => `${type}:${id}`;

/** A short label for the device that saved a draft. */
export const deviceLabel = (userAgent: string): "phone" | "laptop" => (/Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) ? "phone" : "laptop");
