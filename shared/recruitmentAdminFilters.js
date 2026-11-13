/** Keep the admin table and its CSV export on the same filter rules. */
export function filterRecruitmentRows(rows, { search = "", year = "all", branch = "all", preference = "all" } = {}) {
  const needle = String(search).trim().toLowerCase();
  return rows.filter((row) => {
    if (year !== "all" && String(row.year) !== String(year)) return false;
    if (branch !== "all" && row.branch !== branch) return false;
    if (preference !== "all" && row.first_preference !== preference) return false;
    if (!needle) return true;
    return [row.name, row.email, row.usn, row.branch, row.section, row.phone].some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(needle),
    );
  });
}
