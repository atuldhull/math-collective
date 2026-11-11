-- ═══════════════════════════════════════════════════════════════
--  ASYMPTOTES — RE-ENABLE ROW LEVEL SECURITY
--  Run this in the Supabase SQL Editor.
--
--  WHY THIS EXISTS
--  ───────────────
--  Migration 21 switched RLS off across the data plane. Its stated
--  reason was that writes were failing with "new row violates
--  row-level security policy" *despite the server using the
--  service-role key*, so it concluded that service-role had stopped
--  bypassing RLS.
--
--  That conclusion was wrong. The server was not using the
--  service-role key: SUPABASE_SERVICE_ROLE_KEY on the host was set to
--  the publishable key, which maps to the `anon` role. RLS was working
--  exactly as designed and correctly refusing an anonymous client.
--
--  The symptom that exposed it: recruitment_registrations (migration
--  45) is the one table that kept RLS on, and reads of it failed with
--  42501 "permission denied" while every other table worked — because
--  every other table had RLS disabled. Once the host was given the
--  real secret key, that table started reading fine. That is
--  service-role bypassing RLS, working.
--
--  So the workaround can go, and the protection can come back.
--
--  WHY THIS IS SAFE
--  ────────────────
--  Nothing but the server talks to the database:
--    - the browser bundle contains no supabase-js and no
--      VITE_SUPABASE_* variables; every query goes through Express;
--    - backend/config/supabase.js builds one client from
--      SUPABASE_SERVICE_ROLE_KEY, and service-role bypasses RLS;
--    - createAuthClient() is used only for signInWithPassword and
--      verifyOtp — it never runs a table query — so no query ever
--      goes out carrying a member's JWT.
--
--  Enabling RLS with no policies is therefore default-deny for anyone
--  holding the publishable key, and a no-op for the server. Tenant
--  scoping is unaffected: it is enforced in application code by the
--  req.db proxy, not by RLS.
--
--  WHAT IT DOES
--  ────────────
--  Turns RLS on for every table in `public` that currently has it off.
--  Written as a loop rather than a list so tables added since — and
--  any this file's author did not know about — are covered too.
--  Idempotent: running it twice changes nothing the second time.
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'          -- ordinary tables only, not views
      AND c.relrowsecurity = FALSE -- already-protected tables are skipped
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target.relname);
    RAISE NOTICE 'RLS enabled on %', target.relname;
  END LOOP;
END $$;

-- ── Check it ───────────────────────────────────────────────────
-- Expect zero rows. Anything listed still has RLS off.
SELECT c.relname AS table_without_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = FALSE
ORDER BY 1;

-- ── If something breaks ────────────────────────────────────────
-- Turn it off for one table and report which one, rather than
-- disabling the lot again:
--
--   ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
--
-- A failure here would mean some query reaches the database as a role
-- other than service_role, which is worth finding rather than hiding.
