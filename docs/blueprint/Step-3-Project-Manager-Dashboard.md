# Step 3 — Project Manager Dashboard (Jobcard Creation)

**Goal:** Replace the PM placeholder with a working dashboard where a Project
Manager edits a Job's `flashingMaterial` (their one writable Job field) and
**creates Jobcards** against a parent Job — with flashing **auto-fetched** from
the Job — then releases them into the Scheduler's **Unassigned backlog**.

**Prerequisites:** Step 1 (flashing + Jobcard fields + `addJobcard`/`updateJob`).

**Read first:** `Step-0-Overview.md` (RBAC matrix, conventions).

---

## Current state

`src/app/(desktop)/pm.tsx` is a placeholder ("Jobcard creation coming soon"). The
desktop nav already routes `project_manager → /pm` (`src/roles.ts`,
`DESKTOP_NAV.project_manager`). The store has `jobs`, `addJobcard`, `updateJob`
(after Step 1). No PM UI exists.

---

## What the PM screen must do (from blueprint §2.B)

1. **Pick an active Job** from the global list and **create a Jobcard** for it.
2. **Auto-fetch flashing:** when the parent Job is selected, the form
   automatically applies that Job's `flashingMaterial` to the new card (read-only
   preview — the PM doesn't retype it). `addJobcard` snapshots it (Step 1).
3. Set task-specific fields: **priority**, **materials**, **scope of work / work
   required**, optional **title**, optional **scheduled date**.
4. **Partial Job access:** the PM can UPDATE a Job's `flashingMaterial` only.
   They must **not** be able to edit `qbtJobcodeId`, name, location, or status.
5. On create, the Jobcard enters the global **Unassigned backlog** (any Jobcard
   with no `ScheduleAssignment` is "unassigned" — see Step 2/Step 4). No extra
   flag is needed; "unassigned" = "has no assignment row."

---

## Build

### Screen — `src/app/(desktop)/pm.tsx`

Gate first: `const role = useCurrentRole(); if (role !== 'project_manager') return <AccessDenied />;`

Layout (reuse the `jobs.tsx` table/section conventions; wrap in `ScrollView`,
`maxWidth` ~1100):

- **Header row:** title/subtitle (e.g. "N jobcards · M unassigned") + a primary
  **"Create jobcard"** button (same pill style as `jobs.tsx`'s "Create job").
- **Section A — Jobs & flashing (PM-editable):** a compact list/table of active
  Jobs showing name, location, and an **inline-editable `flashingMaterial`** field
  (commit on blur, like `JobcodeCell` in `jobs.tsx`, calling
  `updateJob(job.id, { flashingMaterial })`). Read-only for everything else. Only
  show `status === 'Active'` jobs (PMs scope active work).
- **Section B — Jobcards backlog:** list of existing jobcards (newest first),
  each showing title, parent Job name, priority badge, and an
  **Assigned / Unassigned** indicator (unassigned = no row in `assignments` for
  that jobcard). This gives the PM feedback that their card reached the backlog.

### Create-Jobcard modal — `src/components/desktop/CreateJobcardModal.tsx` (new)

Model it on `CreateJobModal.tsx` (same `Modal` + overlay + `FormInput` +
`InlineSelect` + actions styling). Fields:

| Field | Control | Notes |
|---|---|---|
| **Parent Job** | `InlineSelect` of active Jobs (`value`=jobId) | **Required.** On change, look up the Job's `flashingMaterial`. |
| **Flashing material** | read-only display row | Auto-filled from the selected Job; shows "Inherited from <Job name>" or "None set on this job". Not an input. |
| **Title** | `FormInput` | Optional; default to something sensible if blank (e.g. the Job name + " — Jobcard"). |
| **Priority** | `InlineSelect` (`Low / Medium / High`) | Default `Medium`. |
| **Materials needed** | `FormInput` (multiline ok) | Optional. |
| **Scope of work / work required** | `FormInput` (multiline) | Optional. |
| **Scheduled date** | date input (`yyyy-MM-dd`) | Optional — the Scheduler sets the real date when assigning. If your stack lacks a date picker, a `FormInput` validated to `yyyy-MM-dd` is fine; default to today. |

Validation: parent Job required. On submit call:

```ts
addJobcard({
  jobId,
  title: title.trim() || `${jobName} — Jobcard`,
  address: job.location,        // seed address from the Job's location
  date,                          // yyyy-MM-dd
  priority,
  materials: materials.trim() || undefined,
  scopeOfWork: scope.trim() || undefined,
  details: { generalContractor: '', managerName: '', managerPhone: '' },
});
```

`addJobcard` (Step 1) snapshots the parent Job's `flashingMaterial` — **do not**
pass flashing from the form; let the store inherit it (single source of the
inheritance rule). Show a `Toast` ("Jobcard created") and close on success.

> The `details` GC/manager fields aren't in the blueprint's PM inputs; pass empty
> strings (the installer detail screen already tolerates them). Don't add them to
> the PM form unless the user later asks.

---

## RBAC / constraints

- Wrong role → `<AccessDenied />`.
- PM may write **only** `Job.flashingMaterial` — never expose `qbtJobcodeId`,
  name, location, or status as editable on this screen.
- "Unassigned backlog" is derived (no assignment row), not a stored flag. Don't
  add a status field for it.
- Don't build crew/scheduling UI here — that's Step 4.

## Files touched / created

- `src/app/(desktop)/pm.tsx` — full PM dashboard (replaces placeholder).
- `src/components/desktop/CreateJobcardModal.tsx` — **new**.
- (Reuse `FormInput`, `InlineSelect`, `Toast`, `AccessDenied`; no store changes if
  Step 1 added `addJobcard`/`updateJob`.)

## Definition of Done

- [ ] PM role renders the dashboard; other roles get `<AccessDenied />`.
- [ ] Selecting a parent Job auto-shows its flashing; created card snapshots it.
- [ ] Priority/materials/scope persist on the created Jobcard.
- [ ] PM can edit a Job's `flashingMaterial` inline and nothing else on the Job.
- [ ] New cards show as "Unassigned" until Step 4 assigns them.
- [ ] `npx tsc --noEmit` clean; no new lint errors.
