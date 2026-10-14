import { lazy, Suspense, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { usePublicStats, formatStat } from "@/hooks/usePublicStats";
import MathStory from "./MathStory";
import JourneyOverlay from "./JourneyOverlay";
import usePublicMotion from "./usePublicMotion";
import MathSignature from "./MathSignature";

const MobiusScene = lazy(() => import("./MobiusScene"));
const activities = [
  {
    no: "01",
    title: "Find your next challenge.",
    text: "A fresh perspective starts with a good problem. Explore the arena, sharpen your intuition, and build your problem-solving practice.",
    to: "/arena",
    label: "Enter the arena",
    symbol: "∑",
    topic: "THINK / SOLVE / REPEAT",
  },
  {
    no: "02",
    title: "Ideas are better together.",
    text: "From live quizzes to club events, take your curiosity beyond the classroom. Meet the minds that make mathematics a collective pursuit.",
    to: "/events",
    label: "Explore events",
    symbol: "∩",
    topic: "MEET / CONNECT / DISCOVER",
  },
  {
    no: "03",
    title: "Make your progress count.",
    text: "Earn XP, climb the rankings, and celebrate the work behind every solution. A little friendly competition goes a long way.",
    to: "/leaderboard",
    label: "View the leaderboard",
    symbol: "↗",
    topic: "PRACTISE / PROGRESS / COMPETE",
  },
];
const history = [
  ["c. 500 BCE", "Geometry", "A connection between number and shape.", "a² + b² = c²"],
  ["17th century", "Calculus", "A language for a world in motion.", "∫ f(x) dx"],
  [
    "18th century",
    "Analysis",
    "Unexpected ideas, beautifully connected.",
    <span key="euler">
      e<sup>iπ</sup> + 1 = 0
    </span>,
  ],
  ["Today", "New possibilities", "The next question is yours to ask.", "∇L(θ)"],
];

export default function PublicHome() {
  const stats = usePublicStats();
  const root = useRef(null);
  usePublicMotion(root);
  useEffect(() => {
    const elements = root.current.querySelectorAll("[data-mc-reveal]");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches || !("IntersectionObserver" in window)) return;
    const observer = new window.IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("mc-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    elements.forEach((element) => {
      element.classList.add("mc-reveal-ready");
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={root}>
      <div className="mc-journey" data-scene="hero">
        <section className="mc-hero" aria-labelledby="mc-hero-title">
          <div className="mc-hero-copy">
            <p className="mc-eyebrow">
              <span className="mc-dot" /> BMSIT · THE MATHEMATICS CLUB
            </p>
            <h1 id="mc-hero-title">
              <span className="mc-hero-line">Curiosity has</span>
              <br />
              no{" "}
              <span className="mc-limit">
                limits
                <svg viewBox="0 0 310 20" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M3 15 Q130 -5 307 9" />
                </svg>
              </span>
              .
            </h1>
            <p className="mc-hero-description">
              Beyond the textbook.
              <br />
              Into a world of infinite possibilities.
            </p>
            <div className="mc-hero-actions">
              <Link className="mc-button" to="/register">
                Find your people <span aria-hidden="true">↗</span>
              </Link>
              <a className="mc-text-link" href="#collective">
                Explore the collective <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="mc-hero-note">For the love of a good problem.</p>
          </div>
          <div className="mc-hero-art">
            <Suspense
              fallback={
                <div className="mc-scene-loading" aria-hidden="true">
                  ∞
                </div>
              }
            >
              <MobiusScene />
            </Suspense>
          </div>
          <div className="mc-hero-bottom">
            <span>THINK DEEPLY. EXPLORE FREELY.</span>
            <a href="#collective">
              A little further down <span aria-hidden="true">↓</span>
            </a>
            <span>01 / ∞</span>
          </div>
          <JourneyOverlay />
        </section>
      </div>

      <section className="mc-intro mc-section" id="collective" data-mc-reveal>
        <p className="mc-eyebrow">THE COLLECTIVE / A SHARED CURIOSITY</p>
        <div className="mc-intro-grid">
          <h2>
            Mathematics is
            <br />a way of <em>seeing.</em>
          </h2>
          <div>
            <p>
              Patterns in the unexpected. Beauty in the abstract. Possibilities in a problem that hasn’t been solved.
            </p>
            <p>
              We’re Asymptotes, the mathematics club at BMSIT. A community of curious minds exploring what happens when
              we think, question, and create together.
            </p>
            <Link className="mc-text-link" to="/contact">
              Get to know us <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <dl className="mc-stats" aria-label="Live platform totals">
          {[
            ["members", "Active members"],
            ["challenges", "Challenges to explore"],
            ["events", "Collective experiences"],
            ["submissions", "Solutions submitted"],
          ].map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{formatStat(stats[key])}</dd>
            </div>
          ))}
        </dl>
        {!stats.loading && stats.members == null && (
          <p className="mc-stats-note">Live totals are temporarily unavailable.</p>
        )}
      </section>

      <section className="mc-explore mc-section" aria-labelledby="mc-explore-title">
        <div className="mc-section-heading" data-mc-reveal>
          <div>
            <p className="mc-eyebrow">THERE’S MORE THAN ONE WAY IN</p>
            <h2 id="mc-explore-title">Follow your curiosity.</h2>
          </div>
          <p>
            A place to start.
            <br />A reason to keep going.
          </p>
        </div>
        <div className="mc-activities">
          {activities.map((item) => (
            <article key={item.no} className="mc-activity" data-mc-reveal>
              <div className="mc-activity-art" aria-hidden="true">
                <span className="mc-activity-no">{item.no}</span>
                <span className="mc-math-symbol">{item.symbol}</span>
                <span className="mc-art-topic">{item.topic}</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
              <Link className="mc-text-link" to={item.to}>
                {item.label}
                <span aria-hidden="true">↗</span>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <MathStory />
      <section className="mc-lineage mc-section" data-mc-reveal>
        <p className="mc-eyebrow">OLD QUESTIONS. NEW PERSPECTIVES.</p>
        <div className="mc-section-heading">
          <h2>
            Part of a much
            <br />
            longer conversation.
          </h2>
          <p>From the first geometric proofs to the mathematics of intelligence. Every idea begins with another.</p>
        </div>
        <div className="mc-history">
          {history.map(([era, name, note, formula]) => (
            <article key={era}>
              <span className="mc-eyebrow">{era}</span>
              <div className="mc-history-formula" aria-hidden="true">
                {formula}
              </div>
              <h3>{name}</h3>
              <p>{note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mc-community mc-section" data-mc-reveal>
        <div>
          <p className="mc-eyebrow">OFF THE PAGE. INTO THE WORLD.</p>
          <h2>
            The best part?
            <br />
            <em>The people.</em>
          </h2>
          <p>
            Shared discoveries. Spirited competitions. The moments between the equations. This is what the collective
            looks like.
          </p>
          <Link className="mc-text-link" to="/gallery">
            Life at Asymptotes <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <Link className="mc-community-photo" to="/gallery" aria-label="Explore the club photo gallery">
          <img
            src="https://res.cloudinary.com/dd0pler5u/image/upload/f_auto,q_auto,w_1000/v1774176829/in6_jwompu.jpg"
            alt="The Asymptotes community at the club inauguration"
            loading="lazy"
            width="1000"
            height="700"
          />
          <span>
            THE COLLECTIVE, IN REAL LIFE <span aria-hidden="true">↗</span>
          </span>
        </Link>
      </section>

      <section className="mc-invitation mc-section" data-mc-reveal>
        <MathSignature />
        <p className="mc-eyebrow">YOUR NEXT CHAPTER</p>
        <h2>
          You don’t need all the answers.
          <br />
          <em>Just the curiosity.</em>
        </h2>
        <p>Join the collective. Let’s see where your questions take you.</p>
        <Link className="mc-button" to="/register">
          Join Asymptotes <span aria-hidden="true">↗</span>
        </Link>
        <Link className="mc-text-link" to="/login">
          Already one of us? Sign in
        </Link>
      </section>
    </div>
  );
}
