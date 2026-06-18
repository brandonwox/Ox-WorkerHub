-- Give the Operator write access to jobcards, crews, and scheduling.
--
-- The initial schema (20260614201808_initial_schema.sql) split every write
-- policy strictly by role: only a project_manager may write jobcards, and only
-- a scheduler may write crews / daily crews / their members / assignments. In
-- practice the Operator is the owner/admin and does ALL of this work, so every
-- such write was being rejected by RLS. Because the store fires these writes
-- fire-and-forget (src/store/useAppStore.ts `write()`), the rejection was
-- swallowed as a console warning: the UI updated in memory but nothing
-- persisted, and the row vanished on the next reload.
--
-- Operators already have full write access to jobs and workers; this extends the
-- same admin reach to the remaining collections. The role-specific policies stay
-- in place (RLS permissive policies are OR'd), so a project_manager / scheduler
-- keeps exactly the access they had — the Operator is simply added alongside.
--
-- The existing column-guard triggers (guard_jobcard_installer_update, etc.) only
-- restrict installers/PMs, so an Operator update passes them untouched.

-- --- jobcards (Operator: full write) --------------------------------------
create policy jobcards_insert_operator on public.jobcards
  for insert to authenticated
  with check ((select private.current_app_role()) = 'operator');
create policy jobcards_update_operator on public.jobcards
  for update to authenticated
  using ((select private.current_app_role()) = 'operator')
  with check ((select private.current_app_role()) = 'operator');
create policy jobcards_delete_operator on public.jobcards
  for delete to authenticated
  using ((select private.current_app_role()) = 'operator');

-- --- crews / daily crews / members / assignments (Operator: full write) ----
create policy crews_write_operator on public.crews
  for all to authenticated
  using ((select private.current_app_role()) = 'operator')
  with check ((select private.current_app_role()) = 'operator');

create policy crew_members_write_operator on public.crew_members
  for all to authenticated
  using ((select private.current_app_role()) = 'operator')
  with check ((select private.current_app_role()) = 'operator');

create policy daily_crews_write_operator on public.daily_crews
  for all to authenticated
  using ((select private.current_app_role()) = 'operator')
  with check ((select private.current_app_role()) = 'operator');

create policy daily_crew_members_write_operator on public.daily_crew_members
  for all to authenticated
  using ((select private.current_app_role()) = 'operator')
  with check ((select private.current_app_role()) = 'operator');

create policy schedule_assignments_write_operator on public.schedule_assignments
  for all to authenticated
  using ((select private.current_app_role()) = 'operator')
  with check ((select private.current_app_role()) = 'operator');
