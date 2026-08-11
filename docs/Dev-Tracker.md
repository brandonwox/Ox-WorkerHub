# Dev Tracker
This file is used by the developer of Ox WorkerHub. (Agents may use this file in accordance to instructions from the developer.)


# Awaiting

(UNSURE IF WE SHOULD DO THIS EDIT AT ALL, but here's the idea) - the overview page is a bit much and distracting, i'm thinking we get rid of it, or save it for later. (we won't actually get rid of it yet, we'll see if it's useful or not, for now.)

deleting a job should only archive it. once a job is archived, it can be deleted from the archive to permanently delete it. (both deletes require confirmation.)

i noticed the mobile keyboard doesn't have a button to hide the mobile keyboard, are we able to add one?

mobile (installer):
- in work requests: clicking the location should open a menu to open the location in any installed maps apps (I thought this functionality was already implemented, is it not?)
- when inside an open work request I want to be able to swipe down to close the work request (right now I have to click the x button to close it, but i also want to be able to swipe down)

All the awaiting edits below change a lot of stuff and need to be merged into cohesive edits. there are multiple edits mentioning the new "PO", and multiple edits mentioning the new change from "Jobcards" to "Work Requests", and other things like this. Please do not change the dev-tracker other than moving the edits to the done section once they've been implemented. This is simply a note to scan all the awaiting edits and make sure you understand any connecting pieces before making changes.

improve the notifications system. Right now the notification dropdown seems like it could use a lot of improvements. (find weakspots or missing functionality, and make a list. Also look at what notifications we should set up (right now we have some good notifications like when a work request changes priority to Now. But we need to make a list of more notifications that I can decide yes or no to.))

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
