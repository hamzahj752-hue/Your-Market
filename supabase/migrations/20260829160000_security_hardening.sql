-- Phase 7: Security Hardening
--
-- Comprehensive, additive, idempotent hardening of the existing security model.
-- The prior phases already established a strong baseline (RLS on every table via
-- the public.is_admin() SECURITY DEFINER helper, SECURITY DEFINER place_order RPC,
-- admin-only storage writes). This migration ONLY closes the remaining gaps:
--
--   1. Products: public SELECT is currently `using (true)` which exposes inactive
--      products. Restrict public read to ACTIVE products; add an admin read-all
--      policy so admins can still manage hidden products.
--   2. Reviews: the default moderation_status is 'approved', so a user who inserts
--      a review bypasses moderation entirely (self-publish). Force client inserts
--      through moderation (pending) and neuter forged verified_purchase/report.
--   3. Notifications: the SECURITY DEFINER public.notify() helper can be invoked
--      directly by any client to forge notifications. Revoke EXECUTE from clients;
--      only the internal triggers (which run as the definer) may insert.
--   4. Storage: defensively drop any blanket write policies on the product-images,
--      store-logo and homepage-images buckets so ONLY admins can write, while
--      keeping public SELECT read access.
--   5. Assert search_path = public on all security-relevant SECURITY DEFINER
--      functions to prevent search-path injection.
--
-- No destructive SQL: no DROP TABLE, no TRUNCATE, no DELETE FROM, no reset.
-- No policies create recursion. All statements are re-runnable.

-- ===========================================================================
-- 0) Defensive: ensure RLS is enabled on every application table.
-- ===========================================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','addresses','wishlist_items','cart_items','admin_users',
    'orders','order_items','coupons','reviews','product_images','categories',
    'products','store_settings',
    'homepage_hero_banners','homepage_featured_products','homepage_deals',
    'homepage_categories','homepage_promotional_banners','homepage_testimonials',
    'homepage_trust_items','notifications'
  ]
  loop
    execute format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  end loop;
end $$;

-- ===========================================================================
-- 1) PRODUCTS: public read only active; admins read all.
--    Replaces the blanket `using (true)` policy (non-destructive drop/recreate).
-- ===========================================================================
drop policy if exists "Products are publicly viewable" on public.products;
create policy "Products are publicly viewable"
  on public.products for select
  to anon, authenticated
  using (active = true);

drop policy if exists "Admins can view all products" on public.products;
create policy "Admins can view all products"
  on public.products for select
  to authenticated
  using (public.is_admin());

-- ===========================================================================
-- 2) REVIEWS: force client inserts through moderation and prevent forging of
--    verified_purchase / moderation_status / reported flags.
--    Authors may still see their own pending reviews (RLS select policy already
--    grants auth.uid() = user_id), so the author UX is unchanged.
-- ===========================================================================
create or replace function public.reviews_force_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.moderation_status := 'pending';
  new.verified_purchase := false;
  new.reported := false;
  new.reports_count := 0;
  return new;
end;
$$;

drop trigger if exists trg_reviews_force_moderation on public.reviews;
create trigger trg_reviews_force_moderation
  before insert on public.reviews
  for each row
  execute function public.reviews_force_moderation();

-- Tighten the client insert WITH CHECK so a user can never insert a review that
-- claims to be verified or auto-approved (defense in depth alongside the trigger).
drop policy if exists "Authenticated users can insert their own reviews" on public.reviews;
create policy "Authenticated users can insert their own reviews"
  on public.reviews for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and rating between 1 and 5
    and coalesce(verified_purchase, false) = false
    and coalesce(moderation_status, '') <> 'approved'
  );

-- ===========================================================================
-- 3) NOTIFICATIONS: only SECURITY DEFINER triggers may write. Revoke direct
--    client execution of the notify() helper. The triggers call notify() while
--    running as the function owner (definer), so they keep working.
--    The notifications table already has NO insert/delete policy for clients.
-- ===========================================================================
revoke all on function public.notify(text, uuid, text, text, text, text, text, jsonb)
  from public;
revoke all on function public.notify(text, uuid, text, text, text, text, text, jsonb)
  from anon;
revoke all on function public.notify(text, uuid, text, text, text, text, text, jsonb)
  from authenticated;

-- ===========================================================================
-- 4) STORAGE: re-assert public SELECT + admin-only writes on the managed
--    buckets. Defensively drop any blanket `true` write policies (e.g. a stray
--    "Give users access to their own ..." policy) so writes stay admin-only.
-- ===========================================================================

-- --- product-images ---
drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;

-- Remove any leftover broad write access on this bucket (idempotent names).
drop policy if exists "Give users access to their own product images" on storage.objects;
drop policy if exists "Public can upload product images" on storage.objects;

create policy "Admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "Admins can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
create policy "Admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- --- store-logo ---
drop policy if exists "Public can view store logo" on storage.objects;
create policy "Public can view store logo"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'store-logo');

drop policy if exists "Admins can upload store logo" on storage.objects;
drop policy if exists "Admins can update store logo" on storage.objects;
drop policy if exists "Admins can delete store logo" on storage.objects;
drop policy if exists "Public can upload store logo" on storage.objects;

create policy "Admins can upload store logo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'store-logo' and public.is_admin());
create policy "Admins can update store logo"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'store-logo' and public.is_admin())
  with check (bucket_id = 'store-logo' and public.is_admin());
create policy "Admins can delete store logo"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'store-logo' and public.is_admin());

-- --- homepage-images ---
drop policy if exists "Public can view homepage images" on storage.objects;
create policy "Public can view homepage images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'homepage-images');

drop policy if exists "Admins can upload homepage images" on storage.objects;
drop policy if exists "Admins can update homepage images" on storage.objects;
drop policy if exists "Admins can delete homepage images" on storage.objects;
drop policy if exists "Public can upload homepage images" on storage.objects;

create policy "Admins can upload homepage images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'homepage-images' and public.is_admin());
create policy "Admins can update homepage images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'homepage-images' and public.is_admin())
  with check (bucket_id = 'homepage-images' and public.is_admin());
create policy "Admins can delete homepage images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'homepage-images' and public.is_admin());

-- ===========================================================================
-- 5) DEFINER FUNCTIONS: assert search_path = public and owner execution for
--    every security-relevant SECURITY DEFINER function used across the app.
-- ===========================================================================
alter function public.is_admin() security definer set search_path = public;
alter function public.place_order(jsonb, jsonb, text, text) security definer set search_path = public;
alter function public.prevent_orders_when_blocked() security definer set search_path = public;
alter function public.notify(text, uuid, text, text, text, text, text, jsonb) security definer set search_path = public;
alter function public.notify_order_placed() security definer set search_path = public;
alter function public.notify_order_status() security definer set search_path = public;
alter function public.notify_low_stock() security definer set search_path = public;
alter function public.notify_new_customer() security definer set search_path = public;
alter function public.notify_new_review() security definer set search_path = public;
alter function public.reviews_force_moderation() security definer set search_path = public;

-- place_order must only be granted to authenticated (never anon / public).
revoke all on function public.place_order(jsonb, jsonb, text, text) from public;
grant execute on function public.place_order(jsonb, jsonb, text, text) to authenticated;

-- ===========================================================================
-- 6) COUPONS: no public read is required (place_order reads them via the
--    SECURITY DEFINER RPC). Retain admin-only RLS as-is; it is already strict.
--    Explicitly protect the publicly-served read policies from accidental leaks:
--    the storefront-facing settings/CMS tables keep their intentional public
--    SELECT (non-sensitive), no change needed.
-- ===========================================================================
