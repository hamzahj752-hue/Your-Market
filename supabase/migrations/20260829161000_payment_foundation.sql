-- Phase 8: Payment Foundation & COD Implementation
--
-- Adds a production-ready payment tracking foundation to the existing `orders`
-- table and hardens the server-side payment logic:
--
--   1. Add missing payment tracking columns to `orders` (provider, reference,
--      timestamps, failure reason). DO NOT recreate orders or touch data.
--   2. Extend the `payment_status` CHECK to include `failed` (existing values
--      pending/paid/unpaid/refunded are preserved).
--   3. Add a BEFORE UPDATE trigger that records paid_at/refunded_at whenever the
--      payment status changes — so timestamps are always set server-side, never
--      from client input.
--   4. Redefine place_order to:
--        * keep COD authoritative and server-validated vs store_settings.cod_enabled
--        * mark COD orders payment_status = 'pending' (money NOT collected online)
--        * NOT auto-mark any online method as 'paid' — there is no real gateway
--          integrated yet, so online methods are rejected with a clear message
--          instead of creating a falsely-"paid" or falsely-"pending" online order.
--      Totals remain recomputed server-side from products/store_settings; the
--      buyer is always auth.uid(); never trusts client-supplied price/total/user.
--
-- Safe & idempotent: no DROP TABLE, no TRUNCATE, no DELETE FROM, no reset, no
-- historical-data rewrite. All statements are re-runnable. Migration stays LOCAL
-- pending manual review (DO NOT auto push).

-- ===========================================================================
-- 1) Add missing payment tracking columns to orders (idempotent).
-- ===========================================================================
alter table public.orders add column if not exists payment_provider text;
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists refunded_at timestamptz;
alter table public.orders add column if not exists payment_failure_reason text;

comment on column public.orders.payment_provider is
  'Name of the payment provider used for an online order (NULL for COD / cash).';
comment on column public.orders.payment_reference is
  'Provider transaction/reference id for an online order (NULL for COD / cash).';
comment on column public.orders.paid_at is
  'Timestamp when the order was marked paid (server/admin only).';
comment on column public.orders.refunded_at is
  'Timestamp when the order was refunded (server/admin only).';
comment on column public.orders.payment_failure_reason is
  'Optional explanation recorded when a payment failed or was rejected.';

-- ===========================================================================
-- 2) Extend payment_status CHECK to include `failed`, preserving existing values.
-- ===========================================================================
alter table public.orders drop constraint if exists orders_payment_status_check;
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_payment_status_check' and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_payment_status_check
      check (payment_status in ('pending','paid','unpaid','failed','refunded'));
  end if;
end $$;

-- ===========================================================================
-- 3) Sync payment timestamps on status change (server-enforced, trigger-based).
--    Fires on ANY update that changes payment_status — whether from an admin
--    panel update or a future secure server-side verification RPC — so paid_at /
--    refunded_at are always derived from the status transition, never from the
--    browser-submitted body.
-- ===========================================================================
create or replace function public.orders_sync_payment_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.payment_status is distinct from old.payment_status then
    if new.payment_status = 'paid' then
      new.paid_at := coalesce(new.paid_at, now());
      new.refunded_at := null;
      new.payment_failure_reason := null;
    elsif new.payment_status = 'refunded' then
      new.refunded_at := coalesce(new.refunded_at, now());
      new.paid_at := null;
    else
      new.paid_at := null;
      new.refunded_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_sync_payment_fields on public.orders;
create trigger trg_orders_sync_payment_fields
  before update of payment_status on public.orders
  for each row
  execute function public.orders_sync_payment_fields();

-- ===========================================================================
-- 4) Hardened place_order.
--
-- Changes vs the Phase 4 version (single behavior change, everything else
-- preserved exactly):
--   * COD: still validates store_settings.cod_enabled server-side; payment stays
--     'pending' (cash is collected on delivery, not online).
--   * Online (card/wallet/online and future provider names): NO real gateway is
--     integrated, so these are REJECTED with a clear message rather than being
--     recorded as paid (or as unpaid online orders). This closes the gap where
--     an enabled online setting previously produced a "paid" order with zero
--     payment verification.
--
-- Totals are recomputed server-side (products, coupons, store_settings). Buyer
-- is auth.uid(). No client-supplied price/discount/shipping/tax/total/user_id
-- is trusted. Blocked-account trigger and notification triggers still fire.
-- ===========================================================================
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

  -- COD: fully supported. Server-validated against store_settings.cod_enabled.
  -- payment_status stays 'pending' because cash is collected on delivery.
  if v_payment = 'cod' then
    if coalesce(v_settings.cod_enabled, true) = false then
      raise exception 'Cash on Delivery is currently unavailable. Please contact support.';
    end if;
    v_payment_status := 'pending';
  elsif v_payment in ('card', 'wallet', 'online', 'esewa', 'khalti', 'fonepay', 'imepay') then
    -- No real online payment gateway is configured/verified yet. Refuse to create
    -- a falsely-"paid" (or unpaid "online") order. Online checkout is shown as
    -- "coming soon" in the UI until a provider is integrated server-side.
    raise exception 'Online payment is not available yet. Please use Cash on Delivery.';
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
    'payment_method', v_order_row.payment_method,
    'total', v_order_row.total,
    'created_at', v_order_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, text, text) TO authenticated;
