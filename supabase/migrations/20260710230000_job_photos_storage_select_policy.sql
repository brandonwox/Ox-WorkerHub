-- Root-cause fix for photo uploads failing with a bare "new row violates
-- row-level security policy": the app uploads with upsert:true, which storage
-- executes as INSERT ... ON CONFLICT DO UPDATE. Postgres requires INSERT,
-- UPDATE *and* SELECT policies on storage.objects to run that statement —
-- even when no conflicting row exists. The original job_photos migration only
-- created INSERT + DELETE (UPDATE was added in the previous migration), so
-- every upsert upload was rejected. Verified empirically: the upsert INSERT
-- fails as `authenticated` without this policy and passes with it.
create policy job_photos_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'job-photos');
