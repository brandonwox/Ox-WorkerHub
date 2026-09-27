-- HOTFIX: restore work_requests.field_notes as a compatibility column.
--
-- 20260924120000_work_request_single_notes.sql merged field_notes into notes
-- and dropped the column — but it was applied while every shipped client
-- (the Live web build and the 8/28 phone builds) still writes `field_notes`
-- on EVERY work request insert/update. Postgres rejected each write
-- ("column field_notes does not exist"), so from 2026-09-2x no one could
-- create or edit a work request ("A change couldn't be saved").
--
-- Putting the nullable column back makes those clients' writes succeed again
-- at once. New-code clients don't send it, and nothing reads it: it's a
-- write-only sink until every phone runs the 1.1.0 build and Live carries
-- the single-notes code. THEN a final migration re-merges whatever old-phone
-- installers typed into it (same rule: notes, blank line, field_notes) and
-- drops it for good — see the Brandon block in docs/Dev-Tracker.md.
--
-- Lesson: never drop or rename a column that shipped clients still write.
-- Add first, ship the clients, remove last.

alter table public.work_requests
  add column if not exists field_notes text;
