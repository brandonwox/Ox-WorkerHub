# Step 7 — Backend Persistence & Scheduled QBT Sync (Deferred)

**Status:** ⛔ **Blocked / deferred.** Do not start until the user provides a
Supabase **Project URL + anon key** and explicitly unblocks the backend. Steps 1–6
deliberately target the in-memory store so the whole app is usable without a
backend. This step maps that store onto Supabase and moves secrets server-side.

**Prerequisites:** Steps 1–6 complete; Supabase project created; keys supplied.

**Read first:** `Step-0-Overview.md`, `docs/supabase-setup.md`,
`docs/quickbooks-time-setup.md`. Also use the **`supabase` skill** for any
Supabase work (auth/RLS/migrations/Edge Functions).

---

## Why this is last

The app currently has **no persistence** — `useAppStore` is in-memory, seeded from
`src/data/mock.ts`; config ships via `app.json → expo.extra`. Supabase was chosen
to provide: email-invite auth, a `workers/jobs/jobcards/crews/timesheets` schema
with RLS by role, and a **scheduled Edge Function** that pushes approved timesheets
to QuickBooks Time. Wiring was parked at the user's request pending keys.

---

## Hard security constraints (non-negotiable)

- **`service_role` key never ships in the app** — only the anon/publishable key.
  Admin actions (worker invites, the QBT push) run in **Edge Functions** with
  server-side secrets.
- The **QBT access token moves out of `app.json`** (where it's client-exposed)
  into an Edge Function secret `QBT_ACCESS_TOKEN`.
- **RLS on every table.** Resolve the caller's role via a `SECURITY DEFINER`
  helper that reads the `workers` table — **never** trust user-editable
  `user_metadata`.
- Expo client deps when wiring auth: `@supabase/supabase-js`, AsyncStorage session
  storage, `react-native-url-polyfill/auto`, deep-link redirect (`oxworkerhub://`).

---

## Schema map (in-memory slice → Postgres table)

| Store collection | Table | Key columns | RLS sketch |
|---|---|---|---|
| `workers[]` | `workers` | id, name, email, phone, role, trade_role, hourly_rate, status | All authed can read names/roles; `hourly_rate` readable only by self + operator; only operator writes role/rate. |
| `jobs[]` | `jobs` | id, name, location, status, qbt_jobcode_id, flashing_material | Operator full write; Field Super may update **only** `flashing_material`; others read. |
| `jobcards[]` | `jobcards` | id, job_id, title, address, date, status, priority, priority_order, flashing_material, materials, scope_of_work, field_notes, details | Field Super insert/update; installers update `status`/`field_notes` for cards assigned to their crew; scheduler reads. |
| `crews[]` | `crews` | id, name | Scheduler write; others read. |
| crew membership | `crew_members` | crew_id, installer_id | Scheduler write; **CHECK/trigger: installer_id must reference a worker with role='installer'.** |
| `dailyCrews[]` | `daily_crews` (+ `daily_crew_members`) | id, date, name (+ members) | Scheduler write. Installers only. |
| `assignments[]` | `schedule_assignments` | id, jobcard_id, crew_id, date | Scheduler write; unique `(jobcard_id, crew_id, date)`. |
| `logs[]` | `timesheets` | id, worker_id, date, jobcard_id, custom_project_name, start_time, end_time, total_hours, earned_amount, send_status (`'unsent' \| 'sent' \| 'failed'`) | Installer inserts own (**no in-app approval gate** — rows start `'unsent'`); operator reads all + may correct times; installer reads own. The weekly sweep stamps each row `'sent'` or `'failed'`; approval happens in QBT. |

Enforce the **installer-only crew** rule in the DB (trigger or FK to a filtered
view), mirroring the store-level filter from Step 2 — defense in depth.

---

## Work items (when unblocked)

1. **Config:** read `app.json → expo.extra.supabase` ({ url, anonKey }) — the slot
   already exists. Create the Supabase client (`src/integrations/supabase/`).
2. **Migrations:** create the tables above with RLS policies + the role helper
   (`SECURITY DEFINER`) + the installer-only crew constraint. Use the CLI under
   `supabase/` (already initialized).
3. **Auth:** email-invite flow — operator "Add worker" calls an `invite-worker`
   Edge Function (server-side `service_role`); worker accepts via deep link;
   `workers.status` flips `invited → active`.
4. **Store swap:** back each Zustand slice with Supabase queries (keep the same
   action signatures from Steps 1–2 so the UI is untouched). Replace `mock.ts`
   seeds with real reads; keep mock as a dev fallback if convenient.
5. **Scheduled QBT push:** an Edge Function on **pg_cron, Mondays 07:30**, that
   bundles every `send_status='unsent'` timesheet, resolves each jobcode via the
   parent Job's `qbt_jobcode_id` (the same precedence as Step 6's
   `resolveJobcodeId`), POSTs to QBT with the `QBT_ACCESS_TOKEN` secret, and stamps
   each row `'sent'` on success or `'failed'` on error. **The payroll manager then
   reviews and approves the pushed hours inside QuickBooks Time** — there is no
   approval step in this app. The client `markTimesheetsSent()` is the in-app
   reflection of a successful sweep, not a user-triggered pusher.

---

## Constraints

- Do **not** begin until keys are provided and the user says go.
- Keep all Step 1–6 action signatures stable so screens don't change.
- No secret beyond the anon key ever reaches the client bundle.

## Definition of Done (when unblocked)

- [ ] Tables + RLS + role helper migrated; installer-only crew enforced in DB.
- [ ] Auth/invite flow works end to end.
- [ ] Store slices read/write Supabase; UI unchanged.
- [ ] Weekly Edge Function pushes all `'unsent'` hours under the parent Job's
      jobcode and stamps `'sent'`/`'failed'`; no in-app approval gate.
- [ ] `service_role` and `QBT_ACCESS_TOKEN` exist only as server secrets.
