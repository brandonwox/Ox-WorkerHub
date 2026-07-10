# Ox WorkerHub — Project Handoff & Status

**Last updated:** 2026-06-14

This is the "read me to pick the project back up" doc: what's built, how it's wired,
how to run it, what's left, the commands you'll reach for, and the gotchas that will
otherwise bite you. The granular step-by-step log lives in
[`blueprint/Progress.md`](blueprint/Progress.md); the work orders are
`blueprint/Step-*.md`.

---

## 1. Status at a glance

| Area | State |
|---|---|
| Steps 1–6 (domain model + all role UIs) | ✅ Done |
| Step 7a (schema/RLS migration + Supabase client lib) | ✅ Done |
| Step 7b (developer role + auth session → role) | ✅ Done |
| Step 7c (`invite-worker` Edge Function + Add-worker) | ✅ Done |
| Step 7d (store swap — reads + write-through) | ✅ Done |
| **Step 7e (weekly QBT push Edge Function)** | ⏳ **Not started — the only thing left** |

Backend project: Supabase ref **`ovelhjqoeofjqzvsxoar`** (CLI linked). The app runs
on web (Expo static) and native.

---

## 2. The big picture (architecture)

- **One Expo codebase**, two shells split by **form factor** (since 2026-07-09):
  native (iOS/Android) = mobile tabs (`src/app/(mobile)`), web = desktop sidebar
  console (`src/app/(desktop)`) — **every role has a layout in both**. Nav in
  `src/roles.ts` (`MOBILE_NAV` + `DESKTOP_NAV`).
- **State:** a single Zustand store, `src/store/useAppStore.ts`.
- **Backend:** Supabase (Postgres + Auth + Edge Functions). Client lib in
  `src/integrations/supabase/`.
- **Two data modes** (important):
  - **Dev mode** = *not signed in*. You are the **Developer** role on **mock data**
    (`src/data/mock.ts`). The "View as" switcher lets you preview every role. Nothing
    persists.
  - **Real mode** = *signed in*. The store is **hydrated from Supabase**, and every
    change **writes through to the database**. The switcher is hidden (only the
    Developer can impersonate).
- **Roles:** `operator | field_super | scheduler | installer | developer`. The
  `developer` role is special — it's the *only* role allowed to use the dev switcher.

### Identity model (how "who am I" works)
- **base identity** = the real signed-in worker (`authWorker`), or the dev base
  `w-dev` (the Developer) when not signed in.
- **effective identity** = what the UI renders as = the Developer's `viewAsUserId`
  impersonation, else the base. `useCurrentRole()` / `useCurrentWorker()` return the
  *effective* one; `useIsDeveloper()` checks the *base*.

---

## 3. What changed (this build, by area)

- **Domain model:** `Job.flashingMaterial`; Jobcard task fields (`priority`,
  `materials`, `scopeOfWork`, inherited `flashingMaterial`, `fieldNotes`); **Crews**
  (`Crew`, `DailyCrew`, `ScheduleAssignment`) with Daily-overrides-Permanent
  resolution selectors.
- **Role screens:** Field Super dashboard (jobcard creation), Scheduler
  dashboard (crew management + month calendar + backlog + assignment), Installer
  crew-based agenda + jobcard detail (flashing/materials/scope/priority + shared
  field notes), Operator Job-flashing + jobcode-resolution.
- **Timesheets — no in-app approval:** replaced the old `pending→approved→synced`
  review pipeline with `TimesheetSendStatus` (`'unsent' | 'sent' | 'failed'`). A
  fresh log has **no status**; the weekly sweep stamps **"Sent to QBT"** /
  **"Failed to send to QBT"**. The payroll manager approves *inside QuickBooks Time*.
  The Operator's timesheet screen is **read-only**.
- **Developer role:** new role + base/effective identity split; dev switcher gated to
  the developer (was `__DEV__`).
- **Supabase backend (Step 7):**
  - Migration `supabase/migrations/20260614201808_initial_schema.sql` — all tables,
    `app_role` enum, a `private.current_app_role()` SECURITY-DEFINER helper, RLS on
    every table, integrity triggers (installer-only crews, Field-Super-flashing-only,
    installer-status/notes-only, operator-role/rate-only), and explicit GRANTs.
  - Client lib `src/integrations/supabase/` — **lazy** client (`getSupabase()`),
    auth helpers, session bootstrap (`useSupabaseSession` in the root layout),
    `/sign-in` screen + `AuthControl`.
  - `invite-worker` Edge Function (operator-gated email invites).
  - **Store swap:** `data.ts` maps rows↔domain, hydrates on sign-in, and every
    mutating action write-throughs to Supabase (gated to a real, non-Developer
    session).

---

## 4. How to run it

```bash
# Start the dev server (clear cache — needed after editing app.json/config)
npx expo start -c
# then press "w" for web, or use Expo Go / a dev build for native

# Type-check (the project's definition of "no errors"; the team tests features manually)
npx tsc --noEmit
```

- Web opens at the `http://localhost:PORT` shown in the terminal (usually `:8081`).
- **Editing `app.json` requires restarting the dev server** — it's read once at boot.

---

## 5. How to continue — Step 7e (the only step left)

Goal: a scheduled Edge Function `push-timesheets-to-qbt` that runs **weekly
(pg_cron, Mondays 07:30)**, bundles every `send_status='unsent'` timesheet, resolves
each jobcode via the parent Job's `qbt_jobcode_id` (same precedence as Step 6's
`resolveJobcodeId`), POSTs to QuickBooks Time, and stamps each row `'sent'`/`'failed'`.
The QBT token moves out of `app.json` into a **function secret** `QBT_ACCESS_TOKEN`.

Work items when you resume:
1. `supabase functions new push-timesheets-to-qbt` → implement the push + jobcode
   resolution (service role auto-provided; read `QBT_ACCESS_TOKEN` from env).
2. Schedule it with `pg_cron` (a migration that `cron.schedule(...)` calls the
   function) — or Supabase's scheduled-functions config.
3. Secrets: `supabase secrets set QBT_ACCESS_TOKEN=...` and remove the token from
   `app.json` (`expo.extra.quickbooksTime.accessToken`).
4. The client `markTimesheetsSent()` becomes a reflection of what the server did.

Full spec: [`blueprint/Step-7-Backend-Persistence-And-Scheduled-Sync.md`](blueprint/Step-7-Backend-Persistence-And-Scheduled-Sync.md).

---

## 6. Command cheat-sheet

### Expo / app
```bash
npx expo start -c          # start dev server, cache cleared
npx tsc --noEmit           # type-check
```

### Supabase CLI (project is linked to ovelhjqoeofjqzvsxoar)
```bash
supabase db push --linked                       # apply pending migrations to the remote DB
supabase migration new <name>                   # scaffold a new migration file
supabase db advisors --linked --type security   # security lint (fix what it flags)
supabase migration list --linked                # see which migrations are applied

supabase functions deploy invite-worker         # (re)deploy a function
supabase functions list                         # list deployed functions
supabase functions logs invite-worker           # tail a function's logs (great for debugging)
supabase secrets set NAME=value                 # set a server-side function secret
```

> You run all *live* Supabase commands yourself (they touch the real DB/project);
> the agent authors the migration/function files.

---

## 7. Backend admin recipes (you'll need these)

**Email is rate-limited on the free tier** (a few/hour), so for creating test users,
skip the email invite and do it directly:

**Create a user with a known password (no email):**
Dashboard → **Authentication → Add user** → email + password, tick **Auto Confirm
User**. Then add their app row (copy the new user's UUID from the Users list):
```sql
insert into public.workers (id, name, email, role, status)
values ('<user-uuid>', 'Full Name', 'person@ox-glass.com', 'operator', 'active');
-- role: operator | field_super | scheduler | installer | developer
```

**Set/reset a password for an existing user (the dashboard has no field for this):**
```sql
update auth.users
set encrypted_password = crypt('NewPassword123', gen_salt('bf')),
    email_confirmed_at  = coalesce(email_confirmed_at, now())
where email = 'person@ox-glass.com';
```

**Stop the email rate limit altogether:** configure custom **SMTP** in
Authentication → Emails (then invites/recovery use your mail provider, no cap).

**Check what RLS sees / debug a write:** failed write-throughs log
`Supabase write failed: …` in the **browser console** — that line names the table and
policy to fix.

---

## 8. Gotchas & things to remember

- **`app.json` changes need a dev-server restart** (`npx expo start -c`).
- **The Supabase client is lazy on purpose** (`getSupabase()`), constructed on first
  use — never at import. Don't add a top-level `createClient(...)`; static web SSR
  imports the module and would throw `supabaseUrl is required`.
- **Dev mode vs real mode:** not signed in = Developer + mock data + switcher; signed
  in = real DB data + write-through, no switcher. A signed-in **Developer** stays a
  read-only sandbox (the Developer has no RLS write grants — intentional).
- **Writes are fire-and-forget.** The UI updates immediately; if the DB write fails
  (RLS/network) it won't persist and logs to the console. So "it vanished on reload"
  → check the console.
- **RLS requires the signed-in user's role to match the action.** A real operator
  only has operator screens; to test scheduler/Field Super/installer *persistence* you need
  real users with those roles and must sign in as each (only the Developer can
  impersonate, and that path doesn't persist).
- **Secrets:** the **anon key** is in `app.json` and is safe to commit (RLS protects
  data). The **service_role key never goes in the app** — it's auto-provided to Edge
  Functions server-side.
- **`tsconfig.json` excludes `supabase/`** so the Deno Edge Functions (Deno globals,
  `jsr:` imports) aren't type-checked by the app.
- **`invite-worker` has `verify_jwt = false`** (in `supabase/config.toml`) so the
  browser CORS preflight isn't rejected; auth is enforced *inside* the function.
- **Security advisor's "Leaked Password Protection" warning** is optional and
  Pro-plan-gated — safe to ignore on free tier.
- **Run the migration before expecting real data:** `supabase db push --linked`. If
  the tables aren't there, sign-in hydration fails gracefully and stays on mock.

---

## 9. Where things live

| What | Path |
|---|---|
| Domain types | `src/types.ts` |
| Store (state + all actions + selectors) | `src/store/useAppStore.ts` |
| Mock seed data (dev mode) | `src/data/mock.ts` |
| Role nav / labels / home routes | `src/roles.ts` |
| Supabase client / auth / session / invites / data layer | `src/integrations/supabase/` |
| QuickBooks Time integration | `src/integrations/quickbooksTime/` |
| Desktop (web) screens | `src/app/(desktop)/` |
| Mobile tab routes (role-branching) | `src/app/(mobile)/` |
| Mobile screen components | `src/components/mobile/` |
| Jobcard detail | `src/app/job/[id].tsx` |
| Sign-in screen | `src/app/sign-in.tsx` |
| DB schema + RLS | `supabase/migrations/20260614201808_initial_schema.sql` |
| Edge Functions | `supabase/functions/` |
| Blueprint work orders + progress log | `docs/blueprint/` |
| Supabase setup notes | `docs/supabase-setup.md` |
