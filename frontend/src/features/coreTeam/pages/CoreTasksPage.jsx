import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { CalendarClock, Plus, Trash2, UserRound } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { core } from "@/lib/api";
import { useCoreStore } from "@/store/core-store";
import { ModalShell, Field, INPUT_CLS } from "@/features/coreTeam/components/FormBits";
import { EmptyState, PageHeader, SegmentedTabs } from "@/components/lamp";

const STATUS = {
  open:        { label: "Open",        cls: "border-secondary/35 bg-secondary/10 text-secondary" },
  todo:        { label: "To do",       cls: "border-[rgb(var(--rule))] bg-white/[0.04] text-text-muted" },
  in_progress: { label: "In progress", cls: "border-warning/40 bg-warning/10 text-warning" },
  submitted:   { label: "Submitted",   cls: "border-primary/40 bg-primary/10 text-primary" },
  confirmed:   { label: "Confirmed",   cls: "border-success/40 bg-success/10 text-success" },
};

// Board columns. Purely a view over the same filtered list.
const COLUMNS = [
  { key: "todo",      label: "To do",       statuses: ["open", "todo"], dot: "bg-secondary", empty: "Nothing waiting to be claimed." },
  { key: "doing",     label: "In progress", statuses: ["in_progress"],  dot: "bg-warning",   empty: "No one is working on anything here." },
  { key: "submitted", label: "Submitted",   statuses: ["submitted"],    dot: "bg-primary",   empty: "Nothing waiting for a head to confirm." },
  { key: "done",      label: "Confirmed",   statuses: ["confirmed"],    dot: "bg-success",   empty: "Confirmed work lands here." },
];

function fmtDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function CoreTasksPage() {
  const { member } = useCoreStore();
  const [tasks, setTasks] = useState(null);
  const [teams, setTeams] = useState([]);
  const [filter, setFilter] = useState("mine");
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [submitFor, setSubmitFor] = useState(null);

  const isLead = member?.tier === "council" || member?.tier === "head";

  const load = useCallback(() => {
    core.tasks()
      .then((r) => setTasks(Array.isArray(r.data) ? r.data : []))
      .catch(() => setTasks([]));
  }, []);

  useEffect(() => {
    load();
    core.teams().then((r) => setTeams(r.data?.teams || [])).catch(() => {});
  }, [load]);

  const act = async (fn, id) => {
    setBusy(id);
    setErr(null);
    try {
      await fn();
      load();
    } catch (e) {
      setErr(e?.response?.data?.error || "Action failed.");
    }
    setBusy(null);
  };

  if (!tasks) {
    return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading tasks…" /></div>;
  }

  const FILTERS = [
    { key: "mine",    label: "My Tasks" },
    { key: "team",    label: "My Team" },
    { key: "open",    label: "Open" },
    ...(isLead ? [{ key: "confirm", label: "Awaiting Confirm" }] : []),
    { key: "all",     label: "All" },
  ];

  const visible = tasks.filter((t) => {
    if (filter === "mine")    return t.claimer?.id === member?.id;
    if (filter === "team")    return t.team_id && t.team_id === member?.team_id;
    if (filter === "open")    return t.is_open;
    if (filter === "confirm") return t.status === "submitted" &&
      (member?.tier === "council" || (member?.tier === "head" && t.team_id === member?.team_id));
    return true;
  });

  const countFor = (key) => tasks.filter((t) => {
    if (key === "mine")    return t.claimer?.id === member?.id;
    if (key === "team")    return t.team_id && t.team_id === member?.team_id;
    if (key === "open")    return t.is_open;
    if (key === "confirm") return t.status === "submitted" &&
      (member?.tier === "council" || (member?.tier === "head" && t.team_id === member?.team_id));
    return true;
  }).length;

  const confirmedShare = visible.length ? visible.filter((t) => t.status === "confirmed").length / visible.length : 0;

  const renderCard = (t) => {
    const st = STATUS[t.status] || STATUS.todo;
    const mine = t.claimer?.id === member?.id;
    const canClaim = !t.claimed_by && ["open", "todo"].includes(t.status) &&
      (!t.team_id || member?.tier === "council" || t.team_id === member?.team_id);
    const canSubmit = mine && t.status === "in_progress";
    const canConfirm = t.status === "submitted" &&
      (member?.tier === "council" || (member?.tier === "head" && t.team_id === member?.team_id));
    const canDelete = member?.tier === "council" ||
      (member?.tier === "head" && t.team_id === member?.team_id);
    const overdue = t.deadline && t.status !== "confirmed" && new Date(t.deadline) < new Date();

    return (
      <motion.article
        key={t.id}
        layout
        layoutId={`core-task-${t.id}`}
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className={`lamp-panel p-4 ${mine ? "border-primary/30" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>
            {st.label}
          </span>
          {t.is_open && (
            <span className="rounded-full border border-secondary/30 bg-secondary/10 px-2 py-0.5 text-[11px] font-medium text-secondary">
              Open to all
            </span>
          )}
          <span className="lamp-numerals ml-auto text-sm text-primary">{t.points} pts</span>
        </div>
        <h3 className="mt-2.5 text-base font-medium leading-snug text-text-primary">{t.title}</h3>
        {t.description && (
          <p className="mt-1 line-clamp-3 break-words text-[13px] leading-5 text-text-muted">{t.description}</p>
        )}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-dim">
          {t.core_teams && <span>{t.core_teams.name}</span>}
          {t.claimer && <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />{t.claimer.name}</span>}
          {t.deadline && (
            <span className={`inline-flex items-center gap-1 ${overdue ? "text-danger" : ""}`}>
              <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              {overdue ? "Overdue, " : "Due "}<span className="lamp-numerals">{fmtDate(t.deadline)}</span>
            </span>
          )}
        </div>
        {t.submission && (
          <p className="mt-2.5 break-words rounded-xl border border-[rgb(var(--rule))] bg-white/[0.02] px-3 py-2 text-[12px] leading-5 text-text-muted">
            <span className="text-text-dim">Submission: </span>{t.submission}
          </p>
        )}

        {(canClaim || canSubmit || canConfirm || canDelete) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[rgb(var(--rule))] pt-3">
            {canClaim && (
              <Button size="sm" variant="primary" magnetic={false} loading={busy === t.id}
                onClick={() => act(() => core.claimTask(t.id), t.id)}>
                Claim
              </Button>
            )}
            {canSubmit && (
              <Button size="sm" variant="secondary" magnetic={false}
                onClick={() => setSubmitFor(t)}>
                Mark done
              </Button>
            )}
            {canConfirm && (
              <Button size="sm" variant="primary" magnetic={false} loading={busy === t.id}
                onClick={() => act(() => core.confirmTask(t.id), t.id)}>
                Confirm
              </Button>
            )}
            {canDelete && (
              <button
                onClick={() => act(() => core.deleteTask(t.id), t.id)}
                aria-label={`Delete ${t.title}`}
                className="ml-auto inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-[13px] text-text-dim transition hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Delete
              </button>
            )}
          </div>
        )}
      </motion.article>
    );
  };

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Core team"
        title="Tasks"
        description="Claim work, mark it done, and get it confirmed by your head for points."
        progress={confirmedShare}
        actions={isLead ? (
          <Button size="sm" variant="primary" magnetic={false} onClick={() => setShowNew(true)} leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
            New Task
          </Button>
        ) : null}
      >
        <SegmentedTabs
          aria-label="Filter tasks"
          value={filter}
          onChange={setFilter}
          items={FILTERS.map((f) => ({ value: f.key, label: f.label, count: countFor(f.key) }))}
        />
      </PageHeader>

      <AnimatePresence>
        {err && (
          <motion.p key={err} role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">{err}</motion.p>
        )}
      </AnimatePresence>

      {/* board — cards glide between columns when their status changes */}
      {visible.length === 0 ? (
        <EmptyState
          title="No tasks here yet"
          body={filter === "mine" ? "Claim an open task to start earning points." : "Try another filter, or check back once a head posts work."}
          action={filter !== "open" ? <Button size="sm" variant="secondary" magnetic={false} onClick={() => setFilter("open")}>Show open tasks</Button> : null}
        />
      ) : (
        <LayoutGroup id="core-tasks">
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 scrollbar-none lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0">
            {COLUMNS.map((col) => {
              const items = visible.filter((t) => col.statuses.includes(t.status));
              return (
                <section
                  key={col.key}
                  data-reveal="up"
                  aria-label={col.label}
                  className="flex w-[82vw] max-w-[22rem] shrink-0 snap-start flex-col rounded-[1.25rem] border border-[rgb(var(--rule))] bg-white/[0.015] p-3 sm:w-[21rem] lg:w-auto lg:max-w-none"
                >
                  <header className="mb-3 flex items-center justify-between px-1">
                    <h2 className="flex items-center gap-2 text-[15px] font-medium text-text-primary">
                      <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                      {col.label}
                    </h2>
                    <motion.span
                      key={items.length}
                      initial={{ scale: 1.5, opacity: 0.4 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="lamp-numerals rounded-full bg-white/[0.05] px-2 text-[12px] text-text-muted"
                    >
                      {items.length}
                    </motion.span>
                  </header>
                  <div className="flex min-h-[6rem] flex-1 flex-col gap-3">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {items.map(renderCard)}
                    </AnimatePresence>
                    {items.length === 0 && (
                      <p className="rounded-xl border border-dashed border-[rgb(var(--rule))] px-3 py-6 text-center text-[13px] text-text-dim">{col.empty}</p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </LayoutGroup>
      )}

      {/* modals */}
      <AnimatePresence>
        {showNew && (
          <NewTaskModal
            member={member}
            teams={teams}
            onClose={() => setShowNew(false)}
            onCreated={() => { setShowNew(false); load(); }}
          />
        )}
        {submitFor && (
          <SubmitModal
            task={submitFor}
            onClose={() => setSubmitFor(null)}
            onDone={() => { setSubmitFor(null); load(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── New-task modal ──────────────────────────────────────── */
function NewTaskModal({ member, teams, onClose, onCreated }) {
  const isCouncil = member?.tier === "council";
  const [form, setForm] = useState({
    title: "", description: "", points: 10,
    isOpen: false, teamId: isCouncil ? "" : member?.team_id || "", deadline: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!form.title.trim()) { setErr("Give the task a title."); return; }
    setBusy(true); setErr(null);
    try {
      await core.createTask({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        isOpen: isCouncil ? form.isOpen : false,
        teamId: form.isOpen ? null : (form.teamId || null),
        points: Number(form.points) || 10,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      });
      onCreated();
    } catch (e) {
      setErr(e?.response?.data?.error || e?.response?.data?.issues?.[0]?.message || "Could not create task.");
      setBusy(false);
    }
  };

  return (
    <ModalShell title="New task" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Title">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={INPUT_CLS} placeholder="What needs doing?" />
        </Field>
        <Field label="Details (optional)">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} className={INPUT_CLS} placeholder="Context, links, expectations…" />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Points">
            <input type="number" min={1} max={500} value={form.points}
              onChange={(e) => setForm({ ...form, points: e.target.value })} className={INPUT_CLS} />
          </Field>
          <Field label="Deadline (optional)">
            <input type="date" value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={INPUT_CLS} />
          </Field>
        </div>
        {isCouncil && (
          <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm text-text-muted">
            <input type="checkbox" checked={form.isOpen}
              onChange={(e) => setForm({ ...form, isOpen: e.target.checked })} className="h-4 w-4 accent-primary" />
            Open task — anyone can claim it (first come, first serve)
          </label>
        )}
        {isCouncil && !form.isOpen && (
          <Field label="Assign to team">
            <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} className={INPUT_CLS}>
              <option value="">— pick a team —</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
        )}
        {!isCouncil && (
          <p className="text-[13px] text-text-dim">This task goes to your team: {member?.core_teams?.name}.</p>
        )}
        {err && <p role="alert" className="text-[13px] text-danger">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" magnetic={false} loading={busy} onClick={save}>Create</Button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ── Submission-note modal ───────────────────────────────── */
function SubmitModal({ task, onClose, onDone }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (!note.trim()) { setErr("Add a quick note on what you did."); return; }
    setBusy(true); setErr(null);
    try {
      await core.submitTask(task.id, note.trim());
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.error || "Could not submit.");
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Mark task done" onClose={onClose}>
      <p className="text-sm text-text-muted">{task.title}</p>
      <Field label="What did you do?">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className={INPUT_CLS}
          placeholder="A short note for the head who confirms this…" />
      </Field>
      {err && <p role="alert" className="text-[13px] text-danger">{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <Button size="sm" variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="primary" magnetic={false} loading={busy} onClick={save}>Submit</Button>
      </div>
    </ModalShell>
  );
}

