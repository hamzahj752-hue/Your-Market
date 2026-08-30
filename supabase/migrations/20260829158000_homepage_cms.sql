-- Phase 5: Homepage Management (CMS)
-- Adds admin-managed homepage content tables so storefront homepage sections can
-- be edited from the Admin Dashboard without touching source code.
--
-- Safe & idempotent: no DROP TABLE, no TRUNCATE, no DELETE FROM, no reset.
-- Existing tables/rows are untouched. Products/categories are referenced by FK
-- only; homepage records never duplicate product/category data.

-- ===========================================================================
-- 1) homepage_hero_banners
-- ===========================================================================
create table if not exists public.homepage_hero_banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text not null,
  cta_text text,
  cta_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.homepage_hero_banners is 'Admin-managed homepage hero banners';

create index if not exists homepage_hero_banners_active_sort_idx
  on public.homepage_hero_banners (is_active, sort_order);

alter table public.homepage_hero_banners enable row level security;

create policy "Public view active hero banners"
  on public.homepage_hero_banners for select
  to anon, authenticated
  using (is_active = true);

create policy "Admins view hero banners"
  on public.homepage_hero_banners for select
  to authenticated
  using (public.is_admin());

create policy "Admins insert hero banners"
  on public.homepage_hero_banners for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update hero banners"
  on public.homepage_hero_banners for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete hero banners"
  on public.homepage_hero_banners for delete
  to authenticated
  using (public.is_admin());

grant select on public.homepage_hero_banners to anon, authenticated;
grant insert, update, delete on public.homepage_hero_banners to authenticated;

-- ===========================================================================
-- 2) homepage_featured_products (references live products; no duplicated data)
-- ===========================================================================
create table if not exists public.homepage_featured_products (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint homepage_featured_products_product_unique unique (product_id)
);

comment on table public.homepage_featured_products is 'Products highlighted on the storefront homepage';

create index if not exists homepage_featured_products_active_sort_idx
  on public.homepage_featured_products (is_active, sort_order);

alter table public.homepage_featured_products enable row level security;

create policy "Public view active featured products"
  on public.homepage_featured_products for select
  to anon, authenticated
  using (is_active = true);

create policy "Admins view featured products"
  on public.homepage_featured_products for select
  to authenticated
  using (public.is_admin());

create policy "Admins insert featured products"
  on public.homepage_featured_products for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update featured products"
  on public.homepage_featured_products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete featured products"
  on public.homepage_featured_products for delete
  to authenticated
  using (public.is_admin());

grant select on public.homepage_featured_products to anon, authenticated;
grant insert, update, delete on public.homepage_featured_products to authenticated;

-- ===========================================================================
-- 3) homepage_deals (references live products; presentation/schedule only)
-- ===========================================================================
create table if not exists public.homepage_deals (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  title text,
  subtitle text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_deals_product_unique unique (product_id),
  constraint homepage_deals_date_range_check check (
    starts_at is null or ends_at is null or ends_at >= starts_at
  )
);

comment on table public.homepage_deals is 'Homepage flash-deal placements referencing live products';

create index if not exists homepage_deals_active_sort_idx
  on public.homepage_deals (is_active, sort_order);

alter table public.homepage_deals enable row level security;

-- Public sees only active deals that are within their configured window.
create policy "Public view active in-schedule deals"
  on public.homepage_deals for select
  to anon, authenticated
  using (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy "Admins view deals"
  on public.homepage_deals for select
  to authenticated
  using (public.is_admin());

create policy "Admins insert deals"
  on public.homepage_deals for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update deals"
  on public.homepage_deals for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete deals"
  on public.homepage_deals for delete
  to authenticated
  using (public.is_admin());

grant select on public.homepage_deals to anon, authenticated;
grant insert, update, delete on public.homepage_deals to authenticated;

-- ===========================================================================
-- 4) homepage_categories (references live categories; no duplicated data)
-- ===========================================================================
create table if not exists public.homepage_categories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint homepage_categories_category_unique unique (category_id)
);

comment on table public.homepage_categories is 'Categories shown on the storefront homepage';

create index if not exists homepage_categories_active_sort_idx
  on public.homepage_categories (is_active, sort_order);

alter table public.homepage_categories enable row level security;

create policy "Public view active homepage categories"
  on public.homepage_categories for select
  to anon, authenticated
  using (is_active = true);

create policy "Admins view homepage categories"
  on public.homepage_categories for select
  to authenticated
  using (public.is_admin());

create policy "Admins insert homepage categories"
  on public.homepage_categories for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update homepage categories"
  on public.homepage_categories for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete homepage categories"
  on public.homepage_categories for delete
  to authenticated
  using (public.is_admin());

grant select on public.homepage_categories to anon, authenticated;
grant insert, update, delete on public.homepage_categories to authenticated;

-- ===========================================================================
-- 5) homepage_promotional_banners
-- ===========================================================================
create table if not exists public.homepage_promotional_banners (
  id uuid primary key default gen_random_uuid(),
  title text,
  subtitle text,
  image_url text not null,
  cta_text text,
  cta_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.homepage_promotional_banners is 'Admin-managed promotional banners';

create index if not exists homepage_promo_banners_active_sort_idx
  on public.homepage_promotional_banners (is_active, sort_order);

alter table public.homepage_promotional_banners enable row level security;

create policy "Public view active promo banners"
  on public.homepage_promotional_banners for select
  to anon, authenticated
  using (is_active = true);

create policy "Admins view promo banners"
  on public.homepage_promotional_banners for select
  to authenticated
  using (public.is_admin());

create policy "Admins insert promo banners"
  on public.homepage_promotional_banners for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update promo banners"
  on public.homepage_promotional_banners for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete promo banners"
  on public.homepage_promotional_banners for delete
  to authenticated
  using (public.is_admin());

grant select on public.homepage_promotional_banners to anon, authenticated;
grant insert, update, delete on public.homepage_promotional_banners to authenticated;

-- ===========================================================================
-- 6) homepage_testimonials (manually curated public content, no customer PII)
-- ===========================================================================
create table if not exists public.homepage_testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  testimonial_text text not null,
  customer_image_url text,
  rating integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint homepage_testimonials_rating_check check (
    rating is null or (rating >= 1 and rating <= 5)
  )
);

comment on table public.homepage_testimonials is 'Manually curated homepage testimonials';

create index if not exists homepage_testimonials_active_sort_idx
  on public.homepage_testimonials (is_active, sort_order);

alter table public.homepage_testimonials enable row level security;

create policy "Public view active testimonials"
  on public.homepage_testimonials for select
  to anon, authenticated
  using (is_active = true);

create policy "Admins view testimonials"
  on public.homepage_testimonials for select
  to authenticated
  using (public.is_admin());

create policy "Admins insert testimonials"
  on public.homepage_testimonials for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update testimonials"
  on public.homepage_testimonials for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete testimonials"
  on public.homepage_testimonials for delete
  to authenticated
  using (public.is_admin());

grant select on public.homepage_testimonials to anon, authenticated;
grant insert, update, delete on public.homepage_testimonials to authenticated;

-- ===========================================================================
-- 7) homepage_trust_items
-- ===========================================================================
create table if not exists public.homepage_trust_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  icon text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.homepage_trust_items is 'Trust/assurance badges shown on the storefront homepage';

create index if not exists homepage_trust_items_active_sort_idx
  on public.homepage_trust_items (is_active, sort_order);

alter table public.homepage_trust_items enable row level security;

create policy "Public view active trust items"
  on public.homepage_trust_items for select
  to anon, authenticated
  using (is_active = true);

create policy "Admins view trust items"
  on public.homepage_trust_items for select
  to authenticated
  using (public.is_admin());

create policy "Admins insert trust items"
  on public.homepage_trust_items for insert
  to authenticated
  with check (public.is_admin());

create policy "Admins update trust items"
  on public.homepage_trust_items for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admins delete trust items"
  on public.homepage_trust_items for delete
  to authenticated
  using (public.is_admin());

grant select on public.homepage_trust_items to anon, authenticated;
grant insert, update, delete on public.homepage_trust_items to authenticated;

-- ===========================================================================
-- 8) homepage-images storage bucket (public read, admin write)
-- Follows the existing product-images / store-logo security pattern.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('homepage-images', 'homepage-images', true)
on conflict (id) do nothing;

drop policy if exists "Public can view homepage images" on storage.objects;
create policy "Public can view homepage images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'homepage-images');

drop policy if exists "Admins can upload homepage images" on storage.objects;
create policy "Admins can upload homepage images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'homepage-images' and public.is_admin());

drop policy if exists "Admins can update homepage images" on storage.objects;
create policy "Admins can update homepage images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'homepage-images' and public.is_admin())
  with check (bucket_id = 'homepage-images' and public.is_admin());

drop policy if exists "Admins can delete homepage images" on storage.objects;
create policy "Admins can delete homepage images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'homepage-images' and public.is_admin());
