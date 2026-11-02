import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { AlertCircle, BarChart3, Crown, Search } from "lucide-react";
import gsap from "@/lib/gsap-setup";
import Button from "@/components/ui/Button";
import { teacher } from "@/lib/api";
import { PageHeader } from "@/components/lamp";

const podiumOrder = [1, 0, 2]; // silver, gold, bronze — gold stands in the middle
const podiumHeight = ["h-28", "h-20", "h-14"];
const rankTone = ["text-primary", "text-text-primary", "text-[#cd7f32]"];

export default function TeacherStudentsPage() {
  const [students, setStudents] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPerformance, setShowPerformance] = useState(false);
  const [perfLoading, setPerfLoading] = useState(false);
  const boardRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        const [studentsRes, leaderboardRes] = await Promise.all([
          teacher.students(),
          teacher.leaderboard(),
        ]);
        if (cancelled) return;
        setStudents(studentsRes.data);
        setLeaderboard(leaderboardRes.data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load students");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  async function handleViewPerformance() {
    try {
      setPerfLoading(true);
      const res = await teacher.performance();
      setPerformance(res.data);
      setShowPerformance(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load performance data");
    } finally {
      setPerfLoading(false);
    }
  }

  // Bespoke moment: the podium rises out of the floor, then the names
  // drop onto their steps, gold last.
  useGSAP(() => {
    if (!boardRef.current) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(boardRef);
      const tl = gsap.timeline({
        scrollTrigger: { trigger: boardRef.current, start: "top 85%", once: true },
        defaults: { ease: "expo.out" },
      });
      tl.from(q("[data-step]"), { scaleY: 0, transformOrigin: "bottom center", duration: 1, stagger: 0.12 })
        .from(q("[data-podium-name]"), { y: -24, autoAlpha: 0, duration: 0.7, ease: "back.out(2)", stagger: 0.1 }, "-=0.5")
        .from(q("[data-crown]"), { y: -10, rotate: -25, autoAlpha: 0, duration: 0.8, ease: "elastic.out(1, 0.5)" }, "-=0.2");
    });
    return () => mm.revert();
  }, { scope: boardRef, dependencies: [leaderboard.length, loading], revertOnUpdate: true });

  const filtered = students.filter(
    (s) =>
      (s.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.email || "").toLowerCase().includes(search.toLowerCase()),
  );

  const header = (
    <PageHeader
      context="Teacher panel"
      title="Student manager"
      description={`${students.length} enrolled students`}
      actions={!loading && !(error && students.length === 0) ? (
        <Button
          size="sm"
          variant="secondary"
          loading={perfLoading}
          leading={<BarChart3 className="h-4 w-4" strokeWidth={1.75} />}
          onClick={handleViewPerformance}
        >
          {showPerformance ? "Refresh Performance" : "View Performance"}
        </Button>
      ) : null}
    />
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 w-64 animate-pulse rounded-xl bg-surface/40" />
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="h-96 animate-pulse rounded-[1.25rem] border border-[rgb(var(--rule))] bg-surface/40 xl:col-span-2" />
          <div className="h-96 animate-pulse rounded-[1.25rem] border border-[rgb(var(--rule))] bg-surface/40" />
        </div>
      </div>
    );
  }

  if (error && students.length === 0) {
    return (
      <div>
        {header}
        <div data-reveal="scale" className="lamp-panel flex flex-col items-center gap-3 px-6 py-12 text-center">
          <AlertCircle className="h-10 w-10 text-danger" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      </div>
    );
  }

  const podium = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3, 10);

  return (
    <div className="space-y-6">
      {header}

      <label data-reveal="fade" className="relative block">
        <span className="sr-only">Search students</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/60 py-3 pl-11 pr-4 text-sm text-text-primary placeholder-text-dim backdrop-blur outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
        />
      </label>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Roster */}
        <section data-reveal="up" className="lamp-panel p-4 sm:p-6 xl:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-xl text-text-primary">All students</h2>
            <span className="text-[13px] tabular-nums text-text-dim">{filtered.length} shown</span>
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-text-dim">
              {search ? "No students match your search" : "No students found"}
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="mt-4 hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--rule))] text-[13px] font-medium text-text-muted">
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 text-right font-medium">XP</th>
                      <th className="px-4 py-3 text-right font-medium">Solved</th>
                    </tr>
                  </thead>
                  <tbody data-stagger="up">
                    {filtered.map((s) => (
                      <tr
                        key={s._id || s.email}
                        className="border-b border-[rgb(var(--rule)/0.6)] transition-colors hover:bg-primary/[0.04]"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                              {(s.name || "?").charAt(0).toUpperCase()}
                            </span>
                            <span className="font-medium text-text-primary">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-text-muted">{s.email}</td>
                        <td className="lamp-numerals px-4 py-3 text-right text-primary">{s.xp ?? 0}</td>
                        <td className="lamp-numerals px-4 py-3 text-right text-secondary">{s.solvedCount ?? s.solved ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Phone: stacked rows */}
              <ul data-stagger="up" className="mt-4 divide-y divide-[rgb(var(--rule))] sm:hidden">
                {filtered.map((s) => (
                  <li key={s._id || s.email} className="flex items-center gap-3 py-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                      {(s.name || "?").charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-primary">{s.name}</p>
                      <p className="truncate text-[12px] text-text-dim">{s.email}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="lamp-numerals text-sm text-primary">{s.xp ?? 0} XP</p>
                      <p className="text-[12px] text-secondary">{s.solvedCount ?? s.solved ?? 0} solved</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Leaderboard */}
        <section ref={boardRef} data-reveal="right" className="lamp-panel lamp-panel--lit p-4 sm:p-6">
          <h2 className="text-xl text-text-primary">Leaderboard</h2>

          {leaderboard.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-dim">No rankings available</p>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-3 items-end gap-2">
                {podiumOrder.map((idx) => {
                  const entry = podium[idx];
                  if (!entry) return <div key={idx} />;
                  return (
                    <div key={entry._id || idx} className="flex min-w-0 flex-col items-center text-center">
                      <div data-podium-name className="mb-2 min-w-0 max-w-full">
                        {idx === 0 ? (
                          <Crown data-crown className="mx-auto mb-1 h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
                        ) : null}
                        <p className="truncate text-sm font-medium text-text-primary">{entry.name || entry.userName}</p>
                        <p className="text-[12px] tabular-nums text-text-dim">{entry.xp ?? 0} XP</p>
                      </div>
                      <div
                        data-step
                        className={`flex w-full items-start justify-center rounded-t-xl border border-b-0 pt-2 ${podiumHeight[idx]} ${
                          idx === 0
                            ? "border-primary/40 bg-[linear-gradient(180deg,rgb(var(--lamp)/0.28),rgb(var(--lamp)/0.04))]"
                            : "border-[rgb(var(--rule))] bg-white/[0.03]"
                        }`}
                      >
                        <span className={`lamp-numerals text-2xl ${rankTone[idx]}`}>{idx + 1}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="h-px w-full bg-[rgb(var(--rule))]" />

              <ol data-stagger="left" className="mt-2 divide-y divide-[rgb(var(--rule))]">
                {podium.map((entry, i) => (
                  <li key={`solved-${entry._id || i}`} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <span className="truncate text-text-muted">{entry.name || entry.userName}</span>
                    <span className="shrink-0 text-success">{entry.solvedCount ?? entry.solved ?? 0} solved</span>
                  </li>
                ))}
                {rest.map((entry, j) => {
                  const i = j + 3;
                  return (
                    <li key={entry._id || i} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="lamp-numerals flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-xs text-text-dim">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-text-primary">{entry.name || entry.userName}</p>
                          <p className="text-[12px] tabular-nums text-text-dim">{entry.xp ?? 0} XP</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-[13px] text-success">
                        {entry.solvedCount ?? entry.solved ?? 0} solved
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </section>
      </div>

      <AnimatePresence>
        {showPerformance && performance.length > 0 && (
          <motion.section
            key="perf"
            initial={{ opacity: 0, y: 24, rotateX: -8 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformPerspective: 1000 }}
            className="lamp-panel p-4 sm:p-6"
          >
            <h2 className="text-xl text-text-primary">Per-challenge performance</h2>

            <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[rgb(var(--rule))] text-[13px] text-text-muted">
                      <th className="px-4 py-3 font-medium">Challenge</th>
                      <th className="px-4 py-3 text-right font-medium">Attempts</th>
                      <th className="px-4 py-3 text-right font-medium">Correct</th>
                      <th className="px-4 py-3 font-medium">Accuracy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performance.map((p, i) => {
                      const accuracy =
                        p.attempts > 0
                          ? Math.round((p.correct / p.attempts) * 100)
                          : 0;
                      return (
                        <tr
                          key={p._id || i}
                          className="border-b border-[rgb(var(--rule)/0.6)] transition-colors hover:bg-primary/[0.04]"
                        >
                          <td className="px-4 py-3 font-medium text-text-primary">
                            {p.title || p.challengeTitle || `Challenge ${i + 1}`}
                          </td>
                          <td className="lamp-numerals px-4 py-3 text-right text-text-muted">{p.attempts ?? 0}</td>
                          <td className="lamp-numerals px-4 py-3 text-right text-success">{p.correct ?? 0}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/5">
                                <motion.div
                                  className="h-full origin-left rounded-full bg-primary"
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: 1 }}
                                  transition={{ delay: 0.2 + i * 0.05, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                                  style={{ width: `${accuracy}%` }}
                                />
                              </div>
                              <span className="text-[12px] tabular-nums text-text-dim">{accuracy}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
