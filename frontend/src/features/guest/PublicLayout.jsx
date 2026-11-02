import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "@/lib/gsap-setup";
import AnnouncementBar from "@/components/AnnouncementBar";
import InstallPwaButton from "@/components/ui/InstallPwaButton";
import { useOrgBranding } from "@/components/OrgThemeProvider";
import "./public.css";
import { PublicThemeSelector } from "./PublicTheme";
import "./worlds.css";
import useHaunted from "@/components/lamp/useHaunted";
import { HauntedAuthScene, HauntedCard } from "./HauntedAuth";

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

// Glyphs drifting behind the sign-in and join pages: [glyph, left %, top %, size px, seconds].
const authGlyphs = [
  ["∑", 6, 14, 54, 19],
  ["π", 44, 8, 34, 23],
  ["∞", 88, 18, 46, 17],
  ["∫", 12, 72, 62, 25],
  ["φ", 52, 86, 30, 21],
  ["∂", 93, 64, 40, 18],
  ["√2", 30, 44, 26, 27],
  ["λ", 70, 40, 32, 22],
];

/** The threshold: an endless run of arched doorways walking toward you,
 * with Euler's identity at the vanishing point. Pure CSS loops (stilled by
 * the public reduced-motion rule); GSAP adds the entrance and a pointer lean.
 * It lives in the side panel, so on a phone it sits below the form. */
function AuthThreshold() {
  const scene = useRef(null);
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(scene);
        gsap.from(q(".mc-auth-story > *"), {
          y: 46,
          rotateX: -35,
          autoAlpha: 0,
          transformPerspective: 900,
          transformOrigin: "50% 0%",
          duration: 1.1,
          stagger: 0.08,
          ease: "expo.out",
          delay: 0.15,
        });
        const tilt = q("[data-threshold-tilt]")[0];
        if (!tilt || !window.matchMedia("(pointer: fine)").matches) return;
        const rx = gsap.quickTo(tilt, "rotateX", { duration: 1.2, ease: "power3.out" });
        const ry = gsap.quickTo(tilt, "rotateY", { duration: 1.2, ease: "power3.out" });
        const lean = (event) => {
          ry((event.clientX / window.innerWidth - 0.5) * 22);
          rx((0.5 - event.clientY / window.innerHeight) * 14);
        };
        window.addEventListener("pointermove", lean, { passive: true });
        return () => window.removeEventListener("pointermove", lean);
      });
      return () => mm.revert();
    },
    { scope: scene },
  );
  return (
    <div ref={scene} className="contents">
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
        <div className="mc-threshold">
          <div className="mc-threshold-tilt" data-threshold-tilt aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="mc-threshold-door" style={{ "--i": i }} />
            ))}
          </div>
          <span className="mc-threshold-glow" aria-hidden="true" />
          <div className="mc-auth-equation" aria-label="Euler’s identity">
            e<sup>iπ</sup> + 1 = 0
          </div>
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
    </div>
  );
}

// Floating backdrop glyphs swap to Halloween ones under the haunted treatment.
const HAUNTED_AUTH_GLYPHS = ["🦇", "👻", "💀", "🕸️", "🦇", "🕯️", "🎃", "🦇"];

export function PublicAuthLayout() {
  const haunted = useHaunted();
  return (
    <div className="mc-public">
      <a className="mc-skip" href="#mc-main">
        Skip to content
      </a>
      <Header />
      <div className="mc-auth-layout" data-haunted={haunted ? "" : undefined}>
        <div className="mc-auth-backdrop" aria-hidden="true">
          {authGlyphs.map(([glyph, x, y, size, seconds], i) => (
            <span
              key={glyph}
              style={{
                left: x + "%",
                top: y + "%",
                "--s": size + "px",
                "--t": seconds + "s",
                "--d": -i * 2.3 + "s",
                "--x": (i % 2 ? -1 : 1) * (14 + i * 3) + "px",
              }}
            >
              {haunted ? HAUNTED_AUTH_GLYPHS[i % HAUNTED_AUTH_GLYPHS.length] : glyph}
            </span>
          ))}
        </div>
        {haunted ? <HauntedAuthScene /> : <AuthThreshold />}
        <main id="mc-main" tabIndex={-1} className="mc-auth-form">
          {haunted ? <HauntedCard><Outlet /></HauntedCard> : <Outlet />}
        </main>
      </div>
      <Footer />
    </div>
  );
}
