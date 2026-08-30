-- Reviews table for YourMarket
-- Each user may write at most one review per product.
-- Reviews are readable by everyone (guests + authenticated users),
-- but only the author (and authenticated accounts) may create/modify/delete.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  user_id uuid not null default auth.uid(),
  rating integer not null check (rating between 1 and 5),
  title text,
  content text not null default '',
  author_name text,
  created_at timestamptz not null default now(),
  constraint reviews_product_user_unique unique (product_id, user_id)
);

comment on table public.reviews is 'Product reviews written by authenticated users';

-- Automatic updated_at is not maintained; reviews are append/edit style only.

alter table public.reviews enable row level security;

-- Anyone (including guests) can read published product reviews.
create policy "Reviews are publicly readable"
  on public.reviews
  for select
  using (true);

-- Authenticated users can create a review, tied to their own account.
create policy "Authenticated users can insert their own reviews"
  on public.reviews
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and rating between 1 and 5
  );

-- Authors can edit / delete only their own reviews.
create policy "Users can update their own reviews"
  on public.reviews
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own reviews"
  on public.reviews
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Helpful index for the product detail page query.
create index if not exists reviews_product_id_idx on public.reviews (product_id);
create index if not exists reviews_created_at_idx on public.reviews (created_at desc);
