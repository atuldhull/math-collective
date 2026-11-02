import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { core } from "@/lib/api";
import { useCoreStore } from "@/store/core-store";
import { ModalShell, Field, INPUT_CLS } from "@/features/coreTeam/components/FormBits";
import { EmptyState, PageHeader } from "@/components/lamp";

const RSVP_OPTS = [
  { key: "going", label: "Going",  cls: "border-success/40 bg-success/15", text: "text-success" },
  { key: "maybe", label: "Maybe",  cls: "border-warning/40 bg-warning/15", text: "text-warning" },
  { key: "no",    label: "Can't",  cls: "border-danger/40 bg-danger/15",   text: "text-danger" },
];

function fmtWhen(d) {
  return new Date(d).toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function CoreMeetingsPage() {
  const { member } = useCoreStore();
  const isLead = member?.tier === "council" || member?.tier === "head";
  const [meetings, setMeetings] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    core.meetings()
      .then((r) => setMeetings(Array.isArray(r.data) ? r.data : []))
      .catch(() => setMeetings([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const rsvp = async (meeting, status) => {
    setBusy(meeting.id);
    try {
      await core.rsvpMeeting(meeting.id, status);
      setMeetings((prev) => prev.map((m) => {
        if (m.id !== meeting.id) return m;
        const counts = { ...m.counts };
        if (m.myRsvp) counts[m.myRsvp] = Math.max(0, counts[m.myRsvp] - 1);
        counts[status] = (counts[status] || 0) + 1;
        return { ...m, myRsvp: status, counts };
      }));
    } catch { /* ignore */ }
    setBusy(null);
  };

  const remove = async (id) => {
    try { await core.deleteMeeting(id); setMeetings((p) => p.filter((m) => m.id !== id)); } catch { /* ignore */ }
  };

  // The upcoming-timeline spine draws down with scroll.
  const root = useRef(null);
  useGSAP(() => {
    const spine = root.current?.querySelector("[data-spine]");
    if (!spine) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(spine, { scaleY: 0 }, {
        scaleY: 1, ease: "none",
        scrollTrigger: { trigger: spine, start: "top 80%", end: "bottom 65%", scrub: 0.6 },
      });
    });
  }, { scope: root, dependencies: [meetings === null], revertOnUpdate: true });
  if (!meetings) {
    return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading meetings…" /></div>;
  }

  const now = Date.now();
  const upcoming = meetings.filter((m) => new Date(m.scheduled_at).getTime() >= now);
  const past     = meetings.filter((m) => new Date(m.scheduled_at).getTime() < now).reverse();

  const MeetingCard = ({ m, isPast }) => {
    const canDelete = member?.tier === "council" ||
      (member?.tier === "head" && m.team_id && m.team_id === member?.team_id);
    const when = new Date(m.scheduled_at);
    return (
      <motion.article
        layout
        exit={{ opacity: 0, x: -30, transition: { duration: 0.25 } }}
        className={`lamp-panel relative p-4 sm:p-5 ${isPast ? "opacity-70" : ""}`}
      >
        <div className="flex gap-4">
          {/* Calendar leaf */}
          <div className={`flex w-14 shrink-0 flex-col items-center justify-center rounded-xl border py-2 ${isPast ? "border-[rgb(var(--rule))] text-text-dim" : "border-primary/30 bg-primary/[0.07] text-primary"}`}>
            <span className="text-[11px] font-medium">{when.toLocaleDateString(undefined, { month: "short" })}</span>
            <span className="lamp-numerals text-2xl leading-none">{when.getDate()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-0.5 text-[11px] font-medium text-secondary">
                {m.core_teams ? m.core_teams.name : "Whole club"}
              </span>
              <span className="lamp-numerals text-[12px] text-text-dim">{fmtWhen(m.scheduled_at)}</span>
              {canDelete && (
                <button onClick={() => remove(m.id)} aria-label={`Delete ${m.title}`}
                  className="ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-[13px] text-text-dim transition hover:bg-danger/10 hover:text-danger">
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}
            </div>
            <h3 className="mt-2 text-lg text-text-primary">{m.title}</h3>
            {m.description && <p className="mt-1 break-words text-sm leading-6 text-text-muted">{m.description}</p>}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-dim">
              {m.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />{m.location}</span>}
              {m.host && <span>Hosted by {m.host.name}</span>}
              <span className="text-success"><span className="lamp-numerals">{m.counts?.going || 0}</span> going</span>
              <span className="text-warning"><span className="lamp-numerals">{m.counts?.maybe || 0}</span> maybe</span>
            </div>
          </div>
        </div>

        {!isPast && (
          <div role="radiogroup" aria-label={`RSVP for ${m.title}`} className="mt-4 flex gap-1 rounded-2xl border border-[rgb(var(--rule))] bg-white/[0.02] p-1">
            {RSVP_OPTS.map((o) => {
              const active = m.myRsvp === o.key;
              return (
                <button
                  key={o.key}
                  role="radio"
                  aria-checked={active}
                  disabled={busy === m.id}
                  onClick={() => rsvp(m, o.key)}
                  className={`relative min-h-[40px] flex-1 rounded-xl text-[13px] font-medium transition-colors disabled:opacity-50 ${active ? o.text : "text-text-muted hover:text-text-primary"}`}
                >
                  {active && (
                    <motion.span
                      layoutId={`rsvp-${m.id}`}
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className={`absolute inset-0 rounded-xl border ${o.cls}`}
                    />
                  )}
                  <span className="relative">{o.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </motion.article>
    );
  };

  return (
    <div ref={root} className="flex flex-col">
      <PageHeader
        context="Core team"
        title="Meetings"
        description={upcoming.length ? `${upcoming.length} coming up. Let the host know if you can make it.` : "Nothing on the calendar yet."}
        actions={isLead ? (
          <Button size="sm" variant="primary" magnetic={false} onClick={() => setShowNew(true)} leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
            Schedule meeting
          </Button>
        ) : null}
      />

      <section>
        <h2 className="mb-3 text-lg text-text-primary">Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState compact title="No meetings scheduled yet" body={isLead ? "Schedule one with the button above." : "Your head or the council will post the next one here."} />
        ) : (
          <div className="relative pl-6 sm:pl-8">
            {/* timeline spine draws itself as you scroll */}
            <span data-spine aria-hidden="true" className="absolute bottom-3 left-[7px] top-3 w-px origin-top bg-[linear-gradient(rgb(var(--lamp)/0.7),rgb(var(--rule)))] sm:left-[11px]" />
            <div data-stagger="left" className="grid gap-3">
              <AnimatePresence initial={false}>
                {upcoming.map((m) => (
                  <div key={m.id} className="relative">
                    <span aria-hidden="true" className="absolute -left-6 top-7 h-[15px] w-[15px] rounded-full border-[3px] border-[rgb(var(--color-obsidian))] bg-primary shadow-[0_0_12px_rgb(var(--lamp)/0.7)] sm:-left-8 sm:ml-1" />
                    <MeetingCard m={m} isPast={false} />
                  </div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg text-text-muted">Past</h2>
          <div data-stagger="up" className="grid gap-3 xl:grid-cols-2">
            {past.map((m) => <MeetingCard key={m.id} m={m} isPast />)}
          </div>
        </section>
      )}

      <AnimatePresence>
        {showNew && (
          <NewMeetingModal
            member={member}
            onClose={() => setShowNew(false)}
            onCreated={() => { setShowNew(false); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NewMeetingModal({ member, onClose, onCreated }) {
  const isCouncil = member?.tier === "council";
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", location: "", scheduledAt: "", teamId: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (isCouncil) core.teams().then((r) => setTeams(r.data?.teams || [])).catch(() => {});
  }, [isCouncil]);

  const save = async () => {
    if (form.title.trim().length < 3) { setErr("Give the meeting a title."); return; }
    if (!form.scheduledAt) { setErr("Pick a date and time."); return; }
    setBusy(true); setErr(null);
    try {
      await core.createMeeting({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        teamId: isCouncil ? (form.teamId || null) : null,
      });
      onCreated();
    } catch (e) {
      setErr(e?.response?.data?.error || e?.response?.data?.issues?.[0]?.message || "Could not create meeting.");
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Schedule a meeting" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={INPUT_CLS} placeholder="Weekly sync, event briefing…" />
        </Field>
        <Field label="Details (optional)">
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={INPUT_CLS} placeholder="Agenda, what to bring…" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="When">
            <input type="datetime-local" value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className={INPUT_CLS} />
          </Field>
          <Field label="Where (optional)">
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
              className={INPUT_CLS} placeholder="Room / link" />
          </Field>
        </div>
        {isCouncil ? (
          <Field label="Audience">
            <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} className={INPUT_CLS}>
              <option value="">Whole club</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        ) : (
          <p className="text-[13px] text-text-dim">This meeting goes to your team: {member?.core_teams?.name}.</p>
        )}
        {err && <p role="alert" className="text-[13px] text-danger">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" magnetic={false} loading={busy} onClick={save}>Schedule</Button>
        </div>
      </div>
    </ModalShell>
  );
}
