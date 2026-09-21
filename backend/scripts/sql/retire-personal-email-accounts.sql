-- ============================================================
-- Retire the personal-email accounts ahead of college-only sign-in
-- ============================================================
-- CONTEXT: 101 of 348 members signed up with a personal address (100
-- gmail.com, 1 iisc.ac.in) rather than their @bmsit.in one. Once
-- ALLOWED_EMAIL_DOMAINS is set, those addresses can no longer register
-- or use code sign-in, and each person will sign in with their college
-- address instead — which creates a NEW students row.
--
-- Without this step the old rows linger as ghosts: they inflate the
-- member count, show up in admin lists and leaderboards, and make it
-- look as though everyone has a duplicate.
--
-- WHY DEACTIVATE RATHER THAN DELETE: this is reversible. A delete would
-- also orphan the matching auth.users row, and there is no way back if
-- it turns out someone's row mattered. Deactivating stops the account
-- being usable and hides it from active-member views; if you decide
-- later that you want the rows gone, delete them then.
--
-- EXCLUDED FROM THIS SCRIPT, and left alone on purpose:
--   - admin, super_admin and teacher accounts. They are verified people,
--     not students, and their addresses are NOT to be changed. Their
--     access is preserved instead via ALLOWED_EMAIL_EXCEPTIONS (see
--     backend/lib/emailDomain.js), which lets named addresses keep
--     using code sign-in even on a personal domain.
--   - anyone holding XP.
-- ============================================================


-- ============================================================
-- SECTION 0 — the accounts this script deliberately SKIPS.
-- Read it; do not "fix" it. These stay exactly as they are.
-- ============================================================
select name, email, role, xp, user_id
from students
where email not ilike '%@bmsit.in'
  and (role <> 'student' or coalesce(xp, 0) > 0)
order by role, xp desc;

-- Copy the email column from the rows above into the Render env var
-- ALLOWED_EMAIL_EXCEPTIONS (comma separated). That keeps every one of
-- these accounts working on the new sign-in flow without touching a
-- single row or asking anyone to change address.


-- ============================================================
-- SECTION 1 — DRY RUN. Changes nothing.
-- ============================================================
select
  count(*)                                   as will_be_deactivated,
  count(*) filter (where is_active is false) as already_inactive
from students
where email not ilike '%@bmsit.in'
  and role = 'student'
  and coalesce(xp, 0) = 0;

-- The actual list, so you can eyeball it before committing.
select name, email, created_at
from students
where email not ilike '%@bmsit.in'
  and role = 'student'
  and coalesce(xp, 0) = 0
order by created_at;


-- ============================================================
-- SECTION 2 — DEACTIVATE. Run after section 0 is handled.
-- ============================================================
begin;

update students
set is_active = false
where email not ilike '%@bmsit.in'
  and role = 'student'
  and coalesce(xp, 0) = 0;

-- Verify: no staff and nobody holding XP should have been touched.
select
  (select count(*) from students
    where email not ilike '%@bmsit.in' and is_active is false)          as deactivated_now,
  (select count(*) from students
    where email not ilike '%@bmsit.in' and role <> 'student'
      and is_active is false)                                           as staff_wrongly_hit,
  (select count(*) from students
    where coalesce(xp,0) > 0 and is_active is false)                    as xp_holders_wrongly_hit;

-- staff_wrongly_hit and xp_holders_wrongly_hit must both be 0.
-- Then finish with `commit;` — or `rollback;` to undo.
commit;


-- ============================================================
-- TO UNDO, later
-- ============================================================
-- update students set is_active = true
-- where email not ilike '%@bmsit.in' and role = 'student';
