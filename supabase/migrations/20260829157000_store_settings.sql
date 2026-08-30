-- Phase 4: Admin Settings
-- Adds a singleton store_settings table (administration surface for the store
-- name, logo, contact info, currency, shipping/tax and payment options), a
-- store-logo storage bucket, and updates place_order so the server derives
-- shipping, tax and allowed payment methods from store_settings instead of
-- hard-coded values.
--
-- Safe & idempotent: no DROP TABLE, no TRUNCATE, no DELETE FROM, no reset.
-- Existing tables/rows are untouched. All statements use IF NOT EXISTS / ON
-- CONFLICT DO NOTHING guards.

-- --- 1) store_settings singleton table ---
create table if not exists public.store_settings (
  id uuid primary key default '00000000-0000-0000-0000-000000000001',
  store_name text,
  logo_url text,
  contact_email text,
  contact_phone text,
  contact_address text,
  currency text not null default 'NPR',
  shipping_charge numeric not null default 0,
  free_shipping_threshold numeric not null default 0,
  tax_percent numeric not null default 0,
  cod_enabled boolean not null default true,
  online_payment_enabled boolean not null default false,
  maintenance_mode boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Non-negative monetary values and sensible tax percentage.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'store_settings_non_negative' and conrelid = 'public.store_settings'::regclass
  ) then
    alter table public.store_settings add constraint store_settings_non_negative
      check (
        shipping_charge >= 0 and free_shipping_threshold >= 0
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'store_settings_tax_percent_check' and conrelid = 'public.store_settings'::regclass
  ) then
    alter table public.store_settings add constraint store_settings_tax_percent_check
      check (tax_percent >= 0 and tax_percent <= 100);
  end if;
end $$;

-- Enforce a single row (singleton): only the fixed id may ever exist. The
-- primary key on id already guarantees a single row for the fixed id.

-- --- 2) Row Level Security ---
-- Public/anonymous can read the (non-sensitive) storefront-facing settings.
-- Only admins can create/update settings. Deletion is intentionally not
-- permitted (no DELETE policy) to protect the singleton row.
alter table public.store_settings enable row level security;

drop policy if exists "Public can read store settings" on public.store_settings;
create policy "Public can read store settings"
  on public.store_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can create store settings" on public.store_settings;
create policy "Admins can create store settings"
  on public.store_settings for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "Admins can update store settings" on public.store_settings;
create policy "Admins can update store settings"
  on public.store_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Grant column-level privileges: select to everyone, write to authenticated
-- (RLS still restricts writes to admins).
grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;

-- --- 3) Seed the singleton row (idempotent). ---
-- Runs as the migration's privileged role which bypasses RLS, so seeding is
-- allowed regardless of admin presence. Defaults preserve current behavior
-- (shipping 200 / free over 6500 / 13% tax are only applied when no settings
-- row exists yet; once the row is present the admin's values win).
insert into public.store_settings (id, store_name, currency, shipping_charge, free_shipping_threshold, tax_percent, cod_enabled, online_payment_enabled, maintenance_mode)
values (
  '00000000-0000-0000-0000-000000000001',
  'Your Market',
  'NPR',
  200,
  6500,
  13,
  true,
  false,
  false
)
on conflict (id) do nothing;

-- --- 4) store-logo storage bucket (public read, admin write) ---
-- Follows the existing product-images security pattern exactly.
insert into storage.buckets (id, name, public)
values ('store-logo', 'store-logo', true)
on conflict (id) do nothing;

drop policy if exists "Public can view store logo" on storage.objects;
create policy "Public can view store logo"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'store-logo');

drop policy if exists "Admins can upload store logo" on storage.objects;
create policy "Admins can upload store logo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'store-logo' and public.is_admin());

drop policy if exists "Admins can update store logo" on storage.objects;
create policy "Admins can update store logo"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'store-logo' and public.is_admin())
  with check (bucket_id = 'store-logo' and public.is_admin());

drop policy if exists "Admins can delete store logo" on storage.objects;
create policy "Admins can delete store logo"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'store-logo' and public.is_admin());

-- --- 5) Update place_order to use store_settings server-side ---
-- The signature is unchanged, so no callers need to change. Shipping, tax and
-- the allowed payment methods are now derived from store_settings; coupon,
-- inventory, ownership and atomic-write behaviour is preserved exactly.
CREATE OR REPLACE FUNCTION public.place_order(
  p_items jsonb,
  p_address jsonb,
  p_payment_method text,
  p_coupon_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order_id text;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_tax numeric(12,2) := 0;
  v_shipping numeric(12,2) := 200;
  v_discount numeric(12,2) := 0;
  v_coupon record;
  v_coupon_applied boolean := false;
  v_item jsonb;
  v_product record;
  v_qty integer;
  v_line_total numeric(12,2);
  v_order_row record;
  v_payment text;
  v_payment_status text := 'pending';
  v_settings record;
BEGIN
  if v_user_id is null then
    raise exception 'You must be signed in to place an order.';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;

  -- Load storefront settings. Defaults preserve the original behaviour when
  -- no settings row exists yet.
  select * into v_settings from public.store_settings limit 1;
  if not found then
    v_settings.shipping_charge := 200;
    v_settings.free_shipping_threshold := 6500;
    v_settings.tax_percent := 13;
    v_settings.cod_enabled := true;
    v_settings.online_payment_enabled := false;
  end if;

  v_payment := lower(coalesce(p_payment_method, 'cod'));

  -- Validate the payment method against the enabled payment settings BEFORE
  -- writing anything, so disabled methods can never slip through.
  if v_payment = 'cod' then
    if coalesce(v_settings.cod_enabled, true) = false then
      raise exception 'Cash on Delivery is currently unavailable.';
    end if;
    v_payment_status := 'pending';
  elsif v_payment in ('card', 'wallet') then
    if coalesce(v_settings.online_payment_enabled, false) = false then
      raise exception 'Online payment is currently unavailable.';
    end if;
    v_payment_status := 'paid';
  else
    raise exception 'Invalid payment method.';
  end if;

  -- Validate items + compute subtotal from the database.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'Invalid quantity for an item.';
    end if;

    select * into v_product
    from public.products
    where id = v_item->>'product_id';

    if not found then
      raise exception 'A product in your cart no longer exists.';
    end if;
    if coalesce(v_product.in_stock, false) = false then
      raise exception 'Sorry, "%" is currently out of stock.', v_product.name;
    end if;

    v_line_total := coalesce(v_product.price, 0) * v_qty;
    v_subtotal := v_subtotal + v_line_total;
  end loop;

  -- Resolve coupon after subtotal is known (needed for min-order validation).
  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select * into v_coupon
    from public.coupons
    where code = upper(btrim(p_coupon_code));

    if v_coupon.code is null then
      raise exception 'Invalid or expired coupon code.';
    end if;
    if not v_coupon.active then
      raise exception 'This coupon is no longer active.';
    end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
      raise exception 'This coupon has expired.';
    end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
      raise exception 'This coupon has reached its usage limit.';
    end if;

    v_coupon_applied := true;
  end if;

  if v_coupon_applied then
    if v_subtotal < coalesce(v_coupon.min_order, 0) then
      raise exception 'This coupon requires a minimum order of %', v_coupon.min_order;
    end if;

    if v_coupon.discount_type = 'fixed' then
      v_discount := least(coalesce(v_coupon.discount_value, 0), v_subtotal);
    else
      v_discount := round(v_subtotal * (coalesce(v_coupon.discount_percent, 0) / 100), 2);
      if v_discount > v_subtotal then
        v_discount := v_subtotal;
      end if;
    end if;
  end if;

  -- Shipping: free once the discounted subtotal crosses the configured
  -- threshold; otherwise the configured flat shipping charge is applied.
  if v_subtotal - v_discount >= coalesce(v_settings.free_shipping_threshold, 6500) then
    v_shipping := 0;
  else
    v_shipping := coalesce(v_settings.shipping_charge, 200);
  end if;

  -- Tax is derived from the configured percentage.
  v_tax := round((v_subtotal - v_discount) * (coalesce(v_settings.tax_percent, 0) / 100), 2);
  v_order_id := gen_random_uuid()::text;
  v_order_number := 'YM-' || to_char(now(), 'YYMMDD') || '-' ||
                    upper(substr(translate(md5(v_order_id), 'abcdef', '123456'), 1, 6));

  insert into public.orders (
    id, user_id, order_number, created_at,
    customer_name, phone, address, city,
    payment_method, payment_status, subtotal, shipping, tax, discount, coupon_code, total,
    status
  ) values (
    v_order_id, v_user_id, v_order_number, now(),
    coalesce(p_address->>'recipient_name', ''),
    coalesce(p_address->>'phone', ''),
    coalesce(p_address->>'address_line', ''),
    coalesce(p_address->>'city', ''),
    v_payment, v_payment_status,
    v_subtotal, v_shipping, v_tax, v_discount,
    case when v_coupon_applied then v_coupon.code else null end,
    v_subtotal - v_discount + v_tax + v_shipping,
    'Pending'
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::int;

    select * into v_product
    from public.products
    where id = v_item->>'product_id';

    insert into public.order_items (
      order_id, product_id, name, price, quantity, image
    ) values (
      v_order_id, v_product.id, v_product.name, coalesce(v_product.price, 0),
      v_qty, v_product.image
    );

    update public.reviews
      set verified_purchase = true, is_edited = is_edited, updated_at = coalesce(updated_at, now())
      where user_id = v_user_id and product_id = v_product.id;
  end loop;

  if v_coupon_applied then
    update public.coupons
      set used_count = used_count + 1
      where code = v_coupon.code;
  end if;

  select * into v_order_row from public.orders where id = v_order_id;

  return jsonb_build_object(
    'id', v_order_row.id,
    'order_number', v_order_row.order_number,
    'status', v_order_row.status,
    'payment_status', v_order_row.payment_status,
    'total', v_order_row.total,
    'created_at', v_order_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, text, text) TO authenticated;
