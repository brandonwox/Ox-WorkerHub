-- HELD MIGRATION — DO NOT APPLY YET. Lives OUTSIDE supabase/migrations/ on
-- purpose so `supabase db push` cannot run it early.
--
-- Final step of the single-notes change (Pass 44): work_requests.field_notes
-- was merged into `notes` and dropped on 2026-09-24, then put back as a
-- nullable write-only sink on 2026-09-27 (20260927120000) because the Live
-- web build and the 8/28 phone builds still wrote it on every save.
--
-- GATE — apply only when BOTH are true:
--   1. Live carries the single-notes web code (Pass 44 step 1 shipped).
--   2. Every phone runs the 1.1.0 native build or newer (Pass 45) — no one is
--      on the 8/28 build any more (that build writes field_notes on every
--      work request save and would break the moment the column is gone).
--
-- WHEN READY:
--   mv supabase/pending/drop_field_notes_after_1_1_0_rollout.sql \
--      supabase/migrations/$(date +%Y%m%d%H%M%S)_drop_field_notes.sql
--   supabase db push
-- (or paste the SQL below into the SQL editor — then still move the file so
-- the migration history matches).
--
-- What it does: re-merges anything old-phone installers typed into the sink
-- column since 09-27 (same rule as before: notes, a blank line, then the
-- field notes; rows with only one keep that text as-is), then drops the
-- column for good. Idempotent — safe to run twice.

update public.work_requests
   set notes = case
                 when notes is null or btrim(notes) = '' then field_notes
                 else notes || E'\n\n' || field_notes
               end
 where field_notes is not null
   and btrim(field_notes) <> ''
   -- Skip rows whose notes already contain the sink text (a re-run).
   and (notes is null or position(field_notes in notes) = 0);

alter table public.work_requests
  drop column if exists field_notes;
