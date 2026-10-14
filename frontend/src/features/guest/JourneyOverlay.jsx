import { journeyChapters } from "./journey";

export default function JourneyOverlay() {
  return (
    <>
      <div className="mc-journey-grid" aria-hidden="true">
        <svg viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
          {Array.from({ length: 13 }, (_, i) => (
            <path key={i} d={`M${i * 100} 0L${600 + (i - 6) * 230} 700 M0 ${i * 60}H1200`} />
          ))}
          <ellipse cx="600" cy="350" rx="410" ry="240" />
          <ellipse cx="600" cy="350" rx="280" ry="160" />
          <path className="mc-journey-curve" pathLength="1" d="M-50 570C250 570 260 40 600 160S950 660 1250 160" />
        </svg>
      </div>
      <div className="mc-cinematic-copy">
        {journeyChapters.map(([id, label, title, text, formula]) => (
          <article key={id} data-journey-chapter={id} aria-hidden="true" inert>
            <p className="mc-eyebrow">{label}</p>
            <h2>
              {title.split("\n").map((line, i) => (
                <span className="mc-line-mask" key={i}>
                  <span>{line}</span>
                </span>
              ))}
            </h2>
            <p>{text}</p>
            <code>{formula}</code>
          </article>
        ))}
      </div>
      <div className="mc-journey-track" aria-hidden="true">
        <span />
        <b>SCROLL TO EXPLORE</b>
        <span>01 — 04</span>
      </div>
      <a className="mc-journey-skip" href="#collective">
        Skip to the collective ↘
      </a>
    </>
  );
}
