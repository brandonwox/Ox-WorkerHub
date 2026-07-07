# Step 0 — Overview & How To Use These Files

This folder breaks the **Master Blueprint** (Ox WorkerHub Architecture & Feature
Specification) into sequential, implementable chunks. Each `Step-N-*.md` is a
self-contained work order: read it, implement it, confirm it type-checks, move on.

> **Read this file first.** It defines the shared vocabulary, the current state of
> the code, the role/permission matrix, and the conventions every later step
> assumes. Do not skip it.

---

## How to work these steps

1. **Do them in order.** Later steps depend on data-model and store changes made
   in earlier ones. The dependency chain is called out in each file's
   *Prerequisites* section.
2. **One step per session/PR.** Each step ends in a compiling, reviewable state.
3. **Don't rebuild what exists.** Every step has a *Current State* section that
   says exactly what is already built. Extend it; don't recreate it.
4. **Verification (project rule from `AGENTS.md`):** the agent does **not**
   manually test features. The definition of done is *"the code I wrote has no
   type/lint errors and matches this spec."* The user does manual testing.
5. **Stay in the established style.** Match the existing component, store, and
   theme conventions (see *Conventions* below). Don't introduce new libraries
   unless a step explicitly calls for one.

---

## The domain model (5 core entities)

| Entity | What it is | Owner / creator | Lives in |
|---|---|---|---|
| **Job** | A jobsite/project. Site-wide settings incl. `qbtJobcodeId` and `flashingMaterial`. | Operator | `jobs[]` |
| **Jobcard** | A task/ticket on a Job. Inherits flashing from its parent Job. | Field Super | `jobcards[]` |
| **Worker** | A person, defined by `role`. Installers have an `hourlyRate`. | Operator | `workers[]` |
| **Crew** | The scheduling container. **Installers only.** Permanent + dated Daily overrides. | Scheduler | `crews[]` / `dailyCrews[]` *(new)* |
| **Timesheet** (`TimesheetLog`) | Hours logged by an installer. **No in-app approval or status** — auto-sent to QBT by the weekly sweep, which stamps each one **"Sent to QBT"** or **"Failed to send"**; the payroll manager reviews/approves them **inside QuickBooks Time**. | Installer | `logs[]` |

**Job ≠ Jobcard.** A *Job* is the site. A *Jobcard* is one piece of work to do on
that site. Work is assigned to **Crews**, never to individual installers.

### The two lifecycles (the whole app, end to end)

**Work lifecycle:**
Operator creates **Job** (maps `qbtJobcodeId`) → Field Super sets the Job's
`flashingMaterial`, then creates a **Jobcard** (flashing auto-inherited; adds
priority/materials/scope) → Jobcard lands in the **Unassigned backlog** →
Scheduler assigns it to a **Crew** on a **date** → Installer on that crew sees it
that day and does the work.

**Financial lifecycle:**
Installer clocks in/out → generates a **Timesheet** (no status yet) linked
(through its Jobcard) to the parent **Job** → the weekly server-side sweep
auto-bundles the hours + the Job's `qbtJobcodeId`, pushes them to QuickBooks Time,
and stamps each timesheet **"Sent to QBT"** (or **"Failed to send"**) → the
**payroll manager reviews and approves them inside QuickBooks Time** (not in this
app). There is **no in-app approval step**; the Operator gets a read-only view of
hours and their send result.

---

## Role-Based Access Control (RBAC) matrix

| Capability | Operator | Field Super | Scheduler | Installer |
|---|:--:|:--:|:--:|:--:|
| Create / edit / archive **Jobs** | ✅ | — | — | — |
| Map `qbtJobcodeId` on a Job | ✅ | ❌ | — | — |
| Edit Job `flashingMaterial` | ✅ | ✅ (only this field) | — | — |
| Manage workers & roles | ✅ | — | — | — |
| Set installer `hourlyRate` (hidden from others) | ✅ | — | — | — |
| Create **Jobcards** | — | ✅ | — | — |
| Manage **Crews** (installers only) | — | — | ✅ | — |
| Assign Jobcards → Crew/date | — | — | ✅ | — |
| See own crew's daily agenda | — | — | — | ✅ |
| Clock in/out, submit hours | — | — | — | ✅ |
| Edit Jobcard field notes / status | — | — | — | ✅ |
| View **Timesheets** (read-only — no in-app approval; shows QBT send result) | ✅ | — | — | — |

Every desktop screen must gate on role and render `<AccessDenied />` for the
wrong role — same pattern already used in `jobs.tsx`, `people.tsx`, `review.tsx`.

---

## Current state of the code (as of these docs)

**Built and working — do not rebuild:**

- **Foundation:** `AppRole` (`installer | scheduler | operator | field_super`),
  `workers[]` roster + `currentUserId`, dev-only "View as" role switcher
  (`DevRoleSwitcher`), routing split — Installer = mobile tabs `src/app/(installer)/`,
  desktop roles = sidebar console `src/app/(desktop)/` (nav in `src/roles.ts`).
- **Job vs Jobcard** already exist as real types in `src/types.ts`; store holds
  both `jobs` and `jobcards`.
- **Operator role (complete):** Jobs table + Create Job modal + inline QBT
  jobcode/status edit (`(desktop)/jobs.tsx`); People roster + role/rate edit +
  Add-worker invite (`(desktop)/people.tsx`); Timesheet screen
  (`(desktop)/review.tsx`) — *currently* a `pending → approved → synced` review
  pipeline with a manual "Send to QuickBooks". **Step 6 simplifies this to a
  read-only screen** with no in-app approval — each timesheet just shows its QBT
  send result ("Sent to QBT" / "Failed to send"); approval happens in QBT.
- **Installer role (complete):** mobile calendar/agenda (`(installer)/index.tsx`),
  jobcard detail (`src/app/job/[id].tsx`), clock in/out + timecards, timesheets.
- **QuickBooks Time integration:** built in `src/integrations/quickbooksTime/`;
  idle until a real token is supplied; push is moving to a weekly server sweep.

**Placeholders — to be built by these steps:**

- **Field Super** dashboard — `src/app/(desktop)/field-super-jobcards.tsx` (currently a
  "Not functional yet" notice).
- **Scheduler** dashboard — `src/app/(desktop)/schedule.tsx` (placeholder board).

**Not modeled yet — to be added by these steps:**

- `Job.flashingMaterial`, and the Jobcard task fields (`priority`, `materials`,
  `scopeOfWork`, inherited `flashingMaterial`, `fieldNotes`).
- **Crews** entirely (`Crew`, `DailyCrew`, `ScheduleAssignment`) — currently the
  installer view uses the temporary `Jobcard.assignedInstallerId` stand-in.

**Backend:** the store is in-memory (`src/data/mock.ts` seeds it). Supabase is the
chosen backend but is **parked/blocked** on the user supplying Project URL + anon
key (see `docs/supabase-setup.md`). All steps below target the in-memory store;
Step 7 maps them onto Supabase for when it's unblocked.

---

## The steps

| Step | File | Builds |
|---|---|---|
| 1 | `Step-1-Domain-Model-Foundation.md` | Flashing material + Jobcard task fields; inheritance; types/store/mock |
| 2 | `Step-2-Crews-And-Scheduling-Data-Model.md` | `Crew` / `DailyCrew` / `ScheduleAssignment` + store slice + resolution selectors |
| 3 | `Step-3-Field-Super-Dashboard.md` | Field Super screen: create Jobcards (auto-inherit flashing), edit Job flashing, push to backlog |
| 4 | `Step-4-Scheduler-Dashboard.md` | Crew management + split-screen calendar/backlog + assignment |
| 5 | `Step-5-Installer-Crew-Agenda.md` | Crew-based daily agenda; show flashing/materials; shared field notes |
| 6 | `Step-6-Operator-And-Financial-Sync.md` | Operator gap-closure (Job flashing) + timesheet→Job→QBT jobcode bundling |
| 7 | `Step-7-Backend-Persistence-And-Scheduled-Sync.md` | (Deferred) Supabase mapping + weekly QBT Edge Function |

Dependency order: **1 → 2** are foundational data-model steps. **3** needs 1.
**4** and **5** need 1 + 2. **6** needs 1. **7** is last and currently blocked.

> **Progress is tracked in [`Progress.md`](./Progress.md)** — a living status doc
> (done / to-do per step) updated whenever a step is worked on. Check it first to
> see where things stand.

---

## Conventions (apply to every step)

- **Stack:** Expo Router + React Native, `react-native-web` for desktop, Zustand
  store (`src/store/useAppStore.ts`), `date-fns` for dates, `@expo/vector-icons`
  (`Feather`) for icons. No new state libs.
- **Theme:** always use `colors`, `fonts`, `radii`, `spacing` from `src/theme.ts`.
  Never hard-code colors or font names. Match the existing semantic colors
  (`primary`, `warning`, `success`, `danger`, `surface`, `surfaceLight`,
  `border`, `textPrimary/Secondary/Tertiary`, and their `*Dim` variants).
- **Imports:** use the `@/` path alias (e.g. `@/store/useAppStore`, `@/types`).
- **Store mutations:** add typed actions to `AppState` in `useAppStore.ts`; keep
  them pure (`set((state) => ...)`), and follow the existing id-counter pattern
  (`nextJobId`, `nextWorkerId`, …) for new entities.
- **Desktop screens:** gate on `useCurrentRole()`, render `<AccessDenied />` for
  the wrong role, wrap content in a `ScrollView`, reuse `Toast`, `FormInput`,
  `InlineSelect`, and the table/modal patterns from `jobs.tsx` / `CreateJobModal`.
- **Mobile screens:** match `(installer)/index.tsx` and `JobCard` / `StatusPill`.
- **Dates** are stored as `yyyy-MM-dd` strings; datetimes as ISO strings.
- **Single Source of Truth:** a Jobcard is one record. Assigning it to multiple
  crews/dates creates *assignment* records that reference it — never duplicate the
  Jobcard.

### Definition-of-Done checklist (every step ends with this)

- [ ] Types compile (`npx tsc --noEmit` is clean for the files touched).
- [ ] No new ESLint errors.
- [ ] RBAC gating present on any new screen.
- [ ] Mock/seed data updated so the feature is previewable in the dev switcher.
- [ ] No duplicated source-of-truth records; no hard-coded theme values.
