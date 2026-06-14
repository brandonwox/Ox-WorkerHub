# Step 6 — Operator Gap-Closure & Financial Sync

**Goal:** Close the small remaining Operator gaps from the blueprint and wire the
**financial lifecycle** correctly. Three changes:

1. Expose the Job's `flashingMaterial` to the Operator.
2. Resolve a Timesheet's QuickBooks Time jobcode from the **parent Job's
   `qbtJobcodeId`** (Timesheet → Jobcard → Job), so the push bundles hours under
   the right code.
3. **Remove the in-app approval gate.** Timesheets are **auto-approved** on
   creation and **auto-pushed** by the weekly server sweep; the payroll manager
   reviews and approves them **inside QuickBooks Time**, not in this app. The
   Operator's timesheet screen becomes **read-only visibility**.

**Prerequisites:** Step 1 (Job flashing) and Step 2 (so jobcards have parent Jobs
in the data). Steps 3–5 don't block this, but make the data realistic.

**Read first:** `Step-0-Overview.md`, and the QBT integration notes in
`docs/quickbooks-time-setup.md`.

---

## Current state (Operator is mostly built)

- **Jobs** (`(desktop)/jobs.tsx`): create/edit, inline `qbtJobcodeId`, Active/
  Archived status. ✅ Already matches blueprint §2.A except it doesn't expose
  `flashingMaterial`.
- **People** (`(desktop)/people.tsx`): roster, role assignment, installer-only
  `hourlyRate` (hidden from non-installers), add-worker invite. ✅
- **Timesheets** (`(desktop)/review.tsx`): review queue, edit times/project,
  `reviewStatus` pipeline `pending → approved → synced`, "Send to QuickBooks",
  "Next push: Monday 07:30" banner. ⚠️ The approval/Send controls are being
  **removed** (Change 3) — the screen becomes read-only visibility.
- **QBT jobcode resolution** (`src/store/useAppStore.ts` → `jobcodeKeyFor`,
  `qbt.jobcodeMap`, `defaultJobcodeId`): currently keys by `jobcard:<id>` or
  `custom:<name>` — it does **not** climb to the parent Job's `qbtJobcodeId`.

So this step is **three targeted changes**, not a rebuild.

---

## Change 1 — Expose Job `flashingMaterial` to the Operator

The Operator owns the Job and creates it; they should be able to set the site-wide
flashing too (the PM can also edit it — Step 3).

- **Create Job modal** (`src/components/desktop/CreateJobModal.tsx`): add a
  `FormInput` for **"Flashing material (site-wide)"** (optional), and include
  `flashingMaterial` in `NewJobInput` and the `onSubmit` payload.
- **Jobs table** (`(desktop)/jobs.tsx`): add an inline-editable flashing cell
  (same `JobcodeCell`-style commit-on-blur) calling
  `updateJob(job.id, { flashingMaterial })`, OR show it read-only if you prefer to
  keep editing in the PM screen. At minimum it must be **settable at create time**.

This is the only Operator UI gap. People and Timesheets need no changes.

---

## Change 2 — Resolve QBT jobcode through the parent Job

Per the blueprint financial lifecycle, approved hours sync under
**`Job.qbtJobcodeId`**. Today a log points at a `jobcardId` (or a custom name), and
jobcode lookup uses the jobcard/custom key. Make Job the source of the code.

Update the jobcode resolution used by the sync layer
(`src/integrations/quickbooksTime/sync.ts` and/or the `jobcodeKeyFor` /
`qbt.jobcodeMap` logic in `useAppStore.ts`) with this **precedence**:

1. If the log has a `jobcardId` → find the Jobcard → find its `jobId` → if that
   `Job.qbtJobcodeId` is set, **use it** (this is the blueprint's intended path).
2. Else fall back to the existing explicit `qbt.jobcodeMap[jobcardKey]`.
3. Else fall back to `qbt.defaultJobcodeId`.
4. Custom-named logs (no jobcard) keep the `custom:<name>` map / default behavior.

Add a small resolver, e.g.:

```ts
/** The QBT jobcode id a log should post under, climbing log → jobcard → job. */
export function resolveJobcodeId(
  state: { jobcards: Jobcard[]; jobs: Job[]; qbt: { jobcodeMap: Record<string, number>; defaultJobcodeId?: number } },
  log: Pick<TimesheetLog, 'jobcardId' | 'customProjectName'>
): number | undefined;
```

Wire `submitLog` / the push payload to use `resolveJobcodeId` instead of going
straight to `jobcodeKeyFor` → map. Keep `jobcodeKeyFor` for the custom-name path.

> **Note on timing:** per project memory, per-clock-out auto-push was removed; the
> real push is a **weekly server-side sweep (Mondays 07:30)** that will live in a
> Supabase Edge Function (Step 7). There is **no manual "Send to QBT"** anymore
> (see Change 3) — the sweep auto-pushes every un-synced (auto-approved)
> timesheet. This step makes the **jobcode that payload will use** correct; the
> actual network push stays idle until Step 7 moves it server-side.

---

## Change 3 — Auto-approve timesheets; make the Operator screen read-only

Approval moves entirely to QuickBooks Time. The payroll manager reviews and
approves incoming timesheets **inside QBT**. In this app, a logged timesheet is
**approved the moment it's created** and waits only to be pushed by the weekly
sweep. The Operator no longer approves anything — they just *see* the hours.

**Store / types (`src/store/useAppStore.ts`, `src/types.ts`):**

- A timesheet is created **already approved**. In `clockOut` and `addLog`, set
  `reviewStatus: 'approved'` (was `'pending'`).
- Editing a log (`updateLog`) must **not** drop it back to `'pending'`; keep it
  `'approved'` (an edit just re-arms the QBT sync — the existing `qbt.sync`
  flip-to-`unsynced` already handles re-push).
- Collapse `ReviewStatus` to **`'approved' | 'synced'`** (drop `'pending'`).
  `'approved'` = logged, not yet pushed. `'synced'` = the weekly sweep has pushed
  it to QBT. (Per-log QBT-side state — submitted/approved-in-QBT — already lives
  in `qbt.sync`, untouched.)
- **Remove `setLogReviewStatus`** (the manual approve action) — nothing should
  set `'pending'` anymore. Keep `sendApprovedToQbt`, but it is no longer wired to
  a button; it is the function the weekly sweep (Step 7) calls to flip
  `approved → synced`. (Optionally rename it to reflect "the sweep ran", but a
  rename is not required.)

**Screen (`src/app/(desktop)/review.tsx`):**

- Remove the **"Send to QuickBooks"** button and the per-row **Approve** button.
- Remove the `Pending` filter/tally; the remaining states are `Approved` and
  `Synced` (plus `All`).
- Reword the banner to make clear the push is automatic and **approval happens in
  QuickBooks Time** (e.g. *"Hours sync to QuickBooks Time automatically — next on
  {date}. Your payroll manager reviews and approves them in QuickBooks Time."*).
- Keep the read-only grouping by worker, hours, and earned totals. **Editing
  times stays allowed** (the Operator can correct an obvious error before the
  sweep); it is not an approval action.

## Constraints

- Don't redesign People — it already meets the spec.
- `hourlyRate` must remain **installer-only and hidden** from other roles
  (already true — don't regress it).
- Don't push hours per clock-out; keep the weekly-sweep model.
- **No in-app approval.** Nothing in the app sets `'pending'` or asks the Operator
  to approve; approval is QuickBooks Time's job.
- Operator may edit `qbtJobcodeId`; PM may not (keep that field off the PM screen).

## Files touched

- `src/components/desktop/CreateJobModal.tsx` — flashing field + payload.
- `src/app/(desktop)/jobs.tsx` — inline flashing cell (or read-only display).
- `src/integrations/quickbooksTime/sync.ts` and/or `src/store/useAppStore.ts` —
  `resolveJobcodeId` (log → jobcard → Job → jobcode) + wiring.
- `src/types.ts` — `ReviewStatus` collapses to `'approved' | 'synced'`.
- `src/store/useAppStore.ts` — auto-approve in `clockOut`/`addLog`; drop
  `setLogReviewStatus`; `updateLog` keeps `'approved'`.
- `src/app/(desktop)/review.tsx` — remove approve/Send controls → read-only.
- `src/data/mock.ts` — seed logs use only `'approved' | 'synced'` (no `'pending'`).

## Definition of Done

- [ ] Operator can set a Job's `flashingMaterial` (at least on create).
- [ ] `resolveJobcodeId` climbs log → jobcard → parent Job's `qbtJobcodeId`, with
      map and default fallbacks; custom-named logs still resolve.
- [ ] The QBT push path uses the resolver.
- [ ] Timesheets are created `'approved'`; `ReviewStatus` has no `'pending'`; no
      in-app approve/Send controls remain. The screen is read-only visibility.
- [ ] `hourlyRate` still hidden from non-installers.
- [ ] `npx tsc --noEmit` clean; no new lint errors.
