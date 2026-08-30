-- Phase 3: categories table + seed from existing product categories
-- Products store category as a denormalized TEXT string (kept intact so the
-- storefront /products?category= filter keeps working). This table is the
-- admin-managed, canonical source for category display and management.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text,
  image text,
  icon text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.categories is 'Admin-managed product categories';

alter table public.categories enable row level security;

create policy "Categories are publicly viewable"
  on public.categories for select
  to anon, authenticated
  using (true);

create policy "Admins can insert categories"
  on public.categories for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins can update categories"
  on public.categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins can delete categories"
  on public.categories for delete
  to authenticated
  using (public.is_admin());

-- Seed categories from the distinct product.category strings in the products
-- table so the admin never manages an empty list.
do $$
declare
  v_name text;
begin
  for v_name in
    select distinct category
    from public.products
    where category is not null and btrim(category) <> ''
  loop
    if not exists (select 1 from public.categories where name = v_name) then
      insert into public.categories (name, slug, sort_order)
      values (v_name, lower(regexp_replace(v_name, '[^a-zA-Z0-9]+', '-', 'g')), 0);
    end if;
  end loop;
end $$;
