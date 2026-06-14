# Step 5 — Installer Crew-Based Agenda

**Goal:** Switch the Installer's daily agenda from the temporary
`Jobcard.assignedInstallerId` field over to **crew-based resolution** (Daily Crew
override → Permanent Crew), and surface the new Jobcard data — site-wide
**flashing material**, **materials**, **scope** — on the jobcard detail, plus a
shared **field notes** field installers can update.

**Prerequisites:** Steps 1 and 2 (and ideally 4, so there are assignments to see).

**Read first:** `Step-0-Overview.md`, Step 2's resolution selectors.

---

## Current state

- `src/app/(installer)/index.tsx` filters the agenda by
  `j.assignedInstallerId === currentUserId` (a temporary stand-in, flagged in a
  comment there and in `src/types.ts`).
- `src/app/job/[id].tsx` shows address/date/time-window + GC/manager details and a
  status menu. It does **not** show flashing, materials, scope, or notes.
- `JobCard.tsx` renders title/address/time-window + `StatusPill`.

After Step 2 the store exposes `jobcardsForInstallerOnDate(state, installerId, date)`.

---

## What to build (from blueprint §2.D)

1. **Daily agenda by crew:** on the selected day, show the jobcards assigned to the
   installer's **active crew** that day (Daily override wins, else Permanent).
2. **Jobcard detail:** show priority, the site-wide **flashing material**, and
   **additional materials** + **scope of work**.
3. **Shared notes/status:** the installer can update status (already works) and
   **field notes**; because the Jobcard is one shared record, notes/status changes
   are immediately visible to any other crew on the same card.
4. **Time tracking:** clock in/out + submit hours — **unchanged**. Don't touch the
   `ClockControls` / timesheet flow.

---

## Build

### Agenda resolution — `src/app/(installer)/index.tsx`

Replace the `assignedInstallerId` filter with crew resolution. Keep the rest of the
screen (WeekRibbon, FlatList, ClockControls, select/edit modes) intact.

- The current `jobcards` memo filters across all dates to build `markedDates` and
  then narrows to the selected day. With assignments, do it per the model:
  - For **marked dates** (dots on the ribbon): collect the set of dates on which
    the installer's active crew has any assignment. A helper like
    `assignedDatesForInstaller(state, installerId)` (iterate `assignments`, keep
    those whose `crewId` equals the installer's active crew *for that
    assignment's date*) is the precise version. A simpler acceptable v1: mark any
    date where `jobcardsForInstallerOnDate(state, id, date)` is non-empty across
    the visible week window.
  - For the **selected day's list**: use
    `jobcardsForInstallerOnDate(state, currentUserId, format(selectedDate, 'yyyy-MM-dd'))`,
    then sort by `priorityOrder` (existing behavior).
- Read `crews`, `dailyCrews`, `assignments` from the store (or expose a
  `useInstallerDay(date)` hook in `useAppStore.ts` that wraps the selectors).

> Keep `assignedInstallerId` in the type for now but stop reading it here. It can
> be deleted in a later cleanup once nothing references it.

### JobCard summary — `src/components/JobCard.tsx`

Optionally add a small **priority** indicator and a **flashing** hint line (icon +
`jobcard.flashingMaterial`) when present, matching the existing `metaRow` style.
Keep it compact; don't redesign the card.

### Jobcard detail — `src/app/job/[id].tsx`

Add card sections (reuse the existing `InfoRow` + `card` styles):

- **Priority** row (badge using the status-pill visual language).
- **Flashing material** row — `jobcard.flashingMaterial ?? 'Not specified'`. Label
  it clearly as the site-wide spec.
- **Materials needed** row — `jobcard.materials` when present.
- **Scope of work** row — `jobcard.scopeOfWork` when present (multi-line).
- **Field notes** — an editable multiline area bound to `jobcard.fieldNotes`,
  committed via `updateJobcardNotes(job.id, text)` on blur. Add a one-line caption:
  "Shared with every crew on this jobcard." Status menu stays as-is.

---

## Constraints

- **Do not** change clock-in/out, timecards, or the timesheets tab.
- Status and notes write to the **single shared Jobcard record** (no per-crew
  copies) — that's what makes them visible across crews.
- If the installer is on **no** crew that day, show the existing empty state
  ("No jobs scheduled").
- Don't reintroduce per-installer assignment; the source of truth is
  `ScheduleAssignment`.

## Files touched

- `src/app/(installer)/index.tsx` — crew-based agenda resolution.
- `src/app/job/[id].tsx` — flashing/materials/scope/priority + editable field notes.
- `src/components/JobCard.tsx` — optional flashing/priority hint.
- (Optional) `src/store/useAppStore.ts` — a `useInstallerDay` convenience hook.

## Definition of Done

- [ ] Installer agenda is driven by crew assignments; Daily Crew overrides
      Permanent for that date.
- [ ] Jobcard detail shows flashing material, materials, scope, and priority.
- [ ] Field notes are editable and persist on the shared Jobcard.
- [ ] Clock-in/out and timesheets are unchanged.
- [ ] Marked dates on the week ribbon reflect crew assignments.
- [ ] `npx tsc --noEmit` clean; no new lint errors.
