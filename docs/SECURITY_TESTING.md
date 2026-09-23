# PUST-Election — Security Test Checklist

Run these AFTER applying `supabase/migrations/202609180001_security_hardening.sql`
and promoting your admin account (see `docs/SECURITY.md` section 3).

You can run the raw SQL probes below in the Supabase SQL Editor, or reproduce
the same checks through the app / a REST client. The intent is: **the anon key
must NOT read or write sensitive tables, and votes must only flow through the
RPCs.**

## 1. Admin promotion sanity check

```sql
select email, is_superuser from public.profiles order by is_superuser desc;
```
Expected: exactly the intended admins show `true`.

## 2. RLS actually enabled

```sql
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relname in ('profiles', 'voiteid_id_db', 'codbixiye_codbixiye_db',
                  'musharax_musharax_db', 'depadrments_depadrments_db');
```
Expected: `relrowsecurity = true` for all five.

## 3. Anon key can NOT read sensitive tables

In the browser console (public site, no login) or via REST with the anon key:

```js
await supabase.from('voiteid_id_db').select('*')        // expect error / 0 rows
await supabase.from('codbixiye_codbixiye_db').select('*')
await supabase.from('profiles').select('*')
```
Expected: all three **fail** (RLS blocks / privilege denied). A wrong result
(= rows returned) means the migration was not fully applied.

## 4. Anon key CAN read the public vote lists

```js
await supabase.from('depadrments_depadrments_db').select('*')
await supabase.from('musharax_musharax_db').select('*')
```
Expected: departments and only candidates with `m_if_allowed = true`.

## 5. Voter flow (public, anonymous)

1. Open the vote page, type a real, unused Vote ID → the ID verifies green.
2. Complete candidate + department + gender and submit → success screen.
3. Go back and try the SAME Vote ID again → rejected
   ("Vote ID-gaas horay ayaa loo isticmaalay").
4. Type a random/gibberish ID → rejected as invalid.
5. Confirm in Supabase:
   ```sql
   select c_id, is_used from public.voiteid_id_db where c_id = 'THE_ID_USED';
   select * from public.codbixiye_codbixiye_db where c_id_id = 'THE_ID_USED';
   ```
   Expected: one row in `codbixiye`, and `is_used = true`.

## 6. Direct table write attempts are rejected for anon

```js
await supabase.from('codbixiye_codbixiye_db').insert({ c_id_id: 'X', c_musharax_id: 1 })
await supabase.from('voiteid_id_db').update({ is_used: true }).eq('c_id', 'ANY')
```
Expected: both **fail** — inserting a vote / consuming a code directly is only
possible through `cast_vote`.

## 7. Admin flow (logged in, superuser)

- Dashboard opens; totals load.
- Musharax: add / edit / delete a candidate; candidate image uploads and the
  stored file is under `candidates/`. Deleting a candidate removes its votes
  and image.
- VoteID: generate/create codes; delete a code.
- Codbixiye: list / search / delete a vote record.
- Departments: add / edit / delete a department.
- ManageAdmin: add an account (non-superuser by default), confirm that account
  CANNOT open the dashboard (sees the "Ma ogola" screen).
- Log out entirely → `/dashboard` requires login again.

## 8. Non-superuser account has no admin power

Log in with a normal (non-superuser) account:
- `/dashboard` shows the "no access" screen (not the menu).
- REST as that user to `codbixiye_codbixiye_db` / `voiteid_id_db` returns
  nothing.
- Trying to set `is_superuser = true` on your own `profiles` row fails.

## 9. Storage checks

- Upload a non-image (e.g. a `.txt` renamed to look like an image) → rejected.
- Upload an image bigger than 4 MB → rejected.
- Confirm your candidate image URL loads publicly.

## 10. Double-vote race (stress) — optional

Fire 2 concurrent submissions with the same Vote ID (two tabs / two users).
Expected: exactly ONE vote recorded; the RPC's `FOR UPDATE` lock serializes
them.

## 11. Headers on production

In DevTools → Network → document response:
- `Content-Security-Policy` present
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy` present

## 12. Dependencies

```bash
npm run audit
```
Address or document any findings before launch.