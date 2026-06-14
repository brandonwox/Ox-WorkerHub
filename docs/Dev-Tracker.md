# Dev Tracker
This file is used by the developer of Ox WorkerHub. It should not be edited by any agents.


# Awaiting

Project Manager: add new "Jobs" tab.

Project Manager -> Jobs tab: create a jobs view to show all the jobs. the project manager should be able to click inside each job to review and edit the job details. (Project manager does not see the QBT info)

operator role -> people tab: 
- fix ui ux (attached screenshot)
- allow removal of workers
- allow editing of worker name and email.
- remove the status (e.g. "active", "Invited")

the Ox WorkerHub needs to be built for different roles. "Installer" is the current app we have right now. anyone assigned the role "Installer" should see the app we've made. We now need to make so people will different roles see a different interface and be able to perform different actions. Here's the next few roles we need to implement: 
- "Scheduler": The scheduler sees a schedule tab that allows the scheduler to manage installer schedules by assigning jobcards to the installers schedules.
- "Operator": The operator sees a people tab that allows the operator to manage workers and their roles. and can assign hourly rates to workers with installer roles. The operator is also able to view and manage the incoming timesheets for review and change before they are sent to intuit quickbooks time.
- "Project Manager": The Project Managers can tag a jobcard (in their own view) so that the scheduler knows which jobs and projects need installers. Project managers create jobcards for jobs and projects. each jobcard the Project Manager creates requires the Project Manager to assign a job/project for that jobcard, as well as any other relevant details (e.g. priority, materials needed, work required for the jobcard.) to clarify: Jobs and jobcards are not the same. A job is a jobsite or project that the company has work to do on. A jobcard is like a ticket or request for something to be done on a job. The workflow is: Operator Creates the job -> Project Manager creates jobcard -> Scheduler assigns jobcard to installer -> Installer performs work on jobcard.

# In Progress / Done (client)

**Foundation**
- Roles modelled (`AppRole`: installer/scheduler/operator/project_manager);
  single `user` replaced by a `workers` roster + `currentUserId`; per-worker
  pay rates. Dev-only "View as" switcher previews any role until real auth.
- Routing split by role: Installer = mobile bottom tabs (`(installer)`);
  Scheduler/Operator/PM = desktop sidebar + top-bar console (`(desktop)`).
- **Job ≠ Jobcard now real:** `Job` = jobsite (name/location/status/`qbtJobcodeId`);
  `Jobcard` (formerly `Job`) = work item with `jobId` parent link. Store holds
  both `jobs` and `jobcards`.

**Operator role — built** (Hub: `[Jobs] [People] [Timesheets]`, operator-only RBAC)
- **Jobs:** data table + Create Job modal (name, location, status, explicit
  `QBT_JobcodeID`); inline edit of jobcode + Active/Archived status.
- **People:** roster table, role dropdown (all 4 roles), installer-only hourly
  rate edit, "Add worker" → email-invite flow (seeds locally; wires to the
  `invite-worker` Edge Function once Supabase is connected).
- **Timesheets:** weekly review grouped by installer; `reviewStatus` pipeline
  Pending → Approved → Synced; per-log Approve + Edit; "Send to QuickBooks"
  action; status filter + tallies; "Next push: Monday 07:30" banner.
- QBT change: removed per-clock-out / per-add auto-push (now a weekly server sweep).

**Crews (modeled in docs, NOT built):** work is assigned to crews, never
individuals — installers belong to one Permanent Crew; Scheduler can make dated
Daily Crews; a jobcard can go to multiple crews. Interim: `Jobcard.assignedInstallerId`
is a temporary stand-in for the installer view until crews land.

Pending: **Scheduler** & **Project Manager** dashboards (placeholders only).
**Supabase backend** parked at user's request — see `docs/supabase-setup.md`;
config slot ready in `app.json`, needs Project URL + anon key when resumed.


# Unsure



# DONE
