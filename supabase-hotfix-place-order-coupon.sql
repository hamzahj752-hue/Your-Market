-- HOTFIX: place_order "record v_coupon is not assigned yet" (SQLSTATE 55000)
--         + food-aware order_type derivation
--
-- Confirmed live error from a signed-in customer request:
--   55000  record "v_coupon" is not assigned yet
--   The tuple structure of a not-yet-assigned record is indeterminate.
--
-- Root cause: the variant-aware place_order dereferences the untyped
--   v_coupon record on paths where no coupon row was ever assigned
--   (blank/NULL coupon, or a code that does not match), which PostgreSQL
--   cannot type-resolve and raises 55000.
--
-- UPDATED: Now matches the final food-aware place_order behavior from
-- 20260909000000_food_orders.sql including:
--   - order_type derivation from items (all-food -> 'food', else 'product')
--   - Mixed food + non-food basket rejection
--   - sold_out manual override for food availability
--   - Food products have no numeric stock (Sold Out is authoritative)
--   - Delivery coordinates persisted
--   - order_type column and CHECK constraint
--   - Product columns (sold_out, cod_enabled, food_category_id)
--
-- This hotfix is built from the CURRENT LIVE variant-aware place_order body
-- (variant pricing, variant validation, variant stock, atomic stock deduction,
-- variant snapshots, verified-purchase update, server-side totals) and changes
-- ONLY the coupon handling:
--   1. adds a nullable scalar  v_coupon_code_applied
--   2. guards the coupon lookup with IF NOT FOUND
--   3. captures the confirmed code into the scalar only after a valid
--      active/non-expired coupon is found
--   4. stores the scalar in the order INSERT instead of dereferencing v_coupon
--   5. hardens EXECUTE ACL (REVOKE from PUBLIC+anon, GRANT to authenticated)
--
-- The scalar-capture pattern matches the established fix already present in
-- supabase/migrations/20260901101000_fix_coupon_record_deref_and_ui.sql.
--
-- No other behavior is changed. Requires manual review; DO NOT auto push.

-- Product columns the function body references (idempotent no-ops when an
-- earlier migration already added them).
alter table public.products add column if not exists sold_out boolean not null default false;
alter table public.products add column if not exists cod_enabled boolean not null default true;
alter table public.products add column if not exists food_category_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where con.conname = 'products_food_category_id_fkey'
      and rel.relname = 'products'
      and ns.nspname = 'public'
  ) then
    alter table public.products
      add constraint products_food_category_id_fkey
      foreign key (food_category_id)
      references public.homepage_food_categories(id)
      on delete set null;
  end if;
end $$;

create index if not exists products_food_category_idx
  on public.products (food_category_id);

-- Delivery coordinates on orders (idempotent no-op when already present).
alter table public.addresses
  add column if not exists latitude double precision;
alter table public.addresses
  add column if not exists longitude double precision;
alter table public.orders
  add column if not exists delivery_latitude double precision;
alter table public.orders
  add column if not exists delivery_longitude double precision;

-- orders.order_type — Food vs product separation.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders'
      and column_name = 'order_type'
  ) then
    alter table public.orders add column order_type text not null default 'product';
  end if;
end $$;

-- Enforce an explicit value domain regardless of whether the column pre-existed.
do $$
begin
  alter table public.orders drop constraint if exists orders_order_type_check;
  alter table public.orders
    add constraint orders_order_type_check
    check (order_type in ('product', 'food'));
end $$;

create index if not exists orders_order_type_idx
  on public.orders (order_type);

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
      -- concurrent orders (the WHERE stock_quantity >= v_qty guard makes the
      -- update conditional; if 0 rows matched, stock was insufficient by the
      -- time we committed, so abort rather than over-sell).
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
        -- Only mark base product out_of_stock if ALL variants are out
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
