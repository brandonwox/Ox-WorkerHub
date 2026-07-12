# Dev Tracker
This file is used by the developer of Ox WorkerHub. It should not be used in any way by any ai agents.


# Awaiting

in the settings theres a new password option: they should have to click a button that says "Change Password" that opens a popup for them to change their password.

web needs a way to access settings: Let's change the log out button at the top of the screen. add a profile image to the left of their name. and instead of signing them out, it opens a large settings page, the sign out button at the bottom of the settings page.

installer -> jobs tab -> job details (viewing a specific job):
look at the attached image to see how I want to redesign the job details page.
specifics:
1. get rid of the "Job Photos" label entirely.
2. the back button should just be an x instead of saying "< (mobile)".
3. add a photo above the job name
4. remove the background color behind the job location and field super name (and when displaying the field supers name just display their name, you don't need to display "Field Super:) (i like the icons on the left of these details, keep that)
5. it's not in the attached image that we're getting inspiration from, but we need to keep the "Issues" section.
6. move the "Take Photos" button to the bottom of the page, center it, and swap the typography for an icon instead. move the "upload" button to the same location and replace it with an icon.

if there are a lot of issues on a job, rather than displaying each issue it should display a few, then have a display all issues button that opens a dropdown of every issue where the user can scroll through all the issues. (this should be for both jobcards and jobs).

in order to turn this app into a real appstore app we need to add all the permissions popups. for example, when the app first tries to access the user's location, camera, microphone, etc., it should show a popup asking the user to grant permission. (it needs to be elaborate and detailed, otherwise apple will reject it.) (I assume there's also a system like this on android devices.)

field-super-jobs:
- add a search bar
- clicking a job should open a large sidebar on the right with the job details (instead of opening a dropdown.)
- the job sidebar should show the jobsite address, window flashing material, a jobcards section, an issues section, and a pictures section.
- basically the job sidebar needs to show a full dashboard for the job.

create finance manager role. 
1. Finance manager role takes over the operator-timesheets page (operator role no longer needs to see timesheets, rename the page to finance-manager-timesheets). 
2. The finance manager should have a jobs tab.
3. each job card in the finance-manager-jobs tab should show the total assigned labor budget for the job. It should also show how much of the labor budget has been paid out.
4. MENTAL NOTE THAT WILL BE IMPLEMENTED LATER (NOT RIGHT NOW): The field supers OR instalelrs will have to enter how many windows have been done (out of the total) for each job. and those numbers should show up for the finance manager.
5. At the top of the jobs page there should be a warning of how many jobs do not have an assigned QuickBooks Time jobcode ID (it is the finance-manager who is responsible for assigning a QBT jobcode ID for each job.)

Not every single change needs to display the "Changes Saved" notification. can you organize which changes should display it and which should not?

add "profit sharing" tab for installers: (DO NOT IMPLEMENT UNTIL I DETAIL THIS PLAN MORE (e.g. HOW WILL PROFIT SHARING BE TRACKED))
1. installers should be able to see their profit sharing in a list of all most recent to oldest. They should also be able to sort through jobs and see profit sharing progress for each job (each profit sharing check they've received so far).

# Unsure

create sms provider account (twilio is the standard). This would allow us to send text messages to schedulers when a Field Super creates a jobcard with a priority of "Now".



# DONE

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
