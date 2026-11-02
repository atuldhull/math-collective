import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { CheckCircle2, Clock, Mail, MapPin } from "lucide-react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import InputField from "@/components/ui/InputField";
import { WorldIntro } from "@/components/lamp";
import { contact } from "@/lib/api";
import gsap from "@/lib/gsap-setup";
import "./worlds.css";

// The way in: a short flight through a constellation, ending at the form.
const signalBeats = [
  {
    kicker: "Contact",
    title: "Send a *signal*.",
    body: "Questions, ideas, a university that wants in. Every message lands in the team's inbox.",
  },
  {
    kicker: "Bangalore",
    title: "Someone is listening.",
    body: "The club runs from the BMSIT campus and reads every note, Monday to Friday.",
  },
  {
    kicker: "The form",
    title: "Say hello.",
    body: "A name, an email, a subject and a few lines. That is all it takes.",
  },
];
const signalFrames = [
  "Hello?",
  "A question",
  "asymptotesbmsit@gmail.com",
  "Re: collaboration",
  "BMSIT, Bangalore",
  "Mon–Fri, 9–5 IST",
].map((label) => ({ label }));
const signalGlyphs = ["✦", "·", "@", "∿", "?", "✧", "⋆", "λ", "∞", "✦", "π", "·"];
// Stars of the signal line under the heading (viewBox 720 × 90).
const stars = [
  [16, 62],
  [118, 30],
  [228, 70],
  [342, 22],
  [452, 58],
  [566, 26],
  [704, 48],
];
const signalPath = stars.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");

export default function GuestContact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const pageRef = useRef(null);

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

  // The signal line draws star to star as the heading scrolls up, and the
  // form panel swings up into place behind it.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(pageRef);
        const svg = q(".mc-signal")[0];
        const line = q(".mc-signal path")[0];
        if (svg && line) {
          const length = line.getTotalLength?.() || 800;
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: { trigger: svg, start: "top 92%", end: "top 45%", scrub: 0.6 },
          });
          tl.fromTo(
            line,
            { strokeDasharray: length, strokeDashoffset: length },
            { strokeDashoffset: 0, duration: 1 },
            0,
          );
          q(".mc-signal circle").forEach((star, i, all) => {
            tl.from(star, { scale: 0, transformOrigin: "50% 50%", duration: 0.12 }, (i / (all.length - 1)) * 0.9);
          });
        }
        q("[data-signal-panel]").forEach((panel, i) => {
          gsap.from(panel, {
            rotateX: 18,
            y: 70,
            transformPerspective: 1100,
            transformOrigin: "50% 0%",
            ease: "none",
            scrollTrigger: { trigger: panel, start: "top bottom", end: "top 65%", scrub: 0.6 + i * 0.2 },
          });
        });
      });
      return () => mm.revert();
    },
    { scope: pageRef },
  );

  return (
    <div className="relative" ref={pageRef}>
      <WorldIntro
        inset="full"
        className="mc-world"
        beats={signalBeats}
        frames={signalFrames}
        glyphs={signalGlyphs}
        length={3}
        cta={
          <a className="mc-button" href="#contact-form">
            Write a message
          </a>
        }
      />
      <div className="relative z-10 space-y-10 pb-16">
        <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <p className="mc-world-label">Get in touch</p>
          <h1 className="mt-4 font-display text-5xl font-extrabold tracking-[-0.06em] text-white sm:text-6xl">
            Contact Us
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-text-muted">
            Have a question, suggestion, or want to collaborate? Reach out to the Asymptotes team.
          </p>
          <svg className="mc-signal mt-8" viewBox="0 0 720 90" aria-hidden="true">
            <path d={signalPath} />
            {stars.map(([cx, cy], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={i === stars.length - 1 ? 6 : 4}
                data-end={i === stars.length - 1 || undefined}
              />
            ))}
          </svg>
        </motion.section>

        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_0.8fr]">
          <div id="contact-form" className="scroll-mt-6" data-signal-panel>
            <Card variant="glass">
              {success ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-success" strokeWidth={1.5} aria-hidden="true" />
                  <h3 className="mt-4 font-display text-2xl font-bold text-white">Message Sent!</h3>
                  <p className="mt-2 text-text-muted">We'll get back to you as soon as possible.</p>
                  <Button variant="ghost" size="sm" className="mt-6" onClick={() => setSuccess(false)}>
                    Send Another
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <h3 className="font-display text-xl font-bold text-white">Send a Message</h3>

                  {error && (
                    <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                      {error}
                    </div>
                  )}

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
                    Send Message
                  </Button>
                </form>
              )}
            </Card>
          </div>

          <div className="space-y-6" data-signal-panel>
            <Card variant="solid">
              <h3 className="font-display text-lg font-bold text-white">Quick Info</h3>
              <div className="mt-4 space-y-4">
                {[
                  // Must match where contactController actually delivers.
                  { label: "Email", value: "asymptotesbmsit@gmail.com", Icon: Mail },
                  { label: "Location", value: "BMSIT Campus, Bangalore", Icon: MapPin },
                  { label: "Hours", value: "Mon-Fri, 9 AM - 5 PM IST", Icon: Clock },
                ].map(({ label, value, Icon }) => (
                  <div key={label} className="flex items-start gap-3">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} aria-hidden="true" />
                    <div>
                      <p className="mc-world-label">{label}</p>
                      <p className="mt-1 text-sm text-white">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card variant="glass">
              <h3 className="font-display text-lg font-bold text-white">FAQ</h3>
              <div className="mt-4 space-y-3">
                {[
                  { q: "How do I join?", a: "Register with your university email and start solving challenges." },
                  { q: "Is it free?", a: "Yes! Core features are free for all university students." },
                  { q: "Can my university join?", a: "Absolutely! Contact us and we'll set up your organization." },
                ].map((faq) => (
                  <div key={faq.q} className="rounded-xl border border-line/10 bg-black/10 px-4 py-3">
                    <p className="text-sm font-medium text-white">{faq.q}</p>
                    <p className="mt-1 text-xs text-text-muted">{faq.a}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
