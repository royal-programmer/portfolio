"use client";

/** Small client pieces for the admin home: Revert on a recent change, and Share profile link. */
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revertToHistory } from "../actions";
import { forLink, FOR_MAX, typeFor } from "@/lib/site/netflix-for";

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

/** The engineer world's origin as seen from here: `admin.<root>` maps to `code.<root>`; an unrouted host serves it under /engineer. */
export function engineerOrigin(loc: { protocol: string; host: string; origin: string }): string {
  return /^admin\./.test(loc.host) ? `${loc.protocol}//${loc.host.replace(/^admin\./, "code.")}` : `${loc.origin}/engineer`;
}

/** Share profile link: a small name field makes the `?for=` link, like the Profiles menu on the site. */
export function ShareButton() {
  const [name, setName] = useState("");
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const make = async () => {
    const url = forLink(engineerOrigin(window.location), "recruiter", name);
    setLink(url);
    try {
      if (navigator.share) await navigator.share({ title: "Ratul Roy", url });
      else {
        await navigator.clipboard.writeText(url);
        setMsg("Copied.");
      }
    } catch {
      setMsg("Select the link and copy it.");
    }
  };
  return (
    <span className="adm-sharebox">
      <input className="adm-input is-narrow" aria-label="Name for the link (optional)" placeholder="Name, e.g. Priya" maxLength={FOR_MAX} value={name} onChange={(e) => setName(typeFor(e.target.value))} />
      <button type="button" className="adm-btn" onClick={make}>
        Share profile link
      </button>
      {link ? <input className="adm-input" readOnly aria-label="The link" value={link} onFocus={(e) => e.currentTarget.select()} /> : null}
      {msg ? (
        <span className="adm-hint" role="status">
          {msg}
        </span>
      ) : null}
    </span>
  );
}

const STAGES = ["collect", "layout", "fonts", "render", "verify"] as const;

/** Build résumé: runs the real pipeline (`/api/resume/build`, the same one as `resume --build`) and shows each stage. */
export function BuildResume({ submittedOn }: { submittedOn: string }) {
  const [state, setState] = useState<{ phase: "idle" | "running" | "done" | "error"; stage: number; text: string; token?: string; builtAt?: string }>({ phase: "idle", stage: 0, text: "" });
  const run = () => {
    setState({ phase: "running", stage: 0, text: "Starting…" });
    const es = new EventSource("/api/resume/build");
    const fail = (text: string) => {
      es.close();
      setState((c) => ({ ...c, phase: "error", text }));
    };
    for (const [i, name] of STAGES.entries()) {
      es.addEventListener(name, () => setState((c) => (c.phase === "running" ? { ...c, stage: i + 1, text: `${name} done (${i + 1} of ${STAGES.length})` } : c)));
    }
    es.addEventListener("done", (e) => {
      es.close();
      const d = JSON.parse((e as MessageEvent).data) as { token: string; bytes: number; pages: number; ms: number };
      setState({ phase: "done", stage: STAGES.length, text: `Built: ${d.pages} page${d.pages === 1 ? "" : "s"}, ${Math.round(d.bytes / 1024)} KB, ${(d.ms / 1000).toFixed(1)} s.`, token: d.token, builtAt: new Date().toISOString() });
    });
    es.addEventListener("error", (e) => {
      const raw = (e as MessageEvent).data;
      let text = "The build failed or the connection dropped.";
      try {
        if (raw) text = `The build failed at ${JSON.parse(raw).stage}: ${JSON.parse(raw).message}`;
      } catch {
        /* keep the generic text */
      }
      fail(text);
    });
  };
  return (
    <span className="adm-buildbox">
      <button type="button" className="adm-btn" onClick={run} disabled={state.phase === "running"}>
        {state.phase === "running" ? "Building…" : "Build résumé"}
      </button>
      {state.phase !== "idle" ? (
        <span role="status" className={`adm-hint${state.phase === "error" ? " adm-bad" : ""}`}>
          {state.phase === "running" ? <progress max={STAGES.length} value={state.stage} aria-label="Résumé build progress" /> : null} {state.text}
          {state.phase === "done" && state.token ? (
            <>
              {" "}
              <a href={`/resume.pdf?build=${state.token}`} target="_blank" rel="noreferrer">
                Open the new PDF
              </a>{" "}
              (built {new Date(state.builtAt ?? "").toLocaleString()}).
            </>
          ) : null}
        </span>
      ) : null}
      <span className="adm-hint">Submitted file: {submittedOn}.</span>
    </span>
  );
}
