# Dev Tracker — DONE
Completed edits, newest first — moved out of Dev-Tracker.md to keep the working file small. (Agents: when an Awaiting edit from Dev-Tracker.md is implemented, log it at the TOP of this file, same style as the entries below.)

Crew assign now schedules an unscheduled work request (scheduler, web): picking a crew from the work request's crew square no longer warns "Not on the calendar yet…" — it assigns the crew AND schedules the request on its target date, moving it off the Work Requests pool/calendar onto the main crew calendar (the day it showed under in the work requests calendar is the day it lands on). Works in "Assign Multiple" mode too; the success pill notes the scheduled day. Also in this batch: the DONE log moved from Dev-Tracker.md into this file.

Pass 10 — Events removed + multi-day (stretched) work requests + Assign Multiple in the crew menu (REQUIRES: apply the new drop-calendar-events Supabase migration — it deletes the calendar_events table; NO migration needed for multi-day, the existing schedule_assignments schema already allows one row per request/crew/day):
- EVENTS REMOVED ENTIRELY (work requests untouched): the "+ Event" toolbar and day-sidebar buttons, the event popup, the calendar/day-sidebar event chips, the installer-agenda pinned day notes, the store actions, the offline cache slot, the realtime subscription, the mock seed, and the calendar_events table are all gone. The separate Awaiting note asking for events to be drag-droppable / backlog-creatable was superseded by this removal and moved here with it.
- MULTI-DAY WORK REQUESTS (Google-Calendar style, per the provided screenshot): a scheduled request can be STRETCHED across consecutive days — never split. Data model: one schedule_assignments row per crew per covered day (so the day sidebar, installer agendas, and mobile calendars show the request on every covered day with no extra logic); the scheduler month calendar merges a request's contiguous days into ONE continuous bar overlapping the day-cell borders (week-aligned segments; a span crossing a week boundary squares off the continuing edge; overlapping bars stack in lanes and that week's single-day chips start below them).
- STRETCHING: every placed chip/bar grows a small grip on its right edge (web scheduler only) — drag it onto any calendar day to set the stretch's END day (dropping before the start collapses back to a single day). Dragging the bar itself MOVES the whole stretch: a 3-day request stays 3 days wherever it lands (drop day = new start). Unassigning (×, or dropping on the Work Requests pool) removes the whole stretch from every crew — the mobile scheduler's × now fans out the same way so a span can never be left half-removed. The quick view's calendar row shows the full range ("August 10 – August 12").
- ASSIGN MULTIPLE (work request crew square): the crew dropdown in the quick view has an "Assign Multiple" button at the bottom; while active the menu stays open and clicking crews toggles them onto/off the card (assigned crew click = unassign; the card's scheduled days are kept for every crew). Removing the LAST crew this way is refused — that's the unassign flow's job.

Pass 9 — Field Super assignment overhaul + drag-selection fix (REQUIRES: apply BOTH new Supabase migrations — field-super-assignment and field-super-edit-all; the app now orders assignments by the new job_field_supers.assigned_at column, so jobs will not load against the old schema). REVISED in-session: assignment now records RESPONSIBILITY only — it no longer gates what a field super can see or do:
- SCHEDULERS ASSIGN FIELD SUPERS: the scheduler's Create job form now has the same Field supers picker the Operator gets (multi-select; RLS widened from operator-only to operator + scheduler on the assignment table, so schedulers could also be given post-creation assignment UI later without another migration).
- FIELD SUPERS SEE + EDIT EVERY JOB (decision revised mid-pass from "view-only until assigned"): every job and all of its content — work requests, photos, issues, documents — is fully visible AND editable to any field super, assigned or not, so one can help on another's job for a day without an assign/unassign dance. The ONLY thing still assignment-gated is DELETING a job (the responsible supers' call). Sub-job creation also opened to any parent for them.
- ALL JOBS TOGGLE (field-super jobs pages, web + mobile): the jobs lists still show ONLY assigned jobs by default; an "All jobs" toggle widens to every job, and with it on each row also shows the field supers assigned to that job.
- SELF-ASSIGN: viewing a job they're not assigned to (web sidebar + mobile job details) shows an "Assign myself to this job" button — taking responsibility puts the job on their default list and into the displayed-super lineup (queues offline; RLS lets a field super insert/remove only their OWN assignment row).
- MULTIPLE FIELD SUPERS PER JOB (rule change): the displayed name on job details (mobile page + web sidebar) is now the FIRST-assigned field super still on the job — if they're unassigned, the next-oldest takes over. Backed by the new assigned_at column (clock_timestamp so same-statement adds stay ordered); the Operator's assignment edits now diff instead of delete-all-then-reinsert so surviving supers keep their original assignment date.
- DRAG-SELECTION FIX (scheduler board): dragging a chip no longer sweeps text selection across the page — text selection is disabled on the document for the duration of the drag (and whatever got selected during the first few pre-drag pixels is cleared), restored on drop/cancel.

Pass 8 — Crews overhaul (REQUIRES: apply the new crew-colors-one-crew Supabase migration — it adds the color columns AND enforces one permanent crew per installer with a unique index; installers currently on several crews are kept only on their OLDEST crew, the rest are dropped, and a crew whose foreman was dropped that way gets re-flagged in Manage Crews):
- CREW COLORS: schedulers pick a color per crew (permanent AND daily) from a 16-swatch row in Manage Crews — the leading dashed "A" swatch returns the crew to the automatic palette assignment. The picked color drives every colored surface (calendar chips/tints, crew filter chips, work request crew squares, mobile calendar). Stored on crews.color / daily_crews.color.
- ALPHABETICAL EVERYWHERE: crews had NO database ordering (that's why lists "got unorganized easily") — the store now sorts crews alphabetically (daily crews by name, then date) at every point they enter state, so every crew list on every surface stays sorted, and the automatic palette color (keyed by list position) stays stable too.
- MANAGE CREWS MEMBER PICKER: crew blocks no longer list every installer — only the crew's members show (tap a chip to remove), with a dashed "+ Add" chip that unfolds the addable roster.
- ONE PERMANENT CREW PER INSTALLER (this was never actually enforced): the add picker shows installers already on another permanent crew as disabled with "· on A" so the scheduler deselects them there first; the store drops violations as a backstop; and the DB unique index makes it impossible to bypass. Daily crews stay exempt (any number, alongside the regular crew).
- DAILY CREW NAMES: up to 20 characters (decision changed in-session from the tracker's 10), free text, no forced uppercase. Permanent crews keep the single-letter rule.

Pass 7 — Layout Plans: Shower plans + document editing + polish (REQUIRES: apply the new shower-layout-document-editing Supabase migration — it adds jobs.shower_layout_not_needed + the 'shower_layout' doc type, widens document delete RLS, and contains the document-upload bug fix):
- SHOWER LAYOUT PLANS (requested in-session alongside this pass): Showers-scoped jobs now run the identical layout-plan flow as Windows and Mirrors — the "The installers need an image of the shower layout." warning on the job details page (mobile + web sidebar), the same + assignment menu, a "Shower Layout Plans" document type (shows in the Documents type chips and tags), and a "Shower layout plans not necessary" escape hatch (office-only flag, like the other two).
- DOCUMENTS EDITABLE + DELETABLE: each document row gains a pencil (edit title / body / type in the same form, prefilled; the file itself isn't replaceable — delete and recreate for that) and a two-tap trash (arms red, disarms after 4s). Available to the creator, the Operator, and Field Supers on their jobs (RLS widened to match for delete). Edits/deletes queue offline like other metadata writes. Deleting a job's last layout-plan document brings its warning banner back automatically — unless "layout plans not necessary" was chosen, which stays dismissed.
- UPLOAD FAILURE FIXED ("Document upload failed — check your signal and retry"): root cause found — document files upload with upsert, which Postgres executes as INSERT ... ON CONFLICT DO UPDATE and therefore needs INSERT + UPDATE + SELECT policies on storage.objects; the job-documents bucket only had INSERT + DELETE. This is the exact bug fixed for the job-photos bucket on 2026-07-10; the fix never reached this bucket. The migration adds the two missing policies.
- PICKER POLISH: the layout-plan + button is now a small neutral bordered rounded-corner button (was a big solid-blue pill); the Take photo / Upload Image / Choose from Job images / Choose from Job documents options (and the document list rows) highlight on hover; the "…layout plans not necessary" text brightens on hover so it reads as clickable; the "Choose a job image" popup is wider with 3-across (much larger) thumbnails.

Pass 6 — Flashing material gating + work request creation flow (no DB migration needed):
- FLASHING GATE ON CREATION: the missing-flashing warning no longer shows up front — it appears only after the Create button is clicked, above the buttons: it says to type a flashing material into the work request's own Window Opening Flashing Material field (visible once the Windows scope is added) OR set it in the parent job's details. Typing one either place clears the warning on its own and unblocks creation (a value typed on the work request satisfies the requirement — the job's own material can stay unset). The missing-jobsite-address warning keeps its old immediate behavior.
- JOB DETAILS WARNING: a windows-covering job with no flashing material set now shows a plain warning row under the job header ("No Window Opening Flashing Material set — work requests can't be created for this job until it is") on the mobile job details page and the web job dashboard sidebar — shown only to the roles that can fix it (Field Supers, Operator, Schedulers). Verified flashing surfaces stay hidden for jobs whose scopes exclude Windows (already the case everywhere).
- SCHEDULER EDIT BUTTON: schedulers now get the top-right Edit pencil on the job details sidebar (jobs pages, work requests pages, calendar) — scoped to what their DB guard allows: the flashing material text + reference photo, on windows jobs only. Address/counts stay read-only for them (widening that needs a migration and wasn't asked).
- "+ WORK REQUEST" ON JOB PAGES (web Field Supers + Schedulers): the job details sidebar's Work Requests section header has a "+ Work Request" button. It opens the standard creation form as a POPUP shifted left of the sidebar (not in the sidebar itself), pre-linked to the job being viewed (the picker still allows adding the rest of its family). Available from the jobs pages, the work-requests pages' stacked job view, and the calendar's job view; the Operator doesn't get it.
- AUTO FIRST TASK: on creation, typing the work request's title auto-creates the first task with the same text. It keeps following title retypes until the task is edited or another task exists — then it's the user's.

Pass 5 — Job/sub-job deletion + work request creation overhaul (REQUIRES: apply the new wr-multi-jobs-standalone-job-delete Supabase migration — adds work_requests.job_ids, opens jobs DELETE to schedulers + assigned field supers, and lets field supers see/write standalone (null-job) work requests):
- DELETE JOBS/SUB-JOBS: the job details sidebar's options (…) popup now has a "Delete this Job/Sub-Job…" entry with a confirm step (copy spells out the cascade: sub-jobs + their work requests go too). Available to schedulers (any job), field supers (their jobs), and the operator (who also keeps the type-to-confirm delete in the Edit job popup). The popup now opens on sub-jobs too (delete only — the Sub-Jobs toggle stays parent-only). Both roles could already create jobs/sub-jobs/work requests; deletion was the missing piece.
- STANDALONE WORK REQUESTS: creation has a "No parent job — standalone work request" checkbox; with it on, the job picker hides and the address line becomes a typed field (required). Standalone cards show "No parent job" where the parent name would be and appear on every work-requests surface (they belong to no one's job list).
- PO-FIRST JOB PICKER: the creation job picker lists jobs as "PO <po>" (name shown only for legacy jobs without one) and searching matches PO or job name.
- MULTI-SUB-JOB LINKS: the job picker is now a multi-select. Either one job, or several members of ONE family — sibling sub-jobs of the same parent, optionally that parent itself; after the first pick the dropdown only offers the rest of that family, so two different parents are impossible. Stored as work_requests.job_ids with job_id staying the primary link (parent first when included) — FK cascade, Field Super scoping, and legacy cards all keep working. Multi-linked cards read "Parent Lot 2, Lot 5" everywhere (work request lists, quick view, scheduler backlog/calendar/day sidebar, mobile lists), count toward every linked sub-job's work-request counts, and appear on each linked job's details page. Deleting a linked sub-job only unlinks it from the card; deleting the primary job still deletes the card.

Pass 4 — PO numbers + job pages overhaul (REQUIRES: apply the new job-po Supabase migration — the app reads/writes the new jobs.po column):
- PO ON CREATION: every job and sub-job creation form (operator create, scheduler/field-super web create, field-super mobile create sheet, and the New Sub-Job modal) has a required "PO" input on the same line as the name — creation is blocked until both are typed. The Operator's Edit job popup can fix a PO afterwards (name + PO share the line there too). DB guards: installers, schedulers, and finance managers can't change a PO after creation (schedulers still create jobs WITH one); Operators and Field Supers can.
- PO IN SEARCH: every search that matches job names now matches POs too — the operator/scheduler/field-super web jobs pages, the sub-job searches (web sidebar + mobile job details), the installer Jobs tab, and the work-request searches that match parent job names (desktop Work Requests screen + field-super mobile). Placeholders updated to say PO.
- JOBS LISTS: rows on every job list (web jobs pages, operator/field-super mobile lists, installer Jobs tab, finance manager cards, and the Sub-Jobs sections' rows) show the job's PO in a faded style, and any job with "This job has Sub-Jobs" active leads with a faded, lighter-weight "Master Folder" label in front of its name.
- JOB DETAILS HEADERS (mobile page + web sidebar): the PO shows directly under the job name, smaller than the name. On a sub-job's details, the parent job's name (still a link back to the parent) now sits on the SAME line as the sub-job's name with a dot between them, instead of stacked above.
- SECTION CARDS: on job and sub-job details (mobile + web sidebar), the active section's card no longer hides — all cards (Sub-Jobs / Issues / Documents / Work Requests) stay visible at all times and the active one is highlighted with an accent border; its section still renders below, one at a time.

Pass 3 — Unified scopes + counts for every scope + videos/SGD tagging + Pictures filters (REQUIRES: apply the new scopes-counts-videos Supabase migration, and run npm install after pulling — adds expo-video):
- SCOPES: the selectable set is now Windows, Mirrors, Showers, Swing Doors, Screens, IGU's, Storefront, Service — the SAME list everywhere (jobs, sub-jobs, work requests; the planned "work-request-only" split was dropped by decision). 'Showerglass Door' was renamed to 'Showers' (legacy rows are mapped on read and rewritten by the migration). 'Service' predates this pass and was kept.
- COUNTS for every counted scope: Shower, Swing Door, Screen, and IGU counts join Window/SGD/Mirror — each a done/total pair shown once its total is set (job details page, web sidebar, and every work request of the job). Which pairs are EDITABLE follows the job's scopes (Window + SGD both belong to Windows; Storefront/Service carry no counts); the office edit surfaces (web sidebar Edit mode + mobile field-super editor) are now generated from one shared definition list instead of hand-rolled per pair. Totals stay office-set, installers write only done numbers, schedulers/finance neither (DB guards updated).
- COUNT WHEEL: on phones, updating an "amount done" now scrolls an iOS-style number wheel (0 to the total, pre-set to the current done); web keeps the typed input.
- VIDEOS: the in-app photo taker has a PHOTO/VIDEO mode toggle — recordings (1080p, 2 min cap, red shutter → square while recording) enter the same offline upload queue as photos and upload as .mp4 (the job-photos bucket now allows video mime types and 200 MiB). The "Upload Images" pickers (work request, job pages, web sidebar, issues) now accept videos alongside photos too — picked videos over the 200 MB cap are refused up front with a warning instead of failing after queueing, and iOS delivers library videos in their most compatible representation (HEVC transcodes to H.264 on export, so they play in desktop browsers too). Video tiles show a play icon in the grids; the viewer plays them with native controls (new expo-video dependency). Camera + mic permissions both prompt (a denied mic records muted).
- SGD VIDEOS: leaving the camera of a Windows-scope work request with videos taken opens "Were any SGD videos taken?" — checkable video list; button reads "No SGD videos taken" until one is checked, then "Confirm". Checked videos carry an SGD tag (queues offline like a note edit; the taker owns the row per RLS).
- PICTURES FILTERS: the job (and sub-job) Pictures sections — mobile page + web sidebar — gained filter chips: All, one chip per scope that actually has photos (a photo's scope = its work request's scopes; photos not taken from a work request only show under All), plus "SGD Videos". The row hides when there's nothing to filter.
- TASK PHOTOS IN THE TASK: photos/videos taken for a task now show as a thumbnail strip inside that task on the mobile work request page AND the web quick view (still in the Photos section too).

Pass 2 — Scheduler calendar: drag & drop, Events, backlog calendar upgrades (REQUIRES: apply the new calendar-events Supabase migration — events won't load/save without it):
- EVENTS: schedulers create simple day notes ("+ Event" button on the calendar toolbar, and one inside the day sidebar pre-filled with that day) — title, optional description, date. On the calendars an event renders like a work request chip (rounded rectangle with title) in a neutral crew-less style; clicking it opens a popup showing ONLY date/title/description, where schedulers edit or delete it (two-click confirm). Field supers see events read-only on their shared calendar, and installers see the day's events pinned above their agenda list. Events live in a new calendar_events table (everyone reads, schedulers write), sync over realtime, cache offline, and queue writes like everything else.
- DRAG & DROP (scheduler web console; field supers and mobile keep tap flows): press-and-drag any chip — a ghost follows the cursor, the hovered day highlights with an insertion line, release drops it. Works from/to the main calendar's day cells, the day sidebar, the Work Requests list, and the expanded Work Requests calendar:
  - within a day: drop between two chips to reorder (day stacks now sort by priorityOrder; work requests and events share the ordering).
  - day → any day (including across the two side-by-side calendars): the request moves — every crew assignment follows to the new date, landing at the drop position.
  - Work Requests pool → a crew-calendar day: assigns to the current active crew(s), exactly like the Schedule button (warns when no crew is targeted).
  - calendar → the Work Requests column: unassigns from every crew (back to the pool). Dropping on a specific day of the expanded pool calendar also moves the request's target date; day → day inside the pool calendar just retargets.
  - events drag between days; the pool refuses them (a hint flashes). A drop outside any valid zone snaps back and changes nothing. A plain click (no movement) still opens the chip as before.
  - known limits: dragging can't scroll the page or flip months mid-drag (drag between months by putting the two calendars on different months), and drop positions are measured when the drag starts — scrolling mid-drag isn't supported.
- the Work Requests calendar now shows EVERY unassigned request, including not-ready ones (muted, with a small "Not ready" tag) — so schedulers see what's coming without mistaking it for schedulable work.
- expanding the Work Requests calendar now splits the board 50/50 with the main crew calendar (it used to dwarf it), since dragging between the two needs both usable.
- the old click-to-place "Schedule" flow, multi-crew assign, and crew colors are unchanged.

Pass 1 — Work Requests rename + readiness + status overhaul + crew foremen (REQUIRES: apply the new work-requests Supabase migration — the app now reads/writes the renamed work_requests table and the new status/foreman columns, so it will not run against the old schema):
- jobcards are now "Work Requests" EVERYWHERE: all user-facing text, the web routes (/scheduler-work-requests, /field-super-work-requests, and the detail page moved from /job/<id> to /work-request/<id>), the codebase (components, store actions, types — WorkRequest*, workRequestId, …), and the DATABASE (public.jobcards → public.work_requests; every jobcard_id column, constraint, RLS policy, trigger, and guard function renamed; old notification rows remapped). Decision on renaming code identifiers: YES — the app is pre-production, so code, DB, and product language stay in lockstep; nothing legacy remains to confuse future work. (Old on-device caches/outboxes from before the rename are treated as a miss and refill on the next online open.)
- "Ready for installers" options are now "Yes" / "No" / "Soon" (legacy Now → Yes, Over 2 Weeks → No — mapped on read and by the migration). Only "Yes" requests sit in the schedulers' backlog pool; the "Not ready yet" collapsed section keeps the rest visible, and the mobile scheduler backlog gained the same split.
- statuses: new default "Undefined" until someone reports one (creation no longer starts at Untouched); "No progress" removed (legacy rows re-read as Undefined). Picking Untouched or False Start opens a required popup — "Why was this Work Request untouched / a false start?" — and the typed reason is saved on the request with who/when; both the scheduler and field super Overview dashboards got an "Untouched & false start reasons" review section (the reason also shows under the status in the web quick view). Marking Finished opens a popup: "Everything done, nothing left." / "Everything but sheetrock" (offered ONLY when the request has the Windows scope) / custom text.
- crews: new Foreman tag — the scheduler must pick exactly ONE foreman per permanent crew (Manage crews enforces it on create, and flags existing crews that still need one; deselecting the foreman from the crew clears the tag and re-flags). Daily crews have no foreman. Stored on crew_members.is_foreman with a DB at-most-one guard.
- 3:30 PM daily sweep: any work request scheduled today or yesterday whose status is still "Undefined" notifies ONLY the assigned crew's foreman ("A work request status needs updating" + the request name; for a daily crew, any member who is a permanent-crew foreman). One reminder per request per day across sessions (a date stamp on the row prevents re-pings). Separately, when an installer whose crew has such requests opens the app (yesterday's, or today's after 3:30), a catch-up popup lists them with an inline status selector per request — Untouched / False Start / Finished route through the same reason/completion popups.

left sidebar restyle (web console):
- the active page's blue highlight is gone — it's now a neutral gray rounded background, with the label/icon in the primary text color instead of blue.
- nav icons switched from Feather to lucide: CalendarDays (calendar pages), Briefcase (jobs), NotepadText (jobcards), Settings, plus FileText (timesheets), Users (people), and LayoutDashboard (the new Overview). Icons were already inline to the left of each label. The mobile tab bar keeps its existing icons.

"Overview" page for schedulers and field supers (web console page + mobile tab, shared content):
- it is now BOTH roles' landing page on web (sign-in lands on Overview instead of calendar/jobcards); on mobile it's the first tab but the app still opens on the existing home tab.
- scheduler overview: stat tiles ("Now" priority count, work requests ready — tappable, jumps to the calendar/backlog — and finished this week), then a list of every jobcard at "Now" priority (escalated cards flagged), a work-request summary line (ready vs not ready yet), and the jobcards marked Finished this week.
- field super overview (scoped to their jobs): stat tiles (jobcards with open issues, false starts this week), then their jobcards with open issues (open-issue count badge, newest issue snippet + date) and this week's false-start jobcards.
- "this week" uses the card's scheduled day in the current Mon–Sun week — the same proxy as the false-starts counter (there's no status-change timestamp).
- clicking a jobcard opens the quick-view sidebar on web / the jobcard page on mobile.

scope-driven job counts (REQUIRES: apply the new job-scope-counts Supabase migration):
- Windows-scoped jobs (and sub-jobs) carry "Window Count" and "SGD Count" details; Mirrors-scoped jobs carry "Mirror Count". Each is a done/total pair always displayed as "0/100".
- shown on the job details page (mobile + web sidebar) and on every jobcard of the job; totals are office-edited (Operator / Field Supers, in the sidebar's Edit mode and the mobile editor).
- installers tap the count on a jobcard to open a popup that updates the amount done (current done pre-filled grayed out, total shown on the right); RLS lets installers write only the done numbers.

Window/Mirror Layout Plans documents (REQUIRES: apply the new layout-plan-documents Supabase migration — it also fixes a regression in the uncommitted job-scope-counts migration that accidentally re-blocked flashing-material edits for installers/schedulers/finance):
- Field supers on a Windows-scoped job with no assigned "Window Layout Plans" see a plain-text warning below the field super names ("The installers need an image of the window layout.", no background/border) on both the mobile job details page and the web job dashboard sidebar, with a clearly-a-button + button.
- The + button offers: Take photo (native only) / Upload Image / Choose from Job images / Choose from Job documents / "Window layout plans not necessary" (bottom, muted). The first three create a new photo document that MUST be given a label (e.g. "West face"); choosing an existing document retags it as the layout plan; "not necessary" flags the job and stops the warnings. Any one of these clears the warning.
- Mirrors-scoped jobs get the identical flow for "Mirror Layout Plans".
- New documents have an optional Type selector ("Window Layout Plans", "Mirror Layout Plans", "Window Flashing Example"); typed documents show the type label above their title in the Documents list so installers can spot the right plan fast.
- The retag write queues offline like other metadata writes; new layout-plan images upload immediately like other file documents.

the "window flashing material" pre-filled text now says "regular rainbuster" everywhere it was still something else (sub-job creation placeholder, web sidebar edit-mode placeholder, and the dev-mode mock values that showed "Clear Anodized Aluminum" / "Stainless Steel"). The mobile field-super editor and jobcard quick view already said it.

settings & account surfaces:
- web top bar: the logout button is now a profile chip (initials avatar + name) that opens the Settings page; Sign out moved to the bottom of that page. The Developer role switcher stays in the top bar.
- Change Password is now a button that opens a popup (new password + confirmation, 6+ chars, must match) and ACTUALLY changes the password via Supabase auth — the old inline "New password" field was silently discarded and never worked. In dev-switcher mode (no real session) the button is replaced with a hint.
- email is no longer editable anywhere: the Settings profile form and the Operator's Edit worker popup both show it read-only (it's the Supabase sign-in identity — editing only the profile row would break sign-in; a wrong email means remove + re-invite). Name/phone editing unchanged.
- scheduler mobile check: schedulers DO have a mobile view — Calendar (with assign), Backlog, Settings. Missing vs their web console: the Jobcards page and the new Jobs page (job dashboards + creation). Building those two tabs would bring scheduler mobile to parity.

top-level job creation for schedulers + field supers (REQUIRES: apply the new top-level-jobs Supabase migration — creations are rejected server-side without it):
- field supers (web Jobs page + mobile Jobs tab) and schedulers (a NEW web "Jobs" nav page between Calendar and Jobcards) get a "Create job" button: job name, jobsite address, scopes — no QBT jobcode (the Finance Manager fills it in later; the job lands in their amber missing-ID list) and no field-super picker.
- a field super who creates a job is auto-assigned to it (DB trigger + mirrored locally) so it stays visible in their scoped views.
- the migration widens the jobs INSERT policy (schedulers: any job; field supers: top-level jobs, sub-jobs still only under their own) and DB-enforces that non-operator creations leave the QBT jobcode and labor budget empty.
- the scheduler's new Jobs page lists every top-level job with search + the job dashboard sidebar; job fields stay read-only for them, but they can now toggle "This job has Sub-Jobs" and create sub-jobs from here (the DB always allowed it — there was just no scheduler UI for it before).

jobcard ↔ job navigation + display fixes:
- the parent job name on a jobcard is now clickable: on jobcard pages it opens the job details sidebar stacked over the jobcard sidebar with a back arrow (top-left) returning to the jobcard; from a calendar popup (scheduler + field super) it opens the job details over the popup, back (or clicking outside) returns to the still-open jobcard. Field supers get the editable job view; schedulers get read-only.
- mobile field super Jobs tab: tapping a job now opens its job details page; the chevron alone expands the inline address/flashing editor (the redundant "Job pics" button was removed since the row tap goes there).
- monthly calendar + day sidebar crew tags: legacy crew names like "Crew A" now render as just "A" (leading "Crew" prefix stripped; single-letter names unchanged).

job details page — sub-jobs section + sidebar editing (web + mobile):
- Sub-Jobs is now a 4th section card next to Issues / Documents / Jobcards (leading the row, only on parent jobs with sub-jobs enabled). One section is always open and clicking another card cycles to it — Sub-Jobs opens by default when the job has sub-jobs, otherwise Issues opens by default.
- the sub-jobs list collapses to 3 by default with a "View all N sub-jobs" / "Show fewer" toggle.
- a search box appears in the Sub-Jobs section once there are more than 3 sub-jobs, filtering by name only.
- web sidebar only: an Edit pencil toggle at the top-right (next to the ⋯ options button, editable viewers only). The duplicate "Jobsite address" edit block is gone — the single header address swaps to an inline editor while Edit mode is on, and the flashing material editor (window jobs) also only shows in Edit mode.

jobcard sidebar + creation rework:
- field-super-jobcards and other jobcards pages (not the calendar pages): clicking a jobcard opens it in a right sidebar the same size as the job details sidebar, instead of the old centered popup.
- creating a jobcard now happens in that same right sidebar, using the identical layout/style/sizing as viewing a jobcard — the only difference is "Cancel" and "Create Jobcard" buttons at the bottom, and creation is blocked with an inline error until requirements are met. The old separate creation modal is gone.
- the parent job name now sits directly above the jobcard name on every jobcard view (popup and sidebar), matching the mobile installer layout. It's no longer switchable once a jobcard exists — only the creation draft still picks a parent.
- field supers can no longer open the crew selector on a jobcard (clicking the rounded square does nothing for them); hovering still shows the assigned crew's name. Schedulers are unaffected.
- the web jobcard popup is slightly wider, and the photos section wording changed from "Installer photos" / "No photos taken for this jobcard yet" to role-neutral "Photos" / "No photos for this jobcard yet".

mobile jobcards view (REQUIRES: apply the new job-photos task_id Supabase migration — task-linked photo uploads are rejected without it):
- jobcard name is bigger and less bold (22 semibold → 26 medium).
- more space between the icon-led sections, and the section icons are slightly larger.
- the per-task issue button is now "+ Issue" (plus icon).
- installers can't check off a task without at least one photo taken FOR that task: each task row has a camera button (in-app camera on phones, image picker on web) with a count once photos exist; photos carry the task's id, and a blocked tap shows a "take at least one photo of this task" hint under the row. Unchecking is never blocked, office roles aren't gated, and task photos still show in the jobcard's Photos section.
- top margin above the X/status row removed, and the page behind the jobcard is no longer dimmed: iOS dims its sheet presentation at the OS level, so the jobcard is now a self-drawn sheet over a transparent backdrop (sits slightly higher, soft top shadow instead of the dim). Swipe-down-to-dismiss went away with this presentation — the X closes it.

mobile -> editing a photo's note: the note input now rides above the keyboard. Root cause: the viewer's bottom bar is absolutely positioned, and KeyboardAvoidingView padding never moves absolute children — a new keyboard-height hook lifts the bar by the keyboard's exact height on iOS (Android resizes the window itself; every other input surface in the app uses in-flow content that KeyboardAvoidingView already handles).

installer schedule: jobcards no longer show priority, and the row under the jobcard name now reads "Parent Job · address".

mobile bottom bar: now a floating island (rounded, inset from the screen edges, floating above the home indicator, border + soft shadow) and the icons sit slightly lower inside it.

web job dashboard sidebar now mirrors the mobile installer job details view (field-super-jobs and operator-jobs):
- wider panel (640px), X top-left like mobile.
- centered cover photo (rounded square; oldest photo by default, tap → popup with "Change jobsite photo" picker over the job's photos — same as mobile).
- centered job name, tappable location (popup with Copy / Open in Google Maps), and centered Field Super names.
- Jobcards / Issues / Documents no longer stack all at once — the same three clickable section cards as mobile (counts on each; the active card hides and its section shows below, one at a time). The photo wall stays always visible underneath with the Upload button.
- the field-super/operator extras sit in their own bordered block under the header: inline-editable jobsite address and (window jobs) the flashing material text + reference photo.

finance manager role (REQUIRES: apply the two new finance-manager Supabase migrations — the enum value and the policies are split because Postgres can't add and use an enum value in one transaction — and redeploy the invite-worker edge function so Finance Managers can be invited):
- new role "Finance Manager", invitable from the People page like any other role; shows in the people lists.
- the timesheets review page moved from the Operator to the Finance Manager (route renamed to /finance-manager-timesheets; the Operator's Timesheets nav entry is gone on web and mobile). Same weekly pre-QBT-push review: filters, tallies, per-worker groups, timecard editing.
- Finance Manager Jobs tab (web + mobile home): every job as a card with an inline-editable QBT jobcode ID (amber outline while missing) and an inline-editable labor budget. Each card shows wages paid out (summed timesheet earnings on the job's jobcards) against the budget with a progress bar that turns red when over budget. A warning banner at the top counts jobs still missing a QBT jobcode ID.
- jobs got a labor_budget column; the Finance Manager may update ONLY the QBT jobcode + labor budget on a job (RLS policy + guard trigger), and the budget column is blocked for the other limited roles' job updates.

web jobs pages: job dashboard sidebar + search.
- field-super-jobs: a search bar filters by job name or address; clicking a job now opens a large right-hand sidebar instead of the old dropdown. The sidebar is the job's full dashboard: jobsite address (inline-editable, with copy + open-in-Google-Maps buttons), Window Opening Flashing Material (inline-editable text + the reference photo, hidden for non-window jobs), a Jobcards section (status pill + task progress; clicking one opens the jobcard quick view), an Issues section (open issues with the collapse behavior + the collapsed "Resolved (n)" group), a Documents section (same as mobile — non-installers can add), and a Pictures section with upload. The old jobcards/photos popup modals are gone (the unused JobJobcardsModal component was deleted).
- operator-jobs: same search bar; clicking a job card opens the same dashboard sidebar (the Edit button still opens the full editor with delete/QBT/field-super controls).
- the installer's web jobs page keeps navigating to the full job details page, which already mirrors mobile.

installer timesheets tab rework (mobile tab + the desktop /installer-timesheets page, which share the screen):
- the "Timesheets" title and the Today/This Week/Last 30 Days buttons are gone.
- a bordered stat card sits on top: date range line, then the period title, then Hours worked + Earned. Tapping anywhere on the card cycles Today → This week → This month → All time → repeat. On the week/month steps the title reads "This week | Week to date" with the inactive half grayed out and tappable to flip the stats to the to-date range (same for month).
- tapping the date range line opens a custom range picker (From/To — Android date dialog, iOS spinner inline, typed YYYY-MM-DD on web). Applying shows "Custom range" stats; tapping the card again returns to Today.
- below the card, the activity log: a section per day of the current week ("Today", then weekday names) with the day's earnings right-aligned on the header row; older weeks collapse into one container each (date range on the left, week earnings on the right; day sections inside use numeric dates).
- timecards no longer repeat the date; they show the jobcard name, the parent job's name, start–end times, total hours, and the amount earned on that card.

fixed: adjusting a clock-in start time showed a blank picker — the iOS time spinner was hardcoded to dark digits, invisible against the light-mode sheet. All native pickers now follow the selected theme.

job details page round 2 (REQUIRES: apply the new job-documents/cover-photo Supabase migration, and run npm install after pulling — adds expo-clipboard + expo-document-picker):
- cover photo is now a centered medium rounded square. It defaults to the job's OLDEST photo; tapping it opens a popup showing the image with a "Change jobsite photo" button that flips into a picker over the job's photos. Any worker can set it (a new RLS policy + guard trigger lets installers/schedulers write only this column).
- job name, location, and field super names are centered; tapping the location opens a popup with "Copy" and "Open in Maps" (Apple Maps on iOS, the geo: handler on Android, Google Maps in a tab on web).
- below the field supers sit three section cards styled like the reference screenshot — Issues (n Open), Documents (n Total), Jobcards (n Total). None is open by default; opening one hides its own card and shows that section below (one at a time). The photo wall stays always visible underneath, with more space between the major blocks.
- Jobcards section lists the job's jobcards with status pill + task progress; tapping opens the jobcard.
- Documents section: photos, PDFs, and text notes, each with a required title. Non-installers get a + button (Photo = take/upload, PDF = file picker, Text = typed in place); installers view only (enforced by RLS too). Photo documents open in a full-screen pinch-zoom viewer, PDFs open in the browser, text expands in place. Text documents queue offline like other writes; photo/PDF files upload immediately and need a connection.

issue resolving: installers can now resolve/reopen issues (was Field Super only; RLS updated to match). On the job details page, resolved issues no longer mix into the list — they sit in a collapsed "Resolved (n)" group at the very bottom of the Issues section. Collapsed issue rows now show only the description; expanding shows the clickable jobcard name, the task, and the worker + date as before.

installer job details page redesign: no more "Job Photos" nav header — the page has a plain X close button top-left instead of the "< (mobile)" back button. The job's newest photo shows as a cover image above the job name (tap it to open the viewer; quiet placeholder until the job has photos). Location and Field Super rows lost their card background (icons kept, and it now shows just the supers' names without the "Field Super:" prefix). The Issues section stays. Take Photos and Upload became icon-only round buttons floating centered at the bottom of the page (camera is native-only as before; web shows upload alone).

issues collapse: when a job or jobcard has more than 3 issues, only the first 3 show, followed by a "View all n issues" button that expands the full scrollable list in place (and a "Show fewer issues" to re-collapse). Applied to the job details page, the installer jobcard page, and the desktop jobcard quick view via one shared component.

dark/light theme: every worker can pick Dark or Light under Settings → Appearance; the choice applies instantly (the app re-renders in place and returns to the same page) and is remembered per device. Every role now has a Settings surface on both form factors: the mobile Settings tab already existed for all roles; the web console gained a Settings sidebar entry for every role (route /console-settings — profile + appearance; sign-out and the dev role switcher stay in the top bar). The camera, full-screen photo viewers, and photo-thumbnail badges intentionally stay dark-styled in light mode (their chrome sits on viewfinder/photo content). Buttons with solid blue/red fills keep white labels in both themes.

viewing a photo: deleting a photo while viewing it now moves the user to the nearest remaining photo (and closes the viewer if it was the last one). Root cause was the viewer rendering a stale snapshot of the photo list; it now tracks live data, so the fix holds on every screen that opens the photo viewer.

viewing a photo: tapping once hides the details bars, tapping again shows them (double-tap zoom is unaffected; works on web too). Swiping down dismisses the photo on mobile only — the photo follows the finger and the backdrop fades, springing back if not pulled far enough; disabled while pinch-zoomed so vertical drags still pan the zoomed photo.

offline-first (requested in-session, answers "what is the best way to save changes to supabase?"): every change is device-first — it applies on screen instantly, queues on the phone (surviving force-quits), and pushes to Supabase in order when signal returns. Reads are cached on-device too: a cold offline launch shows all jobs, jobcards, crews, schedules, issues, and the last 90 days of timesheets. Photo areas show "Connect to the internet to view photos" instead of a gallery when offline (flashing-material photos are pre-downloaded so they still render on site). A sync chip (mobile top-right, desktop sidebar bottom) shows offline/pending state; a change the server permanently rejects raises a "couldn't be saved" notification instead of failing silently. Offline creations never overwrite each other (new records have unique ids); only two people editing the same field is last-save-wins. (the cache fills on the first ONLINE open; added @react-native-community/netinfo — run npm install after pulling)

mobile installer:
- the "issue" button no longer glitches: the root cause was background data refreshes briefly reverting changes whose save was still traveling (same class as the old checkbox glitch); fixed system-wide — refreshes now wait for in-flight saves and keep locally-changed rows.
- job photos section: each issue now leads with its jobcard's name as a blue link (in both the collapsed row and the expanded card) that jumps to the jobcard.
- photo notes now save: they were silently dropped whenever the camera or photo viewer closed before the note input lost focus; notes now commit on every capture and on close.
- pics tab renamed to Jobs (briefcase icon, phone tabs + web console nav).
- the Jobs tab is a dashboard of every job by recency: clocked-into jobs first (running shift counts as most recent), then jobs by newest photo, then the rest alphabetically; search unchanged.
- photo details showing the jobcard name as a clickable chip that jumps to the jobcard (was already implemented)

The clock in for installers: selecting or adjusting a time now opens the standard iOS spinner (bottom sheet with Cancel/Done) or the standard Android clock dialog instead of typing — everywhere times are entered (adjust shift start, add timecard, edit timecard). Web keeps the typed input (browsers have no native picker). The start-time pill no longer gets squeezed on narrow phones; the row wraps instead. (added @react-native-community/datetimepicker — run npm install after pulling)

notifications on web: the popup container is bigger (460×600); hovering a notification reveals a dismiss button that deletes it permanently; clicking a "New Priority Jobcard" notification takes the scheduler to the calendar with that jobcard's quick view open (does nothing extra if the card was deleted since the ping).

jobcards no longer require tasks to be 15 characters minimum (removed from the create modal and inline edits; tasks still can't be empty and a card still needs at least one).

more space between rows in the jobcard quick view (between rows and between each icon and its section), and the row icons are slightly larger.

scheduler-jobcards and field-super-jobcards jobcard lists: the priority pill now shows a flag icon and the full start–end date range at all times (no hover needed); "Now" cards still read "Now", undated legacy cards show their label.

jobcard priority is now a date range (start + end). The selector offers "Now" (both dates today), "This week" (Monday → Friday of the current week; from a weekend it rolls to the upcoming week), "Next week" (Monday → Friday of the following week), or "Set dates" (manual date pickers, required before create/save). The two dates cross-clamp so the end can never precede the start. Displays show "Now" or the start date and reveal the full range on hover; when a card's end date arrives and it isn't finished, it escalates to "Now" everywhere (visually at once; persisted + scheduler-pinged by an hourly sweep in non-installer sessions). Legacy label-only cards keep their old behavior. (requires applying the new priority-range Supabase migration)

jobcard task checkboxes no longer glitch: check-offs apply locally instantly but only push to the database after the card's checkboxes sit unchanged for 5 seconds, and live refreshes can't clobber pending toggles. (closing the app within those 5 seconds loses the un-pushed toggles)

jobcard web view: clicking on the priority (or readiness / parent job) opens the dropdown menu immediately without having to click again.

if a dropdown, editable input, or similar is open/active and the user clicks outside/elsewhere the active element closes: jobcard quick-view priority/readiness/job editors, the status menu, and the crew menu; text editors already committed and closed on blur. (mobile dropdowns were fixed earlier via DropdownPortal)

at the top of the field super jobcard page there is a counter displaying the number of false starts this week (jobcards installers set to "False Start" whose scheduled day falls in the current Mon–Sun week — there's no marked-at timestamp, so the scheduled day is the proxy).

field super jobcards calendar status says "Today", "Tomorrow", or the scheduled date instead of "On calendar". Hovering turns it into "View on calendar", which opens the field-super-calendar with that day highlighted for a few seconds.

calendar view on web: the days in the month calendar are a little larger.

only jobcards with the "Ready for installers" readiness set to "Now" are displayed in the work requests view. Requests that aren't ready sit in a collapsed "Not ready yet (n)" section at the bottom of the list so they don't silently vanish. (legacy cards with no readiness recorded still show as ready)

scheduler-calendar: expanding the work requests calendar no longer opens a popup — the work requests container expands in place across the screen to the left (animated), hiding the list content and pushing the standard calendar to a smaller width.

scheduler-calendar: clicking a day in the calendar opens a sidebar (between the standard calendar and the work requests view) showing that day's schedule, with a large X to close. Clicking a jobcard in the main calendar closes the daily sidebar. Opening the sidebar and expanding the work requests calendar are mutually exclusive (each closes the other).

jobs now have scopes: the operator picks them at job creation (editable later from Edit job). If Windows is not a scope of the job, the Window Opening Flashing Material never shows for the job or its jobcards. (requires applying the new Supabase migration)

jobcard creation: field super is required to click either "Yes" or "No" for "Pickup Required". selecting "Yes" requires typing the pickup location. Installers see the pickup on the jobcard; field supers can edit it in the jobcard details.

field super cannot create a jobcard if the parent job has no "Jobsite address" — or no "Window Opening Flashing Material" when the job covers windows. (the DB guard now also allows field supers to edit the jobsite address, which it previously blocked)

operator: deleting a job requires typing the name of the job and clicking a confirmation button, with a warning that the job and its jobcards cannot be restored.

password reset: the reset flow already routes recovery links to the set-password screen (fix shipped 2026-07-02); hardened so a reload mid-reset no longer drops the user into the app without the prompt. NEEDS: redeploy the website, then retest from a fresh reset email.

operator role -> people tab: 
- fix ui ux (attached screenshot)
- allow removal of workers
- allow editing of worker name and email.
- remove the status column; active workers show nothing, non-active ones get a small inline "Invited" tag that takes no extra space.

installers on mobile (and elsewhere) -> jobcards -> if a dropdown is open and the user clicks elsewhere the dropdown should go away.

workers on mobile: clicking into an editable text input pulls up the keyboard, but when the keyboard is open I can't scroll down enough to see the bottom of what i need to see. (fixed on the jobcard details and job-site pages via keyboard insets)

installer camera: add zoom buttons (0.5 if available on their device, 1, 1.5, 3). The user can also grab and drag the numbers to scrub continuous zoom from the device's widest view up to 5x. (zoom factors are approximate — expo-camera does not expose the device's true max zoom)

photos on mobile: users on mobile can pinch to zoom in/out on any photo while viewing it (photo browser + flashing material viewer), plus double-tap to zoom.

the work requests are expandable into a large calendar view that doesn't effect the crew's schedules (collapsed view remains the same)

scheduler calendar: clicking on a jobcard in the calendar should open the jobcard details in a popup modal. but it should also open a second modal to the right of the other. The second modal is a calendar modal for the jobcard with options to change the assigned crews. (was already working as desired)

the scheduler needs to be able to click on jobcards to expand them (they should open up big and show all the details of the jobcard). there should be a button on the card in the scheduler view that when clicked and active allows the scheduler to click on a day on the calendar to schedule it. The button should also be visible and useable while the jobcard is in the calendar view. (was already working as desired)

Scheduler: each crew should have a color. this color will be used to faintly color the bg of scheduled jobcards. Along with this update, the scheduler should now be able to toggle crews on or off in the calendar view by clicking them. (was already working as desired)

the scheduler doesn't need to see the flashing material. (the only thing the scheduler needs to see on their version of the jobcards is the jobcard title and the parent job. If they are viewing the expanded details of the jobcard, they should see all jobcard details.) (was already working as desired)

each task created in the jobcard by the scheduler/field super should be a task that the installers have to check off on their phone. issues are now per task rather than a separate row in the jobcard.

jobcard creation: both schedulers and field-supers can create jobcards.

for the desktop user roles (operator, scheduler, field super) the popup modals are pretty thin, but since these roles are used on the desktop, they can be a lot wider. for example the create jobcard popup is pretty thin. (was already implemented)

when a popup modal (e.g. to create a jobcard) appears it adds an overlay that darkens the rest of the screen, can you get rid of that and instead just add a slight dropshadow to the popup modal?

in the scheduler role's notifications: when they get the message "Priority "Now" jobcard" can we change it to "New Priority Jobcard". 

on the sign in page i should be able to hit enter to sign in (rather than having to click the sign in button with the mouse)

the backlog view in scheduler-calendar -> the jobcards in the backlog should show the priority of the jobcard. and the backlog should be filtered to top bottom of priority. (among jobcards in the same priority it should then be filtered by how long each jobcard has been waiting in the backlog) (was mostly already implemented; wait-time tiebreak now uses real created-at)

the "Create a crew befor assigning work" popup displays behind the calendar. fix the ui ux so the message appears in the bottom left of the left sidebar. (we already have a popup message that appears there whenever changes are saved that says "Changes saved". so you should use that same system. the bottom left of the left sidebar is where i want all system messages to appear) (was already implemented)

change the "Archived" job status to "Finished".

1. only let crew names be a single letter.
2. if multiple crews are assigned to a single jobcard, and the scheduler is viewing multiple crew calendars, the jobcard currently would show the same jobcard multiple times, instead it should only show the one jobcard. that jobcard - because it has multiple crews assigned - should have the crew name of each assigned crew listed on the end of the jobcard.

scheduler calendar: "Assigning to" at the top of the calendar should not be blue it should be gray.

field-super-calendar -> there should not be a "Assinging to Crew" message at the top of the calendar because field supers do not assign jobcards. they can only see the calendar. (This change should not affect the scheduler's calendar.)

make sure jobcards placed assigned for multiple crews is actually assigned to each of those crews. (if a jobcard is taken of the calendar or moved, it should be removed from all crews, even if the scheduler was only viewing from a single crew calendar.) (was already implemented)

calendar views: when assigning crews the calendar borders should not change colors. (was already implemented)

when assigning multiple crews the style shouldn't be blue, it should be gray. and in the jobcard where it says "Placing -- {crew name(s)}" it should also be gray, but the specific crew names should be their crew colors.

jobcard view on web: 
1. the priority "Now" should be color coded to be red.
2. the color of the rounded square at the top left should reflect the color of the crew the jobcard is assigned to. if not assigned to a crew, the rounded square should be gray and have a slash through it. hovering over the rounded square should show the assigned crew. clicking the square allows you to change the crew the jobcard is assigned to (the date the jobcard is scheduled on does not change, only the assigned crew.)
3. move the created on date to the very bottom of the jobcard info (center aligned). Keep the row in the jobcard for the date, only now it should only show the date the jobcard is scheduled for. and it shouldn't show "On Calendar" since it'll just show the date instead. It should show "Not on calendar" if the jobcard is not on the calendar. but get rid of the pill (custom bg color and border)

jobcard -> clicking delete icon shows the delete confirmation. the delete confirmation should go away when the user clicks elsewhere, or if they do not click it after 4 seconds.

scheduler work requests -> jobcards: make the open and schedule buttons way smaller and not take up as much space as they currently do.

project mananger role -> jobcards page -> clicking on a jobcard should open a large details view of the jobcard that the Field Super can use to edit any details of the jobcard. (double check that if the jobcard is updated to "Now" priority, the scheduler will be pinged.)

the scheduler role should get pinged anytime a new jobcard is created with priority of "Now".

Field Super's should be assigned to jobs. Field Super workers are only able to see their own jobs (that means, each Field Super can only see their own jobcards) and can only see jobcards for their jobs. The operator assigns each job to a Field Super (but can assign more than 1 Field Super to a job)

Field Super needs to be able to edit jobcards.

operator role -> jobs tab -> create job: the operator does not even need to see the flashing material variable (when creating the job and also when viewing jobs). they also dont need a status input while creating a job. the creation should have an input for the job name, location, and QBT Jobcode ID. 

Field Super needs to have a better sort and view of their jobcards. sort by job maybe.

host the app so it can be accessed from anywhere.

Installer -> Settings tab: underneath the installers name is the word "Glazier". There should be a few types of installers: "Window Installer", "Storefront Installer", "ShowerGlassDoor Installer", "Remodel Installer". These installer types should also be set by the operator role for each installer. (these types do not affect anything, they are a title.)

Field Super -> Jobs tab: create a jobs view to show all the jobs. the field super should be able to click inside each job to review and edit the job details. (Field super does not see the QBT info). 

the Ox WorkerHub needs to be built for different roles. "Installer" is the current app we have right now. anyone assigned the role "Installer" should see the app we've made. We now need to make so people will different roles see a different interface and be able to perform different actions. Here's the next few roles we need to implement: 
- "Scheduler": The scheduler sees a schedule tab that allows the scheduler to manage installer schedules by assigning jobcards to the installers schedules.
- "Operator": The operator sees a people tab that allows the operator to manage workers and their roles. and can assign hourly rates to workers with installer roles. The operator is also able to view and manage the incoming timesheets for review and change before they are sent to intuit quickbooks time.
- "Field Super": The Field Supers can tag a jobcard (in their own view) so that the scheduler knows which jobs and projects need installers. Field supers create jobcards for jobs and projects. each jobcard the Field Super creates requires the Field Super to assign a job/project for that jobcard, as well as any other relevant details (e.g. priority, materials needed, work required for the jobcard.) to clarify: Jobs and jobcards are not the same. A job is a jobsite or project that the company has work to do on. A jobcard is like a ticket or request for something to be done on a job. The workflow is: Operator Creates the job -> Field Super creates jobcard -> Scheduler assigns jobcard to installer -> Installer performs work on jobcard.
