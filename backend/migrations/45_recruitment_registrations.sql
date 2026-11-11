-- Run in the Supabase SQL Editor before accepting recruitment applications.
-- No unique constraint: this intake does not impose a new duplicate policy.
CREATE TABLE IF NOT EXISTS public.recruitment_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year SMALLINT NOT NULL CHECK (year IN (1, 2, 3)),
  student_type TEXT NOT NULL CHECK (
    (year = 1 AND student_type = 'first-year') OR
    (year IN (2, 3) AND student_type IN ('normal', 'lateral'))
  ),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  usn TEXT NOT NULL,
  branch TEXT NOT NULL,
  section TEXT NOT NULL,
  first_preference TEXT NOT NULL,
  second_preference TEXT NOT NULL CHECK (second_preference <> first_preference),
  rules_accepted BOOLEAN NOT NULL CHECK (rules_accepted = TRUE),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (student_type <> 'normal' OR lower(email) LIKE '%@bmsit.in')
);

-- All access goes through the server's service-role client. No public list or
-- direct browser insert is permitted, including for signed-in students.
ALTER TABLE public.recruitment_registrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.recruitment_registrations FROM anon, authenticated;
GRANT INSERT, SELECT ON TABLE public.recruitment_registrations TO service_role;
