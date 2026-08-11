# Dev Tracker
This file is used by the developer of Ox WorkerHub. (Agents may use this file in accordance to instructions from the developer.)


# Awaiting

deleting a job should only archive it. once a job is archived, it can be deleted from the archive to permanently delete it. (both deletes require confirmation.)

i noticed the mobile keyboard doesn't have a button to hide the mobile keyboard, are we able to add one?

mobile (installer):
- open work request: the top of the work request has a shadow above it. remove that shadow and any other border.
- calendar (e.g. viewing the schedule for the day): each work request shown to me for the day should show the PO directly above the work request title. directly below we can leave the address, but remove the materials needed, and replace it with the notes. (it should all still get cut off and stay on one line, no wrapping to new lines (as it is))
- in light mode: viewing the daily schedule: the bg color of the work request cards in the schedule list is the same as the bg color behind them. can you make it slightly darker. (but do not affect the bg color of the work requests when they're open)
- in work requests: clicking the location should open a menu to open the location in any installed maps apps (I thought this functionality was already implemented, is it not?)
- when inside an open work request I want to be able to swipe down to close the work request (right now I have to click the x button to close it, but i also want to be able to swipe down)

on the job details page -> issues section -> add a "+ Issue" button on the right side of the "Issues" title, so that issues can be created for the job, without having to be created and assigned to a work request.

when viewing a job details page dont display "PO" before the PO, simply show the PO by itself. (same with the column list of jobs, get rid of "PO" and just show the PO.)

field-super-work-requests page -> the column of work requests -> right now the text directly below the work request name shows the parent job name + the subjob name, instead: just display the PO. (if its a subjob, only show the subjob PO) (same for inside the work request: directly above the work request name, just show the po).

job details page -> The additional info section that is only accessible from the edit button on the top right (it holds the flashing material, counts, etc.) -> there should be another input field for "Builder". the input field when clicked should show a dropdown of every builder that has ever been applied to a job in the past. The user can type to search builders. or can simply type and enter to create new builder if no match is found. Also, the 3 dots button should be removed, the "This job has Sub-Jobs" option should just be shown in the job details page if editing is active. (e.g. move the "This job has Sub-Jobs" option to the edit button.)

- When enabling "This job has Sub-Jobs" the user must also choose from "Lots", "Phases, "Bldgs", or custom. (this will be used in subjob name creation, see next step to this edit)
- When creating a subjob: it should show the parent job name (same as it does currently), then it should show the subjob type that was saved for subjobs (e.g. "Lot", "Phase", "Bldg", or the custom entry.), then it should show the input field to type the subjob name. The subjob name becomes the subjob type + the entered subjob name. if the type was "Lots" and they entered "159", then the subjob name becomes "Lot 159" (remove the "s" from "Lots" and the other terms.)
- change the fake "Lot 2, Phase 3, Building B..." text accordingly. (shown in the input field until the user starts typing): it should say something like "Which lot is this?" or "Which phase is this?"

"Service" should not be a scope.

All the awaiting edits below change a lot of stuff and need to be merged into cohesive edits. there are multiple edits mentioning the new "PO", and multiple edits mentioning the new change from "Jobcards" to "Work Requests", and other things like this. Please do not change the dev-tracker other than moving the edits to the done section once they've been implemented. This is simply a note to scan all the awaiting edits and make sure you understand any connecting pieces before making changes.

improve the notifications system. Right now the notification dropdown seems like it could use a lot of improvements. (find weakspots or missing functionality, and make a list. Also look at what notifications we should set up (right now we have some good notifications like when a work request changes priority to Now. But we need to make a list of more notifications that I can decide yes or no to.))

in the notifications section: i try to hover over a notification and click on the x button to dismiss the notification and delete it, but the x button disappears whenever i get close.

web users -> the settings page should not show up in the left sidebar. accessing the settings page is done by clicking the profile chip in the top right of the screen.

add small radius drop shadow around popups in web view, such as when a scheduler opens a jobcard popup (there should be a box/drop shadow around the popup, just dont make it too big or too strong.)

make sure the field super is shown on the jobcard. (installers don't see the field super for the jobcard.) (also make so field supers phone numbers are required for the field super to operate.) (the field super's phone number should be shown on the same line as the field supers name).

make the speech to text work for mobile users. (add mic button in text sections, especially for image notes.) use lucide Mic icon.

Not every single change needs to display the "Changes Saved" notification. can you organize which changes should display it and which should not?

use font Poppins for everything aside from the "WorkerHub" text in the header. here's the import code:
```
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
```

use font Quantico for the "WorkerHub" text in the header. here's the import code:
```
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Quantico:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
```



# Unsure



# DONE

Completed edits live in [Dev-Tracker-Done.md](Dev-Tracker-Done.md), newest first. When an Awaiting edit above is implemented, remove it from this file and log it at the top of that one.
