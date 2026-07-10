-- Window Flashing Material reference photo on a job.
--
-- The Field Super photographs (or uploads) the flashing material used across
-- the jobsite; the image shows next to the flashing material text everywhere —
-- including every jobcard of the job, so installers see what to grab.
--
-- The image bytes live in the existing `job-photos` storage bucket at
-- "<job_id>/flashing-<uuid>.jpg" (public reads, same as job photos); this
-- column stores the object path. Replacing the photo writes a new object and
-- best-effort deletes the old one.
--
-- No RLS/trigger changes needed: private.guard_job_field_super_update() only
-- blocklists name/location/status/qbt_jobcode_id, so Field Supers may write
-- this new column under the existing jobs_update_field_super policy, and the
-- job-photos bucket policies already allow authenticated inserts + Field
-- Super deletes.
alter table public.jobs
  add column if not exists flashing_photo_path text;
