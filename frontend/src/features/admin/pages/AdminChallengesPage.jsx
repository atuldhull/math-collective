import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { Check, Plus, Search, Sparkles, Trash2, Wand2, X } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import InputField from "@/components/ui/InputField";
import Loader from "@/components/ui/Loader";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import { challenges, teacher } from "@/lib/api";
import { PageHeader } from "@/components/lamp";
import LaTeXEditor from "@/components/math/LaTeXEditor";
import MathRender from "@/components/math/MathRender";

const DIFFS = [
  { value: "easy", label: "Easy", text: "text-success", bar: "bg-success" },
  { value: "medium", label: "Medium", text: "text-warning", bar: "bg-warning" },
  { value: "hard", label: "Hard", text: "text-danger", bar: "bg-danger" },
  { value: "extreme", label: "Extreme", text: "text-secondary", bar: "bg-secondary" },
];
const LABEL = "mb-2 block text-[13px] font-medium text-text-muted";
const FIELD = "w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/70 px-4 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-dim focus:border-primary/50";
const icon = (Icon) => <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />;

export default function AdminChallengesPage() {
  const root = useRef(null);
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDiff, setFilterDiff] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", question: "", options: ["", "", "", ""], correct_index: 0, difficulty: "medium", points: 50, solution: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [selected, setSelected] = useState(new Set());

  // AI generation state
  const [aiTopic, setAiTopic] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("Medium");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [genError, setGenError] = useState(null);

  async function handleAiGenerate() {
    if (!aiTopic.trim()) return;
    setGenerating(true); setGenError(null); setGenerated(null);
    try {
      const res = await teacher.generate(aiTopic, aiDifficulty);
      setGenerated(res.data);
    } catch (err) {
      // Distinguish "backend sent an error reason" from "the request
      // never reached the server" (CORS, offline, timeout with no
      // response). Users were seeing a bare "AI generation failed"
      // when axios had no response object at all — now they see a
      // specific hint that points at the right place to look.
      const data = err?.response?.data;
      const status = err?.response?.status;
      let msg;
      if (data?.error || data?.message) {
        msg = data.error || data.message;
      } else if (!err?.response) {
        msg = `Network error — the request didn't reach the server (${err?.code || err?.message || "unknown"}). Check your connection and try again.`;
      } else {
        msg = `AI generation failed (HTTP ${status}). Try again or lower the difficulty.`;
      }
      setGenError(msg);
    }
    setGenerating(false);
  }

  async function handleAiSave() {
    if (!generated) return;
    setAiSaving(true);
    try {
      await teacher.saveQuestion(generated);
      showMsg("AI question saved to bank!");
      setGenerated(null); setAiTopic("");
      fetch();
    } catch (err) {
      setGenError(err.response?.data?.message || "Failed to save");
    }
    setAiSaving(false);
  }

  const fetch = () => {
    setLoading(true);
    challenges.all()
      .then((r) => setList(Array.isArray(r.data) ? r.data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetch(); }, []);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(null), 3000); };

  const filtered = list.filter((c) => {
    if (search && !c.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterDiff !== "all" && (c.difficulty || "").toLowerCase() !== filterDiff) return false;
    if (filterStatus === "active" && c.is_active === false) return false;
    if (filterStatus === "inactive" && c.is_active !== false) return false;
    return true;
  });

  const stats = {
    total: list.length,
    active: list.filter((c) => c.is_active !== false).length,
    inactive: list.filter((c) => c.is_active === false).length,
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await challenges.create(form);
      setShowCreate(false);
      setForm({ title: "", question: "", options: ["", "", "", ""], correct_index: 0, difficulty: "medium", points: 50, solution: "" });
      showMsg("Challenge created");
      fetch();
    } catch (err) { showMsg(err.response?.data?.error || "Failed"); }
    setSaving(false);
  };

  const handleToggle = async (id) => {
    try { await challenges.toggle(id); }
    catch (err) { showMsg(err.response?.data?.error || "Could not toggle challenge"); return; }
    fetch();
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this challenge?")) return;
    try { await challenges.remove(id); showMsg("Deleted"); fetch(); }
    catch (err) { showMsg(err.response?.data?.error || "Delete failed"); }
  };

  const handleBulkToggle = async (activate) => {
    const ids = [...selected];
    if (!ids.length) return;
    let failed = 0;
    for (const id of ids) {
      const ch = list.find((c) => c.id === id);
      if (ch && (activate ? ch.is_active === false : ch.is_active !== false)) {
        try { await challenges.toggle(id); }
        catch { failed++; }
      }
    }
    setSelected(new Set());
    showMsg(failed ? `Updated ${ids.length - failed} / ${ids.length} — ${failed} failed` : `${ids.length} challenges updated`);
    fetch();
  };

  const toggleSelect = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

  const updateOption = (i, v) => { const o = [...form.options]; o[i] = v; setForm({ ...form, options: o }); };

  // The difficulty mix fills segment by segment, left to right, whenever the bank reloads.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from("[data-mix]", { scaleX: 0, transformOrigin: "left center", duration: 0.9, ease: "expo.out", stagger: 0.12, delay: 0.5 });
    });
  }, { scope: root, dependencies: [list.length], revertOnUpdate: true });

  const diffMix = DIFFS.map((d) => ({ ...d, n: list.filter((c) => (c.difficulty || "").toLowerCase() === d.value).length }));
  const allSelected = selected.size === filtered.length && filtered.length > 0;

  return (
    <div ref={root} className="flex flex-col">
      <PageHeader
        context="Admin"
        title="Challenge bank"
        description="Write problems by hand or draft them with AI, then switch them on when they are ready for students."
        actions={(
          <Button size="sm" onClick={() => setShowCreate(!showCreate)} leading={icon(showCreate ? X : Plus)}>
            {showCreate ? "Cancel" : "Create Challenge"}
          </Button>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <dl className="flex gap-6 text-[13px]">
            <div><dt className="text-text-dim">Total</dt><dd className="lamp-numerals text-xl text-text-primary"><AnimatedNumber value={stats.total} /></dd></div>
            <div><dt className="text-text-dim">Active</dt><dd className="lamp-numerals text-xl text-success"><AnimatedNumber value={stats.active} /></dd></div>
            <div><dt className="text-text-dim">Inactive</dt><dd className="lamp-numerals text-xl text-danger"><AnimatedNumber value={stats.inactive} /></dd></div>
          </dl>
          {stats.total > 0 && (
            <div className="min-w-0">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/[0.04]" role="img" aria-label="Difficulty mix of the bank">
                {diffMix.filter((d) => d.n > 0).map((d) => (
                  <span key={d.value} data-mix className={`h-full ${d.bar}`} style={{ width: `${(d.n / stats.total) * 100}%` }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-muted">
                {diffMix.map((d) => (
                  <span key={d.value} className="inline-flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${d.bar}`} />{d.label}<span className="lamp-numerals text-text-dim">{d.n}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageHeader>

      <AnimatePresence>
        {msg && (
          <motion.div key="msg" role="status" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="mb-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">{msg}</motion.div>
        )}
      </AnimatePresence>

      {/* Create form */}
      <AnimatePresence initial={false}>
        {showCreate && (
          <motion.div
            key="create"
            initial={{ opacity: 0, height: 0, rotateX: -10 }}
            animate={{ opacity: 1, height: "auto", rotateX: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformPerspective: 900, transformOrigin: "50% 0%" }}
          >
            <form onSubmit={handleCreate} className="lamp-panel lamp-panel--lit mb-6 space-y-5 p-5 sm:p-6">
              <h2 className="text-lg text-text-primary">New challenge</h2>
              <InputField label="Title" placeholder="Challenge title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              <div>
                <p className={LABEL}>Question</p>
                <LaTeXEditor
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  placeholder="Type the question. Wrap math in $...$ (inline) or $$...$$ (display). Click toolbar buttons to insert common LaTeX."
                  required
                />
              </div>
              <fieldset className="space-y-3">
                <legend className={LABEL}>Options <span className="text-text-dim">(tap a letter to mark the correct one)</span></legend>
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => setForm({ ...form, correct_index: i })}
                      aria-pressed={form.correct_index === i}
                      aria-label={`Mark option ${String.fromCharCode(65 + i)} correct`}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border font-mono text-sm transition ${form.correct_index === i ? "border-success bg-success/15 text-success" : "border-[rgb(var(--rule))] text-text-dim hover:text-text-primary"}`}>
                      {String.fromCharCode(65 + i)}
                    </motion.button>
                    <input type="text" placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt} onChange={(e) => updateOption(i, e.target.value)}
                      className={`${FIELD} flex-1`} required />
                  </div>
                ))}
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="ch-difficulty" className={LABEL}>Difficulty</label>
                  <select id="ch-difficulty" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className={FIELD}>
                    <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="extreme">Extreme</option>
                  </select>
                </div>
                <InputField label="Points" type="number" value={form.points} onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
              </div>
              <div>
                <p className={LABEL}>Solution <span className="text-text-dim">(optional)</span></p>
                <LaTeXEditor
                  value={form.solution}
                  onChange={(e) => setForm({ ...form, solution: e.target.value })}
                  placeholder="Explain the answer. Math goes between $...$ or $$...$$"
                  rows={3}
                />
              </div>
              <Button type="submit" loading={saving}>Save Challenge</Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Question Generator */}
      <section data-reveal="up" className="lamp-panel p-5 sm:p-6">
        <div className="flex items-center gap-2 text-secondary">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-[13px] font-medium">Draft with AI</p>
        </div>
        <h2 className="mt-1 text-xl text-text-primary">Question generator</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="ai-topic" className={LABEL}>Topic</label>
            <input id="ai-topic" type="text" placeholder="e.g. Quadratic equations, Probability..." value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} className={FIELD} />
          </div>
          <div>
            <label htmlFor="ai-difficulty" className={LABEL}>Difficulty</label>
            <select id="ai-difficulty" value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)} className={FIELD}>
              <option>Easy</option><option>Medium</option><option>Hard</option><option>Extreme</option>
            </select>
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={handleAiGenerate} loading={generating} disabled={!aiTopic.trim()} size="sm" leading={icon(Wand2)}>
            {generating ? "Generating..." : "Generate Question"}
          </Button>
        </div>
        <AnimatePresence>
          {genError && (
            <motion.div key="err" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }} exit={{ opacity: 0 }}
              className="mt-3 rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">{genError}</motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          {generated && (
            <motion.div
              key={generated.title || "generated"}
              initial={{ opacity: 0, rotateX: -24, y: 24 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              exit={{ opacity: 0, rotateX: 12, y: -12 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformPerspective: 1000, transformOrigin: "50% 0%" }}
              className="mt-5"
            >
              <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-5">
                <p className="text-[13px] font-medium text-primary">Generated preview</p>
                <h3 className="mt-1 text-lg text-text-primary">{generated.title}</h3>
                <MathRender source={generated.question || ""} className="mt-2 text-sm leading-relaxed text-text-muted [&_.katex]:text-text-primary" />
                {generated.options && (
                  <div className="mt-3 space-y-2">
                    {generated.options.map((opt, i) => {
                      const isCorrect = i === generated.correct_index || i === generated.correctIndex;
                      return (
                        <div key={i} className={`flex items-baseline gap-2 rounded-xl border px-3 py-2 text-sm ${
                          isCorrect ? "border-success/30 bg-success/10 text-success" : "border-[rgb(var(--rule))] bg-white/[0.02] text-text-muted"
                        }`}>
                          <span className="font-mono text-xs">{String.fromCharCode(65 + i)}.</span>
                          <MathRender source={String(opt || "")} className={`inline ${isCorrect ? "[&_.katex]:text-success" : "[&_.katex]:text-text-primary"}`} />
                          {isCorrect && <Check className="ml-auto h-4 w-4 shrink-0 self-center" strokeWidth={1.75} aria-label="Correct answer" />}
                        </div>
                      );
                    })}
                  </div>
                )}
                {(generated.solution || generated.explanation) && (
                  <div className="mt-3 rounded-xl border border-[rgb(var(--rule))] bg-white/[0.02] p-3">
                    <p className="text-[12px] font-medium text-text-dim">Explanation</p>
                    <p className="mt-1 text-sm text-text-muted">{generated.solution || generated.explanation}</p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button onClick={handleAiSave} loading={aiSaving} size="sm" variant="secondary">Save to Bank</Button>
                  <Button onClick={handleAiGenerate} loading={generating} size="sm" variant="primary">Regenerate</Button>
                  <Button onClick={() => setGenerated(null)} size="sm" variant="ghost">Discard</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Filters */}
      <div data-reveal="fade" className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
          <input type="text" aria-label="Search challenges" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className={`${FIELD} pl-10`} />
        </div>
        <select aria-label="Filter by difficulty" value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)} className={`${FIELD} w-auto flex-1 sm:flex-none`}>
          <option value="all">All Difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option><option value="extreme">Extreme</option>
        </select>
        <select aria-label="Filter by status" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={`${FIELD} w-auto flex-1 sm:flex-none`}>
          <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <AnimatePresence>
          {selected.size > 0 && (
            <motion.div
              key="bulk"
              initial={{ opacity: 0, scale: 0.9, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex w-full flex-wrap items-center gap-1 rounded-xl border border-primary/30 bg-primary/[0.07] px-3 py-1.5 sm:w-auto"
            >
              <span className="lamp-numerals mr-2 text-[13px] text-primary">{selected.size} selected</span>
              <button onClick={() => handleBulkToggle(true)} className="min-h-[36px] rounded-lg px-2 text-[13px] text-success hover:bg-success/10">Activate</button>
              <button onClick={() => handleBulkToggle(false)} className="min-h-[36px] rounded-lg px-2 text-[13px] text-danger hover:bg-danger/10">Deactivate</button>
              <button onClick={() => setSelected(new Set())} className="min-h-[36px] rounded-lg px-2 text-[13px] text-text-muted hover:bg-white/5">Clear</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader variant="orbit" size="lg" /></div>
      ) : (
        <section data-reveal="up" className="lamp-panel mt-4 p-2 md:p-0">
          {/* Phone: rows become stacked cards; md+: a real table. */}
          <table className="block w-full text-left text-sm md:table">
            <thead className="hidden md:table-header-group">
              <tr className="border-b border-[rgb(var(--rule))] text-[13px] text-text-muted">
                <th className="w-10 py-3.5 pl-5 pr-2"><input type="checkbox" aria-label="Select all challenges" checked={allSelected} onChange={selectAll} className="h-4 w-4 accent-primary" /></th>
                <th className="px-3 py-3.5 font-medium">Challenge</th>
                <th className="px-3 py-3.5 font-medium">Difficulty</th>
                <th className="px-3 py-3.5 text-right font-medium">Points</th>
                <th className="px-3 py-3.5 font-medium">Status</th>
                <th className="px-3 py-3.5 font-medium">Created</th>
                <th className="px-5 py-3.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody data-stagger="up" className="block space-y-2 md:table-row-group md:space-y-0">
              {filtered.length > 0 && (
                <tr className="flex items-center gap-3 px-2 pb-1 pt-1 md:hidden">
                  <td className="flex items-center gap-3">
                    <input id="ch-select-all-m" type="checkbox" checked={allSelected} onChange={selectAll} className="h-5 w-5 accent-primary" />
                    <label htmlFor="ch-select-all-m" className="text-[13px] text-text-muted">Select all</label>
                  </td>
                </tr>
              )}
              {filtered.length === 0 && (
                <tr className="block md:table-row"><td colSpan="7" className="block px-4 py-10 text-center text-text-dim md:table-cell">No challenges found</td></tr>
              )}
              <AnimatePresence initial={false}>
                {filtered.map((c) => {
                  const diff = DIFFS.find((d) => d.value === (c.difficulty || "").toLowerCase());
                  const active = c.is_active !== false;
                  return (
                    <motion.tr
                      key={c.id}
                      exit={{ opacity: 0, x: -24, transition: { duration: 0.25 } }}
                      className={`grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 rounded-xl border p-4 transition-colors md:table-row md:rounded-none md:border-0 md:border-b md:border-[rgb(var(--rule))] md:p-0 md:last:border-b-0 md:hover:bg-primary/[0.04] ${selected.has(c.id) ? "border-primary/35 bg-primary/[0.05]" : "border-[rgb(var(--rule))] bg-white/[0.015]"}`}
                    >
                      <td className="row-span-2 self-start md:table-cell md:py-3.5 md:pl-5 md:pr-2 md:align-middle">
                        <input type="checkbox" aria-label={`Select ${c.title}`} checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} className="h-5 w-5 accent-primary md:h-4 md:w-4" />
                      </td>
                      <td className="min-w-0 font-medium text-text-primary md:table-cell md:px-3 md:py-3.5">{c.title}</td>
                      <td className="text-right md:table-cell md:px-3 md:py-3.5 md:text-left">
                        <span className={`inline-flex items-center gap-1.5 text-[13px] ${diff?.text || "text-text-muted"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${diff?.bar || "bg-text-dim"}`} />
                          {c.difficulty || "—"}
                        </span>
                      </td>
                      <td className="col-start-2 md:table-cell md:px-3 md:py-3.5 md:text-right">
                        <span className="lamp-numerals text-primary">{c.points || 50}</span><span className="ml-1 text-[12px] text-text-dim md:hidden">pts</span>
                      </td>
                      <td className="text-right md:table-cell md:px-3 md:py-3.5 md:text-left">
                        <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleToggle(c.id)}
                          aria-label={`${active ? "Deactivate" : "Activate"} ${c.title}`}
                          className={`min-h-[32px] rounded-full border px-3 py-0.5 text-[12px] font-medium transition ${active ? "border-success/30 bg-success/10 text-success" : "border-danger/30 bg-danger/10 text-danger"}`}>
                          {active ? "active" : "inactive"}
                        </motion.button>
                      </td>
                      <td className="col-start-2 lamp-numerals text-[12px] text-text-dim md:table-cell md:px-3 md:py-3.5 md:text-[13px]">{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                      <td className="text-right md:table-cell md:px-5 md:py-3.5">
                        <button onClick={() => handleDelete(c.id)} aria-label={`Delete ${c.title}`}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-[13px] text-danger transition hover:bg-danger/10">
                          <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
