/**
 * Admin view of the recruitment intake.
 *
 * The public form writes to `recruitment_registrations` and nothing could
 * read it back, so applications landed somewhere only the Supabase dashboard
 * could see. These two endpoints are that missing half.
 *
 * Rows hold applicants' personal details — name, phone, email, USN — so both
 * routes sit behind requireAdmin (mounted in adminRoutes.js) and neither is
 * reachable by a student.
 *
 * The table is not tenant-scoped: it has no org_id, and the intake is a
 * single club's recruitment drive rather than per-organisation data. So these
 * read through the service-role client directly, exactly as the public
 * submission path does, and the tenant-scoping invariant does not apply.
 */
import supabase from "../../config/supabase.js";
import { logger } from "../../config/logger.js";
import { toCsv, CSV_BOM } from "../../lib/exportHelpers.js";

const COLUMNS =
  "id, year, student_type, name, phone, email, usn, branch, section, " +
  "first_preference, second_preference, submitted_at";

/** Newest first; ties broken by id so paging is stable. */
function query() {
  return supabase
    .from("recruitment_registrations")
    .select(COLUMNS)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: true });
}

/**
 * A missing table is the expected state until migration 45 has been run in
 * Supabase, and it should read as "nothing yet" rather than a server error —
 * otherwise the page looks broken when it is merely empty.
 */
function tableMissing(error) {
  return error?.code === "PGRST205" || /Could not find the table/i.test(error?.message || "");
}

/* GET /api/admin/recruitment — every registration, plus the counts the
   page shows at the top. The intake is a few hundred rows at most, so it
   is returned in one go and filtered in the browser. */
export const listRecruitment = async (req, res) => {
  try {
    const { data, error } = await query();
    if (error) {
      if (tableMissing(error)) {
        return res.json({ registrations: [], summary: emptySummary(), tableReady: false });
      }
      throw error;
    }
    const rows = data || [];
    return res.json({ registrations: rows, summary: summarise(rows), tableReady: true });
  } catch (err) {
    logger.error({ err, adminId: req.session?.user?.id }, "listRecruitment");
    return res.status(500).json({ error: "Failed to load recruitment registrations" });
  }
};

/* GET /api/admin/recruitment/export — the same rows as a CSV for
   shortlisting and interview scheduling. */
export const exportRecruitment = async (req, res) => {
  try {
    const { data, error } = await query();
    if (error && !tableMissing(error)) throw error;
    const rows = error ? [] : data || [];
    const csv = toCsv(rows, [
      "name",
      { key: "year", label: "year", value: (r) => `Year ${r.year}` },
      { key: "student_type", label: "entry", value: (r) => r.student_type },
      "email",
      "phone",
      "usn",
      "branch",
      "section",
      { key: "first_preference", label: "1st preference" },
      { key: "second_preference", label: "2nd preference" },
      {
        key: "submitted_at",
        label: "submitted",
        value: (r) => (r.submitted_at ? String(r.submitted_at).replace("T", " ").slice(0, 16) : ""),
      },
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="recruitment_${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    return res.send(CSV_BOM + csv);
  } catch (err) {
    logger.error({ err, adminId: req.session?.user?.id }, "exportRecruitment");
    return res.status(500).json({ error: "Failed to export recruitment registrations" });
  }
};

function emptySummary() {
  return { total: 0, byYear: {}, byFirstPreference: {}, byStudentType: {} };
}

/** Counts for the header strip: how many applied, and demand per team. */
function summarise(rows) {
  const summary = emptySummary();
  summary.total = rows.length;
  for (const row of rows) {
    const year = `Year ${row.year}`;
    summary.byYear[year] = (summary.byYear[year] || 0) + 1;
    if (row.first_preference) {
      summary.byFirstPreference[row.first_preference] =
        (summary.byFirstPreference[row.first_preference] || 0) + 1;
    }
    if (row.student_type) {
      summary.byStudentType[row.student_type] = (summary.byStudentType[row.student_type] || 0) + 1;
    }
  }
  return summary;
}
