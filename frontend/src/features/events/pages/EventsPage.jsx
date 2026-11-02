/**
 * EventsPage — Complete event browsing + registration + check-in flow.
 *
 * User Flows:
 *   1. Browse: Timeline of events with filters (All/Live/Upcoming/Completed)
 *   2. Register: Click "Register" → confirm modal → success/waitlisted/error
 *   3. Cancel: Click "Cancel Registration" → confirm → removed
 *   4. Check-in: Click "Check In" → enter code (if required) → XP awarded
 *   5. View Details: Expanded card with description, capacity, leaderboard link
 *
 * States: loading, empty, error, registered, waitlisted, attended, full
 */

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  CalendarDays, Check, Clock, ExternalLink, Globe, MapPin, Repeat, RotateCcw,
  Sparkles, Ticket, TicketCheck, TriangleAlert, Trophy, Users,
} from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import CapacityBar from "@/components/ui/CapacityBar";
import EventQrCode from "@/components/ui/EventQrCode";
import { EmptyState, PageHeader, SegmentedTabs, TiltPanel } from "@/components/lamp";
import { Flicker } from "@/components/motion/ScrollFx";
import EventHero from "@/features/events/components/EventHero";
import EventExplorer from "@/features/events/components/EventExplorer";
import { NoteChip, StatusChip, TypeChip } from "@/features/events/components/EventChips";
import { events as eventsApi, insights } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { openRazorpayCheckout } from "@/lib/razorpay";

// ── Lamplight constants ──────────────────────────────────

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "active", label: "Live" },
  { value: "registering", label: "Open" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Past" },
];

const INPUT = "w-full min-w-0 rounded-xl border border-[rgb(var(--rule))] bg-obsidian/50 px-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/50 focus:shadow-[0_0_0_3px_rgb(var(--lamp)/0.12)]";

// ── Helpers ──────────────────────────────────────────────

function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function formatTime(d) {
  if (!d) return "";
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function timeUntil(d) {
  if (!d) return "";
  const diff = new Date(d) - new Date();
  if (diff < 0) return "Started";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

// ── Main Component ───────────────────────────────────────

export default function EventsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const listRef = useRef(null);

  const [eventsList, setEventsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");       // status filter
  const [typeFilter, setTypeFilter] = useState("all"); // category/type filter

  // Modal/action states
  const [actionLoading, setActionLoading] = useState(null); // event id being acted on
  const [actionResult, setActionResult] = useState(null); // { eventId, type, message }
  const [checkinCode, setCheckinCode] = useState("");
  const [showCheckin, setShowCheckin] = useState(null); // event id showing checkin input
  // Team registration — open a small inline form for team events
  // (name + size). Keyed by event.id so the form shows for just the
  // event being registered, not all team events at once.
  const [showTeamForm, setShowTeamForm] = useState(null); // event id
  const [teamForm, setTeamForm] = useState({ name: "", size: "" });
  const [recs, setRecs] = useState([]);
  const [recPrefs, setRecPrefs] = useState(null);
  // Paid-event payment submission state (migration 19).
  // Keyed by event.id so multiple open payment forms on the page
  // don't trample each other.
  const [payRefInputs, setPayRefInputs] = useState({});
  const [payLoading, setPayLoading] = useState(null);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data } = await eventsApi.list();
      setEventsList(Array.isArray(data) ? data : []);
    } catch {
      setError("Failed to load events");
      setEventsList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Fetch personalized recommendations (only if logged in)
  useEffect(() => {
    if (!user) return;
    insights.recommendations()
      .then(r => { setRecs(r.data?.recommendations || []); setRecPrefs(r.data?.preferences || null); })
      .catch(() => {});
  }, [user]);

  // Clear action result after 4 seconds
  useEffect(() => {
    if (!actionResult) return;
    const t = setTimeout(() => setActionResult(null), 4000);
    return () => clearTimeout(t);
  }, [actionResult]);

  // Filter: apply both type and status filters
  const filtered = eventsList.filter((e) => {
    if (typeFilter !== "all" && (e.event_type || "general") !== typeFilter) return false;
    if (filter !== "all") {
      const s = e.status || "upcoming";
      // "completed" filter should also match "past" status
      if (filter === "completed") { if (s !== "completed" && s !== "past") return false; }
      else if (s !== filter) return false;
    }
    return true;
  });

  // Event type counts (for explorer cards)
  const typeCounts = {};
  eventsList.forEach(e => {
    const t = e.event_type || "general";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  // ── Actions ────────────────────────────────────────────

  const handleRegister = async (event) => {
    if (!user) { navigate("/login"); return; }
    // Team events collect a team name + size before calling the API.
    // Clicking Register on a team event opens the inline form and
    // returns — the real register call happens from that form's
    // confirm button via submitTeamRegistration.
    if (event.is_team_event) {
      setShowTeamForm(event.id);
      setTeamForm({ name: "", size: String(event.min_team_size || 2) });
      return;
    }
    await submitRegistration(event, null);
  };

  async function submitRegistration(event, teamPayload) {
    setActionLoading(event.id);
    try {
      const { data } = await eventsApi.register(event.id, teamPayload || undefined);
      setActionResult({
        eventId: event.id,
        type: data.waitlisted ? "warning" : "success",
        message: data.waitlisted
          ? "You're on the waitlist — we'll notify you if a spot opens"
          : "Registered successfully!",
      });
      setShowTeamForm(null);
      setTeamForm({ name: "", size: "" });
      fetchEvents(); // refresh counts
    } catch (err) {
      const msg = err.response?.data?.error || "Registration failed";
      setActionResult({ eventId: event.id, type: "error", message: msg });
    } finally {
      setActionLoading(null);
    }
  }

  const submitTeamRegistration = (event) => {
    const name = teamForm.name.trim();
    const size = Number(teamForm.size);
    if (!name) {
      setActionResult({ eventId: event.id, type: "error", message: "Team name required" });
      return;
    }
    const mn = event.min_team_size || 1;
    const mx = event.max_team_size || 50;
    if (!Number.isInteger(size) || size < mn || size > mx) {
      setActionResult({
        eventId: event.id,
        type: "error",
        message: `Team size must be between ${mn} and ${mx}`,
      });
      return;
    }
    return submitRegistration(event, { team_name: name, team_size: size });
  };

  const handleCancel = async (event) => {
    if (!confirm("Cancel your registration?")) return;
    setActionLoading(event.id);
    try {
      await eventsApi.cancelReg(event.id);
      setActionResult({ eventId: event.id, type: "success", message: "Registration cancelled" });
      fetchEvents();
    } catch (err) {
      setActionResult({ eventId: event.id, type: "error", message: err.response?.data?.error || "Cancel failed" });
    } finally {
      setActionLoading(null);
    }
  };

  // Paid-event: submit UPI transaction reference after paying.
  const handleSubmitPayment = async (event) => {
    const regId = event.user_registration?.id;
    const ref = (payRefInputs[event.id] || "").trim();
    if (!regId || !ref) return;
    setPayLoading(event.id);
    try {
      await eventsApi.submitPayment(event.id, regId, ref);
      setActionResult({
        eventId: event.id,
        type: "success",
        message: "Payment reference submitted — an admin will verify shortly",
      });
      setPayRefInputs((s) => ({ ...s, [event.id]: "" }));
      fetchEvents();
    } catch (err) {
      const issues = err.response?.data?.issues;
      const msg = issues?.[0]?.message
        || err.response?.data?.error
        || "Submission failed";
      setActionResult({ eventId: event.id, type: "error", message: msg });
    } finally {
      setPayLoading(null);
    }
  };

  // Razorpay auto-verify flow (migration 23). Creates a server-side
  // order, opens the checkout widget, and polls for payment_status
  // updates driven by the webhook — no manual UPI ref needed.
  const handleRazorpayPay = async (event) => {
    const regId = event.user_registration?.id;
    if (!regId) return;
    setPayLoading(event.id);
    try {
      const { data: order } = await eventsApi.createRazorpayOrder(event.id, regId);
      if (!order?.order_id || !order?.key_id) {
        throw new Error(order?.error || "Razorpay order not created");
      }
      await openRazorpayCheckout({
        keyId:       order.key_id,
        orderId:     order.order_id,
        amountPaise: order.amount,
        eventTitle:  order.event_title || event.title,
        prefill:     { name: user?.name, email: user?.email },
      });
      // The webhook is the source of truth; the checkout modal
      // closing only tells us the user clicked "success" at
      // Razorpay's end. Poll a few times — most webhooks land in
      // under 3 seconds.
      setActionResult({
        eventId: event.id,
        type: "success",
        message: "Payment captured — verifying with our server…",
      });
      let attempts = 0;
      const poll = async () => {
        attempts++;
        await fetchEvents();
        if (attempts < 5) setTimeout(poll, 1500);
      };
      setTimeout(poll, 1500);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "Payment failed";
      // Don't treat "user cancelled" as a red toast — it's just a
      // close. Razorpay's own modal already showed the relevant UI.
      if (/cancel/i.test(msg)) {
        setActionResult({ eventId: event.id, type: "warning", message: "Payment cancelled — retry when ready" });
      } else {
        setActionResult({ eventId: event.id, type: "error", message: msg });
      }
    } finally {
      setPayLoading(null);
    }
  };

  const handleCheckin = async (event) => {
    if (!user) { navigate("/login"); return; }
    setActionLoading(event.id);
    try {
      const { data } = await eventsApi.checkin(event.id, { code: checkinCode || undefined });
      setActionResult({
        eventId: event.id,
        type: "success",
        message: data.xp_awarded > 0
          ? `Checked in! +${data.xp_awarded} XP earned`
          : "Checked in successfully!",
      });
      setShowCheckin(null);
      setCheckinCode("");
      fetchEvents();
    } catch (err) {
      setActionResult({ eventId: event.id, type: "error", message: err.response?.data?.error || "Check-in failed" });
    } finally {
      setActionLoading(null);
    }
  };

  // Scroll to timeline
  const timelineRef = useRef(null);
  const scrollToTimeline = () => {
    timelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Compute hero stats
  const heroStats = {
    total: eventsList.length,
    upcoming: eventsList.filter(e => e.status === "upcoming" || e.status === "registering").length,
    live: eventsList.filter(e => e.status === "active").length,
  };

  // Status tab counts (same matching rules as the status filter above).
  const statusCount = (key) => eventsList.filter((e) => {
    if (typeFilter !== "all" && (e.event_type || "general") !== typeFilter) return false;
    const s = e.status || "upcoming";
    if (key === "all") return true;
    if (key === "completed") return s === "completed" || s === "past";
    return s === key;
  }).length;

  // The one lit card on the page: the first live event, else the
  // first one taking registrations.
  const featuredId = (filtered.find((e) => e.status === "active")
    || filtered.find((e) => e.status === "registering"))?.id;

  // ── Motion: the timeline draws itself and cards flip down into place ──
  const listKey = filtered.map((e) => e.id).join(",");
  useGSAP(() => {
    if (!listRef.current) return undefined;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(listRef);
      const line = q("[data-tl-line]")[0];
      if (line) {
        gsap.fromTo(line, { scaleY: 0 }, {
          scaleY: 1,
          ease: "none",
          scrollTrigger: { trigger: listRef.current, start: "top 70%", end: "bottom 70%", scrub: 0.6 },
        });
      }
      q("[data-tl-dot]").forEach((dot) => {
        ScrollTrigger.create({
          trigger: dot,
          start: "top 70%",
          onEnter: () => { dot.dataset.reached = "true"; },
          onLeaveBack: () => { dot.dataset.reached = "false"; },
        });
      });
      const cards = q("[data-flip]");
      gsap.set(cards, { autoAlpha: 0, rotateX: -72, y: 46, transformPerspective: 1100, transformOrigin: "50% 0%" });
      ScrollTrigger.batch(cards, {
        start: "top 92%",
        once: true,
        onEnter: (batch) => gsap.to(batch, {
          autoAlpha: 1, rotateX: 0, y: 0,
          duration: 1.15, ease: "expo.out", stagger: 0.09,
          clearProps: "transform,opacity,visibility",
        }),
      });
    });
    return () => mm.revert();
  }, { scope: listRef, dependencies: [listKey, loading], revertOnUpdate: true });

  // ── Render ─────────────────────────────────────────────

  // Same header in every return so it holds its place while events load.
  const header = (
    <PageHeader
      context="Events"
      title="Enter the arena of the week"
      description="Register for what's coming up, check in when you arrive and keep your entry QR close."
    />
  );

  if (loading) {
    return (
      <div className="relative pb-16">
        {header}
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader variant="orbit" size="lg" label="Loading events..." />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative pb-16">
        {header}
        <div className="lamp-panel mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-14 text-center">
          <TriangleAlert className="h-8 w-8 text-danger" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-sm text-danger">{error}</p>
          <Button variant="secondary" size="sm" onClick={fetchEvents} leading={<RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pb-16">
      {header}

      <div className="space-y-12">
        {/* Week at a glance: count-up tiles + two-week calendar strip */}
        <EventHero stats={heroStats} onExplore={scrollToTimeline} events={eventsList} />

        {/* Timeline section (scroll target) */}
        <div ref={timelineRef} className="scroll-mt-24 space-y-10">

        {/* Category Explorer — tilting tiles */}
        <EventExplorer
          activeFilter={typeFilter}
          onFilterChange={setTypeFilter}
          eventCounts={typeCounts}
          onExplore={scrollToTimeline}
        />

        {/* Status filter. Selecting the active status again resets to all. */}
        <div data-reveal="fade" className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3">
          <span className="hidden text-[13px] font-medium text-text-muted sm:inline">Status</span>
          <SegmentedTabs
            aria-label="Filter by status"
            size="sm"
            value={filter}
            onChange={(v) => setFilter(v === filter ? "all" : v)}
            items={STATUS_TABS.map((f) => ({ ...f, count: statusCount(f.value) }))}
          />
        </div>

        {/* Recommended for You */}
        {recs.length > 0 && filter === "all" && (
          <section className="mx-auto w-full max-w-6xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Flicker as="h2" className="text-lg text-text-primary sm:text-xl">Recommended for you</Flicker>
              {recPrefs?.top_type && (
                <NoteChip tone="violet" icon={Sparkles}>Based on your {recPrefs.top_type} interest</NoteChip>
              )}
            </div>
            <div data-stagger="fog" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recs.slice(0, 3).map(ev => (
                <TiltPanel
                  key={ev.id}
                  as="button"
                  type="button"
                  className="p-5 text-left"
                  onClick={() => {
                    const el = document.getElementById(`event-${ev.id}`);
                    el?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <span className="relative block"><TypeChip type={ev.event_type} /></span>
                  <span className="relative mt-3 block truncate text-base font-semibold text-text-primary">{ev.title}</span>
                  <span className="relative mt-1 block text-[13px] text-text-muted">
                    {ev.starts_at || ev.date ? new Date(ev.starts_at || ev.date).toLocaleDateString() : ""}
                  </span>
                  <span className="relative mt-3 flex items-center justify-between text-[13px]">
                    {ev.xp_reward > 0 ? <span className="lamp-numerals text-primary">+{ev.xp_reward} XP</span> : <span />}
                    <span className="text-text-dim">{ev.registration_count || 0} registered</span>
                  </span>
                </TiltPanel>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <EmptyState
            title="No events found"
            body={filter !== "all" || typeFilter !== "all" ? "Try a different filter." : "Check back later for new events!"}
            action={filter !== "all" || typeFilter !== "all" ? (
              <Button variant="secondary" size="sm" onClick={() => { setFilter("all"); setTypeFilter("all"); }}>
                Show all events
              </Button>
            ) : null}
          />
        )}

        {/* Event Timeline */}
        <div ref={listRef} className="relative mx-auto w-full max-w-6xl">
          {/* Timeline rail: a faint ghost line, and a lamp line that draws with the scroll */}
          {filtered.length > 0 && (
            <div aria-hidden="true" className="absolute bottom-6 left-[23px] top-6 hidden w-px md:block">
              <div className="absolute inset-0 bg-[rgb(var(--rule))]" />
              <div data-tl-line className="absolute inset-0 origin-top bg-[linear-gradient(180deg,rgb(var(--lamp)/0.95),rgb(var(--violet)/0.7))] shadow-[0_0_10px_rgb(var(--lamp)/0.6)]" />
            </div>
          )}

          <div className="space-y-5 sm:space-y-6">
            <AnimatePresence mode="popLayout">
              {filtered.map((event) => {
                const status = event.status || "upcoming";
                const isRegistered = event.user_registration && event.user_registration.status !== "cancelled";
                const isAttended = event.user_registration?.status === "attended";
                const isWaitlisted = event.user_registration?.status === "waitlisted";
                const isActing = actionLoading === event.id;
                const result = actionResult?.eventId === event.id ? actionResult : null;
                const when = event.starts_at || event.date;
                const formOpen = showCheckin === event.id || showTeamForm === event.id;

                return (
                  <motion.div
                    key={event.id}
                    layout
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.25 } }}
                    id={`event-${event.id}`}
                    className="relative md:pl-16"
                  >
                    {/* Timeline stop — lights up as the rail reaches it */}
                    <span
                      data-tl-dot
                      aria-hidden="true"
                      className={`absolute left-[17px] top-10 hidden h-[13px] w-[13px] rounded-full border-2 transition-all duration-500 md:block data-[reached=true]:scale-110 data-[reached=true]:border-primary data-[reached=true]:bg-primary data-[reached=true]:shadow-[0_0_14px_rgb(var(--lamp)/0.85)] ${
                        status === "active"
                          ? "border-success bg-success shadow-[0_0_14px_rgb(var(--color-success))]"
                          : "border-[rgb(var(--rule))] bg-obsidian"
                      }`}
                    />

                    <div data-flip>
                    <TiltPanel lit={event.id === featuredId} tilt={!formOpen} className="p-5 sm:p-6">
                      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start">
                        {/* Calendar leaf */}
                        <div className="flex shrink-0 items-center gap-3 sm:w-[4.75rem] sm:flex-col sm:gap-0 sm:rounded-xl sm:border sm:border-[rgb(var(--rule))] sm:bg-obsidian/40 sm:py-3">
                          {when ? (
                            <>
                              <span className="lamp-numerals text-[2rem] leading-none text-text-primary sm:text-[2.1rem]">
                                {new Date(when).getDate()}
                              </span>
                              <span className="flex flex-col sm:items-center">
                                <span className="text-[13px] font-medium text-primary sm:mt-1">
                                  {new Date(when).toLocaleDateString("en-IN", { month: "short" })}
                                </span>
                                <span className="text-[12px] text-text-dim">
                                  {new Date(when).toLocaleDateString("en-IN", { weekday: "short" })}
                                </span>
                              </span>
                            </>
                          ) : (
                            <span className="text-[13px] text-text-dim sm:px-2 sm:text-center">Date to be announced</span>
                          )}
                        </div>

                        {/* Event info */}
                        <div className="min-w-0 flex-1">
                          {/* Badges row */}
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusChip status={status} />
                            <TypeChip type={event.event_type} />
                            {event.xp_reward > 0 && (
                              <NoteChip tone="lamp">+{event.xp_reward} XP</NoteChip>
                            )}
                            {isRegistered && !isAttended && (
                              isWaitlisted
                                ? <NoteChip tone="warn">Waitlisted</NoteChip>
                                : <NoteChip tone="good" icon={Check}>Registered</NoteChip>
                            )}
                            {isAttended && (
                              <NoteChip tone="good" icon={Check}>Attended</NoteChip>
                            )}
                            {/* Paid-event badges (migration 19) */}
                            {event.is_paid && event.price_paise > 0 && (
                              <NoteChip tone="violet">₹{(event.price_paise / 100).toFixed(0)}</NoteChip>
                            )}
                            {event.is_paid && isRegistered && event.user_registration?.payment_status === "paid" && (
                              <NoteChip tone="good" icon={Check}>Paid</NoteChip>
                            )}
                            {event.is_paid && isRegistered && event.user_registration?.payment_status === "submitted" && (
                              <NoteChip tone="violet">Awaiting verification</NoteChip>
                            )}
                            {event.is_paid && isRegistered && event.user_registration?.payment_status === "rejected" && (
                              <NoteChip tone="bad">Payment rejected</NoteChip>
                            )}
                          </div>

                          {/* Title */}
                          <h3 className="mt-3 text-[1.45rem] leading-tight text-text-primary sm:text-2xl">
                            {event.title}
                          </h3>

                          {/* Meta row */}
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-text-muted">
                            {when && (
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
                                {formatDate(when)}
                              </span>
                            )}
                            {when && (
                              <span className="inline-flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
                                {formatTime(when)}
                              </span>
                            )}
                            {event.location && (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
                                {event.location}
                              </span>
                            )}
                            {event.organiser && <span>by {event.organiser}</span>}
                            {event.venue_type && event.venue_type !== "in-person" && (
                              <span className="inline-flex items-center gap-1.5 text-secondary">
                                {event.venue_type === "online"
                                  ? <Globe className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                                  : <Repeat className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />}
                                {event.venue_type === "online" ? "Online" : "Hybrid"}
                              </span>
                            )}
                          </div>

                          {/* Countdown for upcoming */}
                          {(status === "upcoming" || status === "registering") && when && (
                            <p className="mt-2 text-[13px] font-medium text-primary">
                              Starts in <span className="lamp-numerals">{timeUntil(when)}</span>
                            </p>
                          )}

                          {/* Tags */}
                          {event.tags?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {event.tags.map((tag) => (
                                <span key={tag} className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[12px] text-text-muted">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Description (truncated) */}
                          {event.description && (
                            <p className="mt-3 max-w-[68ch] text-sm leading-7 text-text-muted line-clamp-3">
                              {event.description}
                            </p>
                          )}

                          {/* Capacity bar */}
                          {(event.capacity || event.registration_count > 0) && (
                            <div className="mt-4 max-w-xs">
                              <CapacityBar current={event.registration_count || 0} max={event.capacity} />
                            </div>
                          )}

                          {/* QR Code — shown when registered, not yet attended,
                             AND (free event OR payment verified). Paid events
                             previously showed the QR immediately on registration
                             which was misleading: the attendance controller
                             refuses to check in an unpaid registration, so
                             scanning would fail anyway. Gating here means the
                             QR only appears once the student is actually
                             cleared to walk through the door. */}
                          {(() => {
                            const reg = event.user_registration;
                            if (!isRegistered || isAttended || !reg?.qr_token) return null;
                            const paymentCleared =
                              !event.is_paid
                              || reg.payment_status === "paid"
                              || reg.payment_status === "not_required";
                            if (!paymentCleared) {
                              return (
                                <p className="mt-4 rounded-xl border border-warning/25 bg-warning/[0.06] px-3 py-2 text-[13px] text-warning">
                                  Your entry QR unlocks here as soon as your payment clears.
                                </p>
                              );
                            }
                            return (
                              <div className="mt-4 inline-flex rounded-2xl border border-primary/25 bg-primary/[0.04] p-4 shadow-[0_0_40px_-16px_rgb(var(--lamp)/0.6)]">
                                <EventQrCode
                                  eventId={event.id}
                                  qrToken={reg.qr_token}
                                  eventTitle={event.title}
                                />
                              </div>
                            );
                          })()}

                          {/* Paid-event: payment panel (migration 19).
                              Only shown to registered students whose
                              payment isn't already verified. */}
                          {event.is_paid && isRegistered && event.user_registration?.payment_status !== "paid" && event.user_registration?.payment_status !== "not_required" && (
                            <div className="mt-4 rounded-2xl border border-secondary/25 bg-secondary/[0.05] p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-[13px] font-medium text-secondary">Payment required</p>
                                  <p className="lamp-numerals mt-1 text-2xl text-text-primary">
                                    ₹{((event.price_paise || 0) / 100).toFixed(2)}
                                  </p>
                                </div>
                                {event.payment_qr_base64 && (
                                  <img
                                    src={event.payment_qr_base64}
                                    alt="Payment QR"
                                    loading="lazy"
                                    className="h-28 w-28 rounded-xl border border-[rgb(var(--rule))] bg-white p-1"
                                  />
                                )}
                              </div>
                              {event.payment_upi_id && (
                                <p className="mt-2 text-[13px] text-text-muted">
                                  UPI ID: <span className="select-all font-mono text-text-primary">{event.payment_upi_id}</span>
                                </p>
                              )}
                              {event.payment_instructions && (
                                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-6 text-text-dim">
                                  {event.payment_instructions}
                                </p>
                              )}

                              {/* Rejection reason — shown so the student knows why and how to retry. */}
                              {event.user_registration?.payment_status === "rejected" && event.user_registration?.rejection_reason && (
                                <p className="mt-2 rounded-xl border border-danger/25 bg-danger/[0.06] px-3 py-2 text-[13px] text-danger">
                                  Previous attempt rejected: {event.user_registration.rejection_reason}
                                </p>
                              )}

                              {/* Razorpay auto-verify button — primary payment path.
                                  Hidden once status='submitted' (manual flow in progress) or while polling. */}
                              {event.user_registration?.payment_status !== "submitted" && (
                                <div className="mt-3">
                                  <Button
                                    size="sm"
                                    onClick={() => handleRazorpayPay(event)}
                                    loading={payLoading === event.id}
                                    className="w-full sm:w-auto"
                                  >
                                    {event.user_registration?.payment_status === "rejected" ? "Retry payment" : `Pay ₹${((event.price_paise || 0) / 100).toFixed(0)} securely`}
                                  </Button>
                                  <p className="mt-2 text-[12px] leading-5 text-text-dim">
                                    Opens Razorpay for cards, UPI or netbanking. Your registration is marked paid automatically once the payment clears, with no admin check needed.
                                  </p>
                                </div>
                              )}

                              {/* Manual UPI ref fallback — shown collapsed, expands on click.
                                  Keeps the old path available when Razorpay is down / not wired. */}
                              {event.user_registration?.payment_status !== "submitted" && (
                                <details className="mt-3">
                                  <summary className="cursor-pointer text-[13px] text-text-muted hover:text-text-primary">
                                    Or pay manually via UPI and submit the reference
                                  </summary>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="UPI Ref / Transaction ID"
                                      value={payRefInputs[event.id] || ""}
                                      onChange={(e) => setPayRefInputs((s) => ({ ...s, [event.id]: e.target.value }))}
                                      onKeyDown={(e) => e.key === "Enter" && handleSubmitPayment(event)}
                                      className={`${INPUT} flex-1 font-mono sm:w-auto sm:min-w-[180px]`}
                                      maxLength={32}
                                    />
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => handleSubmitPayment(event)}
                                      loading={payLoading === event.id}
                                      disabled={!((payRefInputs[event.id] || "").trim())}
                                    >
                                      Submit ref
                                    </Button>
                                  </div>
                                </details>
                              )}
                              {event.user_registration?.payment_status === "submitted" && (
                                <p className="mt-3 text-[13px] text-text-dim">
                                  Ref submitted: <span className="font-mono text-text-muted">{event.user_registration.payment_ref}</span>. An admin will verify it shortly.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Action result toast */}
                          <AnimatePresence>
                            {result && (
                              <motion.div
                                role="status"
                                initial={{ opacity: 0, y: -8, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: "auto" }}
                                exit={{ opacity: 0, y: -8, height: 0 }}
                                className={`mt-3 rounded-xl border px-3 py-2 text-[13px] ${
                                  result.type === "success" ? "border-success/25 bg-success/10 text-success" :
                                  result.type === "warning" ? "border-warning/25 bg-warning/10 text-warning" :
                                  "border-danger/25 bg-danger/10 text-danger"
                                }`}
                              >
                                {result.message}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Check-in code input */}
                          <AnimatePresence>
                            {showCheckin === event.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 flex flex-wrap items-center gap-2"
                              >
                                <input
                                  type="text"
                                  aria-label="Check-in code"
                                  placeholder="Enter check-in code"
                                  value={checkinCode}
                                  onChange={(e) => setCheckinCode(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && handleCheckin(event)}
                                  className={`${INPUT} font-mono sm:w-44`}
                                  autoFocus
                                />
                                <Button size="sm" onClick={() => handleCheckin(event)} loading={isActing}>
                                  Confirm
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => { setShowCheckin(null); setCheckinCode(""); }}>
                                  Cancel
                                </Button>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Team registration form — shown when the
                             student clicks Register on a team event. */}
                          <AnimatePresence>
                            {showTeamForm === event.id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.05] p-4"
                              >
                                <p className="mb-3 flex items-center gap-2 text-[13px] font-medium text-primary">
                                  <Users className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                                  Team details
                                </p>
                                <div className="flex flex-wrap items-end gap-3">
                                  <div className="min-w-[180px] flex-1">
                                    <label className="mb-1.5 block text-[13px] text-text-muted">Team name</label>
                                    <input
                                      type="text"
                                      value={teamForm.name}
                                      onChange={(e) => setTeamForm((s) => ({ ...s, name: e.target.value }))}
                                      placeholder="e.g. Euler's Engineers"
                                      maxLength={80}
                                      autoFocus
                                      className={INPUT}
                                    />
                                  </div>
                                  <div className="w-36">
                                    <label className="mb-1.5 block text-[13px] text-text-muted">
                                      Team size ({event.min_team_size || 1}–{event.max_team_size || 50})
                                    </label>
                                    <input
                                      type="number"
                                      min={event.min_team_size || 1}
                                      max={event.max_team_size || 50}
                                      value={teamForm.size}
                                      onChange={(e) => setTeamForm((s) => ({ ...s, size: e.target.value }))}
                                      className={`${INPUT} font-mono`}
                                    />
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => submitTeamRegistration(event)} loading={isActing}>
                                      Confirm
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => { setShowTeamForm(null); setTeamForm({ name: "", size: "" }); }}>
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                                <p className="mt-3 text-[12px] text-text-dim">
                                  You're registering on behalf of your team. One QR and one check-in covers everyone.
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Action buttons. Stretch to full width on mobile so
                           they sit below the info block cleanly; right-align
                           at tablet+ where the card goes horizontal. */}
                        <div className="flex flex-shrink-0 flex-col items-stretch gap-2 sm:items-end">
                          {/* Register button */}
                          {(status === "upcoming" || status === "registering") && !isRegistered && !event.is_full && (
                            <Button size="sm" onClick={() => handleRegister(event)} loading={isActing}
                              leading={<Ticket className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}>
                              Register
                            </Button>
                          )}

                          {/* Full — join waitlist */}
                          {(status === "upcoming" || status === "registering") && !isRegistered && event.is_full && (
                            <Button size="sm" variant="secondary" onClick={() => handleRegister(event)} loading={isActing}>
                              Join waitlist
                            </Button>
                          )}

                          {/* Cancel registration */}
                          {isRegistered && !isAttended && status !== "completed" && status !== "past" && (
                            <Button variant="ghost" size="sm" onClick={() => handleCancel(event)} loading={isActing}>
                              Cancel registration
                            </Button>
                          )}

                          {/* Check-in (for active/registering events when registered) */}
                          {isRegistered && !isAttended && (status === "active" || status === "registering") && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                if (event.requires_checkin) {
                                  setShowCheckin(event.id);
                                } else {
                                  handleCheckin(event);
                                }
                              }}
                              loading={isActing && showCheckin !== event.id}
                              leading={<TicketCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
                            >
                              Check in
                            </Button>
                          )}

                          {/* External registration link (fallback) */}
                          {event.registration_form_url && !isRegistered && (
                            <a href={event.registration_form_url} target="_blank" rel="noopener noreferrer" className="flex flex-col">
                              <Button variant="ghost" size="sm" tabIndex={-1}
                                trailing={<ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />}>
                                Open external form
                              </Button>
                            </a>
                          )}

                          {/* Online venue link */}
                          {event.venue_link && (status === "active" || isRegistered) && (
                            <a href={event.venue_link} target="_blank" rel="noopener noreferrer" className="flex flex-col">
                              <Button variant="ghost" size="sm" tabIndex={-1}
                                trailing={<ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />}>
                                Join online
                              </Button>
                            </a>
                          )}

                          {/* View leaderboard for competitions */}
                          {(event.event_type === "competition" || event.event_type === "hackathon") && status === "completed" && (
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/events/${event.id}/leaderboard`)}
                              leading={<Trophy className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}>
                              Leaderboard
                            </Button>
                          )}
                        </div>
                      </div>
                    </TiltPanel>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
