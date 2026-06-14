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
| 5 | Installer Crew Agenda | ⬜ Not started (next) |
| 6 | Operator Gap-Closure & Financial Sync | ⬜ Not started |
| 7 | Backend Persistence & Scheduled Sync | ⛔ Blocked (needs Supabase keys) |

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

## Step 5 — Installer Crew Agenda ⬜ (next)

Crew-based daily agenda; show flashing/materials; shared field notes. Depends on
Steps 1 + 2; swaps the installer agenda read over to the Step 2 selectors. See
`Step-5-Installer-Crew-Agenda.md`.

**To do** — entire step.

---

## Step 6 — Operator Gap-Closure & Financial Sync ⬜

Depends on Step 1. Three changes (see `Step-6-Operator-And-Financial-Sync.md`):
1. Expose Job `flashingMaterial` to the Operator (create + table).
2. `resolveJobcodeId` — climb log → jobcard → parent Job's `qbtJobcodeId`.
3. **Auto-approve timesheets / read-only Operator screen** (see Decisions below):
   create logs as `'approved'`, collapse `ReviewStatus` to `'approved' | 'synced'`,
   drop `setLogReviewStatus`, remove Approve/"Send to QuickBooks" controls.

**To do** — entire step.

---

## Step 7 — Backend Persistence & Scheduled Sync ⛔ Blocked

Deferred until the user supplies a Supabase **Project URL + anon key** and
unblocks the backend. Maps the in-memory store onto Supabase + a weekly QBT Edge
Function. See `Step-7-Backend-Persistence-And-Scheduled-Sync.md`.

**To do** — entire step (blocked).

---

## Decisions & deviations from the original blueprint

- **2026-06-14 — Timesheets are auto-approved; no in-app approval.** The Operator
  no longer reviews/approves timesheets. They are auto-approved on creation and
  auto-pushed by the weekly server sweep; the **payroll manager approves them
  inside QuickBooks Time**. The Operator's timesheet screen becomes **read-only
  visibility**. Reflected in Steps 0, 6, 7. (Implementation lands in Step 6.)
