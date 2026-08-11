-- Statutory inspection record: freeze form answers at submit time.
-- Run once in Supabase → SQL Editor (Valuer Pro phase 1).

alter table public.inspections
  add column if not exists submitted_form_values jsonb;

alter table public.inspections
  add column if not exists submitted_schema_version text;

comment on column public.inspections.submitted_form_values is
  ''Immutable copy of form_values written once when status becomes submitted (inspection notes for statutory retention).'';

comment on column public.inspections.submitted_schema_version is
  ''Schema version that applied when the inspection was submitted.'';

-- Backfill existing submitted rows that have no snapshot yet.
update public.inspections
set
  submitted_form_values = form_values,
  submitted_schema_version = coalesce(submitted_schema_version, schema_version)
where status = ''submitted''
  and submitted_form_values is null;
