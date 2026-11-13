/**
 * Admin view of the recruitment intake.
 *
 * The public form at /register had no counterpart: applications went into the
 * database and could only be read from the Supabase dashboard. This is that
 * counterpart — the whole intake, searchable, with the counts that decide how
 * many interview slots each team needs, and a CSV for shortlisting.
 *
 * The intake runs to a few hundred rows at most, so it is fetched once and
 * filtered in the browser. That keeps filtering instant and avoids a round
 * trip per keystroke.
 */
import { useEffect, useMemo, useState } from "react";
import { Download, Inbox, Search, Users } from "lucide-react";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { admin } from "@/lib/api";
import { PageHeader, StatTile } from "@/components/lamp";
import { recruitmentConfig } from "../../../../../shared/recruitmentConfig.js";
import { filterRecruitmentRows } from "../../../../../shared/recruitmentAdminFilters.js";

const icon = (Icon) => <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />;

const ENTRY_LABEL = { "first-year": "1st year", normal: "Normal", lateral: "Lateral" };

export default function AdminRecruitmentPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tableReady, setTableReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");
  const [branch, setBranch] = useState("all");
  const [preference, setPreference] = useState("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await admin.recruitment();
        if (!alive) return;
        setRows(data.registrations || []);
        setSummary(data.summary || null);
        setTableReady(data.tableReady !== false);
      } catch {
        if (alive) setError("Could not load the registrations. Try again in a moment.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Every 1st preference that actually appears, so the filter never offers a
  // domain nobody applied to.
  const preferences = useMemo(
    () => [...new Set(rows.map((r) => r.first_preference).filter(Boolean))].sort(),
    [rows],
  );
  const branches = useMemo(
    () => [...new Set([...recruitmentConfig.branches, ...rows.map((r) => r.branch)])].filter(Boolean),
    [rows],
  );

  const visible = useMemo(
    () => filterRecruitmentRows(rows, { search, year, branch, preference }),
    [rows, search, year, branch, preference],
  );

  async function downloadCsv() {
    setExporting(true);
    try {
      const res = await admin.exportRecruitment({ search, year, branch, preference });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `recruitment-${branch === "all" ? "" : `${branch.toLowerCase()}-`}${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not build the CSV. Try again in a moment.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader variant="orbit" size="lg" /></div>;
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        context="Admin"
        title="Recruitment"
        description="Everyone who has registered through the public recruitment form."
        actions={(
          <Button
            size="sm"
            variant="secondary"
            loading={exporting}
            disabled={visible.length === 0}
            leading={icon(Download)}
            onClick={downloadCsv}
          >
            {visible.length === rows.length ? "Export CSV" : "Export filtered CSV"}
          </Button>
        )}
      />

      {error && (
        <div role="alert" className="mb-5 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Until migration 45 has been run there is no table to read, which is
          an expected setup state rather than a failure. Say so plainly. */}
      {!tableReady && (
        <div role="status" className="mb-5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          The <code>recruitment_registrations</code> table does not exist yet. Run migration{" "}
          <code>45_recruitment_registrations.sql</code> in the Supabase SQL editor — registrations
          will appear here once applicants start submitting.
        </div>
      )}

      {summary && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total registered" value={summary.total} icon={Users} lit />
          {Object.entries(summary.byYear).sort().map(([label, value]) => (
            <StatTile key={label} label={label} value={value} />
          ))}
        </div>
      )}

      {summary && rows.length > 0 && (
        <section className="lamp-panel mb-6 p-5 sm:p-6" aria-labelledby="recruitment-departments-title">
          <h2 id="recruitment-departments-title" className="text-lg text-text-primary">Registrations by department</h2>
          <p className="mt-1 text-[13px] text-text-muted">All registrations. Select a department to filter the list below.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {branches.map((name) => {
              const count = summary.byBranch?.[name] || 0;
              const pct = Math.round((count / summary.total) * 100);
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={branch === name}
                  aria-label={`${name}: ${count} ${count === 1 ? "registration" : "registrations"}. ${branch === name ? "Clear department filter" : "Filter by department"}`}
                  onClick={() => setBranch((current) => current === name ? "all" : name)}
                  className={`min-h-20 rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${branch === name ? "border-primary bg-primary/10" : "border-[rgb(var(--rule))] bg-surface/50 hover:border-primary/60"}`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-text-primary">{name}</span>
                    <span className="text-lg font-semibold tabular-nums text-text-primary">{count}</span>
                  </span>
                  <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="mt-1 block text-xs tabular-nums text-text-muted">{pct}% of total</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {summary && Object.keys(summary.byFirstPreference).length > 0 && (
        <section className="lamp-panel p-5 sm:p-6 mb-6">
          <h2 className="text-lg text-text-primary">Demand by 1st preference</h2>
          <p className="mt-1 text-[13px] text-text-muted">How many picked each domain first — use it to size interview slots.</p>
          <ul className="mt-4 flex flex-col gap-2">
            {Object.entries(summary.byFirstPreference)
              .sort((a, b) => b[1] - a[1])
              .map(([domain, count]) => {
                const pct = summary.total ? Math.round((count / summary.total) * 100) : 0;
                return (
                  <li key={domain} className="flex items-center gap-3">
                    <span className="w-48 shrink-0 truncate text-sm text-text-primary">{domain}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-16 shrink-0 text-right text-sm tabular-nums text-text-muted">
                      {count} ({pct}%)
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      <section className="lamp-panel p-5 sm:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="text-[13px] text-text-muted">Search</span>
            <span className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-text-dim" strokeWidth={1.75} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, USN, branch, section or phone"
                className="w-full rounded-xl border border-[rgb(var(--rule))] bg-surface/50 py-2 pl-9 pr-3 text-sm text-text-primary"
              />
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-muted">Year</span>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="rounded-xl border border-[rgb(var(--rule))] bg-surface/50 px-3 py-2 text-sm text-text-primary"
            >
              <option value="all">All years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-muted">Department</span>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="rounded-xl border border-[rgb(var(--rule))] bg-surface/50 px-3 py-2 text-sm text-text-primary"
            >
              <option value="all">All departments</option>
              {branches.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[13px] text-text-muted">1st preference</span>
            <select
              value={preference}
              onChange={(e) => setPreference(e.target.value)}
              className="rounded-xl border border-[rgb(var(--rule))] bg-surface/50 px-3 py-2 text-sm text-text-primary"
            >
              <option value="all">All domains</option>
              {preferences.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>

        <p className="mt-4 text-[13px] text-text-muted" role="status">
          Showing {visible.length} of {rows.length}
        </p>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Inbox className="h-6 w-6 text-text-dim" strokeWidth={1.5} aria-hidden="true" />
            <p className="text-sm text-text-muted">
              {rows.length === 0 ? "No one has registered yet." : "Nothing matches those filters."}
            </p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--rule))] text-left text-[13px] text-text-muted">
                  <th scope="col" className="py-2 pr-4 font-normal">Name</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Year</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Contact</th>
                  <th scope="col" className="py-2 pr-4 font-normal">USN</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Branch / section</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Preferences</th>
                  <th scope="col" className="py-2 font-normal">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id} className="border-b border-[rgb(var(--rule))]/60 align-top">
                    <td className="py-3 pr-4 text-text-primary">{r.name}</td>
                    <td className="py-3 pr-4 text-text-muted">
                      Year {r.year}
                      <span className="block text-[12px] text-text-dim">
                        {ENTRY_LABEL[r.student_type] || r.student_type}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-text-muted">
                      <a href={`mailto:${r.email}`} className="underline underline-offset-2">{r.email}</a>
                      <span className="block text-[12px] text-text-dim">{r.phone}</span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-[13px] text-text-muted">{r.usn}</td>
                    <td className="py-3 pr-4 text-text-muted">
                      {r.branch}
                      <span className="block text-[12px] text-text-dim">Section {r.section}</span>
                    </td>
                    <td className="py-3 pr-4 text-text-muted">
                      {r.first_preference}
                      <span className="block text-[12px] text-text-dim">then {r.second_preference}</span>
                    </td>
                    <td className="py-3 text-text-dim">
                      {r.submitted_at ? String(r.submitted_at).slice(0, 10) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
