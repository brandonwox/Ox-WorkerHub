-- Per-photo type tag (Window, SGD, Mirror, Shower, Swing Door, Screen, IGU,
-- Storefront).
--
-- Picked by the taker in the in-app camera: a session-wide default via the
-- camera's type button, or per shot from the expanded image view. Optional —
-- untyped photos stay valid. Stored as free text (the app's JobPhotoType
-- union) so adding a type later needs no migration; existing owner-only
-- update RLS on job_photos already covers writes to this column.

alter table public.job_photos add column if not exists photo_type text;
