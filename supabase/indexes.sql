-- ========================================================
-- PRODUCTION INDEXES
-- Run in Supabase SQL Editor. Safe to run multiple times.
-- These prevent full-table scans as the vote log grows.
-- ========================================================

-- Vote log: most common query pattern is votes-by-candidate
CREATE INDEX IF NOT EXISTS idx_codbixiye_musharax_id
    ON public.codbixiye_codbixiye_db (c_musharax_id);

-- Vote log: votes-by-department (Dashboard / Departments tallies)
CREATE INDEX IF NOT EXISTS idx_codbixiye_department_id
    ON public.codbixiye_codbixiye_db (c_department_id);

-- Vote log: lookup by voting ID (Codbixiye search / duplicate guard)
CREATE INDEX IF NOT EXISTS idx_codbixiye_c_id_id
    ON public.codbixiye_codbixiye_db (c_id_id);

-- Voting IDs: uniqueness is already enforced by the UNIQUE(c_id) constraint;
-- an index enables fast "is this code used?" lookups during voting.
CREATE INDEX IF NOT EXISTS idx_voiteid_is_used
    ON public.voiteid_id_db (is_used);

-- Candidates: filter/aggregate by department
CREATE INDEX IF NOT EXISTS idx_musharax_department_id
    ON public.musharax_musharax_db (m_depadrments_id);

-- Candidates: public voting page lists only allowed candidates
CREATE INDEX IF NOT EXISTS musharax_m_if_allowed_idx
    ON public.musharax_musharax_db (m_if_allowed);

-- Vote log: "recent votes" ordering on the dashboard / tables
CREATE INDEX IF NOT EXISTS codbixiye_created_at_idx
    ON public.codbixiye_codbixiye_db (created_at);

-- Profiles: is_superuser() / admin listing lookups
CREATE INDEX IF NOT EXISTS profiles_is_superuser_idx
    ON public.profiles (is_superuser);