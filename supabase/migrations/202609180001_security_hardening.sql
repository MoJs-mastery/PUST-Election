-- ========================================================
-- P-ELECTION SECURITY HARDENING MIGRATION
-- Tested against the production schema (Puntland University app).
--
-- Run this ONCE in the Supabase SQL Editor (dashboard > SQL > New query).
-- It is idempotent: safe to run again if a statement fails halfway.
--
-- What it does:
--   1. Enables ROW LEVEL SECURITY on every table (admin + voter data).
--   2. Creates a SECURITY DEFINER helper  public.is_superuser()  so the
--      frontend never has to trust client-supplied metadata.
--   3. Creates  cast_vote()  - the ONLY way a ballot can be written.
--      It locks the voting code row, validates everything server-side,
--      and atomically records the vote + marks the code used.
--   4. Creates  validate_voting_code()  - safe "is my ID still valid?"
--      check that discloses nothing to anonymous users.
--   5. Replaces the old permissive storage policies with superuser-gated
--      policies that also enforce path + file type (png/jpeg/jpg/webp).
--   6. Adds CHECK constraints + indexes that match the existing data.
--   7. Bootstraps public.profiles from auth.users (the table is currently
--      EMPTY). Existing users are imported with is_superuser = FALSE by
--      default. See the "ADMIN PROMOTION" note at the bottom - run the
--      one-line UPDATE with YOUR OWN email to unlock the dashboard.
-- ========================================================

BEGIN;

-- --------------------------------------------------------
-- 0. Helper: is_superuser()
-- --------------------------------------------------------
-- SECURITY DEFINER = runs with full privileges, ignores RLS, reads the
-- protected profiles table. The END USER CANNOT change its result.
create or replace function public.is_superuser()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select (public.profiles.is_superuser = true)
  from public.profiles
  where profiles.id = auth.uid();
$$;

revoke all on function public.is_superuser() from public;
grant execute on function public.is_superuser() to authenticated;

-- --------------------------------------------------------
-- 1. Enable ROW LEVEL SECURITY on all tables
-- --------------------------------------------------------
alter table public.depadrments_depadrments_db enable row level security;
alter table public.musharax_musharax_db enable row level security;
alter table public.voiteid_id_db enable row level security;
alter table public.codbixiye_codbixiye_db enable row level security;
alter table public.profiles enable row level security;

-- Defense in depth: anonymous users lose direct table access to anything
-- sensitive. The SECURITY DEFINER functions above are the only anon paths
-- to voter data now.
revoke all on public.voiteid_id_db from anon;
revoke all on public.codbixiye_codbixiye_db from anon;
revoke all on public.profiles from anon;

-- --------------------------------------------------------
-- 2. DROP all policies this migration owns, so it is IDEMPOTENT
--    (old permissive schema.sql-era policies AND this file's own)
-- --------------------------------------------------------
drop policy if exists "Allow public full access depadrments" on public.depadrments_depadrments_db;
drop policy if exists "Allow public full access musharax" on public.musharax_musharax_db;
drop policy if exists "Allow public full access voiteid" on public.voiteid_id_db;
drop policy if exists "Allow public full access codbixiye" on public.codbixiye_codbixiye_db;
drop policy if exists "Allow public full access profiles" on public.profiles;

drop policy if exists "depadrments_select_public" on public.depadrments_depadrments_db;
drop policy if exists "depadrments_insert_admin" on public.depadrments_depadrments_db;
drop policy if exists "depadrments_update_admin" on public.depadrments_depadrments_db;
drop policy if exists "depadrments_delete_admin" on public.depadrments_depadrments_db;

drop policy if exists "musharax_select_public" on public.musharax_musharax_db;
drop policy if exists "musharax_select_admin" on public.musharax_musharax_db;
drop policy if exists "musharax_insert_admin" on public.musharax_musharax_db;
drop policy if exists "musharax_update_admin" on public.musharax_musharax_db;
drop policy if exists "musharax_delete_admin" on public.musharax_musharax_db;

drop policy if exists "voiteid_select_admin" on public.voiteid_id_db;
drop policy if exists "voiteid_insert_admin" on public.voiteid_id_db;
drop policy if exists "voiteid_update_admin" on public.voiteid_id_db;
drop policy if exists "voiteid_delete_admin" on public.voiteid_id_db;

drop policy if exists "codbixiye_select_admin" on public.codbixiye_codbixiye_db;
drop policy if exists "codbixiye_insert_admin" on public.codbixiye_codbixiye_db;
drop policy if exists "codbixiye_update_admin" on public.codbixiye_codbixiye_db;
drop policy if exists "codbixiye_delete_admin" on public.codbixiye_codbixiye_db;

drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;

-- --------------------------------------------------------
-- 3. DEPARTMENTS: anyone can read, admin table writes
-- --------------------------------------------------------
create policy "depadrments_select_public"
on public.depadrments_depadrments_db for select
to anon, authenticated
using (true);

create policy "depadrments_insert_admin"
on public.depadrments_depadrments_db for insert
to authenticated
with check (public.is_superuser());

create policy "depadrments_update_admin"
on public.depadrments_depadrments_db for update
to authenticated
using (public.is_superuser())
with check (public.is_superuser());

create policy "depadrments_delete_admin"
on public.depadrments_depadrments_db for delete
to authenticated
using (public.is_superuser());

-- --------------------------------------------------------
-- 4. CANDIDATES: anon sees only allowed candidates, admins CRUD all
-- --------------------------------------------------------
create policy "musharax_select_public"
on public.musharax_musharax_db for select
to anon, authenticated
using (m_if_allowed = true);

create policy "musharax_select_admin"
on public.musharax_musharax_db for select
to authenticated
using (public.is_superuser());

create policy "musharax_insert_admin"
on public.musharax_musharax_db for insert
to authenticated
with check (public.is_superuser());

create policy "musharax_update_admin"
on public.musharax_musharax_db for update
to authenticated
using (public.is_superuser())
with check (public.is_superuser());

create policy "musharax_delete_admin"
on public.musharax_musharax_db for delete
to authenticated
using (public.is_superuser());

-- --------------------------------------------------------
-- 5. VOTING IDS + VOTES: superusers only (no anon access)
-- --------------------------------------------------------
create policy "voiteid_select_admin"
on public.voiteid_id_db for select
to authenticated
using (public.is_superuser());

create policy "voiteid_insert_admin"
on public.voiteid_id_db for insert
to authenticated
with check (public.is_superuser());

create policy "voiteid_update_admin"
on public.voiteid_id_db for update
to authenticated
using (public.is_superuser())
with check (public.is_superuser());

create policy "voiteid_delete_admin"
on public.voiteid_id_db for delete
to authenticated
using (public.is_superuser());

create policy "codbixiye_select_admin"
on public.codbixiye_codbixiye_db for select
to authenticated
using (public.is_superuser());

create policy "codbixiye_insert_admin"
on public.codbixiye_codbixiye_db for insert
to authenticated
with check (public.is_superuser());

create policy "codbixiye_update_admin"
on public.codbixiye_codbixiye_db for update
to authenticated
using (public.is_superuser())
with check (public.is_superuser());

create policy "codbixiye_delete_admin"
on public.codbixiye_codbixiye_db for delete
to authenticated
using (public.is_superuser());

-- --------------------------------------------------------
-- 6. PROFILES: users see/update themselves, admins manage everyone.
--    Self-promotion is impossible: the WITH CHECK re-reads is_superuser()
--    from the ALREADY STORED row, so a normal user cannot flip the flag.
-- --------------------------------------------------------
create policy "profiles_select_self"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_superuser());

create policy "profiles_insert_self"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and is_superuser = false);

create policy "profiles_insert_admin"
on public.profiles for insert
to authenticated
with check (public.is_superuser());

create policy "profiles_update_self"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid() and (public.is_superuser() or is_superuser = false));

create policy "profiles_update_admin"
on public.profiles for update
to authenticated
using (public.is_superuser())
with check (public.is_superuser());

create policy "profiles_delete_admin"
on public.profiles for delete
to authenticated
using (public.is_superuser() and id <> auth.uid());

-- --------------------------------------------------------
-- 7. SECURE VOTING RPC (THE ONLY WRITE PATH FOR BALLOTS)
-- --------------------------------------------------------
-- Validate + record one vote atomically. Called by an anonymous user
-- (the voter), runs as the table owner (SECURITY DEFINER), so it can
-- safely touch voiteid/codbixiye after revoking anon table access.
--
-- Returns app-level status codes the frontend maps to user messages:
--   ok | INVALID_VOTING_CODE | VOTING_CODE_ALREADY_USED |
--   INVALID_CANDIDATE | CANDIDATE_NOT_ALLOWED |
--   INVALID_DEPARTMENT | INVALID_GENDER | VOTE_FAILED
create or replace function public.cast_vote(
    p_voting_code    text,
    p_candidate_id   bigint,
    p_department_id  bigint,
    p_gender         text
)
returns text
language plpgsql
security definer
set search_path = public
volatile
as $$
declare
    t_code    text := upper(btrim(coalesce(p_voting_code, '')));
    -- Normalize to the exact values used by the database ('Male'/'Female'),
    -- which the codbixiye_gender_values CHECK constraint requires.
    t_gender  text := initcap(lower(btrim(coalesce(p_gender, ''))));
    v_cand    record;
    v_vote    record;
begin
    if t_code = '' then
        return 'INVALID_VOTING_CODE';
    end if;

    if t_gender not in ('Male', 'Female') then
        return 'INVALID_GENDER';
    end if;

    -- Lock the voting-code row exclusively so a concurrent over-the-wire
    -- request on the SAME code serializes here and cannot double-spend it.
    select * into v_vote
    from public.voiteid_id_db
    where c_id = t_code
    for update;

    if not found then
        return 'INVALID_VOTING_CODE';
    end if;

    if v_vote.is_used = true then
        return 'VOTING_CODE_ALREADY_USED';
    end if;

    -- Lock + validate the candidate (must exist AND be accepting votes).
    select * into v_cand
    from public.musharax_musharax_db
    where id = p_candidate_id
    for update;

    if not found then
        return 'INVALID_CANDIDATE';
    end if;

    if v_cand.m_if_allowed = false then
        return 'CANDIDATE_NOT_ALLOWED';
    end if;

    if not exists (select 1 from public.depadrments_depadrments_db where id = p_department_id) then
        return 'INVALID_DEPARTMENT';
    end if;

    -- Atomically record the vote AND consume the code.
    insert into public.codbixiye_codbixiye_db
        (c_id_id, c_musharax_id, c_department_id, c_gender)
    values
        (t_code, p_candidate_id, p_department_id, t_gender);

    update public.voiteid_id_db
    set is_used = true
    where id = v_vote.id;

    return 'ok';
exception
    when others then
        return 'VOTE_FAILED';
end;
$$;

revoke all on function public.cast_vote(text, bigint, bigint, text) from public;
grant execute on function public.cast_vote(text, bigint, bigint, text) to anon, authenticated;

-- --------------------------------------------------------
-- 8. SAFE "IS MY VOTE ID STILL GOOD?" RPC
-- --------------------------------------------------------
-- Returns a plain boolean. Reveals nothing about whether a code exists
-- vs. already used (both are simply "false"), so anonymous users get no
-- enumeration oracle. Used on the public vote page before show the form.
create or replace function public.validate_voting_code(
    p_voting_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_is_used boolean;
begin
    select is_used into v_is_used
    from public.voiteid_id_db
    where c_id = upper(btrim(coalesce(p_voting_code, '')));

    if not found then
        return false;
    end if;

    return (v_is_used = false);
end;
$$;

revoke all on function public.validate_voting_code(text) from public;
grant execute on function public.validate_voting_code(text) to anon, authenticated;

-- --------------------------------------------------------
-- 9. STORAGE: candidate images hardened
-- --------------------------------------------------------
-- Public bucket (read stays public because images are served over the
-- /object/public/ CDN). ALL writes now require is_superuser() AND the
-- path must stay inside candidates/ AND the file must be an image.

drop policy if exists "candidate-images-authenticated-upload" on storage.objects;
drop policy if exists "candidate-images-authenticated-delete" on storage.objects;
drop policy if exists "candidate-images-authenticated-update" on storage.objects;
drop policy if exists "candidate-images-admin-insert" on storage.objects;
drop policy if exists "candidate-images-admin-update" on storage.objects;
drop policy if exists "candidate-images-admin-delete" on storage.objects;

-- Writes are superuser-only and restricted to the candidates/ folder.
create policy "candidate-images-admin-insert"
on storage.objects for insert
to authenticated
with check (
    bucket_id = 'candidate-images'
    and (storage.foldername(name))[1] = 'candidates'
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp')
    and public.is_superuser()
);

create policy "candidate-images-admin-update"
on storage.objects for update
to authenticated
using (
    bucket_id = 'candidate-images'
    and (storage.foldername(name))[1] = 'candidates'
    and public.is_superuser()
)
with check (
    bucket_id = 'candidate-images'
    and (storage.foldername(name))[1] = 'candidates'
    and lower(storage.extension(name)) in ('png', 'jpg', 'jpeg', 'webp')
    and public.is_superuser()
);

create policy "candidate-images-admin-delete"
on storage.objects for delete
to authenticated
using (
    bucket_id = 'candidate-images'
    and (storage.foldername(name))[1] = 'candidates'
    and public.is_superuser()
);

-- Enforce the bucket-level limits (already set in schema.sql, re-apply
-- in case the bucket was created by hand without them).
update storage.buckets
set file_size_limit = 4194304,
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
where id = 'candidate-images';

-- --------------------------------------------------------
-- 10. CHECK CONSTRAINTS that match existing production data
-- --------------------------------------------------------
do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'musharax_name_not_blank'
                   and conrelid = 'public.musharax_musharax_db'::regclass) then
        alter table public.musharax_musharax_db
            add constraint musharax_name_not_blank check (btrim(coalesce(m_name, '')) <> '');
    end if;

    if not exists (select 1 from pg_constraint where conname = 'musharax_gender_check'
                   and conrelid = 'public.musharax_musharax_db'::regclass) then
        alter table public.musharax_musharax_db
            add constraint musharax_gender_check check (m_gender is null or m_gender in ('lab', 'dhadig'));
    end if;

    if not exists (select 1 from pg_constraint where conname = 'musharax_email_format'
                   and conrelid = 'public.musharax_musharax_db'::regclass) then
        alter table public.musharax_musharax_db
            add constraint musharax_email_format check (m_email is null or m_email = '' or m_email ~ '^[^@[:space:]]+@[^@[:space:]]+$');
    end if;

    if not exists (select 1 from pg_constraint where conname = 'musharax_image_url'
                   and conrelid = 'public.musharax_musharax_db'::regclass) then
        alter table public.musharax_musharax_db
            add constraint musharax_image_url check (m_image is null or m_image = '' or m_image ~ '^https?://');
    end if;

    if not exists (select 1 from pg_constraint where conname = 'voiteid_cid_not_blank'
                   and conrelid = 'public.voiteid_id_db'::regclass) then
        alter table public.voiteid_id_db
            add constraint voiteid_cid_not_blank check (btrim(coalesce(c_id, '')) <> '');
    end if;

    if not exists (select 1 from pg_constraint where conname = 'codbixiye_cidid_not_blank'
                   and conrelid = 'public.codbixiye_codbixiye_db'::regclass) then
        alter table public.codbixiye_codbixiye_db
            add constraint codbixiye_cidid_not_blank check (btrim(coalesce(c_id_id, '')) <> '');
    end if;

    if not exists (select 1 from pg_constraint where conname = 'codbixiye_gender_values'
                   and conrelid = 'public.codbixiye_codbixiye_db'::regclass) then
        alter table public.codbixiye_codbixiye_db
            add constraint codbixiye_gender_values check (c_gender is null or c_gender in ('Male', 'Female'));
    end if;
end;
$$;

-- --------------------------------------------------------
-- 11. ADDITIONAL INDEXES for the policies and queries above
-- --------------------------------------------------------
-- (The vote-log indexes already live in supabase/indexes.sql:
--  idx_codbixiye_musharax_id, idx_codbixiye_department_id,
--  idx_codbixiye_c_id_id, idx_voiteid_is_used, idx_musharax_department_id.)
-- NOTE: indexes are created only when the underlying column exists, so this
-- migration also runs against databases created from an older schema that
-- predates the created_at column.
do $$
begin
    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'musharax_musharax_db'
          and column_name = 'm_if_allowed'
    ) then
        create index if not exists musharax_m_if_allowed_idx on public.musharax_musharax_db (m_if_allowed);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'codbixiye_codbixiye_db'
          and column_name = 'created_at'
    ) then
        create index if not exists codbixiye_created_at_idx on public.codbixiye_codbixiye_db (created_at);
    end if;

    if exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'profiles'
          and column_name = 'is_superuser'
    ) then
        create index if not exists profiles_is_superuser_idx on public.profiles (is_superuser);
    end if;
end;
$$;

-- --------------------------------------------------------
-- 12. BOOTSTRAP PROFILES FROM EXISTING AUTH USERS
-- --------------------------------------------------------
-- public.profiles is currently EMPTY. Without this, NOBODY (not even the
-- owner) can use the admin dashboard because is_superuser() returns NULL.
--
-- Existing auth users are imported with is_superuser = FALSE by default.
-- They will NOT be able to log in to the admin app until you promote the
-- correct person(s) (ADMIN PROMOTION section below).
--
-- NOTE: is_superuser in the old code depended on client-supplied
-- (user_metadata) values, so the metadata flag is NOT trusted here.
insert into public.profiles (id, username, email, first_name, last_name, is_superuser, date_joined)
select
    u.id,
    coalesce(u.raw_user_meta_data ->> 'username',
             u.raw_user_meta_data ->> 'first_name',
             split_part(u.email, '@', 1)),
    u.email,
    u.raw_user_meta_data ->> 'first_name',
    u.raw_user_meta_data ->> 'last_name',
    false, -- never auto-grant superuser
    u.created_at
from auth.users u
on conflict (id) do nothing;

-- sanity: only rows whose user really exists
delete from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.id);

COMMIT;

-- ========================================================
-- ADMIN PROMOTION (DO THIS MANUALLY AFTER RUNNING THIS FILE)
-- ========================================================
-- You are the first profile created with is_superuser = FALSE. To unlock
-- the admin dashboard, run ONE of these with YOUR OWN email address:
--
--   update public.profiles
--   set is_superuser = true
--   where email = 'you@example.com';
--
-- Tip: keep the app open on the Dashboard > Manage Admin page to grant
-- more staff accounts afterwards (gui handles it now that profiles exists).
-- Remember: anyone you promote can promote others. Prefer a SMALL admin team.
--
-- Recommended cleanup after this migration:
--   1. Supabase Dashboard > Authentication > Providers: turn OFF
--      "Allow new user sign-ups" so strangers can't create accounts.
--   2. Keep Email confirmation required. Require strong passwords.
--   3. Test the public vote page and the admin pages (docs/SECURITY_TESTING.md).
-- ========================================================