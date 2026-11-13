import "./insights.css";
import { loadEvents } from "@/lib/site/events-server";
import { summarize, type Count } from "@/lib/site/insights";

/**
 * `/admin/site/insights`: what visitors did, counted from `site_events` (migration 0013) and nothing else.
 * Server-rendered; the layout above already requires an admin. 7 / 30 / 90 days, an inline-SVG per-day line,
 * a CSV of the raw rows. No data gives "No data yet", never a made-up number.
 */
const RANGES = [7, 30, 90] as const;

export default async function InsightsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const q = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(q) ? q : 30;
  const { rows, note, capped } = await loadEvents(days);
  const s = summarize(rows, days);
  const none = s.total === 0;
  const pct = (r: number | null) => (r === null ? "no plays yet" : `${Math.round(r * 100)}%`);
  const first = s.funnel[0].sessions;

  return (
    <section className="adm-editor">
      <header className="adm-bar">
        <div className="adm-bar-title">
          <h1>Insights</h1>
          <code>site_events</code>
        </div>
        <div className="ins-range">
          {RANGES.map((r) => (
            <a key={r} className="adm-btn is-ghost" href={`?days=${r}`} aria-current={r === days ? "true" : undefined}>
              Last {r} days
            </a>
          ))}
          <a className="adm-btn" href={`/admin/site/insights/csv?days=${days}`} download>
            Export CSV
          </a>
        </div>
        <p className="adm-hint">Counted in the browser without cookies: no IP, no account, no arguments typed in the terminal. Rows older than 180 days are deleted. Turn counting off in Switches.</p>
      </header>
      {note ? <p className="adm-note is-bad">{note}</p> : null}
      {capped ? <p className="adm-note">Showing the newest {rows.length.toLocaleString()} events for this range.</p> : null}
      {none ? (
        <p className="ins-none">No data yet. Events appear here once visitors open a view (nothing is estimated).</p>
      ) : (
        <div className="ins-grid">
          <div className="ins-card is-wide">
            <h2>Events per day</h2>
            <Spark days={s.days} />
            <p className="ins-none">
              {s.total.toLocaleString()} events in {days} days
            </p>
          </div>
          <Card title="Visits by view" items={s.visits} />
          <Card title="Netflix profile picks" items={s.profilePicks} />
          <Card title="Top titles opened" items={s.topTitles} />
          <div className="ins-card">
            <h2>Play completion</h2>
            <div className="ins-big">{pct(s.completion.rate)}</div>
            <p className="ins-none">
              {s.completion.completes} played to the end of {s.completion.starts} started
            </p>
          </div>
          <div className="ins-card">
            <h2>Conversion funnel (by session)</h2>
            <ul className="ins-list">
              {s.funnel.map((f) => (
                <li key={f.label}>
                  <span>{f.label}</span>
                  <span>
                    {f.sessions}
                    {first ? ` · ${Math.round((f.sessions / first) * 100)}%` : ""}
                  </span>
                  <span className="ins-bar" aria-hidden>
                    <i style={{ width: `${first ? (f.sessions / first) * 100 : 0}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <Card title="Top skills opened" items={s.skills} />
          <Card title="Referrers (host only)" items={s.referrers} empty="No referrers recorded: direct visits and hidden referrers are not counted." />
          <Card title="Phone and desktop" items={s.devices} />
          <Card title="Top terminal commands" items={s.commands} />
        </div>
      )}
    </section>
  );
}

function Card({ title, items, empty = "Nothing yet." }: { title: string; items: Count[]; empty?: string }) {
  const max = items[0]?.n ?? 0;
  return (
    <div className="ins-card">
      <h2>{title}</h2>
      {items.length ? (
        <ul className="ins-list">
          {items.map((c) => (
            <li key={c.key}>
              <span title={c.key}>{c.key}</span>
              <span>{c.n}</span>
              <span className="ins-bar" aria-hidden>
                <i style={{ width: `${max ? (c.n / max) * 100 : 0}%` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ins-none">{empty}</p>
      )}
    </div>
  );
}

/** A plain SVG line over the day buckets: the real counts, scaled to the tallest day. */
function Spark({ days }: { days: { day: string; n: number }[] }) {
  const W = 600;
  const H = 60;
  const max = Math.max(1, ...days.map((d) => d.n));
  const x = (i: number) => (days.length > 1 ? (i / (days.length - 1)) * W : W / 2);
  const y = (n: number) => H - 3 - (n / max) * (H - 6);
  const line = days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d.n).toFixed(1)}`).join(" ");
  const label = `Events per day, ${days[0]?.day} to ${days[days.length - 1]?.day}, peak ${max}`;
  return (
    <svg className="ins-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path className="ins-area" d={`${line} L${W} ${H} L0 ${H} Z`} />
      <path d={line} />
    </svg>
  );
}
