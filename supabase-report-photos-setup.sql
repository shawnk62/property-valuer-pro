-- Run in Supabase SQL Editor (or create via Storage UI).
-- Bucket for valuation report photographs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-photos',
  'report-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set public = excluded.public;

-- Authenticated users can upload only into their own folder: {userId}/...
create policy "report_photos_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "report_photos_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "report_photos_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'report-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Public read so report preview and Word export can load image URLs.
create policy "report_photos_select_public"
on storage.objects for select
using (bucket_id = 'report-photos');
