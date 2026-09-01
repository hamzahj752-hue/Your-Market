-- Hardening: eliminate the "record v_coupon is not assigned yet" class of errors
-- in place_order, and never dereference the v_coupon record on any path where a
-- coupon was not confirmed present.
--
-- WHY THIS MIGRATION IS NEEDED
--   The previous hotfix (20260901100000) guarded every v_coupon.* read with
--   v_coupon_applied / FOUND, and used a short-circuiting CASE in the INSERT.
--   That body is logically correct for a blank coupon. However the reported
--   symptom ("record v_coupon is not assigned yet" on a BLANK coupon) indicates
--   the production body can still read an unassigned record. This migration
--   removes the composite-record dereference entirely on the "no coupon" path by
--   copying the confirmed coupon code into a nullable scalar
--   (v_coupon_code_applied) the moment a coupon is validated. Every later
--   coupon-dependent statement then uses that scalar / the v_coupon_applied
--   boolean, so there is no code path that dereferences v_coupon.* unless a
--   coupon row actually matched.
--
-- BEHAVIOR (identical to prior correct intent) --
--   * NULL/blank coupon  -> no lookup, no discount (0), stored coupon NULL,
--                           no usage update; order proceeds normally.
--   * Non-blank but no row -> clean 'Invalid or expired coupon code.' exception.
--   * Valid coupon        -> validate active/expiry/limit/min-order, compute
--                            discount, store code, bump used_count once.
--   All quantity, product/stock, shipping/tax/store_settings, COD validation,
--   auth.uid(), notification triggers and server-side totals are unchanged.
--
-- SAFETY PRESERVED:
--   * SECURITY DEFINER + SET search_path = public
--   * authenticated-only EXECUTE (REVOKE from PUBLIC)
--   * Buyer always auth.uid(); server is authoritative for prices/totals
--   * No DROP TABLE / TRUNCATE / DELETE / reset / data rewrite
--   * Stays LOCAL pending manual review (do NOT auto push).

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
  v_coupon_code_applied text := null;
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
    -- a falsely-"paid" (or unpaid "online") order.
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
  -- Blank/NULL code -> skip entirely (no lookup, no discount).
  if p_coupon_code is not null and btrim(p_coupon_code) <> '' then
    select * into v_coupon
    from public.coupons
    where code = upper(btrim(p_coupon_code));

    -- IF NOT FOUND: row did not match. v_coupon is UNASSIGNED here, so we NEVER
    -- touch v_coupon.* on this branch (that would raise "record ... not assigned").
    if not found then
      raise exception 'Invalid or expired coupon code.';
    end if;

    -- From this point onward v_coupon holds a real row; field reads are safe.
    if not v_coupon.active then
      raise exception 'This coupon is no longer active.';
    end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
      raise exception 'This coupon has expired.';
    end if;
    if v_coupon.usage_limit is not null and v_coupon.used_count >= v_coupon.usage_limit then
      raise exception 'This coupon has reached its usage limit.';
    end if;

    -- Capture the confirmed code into a nullable scalar so later code (order
    -- insert, usage update) never needs to dereference the record when no
    -- coupon applied.
    v_coupon_code_applied := v_coupon.code;
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
    v_coupon_code_applied,
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

  -- Increment usage count exactly once, only when a coupon was applied.
  if v_coupon_applied then
    update public.coupons
      set used_count = used_count + 1
      where code = v_coupon_code_applied;
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
