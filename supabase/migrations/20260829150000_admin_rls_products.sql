-- Phase 3: Server-side admin authorization + products enhancement
-- 1) Enforce RLS on admin_users so only admins can read the table.
-- 2) Enable RLS on products with a PUBLIC read policy (so the storefront keeps
--    working for anon/authenticated) and ADMIN-ONLY write policies.
-- 3) Add product detail/management columns without breaking existing reads.
-- 4) product-images storage bucket + product_images table for gallery images.

-- --- admin_users: admin-only reads ---
alter table public.admin_users enable row level security;

drop policy if exists "Admins can view admin users" on public.admin_users;
create policy "Admins can view admin users"
  on public.admin_users for select
  to authenticated
  using (public.is_admin());

-- --- products: public read, admin write ---
alter table public.products enable row level security;

drop policy if exists "Products are publicly viewable" on public.products;
create policy "Products are publicly viewable"
  on public.products for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
  on public.products for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
  on public.products for delete
  to authenticated
  using (public.is_admin());

-- --- Product detail/management columns (idempotent) ---
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists featured boolean not null default false;
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists stock_quantity integer not null default 0;
alter table public.products add column if not exists images jsonb;

create index if not exists products_category_idx on public.products (category);
create index if not exists products_active_idx on public.products (active);

-- --- product-images storage bucket (public read, admin write) ---
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- --- product_images gallery table (public read, admin write) ---
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.product_images is 'Additional gallery images for a product, managed by admins';

alter table public.product_images enable row level security;

create policy "Product images are publicly viewable"
  on public.product_images for select
  to anon, authenticated
  using (true);

create policy "Admins can insert product images"
  on public.product_images for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can delete product images"
  on public.product_images for delete
  to authenticated
  using (public.is_admin());

create index if not exists product_images_product_idx on public.product_images (product_id);
