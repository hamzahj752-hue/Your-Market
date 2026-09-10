-- Store Business Control Center: settings-aware order math + service hours +
-- Delivery Information + optional product overrides (PREPARED, NOT APPLIED).
--
-- HIGH PRIORITY DISCOVERY: the authoritative server-side order math in
-- place_order has been HARD-CODED (shipping flat 200, free over 6500,
-- tax 13%) instead of reading the Admin-managed store_settings row. The
-- customer's displayed totals already follow Admin → Settings, so changing a
-- setting today makes the DISPLAYED total diverge from the RECORDED order
-- totals. This migration is the fix: place_order reads the row (with the same
-- numbers as back-compat fallbacks, so an empty/missing row behaves exactly as
-- today) and freezes the whole superset already established by
-- 20260909000000_food_orders.sql.
--
-- Completely forward-safe and re-runnable:
--   * `add column if not exists` for every new column,
--   * `CREATE OR REPLACE` for the function — byte-compatible delete of the
--     hard-coded constants replaced by Admin-driven values with fallbacks,
--   * no drops, no grants/policies revoked.
-- New store_settings columns sit on the SAME public row the storefront and
-- Admin already read/write, so RLS behaviour is unchanged.

-- ===========================================================================
-- 1) store_settings: store-wide business controls.
-- ===========================================================================
alter table public.store_settings
  add column if not exists service_hours_enabled boolean not null default false;
alter table public.store_settings
  add column if not exists service_open_time text;
alter table public.store_settings
  add column if not exists service_close_time text;
alter table public.store_settings
  add column if not exists service_hours_label text;
alter table public.store_settings
  add column if not exists delivery_information jsonb not null default '[]'::jsonb;

-- ===========================================================================
-- 2) products: OPTIONAL per-product override columns (INERT BY DESIGN).
--    These are NOT wired into checkout math yet. Server-side totals are
--    computed in the single place_order RPC, and there is currently NO rule
--    for aggregating multiple product delivery/tax overrides in one basket.
--    Wiring these would require: an explicit business rule, order-math parity
--    in place_order, and client display parity — then the Admin Controls can
--    be exposed. Until then the columns are reserved and documented.
-- ===========================================================================
alter table public.products
  add column if not exists delivery_charge_override numeric(12,2);
alter table public.products
  add column if not exists tax_rate_override numeric(12,2);

-- ===========================================================================
-- 3) place_order: read Admin business settings (Fallback = today's numbers).
--    Based on the 20260909000000 superset (order_type + coordinates + food
--    availability + coupon + COD + Sold Out guards). ONLY the shipping and
--    tax calculation block changes.
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
  v_coupon_code_applied text := null;
  v_settings record;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_qty integer;
  v_effective_price numeric(12,2);
  v_line_total numeric(12,2);
  v_order_row record;
  v_payment text;
  v_variant_id uuid;
  v_lat double precision;
  v_lng double precision;
  v_order_type text;
  v_is_food boolean;
  v_food_count integer := 0;
  v_total_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place an order.';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty.';
  END IF;

  v_payment := coalesce(p_payment_method, 'cod');

  -- Resolve coupon first
  IF p_coupon_code IS NOT NULL AND btrim(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE code = upper(btrim(p_coupon_code));

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or expired coupon code.';
    END IF;

    IF v_coupon.active
       AND (v_coupon.expires_at IS NULL OR v_coupon.expires_at > now()) THEN
      v_coupon_code_applied := v_coupon.code;
      v_coupon_applied := true;
    ELSE
      RAISE EXCEPTION 'Invalid or expired coupon code.';
    END IF;
  END IF;

  -- Resolve optional delivery coordinates from the address payload.
  BEGIN
    v_lat := CASE
      WHEN p_address->>'latitude' IS NULL OR p_address->>'latitude' = '' THEN NULL
      ELSE (p_address->>'latitude')::double precision
    END;
    v_lng := CASE
      WHEN p_address->>'longitude' IS NULL OR p_address->>'longitude' = '' THEN NULL
      ELSE (p_address->>'longitude')::double precision
    END;
  EXCEPTION WHEN others THEN
    v_lat := NULL;
    v_lng := NULL;
  END;

  -- Validate items + compute subtotal, tagging food vs non-food as we go.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for an item.';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item->>'product_id';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in your cart no longer exists.';
    END IF;

    v_is_food := coalesce(v_product.food_category_id, NULL::uuid) IS NOT NULL;
    IF v_is_food THEN
      v_food_count := v_food_count + 1;
    END IF;
    v_total_count := v_total_count + 1;

    -- Manual Sold Out guard: the admin's manual override halts ALL purchasing
    -- for this product (food and non-food, variant and non-variant paths)
    -- regardless of stock.
    IF coalesce(v_product.sold_out, false) = true THEN
      RAISE EXCEPTION 'Sorry, "%" is currently sold out.', v_product.name;
    END IF;

    -- COD enforcement: if payment is COD and product disallows COD, reject entire order
    IF v_payment = 'cod' AND v_product.cod_enabled = false THEN
      RAISE EXCEPTION 'Cash on Delivery is currently unavailable for "%".', v_product.name;
    END IF;

    v_variant_id := NULL;
    v_effective_price := coalesce(v_product.price, 0);

    -- If a variant_id is provided, validate and use variant price/stock
    IF v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' <> '' THEN
      v_variant_id := (v_item->>'variant_id')::uuid;

      SELECT * INTO v_variant
      FROM public.product_variants
      WHERE id = v_variant_id
        AND product_id = v_product.id
        AND active = true;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected variant for "%" is no longer available.', v_product.name;
      END IF;

      -- Numeric variant stock is validated/deducted ONLY for non-food products.
      -- Food availability is governed exclusively by the Sold Out toggle above,
      -- per the food architecture (no numeric inventory for food).
      IF NOT v_is_food AND coalesce(v_variant.stock_quantity, 0) < v_qty THEN
        RAISE EXCEPTION 'Sorry, "%" (% %) only has % in stock.', v_product.name,
          coalesce(v_variant.size, ''), coalesce(v_variant.color_name, ''),
          v_variant.stock_quantity;
      END IF;

      -- Use variant price if set, otherwise fall back to base product price
      v_effective_price := coalesce(v_variant.price, v_product.price, 0);
    ELSE
      -- No variant: use base product price. Availability rules differ:
      --   Food products have no numeric stock; the Sold Out toggle above is
      --   the ONLY availability gate.
      --   Non-food products keep the existing in_stock + numeric stock rules.
      IF NOT v_is_food THEN
        IF coalesce(v_product.in_stock, false) = false THEN
          RAISE EXCEPTION 'Sorry, "%" is currently out of stock.', v_product.name;
        END IF;

        IF v_product.stock_quantity IS NOT NULL AND v_product.stock_quantity < v_qty THEN
          RAISE EXCEPTION 'Sorry, "%" only has % in stock.', v_product.name, v_product.stock_quantity;
        END IF;
      END IF;
    END IF;

    v_line_total := v_effective_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  -- Derive order_type exclusively from the items. A MIXED basket (some food,
  -- some non-food) is rejected outright so no ambiguous combined order can
  -- ever be created. The client never supplies order_type.
  IF v_total_count > 0 AND v_food_count = v_total_count THEN
    v_order_type := 'food';
  ELSE
    v_order_type := 'product';
  END IF;

  IF v_food_count > 0 AND v_food_count < v_total_count THEN
    RAISE EXCEPTION 'This basket includes both food and non-food items. Please place separate orders.';
  END IF;

  -- Apply coupon discount
  IF v_coupon_applied THEN
    v_discount := round(v_subtotal * (v_coupon.discount_percent / 100), 2);
    IF v_discount > v_subtotal THEN
      v_discount := v_subtotal;
    END IF;
  END IF;

  -- Admin business settings drive the authoritative totals. Fallbacks match
  -- the historical hard-coded values so an empty row behaves exactly as today.
  SELECT settings.* INTO v_settings FROM public.store_settings settings LIMIT 1;

  -- Shipping: flat charge from Admin → Settings (fallback 200), free when the
  -- (coupon-adjusted) subtotal reaches the Admin free-shipping threshold
  -- (fallback 6500).
  v_shipping := coalesce(v_settings.shipping_charge, 200);
  IF v_subtotal - v_discount >= coalesce(v_settings.free_shipping_threshold, 6500) THEN
    v_shipping := 0;
  END IF;

  -- Tax: an Admin-set PERCENTAGE of the taxable subtotal (Nepal — never an
  -- amount, never an INR/GST model). Fallback 13.
  v_tax := round(
    (v_subtotal - v_discount) * (coalesce(v_settings.tax_percent, 13) / 100),
    2
  );

  v_order_id := gen_random_uuid()::text;
  v_order_number := 'YM-' || to_char(now(), 'YYMMDD') || '-' ||
                    upper(substr(translate(md5(v_order_id), 'abcdef', '123456'), 1, 6));

  INSERT INTO public.orders (
    id, user_id, order_number, created_at,
    customer_name, phone, address, city,
    payment_method, subtotal, shipping, tax, discount, coupon_code, total,
    status, order_type, delivery_latitude, delivery_longitude
  ) VALUES (
    v_order_id, v_user_id, v_order_number, now(),
    coalesce(p_address->>'recipient_name', ''),
    coalesce(p_address->>'phone', ''),
    coalesce(p_address->>'address_line', ''),
    coalesce(p_address->>'city', ''),
    v_payment,
    v_subtotal, v_shipping, v_tax, v_discount,
    v_coupon_code_applied,
    v_subtotal - v_discount + v_tax + v_shipping,
    'Pending',
    v_order_type,
    v_lat, v_lng
  );

  -- Insert order items + deduct stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    v_variant_id := NULL;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item->>'product_id';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A product in your cart no longer exists.';
    END IF;

    IF coalesce(v_product.sold_out, false) = true THEN
      RAISE EXCEPTION 'Sorry, "%" is currently sold out.', v_product.name;
    END IF;

    v_is_food := coalesce(v_product.food_category_id, NULL::uuid) IS NOT NULL;
    v_effective_price := coalesce(v_product.price, 0);

    IF v_item->>'variant_id' IS NOT NULL AND v_item->>'variant_id' <> '' THEN
      v_variant_id := (v_item->>'variant_id')::uuid;

      SELECT * INTO v_variant
      FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product.id AND active = true;

      v_effective_price := coalesce(v_variant.price, v_product.price, 0);

      -- Snapshot variant details into order_items
      INSERT INTO public.order_items (
        order_id, product_id, name, price, quantity, image,
        variant_id, variant_size, variant_color, variant_sku
      ) VALUES (
        v_order_id, v_product.id, v_product.name, v_effective_price,
        v_qty, coalesce(v_variant.image_url, v_product.image),
        v_variant.id, v_variant.size, v_variant.color_name, v_variant.sku
      );

      -- Deduct variant stock atomically and prevent overselling even under
      -- concurrent orders. Food products have NO numeric variant stock, so
      -- their variant stock is never decremented — Sold Out is authoritative.
      IF NOT v_is_food THEN
        UPDATE public.product_variants
        SET stock_quantity = stock_quantity - v_qty
        WHERE id = v_variant.id AND stock_quantity >= v_qty;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'Sorry, "%" (% %) only has % in stock.', v_product.name,
            coalesce(v_variant.size, ''), coalesce(v_variant.color_name, ''),
            coalesce(v_variant.stock_quantity, 0);
        END IF;

        -- If variant stock hit zero, check if product has other active in-stock variants
        IF (SELECT stock_quantity FROM public.product_variants WHERE id = v_variant.id) <= 0 THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.product_variants
            WHERE product_id = v_product.id AND active = true AND stock_quantity > 0
          ) THEN
            UPDATE public.products SET in_stock = false WHERE id = v_product.id;
          END IF;
        END IF;
      END IF;
    ELSE
      -- Non-variant product
      INSERT INTO public.order_items (
        order_id, product_id, name, price, quantity, image
      ) VALUES (
        v_order_id, v_product.id, v_product.name, coalesce(v_product.price, 0),
        v_qty, v_product.image
      );

      -- Deduct base product stock if stock_quantity is tracked. Food products
      -- have no numeric stock, so their stock/quantity is never decremented
      -- and in_stock is left to the admin's Sold Out control.
      IF NOT v_is_food THEN
        IF v_product.stock_quantity IS NOT NULL THEN
          UPDATE public.products
          SET stock_quantity = stock_quantity - v_qty,
              in_stock = (stock_quantity - v_qty > 0)
          WHERE id = v_product.id AND stock_quantity >= v_qty;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'Sorry, "%" only has % in stock.', v_product.name,
              coalesce(v_product.stock_quantity, 0);
          END IF;
        ELSE
          UPDATE public.products
          SET in_stock = false
          WHERE id = v_product.id;
        END IF;
      END IF;
    END IF;

    -- Mark verified purchase on user's reviews
    UPDATE public.reviews
      SET verified_purchase = true, is_edited = is_edited,
          updated_at = coalesce(updated_at, now())
      WHERE user_id = v_user_id AND product_id = v_product.id;
  END LOOP;

  SELECT * INTO v_order_row FROM public.orders WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'id', v_order_row.id,
    'order_number', v_order_row.order_number,
    'status', v_order_row.status,
    'total', v_order_row.total,
    'created_at', v_order_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(jsonb, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, jsonb, text, text) TO authenticated;