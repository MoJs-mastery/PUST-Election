# PUST-Election

A university student-union election web app for **PUST (Puntland University of Science & Technology)**. Voters enter a one-time voting ID code and cast a vote for a candidate in their department. Administrators manage candidates, departments, voting ID codes, voter audit logs, and other admins — all powered by a Supabase backend.

## Features

### Public
- **Landing page** — hero section with quick navigation to voting and admin login.
- **Voting page (`/vote`)** — lists all *allowed* candidates. A blocked candidate (`m_if_allowed = false`) is hidden automatically.
  - Vote modal: choose a candidate, type your 8-character voting ID, pick your department and gender, confirm, and your vote is recorded.
  - Voting ID codes are verified against the database and flagged as **used**, so each code can only vote once.
  - Success screen with a "Done" (transaction) transition back to landing.

### Admin (`/dashboard`)
- **Dashboard** — overview stats: total candidates, departments, voter records, and recent/active votes.
- **Musharax (Candidates)** — add, edit, block/unblock, and delete candidates. Each candidate belongs to a department and has a name, optional image, email, and gender.
- **Voiteid (Voting IDs)** — generate bulk voting ID codes, search, filter by used/unused, export to CSV, and delete codes.
- **Codbixiye (Voter Audit)** — read-only log of every cast vote with the voting ID, candidate, department, and gender.
- **Departments (Waaxaha)** — add/edit/delete university departments; each department shows its vote count.
- **Manage Admin** — superuser-only page to create/edit/remove admin accounts and assign superuser rights.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI framework | React 18 (function components + hooks) |
| Build tool | Vite 6 |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite`), custom CSS with `@apply` |
| Routing | React Router v6 (`react-router-dom`) |
| Backend / DB | Supabase (Postgres + REST client `@supabase/supabase-js`) |
| Icons | Font Awesome 6 (CDN icons, `fa-solid` / `fa-regular`) |
| Language | JavaScript (JSX) |

## Project Structure

```
src/
├── main.jsx                  # React root + browser router
├── App.jsx                   # Route definitions
├── supabaseClient.js         # Supabase client (URL + anon key from env)
├── auth.jsx                  # AuthContext: login / logout / session state
├── toast.jsx                 # ToastContext: success/error/warning/info popups
├── utils.js                  # date formatters + gender label map
├── index.css                 # global styles, theme variables, components, media queries
├── components/
│   ├── AdminLayout.jsx       # Admin shell: sidebar nav + top header
│   ├── CustomSelect.jsx      # Reusable dropdown (used in forms)
│   ├── ConfirmDeleteModal.jsx# Shared delete-confirmation dialog
│   └── Pager.jsx             # Pagination control for long tables
└── pages/
    ├── Landing.jsx           # Public landing page
    ├── Voting.jsx            # Public voting experience (3-step modal flow)
    ├── Login.jsx             # Admin login
    ├── Dashboard.jsx         # Admin overview/stats
    ├── Musharax.jsx          # Candidates CRUD
    ├── VoteId.jsx            # Voting ID generation + management
    ├── Codbixiye.jsx         # Voters audit log
    ├── Departments.jsx       # Department management
    ├── ManageAdmin.jsx       # Admin account management (superuser)
    └── NotFound.jsx          # 404 page
```

## Routing

| Route | Page | Access |
|-------|------|--------|
| `/` | Landing | Public |
| `/vote` | Voting | Public |
| `/login` | Candidate login | Public |
| `/login/admin` | Admin login | Public (redirects `/dashboard/login` here) |
| `/candidate` | Candidate portal (own results) | Signed-in candidate |
| `/dashboard` | Dashboard | Admin |
| `/dashboard/musharax` | Candidates | Admin |
| `/dashboard/voiteid` | Voting IDs | Admin |
| `/dashboard/codbixiye` | Voter audit | Admin |
| `/dashboard/departments` | Departments | Admin |
| `/dashboard/manageadmin` | Manage admins | Superuser only |
| `*` | 404 | Public |

## Database Schema (Supabase)

The `schema.sql` file in the repo root matches the live database schema. Tables:

- **`depadrments_depadrments_db`** — departments. Columns: `id`, `d_name`.
- **`musharax_musharax_db`** — candidates. Columns: `id`, `m_name`, `m_email`, `m_gender`, `m_depadrments_id` (FK → departments), `m_if_allowed` (block/allow), `m_joined` (creation time, required), `m_image`, `m_username`, `auth_id` (FK → `auth.users`, links a candidate to their login account; added by the candidate-portal migration).
- **`voiteid_id_db`** — one-time voting codes. Columns: `id`, `c_id` (unique code), `is_used`, `c_created_at`.
- **`codbixiye_codbixiye_db`** — vote audit rows. Columns: `id`, `c_id_id` (the voting ID used), `c_musharax_id` (FK → candidates), `c_department_id` (FK → departments), `c_gender`.
- **`profiles`** — admin metadata (used by Manage Admin, populated via Supabase Auth).

> Important: column names are intentionally non-standard (e.g. `m_depadrments_id`, `c_id_id`) — the app code and `schema.sql` must stay in sync with them.

## How a Vote Works (end to end)

1. Admin generates voting ID codes on **Voiteid** (inserted into `voiteid_id_db`, `is_used = false`).
2. Voter opens `/vote` and clicks **Codeeh** on a candidate.
3. Voter enters their voting ID in the modal. The app calls the `validate_voting_code` RPC (returns a safe boolean — a code that is invalid **or** already used both come back `false`).
4. Voter selects department and gender, then clicks **Continue**.
5. The confirm dialog shows the chosen candidate. Confirming calls the `cast_vote` RPC, which server-side locks the voting-code row (`FOR UPDATE`), validates the code/candidate/department/gender, and **in one transaction** inserts the ballot into `codbixiye_codbixiye_db` and marks the code used in `voiteid_id_db`. A duplicate/concurrent submit on the same code is rejected.
6. The success screen is shown, then **Done** returns to the landing page.

## Authentication

- Login: `supabase.auth.signInWithPassword`. Entering just a username is allowed — it is converted to `<username>@pelection.com` internally.
- Session is persisted automatically by Supabase (`getSession` + `onAuthStateChange`).
- Logout calls `supabase.auth.signOut()`.
- `is_superuser` comes from the server (`supabase.rpc('is_superuser')`, a SECURITY DEFINER helper) — never from client metadata. Non-superusers get a "no access" screen inside `/dashboard`.
- **Candidate portal**: admins give candidates an email + password on the **Musharax** page (Add/Edit candidate). The candidate then logs in at `/login` and sees **only their own** results at `/candidate` (total votes, male/female split, per-department breakdown). RLS isolates this via the `musharax_select_own` / `codbixiye_select_own` policies in `supabase/migrations/202609260001_candidate_portal.sql`. The account is created with the `create-candidate-user` Edge Function (service role); if that function is not deployed, the page falls back to `supabase.auth.signUp` for local dev.

## Setup & Run Locally

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in the root:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` belong in the client
   bundle. If you need bootstrap admin credentials for a server-side setup
   script, use **non-prefixed** names (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) — any
   `VITE_*` variable is inlined into public JavaScript at build time and is
   readable by every visitor. Admin logins are managed through Supabase Auth,
   not through the client.
3. Create the tables with the schema from `schema.sql` (run it in the Supabase SQL editor), then run the **hardening migration** `supabase/migrations/202609180001_security_hardening.sql` (enables RLS + secure voting RPCs), then the **candidate portal migration** `supabase/migrations/202609260001_candidate_portal.sql`, and enable Supabase Auth. See `docs/SECURITY_TESTING.md` for the checks to run afterwards.
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Production build:
   ```bash
   npm run build
   npm run preview
   ```

## Notes & Gotchas

- **Blocked candidates** are hidden from the public voting page (`m_if_allowed !== false`).
- The **`m_joined`** column is `NOT NULL` in the live database with no default, so candidate creation must always send it (the app sends `new Date().toISOString()`). To make the database more forgiving, run:
  ```sql
  ALTER TABLE public.musharax_musharax_db ALTER COLUMN m_joined SET DEFAULT NOW();
  ```
- **Foreign key** `codbixiye_codbixiye_db_c_musharax_id_fkey` was `RESTRICT` in a live DB created before `schema.sql`; the app now deletes a candidate's votes before the candidate, and `schema.sql` includes the ALTER to make it `ON DELETE CASCADE`.
- **Candidate images** upload to the public Supabase Storage bucket `candidate-images` (max 4 MB). The bucket + policies are created by `schema.sql`. Deleting a candidate also deletes its uploaded image.
- Voting IDs are normalized to uppercase (`toUpperCase()`) before verification and insertion.
- All user-facing text is in **Somali**; the code/comments are in English.

## Development Commands

```bash
npm install          # install dependencies
npm run dev          # start Vite dev server (http://localhost:5173)
npm run build        # production build into dist/
npm run preview      # preview the production build
npm test             # run Vitest unit tests once
npm run test:watch   # run tests in watch mode
```

## Database & Production SQL

> **Security is applied in two steps**: `schema.sql` creates the tables and the
> storage bucket; then **`supabase/migrations/202609180001_security_hardening.sql`**
> MUST be run — it enables RLS on every table, creates the secure RPCs
> (`cast_vote`, `validate_voting_code`, `is_superuser`), superuser-gated storage
> policies, constraints, indexes, and bootstraps `profiles` from `auth.users`.

| File | Purpose |
|------|---------|
| `schema.sql` | Tables + storage bucket + FK CASCADE fix (no RLS statements) |
| `supabase/migrations/202609180001_security_hardening.sql` | **Required**: RLS on all tables, secure voting RPCs, superuser checks, storage hardening, constraints, profiles bootstrap |
| `supabase/migrations/202609260001_candidate_portal.sql` | **Required for candidate login**: `auth_id` column on candidates + own-data SELECT policies |
| `supabase/indexes.sql` | Production indexes for the vote log and hot tables |
| `supabase/rls_hardening.sql` | Superseded (warns + points to the migration) |
| `supabase/functions/cast-vote/index.ts` | Optional Edge Function for IP rate-limited voting |
| `supabase/functions/create-candidate-user/index.ts` | Edge Function (service role) that creates/resets candidate login accounts |

## Production Readiness Checklist

| # | Item | Status |
|---|------|--------|
| 1 | Auth (Supabase) works | Done |
| 2 | Admin routes guarded | Done (UX; RLS is the real control) |
| 3 | Passwords hashed (Supabase) | Done |
| 4 | Secrets not in repo (`.env` ignored, `.env.example` provided) | Done |
| 5 | Input validation (forms, voting ID, file type/size) | Done |
| 6 | File upload security (Storage, 4MB, safe names, image-only) | Done |
| 7 | Database indexes | `supabase/indexes.sql` ready |
| 8 | Pagination on large tables (VoteId, Codbixiye) | Done |
| 9 | Error / loading / empty states | Done |
| 10 | Confirmation on destructive actions | Done |
| 11 | Responsive UI | Done |
| 12 | SEO meta (title, description, OG) | Done |
| 13 | RLS enabled, anon scoped to voting | **Pending — run `supabase/migrations/202609180001_security_hardening.sql` in Supabase** |
| 14 | Server-authoritative admin check (`is_superuser` RPC) | Code done; live after migration + promote your account |
| 15 | Rate limiting / abuse protection | Edge Function ready — deploy + set `VITE_CAST_VOTE_URL` |
| 16 | Security headers (CSP, nosniff, frame-ancestors) | **Pending — apply on the hosting provider** |
| 17 | Candidate portal (login + own results) | Code done; **pending** — run `202609260001_candidate_portal.sql`, deploy `create-candidate-user`, set `VITE_SUPABASE_FUNCTIONS_BASE` |
| 18 | E2E tests | **Pending — Playwright recommended** |
| 19 | Monitoring / error tracking | **Pending — Sentry + uptime checks recommended** |
| 20 | Backup strategy documented | **Pending — enable Supabase PITR / daily backups** |

## Docs

- `docs/ARCHITECTURE.md` — system architecture, stack rationale, scalability, deployment, monitoring.
- `docs/SECURITY.md` — security controls, threat review, remaining risks, pre-release checklist.
- `docs/SECURITY_TESTING.md` — step-by-step security checks to run after the migration.