# Dev Tracker
This file is used by the developer of Ox WorkerHub. (Agents may use this file in accordance to instructions from the developer.)


# Awaiting

I found a weird problem: I'm on web -> I'm logged into the field super role -> I clicked on a notification "Work request reported Finished" -> it opened the appropriate work request but the work request filled my entire screen for some reason. make sure the work request either opens in the right sidebar or as a popup. (sidebar most times, popup on calendar page.)

web -> notifications dropdown:
- make the x button larger so its easier to remove notifications.
- the scheduler notifications center looks like it doesnt have as much functionality as the field super, can you fix that.

mobile (installer): 
1. the notifications icon button should shown in the same row as the page button icons, only it should not be in the same floating island container. it should have its own separated island container. to the right. and to make things make more sense, the settings page icon button should also move into the new island container. The first island should be Timesheets, Schedule, Jobs. and the second one should be notifications, Settings. Oh, But only the icon for the notifications button (don't add the word "Notifications" because its too large, just leave it blank.) Also make the island container corners a little less rounded.
2. when i opened the notifications the top went too high and overlayed over the native ios header that shows the time, dynamic island, service, wifi, battery. Does that make sense? it was just a bug that i need you to look into.
2. when typing in the notes on an image, the keyboard checkmark button should make the user exit the text area and drop the keyboard. right now it just line breaks onto a new line.
3. the height of the notes area in the image notes is really small, it needs to be taller. make it a little taller, then when the user types onto a second line, it should grow a little. it should grow for each new line until it is 6 lines tall. (make sure as it grows the things around it move and reposition properly, no bugs or weird kinks.)
4. when taking a picture, there should be a type selector to choose whether the image is a window, sgd, swing door, screen, and so on for each scope. (We're basically just expanding the "Video needs to be )
5. on a job details page update clicking the location to show the full list of options that work requests have. (e.g. apple maps, google maps, waze, copy address)
6. after taking a picture, the user can click on the small image in the bottom left. once viewing the image I want to allow the user to pinch to zoom.
7. below the switch camera icon button add a scope button that allows all pictures taken to be auto selected to that picture type (e.g. window, sgd, swing door, screen, etc). They can also click on the image in the bottom right to expand and view that image, there should be a type selector in there too (as specified earlier)
8. when viewing a specific image (from clicking the image in the bottom right of the image taker) the user should be able to swipe left and right to view the other images they have taken in the current image taker session.
9. work request -> task -> taking a picture for a specific task -> (The user has clicked the camera icon button for a task to take pictures for a specific task). Please add the title of the task to the top of the image taker so the user can see what task they are taking pictures for.

job scopes should be editable ( when the user clicks the edit button in the top right of the job details sidebar the scopes should be adjustable so scopes can be removed or added.) (Don't forget that any job with a scope also needs the specific counts for done / total for that scope.)

manage crews popup: the foreman section on each crew shows every installer on the crew. can you change it so it just shows one person, and is a dropdown selector, rather than showing every person.

when editing a job's details change the checkmark button to say "Save changes" rather than just a checkmark.

All the awaiting edits below change a lot of stuff and need to be merged into cohesive edits. there are multiple edits mentioning the new "PO", and multiple edits mentioning the new change from "Jobcards" to "Work Requests", and other things like this. Please do not change the dev-tracker other than moving the edits to the done section once they've been implemented. This is simply a note to scan all the awaiting edits and make sure you understand any connecting pieces before making changes.


# Unsure



# DONE

Completed edits live in [Dev-Tracker-Done.md](Dev-Tracker-Done.md), newest first. When an Awaiting edit above is implemented, remove it from this file and log it at the top of that one.
