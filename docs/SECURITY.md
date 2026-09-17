# PUST-Election — Security Review

This document records implemented controls, reviewed threats, and remaining
risks. It is a living document: update it whenever security-relevant changes
are made.

> We do NOT claim the application is "100% secure", "unhackable", or
> "zero-vulnerability". No real system can guarantee that. What follows is an
> honest list of what is in place and what still needs attention.

## 1. Implemented controls

### Authentication
- Supabase Auth (GoTrue) email/password. Passwords are hashed by Supabase
  (never in our code or DB).
- Username-only login convenience maps to `<username>@pelection.com` (documented
  behavior, not a bypass — login still verifies password).
- Sessions managed by Supabase (JWT); `signOut` invalidates the session.
- No cookies set by our app (token in memory/localStorage by Supabase client).

### Authorization / access control
- Admin SPA routes guarded by `AdminLayout` (redirects to login).
- Superuser-only page (`ManageAdmin`) checks `user.is_superuser` client-side.
- **Server-side enforcement is delegated to Supabase RLS.** This is currently
  the weak point (see Risks): tables have RLS disabled with permissive policies.
  `supabase/rls_hardening.sql` is provided to enable and scope it.

### Input validation
- Forms validate required fields before submit (client-side).
- Voting ID constrained client-side (length, uppercase normalization).
- File uploads: type (`image/*`), size (≤ 4 MB), safe generated filename
  (`candidates/<timestamp>-<random>.<ext>`), stored in Supabase Storage (never
  on the app server), never executed, served read-only.
- Server-side validation is provided by Postgres constraints (NOT NULL, UNIQUE)
  and would be strengthened by RLS policies.

### Data
- No plaintext secrets in code. `.env` ignored; `.env.example` documents vars.
- Vote IDs are stored once-used via `is_used` + UNIQUE `c_id`.
- FK constraints keep referential integrity; candidate delete cascade handled.

### Storage
- Public bucket `candidate-images`; write/delete restricted to authenticated
  admins via storage policies in `schema.sql`.
- Deleting a candidate removes its stored image too.

### Frontend
- React escapes all rendered values (XSS-safe by default — no
  `dangerouslySetInnerHTML`).
- Confirmation dialogs for destructive actions.
- Loading / error / empty states on all data pages.

## 2. Threats reviewed

| Threat | Mitigation |
|--------|-----------|
| SQL injection | PostgREST parameterized queries only; no raw SQL from client |
| XSS | React auto-escaping; no `dangerouslySetInnerHTML` |
| CSRF | Supabase REST uses bearer JWTs, not cookies |
| IDOR / broken access control | **Not fully mitigated** until RLS hardening is applied (see Risks) |
| Brute-force login | Supabase Auth rate limiting; add stronger limits before public launch |
| Malicious file upload | Type/size validation + storage-only policy + safe filenames |
| Path traversal | No server-side file paths involved (object storage) |
| Sensitive data exposure | Anon key is public by design; **all** enforcement must be server-side |
| Open redirects | No external redirect logic in app |

## 3. Remaining risks (must fix before public production launch)

1. **RLS disabled + full anon access (HIGH).** Today the anon key can read
   every table including the full vote log and write any row. The app only
   *uses* a safe subset, but nothing enforces that. Fix: run
   `supabase/rls_hardening.sql`, then verify:
   - anon can `SELECT` departments/candidates, verify + mark-used a voting ID,
     and `INSERT` a vote — but **cannot** read `codbixiye_codbixiye_db`
     or create/edit candidates/codes.
   - authenticated admin can perform all management operations.
2. **No per-endpoint rate limiting (MEDIUM).** The anon key is unthrottled.
   Enable Supabase rate limiting or gate vote submission behind an Edge
   Function with IP + voting-ID rate limits.
3. **Client-side-only superuser check (MEDIUM).** `ManageAdmin`'s superuser
   gate is cosmetic; the DB must reject non-superusers. Add an `is_superuser`
   check enforced via RLS policies (helper function using `auth.jwt()` claims).
4. **No email delivery / verification (LOW-MEDIUM).** Admin creation sends no
   verification/password-reset email today. Document or wire GoTrue mailer.
5. **No dependency scanning (LOW).** Add `npm audit` to CI.
6. **No CSP/security headers configured (LOW).** Add CSP via the static host
   (or emailJS placeholder) and `X-Content-Type-Options: nosniff`.

## 4. Secrets handling rules

- Never commit `.env` (ignored). Use `.env.example` for documentation.
- `VITE_*` vars are public by design (bundled into client JS).
- Service-role keys, DB passwords, and any server-side secret must live in
  Supabase and server-side functions only.
- If a secret is ever committed, rotate it immediately.

## 5. Security checklist (run before each production release)

- [ ] `supabase/rls_hardening.sql` applied and anon/authenticated behavior
      verified via REST
- [ ] `npm audit` clean (or accepted risks documented)
- [ ] No `.env`, keys, or secrets in the repository or build logs
- [ ] Candidate/vote CRUD verified as admin; voter flow verified as anonymous
- [ ] File upload rejects non-images and >4 MB files
- [ ] Delete candidate also removes votes and storage image
- [ ] Session logout invalidates correctly
- [ ] Monitoring/error tracking configured (e.g., Sentry)
- [ ] Host security headers applied (CSP, nosniff, frame-ancestors)