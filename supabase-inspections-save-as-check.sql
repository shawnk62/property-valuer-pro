-- Step 1: Save as / duplicate prerequisites for public.inspections
-- Run in Supabase → SQL Editor. Safe to re-run.

-- Columns used by the app
alter table public.inspections
  add column if not exists report_extras jsonb;

alter table public.inspections
  add column if not exists submitted_form_values jsonb;

alter table public.inspections
  add column if not exists submitted_schema_version text;

alter table public.inspections
  add column if not exists edit_lock_device_id text,
  add column if not exists edit_lock_label text,
  add column if not exists edit_lock_at timestamptz;

-- RLS must be on; policies must allow the signed-in user to INSERT their own rows
alter table public.inspections enable row level security;

-- SELECT own rows
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inspections' and policyname = 'inspections_select_own'
  ) then
    create policy inspections_select_own
      on public.inspections for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- INSERT own rows (required for Save as)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inspections' and policyname = 'inspections_insert_own'
  ) then
    create policy inspections_insert_own
      on public.inspections for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

-- UPDATE own rows
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inspections' and policyname = 'inspections_update_own'
  ) then
    create policy inspections_update_own
      on public.inspections for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- DELETE own rows
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'inspections' and policyname = 'inspections_delete_own'
  ) then
    create policy inspections_delete_own
      on public.inspections for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- Quick visibility check (run and read the results)
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'inspections'
order by ordinal_position;

select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'inspections'
order by policyname;
