import { adminClient } from "@/lib/db/client";
import { isMissingTable } from "@/lib/settings/read";
import { HistoryTable, type HistoryRow } from "./history-table";

/** The last 200 changes: who, when, what (a key-level diff summary), with Revert. */
export default async function HistoryPage() {
  let rows: HistoryRow[] = [];
  let note: string | null = null;
  try {
    const { data, error } = await adminClient().from("settings_history").select("id, key, action, before, after, by, at").order("at", { ascending: false }).limit(200);
    if (error) note = isMissingTable(error) ? "No history yet: migration 0011 is not applied." : `Could not read history: ${error.message}`;
    else rows = (data ?? []).map((r) => ({ id: r.id as number, key: r.key as string, action: r.action as string, by: (r.by as string | null) ?? null, at: r.at as string, summary: summarize(r.before, r.after), canRevert: r.before !== null && r.before !== undefined }));
  } catch (e) {
    note = e instanceof Error ? e.message : "Could not read history.";
  }
  return (
    <section className="adm-editor">
      <header className="adm-bar">
        <div className="adm-bar-title">
          <h1>History</h1>
          <code>settings_history</code>
        </div>
        <p className="adm-hint">Revert puts a change&apos;s earlier value into the draft; open that setting and Publish to make it live.</p>
      </header>
      {note ? <p className="adm-note is-bad">{note}</p> : null}
      <HistoryTable rows={rows} />
    </section>
  );
}

/** Top-level fields that differ, e.g. "status, now.lines"; one level deep so it stays readable. */
function summarize(before: unknown, after: unknown): string {
  const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
  if (!isObj(before) || !isObj(after)) return JSON.stringify(before) === JSON.stringify(after) ? "no change" : "value changed";
  const out: string[] = [];
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const b = before[k];
    const a = after[k];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    if (isObj(b) && isObj(a)) {
      for (const c of new Set([...Object.keys(b), ...Object.keys(a)])) if (JSON.stringify(b[c]) !== JSON.stringify(a[c])) out.push(`${k}.${c}`);
    } else out.push(k);
  }
  return out.length ? out.slice(0, 8).join(", ") + (out.length > 8 ? ` +${out.length - 8}` : "") : "no change";
}
