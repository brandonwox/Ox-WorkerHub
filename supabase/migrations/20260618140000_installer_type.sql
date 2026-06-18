-- Add an Operator-assigned installer specialty title to workers.
-- Purely cosmetic: it drives no scheduling or permissions, it's just a label.
-- Writes are already restricted to the Operator by the existing
-- workers_update_operator RLS policy (the self-update policy only lets an
-- installer touch their own row, and they have no UI to set this).
alter table public.workers
  add column installer_type text not null default '';
