# Dev Tracker
This file is used by the developer of Ox WorkerHub. It should not be used in any way by any ai agents.


# Awaiting

improve ui/ux:
- the header bar doesn't need to have a separate bg color from the main bg color and it doesnt need a separator line.

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

Field Super jobcards calendar status shouldn't say "On calendar", it should say "Today", "Tomorrow", or if it's scheduled for a future date, it should display the date it's scheduled for.

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
