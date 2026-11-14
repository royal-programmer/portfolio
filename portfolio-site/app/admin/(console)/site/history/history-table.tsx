"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revertToHistory } from "../../../actions";
import { LocalTime } from "../../../local-time";

export type HistoryRow = { id: number; key: string; action: string; by: string | null; at: string; summary: string; canRevert: boolean };

export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  if (!rows.length) return <p className="adm-hint">No changes recorded yet.</p>;
  return (
    <>
      {notice ? (
        <p role="status" className={notice.ok ? "adm-note is-ok" : "adm-note is-bad"}>
          {notice.text}
        </p>
      ) : null}
      <div className="adm-tablewrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>when</th>
              <th>key</th>
              <th>action</th>
              <th>who</th>
              <th>changed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><LocalTime iso={r.at} /></td>
                <td>
                  <code>{r.key}</code>
                </td>
                <td>{r.action}</td>
                <td>{r.by ? r.by.slice(0, 8) : "-"}</td>
                <td>{r.summary}</td>
                <td>
                  <button
                    type="button"
                    className="adm-btn is-ghost"
                    disabled={pending || !r.canRevert}
                    onClick={() =>
                      start(async () => {
                        const res = await revertToHistory(r.id);
                        setNotice({ ok: res.ok, text: res.message });
                        router.refresh();
                      })
                    }
                  >
                    Revert
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
