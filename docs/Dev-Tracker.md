# Dev Tracker
This file is used by the developer of Ox WorkerHub. (Agents may use this file in accordance to instructions from the developer.)


# Awaiting

when editing the job details:
- allow the user to edit the job's PO.
- allow the user to change the assigned field supers

change "No Window Opening Flashing Material set — work requests can't be created for this job until it is." to "No Window Opening Flashing Material set — Installers need this information."

All the awaiting edits below change a lot of stuff and need to be merged into cohesive edits. there are multiple edits mentioning the new "PO", and multiple edits mentioning the new change from "Jobcards" to "Work Requests", and other things like this. Please do not change the dev-tracker other than moving the edits to the done section once they've been implemented. This is simply a note to scan all the awaiting edits and make sure you understand any connecting pieces before making changes.

improve the notifications system. Right now the notification dropdown seems like it could use a lot of improvements. (find weakspots or missing functionality, and make a list. Also look at what notifications we should set up (right now we have some good notifications like when a work request changes priority to Now. But we need to make a list of more notifications that I can decide yes or no to.))

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
