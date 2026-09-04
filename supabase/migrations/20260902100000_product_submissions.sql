-- Product Submissions: customer-initiated product listings requiring admin review.
-- Customers may submit product details + images. Submissions start as 'pending'
-- and must be reviewed by an admin before becoming a public product.

-- ===========================================================================
-- 1) product_submissions table
-- ===========================================================================
create table if not exists public.product_submissions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  product_name  text not null,
  category      text not null,
  brand         text,
  condition     text not null default 'New',
  expected_price numeric not null,
  quantity      integer not null default 1,
  description   text,
  city          text,
  image_urls    jsonb not null default '[]'::jsonb,
  status        text not null default 'pending',
  admin_note    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);

comment on table public.product_submissions is 'Customer product submissions pending admin review';

-- Constraints
alter table public.product_submissions
  add constraint product_submissions_expected_price_check
    check (expected_price >= 0);

alter table public.product_submissions
  add constraint product_submissions_quantity_check
    check (quantity > 0);

alter table public.product_submissions
  add constraint product_submissions_status_check
    check (status in ('pending', 'approved', 'rejected'));

alter table public.product_submissions
  add constraint product_submissions_condition_check
    check (condition in ('New', 'Like New', 'Used'));

-- Indexes
create index if not exists product_submissions_user_idx
  on public.product_submissions (user_id);

create index if not exists product_submissions_status_idx
  on public.product_submissions (status);

create index if not exists product_submissions_created_idx
  on public.product_submissions (created_at desc);

-- ===========================================================================
-- 2) RLS
-- ===========================================================================
alter table public.product_submissions enable row level security;

-- Customers can read only their own submissions
drop policy if exists "Customers can read own submissions" on public.product_submissions;
create policy "Customers can read own submissions"
  on public.product_submissions for select
  to authenticated
  using (auth.uid() = user_id);

-- Customers can create submissions as themselves (user_id forced by trigger)
drop policy if exists "Customers can create submissions" on public.product_submissions;
create policy "Customers can create submissions"
  on public.product_submissions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Customers can update limited fields on their own pending submissions
drop policy if exists "Customers can update own pending submissions" on public.product_submissions;
create policy "Customers can update own pending submissions"
  on public.product_submissions for update
  to authenticated
  using (auth.uid() = user_id and status = 'pending')
  with check (auth.uid() = user_id and status = 'pending');

-- Customers can delete their own pending submissions
drop policy if exists "Customers can delete own pending submissions" on public.product_submissions;
create policy "Customers can delete own pending submissions"
  on public.product_submissions for delete
  to authenticated
  using (auth.uid() = user_id and status = 'pending');

-- Admins can read all submissions
drop policy if exists "Admins can read all submissions" on public.product_submissions;
create policy "Admins can read all submissions"
  on public.product_submissions for select
  to authenticated
  using (public.is_admin());

-- Admins can update any submission (review/approve/reject)
drop policy if exists "Admins can update submissions" on public.product_submissions;
create policy "Admins can update submissions"
  on public.product_submissions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Admins can delete any submission
drop policy if exists "Admins can delete submissions" on public.product_submissions;
create policy "Admins can delete submissions"
  on public.product_submissions for delete
  to authenticated
  using (public.is_admin());

-- ===========================================================================
-- 3) Trigger: force user_id from auth.uid() on insert (prevent spoofing)
-- ===========================================================================
create or replace function public.set_submission_user_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();
  new.status := 'pending';
  new.admin_note := null;
  new.reviewed_at := null;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_set_submission_user_id on public.product_submissions;
create trigger trg_set_submission_user_id
  before insert on public.product_submissions
  for each row
  execute function public.set_submission_user_id();

-- ===========================================================================
-- 4) Triggers: auto-set updated_at on update AND protect admin review columns.
-- ---------------------------------------------------------------------------
-- update_submission_timestamp: keep updated_at current.
--
-- protect_submission_admin_fields: a customer may edit their own PENDING row
-- (RLS permits it) but must NOT be able to modify admin_note / reviewed_at.
-- RLS with-check already forces status to remain 'pending' for customers, but
-- admin_note and reviewed_at are not restricted by the SELECT-only READ of the
-- owner policy, so this trigger forces those columns to their stored values
-- for any non-admin. Admins (is_admin()) may set them normally during review.
-- ===========================================================================
create or replace function public.update_submission_timestamp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_submission_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.admin_note  := old.admin_note;
    new.reviewed_at := old.reviewed_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_update_submission_timestamp on public.product_submissions;
create trigger trg_update_submission_timestamp
  before update on public.product_submissions
  for each row
  execute function public.update_submission_timestamp();

drop trigger if exists trg_protect_submission_admin_fields on public.product_submissions;
create trigger trg_protect_submission_admin_fields
  before update on public.product_submissions
  for each row
  execute function public.protect_submission_admin_fields();

-- ===========================================================================
-- 5) submission-images storage bucket (PRIVATE)
--    Submissions carry customer contact info and may be unpublished/rejected,
--    so the bucket is PRIVATE (public = false). There is NO public SELECT
--    policy and NO public get-public-URL in the client. Reads use signed URLs:
--    owner (path-based auth.uid()) and admins (is_admin()) only.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('submission-images', 'submission-images', false)
on conflict (id) do nothing;

-- Owners can read their own submission images (signed-URL reads)
drop policy if exists "Owners can read own submission images" on storage.objects;
create policy "Owners can read own submission images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'submission-images'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Admins can read all submission images (signed-URL reads during review)
drop policy if exists "Admins can read submission images" on storage.objects;
create policy "Admins can read submission images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'submission-images'
    and public.is_admin()
  );

-- Authenticated users can upload to their own folder
drop policy if exists "Users can upload submission images" on storage.objects;
create policy "Users can upload submission images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'submission-images'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Users can delete their own submission images
drop policy if exists "Users can delete own submission images" on storage.objects;
create policy "Users can delete own submission images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'submission-images'
    and (storage.foldername(name))[1] = 'submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- Admins can manage all submission images (for review/cleanup)
drop policy if exists "Admins can manage submission images" on storage.objects;
create policy "Admins can manage submission images"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'submission-images'
    and public.is_admin()
  )
  with check (
    bucket_id = 'submission-images'
    and public.is_admin()
  );
