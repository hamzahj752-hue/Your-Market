-- Phase 7: Homepage "Food" section
-- Adds an admin-managed "Food" tile row to the storefront homepage, placed
-- between the existing "Shop by Category" strip and the "Request a Product"
-- banner (Hero -> Shop by Category -> NEW Food -> Request a Product -> Promo
-- Banner -> All Products).
--
-- The section is entirely data-driven and admin-controlled; there is no
-- hard-coded food content and no fabricated food item anywhere:
--   * store_settings.food_section_enabled  -> whole-section ON/OFF
--   * store_settings.food_section_title    -> section heading
--   * homepage_food_categories             -> which REAL categories are featured,
--                                             each with an optional admin-uploaded
--                                             artwork image, sort order and an
--                                             independent visible toggle
--
-- Every food card links to its real category listing page
-- (/products?category=<name>) which renders all active products in that
-- category; it NEVER links straight to a single product. Product Details
-- behavior is left untouched.
--
-- Safe & idempotent: no DROP TABLE, no TRUNCATE, no DELETE FROM, no reset.
-- Existing tables/rows are untouched. Statements use IF NOT EXISTS / do$$ guards.

-- ===========================================================================
-- 1) Store settings: whole-section ON/OFF + section title (default OFF so the
--    storefront never shows an empty/partial section before it is configured).
-- ===========================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'store_settings'
      and column_name = 'food_section_enabled'
  ) then
    alter table public.store_settings
      add column food_section_enabled boolean not null default false;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'store_settings'
      and column_name = 'food_section_title'
  ) then
    alter table public.store_settings
      add column food_section_title text not null default 'Food';
  end if;
end $$;

-- Admin can already update store_settings via the existing RLS update policy and
-- column-level grants (authenticated); public read is likewise covered by the
-- existing select policy/grants, so no new grants or policies are required here.

-- ===========================================================================
-- 2) homepage_food_categories (references live categories; no duplicated data).
--    The image column is the admin-assigned category artwork; when it is empty
--    the storefront falls back to the category image, then a real product image
--    in that category. Only active categories with active products can ever be
--    shown.
-- ===========================================================================
create table if not exists public.homepage_food_categories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  image text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_food_categories_category_unique unique (category_id)
);

comment on table public.homepage_food_categories is 'Real categories featured in the homepage Food section';

create index if not exists homepage_food_categories_active_sort_idx
  on public.homepage_food_categories (is_active, sort_order);

alter table public.homepage_food_categories enable row level security;

drop policy if exists "Public view active food categories" on public.homepage_food_categories;
create policy "Public view active food categories"
  on public.homepage_food_categories for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins view food categories" on public.homepage_food_categories;
create policy "Admins view food categories"
  on public.homepage_food_categories for select
  to authenticated
  using (public.is_admin());

drop policy if exists "Admins insert food categories" on public.homepage_food_categories;
create policy "Admins insert food categories"
  on public.homepage_food_categories for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins update food categories" on public.homepage_food_categories;
create policy "Admins update food categories"
  on public.homepage_food_categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Admins delete food categories" on public.homepage_food_categories;
create policy "Admins delete food categories"
  on public.homepage_food_categories for delete
  to authenticated
  using (public.is_admin());

grant select on public.homepage_food_categories to anon, authenticated;
grant insert, update, delete on public.homepage_food_categories to authenticated;