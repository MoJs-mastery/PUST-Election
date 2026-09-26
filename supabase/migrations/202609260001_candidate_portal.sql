-- ========================================================
-- CANDIDATE PORTAL MIGRATION
-- Candidates log in with an email/password (given by an admin) and see
-- ONLY their own data (their profile + their own vote count).
--
-- Run this in the Supabase SQL Editor. Idempotent: safe to re-run.
-- ========================================================

BEGIN;

-- 1. Link a candidate row to an auth.users account (admin-created).
alter table public.musharax_musharax_db
    add column if not exists auth_id uuid references auth.users(id) on delete set null;

create index if not exists musharax_auth_id_idx on public.musharax_musharax_db (auth_id);

-- 2. A logged-in candidate may read ONLY their own candidate row
--    (even if they are currently blocked from receiving new votes).
drop policy if exists "musharax_select_own" on public.musharax_musharax_db;
create policy "musharax_select_own"
    on public.musharax_musharax_db for select
    to authenticated
    using (auth_id = auth.uid());

-- 3. A logged-in candidate may read ONLY their own votes.
drop policy if exists "codbixiye_select_own" on public.codbixiye_codbixiye_db;
create policy "codbixiye_select_own"
    on public.codbixiye_codbixiye_db for select
    to authenticated
    using (
        c_musharax_id = (
            select m.id
            from public.musharax_musharax_db m
            where m.auth_id = auth.uid()
            limit 1
        )
    );

COMMIT;