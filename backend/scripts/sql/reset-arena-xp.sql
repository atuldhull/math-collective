-- ============================================================
-- Reset arena XP
-- ============================================================
-- WHY: before commit 2813a91, /api/challenge/current, /next and /:id
-- returned `correct_index` and `solution` to anyone, without a login,
-- BEFORE the student answered. Anyone who opened the Network tab could
-- score every arena challenge correctly. Arena XP and the leaderboard
-- built on it therefore cannot be trusted.
--
-- (The live-quiz time bonus was separately broken — the client sent its
-- own `timeTaken` and the field was in fact never set, so every correct
-- answer always received a full bonus. Quiz scores are not stored in
-- students.xp, so this script does not touch them.)
--
-- SCOPE: this subtracts ONLY XP earned in the arena, computed from
-- arena_attempts. It deliberately does NOT zero students.xp, because
-- that column also holds XP from events, certificates and scheduled
-- tests, which were never forgeable and should survive.
--
-- HOW TO RUN: execute section 1, read the output, and only then run
-- section 2. Section 2 is wrapped in a transaction — inspect the
-- verification output before you COMMIT.
-- ============================================================


-- ============================================================
-- SECTION 1 — DRY RUN. Changes nothing. Read this first.
-- ============================================================

-- 1a. How much arena XP exists, and how many people are affected?
select
  count(distinct user_id)                       as students_affected,
  count(*)                                      as total_attempts,
  coalesce(sum(xp_earned), 0)                   as total_arena_xp,
  coalesce(min(xp_earned), 0)                   as smallest_award,
  coalesce(max(xp_earned), 0)                   as largest_award
from arena_attempts;

-- 1b. Per-student preview: what each person has now, what would be
--     subtracted, and what they would be left with.
--
--     Two flags worth reading before you run section 2:
--
--     would_go_negative — their arena XP exceeds their total, which can
--       happen if XP was spent or adjusted elsewhere. Section 2 floors
--       at 0 so nobody ends up below zero.
--
--     net_arena_was_negative — arena_attempts.xp_earned can be NEGATIVE,
--       because the arena docks XP for a wrong answer. Anyone who got
--       more wrong than right has a negative net, and subtracting a
--       negative ADDS XP. That is the faithful undo (it refunds
--       penalties paid in a game whose answers were visible), but it
--       does mean a few people finish with MORE than they started with.
--       Check how many before deciding you are happy with it.
select
  s.user_id,
  s.name,
  s.email,
  s.xp                                          as xp_now,
  coalesce(a.arena_xp, 0)                       as arena_xp_to_remove,
  greatest(0, s.xp - coalesce(a.arena_xp, 0))   as xp_after,
  (s.xp - coalesce(a.arena_xp, 0)) < 0          as would_go_negative,
  coalesce(a.arena_xp, 0) < 0                   as net_arena_was_negative
from students s
left join (
  select user_id, sum(xp_earned) as arena_xp
  from arena_attempts
  group by user_id
) a on a.user_id = s.user_id
where coalesce(a.arena_xp, 0) <> 0
order by arena_xp_to_remove desc;

-- 1c. Just the counts, if the per-student list is long.
select
  count(*) filter (where arena_xp > 0) as would_lose_xp,
  count(*) filter (where arena_xp < 0) as would_gain_xp_refunded_penalties
from (
  select user_id, sum(xp_earned) as arena_xp
  from arena_attempts group by user_id
) a;


-- ============================================================
-- SECTION 2 — THE ACTUAL RESET. Run only after reading section 1.
-- ============================================================
-- Remove the BEGIN/COMMIT lines if your SQL editor manages its own
-- transaction (the Supabase editor does not run these implicitly).

begin;

-- 2a. Subtract arena XP from the running totals, floored at zero so a
--     mismatch can never leave someone with negative XP.
update students s
set
  xp        = greatest(0, s.xp        - coalesce(a.arena_xp, 0)),
  weekly_xp = greatest(0, s.weekly_xp - coalesce(a.arena_weekly_xp, 0))
from (
  select
    user_id,
    sum(xp_earned) as arena_xp,
    -- Weekly XP only counts this week's attempts; anything older has
    -- already been cleared by the weekly reset job.
    sum(xp_earned) filter (where created_at >= date_trunc('week', now())) as arena_weekly_xp
  from arena_attempts
  group by user_id
) a
where a.user_id = s.user_id;

-- 2b. Clear the attempt history itself, so the challenges become
--     answerable again and nobody keeps a record built on visible
--     answers. Comment this out if you would rather keep the rows for
--     analysis — 2a alone already removes the XP.
delete from arena_attempts;

-- 2c. Verification — expect total_arena_xp = 0 and no negative XP.
select
  (select coalesce(sum(xp_earned), 0) from arena_attempts) as total_arena_xp_remaining,
  (select count(*) from students where xp < 0)             as students_with_negative_xp,
  (select count(*) from students where xp > 0)             as students_still_holding_xp;

-- Inspect the row above, then finish with either:
--   commit;      -- keep the changes
--   rollback;    -- undo everything in this transaction
commit;
