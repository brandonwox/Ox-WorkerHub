# Blueprint Progress Tracker

> **Living status doc.** Updated whenever any step has had work done on it. For
> each step it records what's **done** and what's **still to do**. Read
> `Step-0-Overview.md` for the shared vocabulary and conventions; read the
> matching `Step-N-*.md` for the full work order.

**Last updated:** 2026-06-14

---

## Status at a glance

| Step | Title | Status |
|---|---|---|
| 0 | Overview & conventions | 📘 Reference (not a build step) |
| 1 | Domain Model Foundation | ✅ Done |
| 2 | Crews & Scheduling Data Model | ✅ Done |
| 3 | Project Manager Dashboard | ✅ Done |
| 4 | Scheduler Dashboard | ✅ Done |
| 5 | Installer Crew Agenda | ✅ Done |
| 6 | Operator Gap-Closure & Financial Sync | ✅ Done |
| 7 | Backend Persistence & Scheduled Sync | 🟡 In progress (7a foundation done) |

Legend: ✅ done · 🟡 in progress · ⬜ not started · ⛔ blocked · 📘 reference

---

## Step 1 — Domain Model Foundation ✅

**Done**
- `JobcardPriority = 'Low' | 'Medium' | 'High'` and `Job.flashingMaterial?` added
  to `src/types.ts`.
- `Jobcard` extended with `priority`, `flashingMaterial?` (snapshot), `materials?`,
  `scopeOfWork?`, `fieldNotes?`.
- Store: `addJobcard` (snapshots parent-Job flashing on create), `updateJobcard`,
  `updateJobcardNotes`, `nextJobcardId` counter.
- Seeds: flashing on `job-1`/`job-2`; priority on every card; `materials`/
  `scopeOfWork` on a few; map injects inherited flashing snapshot.

**To do** — none.

---

## Step 2 — Crews & Scheduling Data Model ✅

**Done**
- Types: `Crew`, `DailyCrew`, `ScheduleAssignment` in `src/types.ts`.
- Store: `crews` / `dailyCrews` / `assignments` collections; `addCrew`/
  `updateCrew`/`removeCrew`, `addDailyCrew`/`updateDailyCrew`/`removeDailyCrew`,
  `assignJobcard` (idempotent on `(jobcard, crew, date)`), `unassignJobcard`;
  installer-only enforcement via `onlyInstallerIds`; counters added.
- Selectors: `activeCrewIdFor` (Daily overrides Permanent), `jobcardIdsForCrewOnDate`,
  `jobcardsForInstallerOnDate`.
- Seeds: Crew Alpha `[Marcus, Tyler]`, Crew Bravo `[Sofia]`; assignments place all
  seeded cards on Crew Alpha; a day+2 "Punch List Crew" Daily Crew exercises the
  override (Marcus still sees `j-7`).

**To do** — none.

---

## Step 3 — Project Manager Dashboard ✅

**Done**
- `src/app/(desktop)/pm.tsx` rebuilt (placeholder replaced): role-gated to
  `project_manager`; header with "N jobcards · M unassigned" + "Create jobcard".
- Section A — active Jobs table with inline-editable `flashingMaterial`
  (commit-on-blur → `updateJob`); nothing else on the Job is editable.
- Section B — jobcards backlog (newest first): title, parent Job name, priority
  badge, and a derived **Assigned / Unassigned** indicator (unassigned = no row
  in `assignments`).
- `src/components/desktop/CreateJobcardModal.tsx` (new): parent-Job select,
  read-only inherited-flashing preview, optional title (defaults to
  `<Job> — Jobcard`), priority (default Medium), materials, scope, scheduled date
  (YYYY-MM-DD, defaults today). `addJobcard` snapshots flashing — the form never
  passes it.

**To do** — none.

---

## Step 4 — Scheduler Dashboard ✅

**Done**
- `src/app/(desktop)/schedule.tsx` rebuilt (placeholder replaced): role-gated to
  `scheduler`; top toolbar with a **crew toggle** (`InlineSelect`) + "Manage
  crews"; split-screen body — calendar (flex 2) beside backlog (flex 1).
- `src/components/desktop/scheduler/MonthCalendar.tsx` (new): month grid via
  `date-fns`, prev/next nav, per-day cards for the viewed crew, "×" to
  `unassignJobcard`, **Daily-override chips** + **double-booked warning** day
  highlighting, click-to-assign in placing mode.
- `src/components/desktop/scheduler/Backlog.tsx` (new): unassigned jobcards
  (derived — no `assignments` row), priority badge + flashing/materials hint;
  tap selects a card into "placing" mode.
- `src/components/desktop/scheduler/ManageCrewsModal.tsx` (new): permanent + daily
  crew CRUD with an **installer-only** chip picker (`role === 'installer'`).
- Assignment writes `ScheduleAssignment` rows (idempotent); a card with ≥1
  assignment leaves the backlog automatically; the same card can go to multiple
  crews without duplicating the record.

**To do** — none. (Drag-and-drop was specced as an optional enhancement over the
required click-to-assign baseline; baseline implemented, DnD not added.)

---

## Step 5 — Installer Crew Agenda ✅

**Done**
- `src/app/(installer)/index.tsx` — agenda now driven by **crew resolution**
  (`jobcardsForInstallerOnDate`) instead of the temporary `assignedInstallerId`;
  week-ribbon dots driven by a new `assignedDatesForInstaller` selector (Daily
  Crew overrides Permanent per date). Clock-in/out and timesheets untouched.
- `src/store/useAppStore.ts` — added `assignedDatesForInstaller` selector.
- `src/components/JobCard.tsx` — compact priority pill + flashing hint line.
- `src/app/job/[id].tsx` — new "Work details" card (priority badge, site-wide
  flashing, materials, scope) + editable **Field notes** committed via
  `updateJobcardNotes` on blur, captioned "Shared with every crew on this
  jobcard." Status menu unchanged.

**To do** — none. (`assignedInstallerId` left in the type but no longer read by
the agenda; safe to delete in a later cleanup.)

---

## Step 6 — Operator Gap-Closure & Financial Sync ✅

**Done**
- **Change 1 — Job flashing for the Operator:** `CreateJobModal` gained a
  "Flashing material (site-wide)" field (+ `NewJobInput.flashingMaterial`);
  `(desktop)/jobs.tsx` gained an inline-editable **Flashing** column
  (commit-on-blur → `updateJob`).
- **Change 2 — jobcode resolution:** `resolveJobcodeId` (in
  `integrations/quickbooksTime/sync.ts`) now climbs **log → jobcard → parent
  Job's `qbtJobcodeId`** first, then the explicit map, then the default;
  custom-named logs still resolve. `submitLog` already uses it.
- **Change 3 — send-result status (no approval):** replaced `ReviewStatus` with
  `TimesheetSendStatus` (`'unsent' | 'sent' | 'failed'`); renamed the log field
  `reviewStatus → sendStatus`; `clockOut`/`addLog` create `'unsent'`; `updateLog`
  re-arms to `'unsent'`; dropped `setLogReviewStatus`; `sendApprovedToQbt →
  markTimesheetsSent`. `(desktop)/review.tsx` is now **read-only**: no
  approve/Send buttons; badges only **"Sent to QBT"** / **"Failed to send to
  QBT"** (unsent = no badge); filters/tallies are All/Unsent/Sent/Failed; editing
  times still allowed. Seeds: current week `'unsent'`, history `'sent'`, one
  `'failed'` for preview.

**To do** — none.

---

## Step 7 — Backend Persistence & Scheduled Sync 🟡 In progress

Unblocked 2026-06-14 (keys supplied; project `ovelhjqoeofjqzvsxoar` linked).
Being delivered in **stages** so the app keeps working between them. The user
runs all live deploy commands (`supabase db push`, `functions deploy`,
`secrets set`); the agent authors the files.

**7a — Foundation ✅ (done)**
- `app.json → expo.extra.supabase` filled with the project URL + anon key.
- Deps installed: `@supabase/supabase-js`, `@react-native-async-storage/async-storage`,
  `react-native-url-polyfill` (Expo-56 compatible).
- `supabase init` (config.toml) + migration
  `supabase/migrations/20260614201808_initial_schema.sql`: all tables (`workers`,
  `jobs`, `jobcards`, `crews`+`crew_members`, `daily_crews`+`daily_crew_members`,
  `schedule_assignments`, `timesheets`), `app_role` enum, a `private`
  `current_app_role()` SECURITY-DEFINER helper, installer-only crew triggers,
  PM-flashing-only / installer-status-notes-only / operator-role-rate guards,
  explicit GRANTs (new tables aren't auto-exposed since 2026-04-28), and RLS on
  every table.
- Client library: `src/integrations/supabase/{config,client,auth,index}.ts`
  (supabase-js + AsyncStorage session, role/session helpers). **Not yet wired into
  the running app** — the app still runs on the in-memory store.

**⏳ Awaiting the user (live, run yourself):**
1. `supabase db push --linked` (apply the migration; enter DB password if asked).
2. `supabase db advisors --linked --type security` (fix anything flagged).
3. Create the first operator: Dashboard → Authentication → Add user
   (`brandonw@ox-glass.com`, auto-confirm), then in the SQL editor:
   `insert into public.workers (id, name, email, role, status) values
   ('<that-user-uuid>', 'Brandon Wallace', 'brandonw@ox-glass.com', 'operator',
   'active');`

**To do — later stages (not started):**
- **7b** — Auth UI + wire session → active worker/role (replaces DevRoleSwitcher).
- **7c** — `invite-worker` Edge Function + wire Operator "Add worker".
- **7d** — Store swap: back each Zustand slice with Supabase (reads then writes),
  keeping action signatures stable. **Biggest/riskiest stage.**
- **7e** — `push-timesheets-to-qbt` Edge Function on pg_cron (Mon 07:30) +
  `QBT_ACCESS_TOKEN` / service-role secrets; client `markTimesheetsSent` becomes
  the reflection of the sweep.

**Open refinement:** `workers.hourly_rate` is column-readable by all authenticated
(UI hides it); move pay behind a view / column privilege for true column secrecy
during 7d.

---

## Decisions & deviations from the original blueprint

- **2026-06-14 — No in-app approval or status; show only the QBT send result.**
  The Operator no longer reviews/approves timesheets. A fresh log has **no
  status**; the weekly server sweep pushes it and stamps **"Sent to QBT"** or
  **"Failed to send to QBT"**. The **payroll manager approves inside QuickBooks
  Time**. Step 6 replaces `ReviewStatus` with `TimesheetSendStatus`
  (`'unsent' | 'sent' | 'failed'`), renames `reviewStatus → sendStatus`, drops
  `setLogReviewStatus`, and replaces `sendApprovedToQbt → markTimesheetsSent`. The
  Operator timesheet screen becomes **read-only**. Reflected in Steps 0, 6, 7.
