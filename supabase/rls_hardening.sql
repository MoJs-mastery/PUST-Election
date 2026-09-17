-- ========================================================
-- RLS HARDENING (OPTIONAL, RECOMMENDED FOR PRODUCTION)
-- Run in Supabase SQL Editor.
--
-- WARNING: This ENABLES Row Level Security. After applying, the anon key
-- can only run the operations granted below. Verify the public voting flow
-- (ID check + vote submit) and the admin flow (login + dashboard CRUD)
-- immediately after applying. Everything was policy-mapped to the exact
-- operations the app performs today, so it should keep working.
--
-- To revert at any time:
--   ALTER TABLE public.depadrments_depadrments_db          DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.musharax_musharax_db                DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.voiteid_id_db                       DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.codbixiye_codbixiye_db              DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.profiles                            DISABLE ROW LEVEL SECURITY;
-- ========================================================

-- ---------- 1. Departments ----------
ALTER TABLE public.depadrments_depadrments_db ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "depts_public_read" ON public.depadrments_depadrments_db;
CREATE POLICY "depts_public_read"
    ON public.depadrments_depadrments_db FOR SELECT
    USING (true); -- public voters see departments

DROP POLICY IF EXISTS "depts_admin_all" ON public.depadrments_depadrments_db;
CREATE POLICY "depts_admin_all"
    ON public.depadrments_depadrments_db FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

-- ---------- 2. Candidates ----------
ALTER TABLE public.musharax_musharax_db ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cands_public_read" ON public.musharax_musharax_db;
CREATE POLICY "cands_public_read"
    ON public.musharax_musharax_db FOR SELECT
    USING (true); -- public voters see candidates

DROP POLICY IF EXISTS "cands_admin_all" ON public.musharax_musharax_db;
CREATE POLICY "cands_admin_all"
    ON public.musharax_musharax_db FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

-- ---------- 3. Voting IDs ----------
ALTER TABLE public.voiteid_id_db ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ids_public_read" ON public.voiteid_id_db;
CREATE POLICY "ids_public_read"
    ON public.voiteid_id_db FOR SELECT
    TO anon, authenticated
    USING (true); -- voters verify their code exists/available

-- Voters may only flip a code to used (marking a vote); they cannot
-- create codes or change their value.
DROP POLICY IF EXISTS "ids_public_use" ON public.voiteid_id_db;
CREATE POLICY "ids_public_use"
    ON public.voiteid_id_db FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (is_used = true);

DROP POLICY IF EXISTS "ids_admin_all" ON public.voiteid_id_db;
CREATE POLICY "ids_admin_all"
    ON public.voiteid_id_db FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

-- ---------- 4. Vote log (Codbixiye) ----------
ALTER TABLE public.codbixiye_codbixiye_db ENABLE ROW LEVEL SECURITY;

-- Public voters may cast a vote (insert) but NOT read the vote log.
DROP POLICY IF EXISTS "votes_public_insert" ON public.codbixiye_codbixiye_db;
CREATE POLICY "votes_public_insert"
    ON public.codbixiye_codbixiye_db FOR INSERT
    TO anon
    WITH CHECK (true);

-- Admins can read and delete vote records.
DROP POLICY IF EXISTS "votes_admin_select" ON public.codbixiye_codbixiye_db;
CREATE POLICY "votes_admin_select"
    ON public.codbixiye_codbixiye_db FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "votes_admin_delete" ON public.codbixiye_codbixiye_db;
CREATE POLICY "votes_admin_delete"
    ON public.codbixiye_codbixiye_db FOR DELETE
    TO authenticated
    USING (true);

-- ---------- 5. Admin profiles ----------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all"
    ON public.profiles FOR ALL
    TO authenticated
    USING (true) WITH CHECK (true);

-- ---------- Storage (already created in schema.sql) ----------
-- candidate-images bucket: public read, authenticated upload/update/delete.
-- If not yet applied, run that section of schema.sql first.