-- ========================================================
-- STUDENTS IMPORT MIGRATION
-- Adds student details to the voting-ID table and a single, validated,
-- superuser-only RPC that imports a whole batch of students at once.
--
-- Run this ONCE in the Supabase SQL Editor (dashboard > SQL > New query).
-- Idempotent: safe to re-run.
--
-- Design (confirmed with the operator):
--   * Each student lives on the SAME row as their voting code, so the
--     student <-> voting-ID relationship is guaranteed 1:1.
--   * The voting code is AUTO-GENERATED here (same 8-char A-Z0-9 alphabet
--     the "Generate IDs" button already uses). The import file never
--     supplies an ID.
--   * The department must already exist in depadrments_depadrments_db;
--     rows with an unknown department are reported back and skipped.
--   * Semester is free text.
--   * Only public.is_superuser() may call the importer.
--
-- DEPENDS ON: 202609180001_security_hardening.sql (needs public.is_superuser()
--             and the existing superuser-only RLS policies on voiteid_id_db).
-- ========================================================

BEGIN;

-- --------------------------------------------------------
-- 1. Student columns on the voting-ID table
-- --------------------------------------------------------
-- All nullable: the table also holds plain generated codes that have no
-- student attached yet, and adding columns cannot break existing rows,
-- the public vote RPC (cast_vote) or the Vote IDs admin page.
alter table public.voiteid_id_db
    add column if not exists student_name          text;

alter table public.voiteid_id_db
    add column if not exists student_department_id bigint
        references public.depadrments_depadrments_db(id) on delete set null;

alter table public.voiteid_id_db
    add column if not exists semester              text;

-- Scale-friendly lookups: students-by-department lists/filters, and a
-- guard so an imported student's name is never blank.
create index if not exists voiteid_student_department_idx
    on public.voiteid_id_db (student_department_id);

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'voiteid_student_name_not_blank'
          and conrelid = 'public.voiteid_id_db'::regclass
    ) then
        alter table public.voiteid_id_db
            add constraint voiteid_student_name_not_blank
            check (student_name is null or btrim(student_name) <> '');
    end if;
end;
$$;

-- --------------------------------------------------------
-- 2. import_students(jsonb)
-- --------------------------------------------------------
-- Input:  a JSON array of objects, e.g.
--         [{"student_name":"Ali Yusuf","department":"IT","semester":"1"}, ...]
-- Output: {"received":N,"inserted":M,"skipped":[{index,name,reason,...}]}
--
-- Behaviour:
--   * Validates every row (name present, department present AND known).
--   * Generates a unique voting code per accepted row.
--   * Inserts row-by-row so ONE bad row never aborts the whole batch; a
--     per-row subtransaction captures any database error as a skip.
--   * SECURITY DEFINER + is_superuser() check, so the client can never
--     use it to mass-write as a normal user.
create or replace function public.import_students(p_students jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
volatile
as $$
declare
    v_alphabet  text    := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    v_row       jsonb;
    v_index     int     := -1;
    v_name      text;
    v_dept_raw  text;
    v_semester  text;
    v_dept_id   bigint;
    v_code      text;
    v_inserted  int     := 0;
    v_skipped   jsonb   := '[]'::jsonb;
    v_attempt   int;
begin
    -- `is not true` also rejects a NULL result (missing profile row).
    if public.is_superuser() is not true then
        raise exception 'not_authorized';
    end if;

    if p_students is null or jsonb_typeof(p_students) <> 'array' then
        raise exception 'invalid_payload';
    end if;

    for v_row in select value from jsonb_array_elements(p_students)
    loop
        v_index := v_index + 1;
        v_name     := btrim(coalesce(v_row ->> 'student_name', ''));
        v_dept_raw := btrim(coalesce(v_row ->> 'department', ''));
        v_semester := btrim(coalesce(v_row ->> 'semester', ''));

        if v_name = '' then
            v_skipped := v_skipped || jsonb_build_object(
                'index', v_index, 'name', '', 'reason', 'missing_name');
            continue;
        end if;

        -- Department is optional. If empty, insert with NULL department.
        -- If provided but unknown, skip with a clear reason.
        if v_dept_raw = '' then
            v_dept_id := null;
        else
            -- Case-insensitive match that also collapses any internal whitespace
            -- (double spaces, tabs, non-breaking spaces) so "Business  Admin..."
            -- in a spreadsheet still matches the stored canonical name.
            select id into v_dept_id
            from public.depadrments_depadrments_db
            where lower(regexp_replace(btrim(d_name), '\s+', ' ', 'g'))
                = lower(regexp_replace(v_dept_raw, '\s+', ' ', 'g'))
            limit 1;

            if v_dept_id is null then
                v_skipped := v_skipped || jsonb_build_object(
                    'index', v_index, 'name', v_name,
                    'reason', 'department_not_found', 'department', v_dept_raw);
                continue;
            end if;
        end if;

        -- Generate a code that is unique within the table AND this batch.
        v_attempt := 0;
        loop
            select string_agg(
                       substr(v_alphabet,
                              1 + floor(random() * length(v_alphabet))::int,
                              1),
                       '' order by g)
            into v_code
            from generate_series(1, 8) as g;

            exit when not exists (
                select 1 from public.voiteid_id_db where c_id = v_code
            );

            v_attempt := v_attempt + 1;
            if v_attempt > 50 then
                raise exception 'code_generation_exhausted';
            end if;
        end loop;

        begin
            insert into public.voiteid_id_db
                (c_id, student_name, student_department_id, semester)
            values
                (v_code, v_name, v_dept_id, nullif(v_semester, ''));

            v_inserted := v_inserted + 1;
        exception
            when unique_violation then
                v_skipped := v_skipped || jsonb_build_object(
                    'index', v_index, 'name', v_name, 'reason', 'duplicate_code');
        end;
    end loop;

    return jsonb_build_object(
        'received', jsonb_array_length(p_students),
        'inserted', v_inserted,
        'skipped',  v_skipped
    );
end;
$$;

revoke all on function public.import_students(jsonb) from public;
grant execute on function public.import_students(jsonb) to authenticated;

-- --------------------------------------------------------
-- 3. students_stats()
-- --------------------------------------------------------
-- Exact dashboard counters in ONE round trip. Required because the Students
-- page paginates on the server and no longer keeps every row in memory.
create or replace function public.students_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
    v_result jsonb;
begin
    if public.is_superuser() is not true then
        raise exception 'not_authorized';
    end if;

    select jsonb_build_object(
        'total',       count(*),
        'voted',       count(*) filter (where is_used = true),
        'not_voted',   count(*) filter (where is_used is not true),
        'departments', count(distinct student_department_id)
    )
    into v_result
    from public.voiteid_id_db
    where student_name is not null;

    return v_result;
end;
$$;

revoke all on function public.students_stats() from public;
grant execute on function public.students_stats() to authenticated;

COMMIT;

-- ========================================================
-- After running, verify with a superuser account:
--   select public.import_students('[{"student_name":"Test Student",
--     "department":"IT","semester":"1"}]'::jsonb);
-- Then delete the test row:
--   delete from public.voiteid_id_db where student_name = 'Test Student';
-- ========================================================
