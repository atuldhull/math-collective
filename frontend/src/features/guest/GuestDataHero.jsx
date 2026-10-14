export function GuestDataHero({ title, subtitle, description }) {
  return (
    <header className="mc-data-hero">
      <p className="mc-eyebrow">{subtitle || "THE COLLECTIVE"}</p>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}

export function GuestEventHero({ stats, onExplore }) {
  return (
    <header className="mc-data-hero">
      <p className="mc-eyebrow">EVENTS & COMPETITIONS</p>
      <h1>
        Event <em>Timeline</em>
      </h1>
      <p>Live quizzes, hackathons, workshops, and competitions. Register, compete, and climb the ranks.</p>
      <dl className="mc-event-totals">
        {[
          ["Upcoming", stats.upcoming],
          ["Live now", stats.live],
          ["Total events", stats.total],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? 0}</dd>
          </div>
        ))}
      </dl>
      <button className="mc-button" onClick={onExplore}>
        Explore events <span aria-hidden="true">↓</span>
      </button>
    </header>
  );
}
