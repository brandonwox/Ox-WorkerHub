# Step 2 — Crews & Scheduling Data Model

**Goal:** Introduce the **Crew** as the scheduling container, plus the
**Daily Crew** override and the **ScheduleAssignment** join that links a Jobcard
to a Crew on a date. This is the data layer the Scheduler UI (Step 4) writes and
the Installer agenda (Step 5) reads. Still no screens here — types, store, seeds,
and resolution selectors only.

**Prerequisites:** Step 1.

**Read first:** `Step-0-Overview.md` (esp. the *Single Source of Truth* rule).

---

## The model in one paragraph

Work is assigned to **Crews, never individuals**. Crews contain **installers
only**. Each installer belongs to exactly **one Permanent Crew**. The Scheduler
can create a **Daily Crew** for a specific date that temporarily regroups some
installers for that day (pulling them out of their permanent crew to prevent
double-booking). A **ScheduleAssignment** places one Jobcard onto one Crew for one
date; a single Jobcard can have many assignments (multiple crews/dates) **without
duplicating the Jobcard record**.

---

## What to build

### 1. Types — `src/types.ts`

```ts
/** A permanent crew of installers. The default scheduling container. */
export interface Crew {
  id: string;
  /** e.g. "Crew Alpha". */
  name: string;
  /** Members — MUST all be workers with role 'installer'. */
  installerIds: string[];
}

/**
 * A temporary, date-specific crew that overrides permanent crews for ONE day.
 * Installers listed here are treated as working under this crew on `date`
 * instead of their permanent crew (prevents double-booking).
 */
export interface DailyCrew {
  id: string;
  /** The single day this override applies to (yyyy-MM-dd). */
  date: string;
  name: string;
  /** Members — installers only. */
  installerIds: string[];
}

/**
 * Single-source-of-truth link: a Jobcard placed on a crew for a date. The
 * Jobcard itself is never duplicated; multiple assignments fan it out to
 * multiple crews/dates.
 */
export interface ScheduleAssignment {
  id: string;
  jobcardId: string;
  /** References a Crew.id OR a DailyCrew.id. */
  crewId: string;
  /** yyyy-MM-dd the work is scheduled for. */
  date: string;
}
```

### 2. Store — `src/store/useAppStore.ts`

Add three collections to `AppState` and the actions below (follow existing
patterns; add `nextCrewId` / `nextAssignmentId` counters):

```ts
// State:
crews: Crew[];
dailyCrews: DailyCrew[];
assignments: ScheduleAssignment[];

// Crew management (Scheduler) — installer-only enforced in the action:
addCrew: (crew: Omit<Crew, 'id'> & { id?: string }) => Crew;
updateCrew: (id: string, changes: Partial<Crew>) => void;
removeCrew: (id: string) => void;

addDailyCrew: (crew: Omit<DailyCrew, 'id'> & { id?: string }) => DailyCrew;
updateDailyCrew: (id: string, changes: Partial<DailyCrew>) => void;
removeDailyCrew: (id: string) => void;

// Assignment (Scheduler):
assignJobcard: (jobcardId: string, crewId: string, date: string) => ScheduleAssignment;
unassignJobcard: (assignmentId: string) => void;
```

**Installer-only enforcement (required):** in `addCrew` / `updateCrew` /
`addDailyCrew` / `updateDailyCrew`, filter `installerIds` down to ids that
resolve to a worker whose `role === 'installer'`. Silently dropping non-installers
in the store is the backstop; the UI (Step 4) also prevents selecting them. Add a
small helper, e.g. `onlyInstallerIds(workers, ids)`.

**Idempotent assignment:** `assignJobcard` should not create a duplicate if an
assignment with the same `(jobcardId, crewId, date)` already exists — return the
existing one. This keeps the source-of-truth single even on repeated drops.

### 3. Resolution selectors (the heart of the model)

Add exported selector helpers in `useAppStore.ts` (next to `currentWorkerOf`),
plus thin `use*` hooks if convenient. These encode the **Daily-overrides-Permanent**
rule:

```ts
/**
 * The crew id an installer is working under on `date`:
 * a Daily Crew they're in that day wins; otherwise their Permanent Crew.
 * Returns null if they're on no crew that day.
 */
export function activeCrewIdFor(
  state: { crews: Crew[]; dailyCrews: DailyCrew[] },
  installerId: string,
  date: string
): string | null;

/**
 * Jobcard ids assigned to a given crew on a given date.
 */
export function jobcardIdsForCrewOnDate(
  state: { assignments: ScheduleAssignment[] },
  crewId: string,
  date: string
): string[];

/**
 * Convenience: the Jobcards an installer should see on `date` =
 * assignments to their active crew that day.
 */
export function jobcardsForInstallerOnDate(
  state: { crews: Crew[]; dailyCrews: DailyCrew[]; assignments: ScheduleAssignment[]; jobcards: Jobcard[] },
  installerId: string,
  date: string
): Jobcard[];
```

`activeCrewIdFor` logic:
1. Find a `DailyCrew` where `date` matches and `installerIds` includes the
   installer → return its id.
2. Else find a `Crew` whose `installerIds` includes the installer → return its id.
3. Else `null`.

> **Edge case to document in a code comment:** if an installer is pulled into a
> Daily Crew on a date, they see that Daily Crew's assignments **instead of** their
> Permanent Crew's that day. That's intentional (prevents double-booking).

### 4. Seeds — `src/data/mock.ts`

- Seed **2 permanent crews** from the seeded installers, e.g.
  `Crew Alpha = [Marcus Lee (w-i1), Tyler Brooks (w-i3)]`,
  `Crew Bravo = [Sofia Ramirez (w-i2)]`. Installers only.
- Seed **a few `ScheduleAssignment`s** that place existing seeded jobcards onto
  these crews on their existing `date`s, so the Scheduler board and the
  crew-based installer agenda (Step 5) have content immediately. Keep the
  primary installer (Marcus) seeing the same cards he sees today so nothing
  visibly regresses when Step 5 switches the agenda to crew resolution.
- Optionally seed **one Daily Crew** on a near date to exercise the override path.

---

## Constraints

- **Installers only** in any crew — enforce in the store and (later) the UI.
- **Never duplicate a Jobcard.** Fan-out is via `ScheduleAssignment` rows only.
- Don't touch the installer agenda screen yet (that's Step 5). This step leaves
  the temporary `Jobcard.assignedInstallerId` path working as-is; Step 5 swaps the
  read over to these selectors.

## Files touched

- `src/types.ts` — `Crew`, `DailyCrew`, `ScheduleAssignment`.
- `src/store/useAppStore.ts` — collections, actions, resolution selectors, counters.
- `src/data/mock.ts` — seed crews + assignments (+ optional daily crew).

## Definition of Done

- [ ] Three new types exported and documented.
- [ ] Store has crews/dailyCrews/assignments + all listed actions, with
      installer-only filtering and idempotent `assignJobcard`.
- [ ] `activeCrewIdFor`, `jobcardIdsForCrewOnDate`, `jobcardsForInstallerOnDate`
      exported and correct (Daily overrides Permanent).
- [ ] Seeds include crews + assignments; primary installer's visible cards are
      unchanged in spirit.
- [ ] `npx tsc --noEmit` clean; no new lint errors.
