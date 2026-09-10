-- Food architecture correction: independent food categories + food products
-- (manually prepared; NOT yet applied).
--
-- The original Food section (20260907130000_food_section.sql, already applied)
-- modelled each “Food category” as a JOIN row referencing an existing row of
-- public.categories, with a NOT NULL category_id FK (ON DELETE CASCADE) and a
-- unique constraint. That couples the storefront Food section to the general
-- product-category catalog and makes every card link to
-- /products?category=<name>. This forward migration makes Food categories
-- fully independent Admin-owned records with their own name / slug / artwork /
-- notice / visibility / order, lines each product up under a single food
-- category via products.food_category_id, and exposes every category on the
-- customer app at /{slug}page/all{slug}.
--
-- Behavior changes (all forward, none destructive):
--   1. homepage_food_categories gains independent name/slug/notice columns;
--      every existing row is back-filled from its linked category (safe
--      data-preserving UPDATE of the new columns only).
--   2. category_id becomes a nullable LEGACY column (the FK + unique +
--      NOT NULL constraints are dropped) so deleting a general category can
--      never cascade-delete an Admin-created Food category.
--   3. slug is unique and URL-safe; the storefront resolves {slug}page/all{slug}.
--   4. products.food_category_id (uuid, FK -> homepage_food_categories(id)
--      ON DELETE SET NULL) optionally links a product to one food category;
--      deleting a food category unlinks its products, it never deletes them.
--   5. Food products have NO numeric stock rule: availability is controlled
--      solely by the manual Sold Out toggle (products.sold_out). The
--      authoritative place_order RPC is re-created so the numeric stock check
--      is skipped for food products on BOTH the validate and the deduct paths
--      while all non-food behavior stays exactly as today.
--
-- This migration is self-contained and re-runnable: it idempotently adds the
-- products.sold_out / products.cod_enabled columns the place_order body
-- references, superseding the earlier prepared sold-out work, and recreates
-- place_order as the superset of the coupon scalar fix + COD guard + sold-out
-- guard + food-aware stock skip. No tables, rows or columns are dropped; no
-- policies/grants are revoked.

-- ===========================================================================
-- 1) Independent food category fields.
-- ===========================================================================
alter table public.homepage_food_categories
  add column if not exists name text;

alter table public.homepage_food_categories
  add column if not exists slug text;

alter table public.homepage_food_categories
  add column if not exists notice text;

-- Back-fill existing rows from the category they were joined to. Only the new
-- name/slug fields are written; image/sort_order/is_active are untouched.
do $$
begin
  update public.homepage_food_categories f
  set name = coalesce(nullif(btrim(f.name), ''), c.name),
      slug = coalesce(
        nullif(btrim(f.slug), ''),
        lower(regexp_replace(c.name, '[^a-zA-Z0-9]+', '-', 'g'))
      )
  from public.categories c
  where f.category_id = c.id
    and (f.name is null or btrim(f.name) = '' or f.slug is null or btrim(f.slug) = '');
end $$;

-- Safety net for rows with no legacy category (should not exist yet, but the
-- migration must stay runnable regardless of data state).
do $$
begin
  update public.homepage_food_categories
  set name = coalesce(nullif(btrim(name), ''), 'Category ' || left(id::text, 8))
  where name is null or btrim(name) = '';
end $$;

-- Guarantee URL-safe, unique slugs. Deterministic order (id) so re-running the
-- migration produces identical results. Duplicates are suffixed -2, -3, ...
do $$
declare
  r record;
  base text;
  cand text;
  i int;
begin
  for r in
    select id,
           coalesce(
             nullif(btrim(slug), ''),
             lower(regexp_replace(coalesce(name, 'category'), '[^a-zA-Z0-9]+', '-', 'g'))
           ) as raw_slug
    from public.homepage_food_categories
    order by id
  loop
    -- Collapse leading/trailing/'--' artifacts to a single clean slug.
    base := lower(
      regexp_replace(
        regexp_replace(r.raw_slug, '[^a-z0-9-]+', '-', 'g'),
        '^-+|-+$',
        '',
        'g'
      )
    );
    if base = '' then
      base := 'category-' || left(r.id::text, 8);
    end if;
    cand := base;
    i := 1;
    while exists (
      select 1 from public.homepage_food_categories where slug = cand and id < r.id
    ) loop
      i := i + 1;
      cand := base || '-' || i;
    end loop;
    update public.homepage_food_categories set slug = cand where id = r.id;
  end loop;
end $$;

alter table public.homepage_food_categories alter column name set not null;
alter table public.homepage_food_categories alter column slug set not null;

-- ===========================================================================
-- 2) Detach from the general categories catalog (keep category_id as a nullable
--    legacy column, drop the FK + unique + NOT NULL constraints).
-- ===========================================================================
alter table public.homepage_food_categories
  drop constraint if exists homepage_food_categories_category_id_fkey;

alter table public.homepage_food_categories
  drop constraint if exists homepage_food_categories_category_unique;

alter table public.homepage_food_categories
  alter column category_id drop not null;

-- ===========================================================================
-- 3) Unique index on the independent slug.
-- ===========================================================================
create unique index if not exists homepage_food_categories_slug_key
  on public.homepage_food_categories (slug);

-- Public/admin row-security already grant read on the whole table to
-- anon/authenticated (SELECT policy is_active = true) and Admin CRUD via
-- public.is_admin(); the new columns are covered by the same policies.

-- ===========================================================================
-- 4) products.food_category_id (optional, one food category per product).
-- ===========================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products'
      and column_name = 'food_category_id'
  ) then
    alter table public.products
      add column food_category_id uuid;
  end if;
end $$;

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

-- ===========================================================================
-- 5) Self-contained product columns referenced by the re-created place_order.
--    Idempotent; no-op when an earlier migration already added them.
-- ===========================================================================
alter table public.products add column if not exists sold_out boolean not null default false;
alter table public.products add column if not exists cod_enabled boolean not null default true;

-- ===========================================================================
-- 6) place_order: food-aware availability (Sold Out governs food; numeric
--    stock rules stay authoritative for every non-food product). Built as the
--    superset of the coupon scalar fix, the per-product COD guard and the
--    manual Sold Out guard, with the numeric-stock checks skipped for food.
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
  v_is_food boolean;
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

    v_is_food := coalesce(v_product.food_category_id, NULL::uuid) IS NOT NULL;

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

      IF coalesce(v_variant.stock_quantity, 0) < v_qty THEN
        RAISE EXCEPTION 'Sorry, "%" (% %) only has % in stock.', v_product.name,
          coalesce(v_variant.size, ''), coalesce(v_variant.color_name, ''),
          v_variant.stock_quantity;
      END IF;

      -- Use variant price if set, otherwise fall back to base product price
      v_effective_price := coalesce(v_variant.price, v_product.price, 0);
      v_has_variants := true;
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