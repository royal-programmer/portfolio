"use client";

/**
 * The cards that open over the full-screen room (round 36): long content in plain DOM, so it is readable at 393 px
 * and by a screen reader. A side card on a wide screen, a bottom sheet on a phone. The room stays behind it; focus is
 * trapped inside, Esc or "Back to the room" closes it and focus returns to what opened it. Every word comes from
 * `RoomContent`; the skill evidence is the same builder the terminal and the Netflix view use.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { RoomContent, PanelId } from "@/lib/room3d/content";
import type { SkillEvidence } from "@/lib/site/skill-evidence";

export type PanelState = { id: PanelId; item: number | null };

export type World = { slug: string; label: string; color: string; href: string; cross: boolean };

type Props = {
  panel: PanelState;
  content: RoomContent;
  worlds: World[];
  landing: { href: string; cross: boolean };
  /** The page that opens the Netflix view (where the Fit check lives), and a project's page. */
  hrefs: { fit: string; project: (slug: string) => string };
  evidenceOf: (skill: string) => SkillEvidence | null;
  onItem: (item: number | null) => void;
  onClose: () => void;
  onWorld: (w: { href: string; cross: boolean }, hub: boolean) => void;
};

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

const TITLES: Record<PanelId, string> = {
  terminal: "Terminal",
  projects: "Projects",
  skills: "Skills",
  tv: "Project reel",
  credentials: "Certificates and education",
  moments: "Key moments",
  worlds: "The other worlds",
  hire: "Hire me",
  now: "Now",
};

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="rx-chips" aria-label="Stack">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  );
}

function Row({ title, sub, tag, onClick, href }: { title: string; sub?: string; tag?: string; onClick?: () => void; href?: string }) {
  const inner = (
    <>
      <span className="rx-row-main">
        <span className="rx-row-title">{title}</span>
        {sub ? <span className="rx-row-sub">{sub}</span> : null}
      </span>
      {tag ? <span className="rx-tag">{tag}</span> : null}
    </>
  );
  if (href) {
    return (
      <a className="rx-row" href={href} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  if (!onClick) return <div className="rx-row rx-row-static">{inner}</div>;
  return (
    <button type="button" className="rx-row" onClick={onClick}>
      {inner}
    </button>
  );
}

function Back({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="rx-link" onClick={onClick}>
      <span aria-hidden>←</span> {children}
    </button>
  );
}

export function RoomPanel(p: Props) {
  const { panel, content: c } = p;
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  // Focus goes in on open and returns on close; Tab stays inside; Esc closes.
  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = ref.current;
    root?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        p.onClose();
        return;
      }
      if (e.key !== "Tab" || !root) return;
      const f = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (f.length === 0) {
        e.preventDefault();
        return;
      }
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!root.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      const o = opener.current;
      if (o && document.contains(o)) o.focus({ preventScroll: true });
    };
    // The opener and the trap are set up once per open card; the close callback is stable for the card's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const evidence = useMemo(() => (skill ? p.evidenceOf(skill) : null), [skill, p]);
  const sel = panel.item;
  let body: ReactNode = null;
  let title = TITLES[panel.id];

  if (panel.id === "projects") {
    const pr = sel !== null ? c.projects[sel] : null;
    if (pr) {
      title = pr.title;
      body = (
        <>
          <Back onClick={() => p.onItem(null)}>All projects</Back>
          <p className="rx-meta">
            <span className="rx-tag" data-status={pr.status}>
              {pr.statusLabel}
            </span>
            {[pr.role, pr.year].filter(Boolean).join(" · ")}
          </p>
          {pr.summary ? <p>{pr.summary}</p> : null}
          {pr.stack.length ? <Chips items={pr.stack} /> : null}
          <div className="rx-actions">
            <a className="rx-btn rx-btn-main" href={p.hrefs.project(pr.slug)}>
              Open the project page
            </a>
            {pr.deployedUrl ? (
              <a className="rx-btn" href={pr.deployedUrl} target="_blank" rel="noopener noreferrer">
                Live site
              </a>
            ) : null}
            {pr.repoUrl ? (
              <a className="rx-btn" href={pr.repoUrl} target="_blank" rel="noopener noreferrer">
                Code
              </a>
            ) : null}
          </div>
        </>
      );
    } else {
      body =
        c.projects.length === 0 ? (
          <p>Nothing public yet.</p>
        ) : (
          <div className="rx-list">
            {c.projects.map((x, i) => (
              <Row key={x.slug} title={x.title} sub={x.summary} tag={x.statusLabel} onClick={() => p.onItem(i)} />
            ))}
          </div>
        );
    }
  } else if (panel.id === "skills") {
    if (skill && evidence) {
      title = evidence.name;
      body = (
        <>
          <Back onClick={() => setSkill(null)}>All skills</Back>
          {evidence.source === "none" ? <p>No project, role or certificate is linked to this yet.</p> : null}
          {evidence.projects.length ? (
            <section>
              <h3 className="rx-h">Projects</h3>
              <div className="rx-list">
                {evidence.projects.map((x) => (
                  <Row key={x.slug} title={x.title} sub={x.line} href={p.hrefs.project(x.slug)} />
                ))}
              </div>
            </section>
          ) : null}
          {evidence.work.length ? (
            <section>
              <h3 className="rx-h">Work</h3>
              {evidence.work.map((w) => (
                <div key={`${w.role}-${w.period}`} className="rx-block">
                  <strong>
                    {w.role}, {w.company}
                  </strong>
                  <span className="rx-row-sub">{w.period}</span>
                  {w.bullets.length ? (
                    <ul className="rx-bullets">
                      {w.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </section>
          ) : null}
          {evidence.certs.length ? (
            <section>
              <h3 className="rx-h">Certificates</h3>
              <div className="rx-list">
                {evidence.certs.map((x) => (
                  <Row key={`${x.name}-${x.issuer}`} title={x.name} sub={x.issuer} tag={x.verify ? "verify" : undefined} href={x.verify} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      );
    } else {
      body =
        c.skills.length === 0 ? (
          <p>No skills listed yet.</p>
        ) : (
          <>
            {c.skills.map((g, gi) => (
              <section key={g.group} className={sel === gi ? "rx-hot" : undefined}>
                <h3 className="rx-h">{g.group}</h3>
                <ul className="rx-chips rx-chips-btn">
                  {g.items.map((it) => (
                    <li key={it}>
                      <button type="button" onClick={() => setSkill(it)}>
                        {it}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <p className="rx-note">Pick a skill to see the projects, work and certificates behind it.</p>
          </>
        );
    }
  } else if (panel.id === "credentials") {
    body = c.credentials.length === 0 ? <p>None yet.</p> : (
      <div className="rx-list">
        {c.credentials.map((x, i) => (
          <div key={x.id} className={`rx-card${sel === i ? " rx-hot" : ""}`}>
            <span className="rx-row-title">{x.title}</span>
            <span className="rx-row-sub">
              {x.issuer}
              {x.year ? ` · ${x.year}` : ""}
            </span>
            {x.note ? <span className="rx-row-sub">{x.note}</span> : null}
            <span className="rx-tag">{x.kind}</span>
            {x.verify ? (
              <a className="rx-link" href={x.verify} target="_blank" rel="noopener noreferrer">
                Verify this credential
              </a>
            ) : null}
          </div>
        ))}
      </div>
    );
  } else if (panel.id === "moments") {
    body = c.moments.length === 0 ? <p>None yet.</p> : (
      <ol className="rx-timeline">
        {c.moments.map((m, i) => (
          <li key={m.id} className={sel === i ? "rx-hot" : undefined}>
            <span className="rx-row-sub">{m.date.slice(0, 10)}</span>
            <span className="rx-row-title">{m.subject}</span>
            {m.grade || m.tag ? <span className="rx-tag">{m.grade ?? m.tag}</span> : null}
          </li>
        ))}
      </ol>
    );
  } else if (panel.id === "tv") {
    const clips = c.projects.flatMap((x) => x.clips.map((k) => ({ ...k, project: x })));
    body =
      clips.length === 0 ? (
        <p>No clips yet. The screen shows the worlds instead.</p>
      ) : (
        <div className="rx-list">
          {clips.map((k) => (
            <Row key={`${k.project.slug}-${k.id}`} title={k.label} sub={k.project.title} href={p.hrefs.project(k.project.slug)} />
          ))}
        </div>
      );
  } else if (panel.id === "worlds") {
    body = (
      <>
        <div className="rx-worlds">
          {p.worlds.map((w) => (
            <button key={w.slug} type="button" className="rx-world" style={{ ["--w" as string]: w.color }} onClick={() => p.onWorld(w, false)}>
              {w.label}
            </button>
          ))}
        </div>
        <div className="rx-actions">
          <button type="button" className="rx-btn" onClick={() => p.onWorld(p.landing, true)}>
            Landing page
          </button>
        </div>
      </>
    );
  } else if (panel.id === "hire") {
    const h = c.hire;
    body = (
      <>
        {h.line ? <p>{h.line}</p> : null}
        <dl className="rx-dl">
          {h.stackCore.length ? (
            <>
              <dt>Core stack</dt>
              <dd>{h.stackCore.join(", ")}</dd>
            </>
          ) : null}
        </dl>
        <div className="rx-actions">
          {h.mail ? (
            <a className="rx-btn rx-btn-main" href={h.mail}>
              Email me
            </a>
          ) : null}
          {h.book ? (
            <a className="rx-btn" href={h.book.href} target="_blank" rel="noopener noreferrer">
              {h.book.label}
            </a>
          ) : null}
          <a className="rx-btn" href={h.resume} target="_blank" rel="noopener noreferrer">
            Résumé (PDF)
          </a>
          <a className="rx-btn" href={p.hrefs.fit}>
            Fit check
          </a>
        </div>
        <p className="rx-note">Fit check lives in the Netflix view: paste a job description and see how it matches, in your browser only.</p>
        {h.proof.length ? (
          <section>
            <h3 className="rx-h">Proof</h3>
            <ul className="rx-bullets">
              {h.proof.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {h.links.length ? (
          <section>
            <h3 className="rx-h">Elsewhere</h3>
            <div className="rx-list">
              {h.links.map((l) => (
                <Row key={l.label} title={l.label} sub={l.href.replace(/^https:\/\//, "")} href={l.href} />
              ))}
            </div>
          </section>
        ) : null}
      </>
    );
  } else if (panel.id === "now") {
    body = c.now ? (
      <>
        <p className="rx-row-sub">{c.now.month}</p>
        <ul className="rx-bullets">
          {c.now.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </>
    ) : (
      <p>Nothing posted this month.</p>
    );
  }

  return (
    <div ref={ref} className="rx-panel" role="dialog" aria-modal="true" aria-labelledby="rx-panel-title" tabIndex={-1} data-panel={panel.id}>
      <header className="rx-panel-head">
        <h2 id="rx-panel-title">{title}</h2>
        <button type="button" className="rx-close" onClick={p.onClose} aria-label="Close and go back to the room">
          <span aria-hidden>×</span>
        </button>
      </header>
      <div className="rx-panel-body">{body}</div>
      <footer className="rx-panel-foot">
        <button type="button" className="rx-btn" onClick={p.onClose}>
          Back to the room
        </button>
      </footer>
    </div>
  );
}
