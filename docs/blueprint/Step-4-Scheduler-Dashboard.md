# Step 4 — Scheduler Dashboard (Crews + Split-Screen Calendar)

**Goal:** Replace the Scheduler placeholder with a working dispatch console:
manage **Crews** (installers only), view a **split-screen** calendar (assignments
per crew) beside the **Unassigned backlog**, and **assign** backlog Jobcards to a
crew on a date. Assignment writes `ScheduleAssignment` rows (Step 2) — the single
source of truth the Installer agenda (Step 5) reads.

**Prerequisites:** Steps 1 and 2.

**Read first:** `Step-0-Overview.md`, and Step 2's resolution model.

---

## Current state

`src/app/(desktop)/schedule.tsx` is a placeholder board ("Schedule board coming
soon"). Nav already routes `scheduler → /schedule` (`src/roles.ts`). After Step 2
the store has `crews`, `dailyCrews`, `assignments`, their CRUD actions, and
`assignJobcard` / `unassignJobcard`.

---

## What the Scheduler screen must do (from blueprint §2.C)

1. **Crew management:** create/edit crews; **only `installer`-role workers** may
   be added. Create dated **Daily Crews** that override permanent crews for a day.
2. **Split-screen schedule:**
   - **Right — Backlog:** the pool of **Unassigned Jobcards** (no assignment row).
   - **Left — Calendar:** a **monthly** calendar, **toggleable by Crew**
     ("Viewing Crew Alpha"), showing that crew's assigned jobcards per day.
3. **Assignment:** place an unassigned Jobcard onto a specific date for the
   currently-viewed crew. A single Jobcard can go to **multiple crews** without
   duplicating the record. Surface conflicts/daily-crew overrides visually.

---

## Build

Gate first: `if (role !== 'scheduler') return <AccessDenied />;`

Suggested file layout (keep `schedule.tsx` as the screen; extract pieces into
`src/components/desktop/scheduler/`):

- `schedule.tsx` — screen shell: top bar with **Crew toggle** + a "Manage crews"
  button; two-column body (`flexDirection: 'row'`): `MonthCalendar` (left, flex 2)
  and `Backlog` (right, flex 1).
- `scheduler/MonthCalendar.tsx` — month grid for the selected crew.
- `scheduler/Backlog.tsx` — unassigned jobcards list.
- `scheduler/ManageCrewsModal.tsx` — crew CRUD with installer-only picker.

### Crew toggle

A segmented control / `InlineSelect` listing `crews` (and optionally a "+ Daily
crew" affordance). Selecting one sets `viewingCrewId`. The calendar shows that
crew's assignments; the title reads "Viewing <Crew name>".

### Backlog (right)

`jobcards` with **no** matching row in `assignments`
(`assignments.every(a => a.jobcardId !== card.id)` → unassigned). Render each as a
compact card: title, parent Job name, **priority badge**, flashing/materials hint.
Each card needs an affordance to assign it to the selected date (see below).

### Calendar (left)

Month grid (build with `date-fns`: `startOfMonth`, `endOfMonth`,
`eachDayOfInterval`, `getDay` for the leading offset). Prev/next month controls.
For each day cell, show the jobcards assigned to `viewingCrewId` on that date via
`jobcardIdsForCrewOnDate(state, viewingCrewId, date)` (Step 2). Each placed card
shows title + priority, with a small "×" to call `unassignJobcard`.

**Visual cues (blueprint "identify conflicts/overrides"):**
- If a **Daily Crew** exists on a day that overlaps the viewed crew's installers,
  badge that day (e.g. a "Daily override" chip).
- If the same installer would be double-booked (in two crews with assignments
  that day), highlight the day in `warning`.

### Assignment interaction

The blueprint asks for **drag-and-drop** of backlog cards onto calendar days.
Drag-and-drop in `react-native-web` is fiddly; implement the **reliable
click-to-assign baseline** and treat drag as an optional enhancement:

- **Baseline (required):** clicking a backlog card enters "placing" mode
  (highlight it); clicking a calendar day calls
  `assignJobcard(cardId, viewingCrewId, dateOfCell)`, then clears placing mode and
  shows a `Toast`. (Mirrors the installer app's existing "tap to select / tap to
  place" pattern in `(installer)/index.tsx`.)
- **Optional enhancement:** HTML5 drag-and-drop on web (`draggable` +
  `onDragStart`/`onDrop` via DOM props on web only). Only add it if it doesn't
  regress the click baseline; gate behind `Platform.OS === 'web'`.

Because assignment creates a separate `ScheduleAssignment` row, assigning the same
card to a second crew (toggle crew, place again) **does not** duplicate the
Jobcard — exactly the Single-Source-of-Truth requirement. `assignJobcard` is
idempotent for the same `(jobcardId, crewId, date)` (Step 2).

### Manage-crews modal

- List crews; for each, an installer multi-select. **The picker lists only
  `workers` with `role === 'installer'`** — never PMs/operators/schedulers
  (blueprint hard constraint). Use `workers.filter(w => w.role === 'installer')`.
- Create a new permanent crew (name + installers).
- Create a **Daily Crew**: name + date + installers (subset of installers); this
  is the temporary override for that date.
- The store also filters non-installers as a backstop (Step 2), but the UI must
  not even offer them.

---

## RBAC / constraints

- Wrong role → `<AccessDenied />`.
- **Installers only** in crews — enforced in the picker AND the store.
- **Never duplicate a Jobcard** — only `assignJobcard`/`unassignJobcard` rows.
- A Jobcard with ≥1 assignment leaves the backlog automatically (derived).

## Files touched / created

- `src/app/(desktop)/schedule.tsx` — real screen (replaces placeholder).
- `src/components/desktop/scheduler/MonthCalendar.tsx` — **new**.
- `src/components/desktop/scheduler/Backlog.tsx` — **new**.
- `src/components/desktop/scheduler/ManageCrewsModal.tsx` — **new**.
- (Reuse `AccessDenied`, `Toast`, `InlineSelect`, `FormInput`, theme.)

## Definition of Done

- [ ] Scheduler role renders the split-screen; other roles get `<AccessDenied />`.
- [ ] Crew toggle switches which crew's assignments the calendar shows.
- [ ] Backlog shows only unassigned jobcards; placing one creates a
      `ScheduleAssignment` and removes it from the backlog.
- [ ] Same Jobcard can be assigned to a second crew without duplicating it.
- [ ] Crew pickers list installers only; Daily Crews can be created per date.
- [ ] Daily-override / double-booking days are visually flagged.
- [ ] `npx tsc --noEmit` clean; no new lint errors.
