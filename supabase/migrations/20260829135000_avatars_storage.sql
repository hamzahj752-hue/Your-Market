-- Phase 2: avatars storage bucket + policies
-- The account page uploads a profile photo to the "avatars" bucket using the
-- path "<user_id>/avatar.<ext>". This migration idempotently creates the bucket
-- and scopes access so that every user can only manage their own avatar.

-- Create the storage bucket if it does not already exist.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Ownership is enforced by the first path segment matching the caller's uid.
create policy "Users can read their own avatars"
  on storage.objects for select
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload their own avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can update their own avatars"
  on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own avatars"
  on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
