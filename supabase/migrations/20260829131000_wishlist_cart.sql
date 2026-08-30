-- Phase 2: wishlist_items + cart_items
-- wishlist_items persists a user's saved products (created for the app; kept idempotent).
-- cart_items persists a signed-in user's cart across devices.

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  product jsonb,
  created_at timestamptz not null default now()
);

comment on table public.wishlist_items is 'Saved products per user';

-- Ensure a user can hold each product once in their wishlist.
-- Wrapped so it does not fail if the index already exists.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'wishlist_items'
      and indexdef ilike '%user_id%product_id%'
  ) then
    create unique index wishlist_items_user_product_idx
      on public.wishlist_items (user_id, product_id);
  end if;
end $$;

alter table public.wishlist_items enable row level security;

drop policy if exists "Users can view own wishlist" on public.wishlist_items;
create policy "Users can view own wishlist"
  on public.wishlist_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add own wishlist" on public.wishlist_items;
create policy "Users can add own wishlist"
  on public.wishlist_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own wishlist" on public.wishlist_items;
create policy "Users can delete own wishlist"
  on public.wishlist_items for delete
  using (auth.uid() = user_id);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  unique (user_id, product_id)
);

comment on table public.cart_items is 'Persisted cart line items per user';

alter table public.cart_items enable row level security;

drop policy if exists "Users can view own cart" on public.cart_items;
create policy "Users can view own cart"
  on public.cart_items for select
  using (auth.uid() = user_id);

drop policy if exists "Users can add own cart" on public.cart_items;
create policy "Users can add own cart"
  on public.cart_items for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own cart" on public.cart_items;
create policy "Users can update own cart"
  on public.cart_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own cart" on public.cart_items;
create policy "Users can delete own cart"
  on public.cart_items for delete
  using (auth.uid() = user_id);

create index if not exists cart_items_user_id_idx on public.cart_items (user_id);
