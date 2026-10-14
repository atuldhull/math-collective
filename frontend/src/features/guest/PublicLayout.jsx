import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import AnnouncementBar from "@/components/AnnouncementBar";
import InstallPwaButton from "@/components/ui/InstallPwaButton";
import { useOrgBranding } from "@/components/OrgThemeProvider";
import "./public.css";
import { PublicThemeSelector } from "./PublicTheme";

const links = [
  ["/arena", "Arena"],
  ["/events", "Events"],
  ["/leaderboard", "Leaderboard"],
  ["/gallery", "Gallery"],
];

export function PublicBrand() {
  const { orgName } = useOrgBranding();
  return (
    <Link className="mc-brand" to="/" aria-label="Asymptotes home">
      <img src="/app/brand/club-logo-128.webp" width="48" height="48" alt="" />
      <span>
        Asymptotes<small>{orgName || "THE MATHEMATICS COLLECTIVE"}</small>
      </span>
    </Link>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const toggle = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return (
    <header className="mc-header">
      <div className="mc-header-inner">
        <PublicBrand />
        <nav className="mc-desktop-nav" aria-label="Main navigation">
          {links.map(([to, label]) => (
            <NavLink key={to} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mc-header-actions">
          <PublicThemeSelector />
          <Link className="mc-signin" to="/login">
            Sign in <span aria-hidden="true">↗</span>
          </Link>
          <Link className="mc-button mc-button-small" to="/register">
            Join the collective
          </Link>
          <button
            ref={toggle}
            className="mc-menu-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mc-mobile-nav"
            onClick={() => setOpen(!open)}
          >
            {open ? "−" : "+"}
          </button>
        </div>
      </div>
      <nav id="mc-mobile-nav" className="mc-mobile-nav" hidden={!open} aria-label="Mobile navigation">
        <NavLink to="/">Home</NavLink>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to}>
            {label}
            <span aria-hidden="true">↗</span>
          </NavLink>
        ))}
        <Link to="/contact">Contact</Link>
        <Link to="/login">Sign in</Link>
        <Link to="/register">Join the collective ↗</Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mc-footer">
      <div className="mc-footer-top">
        <PublicBrand />
        <p>
          Different minds.
          <br />
          Infinite possibilities.
        </p>
      </div>
      <div className="mc-footer-bottom">
        <span>© {new Date().getFullYear()} Asymptotes · BMSIT</span>
        <nav aria-label="Footer navigation">
          {[...links, ["/problems", "Problems"], ["/roadmaps", "Roadmaps"], ["/contact", "Contact"]].map(
            ([to, label]) => (
              <Link key={to} to={to}>
                {label}
              </Link>
            ),
          )}
        </nav>
        <InstallPwaButton />
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="mc-public">
      <a className="mc-skip" href="#mc-main">
        Skip to content
      </a>
      <AnnouncementBar />
      <Header />
      <main
        id="mc-main"
        tabIndex={-1}
        data-mc-page={pathname.split("/")[1] || "home"}
        data-mc-route={pathname}
        className={pathname === "/" ? "mc-home-main" : "mc-existing-page"}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function PublicAuthLayout() {
  return (
    <div className="mc-public">
      <a className="mc-skip" href="#mc-main">
        Skip to content
      </a>
      <Header />
      <div className="mc-auth-layout">
        <aside className="mc-auth-story">
          <p className="mc-eyebrow">A PLACE FOR CURIOUS MINDS</p>
          <h2>
            Good questions.
            <br />
            Great company.
            <br />
            <em>Infinite potential.</em>
          </h2>
          <p>
            One collective for the problems that fascinate you, the ideas that challenge you, and the people who get it.
          </p>
          <div className="mc-auth-equation" aria-label="Euler’s identity">
            e<sup>iπ</sup> + 1 = 0
          </div>
          <details>
            <summary>What is Asymptotes?</summary>
            <p>The mathematics club at BMSIT. Solve challenges, compete in live quizzes, and explore ideas together.</p>
          </details>
          <details>
            <summary>Is it free to join?</summary>
            <p>Students can register for free. Organisations choose a plan based on their needs.</p>
          </details>
          <details>
            <summary>Can my university join?</summary>
            <p>
              <Link to="/contact">Contact our team</Link> to discuss your organisation.
            </p>
          </details>
        </aside>
        <main id="mc-main" tabIndex={-1} className="mc-auth-form">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
