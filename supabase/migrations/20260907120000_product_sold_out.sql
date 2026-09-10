-- Manual "Sold Out" product control (manually prepared; NOT yet applied).
--
-- Adds a boolean "manual sold out" flag to products. The flag is independent of
-- stock_quantity: toggling Sold Out never deletes or changes the stored stock
-- quantity. When ON, the product is treated as unavailable for purchase even if
-- the stored stock quantity is greater than 0. When OFF, the existing stock
-- rules resume unchanged.
--
-- The existing products.in_stock boolean is NOT reused as the manual sold-out
-- flag because it is auto-derived from stock_quantity by the admin save flow and
-- by the stock-deduction code inside place_order. This keeps that derivation
-- intact and avoids conflating "out of stock because quantity reached 0" with
-- "the admin manually chose to halt sales".
--
-- The authoritative place_order RPC is re-created with a sold-out guard placed
-- right after each product row is loaded, so a manually sold-out product is
-- rejected server-side even when a stale client sends an order. The guard covers
-- both variant and non-variant ordering paths.
--
-- ---------------------------------------------------------------------------
-- FINAL-SPEC NOTE (2026-09-08): This migration is SUPERSEDED. The `sold_out`
-- column and its Sold-Out server guard are now part of ALREADY-APPLIED
-- 20260907160000_food_categories_independent.sql and the final
-- 20260909000000_food_orders.sql. It is REDUNDANT (its `sold_out add column` is
-- idempotent no-op) and its CREATE OR REPLACE would overwrite the authoritative
-- food-aware place_order with a non-food version. DO NOT APPLY — skip.
-- ---------------------------------------------------------------------------

-- 1. Persistent manual sold-out state (additive, safe default OFF).
alter table public.products add column if not exists sold_out boolean not null default false;

-- 2. Server-side order safety: block orders for manually sold-out products.
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
  v_variant record;
  v_qty integer;
  v_effective_price numeric(12,2);
  v_line_total numeric(12,2);
  v_order_row record;
  v_payment text;
  v_variant_id uuid;
  v_has_variants boolean := false;
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

  -- Validate items + compute subtotal
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

    -- Manual Sold Out guard: the admin's manual override halts ALL purchasing
    -- for this product (variant and non-variant paths) regardless of stock.
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

      IF coalesce(v_variant.stock_quantity, 0) < v_qty THEN
        RAISE EXCEPTION 'Sorry, "%" (% %) only has % in stock.', v_product.name,
          coalesce(v_variant.size, ''), coalesce(v_variant.color_name, ''),
          v_variant.stock_quantity;
      END IF;

      -- Use variant price if set, otherwise fall back to base product price
      v_effective_price := coalesce(v_variant.price, v_product.price, 0);
      v_has_variants := true;
    ELSE
      -- No variant: use base product stock/price
      IF coalesce(v_product.in_stock, false) = false THEN
        RAISE EXCEPTION 'Sorry, "%" is currently out of stock.', v_product.name;
      END IF;

      IF v_product.stock_quantity IS NOT NULL AND v_product.stock_quantity < v_qty THEN
        RAISE EXCEPTION 'Sorry, "%" only has % in stock.', v_product.name, v_product.stock_quantity;
      END IF;
    END IF;

    v_line_total := v_effective_price * v_qty;
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  -- Apply coupon discount
  IF v_coupon_applied THEN
    v_discount := round(v_subtotal * (v_coupon.discount_percent / 100), 2);
    IF v_discount > v_subtotal THEN
      v_discount := v_subtotal;
    END IF;
  END IF;

  -- Shipping: free over threshold
  IF v_subtotal - v_discount >= 6500 THEN
    v_shipping := 0;
  END IF;

  v_tax := round((v_subtotal - v_discount) * 0.13, 2);
  v_order_id := gen_random_uuid()::text;
  v_order_number := 'YM-' || to_char(now(), 'YYMMDD') || '-' ||
                    upper(substr(translate(md5(v_order_id), 'abcdef', '123456'), 1, 6));

  INSERT INTO public.orders (
    id, user_id, order_number, created_at,
    customer_name, phone, address, city,
    payment_method, subtotal, shipping, tax, discount, coupon_code, total,
    status
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
    'Pending'
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
      -- concurrent orders (the WHERE stock_quantity >= v_qty guard makes the
      -- update conditional; if 0 rows matched, stock was insufficient by the
      -- time we committed, so abort rather than over-sell).
      UPDATE public.product_variants
      SET stock_quantity = stock_quantity - v_qty
      WHERE id = v_variant.id AND stock_quantity >= v_qty;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Sorry, "%" (% %) only has % in stock.', v_product.name,
          coalesce(v_variant.size, ''), coalesce(v_variant.color_name, ''),
          coalesce(v_variant.stock_quantity, 0);
      END IF;

      -- If variant stock hit zero, check if product has other active in-stock variants
      -- Only mark base product out_of_stock if ALL variants are out
      IF (SELECT stock_quantity FROM public.product_variants WHERE id = v_variant.id) <= 0 THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.product_variants
          WHERE product_id = v_product.id AND active = true AND stock_quantity > 0
        ) THEN
          UPDATE public.products SET in_stock = false WHERE id = v_product.id;
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

      -- Deduct base product stock if stock_quantity is tracked
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