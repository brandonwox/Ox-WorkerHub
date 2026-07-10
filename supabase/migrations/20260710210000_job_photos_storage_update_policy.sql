-- Photo uploads retry with upsert (see uploadJobPhoto): once a half-failed
-- attempt has created the storage object, the retry takes storage's UPDATE
-- path on storage.objects. The job_photos migration only created INSERT and
-- DELETE policies, so that retry died with a bare RLS error forever. Mirror
-- the insert policy for updates, scoped to the same bucket.
create policy job_photos_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'job-photos')
  with check (bucket_id = 'job-photos');
