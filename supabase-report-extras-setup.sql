-- Report draft extras (narrative, photos metadata, sales, meta) shared across devices.
-- Run once in Supabase → SQL Editor (Valuer Pro phase 1).

alter table public.inspections
  add column if not exists report_extras jsonb;

comment on column public.inspections.report_extras is
  ''Report workspace extras: narrative, photos (https URLs + paths), sales, reportMeta. Synced so iPad/desktop share the same draft.'';
