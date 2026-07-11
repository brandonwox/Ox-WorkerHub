# Dev Tracker
This file is used by the developer of Ox WorkerHub. It should not be used in any way by any ai agents.


# Awaiting

create finance manager role. 
1. Finance manager role takes over the operator-timesheets page (operator role no longer needs to see timesheets, rename the page to finance-manager-timesheets). 
2. The finance manager should have a jobs tab.
3. each job card in the finance-manager-jobs tab should show the total assigned labor budget for the job. It should also show how much of the labor budget has been paid out.
4. MENTAL NOTE THAT WILL BE IMPLEMENTED LATER (NOT RIGHT NOW): The field supers OR instalelrs will have to enter how many windows have been done (out of the total) for each job. and those numbers should show up for the finance manager.
5. At the top of the jobs page there should be a warning of how many jobs do not have an assigned QuickBooks Time jobcode ID (it is the finance-manager who is responsible for assigning a QBT jobcode ID for each job.)

operator: deleting a job should require the operator to type the name of the job and click a confirmation button. there should also be a warning that tells the operator that the job can be restored if they proceed.

calendar (scheduler): make the days in the month calendar a little larger. and when 

add a "False Start" button the installer can click at the bottom of a jobcard to mark it as a false start. This will ping the field super in charge of the jobcard to let them know the jobcard was marked as a false start.

Priority of jobcards should be a range. It should have a start date and a finish date. In the Work Requests view, the displayed priority should still be the start date, but when hovering over it, it should display the start date and the finish date.

jobcard creation: field super is required to click either "Yes" or "No" for an option called "Pickup Required". if they select "Yes", then the field super must type into a new text field to specify where the pickup location is.

field super cannot create a jobcard if they have not specified a "Window Opening Flashing Material" and a "Jobsite address" for the parent job.

ask the office some important questions that will determine the flow of Ox WorkerHub:
- How does job assignment work? (How do they decide the Field Super for a new job)
- 

in supabase -> authentication -> users -> send password reset email -> when the user clicks the link in the email, they should be prompted to enter a new password, but instead they are immediately logged in without any option to reset their password.

Field Super jobcards calendar status shouldn't say "On calendar", it should say "Today", "Tomorrow", or if it's scheduled for a future date, it should display the date it's scheduled for. When hovering over the displayed date, it should turn the text into "View on calendar", which takes them to their field-super-calendar view, and makes sure the day the jobcard is scheduled for is highlighted for a few seconds.

installers can set the completion status of a jobcard to "Issues", "In-Progress", or "Complete". If the installer sets the status to "Issues", the jobcard will be highlighted in red and the Field Super will be notified. If the installer sets the status to "Issues", the installer must write at least 1 issue in the issue field.

add profit sharing tab for installers, so installers can see their profit sharing checks (past and upcoming). installers should also be able to see the profit sharing remaining on any job.

operator role -> people tab: 
- fix ui ux (attached screenshot)
- allow removal of workers
- allow editing of worker name and email.
- remove the status (e.g. "active", "Invited"), if they are active, it doesn't need to show anything. if they are not active, it should show the status (e.g. "Invited"). I dont want there to be an entire column displaying for each worker for their status, that's a waste of space since most workers will always be active. so the invited tag should not add any extra space to the ui.

create sms provider account (twilio is the standard). This would allow us to send text messages to schedulers when a Field Super creates a jobcard with a priority of "Now".

# Unsure



# DONE

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
