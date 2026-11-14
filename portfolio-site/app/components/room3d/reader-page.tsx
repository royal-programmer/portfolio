import { PersonaLink } from "@/lib/site/persona-link";
import type { RoomContent } from "@/lib/room3d/content";

/**
 * Reader mode (round 36): the room's content as a plain page. A server component: the real text is in the HTML, so
 * search engines, screen readers and a browser with no WebGL (or no JavaScript) all get it. Semantic headings,
 * links and lists only; no 3D, no motion. The same `RoomContent` feeds the room's boards and cards, so the two
 * cannot say different things.
 */
export function ReaderPage({ content: c, persona }: { content: RoomContent; persona: "engineer" }) {
  const h = c.hire;
  return (
    <article className="rx-reader-main" aria-label={`${c.name}, in plain text`}>
      <header>
        <h1>{c.name}</h1>
        <p className="rx-lead">{[c.title, c.location].filter(Boolean).join(" · ")}</p>
        <nav aria-label="Sections">
          <ul>
            {[
              ["about", "About"],
              ["projects", "Projects"],
              ["skills", "Skills"],
              ["experience", "Experience"],
              ["certificates", "Certificates"],
              ["education", "Education"],
              ["moments", "Key moments"],
              ["contact", "Contact"],
            ].map(([id, label]) => (
              <li key={id}>
                <a href={`#reader-${id}`}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section id="reader-about" aria-labelledby="reader-about-h">
        <h2 id="reader-about-h">About</h2>
        {c.about ? c.about.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>) : <p>Nothing here yet.</p>}
        {c.now ? (
          <>
            <h3>Now · {c.now.month}</h3>
            <ul>
              {c.now.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section id="reader-projects" aria-labelledby="reader-projects-h">
        <h2 id="reader-projects-h">Projects</h2>
        {c.projects.length === 0 ? <p>Nothing public yet.</p> : null}
        {c.projects.map((p) => (
          <div key={p.slug} className="rx-item">
            <h3>
              <PersonaLink persona={persona} path={`/${p.slug}`}>
                {p.title}
              </PersonaLink>{" "}
              <small>({p.statusLabel})</small>
            </h3>
            {p.role || p.year ? <p>{[p.role, p.year].filter(Boolean).join(" · ")}</p> : null}
            {p.summary ? <p>{p.summary}</p> : null}
            {p.stack.length ? <p>Stack: {p.stack.join(", ")}</p> : null}
            {p.deployedUrl || p.repoUrl ? (
              <p>
                {p.deployedUrl ? <a href={p.deployedUrl}>Live site</a> : null}
                {p.deployedUrl && p.repoUrl ? " · " : null}
                {p.repoUrl ? <a href={p.repoUrl}>Code</a> : null}
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section id="reader-skills" aria-labelledby="reader-skills-h">
        <h2 id="reader-skills-h">Skills</h2>
        {c.skills.length === 0 ? <p>No skills listed yet.</p> : null}
        {c.skills.map((g) => (
          <div key={g.group} className="rx-item">
            <h3>{g.group}</h3>
            <p>{g.items.join(", ")}</p>
          </div>
        ))}
      </section>

      <section id="reader-experience" aria-labelledby="reader-experience-h">
        <h2 id="reader-experience-h">Experience</h2>
        {c.experience.length === 0 ? <p>Nothing listed yet.</p> : null}
        {c.experience.map((e) => (
          <div key={`${e.role}-${e.period}`} className="rx-item">
            <h3>
              {e.role}, {e.company}
            </h3>
            <p>{e.period}</p>
            {e.headline ? <p>{e.headline}</p> : null}
            {e.bullets.length ? (
              <ul>
                {e.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </section>

      <section id="reader-certificates" aria-labelledby="reader-certificates-h">
        <h2 id="reader-certificates-h">Certificates</h2>
        {c.credentials.filter((x) => x.kind === "certificate").length === 0 ? <p>None yet.</p> : null}
        {c.credentials
          .filter((x) => x.kind === "certificate")
          .map((x) => (
            <div key={x.id} className="rx-item">
              <h3>{x.title}</h3>
              <p>
                {x.issuer}
                {x.verify ? (
                  <>
                    {" · "}
                    <a href={x.verify}>Verify</a>
                  </>
                ) : null}
              </p>
            </div>
          ))}
      </section>

      <section id="reader-education" aria-labelledby="reader-education-h">
        <h2 id="reader-education-h">Education</h2>
        {c.credentials.filter((x) => x.kind === "education").length === 0 ? <p>None yet.</p> : null}
        {c.credentials
          .filter((x) => x.kind === "education")
          .map((x) => (
            <div key={x.id} className="rx-item">
              <h3>{x.title}</h3>
              <p>{[x.issuer, x.year].filter(Boolean).join(" · ")}</p>
              {x.note ? <p>{x.note}</p> : null}
            </div>
          ))}
      </section>

      <section id="reader-moments" aria-labelledby="reader-moments-h">
        <h2 id="reader-moments-h">Key moments</h2>
        {c.moments.length === 0 ? <p>None yet.</p> : null}
        <ul>
          {c.moments.map((m) => (
            <li key={m.id}>
              <time dateTime={m.date.slice(0, 10)}>{m.date.slice(0, 10)}</time>: {m.subject}
              {m.grade || m.tag ? ` (${m.grade ?? m.tag})` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section id="reader-contact" aria-labelledby="reader-contact-h">
        <h2 id="reader-contact-h">Contact</h2>
        {h.line ? <p>{h.line}</p> : null}
        <ul>
          {h.mail ? (
            <li>
              <a href={h.mail}>Email</a>
            </li>
          ) : null}
          {h.book ? (
            <li>
              <a href={h.book.href}>{h.book.label}</a>
            </li>
          ) : null}
          <li>
            <a href={h.resume}>Résumé (PDF)</a>
          </li>
          {h.links.map((l) => (
            <li key={l.label}>
              <a href={l.href}>{l.label}</a>
            </li>
          ))}
          <li>
            <PersonaLink persona={persona} path="/netflix">
              Fit check (paste a job description, in the Netflix view)
            </PersonaLink>
          </li>
        </ul>
      </section>
    </article>
  );
}
