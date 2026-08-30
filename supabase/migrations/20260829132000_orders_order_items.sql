-- Phase 2: orders enhancements + order_items + admin helper
-- Reuses the existing public.orders table; adds columns + RLS idempotently.
-- order_items stores one row per product line for each order.

-- Admin helper: true when the current user is an admin.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- Enhance the existing orders table.
alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists tax numeric(12,2) not null default 0;
alter table public.orders add column if not exists discount numeric(12,2) not null default 0;
alter table public.orders add column if not exists coupon_code text;

-- Ensure a status column with a safe default (existing rows keep 'Placed').
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'status'
  ) then
    alter table public.orders add column status text not null default 'Pending';
  end if;
end $$;

-- Idempotent status check constraint (includes legacy 'Placed').
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_status_check' and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_status_check
      check (status in ('Pending','Confirmed','Shipped','Delivered','Cancelled','Placed'));
  end if;
end $$;

-- Order RLS (must drop any pre-existing conflicting policy to stay idempotent).
alter table public.orders enable row level security;

drop policy if exists "Users can view own orders" on public.orders;
create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders"
  on public.orders for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins can update orders" on public.orders;
create policy "Admins can update orders"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- order_items
-- NOTE: public.orders.id is TEXT (existing schema), so order_id must be TEXT
-- to correctly reference public.orders(id). Do not use uuid here.
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  product_id text not null,
  name text not null,
  price numeric(12,2) not null,
  quantity integer not null check (quantity > 0),
  image text,
  created_at timestamptz not null default now()
);

comment on table public.order_items is 'Line items belonging to an order';

alter table public.order_items enable row level security;

-- Owner can read their order's line items; admins can read any.
create policy "Owners and admins can view order items"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists order_items_order_id_idx on public.order_items (order_id);
