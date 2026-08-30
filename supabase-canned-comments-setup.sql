-- Canned narrative comments (per section, labelled).
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists public.canned_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  section text not null,
  label text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canned_comments_user_section_idx
  on public.canned_comments (user_id, section, label);

alter table public.canned_comments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'canned_comments'
      and policyname = 'canned_comments_select_own'
  ) then
    create policy canned_comments_select_own
      on public.canned_comments for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'canned_comments'
      and policyname = 'canned_comments_insert_own'
  ) then
    create policy canned_comments_insert_own
      on public.canned_comments for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'canned_comments'
      and policyname = 'canned_comments_update_own'
  ) then
    create policy canned_comments_update_own
      on public.canned_comments for update
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
      and tablename = 'canned_comments'
      and policyname = 'canned_comments_delete_own'
  ) then
    create policy canned_comments_delete_own
      on public.canned_comments for delete
      to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;
