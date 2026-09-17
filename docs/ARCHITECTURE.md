# PUST-Election — System Architecture

This document describes the production architecture of the PUST-Election voting
platform. It is written for developers and operators.

## 1. Overview

PUST-Election is an online voting platform for Puntland State University
student-union elections. Two audiences exist:

- **Voters (public, unauthenticated)** — view candidates, enter a one-time
  voting ID, cast a single vote.
- **Admins (authenticated)** — manage candidates, departments, voting IDs,
  voter audit logs, and other admins.

## 2. Architecture

```
┌───────────────────────────┐
│   Browser (React SPA)     │
│   Vite build artifacts    │
└───────────┬───────────────┘
            │ HTTPS (JSON / REST)
┌───────────▼───────────────┐        ┌────────────────────────┐
│   Supabase                │        │  Storage (bucket       │
│   - PostgREST (Postgres)  │        │  candidate-images)     │
│   - Auth (GoTrue)         │────────│  public images         │
│   - Storage API           │        └────────────────────────┘
│   - RLS policies          │
└───────────────────────────┘
```

The application is **serverless-first**: it relies on Supabase (hosted
PostgreSQL + PostgREST + Auth + Storage). The frontend is a static SPA built
with Vite and hosted on any static host / CDN.

### Architecture layers

| Layer | Where it lives |
|-------|----------------|
| Presentation | `src/pages/*`, `src/components/*` (React) |
| Data access | `src/supabaseClient.js` (thin client) + direct Supabase queries in pages |
| Auth | `src/auth.jsx` (React context wrapping Supabase Auth) |
| Persistence | Supabase Postgres, Postgres RLS, Supabase Storage |
| Notifications | `src/toast.jsx` (local UI toasts) |

> Current simplification: business logic lives inside pages. For a project of
> this size this is acceptable, but the data-access layer should be extracted
> into `src/lib/*` modules if feature count grows (see Scalability path).

## 3. Technology choices & rationale

| Technology | Why |
|-----------|-----|
| React 18 + Vite 6 | Mature component model, fast builds, static deploy |
| Tailwind CSS v4 | Utility-first styling kept in CSS, consistent design system |
| React Router v6 | Declarative routing, nested admin layout |
| Supabase (Postgres + Auth + Storage) | Managed Postgres, built-in auth, REST + RLS, no custom backend to operate |
| Vitest | Fast, Vite-native test runner |

**Deliberately avoided:** a custom Node/Express backend (not needed today —
Supabase covers auth, DB, file storage and authorization), microservices
(overkill), GraphQL (false complexity), and SSR (this app is a private
university portal; SEO matters only for the landing page).

## 4. Data model

See `schema.sql` for authoritative DDL. High level:

- `depadrments_depadrments_db` — departments (`id`, `d_name`).
- `musharax_musharax_db` — candidates (FK `m_depadrments_id` → departments).
- `voiteid_id_db` — one-time voting codes (`c_id` UNIQUE, `is_used`).
- `codbixiye_codbixiye_db` — vote audit rows (FK `c_musharax_id` → candidates
  `ON DELETE CASCADE`, FK `c_department_id` → departments).
- `profiles` — admin metadata, linked to `auth.users`.

Production indexes: `supabase/indexes.sql`.

## 5. Authentication & authorization

- **Auth:** Supabase GoTrue (email/password). Sessions persisted automatically;
  `useAuth()` context provides `user`, `loading`, `login`, `logout`.
- **Admin route guard:** `AdminLayout` redirects unauthenticated users to
  `/dashboard/login` (`<Navigate>`). This is a UX guard, not a security control.
- **Real authorization:** must be enforced server-side. Today tables run with
  RLS **disabled** and full permissive policies so the anon key can operate the
  whole system. For production this must change: apply
  `supabase/rls_hardening.sql` to restrict the anon key to voting operations
  only and authenticated admins to management operations.

## 6. File storage

Candidate images upload to the public bucket `candidate-images` (max 4 MB, PNG/
JPEG/WebP/GIF). Public read, authenticated write/delete. Deleting a candidate
also deletes its stored image (see `Musharax.jsx` `confirmDelete`).

## 7. Scalability strategy

Current expected limits (honest assessment):

- **100 users:** trivial for this stack.
- **10k users / 100k users:** PostgREST + Supabase scale horizontally; the
  bottleneck is Postgres connection quota (read replicas / connection pooling
  via Supabase available).
- **Large vote log:** `codbixiye_codbixiye_db` grows with every vote. Mitigations:
  - `supabase/indexes.sql` indexes for the query patterns used.
  - Pagination already used in VoteId (100/page) and Codbixiye (50/page).
  - Archive old election cycles into separate tables.
- **Statelessness:** the SPA is fully stateless; static assets are cached by a
  CDN. Multiple instances/edge deployments work without changes.
- **Caching opportunities (not yet done):** candidate/department lists can be
  cached client-side or via Supabase's in-built CDN caching once traffic grows.
- **Rate limiting:** Supabase does not rate-limit the anon key by default.
  For abuse protection, enable Supabase's per-project rate limiting or move the
  vote-submit path to a Supabase Edge Function with rate limits.

## 8. Deployment

- **Build:** `npm ci && npm run build` → `dist/`.
- **Host:** any static host (Vercel, Netlify, Cloudflare Pages, S3+CDN).
  SPA fallback to `index.html` must be configured (all routes except static
  assets).
- **Environment:** Vercel/Netlify project env vars from `.env.example` values.
- **CI:** recommended `npm ci → npm test → npm run build → deploy`.
- **Database changes:** run migration SQL (`schema.sql`, `supabase/*.sql`) in
  Supabase SQL Editor before deploy; keep changes backward compatible.
- **Rollback:** redeploy previous `dist/` build (immutable builds).

## 9. Monitoring & observability

- **Build-time only today.** Recommended:
  - Sentry (`@sentry/react`) for frontend error tracking.
  - Supabase dashboard for DB metrics, auth activity, and rate limiting.
  - Uptime monitoring (e.g., UptimeRobot) on the deployed host.
  - Structured logging: log failed Auth/Storage/DB operations server-side;
    never log passwords, tokens, or PII.

## 10. Testing

- Unit tests: `npm test` (Vitest) — currently covers `src/utils.js`.
- Integration/E2E (recommended): Playwright for the voter journey (landing →
  pick candidate → enter valid/unused ID → confirm → success) and admin CRUD.
- Security tests: verify anon key cannot read vote log or upsert codes once
  RLS hardening is applied (`curl`-style REST assertions).

## 11. Assumptions

- One election cycle at a time; historical data may be archived.
- Voters are issued physical/published one-time codes; no email delivery yet.
- Somali is the UI language; English for code/docs.