# Dev Tracker
This file is used by the developer of Ox WorkerHub. It should not be used in any way by any ai agents.


# Awaiting

each task created in the jobcard by the scheduler/field super should be a task that the installers have to check off on their phone. (installer roles -> mobile view -> jobcard -> show each task in a list. each task can be checked off as completed or issues can be created for each task.) (move the issues list, rather than a separate row in the jobcard, the issues list should be per task, issues can be added per task.)

installer camera: add zoom buttons (0.5 if available on their device or 0.7, 1, 1.5, 3). The user should also be able to grab and drag the numbers to scroll through more defined zoom ranging from the most zoomed out their device works on, and all the way to 5x zoom in.

photos on mobile: users on mobile should be able to pinch to zoom in/out on any photo while viewing it on mobile, no matter where they're viewing from.

kim(scheduler) creates jobcards (not field supers)

1. only let crew names be a single letter.
2. if multiple crews are assigned to a single jobcard, and the scheduler is viewing multiple crew calendars, the jobcard currently would show the same jobcard multiple times, instead it should only show the one jobcard. that jobcard - because it has multiple crews assigned - should have the crew name of each assigned crew listed on the end of the jobcard.

scheduler calendar: "Assigning to" at the top of the calendar should not be blue it should be gray.

field-super-calendar -> there should not be a "Assinging to Crew" message at the top of the calendar because field supers do not assign jobcards. they can only see the calendar. (This change should not affect the scheduler's calendar.)

operator: deleting a job should require the operator to type the name of the job and click a confirmation button. there should also be a warning that tells the operator that the job can be restored if they proceed.

scheduler work requests -> jobcards: make the open and schedule buttons way smaller and not take up as much space as they currently do.

make sure jobcards placed assigned for multiple crews is actually assigned to each of those crews. (if a jobcard is taken of the calendar or moved, it should be removed from all crews, even if the scheduler was only viewing from a single crew calendar.)

calendar views: when assigning crews the calendar borders should not change colors.

when assigning multiple crews the style shouldn't be blue, it should be gray. and in the jobcard where it says "Placing -- {crew name(s)}" it should also be gray, but the specific crew names should be their crew colors.

scheduler calendar: clicking on a jobcard in the calendar should open the jobcard details in a popup modal. but it should also open a second modal to the right of the other. The second modal is a calendar modal for the jobcard with options to change the assigned crews.

scheduler: crew pills: rather than have to click through a cycle off -> on -> assigning -> off. can we instead just make so the crew pills are just a toggle on and off pill to see the crew calendars and separate the assinging functionality directly below the crew pill row. on the left of the row should be an input field. when click it opens a dropdown menu of all the crews. the scheduler can 

calendar (scheduler): make the days in the month calendar a little larger. and when 

add a "False Start" button the installer can click at the bottom of a jobcard to mark it as a false start. This will ping the field super in charge of the jobcard to let them know the jobcard was marked as a false start.

Priority of jobcards should be a range. It should have a start date and a finish date. In the Work Requests view, the displayed priority should still be the start date, but when hovering over it, it should display the start date and the finish date.

jobcard creation: field super is required to click either "Yes" or "No" for an option called "Pickup Required". if they select "Yes", then the field super must type into a new text field to specify where the pickup location is.

field super cannot create a jobcard if they have not specified a "Window Opening Flashing Material" and a "Jobsite address" for the parent job.

the work requests should be expandable into a large calendar view that doesn't effect the crew's schedules (collapsed view remains the same)

when a popup modal (e.g. to create a jobcard) appears it adds an overlay that darkens the rest of the screen, can you get rid of that and instead just add a slight dropshadow to the popup modal?

in the scheduler role's notifications: when they get the message "Priority "Now" jobcard" can we change it to "New Priority Jobcard". 

on the sign in page i should be able to hit enter to sign in (rather than having to click the sign in button with the mouse)

the backlog view in scheduler-calendar -> the jobcards in the backlog should show the priority of the jobcard. and the backlog should be filtered to top bottom of priority. (among jobcards in the same priority it should then be filtered by how long each jobcard has been waiting in the backlog)

Scheduler: each crew should have a color. this color will be used to faintly color the bg of scheduled jobcards. (the bg of each jobcard should be colored according to the crew's color). Along with this update, the scheduler should now be able to toggle the filter mode of the calendar. Rather than selecting what crew the scheduler wants to see, they should instead simply click on any crew they want and it will toggle them on or off in the calendar view.

ask the office some important questions that will determine the flow of Ox WorkerHub:
- How does job assignment work? (How do they decide the Field Super for a new job)
- 

the scheduler doesn't need to see the flashing material. (the only thing the scheduler needs to see on their version of the jobcards is the jobcard title and the parent job.) (HOWEVER. If they are viewing the expanded details of the jobcard, they should see all jobcard details.)

the scheduler needs to be able to click on jobcards to expand them (they should open up big and show all the details of the jobcard). there should be a button on the card in the scheduler view that when clicked and active allows the scheduler to click on a day on the calendar to schedule it. The button should also be visible and useable while the jobcard is in the calendar view.

the "Create a crew befor assigning work" popup displays behind the calendar. fix the ui ux so the message appears in the bottom left of the left sidebar. (we already have a popup message that appears there whenever changes are saved that says "Changes saved". so you should use that same system. the bottom left of the left sidebar is where i want all system messages to appear)

in supabase -> authentication -> users -> send password reset email -> when the user clicks the link in the email, they should be prompted to enter a new password, but instead they are immediately logged in without any option to reset their password.

change the "Archived" job status to "Finished".

Field Super jobcards calendar status shouldn't say "On calendar", it should say "Today", "Tomorrow", or if it's scheduled for a future date, it should display the date it's scheduled for. When hovering over the displayed date, it should turn the text into "View on calendar", which takes them to their field-super-calendar view, and makes sure the day the jobcard is scheduled for is highlighted for a few seconds.

installers can set the completion status of a jobcard to "Issues", "In-Progress", or "Complete". If the installer sets the status to "Issues", the jobcard will be highlighted in red and the Field Super will be notified. If the installer sets the status to "Issues", the installer must write at least 1 issue in the issue field.

for the desktop user roles (operator, scheduler, field super) the popup modals are pretty thin, but since these roles are used on the desktop, they can be a lot wider. for example the create jobcard popup is pretty thin.

add profit sharing tab for installers, so installers can see their profit sharing checks (past and upcoming). installers should also be able to see the profit sharing remaining on any job.

operator role -> people tab: 
- fix ui ux (attached screenshot)
- allow removal of workers
- allow editing of worker name and email.
- remove the status (e.g. "active", "Invited"), if they are active, it doesn't need to show anything. if they are not active, it should show the status (e.g. "Invited"). I dont want there to be an entire column displaying for each worker for their status, that's a waste of space since most workers will always be active. so the invited tag should not add any extra space to the ui.

create sms provider account (twilio is the standard). This would allow us to send text messages to schedulers when a Field Super creates a jobcard with a priority of "Now".

# Unsure



# DONE

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
