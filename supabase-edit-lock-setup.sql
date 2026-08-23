-- Single-active-editor lock for inspections / report drafts.
-- Run once in Supabase → SQL Editor.

alter table public.inspections
  add column if not exists edit_lock_device_id text,
  add column if not exists edit_lock_label text,
  add column if not exists edit_lock_at timestamptz;

comment on column public.inspections.edit_lock_device_id is
  'Device id currently editing this inspection/report (null = unlocked).';
comment on column public.inspections.edit_lock_label is
  'Human-readable holder (email or device label).';
comment on column public.inspections.edit_lock_at is
  'Last lock heartbeat. Stale locks may be taken over after ~45 minutes.';
