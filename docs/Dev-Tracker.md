# Dev Tracker
This file is used by the developer of Ox WorkerHub. It should not be used in any way by any ai agents.


# Awaiting

host the app so it can be accessed from anywhere.

scheduler should get pinged anytime a new jobcard is created with priority of "Now", we could even have it automatically send them a text or email.

pm needs to be able to edit jobcards.

pm needs to have a better sort and view of their jobcards. sort by job maybe.

pm jobcards calendar status shouldn't say "On calendar", it should say "Today", "Tomorrow", or if it's scheduled for a future date, it should display the date it's scheduled for.

installers can set the status of the jobcard from "Issues" and "Complete". If the installer sets the status to "Issues", the jobcard will be highlighted in red and the pm will be notified. If the installer sets the status to "Issues", the installer must write at least 1 issue in the issue field.

for the desktop user roles (operator, scheduler, project manager) the popup modals are pretty thin, but since these roles are used on the desktop, they can be a little wider. for example the create jobcard popup is pretty thin.

add profit sharing tab to see all my profit sharing checks (past and upcoming). and also so i can see all the profit sharing remaining on any job.

Installer -> Settings tab: underneath the installers name is the word "Glazier". There should be a few types of installers: "Window Installer", "Storefront Installer", "ShowerGlassDoor Installer", "Remodel Installer". These installer types should also be set by the operator role for each installer. (these types do not affect anything, they are a title.)

Project Manager -> Jobcards tab: Each jobcard should have a schedule status (e.g. "On the Schedule", "completed", "cancelled").

operator role -> jobs tab -> create job: the operator does not even need to see the flashing material input while creating a job. they also dont need a status input while creating a job. the creation should have an input for the job name, location, and QBT Jobcode ID. 

operator role -> people tab: 
- fix ui ux (attached screenshot)
- allow removal of workers
- allow editing of worker name and email.
- remove the status (e.g. "active", "Invited"), if they are active, it doesn't need to show anything. if they are not active, it should show the status (e.g. "Invited"). I dont want there to be an entire column displaying for each worker for their status, that's a waste of space since most workers will always be active. so the invited tag should not add any extra space to the ui.


# In Progress / Done (client)


# Unsure



# DONE

Project Manager -> Jobs tab: create a jobs view to show all the jobs. the project manager should be able to click inside each job to review and edit the job details. (Project manager does not see the QBT info). 

the Ox WorkerHub needs to be built for different roles. "Installer" is the current app we have right now. anyone assigned the role "Installer" should see the app we've made. We now need to make so people will different roles see a different interface and be able to perform different actions. Here's the next few roles we need to implement: 
- "Scheduler": The scheduler sees a schedule tab that allows the scheduler to manage installer schedules by assigning jobcards to the installers schedules.
- "Operator": The operator sees a people tab that allows the operator to manage workers and their roles. and can assign hourly rates to workers with installer roles. The operator is also able to view and manage the incoming timesheets for review and change before they are sent to intuit quickbooks time.
- "Project Manager": The Project Managers can tag a jobcard (in their own view) so that the scheduler knows which jobs and projects need installers. Project managers create jobcards for jobs and projects. each jobcard the Project Manager creates requires the Project Manager to assign a job/project for that jobcard, as well as any other relevant details (e.g. priority, materials needed, work required for the jobcard.) to clarify: Jobs and jobcards are not the same. A job is a jobsite or project that the company has work to do on. A jobcard is like a ticket or request for something to be done on a job. The workflow is: Operator Creates the job -> Project Manager creates jobcard -> Scheduler assigns jobcard to installer -> Installer performs work on jobcard.
