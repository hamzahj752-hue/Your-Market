-- Review images: table + private storage bucket
-- Customers may attach up to 5 photos per review.
-- Images are stored in a PRIVATE bucket and served via signed URLs.
-- Public visibility is gated on the parent review's moderation_status:
--   only approved reviews expose their images to anonymous/public users.
-- Authors and admins can always see their own / all images.

-- =========================================================================
-- 1) Table
-- =========================================================================
create table if not exists public.review_images (
  id            uuid primary key default gen_random_uuid(),
  review_id     uuid not null references public.reviews(id) on delete cascade,
  user_id       uuid not null default auth.uid(),
  storage_path  text not null,
  mime_type     text not null default 'image/jpeg',
  file_size     integer not null default 0,
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);

comment on table  public.review_images is 'Photos attached to product reviews';
comment on column public.review_images.storage_path is 'Path in the review-images storage bucket (not a URL)';

alter table public.review_images enable row level security;

-- Owner read / write (authors can always see/manage their own images)
create policy "Review image owners can read their images"
  on public.review_images for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Review image owners can insert their images"
  on public.review_images for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and coalesce(storage_path, '') <> ''
    -- Defense in depth: an image may only be attached to a review the caller
    -- actually owns. This prevents attaching an image to another customer's
    -- review even when bypassing the API route. The author can always read
    -- their own review (RLS), so this subquery is recursion-free.
    and exists (
      select 1 from public.reviews r
      where r.id = review_images.review_id
        and r.user_id = auth.uid()
    )
  );

create policy "Review image owners can delete their images"
  on public.review_images for delete
  to authenticated
  using (auth.uid() = user_id);

-- Public: read images attached to approved reviews only
create policy "Public can view approved review images"
  on public.review_images for select
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_images.review_id
        and r.moderation_status = 'approved'
    )
  );

-- Admin full access
create policy "Admins can manage all review images"
  on public.review_images for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index if not exists review_images_review_id_idx on public.review_images (review_id);

-- Hard DB-level cap on photos per review (defense in depth behind the API's
-- MAX_PHOTOS check). Counting the owning user's rows prevents a customer from
-- exceeding the limit by inserting directly.
create or replace function public.review_images_limit_photos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.review_images
  where review_id = new.review_id;
  if v_count >= 5 then
    raise exception 'Maximum 5 photos per review.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_review_images_limit_photos on public.review_images;
create trigger trg_review_images_limit_photos
  before insert on public.review_images
  for each row
  execute function public.review_images_limit_photos();

-- =========================================================================
-- 2) Storage bucket (private)
-- =========================================================================
insert into storage.buckets (id, name, public)
  values ('review-images', 'review-images', false)
  on conflict (id) do nothing;

-- Upload: authenticated users to own folder only
create policy "Authenticated users can upload review images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'review-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Read: only the image owner, or users who can see the parent review
-- (approved review → public read; author → always; admin → always).
create policy "Users can read review images they own or are approved"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'review-images'
    and (
      -- Owner
      (storage.foldername(name))[1] = auth.uid()::text
      -- Approved review images (review_images RLS enforces approval check)
      or exists (
        select 1
        from public.review_images ri
        join public.reviews r on r.id = ri.review_id
        where ri.storage_path = name
          and r.moderation_status = 'approved'
      )
      -- Admin
      or public.is_admin()
    )
  );

-- Public anon can read approved review images via signed URLs
create policy "Public can read approved review images"
  on storage.objects for select
  to anon
  using (
    bucket_id = 'review-images'
    and exists (
      select 1
      from public.review_images ri
      join public.reviews r on r.id = ri.review_id
      where ri.storage_path = name
        and r.moderation_status = 'approved'
    )
  );

-- Delete: owner or admin
create policy "Owners and admins can delete review images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'review-images'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
