# Dev Tracker
This file is used by the developer of Ox WorkerHub. (Agents may use this file in accordance to instructions from the developer.)


# Awaiting

we have an apk install for android and an testflight app install for ios users. with those types of installs, are we able to make real notifications that show up on the users phones? (If so, please make the notifications actually be a notification on their phone and not just in the app. such as when the schedule changes for an installer.) (If we are able to implement this, please make a list of all the notifications you believe are high enough priority and actually important / useful to be a real phone notification, because we don't want to overdo the notifications sent to their phone.)

Mobile installer: Installers should have a crew status somewhere on their schedule page that says the status of their crew for the day. For example: if the installer and his crew is unaffected for the day (e.g. no one on the crew has a daily crew that separates them) then the status should say "Crew Unaffected". Or if the installer is on a daily crew, the crew status should say the name of the daily crew and clicking on the text should show exactly who the installer is working with that day. Another example is if the installer is not on a daily crew, but someone on their crew is on a daily crew, in this case the status should say something like "Crew B -Tim" (if the installer is on crew "B" and tim was the installer who was put on a daily crew.). A couple hurdles I see while implementing this feature is where it will go and trying not to clutter the schedule page, and making sure the status text is clear, understandable, and doesn't get too long. (when planning this edit, please brainstorm with me on all the details.)

# Unsure

Field Super web gating inconsistencies (spotted during the same audit — policy calls, not parity):

- job archive gating is inconsistent: assignment-gated on field-super-jobs (canDelete={meAssigned}) but unconditionally allowed when the job sidebar is reached via a work request's parent-job link (WorkRequestsScreen passes canDelete). Decide which rule wins.
- permanent delete in ArchivedJobsSection has no role or assignment gate at all — any role that can see the section can delete a job forever.
- on field-super-jobs with "All jobs" on, creating a work request from an unassigned job's sidebar doesn't pre-link (or offer) that job, because the sidebar only receives the assigned-jobs list (quickViewJobs={myJobs}).



# DONE

Completed edits live in [Dev-Tracker-Done.md](Dev-Tracker-Done.md), newest first. When an Awaiting edit above is implemented, remove it from this file and log it at the top of that one.
