# PUST-Election — Security Review

This document records implemented controls, reviewed threats, and remaining
risks. It is a living document: update it whenever security-relevant changes
are made.

> We do NOT claim the application is "100% secure", "unhackable", or
> "zero-vulnerability". No real system can guarantee that. What follows is an
> honest list of what is in place and what still needs attention.

## 1. Implemented controls

### Database row-level security (RLS) — applied by migration
`supabase/migrations/202609180001_security_hardening.sql` (run in the Supabase
SQL Editor) enables RLS on **every** table and replaces all old permissive
policies:

| Table | anon (public voter) | authenticated (admin) |
|-------|--------------------|------------------------|
| `depadrments_depadrments_db` | SELECT only | full CRUD — superuser only |
| `musharax_musharax_db` | SELECT where `m_if_allowed = true` | full CRUD — superuser only |
| `voiteid_id_db` | **no access** | full CRUD — superuser only |
| `codbixiye_codbixiye_db` | **no access** | full CRUD — superuser only |
| `profiles` | **no access** | self read/update; admin full |

- No `USING (true) WITH CHECK (true)` write policies remain. No
  `DISABLE ROW LEVEL SECURITY` exists anywhere (`schema.sql` and
  `supabase/rls_hardening.sql` were cleaned — the latter now just points to
  the migration).
- Anonymous table access to `voiteid_id_db`, `codbixiye_codbixiye_db` and
  `profiles` was additionally revoked as defense in depth (privilege).

### Server-authoritative admin flag — `public.is_superuser()`
- SECURITY DEFINER (ignores RLS, reads the protected `profiles` table), so the
  result **cannot** be forged by the client.
- The frontend no longer trusts `user_metadata.is_superuser`. `src/auth.jsx`
  calls `supabase.rpc('is_superuser')`; `AdminLayout` renders a "no access"
  screen (not the dashboard) for anyone who is not superuser.
- Self-promotion is impossible: the profiles `UPDATE`/`INSERT` policies
  re-check the stored flag via `is_superuser()` inside `WITH CHECK`.

### Secure voting — `public.cast_vote()` (the ONLY ballot write path)
- SECURITY DEFINER, `FOR UPDATE` lock on the voting-code row ⇒ two concurrent
  requests on the same code serialize and cannot double-spend it.
- Validates everything server-side in one transaction: code exists, code not
  used, candidate exists, candidate allows votes, department exists, gender
  is `Male`/`Female`.
- Atomically inserts the vote AND consumes the code. Failures return app-level
  codes (`INVALID_VOTING_CODE`, `VOTING_CODE_ALREADY_USED`,
  `INVALID_CANDIDATE`, `CANDIDATE_NOT_ALLOWED`, `INVALID_DEPARTMENT`,
  `DEPARTMENT_MISMATCH`, `INVALID_GENDER`, `VOTE_FAILED`).
- `public.validate_voting_code()` gives voters a safe boolean check ("is my
  ID still usable?") without revealing whether a code exists vs. already used
  (no enumeration oracle).
- `public.lookup_vote_department()` returns `{valid:false}` for an invalid or
  used code (same signal as the boolean check) and, only for a valid code, the
  department the ID was issued for, so the form can pre-select the voter's own
  department. `cast_vote()` independently enforces it: a ballot whose
  department is not the voter's own is rejected with `DEPARTMENT_MISMATCH`
  (legacy IDs with no recorded department keep free choice).

### Storage hardening
- Write/update/delete policies now require `is_superuser()` **and** a path
  inside `candidates/` **and** an image extension (`png/jpg/jpeg/webp`).
- Public read stays (images are static, served read-only from Storage CDN).
- Bucket limits enforced: 4 MB max, MIME allow-list.

### Edge Function rate limiting (optional, recommended)
- `supabase/functions/cast-vote/index.ts` adds a per-IP sliding-window rate
  limit (10 votes/min) in front of `cast_vote()`.
- Client uses it when `VITE_CAST_VOTE_URL` is set; otherwise it falls back to
  the RPC (still secure, just without the IP throttle).

### Security headers (static host)
Recommended (apply on whichever host serves the build): CSP,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`,
`X-Frame-Options: DENY`, and a `Permissions-Policy` that disables
geolocation/camera/mic/payment/usb. The CSP allow-lists only: `'self'`,
Google Fonts, the Font Awesome CDN, and the Supabase API + Realtime wss.
Also configure an SPA fallback to `index.html` so client-side routes
(`/login`, `/vote`, `/candidate`, `/dashboard/*`) do not 404 on refresh.

### Data constraints & indexes
CHECK constraints that match existing production data (candidate gender in
`lab`/`dhadig`, vote gender in `Male`/`Female`, non-blank names/IDs, image
URL format), plus indexes for the policy-heavy query paths.

### Candidate portal (own-results isolation)
- Candidates sign in at `/login` and are shown **only their own** data at
  `/candidate`. Isolation is enforced by RLS policies from
  `supabase/migrations/202609260001_candidate_portal.sql`:
  - `musharax_select_own` — a candidate can SELECT only the candidate row
    where `auth_id = auth.uid()`.
  - `codbixiye_select_own` — a candidate can SELECT only votes where
    `c_musharax_id` equals their own candidate id.
  - No insert/update/delete grants to `authenticated` on these tables beyond
    what admins hold — even a candidate's own row is read-only client-side
    (edits happen through the admin dashboard).
- Login accounts are created/reset by the Edge Function
  `supabase/functions/create-candidate-user/index.ts` with the **service
  role**, never from the client. The function verifies the caller is a
  superuser (via `profiles.is_superuser`) before acting; it also sets
  `email_confirm = true` so candidates need no confirmation email.
- The service role key is an Edge Function environment variable only — it is
  never shipped to the browser.

### Profiles bootstrap
`public.profiles` was empty (0 rows) — the migration imports existing
`auth.users` with `is_superuser = FALSE` so NOBODY is director-level by
default. The owner must promote the correct account manually (see migration
footer / checklist).

## 2. Threats reviewed

| Threat | Mitigation |
|--------|-----------|
| SQL injection | PostgREST parameterized queries; RPCs use parameterized PL/pgSQL |
| XSS | React auto-escaping; no `dangerouslySetInnerHTML` |
| CSRF | Supabase REST uses bearer JWTs, not cookies |
| IDOR / broken access control | RLS on every table; anon can only SELECT public lists + cast via RPC |
| Brute-force voting-ID abuse | `cast_vote` validates + marks-used server-side; optional edge rate limit |
| Vote double-spending | `FOR UPDATE` row lock + `is_used` consumed atomically in `cast_vote` |
| Privilege escalation (self → admin) | Profiles policies + `is_superuser()` re-check; client metadata ignored |
| Malicious file upload | Superuser-only write policy + path/folder check + extension allow-list + 4 MB limit |
| Path traversal | Object storage, no server-side file paths |
| Sensitive data exposure | Sensitive tables have **no** anon grants/policies |
| Open redirects | No external redirect logic in app |

## 3. Remaining risks / human actions required (important)

1. **Run the migration (HIGH, manual).** You MUST paste
   `supabase/migrations/202609180001_security_hardening.sql` into the Supabase
   SQL Editor and run it. Until then RLS is still disabled and the anon key
   can read everything.
2. **Promote YOUR admin account (HIGH, manual).** After the migration, run:
   ```sql
   update public.profiles set is_superuser = true where email = 'YOUR_EMAIL';
   ```
   Everyone else stays non-superuser. Prefer a SMALL admin team — anyone you
   promote can promote others.
3. **Turn OFF open sign-ups (MEDIUM, manual).** Supabase Dashboard →
   Authentication → Providers → *Allow new user sign-ups* OFF. Otherwise
   strangers can create accounts (they still can't self-promote, but it
   removes the noise).
4. **Edge Function is per-isolate, best-effort (LOW).** The in-memory IP
   limiter resets on cold starts. For hardened production, back it with a KV
   store. This is a targeted vote-abuse control; RLS/RPCs already prevent
   invalid/duplicate votes.
5. **No email verification/confirmation wired (LOW-MEDIUM).** Admin creation
   sends no verification/password-reset email. Consider enabling the Supabase
   SMTP mailer before launch.
6. **Dependency scanning (LOW).** `npm run audit`. Current state after
   `npm audit fix`: the high-severity `nanoid` finding is fixed
   (react-router-dom 6.30.4 → 6.30.6). Two **moderate** react-router
   advisories remain with no 6.x patch (only a breaking v7 upgrade). We accept
   them because (a) the "open redirect via backslash" vector requires a
   user-supplied destination, and every `Link`/`useNavigate` in this app is a
   hardcoded internal path; (b) the `deserializeErrors()` constructor-injection
   advisory only affects SSR hydration, and this app is a client-only SPA.
   Optional: `npm audit fix --force` (upgrades to react-router-dom v7 — test
   thoroughly before shipping).
7. **No 100% guarantee.** As stated above, no system is "unhackable".

## 4. Secrets handling rules

- Never commit `.env` (ignored). Use `.env.example` for documentation.
- `VITE_*` vars are public by design (bundled into client JS).
- Service-role keys, DB passwords, and any server-side secret must live in
  Supabase and server-side functions only.
- If a secret is ever committed, rotate it immediately.

## 5. Deployment notes

- Build: `npm run build` → static `dist/`.
- Host the `dist/` folder on any static host; configure the SPA fallback to
  `index.html` and the security headers (see "Security headers" above) on that
  host.
- Set env vars on the host: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  (and optionally `VITE_CAST_VOTE_URL`, `VITE_SUPABASE_FUNCTIONS_BASE`).

## 6. Security checklist (run before each production release)

- [ ] Migration `202609180001_security_hardening.sql` applied; verify with the
      REST checks in `docs/SECURITY_TESTING.md`
- [ ] Exactly the intended admins are `is_superuser = true` (`profiles` table)
- [ ] Open sign-ups disabled in Supabase Auth settings
- [ ] `npm run audit` clean (or accepted risks documented)
- [ ] No `.env`, keys, or secrets in the repository or build logs
- [ ] Candidate/vote CRUD verified as admin; voter flow verified as anonymous
- [ ] File upload rejects non-images and >4 MB files
- [ ] Delete candidate also removes votes and storage image
- [ ] Anon key cannot read `voiteid_id_db`, `codbixiye_codbixiye_db`, `profiles`
- [ ] Same vote ID twice ⇒ second attempt correctly rejected
- [ ] Session logout invalidates correctly
- [ ] Security headers present on production responses (CSP, nosniff,
      frame-ancestors)
- [ ] Monitoring/error tracking configured (e.g., Sentry), if desired