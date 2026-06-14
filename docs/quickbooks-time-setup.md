# QuickBooks Time integration

Ox WorkerHub pushes each timecard to **QuickBooks Time** (formerly TSheets) via
its REST API. Workers' hours land in the QuickBooks Time timesheet queue, where
the payroll manager reviews and approves them.

The integration is **invisible to workers** — there is no QuickBooks Time UI in
the app. Installers just clock in and out; hours report automatically in the
background. All configuration lives in `app.json` and ships with the build.

## What got built

| Area | File |
| --- | --- |
| Build-time config (token, base URL, jobcode mappings) | `src/integrations/quickbooksTime/config.ts` |
| REST client (auth, jobcodes, create/update/delete timesheets, approval window) | `src/integrations/quickbooksTime/client.ts` |
| Sync orchestration (startup connect, submit, silent auto-sync) | `src/integrations/quickbooksTime/sync.ts` |
| Store state + actions | `src/store/useAppStore.ts` (`qbt` slice) |
| Startup connect | `src/app/_layout.tsx` (`ensureQbtConnection`) |

## How it flows

1. On launch, `ensureQbtConnection()` reads the baked-in token and looks up the
   QuickBooks Time user it belongs to.
2. A worker clocks out (or adds a manual timecard). If `autoSync` is on, the log
   is POSTed to QuickBooks Time as a `regular` timesheet in the background.
3. The payroll manager reviews and approves the hours **inside QuickBooks Time**
   (Time → Approve Timesheets). That approval workflow, locking and payroll
   export are Intuit's; we only feed timesheets into it.

Sync status (submitted / approved / error) is still tracked per-log in the store
for diagnostics, but nothing about it is shown to the worker.

## Getting the API access token

1. Sign in to QuickBooks Time as an **admin**.
2. **Feature Add-ons → Manage Add-ons**, then install **API**.
3. Open the **API** add-on → **Add New** application (any name/URL).
4. Copy the **API access token** — a long bearer token tied to your company.
   The manual add-on token does not expire and is the right choice for a
   single-company integration. (For a multi-company/public app you'd switch to
   OAuth 2.0; the client already sends a standard `Bearer` token, so only
   token-acquisition would change.)

## Where to put the token (baked into the build)

Edit `app.json` → `expo.extra.quickbooksTime`:

```json
"extra": {
  "quickbooksTime": {
    "accessToken": "PASTE_YOUR_TOKEN_HERE",
    "baseUrl": "https://rest.tsheets.com/api/v1",
    "autoSync": true,
    "defaultJobcodeId": 12345,
    "jobcodeMap": {
      "job:j-1": 12345,
      "custom:shop fabrication": 67890
    }
  }
}
```

- `accessToken` — the token from above. Empty string = integration stays idle.
- `autoSync` — `true` submits hours automatically on clock-out.
- `defaultJobcodeId` — jobcode used for any project without a specific mapping.
  Hours can't post without at least this set (QuickBooks Time books time against
  jobcodes, not free-text names).
- `jobcodeMap` — optional per-project overrides. Keys are `job:<jobId>` for
  scheduled jobs or `custom:<lowercased project name>` for ad-hoc projects.

To find your jobcode ids, call `GET https://rest.tsheets.com/api/v1/jobcodes`
with `Authorization: Bearer <token>`, or read them off the QuickBooks Time web
dashboard.

## Notes / future considerations

- **Single QBT identity:** a baked-in token files all hours under the one
  QuickBooks Time user the token belongs to. For per-worker attribution you'd
  need per-worker tokens or OAuth login.
- **Timezone:** start/end are sent as the device's ISO time (UTC `Z`). To pin
  timesheets to a fixed business timezone regardless of device, the offset would
  need to be made explicit in `sync.ts`.
