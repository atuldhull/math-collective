import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { CheckCircle2, Clock, Mail, MapPin } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import { PageHeader, WorldIntro, useIsGuest } from "@/components/lamp";
import { contact } from "@/lib/api";

const motionOK = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: no-preference)").matches;

const signalBeats = [
  { kicker: "Contact", title: "Send a signal", body: "A question, an idea, a problem that won't let you sleep. Someone on the team will read it." },
  { kicker: "Across the campus", title: "Every message finds a reader", body: "Students, faculty and other universities write to us. We answer each one." },
  { kicker: "Start the conversation", title: "We're listening", body: "Scroll on to write to the Asymptotes team." },
];

const signalGlyphs = ["✦", "∿", "@", "?", "⋆", "≈", "∴", "↗", "∞", "·", "!", "∵"];

const signalFrames = [
  { label: "How do I join?" }, { label: "Can my university join?" },
  { label: "Let's run a hackathon" }, { label: "Is it free?" },
  { label: "Found a bug in a challenge" }, { label: "Want to give a talk" },
];

const INFO = [
  // Must match where contactController actually delivers.
  { label: "Email", value: "asymptotesbmsit@gmail.com", icon: Mail, href: "mailto:asymptotesbmsit@gmail.com" },
  { label: "Location", value: "BMSIT Campus, Bangalore", icon: MapPin },
  { label: "Hours", value: "Mon-Fri, 9 AM - 5 PM IST", icon: Clock },
];

const FAQ = [
  { q: "How do I join?", a: "Register with your university email and start solving challenges." },
  { q: "Is it free?", a: "Yes. Core features are free for all university students." },
  { q: "Can my university join?", a: "Yes. Contact us and we'll set up your organization." },
];

// A small constellation: stars appear, the lines between them draw,
// then a pulse of light keeps travelling the chain like a signal.
const STARS = [[18, 78], [62, 40], [112, 58], [150, 18], [196, 46], [236, 28]];
const CHAIN = `M${STARS.map(([x, y]) => `${x} ${y}`).join(" L")}`;

function Constellation() {
  const root = useRef(null);
  useGSAP(() => {
    if (!motionOK()) return;
    const q = gsap.utils.selector(root);
    const line = q("[data-chain]")[0];
    const tl = gsap.timeline({ delay: 0.4 });
    tl.from(q("[data-star]"), { scale: 0, transformOrigin: "50% 50%", duration: 0.6, stagger: 0.12, ease: "back.out(3)" })
      .fromTo(line, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut" }, 0.2);
    gsap.to(q("[data-pulse]"), {
      motionPath: { path: line, align: line, alignOrigin: [0.5, 0.5] },
      duration: 2.6, ease: "power1.inOut", repeat: -1, repeatDelay: 0.8, delay: 2,
    });
    gsap.to(q("[data-star]"), {
      opacity: 0.45, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: -1,
      stagger: { each: 0.35, from: "random" },
    });
  }, { scope: root });

  return (
    <svg ref={root} viewBox="0 0 254 96" fill="none" aria-hidden="true" className="h-20 w-full max-w-[17rem] overflow-visible">
      <path data-chain d={CHAIN} pathLength="1" strokeDasharray="1" stroke="rgb(var(--lamp)/0.45)" strokeWidth="1.2" />
      {STARS.map(([x, y], i) => (
        <circle key={i} data-star cx={x} cy={y} r={i === STARS.length - 1 ? 4.5 : 3} fill={i === STARS.length - 1 ? "rgb(var(--lamp))" : "rgb(var(--violet))"} />
      ))}
      <circle data-pulse cx="0" cy="0" r="4" fill="rgb(var(--lamp))" style={{ filter: "drop-shadow(0 0 6px rgb(var(--lamp)))" }} transform={`translate(${STARS[0][0]} ${STARS[0][1]})`} />
    </svg>
  );
}

// Rings that keep radiating out of the check once a message is sent.
function SignalSent() {
  const root = useRef(null);
  useGSAP(() => {
    if (!motionOK()) return;
    const q = gsap.utils.selector(root);
    gsap.from(q("[data-check]"), { scale: 0, rotate: -90, duration: 0.9, ease: "back.out(2.2)" });
    gsap.fromTo(q("[data-ring]"), { scale: 0.4, autoAlpha: 0.9 }, {
      scale: 2.6, autoAlpha: 0, duration: 2.4, ease: "power2.out", stagger: { each: 0.8, repeat: -1 },
    });
  }, { scope: root });

  return (
    <div ref={root} className="relative mx-auto grid h-24 w-24 place-items-center">
      {[0, 1, 2].map((i) => (
        <span key={i} data-ring aria-hidden="true" className="absolute inset-0 rounded-full border border-[rgb(var(--lamp)/0.6)] opacity-0" />
      ))}
      <span data-check className="relative grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary shadow-[0_0_40px_-6px_rgb(var(--lamp)/0.7)]">
        <CheckCircle2 className="h-8 w-8" strokeWidth={1.75} aria-hidden="true" />
      </span>
    </div>
  );
}

export default function ContactPage() {
  const isGuest = useIsGuest();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await contact.send(form);
      setSuccess(true);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <>
      {isGuest ? (
        <WorldIntro
          beats={signalBeats}
          glyphs={signalGlyphs}
          frames={signalFrames}
          length={3.4}
          cta={<Link to="/register"><Button size="lg">Join the collective</Button></Link>}
        />
      ) : (
        <PageHeader
          context="Contact"
          title="Send us a message"
          description="Have a question, suggestion, or want to collaborate? Reach out to the Asymptotes team."
        />
      )}

      <div className="relative z-10 pb-16">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:gap-8">
          <section data-reveal="tilt" className="lamp-panel lamp-panel--lit p-5 sm:p-8">
            <AnimatePresence mode="wait" initial={false}>
              {success ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35 }}
                  className="py-8 text-center"
                  role="status"
                >
                  <SignalSent />
                  <h2 className="mt-6 text-2xl text-text-primary sm:text-3xl">Message sent</h2>
                  <p className="mx-auto mt-2 max-w-[40ch] text-text-muted">We&rsquo;ll get back to you as soon as possible.</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-6"
                    onClick={() => setSuccess(false)}
                  >
                    Send another message
                  </Button>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleSubmit}
                  className="space-y-5"
                >
                  <div>
                    <h2 className="text-2xl text-text-primary">Write to the team</h2>
                    <p className="mt-1 text-sm text-text-muted">We usually reply within two working days.</p>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        role="alert"
                        className="overflow-hidden rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <InputField
                      label="Name"
                      placeholder="Your name"
                      value={form.name}
                      onChange={update("name")}
                      required
                    />
                    <InputField
                      label="Email"
                      type="email"
                      placeholder="yourname@bmsit.in"
                      value={form.email}
                      onChange={update("email")}
                      required
                    />
                  </div>
                  <InputField
                    label="Subject"
                    placeholder="What's this about?"
                    value={form.subject}
                    onChange={update("subject")}
                    required
                  />
                  <InputField
                    label="Message"
                    placeholder="Tell us more..."
                    value={form.message}
                    onChange={update("message")}
                    multiline
                    required
                  />
                  <Button type="submit" loading={loading} className="w-full justify-center" size="lg">
                    Send message
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </section>

          <aside className="space-y-6">
            <section data-reveal="right" className="lamp-panel p-5 sm:p-6">
              <Constellation />
              <h2 className="mt-3 text-lg text-text-primary">Other ways to reach us</h2>
              <ul data-stagger="left" className="mt-4 space-y-4">
                {INFO.map(({ label, value, icon: Icon, href }) => (
                  <li key={label} className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[rgb(var(--rule))] bg-white/[0.03] text-primary">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-text-muted">{label}</p>
                      {href ? (
                        <a href={href} className="mt-0.5 block break-all text-sm text-text-primary underline-offset-4 hover:text-primary hover:underline">{value}</a>
                      ) : (
                        <p className="mt-0.5 text-sm text-text-primary">{value}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section data-reveal="right" className="lamp-panel p-5 sm:p-6">
              <h2 className="text-lg text-text-primary">Common questions</h2>
              <dl data-stagger="up" className="mt-3 divide-y divide-[rgb(var(--rule))]">
                {FAQ.map((faq) => (
                  <div key={faq.q} className="py-3 first:pt-1 last:pb-0">
                    <dt className="text-sm font-medium text-text-primary">{faq.q}</dt>
                    <dd className="mt-1 text-[13px] leading-6 text-text-muted">{faq.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
