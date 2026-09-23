# Dev Tracker
This file is used by the developer of Ox WorkerHub. (Agents may use this file in accordance to instructions from the developer.)


# Awaiting

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
2. [Brandon] Android needs Firebase Cloud Messaging: at console.firebase.google.com create a (free) project, add an Android app with package name com.oxglass.workerhub, download its google-services.json, and save it at the repo root as ./google-services.json. Then in app.json under "android" add:  "googleServicesFile": "./google-services.json"  (leave the file out of git if you prefer — add it to .gitignore and set it as an EAS file secret; ask an agent to wire that if so).
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
