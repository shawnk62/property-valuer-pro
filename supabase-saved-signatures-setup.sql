-- Saved valuer signatures (optional multi-device sync for Signature pad).
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists public.saved_signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null default 'My signature',
  image_data text not null,
  created_at timestamptz not null default now()
);

create index if not exists saved_signatures_user_id_idx
  on public.saved_signatures (user_id);

alter table public.saved_signatures enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_signatures'
      and policyname = 'saved_signatures_select_own'
  ) then
    create policy saved_signatures_select_own
      on public.saved_signatures for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_signatures'
      and policyname = 'saved_signatures_insert_own'
  ) then
    create policy saved_signatures_insert_own
      on public.saved_signatures for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_signatures'
      and policyname = 'saved_signatures_update_own'
  ) then
    create policy saved_signatures_update_own
      on public.saved_signatures for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'saved_signatures'
      and policyname = 'saved_signatures_delete_own'
  ) then
    create policy saved_signatures_delete_own
      on public.saved_signatures for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
