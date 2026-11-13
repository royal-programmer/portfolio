"use client";

/** Small client pieces for the admin home: Revert on a recent change, and Share profile link. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revertToHistory } from "../actions";

export function RevertButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, go] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="adm-btn is-ghost"
        disabled={busy}
        onClick={() => {
          if (!window.confirm("Put the earlier value back into the draft? You still publish it yourself.")) return;
          go(async () => {
            const r = await revertToHistory(id);
            setMsg(r.message);
            router.refresh();
          });
        }}
      >
        Revert
      </button>
      {msg ? (
        <span className="adm-hint" role="status">
          {msg}
        </span>
      ) : null}
    </>
  );
}

export function ShareButton() {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="adm-btn"
        onClick={async () => {
          const url = `${window.location.protocol}//${window.location.host.replace(/^admin\./, "")}/`;
          try {
            if (navigator.share) await navigator.share({ title: "Ratul Roy", url });
            else {
              await navigator.clipboard.writeText(url);
              setMsg(`Copied ${url}`);
            }
          } catch {
            setMsg(url);
          }
        }}
      >
        Share profile link
      </button>
      {msg ? (
        <span className="adm-hint" role="status">
          {msg}
        </span>
      ) : null}
    </>
  );
}
