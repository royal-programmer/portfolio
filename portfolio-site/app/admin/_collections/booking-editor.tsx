"use client";

/**
 * The book-a-call link (netflix.bookCall): a label and an https link. Nothing shows on the site while the link is
 * empty. Publish shows what changes first. It writes the `netflix` setting (draft, then publish) through the same
 * actions as every other setting, so it appears in History and can be reverted there.
 */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Settings } from "@/lib/settings/schema";
import { publishSetting, saveDraft } from "../actions";
import { setAdminDirty } from "../dirty";
import { diffValues } from "../_lib/record-forms";

type Netflix = Settings["netflix"];
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function BookingEditor({ draft, live }: { draft: Netflix; live: Netflix }) {
  const router = useRouter();
  const start = draft.bookCall ?? { label: "Book a call", href: "" };
  const liveCall = live.bookCall ?? { label: "Book a call", href: "" };
  const [call, setCall] = useState(start);
  const [review, setReview] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, go] = useTransition();
  const dirty = !same(call, liveCall);
  const bad = call.href.trim() !== "" && !/^https:\/\/.+/.test(call.href.trim());
  const othersDiffer = !same({ ...draft, bookCall: undefined }, { ...live, bookCall: undefined });
  const diff = diffValues(liveCall, { label: call.label.trim(), href: call.href.trim() });

  const set = (p: Partial<typeof call>) => {
    setAdminDirty(true);
    setCall({ ...call, ...p });
  };
  const publish = () =>
    go(async () => {
      const saved = await saveDraft("netflix", { ...draft, bookCall: { label: call.label.trim(), href: call.href.trim() } });
      if (!saved.ok) return setNote({ ok: false, text: saved.message });
      const pub = await publishSetting("netflix");
      setNote({ ok: pub.ok, text: pub.message });
      if (pub.ok) {
        setReview(false);
        setAdminDirty(false);
        router.refresh();
      }
    });

  return (
    <section className="adm-editor">
      <header className="adm-bar">
        <div className="adm-bar-title">
          <h1>Book a call</h1>
          <code>netflix.bookCall</code>
          <span className={`adm-pill ${liveCall.href ? "is-ok" : "is-warn"}`}>{liveCall.href ? "link is live" : "no link: nothing shows on the site"}</span>
        </div>
      </header>
      <div className="adm-form">
        <label className="adm-field is-block">
          <span className="adm-label">Button text</span>
          <input className="adm-input" value={call.label} maxLength={40} onChange={(e) => set({ label: e.target.value })} />
        </label>
        <label className="adm-field is-block">
          <span className="adm-label">Link (https://, or empty to hide the button)</span>
          <input className={`adm-input${bad ? " is-bad" : ""}`} type="url" value={call.href} onChange={(e) => set({ href: e.target.value })} placeholder="https://cal.com/you/intro" />
        </label>
        {bad ? <p className="adm-note is-bad">The link must start with https://</p> : null}
        {othersDiffer ? <p className="adm-note is-bad">Other Netflix edits are waiting as a draft (see Views). Publishing here puts them live too.</p> : null}
        {review ? (
          <div className="adm-review" role="region" aria-label="What will change">
            <h3 className="adm-h2">What will change</h3>
            <table className="adm-table">
              <tbody>
                {diff.map((d) => (
                  <tr key={d.path}>
                    <td>{d.path}</td>
                    <td className="adm-before">{d.before}</td>
                    <td className="adm-after">{d.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="adm-actions">
              <button type="button" className="adm-btn is-primary" disabled={busy} onClick={publish}>
                {busy ? "Publishing…" : "Yes, publish"}
              </button>
              <button type="button" className="adm-btn" onClick={() => setReview(false)}>
                Keep editing
              </button>
            </div>
          </div>
        ) : null}
        {note ? <p role="status" className={`adm-note ${note.ok ? "is-ok" : "is-bad"}`}>{note.text}</p> : null}
        <div className="adm-actions adm-stickybar">
          <button type="button" className="adm-btn is-primary" disabled={!dirty || bad || busy} onClick={() => setReview(true)}>
            Publish
          </button>
          <button
            type="button"
            className="adm-btn"
            disabled={!dirty}
            onClick={() => {
              setCall(liveCall);
              setReview(false);
              setAdminDirty(false);
            }}
          >
            Revert
          </button>
        </div>
      </div>
    </section>
  );
}
