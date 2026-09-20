/**
 * Pull a human-readable message out of an axios error.
 *
 * Every backend handler answers with `{ error }`, and validateBody adds
 * `{ error: "Validation failed", issues: [{ path, message }] }`. The
 * profile page used to read `data.message`, which no endpoint sends —
 * so a perfectly clear 400 ("Password must be at least 8 characters")
 * was rendered as a blank "Failed to change password" and members had
 * no idea what to fix. Read the shapes we actually send, preferring the
 * specific field-level issue over the generic wrapper.
 */
export function apiErrorMessage(err, fallback = "Something went wrong") {
  const data = err?.response?.data;
  if (!data) {
    // No response at all → network / CORS / timeout.
    if (err?.code === "ECONNABORTED") return "The server took too long to respond. Try again.";
    if (err?.message === "Network Error") return "Can't reach the server. Check your connection.";
    return err?.message || fallback;
  }
  const issue = Array.isArray(data.issues) && data.issues.length ? data.issues[0].message : null;
  return issue || data.error || data.message || fallback;
}
