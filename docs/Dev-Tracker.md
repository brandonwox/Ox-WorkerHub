# Dev Tracker
This file is used by the developer of Ox WorkerHub. (Agents may use this file in accordance to instructions from the developer.)


# Awaiting

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
