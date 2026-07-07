# Step 1 — Domain Model Foundation (Flashing Material + Jobcard Task Fields)

**Goal:** Extend the data model so a **Job** carries a site-wide
`flashingMaterial`, and a **Jobcard** carries the Field-Super-authored task fields the
blueprint requires (priority, materials, scope) plus an **inherited** copy of the
parent Job's flashing material and a shared field-notes field. This is pure
data-layer work — no new screens. Everything in Steps 3–6 depends on it.

**Prerequisites:** none. This is the first build step.

**Read first:** `Step-0-Overview.md`.

---

## Current state

`src/types.ts` already has `Job`, `Jobcard`, `Worker`, `TimesheetLog`. The
`Jobcard` has `title`, `address`, `date`, `status`, `priorityOrder`,
`assignedInstallerId` (temporary), and a `details` object. It has **no**
flashing, materials, scope, or Field-Super-priority fields. `Job` has `name`, `location`,
`status`, `qbtJobcodeId` — **no** flashing field.

The store (`src/store/useAppStore.ts`) has `addJob` / `updateJob` /
`setJobcardStatus` but **no** `addJobcard` / `updateJobcard`. Seeds live in
`src/data/mock.ts`.

---

## What to build

### 1. Types — `src/types.ts`

**Add a Jobcard priority enum** (Field-Super-set, distinct from the existing
`priorityOrder`, which stays as the intra-day sort key):

```ts
/** Field-Super-assigned importance of a Jobcard. Distinct from `priorityOrder` (sort). */
export type JobcardPriority = 'Low' | 'Medium' | 'High';
```

**Extend `Job`** with the site-wide flashing requirement:

```ts
export interface Job {
  // ...existing fields...
  /**
   * Site-wide flashing material spec. Set by the Operator on create and editable
   * by the Field Super (their one writable Job field). Jobcards snapshot this
   * value at creation time. Optional until specified.
   */
  flashingMaterial?: string;
}
```

**Extend `Jobcard`** with the task fields + inherited flashing + shared notes:

```ts
export interface Jobcard {
  // ...existing fields (keep priorityOrder, assignedInstallerId, details)...

  /** Field-Super-assigned priority. Defaults to 'Medium'. */
  priority: JobcardPriority;
  /**
   * Flashing material inherited from the parent Job AT CREATION TIME (a snapshot,
   * not a live link — so later Job edits don't silently mutate existing cards).
   */
  flashingMaterial?: string;
  /** Task-specific / additional materials needed (free text). Field-Super-authored. */
  materials?: string;
  /** Scope of work / what's required on this card (free text). Field-Super-authored. */
  scopeOfWork?: string;
  /**
   * Shared field notes updated by installers on site. Because a Jobcard is a
   * single shared record, a note added by one crew is visible to every crew the
   * card is assigned to.
   */
  fieldNotes?: string;
}
```

> Keep `jobId` as-is (optional in the type for legacy/seed migration), but **all
> Field-Super-created Jobcards must set it** (enforced in Step 3). Keep `priorityOrder`,
> `assignedInstallerId`, and `details` untouched — other code still reads them.

### 2. Store — `src/store/useAppStore.ts`

Add Jobcard create/update actions to the `AppState` interface and implementation,
following the existing `addJob`/`updateJob` shape and the `nextJobId`-style id
counter pattern. Add a `nextJobcardId` counter.

```ts
// In AppState:
/** Create a Jobcard. Inherits flashingMaterial from the parent Job. */
addJobcard: (
  card: Omit<Jobcard, 'id' | 'status' | 'priorityOrder' | 'flashingMaterial'> & {
    id?: string;
    status?: JobcardStatus;
    priorityOrder?: number;
  }
) => Jobcard;
updateJobcard: (id: string, changes: Partial<Jobcard>) => void;
/** Installer-facing: append/replace shared field notes on a Jobcard. */
updateJobcardNotes: (id: string, fieldNotes: string) => void;
```

Implementation notes for `addJobcard`:

- Resolve the parent Job by `card.jobId` from `state.jobs` and **snapshot** its
  `flashingMaterial` onto the new card (this is the auto-inheritance the blueprint
  requires — see lifecycle step 3). If no parent or no flashing, leave undefined.
- Default `status` to `'Upcoming'`, `priority` to whatever the caller passes
  (default `'Medium'` if omitted), and `priorityOrder` to a sensible value
  (e.g. `(max existing order on that date) + 1`, or just the card count).
- Insert at the front of `jobcards` (newest first), matching `addJob`'s ordering.

`updateJobcard` / `updateJobcardNotes` follow the `updateJob` map-and-merge shape.

### 3. Seed data — `src/data/mock.ts`

- Add a `flashingMaterial` to a couple of the seeded **Jobs** (e.g. `job-1`,
  `job-2`) and leave others blank to show the unset state.
- Give every seeded **Jobcard** a `priority` (mix of `'Low' | 'Medium' | 'High'`)
  and, where the parent Job has flashing, a matching `flashingMaterial` snapshot.
  Add `materials` / `scopeOfWork` to a few so the Field Super/installer views have content.
- The existing `mockJobcards.map(...)` that injects `jobId` and
  `assignedInstallerId` is the natural place to also inject default `priority`
  and the inherited `flashingMaterial` (look it up from `mockJobs` by the mapped
  `jobId`). This keeps seed flashing consistent with the inheritance rule.

---

## Constraints

- **Inheritance is a snapshot, not a live binding.** Copy the Job's
  `flashingMaterial` onto the Jobcard at creation. Do not resolve it live on
  read — the blueprint says the card "inherits ... upon creation."
- Don't remove `priorityOrder` or `assignedInstallerId` yet — later steps retire
  `assignedInstallerId`, and the installer day-view still sorts by `priorityOrder`.
- No UI in this step. If you find yourself editing a `.tsx` screen, stop — that's
  Step 3+.

---

## Files touched

- `src/types.ts` — new enum + fields.
- `src/store/useAppStore.ts` — `addJobcard`, `updateJobcard`, `updateJobcardNotes`,
  `nextJobcardId`.
- `src/data/mock.ts` — seed flashing + jobcard task fields.

## Definition of Done

- [ ] `JobcardPriority` exported; `Job.flashingMaterial` and the new `Jobcard`
      fields present and documented.
- [ ] `addJobcard` snapshots parent-Job flashing onto the new card.
- [ ] `updateJobcard` / `updateJobcardNotes` exist and are typed.
- [ ] Seeds compile and include flashing + priority on cards.
- [ ] `npx tsc --noEmit` clean; no new lint errors.
