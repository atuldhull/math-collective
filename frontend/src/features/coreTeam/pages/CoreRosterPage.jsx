import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGSAP } from "@gsap/react";
import { Medal, Plus, UsersRound } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import MessageButton from "@/components/social/MessageButton";
import { core } from "@/lib/api";
import { useCoreStore } from "@/store/core-store";
import CoreBadge from "@/features/coreTeam/components/CoreBadge";
import { ModalShell, Field, INPUT_CLS } from "@/features/coreTeam/components/FormBits";
import { PageHeader } from "@/components/lamp";

const MEDAL_CLS = ["text-primary", "text-text-muted"];

function MemberRow({ m, rank, max }) {
  const top = rank < 2;
  return (
    <li className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl px-3 py-2.5">
      <span
        data-bar
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 rounded-xl ${top ? "bg-primary/[0.08]" : "bg-white/[0.025]"}`}
        style={{ width: `${Math.max(4, ((m.points || 0) / max) * 100)}%` }}
      />
      <div className="relative flex min-w-0 items-center gap-3">
        <span className="flex w-6 justify-center text-sm">
          {top
            ? <Medal className={`h-4 w-4 ${MEDAL_CLS[rank]}`} strokeWidth={1.75} aria-label={rank === 0 ? "First" : "Second"} />
            : <span className="lamp-numerals text-[13px] text-text-dim">{rank + 1}</span>}
        </span>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-xs font-semibold text-secondary">
          {(m.name || "?")[0]}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-text-primary">{m.name}</p>
          <p className="truncate text-[12px] text-text-dim">{m.position}</p>
        </div>
      </div>
      <div className="relative flex shrink-0 items-center gap-2">
        {m.user_id && <MessageButton userId={m.user_id} size="sm" variant="ghost" label="" />}
        {!m.user_id && (
          <span className="text-[11px] text-text-dim">code unused</span>
        )}
        <span className="lamp-numerals w-10 text-right text-sm text-primary">{m.points}</span>
      </div>
    </li>
  );
}

export default function CoreRosterPage() {
  const { member } = useCoreStore();
  const isCouncil = member?.tier === "council";
  const [data, setData] = useState(null);
  const [modal, setModal] = useState(null); // 'team' | 'member' | null
  const root = useRef(null);

  const load = useCallback(() => {
    core.teams().then((r) => setData(r.data || { council: [], teams: [] })).catch(() => setData({ council: [], teams: [] }));
  }, []);
  useEffect(() => { load(); }, [load]);

  // Each team's points ladder fills from the left as the team scrolls in.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray("[data-team]").forEach((team) => {
        gsap.from(team.querySelectorAll("[data-bar]"), {
          scaleX: 0, transformOrigin: "left center", duration: 1.2, ease: "expo.out", stagger: 0.06,
          scrollTrigger: { trigger: team, start: "top 85%", once: true },
        });
      });
    });
  }, { scope: root, dependencies: [data], revertOnUpdate: true });

  if (!data) {
    return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" label="Loading roster…" /></div>;
  }

  const memberCount = data.council.length + data.teams.reduce((s, t) => s + t.members.length, 0);

  return (
    <div ref={root} className="flex flex-col">
      <PageHeader
        context="Core team"
        title="Roster"
        description={`${memberCount} people across the council and ${data.teams.length} team${data.teams.length === 1 ? "" : "s"}, ranked by points.`}
        actions={isCouncil ? (
          <>
            <Button size="sm" variant="secondary" magnetic={false} onClick={() => setModal("team")} leading={<UsersRound className="h-4 w-4" strokeWidth={1.75} />}>Add Team</Button>
            <Button size="sm" variant="primary" magnetic={false} onClick={() => setModal("member")} leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>Add Member</Button>
          </>
        ) : null}
      />

      {/* Council */}
      <section data-reveal="tilt" className="lamp-panel lamp-panel--lit p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl text-text-primary">Club council</h2>
          <CoreBadge tier="council" />
        </div>
        <ul data-stagger="scale" className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.council.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-[rgb(var(--rule))] bg-white/[0.02] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {(m.name || "?")[0]}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-text-primary">{m.name}</p>
                  <p className="truncate text-[12px] text-text-dim">{m.position}</p>
                </div>
              </div>
              {m.user_id && <MessageButton userId={m.user_id} size="sm" variant="ghost" label="" />}
            </li>
          ))}
        </ul>
      </section>

      {/* Teams */}
      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        {data.teams.map((t) => {
          const max = Math.max(1, ...t.members.map((m) => m.points || 0));
          return (
            <section key={t.id} data-team data-reveal="up" className="lamp-panel relative overflow-hidden p-5 sm:p-6">
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5" style={{ background: t.accent }} />
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: t.accent }} />
                  <h2 className="truncate text-lg text-text-primary">{t.name}</h2>
                </div>
                <span className="shrink-0 text-[12px] text-text-dim"><span className="lamp-numerals text-text-muted">{t.members.length}</span> members</span>
              </div>
              {t.description && <p className="mt-1 text-[13px] text-text-muted">{t.description}</p>}
              <ol className="mt-3 space-y-1">
                {t.members.length === 0 && (
                  <li className="py-3 text-center text-[13px] text-text-dim">No members yet.</li>
                )}
                {t.members.map((m, i) => <MemberRow key={m.id} m={m} rank={i} max={max} />)}
              </ol>
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {modal === "team"   && <AddTeamModal   onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
        {modal === "member" && <AddMemberModal teams={data.teams} onClose={() => setModal(null)} onDone={() => { setModal(null); load(); }} />}
      </AnimatePresence>
    </div>
  );
}

/* ── Add team ────────────────────────────────────────────── */
function AddTeamModal({ onClose, onDone }) {
  const [form, setForm] = useState({ name: "", description: "", accent: "#7c3aed" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const save = async () => {
    if (form.name.trim().length < 2) { setErr("Name the team."); return; }
    setBusy(true); setErr(null);
    try {
      await core.createTeam({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        accent: form.accent,
      });
      onDone();
    } catch (e) {
      setErr(e?.response?.data?.error || "Could not create team.");
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Add a team" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Team name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT_CLS} />
        </Field>
        <Field label="Description (optional)">
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={INPUT_CLS} />
        </Field>
        <Field label="Accent colour">
          <input type="color" value={form.accent} onChange={(e) => setForm({ ...form, accent: e.target.value })}
            className="h-11 w-full cursor-pointer rounded-xl border border-[rgb(var(--rule))] bg-surface/70 p-1" />
        </Field>
        {err && <p role="alert" className="text-[13px] text-danger">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" magnetic={false} loading={busy} onClick={save}>Create team</Button>
        </div>
      </div>
    </ModalShell>
  );
}

/* ── Add member ──────────────────────────────────────────── */
function AddMemberModal({ teams, onClose, onDone }) {
  const [form, setForm] = useState({ name: "", email: "", teamId: "", tier: "member", position: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [code, setCode] = useState(null);

  const save = async () => {
    if (form.name.trim().length < 2 || !form.email.trim()) { setErr("Name and email are required."); return; }
    setBusy(true); setErr(null);
    try {
      const { data } = await core.addMember({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        teamId: form.teamId || null,
        tier: form.tier,
        position: form.position.trim() || undefined,
      });
      setCode(data.accessCode);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.response?.data?.issues?.[0]?.message || "Could not add member.");
      setBusy(false);
    }
  };

  if (code) {
    return (
      <ModalShell title="Member added" onClose={onDone}>
        <p className="text-sm text-text-muted">Share this private access code with the new member:</p>
        <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-5 text-center [perspective:600px]">
          <p className="select-all font-mono text-2xl tracking-[0.3em] text-text-primary">
            <span className="sr-only">{code}</span>
            {/* each character flips down into place like a split-flap board */}
            {String(code).split("").map((ch, i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                className="inline-block"
                initial={{ rotateX: -90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                transition={{ delay: 0.15 + i * 0.05, type: "spring", stiffness: 300, damping: 20 }}
              >
                {ch}
              </motion.span>
            ))}
          </p>
        </div>
        <p className="mt-3 text-[13px] text-text-dim">
          They redeem it inside the portal — it only works with the email you entered.
        </p>
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant="primary" magnetic={false} onClick={onDone}>Done</Button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell title="Add a core member" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Full name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={INPUT_CLS} />
        </Field>
        <Field label="Club email">
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={INPUT_CLS}
            placeholder="name@bmsit.in" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tier">
            <select value={form.tier} onChange={(e) => setForm({ ...form, tier: e.target.value })} className={INPUT_CLS}>
              <option value="member">Member</option>
              <option value="head">Head</option>
              <option value="council">Council</option>
            </select>
          </Field>
          <Field label="Position">
            <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}
              className={INPUT_CLS} placeholder="Member / Head…" />
          </Field>
        </div>
        <Field label="Team (leave blank for council)">
          <select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })} className={INPUT_CLS}>
            <option value="">— no team (council) —</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
        {err && <p role="alert" className="text-[13px] text-danger">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button size="sm" variant="ghost" magnetic={false} onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" magnetic={false} loading={busy} onClick={save}>Add & issue code</Button>
        </div>
      </div>
    </ModalShell>
  );
}
