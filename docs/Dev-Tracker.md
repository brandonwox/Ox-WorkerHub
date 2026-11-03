# Dev Tracker
This file is used by the developer of Ox WorkerHub. (Agents may use this file in accordance to instructions from the developer.)


# Awaiting

BRANDON TO DO — Pass 47: delivered counts + resolved work requests + the priority-"Now" / delivery-complete emails (agents skip this block). WHY: the new client writes the delivered-count columns on every job save and resolved_at/resolved_by on every work request save; until the migration is applied Postgres rejects those writes ("column window_count_delivered does not exist" → "A change couldn't be saved"). Shipped clients are unaffected (they don't send the columns). The emails need the one-time function setup below. In order:
   STATUS 2026-11-02 8:30 PM (agent): steps 1, 2 and 5 are DONE — everything through Pass 52 is committed on Dev and pushed; migrations 20261021120000 (Pass 46) and 20261102120000 were applied with `supabase db push`; Dev was pushed to Live (Cloudflare builds the web app from Live, so that is the web deploy); work-event-email is deployed. STILL YOURS: steps 3–4 (Resend secrets — `supabase secrets list` shows only the built-in SUPABASE_* entries, so none of the email/push secrets from Passes 40, 41, 43 or 47 have been set yet), 6 (the two app_settings rows), 7 (profile emails), 8–9 (tests), The phone update went out 2026-11-03 ("Passes 46-53", runtime 1.1.0) — it reaches the Android 1.1.0 build only; iOS phones are still on the 1.0.0 build until the Pass 45 iOS build ships. Pass 53 (the blank-page fix) shipped the same way on 2026-11-03. Run the Supabase CLI as `npx supabase@2 …` — the 3.0 CLI rejects this config.toml's [inbucket] section.
1. [Brandon] Apply 20261102120000_delivered_counts_resolved_work_events.sql (`supabase db push`, or paste it into the SQL editor). It adds the seven jobs.<count>_delivered columns, work_requests.resolved_at / resolved_by, refreshes the installer + finance guards, installs the two work-event triggers, adds 'delivery_complete' to the phone-push list, and schedules the pg_cron job `work-request-priority-escalation` (every 15 minutes). Safe to run ahead of the deploy — nothing shipped reads or writes the columns yet. If the SQL editor complains that pg_cron isn't available, enable it first (Dashboard → Database → Extensions → pg_cron), then re-run.
2. [Brandon] Only then merge Dev → Live and deploy the web build; phones pick the JS up with the next `eas update --channel production` (no native change in this pass).
3. [Brandon] Email needs Resend — the same account/domain/API key as the Pass 40 AR email and the Pass 43 task reminders. If that's done, reuse it; if not, do Pass 40 step 2 first (resend.com → add domain ox-glass.com → DNS records → Verified → API key).
4. [Brandon] Set the secrets (one command; replace the values; the webhook secret is any long random string — keep it for step 6). RESEND_API_KEY and EMAIL_FROM are shared with the other emails, so skip them if already set:
   supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="Ox WorkerHub <noreply@ox-glass.com>" WORK_EVENT_WEBHOOK_SECRET=your-long-random-string
   Optional, in the same command: WORK_EVENT_EMAIL_TO=someone@ox-glass.com (fixed extra recipients, comma-separated), WORK_EVENT_EMAIL_CC=... (CC list), APP_WEB_URL=https://<your web console host> (adds an "Open in Ox WorkerHub" link to each email).
5. [Brandon] Deploy the Edge Function: `supabase functions deploy work-event-email`
6. [Brandon] Point the database triggers at the function — SQL editor, with your project ref and the SAME random string from step 4:
   insert into private.app_settings (key, value) values
     ('work_event_email_url', 'https://<project-ref>.supabase.co/functions/v1/work-event-email'),
     ('work_event_email_secret', 'your-long-random-string')
   on conflict (key) do update set value = excluded.value;
7. [Brandon] Recipients come from worker profiles: every Scheduler's email gets both emails; the job's Field Supers also get delivery-complete emails. Make sure those people have an email on their profile (Settings → Personal info, or the Operator's People page) — a worker with no email is skipped. Until step 6 is done the triggers silently do nothing, so the app keeps working either way.
8. [Brandon] Test — "Now" email: as a Field Super create a throwaway work request with priority "Now" (or "Set dates" with an end date of today, then wait up to 15 minutes for the sweep); every Scheduler with an email should get "Now priority — <PO> · <title>" and the in-app "Now" ping. Delivery email: open a job's work request on the phone (or the web quick view), tap a count's "delivered" row and set it to the total — the count shows "✓ All Windows are On Site", the office gets the "Deliveries complete" bell notification, and the email arrives. If nothing: Edge Functions → work-event-email → Logs (look for "no-recipients", a missing secret, or a Resend error); SQL editor → `select * from cron.job_run_details order by start_time desc limit 10;` shows whether the escalation sweep ran.
9. [Brandon] Test resolved: as a Scheduler open a work request (calendar page popup or work requests page sidebar) → "Mark resolved" in the header. It leaves the Work Requests pool on the calendar page and disappears from the work requests page; the page's new "Resolved" toggle shows only resolved cards (with a Resolved pill); the same button there reads "Resolved" and reopens it. Installers see no change.
10. [Brandon] Once it works, delete this block.

BRANDON TO DO — Pass 46 migration BEFORE the next web deploy (agents skip this block). WHY: the new scheduler code writes three new columns on every work request save and crew save; until they exist Postgres rejects those writes ("column end_date does not exist" → "A change couldn't be saved"). Shipped clients are unaffected either way (they don't send the columns). In order:
   STATUS 2026-11-02 (agent): steps 1–2 done — the migration is applied and Dev → Live is pushed. The phone update went out 2026-11-03 (Android 1.1.0 build only — see the Pass 45 note); the step 3 tests remain.
1. [Brandon] Apply 20261021120000_calendars_planned_crews_end_date.sql (`supabase db push`, or paste it into the SQL editor). It adds crews.is_calendar, work_requests.end_date, work_requests.planned_crew_ids, and refreshes the installer guard. Safe to run ahead of the deploy — nothing shipped reads or writes the columns yet.
2. [Brandon] Only then merge Dev → Live and deploy the web build; phones pick the JS up with the next `eas update --channel production` (no native change in this pass).
3. [Brandon] Test as Scheduler: Manage crews → Calendars → add "Deliveries" (its chip shows on the board, nothing reaches installers); in the pool list click "Pencil in — A" on a request (dashed border, it STAYS in Work Requests), then drag it onto the calendar — it lands on A, not the current assign target; expand the Work Requests calendar, drag a chip's right-edge grip to a later day (it becomes a bar), drag the bar across to the crew calendar (same number of days); drag a chip over the month name, hover "November 2026", drop it on a day there; open a card and change the date / end day by typing (YYYY-MM-DD). As Field Super: expand the Work Requests calendar — the main calendar shrinks to the arrow strip; the arrow brings it back. Also: Field Super → Jobs → Create job has no PO field (web and phone).
4. [Brandon] Once it works, delete this block.

BRANDON TO DO — new native build 1.1.0 (Pass 45; agents skip this block). WHY: phones are on the 8/28 build (runtime 1.0.0, no expo-notifications). Every OTA update published since 9/7 imports expo-notifications, crashes on launch on that build, and expo-updates silently rolls back to the built-in bundle — so nothing from Pass 40 onward has ever shown on a phone. app.json is now version 1.1.0 (runtime 1.1.0), so the 8/28 installs stop being served updates they can't run. This is the SAME build Pass 41 step 6 asks for — doing it here ticks that step too. In order:
   STATUS 2026-11-03 (agent): EAS shows a 1.1.0 ANDROID build (2026-10-19) but NO 1.1.0 iOS build — iPhones are still on the 8/28 1.0.0 build and receive no updates (every production update now targets 1.1.0) until step 2's iOS build is made and installed.
1. [Brandon] (If the Pass 41 Firebase/FCM steps 2–3 aren't done, do them first so the build carries Android push; iOS needs nothing extra.)
2. [Brandon] `eas build --platform all --profile production`, then submit iOS to TestFlight and hand out the new APK. Everyone installs the new build.
3. [Brandon] From now on, JS changes ship with `eas update --channel production` as before — they target runtime 1.1.0 and only reach the new build.
4. [Brandon] Optional tidy-up so old 1.0.0 installs stop re-downloading a crashing update every launch: `eas update:roll-back-to-embedded --branch production --runtime-version 1.0.0 --message "1.0.0 stays on embedded"`.
5. [Brandon] Check: Settings → "About this app" on the new build shows Version 1.1.0 and the loaded update; the installer home screen shows the crew status line under the day label.
6. [Brandon] Once it works, delete this block. RULE going forward: any time a native dependency is added or removed, bump app.json `version` in the same commit and rebuild.

BRANDON TO DO — finish the single-notes change (Pass 44; agents skip this block). STATUS 2026-09-27: 20260924120000 (merge + drop field_notes) was applied while Live and the 8/28 phones still wrote field_notes, which broke every work request save; hotfix 20260927120000 put the column back (nullable, write-only sink) so all clients save again. Remaining, IN THIS ORDER:
   STATUS 2026-11-02 (agent): step 1 done — Live now carries the single-notes web code. Steps 2–3 remain (every phone on the 1.1.0 build, then the held drop migration).
1. [Brandon] Commit the working tree and merge Dev → Live; deploy the web build (single-notes code — no field_notes in writes).
2. [Brandon] Ship the 1.1.0 native build (the Pass 45 block above) and get every phone onto it. Until then, installers on the 8/28 build still see their old "Field Notes" box (writes go to the sink column; the office doesn't see that text yet).
3. [Brandon] ONLY once no one is on the 8/28 build: the final cleanup migration is already written and HELD at supabase/pending/drop_field_notes_after_1_1_0_rollout.sql (outside the migrations folder so `db push` can't run it early). Move it in with a fresh timestamp, then push:
   mv supabase/pending/drop_field_notes_after_1_1_0_rollout.sql supabase/migrations/$(date +%Y%m%d%H%M%S)_drop_field_notes.sql
   supabase db push
4. [Brandon] Test: as an installer on the phone, open a work request, type in Notes, tap away — then open the same card in the web quick view as a Scheduler or Field Super and confirm the text is there and editable; edit it on the web and confirm the phone shows the new text when the box isn't focused.
5. [Brandon] Once it works, delete this block.

BRANDON TO DO — manual setup for Field Super calendar task reminders (Pass 43; agents skip this block). The tasks themselves work as soon as step 1 is done; the reminder legs need the rest. Do these in order:
1. [Brandon] Apply migration 20260923120000_calendar_tasks.sql (`supabase db push`, or paste it into the SQL editor). It creates the calendar_tasks table, adds 'task_reminder' to the pushed notification types, and schedules a pg_cron job (`calendar-task-reminders`, every minute) that fires due reminders. If the SQL editor complains that pg_cron isn't available, enable it first: Dashboard → Database → Extensions → search "pg_cron" → enable, then re-run the migration.
2. [Brandon] Phone push for reminders needs nothing new — it rides the Pass 41 push setup (push_tokens + push-notification function + the two push_* app_settings rows + the new native build). If Pass 41 isn't done yet, reminders still land as in-app notifications and emails; the phone push starts working the moment Pass 41 is finished. One thing to redeploy: `supabase functions deploy push-notification` (the function now exempts task reminders from quiet hours).
3. [Brandon] Email needs Resend (same account/domain as the Pass 40 AR email — if that's done, reuse it; if not, do Pass 40 steps 2 first: resend.com account → add domain ox-glass.com → add the DNS records it shows → wait for Verified → create an API key).
4. [Brandon] Set the secrets (one command; replace the values; the webhook secret is any long random string — keep it for step 6). RESEND_API_KEY is shared with the AR email, so skip it if already set:
   supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="Ox WorkerHub <noreply@ox-glass.com>" TASK_REMINDER_WEBHOOK_SECRET=your-long-random-string
5. [Brandon] Deploy the Edge Function: `supabase functions deploy task-reminder-email`
6. [Brandon] Point the reminder sweep at the function — SQL editor, with your project ref and the SAME random string from step 4:
   insert into private.app_settings (key, value) values
     ('task_reminder_email_url', 'https://<project-ref>.supabase.co/functions/v1/task-reminder-email'),
     ('task_reminder_email_secret', 'your-long-random-string')
   on conflict (key) do update set value = excluded.value;
7. [Brandon] Each Field Super must have their email on their worker profile (Settings → Personal info, or the Operator's People page) — that's the address the reminder goes to; a worker with no email is skipped (the app notification and push still go out).
8. [Brandon] Test: as a Field Super, hover a day on the web calendar → click the ＋ row → create a task with "Remind me" on and a time a couple of minutes ahead. Within a minute of that time you should get the bell notification (and a phone push on the new build), and the email at your profile address. If nothing: SQL editor → `select * from cron.job_run_details order by start_time desc limit 10;` shows whether the sweep ran and any error; Edge Functions → task-reminder-email → Logs shows email problems (missing secret, unverified domain, no email on the worker).
9. [Brandon] Once it works, delete this block.

BRANDON TO DO — manual setup for the "job finished" accounts-receivable email (Pass 40; agents skip this block, it's not code work). Do these in order:
1. [Brandon] Apply the pending migrations to the Supabase project (`supabase db push`, or paste each into the SQL editor), newest last: 20260906120000_job_todos.sql, 20260906150000_job_photo_tags.sql, 20260906180000_job_issues_scheduler.sql, 20260907120000_job_status_field_super_finished_email.sql (and 20260828120000_work_request_delivery_casements.sql if it never went out). Skip any already applied.
2. [Brandon] Create a Resend account at resend.com. In Resend, add the domain ox-glass.com and add the DNS records it shows you (SPF/DKIM) at the domain registrar; wait for Resend to show the domain as Verified. Then create an API key (Sending access is enough).
3. [Brandon] Decide the recipient(s): the accounts receivable address(es) for AR_EMAIL_TO (comma-separated for several), any CC addresses for AR_EMAIL_CC (optional), and the from address for AR_EMAIL_FROM (must be on the verified domain, e.g. "Ox WorkerHub <noreply@ox-glass.com>").
4. [Brandon] Set the function secrets (one command; replace the values; the webhook secret is any long random string you make up — keep it for step 6):
   supabase secrets set RESEND_API_KEY=re_xxx AR_EMAIL_TO=ar@ox-glass.com AR_EMAIL_FROM="Ox WorkerHub <noreply@ox-glass.com>" JOB_FINISHED_WEBHOOK_SECRET=your-long-random-string
   (add AR_EMAIL_CC=someone@ox-glass.com to that command if anyone should be copied)
5. [Brandon] Deploy the Edge Function: `supabase functions deploy job-finished-email`
6. [Brandon] Point the database trigger at the function — in the Supabase SQL editor, with your project ref and the SAME random string from step 4:
   insert into private.app_settings (key, value) values
     ('job_finished_email_url', 'https://<project-ref>.supabase.co/functions/v1/job-finished-email'),
     ('job_finished_email_secret', 'your-long-random-string')
   on conflict (key) do update set value = excluded.value;
7. [Brandon] Test: as a Field Super, mark a throwaway job Finished (web sidebar edit mode, or the phone's "Mark job finished…" button) and confirm the email arrives at AR_EMAIL_TO. If nothing arrives, check the function's logs in the Supabase dashboard (Edge Functions → job-finished-email → Logs) — a missing secret or an unverified Resend domain shows up there as the error. Until step 6 is done the trigger silently does nothing, so the app keeps working either way.
8. [Brandon] Once it works, delete this block.

BRANDON TO DO — manual setup for real phone push notifications (Pass 41; agents skip this block). Do these in order:
1. [Brandon] Apply migration 20260907150000_push_notifications.sql (push_tokens table + the notifications → push trigger).
2. [Brandon] Android needs Firebase Cloud Messaging: at console.firebase.google.com create a (free) project, add an Android app with package name com.oxglass.workerhub, download its google-services.json, and save it at the repo root as ./google-services.json. The wiring is done: the file is git-ignored and app.config.js sets android.googleServicesFile from the GOOGLE_SERVICES_JSON file environment variable on EAS (or the local file when present). Upload it once to EAS (repeat with `--environment preview` if you make preview builds):
   eas env:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production --visibility secret
3. [Brandon] Upload the FCM V1 server credential to EAS: in the Firebase project go to Project settings → Service accounts → Generate new private key (a JSON file), then run `eas credentials` → Android → production → Google Service Account → FCM V1 → upload that JSON. (iOS needs nothing extra — EAS already holds your APNs key from the App Store builds; if `eas credentials` shows no Push Notification key under iOS, let it generate one.)
4. [Brandon] Set the function secret and deploy: `supabase secrets set PUSH_WEBHOOK_SECRET=<another long random string>` then `supabase functions deploy push-notification`.
5. [Brandon] Point the trigger at the function — SQL editor, with your project ref and the SAME string from step 4:
   insert into private.app_settings (key, value) values
     ('push_function_url', 'https://<project-ref>.supabase.co/functions/v1/push-notification'),
     ('push_webhook_secret', '<that random string>')
   on conflict (key) do update set value = excluded.value;
6. [Brandon] Build NEW native apps (expo-notifications is native code — an OTA update is not enough): `eas build --platform all --profile production`, then submit iOS to TestFlight and hand out the new APK as usual. Everyone must install the new build to receive pushes; older installs keep working with in-app notifications only.
7. [Brandon] Test: sign in on a phone running the new build, accept the notification permission prompt, then from the web console change something on a work request scheduled on that installer's crew for today (schedule_change) — the phone should get a system notification (outside 8 PM–6 AM Mountain; quiet hours skip the phone). Tapping it should open that work request. If nothing arrives: Supabase dashboard → Edge Functions → push-notification → Logs (look for "no-devices", "quiet-hours", or an Expo error), and Table editor → push_tokens to confirm the phone registered a row.
8. [Brandon] Once it works, delete this block.

# Unsure

change the way master jobs work. since master jobs have subjobs, make jobs that have subjobs no longer have their own issues, to-do's, work requests, photos, etc. the only thing a master job is is a folder for its subjobs. But it can be given details like a location, field super, flashing type, window count etc, some of those variables are passed to their subjobs so they should still exist. (THIS IS NOT AN IDEA WE ARE WANTING TO IMPLEMENT YET OR AT ALL. Its just an idea for later.)

(nothing open — the Field Super web gating calls from the 2026-08-28 audit were settled in Pass 42)



# DONE

Completed edits live in [Dev-Tracker-Done.md](Dev-Tracker-Done.md), newest first. When an Awaiting edit above is implemented, remove it from this file and log it at the top of that one.
