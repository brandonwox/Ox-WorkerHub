# Supabase setup — Ox WorkerHub

This is the backend for accounts, the Operator's worker invites, and the weekly
QuickBooks Time push. Do the steps in **Part 1** and hand back the two values in
**Part 2**; the agent builds everything in **Part 3** once it has them.

> Security rule that shapes all of this: the **service role key never goes in
> the app**. The app only ever uses the publishable (anon) key. Anything that
> needs admin rights (sending invites, the weekly QBT push) runs in an Edge
> Function where secrets stay server-side.

---

## Part 1 — Create the project (you do this)

1. Go to <https://supabase.com/dashboard> → **New project**.
   - Name: `ox-workerhub` (anything is fine).
   - Pick a region close to you; set a strong database password and save it.
2. When it finishes provisioning, open **Project Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **Publishable / anon key** (the `anon` `public` key — safe for the app)
3. Install the CLI so the agent can push migrations and deploy functions:
   ```bash
   npm install -g supabase
   supabase --version
   ```
   Then from the project root, log in and link (you'll paste an access token and
   the project ref from the dashboard URL when prompted):
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   ```

## Part 2 — Hand these back to the agent

- ✅ **Project URL**
- ✅ **anon (publishable) key**
- ✅ Confirm `supabase link` succeeded (so migrations/functions can deploy)

The agent pastes the URL + anon key into `app.json → expo.extra.supabase` and
proceeds. The **service role key** is *not* needed in the app — the agent will
have you set it as a Function secret instead (Part 3).

## Part 3 — What the agent builds next (after Part 2)

1. **Client** (`src/integrations/supabase/`): `supabase-js` configured for Expo
   (AsyncStorage session, URL polyfill, deep-link redirect), an auth/session
   bootstrap that drives the active worker + role, and a workers data layer.
2. **Schema + RLS** (migrations): `app_role` enum and `workers`, `jobs`,
   `timesheets` tables. RLS on every table — installers see only their own rows;
   operators manage everyone; a `SECURITY DEFINER` helper resolves the caller's
   role from `workers` (never from user-editable metadata).
3. **Edge Functions** (`supabase/functions/`):
   - `invite-worker` — verifies the caller is an Operator, then
     `auth.admin.inviteUserByEmail(...)` and inserts the `workers` row. Uses the
     service role from function env.
   - `push-timesheets-to-qbt` — scheduled with `pg_cron` for **Mondays 07:30**;
     pushes the week's timesheets to QuickBooks Time.
4. **Secrets you'll set** (server-side only, via CLI — the agent gives exact
   commands):
   - `SUPABASE_SERVICE_ROLE_KEY` (from Project Settings → API)
   - `QBT_ACCESS_TOKEN` (your QuickBooks Time personal token — this moves out of
     `app.json`, where it's currently exposed to clients, into the function)

   ```bash
   supabase secrets set QBT_ACCESS_TOKEN=xxxxx
   # service role is available to functions automatically on Supabase-hosted runs
   ```
