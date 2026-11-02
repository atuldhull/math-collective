/**
 * AdminEventsPage — Complete event management dashboard.
 *
 * Sections:
 *   1. Stats overview (total, upcoming, live, registrations, reg open)
 *   2. Create/edit event form (all fields including new schema)
 *   3. Event list with filters, inline actions
 *   4. Registration viewer (expandable per event, with CSV export)
 *   5. Attendance viewer (expandable per event, with CSV export)
 */

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import {
  CalendarClock, CalendarDays, Check, Clock, DoorOpen, Download, IndianRupee, MapPin, Pencil, Plus, Radio,
  RefreshCw, ScanLine, Trash2, Users, UsersRound, X,
} from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import EventStatusBadge from "@/components/ui/EventStatusBadge";
import EventTypeBadge from "@/components/ui/EventTypeBadge";
import CapacityBar from "@/components/ui/CapacityBar";
import { events as eventsApi, insights } from "@/lib/api";
import { EmptyState, PageHeader, SegmentedTabs, StatTile } from "@/components/lamp";
import UserHoverCard from "@/components/social/UserHoverCard";

const LABEL = "mb-2 block text-[13px] font-medium text-text-muted";
const FIELD = "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-3 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/50 [color-scheme:dark]";
const icon = (Icon) => <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />;

const EMPTY_FORM = {
  title: "", description: "", location: "", date: "",
  event_type: "general", organiser: "", tags: "",
  capacity: "", venue_type: "in-person", venue_link: "",
  xp_reward: "0", xp_bonus_first: "0", xp_bonus_winner: "0",
  requires_checkin: false, checkin_code: "",
  starts_at: "", ends_at: "", cover_image_url: "",
  registration_deadline: "", banner_color: "#7c3aed",
  // Paid-event fields (migration 19). price_rupees is a UI-only
  // field; we convert to paise in the submit handler. Keeping it as
  // rupees in the form matches how a teacher actually thinks about
  // the fee.
  is_paid: false, price_rupees: "", payment_upi_id: "",
  payment_qr_base64: "", payment_instructions: "",
  // Team-event fields (migration 22). Only meaningful when
  // is_team_event is true; the DB defaults keep solo events clean
  // if a teacher flips the checkbox on + off without touching the
  // size inputs.
  is_team_event: false, min_team_size: "2", max_team_size: "5",
};

export default function AdminEventsPage() {
  const root = useRef(null);
  const navigate = useNavigate();

  const [eventsList, setEventsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [expandedRegs, setExpandedRegs] = useState(null);
  const [expandedAtt, setExpandedAtt] = useState(null);
  const [regsData, setRegsData] = useState([]);
  const [attData, setAttData] = useState([]);
  const [regsLoading, setRegsLoading] = useState(false);
  const [attLoading, setAttLoading] = useState(false);
  const [expandedHealth, setExpandedHealth] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [adminInsights, setAdminInsights] = useState(null);
  // Paid-event reconciliation panel (migration 19)
  const [expandedPayments, setExpandedPayments] = useState(null);
  const [paymentsData, setPaymentsData] = useState({ event: null, registrations: [] });
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [reconcilingId, setReconcilingId] = useState(null);

  const fetchEvents = useCallback(() => {
    setLoading(true);
    eventsApi.list()
      .then(r => setEventsList(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEventsList([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  // Fetch admin insights
  useEffect(() => {
    insights.admin().then(r => setAdminInsights(r.data)).catch(() => {});
  }, []);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3500); };
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const stats = {
    total: eventsList.length,
    upcoming: eventsList.filter(e => e.status === "upcoming" || e.status === "registering").length,
    live: eventsList.filter(e => e.status === "active").length,
    totalRegs: eventsList.reduce((s, e) => s + (e.registration_count || 0), 0),
    regOpen: eventsList.filter(e => e.registration_open).length,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    // Paid events with a blank price silently shipped as free before
    // this guard — backend would accept is_paid:true with price_paise:0
    // and students would register without ever seeing a pay screen.
    // Block the save here with a clear message instead.
    if (form.is_paid) {
      const rupees = Number(form.price_rupees);
      if (!form.price_rupees || !(rupees > 0)) {
        showMsg("Paid events need a price greater than 0");
        return;
      }
      if (!form.payment_upi_id && !form.payment_qr_base64) {
        showMsg("Paid events need a UPI ID or a QR image for students to pay");
        return;
      }
    }
    if (form.is_team_event) {
      const mn = Number(form.min_team_size);
      const mx = Number(form.max_team_size);
      if (!(mn >= 1) || !(mx >= mn) || mx > 50) {
        showMsg("Team size range must be 1 ≤ min ≤ max ≤ 50");
        return;
      }
    }
    setSaving(true);
    try {
      // <input type="datetime-local"> emits values like "2026-04-20T12:00"
      // (no seconds, no timezone). Zod's .datetime() requires full ISO
      // with timezone ("...T12:00:00Z"), so every date entered in the
      // form was failing validation with "date: Invalid datetime". Pad
      // the string to a full ISO instant before POST — the local wall
      // clock is the user's intent, so "Z" marks it as UTC without
      // silently shifting by their tz offset.
      const toIsoOrNull = (v) => {
        if (!v) return null;
        if (typeof v !== "string") return v;
        // Already full ISO? ends with Z or an offset (+/-hh:mm)
        if (/Z$|[+-]\d{2}:?\d{2}$/.test(v)) return v;
        // YYYY-MM-DDTHH:MM → add :00 seconds
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return `${v}:00Z`;
        // YYYY-MM-DDTHH:MM:SS → add Z
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) return `${v}Z`;
        // YYYY-MM-DD (date only) — leave alone, validator's second
        // branch accepts it via regex.
        return v;
      };
      const payload = {
        ...form,
        capacity: form.capacity ? Number(form.capacity) : null,
        xp_reward: Number(form.xp_reward) || 0,
        xp_bonus_first: Number(form.xp_bonus_first) || 0,
        xp_bonus_winner: Number(form.xp_bonus_winner) || 0,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        // Zod's .url() and isoDate regex both reject "". Inputs that were
        // never touched sit at "" in form state, so without this coercion
        // every unfilled date or URL field triggers a blanket "Validation
        // failed" on event create.
        date:                 toIsoOrNull(form.date),
        venue_link:           form.venue_link || null,
        cover_image_url:      form.cover_image_url || null,
        starts_at: toIsoOrNull(form.starts_at || form.date),
        ends_at:   toIsoOrNull(form.ends_at),
        registration_deadline: toIsoOrNull(form.registration_deadline),
        // Paid-event fields. Convert rupees → paise for the API.
        // Empty strings become nulls so the validator's optional()
        // branches are hit instead of failing on "" vs. UPI regex.
        is_paid: !!form.is_paid,
        price_paise: form.is_paid && form.price_rupees
          ? Math.round(Number(form.price_rupees) * 100)
          : 0,
        payment_upi_id:       form.is_paid ? (form.payment_upi_id || null) : null,
        payment_qr_base64:    form.is_paid ? (form.payment_qr_base64 || null) : null,
        payment_instructions: form.is_paid ? (form.payment_instructions || null) : null,
        // Team-event fields. When is_team_event is off we send the DB
        // defaults (2/5) rather than null — the columns are NOT NULL
        // per migration 22.
        is_team_event:  !!form.is_team_event,
        min_team_size:  form.is_team_event ? Number(form.min_team_size) || 2 : 2,
        max_team_size:  form.is_team_event ? Number(form.max_team_size) || 5 : 5,
      };
      // strip the UI-only field before sending
      delete payload.price_rupees;
      if (editId) {
        await eventsApi.update(editId, payload);
        showMsg("Event updated");
      } else {
        await eventsApi.create(payload);
        showMsg("Event created");
      }
      setForm({ ...EMPTY_FORM }); setEditId(null); setShowForm(false);
      fetchEvents();
    } catch (err) {
      // Surface the first Zod issue (path + message) when the validator
      // rejects the payload, so "Validation failed" stops being an
      // unactionable wall and the admin can see e.g. "venue_link: must
      // be a URL".
      const data = err.response?.data;
      const firstIssue = data?.issues?.[0];
      const detail = firstIssue
        ? `${firstIssue.path}: ${firstIssue.message}`
        : null;
      showMsg(detail || data?.error || "Failed");
    }
    setSaving(false);
  };

  const handleEdit = (ev) => {
    setForm({
      title: ev.title || "", description: ev.description || "", location: ev.location || "",
      date: ev.date ? new Date(ev.date).toISOString().slice(0, 16) : "",
      event_type: ev.event_type || "general", organiser: ev.organiser || "",
      tags: (ev.tags || []).join(", "), capacity: ev.capacity || "",
      venue_type: ev.venue_type || "in-person", venue_link: ev.venue_link || "",
      xp_reward: String(ev.xp_reward || 0), xp_bonus_first: String(ev.xp_bonus_first || 0),
      xp_bonus_winner: String(ev.xp_bonus_winner || 0),
      requires_checkin: ev.requires_checkin || false, checkin_code: ev.checkin_code || "",
      starts_at: ev.starts_at ? new Date(ev.starts_at).toISOString().slice(0, 16) : "",
      ends_at: ev.ends_at ? new Date(ev.ends_at).toISOString().slice(0, 16) : "",
      cover_image_url: ev.cover_image_url || "",
      registration_deadline: ev.registration_deadline ? new Date(ev.registration_deadline).toISOString().slice(0, 16) : "",
      banner_color: ev.banner_color || "#7c3aed",
      // Paid-event fields
      is_paid: !!ev.is_paid,
      price_rupees: ev.price_paise ? String(ev.price_paise / 100) : "",
      payment_upi_id: ev.payment_upi_id || "",
      payment_qr_base64: ev.payment_qr_base64 || "",
      payment_instructions: ev.payment_instructions || "",
      // Team-event fields
      is_team_event: !!ev.is_team_event,
      min_team_size: ev.min_team_size != null ? String(ev.min_team_size) : "2",
      max_team_size: ev.max_team_size != null ? String(ev.max_team_size) : "5",
    });
    setEditId(ev.id); setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Convert an uploaded file (File object) to a data:URL string so
  // the backend can store it inline. 200KB cap is enforced by the
  // Zod validator server-side; we surface an early error client-side
  // so the user doesn't upload then get rejected.
  const handleQrFile = async (file) => {
    if (!file) return;
    if (file.size > 200 * 1024) {
      showMsg("QR image too large — re-export at a lower resolution (target <50KB)");
      return;
    }
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      showMsg("QR must be a PNG or JPEG image");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setField("payment_qr_base64", reader.result);
    reader.readAsDataURL(file);
  };

  const viewPayments = async (eventId) => {
    if (expandedPayments === eventId) { setExpandedPayments(null); return; }
    setExpandedPayments(eventId); setPaymentsLoading(true);
    try {
      const { data } = await eventsApi.listPayments(eventId);
      setPaymentsData({ event: data.event, registrations: data.registrations || [] });
    } catch {
      setPaymentsData({ event: null, registrations: [] });
    }
    setPaymentsLoading(false);
  };

  const refreshPayments = async (eventId) => {
    setPaymentsLoading(true);
    try {
      const { data } = await eventsApi.listPayments(eventId);
      setPaymentsData({ event: data.event, registrations: data.registrations || [] });
    } catch { /* keep prior data */ }
    setPaymentsLoading(false);
  };

  const handleMarkPaid = async (eventId, regId) => {
    setReconcilingId(regId);
    try {
      await eventsApi.markPaid(eventId, regId);
      showMsg("Marked paid");
      await refreshPayments(eventId);
    } catch (err) {
      showMsg(err.response?.data?.error || "Mark-paid failed");
    } finally {
      setReconcilingId(null);
    }
  };

  const handleRejectPayment = async (eventId, regId) => {
    const reason = window.prompt("Reason for rejecting this payment (shown to the student):");
    if (!reason || !reason.trim()) return;
    setReconcilingId(regId);
    try {
      await eventsApi.rejectPayment(eventId, regId, reason.trim());
      showMsg("Payment rejected");
      await refreshPayments(eventId);
    } catch (err) {
      showMsg(err.response?.data?.error || "Reject failed");
    } finally {
      setReconcilingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this event?")) return;
    try { await eventsApi.remove(id); showMsg("Event deleted"); fetchEvents(); }
    catch (err) { showMsg(err.response?.data?.error || "Delete failed"); }
  };

  const handleToggleReg = async (id) => {
    try { await eventsApi.toggleReg(id); fetchEvents(); }
    catch (err) { showMsg(err.response?.data?.error || "Could not toggle registration"); }
  };

  const viewRegistrations = async (eventId) => {
    if (expandedRegs === eventId) { setExpandedRegs(null); return; }
    setExpandedRegs(eventId); setRegsLoading(true);
    try { const { data } = await eventsApi.registrations(eventId); setRegsData(Array.isArray(data) ? data : []); }
    catch { setRegsData([]); }
    setRegsLoading(false);
  };

  const viewAttendance = async (eventId) => {
    if (expandedAtt === eventId) { setExpandedAtt(null); return; }
    setExpandedAtt(eventId); setAttLoading(true);
    try { const { data } = await eventsApi.attendance(eventId); setAttData(Array.isArray(data) ? data : []); }
    catch { setAttData([]); }
    setAttLoading(false);
  };

  const viewHealth = async (eventId) => {
    if (expandedHealth === eventId) { setExpandedHealth(null); return; }
    setExpandedHealth(eventId); setHealthLoading(true);
    try { const { data } = await insights.eventHealth(eventId); setHealthData(data); }
    catch { setHealthData(null); }
    setHealthLoading(false);
  };

  const exportCSV = (data, filename) => {
    if (!data.length) return;
    const rows = data.map(row => {
      const flat = { ...row };
      if (row.students) { flat.student_name = row.students.name; flat.student_email = row.students.email; }
      delete flat.students;
      // Nested values (team members, payment details) would otherwise
      // serialise as "[object Object]".
      for (const k of Object.keys(flat)) {
        if (flat[k] !== null && typeof flat[k] === "object") flat[k] = JSON.stringify(flat[k]);
      }
      return flat;
    });
    // Union of keys — later rows can carry fields the first row lacks.
    const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => cell(r[h])).join(","))].join("\n");
    // BOM so Excel reads UTF-8 (avatar emojis, accented names) correctly.
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${filename}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filtered = filter === "all" ? eventsList
    : filter === "live" ? eventsList.filter(e => e.status === "active")
    : filter === "upcoming" ? eventsList.filter(e => e.status === "upcoming" || e.status === "registering")
    : eventsList.filter(e => e.status === "completed" || e.status === "past");

  // Top-event bars in the insights panel grow to their share as they scroll in.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray("[data-topbar]").forEach((el, i) => {
        gsap.from(el, {
          scaleX: 0, transformOrigin: "left center", duration: 1.2, ease: "expo.out", delay: i * 0.08,
          scrollTrigger: { trigger: el, start: "top 95%", once: true },
        });
      });
    });
  }, { scope: root, dependencies: [adminInsights, loading], revertOnUpdate: true });

  if (loading) return (
    <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading events..." /></div>
  );

  const filterCount = {
    all: eventsList.length,
    upcoming: stats.upcoming,
    live: stats.live,
    past: eventsList.filter(e => e.status === "completed" || e.status === "past").length,
  };
  const topMax = Math.max(1, ...(adminInsights?.top_events || []).map(t => t.count || 0));

  return (
    <div ref={root} className="flex flex-col">
      <PageHeader
        context="Admin"
        title="Events"
        description="Plan sessions, open registration, check people in and reconcile payments."
        actions={(
          <>
            <Button size="sm" variant="secondary" onClick={() => navigate("/teacher/scanner")} leading={icon(ScanLine)}>QR Scanner</Button>
            <Button
              size="sm"
              onClick={() => { setShowForm(!showForm); if (showForm) { setEditId(null); setForm({ ...EMPTY_FORM }); } }}
              leading={icon(showForm ? X : Plus)}
            >
              {showForm ? "Cancel" : "Create Event"}
            </Button>
          </>
        )}
      >
        <SegmentedTabs
          aria-label="Filter events"
          value={filter}
          onChange={setFilter}
          items={[
            { value: "all", label: "All", count: filterCount.all },
            { value: "upcoming", label: "Upcoming", count: filterCount.upcoming },
            { value: "live", label: "Live", count: filterCount.live },
            { value: "past", label: "Past", count: filterCount.past },
          ]}
        />
      </PageHeader>

      {/* Stats */}
      <div data-stagger="scale" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Total" value={stats.total} icon={CalendarDays} />
        <StatTile label="Upcoming" value={stats.upcoming} icon={CalendarClock} />
        <StatTile label="Live now" value={stats.live} icon={Radio} tone="good" sub={stats.live ? "Happening right now" : undefined} lit={stats.live > 0} />
        <StatTile label="Registrations" value={stats.totalRegs} icon={Users} />
        <StatTile label="Registration open" value={stats.regOpen} icon={DoorOpen} className="col-span-2 sm:col-span-1" />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {msg && (
          <motion.div key="msg" role="status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mt-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{msg}</motion.div>
        )}
      </AnimatePresence>

      {/* Create / Edit Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0, rotateX: -10 }}
            animate={{ opacity: 1, height: "auto", rotateX: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformPerspective: 1000, transformOrigin: "50% 0%" }}
          >
            <form onSubmit={handleSubmit} className="lamp-panel lamp-panel--lit mt-6 space-y-5 p-5 sm:p-6">
              <h2 className="text-xl text-text-primary">{editId ? "Edit event" : "New event"}</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2"><InputField label="Title" placeholder="Event name" value={form.title} onChange={e => setField("title", e.target.value)} required /></div>
                <div>
                  <label htmlFor="ev-type" className={LABEL}>Type</label>
                  <select id="ev-type" value={form.event_type} onChange={e => setField("event_type", e.target.value)} className={FIELD}>
                    <option value="general">General</option><option value="hackathon">Hackathon</option>
                    <option value="workshop">Workshop</option><option value="competition">Competition</option><option value="seminar">Seminar</option>
                  </select>
                </div>
              </div>
              <InputField label="Description" placeholder="Event details" value={form.description} onChange={e => setField("description", e.target.value)} multiline />
              <div className="grid gap-4 sm:grid-cols-3">
                <InputField label="Location" placeholder="Campus / Online" value={form.location} onChange={e => setField("location", e.target.value)} />
                <div>
                  <label htmlFor="ev-venue" className={LABEL}>Venue</label>
                  <select id="ev-venue" value={form.venue_type} onChange={e => setField("venue_type", e.target.value)} className={FIELD}>
                    <option value="in-person">In-Person</option><option value="online">Online</option><option value="hybrid">Hybrid</option>
                  </select>
                </div>
                {(form.venue_type === "online" || form.venue_type === "hybrid") && (
                  <InputField label="Meeting Link" placeholder="https://meet.google.com/..." value={form.venue_link} onChange={e => setField("venue_link", e.target.value)} />
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div><label htmlFor="ev-start" className={LABEL}>Start</label>
                  <input id="ev-start" type="datetime-local" value={form.starts_at || form.date} onChange={e => { setField("starts_at", e.target.value); setField("date", e.target.value); }} className={FIELD} /></div>
                <div><label htmlFor="ev-end" className={LABEL}>End</label>
                  <input id="ev-end" type="datetime-local" value={form.ends_at} onChange={e => setField("ends_at", e.target.value)} className={FIELD} /></div>
                <div><label htmlFor="ev-deadline" className={LABEL}>Registration deadline</label>
                  <input id="ev-deadline" type="datetime-local" value={form.registration_deadline} onChange={e => setField("registration_deadline", e.target.value)} className={FIELD} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <InputField label="Capacity" placeholder="∞" type="number" value={form.capacity} onChange={e => setField("capacity", e.target.value)} />
                <InputField label="XP Reward" placeholder="0" type="number" value={form.xp_reward} onChange={e => setField("xp_reward", e.target.value)} />
                <InputField label="Early Bird XP" placeholder="0" type="number" value={form.xp_bonus_first} onChange={e => setField("xp_bonus_first", e.target.value)} />
                <InputField label="Winner XP" placeholder="0" type="number" value={form.xp_bonus_winner} onChange={e => setField("xp_bonus_winner", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <InputField label="Organiser" placeholder="Dept of AI&ML" value={form.organiser} onChange={e => setField("organiser", e.target.value)} />
                <InputField label="Tags (comma)" placeholder="math, hackathon" value={form.tags} onChange={e => setField("tags", e.target.value)} />
                <div>
                  <p className={LABEL}>Check-in</p>
                  <div className="flex min-h-[48px] flex-wrap items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-text-muted">
                      <input type="checkbox" checked={form.requires_checkin} onChange={e => setField("requires_checkin", e.target.checked)} className="h-4 w-4 accent-primary" />
                      Require code
                    </label>
                    {form.requires_checkin && (
                      <input type="text" aria-label="Check-in code" placeholder="6-digit" value={form.checkin_code} onChange={e => setField("checkin_code", e.target.value)} maxLength={6}
                        className="w-28 rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-3 py-2 font-mono text-sm tracking-widest text-text-primary outline-none focus:border-primary/50" />
                    )}
                  </div>
                </div>
              </div>
              {/* ── Team Event (migration 22) ── */}
              <div className={`rounded-2xl border p-4 transition-colors ${form.is_team_event ? "border-secondary/35 bg-secondary/[0.06]" : "border-[rgb(var(--rule))] bg-white/[0.02]"}`}>
                <label className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-primary">
                  <input type="checkbox" checked={form.is_team_event} onChange={e => setField("is_team_event", e.target.checked)} className="h-4 w-4 accent-primary" />
                  <UsersRound className="h-4 w-4 text-secondary" strokeWidth={1.75} aria-hidden="true" />
                  <span className="font-medium">This is a team event</span>
                  <span className="text-[13px] text-text-dim">(one leader registers on behalf of the team)</span>
                </label>
                <AnimatePresence initial={false}>
                  {form.is_team_event && (
                    <motion.div key="team" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <InputField label="Min team size" type="number" value={form.min_team_size} onChange={e => setField("min_team_size", e.target.value)} placeholder="2" />
                        <InputField label="Max team size" type="number" value={form.max_team_size} onChange={e => setField("max_team_size", e.target.value)} placeholder="5" />
                      </div>
                      <p className="mt-3 text-[13px] leading-6 text-text-dim">
                        Students will be asked for a team name and team size at registration. The size is validated against the range above. One QR / one check-in per team.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              {/* ── Paid Event (migration 19) ── */}
              <div className={`rounded-2xl border p-4 transition-colors ${form.is_paid ? "border-primary/35 bg-primary/[0.05]" : "border-[rgb(var(--rule))] bg-white/[0.02]"}`}>
                <label className="flex cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-primary">
                  <input type="checkbox" checked={form.is_paid} onChange={e => setField("is_paid", e.target.checked)} className="h-4 w-4 accent-primary" />
                  <IndianRupee className="h-4 w-4 text-primary" strokeWidth={1.75} aria-hidden="true" />
                  <span className="font-medium">This is a paid event</span>
                  <span className="text-[13px] text-text-dim">(manual UPI / QR)</span>
                </label>
                <AnimatePresence initial={false}>
                  {form.is_paid && (
                    <motion.div key="paid" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <InputField label="Price (₹)" placeholder="50" type="number" value={form.price_rupees} onChange={e => setField("price_rupees", e.target.value)} />
                          <InputField label="UPI ID (VPA)" placeholder="name@okhdfcbank" value={form.payment_upi_id} onChange={e => setField("payment_upi_id", e.target.value)} />
                        </div>
                        <div>
                          <label htmlFor="ev-qr" className={LABEL}>QR image <span className="text-text-dim">(PNG or JPEG, under 50KB is ideal)</span></label>
                          <input id="ev-qr" type="file" accept="image/png,image/jpeg" onChange={e => handleQrFile(e.target.files?.[0])}
                            className={`${FIELD} file:mr-3 file:rounded-lg file:border-0 file:bg-primary/20 file:px-3 file:py-1 file:text-text-primary`} />
                          {form.payment_qr_base64 && (
                            <div className="mt-2 flex items-start gap-3">
                              <img src={form.payment_qr_base64} alt="QR preview" loading="lazy" decoding="async" width="96" height="96" className="h-24 w-24 rounded-xl border border-[rgb(var(--rule))] bg-white p-1" />
                              <button type="button" onClick={() => setField("payment_qr_base64", "")}
                                className="min-h-[36px] rounded-lg px-2 text-[13px] text-danger hover:bg-danger/10">remove</button>
                            </div>
                          )}
                        </div>
                        <InputField label="Instructions (shown to students)" placeholder="Include your USN in the transaction note"
                          value={form.payment_instructions} onChange={e => setField("payment_instructions", e.target.value)} multiline />
                        <p className="text-[13px] leading-6 text-text-dim">
                          Students will see the QR + UPI ID on the event page, pay from their UPI app, and submit the 12-digit reference number. You verify in your own bank app and mark them paid from the Payments panel on each event.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={saving} size="sm">{editId ? "Update Event" : "Create Event"}</Button>
                {editId && <Button variant="ghost" size="sm" onClick={() => { setEditId(null); setForm({ ...EMPTY_FORM }); setShowForm(false); }}>Cancel Edit</Button>}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event List */}
      <div className="mt-8 space-y-4">
        {filtered.length === 0 && (
          <EmptyState compact title="No events found" body="Nothing matches this filter. Switch tabs or create an event." />
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          {filtered.map(ev => {
            const live = ev.status === "active";
            return (
              <motion.div
                key={ev.id}
                layout="position"
                initial={{ opacity: 0, y: 18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              >
                <article className={`lamp-panel relative overflow-hidden p-5 sm:p-6 ${live ? "lamp-panel--lit" : ""}`}>
                  {ev.banner_color && (
                    <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ background: ev.banner_color }} />
                  )}
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <EventStatusBadge status={ev.status} />
                        <EventTypeBadge type={ev.event_type} />
                        <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleToggleReg(ev.id)}
                          aria-label={`Registration is ${ev.registration_open ? "open" : "closed"} — toggle`}
                          className={`min-h-[28px] rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition ${ev.registration_open ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
                          Reg: {ev.registration_open ? "Open" : "Closed"}
                        </motion.button>
                        {ev.xp_reward > 0 && <span className="lamp-numerals text-[12px] text-primary">+{ev.xp_reward} XP</span>}
                      </div>
                      <h3 className="mt-3 text-xl text-text-primary">{ev.title}</h3>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-muted">
                        {(ev.starts_at || ev.date) && (
                          <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-text-dim" strokeWidth={1.75} aria-hidden="true" /><span className="lamp-numerals">{new Date(ev.starts_at || ev.date).toLocaleString()}</span></span>
                        )}
                        {ev.location && <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-text-dim" strokeWidth={1.75} aria-hidden="true" />{ev.location}</span>}
                        {ev.organiser && <span>by {ev.organiser}</span>}
                      </div>
                      {ev.description && <p className="mt-2 line-clamp-2 max-w-[70ch] text-sm text-text-muted">{ev.description}</p>}
                      {(ev.capacity || ev.registration_count > 0) && (
                        <div className="mt-3 max-w-xs"><CapacityBar current={ev.registration_count || 0} max={ev.capacity} /></div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-[22rem] lg:justify-end">
                      <Button variant={expandedRegs === ev.id ? "secondary" : "ghost"} size="sm" onClick={() => viewRegistrations(ev.id)} aria-expanded={expandedRegs === ev.id}>
                        {expandedRegs === ev.id ? "Hide" : `Regs (${ev.registration_count || 0})`}
                      </Button>
                      <Button variant={expandedAtt === ev.id ? "secondary" : "ghost"} size="sm" onClick={() => viewAttendance(ev.id)} aria-expanded={expandedAtt === ev.id}>
                        {expandedAtt === ev.id ? "Hide" : "Attendance"}
                      </Button>
                      <Button variant={expandedHealth === ev.id ? "secondary" : "ghost"} size="sm" onClick={() => viewHealth(ev.id)} aria-expanded={expandedHealth === ev.id}>
                        {expandedHealth === ev.id ? "Hide" : "Health"}
                      </Button>
                      {ev.is_paid && (
                        <Button variant={expandedPayments === ev.id ? "secondary" : "ghost"} size="sm" onClick={() => viewPayments(ev.id)} aria-expanded={expandedPayments === ev.id}>
                          {expandedPayments === ev.id ? "Hide" : "Payments"}
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => handleEdit(ev)} leading={icon(Pencil)}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => handleDelete(ev.id)} leading={icon(Trash2)}>Delete</Button>
                    </div>
                  </div>
                </article>

                {/* Registrations Panel */}
                <AnimatePresence>
                  {expandedRegs === ev.id && (
                    <SubPanel key="regs" accent="border-l-primary/50" title="Registrations" tone="text-primary"
                      action={regsData.length > 0 && <Button variant="ghost" size="sm" onClick={() => exportCSV(regsData, `regs-${ev.title}`)} leading={icon(Download)}>Export CSV</Button>}>
                      {regsLoading ? <Loader variant="dots" size="sm" /> : regsData.length === 0 ? (
                        <p className="text-[13px] text-text-dim">No registrations yet</p>
                      ) : (
                        <ScrollTable minWidth="min-w-[620px]" head={["Student", "Email", "Status", "Date", "Team"]}>
                          {regsData.map(r => (
                            <tr key={r.id} className="border-b border-[rgb(var(--rule))] last:border-b-0 hover:bg-white/[0.02]">
                              <td className="px-3 py-2.5 text-text-primary">
                                {r.user_id
                                  ? <UserHoverCard userId={r.user_id}>{r.students?.name || "—"}</UserHoverCard>
                                  : (r.students?.name || "—")}
                              </td>
                              <td className="px-3 py-2.5 text-text-muted">{r.students?.email || "—"}</td>
                              <td className="px-3 py-2.5"><Pill tone={
                                r.status === "attended" ? "good" : r.status === "registered" ? "violet" : r.status === "waitlisted" ? "warn" : "bad"
                              }>{r.status}</Pill></td>
                              <td className="lamp-numerals px-3 py-2.5 text-text-muted">{r.registered_at ? new Date(r.registered_at).toLocaleDateString() : "—"}</td>
                              <td className="px-3 py-2.5 text-text-muted">{r.team_name || "—"}</td>
                            </tr>
                          ))}
                        </ScrollTable>
                      )}
                    </SubPanel>
                  )}
                </AnimatePresence>

                {/* Attendance Panel */}
                <AnimatePresence>
                  {expandedAtt === ev.id && (
                    <SubPanel key="att" accent="border-l-success/50" title="Attendance" tone="text-success"
                      action={attData.length > 0 && <Button variant="ghost" size="sm" onClick={() => exportCSV(attData, `attendance-${ev.title}`)} leading={icon(Download)}>Export CSV</Button>}>
                      {attLoading ? <Loader variant="dots" size="sm" /> : attData.length === 0 ? (
                        <p className="text-[13px] text-text-dim">No attendance yet</p>
                      ) : (
                        <ScrollTable minWidth="min-w-[560px]" head={["Student", "Method", "Time", "XP", "Session"]} numericCols={[3]}>
                          {attData.map(a => (
                            <tr key={a.id} className="border-b border-[rgb(var(--rule))] last:border-b-0 hover:bg-white/[0.02]">
                              <td className="px-3 py-2.5 text-text-primary">
                                {a.user_id
                                  ? <UserHoverCard userId={a.user_id}>{a.students?.name || "—"}</UserHoverCard>
                                  : (a.students?.name || "—")}
                              </td>
                              <td className="px-3 py-2.5"><Pill tone={a.checkin_method === "qr" ? "lamp" : a.checkin_method === "code" ? "violet" : "muted"}>{a.checkin_method}</Pill></td>
                              <td className="lamp-numerals px-3 py-2.5 text-text-muted">{a.checkin_time ? new Date(a.checkin_time).toLocaleString() : "—"}</td>
                              <td className="lamp-numerals px-3 py-2.5 text-right text-primary">{a.xp_awarded || 0}</td>
                              <td className="px-3 py-2.5 text-text-muted">{a.session_label || "—"}</td>
                            </tr>
                          ))}
                        </ScrollTable>
                      )}
                    </SubPanel>
                  )}
                </AnimatePresence>

                {/* Payments Panel (migration 19) */}
                <AnimatePresence>
                  {expandedPayments === ev.id && ev.is_paid && (
                    <SubPanel key="pay" accent="border-l-secondary/50" title="Payments" tone="text-secondary"
                      sub={paymentsData.event && <span className="lamp-numerals">₹{((paymentsData.event.price_paise || 0) / 100).toFixed(2)} per seat</span>}
                      action={(
                        <div className="flex flex-wrap gap-2">
                          {paymentsData.registrations.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={() => exportCSV(paymentsData.registrations, `payments-${ev.title}`)} leading={icon(Download)}>Export CSV</Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => refreshPayments(ev.id)} leading={icon(RefreshCw)}>Refresh</Button>
                        </div>
                      )}>
                      {paymentsLoading ? <Loader variant="dots" size="sm" /> : paymentsData.registrations.length === 0 ? (
                        <p className="text-[13px] text-text-dim">No registrations yet</p>
                      ) : (
                        <ScrollTable minWidth="min-w-[760px]" head={["Student", "Email", "UPI Ref", "Status", "Paid At", "Actions"]}>
                          {paymentsData.registrations.map(r => {
                            const ps = r.payment_status || "pending";
                            const busy = reconcilingId === r.id;
                            return (
                              <tr key={r.id} className="border-b border-[rgb(var(--rule))] last:border-b-0 hover:bg-white/[0.02]">
                                <td className="px-3 py-2.5 text-text-primary">
                                  {r.user_id
                                    ? <UserHoverCard userId={r.user_id}>{r.students?.name || "—"}</UserHoverCard>
                                    : (r.students?.name || "—")}
                                </td>
                                <td className="px-3 py-2.5 text-text-muted">{r.students?.email || "—"}</td>
                                <td className="px-3 py-2.5 font-mono text-[12px] text-text-muted">{r.payment_ref || "—"}</td>
                                <td className="px-3 py-2.5"><Pill tone={
                                  ps === "paid" ? "good" : ps === "submitted" ? "violet" : ps === "rejected" ? "bad" : ps === "pending" ? "warn" : "muted"
                                }>{ps.replace("_", " ")}</Pill></td>
                                <td className="lamp-numerals px-3 py-2.5 text-text-muted">{r.paid_at ? new Date(r.paid_at).toLocaleDateString() : "—"}</td>
                                <td className="px-3 py-2.5">
                                  {ps === "submitted" && (
                                    <div className="flex gap-1.5">
                                      <Button variant="primary" size="sm" loading={busy} onClick={() => handleMarkPaid(ev.id, r.id)}>Mark paid</Button>
                                      <Button variant="danger" size="sm" loading={busy} onClick={() => handleRejectPayment(ev.id, r.id)}>Reject</Button>
                                    </div>
                                  )}
                                  {ps === "rejected" && r.rejection_reason && (
                                    <span className="text-[12px] text-danger">{r.rejection_reason}</span>
                                  )}
                                  {ps === "paid" && (
                                    <span className="inline-flex items-center gap-1 text-[12px] text-success"><Check className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />verified</span>
                                  )}
                                  {(ps === "pending" || ps === "not_required") && (
                                    <span className="text-[12px] text-text-dim">awaiting ref</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </ScrollTable>
                      )}
                    </SubPanel>
                  )}
                </AnimatePresence>

                {/* Health Metrics Panel */}
                <AnimatePresence>
                  {expandedHealth === ev.id && (
                    <SubPanel key="health" accent="border-l-warning/50" title="Event health" tone="text-warning">
                      {healthLoading ? <Loader variant="dots" size="sm" /> : !healthData ? (
                        <p className="text-[13px] text-text-dim">No data</p>
                      ) : (
                        <div className="grid gap-6 sm:grid-cols-3">
                          <div>
                            <p className="mb-3 text-[13px] font-medium text-text-muted">Registration</p>
                            <dl className="grid grid-cols-2 gap-3">
                              {[
                                { label: "Total", val: healthData.registration?.total || 0, cls: "text-text-primary" },
                                { label: "Attended", val: healthData.registration?.attended || 0, cls: "text-success" },
                                { label: "Cancelled", val: healthData.registration?.cancelled || 0, cls: "text-danger" },
                                { label: "Waitlisted", val: healthData.registration?.waitlisted || 0, cls: "text-warning" },
                              ].map(s => (
                                <div key={s.label} className="rounded-xl bg-white/[0.025] px-3 py-2">
                                  <dd className={`lamp-numerals text-xl ${s.cls}`}><AnimatedNumber value={s.val} duration={1} /></dd>
                                  <dt className="text-[12px] text-text-dim">{s.label}</dt>
                                </div>
                              ))}
                            </dl>
                          </div>
                          <div>
                            <p className="mb-3 text-[13px] font-medium text-text-muted">Rates</p>
                            <div className="space-y-3">
                              <RateBar label="Fill rate" value={healthData.rates?.fill_rate} display={`${healthData.rates?.fill_rate ?? "∞"}%`} tone="bg-primary" text="text-text-primary" />
                              <RateBar
                                label="Attendance"
                                value={healthData.rates?.attendance_rate || 0}
                                display={`${healthData.rates?.attendance_rate || 0}%`}
                                tone={healthData.rates?.attendance_rate >= 70 ? "bg-success" : healthData.rates?.attendance_rate >= 40 ? "bg-warning" : "bg-danger"}
                                text={healthData.rates?.attendance_rate >= 70 ? "text-success" : healthData.rates?.attendance_rate >= 40 ? "text-warning" : "text-danger"}
                              />
                              <RateBar
                                label="Cancel rate"
                                value={healthData.rates?.cancel_rate || 0}
                                display={`${healthData.rates?.cancel_rate || 0}%`}
                                tone={healthData.rates?.cancel_rate <= 10 ? "bg-success" : "bg-danger"}
                                text={healthData.rates?.cancel_rate <= 10 ? "text-success" : "text-danger"}
                              />
                            </div>
                          </div>
                          <div>
                            <p className="mb-3 text-[13px] font-medium text-text-muted">Check-in methods</p>
                            <dl className="space-y-1.5 text-sm">
                              {[
                                { label: "QR Scan", val: healthData.attendance?.qr || 0, color: "text-primary" },
                                { label: "Code", val: healthData.attendance?.code || 0, color: "text-secondary" },
                                { label: "Manual", val: healthData.attendance?.manual || 0, color: "text-text-muted" },
                              ].map(m => (
                                <div key={m.label} className="flex justify-between">
                                  <dt className="text-text-dim">{m.label}</dt>
                                  <dd className={`lamp-numerals ${m.color}`}>{m.val}</dd>
                                </div>
                              ))}
                              <div className="mt-2 flex justify-between border-t border-[rgb(var(--rule))] pt-2">
                                <dt className="text-text-dim">Total XP awarded</dt>
                                <dd className="lamp-numerals text-primary">{healthData.xp?.total_awarded || 0}</dd>
                              </div>
                            </dl>
                          </div>
                        </div>
                      )}
                    </SubPanel>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Platform Insights */}
      {adminInsights && (
        <section data-reveal="tilt" className="lamp-panel mt-8 p-5 sm:p-6">
          <h2 className="text-xl text-text-primary">Platform insights</h2>
          <dl data-stagger="up" className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Active users", val: adminInsights.registrations?.active_users || 0, cls: "text-primary" },
              { label: "Attendance rate", val: adminInsights.registrations?.attendance_rate || 0, suffix: "%", cls: "text-success" },
              { label: "Achievements unlocked", val: adminInsights.achievements?.total_unlocks || 0, cls: "text-warning" },
              { label: "Total registrations", val: adminInsights.registrations?.total || 0, cls: "text-secondary" },
            ].map(s => (
              <div key={s.label} className="border-l border-[rgb(var(--rule))] pl-4">
                <dd className={`lamp-numerals text-[1.75rem] leading-none ${s.cls}`}><AnimatedNumber value={s.val} suffix={s.suffix || ""} /></dd>
                <dt className="mt-1.5 text-[13px] text-text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
          {adminInsights.top_events?.length > 0 && (
            <div className="mt-7">
              <p className="mb-3 text-[13px] font-medium text-text-muted">Top events by registration</p>
              <ol className="space-y-1.5">
                {adminInsights.top_events.map((ev, i) => (
                  <li key={ev.id} className="relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2">
                    <span data-topbar aria-hidden="true" className="absolute inset-y-0 left-0 rounded-xl bg-primary/[0.08]" style={{ width: `${Math.max(4, ((ev.count || 0) / topMax) * 100)}%` }} />
                    <span className="lamp-numerals relative w-6 text-right text-[13px] text-text-dim">{i + 1}</span>
                    <span className="relative min-w-0 flex-1 truncate text-sm text-text-primary">{ev.title}</span>
                    <span className="relative hidden rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-text-muted sm:inline">{ev.type}</span>
                    <span className="lamp-numerals relative text-sm text-primary">{ev.count}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/* ── Presentational helpers ───────────────────────────── */

const PILL_TONES = {
  good: "border-success/30 bg-success/10 text-success",
  bad: "border-danger/30 bg-danger/10 text-danger",
  warn: "border-warning/30 bg-warning/10 text-warning",
  violet: "border-secondary/30 bg-secondary/10 text-secondary",
  lamp: "border-primary/30 bg-primary/10 text-primary",
  muted: "border-[rgb(var(--rule))] bg-white/[0.04] text-text-muted",
};

function Pill({ tone = "muted", children }) {
  return <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${PILL_TONES[tone]}`}>{children}</span>;
}

function SubPanel({ accent, title, tone, sub, action, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0, y: -8 }}
      animate={{ opacity: 1, height: "auto", y: 0 }}
      exit={{ opacity: 0, height: 0, y: -8 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      <div className={`lamp-panel mt-2 border-l-2 p-4 sm:ml-5 sm:p-5 ${accent}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className={`text-[15px] font-medium ${tone}`}>{title}</h4>
            {sub ? <p className="mt-0.5 text-[13px] text-text-dim">{sub}</p> : null}
          </div>
          {action || null}
        </div>
        {children}
      </div>
    </motion.div>
  );
}

function ScrollTable({ head, minWidth, numericCols = [], children }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className={`w-full text-left text-[13px] ${minWidth}`}>
        <thead>
          <tr className="border-b border-[rgb(var(--rule))] text-[12px] text-text-dim">
            {head.map((h, i) => <th key={h} className={`px-3 py-2 font-medium ${numericCols.includes(i) ? "text-right" : ""}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody data-stagger="fade">{children}</tbody>
      </table>
    </div>
  );
}

function RateBar({ label, value, display, tone, text }) {
  const pct = typeof value === "number" ? Math.min(100, Math.max(0, value)) : 100;
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span className="text-text-dim">{label}</span>
        <span className={`lamp-numerals ${text}`}>{display}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <motion.div
          className={`h-full origin-left rounded-full ${tone}`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        />
      </div>
    </div>
  );
}
