-- Crew colors + one permanent crew per installer.
--
-- 1) crews.color / daily_crews.color — a scheduler-picked display color
--    (hex). Null keeps the automatic palette assignment the app has always
--    used (keyed by alphabetical position).
--
-- 2) One permanent crew per installer, enforced at the DB: a unique index on
--    crew_members(installer_id). Daily crews are exempt (their own table).
--    Existing double-memberships (the app rule was never enforced, so some
--    may exist) are cleaned first: the installer KEEPS the membership in
--    their oldest crew (created_at, id tiebreak) and is dropped from the
--    rest. If a dropped row carried a foreman tag, that crew shows up in
--    Manage Crews as "needs a foreman" — the existing flag flow.

-- ===========================================================================
-- Colors
-- ===========================================================================
alter table public.crews
  add column if not exists color text
    check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.daily_crews
  add column if not exists color text
    check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');

-- ===========================================================================
-- One permanent crew per installer
-- ===========================================================================
with ranked as (
  select
    cm.crew_id,
    cm.installer_id,
    row_number() over (
      partition by cm.installer_id
      order by c.created_at, c.id
    ) as rn
  from public.crew_members cm
  join public.crews c on c.id = cm.crew_id
)
delete from public.crew_members cm
using ranked r
where cm.crew_id = r.crew_id
  and cm.installer_id = r.installer_id
  and r.rn > 1;

create unique index if not exists crew_members_one_crew_per_installer
  on public.crew_members (installer_id);
