# Whisk Takers — Kitchen Control

Separate administration app using the existing Whisk Takers Supabase project.
Includes a protected dashboard, read-only profiles and votes, and manual generation CRUD.

## Run

The existing `.env.local` must contain `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. No service-role key is needed.

```sh
npm install
npm run dev
```

In the existing Supabase project, enable the Google Auth provider if it is not
already enabled. Add `http://localhost:3000/auth/callback` and the exact deployed
app `/auth/callback` URL to Authentication → URL Configuration → Redirect URLs.
Keep the existing application's URLs. Google's provider callback remains the
Supabase Auth callback shown in the Google provider settings.

## Access control

- `/` redirects to `/admin`.
- `/login` starts Google OAuth using the Supabase SSR browser client and PKCE.
- `/auth/callback` exchanges the code using the browser's verifier cookie and
  redirects to the fixed local `/admin` route. Failures return a generic login error.
- Next.js 16 `proxy.ts` refreshes cookie sessions and checks every `/admin` path.
  It validates the user with `auth.getUser()`, then queries
  `public.profiles.is_superadmin` where `profiles.id = user.id` using the user's
  session and existing RLS. Only the literal boolean `true` allows access.
- Logged-out users go to `/login`. False/missing flags, missing profiles, and
  profile query failures go to `/unauthorized`.
- The admin layout, all four admin pages, and all generation mutations call `requireAdmin()` server-side. Future
  protected data functions, Route Handlers, and Server Actions must call this
  helper at their own entry points; layouts alone are insufficient protection.
- Sign-out is a POST Server Action with Next.js origin protection. It ends this
  browser's session without signing out the existing app on other devices.
- Auth responses are private and not cached. No roles come from browser state or
  user-editable metadata. There are no schema changes, SQL migrations, or RLS changes.

The existing schema is expected to associate `profiles.id` with the Auth user ID.
Existing RLS must allow users to read their own profile flag and prevent ordinary
users from granting themselves superadmin status. The app never bypasses RLS;
if it cannot read the flag, access is denied. These existing database policies
have not been inspected or modified by this implementation.

## Verify

```sh
npx next typegen
npx tsc --noEmit
npm run lint
node --test tests/*.test.mjs
npm run build
```

The tests exercise the actual authorization helper with a mocked Supabase
boundary. For live verification, open `/admin` logged out, sign in with a normal
Google account, then separately sign in with an existing superadmin account.
Expect `/login`, `/unauthorized`, and the dashboard respectively.
Also verify sign-out and a subsequent direct request to `/admin`.

## Admin routes

- `/admin`: exact profile count; total generations, votes, likes, boos, and like
  rate; most liked/booed AI generation; recent generations and votes; CSS vote chart.
- `/admin/profiles`: read-only first/last name, HTTPS avatar if available, ID,
  creation time, and superadmin badge; name filter on the current 25-row page.
- `/admin/generations`: paginated records and manual create/update/delete forms.
- `/admin/votes`: paginated read-only votes, Like/Boo labels, user/target IDs,
  resolved `generations.generated_text` or `jokes.text`, and timestamps.

All timestamps are labeled and displayed in America/New_York. Tables scroll on
small screens. Long text expands inline. Every screen has empty/error states;
route loading and error boundaries are provided.

## Generation mutations

Every Server Action calls the unchanged `requireAdmin()` before reading input or
using Supabase. Create accepts prompt and generated text, sets `user_id` to the
verified admin and `created_at` to the current time, and optionally accepts a
positive PostgreSQL bigint ID if there is no existing ID default. Update changes
only prompt and generated text for one ID. Delete requires typing that ID exactly;
no vote deletion is performed in application code. Existing foreign keys decide
whether deletion cascades or is rejected. Successful mutations refresh dashboard,
generation and vote routes. Zero-row mutations never report success.

## Database and RLS limits

The provided schema is used unchanged. No direct `auth.users` access, service-role
key, schema/policy changes, RPCs, AI integration, or additional dependencies exist.
All reads and writes use the existing anonymous public key plus the logged-in
admin's session. SELECT policies may silently filter rows; displayed counts are
explicitly described as the records visible under existing RLS, not independently
verified global database totals.

Dashboard analysis reads generations/votes in explicit batches to avoid the
usual 1,000-row API cap. It stops at 50,000 rows per table and reports statistics
as unavailable rather than displaying partial aggregates. Beyond that size,
server database aggregates would be needed for scalable analysis.

No authenticated superadmin database session was available during implementation,
so live CRUD/policies could not be inspected or verified. The unauthenticated
schema endpoint returned HTTP 401. The user supplied the table definitions.
If a mutation is denied, the app stops and reports its operation and database
error. A `42501` needs the corresponding authenticated-superadmin INSERT, UPDATE,
or DELETE permission/policy on `public.generations`; returned-row checks also
require SELECT. A zero-row update/delete can mean RLS filtering or a missing row,
so the app reports both possibilities rather than claiming an exact policy name.
Policy definitions/names cannot be determined from this client. Foreign-key
failure `23503` is a constraint issue, not an RLS issue. Never bypass these errors.

Before production use, test create, update, and confirmed delete with a real
superadmin session, plus generation deletion with related votes. The automated
tests mock the database boundary; they do not prove deployed RLS permissions.
