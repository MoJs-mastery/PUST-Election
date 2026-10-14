-- ========================================================
-- 202610140001_vote_department_lock.sql
-- Restrict each student to voting under THEIR OWN department.
-- --------------------------------------------------------
-- Depends on: 202610130001_students_import.sql
--   (adds voiteid_id_db.student_department_id)
--
-- This migration is defensive: it never references the
-- student_department_id column by name in a way that would
-- error if the import migration has NOT been run. Every read
-- goes through to_jsonb(...) so a missing column is simply
-- treated as "no department recorded" (legacy behavior).
--
--   1. lookup_vote_department() - returns the department the
--      voting code was issued for (only for a valid + unused
--      code, so it leaks nothing beyond the existing boolean).
--   2. cast_vote()             - rejects a ballot whose chosen
--      department differs from the voter's own department.
-- ========================================================

-- --------------------------------------------------------
-- 1. LOOKUP THE VOTER'S OWN DEPARTMENT
-- --------------------------------------------------------
-- Returns:
--   {"valid": false}                                   -> bad/used code
--   {"valid": true, "department_id": null, "department_name": null}
--                                                      -> valid, no dept set
--   {"valid": true, "department_id": 3, "department_name": "..."}
--                                                      -> valid, dept known
create or replace function public.lookup_vote_department(
    p_voting_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_json    jsonb;
    v_dept_id bigint;
    v_name    text;
begin
    select to_jsonb(v) into v_json
    from public.voiteid_id_db v
    where v.c_id = upper(btrim(coalesce(p_voting_code, '')));

    -- Not found, or already used -> indistinguishable, both invalid.
    if v_json is null or (v_json->>'is_used')::boolean is true then
        return jsonb_build_object('valid', false);
    end if;

    v_dept_id := nullif(v_json->>'student_department_id', '')::bigint;

    if v_dept_id is not null then
        select d_name into v_name
        from public.depadrments_depadrments_db
        where id = v_dept_id;
    end if;

    return jsonb_build_object(
        'valid', true,
        'department_id', v_dept_id,
        'department_name', v_name
    );
exception
    when others then
        return jsonb_build_object('valid', false);
end;
$$;

revoke all on function public.lookup_vote_department(text) from public;
grant execute on function public.lookup_vote_department(text) to anon, authenticated;

-- --------------------------------------------------------
-- 2. cast_vote() - ENFORCE THE VOTER'S OWN DEPARTMENT
-- --------------------------------------------------------
-- Identical to the hardened version, plus one guard: if the
-- voting row has a student_department_id and the ballot's
-- p_department_id differs, the vote is refused with
-- DEPARTMENT_MISMATCH. Legacy codes (no student_department_id)
-- keep the old free-choice behavior.
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
    t_code      text := upper(btrim(coalesce(p_voting_code, '')));
    t_gender    text := initcap(lower(btrim(coalesce(p_gender, ''))));
    v_cand      record;
    v_vote      record;
    v_vote_json jsonb;
    v_own_dept  bigint;
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

    v_vote_json := to_jsonb(v_vote);

    if (v_vote_json->>'is_used')::boolean is true then
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

    -- NEW GUARD: a student may only vote under their own recorded department.
    -- Read via jsonb so a missing column (import migration not run) -> null.
    v_own_dept := nullif(v_vote_json->>'student_department_id', '')::bigint;

    if v_own_dept is not null and p_department_id <> v_own_dept then
        return 'DEPARTMENT_MISMATCH';
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
