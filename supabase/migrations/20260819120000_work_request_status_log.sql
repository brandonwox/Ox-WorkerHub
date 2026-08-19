-- Work request status log: a permanent per-card history of every status
-- change ({id, status, note?, at, byId?} entries, oldest first) the office
-- reviews from the quick view. The app appends an entry on every
-- setWorkRequestStatus call — including the new office-side "Reset status"
-- back to 'Undefined'.
--
-- No installer-guard change needed: guard_work_request_installer_update is a
-- column BLOCKLIST, so the new column is installer-writable by omission
-- (installers append to the log when they report a status, exactly like
-- status_note / status_changed_at).

alter table public.work_requests
  add column if not exists status_log jsonb not null default '[]'::jsonb;

-- Backfill: a card whose current status predates the log gets a single entry
-- synthesized from the last-change columns, so its history doesn't start empty.
update public.work_requests
set status_log = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'status', status,
      'note', status_note,
      'at', status_changed_at,
      'byId', status_changed_by
    )
  )
)
where status <> 'Undefined'
  and status_changed_at is not null
  and status_log = '[]'::jsonb;
